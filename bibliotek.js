const amountManifestUrl = '/images/amounts/manifest.json';
const measureManifestUrl = '/images/measure/manifest.json';
const statusEl = document.querySelector('[data-status]');
const filterInput = document.querySelector('[data-filter]');
const countEl = document.querySelector('[data-count]');
const categoryGrid = document.querySelector('[data-category-grid]');
const categorySortSelect = document.querySelector('[data-category-sort]');
const helperEl = document.querySelector('[data-helper]');
const categorySuggestionsList = document.querySelector('[data-category-suggestions]');
const uploadForm = document.querySelector('[data-upload-form]');
const addCategoryToggleButton = document.querySelector('[data-add-category-toggle]');
const addCategoryForm = document.querySelector('[data-add-category-form]');
const addCategoryInput = addCategoryForm?.querySelector('[data-add-category-input]') || null;
const addCategoryCancelButton = addCategoryForm?.querySelector('[data-add-category-cancel]') || null;
const addCategoryFeedback = document.querySelector('[data-add-category-feedback]');
const uploadFileInput = uploadForm?.querySelector('[data-upload-file]') || null;
const uploadNameInput = uploadForm?.querySelector('[data-upload-name]') || null;
const uploadCategoryInput = uploadForm?.querySelector('[data-upload-category]') || null;
const uploadStatusEl = uploadForm?.querySelector('[data-upload-status]') || null;
const editorDialog = document.querySelector('[data-custom-editor]');
const editorForm = editorDialog?.querySelector('[data-editor-form]') || null;
const editorNameInput = editorDialog?.querySelector('[data-editor-name]') || null;
const editorCategoryInput = editorDialog?.querySelector('[data-editor-category]') || null;
const editorErrorEl = editorDialog?.querySelector('[data-editor-error]') || null;
const editorCancelButton = editorDialog?.querySelector('[data-editor-cancel]') || null;
const categoryDialog = document.querySelector('[data-category-dialog]');
const categoryDialogTitle = categoryDialog?.querySelector('[data-category-title]') || null;
const categoryDialogDescription = categoryDialog?.querySelector('[data-category-description]') || null;
const categoryDialogCount = categoryDialog?.querySelector('[data-category-count]') || null;
const categoryDialogFigures = categoryDialog?.querySelector('[data-category-figures]') || null;
const categoryDialogEmpty = categoryDialog?.querySelector('[data-category-empty]') || null;
const categoryDialogCloseButton = categoryDialog?.querySelector('[data-category-close]') || null;
const categoryDialogUploadButton = categoryDialog?.querySelector('[data-category-upload]') || null;
const categoryMenu = document.querySelector('[data-category-menu]');
const categoryMenuSurface = categoryMenu?.querySelector('[data-category-menu-surface]') || null;
const copyFeedbackTimers = new WeakMap();

const CUSTOM_STORAGE_KEY = 'mathvis:figureLibrary:customEntries:v1';
const CUSTOM_CATEGORY_STORAGE_KEY = 'mathvis:figureLibrary:customCategories:v1';
const DEFAULT_CATEGORY_THUMBNAIL = '/images/amounts/tb10.svg';
const CATEGORY_PREVIEW_COUNT = 4;
const FIGURE_LIBRARY_ENDPOINT = '/api/figure-library';
const FIGURE_LIBRARY_TOOL = 'bibliotek-upload';

const amountCategories = [
  {
    id: 'tierbrett',
    type: 'amount',
    name: 'Tierbrett',
    filter: 'Tierbrett',
    sampleSlug: 'tb10',
    sampleAlt: 'Eksempel på tierbrett',
    description: 'Tierbrett med markører som representerer antall.',
    matches: (slug) => slug.startsWith('tb'),
  },
  {
    id: 'tallbrikker',
    type: 'amount',
    name: 'Tallbrikker',
    filter: 'Tallbrikker',
    sampleSlug: 'n53',
    sampleAlt: 'Eksempel på tallbrikker',
    description: 'Tallbrikker som viser grupperte mengder.',
    matches: (slug) => slug.startsWith('n'),
  },
  {
    id: 'penger',
    type: 'amount',
    name: 'Penger',
    filter: 'Penger',
    sampleSlug: 'v50',
    sampleAlt: 'Eksempel på penger',
    description: 'Sedler og mynter til arbeid med kroner og øre.',
    matches: (slug) => slug.startsWith('v'),
  },
  {
    id: 'terninger',
    type: 'amount',
    name: 'Terninger',
    filter: 'Terninger',
    sampleSlug: 'd5',
    sampleAlt: 'Eksempel på terninger',
    description: 'Terninger for sannsynlighet og telling.',
    matches: (slug) => slug.startsWith('d'),
  },
  {
    id: 'hender',
    type: 'amount',
    name: 'Hender',
    filter: 'Hender',
    sampleSlug: 'h05G',
    sampleAlt: 'Eksempel på tellehender',
    description: 'Hender som viser fingre for tallrepresentasjon.',
    matches: (slug) => slug.startsWith('h'),
  },
];

let categories = [];
const categoryMetaById = new Map();

const categoryButtons = new Map();
let activeCategoryId = null;

let categorySortOrder = 'default';

const figuresByCategory = new Map();
const UNCATEGORIZED_KEY = '__uncategorized__';

let figureItems = [];
let allAmountSlugs = [];
let measurementItems = [];
let measurementCategoryList = [];

const customCategories = [];
const customCategoryMap = new Map();
let addCategoryFeedbackTimer = null;

const customEntries = [];
const customEntryMap = new Map();
let customStorageAvailable = true;
let uploadStatusTimer = null;
let editorReturnFocus = null;
let editingEntryId = null;
let categoryDialogReturnFocus = null;
let categoryMenuTrigger = null;
let categoryMenuCategory = null;

let figureLibraryMetadata = { storageMode: 'memory', persistent: false, limitation: '' };

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.1,
    })
  : null;

async function init() {
  setStatusMessage('Laster figurer …', 'info', { storeBase: true });
  loadCustomCategories();
  try {
    await loadCustomEntries();
  } catch (error) {
    console.error('Kunne ikke laste egendefinerte figurer', error);
  }
  refreshLibrary({ maintainFilter: false });
  loadLibraries();
  filterInput?.addEventListener('input', handleFilterInput);
  categorySortSelect?.addEventListener('change', handleCategorySortChange);
  setupAddCategoryForm();
  setupUploadForm();
  setupEditorDialog();
  setupCategoryDialog();
  setupCategoryMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function loadLibraries() {
  try {
    const [amountPayload, measurePayload] = await Promise.all([
      fetchJson(amountManifestUrl),
      fetchJson(measureManifestUrl).catch((error) => {
        console.error('Kunne ikke laste målemanifestet', error);
        return null;
      }),
    ]);

    if (!amountPayload || !Array.isArray(amountPayload.slugs)) {
      throw new Error('Ugyldig manifest for mengder');
    }

    allAmountSlugs = amountPayload.slugs;

    const measurementCatalog = Array.isArray(measurePayload?.categories)
      ? measurePayload.categories
      : [];

    const { categoryList: measurementCategories, items: measurementData } =
      buildMeasurementData(measurementCatalog);

    measurementItems = measurementData;
    measurementCategoryList = measurementCategories;

    refreshLibrary();
  } catch (error) {
    console.error('Kunne ikke laste manifestet', error);
    setStatusMessage('Kunne ikke laste figurene. Prøv å laste siden på nytt.', 'error', {
      includeStorageWarning: false,
    });
  }
}

function refreshLibrary(options = {}) {
  const { maintainFilter = true } = options;
  const baseCategories = amountCategories.concat(Array.isArray(measurementCategoryList) ? measurementCategoryList : []);
  const augmentedBase = baseCategories.concat(customCategories);

  alignCustomEntriesWithBaseCategories(augmentedBase);

  prepareFigureItems(allAmountSlugs, measurementItems, customEntries);
  recomputeCategories(augmentedBase);

  let shouldCloseCategoryDialog = false;
  if (!maintainFilter) {
    if (activeCategoryId) {
      shouldCloseCategoryDialog = true;
    }
    activeCategoryId = null;
    if (filterInput) {
      filterInput.value = '';
    }
  } else if (activeCategoryId && !categoryMetaById.has(activeCategoryId)) {
    activeCategoryId = null;
    shouldCloseCategoryDialog = true;
  }

  updateCategorySelection();
  updateCategoryCounts();
  applyFilter();

  if (shouldCloseCategoryDialog && isCategoryDialogOpen()) {
    closeCategoryDialog({ restoreFocus: false });
  }
}

function renderCategories() {
  if (!categoryGrid) return;
  closeCategoryMenu({ returnFocus: false });
  categoryGrid.innerHTML = '';
  categoryButtons.clear();
  categoryMetaById.clear();

  const fragment = document.createDocumentFragment();
  const orderedCategories = getSortedCategories(categories);
  for (const category of orderedCategories) {
    if (!category || typeof category !== 'object') {
      continue;
    }
    const categoryId = typeof category.id === 'string' ? category.id : '';
    if (!categoryId) continue;
    const titleText = getCategoryDisplayName(category) || categoryId;
    const descriptionText = typeof category.description === 'string' && category.description.trim()
      ? category.description.trim()
      : '';

    const type = typeof category.type === 'string' ? category.type : 'custom';
    const normalizedMeta = { ...category, id: categoryId, type, name: titleText, description: descriptionText };

    const item = document.createElement('li');
    item.className = 'categoryItem';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'categoryMenuToggle';
    menuButton.dataset.categoryId = categoryId;
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', `Flere handlinger for ${titleText}`);
    menuButton.innerHTML = `
      <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
        <circle cx="8" cy="3" r="1.5" fill="currentColor"></circle>
        <circle cx="8" cy="8" r="1.5" fill="currentColor"></circle>
        <circle cx="8" cy="13" r="1.5" fill="currentColor"></circle>
      </svg>
    `;
    menuButton.addEventListener('click', (event) => handleCategoryMenuToggle(event, normalizedMeta));
    menuButton.addEventListener('keydown', (event) => handleCategoryMenuButtonKeydown(event, normalizedMeta));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'categoryButton';
    button.dataset.categoryId = categoryId;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', titleText);
    button.title = titleText;
    button.addEventListener('click', (event) => handleCategoryClick(category, event.currentTarget));

    const figure = createCategoryPreviewElement(category, titleText);

    const meta = document.createElement('div');
    meta.className = 'categoryMeta';

    const title = document.createElement('h3');
    title.textContent = titleText;
    meta.appendChild(title);

    const description = document.createElement('p');
    if (descriptionText) {
      description.textContent = descriptionText;
      description.hidden = false;
    } else {
      description.textContent = '';
      description.hidden = true;
    }
    meta.appendChild(description);

    const count = document.createElement('span');
    count.className = 'categoryCount';
    count.dataset.categoryCount = '';
    count.textContent = '–';
    meta.appendChild(count);

    button.appendChild(figure);
    button.appendChild(meta);

    item.appendChild(button);
    item.appendChild(menuButton);
    fragment.appendChild(item);

    categoryButtons.set(categoryId, { button, countEl: count, category: normalizedMeta, listItem: item, menuButton });
    categoryMetaById.set(categoryId, normalizedMeta);
  }

  categoryGrid.appendChild(fragment);
}

function getSortedCategories(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const items = list.slice();
  if (categorySortOrder === 'alphabetical') {
    return items.sort((a, b) => {
      const nameA = (getCategoryDisplayName(a) || '').toLowerCase();
      const nameB = (getCategoryDisplayName(b) || '').toLowerCase();
      return nameA.localeCompare(nameB, 'nb', { sensitivity: 'base' });
    });
  }
  return items;
}

function setupCategoryMenu() {
  if (!categoryMenu || !categoryMenuSurface) return;
  categoryMenuSurface.addEventListener('click', handleCategoryMenuClick);
  categoryMenuSurface.addEventListener('keydown', handleCategoryMenuSurfaceKeydown);
  categoryMenu.addEventListener('focusout', handleCategoryMenuFocusOut);
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  window.addEventListener('resize', handleWindowResizeForMenu);
  window.addEventListener('scroll', handleWindowScrollForMenu, true);
}

function isCategoryMenuOpen() {
  return Boolean(categoryMenu && categoryMenu.dataset.open === 'true');
}

function getCategoryMenuItems() {
  if (!categoryMenuSurface) return [];
  return Array.from(categoryMenuSurface.querySelectorAll('[data-category-action]'));
}

function handleCategoryMenuToggle(event, category) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) return;
  if (!category || typeof category.id !== 'string') return;

  if (isCategoryMenuOpen() && categoryMenuTrigger === button) {
    closeCategoryMenu({ returnFocus: false });
    return;
  }

  closeCategoryMenu({ returnFocus: false });
  openCategoryMenu(button, category);
}

