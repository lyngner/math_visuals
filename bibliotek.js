const amountManifestUrl = 'images/amounts/manifest.json';
const measureManifestUrl = 'images/measure/manifest.json';
const statusEl = document.querySelector('[data-status]');
const resultsContainer = document.querySelector('[data-results]');
const gridEl = document.querySelector('[data-grid]');
const emptyEl = document.querySelector('[data-empty]');
const filterInput = document.querySelector('[data-filter]');
const countEl = document.querySelector('[data-count]');
const categoryGrid = document.querySelector('[data-category-grid]');
const helperEl = document.querySelector('[data-helper]');
const categorySuggestionsList = document.querySelector('[data-category-suggestions]');
const uploadForm = document.querySelector('[data-upload-form]');
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
const copyFeedbackTimers = new WeakMap();

const CUSTOM_STORAGE_KEY = 'mathvis:figureLibrary:customEntries:v1';

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

let figureItems = [];
let allAmountSlugs = [];
let measurementItems = [];
let measurementCategoryList = [];

const customEntries = [];
const customEntryMap = new Map();
let customStorageAvailable = true;
let uploadStatusTimer = null;
let editorReturnFocus = null;
let editingEntryId = null;

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.1,
    })
  : null;

function init() {
  loadCustomEntries();
  refreshLibrary({ maintainFilter: false });
  loadLibraries();
  filterInput?.addEventListener('input', handleFilterInput);
  setupUploadForm();
  setupEditorDialog();
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

  alignCustomEntriesWithBaseCategories(baseCategories);

  buildGrid(allAmountSlugs, measurementItems, customEntries);
  recomputeCategories(baseCategories);

  if (!maintainFilter) {
    activeCategoryId = null;
    if (filterInput) {
      filterInput.value = '';
    }
  } else if (activeCategoryId && !categoryMetaById.has(activeCategoryId)) {
    activeCategoryId = null;
  }

  updateCategorySelection();
  updateCategoryCounts();
  applyFilter();
}

function renderCategories() {
  if (!categoryGrid) return;
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

    const item = document.createElement('li');
    item.className = 'categoryItem';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'categoryButton';
    button.dataset.categoryId = categoryId;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => handleCategoryClick(category));

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
    fragment.appendChild(item);

    const normalizedMeta = { ...category, id: categoryId, name: titleText, description: descriptionText };
    categoryButtons.set(categoryId, { button, countEl: count, category: normalizedMeta });
    categoryMetaById.set(categoryId, normalizedMeta);
  }

  categoryGrid.appendChild(fragment);
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
  const sampleImage = category.sampleImage || (category.sampleSlug ? `images/amounts/${category.sampleSlug}.svg` : null);
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
  const customList = buildCustomCategories(normalizedBase, customEntries)
    .map(normalizeCategoryMeta)
    .filter(Boolean);
  categories = normalizedBase.concat(customList);
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

function handleCategoryClick(category) {
  if (!category || typeof category.id !== 'string') {
    return;
  }
  const isActive = activeCategoryId === category.id;
  activeCategoryId = isActive ? null : category.id;
  applyFilter();
  updateCategorySelection();
}

function updateCategorySelection() {
  for (const { button, category } of categoryButtons.values()) {
    const isSelected = category.id === activeCategoryId;
    button.dataset.selected = isSelected ? 'true' : 'false';
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }
}

function updateCategoryCounts() {
  for (const { countEl, category } of categoryButtons.values()) {
    const matchCount = figureItems.filter((item) => item.data.categoryId === category.id).length;
    if (countEl) {
      countEl.textContent = matchCount === 1 ? '1 figur' : `${matchCount} figurer`;
    }
  }
}

function buildGrid(amountSlugs, measureEntries, customFigures = []) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const amountEntries = Array.isArray(amountSlugs)
    ? amountSlugs.map((slug) => createAmountFigureData(slug)).filter(Boolean)
    : [];
  const measurementEntries = Array.isArray(measureEntries) ? measureEntries : [];
  const customEntriesData = Array.isArray(customFigures)
    ? customFigures.map((entry) => createCustomFigureData(entry)).filter(Boolean)
    : [];
  const combinedEntries = amountEntries.concat(measurementEntries, customEntriesData);
  figureItems = combinedEntries.map((entry) => createFigureItem(entry));
  const fragment = document.createDocumentFragment();
  for (const item of figureItems) {
    fragment.appendChild(item.element);
  }
  gridEl.appendChild(fragment);
  if (resultsContainer) {
    resultsContainer.hidden = false;
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
  activeCategoryId = null;
  updateCategorySelection();
  applyFilter(query);
}

