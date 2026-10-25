'use strict';

// Figure links also work without JavaScript.
const figureDialog = document.querySelector('#figure-dialog');
const dialogImage = document.querySelector('#dialog-image');
const dialogTitle = document.querySelector('#dialog-title');

if (figureDialog && typeof figureDialog.showModal === 'function') {
  document.querySelectorAll('[data-figure]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      dialogImage.src = link.href;
      dialogImage.alt = link.querySelector('img').alt;
      dialogTitle.textContent = link.dataset.figure;
      figureDialog.showModal();
      document.body.classList.add('dialog-open');
      document.querySelector('.dialog-image-area').scrollTo(0, 0);
    });
  });
  document.querySelector('#close-figure').addEventListener('click', () => figureDialog.close());
  figureDialog.addEventListener('click', (event) => {
    if (event.target !== figureDialog) return;
    const bounds = figureDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) figureDialog.close();
  });
  figureDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
}

// Each experiment section uses one player. Examples are swapped into that
// player so the page never presents a wall of simultaneously moving videos.
const decks = [...document.querySelectorAll('.video-deck')];
const deckVideos = decks.map((deck) => deck.querySelector('video'));
const paperVideo = document.querySelector('#paper-video-player');
const deckVisibility = new Map(decks.map((deck) => [deck, 0]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeDeck = null;

const pauseOtherDecks = (currentVideo) => {
  if (paperVideo && paperVideo !== currentVideo && !paperVideo.paused) paperVideo.pause();
  deckVideos.forEach((video) => {
    if (video !== currentVideo && !video.paused) video.pause();
  });
};

// The full paper video is user-controlled and takes priority over gallery autoplay.
paperVideo?.addEventListener('play', () => {
  activeDeck = null;
  pauseOtherDecks(paperVideo);
});

const targetAssetRevision = Date.now();
const parseGoalStages = (button) => {
  if (!button.dataset.goalPrefix) return [];
  const times = button.dataset.goalTimes.split(',').map(Number);
  const labels = button.dataset.goalLabels.split('|');
  const fractions = button.dataset.goalFractions?.split(',').map(Number) || [];
  const metas = button.dataset.goalMetas?.split('|') || [];
  const frames = button.dataset.goalFrames.split('|').length > 1
    ? button.dataset.goalFrames.split('|')
    : button.dataset.goalFrames.split(',');
  const layouts = button.dataset.goalLayouts.split('|').map((entry) => entry.split(',').map(Number));
  return times.map((time, index) => ({
    time,
    label: labels[index],
    fraction: fractions[index],
    frame: frames[index],
    meta: metas[index],
    layout: layouts[index],
    src: `${button.dataset.goalPrefix}-s${index + 1}.png?v=${targetAssetRevision}`,
  }));
};

const showGoalStage = (deck, stageIndex, force = false) => {
  const goal = deck.querySelector('.stage-goal-ghost');
  const stages = deck.goalStages || [];
  const stage = stages[stageIndex];
  if (!goal || !stage || (!force && deck.goalStageIndex === stageIndex)) return;
  deck.goalStageIndex = stageIndex;
  const [x, y, width, rotation] = stage.layout;
  const image = goal.querySelector('img');
  image.src = stage.src;
  image.alt = deck.goalPersistent
    ? `Palm-down ${stage.label} in the shared ANY2ANY target camera view for ${deck.goalTaskTitle}`
    : `${stage.label} hand-object target inset for ${deck.goalTaskTitle}`;
  image.style.setProperty('--goal-x', `${x}%`);
  image.style.setProperty('--goal-y', `${y}%`);
  image.style.setProperty('--goal-width', `${width}%`);
  image.style.setProperty('--goal-rotation', `${rotation}deg`);
  const goalKind = deck.goalPersistent
    ? 'Final grasp target'
    : (deck.goalKind || 'Policy target');
  goal.querySelector('figcaption span').textContent = deck.goalPersistent
    ? 'TARGET'
    : `${goalKind} ${String(stageIndex + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')}`;
  goal.querySelector('figcaption strong').textContent = deck.goalPersistent
    ? 'Palm down · fingers forward'
    : stage.label;
  goal.querySelector('figcaption small').textContent = deck.goalPersistent
    ? `Shared camera · ${stage.meta || `F${stage.frame}`}`
    : (stage.meta || `3D target inset · F${stage.frame}`);
  goal.classList.remove('is-changing');
  void goal.offsetWidth;
  goal.classList.add('is-changing');
};

const updateGoalForTime = (deck) => {
  const goal = deck.querySelector('.stage-goal-ghost');
  if (!goal || !deck.goalStages?.length) return;
  const currentTime = deck.querySelector('video').currentTime;
  const closestIndex = deck.goalStages.reduce((bestIndex, stage, index, stages) => (
    Math.abs(stage.time - currentTime) < Math.abs(stages[bestIndex].time - currentTime)
      ? index
      : bestIndex
  ), 0);
  const closest = deck.goalStages[closestIndex];
  const isMatchedMoment = currentTime >= closest.time - 0.32 && currentTime <= closest.time + 0.46;
  if (deck.goalPersistent || isMatchedMoment) showGoalStage(deck, closestIndex);
  goal.classList.toggle('is-visible', deck.goalPersistent || isMatchedMoment);
};

const updateGoalStream = (deck, force = false) => {
  const stream = deck.querySelector('.goal-stream');
  const video = deck.querySelector('video');
  if (!stream || !deck.goalStages?.length || !Number.isFinite(video.duration)) return;
  const speed = deck.goalSpeed || 1;
  const policyTime = Math.max(0, video.currentTime - (deck.goalPolicyStartTime || 0));
  const goalIndex = Math.max(0, Math.floor(policyTime * speed));
  const progress = Math.min(100, Math.max(0, video.currentTime / video.duration * 100));
  stream.querySelector('.goal-stream-index').textContent = `g_${String(goalIndex).padStart(3, '0')}`;
  stream.querySelector('.goal-stream-fill').style.width = `${progress}%`;
  stream.querySelector('.goal-stream-cursor').style.left = `${progress}%`;
  stream.querySelectorAll('.goal-stream-markers button').forEach((marker, index) => {
    const delta = video.currentTime - deck.goalStages[index].time;
    marker.classList.toggle('is-complete', delta >= 0);
    marker.classList.toggle('is-current', Math.abs(delta) <= 0.42);
  });
  if (!force && deck.goalStreamIndex !== goalIndex) {
    stream.classList.remove('is-pulsing');
    void stream.offsetWidth;
    stream.classList.add('is-pulsing');
  }
  deck.goalStreamIndex = goalIndex;
};

const buildGoalStream = (deck) => {
  const stream = deck.querySelector('.goal-stream');
  const video = deck.querySelector('video');
  if (!stream || !deck.goalStages?.length || !Number.isFinite(video.duration)) return;
  const speed = deck.goalSpeed || 1;
  const policyDuration = Math.max(0, video.duration - (deck.goalPolicyStartTime || 0));
  const updateCount = Math.max(1, Math.floor(policyDuration * speed));
  stream.style.setProperty('--goal-tick-spacing', `${100 / updateCount}%`);
  const markers = stream.querySelector('.goal-stream-markers');
  markers.replaceChildren();
  deck.goalStages.forEach((stage, index) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    const policyStart = deck.goalPolicyStartTime || 0;
    const markerTime = Number.isFinite(stage.fraction)
      ? policyStart + (video.duration - policyStart) * stage.fraction
      : stage.time;
    marker.style.left = `${Math.min(100, markerTime / video.duration * 100)}%`;
    marker.setAttribute('aria-label', `Inspect representative goal ${index + 1}: ${stage.label}`);
    marker.title = `Goal ${index + 1} · ${stage.label} · ${stage.time.toFixed(2)} s`;
    marker.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeDeck = deck;
      deck.dataset.inspectingGoal = 'true';
      video.pause();
      video.currentTime = stage.time;
      showGoalStage(deck, index, true);
      updateGoalForTime(deck);
      updateGoalStream(deck, true);
    });
    markers.append(marker);
  });
  updateGoalStream(deck, true);
};

