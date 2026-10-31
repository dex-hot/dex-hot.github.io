'use strict';

// Static images only. This component does not interact with the page's videos.
(() => {
  const gallery = document.querySelector('#distance-gallery');
  if (!gallery) return;
  const tabs = [...gallery.querySelectorAll('.dg-tabs [role="tab"]')];
  const panel = gallery.querySelector('.dg-panel');
  const status = gallery.querySelector('.dg-status');
  const retry = gallery.querySelector('.dg-retry');
  const thumbnails = gallery.querySelector('.dg-thumbnails');
  const previous = gallery.querySelector('.dg-previous');
  const next = gallery.querySelector('.dg-next');
  const referenceStage = gallery.querySelector('.dg-reference .dg-image-stage');
  const sampleStage = gallery.querySelector('.dg-sample .dg-image-stage');
  const imageRequests = new WeakMap();
  const groupIds = ['0to20mm', '20to40mm', '20to70mm', 'over70mm'];
  const bounds = [[0, 20], [20, 40], [20, 70], [70, Infinity]];
  const selectedByGroup = new Map([['0to20mm', 4]]);
  let data = null;
  let groupIndex = 0;
  let sampleIndex = 0;
  let loading = false;

  const require = (condition) => {
    if (!condition) throw new Error('Invalid configuration-distance gallery data.');
  };
  const validImagePath = (src) => typeof src === 'string' &&
    /^(?:\.\/)?static\/configuration-distance\/[A-Za-z0-9_-]+\.webp$/.test(src);

  const validateData = (value) => {
    require(value && value.reference?.gid === 977 && validImagePath(value.reference.src));
    require(Array.isArray(value.groups) && value.groups.length === groupIds.length);
    const seen = new Set([value.reference.gid]);
    value.groups.forEach((group, index) => {
      require(group.id === groupIds[index] && typeof group.name === 'string' && group.name.trim());
      require(typeof group.label === 'string' && Array.isArray(group.samples) && group.samples.length === 10);
      group.samples.forEach((sample, position) => {
        require(Number.isInteger(sample.gid) && sample.gid >= 0 && !seen.has(sample.gid));
        require(sample.index === position + 1 && Number.isFinite(sample.d_mm));
        require(sample.d_mm > bounds[index][0] && sample.d_mm <= bounds[index][1]);
        require(validImagePath(sample.src));
        seen.add(sample.gid);
      });
    });
    return value;
  };

  const loadImage = (stage, src, alt, kind) => {
    const old = imageRequests.get(stage);
    if (old) {
      clearTimeout(old.timer);
      old.image.onload = null;
      old.image.onerror = null;
    }
    stage.querySelector('img')?.remove();
    const message = stage.querySelector('.dg-image-message');
    message.hidden = false;
    message.textContent = `Loading ${kind} image…`;
    stage.dataset.state = 'pending';
    const image = new Image(640, 640);
    image.alt = alt;
    image.decoding = 'async';
    const request = {image, timer: null};
    imageRequests.set(stage, request);
    const finish = (loaded) => {
      if (imageRequests.get(stage) !== request) return;
      clearTimeout(request.timer);
      image.onload = null;
      image.onerror = null;
      // A full, identical 640 × 640 canvas is essential for equal-scale comparison.
      if (loaded && image.naturalWidth === 640 && image.naturalHeight === 640) {
        stage.append(image);
        message.hidden = true;
        stage.dataset.state = 'ready';
      } else {
        message.textContent = loaded
          ? `This ${kind} image has an unexpected canvas size and cannot be compared at the same scale.`
          : `The ${kind} image could not be loaded. Please reload the page to try again.`;
        stage.dataset.state = 'error';
      }
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    request.timer = setTimeout(() => finish(false), 12000);
    image.src = src;
  };

  const selectSample = (index, focusThumbnail = false) => {
    if (!data) return;
    const group = data.groups[groupIndex];
    sampleIndex = Math.min(group.samples.length - 1, Math.max(0, index));
    selectedByGroup.set(group.id, sampleIndex);
    const sample = group.samples[sampleIndex];
    const distance = sample.d_mm.toFixed(2);
    gallery.querySelector('.dg-sample-id').textContent = `gid ${sample.gid}`;
    gallery.querySelector('.dg-sample-distance').textContent = `d = ${distance}`;
    gallery.querySelector('.dg-sample-position').textContent = `Sample ${String(sample.index).padStart(2, '0')} / ${group.samples.length}`;
    previous.disabled = sampleIndex === 0;
    next.disabled = sampleIndex === group.samples.length - 1;
    [...thumbnails.children].forEach((button, buttonIndex) => {
      const selected = buttonIndex === sampleIndex;
      button.setAttribute('aria-pressed', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focusThumbnail) button.focus();
    });
    gallery.querySelector('.dg-announcement').textContent = `${group.name}. Sample ${sample.index} of ${group.samples.length}. Distance ${distance} millimetres from reference.`;
    loadImage(sampleStage, sample.src,
      `Drill hand–object configuration, gid ${sample.gid}, ${distance} mm from reference gid 977`, 'sample');
  };

  const selectGroup = (index, focusTab = false) => {
    if (!data) return;
    groupIndex = index;
    const group = data.groups[groupIndex];
    tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === groupIndex;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });
    panel.setAttribute('aria-labelledby', tabs[groupIndex].id);
    gallery.querySelector('.dg-group-name').textContent = group.name;
    thumbnails.setAttribute('aria-label', `Ten ${group.name.toLowerCase()} configuration samples`);
    thumbnails.replaceChildren();
    group.samples.forEach((sample, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dg-thumbnail';
      button.setAttribute('aria-label', `Sample ${sample.index}, distance ${sample.d_mm.toFixed(2)} millimetres, gid ${sample.gid}`);
      const viewport = document.createElement('span');
      viewport.className = 'dg-thumbnail-image';
      const image = document.createElement('img');
      image.width = 640;
      image.height = 640;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.alt = '';
      image.addEventListener('error', () => {
        image.hidden = true;
        const unavailable = document.createElement('span');
        unavailable.textContent = 'Image unavailable';
        viewport.append(unavailable);
      }, {once: true});
      image.src = sample.src;
      viewport.append(image);
      const label = document.createElement('span');
      label.className = 'dg-thumbnail-distance';
      label.textContent = `${sample.d_mm.toFixed(2)} mm`;
      button.append(viewport, label);
      button.addEventListener('click', () => selectSample(index));
      thumbnails.append(button);
    });
    selectSample(selectedByGroup.get(group.id) ?? 0);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectGroup(index));
    tab.addEventListener('keydown', (event) => {
      if (!data || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const destination = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectGroup(destination, true);
    });
  });
  previous.addEventListener('click', () => selectSample(sampleIndex - 1));
  next.addEventListener('click', () => selectSample(sampleIndex + 1));
  panel.addEventListener('keydown', (event) => {
    if (!data || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const destination = event.key === 'Home' ? 0 : event.key === 'End' ? 9
      : sampleIndex + (event.key === 'ArrowRight' ? 1 : -1);
    selectSample(destination, thumbnails.contains(event.target));
  });

  const loadGallery = async () => {
    if (loading || data) return;
    loading = true;
    gallery.dataset.state = 'loading';
    status.hidden = false;
    status.textContent = 'Loading configuration examples…';
    retry.hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(gallery.dataset.manifest, {signal: controller.signal, credentials: 'same-origin'});
      if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
      data = validateData(await response.json());
      tabs.forEach((tab) => { tab.disabled = false; });
      panel.hidden = false;
      status.hidden = true;
      gallery.dataset.state = 'ready';
      gallery.querySelector('.dg-reference-id').textContent = `gid ${data.reference.gid}`;
      loadImage(referenceStage, data.reference.src, 'Fixed drill reference configuration, gid 977, distance zero', 'reference');
      selectGroup(0);
    } catch {
      data = null;
      tabs.forEach((tab) => { tab.disabled = true; });
      panel.hidden = true;
      status.hidden = false;
      gallery.dataset.state = 'error';
      status.textContent = 'The configuration examples could not be loaded. The distance definition and evaluation protocol remain available.';
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  };
  retry.addEventListener('click', loadGallery);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadGallery();
    }, {rootMargin: '400px 0px'});
    observer.observe(gallery);
  } else {
    loadGallery();
  }
})();
