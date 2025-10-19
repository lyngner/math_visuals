(() => {
  const grid = document.querySelector('[data-svg-grid]');
  const statusElement = document.querySelector('[data-status]');
  const filterWrapper = document.querySelector('[data-filter-wrapper]');
  const filterSelect = document.querySelector('[data-tool-filter]');
  const storageNote = document.querySelector('[data-storage-note]');
  const trashToggle = document.querySelector('[data-trash-toggle]');
  const trashArchive = document.querySelector('[data-trash-archive]');
  const trashClose = document.querySelector('[data-trash-close]');
  const trashStatus = document.querySelector('[data-trash-status]');

  if (!grid || !statusElement) {
    return;
  }

  let allEntries = [];
  let archiveDialog = null;
  let trashRestoreFocusTo = null;
  const defaultTrashToggleLabel = (trashToggle?.dataset.labelDefault || trashToggle?.textContent || '').trim() || 'Vis slettede figurer';
  const activeTrashToggleLabel = (trashToggle?.dataset.labelActive || '').trim() || 'Skjul slettede figurer';
  const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    '[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function normalizeToolIdentifier(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .trim()
      .toLowerCase()
      .replace(/[\u00e6]/g, 'ae')
      .replace(/[\u00f8\u0153]/g, 'o')
      .replace(/[\u00e5]/g, 'a')
      .replace(/[^a-z0-9]+/g, '');
  }

  const TOOL_OPEN_TARGETS = (() => {
    const definitions = [
      { names: ['Graftegner'], url: '/graftegner.html', storagePath: '/graftegner' },
      { names: ['nKant', 'N-kant'], url: '/nkant.html', storagePath: '/nkant' },
      { names: ['Diagram'], url: '/diagram/index.html', storagePath: '/diagram' },
      { names: ['Brøkpizza'], url: '/brøkpizza.html', storagePath: '/brøkpizza' },
      { names: ['Brøkfigurer'], url: '/brøkfigurer.html', storagePath: '/brøkfigurer' },
      { names: ['Figurtall'], url: '/figurtall.html', storagePath: '/figurtall' },
      { names: ['Tenkeblokker'], url: '/tenkeblokker.html', storagePath: '/tenkeblokker' },
      {
        names: ['Arealmodell', 'Arealmodellen', 'Arealmodellen 1', 'Arealmodellen 2', 'Arealmodell 0'],
        url: '/arealmodell.html',
        storagePath: '/arealmodell'
      },
      { names: ['Tallinje'], url: '/tallinje.html', storagePath: '/tallinje' },
      { names: ['Perlesnor'], url: '/perlesnor.html', storagePath: '/perlesnor' },
      { names: ['Kuler'], url: '/kuler.html', storagePath: '/kuler' },
      { names: ['Kvikkbilder'], url: '/kvikkbilder.html', storagePath: '/kvikkbilder' },
      { names: ['3D-figurer', 'Trefigurer'], url: '/trefigurer.html', storagePath: '/trefigurer' },
      { names: ['Brøkvegg'], url: '/brøkvegg.html', storagePath: '/brøkvegg' },
      {
        names: ['Prikk til prikk', 'Prikk til prikk (beta)'],
        url: '/prikktilprikk.html',
        storagePath: '/prikktilprikk'
      },
      {
        names: ['Fortegnsskjema', 'Fortegnsskjema – under utvikling'],
        url: '/fortegnsskjema.html',
        storagePath: '/fortegnsskjema'
      }
    ];

    const map = new Map();
    for (const definition of definitions) {
      const entry = {
        url: definition.url,
        storagePath: definition.storagePath,
        displayName: definition.displayName || (definition.names && definition.names[0]) || ''
      };
      if (!Array.isArray(definition.names)) {
        continue;
      }
      for (const name of definition.names) {
        const key = normalizeToolIdentifier(name);
        if (!key || map.has(key)) {
          continue;
        }
        map.set(key, entry);
      }
    }
    return map;
  })();

  function resolveToolOpenTarget(toolName) {
    if (typeof toolName !== 'string') {
      return null;
    }

    const key = normalizeToolIdentifier(toolName);
    if (!key) {
      return null;
    }

    return TOOL_OPEN_TARGETS.get(key) || null;
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(focusableSelectors)).filter(element => {
      if (element.disabled) {
        return false;
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const rects = element.getClientRects();
      const isSvgElement = typeof window !== 'undefined' && window.SVGElement
        ? element instanceof window.SVGElement
        : false;
      return rects.length > 0 && (element.offsetParent !== null || isSvgElement);
    });
  }

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

  function announceTrash(message) {
    if (!trashStatus) {
      return;
    }
    trashStatus.textContent = message || '';
  }

  function syncTrashToggleState(isOpen) {
    if (!trashToggle) {
      return;
    }
    trashToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    const label = isOpen ? activeTrashToggleLabel : defaultTrashToggleLabel;
    trashToggle.textContent = label;
  }

  function isTrashPanelOpen() {
    return Boolean(trashArchive && !trashArchive.hasAttribute('hidden'));
  }

  function setTrashPanelVisibility(isOpen, { focusPanel = true, triggeredBy = null, announce = true } = {}) {
    if (!trashArchive || !trashToggle) {
      return;
    }

    const currentlyOpen = isTrashPanelOpen();
    if (currentlyOpen === Boolean(isOpen)) {
      if (isOpen && focusPanel) {
        requestAnimationFrame(() => {
          trashArchive.focus();
        });
      }
      return;
    }

    if (isOpen) {
      trashRestoreFocusTo = triggeredBy || document.activeElement || trashToggle;
      trashArchive.removeAttribute('hidden');
      trashArchive.setAttribute('aria-hidden', 'false');
      syncTrashToggleState(true);
      if (announce) {
        announceTrash('Viser slettede figurer.');
      }
      if (focusPanel) {
        requestAnimationFrame(() => {
          trashArchive.focus();
        });
      }
    } else {
      trashArchive.setAttribute('hidden', '');
      trashArchive.setAttribute('aria-hidden', 'true');
      syncTrashToggleState(false);
      if (announce) {
        announceTrash('Slettede figurer er skjult.');
      }
      const focusTarget = trashRestoreFocusTo && typeof trashRestoreFocusTo.focus === 'function'
        ? trashRestoreFocusTo
        : trashToggle;
      trashRestoreFocusTo = null;
      requestAnimationFrame(() => {
        focusTarget?.focus?.();
      });
    }
  }

  if (trashToggle && trashArchive) {
    syncTrashToggleState(false);
    trashToggle.addEventListener('click', event => {
      event.preventDefault();
      const nextOpen = !isTrashPanelOpen();
      setTrashPanelVisibility(nextOpen, { triggeredBy: trashToggle });
    });
  }

  if (trashClose) {
    trashClose.addEventListener('click', event => {
      event.preventDefault();
      setTrashPanelVisibility(false, { announce: true });
    });
  }

  if (trashArchive) {
    trashArchive.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isTrashPanelOpen()) {
        event.preventDefault();
        setTrashPanelVisibility(false, { announce: true });
      }
    });
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

  function createArchiveDialog(options = {}) {
    const dialog = document.querySelector('dialog[data-archive-viewer]') || (() => {
      const dialogElement = document.createElement('dialog');
      dialogElement.dataset.archiveViewer = 'true';
      dialogElement.className = 'svg-archive__dialog';
      dialogElement.setAttribute('aria-modal', 'true');
      dialogElement.setAttribute('role', 'dialog');
      dialogElement.setAttribute('aria-labelledby', 'svg-archive-dialog-title');
      dialogElement.setAttribute('aria-describedby', 'svg-archive-dialog-caption');

      const overlay = document.createElement('div');
      overlay.className = 'svg-archive__dialog-surface';

      const header = document.createElement('header');
      header.className = 'svg-archive__dialog-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'svg-archive__dialog-titlegroup';

      const title = document.createElement('h2');
      title.id = 'svg-archive-dialog-title';
      title.className = 'svg-archive__dialog-title';
      titleGroup.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'svg-archive__dialog-subtitle';
      subtitle.setAttribute('aria-live', 'polite');
      subtitle.setAttribute('hidden', '');
      titleGroup.appendChild(subtitle);

      header.appendChild(titleGroup);

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'svg-archive__dialog-close';
      closeButton.setAttribute('aria-label', 'Lukk visning');
      closeButton.innerHTML = '&times;';
      header.appendChild(closeButton);

      const body = document.createElement('div');
      body.className = 'svg-archive__dialog-body';

      const figure = document.createElement('figure');
      figure.className = 'svg-archive__dialog-figure';

      const image = document.createElement('img');
      image.className = 'svg-archive__dialog-image';
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.appendChild(image);

      const figcaption = document.createElement('figcaption');
      figcaption.id = 'svg-archive-dialog-caption';
      figcaption.className = 'svg-archive__dialog-caption';
      figure.appendChild(figcaption);

      const meta = document.createElement('dl');
      meta.id = 'svg-archive-dialog-meta';
      meta.className = 'svg-archive__dialog-meta';

      const actions = document.createElement('div');
      actions.className = 'svg-archive__dialog-actions';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Handlinger for figur');

      const actionConfig = [
        { action: 'download-svg', label: 'Last ned SVG' },
        { action: 'download-png', label: 'Last ned PNG' },
        { action: 'open', label: 'Åpne figur' },
        { action: 'delete', label: 'Slett figur' }
      ];

      for (const { action, label } of actionConfig) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'svg-archive__dialog-action';
        button.dataset.action = action;
        button.textContent = label;
        actions.appendChild(button);
      }

      body.appendChild(figure);
      body.appendChild(meta);
      body.appendChild(actions);

      overlay.appendChild(header);
      overlay.appendChild(body);
      dialogElement.appendChild(overlay);
      document.body.appendChild(dialogElement);

      return dialogElement;
    })();

    const titleElement = dialog.querySelector('.svg-archive__dialog-title');
    const closeButton = dialog.querySelector('.svg-archive__dialog-close');
    const subtitleElement = dialog.querySelector('.svg-archive__dialog-subtitle');
    const captionElement = dialog.querySelector('.svg-archive__dialog-caption');
    const imageElement = dialog.querySelector('.svg-archive__dialog-image');
    const metaElement = dialog.querySelector('.svg-archive__dialog-meta');
    const actionsContainer = dialog.querySelector('.svg-archive__dialog-actions');
    const actionButtons = Array.from(actionsContainer.querySelectorAll('[data-action]'));

    let activeEntry = null;
    let restoreFocusTo = null;

    function renderMeta(entry) {
      metaElement.innerHTML = '';

      const metaPairs = [];

      if (entry.sequenceLabel) {
        metaPairs.push(['Sekvens', entry.sequenceLabel]);
      }
      if (entry.fileSizeLabel) {
        metaPairs.push(['Filstørrelse', entry.fileSizeLabel]);
      }

      if (!metaPairs.length) {
        metaElement.setAttribute('hidden', '');
        return;
      }

      metaElement.removeAttribute('hidden');

      for (const [term, description] of metaPairs) {
        const dt = document.createElement('dt');
        dt.textContent = term;
        metaElement.appendChild(dt);

        const dd = document.createElement('dd');
        dd.textContent = description;
        metaElement.appendChild(dd);
      }
    }

    function updateDialog(entry) {
      activeEntry = entry;
      titleElement.textContent = entry.displayTitle || entry.title || entry.baseName || 'Detaljer';
      if (subtitleElement) {
        if (entry.createdAt) {
          const formatted = new Date(entry.createdAt).toLocaleString('nb-NO', {
            dateStyle: 'medium',
            timeStyle: 'short'
          });
          subtitleElement.textContent = formatted;
          subtitleElement.removeAttribute('hidden');
        } else {
          subtitleElement.textContent = '';
          subtitleElement.setAttribute('hidden', '');
        }
      }
      captionElement.textContent = entry.summary || entry.altText || '';
      if (captionElement.textContent) {
        captionElement.removeAttribute('hidden');
      } else {
        captionElement.setAttribute('hidden', '');
      }
      if (entry.pngUrl) {
        imageElement.src = entry.pngUrl;
      } else if (entry.svgUrl) {
        imageElement.src = entry.svgUrl;
      } else {
        imageElement.removeAttribute('src');
      }
      imageElement.alt = entry.altText || entry.displayTitle || 'Forhåndsvisning';

      renderMeta(entry);

      const descriptionIds = [];
      if (!captionElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-caption');
      }
      if (!metaElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-meta');
      }
      if (descriptionIds.length) {
        dialog.setAttribute('aria-describedby', descriptionIds.join(' '));
      } else {
        dialog.removeAttribute('aria-describedby');
      }

      for (const button of actionButtons) {
        const action = button.dataset.action;
        const hasUrl = action === 'download-svg'
          ? Boolean(entry.svgUrl)
          : action === 'download-png'
            ? Boolean(entry.pngUrl)
            : action === 'open'
              ? Boolean(entry.svgUrl || entry.pngUrl)
              : true;

        if (!hasUrl) {
          button.disabled = true;
          button.setAttribute('aria-hidden', 'true');
        } else {
          button.disabled = false;
          button.removeAttribute('aria-hidden');
        }
      }
    }

    function closeDialog(options = {}) {
      const { returnFocus = true } = options;
      if (!dialog.open) {
        return;
      }
      dialog.close();
      dialog.removeEventListener('keydown', trapFocus, true);
      dialog.removeEventListener('cancel', handleCancel, true);
      dialog.removeEventListener('click', handleBackdropClick);
      if (returnFocus && restoreFocusTo && typeof restoreFocusTo.focus === 'function') {
        restoreFocusTo.focus();
      }
      restoreFocusTo = null;
      activeEntry = null;
    }

    function trapFocus(event) {
      if (event.key !== 'Tab') {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeDialog();
        }
        return;
      }

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        closeDialog();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleCancel(event) {
      event.preventDefault();
      closeDialog();
    }

    function handleBackdropClick(event) {
      if (event.target === dialog) {
        closeDialog();
      }
    }

    closeButton.addEventListener('click', () => {
      closeDialog();
    });

    actionsContainer.addEventListener('click', async event => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest('[data-action]');
      if (!button || !actionsContainer.contains(button)) {
        return;
      }
      event.preventDefault();
      if (!activeEntry) {
        return;
      }
      const action = button.dataset.action;
      if (!action) {
        return;
      }
      await options.onAction?.(action, activeEntry, {
        close: closeDialog
      });
    });

    return {
      open(entry, { focusActions = false, trigger = null } = {}) {
        restoreFocusTo = trigger || document.activeElement;
        updateDialog(entry);
        dialog.showModal();
        dialog.addEventListener('keydown', trapFocus, true);
        dialog.addEventListener('cancel', handleCancel, true);
        dialog.addEventListener('click', handleBackdropClick);

        const focusTarget = focusActions
          ? actionButtons.find(button => !button.disabled)
          : closeButton;

        requestAnimationFrame(() => {
          if (focusTarget) {
            focusTarget.focus();
          }
        });
      },
      close: closeDialog,
      isOpen: () => dialog.open,
      getCurrentEntry: () => activeEntry
    };
  }

  archiveDialog = createArchiveDialog({
    onAction: performEntryAction
  });

  function createCard(entry) {
    const slugValue = entry.slug || entry.svgSlug || entry.baseName || '';

    const item = document.createElement('li');
    item.className = 'svg-archive__item';
    item.dataset.svgItem = slugValue;

    const card = document.createElement('article');
    card.className = 'svg-archive__card';
    card.dataset.slug = slugValue;
    card.dataset.svgUrl = normalizeAssetUrl(entry.svgUrl, 'svg') || entry.svgUrl || '';
    card.dataset.pngUrl = normalizeAssetUrl(entry.pngUrl, 'png') || entry.pngUrl || '';

    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'svg-archive__menu-trigger';
    menuTrigger.setAttribute('aria-haspopup', 'dialog');
    menuTrigger.setAttribute('aria-label', `Åpne meny for ${entry.displayTitle}`);
    menuTrigger.dataset.slug = slugValue;
    menuTrigger.dataset.svgUrl = card.dataset.svgUrl;
    menuTrigger.dataset.pngUrl = card.dataset.pngUrl;

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'svg-archive__preview';
    preview.dataset.previewTrigger = 'true';
    preview.setAttribute('aria-haspopup', 'dialog');
    preview.setAttribute('aria-label', `Vis detaljer for ${entry.displayTitle}`);

    const img = document.createElement('img');
    img.src = normalizeAssetUrl(entry.thumbnailUrl, 'png') || entry.thumbnailUrl || '';
    img.alt = entry.altText || `Forhåndsvisning av ${entry.displayTitle}`;
    img.loading = 'lazy';
    img.decoding = 'async';

    preview.appendChild(img);

    const toolbar = document.createElement('div');
    toolbar.className = 'svg-archive__card-toolbar';
    toolbar.appendChild(menuTrigger);

    card.appendChild(toolbar);
    card.appendChild(preview);

    item.appendChild(card);

    return item;
  }

  function render() {
    const selectedTool = filterSelect && filterSelect.value !== 'all' ? filterSelect.value : null;
    const filteredEntries = selectedTool
      ? allEntries.filter(entry => entry.tool === selectedTool)
      : allEntries.slice();

    if (archiveDialog && archiveDialog.isOpen()) {
      archiveDialog.close({ returnFocus: false });
    }
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
    setStatus('Laster arkivet …');

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
      console.error('Kunne ikke laste arkivet', error);
      setStatus('Klarte ikke å hente arkivet akkurat nå. Prøv igjen senere.', 'error');
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

  function openEntryForTrigger(trigger, { focusActions = false } = {}) {
    const card = trigger.closest('.svg-archive__card');
    if (!card) {
      return;
    }

    const slug = card.dataset.slug;
    if (!slug) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    const entry = allEntries.find(item => item.slug === slug);
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    archiveDialog.open(entry, { focusActions, trigger });
  }

  async function performEntryAction(action, entry, helpers = {}) {
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    try {
      if (action === 'download-svg' || action === 'download-png') {
        const isSvg = action === 'download-svg';
        const url = isSvg ? entry.svgUrl : entry.pngUrl;
        if (!url) {
          setStatus('Fant ikke nedlastingslenken for figuren.', 'error');
          return;
        }

        const link = document.createElement('a');
        link.href = url;
        const fallbackName = `${entry.slug || 'figur'}${isSvg ? '.svg' : '.png'}`;
        link.download = isSvg
          ? (entry.svgSlug || `${entry.baseName || entry.slug || 'figur'}.svg`)
          : (entry.pngSlug || `${entry.baseName || entry.slug || 'figur'}.png`);
        if (!link.download) {
          link.download = fallbackName;
        }
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatus(isSvg ? 'Starter nedlasting av SVG.' : 'Starter nedlasting av PNG.', 'success');
      } else if (action === 'open') {
        const targetConfig = resolveToolOpenTarget(entry.tool || '');
        const exampleState = entry.exampleState;
        const hasExampleState = exampleState != null;

        if (hasExampleState && targetConfig && targetConfig.url && targetConfig.storagePath) {
          const slug = entry.slug || entry.svgSlug || entry.baseName || '';
          const title = entry.displayTitle || entry.title || entry.baseName || slug || 'Figur';
          const toolLabel = (entry.tool && entry.tool.trim()) || targetConfig.displayName || 'verktøyet';

          const openRequest = {
            id: slug || entry.svgSlug || entry.pngSlug || undefined,
            slug,
            title,
            tool: entry.tool || targetConfig.displayName,
            storagePath: targetConfig.storagePath,
            canonicalPath: targetConfig.storagePath,
            path: targetConfig.storagePath,
            targetUrl: targetConfig.url,
            example: exampleState,
            exampleState,
            summary: entry.summary,
            createdAt: entry.createdAt,
            svgUrl: entry.svgUrl,
            pngUrl: entry.pngUrl,
            source: 'svg-archive'
          };

          try {
            window.MathVisExamples?.prepareOpenRequest?.(openRequest);
          } catch (error) {
            console.error('Kunne ikke forberede åpning av eksempel', error);
          }

          const popup = window.open(targetConfig.url, '_blank', 'noopener');
          if (popup) {
            setStatus(`Figuren åpnes i ${toolLabel} med et midlertidig eksempel.`, 'success');
          } else {
            setStatus('Klarte ikke å åpne verktøyet. Tillat sprettoppvinduer og prøv igjen.', 'error');
          }
        } else {
          const url = entry.svgUrl || entry.pngUrl;
          if (!url) {
            setStatus('Fant ikke en URL å åpne for figuren.', 'error');
            return;
          }
          const popup = window.open(url, '_blank', 'noopener');
          if (popup) {
            setStatus('Åpner figur i ny fane.', 'success');
          } else {
            setStatus('Klarte ikke å åpne figuren. Tillat sprettoppvinduer og prøv igjen.', 'error');
          }
        }
      } else if (action === 'delete') {
        const confirmed = window.confirm(`Er du sikker på at du vil slette «${entry.displayTitle}»?`);
        if (!confirmed) {
          return;
        }

        const response = await fetch(`/api/svg?slug=${encodeURIComponent(entry.slug)}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(`Uventet svar: ${response.status}`);
        }

        allEntries = allEntries.filter(item => item.slug !== entry.slug);
        render();
        setStatus('Figur slettet.', 'success');
        helpers.close?.({ returnFocus: false });
        return;
      }
    } catch (error) {
      console.error('Kunne ikke utføre handlingen', error);
      setStatus('Klarte ikke å utføre handlingen. Prøv igjen senere.', 'error');
    }
  }

  grid.addEventListener('click', event => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const previewTrigger = event.target.closest('[data-preview-trigger="true"]');
    if (previewTrigger && grid.contains(previewTrigger)) {
      event.preventDefault();
      openEntryForTrigger(previewTrigger, { focusActions: false });
      return;
    }

    const menuTrigger = event.target.closest('.svg-archive__menu-trigger');
    if (menuTrigger && grid.contains(menuTrigger)) {
      event.preventDefault();
      openEntryForTrigger(menuTrigger, { focusActions: true });
    }
  });
})();
