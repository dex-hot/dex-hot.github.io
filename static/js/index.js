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

// Load experiment videos near the viewport; the hero has its own playback controls.
const videos = [...document.querySelectorAll('.video-frame video')];
const loadVideo = (video) => {
  if (video.dataset.loaded === 'true') return;
  video.querySelectorAll('source[data-src]').forEach((source) => {
    source.src = source.dataset.src;
    delete source.dataset.src;
  });
  video.dataset.loaded = 'true';
  video.preload = 'metadata';
  video.load();
  if (video.dataset.rate) {
    video.defaultPlaybackRate = Number(video.dataset.rate);
    video.playbackRate = Number(video.dataset.rate);
  }
};

if ('IntersectionObserver' in window) {
  const videoObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadVideo(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '400px 0px' });
  videos.forEach((video) => videoObserver.observe(video));
} else {
  videos.forEach(loadVideo);
}

videos.forEach((video) => {
  video.addEventListener('play', () => {
    document.querySelectorAll('.hero-tile video').forEach((background) => background.pause());
    videos.forEach((otherVideo) => {
      if (otherVideo !== video && !otherVideo.paused) otherVideo.pause();
    });
  });
});

const heroVideos = [...document.querySelectorAll('.hero-tile video')];
const heroToggle = document.querySelector('#hero-toggle');
if (heroVideos.length && heroToggle) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let wantsPlayback = !reducedMotion.matches && !navigator.connection?.saveData;
  const isHeroVisible = () => {
    const bounds = document.querySelector('.hero-mosaic').getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < window.innerHeight;
  };
  const updateToggle = () => {
    const playing = heroVideos.some((video) => !video.paused);
    heroToggle.querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
    heroToggle.querySelector('.hero-toggle-label').textContent = `${playing ? 'Pause' : 'Play'} videos`;
    heroToggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} featured videos`);
  };
  const pauseHero = () => heroVideos.forEach((video) => video.pause());
  const playHero = () => {
    if (!wantsPlayback || !isHeroVisible() || document.hidden) return;
    heroVideos.forEach((video) => {
      loadVideo(video);
      video.play().catch(updateToggle);
    });
  };
  heroToggle.hidden = false;
  heroVideos.forEach((video) => {
    video.addEventListener('play', updateToggle);
    video.addEventListener('pause', updateToggle);
    video.addEventListener('error', updateToggle);
    const tile = video.parentElement;
    const crop = (tile.dataset.crop || '0,0,1,1').split(',').map(Number);
    const poster = new Image();
    // Each crop is a 4:3 action window checked across the source's motion.
    // Fill equal-sized frames without stretching; original media are unchanged.
    const fit = () => {
      const width = video.videoWidth || poster.naturalWidth;
      const height = video.videoHeight || poster.naturalHeight;
      if (!width || !height) return;
      const [x, y, w, h] = crop;
      const scale = Math.max(tile.clientWidth / (width * w), tile.clientHeight / (height * h));
      Object.assign(video.style, {
        width: `${width * scale}px`, height: `${height * scale}px`,
        left: `${(tile.clientWidth - width * w * scale) / 2 - width * x * scale}px`,
        top: `${(tile.clientHeight - height * h * scale) / 2 - height * y * scale}px`,
      });
    };
    poster.onload = fit;
    poster.src = video.poster;
    video.addEventListener('loadedmetadata', fit);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(tile);
    else window.addEventListener('resize', fit);
  });
  heroToggle.addEventListener('click', () => {
    wantsPlayback = !heroVideos.some((video) => !video.paused);
    if (wantsPlayback) playHero();
    else pauseHero();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(() => {
      if (isHeroVisible()) playHero();
      else pauseHero();
    }, {threshold: 0.1}).observe(document.querySelector('.hero-mosaic'));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseHero();
    else playHero();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      wantsPlayback = false;
      pauseHero();
    }
  });
  playHero();
}

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
