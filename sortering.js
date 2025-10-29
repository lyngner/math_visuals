(function () {
  const globalObj = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const doc = globalObj && globalObj.document ? globalObj.document : null;
  if (!globalObj || !doc) return;

  const DESCRIPTION_RENDERER = globalObj.MathVisDescriptionRenderer || null;

  function normalizeItem(raw, index) {
    const source = raw && typeof raw === 'object' ? raw : {};
    let id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '';
    if (!id) {
      id = `item-${index + 1}`;
    }

    const descriptionCandidates = [source.description, source.text, source.content, source.label];
    let description = '';
    for (const candidate of descriptionCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        description = candidate.trim();
        break;
      }
    }

    const labelCandidates = [source.label, source.alt, description, source.id];
    let label = '';
    for (const candidate of labelCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        label = candidate.trim();
        break;
      }
    }

    const assetCandidates = [source.asset, source.svg, source.image];
    let asset = null;
    for (const candidate of assetCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        asset = candidate.trim();
        break;
      }
    }

    const altCandidates = [source.alt, label, description];
    let alt = '';
    for (const candidate of altCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        alt = candidate.trim();
        break;
      }
    }

    return {
      id,
      description,
      label,
      asset,
      alt
    };
  }

  function buildItems(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [];
    const seen = new Set();
    return list.map((entry, index) => {
      const normalized = normalizeItem(entry, index);
      let { id } = normalized;
      if (!id) {
        id = `item-${index + 1}`;
        normalized.id = id;
      }
      if (seen.has(id)) {
        let suffix = 2;
        let candidateId = `${id}-${suffix}`;
        while (seen.has(candidateId)) {
          suffix += 1;
          candidateId = `${id}-${suffix}`;
        }
        normalized.id = candidateId;
        seen.add(candidateId);
      } else {
        seen.add(id);
      }
      return normalized;
    });
  }

  function cloneItem(item) {
    if (!item || typeof item !== 'object') return item;
    return {
      id: item.id,
      description: item.description,
      label: item.label,
      asset: item.asset,
      alt: item.alt
    };
  }

  function sanitizeOrder(items, order) {
    const idSet = new Set(items.map(item => item.id));
    const seen = new Set();
    const result = [];
    if (Array.isArray(order)) {
      order.forEach(id => {
        if (typeof id !== 'string') return;
        if (!idSet.has(id) || seen.has(id)) return;
        seen.add(id);
        result.push(id);
      });
    }
    items.forEach(item => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      result.push(item.id);
    });
    return result;
  }

  function shuffle(values) {
    const arr = Array.isArray(values) ? values.slice() : [];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function normalizeDirection(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'vertikal' || normalized === 'vertical') {
        return 'vertikal';
      }
    }
    return 'horisontal';
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim();
      if (!normalized) return NaN;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  function normalizeGap(value, fallback) {
    const parsed = parseNumber(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(0, parsed);
  }

  function buildButtonLabel(item, position) {
    if (item && typeof item.label === 'string' && item.label.trim()) {
      return item.label.trim();
    }
    if (item && typeof item.alt === 'string' && item.alt.trim()) {
      return item.alt.trim();
    }
    if (item && typeof item.description === 'string' && item.description.trim()) {
      return item.description.trim();
    }
    const idx = Number.isFinite(position) ? position + 1 : 0;
    return idx > 0 ? `Element ${idx}` : 'Element';
  }

  const DEFAULT_RAW_ITEMS = [
    { id: 'item-1', description: '\\frac{1}{2}', label: '1/2', alt: 'En halv' },
    { id: 'item-2', description: '\\sqrt{16}', label: '√16', alt: 'Kvadratroten av seksten' },
    { id: 'item-3', description: '7', label: '7', alt: 'Sju' },
    { id: 'item-4', asset: 'images/greenStar.svg', label: 'Grønn stjerne', alt: 'Grønn stjerne' }
  ];

  const DEFAULT_ITEMS = buildItems(DEFAULT_RAW_ITEMS);
  const DEFAULT_STATE = {
    items: DEFAULT_ITEMS.map(cloneItem),
    order: DEFAULT_ITEMS.map(item => item.id),
    retning: 'horisontal',
    gap: 32,
    randomisering: false
  };

  let state = null;
  let currentOrder = [];
  const itemNodes = new Map();
  const itemsById = new Map();
  let visualList = null;
  let accessibleList = null;
  let figureHost = null;
  let keyboardActiveId = null;
  const keyboardHandlers = new Map();
  let dragState = null;

  function ensureItemNodes(item) {
    if (!item || !item.id) return null;
    if (itemNodes.has(item.id)) {
      return itemNodes.get(item.id);
    }
    const wrapper = doc.createElement('div');
    wrapper.className = 'sortering__item';
    wrapper.dataset.itemId = item.id;

    const contentEl = doc.createElement('div');
    contentEl.className = 'sortering__item-content';
    wrapper.appendChild(contentEl);

    const li = doc.createElement('li');
    li.className = 'sortering__skia-item';
    li.dataset.itemId = item.id;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sortering__skia-button';
    button.dataset.itemId = item.id;
    li.appendChild(button);

    const nodes = { wrapper, contentEl, li, button };
    itemNodes.set(item.id, nodes);
    attachItemListeners(item.id, nodes);
    return nodes;
  }

  function renderItem(item, position) {
    if (!item) return null;
    const nodes = ensureItemNodes(item);
    if (!nodes) return null;

    const { wrapper, contentEl, li, button } = nodes;
    const label = buildButtonLabel(item, position);
    const accessibleLabel = item && typeof item.alt === 'string' && item.alt.trim() ? item.alt.trim() : label;

    wrapper.dataset.itemId = item.id;
    wrapper.dataset.position = Number.isFinite(position) ? String(position + 1) : '';

    while (contentEl.firstChild) {
      contentEl.removeChild(contentEl.firstChild);
    }

    if (item.asset) {
      const img = doc.createElement('img');
      img.src = item.asset;
      img.alt = accessibleLabel || label || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.className = 'sortering__item-image';
      contentEl.appendChild(img);
    }

    if (item.description) {
      const descriptionEl = doc.createElement('div');
      descriptionEl.className = 'sortering__item-description';
      if (DESCRIPTION_RENDERER && typeof DESCRIPTION_RENDERER.renderInto === 'function') {
        DESCRIPTION_RENDERER.renderInto(descriptionEl, item.description);
      } else {
        descriptionEl.textContent = item.description;
      }
      contentEl.appendChild(descriptionEl);
    } else if (!item.asset && label) {
      contentEl.textContent = label;
    }

    li.dataset.itemId = item.id;
    li.dataset.position = Number.isFinite(position) ? String(position + 1) : '';

    button.dataset.itemId = item.id;
    button.dataset.position = Number.isFinite(position) ? String(position + 1) : '';
    button.textContent = label;
    if (accessibleLabel && accessibleLabel !== label) {
      button.setAttribute('aria-label', accessibleLabel);
    } else if (accessibleLabel) {
      button.setAttribute('aria-label', accessibleLabel);
    } else {
      button.removeAttribute('aria-label');
    }
    if (accessibleLabel) {
      button.title = accessibleLabel;
    } else {
      button.removeAttribute('title');
    }

    return nodes;
  }

  function syncVisualOrder() {
    if (!visualList) return;
    currentOrder.forEach((id, index) => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.wrapper) return;
      const expectedNode = visualList.children[index];
      if (expectedNode !== nodes.wrapper) {
        visualList.insertBefore(nodes.wrapper, expectedNode || null);
      }
    });
  }

  function syncAccessibleOrder() {
    if (!accessibleList) return;
    const fragment = doc.createDocumentFragment();
    currentOrder.forEach(id => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.li) return;
      fragment.appendChild(nodes.li);
    });
    accessibleList.appendChild(fragment);
  }

  function updateItemPositions() {
    const size = currentOrder.length;
    currentOrder.forEach((id, index) => {
      const nodes = itemNodes.get(id);
      if (!nodes) return;
      const pos = index + 1;
      if (nodes.wrapper) {
        nodes.wrapper.dataset.position = String(pos);
      }
      if (nodes.li) {
        nodes.li.dataset.position = String(pos);
        nodes.li.setAttribute('aria-posinset', String(pos));
        nodes.li.setAttribute('aria-setsize', String(size));
      }
      if (nodes.button) {
        nodes.button.dataset.position = String(pos);
        nodes.button.setAttribute('aria-posinset', String(pos));
        nodes.button.setAttribute('aria-setsize', String(size));
      }
    });

    syncVisualOrder();
    syncAccessibleOrder();
  }

  function snapToSlot(targetId) {
    const ids = typeof targetId === 'string' ? [targetId] : currentOrder.slice();
    ids.forEach(id => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.wrapper) return;
      const { wrapper } = nodes;
      wrapper.style.transition = '';
      wrapper.style.transform = '';
      wrapper.classList.remove('sortering__item--dragging');
    });
  }

  function finalizeKeyboardMode(options = {}) {
    const { restoreFocus = false } = options;
    if (!keyboardActiveId) return;
    const id = keyboardActiveId;
    const nodes = itemNodes.get(id);
    const handler = keyboardHandlers.get(id);
    if (nodes && handler) {
      nodes.button.removeEventListener('keydown', handler);
    }
    keyboardHandlers.delete(id);
    keyboardActiveId = null;
    if (nodes) {
      nodes.wrapper.classList.remove('sortering__item--active');
      nodes.button.classList.remove('sortering__skia-button--active');
      nodes.button.removeAttribute('aria-pressed');
      if (restoreFocus) {
        nodes.button.focus();
      }
    }
  }

  function clearVisualMarkers() {
    finalizeKeyboardMode();
    itemNodes.forEach(nodes => {
      if (nodes.wrapper) {
        nodes.wrapper.classList.remove('sortering__item--dragging');
        nodes.wrapper.classList.remove('sortering__item--active');
      }
      if (nodes.button) {
        nodes.button.classList.remove('sortering__skia-button--active');
        nodes.button.removeAttribute('aria-pressed');
      }
    });
  }

  function moveItemToIndex(id, targetIndex, options = {}) {
    if (!state || !currentOrder.length) return false;
    const { preserveTransform = false } = options;
    const currentIndex = currentOrder.indexOf(id);
    if (currentIndex < 0) return false;
    const maxIndex = currentOrder.length - 1;
    const boundedIndex = Math.max(0, Math.min(maxIndex, targetIndex));
    if (boundedIndex === currentIndex) return false;
    currentOrder.splice(currentIndex, 1);
    currentOrder.splice(boundedIndex, 0, id);

    updateItemPositions();
    if (!preserveTransform) {
      snapToSlot(id);
    }
    return true;
  }

  function swapWith(id, offset, options = {}) {
    if (!Number.isFinite(offset) || !offset) return false;
    const idx = currentOrder.indexOf(id);
    if (idx < 0) return false;
    return moveItemToIndex(id, idx + offset, options);
  }

  function handleKeyboardInteraction(event, id) {
    if (!state || keyboardActiveId !== id) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const moved = swapWith(id, -1);
      if (moved) {
        snapToSlot();
      }
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const moved = swapWith(id, 1);
      if (moved) {
        snapToSlot();
      }
    } else if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      snapToSlot();
      updateItemPositions();
      finalizeKeyboardMode({ restoreFocus: event.key === 'Enter' });
    }
  }

  function activateKeyboardMode(id) {
    if (!id) return;
    if (keyboardActiveId === id) return;
    finalizeKeyboardMode();
    const nodes = itemNodes.get(id);
    if (!nodes) return;
    keyboardActiveId = id;
    nodes.wrapper.classList.add('sortering__item--active');
    nodes.button.classList.add('sortering__skia-button--active');
    nodes.button.setAttribute('aria-pressed', 'true');
    const handler = event => handleKeyboardInteraction(event, id);
    keyboardHandlers.set(id, handler);
    nodes.button.addEventListener('keydown', handler);
  }

  function startPointerDrag(event, id) {
    if (!visualList || dragState || !state) return;
    if (typeof event.button === 'number' && event.button !== 0) return;
    const nodes = itemNodes.get(id);
    if (!nodes) return;
    dragState = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    nodes.wrapper.classList.add('sortering__item--dragging');
    nodes.wrapper.style.transition = 'none';
    if (typeof nodes.wrapper.setPointerCapture === 'function') {
      nodes.wrapper.setPointerCapture(event.pointerId);
    }
    const selection = globalObj.getSelection ? globalObj.getSelection() : null;
    if (selection && typeof selection.removeAllRanges === 'function') {
      selection.removeAllRanges();
    }
    finalizeKeyboardMode();
    event.preventDefault();
  }

  function handlePointerMove(event, id) {
    if (!dragState || dragState.id !== id) return;
    if (event.pointerId !== dragState.pointerId) return;
    const nodes = itemNodes.get(id);
    if (!nodes) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    nodes.wrapper.style.transform = `translate(${dx}px, ${dy}px)`;

    nodes.wrapper.style.pointerEvents = 'none';
    const hovered = doc.elementFromPoint(event.clientX, event.clientY);
    nodes.wrapper.style.pointerEvents = '';
    const targetWrapper = hovered && hovered.closest ? hovered.closest('.sortering__item') : null;
    const orientation = normalizeDirection(state.retning);
    const pointerCoord = orientation === 'vertikal' ? event.clientY : event.clientX;

    let targetIndex = -1;
    if (targetWrapper && targetWrapper !== nodes.wrapper) {
      const targetId = targetWrapper.dataset.itemId;
      if (!targetId || targetId === id) return;
      targetIndex = currentOrder.indexOf(targetId);
      if (targetIndex < 0) return;
      const targetRect = targetWrapper.getBoundingClientRect();
      const targetCenter = orientation === 'vertikal' ? targetRect.top + targetRect.height / 2 : targetRect.left + targetRect.width / 2;
      if (pointerCoord > targetCenter) {
        targetIndex += 1;
      }
    } else if (visualList && currentOrder.length) {
      const firstId = currentOrder[0];
      const lastId = currentOrder[currentOrder.length - 1];
      const firstNodes = itemNodes.get(firstId);
      const lastNodes = itemNodes.get(lastId);
      if (!firstNodes || !lastNodes) return;
      const firstRect = firstNodes.wrapper.getBoundingClientRect();
      const lastRect = lastNodes.wrapper.getBoundingClientRect();
      const startBoundary = orientation === 'vertikal' ? firstRect.top : firstRect.left;
      const endBoundary = orientation === 'vertikal' ? lastRect.bottom : lastRect.right;
      if (pointerCoord < startBoundary) {
        targetIndex = 0;
      } else if (pointerCoord > endBoundary) {
        targetIndex = currentOrder.length;
      }
    }

    if (targetIndex < 0) return;
    moveItemToIndex(id, targetIndex, { preserveTransform: true });
  }

  function finishPointerDrag(event, id) {
    if (!dragState || dragState.id !== id) return;
    if (event.pointerId !== dragState.pointerId) return;
    const nodes = itemNodes.get(id);
    dragState = null;
    if (nodes) {
      if (typeof nodes.wrapper.releasePointerCapture === 'function') {
        nodes.wrapper.releasePointerCapture(event.pointerId);
      }
      nodes.wrapper.style.transition = '';
    }
    snapToSlot(id);
    updateItemPositions();
    clearVisualMarkers();
  }

  function attachItemListeners(id, nodes) {
    if (!nodes || nodes.wrapper.dataset.listenersAttached === 'true') return;
    nodes.wrapper.dataset.listenersAttached = 'true';
    nodes.wrapper.style.touchAction = 'none';
    nodes.wrapper.addEventListener('pointerdown', event => startPointerDrag(event, id));
    nodes.wrapper.addEventListener('pointermove', event => handlePointerMove(event, id));
    nodes.wrapper.addEventListener('pointerup', event => finishPointerDrag(event, id));
    nodes.wrapper.addEventListener('pointercancel', event => finishPointerDrag(event, id));

    nodes.button.addEventListener('click', () => {
      if (keyboardActiveId === id) {
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode({ restoreFocus: true });
      } else {
        activateKeyboardMode(id);
      }
    });

    nodes.button.addEventListener('keydown', event => {
      if (event.key === 'Enter' && keyboardActiveId !== id) {
        event.preventDefault();
        activateKeyboardMode(id);
      } else if (event.key === 'Escape' && keyboardActiveId === id) {
        event.preventDefault();
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode({ restoreFocus: true });
      }
    });

    nodes.button.addEventListener('focus', () => {
      nodes.wrapper.classList.add('sortering__item--focus');
    });

    nodes.button.addEventListener('blur', () => {
      nodes.wrapper.classList.remove('sortering__item--focus');
      if (keyboardActiveId === id) {
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode();
      }
    });
  }

  function applyOrder(options = {}) {
    if (!state || !visualList || !accessibleList) return;

    const sanitizedBase = sanitizeOrder(state.items, state.order);
    if (sanitizedBase.length !== state.order.length) {
      state.order = sanitizedBase;
    }

    let nextOrder = [];
    if (options.randomize) {
      nextOrder = shuffle(sanitizedBase);
    } else if (options.resetToBase || currentOrder.length === 0) {
      nextOrder = sanitizedBase.slice();
    } else {
      nextOrder = sanitizeOrder(state.items, currentOrder);
      if (nextOrder.length !== sanitizedBase.length) {
        nextOrder = sanitizedBase.slice();
      }
    }

    currentOrder = nextOrder;
    const usedIds = new Set();

    currentOrder.forEach((id, index) => {
      const item = itemsById.get(id);
      if (!item) return;
      const nodes = renderItem(item, index);
      if (!nodes) return;
      usedIds.add(id);
      if (visualList && nodes.wrapper.parentNode !== visualList) {
        visualList.appendChild(nodes.wrapper);
      } else if (visualList) {
        visualList.appendChild(nodes.wrapper);
      }
      if (accessibleList && nodes.li.parentNode !== accessibleList) {
        accessibleList.appendChild(nodes.li);
      } else if (accessibleList) {
        accessibleList.appendChild(nodes.li);
      }
    });

    itemNodes.forEach((nodes, id) => {
      if (usedIds.has(id)) return;
      if (nodes.wrapper.parentNode === visualList) {
        visualList.removeChild(nodes.wrapper);
      }
      if (nodes.li.parentNode === accessibleList) {
        accessibleList.removeChild(nodes.li);
      }
    });
    updateItemPositions();
    snapToSlot();
    clearVisualMarkers();
  }

  function updateLayout() {
    if (!visualList || !state) return;
    const direction = normalizeDirection(state.retning);
    state.retning = direction;

    visualList.style.display = 'flex';
    visualList.style.flexWrap = direction === 'vertikal' ? 'nowrap' : 'wrap';
    visualList.style.flexDirection = direction === 'vertikal' ? 'column' : 'row';
    visualList.style.alignItems = direction === 'vertikal' ? 'flex-start' : 'stretch';
    visualList.style.gap = `${state.gap}px`;
    visualList.dataset.direction = direction;

    if (figureHost && !figureHost.classList.contains('sortering__figure')) {
      figureHost.classList.add('sortering__figure');
    }

    if (accessibleList) {
      accessibleList.setAttribute('aria-orientation', direction === 'vertikal' ? 'vertical' : 'horizontal');
    }
  }

  function handleGapChange(event) {
    if (!event || !event.target) return;
    const fallback = DEFAULT_STATE.gap;
    const nextValue = normalizeGap(event.target.value, state ? state.gap : fallback);
    if (!state) return;
    state.gap = Number.isFinite(nextValue) ? nextValue : fallback;
    event.target.value = String(state.gap);
    updateLayout();
  }

  function setupSettingsForm(host) {
    if (!host) return;
    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }

    const form = doc.createElement('form');
    form.className = 'sortering-settings';
    form.setAttribute('autocomplete', 'off');
    form.noValidate = true;

    const directionField = doc.createElement('div');
    directionField.className = 'sortering-settings__field';

    const directionLabel = doc.createElement('label');
    directionLabel.className = 'sortering-settings__label';
    directionLabel.textContent = 'Retning';
    directionLabel.setAttribute('for', 'sortering-direction');

    const directionSelect = doc.createElement('select');
    directionSelect.id = 'sortering-direction';
    directionSelect.name = 'direction';

    const optionHorizontal = doc.createElement('option');
    optionHorizontal.value = 'horisontal';
    optionHorizontal.textContent = 'Horisontal';

    const optionVertical = doc.createElement('option');
    optionVertical.value = 'vertikal';
    optionVertical.textContent = 'Vertikal';

    directionSelect.appendChild(optionHorizontal);
    directionSelect.appendChild(optionVertical);
    directionSelect.value = normalizeDirection(state && state.retning);
    directionSelect.addEventListener('change', event => {
      if (!state) return;
      state.retning = normalizeDirection(event.target.value);
      directionSelect.value = state.retning;
      updateLayout();
    });

    directionField.appendChild(directionLabel);
    directionField.appendChild(directionSelect);

    const gapField = doc.createElement('div');
    gapField.className = 'sortering-settings__field';

    const gapLabel = doc.createElement('label');
    gapLabel.className = 'sortering-settings__label';
    gapLabel.textContent = 'Avstand (px)';
    gapLabel.setAttribute('for', 'sortering-gap');

    const gapInput = doc.createElement('input');
    gapInput.id = 'sortering-gap';
    gapInput.name = 'gap';
    gapInput.type = 'number';
    gapInput.min = '0';
    gapInput.step = '1';
    gapInput.value = state ? String(state.gap) : String(DEFAULT_STATE.gap);
    gapInput.addEventListener('change', handleGapChange);
    gapInput.addEventListener('input', handleGapChange);

    gapField.appendChild(gapLabel);
    gapField.appendChild(gapInput);

    const randomField = doc.createElement('label');
    randomField.className = 'sortering-settings__checkbox';

    const randomInput = doc.createElement('input');
    randomInput.type = 'checkbox';
    randomInput.name = 'randomize';
    randomInput.checked = !!(state && state.randomisering);
    randomInput.addEventListener('change', event => {
      if (!state) return;
      state.randomisering = !!event.target.checked;
      applyOrder({ randomize: state.randomisering, resetToBase: !state.randomisering });
    });

    const randomLabelText = doc.createElement('span');
    randomLabelText.textContent = 'Randomiser startrekkefølge';

    randomField.appendChild(randomInput);
    randomField.appendChild(randomLabelText);

    form.appendChild(directionField);
    form.appendChild(gapField);
    form.appendChild(randomField);

    host.appendChild(form);
  }

  function createState() {
    const rootState = globalObj.STATE && typeof globalObj.STATE === 'object' ? globalObj.STATE : {};
    if (!globalObj.STATE || typeof globalObj.STATE !== 'object') {
      globalObj.STATE = rootState;
    }

    const existing = rootState.sortering && typeof rootState.sortering === 'object' ? rootState.sortering : null;
    const incomingItems = buildItems(existing && Array.isArray(existing.items) ? existing.items : []);
    const items = incomingItems.length ? incomingItems : DEFAULT_ITEMS.map(cloneItem);
    const orderSource = existing && Array.isArray(existing.order) ? existing.order : DEFAULT_STATE.order;
    const order = sanitizeOrder(items, orderSource);
    const retning = normalizeDirection(existing && existing.retning ? existing.retning : DEFAULT_STATE.retning);
    const gap = normalizeGap(existing && 'gap' in existing ? existing.gap : Number.NaN, DEFAULT_STATE.gap);
    const randomisering = !!(existing && existing.randomisering);

    const nextState = {
      items,
      order,
      retning,
      gap,
      randomisering
    };

    rootState.sortering = nextState;
    globalObj.STATE = rootState;
    return nextState;
  }

  function init() {
    figureHost = doc.getElementById('sortFigure');
    accessibleList = doc.getElementById('sortSkia');
    const settingsHost = doc.getElementById('settingsHost');

    if (!figureHost || !accessibleList) {
      return;
    }

    state = createState();
    itemsById.clear();
    state.items.forEach(item => {
      itemsById.set(item.id, item);
    });

    currentOrder = sanitizeOrder(state.items, state.order);

    if (!visualList) {
      visualList = doc.createElement('div');
      visualList.className = 'sortering__items';
      figureHost.appendChild(visualList);
    }

    if (accessibleList && accessibleList.firstChild) {
      while (accessibleList.firstChild) {
        accessibleList.removeChild(accessibleList.firstChild);
      }
    }

    updateLayout();
    applyOrder({ randomize: !!state.randomisering, resetToBase: !state.randomisering });
    if (settingsHost) {
      setupSettingsForm(settingsHost);
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