function handleCategoryMenuButtonKeydown(event, category) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) return;
  if (!category || typeof category.id !== 'string') return;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const focusLast = event.key === 'ArrowUp';
    closeCategoryMenu({ returnFocus: false });
    openCategoryMenu(button, category, { focusLast });
  }
}

function openCategoryMenu(button, category, options = {}) {
  if (!categoryMenu || !categoryMenuSurface) return;
  if (!(button instanceof HTMLElement)) return;
  if (!category || typeof category.id !== 'string') return;

  const { focusLast = false } = options;
  categoryMenuTrigger = button;
  categoryMenuCategory = category;

  categoryMenu.hidden = false;
  categoryMenu.dataset.open = 'true';
  button.setAttribute('aria-expanded', 'true');

  positionCategoryMenu(button);

  const items = getCategoryMenuItems();
  if (items.length > 0) {
    const targetItem = focusLast ? items[items.length - 1] : items[0];
    requestAnimationFrame(() => {
      targetItem.focus();
    });
  }
}

function positionCategoryMenu(button) {
  if (!categoryMenuSurface) return;
  categoryMenuSurface.style.top = '0px';
  categoryMenuSurface.style.left = '0px';

  const triggerRect = button.getBoundingClientRect();
  const surfaceRect = categoryMenuSurface.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  let top = triggerRect.bottom + 8;
  const surfaceHeight = surfaceRect.height || 0;
  if (top + surfaceHeight > viewportHeight - 12) {
    top = Math.max(12, triggerRect.top - surfaceHeight - 8);
  }

  let left = triggerRect.right - surfaceRect.width;
  const surfaceWidth = surfaceRect.width || 0;
  if (left < 12) {
    left = 12;
  }
  const maxLeft = viewportWidth - surfaceWidth - 12;
  if (left > maxLeft) {
    left = maxLeft;
  }

  categoryMenuSurface.style.top = `${Math.round(top)}px`;
  categoryMenuSurface.style.left = `${Math.round(left)}px`;
}

function closeCategoryMenu(options = {}) {
  if (!categoryMenu) return;
  const { returnFocus = true } = options;
  const trigger = categoryMenuTrigger;

  categoryMenu.dataset.open = 'false';
  categoryMenu.hidden = true;

  if (categoryMenuSurface) {
    categoryMenuSurface.style.top = '';
    categoryMenuSurface.style.left = '';
  }

  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
  }

  categoryMenuTrigger = null;
  categoryMenuCategory = null;

  if (returnFocus && trigger) {
    requestAnimationFrame(() => {
      trigger.focus();
    });
  }
}

function handleCategoryMenuClick(event) {
  if (!categoryMenuSurface) return;
  const target = event.target instanceof HTMLElement
    ? event.target.closest('[data-category-action]')
    : null;
  if (!target || !categoryMenuSurface.contains(target)) return;
  event.preventDefault();
  event.stopPropagation();
  const action = target.dataset.categoryAction || '';
  handleCategoryMenuAction(action);
}

function handleCategoryMenuSurfaceKeydown(event) {
  if (!isCategoryMenuOpen()) return;
  const items = getCategoryMenuItems();
  if (items.length === 0) return;

  const activeElement = document.activeElement;
  const currentIndex = items.indexOf(activeElement);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
    items[nextIndex].focus();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
    items[prevIndex].focus();
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    items[0].focus();
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    items[items.length - 1].focus();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeCategoryMenu();
    return;
  }

  if (event.key === 'Tab') {
    closeCategoryMenu({ returnFocus: false });
  }
}

function handleCategoryMenuFocusOut(event) {
  if (!isCategoryMenuOpen()) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof HTMLElement) {
    if (categoryMenu?.contains(nextTarget)) {
      return;
    }
    if (categoryMenuTrigger && categoryMenuTrigger.contains(nextTarget)) {
      return;
    }
  }

  requestAnimationFrame(() => {
    if (!isCategoryMenuOpen()) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) {
      if (categoryMenu?.contains(focused)) {
        return;
      }
      if (categoryMenuTrigger && categoryMenuTrigger.contains(focused)) {
        return;
      }
    }
    closeCategoryMenu({ returnFocus: false });
  });
}

function handleDocumentPointerDown(event) {
  if (!isCategoryMenuOpen()) return;
  const target = event.target;
  if (target instanceof HTMLElement) {
    if (categoryMenu?.contains(target)) {
      return;
    }
    if (categoryMenuTrigger && categoryMenuTrigger.contains(target)) {
      return;
    }
  }
  closeCategoryMenu({ returnFocus: false });
}

function handleDocumentKeydown(event) {
  if (!isCategoryMenuOpen()) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCategoryMenu();
  }
}

function handleWindowResizeForMenu() {
  if (isCategoryMenuOpen()) {
    closeCategoryMenu({ returnFocus: false });
  }
}

function handleWindowScrollForMenu() {
  if (isCategoryMenuOpen()) {
    closeCategoryMenu({ returnFocus: false });
  }
}

async function handleCategoryMenuAction(action) {
  if (!categoryMenuCategory || typeof categoryMenuCategory.id !== 'string') {
    closeCategoryMenu({ returnFocus: false });
    return;
  }

  const category = categoryMenuCategory;

  if (action === 'open') {
    closeCategoryMenu({ returnFocus: false });
    const entry = categoryButtons.get(category.id);
    const trigger = entry?.button || categoryMenuTrigger;
    handleCategoryClick(category, trigger);
    return;
  }

  if (action === 'filter') {
    closeCategoryMenu({ returnFocus: false });
    if (filterInput) {
      const query = `category:${category.id}`;
      filterInput.value = query;
      filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      filterInput.focus();
    }
    return;
  }

  if (action === 'copy-id') {
    closeCategoryMenu();
    await copyCategoryIdentifier(category);
    return;
  }

  closeCategoryMenu({ returnFocus: false });
}

async function copyCategoryIdentifier(category) {
  if (!category || typeof category.id !== 'string' || !category.id) {
    return;
  }
  try {
    const success = await copyToClipboard(category.id);
    if (success) {
      announceStatus(`Kopierte kategori-ID «${category.id}».`);
    } else {
      announceStatus(`Kunne ikke kopiere kategori-ID «${category.id}». Kopier teksten manuelt.`);
    }
  } catch (error) {
    console.error('Kunne ikke kopiere kategori-ID', error);
    announceStatus(`Kunne ikke kopiere kategori-ID «${category.id}». Prøv igjen.`);
  }
}

function getStorageWarningMessage() {
  if (!figureLibraryMetadata || typeof figureLibraryMetadata !== 'object') {
    return '';
  }
  const limitation = typeof figureLibraryMetadata.limitation === 'string'
    ? figureLibraryMetadata.limitation.trim()
    : '';
  return limitation;
}

function composeStatusMessage(message, includeStorageWarning = true) {
  const baseMessage = typeof message === 'string' ? message.trim() : '';
  const storageMessage = includeStorageWarning ? getStorageWarningMessage() : '';
  if (baseMessage && storageMessage) {
    return `${baseMessage}\n${storageMessage}`;
  }
  if (storageMessage) {
    return storageMessage;
  }
  return baseMessage;
}

function setStatusMessage(message, state = 'info', options = {}) {
  if (!statusEl) return;
  const shouldStoreBase = options.storeBase !== false;
  const includeStorageWarning = options.includeStorageWarning !== false;
  const baseMessage = shouldStoreBase
    ? (typeof message === 'string' ? message : '')
    : statusEl.dataset.baseMessage || '';
  if (shouldStoreBase) {
    statusEl.dataset.baseMessage = baseMessage;
  }
  statusEl.dataset.includeStorageWarning = includeStorageWarning ? 'true' : 'false';
  const finalMessage = composeStatusMessage(baseMessage, includeStorageWarning);
  statusEl.textContent = finalMessage || '';
  statusEl.dataset.state = state;
  if (state === 'error') {
    statusEl.classList.add('error');
    statusEl.classList.remove('warning');
  } else if (state === 'warning' || (includeStorageWarning && getStorageWarningMessage())) {
    statusEl.classList.remove('error');
    statusEl.classList.add('warning');
  } else {
    statusEl.classList.remove('error');
    statusEl.classList.remove('warning');
  }
}

function refreshStatusWithStorageWarning() {
  if (!statusEl) return;
  const currentState = statusEl.dataset.state || 'info';
  if (currentState === 'error') {
    return;
  }
  const baseMessage = statusEl.dataset.baseMessage || '';
  const includeStorageWarning = statusEl.dataset.includeStorageWarning !== 'false';
  const finalMessage = composeStatusMessage(baseMessage, includeStorageWarning);
  statusEl.textContent = finalMessage || '';
  if (includeStorageWarning && getStorageWarningMessage()) {
    statusEl.classList.add('warning');
    statusEl.classList.remove('error');
  } else if (currentState !== 'warning') {
    statusEl.classList.remove('warning');
  }
}

function announceStatus(message) {
  if (typeof message !== 'string') return;
  setStatusMessage(message, 'info', { includeStorageWarning: false, storeBase: false });
}

function getCategoryDisplayName(category) {
  if (!category || typeof category !== 'object') return '';
  const nameCandidates = [category.name, category.label, category.filter, category.id];
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
}

