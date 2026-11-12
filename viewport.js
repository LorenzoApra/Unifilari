(function exposeViewport(root) {
  'use strict';

  root.UnifilariViewport = function createViewport({ container, stage, zoomSelect, readout, panButton, zoomIn, zoomOut, fitButton }) {
    const WIDTH = 1200, HEIGHT = WIDTH * 540 / 780;
    let scale = 1, fit = true, pan = false, space = false, gesture = null;
    const isEditing = (target) => target.closest('input, textarea, select, [contenteditable="true"]');
    const updateCursor = () => {
      container.classList.toggle('pan-ready', pan || space);
      container.classList.toggle('is-panning', Boolean(gesture));
      panButton.setAttribute('aria-pressed', String(pan));
    };
    function refresh() {
      if (fit) scale = Math.max(.1, Math.min(1, (container.clientWidth - 40) / WIDTH, (container.clientHeight - 40) / HEIGHT));
      stage.style.width = `${WIDTH * scale}px`;
      stage.style.height = `${HEIGHT * scale}px`;
      stage.style.setProperty('--canvas-scale', scale);
      zoomSelect.value = fit ? 'fit' : String(scale);
      // Anche gli ingrandimenti intermedi da rotellina restano selezionabili.
      zoomSelect.querySelector('[data-custom-zoom]')?.remove();
      if (!fit && !zoomSelect.value) {
        const option = document.createElement('option');
        option.value = String(scale); option.textContent = `${Math.round(scale * 100)}%`; option.dataset.customZoom = '';
        zoomSelect.append(option); zoomSelect.value = String(scale);
      }
      readout.textContent = `${Math.round(scale * 100)}%`;
      zoomOut.disabled = scale <= .25 && !fit;
      zoomIn.disabled = scale >= 2.5;
    }
    function setZoom(next, anchor = null) {
      const rect = container.getBoundingClientRect();
      const x = anchor ? anchor.x - rect.left : container.clientWidth / 2;
      const y = anchor ? anchor.y - rect.top : container.clientHeight / 2;
      const logicalX = (container.scrollLeft + x - stage.offsetLeft) / scale;
      const logicalY = (container.scrollTop + y - stage.offsetTop) / scale;
      fit = next === 'fit';
      if (!fit) scale = Math.max(.25, Math.min(2.5, Math.round(Number(next) * 100) / 100));
      refresh();
      container.scrollLeft = fit ? 0 : stage.offsetLeft + logicalX * scale - x;
      container.scrollTop = fit ? 0 : stage.offsetTop + logicalY * scale - y;
    }
    function stopPan(event) {
      if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.id)) return;
      const id = gesture.id;
      gesture = null;
      if (container.hasPointerCapture(id)) container.releasePointerCapture(id);
      updateCursor();
    }
    container.addEventListener('pointerdown', (event) => {
      if ((!pan && !space && event.button !== 1) || !event.isPrimary || event.target.closest('.empty-canvas')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop };
      container.setPointerCapture(event.pointerId);
      updateCursor();
    }, true);
    container.addEventListener('pointermove', (event) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      container.scrollLeft = gesture.left - (event.clientX - gesture.x);
      container.scrollTop = gesture.top - (event.clientY - gesture.y);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => container.addEventListener(type, stopPan));
    window.addEventListener('blur', (event) => { space = false; stopPan(event); updateCursor(); });
    container.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1), { x: event.clientX, y: event.clientY });
    }, { passive: false });
    document.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || isEditing(event.target) || event.target.closest('button, .node, .link') || document.querySelector('dialog[open]')) return;
      event.preventDefault(); space = true; updateCursor();
    });
    document.addEventListener('keyup', (event) => { if (event.code === 'Space') { space = false; updateCursor(); } });
    panButton.addEventListener('click', () => { pan = !pan; updateCursor(); });
    zoomSelect.addEventListener('change', () => setZoom(zoomSelect.value));
    zoomIn.addEventListener('click', () => setZoom((Math.floor(scale * 4) + 1) / 4));
    zoomOut.addEventListener('click', () => setZoom((Math.ceil(scale * 4) - 1) / 4));
    fitButton.addEventListener('click', () => setZoom('fit'));
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    refresh();
    return {
      refresh,
      fit: () => setZoom('fit'),
      resetScroll: () => { container.scrollLeft = 0; container.scrollTop = 0; },
      reveal(element) {
        if (!element) return;
        const target = element.getBoundingClientRect(), bounds = container.getBoundingClientRect();
        container.scrollLeft += target.left + target.width / 2 - bounds.left - container.clientWidth / 2;
        container.scrollTop += target.top + target.height / 2 - bounds.top - container.clientHeight / 2;
      },
      cancelPan() { pan = false; space = false; stopPan({}); updateCursor(); },
    };
  };
})(window);
