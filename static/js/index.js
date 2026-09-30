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

// Load each original presentation video only when it nears the viewport.
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
    videos.forEach((otherVideo) => {
      if (otherVideo !== video && !otherVideo.paused) otherVideo.pause();
    });
  });
});

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
