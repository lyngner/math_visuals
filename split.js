document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.grid').forEach(grid => {
    const side = grid.querySelector('.side');
    if (!side) return;

    // mål startbredden før splitteren legges til slik at vi bevarer
    // sidens opprinnelige bredde på ulike sider
    const initialWidth = side.getBoundingClientRect().width;
    const splitter = document.createElement('div');
    splitter.className = 'splitter';
    grid.insertBefore(splitter, side);
    grid.classList.add('split-enabled');
    grid.style.setProperty('--side-width', `${initialWidth}px`);
    let startX = 0;
    let startWidth = 0;
    const minWidth = 200;
    let scheduledResize = false;
    const scheduleResize = () => {
      if (scheduledResize) return;
      scheduledResize = true;
      requestAnimationFrame(() => {
        scheduledResize = false;
        window.dispatchEvent(new Event('resize'));
      });
    };

    let gridWidth = 0;
    const onMove = e => {
      const dx = e.clientX - startX;
      let newWidth = startWidth + dx;
      const maxWidth = Math.max(minWidth, gridWidth - 100);
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      grid.style.setProperty('--side-width', `${newWidth}px`);
      scheduleResize();
    };
    const stopDrag = e => {
      if (
        e &&
        typeof splitter.releasePointerCapture === 'function' &&
        typeof splitter.hasPointerCapture === 'function' &&
        splitter.hasPointerCapture(e.pointerId)
      ) {
        splitter.releasePointerCapture(e.pointerId);
      }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', stopDrag);
      scheduleResize();
    };
    const startDrag = e => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = side.getBoundingClientRect().width;
      gridWidth = grid.clientWidth;
      if (typeof splitter.setPointerCapture === 'function') {
        splitter.setPointerCapture(e.pointerId);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', stopDrag);
    };
    splitter.addEventListener('pointerdown', startDrag);
    splitter.addEventListener('lostpointercapture', stopDrag);
  });
});
