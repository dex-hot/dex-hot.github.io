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
const deckVisibility = new Map(decks.map((deck) => [deck, 0]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeDeck = null;

const pauseOtherDecks = (currentVideo) => {
  deckVideos.forEach((video) => {
    if (video !== currentVideo && !video.paused) video.pause();
  });
};

const parseGoalStages = (button) => {
  if (!button.dataset.goalPrefix) return [];
  const times = button.dataset.goalTimes.split(',').map(Number);
  const labels = button.dataset.goalLabels.split('|');
  const frames = button.dataset.goalFrames.split('|').length > 1
    ? button.dataset.goalFrames.split('|')
    : button.dataset.goalFrames.split(',');
  const layouts = button.dataset.goalLayouts.split('|').map((entry) => entry.split(',').map(Number));
  return times.map((time, index) => ({
    time,
    label: labels[index],
    frame: frames[index],
    layout: layouts[index],
    src: `${button.dataset.goalPrefix}-s${index + 1}.png?v=goal-stream-14`,
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
  image.alt = `${stage.label} hand-object target, aligned in video pixels for ${deck.goalTaskTitle}`;
  image.style.setProperty('--goal-x', `${x}%`);
  image.style.setProperty('--goal-y', `${y}%`);
  image.style.setProperty('--goal-width', `${width}%`);
  image.style.setProperty('--goal-rotation', `${rotation}deg`);
  goal.querySelector('figcaption span').textContent = `Representative goal ${String(stageIndex + 1).padStart(2, '0')} / 04`;
  goal.querySelector('figcaption strong').textContent = stage.label;
  goal.querySelector('figcaption small').textContent = `3D goal · pixel-aligned · F${stage.frame}`;
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
  if (isMatchedMoment) showGoalStage(deck, closestIndex);
  goal.classList.toggle('is-visible', isMatchedMoment);
};

const updateGoalStream = (deck, force = false) => {
  const stream = deck.querySelector('.goal-stream');
  const video = deck.querySelector('video');
  if (!stream || !deck.goalStages?.length || !Number.isFinite(video.duration)) return;
  const speed = deck.goalSpeed || 1;
  const goalIndex = Math.max(0, Math.floor(video.currentTime * speed));
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
  const updateCount = Math.max(1, Math.floor(video.duration * speed));
  stream.style.setProperty('--goal-tick-spacing', `${100 / updateCount}%`);
  const markers = stream.querySelector('.goal-stream-markers');
  markers.replaceChildren();
  deck.goalStages.forEach((stage, index) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.style.left = `${Math.min(100, stage.time / video.duration * 100)}%`;
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

const stopGoalAnimation = (deck) => {
  if (!deck.goalAnimationFrame) return;
  cancelAnimationFrame(deck.goalAnimationFrame);
  deck.goalAnimationFrame = 0;
};

const animateGoalStream = (deck) => {
  stopGoalAnimation(deck);
  const video = deck.querySelector('video');
  const step = () => {
    updateGoalForTime(deck);
    updateGoalStream(deck);
    if (!video.paused && !document.hidden) deck.goalAnimationFrame = requestAnimationFrame(step);
    else deck.goalAnimationFrame = 0;
  };
  step();
};

const updateComparisonCrop = (deck) => {
  if (deck.dataset.deck !== 'comparison') return;
  const video = deck.querySelector('video');
  const isNarrowShot = deck.dataset.activeIndex === '0' && video.currentTime < 4.36;
  deck.querySelector('.deck-stage').classList.toggle('is-wide-letterboxed', isNarrowShot);
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
  const description = deck.querySelector('.deck-caption p');
  const goal = deck.querySelector('.stage-goal-ghost');

  if (goal) {
    deck.goalStages = parseGoalStages(button);
    deck.goalSpeed = Number(button.dataset.goalSpeed || 1);
    deck.goalTaskTitle = button.dataset.title || 'this task';
    deck.goalStageIndex = -1;
    deck.goalStreamIndex = -1;
    goal.hidden = deck.goalStages.length === 0;
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
  status.textContent = button.dataset.status;
  status.className = `deck-status is-${button.dataset.tone || 'neutral'}`;
  stage.classList.toggle('is-failure', button.dataset.tone === 'failure');
  updateComparisonCrop(deck);
  kicker.textContent = button.dataset.kicker;
  title.textContent = button.dataset.title;
  description.textContent = button.dataset.description;
  video.setAttribute('aria-label', button.dataset.title);
  deck.style.setProperty('--media-scale', button.dataset.mediaScale || '1');

  const alreadyLoaded = source.src === new URL(button.dataset.source, document.baseURI).href;
  if (alreadyLoaded) {
    buildGoalStream(deck);
    updateGoalForTime(deck);
    if (shouldPlay && !document.hidden) video.play().catch(() => {});
    return;
  }

  video.pause();
  stage.classList.add('is-loading', 'is-switching');
  source.src = button.dataset.source;
  video.poster = button.dataset.poster;
  video.load();

  const revealAndPlay = () => {
    stage.classList.remove('is-loading');
    buildGoalStream(deck);
    updateGoalForTime(deck);
    if (shouldPlay && activeDeck === deck && !document.hidden) {
      video.play().catch(() => {});
    }
  };
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) revealAndPlay();
  else video.addEventListener('canplay', revealAndPlay, {once: true});
};

const activateDeck = (deck) => {
  if (!deck || document.hidden) return;
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
  video.addEventListener('pause', () => {
    stopGoalAnimation(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck, true);
  });
  video.addEventListener('loadedmetadata', () => {
    updateComparisonCrop(deck);
    buildGoalStream(deck);
    updateGoalForTime(deck);
  });
  video.addEventListener('timeupdate', () => {
    updateComparisonCrop(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck);
  });
  video.addEventListener('seeked', () => {
    updateComparisonCrop(deck);
    updateGoalForTime(deck);
    updateGoalStream(deck, true);
  });
  video.addEventListener('ended', () => {
    if (activeDeck !== deck || reducedMotion.matches) return;
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