// Frame annotations for the published 30 fps simulation clips, not uniform bins.
// Left/reference changes were checked against adjacent video frames. Between
// success and the next target, the scene briefly displays its reset grasp.
// Green intervals reproduce the ORIGINAL right-hand success color; no success
// is inferred for the fifth transfer, which has no visible green marker here.
const simulationTimelines = {
  camera_003: {starts: [0,181,383,443,512], resets: [[163,181],[371,383],[433,443],[502,512]], successes: [[148,163],[356,371],[418,433],[487,502]]},
  clock_016: {starts: [0,233,607,733,807], resets: [[223,233],[597,607],[723,733],[794,807]], successes: [[208,223],[582,597],[708,723],[779,794]]},
  book_022: {starts: [0,204,301,671,736], resets: [[194,204],[287,301],[661,671],[726,736]], successes: [[179,194],[272,287],[646,661],[711,726]]},
  tape_measure_009: {starts: [0,82,186,317,412], resets: [[72,82],[176,186],[307,317],[402,412]], successes: [[57,72],[161,176],[292,307],[387,402]]},
  spanner_000: {starts: [0,72,164,334,455], resets: [[62,72],[154,164],[311,334],[445,455]], successes: [[47,62],[139,154],[296,311],[430,445]]},
  shampoo_037: {starts: [0,89,151,315,434], resets: [[79,89],[141,151],[305,315],[424,434]], successes: [[64,79],[126,141],[290,305],[409,424]]},
  screwdriver: {starts: [0,52,126,230,324], resets: [[42,52],[116,126],[220,230],[294,324]], successes: [[27,42],[101,116],[205,220],[279,294]]},
  hammer_002: {starts: [0,95,202,292,387], resets: [[80,95],[180,202],[276,292],[377,387]], successes: [[65,80],[165,180],[261,276],[362,377]]},
  flashlight: {starts: [0,312,399,590,737], resets: [[302,312],[389,399],[580,590],[727,737]], successes: [[287,302],[374,389],[565,580],[712,727]]},
};

