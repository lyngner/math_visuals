const amountManifestUrl = 'images/amounts/manifest.json';
const measureManifestUrl = 'images/measure/manifest.json';
const statusEl = document.querySelector('[data-status]');
const filterInput = document.querySelector('[data-filter]');
const countEl = document.querySelector('[data-count]');
const categoryGrid = document.querySelector('[data-category-grid]');
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
const DEFAULT_CATEGORY_THUMBNAIL = 'images/amounts/tb10.svg';

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

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.1,
    })
  : null;

function init() {
  loadCustomCategories();
  loadCustomEntries();
  refreshLibrary({ maintainFilter: false });
  loadLibraries();
  filterInput?.addEventListener('input', handleFilterInput);
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
    statusEl.textContent = 'Kunne ikke laste figurene. Prøv å laste siden på nytt.';
    statusEl.classList.add('error');
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
  for (const category of categories) {
    if (!category || typeof category !== 'object') {
      continue;
    }
    const categoryId = typeof category.id === 'string' ? category.id : '';
    if (!categoryId) continue;
    const titleText = getCategoryDisplayName(category) || categoryId;
    const descriptionText = typeof category.description === 'string' && category.description.trim()
      ? category.description.trim()
      : category.type === 'custom'
        ? 'Egendefinerte figurer du har lagt til.'
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
    button.addEventListener('click', (event) => handleCategoryClick(category, event.currentTarget));

    const figure = document.createElement('figure');
    figure.className = 'categoryFigure';

    const img = document.createElement('img');
    const samplePath = resolveCategorySamplePath(category);
    img.src = samplePath;
    img.alt = category.sampleAlt || `Eksempel på ${titleText}`;
    img.loading = 'lazy';
    img.width = 320;
    img.height = 240;
    figure.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'categoryMeta';

    const title = document.createElement('h3');
    title.textContent = titleText;
    meta.appendChild(title);

    const description = document.createElement('p');
    description.textContent = descriptionText;
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
    if (categoryMenuSurface?.contains(target)) {
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

function announceStatus(message) {
  if (!statusEl || typeof message !== 'string') return;
  statusEl.textContent = message;
  statusEl.classList.remove('error');
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
    : type === 'custom'
      ? 'Egendefinerte figurer du har lagt til.'
      : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : category.sampleSlug
      ? `images/amounts/${category.sampleSlug}.svg`
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
        description: 'Egendefinerte figurer du har lagt til.',
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
    saveCustomEntries();
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
  if (total === 0) {
    statusEl.textContent = 'Ingen figurer tilgjengelig ennå.';
    return;
  }

  if (hasQueryFilter) {
    statusEl.textContent = `Fant ${visible} av ${total} figurer for søket «${query}». Velg en kategori for å se resultatene.`;
    return;
  }

  statusEl.textContent = `Totalt ${total} figurer tilgjengelig. Velg en kategori for å se detaljene.`;
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
    : 'Egendefinerte figurer du har lagt til.';
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

function loadCustomEntries() {
  customEntries.length = 0;
  customEntryMap.clear();
  const storage = getLocalStorage();
  if (!storage) {
    customStorageAvailable = false;
    return;
  }
  customStorageAvailable = true;
  let raw = null;
  try {
    raw = storage.getItem(CUSTOM_STORAGE_KEY);
  } catch (error) {
    console.error('Kunne ikke lese egendefinerte figurer', error);
    customStorageAvailable = false;
    return;
  }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        const normalized = normalizeCustomEntry(entry);
        if (normalized) {
          customEntries.push(normalized);
          customEntryMap.set(normalized.id, normalized);
        }
      });
    }
  } catch (error) {
    console.error('Kunne ikke tolke lagrede egendefinerte figurer', error);
  }
}

function saveCustomEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    customStorageAvailable = false;
    return false;
  }
  const payload = customEntries.map(serializeCustomEntry);
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

function serializeCustomEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    categoryId: entry.categoryId,
    categoryName: entry.categoryName,
    dataUrl: entry.dataUrl,
    summary: entry.summary,
    createdAt: entry.createdAt,
  };
}

function normalizeCustomEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '';
  let dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim() ? entry.dataUrl.trim() : '';
  const rawSvg = typeof entry.svg === 'string' ? entry.svg : null;
  if (!dataUrl && rawSvg) {
    dataUrl = encodeSvgToDataUrl(rawSvg);
  }
  if (!dataUrl) {
    return null;
  }
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Egendefinert figur';
  const categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : 'Egendefinert';
  let categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  if (!categoryId) {
    const baseSlug = slugifyString(categoryName) || 'custom';
    categoryId = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  }
  const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
  if (!id) {
    id = createCustomEntryId(name);
  }
  const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : id;
  return {
    id,
    slug,
    name,
    categoryId,
    categoryName,
    dataUrl,
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
    createdAt,
  };
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
  const file = uploadFileInput.files[0];
  if (!file) return;
  if (uploadNameInput && !uploadNameInput.value) {
    uploadNameInput.value = deriveNameFromFile(file.name) || '';
  }
}

