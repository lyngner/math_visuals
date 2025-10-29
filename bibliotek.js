const manifestUrl = 'images/amounts/manifest.json';
const statusEl = document.querySelector('[data-status]');
const resultsContainer = document.querySelector('[data-results]');
const gridEl = document.querySelector('[data-grid]');
const emptyEl = document.querySelector('[data-empty]');
const filterInput = document.querySelector('[data-filter]');
const countEl = document.querySelector('[data-count]');
const copyFeedbackTimers = new WeakMap();

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
    updateStatus(allSlugs.length, allSlugs.length, '');
    resultsContainer.hidden = false;
  } catch (error) {
    console.error('Kunne ikke laste manifestet', error);
    statusEl.textContent = 'Kunne ikke laste figurene. Prøv å laste siden på nytt.';
    statusEl.classList.add('error');
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

  const title = document.createElement('h2');
  title.textContent = slug;
  meta.appendChild(title);

  const pathEl = document.createElement('div');
  pathEl.className = 'bibliotekPath';
  pathEl.textContent = path;
  pathEl.setAttribute('aria-label', `Filsti ${path}`);
  meta.appendChild(pathEl);

  const actions = document.createElement('div');
  actions.className = 'bibliotekActions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.dataset.path = path;
  copyButton.textContent = `Kopier "${path}"`;
  copyButton.addEventListener('click', handleCopyClick);
  actions.appendChild(copyButton);

  const openLink = document.createElement('a');
  openLink.href = path;
  openLink.target = '_blank';
  openLink.rel = 'noreferrer noopener';
  openLink.textContent = `Vis ${path}`;
  actions.appendChild(openLink);

  meta.appendChild(actions);

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
  applyFilter(query);
}

function applyFilter(rawQuery) {
  const query = rawQuery.trim().toLowerCase();
  let visibleCount = 0;
  for (const item of figureItems) {
    const matches = !query || item.searchText.includes(query);
    item.element.hidden = !matches;
    if (matches) {
      visibleCount += 1;
    }
  }

  const total = figureItems.length;
  updateCount(visibleCount, total, query);
  updateEmptyState(visibleCount, query);
  updateStatus(visibleCount, total, query);
}

function updateCount(visible, total, query) {
  if (!countEl) return;
  const message = query
    ? `Viser ${visible} av ${total} figurer for søket «${query}».`
    : `Viser alle ${total} figurer.`;
  countEl.textContent = message;
}

function updateEmptyState(visible, query) {
  if (!emptyEl) return;
  if (visible === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = query
      ? `Ingen figurer matcher «${query}». Prøv et annet søkeord eller fjern filteret.`
      : 'Ingen figurer tilgjengelig ennå.';
  } else {
    emptyEl.hidden = true;
  }
}

function updateStatus(visible, total, query) {
  if (!statusEl) return;
  if (query) {
    statusEl.textContent = `Viser ${visible} av ${total} figurer for søket «${query}».`;
  } else {
    statusEl.textContent = `Viser ${visible} figurer fra images/amounts.`;
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