const getSimulationState = (timeline, seconds) => {
  const frame = Math.max(0, Math.floor(seconds * 30 + 0.0001));
  const targetIndex = Math.max(0, timeline.starts.filter((start) => start <= frame).length - 1);
  const inInterval = ([start, end]) => frame >= start && frame < end;
  return {
    frame,
    targetIndex,
    resetting: timeline.resets.some(inInterval),
    reached: timeline.successes.some(inInterval),
  };
};

const updateSimulationTimeline = (deck) => {
  const timeline = deck.simulationTimeline;
  if (!timeline) return;
  const state = getSimulationState(timeline, deck.querySelector('video').currentTime);
  const key = `${state.targetIndex}-${state.resetting}-${state.reached}`;
  if (deck.simulationStateKey === key) return;
  deck.simulationStateKey = key;
  const note = deck.querySelector('.simulation-target-note');
  const status = deck.querySelector('.deck-status');
  const label = `Target ${String(state.targetIndex + 1).padStart(2, '0')} / ${String(timeline.starts.length).padStart(2, '0')}`;
  note.textContent = state.resetting ? 'Next target…' : label;
  note.setAttribute('aria-label', state.resetting ? 'Resetting before the next target' : `${label}, reference grasp on the left`);
  status.textContent = state.reached ? '✓ Target reached' : state.resetting ? 'Resetting' : 'Policy execution';
  status.className = `deck-status is-${state.reached ? 'success' : 'neutral'}`;
  deck.querySelector('.deck-stage').classList.toggle('is-success', state.reached);
  deck.querySelectorAll('.simulation-target-buttons button').forEach((button, index) => {
    const current = index === state.targetIndex && !state.resetting;
    button.classList.toggle('is-active', current);
    button.classList.toggle('is-complete', Boolean(timeline.successes[index] && state.frame >= timeline.successes[index][0]));
    button.setAttribute('aria-pressed', String(current));
  });
};