function normalizeCategoryMeta(category) {
  if (!category || typeof category !== 'object') return null;
  const id = typeof category.id === 'string' ? category.id : '';
  if (!id) return null;
  const type = typeof category.type === 'string' ? category.type : 'custom';
  const name = getCategoryDisplayName(category) || id;
  const description = typeof category.description === 'string' && category.description.trim()
    ? category.description.trim()
    : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : category.sampleSlug
      ? `/images/amounts/${category.sampleSlug}.svg`
      : DEFAULT_CATEGORY_THUMBNAIL;
  const sampleAlt = category.sampleAlt || `Eksempel på ${name}`;
  return {
    ...category,
    id,
    type,
    name,
    description,
    sampleImage,
    sampleAlt,
  };
}

function recomputeCategories(baseCategories) {
  const baseList = Array.isArray(baseCategories) ? baseCategories : amountCategories;
  const normalizedBase = baseList
    .map(normalizeCategoryMeta)
    .filter(Boolean);

  const uniqueBase = [];
  const seenIds = new Set();
  for (const category of normalizedBase) {
    if (!category || typeof category.id !== 'string') {
      continue;
    }
    if (seenIds.has(category.id)) {
      continue;
    }
    seenIds.add(category.id);
    uniqueBase.push(category);
  }

  const customList = buildCustomCategories(uniqueBase, customEntries)
    .map(normalizeCategoryMeta)
    .filter(Boolean)
    .filter((category) => {
      if (!category || typeof category.id !== 'string') {
        return false;
      }
      if (seenIds.has(category.id)) {
        return false;
      }
      seenIds.add(category.id);
      return true;
    });

  categories = uniqueBase.concat(customList);
  renderCategories();
  updateCategorySuggestions();
  if (activeCategoryId && !categoryMetaById.has(activeCategoryId)) {
    activeCategoryId = null;
  }
}

function buildCustomCategories(baseCategories, entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  const baseIds = new Set();
  baseCategories.forEach((category) => {
    if (category && typeof category.id === 'string') {
      baseIds.add(category.id);
    }
  });

  const customById = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const categoryId = typeof entry.categoryId === 'string' && entry.categoryId
      ? entry.categoryId
      : 'custom';
    if (baseIds.has(categoryId)) continue;
    const categoryName = entry.categoryName || categoryId;
    const sampleImage = entry.dataUrl || null;
    const sampleAlt = entry.name
      ? `Egendefinert figur: ${entry.name}`
      : `Egendefinert figur i kategorien ${categoryName}`;

    if (!customById.has(categoryId)) {
      customById.set(categoryId, {
        id: categoryId,
        type: 'custom',
        name: categoryName,
        filter: categoryName,
        description: '',
        sampleImage,
        sampleAlt,
      });
    } else {
      const meta = customById.get(categoryId);
      if (!meta.sampleImage && sampleImage) {
        meta.sampleImage = sampleImage;
        meta.sampleAlt = sampleAlt;
      }
    }
  }

  return Array.from(customById.values()).sort((a, b) => {
    const nameA = getCategoryDisplayName(a).toLowerCase();
    const nameB = getCategoryDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB, 'nb', { sensitivity: 'base' });
  });
}

function updateCategorySuggestions() {
  if (!categorySuggestionsList) return;
  const names = new Set();
  categories.forEach((category) => {
    const displayName = getCategoryDisplayName(category);
    if (displayName) {
      names.add(displayName);
    }
  });
  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, 'nb', { sensitivity: 'base' }));
  categorySuggestionsList.innerHTML = '';
  for (const name of sorted) {
    const option = document.createElement('option');
    option.value = name;
    categorySuggestionsList.appendChild(option);
  }
}

function alignCustomEntriesWithBaseCategories(baseCategories) {
  if (!Array.isArray(baseCategories) || !baseCategories.length || !customEntries.length) {
    return;
  }
  const byId = new Map();
  const byName = new Map();
  baseCategories.forEach((category) => {
    if (!category || typeof category !== 'object') return;
    const id = typeof category.id === 'string' ? category.id : '';
    if (id) {
      byId.set(id, category);
    }
    const name = getCategoryDisplayName(category).toLowerCase();
    if (name) {
      byName.set(name, category);
    }
  });

  let updated = false;
  for (const entry of customEntries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.categoryId && byId.has(entry.categoryId)) {
      const match = byId.get(entry.categoryId);
      const displayName = getCategoryDisplayName(match);
      if (displayName && displayName !== entry.categoryName) {
        entry.categoryName = displayName;
        updated = true;
      }
      continue;
    }
    const normalizedName = typeof entry.categoryName === 'string' ? entry.categoryName.trim().toLowerCase() : '';
    if (normalizedName && byName.has(normalizedName)) {
      const match = byName.get(normalizedName);
      const displayName = getCategoryDisplayName(match);
      if (displayName) {
        entry.categoryId = match.id;
        entry.categoryName = displayName;
        updated = true;
      }
    }
  }

  if (updated) {
    persistLocalEntriesIfNeeded();
  }
}

function handleCategoryClick(category, trigger) {
  if (!category || typeof category.id !== 'string') {
    return;
  }
  activeCategoryId = category.id;
  updateCategorySelection();
  openCategoryDialog(category.id, trigger);
}

function isCategoryDialogOpen() {
  if (!categoryDialog) return false;
  if (typeof categoryDialog.open === 'boolean') {
    return categoryDialog.open;
  }
  return categoryDialog.hasAttribute('open');
}

function openCategoryDialog(categoryId, trigger) {
  if (!categoryDialog) return;
  const alreadyOpen = isCategoryDialogOpen();
  const opened = renderCategoryDialog(categoryId);
  if (!opened) {
    return;
  }

  categoryDialogReturnFocus = trigger instanceof HTMLElement ? trigger : null;

  if (!alreadyOpen) {
    try {
      if (typeof categoryDialog.showModal === 'function') {
        categoryDialog.showModal();
      } else {
        categoryDialog.setAttribute('open', 'true');
      }
    } catch (error) {
      categoryDialog.setAttribute('open', 'true');
    }

    requestAnimationFrame(() => {
      if (categoryDialogCloseButton) {
        categoryDialogCloseButton.focus();
      }
    });
  }
}

function closeCategoryDialog(options = {}) {
  if (!categoryDialog) return;
  const { restoreFocus = true } = options;

  try {
    if (typeof categoryDialog.close === 'function') {
      categoryDialog.close();
    } else {
      categoryDialog.removeAttribute('open');
    }
  } catch (error) {
    categoryDialog.removeAttribute('open');
  }

  if (categoryDialogFigures) {
    categoryDialogFigures.innerHTML = '';
  }

  if (restoreFocus && categoryDialogReturnFocus && typeof categoryDialogReturnFocus.focus === 'function') {
    categoryDialogReturnFocus.focus();
  }
  categoryDialogReturnFocus = null;
}

function renderCategoryDialog(categoryId) {
  if (!categoryDialog) return false;
  const category = categoryMetaById.get(categoryId) || null;
  if (!category) {
    return false;
  }

  const displayName = getCategoryDisplayName(category) || category.id || '';

  const queryValue = filterInput?.value ? filterInput.value.trim() : '';
  const normalizedQuery = queryValue.toLowerCase();
  const hasQueryFilter = normalizedQuery.length > 0;

  const allFigures = getFiguresForCategory(category.id);
  const visibleFigures = hasQueryFilter
    ? allFigures.filter((item) => item.searchText.includes(normalizedQuery))
    : allFigures;

  if (categoryDialogTitle) {
    categoryDialogTitle.textContent = displayName;
  }

  if (categoryDialogDescription) {
    const descriptionText = typeof category.description === 'string' && category.description.trim()
      ? category.description.trim()
      : '';
    if (descriptionText) {
      categoryDialogDescription.textContent = descriptionText;
      categoryDialogDescription.hidden = false;
    } else {
      categoryDialogDescription.textContent = '';
      categoryDialogDescription.hidden = true;
    }
  }

  if (categoryDialogCount) {
    categoryDialogCount.textContent = buildCategoryDialogCountMessage(
      visibleFigures.length,
      allFigures.length,
      displayName,
      queryValue,
      hasQueryFilter
    );
  }

  if (categoryDialogUploadButton) {
    categoryDialogUploadButton.dataset.categoryId = category.id;
    categoryDialogUploadButton.dataset.categoryName = displayName;
  }

  if (categoryDialogFigures) {
    categoryDialogFigures.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const item of visibleFigures) {
      fragment.appendChild(item.element);
    }
    categoryDialogFigures.appendChild(fragment);
  }

  if (categoryDialogEmpty) {
    if (visibleFigures.length > 0) {
      categoryDialogEmpty.hidden = true;
      categoryDialogEmpty.textContent = '';
    } else {
      categoryDialogEmpty.hidden = false;
      if (allFigures.length === 0) {
        categoryDialogEmpty.textContent = `Ingen figurer er tilgjengelige i kategorien «${displayName}» ennå.`;
      } else if (hasQueryFilter) {
        categoryDialogEmpty.textContent = `Ingen figurer matcher «${queryValue}» i kategorien «${displayName}».`;
      } else {
        categoryDialogEmpty.textContent = `Ingen figurer er tilgjengelige i kategorien «${displayName}» ennå.`;
      }
    }
  }

  return true;
}

function updateCategorySelection() {
  for (const { button, category } of categoryButtons.values()) {
    const isSelected = category.id === activeCategoryId;
    button.dataset.selected = isSelected ? 'true' : 'false';
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }
}

function updateCategoryCounts(options = {}) {
  const normalizedQuery = typeof options.query === 'string' ? options.query.trim().toLowerCase() : '';
  const hasQueryFilter = Boolean(normalizedQuery);

  for (const { countEl, category } of categoryButtons.values()) {
    const figures = getFiguresForCategory(category.id);
    const matchCount = hasQueryFilter
      ? figures.filter((item) => item.searchText.includes(normalizedQuery)).length
      : figures.length;
    if (countEl) {
      countEl.textContent = formatFigureCount(matchCount);
    }
  }
}

function updateCategoryVisibility(normalizedQuery, hasQueryFilter) {
  const query = typeof normalizedQuery === 'string' ? normalizedQuery : '';
  for (const { category, listItem } of categoryButtons.values()) {
    if (!listItem) continue;
    let shouldShow = true;
    if (hasQueryFilter) {
      const name = getCategoryDisplayName(category).toLowerCase();
      const description = typeof category.description === 'string' ? category.description.toLowerCase() : '';
      const figures = getFiguresForCategory(category.id);
      const matchesFigures = figures.some((item) => item.searchText.includes(query));
      shouldShow = Boolean(name.includes(query) || description.includes(query) || matchesFigures);
    }
    listItem.hidden = !shouldShow;
  }
}

function prepareFigureItems(amountSlugs, measureEntries, customFigures = []) {
  if (observer && Array.isArray(figureItems) && figureItems.length) {
    for (const item of figureItems) {
      if (item?.image) {
        try {
          observer.unobserve(item.image);
        } catch (error) {}
      }
    }
  }

  figuresByCategory.clear();

  const amountEntries = Array.isArray(amountSlugs)
    ? amountSlugs.map((slug) => createAmountFigureData(slug)).filter(Boolean)
    : [];
  const measurementEntries = Array.isArray(measureEntries) ? measureEntries : [];
  const customEntriesData = Array.isArray(customFigures)
    ? customFigures.map((entry) => createCustomFigureData(entry)).filter(Boolean)
    : [];
  const combinedEntries = amountEntries.concat(measurementEntries, customEntriesData);
  figureItems = combinedEntries.map((entry) => createFigureItem(entry));

  for (const item of figureItems) {
    const key = getCategoryKey(item.data.categoryId);
    if (!figuresByCategory.has(key)) {
      figuresByCategory.set(key, []);
    }
    figuresByCategory.get(key).push(item);
  }
}

