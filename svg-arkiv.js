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
  let openMenu = null;
  const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    '[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

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

  function focusNextElementAfter(reference) {
    const allFocusable = Array.from(document.querySelectorAll(focusableSelectors)).filter(element => {
      if (element.disabled) {
        return false;
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      if (typeof element.closest === 'function' && element.closest('[hidden]')) {
        return false;
      }
      const rects = element.getClientRects();
      const isSvgElement = typeof window !== 'undefined' && window.SVGElement
        ? element instanceof window.SVGElement
        : false;
      return rects.length > 0 && (element.offsetParent !== null || isSvgElement);
    });
    const currentIndex = allFocusable.indexOf(reference);
    if (currentIndex === -1) {
      return false;
    }
    for (let index = currentIndex + 1; index < allFocusable.length; index += 1) {
      const candidate = allFocusable[index];
      if (!candidate) {
        continue;
      }
      candidate.focus();
      return true;
    }
    return false;
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
    const slugValue = entry.slug || entry.svgSlug || entry.baseName || '';

    const item = document.createElement('li');
    item.className = 'svg-archive__item';
    item.dataset.svgItem = slugValue;

    const card = document.createElement('article');
    card.className = 'svg-archive__card';
    card.dataset.slug = slugValue;
    card.dataset.svgUrl = normalizeAssetUrl(entry.svgUrl, 'svg') || entry.svgUrl || '';
    card.dataset.pngUrl = normalizeAssetUrl(entry.pngUrl, 'png') || entry.pngUrl || '';

    const preview = document.createElement('div');
    preview.className = 'svg-archive__preview';

    const img = document.createElement('img');
    img.src = normalizeAssetUrl(entry.thumbnailUrl, 'png') || entry.thumbnailUrl || '';
    img.alt = entry.altText || `Forhåndsvisning av ${entry.displayTitle}`;
    img.loading = 'lazy';
    img.decoding = 'async';

    preview.appendChild(img);

    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'svg-archive__menu-trigger';
    menuTrigger.setAttribute('aria-haspopup', 'true');
    menuTrigger.setAttribute('aria-expanded', 'false');
    menuTrigger.setAttribute('aria-label', `Åpne meny for ${entry.displayTitle}`);
    menuTrigger.dataset.slug = slugValue;
    menuTrigger.dataset.svgUrl = card.dataset.svgUrl;
    menuTrigger.dataset.pngUrl = card.dataset.pngUrl;

    preview.appendChild(menuTrigger);

    card.appendChild(preview);

    const menuContainer = document.createElement('div');
    menuContainer.className = 'svg-archive__menu';
    menuContainer.hidden = true;

    const actions = [
      { action: 'download-svg', label: 'Last ned SVG' },
      { action: 'download-png', label: 'Last ned PNG' },
      { action: 'open', label: 'Åpne figur' },
      { action: 'delete', label: 'Slett figur' }
    ];

    for (const { action, label } of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'svg-archive__menu-action';
      button.dataset.action = action;
      button.dataset.slug = slugValue;
      button.textContent = label;
      menuContainer.appendChild(button);
    }

    card.appendChild(menuContainer);

    item.appendChild(card);

    return item;
  }

  function removeGlobalMenuListeners() {
    document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    document.removeEventListener('keydown', handleGlobalKeydown, true);
  }

  function handleMenuKeydown(event) {
    if (!openMenu || event.key !== 'Tab') {
      return;
    }

    const { trigger, menu } = openMenu;
    const focusableItems = getFocusableElements(menu);

    if (!focusableItems.length) {
      if (event.shiftKey) {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      } else {
        closeMenu({ focusTrigger: false });
        requestAnimationFrame(() => {
          focusNextElementAfter(trigger);
        });
      }
      return;
    }

    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstItem) {
      event.preventDefault();
      closeMenu({ focusTrigger: true });
      return;
    }

    if (!event.shiftKey && activeElement === lastItem) {
      event.preventDefault();
      const focusOrigin = trigger;
      closeMenu({ focusTrigger: false });
      requestAnimationFrame(() => {
        if (!focusNextElementAfter(focusOrigin)) {
          focusOrigin.blur();
        }
      });
    }
  }

  function handleGlobalPointerDown(event) {
    if (!openMenu) {
      return;
    }

    const { trigger, menu } = openMenu;
    const target = event.target;

    if (trigger.contains(target) || menu.contains(target)) {
      return;
    }

    closeMenu({ focusTrigger: false });
  }

  function handleGlobalKeydown(event) {
    if (!openMenu) {
      return;
    }

    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeMenu({ focusTrigger: true });
    }
  }

  function closeMenu(options = {}) {
    if (!openMenu) {
      return;
    }

    const { focusTrigger = false } = options;
    const { trigger, menu, previousTabIndex } = openMenu;

    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    menu.removeEventListener('keydown', handleMenuKeydown);
    removeGlobalMenuListeners();

    if (previousTabIndex === null) {
      menu.removeAttribute('tabindex');
    } else if (previousTabIndex !== undefined) {
      menu.setAttribute('tabindex', previousTabIndex);
    }

    openMenu = null;

    if (focusTrigger) {
      trigger.focus();
    }
  }

  function openMenuForTrigger(trigger) {
    const card = trigger.closest('.svg-archive__card');
    if (!card) {
      return;
    }

    const menu = card.querySelector('.svg-archive__menu');
    if (!menu) {
      return;
    }

    if (openMenu && openMenu.trigger === trigger) {
      closeMenu({ focusTrigger: false });
      return;
    }

    if (openMenu) {
      closeMenu({ focusTrigger: false });
    }

    const previousTabIndex = menu.hasAttribute('tabindex') ? menu.getAttribute('tabindex') : null;

    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');

    openMenu = { trigger, menu, previousTabIndex };

    const focusableItems = getFocusableElements(menu);
    if (focusableItems.length) {
      requestAnimationFrame(() => {
        focusableItems[0].focus();
      });
    } else {
      if (previousTabIndex === null) {
        menu.setAttribute('tabindex', '-1');
      }
      requestAnimationFrame(() => {
        menu.focus();
      });
    }

    menu.addEventListener('keydown', handleMenuKeydown);
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);
    document.addEventListener('keydown', handleGlobalKeydown, true);
  }

  function render() {
    const selectedTool = filterSelect && filterSelect.value !== 'all' ? filterSelect.value : null;
    const filteredEntries = selectedTool
      ? allEntries.filter(entry => entry.tool === selectedTool)
      : allEntries.slice();

    closeMenu({ focusTrigger: false });
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

  function handleGridActivation(event) {
    const trigger = event.target instanceof Element
      ? event.target.closest('.svg-archive__menu-trigger')
      : null;

    if (!trigger || !grid.contains(trigger)) {
      return;
    }

    openMenuForTrigger(trigger);
  }

  async function handleMenuAction(actionElement) {
    const card = actionElement.closest('.svg-archive__card');
    if (!card) {
      return;
    }

    const slug = card.dataset.slug || actionElement.dataset.slug || '';
    if (!slug) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      closeMenu({ focusTrigger: false });
      return;
    }

    const entry = allEntries.find(item => item.slug === slug);
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      closeMenu({ focusTrigger: false });
      return;
    }

    const action = actionElement.dataset.action;

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
        const url = entry.svgUrl || entry.pngUrl;
        if (!url) {
          setStatus('Fant ikke en URL å åpne for figuren.', 'error');
          return;
        }
        window.open(url, '_blank', 'noopener');
        setStatus('Åpner figur i ny fane.', 'success');
      } else if (action === 'delete') {
        const confirmed = window.confirm(`Er du sikker på at du vil slette «${entry.displayTitle}»?`);
        if (!confirmed) {
          return;
        }

        const response = await fetch(`/api/svg?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(`Uventet svar: ${response.status}`);
        }

        allEntries = allEntries.filter(item => item.slug !== slug);
        render();
        setStatus('Figur slettet.', 'success');
      }
    } catch (error) {
      console.error('Kunne ikke utføre handlingen', error);
      setStatus('Klarte ikke å utføre handlingen. Prøv igjen senere.', 'error');
    } finally {
      closeMenu({ focusTrigger: false });
    }
  }

  grid.addEventListener('click', async event => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const actionElement = event.target.closest('[data-action]');
    if (actionElement && grid.contains(actionElement)) {
      event.preventDefault();
      await handleMenuAction(actionElement);
      return;
    }

    const trigger = event.target instanceof Element
      ? event.target.closest('.svg-archive__menu-trigger')
      : null;

    if (trigger && trigger.dataset.menuTriggerKeyboard === 'true') {
      delete trigger.dataset.menuTriggerKeyboard;
      return;
    }

    handleGridActivation(event);
  });

  grid.addEventListener('keydown', event => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      const trigger = event.target.closest('.svg-archive__menu-trigger');
      if (!trigger || !grid.contains(trigger)) {
        return;
      }
      event.preventDefault();
      trigger.dataset.menuTriggerKeyboard = 'true';
      handleGridActivation(event);
      setTimeout(() => {
        delete trigger.dataset.menuTriggerKeyboard;
      }, 0);
    }
  });
})();
