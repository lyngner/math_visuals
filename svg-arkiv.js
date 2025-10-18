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

  function normalizeAssetUrl(url, formatHint) {
    if (typeof url !== 'string') {
      return '';
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return '';
    }

    if (/^(?:https?:)?\/\//.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('/api/svg/raw')) {
      return trimmed;
    }

    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    if (normalized.startsWith('/bildearkiv/')) {
      const searchParams = new URLSearchParams();
      searchParams.set('path', normalized.replace(/^\/+/, ''));
      if (formatHint) {
        searchParams.set('format', formatHint);
      }
      return `/api/svg/raw?${searchParams.toString()}`;
    }

    return normalized;
  }

  function createCard(entry) {
    const item = document.createElement('li');
    item.className = 'svg-archive__item';
    item.dataset.svgItem = entry.svgSlug || entry.slug || entry.baseName || '';

    const card = document.createElement('article');
    card.className = 'svg-archive__card';

    const preview = document.createElement('div');
    preview.className = 'svg-archive__preview';

    const img = document.createElement('img');
    img.src = normalizeAssetUrl(entry.thumbnailUrl, 'png') || entry.thumbnailUrl || '';
    img.alt = entry.altText || `Forhåndsvisning av ${entry.displayTitle}`;
    img.loading = 'lazy';
    img.decoding = 'async';

    preview.appendChild(img);

    const body = document.createElement('div');
    body.className = 'svg-archive__body';

    const title = document.createElement('h3');
    title.className = 'svg-archive__title';
    title.textContent = entry.displayTitle;
    body.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'svg-archive__meta';

    if (entry.tool) {
      const toolTag = document.createElement('span');
      toolTag.className = 'svg-archive__tag';
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

    if (entry.sequenceLabel) {
      const sequence = document.createElement('span');
      sequence.className = 'svg-archive__sequence';
      sequence.textContent = entry.sequenceLabel;
      meta.appendChild(sequence);
    }

    if (!meta.childElementCount) {
      const fallbackMeta = document.createElement('span');
      fallbackMeta.textContent = 'Detaljer ukjent';
      meta.appendChild(fallbackMeta);
    }

    body.appendChild(meta);

    const fileInfoItems = [];
    if (entry.baseName) {
      fileInfoItems.push(`Filnavn: ${entry.baseName}`);
    }
    if (entry.fileSizeLabel) {
      fileInfoItems.push(entry.fileSizeLabel);
    }

    if (fileInfoItems.length || entry.summary) {
      const details = document.createElement('p');
      details.className = 'svg-archive__details';
      const infoText = [fileInfoItems.join(' · '), entry.summary].filter(Boolean).join(' — ');
      details.textContent = infoText;
      body.appendChild(details);
    }

    const actions = document.createElement('div');
    actions.className = 'svg-archive__actions';

    const svgLink = document.createElement('a');
    svgLink.className = 'svg-archive__action';
    svgLink.href = normalizeAssetUrl(entry.svgUrl, 'svg') || entry.svgUrl || '#';
    svgLink.target = '_blank';
    svgLink.rel = 'noopener';
    svgLink.textContent = 'Åpne SVG';
    svgLink.setAttribute('aria-label', `Åpne SVG-fil for ${entry.displayTitle}`);

    const pngLink = document.createElement('a');
    pngLink.className = 'svg-archive__action';
    pngLink.href = normalizeAssetUrl(entry.pngUrl, 'png') || entry.pngUrl || '#';
    pngLink.target = '_blank';
    pngLink.rel = 'noopener';
    pngLink.textContent = 'Åpne PNG';
    pngLink.setAttribute('aria-label', `Åpne PNG-forhåndsvisning for ${entry.displayTitle}`);

    actions.appendChild(svgLink);
    actions.appendChild(pngLink);
    body.appendChild(actions);

    card.appendChild(preview);
    card.appendChild(body);
    item.appendChild(card);

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
        .map(entry => {
          const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
          const files = entry && typeof entry === 'object' && entry.files ? entry.files : {};
          const urls = entry && typeof entry === 'object' && entry.urls ? entry.urls : {};
          const metadata = entry && typeof entry === 'object' && entry.metadata ? entry.metadata : {};
          const svgFile = files && typeof files === 'object' ? files.svg : null;
          const pngFile = files && typeof files === 'object' ? files.png : null;
          const svgSlug = typeof entry.svgSlug === 'string' && entry.svgSlug.trim()
            ? entry.svgSlug.trim()
            : svgFile && typeof svgFile.slug === 'string' && svgFile.slug.trim()
              ? svgFile.slug.trim()
              : slug ? `${slug}.svg` : '';
          const pngSlug = typeof entry.pngSlug === 'string' && entry.pngSlug.trim()
            ? entry.pngSlug.trim()
            : pngFile && typeof pngFile.slug === 'string' && pngFile.slug.trim()
              ? pngFile.slug.trim()
              : slug ? `${slug}.png` : '';
          const svgUrl = typeof entry.svgUrl === 'string' && entry.svgUrl.trim()
            ? entry.svgUrl.trim()
            : typeof urls.svg === 'string' && urls.svg.trim()
              ? urls.svg.trim()
              : svgFile && typeof svgFile.url === 'string' && svgFile.url.trim()
                ? svgFile.url.trim()
                : svgSlug
                  ? (svgSlug.startsWith('/') ? svgSlug : `/${svgSlug}`)
                  : slug
                    ? `/svg/${slug}`
                    : '';
          const pngUrl = typeof entry.pngUrl === 'string' && entry.pngUrl.trim()
            ? entry.pngUrl.trim()
            : typeof urls.png === 'string' && urls.png.trim()
              ? urls.png.trim()
              : pngFile && typeof pngFile.url === 'string' && pngFile.url.trim()
                ? pngFile.url.trim()
                : pngSlug
                  ? (pngSlug.startsWith('/') ? pngSlug : `/${pngSlug}`)
                  : svgUrl;

          const baseName = typeof entry.baseName === 'string' && entry.baseName.trim()
            ? entry.baseName.trim()
            : typeof entry.fileName === 'string' && entry.fileName.trim()
              ? entry.fileName.trim()
              : slug;
          const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
          const altText = typeof entry.altText === 'string' && entry.altText.trim()
            ? entry.altText.trim()
            : summary
              ? summary
              : baseName
                ? `Grafikkfil for ${baseName}`
                : 'SVG-fil';

          const sequenceRaw = entry.sequence ?? entry.sequenceNumber ?? metadata.sequence ?? metadata.index;
          let sequenceNumber = null;
          if (typeof sequenceRaw === 'number' && Number.isFinite(sequenceRaw)) {
            sequenceNumber = sequenceRaw;
          } else if (typeof sequenceRaw === 'string' && sequenceRaw.trim()) {
            const parsedSequence = Number(sequenceRaw.trim());
            if (Number.isFinite(parsedSequence)) {
              sequenceNumber = parsedSequence;
            }
          }
          const sequenceLabel = sequenceNumber !== null ? `#${sequenceNumber}` : '';

          const fileSizeValue = metadata.size ?? metadata.fileSize ?? (svgFile && svgFile.size);
          let fileSizeLabel = '';
          if (typeof fileSizeValue === 'number' && Number.isFinite(fileSizeValue)) {
            const kiloBytes = fileSizeValue / 1024;
            fileSizeLabel = kiloBytes >= 1024
              ? `${(kiloBytes / 1024).toFixed(kiloBytes > 10 * 1024 ? 0 : 1)} MB`
              : `${kiloBytes.toFixed(kiloBytes > 100 ? 0 : 1)} kB`;
          } else if (typeof fileSizeValue === 'string' && fileSizeValue.trim()) {
            fileSizeLabel = fileSizeValue.trim();
          }

          const thumbnailUrl = typeof entry.thumbnailUrl === 'string' && entry.thumbnailUrl.trim()
            ? entry.thumbnailUrl.trim()
            : pngUrl || svgUrl;

          const normalizedSlug = (slug && slug.trim())
            ? slug.trim()
            : baseName
              ? baseName.replace(/\.[^/.]+$/, '')
              : svgSlug
                ? svgSlug.replace(/\.svg$/i, '')
                : '';

          const resolvedSvgUrl = normalizeAssetUrl(svgUrl, 'svg') || (normalizedSlug ? normalizeAssetUrl(`/svg/${normalizedSlug}`, 'svg') : '');
          const resolvedPngUrl = normalizeAssetUrl(pngUrl, 'png') || resolvedSvgUrl;
          const resolvedThumbnailUrl = normalizeAssetUrl(thumbnailUrl, 'png') || resolvedPngUrl || resolvedSvgUrl;

          return {
            slug: normalizedSlug || slug,
            svgSlug,
            pngSlug,
            svgUrl: resolvedSvgUrl,
            pngUrl: resolvedPngUrl,
            thumbnailUrl: resolvedThumbnailUrl,
            title: typeof entry.title === 'string' ? entry.title.trim() : '',
            displayTitle: (typeof entry.title === 'string' && entry.title.trim())
              ? entry.title.trim()
              : baseName || normalizedSlug || 'Uten tittel',
            altText,
            baseName,
            tool: typeof entry.tool === 'string' ? entry.tool.trim() : '',
            createdAt:
              typeof entry.createdAt === 'string' && entry.createdAt.trim()
                ? entry.createdAt.trim()
                : typeof entry.updatedAt === 'string'
                  ? entry.updatedAt.trim()
                  : '',
            summary,
            sequenceLabel,
            fileSizeLabel
          };
        })
        .filter(entry => entry.slug && entry.svgUrl);

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