function createFigureItem(data) {
  const { path, slug, id, name, summary, categoryId, categoryName, type, custom, entryId } = data;
  const searchTokens = [
    slug,
    id,
    name,
    summary,
    path,
    categoryName,
    categoryId ? `category:${categoryId}` : null,
    type ? `type:${type}` : null,
  ];
  const searchText = searchTokens
    .filter((token) => typeof token === 'string' && token.trim().length > 0)
    .join(' ')
    .toLowerCase();

  const li = document.createElement('li');
  li.className = 'bibliotekItem';
  li.dataset.slug = slug || id;
  li.dataset.categoryId = categoryId || '';
  li.dataset.type = type || '';
  li.dataset.search = searchText;
  li.dataset.custom = custom ? 'true' : 'false';
  if (custom && entryId) {
    li.dataset.customId = entryId;
  }

  const figure = document.createElement('figure');
  figure.className = 'bibliotekFigure';
  figure.dataset.loading = 'true';

  const img = document.createElement('img');
  const altLabel = name || slug || id || 'Figur';
  img.alt = altLabel;
  const isCustom = Boolean(custom);
  if (isCustom) {
    img.src = path;
  } else {
    img.dataset.src = path;
  }
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 400;
  img.height = 400;
  img.addEventListener('load', () => {
    figure.dataset.loading = 'false';
  });
  img.addEventListener('error', () => {
    figure.dataset.loading = 'false';
    figure.dataset.error = 'true';
  });
  figure.appendChild(img);
  if (!isCustom && observer) {
    observer.observe(img);
  } else if (!isCustom) {
    img.src = path;
    img.removeAttribute('data-src');
  }

  const meta = document.createElement('div');
  meta.className = 'bibliotekMeta';

  const header = document.createElement('div');
  header.className = 'bibliotekHeader';

  const title = document.createElement('h2');
  title.textContent = name || slug || path;
  header.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'bibliotekActions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.dataset.path = path;
  copyButton.textContent = 'Kopier sti';
  copyButton.setAttribute('aria-label', `Kopier ${path}`);
  copyButton.title = `Kopier ${path}`;
  copyButton.addEventListener('click', handleCopyClick);
  actions.appendChild(copyButton);

  const openLink = document.createElement('a');
  openLink.href = path;
  openLink.target = '_blank';
  openLink.rel = 'noreferrer noopener';
  openLink.textContent = 'Vis SVG';
  openLink.setAttribute('aria-label', `Vis ${path} i en ny fane`);
  openLink.title = `Åpne ${path}`;
  if (isCustom) {
    openLink.download = `${slug || id || 'figur'}.svg`;
  }
  actions.appendChild(openLink);

  if (isCustom) {
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Rediger';
    editButton.dataset.customEdit = entryId || id || slug || '';
    editButton.addEventListener('click', () => openCustomEditor(entryId || id || slug || '', editButton));
    actions.appendChild(editButton);
  }

  header.appendChild(actions);
  meta.appendChild(header);

  if (summary) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'bibliotekSummary';
    summaryEl.textContent = summary;
    meta.appendChild(summaryEl);
  }

  const pathEl = document.createElement('div');
  pathEl.className = 'bibliotekPath';
  pathEl.textContent = path;
  pathEl.setAttribute('aria-label', `Filsti ${path}`);
  meta.appendChild(pathEl);

  const feedback = document.createElement('p');
  feedback.className = 'copyFeedback';
  feedback.dataset.feedback = '';
  feedback.hidden = true;
  feedback.setAttribute('aria-live', 'polite');
  meta.appendChild(feedback);

  li.appendChild(figure);
  li.appendChild(meta);

  return {
    data: {
      ...data,
      searchText,
    },
    path,
    searchText,
    element: li,
    image: img,
  };
}

function getCategoryKey(categoryId) {
  const value = typeof categoryId === 'string' ? categoryId.trim() : '';
  return value || UNCATEGORIZED_KEY;
}

function getFiguresForCategory(categoryId) {
  const key = getCategoryKey(categoryId);
  return figuresByCategory.get(key) || [];
}

function formatFigureCount(count) {
  return count === 1 ? '1 figur' : `${count} figurer`;
}

function buildCategoryDialogCountMessage(visible, total, categoryName, query, hasQueryFilter) {
  const name = categoryName || '';
  if (total === 0) {
    return `Ingen figurer i kategorien «${name}» ennå.`;
  }
  if (hasQueryFilter) {
    const visibleLabel = formatFigureCount(visible);
    return `Viser ${visibleLabel} av ${total} i kategorien «${name}» for søket «${query}».`;
  }
  const totalLabel = formatFigureCount(total);
  return `Viser ${totalLabel} i kategorien «${name}».`;
}

function handleIntersection(entries, obs) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
    obs.unobserve(img);
  }
}

function handleCategorySortChange(event) {
  const value = typeof event?.target?.value === 'string' ? event.target.value : 'default';
  categorySortOrder = value === 'alphabetical' ? 'alphabetical' : 'default';
  renderCategories();
  updateCategorySelection();
  applyFilter();
}

function handleFilterInput(event) {
  const query = event.target.value || '';
  if (!isCategoryDialogOpen()) {
    activeCategoryId = null;
    updateCategorySelection();
  }
  applyFilter(query);
}

function applyFilter(rawQuery) {
  const querySource = typeof rawQuery === 'string' ? rawQuery : filterInput?.value || '';
  const trimmedQuery = querySource.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const hasQueryFilter = normalizedQuery.length > 0;

  const visibleItems = hasQueryFilter
    ? figureItems.filter((item) => item.searchText.includes(normalizedQuery))
    : figureItems.slice();

  const total = figureItems.length;
  const visible = visibleItems.length;

  updateCount(visible, total, trimmedQuery, hasQueryFilter);
  updateStatus(visible, total, trimmedQuery, hasQueryFilter);
  updateCategoryCounts({ query: normalizedQuery });
  updateCategoryVisibility(normalizedQuery, hasQueryFilter);
  updateHelperState(total > 0);

  if (isCategoryDialogOpen() && activeCategoryId) {
    renderCategoryDialog(activeCategoryId);
  }
}

function updateCount(visible, total, query, hasQueryFilter) {
  if (!countEl) return;
  if (total === 0) {
    countEl.textContent = 'Ingen figurer tilgjengelig ennå.';
    return;
  }

  if (!hasQueryFilter) {
    countEl.textContent = total === 1 ? '1 figur tilgjengelig.' : `${total} figurer tilgjengelig.`;
    return;
  }

  const visibleLabel = formatFigureCount(visible);
  countEl.textContent = `Fant ${visibleLabel} av totalt ${total} for søket «${query}».`;
}

function updateStatus(visible, total, query, hasQueryFilter) {
  if (!statusEl) return;
  if (statusEl.dataset.state === 'error') {
    return;
  }
  if (total === 0) {
    setStatusMessage('Ingen figurer tilgjengelig ennå.', 'info');
    return;
  }

  if (hasQueryFilter) {
    setStatusMessage(`Fant ${visible} av ${total} figurer for søket «${query}». Velg en kategori for å se resultatene.`, 'info');
    return;
  }

  setStatusMessage(`Totalt ${total} figurer tilgjengelig. Velg en kategori for å se detaljene.`, 'info');
}

function updateHelperState(hasItems) {
  if (!helperEl) return;
  helperEl.hidden = false;
  if (hasItems) {
    helperEl.textContent = 'Velg en kategori for å åpne detaljvisningen med figurene i biblioteket.';
  } else {
    helperEl.textContent = 'Ingen figurer tilgjengelig ennå.';
  }
}

function setupAddCategoryForm() {
  if (!addCategoryToggleButton) return;

  if (addCategoryForm) {
    const formId = addCategoryForm.id || 'category-add-form';
    addCategoryForm.id = formId;
    addCategoryToggleButton.setAttribute('aria-controls', formId);
    addCategoryToggleButton.setAttribute('aria-expanded', addCategoryForm.hasAttribute('hidden') ? 'false' : 'true');
    addCategoryForm.addEventListener('submit', handleAddCategorySubmit);
    addCategoryForm.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideAddCategoryForm({ resetInput: true });
        addCategoryToggleButton.focus();
      }
    });
  } else {
    addCategoryToggleButton.setAttribute('aria-expanded', 'false');
  }

  addCategoryToggleButton.addEventListener('click', () => {
    if (!addCategoryForm) return;
    const isHidden = addCategoryForm.hasAttribute('hidden');
    if (isHidden) {
      showAddCategoryForm();
    } else {
      hideAddCategoryForm({ resetInput: true });
    }
  });

  if (addCategoryCancelButton) {
    addCategoryCancelButton.addEventListener('click', () => {
      hideAddCategoryForm({ resetInput: true });
      addCategoryToggleButton.focus();
    });
  }

  if (addCategoryInput) {
    addCategoryInput.addEventListener('input', () => {
      if (addCategoryFeedback?.dataset.state === 'error') {
        clearAddCategoryFeedback();
      }
    });
  }

  if (addCategoryForm && !addCategoryForm.hasAttribute('hidden')) {
    hideAddCategoryForm({ resetInput: false, clearFeedback: true });
  }
}

function showAddCategoryForm() {
  if (!addCategoryForm) return;
  addCategoryForm.removeAttribute('hidden');
  addCategoryToggleButton?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    if (addCategoryInput) {
      addCategoryInput.focus();
      addCategoryInput.select();
    }
  });
}

function hideAddCategoryForm(options = {}) {
  if (!addCategoryForm) return;
  const { resetInput = false, clearFeedback = true } = options;
  addCategoryForm.setAttribute('hidden', '');
  addCategoryToggleButton?.setAttribute('aria-expanded', 'false');
  if (resetInput && addCategoryInput) {
    addCategoryInput.value = '';
  }
  if (clearFeedback) {
    clearAddCategoryFeedback();
  }
}

function handleAddCategorySubmit(event) {
  event.preventDefault();
  if (!addCategoryInput) {
    return;
  }

  clearAddCategoryFeedback();

  const rawName = addCategoryInput.value || '';
  const trimmedName = rawName.trim();
  if (!trimmedName) {
    showAddCategoryFeedback('Skriv inn et kategorinavn.', { isError: true });
    addCategoryInput.focus();
    return;
  }

  if (trimmedName.length < 2) {
    showAddCategoryFeedback('Kategorinavnet må bestå av minst to tegn.', { isError: true });
    addCategoryInput.focus();
    return;
  }

  if (isCategoryNameTaken(trimmedName)) {
    showAddCategoryFeedback('Denne kategorien finnes allerede.', { isError: true });
    addCategoryInput.select();
    return;
  }

  const newCategory = createCustomCategoryFromName(trimmedName);
  if (!newCategory) {
    showAddCategoryFeedback('Kunne ikke legge til kategorien. Prøv igjen.', { isError: true });
    return;
  }

  customCategories.push(newCategory);
  customCategoryMap.set(newCategory.id, newCategory);
  saveCustomCategories();

  refreshLibrary();

  showAddCategoryFeedback(`La til kategorien «${newCategory.name}».`);
  hideAddCategoryForm({ resetInput: true, clearFeedback: false });

  requestAnimationFrame(() => {
    const entry = categoryButtons.get(newCategory.id);
    if (entry?.button) {
      entry.button.focus();
      entry.button.scrollIntoView({ block: 'nearest' });
    }
  });
}