const configureSimulationTimeline = (deck, button) => {
  if (deck.dataset.deck !== 'simulation') return;
  const timeline = simulationTimelines[button.dataset.objectId];
  if (deck.simulationTimeline === timeline) {
    // selectDeckItem also refreshes generic status text during scroll activation.
    deck.simulationStateKey = null;
    updateSimulationTimeline(deck);
    return;
  }
  deck.simulationTimeline = timeline;
  deck.simulationStateKey = null;
  const navigation = deck.querySelector('.simulation-target-navigation');
  const buttons = navigation.querySelector('.simulation-target-buttons');
  buttons.replaceChildren();
  navigation.hidden = !timeline;
  if (!timeline) return;
  timeline.starts.forEach((frame, index) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.textContent = String(index + 1).padStart(2, '0');
    marker.title = `Target ${index + 1} · ${(frame / 30).toFixed(2)} s`;
    marker.setAttribute('aria-label', `Inspect target ${index + 1} of ${timeline.starts.length}`);
    marker.addEventListener('click', () => {
      const video = deck.querySelector('video');
      activeDeck = deck;
      deck.dataset.inspectingGoal = 'true';
      pauseOtherDecks(video);
      video.pause();
      video.currentTime = frame / 30;
      updateSimulationTimeline(deck);
    });
    buttons.append(marker);
  });
  updateSimulationTimeline(deck);
};

// Showcase success is a closing cue, not a label for the whole execution.
// Use playback time (not a timer) so scrubbing and replay restore the right state.
const isFinalSecond = (duration, currentTime) => (
  Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime) &&
  currentTime >= Math.max(0, duration - 1) && currentTime <= duration
);

const updateCompletionState = (deck) => {
  if (!['real-transfer', 'tasks'].includes(deck.dataset.deck)) return;
  const video = deck.querySelector('video');
  const button = deck.querySelectorAll('.deck-tabs button')[Number(deck.dataset.activeIndex || 0)];
  if (!button) return;
  const complete = video.readyState >= 1 && isFinalSecond(video.duration, video.currentTime);
  const key = `${deck.dataset.activeIndex}-${complete}`;
  if (deck.completionStateKey === key) return;
  deck.completionStateKey = key;
  const status = deck.querySelector('.deck-status');
  status.textContent = complete ? '✓ Success' : button.dataset.status;
  status.className = `deck-status is-${complete ? 'success' : 'neutral'}`;
  deck.querySelector('.deck-stage').classList.toggle('is-success', complete);
};

const stopGoalAnimation = (deck) => {
  if (!deck.goalAnimationFrame) return;
  cancelAnimationFrame(deck.goalAnimationFrame);
  deck.goalAnimationFrame = 0;
};

const animateGoalStream = (deck) => {
  stopGoalAnimation(deck);
  const video = deck.querySelector('video');
  const step = () => {
    updateSimulationTimeline(deck);
    updateCompletionState(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck);
    if (!video.paused && !document.hidden) deck.goalAnimationFrame = requestAnimationFrame(step);
    else deck.goalAnimationFrame = 0;
  };
  step();
};

