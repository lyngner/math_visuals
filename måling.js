(function initMeasurementApp() {
  const board = document.querySelector('[data-board]');
  const ruler = board ? board.querySelector('[data-ruler]') : null;
  if (!board || !ruler) {
    return;
  }

  const state = {
    x: 0,
    y: 0,
    rotation: 0
  };

  const activePointers = new Map();
  let boardRect = board.getBoundingClientRect();
  const baseSize = {
    width: ruler.offsetWidth,
    height: ruler.offsetHeight
  };

  function applyTransform() {
    ruler.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}rad)`;
  }

  function centerRuler() {
    boardRect = board.getBoundingClientRect();
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;
    const offsetX = (boardRect.width - baseSize.width) / 2;
    const offsetY = Math.max(boardRect.height - baseSize.height - 32, 16);
    state.x = offsetX;
    state.y = offsetY;
    state.rotation = 0;
    applyTransform();
  }

  centerRuler();

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let value = angle;
    while (value <= -Math.PI) value += twoPi;
    while (value > Math.PI) value -= twoPi;
    return value;
  }

  function updateFromSinglePointer(pointerEntry) {
    const dx = pointerEntry.clientX - pointerEntry.prevX;
    const dy = pointerEntry.clientY - pointerEntry.prevY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    state.x += dx;
    state.y += dy;
    applyTransform();
  }

  function updateFromGesture(currentEntry) {
    const pointers = Array.from(activePointers.values());
    if (pointers.length === 0) {
      return;
    }
    if (pointers.length === 1) {
      updateFromSinglePointer(currentEntry);
      return;
    }

    const [p1, p2] = pointers;
    const prevPoints = [
      { x: p1 === currentEntry ? currentEntry.prevX : p1.clientX, y: p1 === currentEntry ? currentEntry.prevY : p1.clientY },
      { x: p2 === currentEntry ? currentEntry.prevX : p2.clientX, y: p2 === currentEntry ? currentEntry.prevY : p2.clientY }
    ];
    const nextPoints = [
      { x: p1.clientX, y: p1.clientY },
      { x: p2.clientX, y: p2.clientY }
    ];

    const prevCenter = {
      x: (prevPoints[0].x + prevPoints[1].x) / 2,
      y: (prevPoints[0].y + prevPoints[1].y) / 2
    };
    const nextCenter = {
      x: (nextPoints[0].x + nextPoints[1].x) / 2,
      y: (nextPoints[0].y + nextPoints[1].y) / 2
    };

    const prevAngle = Math.atan2(prevPoints[1].y - prevPoints[0].y, prevPoints[1].x - prevPoints[0].x);
    const nextAngle = Math.atan2(nextPoints[1].y - nextPoints[0].y, nextPoints[1].x - nextPoints[0].x);

    state.x += nextCenter.x - prevCenter.x;
    state.y += nextCenter.y - prevCenter.y;
    state.rotation = normalizeAngle(state.rotation + normalizeAngle(nextAngle - prevAngle));
    applyTransform();
  }

  function handlePointerDown(event) {
    if (event.button && event.button !== 0) {
      return;
    }
    if (activePointers.size >= 2 && !activePointers.has(event.pointerId)) {
      return;
    }
    event.preventDefault();
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY
    };
    activePointers.set(event.pointerId, entry);
    try {
      ruler.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handlePointerMove(event) {
    const entry = activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;
    updateFromGesture(entry);
  }

  function handlePointerEnd(event) {
    const entry = activePointers.get(event.pointerId);
    if (!entry) {
      return;
    }
    activePointers.delete(event.pointerId);
    try {
      ruler.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handleResize() {
    const prevRect = boardRect;
    boardRect = board.getBoundingClientRect();
    const widthChanged = !prevRect || Math.abs(boardRect.width - prevRect.width) > 1;
    const heightChanged = !prevRect || Math.abs(boardRect.height - prevRect.height) > 1;
    baseSize.width = ruler.offsetWidth;
    baseSize.height = ruler.offsetHeight;

    if (activePointers.size === 0 && (widthChanged || heightChanged)) {
      centerRuler();
      return;
    }

    const maxX = boardRect.width;
    const maxY = boardRect.height;
    state.x = Math.min(Math.max(state.x, -maxX), maxX);
    state.y = Math.min(Math.max(state.y, -maxY), maxY);
    applyTransform();
  }

  ruler.addEventListener('pointerdown', handlePointerDown, { passive: false });
  ruler.addEventListener('pointermove', handlePointerMove);
  ruler.addEventListener('pointerup', handlePointerEnd);
  ruler.addEventListener('pointercancel', handlePointerEnd);
  ruler.addEventListener('lostpointercapture', event => {
    if (event.pointerId != null) {
      activePointers.delete(event.pointerId);
    }
  });

  board.addEventListener('dblclick', event => {
    event.preventDefault();
    if (activePointers.size === 0) {
      centerRuler();
    }
  });

  window.addEventListener('resize', handleResize);
})();
