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
const copyFeedbackTimers = new WeakMap();

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

let categories = amountCategories.slice();
const categoryMetaById = new Map();

const categoryButtons = new Map();
let activeCategoryId = null;

let figureItems = [];
let allAmountSlugs = [];
let measurementItems = [];

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.1,
    })
  : null;

function init() {
  renderCategories();
  loadLibraries();
  filterInput?.addEventListener('input', handleFilterInput);
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
    const combinedCategories = amountCategories.concat(measurementCategories);
    categories = combinedCategories;
    renderCategories();

    buildGrid(allAmountSlugs, measurementItems);
    applyFilter('');
    activeCategoryId = null;
    updateCategorySelection();
    updateCategoryCounts();
  } catch (error) {
    console.error('Kunne ikke laste manifestet', error);
    statusEl.textContent = 'Kunne ikke laste figurene. Prøv å laste siden på nytt.';
    statusEl.classList.add('error');
  }
}

function renderCategories() {
  if (!categoryGrid) return;
  categoryGrid.innerHTML = '';
  categoryButtons.clear();
  categoryMetaById.clear();

  const fragment = document.createDocumentFragment();
  for (const category of categories) {
    const item = document.createElement('li');
    item.className = 'categoryItem';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'categoryButton';
    button.dataset.categoryId = category.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => handleCategoryClick(category));

    const figure = document.createElement('figure');
    figure.className = 'categoryFigure';

    const img = document.createElement('img');
    const samplePath = resolveCategorySamplePath(category);
    img.src = samplePath;
    img.alt = category.sampleAlt || `Eksempel på ${category.name}`;
    img.loading = 'lazy';
    img.width = 320;
    img.height = 240;
    figure.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'categoryMeta';

    const title = document.createElement('h3');
    title.textContent = category.name;
    meta.appendChild(title);

    const description = document.createElement('p');
    description.textContent = category.description;
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

    categoryButtons.set(category.id, { button, countEl: count, category });
    categoryMetaById.set(category.id, category);
  }

  categoryGrid.appendChild(fragment);
}

function handleCategoryClick(category) {
  const isActive = activeCategoryId === category.id;
  if (isActive) {
    activeCategoryId = null;
    if (filterInput) {
      filterInput.value = '';
    }
    applyFilter('');
  } else {
    activeCategoryId = category.id;
    if (filterInput) {
      filterInput.value = category.filter;
    }
    applyFilter(category.filter);
  }
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

function buildGrid(amountSlugs, measureEntries) {
  gridEl.innerHTML = '';
  const amountEntries = amountSlugs.map((slug) => createAmountFigureData(slug));
  const measurementEntries = Array.isArray(measureEntries) ? measureEntries : [];
  const combinedEntries = amountEntries.concat(measurementEntries);
  figureItems = combinedEntries.map((entry) => createFigureItem(entry));
  const fragment = document.createDocumentFragment();
  for (const item of figureItems) {
    fragment.appendChild(item.element);
  }
  gridEl.appendChild(fragment);
}

function createFigureItem(data) {
  const { path, slug, id, name, summary, categoryId, categoryName, type } = data;
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

  const figure = document.createElement('figure');
  figure.className = 'bibliotekFigure';
  figure.dataset.loading = 'true';

  const img = document.createElement('img');
  const altLabel = name || slug || id || 'Figur';
  img.alt = altLabel;
  img.dataset.src = path;
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
  if (observer) {
    observer.observe(img);
  } else {
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
  actions.appendChild(openLink);

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
  const query = typeof rawQuery === 'string' ? rawQuery.trim().toLowerCase() : '';
  const hasCategoryFilter = Boolean(activeCategoryId);
  const activeCategory = hasCategoryFilter
    ? categoryMetaById.get(activeCategoryId) || null
    : null;
  const hasQueryFilter = query.length > 0;
  const hasActiveFilter = hasCategoryFilter || hasQueryFilter;
  let visibleCount = 0;

  const totalScope = hasCategoryFilter
    ? figureItems.filter((item) => item.data.categoryId === activeCategoryId).length
    : figureItems.length;

  for (const item of figureItems) {
    const matchesCategory = hasCategoryFilter
      ? item.data.categoryId === activeCategoryId
      : true;
    const matchesQuery = hasQueryFilter ? item.searchText.includes(query) : true;
    const isVisible = hasActiveFilter ? matchesCategory && matchesQuery : false;
    item.element.hidden = !isVisible;
    if (isVisible) {
      visibleCount += 1;
    }
  }

  if (resultsContainer) {
    resultsContainer.hidden = !hasActiveFilter;
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
  updateHelperState(hasActiveFilter);
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
  if (!hasQueryFilter && !hasCategoryFilter) {
    countEl.textContent = '';
    return;
  }

  let context = '';
  if (hasQueryFilter && hasCategoryFilter && activeCategory) {
    context = `for søket «${query}» i kategorien «${activeCategory.name}»`;
  } else if (hasQueryFilter) {
    context = `for søket «${query}»`;
  } else if (hasCategoryFilter && activeCategory) {
    context = `i kategorien «${activeCategory.name}»`;
  }

  const suffix = context ? ` ${context}.` : '.';
  countEl.textContent = `Viser ${visible} av ${total} figurer${suffix}`;
}

function updateEmptyState(
  visible,
  query,
  hasQueryFilter,
  hasCategoryFilter,
  activeCategory
) {
  if (!emptyEl) return;
  if (!hasQueryFilter && !hasCategoryFilter) {
    emptyEl.hidden = true;
    emptyEl.textContent = '';
    return;
  }

  if (visible === 0) {
    emptyEl.hidden = false;
    if (hasQueryFilter) {
      const categoryContext = hasCategoryFilter && activeCategory
        ? ` i kategorien «${activeCategory.name}»`
        : '';
      emptyEl.textContent = `Ingen figurer matcher «${query}»${categoryContext}. Prøv et annet søkeord eller fjern filteret.`;
    } else if (hasCategoryFilter && activeCategory) {
      emptyEl.textContent = `Ingen figurer tilgjengelig i kategorien «${activeCategory.name}» ennå.`;
    } else {
      emptyEl.textContent = 'Ingen figurer tilgjengelig ennå.';
    }
  } else {
    emptyEl.hidden = true;
  }
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
  if (!hasQueryFilter && !hasCategoryFilter) {
    statusEl.textContent = 'Velg en kategori for å vise tilhørende figurer.';
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
}

function updateHelperState(hasActiveFilter) {
  if (!helperEl) return;
  if (!hasActiveFilter) {
    helperEl.hidden = false;
    return;
  }

  helperEl.hidden = true;
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