const selectDeckItem = (deck, index, shouldPlay = true) => {
  const buttons = [...deck.querySelectorAll('.deck-tabs button')];
  const button = buttons[index];
  if (!button) return;
  const video = deck.querySelector('video');
  const source = video.querySelector('source');
  const stage = deck.querySelector('.deck-stage');
  const status = deck.querySelector('.deck-status');
  const kicker = deck.querySelector('.deck-kicker');
  const title = deck.querySelector('.deck-caption h4');
  const description = deck.querySelector('.deck-caption p:not(.object-rate-note)');
  const goal = deck.querySelector('.stage-goal-ghost');

  if (goal) {
    deck.goalStages = parseGoalStages(button);
    deck.goalSpeed = Number(button.dataset.goalSpeed || 1);
    deck.goalPersistent = button.dataset.goalPersistent === 'true';
    deck.goalInset = button.dataset.goalInset === 'true' || (
      deck.dataset.deck === 'tasks' && !deck.goalPersistent
    );
    deck.goalPolicyStartTime = Number(button.dataset.policyStartTime || 0);
    deck.goalKind = button.dataset.goalKind || '';
    deck.goalTaskTitle = button.dataset.title || 'this task';
    deck.goalStageIndex = -1;
    deck.goalStreamIndex = -1;
    goal.hidden = deck.goalStages.length === 0;
    goal.classList.toggle('demo-goal-inset', deck.goalInset);
    goal.classList.remove('is-visible');
    deck.goalPreloads = deck.goalStages.map((goalStage) => {
      const preload = new Image();
      preload.src = goalStage.src;
      return preload;
    });
    if (deck.goalStages.length) showGoalStage(deck, 0, true);
  }

  buttons.forEach((item, itemIndex) => {
    const selected = itemIndex === index;
    item.classList.toggle('is-active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  deck.dataset.activeIndex = String(index);
  deck.completionStateKey = null;
  const successful = button.dataset.tone === 'success';
  status.textContent = button.dataset.status;
  status.className = `deck-status is-${successful ? 'success' : button.dataset.tone || 'neutral'}`;
  stage.classList.toggle('is-success', successful);
  stage.classList.toggle('is-failure', button.dataset.tone === 'failure');
  kicker.textContent = deck.dataset.deck === 'tasks' ? button.dataset.status : button.dataset.kicker;
  const objectRate = deck.querySelector('.object-success-rate');
  if (objectRate) {
    const successes = Number(button.dataset.successCount);
    const trials = Number(button.dataset.trialCount);
    const valid = Number.isInteger(successes) && Number.isInteger(trials) && trials > 0 && successes >= 0 && successes <= trials;
    objectRate.hidden = !valid;
    objectRate.textContent = valid ? `Success rate: ${Math.round(100 * successes / trials)}% (${successes}/${trials})` : '';
  }
  title.textContent = button.dataset.title;
  const position = deck.querySelector('.deck-position');
  position.textContent = `${String(index + 1).padStart(2, '0')} / ${String(buttons.length).padStart(2, '0')}`;
  position.setAttribute('aria-label', `Example ${index + 1} of ${buttons.length}`);
  if (description) description.textContent = button.dataset.description || '';
  video.setAttribute('aria-label', button.dataset.title);
  deck.style.setProperty('--media-scale', button.dataset.mediaScale || '1');

  const alreadyLoaded = source.src === new URL(button.dataset.source, document.baseURI).href;
  if (alreadyLoaded) {
    configureSimulationTimeline(deck, button);
    updateCompletionState(deck);
    buildGoalStream(deck);
    updateGoalForTime(deck);
    if (shouldPlay && !document.hidden && (!paperVideo || paperVideo.paused)) video.play().catch(() => {});
    return;
  }

  video.pause();
  stage.classList.add('is-loading', 'is-switching');
  source.src = button.dataset.source;
  video.poster = button.dataset.poster;
  video.load();
  configureSimulationTimeline(deck, button);
  updateCompletionState(deck);

  const revealAndPlay = () => {
    stage.classList.remove('is-loading');
    updateCompletionState(deck);
    buildGoalStream(deck);
    updateGoalForTime(deck);
    if (shouldPlay && activeDeck === deck && !document.hidden && (!paperVideo || paperVideo.paused) && deck.dataset.inspectingGoal !== 'true') {
      video.play().catch(() => {});
    }
  };
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) revealAndPlay();
  else video.addEventListener('canplay', revealAndPlay, {once: true});
};

const activateDeck = (deck) => {
  if (!deck || document.hidden || (paperVideo && !paperVideo.paused)) return;
  activeDeck = deck;
  const index = Number(deck.dataset.activeIndex || 0);
  pauseOtherDecks(deck.querySelector('video'));
  selectDeckItem(deck, index, deck.dataset.inspectingGoal !== 'true');
};

decks.forEach((deck) => {
  const video = deck.querySelector('video');
  const stage = deck.querySelector('.deck-stage');
  const buttons = [...deck.querySelectorAll('.deck-tabs button')];
  deck.dataset.activeIndex = '0';
  deck.querySelector('.deck-caption').setAttribute('aria-live', 'polite');

  const navigation = document.createElement('div');
  navigation.className = 'deck-navigation';
  const position = document.createElement('span');
  position.className = 'deck-position';
  position.textContent = `01 / ${String(buttons.length).padStart(2, '0')}`;
  position.setAttribute('aria-label', `Example 1 of ${buttons.length}`);
  navigation.append(position);
  for (const [step, label, arrow] of [[-1, 'Previous example', '←'], [1, 'Next example', '→']]) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'deck-step';
    control.setAttribute('aria-label', label);
    control.title = label;
    control.textContent = arrow;
    control.addEventListener('click', () => {
      const index = (Number(deck.dataset.activeIndex || 0) + step + buttons.length) % buttons.length;
      buttons[index].click();
    });
    navigation.append(control);
  }
  deck.querySelector('.deck-caption-heading').append(navigation);

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      activeDeck = deck;
      delete deck.dataset.inspectingGoal;
      pauseOtherDecks(video);
      selectDeckItem(deck, index, true);
    });
  });
  video.addEventListener('play', () => {
    activeDeck = deck;
    delete deck.dataset.inspectingGoal;
    pauseOtherDecks(video);
    animateGoalStream(deck);
  });
  ['loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'seeked', 'emptied', 'pause'].forEach((event) => {
    video.addEventListener(event, () => updateCompletionState(deck));
  });
  video.addEventListener('pause', () => {
    stopGoalAnimation(deck);
    updateSimulationTimeline(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck, true);
  });
  video.addEventListener('loadedmetadata', () => {
    updateSimulationTimeline(deck);
    buildGoalStream(deck);
    updateGoalForTime(deck);
  });
  video.addEventListener('timeupdate', () => {
    updateSimulationTimeline(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck);
  });
  video.addEventListener('seeked', () => {
    updateSimulationTimeline(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck, true);
  });
  video.addEventListener('ended', () => {
    if (deck.dataset.deck === 'comparison' || activeDeck !== deck || reducedMotion.matches) return;
    const next = (Number(deck.dataset.activeIndex || 0) + 1) % buttons.length;
    selectDeckItem(deck, next, true);
  });
  video.addEventListener('error', () => stage.classList.remove('is-loading'));
  stage.addEventListener('animationend', () => stage.classList.remove('is-switching'));
});

const activateMostVisibleDeck = () => {
  if (document.hidden) {
    deckVideos.forEach((video) => video.pause());
    return;
  }
  const visible = [...deckVisibility.entries()].sort((a, b) => b[1] - a[1]);
  if (!visible.length || visible[0][1] < 0.18) {
    deckVideos.forEach((video) => video.pause());
    return;
  }
  activateDeck(visible[0][0]);
};

if ('IntersectionObserver' in window) {
  const deckObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => deckVisibility.set(entry.target, entry.intersectionRatio));
    activateMostVisibleDeck();
  }, {threshold: [0, 0.18, 0.35, 0.55, 0.75]});
  decks.forEach((deck) => deckObserver.observe(deck));
} else if (decks[0]) {
  activateDeck(decks[0]);
}

document.addEventListener('visibilitychange', activateMostVisibleDeck);

const copyButton = document.querySelector('#copy-citation');
const copyStatus = document.querySelector('#copy-status');
if (copyButton && navigator.clipboard && window.isSecureContext) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#citation-code').textContent);
      copyStatus.textContent = 'Citation copied to clipboard.';
    } catch {
      copyStatus.textContent = 'Could not copy automatically. Please select and copy the citation above.';
    }
  });
}
