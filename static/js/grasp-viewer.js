
(() => {
  'use strict';
  const script = document.currentScript;
  const base = new URL('../grasp-viewer/', script ? script.src : new URL('static/js/grasp-viewer.js', location.href));
  const states = new WeakMap();
  let manifestPromise, handPromise, renderer, active, generation = 0;
  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const scale = (a, s) => a.map(v => v * s);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => scale(a, 1 / Math.max(1e-12, Math.hypot(...a)));
  const rotate = (v, axis, angle) => add(add(scale(v, Math.cos(angle)), scale(cross(axis, v), Math.sin(angle))), scale(axis, dot(axis, v) * (1 - Math.cos(angle))));
  const multiply = (a, b) => {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return out;
  };


  function projectPoint(matrix, point, width, height) {
    const clip = [0, 1, 2, 3].map(r => matrix[r] * point[0] + matrix[4 + r] * point[1] + matrix[8 + r] * point[2] + matrix[12 + r]);
    if (!clip.every(Number.isFinite) || clip[3] <= 0 || Math.abs(clip[2]) > clip[3]) return null;
    return [(clip[0] / clip[3] + 1) * width / 2, (1 - clip[1] / clip[3]) * height / 2, clip[2] / clip[3]];
  }
  function drawObjectAxes(context, matrix, mesh, width, height) {
    const origin = projectPoint(matrix, [0, 0, 0], width, height);
    const extent = Math.max(...mesh.span);
    if (!origin || !Number.isFinite(extent) || extent <= 0) return;
    const length = Math.max(0.025, Math.min(0.065, extent * 0.32));
    const axes = ['X', 'Y', 'Z'].map((label, i) => ({
      label, color: ['#ff6675', '#56df9b', '#65adff'][i],
      end: projectPoint(matrix, [0, 1, 2].map(j => i === j ? length : 0), width, height)
    })).filter(axis => axis.end).sort((a, b) => b.end[2] - a.end[2]);
    context.save();
    context.lineCap = 'round'; context.lineJoin = 'round';
    context.font = '600 11px system-ui, sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    const labels = [];
    axes.forEach(({label, color, end}) => {
      const dx = end[0] - origin[0], dy = end[1] - origin[1], distance = Math.hypot(dx, dy);


      const ux = distance > 0.1 ? dx / distance : 0, uy = distance > 0.1 ? dy / distance : -1;
      const head = Math.min(6, distance * 0.32), half = head * 0.5;
      context.beginPath(); context.moveTo(origin[0], origin[1]); context.lineTo(end[0], end[1]);
      if (head > 0.5) {
        context.moveTo(end[0] - ux * head - uy * half, end[1] - uy * head + ux * half);
        context.lineTo(end[0], end[1]);
        context.lineTo(end[0] - ux * head + uy * half, end[1] - uy * head - ux * half);
      }
      context.strokeStyle = 'rgba(5, 14, 20, .84)'; context.lineWidth = 4; context.stroke();
      context.strokeStyle = color; context.lineWidth = 1.8; context.stroke();


      const candidates = [[9, 0], [18, 0], [9, 13], [9, -13], [18, 13], [18, -13], [9, 26], [9, -26]]
        .map(([forward, side]) => [end[0] + ux * forward - uy * side, end[1] + uy * forward + ux * side]);
      const [x, y] = candidates.find(([cx, cy]) => labels.every(([lx, ly]) => Math.abs(cx - lx) >= 12 || Math.abs(cy - ly) >= 15)) || candidates[0];
      labels.push([x, y]);
      context.strokeStyle = 'rgba(5, 14, 20, .95)'; context.lineWidth = 3;
      context.strokeText(label, x, y); context.fillStyle = color; context.fillText(label, x, y);
    });
    context.beginPath(); context.arc(origin[0], origin[1], 2.2, 0, Math.PI * 2);
    context.fillStyle = '#eef6f2'; context.fill(); context.strokeStyle = '#091119'; context.lineWidth = 1; context.stroke();
    context.restore();
  }
  const title = value => (value || '').replace(/^sim[:/]/, '').replace(/_\d+$/, '').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());
  async function response(url) {
    const value = await fetch(url);
    if (!value.ok) throw new Error('The mesh asset could not be loaded.');
    return value;
  }
  function manifest() {
    if (!manifestPromise) manifestPromise = response(new URL('public-manifest.json?v=real-camera-xyz-1', base)).then(r => r.json()).catch(e => { manifestPromise = null; throw e; });
    return manifestPromise;
  }
  async function bundle(path) {
    const bytes = await (await response(new URL(path, base))).arrayBuffer();
    const headLength = new DataView(bytes).getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 4, headLength)));
    if (header.format !== 'DGM1') throw new Error('Unsupported mesh format.');
    return { bytes, start: 4 + headLength, meshes: header.meshes };
  }
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function button(text, label, onClick) {
    const node = make('button', 'grasp-viewer__button', text);
    node.type = 'button';
    node.setAttribute('aria-label', label || text);
    node.addEventListener('click', onClick);
    return node;
  }
  const vertexShader = `
    attribute vec3 aPosition, aNormal, aColor;
    attribute vec2 aUV;
    uniform mat4 uMVP, uModel;
    uniform vec3 uMin, uSpan;
    varying vec3 vNormal, vColor, vPosition;
    varying vec2 vUV;
    void main() {
      vec3 p = uMin + aPosition * uSpan;
      gl_Position = uMVP * vec4(p, 1.0);
      vPosition = (uModel * vec4(p, 1.0)).xyz;
      vNormal = mat3(uModel) * aNormal;
      vColor = aColor; vUV = aUV;
    }`;
  const fragmentShader = `
    precision mediump float;
    varying vec3 vNormal, vColor, vPosition;
    varying vec2 vUV;
    uniform vec3 uColor, uEye, uUp;
    uniform bool uVertexColor, uTextured, uSilver;
    uniform sampler2D uTexture;
    void main() {
      vec3 color = uTextured ? texture2D(uTexture, vUV).rgb : (uVertexColor ? vColor : uColor);
      vec3 n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
      vec3 view = normalize(uEye - vPosition);
      vec3 light = normalize(view + uUp * 0.7 + vec3(0.2, 0.1, 0.3));
      float diffuse = max(dot(n, light), 0.0);
      float lightness = 0.79 + 0.21 * diffuse;
      float specular = uSilver ? pow(max(dot(n, normalize(light + view)), 0.0), 38.0) * 0.15 : 0.0;
      gl_FragColor = vec4(min(color * lightness + specular, vec3(1.0)), 1.0);
    }`;
  class MeshRenderer {
    constructor() {
      this.canvas = make('canvas', 'grasp-viewer__canvas');
      this.axes = make('canvas', 'grasp-viewer__axes');
      this.axes.setAttribute('aria-hidden', 'true');
      this.axesContext = this.axes.getContext('2d');
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute('role', 'img');
      this.canvas.setAttribute('aria-label', 'Interactive triangle mesh with object-local axes: X red, Y green, Z blue. Drag to rotate, scroll to zoom, arrow keys to rotate, R to reset.');
      this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!this.gl) throw new Error('WebGL is unavailable in this browser. The target image remains available.');
      const gl = this.gl;
      this.uint32 = gl.getExtension('OES_element_index_uint');
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('The mesh shader is unavailable.');
        return shader;
      };
      const vs = compile(gl.VERTEX_SHADER, vertexShader), fs = compile(gl.FRAGMENT_SHADER, fragmentShader);
      this.program = gl.createProgram();
      gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('The mesh renderer could not start.');
      this.locations = {};
      ['aPosition', 'aNormal', 'aColor', 'aUV'].forEach(k => { this.locations[k] = gl.getAttribLocation(this.program, k); });
      ['uMVP', 'uModel', 'uMin', 'uSpan', 'uEye', 'uUp', 'uColor', 'uVertexColor', 'uTextured', 'uSilver', 'uTexture'].forEach(k => { this.locations[k] = gl.getUniformLocation(this.program, k); });
      gl.enable(gl.DEPTH_TEST); gl.clearColor(0.025, 0.045, 0.055, 1);
      this.pointer = new Map();
      this.canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        this.canvas.setPointerCapture(e.pointerId);
        this.pointer.set(e.pointerId, [e.clientX, e.clientY]);
      });
      this.canvas.addEventListener('pointermove', e => {
        if (!this.pointer.has(e.pointerId)) return;
        const old = this.pointer.get(e.pointerId), next = [e.clientX, e.clientY];
        if (this.pointer.size === 1) this.orbit((next[0] - old[0]) * 0.008, (next[1] - old[1]) * 0.008);
        else {
          const other = [...this.pointer].find(([id]) => id !== e.pointerId)[1];
          const before = Math.hypot(old[0] - other[0], old[1] - other[1]);
          const after = Math.hypot(next[0] - other[0], next[1] - other[1]);
          if (before > 1 && after > 1) this.zoom(before / after);
        }
        this.pointer.set(e.pointerId, next);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => this.canvas.addEventListener(type, e => this.pointer.delete(e.pointerId)));
      this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * 0.002)); }, { passive: false });
      this.canvas.addEventListener('keydown', e => {
        const actions = { ArrowLeft: () => this.orbit(-0.12, 0), ArrowRight: () => this.orbit(0.12, 0), ArrowUp: () => this.orbit(0, -0.12), ArrowDown: () => this.orbit(0, 0.12), '+': () => this.zoom(0.9), '=': () => this.zoom(0.9), '-': () => this.zoom(1.1), r: () => this.reset(), R: () => this.reset() };
        if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
      });
      this.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault(); generation++;
        if (active) { active.status.textContent = '3D paused by the browser. Select Explore to reload.'; active.root.classList.remove('is-active'); }
        if (this.resize) this.resize.disconnect();
        if (this.visibility) this.visibility.disconnect();
        this.hand = null; this.object = null; renderer = null; active = null; this.canvas.remove(); this.axes.remove();
      });
      this.resize = new ResizeObserver(() => this.request());
      this.resize.observe(this.canvas);
      this.visibility = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) this.request(); });
      this.visibility.observe(this.canvas);
    }
    upload(data) {
      const gl = this.gl;
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data.bytes, data.start), gl.STATIC_DRAW);
      const index = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);

      const packedIndices = [], meshes = data.meshes.map(m => {
        if (m.index_type === 32 && !this.uint32) throw new Error('This browser cannot display this high-resolution mesh.');
        const length = m.triangles * 3 * m.index_type / 8;
        const offset = packedIndices.reduce((total, part) => total + part.byteLength, 0);
        packedIndices.push(new Uint8Array(data.bytes, data.start + m.index, length));
        const padding = (4 - length % 4) % 4;
        if (padding) packedIndices.push(new Uint8Array(padding));
        return { ...m, index_offset: offset };
      });
      const total = packedIndices.reduce((n, p) => n + p.byteLength, 0), joined = new Uint8Array(total);
      let offset = 0;
      packedIndices.forEach(part => { joined.set(part, offset); offset += part.byteLength; });
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, joined, gl.STATIC_DRAW);
      return { buffer, index, meshes, textures: [] };
    }
    disposeObject() {
      if (!this.object) return;
      this.gl.deleteBuffer(this.object.buffer); this.gl.deleteBuffer(this.object.index);
      this.object.textures.forEach(texture => this.gl.deleteTexture(texture));
      this.object = null;
    }
    async texture(path) {
      const image = new Image();
      image.src = new URL(path, base).href;
      await image.decode();
      const gl = this.gl, texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return texture;
    }
    reset() {
      if (!active || !active.record) return;
      const rec = active.record, pose = rec.poses[active.pose], E = (pose.camera || rec.camera).extrinsic;
      this.focus = pose.center.slice();
      this.eye = [0, 1, 2].map(c => -(E[0][c] * E[0][3] + E[1][c] * E[1][3] + E[2][c] * E[2][3]));
      this.up = scale(E[1].slice(0, 3), -1);
      this.radius = pose.radius;
      this.exact = active.pose === 'target' && rec.provenance === 'recorded-real-start-target';
      this.initialBasis = { right: E[0].slice(0, 3), backward: scale(E[2].slice(0, 3), -1) };
      if (!this.exact) {
        const direction = unit(scale(E[2].slice(0, 3), -1));
        this.eye = add(this.focus, scale(direction, pose.fit_distance || this.radius * 2.4));
      }
      this.request();
    }
    orbit(dx, dy) {
      if (!this.eye) return;
      this.exact = false;
      let relative = sub(this.eye, this.focus);
      relative = rotate(relative, unit(this.up), -dx);
      const right = unit(cross(this.up, relative));
      relative = rotate(relative, right, -dy);
      this.up = unit(rotate(this.up, right, -dy));
      this.eye = add(this.focus, relative); this.request();
    }
    zoom(factor) {
      if (!this.eye) return;
      this.exact = false;
      const relative = sub(this.eye, this.focus), length = Math.hypot(...relative);
      this.eye = add(this.focus, scale(relative, Math.max(this.radius * 1.05, Math.min(this.radius * 10, length * factor)) / length));
      this.request();
    }
    request() {
      if (this.frame || document.hidden) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); });
    }
    draw() {
      if (!active || !active.record || active.root.classList.contains('is-loading') || !this.object || !this.hand || !this.eye || !this.canvas.isConnected) return;
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return;
      const gl = this.gl, dpr = Math.min(devicePixelRatio || 1, 1.5);
      const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      if (this.axes.width !== width || this.axes.height !== height) { this.axes.width = width; this.axes.height = height; }
      gl.viewport(0, 0, width, height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
      const backward = this.exact ? this.initialBasis.backward : unit(sub(this.eye, this.focus));
      const right = this.exact ? this.initialBasis.right : unit(cross(this.up, backward));
      const up = unit(cross(backward, right));
      const view = new Float32Array([right[0], up[0], backward[0], 0, right[1], up[1], backward[1], 0, right[2], up[2], backward[2], 0, -dot(right, this.eye), -dot(up, this.eye), -dot(backward, this.eye), 1]);
      const camera = active.record.poses[active.pose].camera || active.record.camera, K = camera.intrinsic;
      const aspect = width / height, f = 2 * K[1][1] / camera.height, near = 0.001, far = 20;
      const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -2 * far * near / (far - near), 0]);
      const vp = multiply(projection, view), loc = this.locations;
      gl.uniform3fv(loc.uEye, this.eye); gl.uniform3fv(loc.uUp, up); gl.uniform1i(loc.uTexture, 0);
      const renderMesh = (resource, meshIndex, model, silver) => {
        const mesh = resource.meshes[meshIndex];
        gl.bindBuffer(gl.ARRAY_BUFFER, resource.buffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resource.index);
        const attr = (key, size, type, normalized, offset) => {
          const location = loc[key];
          if (offset === undefined) { gl.disableVertexAttribArray(location); return; }
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, type, normalized, 0, offset);
        };
        attr('aPosition', 3, gl.UNSIGNED_SHORT, true, mesh.position);
        attr('aNormal', 3, gl.BYTE, true, mesh.normal);
        attr('aColor', 3, gl.UNSIGNED_BYTE, true, mesh.vertex_color);
        attr('aUV', 2, gl.FLOAT, false, mesh.uv);
        gl.uniformMatrix4fv(loc.uModel, false, model);
        gl.uniformMatrix4fv(loc.uMVP, false, multiply(vp, model));
        gl.uniform3fv(loc.uMin, mesh.min); gl.uniform3fv(loc.uSpan, mesh.span);


        const simulationObject = !silver && active.object.startsWith('sim:');
        gl.uniform3fv(loc.uColor, simulationObject ? [0.08, 0.38, 0.90] : mesh.color || [1, 1, 1]);
        gl.uniform1i(loc.uVertexColor, !simulationObject && mesh.vertex_color !== undefined);
        gl.uniform1i(loc.uTextured, !simulationObject && Boolean(mesh.gpuTexture)); gl.uniform1i(loc.uSilver, silver);
        if (mesh.gpuTexture) gl.bindTexture(gl.TEXTURE_2D, mesh.gpuTexture);
        gl.drawElements(gl.TRIANGLES, mesh.triangles * 3, mesh.index_type === 32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, mesh.index_offset);
      };
      const pose = active.record.poses[active.pose];
      pose.hand_nodes.forEach(node => renderMesh(this.hand, node.mesh, new Float32Array(node.matrix), true));
      const objectModel = new Float32Array(pose.object_matrix);
      renderMesh(this.object, 0, objectModel, false);
      if (this.axesContext) {
        const context = this.axesContext;
        context.setTransform(width / rect.width, 0, 0, height / rect.height, 0, 0);
        context.clearRect(0, 0, rect.width, rect.height);
        drawObjectAxes(context, multiply(vp, objectModel), this.object.meshes[0], rect.width, rect.height);
      }
    }
  }
  function updateLabels(state) {
    const record = state.record;
    const simulation = state.object.startsWith('sim:');
    const sourceSelected = simulation ? state.pose.startsWith('source') : state.pose === 'init';
    state.name.textContent = record ? record.label : state.root.dataset.label || title(state.object);
    state.kind.textContent = simulation ? 'Configuration preview' : 'Recorded grasp';
    state.source.textContent = simulation ? 'Source' : 'Init';
    state.source.setAttribute('aria-label', simulation ? 'Show source grasp' : 'Show measured initialization grasp');
    state.source.classList.toggle('is-selected', sourceSelected);
    state.target.classList.toggle('is-selected', state.pose.startsWith('target'));
    state.source.setAttribute('aria-pressed', String(sourceSelected));
    state.target.setAttribute('aria-pressed', String(state.pose.startsWith('target')));
    if (!simulation && record?.poses.init) {
      const init = record.poses.init;
      state.source.title = init.semantics || 'Measured initialization; not registered to the video first frame.';
    } else {
      state.source.title = title(state.sourcePose || 'source');
    }
    state.target.title = title(state.targetPose || 'target');
    state.root.dataset.configuration = `${state.object}/${state.pose}`;
  }
  function applyPreviewOptions(state, options) {
    if (options.sourcePose !== undefined) state.sourcePose = options.sourcePose;
    if (options.targetPose !== undefined) state.targetPose = options.targetPose;
    if (options.label) state.root.dataset.label = options.label;
    if (options.posePosters) Object.assign(state.posePosters, options.posePosters);

    if (options.poster !== undefined) state.posePosters[options.posterPose || options.pose || state.pose] = options.poster;
  }
  function updatePoster(state) {
    const key = `${state.object}/${state.pose}`;
    const src = state.snapshots.get(key) || state.posePosters[state.pose] || '';
    if (state.posterKey === key && state.posterSource === src) return;
    state.posterKey = key; state.posterSource = src;
    if (state.status.textContent === state.posterMessage) state.status.textContent = '';
    state.posterMessage = '';


    const image = make('img', 'grasp-viewer__poster');


    image.loading = 'eager'; image.decoding = 'async'; image.hidden = true;
    image.alt = `${state.record?.label || state.root.dataset.label || title(state.object)}, ${title(state.pose)} grasp preview`;
    state.poster.replaceWith(image); state.poster = image;
    state.root.dataset.posterState = src ? 'loading' : 'unavailable';
    if (!src) return;
    const current = () => state.poster === image && state.posterKey === key;
    const show = () => {
      if (!current() || !image.naturalWidth) return;
      image.hidden = false; state.root.dataset.posterState = 'ready';
    };
    image.addEventListener('load', show);
    image.addEventListener('error', () => {
      if (!current()) return;
      image.hidden = true; state.root.dataset.posterState = 'error';
      state.posterMessage = 'The preview image could not load. Explore the grasp in 3D to view it.';
      if (!state.root.classList.contains('is-active') && !state.root.classList.contains('is-loading') && !state.status.textContent) {
        state.status.textContent = state.posterMessage;
      }
    });
    image.src = src;
    if (image.complete) show();
  }
  function capturePreview(state) {
    if (active !== state || !renderer || !state.record || !state.root.classList.contains('is-active') || state.root.classList.contains('is-loading')) return;
    const canvas = renderer.canvas, rect = canvas.getBoundingClientRect();
    if (!canvas.isConnected || !rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return;
    try {


      renderer.draw();
      const composite = make('canvas'); composite.width = canvas.width; composite.height = canvas.height;
      const context = composite.getContext('2d');
      if (!context) return;
      context.drawImage(canvas, 0, 0); context.drawImage(renderer.axes, 0, 0);
      const snapshot = composite.toDataURL('image/webp', 0.88);
      if (snapshot.startsWith('data:image/')) state.snapshots.set(`${state.object}/${state.pose}`, snapshot);
    } catch {                                                                      }
  }
  function deactivate(state) {
    if (!state) return;
    capturePreview(state);
    if (state.dialog?.open) state.dialog.close();
    state.root.classList.remove('is-active', 'is-loading');
    state.start.disabled = false;
    state.status.textContent = '';
    if (active === state) { generation++; active = null; if (renderer) { renderer.canvas.remove(); renderer.axes.remove(); renderer.pointer.clear(); } }
    const key = `${state.object}/${state.pose}`, target = state.targetPose || 'target';
    if (!state.snapshots.has(key) && !state.posePosters[state.pose] && state.posePosters[target]) setPose(state.root, target);
    else updatePoster(state);
    state.status.textContent = state.posterMessage || '';
  }
  async function activate(state) {
    ++generation;
    if (active && active !== state) deactivate(active);

    const current = generation;
    active = state; state.root.classList.remove('is-active'); state.root.classList.add('is-loading'); state.start.disabled = true;
    renderer?.canvas.remove(); renderer?.axes.remove();
    state.status.textContent = 'Loading triangle meshes…';
    try {
      const data = await manifest();
      if (active !== state || current !== generation) return;
      const record = data.objects[state.object];
      if (!record) throw new Error('No verified mesh configuration is available for this object.');
      if (!record.poses[state.pose]) state.pose = Object.hasOwn(record.poses, 'target') ? 'target' : Object.keys(record.poses)[0];
      state.record = record;
      updatePoster(state);
      if (!renderer) renderer = new MeshRenderer();
      if (!handPromise) handPromise = bundle(data.hand).catch(error => { handPromise = null; throw error; });
      const [hand, object] = await Promise.all([handPromise, bundle(record.mesh)]);
      if (active !== state || current !== generation) return;
      if (!renderer.hand) renderer.hand = renderer.upload(hand);
      renderer.disposeObject(); renderer.object = renderer.upload(object);
      for (const mesh of renderer.object.meshes) {
        if (mesh.texture && !state.object.startsWith('sim:')) {
          const texture = await renderer.texture(mesh.texture);
          if (active !== state || current !== generation) { renderer.gl.deleteTexture(texture); return; }
          mesh.gpuTexture = texture; renderer.object.textures.push(texture);
        }
      }
      state.stage.append(renderer.canvas, renderer.axes);
      state.root.classList.remove('is-loading'); state.root.classList.add('is-active'); state.start.disabled = false;
      state.status.textContent = '';
      updateLabels(state); renderer.reset();
      state.root.dispatchEvent(new CustomEvent('graspviewer:ready', { detail: { object: state.object, pose: state.pose }, bubbles: true }));
    } catch (error) {
      if (active !== state || current !== generation) return;
      state.root.classList.remove('is-loading', 'is-active'); state.start.disabled = false;
      state.status.textContent = error.message || 'The 3D preview could not load. Please try again.';
      state.root.dispatchEvent(new CustomEvent('graspviewer:error', { detail: { message: state.status.textContent }, bubbles: true }));
    }
  }
  function mount(root, options = {}) {
    if (typeof root === 'string') root = document.querySelector(root);
    if (!root) return null;
    if (states.has(root)) return states.get(root);
    root.classList.add('grasp-viewer');
    const state = { root, object: options.object || root.dataset.object || 'banana_011', pose: options.pose || root.dataset.pose || 'target', posePosters: {}, snapshots: new Map() };
    const top = make('div', 'grasp-viewer__heading');
    state.kind = make('span', 'grasp-viewer__eyebrow', 'Recorded grasp'); state.name = make('strong', 'grasp-viewer__name');
    top.append(state.kind, state.name);
    state.stage = make('div', 'grasp-viewer__stage');
    state.poster = make('img', 'grasp-viewer__poster'); state.poster.hidden = true;
    applyPreviewOptions(state, root.dataset.poster ? {poster: root.dataset.poster, ...options} : options);
    state.start = button('Explore grasp in 3D', 'Explore grasp in 3D', () => activate(state));
    state.start.classList.add('grasp-viewer__start');
    const icon = make('span', 'grasp-viewer__cube', '◇'); icon.setAttribute('aria-hidden', 'true');
    state.stage.append(state.poster, icon, state.start);
    const toolbar = make('div', 'grasp-viewer__toolbar');
    const poses = make('div', 'grasp-viewer__poses');
    state.source = button('Source', 'Show source grasp', () => setPose(root,
      state.object.startsWith('sim:') ? state.sourcePose || 'source' : 'init'));
    state.target = button('Target', 'Show target grasp', () => setPose(root, state.targetPose || 'target'));
    poses.append(state.source, state.target);
    const controls = make('div', 'grasp-viewer__controls');
    controls.append(button('−', 'Zoom out', () => renderer && renderer.zoom(1.15)), button('+', 'Zoom in', () => renderer && renderer.zoom(1 / 1.15)), button('↺', 'Reset camera', () => renderer && renderer.reset()), button('×', 'Close interactive preview', () => deactivate(state)));
    const expand = button('Expand', 'Expand interactive 3D view', () => {
      if (state.dialog?.open) { state.dialog.close(); return; }
      const marker = document.createComment('Expanded 3D viewer');
      root.before(marker);
      const dialog = make('dialog', 'grasp-viewer-dialog');
      dialog.setAttribute('aria-label', `${state.name.textContent} interactive 3D view`);
      state.dialog = dialog;
      dialog.append(root);
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        marker.replaceWith(root);
        dialog.remove();
        state.dialog = null;
        expand.textContent = 'Expand';
        expand.setAttribute('aria-label', 'Expand interactive 3D view');
        expand.focus({preventScroll: true});
        renderer?.request();
      }, {once: true});
      dialog.showModal();
      expand.textContent = 'Exit';
      expand.setAttribute('aria-label', 'Exit expanded 3D view');
      renderer?.request();
    });
    expand.classList.add('grasp-viewer__expand');
    controls.prepend(expand);
    toolbar.append(poses, controls);
    const help = make('span', 'grasp-viewer__help', 'Drag to rotate · scroll / pinch to zoom · Object axes: X red, Y green, Z blue');
    state.status = make('p', 'grasp-viewer__status'); state.status.setAttribute('role', 'status');
    root.append(top, state.stage, toolbar, help, state.status);
    states.set(root, state); updateLabels(state); updatePoster(state);
    return state;
  }
  function setObject(root, object, options = {}) {
    const state = mount(root);
    if (!state) return;
    const wasActive = active === state;
    const changed = state.object !== object;
    state.object = object; state.pose = options.pose || (changed ? 'target' : state.pose);
    state.root.dataset.object = object;
    if (changed) { state.record = null; state.posePosters = {}; state.sourcePose = undefined; state.targetPose = undefined; }
    applyPreviewOptions(state, options);
    updateLabels(state); updatePoster(state);
    if (wasActive) activate(state);
  }
  function setPose(root, pose) {
    const state = mount(root);
    if (!state) return;
    state.pose = pose;
    updatePoster(state);
    if (active === state && state.record && state.record.poses[pose]) { updateLabels(state); renderer.reset(); }
    else if (active === state) activate(state);
    else updateLabels(state);
    state.root.dispatchEvent(new CustomEvent('graspviewer:posechange', { detail: { object: state.object, pose }, bubbles: true }));
  }
  function setConfiguration(root, objectOrId, configuration, options = {}) {
    let object = objectOrId, pose = configuration;
    if (!pose) { const split = objectOrId.lastIndexOf('/'); object = objectOrId.slice(0, split); pose = objectOrId.slice(split + 1); }
    const state = mount(root);
    if (state && state.object === object && state.record && state.record.poses[pose]) {
      applyPreviewOptions(state, {...options, pose});
      setPose(root, pose);
    }
    else setObject(root, object, { ...options, pose });
  }
  window.DexGraspViewer = { mount, setObject, setPose, setConfiguration, activate: root => activate(mount(root)), deactivate: root => deactivate(mount(root)) };
  const init = () => document.querySelectorAll('.grasp-viewer[data-object]').forEach(root => mount(root));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.dispatchEvent(new CustomEvent('graspviewerready'));
  document.addEventListener('visibilitychange', () => { if (renderer && !document.hidden) renderer.request(); });
})();