function showAddCategoryFeedback(message, options = {}) {
  if (!addCategoryFeedback) return;
  const { isError = false } = options;
  if (addCategoryFeedbackTimer) {
    clearTimeout(addCategoryFeedbackTimer);
    addCategoryFeedbackTimer = null;
  }
  addCategoryFeedback.textContent = message;
  addCategoryFeedback.hidden = false;
  addCategoryFeedback.dataset.state = isError ? 'error' : 'success';
  if (!isError) {
    addCategoryFeedbackTimer = setTimeout(() => {
      clearAddCategoryFeedback();
    }, 4000);
  }
}

function clearAddCategoryFeedback() {
  if (addCategoryFeedbackTimer) {
    clearTimeout(addCategoryFeedbackTimer);
    addCategoryFeedbackTimer = null;
  }
  if (!addCategoryFeedback) return;
  addCategoryFeedback.hidden = true;
  addCategoryFeedback.textContent = '';
  delete addCategoryFeedback.dataset.state;
}

function createCustomCategoryFromName(name) {
  return normalizeCustomCategory({ name });
}

function isCategoryNameTaken(name) {
  const normalized = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!normalized) {
    return false;
  }

  const known = getKnownCategories();
  for (const category of known) {
    const displayName = getCategoryDisplayName(category);
    if (displayName && displayName.trim().toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

function setupUploadForm() {
  if (!uploadForm) return;
  if (uploadFileInput) {
    uploadFileInput.multiple = true;
  }
  uploadForm.addEventListener('submit', handleUploadSubmit);
  uploadFileInput?.addEventListener('change', handleUploadFileChange);
}

function setupEditorDialog() {
  if (!editorDialog) return;
  if (editorForm) {
    editorForm.addEventListener('submit', handleEditorSubmit);
  }
  if (editorCancelButton) {
    editorCancelButton.addEventListener('click', () => closeCustomEditor());
  }
  if (typeof editorDialog.addEventListener === 'function') {
    editorDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeCustomEditor();
    });
  }
}

function setupCategoryDialog() {
  if (!categoryDialog) return;

  if (categoryDialogCloseButton) {
    categoryDialogCloseButton.addEventListener('click', () => closeCategoryDialog());
  }

  if (typeof categoryDialog.addEventListener === 'function') {
    categoryDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeCategoryDialog();
    });

    categoryDialog.addEventListener('click', (event) => {
      if (event.target === categoryDialog) {
        closeCategoryDialog();
      }
    });
  }

  if (categoryDialogUploadButton) {
    categoryDialogUploadButton.addEventListener('click', handleCategoryUploadClick);
  }
}

function loadCustomCategories() {
  customCategories.length = 0;
  customCategoryMap.clear();

  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  let raw = null;
  try {
    raw = storage.getItem(CUSTOM_CATEGORY_STORAGE_KEY);
  } catch (error) {
    console.error('Kunne ikke lese egendefinerte kategorier', error);
    return;
  }

  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        const normalized = normalizeCustomCategory(entry);
        if (normalized && !customCategoryMap.has(normalized.id)) {
          customCategories.push(normalized);
          customCategoryMap.set(normalized.id, normalized);
        }
      });
    }
  } catch (error) {
    console.error('Kunne ikke tolke lagrede egendefinerte kategorier', error);
  }
}

