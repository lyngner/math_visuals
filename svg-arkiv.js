(() => {
  const grid = document.querySelector('[data-svg-grid]');
  const statusElement = document.querySelector('[data-status]');
  const filterWrapper = document.querySelector('[data-filter-wrapper]');
  const filterSelect = document.querySelector('[data-tool-filter]');
  const storageNote = document.querySelector('[data-storage-note]');

  if (!grid || !statusElement) {
    return;
  }

  let allEntries = [];

  function setStatus(message, state) {
    if (!statusElement) return;
    if (message) {
      statusElement.textContent = message;
      statusElement.hidden = false;
      if (state) {
        statusElement.dataset.state = state;
      } else {
        delete statusElement.dataset.state;
      }
    } else {
      statusElement.textContent = '';
      statusElement.hidden = true;
      delete statusElement.dataset.state;
    }
  }

  function setBusy(isBusy) {
    grid.setAttribute('aria-busy', String(Boolean(isBusy)));
  }

  function formatTimestamp(value) {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      return new Intl.DateTimeFormat('nb-NO', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (error) {
      return '';
    }
  }

  function createCard(entry) {
    const item = document.createElement('li');
    item.className = 'svg-archive__item';
    item.dataset.svgItem = entry.slug;

    const link = document.createElement('a');
    link.className = 'svg-archive__link';
    link.href = `/svg/${entry.slug}`;
    link.target = '_blank';
    link.rel = 'noopener';

    const preview = document.createElement('div');
    preview.className = 'svg-archive__preview';

    const img = document.createElement('img');
    img.src = `/svg/${entry.slug}`;
    img.alt = entry.title || entry.slug || 'SVG-fil';
    img.loading = 'lazy';

    preview.appendChild(img);

    const content = document.createElement('div');
    content.className = 'svg-archive__content';

    const title = document.createElement('p');
    title.className = 'svg-archive__title';
    title.textContent = entry.title || entry.slug || 'Uten tittel';

    const meta = document.createElement('div');
    meta.className = 'svg-archive__meta';

    if (entry.tool) {
      const toolTag = document.createElement('span');
      toolTag.textContent = entry.tool;
      meta.appendChild(toolTag);
    }

    const formattedTime = formatTimestamp(entry.createdAt);
    if (formattedTime) {
      const time = document.createElement('time');
      time.dateTime = entry.createdAt;
      time.textContent = formattedTime;
      meta.appendChild(time);
    }

    if (!meta.childElementCount) {
      const fallbackMeta = document.createElement('span');
      fallbackMeta.textContent = 'Detaljer ukjent';
      meta.appendChild(fallbackMeta);
    }

    content.appendChild(title);
    content.appendChild(meta);

    if (entry.summary) {
      const summary = document.createElement('p');
      summary.className = 'svg-archive__summary';
      summary.textContent = entry.summary;
      content.appendChild(summary);
    }

    link.appendChild(preview);
    link.appendChild(content);
    item.appendChild(link);

    return item;
  }

  function render() {
    const selectedTool = filterSelect && filterSelect.value !== 'all' ? filterSelect.value : null;
    const filteredEntries = selectedTool
      ? allEntries.filter(entry => entry.tool === selectedTool)
      : allEntries.slice();

    grid.innerHTML = '';

    if (!filteredEntries.length) {
      const message = allEntries.length
        ? 'Ingen SVG-er matcher valgt filter.'
        : 'Ingen SVG-er funnet ennå.';
      setStatus(message);
      return;
    }

    setStatus('');

    const fragment = document.createDocumentFragment();
    for (const entry of filteredEntries) {
      fragment.appendChild(createCard(entry));
    }
    grid.appendChild(fragment);
  }

  function updateFilterOptions() {
    if (!filterSelect || !filterWrapper) {
      return;
    }

    const tools = Array.from(new Set(allEntries.map(entry => entry.tool).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'nb')
    );

    const previousValue = filterSelect.value;
    filterSelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Alle verktøy';
    filterSelect.appendChild(allOption);

    for (const tool of tools) {
      const option = document.createElement('option');
      option.value = tool;
      option.textContent = tool;
      filterSelect.appendChild(option);
    }

    if (tools.includes(previousValue)) {
      filterSelect.value = previousValue;
    } else {
      filterSelect.value = 'all';
    }

    filterWrapper.hidden = tools.length <= 1;
  }

  function applyStorageNote(metadata) {
    if (!storageNote) return;
    if (!metadata || !metadata.limitation) {
      storageNote.hidden = true;
      storageNote.textContent = '';
      return;
    }
    storageNote.hidden = false;
    storageNote.textContent = metadata.limitation;
  }

  async function loadEntries() {
    setBusy(true);
    setStatus('Laster SVG-arkivet …');

    try {
      const response = await fetch('/api/svg', { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Uventet svar: ${response.status}`);
      }
      const payload = await response.json();
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      allEntries = entries
        .map(entry => ({
          slug: typeof entry.slug === 'string' ? entry.slug.trim() : '',
          title: typeof entry.title === 'string' ? entry.title.trim() : '',
          tool: typeof entry.tool === 'string' ? entry.tool.trim() : '',
          createdAt:
            typeof entry.createdAt === 'string' && entry.createdAt.trim()
              ? entry.createdAt.trim()
              : typeof entry.updatedAt === 'string'
                ? entry.updatedAt.trim()
                : '',
          summary: typeof entry.summary === 'string' ? entry.summary.trim() : ''
        }))
        .filter(entry => entry.slug);

      allEntries.sort((a, b) => {
        const aTime = Date.parse(a.createdAt || '') || 0;
        const bTime = Date.parse(b.createdAt || '') || 0;
        return bTime - aTime;
      });

      updateFilterOptions();
      applyStorageNote(payload);
      render();
    } catch (error) {
      console.error('Kunne ikke laste SVG-arkivet', error);
      setStatus('Klarte ikke å hente SVG-arkivet akkurat nå. Prøv igjen senere.', 'error');
      grid.innerHTML = '';
      if (storageNote) {
        storageNote.hidden = true;
        storageNote.textContent = '';
      }
    } finally {
      setBusy(false);
    }
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      render();
    });
  }

  loadEntries();
})();
