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

// Each tabbed experiment section uses one player, swapping examples as selected.
const decks = [...document.querySelectorAll('.video-deck')];
const deckVideos = decks.map((deck) => deck.querySelector('video'));
const paperVideo = document.querySelector('#paper-video-player');
const comparisonVideos = [...document.querySelectorAll('.comparison-grid video[data-comparison]')];
const comparisonPlayButton = document.querySelector('#comparison-play');
const comparisonRestartButton = document.querySelector('#comparison-restart');
const comparisonStatus = document.querySelector('#comparison-playback-status');
const deckVisibility = new Map(decks.map((deck) => [deck, 0]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeDeck = null;

const isComparisonPlaying = () => comparisonVideos.some((video) => !video.paused && !video.ended);

const pauseOtherDecks = (currentVideo) => {
  if (paperVideo && paperVideo !== currentVideo && !paperVideo.paused) paperVideo.pause();
  deckVideos.forEach((video) => {
    if (video !== currentVideo && !video.paused) video.pause();
  });
  if (!comparisonVideos.includes(currentVideo)) {
    comparisonStartAttempt += 1;
    comparisonPlaybackError = false;
    comparisonVideos.forEach((video) => video.pause());
  }
};

// The full paper video is user-controlled and takes priority over gallery autoplay.
paperVideo?.addEventListener('play', () => {
  activeDeck = null;
  pauseOtherDecks(paperVideo);
});

// The two comparison clips keep their own duration, playback rate, and controls.
let comparisonStartAttempt = 0;
let comparisonPlaybackError = false;
const updateComparisonControls = () => {
  if (!comparisonVideos.length || !comparisonPlayButton) return;
  const playing = comparisonVideos.filter((video) => !video.paused && !video.ended).length;
  const allEnded = comparisonVideos.every((video) => video.ended);
  comparisonPlayButton.textContent = playing ? 'Pause both' : allEnded ? 'Replay both' : 'Play both';
  comparisonPlayButton.setAttribute('aria-pressed', String(playing > 0));
  if (!comparisonStatus) return;
  comparisonStatus.textContent = comparisonPlaybackError
    ? 'Some clips could not start. Use the individual video controls.'
    : allEnded
      ? 'Both clips have ended. Replay to compare again.'
      : playing === comparisonVideos.length
        ? 'Playing both clips at their original speed.'
        : playing
          ? 'One clip is playing. Each clip keeps its original duration.'
          : 'Paused. Each clip keeps its original speed and duration.';
};

const startComparison = async (restart = false) => {
  if (!comparisonVideos.length) return;
  const attempt = ++comparisonStartAttempt;
  comparisonPlaybackError = false;
  activeDeck = null;
  pauseOtherDecks(comparisonVideos[0]);
  const results = await Promise.allSettled(comparisonVideos.map(async (video) => {
    if (restart || video.ended) video.currentTime = 0;
    await video.play();
  }));
  if (attempt !== comparisonStartAttempt) return;
  comparisonPlaybackError = results.some((result) => result.status === 'rejected');
  updateComparisonControls();
};

comparisonPlayButton?.addEventListener('click', () => {
  if (isComparisonPlaying()) {
    comparisonStartAttempt += 1;
    comparisonPlaybackError = false;
    comparisonVideos.forEach((video) => video.pause());
    updateComparisonControls();
  } else {
    startComparison();
  }
});
comparisonRestartButton?.addEventListener('click', () => startComparison(true));
comparisonVideos.forEach((video) => {
  video.addEventListener('play', () => {
    activeDeck = null;
    pauseOtherDecks(video);
    updateComparisonControls();
  });
  ['pause', 'ended', 'loadedmetadata', 'emptied'].forEach((event) => {
    video.addEventListener(event, updateComparisonControls);
  });
  video.addEventListener('error', () => {
    comparisonPlaybackError = true;
    updateComparisonControls();
  });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  comparisonStartAttempt += 1;
  comparisonVideos.forEach((video) => video.pause());
  updateComparisonControls();
});
updateComparisonControls();

// The muted video wall loads only when visible and loops each complete task.
// Sources already encode the same 2x timing as the task players; do not speed
// them up again or seek within a shortened excerpt.
const heroWall = document.querySelector('#hero-video-wall');
const heroMotionButton = document.querySelector('#hero-motion-toggle');
if (heroWall) {
  const heroClips = [...heroWall.querySelectorAll('.hero-background-video')].map((video) => ({
    video,
    loaded: false,
    ready: false,
    failed: false,
    blocked: false,
    pending: false,
    attempt: 0,
  }));
  let heroVisible = false;
  let heroUserPaused = false;

  const shouldPlayHero = () => heroVisible && !document.hidden && !reducedMotion.matches && !heroUserPaused;
  const updateHeroControl = () => {
    if (!heroMotionButton) return;
    const unavailable = heroClips.every((clip) => clip.failed);
    const running = shouldPlayHero() && heroClips.some((clip) => !clip.failed && !clip.blocked);
    heroMotionButton.disabled = reducedMotion.matches || unavailable;
    heroMotionButton.textContent = reducedMotion.matches
      ? 'Reduced motion enabled'
      : unavailable ? 'Background unavailable' : running ? 'Pause background' : 'Play background';
    heroMotionButton.setAttribute('aria-pressed', String(running));
    heroMotionButton.setAttribute('aria-label', reducedMotion.matches
      ? 'Background motion disabled by your reduced-motion preference'
      : unavailable ? 'Background videos unavailable' : running ? 'Pause all background videos' : 'Play all background videos');
  };
  const syncHeroPlayback = () => {
    heroClips.forEach((clip) => {
      const {video} = clip;
      if (!shouldPlayHero()) {
        clip.attempt += 1;
        clip.pending = false;
        video.pause();
        return;
      }
      if (clip.failed || clip.blocked) return;
      if (!clip.loaded) {
        clip.loaded = true;
        video.preload = 'auto';
        video.src = video.dataset.src;
        video.load();
        return;
      }
      if (!clip.ready || clip.pending || !video.paused) return;
      const attempt = ++clip.attempt;
      clip.pending = true;
      video.play().then(() => {
        if (attempt === clip.attempt) clip.pending = false;
        if (!shouldPlayHero() || clip.failed || clip.blocked) video.pause();
        updateHeroControl();
      }).catch(() => {
        if (attempt !== clip.attempt) return;
        clip.pending = false;
        clip.blocked = true;
        video.pause();
        updateHeroControl();
      });
    });
    updateHeroControl();
  };
  heroMotionButton?.addEventListener('click', () => {
    const running = shouldPlayHero() && heroClips.some((clip) => !clip.failed && !clip.blocked);
    heroUserPaused = running;
    if (!running) heroClips.forEach((clip) => { clip.blocked = false; });
    syncHeroPlayback();
  });
  heroClips.forEach((clip) => {
    const {video} = clip;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.autoplay = false;
    video.playbackRate = 1;
    video.pause();
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = 0;
      video.playbackRate = 1;
      video.loop = true;
    });
    video.addEventListener('canplay', () => {
      clip.ready = true;
      syncHeroPlayback();
    });
    video.addEventListener('play', () => {
      if (!shouldPlayHero() || clip.failed || clip.blocked) video.pause();
      updateHeroControl();
    });
    video.addEventListener('pause', updateHeroControl);
    video.addEventListener('error', () => {
      clip.failed = true;
      clip.attempt += 1;
      clip.pending = false;
      video.pause();
      updateHeroControl();
    });
  });
  document.addEventListener('visibilitychange', syncHeroPlayback);
  reducedMotion.addEventListener('change', syncHeroPlayback);
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting && entry.intersectionRatio > 0;
      syncHeroPlayback();
    }, {threshold: 0});
    heroObserver.observe(heroWall);
  } else {
    const updateHeroVisibility = () => {
      const bounds = heroWall.getBoundingClientRect();
      heroVisible = bounds.bottom > 0 && bounds.top < window.innerHeight &&
        bounds.right > 0 && bounds.left < window.innerWidth;
      syncHeroPlayback();
    };
    window.addEventListener('scroll', updateHeroVisibility, {passive: true});
    window.addEventListener('resize', updateHeroVisibility);
    updateHeroVisibility();
  }
  updateHeroControl();
}

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
  const taskSample = deck.dataset.deck === 'tasks' && !deck.goalPersistent;
  const sampleLabel = `Sample ${String(stageIndex + 1).padStart(2, '0')}`;
  image.src = stage.src;
  image.alt = deck.goalPersistent
    ? `Palm-down ${stage.label} in the shared ANY2ANY target camera view for ${deck.goalTaskTitle}`
    : taskSample ? `${sampleLabel}: sampled hand–object configuration for ${deck.goalTaskTitle}`
      : `${stage.label} hand-object target inset for ${deck.goalTaskTitle}`;
  image.style.setProperty('--goal-x', `${x}%`);
  image.style.setProperty('--goal-y', `${y}%`);
  image.style.setProperty('--goal-width', `${width}%`);
  image.style.setProperty('--goal-rotation', `${rotation}deg`);
  const goalKind = deck.goalPersistent
    ? 'Final hand–object configuration target'
    : (deck.goalKind || 'Policy target');
  goal.querySelector('figcaption span').textContent = deck.goalPersistent
    ? 'TARGET'
    : taskSample ? 'SAMPLED TARGET'
      : `${goalKind} ${String(stageIndex + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')}`;
  goal.querySelector('figcaption strong').textContent = deck.goalPersistent
    ? 'Palm down · fingers forward'
    : taskSample ? sampleLabel : stage.label;
  goal.querySelector('figcaption small').textContent = deck.goalPersistent
    ? `Shared camera · ${stage.meta || `F${stage.frame}`}`
    : taskSample ? `Configuration snapshot ${stageIndex + 1} of ${stages.length}`
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

