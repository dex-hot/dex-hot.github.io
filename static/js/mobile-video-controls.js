'use strict';



(() => {
  const mobile = window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)');
  const candidates = '#paper-video-player, .video-deck[data-deck="simulation"] .video-frame video, .video-deck[data-deck="real-transfer"] .video-frame video, video[data-comparison]';
  const icons = {
    play: '<path d="m8 5 11 7-11 7Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    replay: '<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/>',
    muted: '<path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6M21 9l-5 6"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
    fullscreen: '<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/>',
    exit: '<path d="M3 9h6V3M15 3v6h6M9 21v-6H3M15 21v-6h6"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const makeButton = (label, icon) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.innerHTML = svg(icon);
    return button;
  };
  let expandedPlayer = null;
  let restoreFocus = null;
  const nativeFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isExpanded = (player) => nativeFullscreen() === player || expandedPlayer === player;
  const notifyFullscreen = () => document.dispatchEvent(new CustomEvent('mobilemediafullscreenchange'));
  const leaveExpanded = () => {
    if (!expandedPlayer) return;
    expandedPlayer.classList.remove('mobile-video-expanded');
    expandedPlayer.removeAttribute('aria-modal');
    expandedPlayer.removeAttribute('role');
    expandedPlayer = null;
    document.documentElement.classList.remove('mobile-video-fullscreen');
    restoreFocus?.focus({preventScroll: true});
    restoreFocus = null;
    notifyFullscreen();
  };
  const toggleFullscreen = async (player, button) => {
    if (expandedPlayer === player) return leaveExpanded();
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (nativeFullscreen() === player && exit) return exit.call(document);

    const enter = player.requestFullscreen || player.webkitRequestFullscreen;
    if (enter && document.fullscreenEnabled !== false) {
      try { await enter.call(player); return; } catch {                              }
    }
    leaveExpanded();
    expandedPlayer = player;
    restoreFocus = button;
    player.classList.add('mobile-video-expanded');
    player.setAttribute('role', 'dialog');
    player.setAttribute('aria-modal', 'true');
    document.documentElement.classList.add('mobile-video-fullscreen');
    button.focus({preventScroll: true});
    notifyFullscreen();
  };
  document.addEventListener('keydown', (event) => {
    if (!expandedPlayer) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      leaveExpanded();
    } else if (event.key === 'Tab') {
      const items = [...expandedPlayer.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')]
        .filter((item) => item.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

  document.querySelectorAll('video').forEach((video) => {
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
  });

  const states = [...document.querySelectorAll(candidates)].map((video, index) => {
    const deck = video.closest('.video-deck');
    const player = video.closest('.deck-stage, .paper-video, .comparison-panel');
    if (!player) return null;
    const originalControls = video.controls;
    player.classList.add('mobile-media-player');
    const bar = document.createElement('div');
    bar.className = 'mobile-media-controls';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Video playback controls');
    bar.hidden = true;
    const play = makeButton('Play video', 'play');
    const seek = document.createElement('input');
    seek.type = 'range';
    seek.min = '0'; seek.max = '100'; seek.step = '0.01'; seek.value = '0';
    seek.setAttribute('aria-label', 'Video position');
    seek.disabled = true;
    const time = document.createElement('span');
    time.className = 'mobile-media-time';
    const mute = makeButton('Unmute video', 'muted');
    const fullscreen = makeButton('Enter fullscreen', 'fullscreen');
    const status = document.createElement('span');
    status.className = 'mobile-media-status';
    status.setAttribute('role', 'status');
    status.id = `mobile-media-status-${index}`;
    bar.append(play, seek, time, mute, fullscreen, status);
    (video.closest('.video-frame') || video).after(bar);
    const state = {video, player, bar, enabled: false, dragging: false, resume: false};
    const hold = () => { if (deck) deck.dataset.inspectingGoal = 'true'; };
    const playVideo = async () => {
      if (deck) delete deck.dataset.inspectingGoal;
      try { await video.play(); status.textContent = ''; }
      catch (error) {
        if (error.name !== 'AbortError') status.textContent = 'Tap Play to start this video.';
      }
    };
    const update = () => {
      if (!state.enabled) return;
      const duration = video.duration;
      const available = Number.isFinite(duration) && duration > 0 && video.readyState >= 1;
      seek.disabled = !available;
      if (!state.dragging) seek.value = available ? String(video.currentTime / duration * 100) : '0';
      seek.style.setProperty('--media-progress', `${seek.value}%`);
      seek.setAttribute('aria-valuetext', `${formatTime(video.currentTime)} of ${formatTime(duration)}`);
      time.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
      const playing = !video.paused && !video.ended;
      const playbackIcon = playing ? 'pause' : video.ended ? 'replay' : 'play';
      if (play.dataset.icon !== playbackIcon) {
        play.innerHTML = svg(playbackIcon);
        play.dataset.icon = playbackIcon;
        play.setAttribute('aria-label', playing ? 'Pause video' : video.ended ? 'Replay video' : 'Play video');
      }
      const muted = video.muted || video.volume === 0;
      if (mute.dataset.muted !== String(muted)) {
        mute.dataset.muted = String(muted);
        mute.innerHTML = svg(muted ? 'muted' : 'sound');
        mute.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
      }
      const expanded = isExpanded(player);
      fullscreen.innerHTML = svg(expanded ? 'exit' : 'fullscreen');
      fullscreen.setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Enter fullscreen');
    };
    const toggle = () => {
      if (!state.enabled) return;
      if (video.paused || video.ended) {
        if (video.ended) video.currentTime = 0;
        void playVideo();
      } else { hold(); video.pause(); }
      update();
    };
    const setPosition = () => {
      if (seek.disabled) return;
      const position = Math.min(100, Math.max(0, Number(seek.value))) / 100 * video.duration;
      hold();
      video.currentTime = position;
      seek.style.setProperty('--media-progress', `${seek.value}%`);
      time.textContent = `${formatTime(position)} / ${formatTime(video.duration)}`;
      seek.setAttribute('aria-valuetext', `${formatTime(position)} of ${formatTime(video.duration)}`);
    };
    const finish = () => {
      if (!state.dragging) return;
      state.dragging = false;
      const resume = state.resume;
      state.resume = false;
      if (resume && video.currentTime < video.duration && !video.error && !document.hidden) void playVideo();
      update();
    };
    play.addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    seek.addEventListener('pointerdown', () => {
      if (seek.disabled) return;
      state.dragging = true;
      state.resume = !video.paused && !video.ended;
      hold(); video.pause();
    });
    seek.addEventListener('input', setPosition);
    seek.addEventListener('change', finish);
    seek.addEventListener('blur', finish);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);

    mute.addEventListener('click', () => {
      if (video.muted || video.volume === 0) { video.muted = false; if (video.volume === 0) video.volume = 1; }
      else video.muted = true;
      update();
    });
    fullscreen.addEventListener('click', () => void toggleFullscreen(player, fullscreen));
    ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended', 'volumechange', 'seeked'].forEach((name) => video.addEventListener(name, update));
    ['loadstart', 'emptied'].forEach((name) => video.addEventListener(name, () => {
      state.dragging = state.resume = false;
      status.textContent = '';
      update();
    }));
    const syncMode = () => {
      state.enabled = (mobile.matches || isExpanded(player)) && !video.error;
      bar.hidden = !state.enabled;
      video.controls = state.enabled ? false : originalControls;
      video.classList.toggle('mobile-media-enhanced', state.enabled);
      player.classList.toggle('mobile-media-active', state.enabled);
      if (!state.enabled && expandedPlayer === player) leaveExpanded();
      update();
    };
    video.addEventListener('error', syncMode);
    video.addEventListener('loadedmetadata', syncMode);
    mobile.addEventListener('change', syncMode);
    ['fullscreenchange', 'webkitfullscreenchange', 'mobilemediafullscreenchange'].forEach((name) => document.addEventListener(name, syncMode));
    syncMode();
    return state;
  }).filter(Boolean);



  document.querySelectorAll('.task-player').forEach((player) => {
    const button = player.querySelector('.task-fullscreen-toggle');
    if (!button) return;
    const canFullscreen = typeof player.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
    if (canFullscreen) return;
    const sync = () => {
      button.disabled = !mobile.matches && !isExpanded(player);
      button.dataset.state = isExpanded(player) ? 'fullscreen' : 'windowed';
      button.setAttribute('aria-label', isExpanded(player) ? 'Exit fullscreen' : 'Enter fullscreen');
    };
    button.addEventListener('click', (event) => {
      if (!mobile.matches && !isExpanded(player)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void toggleFullscreen(player, button);
    }, true);
    mobile.addEventListener('change', sync);
    ['fullscreenchange', 'webkitfullscreenchange', 'mobilemediafullscreenchange'].forEach((name) => document.addEventListener(name, sync));
    sync();
  });
})();