function applyFilter(rawQuery) {
  const querySource = typeof rawQuery === 'string' ? rawQuery : filterInput?.value || '';
  const query = querySource.trim().toLowerCase();
  const hasCategoryFilter = Boolean(activeCategoryId);
  const activeCategory = hasCategoryFilter ? categoryMetaById.get(activeCategoryId) || null : null;
  const hasQueryFilter = query.length > 0;
  let visibleCount = 0;

  const totalScope = hasCategoryFilter
    ? figureItems.filter((item) => item.data.categoryId === activeCategoryId).length
    : figureItems.length;

  for (const item of figureItems) {
    const matchesCategory = !hasCategoryFilter || item.data.categoryId === activeCategoryId;
    const matchesQuery = !hasQueryFilter || item.searchText.includes(query);
    const isVisible = matchesCategory && matchesQuery;
    item.element.hidden = !isVisible;
    if (isVisible) {
      visibleCount += 1;
    }
  }

  if (resultsContainer) {
    resultsContainer.hidden = false;
  }

  updateCount(
    visibleCount,
    totalScope,
    query,
    hasQueryFilter,
    hasCategoryFilter,
    activeCategory
  );
  updateEmptyState(
    visibleCount,
    totalScope,
    query,
    hasQueryFilter,
    hasCategoryFilter,
    activeCategory
  );
  updateStatus(
    visibleCount,
    totalScope,
    query,
    hasQueryFilter,
    hasCategoryFilter,
    activeCategory
  );
  updateHelperState(figureItems.length > 0);
}

function updateCount(
  visible,
  total,
  query,
  hasQueryFilter,
  hasCategoryFilter,
  activeCategory
) {
  if (!countEl) return;
  if (total === 0) {
    countEl.textContent = 'Ingen figurer tilgjengelig ennå.';
    return;
  }

  if (!hasQueryFilter && !hasCategoryFilter) {
    countEl.textContent = `Viser ${visible} figurer.`;
    return;
  }

  let context = '';
  if (hasQueryFilter && hasCategoryFilter && activeCategory) {
    context = ` for søket «${query}» i kategorien «${activeCategory.name}»`;
  } else if (hasQueryFilter) {
    context = ` for søket «${query}»`;
  } else if (hasCategoryFilter && activeCategory) {
    context = ` i kategorien «${activeCategory.name}»`;
  }

  countEl.textContent = `Viser ${visible} av ${total} figurer${context}.`;
}

function updateEmptyState(
  visible,
  total,
  query,
  hasQueryFilter,
  hasCategoryFilter,
  activeCategory
) {
  if (!emptyEl) return;
  if (visible > 0) {
    emptyEl.hidden = true;
    emptyEl.textContent = '';
    return;
  }

  emptyEl.hidden = false;
  if (total === 0) {
    emptyEl.textContent = 'Ingen figurer tilgjengelig ennå.';
    return;
  }

  if (hasQueryFilter) {
    const categoryContext = hasCategoryFilter && activeCategory
      ? ` i kategorien «${activeCategory.name}»`
      : '';
    emptyEl.textContent = `Ingen figurer matcher «${query}»${categoryContext}. Prøv et annet søkeord eller juster filtrene.`;
    return;
  }

  if (hasCategoryFilter && activeCategory) {
    emptyEl.textContent = `Ingen figurer tilgjengelig i kategorien «${activeCategory.name}» ennå.`;
    return;
  }

  emptyEl.textContent = 'Ingen figurer tilgjengelig ennå.';
}

function updateStatus(
  visible,
  total,
  query,
  hasQueryFilter,
  hasCategoryFilter,
  activeCategory
) {
  if (!statusEl) return;
  if (total === 0) {
    statusEl.textContent = 'Ingen figurer tilgjengelig ennå.';
    return;
  }

  if (hasQueryFilter && hasCategoryFilter && activeCategory) {
    statusEl.textContent = `Viser ${visible} av ${total} figurer for søket «${query}» i kategorien «${activeCategory.name}».`;
    return;
  }

  if (hasQueryFilter) {
    statusEl.textContent = `Viser ${visible} av ${total} figurer for søket «${query}».`;
    return;
  }

  if (hasCategoryFilter && activeCategory) {
    statusEl.textContent = `Viser ${visible} av ${total} figurer i kategorien «${activeCategory.name}».`;
    return;
  }

  statusEl.textContent = `Viser ${visible} av ${total} figurer.`;
}

function updateHelperState(hasItems) {
  if (!helperEl) return;
  helperEl.hidden = Boolean(hasItems);
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
  if (Array.isArray(categories) && categories.length) {
    return categories;
  }
  return amountCategories.concat(Array.isArray(measurementCategoryList) ? measurementCategoryList : []);
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
  return category.sampleImage || 'images/amounts/tb10.svg';
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
