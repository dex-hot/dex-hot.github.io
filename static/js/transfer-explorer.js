'use strict';


(() => {
  const assetBase = './static/simulation-transfers/';
  const realObjects = {
    'medicine-bottle': 'medicine_bottle_034', banana: 'banana_011',
    'tape-measure': 'tape_measure_009', 'shampoo-bottle': 'shampoo_037',
    hammer: 'hammer_002', 'tennis-ball': 'tennis_ball', mouse: 'mouse',
    flashlight: 'flashlight', 'facial-cream': 'facial_cream_000', screwdriver: 'screwdriver',
  };
  let pairRequest;
  const getPairs = () => pairRequest ||= fetch(`${assetBase}manifest.json?v=real-camera-xyz-1`)
    .then((response) => { if (!response.ok) throw new Error('Recordings unavailable'); return response.json(); })
    .catch((error) => { pairRequest = null; throw error; });
  let distanceRequest;
  const getDistances = () => distanceRequest ||= fetch(`${assetBase}pair-distances.json?v=transfer-kp-distance-1`)
    .then((response) => { if (!response.ok) throw new Error('Distances unavailable'); return response.json(); })
    .catch((error) => { distanceRequest = null; throw error; });
  const panels = [];
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const updatePreview = (state) => {
    if (!state.data) return;
    const pose = state.side === 'source' ? state.data.sources[state.source] : state.data.targets[state.target];
    const posePosters = {};
    for (const [index, target] of state.data.targets.entries()) {
      const clip = state.data.recordings.find(item => item.target_slot === index && item.final_target);
      if (clip) posePosters[target.key] = assetBase + clip.final_target;
    }
    state.viewer.dataset.pose = pose.key;
    state.viewer.dataset.poster = posePosters[pose.key] || '';
    window.DexGraspViewer?.setConfiguration(state.viewer, `sim:${state.object}`, pose.key, {
      label: state.data.label, posePosters,
      sourcePose: state.data.sources[state.source].key,
      targetPose: state.data.targets[state.target].key,
    });
  };
  const selectPair = (state, shouldPlay = false) => {
    const clip = state.data.recordings.find((item) => item.source_slot === state.source && item.target_slot === state.target);
    const source = state.data.sources[state.source], target = state.data.targets[state.target];
    if (!clip || clip.success !== true || clip.source_grasp_id !== source.grasp_id || clip.target_grasp_id !== target.grasp_id) {
      state.note.textContent = 'This recorded pair is unavailable. Please choose another pair.';
      return;
    }
    state.selections.set(state.object, [state.source, state.target]);
    state.sourceSelect.value = String(state.source);
    state.targetSelect.value = String(state.target);
    state.range.hidden = false;
    state.range.textContent = clip.range === 'close' ? 'Close transfer' : 'Far transfer';
    state.range.dataset.range = clip.range;
    const distance = state.distances?.[`g${source.grasp_id}-to-${target.grasp_id}`];
    const validDistance = typeof distance === 'number' && Number.isFinite(distance) && distance >= 0;
    state.distanceValue.textContent = validDistance ? `${distance.toFixed(1)} mm` : 'Unavailable';
    state.distanceRow.hidden = false;
    state.note.textContent = 'Selected successful transfers · choose a source and target to play.';
    state.deck.dataset.pair = `source-${state.source + 1}/target-${state.target + 1}`;
    state.button.dataset.source = assetBase + clip.video;
    state.button.dataset.poster = assetBase + clip.poster;
    state.button.dataset.pairFrames = clip.frames;
    state.button.dataset.pairFps = clip.fps;
    state.button.dataset.pairSource = state.source + 1;
    state.button.dataset.pairTarget = state.target + 1;
    const singleHand = clip.presentation === 'single-side-final-target';
    state.deck.dataset.singleHand = String(singleHand);
    state.deck.style.setProperty('--recording-aspect', `${clip.width} / ${clip.height}`);
    const imagePath = singleHand && clip.final_target ? assetBase + clip.final_target : '';
    if (state.finalImage.getAttribute('src') !== imagePath) {
      state.finalFigure.hidden = true;
      if (imagePath) {
        state.finalImage.alt = `${state.data.label}, final target ${state.target + 1}`;
        state.finalImage.src = imagePath;
      } else state.finalImage.removeAttribute('src');
    }
    state.finalFigure.hidden = !imagePath || !state.finalImage.complete || !state.finalImage.naturalWidth;
    updatePreview(state);
    state.deck.dispatchEvent(new CustomEvent('transferpairchange', {detail: {shouldPlay}}));
  };
  const update = async (state, button) => {
    const simulation = state.deck.dataset.deck === 'simulation';
    const object = simulation ? button.dataset.objectId
      : realObjects[button.dataset.goalPrefix?.split('/').pop()];
    if (!object || state.object === object) return;
    state.object = object;
    state.button = button;
    state.data = null;
    state.distances = null;
    if (state.distanceRow) state.distanceRow.hidden = true;
    if (state.finalFigure) state.finalFigure.hidden = true;
    state.viewer.dataset.object = simulation ? `sim:${object}` : object;
    const image = button.dataset.goalPrefix ? `${button.dataset.goalPrefix}-s1.png?v=interactive-transfer-1` : '';
    state.viewer.dataset.poster = window.DexMedia?.url(image) || image;
    state.caption.textContent = '';
    if (!simulation) {
      window.DexGraspViewer?.setObject(state.viewer, object, {poster: state.viewer.dataset.poster, posterPose: 'target'});
      return;
    }

    window.DexGraspViewer?.setObject(state.viewer, `sim:${object}`, {pose: 'target-1', poster: ''});
    state.sourceSelect.disabled = state.targetSelect.disabled = true;
    try {
      const [manifest, distances] = await Promise.all([getPairs(), getDistances().catch(() => null)]);
      if (state.object !== object) return;
      const data = manifest.objects[object];
      if (!data || data.sources.length !== 3 || data.targets.length !== 3 || data.recordings.length !== 9) throw new Error('Incomplete recordings');
      state.data = data;
      state.distances = distances?.objects?.[object];
      [state.source, state.target] = state.selections.get(object) || [0, 0];
      state.side = 'target';
      state.sourceSelect.disabled = state.targetSelect.disabled = false;


      selectPair(state, false);
    } catch {
      if (state.object !== object) return;
      state.caption.textContent = 'Pair selection could not load. Reload this page to try again.';
      state.note.textContent = 'Showing the default recorded transfer.';
      state.range.hidden = true;
      state.distanceRow.hidden = true;
    }
  };
  document.querySelectorAll('.video-deck[data-deck="simulation"], .video-deck[data-deck="real-transfer"]').forEach((deck) => {
    const simulation = deck.dataset.deck === 'simulation';
    const tabs = deck.querySelector('.deck-tabs');
    const sidebar = make('aside', 'transfer-sidebar');
    tabs.replaceWith(sidebar);
    sidebar.append(tabs);

    let group;
    for (const child of [...tabs.children]) {
      if (child.classList.contains('deck-selector-label')) {
        group = make('div', 'transfer-object-group');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', child.textContent);
        tabs.append(group);
      }
      group.append(child);
    }
    const panel = make('section', 'configuration-explorer');
    panel.setAttribute('aria-label', 'Interactive hand–object configurations');
    const holdExample = () => {
      deck.dataset.inspectingGoal = 'true';
      deck.querySelector('video').pause();
    };
    panel.addEventListener('pointerdown', holdExample);
    panel.addEventListener('focusin', holdExample);
    const caption = make('p', 'explorer-caption');
    const viewer = make('div', 'grasp-viewer');
    viewer.dataset.viewerGroup = simulation ? 'simulation' : 'real';
    panel.append(make('h4', '', 'Explore grasp in 3D'), caption, viewer);
    sidebar.prepend(panel);
    const state = {deck, panel, viewer, caption, selections: new Map()};
    viewer.addEventListener('graspviewer:posechange', ({detail}) => {
      if (simulation && detail.object === `sim:${state.object}`) {
        state.side = detail.pose.startsWith('source') ? 'source' : 'target';
      }
    });
    if (simulation) {
      const finalFigure = make('figure', 'simulation-final-goal');
      finalFigure.hidden = true;
      const finalImage = make('img');
      finalImage.width = 640;
      finalImage.height = 480;
      finalImage.addEventListener('load', () => {
        finalFigure.hidden = deck.dataset.singleHand !== 'true';
      });
      finalImage.addEventListener('error', () => { finalFigure.hidden = true; });
      finalFigure.append(finalImage, make('figcaption', '', 'Final target'));
      deck.querySelector('.video-frame').append(finalFigure);
      state.finalFigure = finalFigure;
      state.finalImage = finalImage;
      state.sourceSelect = deck.querySelector('#simulation-source');
      state.targetSelect = deck.querySelector('#simulation-target');
      state.range = deck.querySelector('.transfer-range');
      const summary = make('div', 'transfer-summary');
      state.range.replaceWith(summary);
      const distanceRow = make('div', 'transfer-distance');
      distanceRow.hidden = true;
      distanceRow.setAttribute('aria-live', 'polite');
      const distanceValue = make('strong');
      const distanceDefinition = make('a', '', 'Definition ↗');
      distanceDefinition.href = '#configuration-distance-title';
      distanceDefinition.setAttribute('aria-label', 'Definition of hand–object configuration keypoint distance');
      distanceRow.append(make('span', '', 'Transfer kp dist.'), distanceValue, distanceDefinition);
      summary.append(state.range, distanceRow);
      state.distanceRow = distanceRow;
      state.distanceValue = distanceValue;
      state.note = deck.querySelector('.recording-note');
      for (const [select, side] of [[state.sourceSelect, 'source'], [state.targetSelect, 'target']]) {
        select.addEventListener('change', () => {
          state[side] = Number(select.value);
          selectPair(state, true);
        });
      }
    }
    panels.push(state);
    const sync = () => update(state, tabs.querySelector('.is-active') || tabs.querySelector('button'));
    deck.addEventListener('deckchange', sync);
    sync();
  });
  window.addEventListener('graspviewerready', () => panels.forEach((state) => {
    if (state.data) updatePreview(state);
    else if (state.deck.dataset.deck !== 'simulation') window.DexGraspViewer?.setObject(state.viewer, state.viewer.dataset.object);
  }));
})();
