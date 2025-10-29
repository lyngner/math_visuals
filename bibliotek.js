const manifestUrl = 'images/amounts/manifest.json';
const statusEl = document.querySelector('[data-status]');
const resultsContainer = document.querySelector('[data-results]');
const gridEl = document.querySelector('[data-grid]');
const emptyEl = document.querySelector('[data-empty]');
const filterInput = document.querySelector('[data-filter]');
const countEl = document.querySelector('[data-count]');
const categoryGrid = document.querySelector('[data-category-grid]');
const copyFeedbackTimers = new WeakMap();

const categories = [
  {
    id: 'tierbrett',
    label: 'Tierbrett',
    filter: 'tb',
    sampleSlug: 'tb10',
    sampleAlt: 'Eksempel på tierbrett',
    description: 'Tierbrett med markører som representerer antall.',
    matches: (slug) => slug.startsWith('tb'),
  },
  {
    id: 'tallbrikker',
    label: 'Tallbrikker',
    filter: 'n',
    sampleSlug: 'n53',
    sampleAlt: 'Eksempel på tallbrikker',
    description: 'Tallbrikker som viser grupperte mengder.',
    matches: (slug) => slug.startsWith('n'),
  },
  {
    id: 'penger',
    label: 'Penger',
    filter: 'v',
    sampleSlug: 'v50',
    sampleAlt: 'Eksempel på penger',
    description: 'Sedler og mynter til arbeid med kroner og øre.',
    matches: (slug) => slug.startsWith('v'),
  },
  {
    id: 'terninger',
    label: 'Terninger',
    filter: 'd',
    sampleSlug: 'd5',
    sampleAlt: 'Eksempel på terninger',
    description: 'Terninger for sannsynlighet og telling.',
    matches: (slug) => slug.startsWith('d'),
  },
  {
    id: 'hender',
    label: 'Hender',
    filter: 'h',
    sampleSlug: 'h05G',
    sampleAlt: 'Eksempel på tellehender',
    description: 'Hender som viser fingre for tallrepresentasjon.',
    matches: (slug) => slug.startsWith('h'),
  },
];

const categoryButtons = new Map();
let activeCategoryId = null;

let figureItems = [];
let allSlugs = [];

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.1,
    })
  : null;

function init() {
  renderCategories();
  loadManifest();
  filterInput?.addEventListener('input', handleFilterInput);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function loadManifest() {
  try {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.slugs)) {
      throw new Error('Ugyldig manifest');
    }
    allSlugs = payload.slugs;
    buildGrid(allSlugs);
    applyFilter('');
    activeCategoryId = null;
    updateCategorySelection();
    updateCategoryCounts();
    updateStatus(allSlugs.length, allSlugs.length, '');
    resultsContainer.hidden = false;
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
    img.src = `images/amounts/${category.sampleSlug}.svg`;
    img.alt = category.sampleAlt;
    img.loading = 'lazy';
    img.width = 320;
    img.height = 240;
    figure.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'categoryMeta';

    const title = document.createElement('h3');
    title.textContent = category.label;
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
  }

  categoryGrid.appendChild(fragment);
}

function handleCategoryClick(category) {
  if (!filterInput) return;
  const isActive = activeCategoryId === category.id;
  if (isActive) {
    activeCategoryId = null;
    filterInput.value = '';
    applyFilter('');
  } else {
    activeCategoryId = category.id;
    filterInput.value = category.filter;
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
    const matchCount = allSlugs.filter(category.matches).length;
    if (countEl) {
      countEl.textContent = matchCount === 1 ? '1 figur' : `${matchCount} figurer`;
    }
  }
}

function buildGrid(slugs) {
  gridEl.innerHTML = '';
  figureItems = slugs.map((slug) => createFigureItem(slug));
  const fragment = document.createDocumentFragment();
  for (const item of figureItems) {
    fragment.appendChild(item.element);
  }
  gridEl.appendChild(fragment);
}

function createFigureItem(slug) {
  const path = `images/amounts/${slug}.svg`;
  const searchText = `${slug} ${path}`.toLowerCase();

  const li = document.createElement('li');
  li.className = 'bibliotekItem';
  li.dataset.slug = slug;
  li.dataset.search = searchText;

  const figure = document.createElement('figure');
  figure.className = 'bibliotekFigure';
  figure.dataset.loading = 'true';

  const img = document.createElement('img');
  img.alt = `Mengdeillustrasjon ${slug}`;
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
  title.textContent = slug;
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
    slug,
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
  const query = rawQuery.trim().toLowerCase();
  const activeCategory = getActiveCategory();
  let visibleCount = 0;
  for (const item of figureItems) {
    const matches = activeCategory
      ? activeCategory.matches(item.slug)
      : !query || item.searchText.includes(query);
    item.element.hidden = !matches;
    if (matches) {
      visibleCount += 1;
    }
  }

  const total = figureItems.length;
  updateCount(visibleCount, total, query, activeCategory);
  updateEmptyState(visibleCount, query, activeCategory);
  updateStatus(visibleCount, total, query, activeCategory);
}

function updateCount(visible, total, query, category) {
  if (!countEl) return;
  const message = category
    ? `Viser ${visible} av ${total} figurer i kategorien «${category.label}».`
    : query
    ? `Viser ${visible} av ${total} figurer for søket «${query}».`
    : `Viser alle ${total} figurer.`;
  countEl.textContent = message;
}

function updateEmptyState(visible, query, category) {
  if (!emptyEl) return;
  if (visible === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = category
      ? `Ingen figurer finnes i kategorien «${category.label}».`
      : query
      ? `Ingen figurer matcher «${query}». Prøv et annet søkeord eller fjern filteret.`
      : 'Ingen figurer tilgjengelig ennå.';
  } else {
    emptyEl.hidden = true;
  }
}

function updateStatus(visible, total, query, category) {
  if (!statusEl) return;
  if (category) {
    statusEl.textContent = `Viser ${visible} av ${total} figurer i kategorien «${category.label}».`;
  } else if (query) {
    statusEl.textContent = `Viser ${visible} av ${total} figurer for søket «${query}».`;
  } else {
    statusEl.textContent = `Viser ${visible} figurer fra images/amounts.`;
  }
}

function getActiveCategory() {
  if (!activeCategoryId) return null;
  const entry = categoryButtons.get(activeCategoryId);
  return entry ? entry.category : null;
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