async function handleUploadSubmit(event) {
  event.preventDefault();
  if (!uploadFileInput || !uploadFileInput.files || uploadFileInput.files.length === 0) {
    showUploadStatus('Velg en SVG-fil først.', 'error');
    return;
  }
  const file = uploadFileInput.files[0];
  if (!file) {
    showUploadStatus('Fant ikke filen som skulle lastes opp.', 'error');
    return;
  }
  let svgText = '';
  try {
    svgText = await file.text();
  } catch (error) {
    console.error('Kunne ikke lese SVG-filen', error);
    showUploadStatus('Kunne ikke lese SVG-filen. Prøv igjen.', 'error');
    return;
  }
  if (typeof svgText !== 'string' || !svgText.includes('<svg')) {
    showUploadStatus('Filen ser ikke ut til å være en gyldig SVG.', 'error');
    return;
  }

  const desiredName = uploadNameInput && uploadNameInput.value.trim() ? uploadNameInput.value.trim() : '';
  const name = desiredName || deriveNameFromFile(file.name) || 'Egendefinert figur';
  const categoryInputValue = uploadCategoryInput && uploadCategoryInput.value ? uploadCategoryInput.value : '';
  const categoryDetails = resolveCategoryDetails(categoryInputValue, null, name);
  const dataUrl = encodeSvgToDataUrl(svgText);
  const id = createCustomEntryId(name);
  const entry = {
    id,
    slug: id,
    name,
    categoryId: categoryDetails.id,
    categoryName: categoryDetails.name,
    dataUrl,
    summary: '',
    createdAt: new Date().toISOString(),
  };

  customEntries.push(entry);
  customEntryMap.set(entry.id, entry);
  const saved = saveCustomEntries();
  refreshLibrary();
  if (statusEl) {
    statusEl.classList.remove('error');
    statusEl.textContent = 'Egendefinert figur lagt til i biblioteket.';
  }
  if (!saved) {
    showUploadStatus('Figuren ble lagt til, men kunne ikke lagres permanent. Den beholdes til siden lastes på nytt.', 'warning');
  } else {
    showUploadStatus('Figuren ble lagt til i biblioteket.', 'success');
  }
  uploadForm.reset();
}

function showUploadStatus(message, state = 'info') {
  if (!uploadStatusEl) return;
  uploadStatusEl.textContent = message;
  uploadStatusEl.dataset.state = state;
  uploadStatusEl.hidden = false;
  if (uploadStatusTimer) {
    clearTimeout(uploadStatusTimer);
  }
  uploadStatusTimer = setTimeout(() => {
    uploadStatusEl.hidden = true;
  }, 4000);
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

function handleEditorSubmit(event) {
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
  const saved = saveCustomEntries();
  const shouldRestoreCategory = activeCategoryId === previousCategoryId;
  refreshLibrary();
  if (shouldRestoreCategory) {
    activeCategoryId = entry.categoryId;
    updateCategorySelection();
    applyFilter();
  }
  if (statusEl) {
    statusEl.classList.remove('error');
    statusEl.textContent = 'Egendefinert figur oppdatert.';
  }
  if (!saved && uploadStatusEl) {
    showUploadStatus('Oppdatert, men kunne ikke lagres permanent. Endringen gjelder til siden lastes på nytt.', 'warning');
  }
  closeCustomEditor();
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

function encodeSvgToDataUrl(svgText) {
  if (typeof svgText !== 'string') return null;
  const encoded = encodeURIComponent(svgText)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function deriveNameFromFile(fileName) {
  if (typeof fileName !== 'string') return '';
  const withoutExtension = fileName.replace(/\.svg$/i, '');
  const spaced = withoutExtension.replace(/[_-]+/g, ' ');
  return spaced.trim();
}

function createCustomEntryId(baseName) {
  const baseSlug = slugifyString(baseName) || 'figur';
  let candidate = `custom-${baseSlug}`;
  let suffix = 1;
  while (customEntryMap.has(candidate) || customEntries.some((entry) => entry.id === candidate)) {
    candidate = `custom-${baseSlug}-${suffix++}`;
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
  const path = `images/amounts/${slug}.svg`;
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
    return `images/amounts/${category.sampleSlug}.svg`;
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