function saveCustomCategories() {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  const payload = customCategories.map(serializeCustomCategory).filter(Boolean);
  try {
    storage.setItem(CUSTOM_CATEGORY_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre egendefinerte kategorier', error);
    return false;
  }
}

function serializeCustomCategory(category) {
  if (!category || typeof category !== 'object') return null;
  return {
    id: category.id,
    name: category.name,
    filter: category.filter,
    description: category.description,
    sampleImage: category.sampleImage,
    sampleAlt: category.sampleAlt,
  };
}

function isCategoryIdTaken(candidateId) {
  const id = typeof candidateId === 'string' ? candidateId.trim() : '';
  if (!id) {
    return false;
  }

  const known = getKnownCategories();
  for (const category of known) {
    if (category && typeof category.id === 'string' && category.id === id) {
      return true;
    }
  }

  if (customCategoryMap.has(id)) {
    return true;
  }

  return customCategories.some((category) => category && category.id === id);
}

function createCustomCategoryId(baseName) {
  const baseSlug = slugifyString(baseName) || 'kategori';
  let baseCandidate = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  if (!baseCandidate.startsWith('custom-')) {
    baseCandidate = `custom-${baseSlug}`;
  }
  const initialCandidate = baseCandidate && baseCandidate !== 'custom-' ? baseCandidate : 'custom-kategori';

  const existingIds = new Set();
  const known = getKnownCategories();
  known.forEach((category) => {
    if (category && typeof category.id === 'string') {
      existingIds.add(category.id);
    }
  });
  customCategories.forEach((category) => {
    if (category && typeof category.id === 'string') {
      existingIds.add(category.id);
    }
  });
  for (const key of customCategoryMap.keys()) {
    existingIds.add(key);
  }

  let candidate = initialCandidate;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${initialCandidate}-${suffix++}`;
  }
  return candidate;
}

function normalizeCustomCategory(category) {
  if (!category || typeof category !== 'object') return null;
  const rawName = typeof category.name === 'string' ? category.name.trim() : '';
  if (!rawName) {
    return null;
  }

  let id = typeof category.id === 'string' ? category.id.trim() : '';
  if (id && isCategoryIdTaken(id)) {
    id = '';
  }
  if (!id) {
    id = createCustomCategoryId(rawName);
  }

  const description = typeof category.description === 'string' && category.description.trim()
    ? category.description.trim()
    : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : DEFAULT_CATEGORY_THUMBNAIL;
  const sampleAlt = typeof category.sampleAlt === 'string' && category.sampleAlt.trim()
    ? category.sampleAlt.trim()
    : `Eksempel på ${rawName}`;
  const filter = typeof category.filter === 'string' && category.filter.trim()
    ? category.filter.trim()
    : rawName;

  return {
    id,
    type: 'custom',
    name: rawName,
    filter,
    description,
    sampleImage,
    sampleAlt,
  };
}

async function loadCustomEntries() {
  customEntries.length = 0;
  customEntryMap.clear();

  const localFallbackEntries = readLocalCustomEntries();
  let requestSucceeded = false;

  try {
    const result = await fetchFigureLibraryEntries();
    requestSucceeded = true;
    const entries = Array.isArray(result.entries) ? result.entries : [];
    entries.forEach((entry) => {
      upsertCustomEntryLocal(entry);
    });
    if (figureLibraryMetadata.storageMode === 'memory' && localFallbackEntries.length) {
      for (const entry of localFallbackEntries) {
        if (!entry || !entry.id || customEntryMap.has(entry.id)) {
          continue;
        }
        upsertCustomEntryLocal(entry);
      }
    }
  } catch (error) {
    console.error('Kunne ikke hente figurer fra API-et', error);
  }

  if (!requestSucceeded && localFallbackEntries.length) {
    localFallbackEntries.forEach((entry) => {
      upsertCustomEntryLocal(entry);
    });
  }

  persistLocalEntriesIfNeeded();
  refreshStatusWithStorageWarning();
}

function readLocalCustomEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    customStorageAvailable = false;
    return [];
  }
  customStorageAvailable = true;
  let raw = null;
  try {
    raw = storage.getItem(CUSTOM_STORAGE_KEY);
  } catch (error) {
    console.error('Kunne ikke lese egendefinerte figurer', error);
    customStorageAvailable = false;
    return [];
  }
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const restored = [];
    parsed.forEach((entry) => {
      const normalized = normalizeCustomEntry(entry);
      if (normalized) {
        restored.push(normalized);
      }
    });
    return restored;
  } catch (error) {
    console.error('Kunne ikke tolke lagrede egendefinerte figurer', error);
    return [];
  }
}

function persistLocalEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    customStorageAvailable = false;
    return false;
  }
  const payload = customEntries
    .map(serializeCustomEntry)
    .filter((entry) => entry !== null);
  try {
    storage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(payload));
    customStorageAvailable = true;
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre egendefinerte figurer', error);
    customStorageAvailable = false;
    return false;
  }
}

function persistLocalEntriesIfNeeded() {
  const mode = normalizeStorageMode(figureLibraryMetadata?.storageMode);
  if (!mode || mode === 'memory') {
    persistLocalEntries();
  } else {
    clearLocalEntries();
  }
}

function serializeCustomEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const result = {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    categoryId: entry.categoryId,
    categoryName: entry.categoryName,
    dataUrl: entry.dataUrl,
    summary: entry.summary,
    createdAt: entry.createdAt,
  };
  if (typeof entry.tool === 'string' && entry.tool.trim()) {
    result.tool = entry.tool.trim();
  }
  if (typeof entry.svg === 'string') {
    result.svg = entry.svg;
  }
  if (typeof entry.png === 'string') {
    result.png = entry.png;
  }
  if (Number.isFinite(entry.pngWidth)) {
    result.pngWidth = Number(entry.pngWidth);
  }
  if (Number.isFinite(entry.pngHeight)) {
    result.pngHeight = Number(entry.pngHeight);
  }
  return result;
}

function clearLocalEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(CUSTOM_STORAGE_KEY);
  } catch (error) {
    // ignore clearing errors
  }
}

function normalizeCustomEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '';
  const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : id;
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Egendefinert figur';
  let categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : 'Egendefinert';
  let categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  let svgMarkup = typeof entry.svg === 'string' ? entry.svg : null;
  let dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim() ? entry.dataUrl.trim() : '';
  if (!svgMarkup && dataUrl && dataUrl.startsWith('data:image/svg+xml')) {
    svgMarkup = decodeSvgDataUrl(dataUrl);
  }
  if (!dataUrl && svgMarkup) {
    dataUrl = encodeSvgToDataUrl(svgMarkup);
  }
  if (!dataUrl) {
    return null;
  }
  if (!categoryId) {
    const baseSlug = slugifyString(categoryName) || 'custom';
    categoryId = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  }
  if (!id) {
    id = slug || createCustomEntryId(name);
  }
  const normalized = {
    id,
    slug: slug || id,
    name,
    categoryId,
    categoryName,
    dataUrl,
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    svg: svgMarkup,
    png: typeof entry.png === 'string' ? entry.png : null,
  };
  if (typeof entry.tool === 'string' && entry.tool.trim()) {
    normalized.tool = entry.tool.trim();
  }
  if (Number.isFinite(entry.pngWidth)) {
    normalized.pngWidth = Number(entry.pngWidth);
  }
  if (Number.isFinite(entry.pngHeight)) {
    normalized.pngHeight = Number(entry.pngHeight);
  }
  return normalized;
}

function normalizeServerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : '';
  const id = slug || (typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '');
  if (!id) {
    return null;
  }
  const nameCandidates = [entry.title, entry.name, slug, id];
  let name = '';
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) {
    name = id;
  }
  const categoryObject = entry.category && typeof entry.category === 'object' ? entry.category : {};
  let categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  if (!categoryId && typeof categoryObject.id === 'string' && categoryObject.id.trim()) {
    categoryId = categoryObject.id.trim();
  }
  let categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : '';
  if (!categoryName && typeof categoryObject.label === 'string' && categoryObject.label.trim()) {
    categoryName = categoryObject.label.trim();
  }
  if (!categoryName) {
    categoryName = categoryId || 'Egendefinert';
  }
  let dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim() ? entry.dataUrl.trim() : '';
  const svgMarkup = typeof entry.svg === 'string' ? entry.svg : null;
  if (!dataUrl) {
    if (svgMarkup) {
      dataUrl = encodeSvgToDataUrl(svgMarkup);
    } else if (entry.urls && typeof entry.urls.svg === 'string') {
      dataUrl = entry.urls.svg;
    } else if (entry.files && entry.files.svg && typeof entry.files.svg.url === 'string') {
      dataUrl = entry.files.svg.url;
    }
  }
  if (!dataUrl) {
    return null;
  }
  const normalized = {
    id,
    slug: slug || id,
    name,
    categoryId: categoryId || 'custom',
    categoryName,
    dataUrl,
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
    createdAt: typeof entry.createdAt === 'string' && entry.createdAt ? entry.createdAt : new Date().toISOString(),
    svg: svgMarkup || (dataUrl.startsWith('data:image/svg+xml') ? decodeSvgDataUrl(dataUrl) : null),
    png: typeof entry.png === 'string' ? entry.png : null,
  };
  if (typeof entry.tool === 'string' && entry.tool.trim()) {
    normalized.tool = entry.tool.trim();
  }
  if (Number.isFinite(entry.pngWidth)) {
    normalized.pngWidth = Number(entry.pngWidth);
  }
  if (Number.isFinite(entry.pngHeight)) {
    normalized.pngHeight = Number(entry.pngHeight);
  }
  return normalized;
}

function upsertCustomEntryLocal(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : entry.slug;
  if (!id) return null;
  const normalized = {
    ...entry,
    id,
    slug: typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : id,
  };
  const existingIndex = customEntries.findIndex((item) => item && item.id === id);
  if (existingIndex >= 0) {
    customEntries[existingIndex] = normalized;
  } else {
    customEntries.push(normalized);
  }
  customEntryMap.set(id, normalized);
  ensureCategoryFromEntry(normalized);
  return normalized;
}

function ensureCategoryFromEntry(entry) {
  if (!entry || typeof entry !== 'object') return;
  const categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  const categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : '';
  if (!categoryId && !categoryName) {
    return;
  }
  if (categoryId && customCategoryMap.has(categoryId)) {
    return;
  }
  const normalized = categoryId
    ? normalizeServerCategory({ id: categoryId, label: categoryName || categoryId })
    : normalizeCustomCategory({ name: categoryName || 'Egendefinert' });
  if (!normalized) {
    return;
  }
  if (!customCategoryMap.has(normalized.id)) {
    customCategoryMap.set(normalized.id, normalized);
    if (!customCategories.some((category) => category && category.id === normalized.id)) {
      customCategories.push(normalized);
    }
  }
}

function normalizeServerCategory(category) {
  if (!category || typeof category !== 'object') return null;
  const id = typeof category.id === 'string' && category.id.trim() ? category.id.trim() : '';
  if (!id) {
    return null;
  }
  const nameCandidates = [category.label, category.name, category.filter, id];
  let name = '';
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) {
    name = id;
  }
  const description = typeof category.description === 'string' ? category.description.trim() : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : typeof category.sampleSlug === 'string' && category.sampleSlug.trim()
    ? `/images/amounts/${category.sampleSlug.trim()}.svg`
    : DEFAULT_CATEGORY_THUMBNAIL;
  const sampleAlt = typeof category.sampleAlt === 'string' && category.sampleAlt.trim()
    ? category.sampleAlt.trim()
    : `Eksempel på ${name}`;
  return {
    id,
    type: 'custom',
    name,
    filter: typeof category.filter === 'string' && category.filter.trim() ? category.filter.trim() : name,
    description,
    sampleImage,
    sampleAlt,
  };
}

function applyServerCategories(categoryList) {
  if (!Array.isArray(categoryList)) return;
  for (const category of categoryList) {
    const normalized = normalizeServerCategory(category);
    if (!normalized) continue;
    if (customCategoryMap.has(normalized.id)) {
      const existing = customCategoryMap.get(normalized.id);
      const merged = { ...existing, ...normalized };
      customCategoryMap.set(normalized.id, merged);
      const index = customCategories.findIndex((entry) => entry && entry.id === normalized.id);
      if (index >= 0) {
        customCategories[index] = merged;
      }
      continue;
    }
    customCategoryMap.set(normalized.id, normalized);
    customCategories.push(normalized);
  }
}

function normalizeStorageMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return normalized;
}

function applyFigureLibraryMetadata(metadata, response) {
  if (!metadata || typeof metadata !== 'object') {
    refreshStatusWithStorageWarning();
    return figureLibraryMetadata;
  }
  const headerMode = response && typeof response.headers?.get === 'function'
    ? response.headers.get('X-Figure-Library-Store-Mode')
    : null;
  const modeHint = metadata.storageMode || metadata.mode || headerMode;
  const normalizedMode = normalizeStorageMode(modeHint) || figureLibraryMetadata.storageMode || 'memory';
  figureLibraryMetadata.storageMode = normalizedMode;
  if (Object.prototype.hasOwnProperty.call(metadata, 'persistent')) {
    figureLibraryMetadata.persistent = Boolean(metadata.persistent);
  } else if (normalizedMode === 'kv') {
    figureLibraryMetadata.persistent = true;
  }
  const limitation = typeof metadata.limitation === 'string' ? metadata.limitation.trim() : '';
  if (limitation || normalizedMode !== 'memory') {
    figureLibraryMetadata.limitation = limitation;
  }
  refreshStatusWithStorageWarning();
  return figureLibraryMetadata;
}

async function fetchFigureLibraryEntries() {
  const { data, response } = await fetchFigureLibrary('GET');
  applyFigureLibraryMetadata(data, response);
  if (Array.isArray(data.categories)) {
    applyServerCategories(data.categories);
  }
  const entries = Array.isArray(data.entries)
    ? data.entries.map((entry) => normalizeServerEntry(entry)).filter(Boolean)
    : [];
  return { entries };
}

async function fetchFigureLibrary(method = 'GET', payload) {
  const options = {
    method,
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  };
  if (payload !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(FIGURE_LIBRARY_ENDPOINT, options);
  let data = {};
  let text = '';
  try {
    text = await response.text();
  } catch (error) {
    text = '';
  }
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      if (response.ok) {
        const parsingError = new Error('Ugyldig JSON-respons fra figurbiblioteket');
        parsingError.response = response;
        throw parsingError;
      }
      data = {};
    }
  }
  if (!response.ok) {
    const message = typeof data.error === 'string' && data.error.trim()
      ? data.error.trim()
      : `HTTP ${response.status}`;
    const error = new Error(message);
    error.response = response;
    error.payload = data;
    throw error;
  }
  return { data, response };
}

function buildFigureEntryPayload(entry, options = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : entry.id;
  if (!slug) return null;
  const toolValue = typeof entry.tool === 'string' && entry.tool.trim() ? entry.tool.trim() : FIGURE_LIBRARY_TOOL;
  const payload = {
    slug,
    title: entry.name || slug,
    tool: toolValue,
    summary: entry.summary || '',
  };
  if (entry.createdAt) {
    payload.createdAt = entry.createdAt;
  }
  if (entry.categoryId) {
    payload.categoryId = entry.categoryId;
  }
  if (entry.categoryName) {
    payload.categoryName = entry.categoryName;
  }
  const categoryPayload = {};
  if (entry.categoryId) {
    categoryPayload.id = entry.categoryId;
  }
  if (entry.categoryName) {
    categoryPayload.label = entry.categoryName;
  }
  if (Object.keys(categoryPayload).length) {
    payload.category = categoryPayload;
  }
  if (options.includeMedia) {
    if (typeof entry.svg === 'string') {
      payload.svg = entry.svg;
    }
    if (typeof entry.png === 'string') {
      payload.png = entry.png;
    }
    if (Number.isFinite(entry.pngWidth)) {
      payload.pngWidth = Number(entry.pngWidth);
    }
    if (Number.isFinite(entry.pngHeight)) {
      payload.pngHeight = Number(entry.pngHeight);
    }
  }
  if (entry.description) {
    payload.description = entry.description;
  }
  if (Array.isArray(entry.tags)) {
    payload.tags = entry.tags;
  }
  return payload;
}

async function submitFigureEntry(entry, options = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const includeMedia = options.includeMedia === true;
  const method = options.method || 'POST';
  const payload = buildFigureEntryPayload(entry, { includeMedia });
  if (!payload) {
    throw new Error('Ugyldig figurdata for opplasting.');
  }
  const { data, response } = await fetchFigureLibrary(method, payload);
  applyFigureLibraryMetadata(data, response);
  if (Array.isArray(data.categories)) {
    applyServerCategories(data.categories);
  }
  let normalized = null;
  if (data.entry) {
    normalized = normalizeServerEntry(data.entry);
  } else if (Array.isArray(data.entries)) {
    const normalizedEntries = data.entries.map((item) => normalizeServerEntry(item)).filter(Boolean);
    normalizedEntries.forEach((item) => upsertCustomEntryLocal(item));
    normalized = normalizedEntries[normalizedEntries.length - 1] || null;
  }
  if (normalized) {
    upsertCustomEntryLocal(normalized);
  } else {
    upsertCustomEntryLocal(entry);
  }
  persistLocalEntriesIfNeeded();
  return normalized || entry;
}

function createCustomFigureData(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const path = entry.dataUrl;
  if (typeof path !== 'string' || !path) return null;
  const id = entry.id || createCustomEntryId(entry.name || 'figur');
  return {
    id,
    slug: entry.slug || id,
    type: 'custom',
    name: entry.name || entry.slug || 'Egendefinert figur',
    summary: entry.summary || '',
    path,
    categoryId: entry.categoryId || 'custom',
    categoryName: entry.categoryName || 'Egendefinert',
    custom: true,
    entryId: entry.id || id,
  };
}

function createCategoryPreviewElement(category, titleText) {
  const container = document.createElement('div');
  container.className = 'categoryFigure';
  container.setAttribute('aria-hidden', 'true');

  const previewItems = getCategoryPreviewItems(category, CATEGORY_PREVIEW_COUNT, titleText);
  if (!previewItems.length) {
    container.dataset.empty = 'true';
  }
  for (const item of previewItems) {
    if (!item || typeof item.src !== 'string' || !item.src) continue;
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.loading = 'lazy';
    img.decoding = 'async';
    container.appendChild(img);
  }

  return container;
}

function getCategoryPreviewItems(category, count = CATEGORY_PREVIEW_COUNT, titleText = '') {
  const total = typeof count === 'number' && count > 0 ? Math.min(Math.floor(count), 12) : CATEGORY_PREVIEW_COUNT;
  const fallbackPath = resolveCategorySamplePath(category);
  const fallbackAlt = category.sampleAlt || `Eksempel på ${titleText || getCategoryDisplayName(category) || 'kategori'}`;

  const figures = getFiguresForCategory(category.id);
  const uniqueFigures = [];
  const seenPaths = new Set();
  for (const item of figures) {
    const src = item?.data?.path || item?.path || '';
    if (!src || seenPaths.has(src)) continue;
    seenPaths.add(src);
    uniqueFigures.push({
      src,
      alt: item?.data?.name || item?.data?.slug || fallbackAlt,
    });
  }

  if (!uniqueFigures.length) {
    if (category?.type === 'custom') {
      return [];
    }
    if (!fallbackPath) {
      return [];
    }
    return Array.from({ length: total }, () => ({ src: fallbackPath, alt: fallbackAlt }));
  }

  const shuffled = shuffleArray(uniqueFigures);
  const selection = [];
  for (let index = 0; index < total; index += 1) {
    const source = shuffled[index] || shuffled[index % shuffled.length];
    if (!source) break;
    selection.push({ src: source.src, alt: source.alt });
  }

  return selection;
}

function shuffleArray(list) {
  const array = Array.isArray(list) ? list.slice() : [];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function handleCategoryUploadClick() {
  const category = activeCategoryId ? categoryMetaById.get(activeCategoryId) || null : null;
  if (category && uploadCategoryInput) {
    const displayName = getCategoryDisplayName(category) || category.id || '';
    uploadCategoryInput.value = displayName;
    uploadCategoryInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  closeCategoryDialog({ restoreFocus: false });

  requestAnimationFrame(() => {
    if (uploadFileInput) {
      uploadFileInput.click();
    } else if (uploadCategoryInput) {
      uploadCategoryInput.focus();
    }
  });
}

function handleUploadFileChange() {
  if (!uploadFileInput || !uploadFileInput.files || uploadFileInput.files.length === 0) {
    return;
  }
  if (uploadFileInput.files.length === 1) {
    const file = uploadFileInput.files[0];
    if (!file) return;
    if (uploadNameInput && !uploadNameInput.value) {
      uploadNameInput.value = deriveNameFromFile(file.name) || '';
    }
    return;
  }
  if (uploadNameInput) {
    uploadNameInput.value = '';
  }
}

async function handleUploadSubmit(event) {
  event.preventDefault();
  if (!uploadFileInput || !uploadFileInput.files || uploadFileInput.files.length === 0) {
    showUploadStatus('Velg minst én SVG-fil først.', 'error', { duration: 6000 });
    return;
  }

  const files = Array.from(uploadFileInput.files).filter(Boolean);
  if (!files.length) {
    showUploadStatus('Fant ingen gyldige filer i utvalget.', 'error', { duration: 6000 });
    return;
  }

  const desiredName = uploadNameInput && uploadNameInput.value ? uploadNameInput.value.trim() : '';
  const categoryInputValue = uploadCategoryInput && uploadCategoryInput.value ? uploadCategoryInput.value : '';
  const results = [];
  let successfulUploads = 0;
  let encounteredError = false;
  const reservedUploadIds = new Set();

  if (uploadForm) {
    uploadForm.dataset.state = 'busy';
    uploadForm.setAttribute('aria-busy', 'true');
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file) continue;
    const label = file.name || `Fil ${index + 1}`;
    try {
      const svgText = await file.text();
      if (typeof svgText !== 'string' || !svgText.includes('<svg')) {
        throw new Error('Filen er ikke en gyldig SVG.');
      }
      const name = determineUploadName(desiredName, files.length, index, file.name);
      const categoryDetails = resolveCategoryDetails(categoryInputValue, null, name);
      const pngResult = await convertSvgMarkupToPng(svgText);
      const id = createCustomEntryId(name, reservedUploadIds);
      const entry = {
        id,
        slug: id,
        name,
        categoryId: categoryDetails.id,
        categoryName: categoryDetails.name,
        summary: '',
        createdAt: new Date().toISOString(),
        dataUrl: encodeSvgToDataUrl(svgText),
        svg: svgText,
        png: pngResult?.dataUrl || null,
        pngWidth: pngResult?.width,
        pngHeight: pngResult?.height,
        tool: FIGURE_LIBRARY_TOOL,
      };
      const savedEntry = await submitFigureEntry(entry, { method: 'POST', includeMedia: true });
      const finalEntry = savedEntry || entry;
      results.push({ state: 'success', message: `${label}: Lastet opp som «${finalEntry.name}».` });
      successfulUploads += 1;
    } catch (error) {
      encounteredError = true;
      console.error('Opplasting av SVG mislyktes', error);
      const message = extractApiErrorMessage(error, 'Opplasting mislyktes.');
      results.push({ state: 'error', message: `${label}: ${message}` });
    }
  }

  if (uploadForm) {
    delete uploadForm.dataset.state;
    uploadForm.removeAttribute('aria-busy');
  }

  if (successfulUploads) {
    refreshLibrary();
    const statusState = encounteredError ? 'warning' : 'info';
    const statusMessage = encounteredError
      ? `Fullførte ${successfulUploads} av ${files.length} opplastinger.`
      : successfulUploads === 1
        ? 'Egendefinert figur lagt til i biblioteket.'
        : 'Egendefinerte figurer lagt til i biblioteket.';
    setStatusMessage(statusMessage, statusState);
    uploadForm?.reset();
  } else if (encounteredError) {
    setStatusMessage('Ingen filer ble lastet opp.', 'error', { includeStorageWarning: false });
  }

  const summaryState = determineUploadState(results);
  const summaryMessage = formatUploadStatusSummary(results, files.length);
  showUploadStatus(summaryMessage, summaryState, { duration: summaryState === 'error' ? 8000 : 6000 });
}

function determineUploadName(desiredName, totalFiles, index, originalFileName) {
  const trimmedDesired = typeof desiredName === 'string' ? desiredName.trim() : '';
  const derived = deriveNameFromFile(originalFileName || '') || '';
  if (totalFiles <= 1) {
    return trimmedDesired || derived || 'Egendefinert figur';
  }
  if (trimmedDesired) {
    return `${trimmedDesired} ${index + 1}`;
  }
  return derived || `Egendefinert figur ${index + 1}`;
}

function showUploadStatus(message, state = 'info', options = {}) {
  if (!uploadStatusEl) return;
  uploadStatusEl.textContent = message;
  uploadStatusEl.dataset.state = state;
  uploadStatusEl.hidden = false;
  if (uploadStatusTimer) {
    clearTimeout(uploadStatusTimer);
    uploadStatusTimer = null;
  }
  const duration = Number.isFinite(options.duration) ? Number(options.duration) : state === 'error' ? 8000 : 5000;
  if (duration > 0) {
    uploadStatusTimer = setTimeout(() => {
      uploadStatusEl.hidden = true;
    }, duration);
  }
}

function determineUploadState(results) {
  if (!Array.isArray(results) || !results.length) {
    return 'info';
  }
  const hasError = results.some((result) => result.state === 'error');
  const hasWarning = results.some((result) => result.state === 'warning');
  const hasSuccess = results.some((result) => result.state === 'success');
  if (hasError && !hasSuccess && !hasWarning) {
    return 'error';
  }
  if (hasError || hasWarning) {
    return 'warning';
  }
  if (hasSuccess) {
    return 'success';
  }
  return 'info';
}

function formatUploadStatusSummary(results, totalFiles) {
  if (!Array.isArray(results) || !results.length) {
    return 'Ingen filer ble behandlet.';
  }
  const successCount = results.filter((result) => result.state === 'success').length;
  const errorCount = results.filter((result) => result.state === 'error').length;
  const warningCount = results.filter((result) => result.state === 'warning').length;
  let header = '';
  if (successCount && !errorCount && !warningCount) {
    header = successCount === 1
      ? 'Figuren ble lagt til i biblioteket.'
      : `${successCount} filer ble lagt til i biblioteket.`;
  } else if (successCount && errorCount) {
    header = `Fullførte ${successCount} av ${totalFiles} opplastinger.`;
  } else if (!successCount && errorCount) {
    header = errorCount === 1 ? 'Opplastingen mislyktes.' : 'Alle opplastingene mislyktes.';
  } else if (warningCount) {
    header = warningCount === 1 ? 'Opplastingen fullførte med en advarsel.' : 'Opplastingene fullførte med advarsler.';
  } else {
    header = 'Ingen filer ble behandlet.';
  }
  const details = results.map((result) => `• ${result.message}`);
  return [header, ...details].join('\n');
}

function extractApiErrorMessage(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (error.payload && typeof error.payload.error === 'string' && error.payload.error.trim()) {
    return error.payload.error.trim();
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return fallbackMessage;
}

function openCustomEditor(entryId, trigger) {
  if (!editorDialog || !entryId) return;
  const entry = customEntryMap.get(entryId);
  if (!entry) {
    return;
  }
  editingEntryId = entryId;
  editorReturnFocus = trigger || null;
  if (editorNameInput) {
    editorNameInput.value = entry.name || '';
  }
  if (editorCategoryInput) {
    editorCategoryInput.value = entry.categoryName || '';
  }
  if (editorErrorEl) {
    editorErrorEl.hidden = true;
    editorErrorEl.textContent = '';
  }
  try {
    if (typeof editorDialog.showModal === 'function') {
      editorDialog.showModal();
    } else {
      editorDialog.setAttribute('open', 'true');
    }
    editorNameInput?.focus();
  } catch (error) {
    editorDialog.setAttribute('open', 'true');
  }
}

function closeCustomEditor() {
  if (!editorDialog) return;
  try {
    if (typeof editorDialog.close === 'function') {
      editorDialog.close();
    } else {
      editorDialog.removeAttribute('open');
    }
  } catch (error) {
    editorDialog.removeAttribute('open');
  }
  if (editorErrorEl) {
    editorErrorEl.hidden = true;
    editorErrorEl.textContent = '';
  }
  if (editorNameInput) editorNameInput.value = '';
  if (editorCategoryInput) editorCategoryInput.value = '';
  const returnTarget = editorReturnFocus;
  editingEntryId = null;
  editorReturnFocus = null;
  if (returnTarget && typeof returnTarget.focus === 'function') {
    returnTarget.focus();
  }
}

async function handleEditorSubmit(event) {
  event.preventDefault();
  if (!editingEntryId) {
    closeCustomEditor();
    return;
  }
  const entry = customEntryMap.get(editingEntryId);
  if (!entry) {
    closeCustomEditor();
    return;
  }
  const nameValue = editorNameInput && editorNameInput.value ? editorNameInput.value.trim() : '';
  if (!nameValue) {
    if (editorErrorEl) {
      editorErrorEl.textContent = 'Navnet kan ikke være tomt.';
      editorErrorEl.hidden = false;
    }
    editorNameInput?.focus();
    return;
  }
  const categoryValue = editorCategoryInput && editorCategoryInput.value ? editorCategoryInput.value : '';
  const previousCategoryId = entry.categoryId;
  const categoryDetails = resolveCategoryDetails(categoryValue, previousCategoryId, nameValue);
  entry.name = nameValue;
  entry.categoryId = categoryDetails.id;
  entry.categoryName = categoryDetails.name;
  customEntryMap.set(entry.id, entry);
  try {
    const updatedEntry = await submitFigureEntry(entry, { method: 'PATCH' });
    const finalEntry = updatedEntry || entry;
    const shouldRestoreCategory = activeCategoryId === previousCategoryId && finalEntry.categoryId !== previousCategoryId;
    refreshLibrary();
    if (shouldRestoreCategory) {
      activeCategoryId = finalEntry.categoryId;
      updateCategorySelection();
      applyFilter();
    }
    setStatusMessage('Egendefinert figur oppdatert.', 'info');
    showUploadStatus('Figuren ble oppdatert.', 'success', { duration: 5000 });
    closeCustomEditor();
  } catch (error) {
    console.error('Kunne ikke oppdatere figur', error);
    const message = extractApiErrorMessage(error, 'Kunne ikke oppdatere figuren. Prøv igjen.');
    if (editorErrorEl) {
      editorErrorEl.textContent = message;
      editorErrorEl.hidden = false;
    }
  }
}

function resolveCategoryDetails(rawValue, fallbackId = null, fallbackName = '') {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  const normalizedValue = value.toLowerCase();
  const knownCategories = getKnownCategories();
  if (normalizedValue) {
    const idMatch = knownCategories.find((category) =>
      typeof category.id === 'string' && category.id.toLowerCase() === normalizedValue
    );
    if (idMatch) {
      return { id: idMatch.id, name: getCategoryDisplayName(idMatch), type: idMatch.type || 'custom' };
    }
    const nameMatch = knownCategories.find((category) =>
      getCategoryDisplayName(category).toLowerCase() === normalizedValue
    );
    if (nameMatch) {
      return { id: nameMatch.id, name: getCategoryDisplayName(nameMatch), type: nameMatch.type || 'custom' };
    }
  }

  if (!value && fallbackId && categoryMetaById.has(fallbackId)) {
    const fallbackCategory = categoryMetaById.get(fallbackId);
    return { id: fallbackCategory.id, name: getCategoryDisplayName(fallbackCategory), type: fallbackCategory.type || 'custom' };
  }

  const baseName = value || fallbackName || 'Egendefinert';
  const baseSlug = slugifyString(baseName) || 'figur';
  let candidateId = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  const existingIds = new Set(categories.map((category) => category.id));
  customEntries.forEach((entry) => existingIds.add(entry.categoryId));
  let suffix = 1;
  while (existingIds.has(candidateId)) {
    candidateId = `${baseSlug}-${suffix++}`;
  }
  return { id: candidateId, name: baseName, type: 'custom' };
}

function getKnownCategories() {
  const base = Array.isArray(categories) && categories.length
    ? categories.slice()
    : amountCategories.concat(Array.isArray(measurementCategoryList) ? measurementCategoryList : []);

  if (!customCategories.length) {
    return base;
  }

  const combined = Array.isArray(base) ? base.slice() : [];
  const seenIds = new Set();
  combined.forEach((category) => {
    if (category && typeof category.id === 'string') {
      seenIds.add(category.id);
    }
  });

  customCategories.forEach((category) => {
    if (!category || typeof category.id !== 'string') {
      return;
    }
    if (!seenIds.has(category.id)) {
      combined.push(category);
      seenIds.add(category.id);
    }
  });

  return combined;
}

async function convertSvgMarkupToPng(svgText) {
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  if (!helper || typeof helper.renderSvgToPng !== 'function') {
    throw new Error('PNG-konvertering er ikke tilgjengelig i denne nettleseren.');
  }
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !doc.body) {
    throw new Error('PNG-konvertering er ikke tilgjengelig i dette dokumentet.');
  }
  const parser = new DOMParser();
  let parsed;
  try {
    parsed = parser.parseFromString(svgText, 'image/svg+xml');
  } catch (error) {
    throw new Error('Kunne ikke tolke SVG-filen.');
  }
  if (!parsed || !parsed.documentElement) {
    throw new Error('Kunne ikke tolke SVG-filen.');
  }
  if (parsed.documentElement.nodeName === 'parsererror' || parsed.getElementsByTagName('parsererror').length) {
    throw new Error('Kunne ikke tolke SVG-filen.');
  }
  let workingSvg;
  try {
    workingSvg = typeof doc.importNode === 'function' ? doc.importNode(parsed.documentElement, true) : parsed.documentElement.cloneNode(true);
  } catch (error) {
    workingSvg = parsed.documentElement.cloneNode(true);
  }
  if (typeof helper.ensureSvgNamespaces === 'function') {
    helper.ensureSvgNamespaces(workingSvg);
  }
  const staging = doc.createElement('div');
  staging.style.position = 'absolute';
  staging.style.width = '0';
  staging.style.height = '0';
  staging.style.overflow = 'hidden';
  staging.style.opacity = '0';
  staging.style.pointerEvents = 'none';
  staging.appendChild(workingSvg);
  doc.body.appendChild(staging);
  let bounds = null;
  try {
    if (typeof helper.getSvgCanvasBounds === 'function') {
      bounds = helper.getSvgCanvasBounds(workingSvg) || null;
    }
  } finally {
    staging.remove();
  }
  const pngResult = await helper.renderSvgToPng(doc, null, svgText, bounds || undefined);
  if (!pngResult || typeof pngResult.dataUrl !== 'string') {
    throw new Error('Kunne ikke generere PNG for filen.');
  }
  return pngResult;
}

function encodeSvgToDataUrl(svgText) {
  if (typeof svgText !== 'string') return null;
  const encoded = encodeURIComponent(svgText)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function decodeSvgDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  const base64Match = trimmed.match(/^data:image\/svg\+xml;base64,/i);
  if (base64Match) {
    const base64Payload = trimmed.slice(base64Match[0].length);
    try {
      if (typeof atob === 'function') {
        return atob(base64Payload);
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.Buffer === 'function') {
        return globalThis.Buffer.from(base64Payload, 'base64').toString('utf-8');
      }
    } catch (error) {
      return null;
    }
    return null;
  }
  const prefixMatch = trimmed.match(/^data:image\/svg\+xml(?:;charset=utf-8)?,/i);
  if (!prefixMatch) {
    return null;
  }
  const encoded = trimmed.slice(prefixMatch[0].length);
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    return encoded;
  }
}

function deriveNameFromFile(fileName) {
  if (typeof fileName !== 'string') return '';
  const withoutExtension = fileName.replace(/\.svg$/i, '');
  const spaced = withoutExtension.replace(/[_-]+/g, ' ');
  return spaced.trim();
}

function createCustomEntryId(baseName, reservedIds = null) {
  const baseSlug = slugifyString(baseName) || 'figur';
  let candidate = `custom-${baseSlug}`;
  let suffix = 1;
  const reservationSet = reservedIds && typeof reservedIds.has === 'function' ? reservedIds : null;
  while (
    customEntryMap.has(candidate) ||
    customEntries.some((entry) => entry.id === candidate) ||
    (reservationSet && reservationSet.has(candidate))
  ) {
    candidate = `custom-${baseSlug}-${suffix++}`;
  }
  if (reservationSet) {
    reservationSet.add(candidate);
  }
  return candidate;
}

function slugifyString(value) {
  if (typeof value !== 'string') return '';
  let normalized = value.normalize ? value.normalize('NFKD') : value;
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch (error) {
    return null;
  }
}

async function handleCopyClick(event) {
  const button = event.currentTarget;
  const path = button.dataset.path;
  if (!path) return;
  const container = button.closest('.bibliotekItem');
  if (!container) return;
  const feedback = container.querySelector('[data-feedback]');
  if (!feedback) return;

  try {
    const success = await copyToClipboard(path);
    if (success) {
      showCopyFeedback(feedback, `Kopierte ${path}`);
    } else {
      showCopyFeedback(feedback, 'Kunne ikke kopiere automatisk. Kopier teksten manuelt.');
    }
  } catch (error) {
    console.error('Kopiering mislyktes', error);
    showCopyFeedback(feedback, 'Kunne ikke kopiere automatisk. Kopier teksten manuelt.');
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const selected = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch (error) {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  if (selected) {
    selection.removeAllRanges();
    selection.addRange(selected);
  }
  return succeeded;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response || !response.ok) {
    throw new Error(`HTTP ${response ? response.status : 'error'}`);
  }
  return response.json();
}

function buildMeasurementData(catalog) {
  const items = [];
  const categoryList = [];
  if (!Array.isArray(catalog)) {
    return { items, categoryList };
  }

  for (const category of catalog) {
    const itemList = Array.isArray(category?.items) ? category.items : [];
    const firstItem = itemList[0] || null;
    const normalizedCategory = {
      id: category.id,
      type: 'measure',
      name: category.name || category.id || 'Måling',
      filter: category.name || category.id || 'måling',
      description: category.description || '',
      sampleImage: firstItem ? firstItem.image : null,
      sampleAlt: firstItem ? `Eksempel på ${category.name || firstItem.name || 'måling'}` : '',
      matches: (slug) => Boolean(slug) && slug === category.id,
    };
    categoryList.push(normalizedCategory);

    for (const entry of itemList) {
      if (!entry || typeof entry !== 'object') continue;
      const path = entry.image || '';
      if (!path) continue;
      const slug = entry.id || entry.fileName || path;
      items.push({
        id: entry.id || path,
        slug,
        type: 'measure',
        name: entry.name || entry.id || path,
        summary: entry.summary || entry.dimensions || '',
        path,
        categoryId: category.id || '',
        categoryName: category.name || '',
      });
    }
  }

  return { categoryList, items };
}

function createAmountFigureData(slug) {
  const category = amountCategories.find((entry) => entry.matches(slug)) || null;
  const path = `/images/amounts/${slug}.svg`;
  return {
    id: slug,
    slug,
    type: 'amount',
    name: slug,
    summary: '',
    path,
    categoryId: category ? category.id : '',
    categoryName: category ? category.name : '',
  };
}

function resolveCategorySamplePath(category) {
  if (category.type === 'measure' && category.sampleImage) {
    return category.sampleImage;
  }
  if (category.type === 'amount' && category.sampleSlug) {
    return `/images/amounts/${category.sampleSlug}.svg`;
  }
  if (category.sampleImage) {
    return category.sampleImage;
  }
  return DEFAULT_CATEGORY_THUMBNAIL;
}

function showCopyFeedback(element, message) {
  element.textContent = message;
  element.hidden = false;
  const existingTimer = copyFeedbackTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    element.hidden = true;
  }, 2500);
  copyFeedbackTimers.set(element, timer);
}
