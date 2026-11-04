
(() => {
  'use strict';
  const script = document.currentScript;
  const dataURL = new URL('../grasp-viewer/object-frame-projections.json?v=real-camera-xyz-1', script.src);
  const siteURL = new URL('../../', script.src);
  const svgNS = 'http://www.w3.org/2000/svg';
  const hosts = new WeakMap();
  let projections;
  const metadata = () => projections ||= fetch(dataURL).then(response => {
    if (!response.ok) throw new Error('Object coordinate projections unavailable');
    return response.json();
  }).then(data => data.images).catch(() => { projections = null; return {}; });
  const svgNode = (tag, attrs = {}, text) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    if (text) node.textContent = text;
    return node;
  };
  const imageKey = image => {
    if (!image?.src || /^(data|blob):/.test(image.src)) return '';
    const url = new URL(image.currentSrc || image.src, location.href);
    if (url.origin !== siteURL.origin || !url.pathname.startsWith(siteURL.pathname)) return '';
    return decodeURIComponent(url.pathname.slice(siteURL.pathname.length));
  };
  function draw(projection) {
    const [width, height] = projection.imageSize;
    const overlay = svgNode('svg', {
      class: 'object-frame-overlay', viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'Object-local axes: X red, Y green, Z blue',
      'data-object': projection.object, 'data-pose': projection.pose,
    });
    overlay.append(svgNode('title', {}, 'Object mesh coordinates · X / Y / Z'));
    const [ox, oy] = projection.origin;
    const labels = [];
    projection.axes.forEach(axis => {
      const [x, y] = axis.end, dx = x - ox, dy = y - oy;
      const length = Math.hypot(dx, dy), ux = length > 0.1 ? dx / length : 0;
      const uy = length > 0.1 ? dy / length : -1;
      if (length >= 5) {
        const arrow = Math.min(14, length * 0.32);
        const path = `M ${ox} ${oy} L ${x} ${y} M ${x - arrow * ux + arrow * 0.5 * uy} ${y - arrow * uy - arrow * 0.5 * ux} L ${x} ${y} L ${x - arrow * ux - arrow * 0.5 * uy} ${y - arrow * uy + arrow * 0.5 * ux}`;
        overlay.append(svgNode('path', {d: path, class: 'object-frame-overlay__halo'}));
        overlay.append(svgNode('path', {d: path, stroke: axis.color, class: 'object-frame-overlay__axis'}));
      } else {

        overlay.append(svgNode('circle', {cx: x, cy: y, r: 9, stroke: axis.color, class: 'object-frame-overlay__end'}));
      }
      const label = {axis, x: Math.max(18, Math.min(width - 18, x + ux * 23)),
        y: Math.max(24, Math.min(height - 18, y + uy * 23))};
      for (const previous of labels) {
        if (Math.hypot(label.x - previous.x, label.y - previous.y) < 29) label.y = Math.max(24, Math.min(height - 18, previous.y + 30));
      }
      labels.push(label);
    });
    overlay.append(svgNode('circle', {cx: ox, cy: oy, r: 5, class: 'object-frame-overlay__origin'}));
    for (const label of labels) overlay.append(svgNode('text', {x: label.x, y: label.y,
      fill: label.axis.color, class: 'object-frame-overlay__label'}, label.axis.label));
    return overlay;
  }
  function mount(host) {
    if (hosts.has(host)) return;
    const state = {version: 0, key: '', overlay: null};
    hosts.set(host, state);
    const update = async () => {
      const image = host.querySelector('img');
      const key = imageKey(image);
      if (state.key === key && state.image === image && state.overlay && !image.hidden && image.complete && image.naturalWidth) return;
      const version = ++state.version;
      state.overlay?.remove(); state.overlay = null;
      state.key = key; state.image = image;
      if (!key || image.hidden || !image.complete || !image.naturalWidth) return;
      const records = await metadata();
      if (state.version !== version || imageKey(image) !== key || image.hidden || host.querySelector('img') !== image) return;
      const projection = records[key];
      if (!projection) return;
      state.overlay = draw(projection); host.append(state.overlay);
    };
    host.addEventListener('load', event => { if (event.target.tagName === 'IMG') update(); }, true);
    host.addEventListener('error', event => { if (event.target.tagName === 'IMG') { ++state.version; state.overlay?.remove(); state.overlay = null; } }, true);
    new MutationObserver(records => {
      if (records.some(record => record.type === 'attributes' ? record.target.tagName === 'IMG'
        : [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && node.tagName === 'IMG'))) update();
    }).observe(host, {subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'hidden']});
    update();
  }
  const init = () => document.querySelectorAll('#simulation-transfer-player .simulation-final-goal, #real-transfer-player .any2any-goal-ghost, #simulation-transfer-player .grasp-viewer__stage, #real-transfer-player .grasp-viewer__stage').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