const formatVideoTime = (seconds) => {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const updateTaskPlayerControls = (deck) => {
  const controls = deck.taskPlayerControls;
  if (!controls) return;
  const video = deck.querySelector('video');
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  const seekable = video.readyState >= 1 && duration > 0 && !video.error && !deck.taskTargetSourceLoading;
  const currentTime = seekable ? Math.min(duration, Math.max(0, video.currentTime)) : 0;
  const progress = seekable ? currentTime / duration * 100 : 0;
  if ((!controls.scrubbing || !seekable) && controls.progress !== progress) controls.seek.value = String(progress);
  const displayedProgress = controls.scrubbing && seekable ? Number(controls.seek.value) : progress;
  if (controls.progress !== displayedProgress) {
    controls.track.style.setProperty('--seek-progress', `${displayedProgress}%`);
    controls.seek.style.setProperty('--seek-progress', `${displayedProgress}%`);
    controls.progress = displayedProgress;
  }
  if (controls.seekable !== seekable) {
    controls.seek.disabled = !seekable;
    controls.seekable = seekable;
  }
  const timeText = `${formatVideoTime(currentTime)} / ${formatVideoTime(duration)}`;
  if (controls.timeText !== timeText) {
    controls.time.textContent = timeText;
    controls.seek.setAttribute('aria-valuetext', `${formatVideoTime(currentTime)} of ${formatVideoTime(duration)}`);
    controls.timeText = timeText;
  }
  const playing = !video.paused && !video.ended;
  const playLabel = playing ? 'Pause video' : video.ended ? 'Replay video' : 'Play video';
  if (controls.playLabel !== playLabel) {
    controls.play.dataset.state = playing ? 'playing' : 'paused';
    controls.play.setAttribute('aria-label', playLabel);
    controls.playLabel = playLabel;
  }
  const muted = video.muted || video.volume === 0;
  if (controls.muted !== muted) {
    controls.mute.dataset.state = muted ? 'muted' : 'audible';
    controls.mute.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
    controls.muted = muted;
  }
  const fullscreen = document.fullscreenElement === controls.player;
  if (controls.isFullscreen !== fullscreen) {
    controls.fullscreen.dataset.state = fullscreen ? 'fullscreen' : 'windowed';
    controls.fullscreen.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
    controls.isFullscreen = fullscreen;
  }
  const failed = Boolean(video.error);
  if (controls.failed !== failed) {
    controls.bar.hidden = failed;
    video.controls = failed;
    controls.failed = failed;
  }
};

const updateGoalStream = (deck, force = false) => {
  updateTaskPlayerControls(deck);
  const stream = deck.querySelector('.goal-stream');
  const video = deck.querySelector('video');
  if (!stream) return;
  const seekable = video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0 && !video.error && !deck.taskTargetSourceLoading;
  const currentIndex = seekable
    ? getTaskTargetIndex(deck, video.currentTime)
    : -1;
  updateTaskTargetInset(deck, currentIndex, seekable);
  updateGoalCadence(deck, video.currentTime, seekable);
  if (!force && deck.goalStreamIndex === currentIndex && deck.goalStreamSeekable === seekable) return;
  deck.querySelectorAll('.goal-stream-markers button').forEach((control) => {
    const current = Number(control.dataset.goalIndex) === currentIndex;
    control.classList.toggle('is-current', current);
    control.setAttribute('aria-pressed', String(current));
    control.disabled = !seekable;
  });
  deck.goalStreamIndex = currentIndex;
  deck.goalStreamSeekable = seekable;
};

// Measured alpha > 20 bounds in the original 640 × 480 target images.
// The viewport adds 16 px of padding and preserves each image's pose and scale ratio.
const goalTargetAlphaBounds = {
  'barcode-scanning': [[147,163,316,383], [142,163,322,340], [172,162,410,324], [183,160,426,301]],
  'block-assembly': [[139,165,297,355], [147,165,309,386], [149,164,306,345], [158,164,323,342]],
  'salt-shaking': [[94,163,264,354], [131,165,317,370], [136,166,315,404], [138,167,309,416]],
  'screw-driving': [[135,163,319,364], [147,160,333,361], [166,155,355,335], [172,167,351,384]],
  'shelf-placement': [[148,165,289,391], [146,166,287,393], [153,165,297,386], [163,165,316,379]],
  'water-pouring': [[134,164,305,368], [148,164,335,344], [177,161,370,319], [186,153,390,275]],
};

// Keep the default upper-right placement unless the moving hand enters that
// area during this sample's three-second display window.
const taskTargetCornerOverrides = {
  'screw-driving-s3.png': 'left',
  'screw-driving-s4.png': 'left',
};

const frameGoalTarget = (image, src) => {
  const filename = src.split('/').pop().split(/[?#]/)[0];
  const match = filename.match(/^(.+)-s([1-4])\.png$/);
  const bounds = match && goalTargetAlphaBounds[match[1]]?.[Number(match[2]) - 1];
  image.style.width = '100%';
  image.style.left = '0%';
  image.style.top = '0%';
  if (!bounds) return;
  const [left, top, right, bottom] = bounds;
  const cropHeight = Math.max(bottom - top + 32, (right - left + 32) * 3 / 4);
  const cropWidth = cropHeight * 4 / 3;
  const cropX = (left + right - cropWidth) / 2;
  const cropY = (top + bottom - cropHeight) / 2;
  image.style.width = `${640 / cropWidth * 100}%`;
  image.style.left = `${-cropX / cropWidth * 100}%`;
  image.style.top = `${-cropY / cropHeight * 100}%`;
};

const getTaskTargetIndex = (deck, currentTime) => (deck.goalStages || []).findIndex((stage, index) => {
  const barcodeFinal = index === 3 && /(?:^|\/)barcode-scanning-s4\.png(?:[?#]|$)/.test(stage.src);
  const start = stage.time - (barcodeFinal ? 1.5 : 0);
  return currentTime >= start && currentTime < start + 3;
});

const updateGoalCadence = (deck, currentTime, seekable) => {
  const speed = Number.isFinite(deck.goalSpeed) && deck.goalSpeed > 0 ? deck.goalSpeed : 1;
  const start = Math.max(0, deck.goalPolicyStartTime || 0);
  const tick = seekable && currentTime >= start ? Math.floor((currentTime - start) * speed + 0.000001) : -1;
  if (deck.goalCadenceTick === tick) return;
  deck.goalCadenceTick = tick;
  deck.querySelectorAll('.goal-cadence-dot').forEach((dot, index) => {
    dot.classList.toggle('is-past', index <= tick);
    dot.classList.toggle('is-current', index === tick);
  });
};

// Checked in the original 960 × 720 footage: this tracks the code-facing side,
// not a confirmed visible barcode. The rendered target's code is exact below.
const barcodeVideoSideKeyframes = [
  {time: 25.033334, points: [[632,431], [661,448], [659,461], [631,443]]},
  {time: 25.8, points: [[667,438], [700,451], [698,462], [665,449]]},
  {time: 26.533334, points: [[680,443], [714,456], [711,466], [677,453]]},
  {time: 27.3, points: [[681,453], [712,467], [709,481], [678,467]]},
  {time: 28.033334, points: [[675,448], [705,461], [705,474], [674,460]]},
];

const updateTaskCodeOverlay = (deck, activeIndex) => {
  const target = deck.querySelector('.task-target-code');
  const videoOverlay = deck.querySelector('.task-code-overlay');
  const stage = deck.goalStages?.[activeIndex];
  const showTarget = activeIndex === 3 && stage && /(?:^|\/)barcode-scanning-s4\.png(?:[?#]|$)/.test(stage.src);
  const add = (parent, name, attributes, text) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text) element.textContent = text;
    parent.append(element);
    return element;
  };
  if (target && showTarget && !target.childElementCount) {
    add(target, 'rect', {x: 325, y: 205, width: 27, height: 13, rx: 1});
    add(target, 'line', {x1: 338.5, y1: 200, x2: 338.5, y2: 205, stroke: '#b4ffda', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke'});
    add(target, 'text', {x: 326, y: 198, 'font-size': 11}, 'Code');
  }
  if (target && target.hasAttribute('hidden') === Boolean(showTarget)) {
    if (showTarget) target.removeAttribute('hidden');
    else target.setAttribute('hidden', '');
  }
  if (!videoOverlay) return;
  if (!showTarget) {
    if (!videoOverlay.hasAttribute('hidden')) videoOverlay.setAttribute('hidden', '');
    deck.taskCodeOverlayTime = undefined;
    return;
  }
  if (videoOverlay.hasAttribute('hidden')) videoOverlay.removeAttribute('hidden');
  if (!deck.taskCodeElements) {
    const dot = add(videoOverlay, 'circle', {class: 'task-code-dot', r: 6});
    const line = add(videoOverlay, 'line', {x1: 650, y1: 550, stroke: '#b4ffda', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke'});
    add(videoOverlay, 'text', {x: 580, y: 565, 'font-size': 14}, 'Code');
    deck.taskCodeElements = {dot, line};
  }
  const currentTime = deck.querySelector('video').currentTime;
  if (deck.taskCodeOverlayTime === currentTime) return;
  deck.taskCodeOverlayTime = currentTime;
  const frames = barcodeVideoSideKeyframes;
  const nextIndex = frames.findIndex((frame) => frame.time > currentTime);
  const right = frames[nextIndex < 0 ? frames.length - 1 : nextIndex];
  const left = frames[Math.max(0, nextIndex < 0 ? frames.length - 2 : nextIndex - 1)];
  const fraction = right.time > left.time ? Math.min(1, Math.max(0, (currentTime - left.time) / (right.time - left.time))) : 0;
  const points = left.points.map(([x, y], index) => [
    x + (right.points[index][0] - x) * fraction,
    y + (right.points[index][1] - y) * fraction,
  ]);
  const center = points.reduce(([x, y], point) => [x + point[0] / 4, y + point[1] / 4], [0, 0]);
  deck.taskCodeElements.dot.setAttribute('cx', center[0].toFixed(2));
  deck.taskCodeElements.dot.setAttribute('cy', center[1].toFixed(2));
  deck.taskCodeElements.line.setAttribute('x2', center[0].toFixed(2));
  deck.taskCodeElements.line.setAttribute('y2', center[1].toFixed(2));
};

const resetTaskTargetInset = (deck) => {
  if (deck.dataset.deck !== 'tasks') return;
  if (deck.taskTargetAnimation) {
    deck.taskTargetAnimation.onfinish = null;
    deck.taskTargetAnimation.cancel();
    deck.taskTargetAnimation = null;
  }
  deck.taskTargetIndex = -1;
  deck.goalCadenceTick = undefined;
  const inset = deck.querySelector('.task-target-inset');
  if (inset) {
    inset.hidden = true;
    inset.dataset.state = 'hidden';
    inset.setAttribute('aria-hidden', 'true');
  }
  updateTaskCodeOverlay(deck, -1);
};

const animateTaskTargetInset = (deck, index, opening) => {
  const inset = deck.querySelector('.task-target-inset');
  const marker = deck.querySelector(`.goal-stream-markers button[data-goal-index="${index}"]`);
  if (deck.taskTargetAnimation) {
    deck.taskTargetAnimation.onfinish = null;
    deck.taskTargetAnimation.cancel();
    deck.taskTargetAnimation = null;
  }
  const finish = () => {
    inset.hidden = !opening;
    inset.dataset.state = opening ? 'visible' : 'hidden';
    deck.taskTargetAnimation = null;
  };
  if (!marker || reducedMotion.matches || typeof inset.animate !== 'function') {
    finish();
    return;
  }
  const from = marker.getBoundingClientRect();
  const to = inset.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) {
    finish();
    return;
  }
  const collapsed = {
    transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
    transformOrigin: 'top left',
    opacity: 0.65,
  };
  const expanded = {transform: 'translate(0, 0) scale(1, 1)', transformOrigin: 'top left', opacity: 1};
  const animation = inset.animate(opening ? [collapsed, expanded] : [expanded, collapsed], {
    duration: opening ? 280 : 220,
    easing: 'cubic-bezier(.2,.7,.2,1)',
  });
  deck.taskTargetAnimation = animation;
  animation.onfinish = finish;
};

const updateTaskTargetInset = (deck, index, seekable) => {
  if (deck.dataset.deck !== 'tasks') return;
  const inset = deck.querySelector('.task-target-inset');
  if (!inset) return;
  if (!seekable) {
    if (deck.taskTargetIndex !== -1 || !inset.hidden) resetTaskTargetInset(deck);
    return;
  }
  if (deck.taskTargetIndex !== index) {
    const previousIndex = deck.taskTargetIndex;
    deck.taskTargetIndex = index;
    if (index >= 0) {
      const stage = deck.goalStages[index];
      const filename = stage.src.split('/').pop().split(/[?#]/)[0];
      deck.dataset.targetCorner = taskTargetCornerOverrides[filename] || 'right';
      const image = inset.querySelector('.task-target-viewport > img');
      const code = inset.querySelector('.task-target-code');
      image.src = stage.src;
      image.alt = `Sample ${String(index + 1).padStart(2, '0')}: sampled hand–object configuration for ${deck.goalTaskTitle}`;
      frameGoalTarget(image, stage.src);
      if (code) frameGoalTarget(code, stage.src);
      inset.querySelector('.task-target-sample').textContent = `Sample ${String(index + 1).padStart(2, '0')}`;
      inset.hidden = false;
      inset.dataset.state = 'visible';
      inset.setAttribute('aria-hidden', 'false');
      animateTaskTargetInset(deck, index, true);
    } else {
      inset.setAttribute('aria-hidden', 'true');
      inset.dataset.state = 'closing';
      if (!inset.hidden && previousIndex >= 0) animateTaskTargetInset(deck, previousIndex, false);
      else {
        inset.hidden = true;
        inset.dataset.state = 'hidden';
      }
    }
  }
  updateTaskCodeOverlay(deck, index);
};

const buildGoalStream = (deck) => {
  const stream = deck.querySelector('.goal-stream');
  const video = deck.querySelector('video');
  if (!stream) return;
  const markers = deck.querySelector('.goal-stream-markers');
  const cadence = deck.querySelector('.goal-cadence-dots');
  markers?.replaceChildren();
  cadence?.replaceChildren();
  deck.goalCadenceTick = undefined;
  if (!deck.goalStages?.length || video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0 || deck.taskTargetSourceLoading) {
    updateGoalStream(deck, true);
    return;
  }
  markers?.setAttribute('aria-label', `${deck.goalStages.length} sampled configuration snapshots`);
  if (cadence) {
    const speed = Number.isFinite(deck.goalSpeed) && deck.goalSpeed > 0 ? deck.goalSpeed : 1;
    const start = Math.max(0, deck.goalPolicyStartTime || 0);
    // These decorative dots illustrate the stated update cadence, not a recorded goal log.
    for (let tick = 0; start + tick / speed < video.duration; tick += 1) {
      const dot = document.createElement('span');
      dot.className = 'goal-cadence-dot';
      dot.style.left = `${(start + tick / speed) / video.duration * 100}%`;
      cadence.append(dot);
    }
  }
  deck.goalStages.forEach((stage, index) => {
    const targetLabel = `Sample ${String(index + 1).padStart(2, '0')}`;
    const sampleDescription = `${targetLabel}, sampled configuration snapshot ${index + 1} of ${deck.goalStages.length}`;
    const inspectTarget = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (video.readyState < 1 || video.error || deck.taskTargetSourceLoading) return;
      activeDeck = deck;
      deck.dataset.inspectingGoal = 'true';
      pauseOtherDecks(video);
      video.pause();
      video.currentTime = stage.time;
      showGoalStage(deck, index, true);
      updateGoalForTime(deck);
      updateGoalStream(deck, true);
    };
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.dataset.goalIndex = String(index);
    marker.style.left = `${Math.min(100, Math.max(0, stage.time / video.duration * 100))}%`;
    marker.setAttribute('aria-label', `Inspect ${sampleDescription}`);
    marker.title = sampleDescription;
    marker.addEventListener('click', inspectTarget);
    const viewport = document.createElement('div');
    viewport.className = 'goal-target-viewport';
    const image = document.createElement('img');
    image.src = stage.src;
    image.alt = `${targetLabel}: sampled hand–object configuration for ${deck.goalTaskTitle}`;
    image.decoding = 'async';
    frameGoalTarget(image, stage.src);
    viewport.append(image);
    const label = document.createElement('span');
    label.className = 'goal-target-label';
    label.textContent = targetLabel;
    marker.append(viewport, label);
    markers?.append(marker);
    const nextStage = deck.goalStages[index + 1];
    if (nextStage) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'goal-stream-ellipsis';
      ellipsis.setAttribute('aria-hidden', 'true');
      ellipsis.textContent = '···';
      ellipsis.style.left = `${(stage.time + nextStage.time) / 2 / video.duration * 100}%`;
      markers?.append(ellipsis);
    }
  });
  updateGoalStream(deck, true);
};

const initializeTaskPlayer = (deck) => {
  if (deck.dataset.deck !== 'tasks') return;
  const player = deck.querySelector('.task-player');
  const video = deck.querySelector('video');
  const bar = player?.querySelector('.task-player-controls');
  const play = bar?.querySelector('.task-play-toggle');
  const track = bar?.querySelector('.task-seek-track');
  const seek = bar?.querySelector('.task-seek');
  const time = bar?.querySelector('.task-time');
  const mute = bar?.querySelector('.task-mute-toggle');
  const fullscreen = bar?.querySelector('.task-fullscreen-toggle');
  if (!player || !video || !bar || !play || !track || !seek || !time || !mute || !fullscreen) return;
  const controls = {player, bar, play, track, seek, time, mute, fullscreen, scrubbing: false};
  deck.taskPlayerControls = controls;
  deck.taskTargetSourceLoading = video.readyState < 1;
  resetTaskTargetInset(deck);

  const togglePlayback = () => {
    activeDeck = deck;
    if (video.paused || video.ended) {
      delete deck.dataset.inspectingGoal;
      pauseOtherDecks(video);
      if (video.ended) video.currentTime = 0;
      const selectedIndex = deck.dataset.activeIndex;
      video.play().catch((error) => {
        if (error.name !== 'AbortError' && selectedIndex === deck.dataset.activeIndex && video.paused) {
          deck.dataset.inspectingGoal = 'true';
        }
        updateGoalStream(deck, true);
      });
    } else {
      deck.dataset.inspectingGoal = 'true';
      video.pause();
    }
    updateGoalStream(deck, true);
  };
  play.addEventListener('click', togglePlayback);
  video.addEventListener('click', () => {
    if (!bar.hidden) togglePlayback();
  });
  player.tabIndex = 0;
  player.addEventListener('keydown', (event) => {
    if (bar.hidden || event.target.closest('button') || (event.key !== ' ' && event.code !== 'Space')) return;
    event.preventDefault();
    if (!event.repeat) togglePlayback();
  });

  const seekFromControl = () => {
    if (seek.disabled || !Number.isFinite(video.duration) || video.duration <= 0) return;
    activeDeck = deck;
    pauseOtherDecks(video);
    if (video.paused) deck.dataset.inspectingGoal = 'true';
    video.currentTime = Math.min(100, Math.max(0, Number(seek.value))) / 100 * video.duration;
    updateCompletionState(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck, true);
  };
  const finishScrubbing = () => {
    controls.scrubbing = false;
    updateGoalStream(deck, true);
  };
  seek.addEventListener('pointerdown', () => { controls.scrubbing = true; });
  seek.addEventListener('input', seekFromControl);
  seek.addEventListener('keydown', (event) => {
    const steps = {ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1};
    if (seek.disabled || !(event.key in steps || event.key === 'Home' || event.key === 'End')) return;
    event.preventDefault();
    const nextTime = event.key === 'Home' ? 0 : event.key === 'End' ? video.duration
      : Math.min(video.duration, Math.max(0, video.currentTime + steps[event.key]));
    seek.value = String(nextTime / video.duration * 100);
    seekFromControl();
  });
  seek.addEventListener('change', () => {
    seekFromControl();
    finishScrubbing();
  });
  seek.addEventListener('blur', finishScrubbing);
  window.addEventListener('pointerup', () => {
    if (controls.scrubbing) finishScrubbing();
  });
  window.addEventListener('pointercancel', () => {
    if (controls.scrubbing) finishScrubbing();
  });

  mute.addEventListener('click', () => {
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = 1;
      video.muted = false;
    } else {
      video.muted = true;
    }
    updateTaskPlayerControls(deck);
  });
  fullscreen.disabled = typeof player.requestFullscreen !== 'function' ||
    typeof document.exitFullscreen !== 'function' || document.fullscreenEnabled === false;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === player) await document.exitFullscreen();
      else await player.requestFullscreen();
      fullscreen.removeAttribute('title');
    } catch {
      fullscreen.title = 'Fullscreen is unavailable in this browser.';
    }
    updateTaskPlayerControls(deck);
  });
  document.addEventListener('fullscreenchange', () => {
    resetTaskTargetInset(deck);
    updateGoalStream(deck, true);
  });
  reducedMotion.addEventListener('change', () => {
    resetTaskTargetInset(deck);
    updateGoalStream(deck, true);
  });
  ['play', 'pause', 'ended', 'volumechange', 'seeking', 'seeked', 'canplay', 'error'].forEach((event) => {
    video.addEventListener(event, () => updateGoalStream(deck, true));
  });
  ['loadstart', 'emptied'].forEach((event) => {
    video.addEventListener(event, () => {
      controls.scrubbing = false;
      deck.taskTargetSourceLoading = true;
      resetTaskTargetInset(deck);
      buildGoalStream(deck);
    });
  });
  video.addEventListener('durationchange', () => buildGoalStream(deck));
  // Keep native controls unless the complete custom control bar was connected.
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
  note.setAttribute('aria-label', state.resetting ? 'Resetting before the next target' : `${label}, reference hand–object configuration on the left`);
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
  const alreadyLoaded = source.src === new URL(button.dataset.source, document.baseURI).href;
  if (!alreadyLoaded && deck.dataset.deck === 'tasks') {
    deck.taskTargetSourceLoading = true;
    resetTaskTargetInset(deck);
    buildGoalStream(deck);
  }
  const stage = deck.querySelector('.deck-stage');
  const status = deck.querySelector('.deck-status');
  const kicker = deck.querySelector('.deck-kicker');
  const title = deck.querySelector('.deck-caption h4');
  const description = deck.querySelector('.deck-caption p:not(.object-rate-note)');
  const goal = deck.querySelector('.stage-goal-ghost');

  if (goal || deck.querySelector('.goal-stream')) {
    deck.goalStages = parseGoalStages(button);
    deck.goalSpeed = Number(button.dataset.goalSpeed || 1);
    deck.goalPersistent = button.dataset.goalPersistent === 'true';
    deck.goalInset = button.dataset.goalInset === 'true' || (
      deck.dataset.deck === 'tasks' && !deck.goalPersistent
    );
    deck.goalPolicyStartTime = Number(button.dataset.policyStartTime || 0);
    deck.goalKind = button.dataset.goalKind || '';
    deck.goalTaskTitle = button.dataset.title || 'this task';
    if (!alreadyLoaded) deck.dataset.targetCorner = 'right';
    deck.goalStageIndex = -1;
    deck.goalStreamIndex = -1;
    if (goal) {
      goal.hidden = deck.goalStages.length === 0;
      goal.classList.toggle('demo-goal-inset', deck.goalInset);
      goal.classList.remove('is-visible');
    }
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

  if (alreadyLoaded) {
    configureSimulationTimeline(deck, button);
    updateCompletionState(deck);
    buildGoalStream(deck);
    updateGoalForTime(deck);
    if (shouldPlay && !document.hidden && (!paperVideo || paperVideo.paused) && !isComparisonPlaying()) video.play().catch(() => {});
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
    if (shouldPlay && activeDeck === deck && !document.hidden && (!paperVideo || paperVideo.paused) && !isComparisonPlaying() && deck.dataset.inspectingGoal !== 'true') {
      video.play().catch(() => {});
    }
  };
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) revealAndPlay();
  else video.addEventListener('canplay', revealAndPlay, {once: true});
};

const activateDeck = (deck) => {
  if (!deck || document.hidden || (paperVideo && !paperVideo.paused) || isComparisonPlaying()) return;
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
    if (deck.dataset.deck === 'tasks') deck.taskTargetSourceLoading = false;
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
    if (deck.dataset.deck === 'tasks' && deck.dataset.inspectingGoal === 'true') return;
    const next = (Number(deck.dataset.activeIndex || 0) + 1) % buttons.length;
    selectDeckItem(deck, next, true);
  });
  video.addEventListener('error', () => stage.classList.remove('is-loading'));
  stage.addEventListener('animationend', () => stage.classList.remove('is-switching'));
  initializeTaskPlayer(deck);
});

const activateMostVisibleDeck = () => {
  if (document.hidden) {
    deckVideos.forEach((video) => video.pause());
    return;
  }
  const fullscreenDeck = document.fullscreenElement?.closest('.video-deck[data-deck="tasks"]');
  if (fullscreenDeck) {
    pauseOtherDecks(fullscreenDeck.querySelector('video'));
    activateDeck(fullscreenDeck);
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
document.addEventListener('fullscreenchange', activateMostVisibleDeck);

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
