(() => {
  const grid = document.querySelector('[data-svg-grid]');
  const statusElement = document.querySelector('[data-status]');
  const filterWrapper = document.querySelector('[data-filter-wrapper]');
  const filterSelect = document.querySelector('[data-tool-filter]');
  const sortSelect = document.querySelector('[data-sort-order]');
  const storageNote = document.querySelector('[data-storage-note]');
  const trashToggle = document.querySelector('[data-trash-toggle]');
  const trashArchive = document.querySelector('[data-trash-archive]');
  const trashClose = document.querySelector('[data-trash-close]');
  const trashStatus = document.querySelector('[data-trash-status]');
  const trashList = document.querySelector('[data-trash-list]');
  const trashEmpty = document.querySelector('[data-trash-empty]');

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

  const nameCollator = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
    ? new Intl.Collator('nb', { sensitivity: 'base', numeric: true })
    : null;

  const TrashArchiveViewerModule = window.MathVisualsTrashArchiveViewer || null;
  const TrashArchiveViewerClass = TrashArchiveViewerModule ? TrashArchiveViewerModule.TrashArchiveViewer : null;
  const trashViewerState = {
    groups: [],
    groupsMap: new Map(),
    filter: 'all',
    metadata: null,
    lastFetchUsedFallback: false
  };
  let trashViewer = null;
  let trashViewerInitialized = false;
  const examplesApiBase = TrashArchiveViewerClass
    ? TrashArchiveViewerClass.resolveExamplesApiBase()
    : null;
  const trashApiBase = TrashArchiveViewerClass
    ? TrashArchiveViewerClass.buildTrashApiBase(examplesApiBase)
    : null;
  const TRASH_QUEUE_STORAGE_KEY = 'mathvis:examples:trashQueue:v1';
  const ARCHIVE_CACHE_STORAGE_KEY = 'mathvis:svgArchive:cache:v1';
  const ARCHIVE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
  let manualTrashReplayInFlight = false;
  const entryDetailsCache = new Map();
  const entryDetailsPending = new Map();
  const entryAltTextCache = new Map();

  function getGlobalTrashQueue() {
    const globalObject = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
    if (!globalObject) {
      return null;
    }
    const queue = globalObject.MathVisExamplesTrashQueue;
    if (!queue || typeof queue !== 'object') {
      return null;
    }
    if (typeof queue.flushPending === 'function') {
      return queue;
    }
    if (typeof queue.flush === 'function') {
      return queue;
    }
    return null;
  }

  function getTrashQueueStorage() {
    if (typeof window === 'undefined') {
      return null;
    }
    const storage = window.localStorage;
    if (!storage) {
      return null;
    }
    try {
      const probeKey = `${TRASH_QUEUE_STORAGE_KEY}__probe`;
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function readQueuedTrashEntries() {
    const storage = getTrashQueueStorage();
    if (!storage) {
      return [];
    }
    let raw = null;
    try {
      raw = storage.getItem(TRASH_QUEUE_STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && typeof item === 'object');
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  function writeQueuedTrashEntries(queue) {
    const storage = getTrashQueueStorage();
    if (!storage) {
      return;
    }
    const list = Array.isArray(queue) ? queue : [];
    if (!list.length) {
      try {
        storage.removeItem(TRASH_QUEUE_STORAGE_KEY);
      } catch (error) {}
      return;
    }
    try {
      storage.setItem(TRASH_QUEUE_STORAGE_KEY, JSON.stringify(list));
    } catch (error) {}
  }

  function getArchiveCacheStorage() {
    if (typeof window === 'undefined') {
      return null;
    }
    const storage = window.localStorage;
    if (!storage) {
      return null;
    }
    try {
      const probeKey = `${ARCHIVE_CACHE_STORAGE_KEY}__probe`;
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function readArchiveCache() {
    const storage = getArchiveCacheStorage();
    if (!storage) {
      return null;
    }
    let raw = null;
    try {
      raw = storage.getItem(ARCHIVE_CACHE_STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const timestamp = Number(parsed.timestamp) || 0;
      if (!timestamp || Date.now() - timestamp > ARCHIVE_CACHE_MAX_AGE_MS) {
        return null;
      }
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      const metadata = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : null;
      return { entries, metadata, timestamp };
    } catch (error) {
      return null;
    }
  }

  function writeArchiveCache(cache) {
    const storage = getArchiveCacheStorage();
    if (!storage) {
      return;
    }
    if (!cache || typeof cache !== 'object') {
      try {
        storage.removeItem(ARCHIVE_CACHE_STORAGE_KEY);
      } catch (error) {}
      return;
    }
    const payload = {
      timestamp: Number(cache.timestamp) || Date.now(),
      entries: Array.isArray(cache.entries) ? cache.entries : [],
      metadata: cache.metadata && typeof cache.metadata === 'object' ? cache.metadata : null
    };
    try {
      storage.setItem(ARCHIVE_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {}
  }

  function getPendingTrashQueueCount() {
    const globalQueue = getGlobalTrashQueue();
    if (globalQueue && typeof globalQueue.getQueueLength === 'function') {
      try {
        return Number(globalQueue.getQueueLength()) || 0;
      } catch (error) {}
    }
    return readQueuedTrashEntries().length;
  }

  async function fallbackFlushQueuedTrashEntries() {
    const storage = getTrashQueueStorage();
    if (!storage) {
      return { processed: 0, remaining: 0 };
    }
    let queue = readQueuedTrashEntries();
    if (!queue.length) {
      return { processed: 0, remaining: 0 };
    }
    if (!trashApiBase || !TrashArchiveViewerClass) {
      throw new Error('Arkivtjenesten for slettede figurer er ikke tilgjengelig.');
    }
    const url = TrashArchiveViewerClass.buildTrashApiUrl(trashApiBase);
    if (!url) {
      throw new Error('Fant ikke adressen til arkivtjenesten.');
    }
    let processed = 0;
    while (queue.length) {
      const current = queue[0];
      if (!current || typeof current !== 'object') {
        queue.shift();
        processed++;
        writeQueuedTrashEntries(queue);
        continue;
      }
      const record = current.record && typeof current.record === 'object' ? current.record : null;
      if (!record) {
        queue.shift();
        processed++;
        writeQueuedTrashEntries(queue);
        continue;
      }
      const payload = {
        entries: [record],
        mode: current.mode === 'append' ? 'append' : 'prepend'
      };
      if (Number.isInteger(current.limit) && current.limit > 0) {
        payload.limit = current.limit;
      }
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        throw new Error('Kunne ikke sende ventende slettinger til arkivet.');
      }
      if (!response || !response.ok) {
        const status = response && response.status ? response.status : 'ukjent';
        throw new Error(`Arkivtjenesten avviste ventende slettinger (status ${status}).`);
      }
      queue.shift();
      processed++;
      writeQueuedTrashEntries(queue);
    }
    return { processed, remaining: queue.length };
  }

  async function replayQueuedTrashEntries(options = {}) {
    const globalQueue = getGlobalTrashQueue();
    if (globalQueue && typeof globalQueue.flushPending === 'function') {
      return globalQueue.flushPending(options);
    }
    if (globalQueue && typeof globalQueue.flush === 'function') {
      return globalQueue.flush(options);
    }
    return fallbackFlushQueuedTrashEntries();
  }

  function clonePlainObject(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      const copy = Array.isArray(value) ? [] : {};
      Object.keys(value).forEach(key => {
        copy[key] = value[key];
      });
      return copy;
    }
  }

  function collectQueuedTrashRecords() {
    const queued = readQueuedTrashEntries();
    if (!Array.isArray(queued) || !queued.length) {
      return [];
    }
    const records = [];
    queued.forEach(entry => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const record = clonePlainObject(entry.record);
      if (!record || typeof record.id !== 'string' || !record.id.trim()) {
        return;
      }
      if (typeof record.deletedAt !== 'string' || !record.deletedAt.trim()) {
        let fallbackTimestamp = null;
        if (typeof entry.queuedAt === 'string' && entry.queuedAt.trim()) {
          fallbackTimestamp = entry.queuedAt.trim();
        }
        if (!fallbackTimestamp) {
          try {
            fallbackTimestamp = new Date().toISOString();
          } catch (error) {
            fallbackTimestamp = '';
          }
        }
        record.deletedAt = fallbackTimestamp;
      }
      if (typeof record.reason !== 'string' || !record.reason) {
        record.reason = 'delete';
      }
      record.fallback = true;
      record.fallbackSource = 'queue';
      record.queuedAt = typeof entry.queuedAt === 'string' ? entry.queuedAt : record.deletedAt;
      records.push(record);
    });
    return dedupeTrashEntries(records);
  }

  function buildTrashFallbackMetadata({ entries, reason, status, error }) {
    const hasEntries = Array.isArray(entries) && entries.length > 0;
    const resolvedReason = typeof reason === 'string' && reason ? reason : 'unavailable';
    const limitationBase =
      resolvedReason === 'unconfigured'
        ? 'Arkivtjenesten for slettede figurer er ikke konfigurert.'
        : 'Arkivtjenesten for slettede figurer er utilgjengelig akkurat nå.';
    const limitation = hasEntries
      ? `${limitationBase} Viser slettede figurer lagret på denne enheten.`
      : `${limitationBase} Ingen lokale slettede figurer er tilgjengelige.`;
    const details = {};
    if (typeof status === 'number') {
      details.status = status;
    }
    if (error && typeof error.message === 'string' && error.message) {
      details.errorMessage = error.message;
    }
    if (!details.queueSize) {
      details.queueSize = Array.isArray(entries) ? entries.length : 0;
    }
    return {
      storage: 'local',
      storageMode: 'local',
      mode: 'local',
      persistent: false,
      ephemeral: true,
      limitation,
      fallback: true,
      fallbackReason: resolvedReason,
      fallbackSource: hasEntries ? 'queue' : 'none',
      fallbackDetails: details
    };
  }

  function buildTrashFallbackResult(options = {}) {
    if (!trashViewer || !TrashArchiveViewerClass) {
      throw new Error('Visningen for slettede figurer er ikke tilgjengelig.');
    }
    const entries = collectQueuedTrashRecords();
    const metadata = buildTrashFallbackMetadata({
      entries,
      reason: options.reason,
      status: options.status,
      error: options.error
    });
    const hasEntries = entries.length > 0;
    const resolvedReason = metadata.fallbackReason;
    const baseMessage =
      resolvedReason === 'unconfigured'
        ? 'Arkivtjenesten er ikke konfigurert.'
        : 'Arkivtjenesten er utilgjengelig.';
    const message = hasEntries
      ? `${baseMessage} Viser slettede figurer som venter på opplasting fra denne enheten.`
      : `${baseMessage} Ingen lokale slettede figurer ble funnet.`;
    const actions = [buildTrashRetryAction()].filter(Boolean);
    const state = hasEntries ? 'warning' : 'error';
    trashViewer.applyEntriesResult({ entries, metadata, usedFallback: true });
    if (message || actions.length) {
      setTrashViewerStatus({ text: message, actions }, state);
    } else {
      setTrashViewerStatus('', null);
    }
    return { entries, metadata, usedFallback: true };
  }

  function buildTrashRetryAction() {
    const hasPending = getPendingTrashQueueCount() > 0;
    if (!hasPending || manualTrashReplayInFlight) {
      return null;
    }
    return {
      label: 'Send lagrede slettinger nå',
      onClick: () => {
        if (manualTrashReplayInFlight) {
          return;
        }
        manualTrashReplayInFlight = true;
        setTrashViewerStatus({ text: 'Sender lagrede slettinger …' }, 'info');
        replayQueuedTrashEntries({ silent: true })
          .then(async result => {
            manualTrashReplayInFlight = false;
            const processed = result && typeof result.processed === 'number' ? result.processed : 0;
            if (processed > 0) {
              setTrashViewerStatus('Ventende slettinger ble sendt til arkivet.', 'success');
              try {
                await fetchTrashEntries();
                renderTrashViewer();
              } catch (error) {
                setTrashViewerStatus(
                  {
                    text: 'Slettingene ble sendt, men arkivlisten kunne ikke oppdateres. Oppdater siden for å se endringene.',
                    actions: [buildTrashRetryAction()].filter(Boolean)
                  },
                  'warning'
                );
              }
            } else {
              setTrashViewerStatus('Fant ingen ventende slettinger å sende.', 'info');
            }
          })
          .catch(error => {
            manualTrashReplayInFlight = false;
            const message = error && error.message ? error.message : 'Kunne ikke sende ventende slettinger.';
            setTrashViewerStatus(
              {
                text: `${message} Arkivet kan fortsatt være ufullstendig.`,
                actions: [buildTrashRetryAction()].filter(Boolean)
              },
              'error'
            );
          });
      }
    };
  }

  function showTrashArchiveWarning(error) {
    const baseMessage = error && error.message ? error.message : 'Kunne ikke hente slettede figurer.';
    const action = buildTrashRetryAction();
    const payload = {
      text: `${baseMessage} Arkivet kan være ufullstendig.`,
      actions: action ? [action] : []
    };
    setTrashViewerStatus(payload, 'error');
  }

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

  function normalizeStoragePath(value) {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
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
      {
        names: ['Numbervisuals', 'Numbervisual'],
        url: '/kvikkbilder-monster.html',
        storagePath: '/kvikkbilder-monster',
        displayName: 'Numbervisuals'
      },
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
    const storageMap = new Map();
    for (const definition of definitions) {
      const normalizedUrl = definition.url;
      const navHrefCandidate = typeof definition.navHref === 'string' ? definition.navHref : normalizedUrl;
      const navHref = typeof navHrefCandidate === 'string'
        ? navHrefCandidate.replace(/^\//, '').trim()
        : '';
      const entry = {
        url: normalizedUrl,
        storagePath: normalizeStoragePath(definition.storagePath),
        displayName: definition.displayName || (definition.names && definition.names[0]) || '',
        navHref
      };
      const storageKey = entry.storagePath;
      if (storageKey && !storageMap.has(storageKey)) {
        storageMap.set(storageKey, entry);
      }
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
    map.byStoragePath = storageMap;
    return map;
  })();

  const OPEN_REQUEST_STORAGE_KEY = 'archive_open_request';

  function getLocalStorage() {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function writeArchiveOpenRequest(payload) {
    const storage = getLocalStorage();
    if (!storage) {
      return false;
    }
    if (!payload || typeof payload !== 'object') {
      try {
        storage.removeItem(OPEN_REQUEST_STORAGE_KEY);
      } catch (error) {}
      return false;
    }
    try {
      storage.setItem(OPEN_REQUEST_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function parseArchiveExample(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        return null;
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    return null;
  }

  function normalizeArchivePath(value) {
    if (typeof value !== 'string') {
      return null;
    }
    let path = value.trim();
    if (!path) {
      return null;
    }
    try {
      const url = new URL(path, window.location.origin);
      if (url && typeof url.pathname === 'string') {
        path = url.pathname;
      }
    } catch (error) {}
    path = path.replace(/\\+/g, '/');
    path = path.replace(/\/+/g, '/');
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    path = path.replace(/\/index\.html?$/i, '/');
    path = path.replace(/\.html?$/i, '');
    path = path.replace(/\/+$/, '');
    if (!path) {
      return '/';
    }
    const examplePattern = /\/eksempel[-_]?\d+$/i;
    while (path.length > 1 && examplePattern.test(path)) {
      const next = path.replace(examplePattern, '');
      if (!next || next === path) {
        break;
      }
      path = next.replace(/\/+$/, '');
    }
    if (!path) {
      return '/';
    }
    try {
      return decodeURI(path).toLowerCase() || '/';
    } catch (error) {
      return path.toLowerCase();
    }
  }

  function cloneArchiveExample(example) {
    if (!example || typeof example !== 'object') {
      return null;
    }
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(example);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(example));
    } catch (error) {
      return null;
    }
  }

  function prepareArchiveOpenRequestFallback(rawRequest) {
    const request = rawRequest && typeof rawRequest === 'object' ? { ...rawRequest } : {};
    const exampleState =
      parseArchiveExample(request.exampleState) ||
      parseArchiveExample(request.example) ||
      parseArchiveExample(request.exampleData) ||
      parseArchiveExample(request.payload);
    if (exampleState) {
      const normalizedExample = cloneArchiveExample(exampleState);
      if (normalizedExample) {
        request.exampleState = normalizedExample;
        request.example = normalizedExample;
        request.exampleData = normalizedExample;
        request.payload = normalizedExample;
      }
    }
    const pathCandidates = [
      request.canonicalPath,
      request.storagePath,
      request.path,
      request.target,
      request.href,
      request.targetUrl
    ];
    for (const candidate of pathCandidates) {
      const normalized = normalizeArchivePath(candidate);
      if (normalized) {
        request.canonicalPath = normalized;
        if (!request.path) {
          request.path = normalized;
        }
        if (!request.storagePath) {
          request.storagePath = normalized;
        }
        break;
      }
    }
    const saved = writeArchiveOpenRequest(request);
    if (!saved) {
      try {
        console.error('Kunne ikke lagre åpningstilstanden for arkivet i localStorage.');
      } catch (_) {}
      return null;
    }
    return request;
  }

  function generateArchiveRequestId(entry) {
    const source =
      entry && typeof entry === 'object'
        ? entry.slug || entry.svgSlug || entry.pngSlug || entry.baseName || entry.displayTitle || 'figur'
        : 'figur';
    const baseSegment = String(source)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    const safeBase = baseSegment || 'figur';
    const timestampSegment = (() => {
      try {
        return Date.now ? Date.now().toString(36) : '';
      } catch (_) {
        return '';
      }
    })();
    let randomSegment = '';
    try {
      const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
      if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        const buffer = new Uint32Array(2);
        cryptoApi.getRandomValues(buffer);
        randomSegment = Array.from(buffer)
          .map(value => value.toString(36))
          .join('')
          .slice(0, 16);
      }
    } catch (_) {}
    if (!randomSegment) {
      randomSegment = Math.random().toString(36).slice(2, 10);
    }
    return [safeBase, timestampSegment, randomSegment].filter(Boolean).join('-');
  }

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

  function resolveTargetFromStorageIndicator(indicator) {
    if (!indicator || !TOOL_OPEN_TARGETS.byStoragePath) {
      return null;
    }

    const normalizedIndicator = String(indicator).toLowerCase();
    if (!normalizedIndicator) {
      return null;
    }

    for (const [storagePath, target] of TOOL_OPEN_TARGETS.byStoragePath.entries()) {
      if (!storagePath) {
        continue;
      }
      const normalizedPath = storagePath.toLowerCase();
      const pathWithoutLeadingSlash = normalizedPath.replace(/^\//, '');
      if (
        normalizedIndicator.includes(normalizedPath) ||
        (pathWithoutLeadingSlash && normalizedIndicator.includes(pathWithoutLeadingSlash))
      ) {
        return target;
      }
    }

    return null;
  }

  function resolveEntryOpenTarget(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const explicitTarget = resolveToolOpenTarget(entry.tool || '');
    if (explicitTarget) {
      return explicitTarget;
    }

    const indicators = [entry.storagePath, entry.slug, entry.svgUrl, entry.pngUrl, entry.thumbnailUrl];
    for (const indicator of indicators) {
      const target = resolveTargetFromStorageIndicator(indicator);
      if (target) {
        return target;
      }
    }

    return null;
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

  function setTrashViewerStatus(message, state) {
    if (!trashStatus) {
      return;
    }
    let text = '';
    let actions = [];
    if (message && typeof message === 'object' && !Array.isArray(message)) {
      text = typeof message.text === 'string' ? message.text : '';
      if (Array.isArray(message.actions)) {
        actions = message.actions.filter(action => action && typeof action === 'object');
      }
    } else if (typeof message === 'string') {
      text = message;
    }

    while (trashStatus.firstChild) {
      trashStatus.removeChild(trashStatus.firstChild);
    }

    if (!text && actions.length === 0) {
      trashStatus.textContent = '';
      trashStatus.hidden = true;
    } else {
      trashStatus.hidden = false;
      if (text) {
        const textNode = document.createElement('span');
        textNode.textContent = text;
        trashStatus.appendChild(textNode);
      }
      if (actions.length) {
        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'svg-archive__trash-panel-actions';
        actions.forEach(action => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'svg-archive__trash-panel-action';
          button.textContent = typeof action.label === 'string' && action.label.trim() ? action.label : 'Prøv igjen';
          if (typeof action.onClick === 'function') {
            button.addEventListener('click', action.onClick);
          }
          actionsContainer.appendChild(button);
        });
        trashStatus.appendChild(actionsContainer);
      }
    }

    if (state) {
      trashStatus.dataset.state = state;
    } else {
      delete trashStatus.dataset.state;
    }
  }

  function updateTrashViewerGroups(groups) {
    const list = Array.isArray(groups) ? groups : [];
    trashViewerState.groups = list;
    trashViewerState.groupsMap = new Map();
    list.forEach(group => {
      if (!group || typeof group.path !== 'string') return;
      trashViewerState.groupsMap.set(group.path, group);
    });
  }

  function formatTrashTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    try {
      return date.toLocaleString('no-NO', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (error) {
      return date.toISOString();
    }
  }

  function renderTrashViewer() {
    if (!trashList) {
      return;
    }

    Array.from(trashList.querySelectorAll('[data-group]')).forEach(node => node.remove());

    const groups = Array.isArray(trashViewerState.groups) ? trashViewerState.groups : [];
    if (!groups.length) {
      if (trashEmpty) {
        trashEmpty.hidden = false;
        if (!trashEmpty.parentNode) {
          trashList.appendChild(trashEmpty);
        }
      }
      return;
    }

    if (trashEmpty) {
      trashEmpty.hidden = true;
      if (!trashEmpty.parentNode) {
        trashList.appendChild(trashEmpty);
      }
    }

    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
      if (!group || !Array.isArray(group.items) || !group.items.length) {
        return;
      }

      const section = document.createElement('section');
      section.className = 'svg-archive__trash-group';
      section.dataset.group = '';
      section.dataset.path = group.path;

      const header = document.createElement('header');
      header.className = 'svg-archive__trash-group-header';

      const title = document.createElement('h3');
      title.className = 'svg-archive__trash-group-title';
      title.textContent = group.sourceTitle || group.path;
      header.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'svg-archive__trash-group-meta';
      const count = group.items.length;
      const countLabel = count === 1 ? '1 arkivert element' : `${count} arkiverte elementer`;
      const latest = formatTrashTimestamp(group.latestDeletedAt);
      meta.textContent = latest ? `${countLabel} · Sist slettet ${latest}` : countLabel;
      header.appendChild(meta);

      section.appendChild(header);

      const list = document.createElement('ul');
      list.className = 'svg-archive__trash-items';

      group.items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          return;
        }

        const listItem = document.createElement('li');
        listItem.className = 'svg-archive__trash-item';
        listItem.dataset.item = '';
        if (item.id) {
          listItem.dataset.id = item.id;
        }

        const itemBody = document.createElement('div');
        itemBody.className = 'svg-archive__trash-item-body';

        const itemTitle = document.createElement('h4');
        itemTitle.className = 'svg-archive__trash-item-title';
        const example = item.example && typeof item.example === 'object' ? item.example : null;
        const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : '';
        const exampleTitle = example && typeof example.title === 'string' && example.title.trim()
          ? example.title.trim()
          : '';
        const exampleDescription = example && typeof example.description === 'string'
          ? example.description.trim()
          : '';
        const fallbackTitle = exampleDescription ? exampleDescription.slice(0, 120) : `Element ${index + 1}`;
        itemTitle.textContent = label || exampleTitle || fallbackTitle;
        itemBody.appendChild(itemTitle);

        const itemMeta = document.createElement('p');
        itemMeta.className = 'svg-archive__trash-item-meta';
        const deletedLabel = formatTrashTimestamp(item.deletedAt);
        const reason = item.reason === 'history-import' ? 'Importert' : item.reason === 'archive' ? 'Arkivert' : null;
        const metaParts = [];
        if (deletedLabel) {
          metaParts.push(`Slettet ${deletedLabel}`);
        }
        if (typeof item.removedAtIndex === 'number' && Number.isFinite(item.removedAtIndex)) {
          metaParts.push(`Plass ${item.removedAtIndex + 1}`);
        }
        if (reason) {
          metaParts.push(reason);
        }
        itemMeta.textContent = metaParts.join(' · ');
        itemBody.appendChild(itemMeta);

        const actions = document.createElement('div');
        actions.className = 'svg-archive__trash-actions';

        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'svg-archive__trash-action';
        restoreButton.dataset.action = 'restore';
        if (item.id) {
          restoreButton.dataset.id = item.id;
        }
        if (group.path) {
          restoreButton.dataset.path = group.path;
        }
        restoreButton.textContent = 'Gjenopprett';
        actions.appendChild(restoreButton);

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'svg-archive__trash-action';
        openButton.dataset.action = 'open';
        if (item.id) {
          openButton.dataset.id = item.id;
        }
        if (group.path) {
          openButton.dataset.path = group.path;
        }
        openButton.textContent = 'Åpne';
        actions.appendChild(openButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'svg-archive__trash-action svg-archive__trash-action--danger';
        deleteButton.dataset.action = 'delete';
        if (item.id) {
          deleteButton.dataset.id = item.id;
        }
        if (group.path) {
          deleteButton.dataset.path = group.path;
        }
        deleteButton.textContent = 'Slett permanent';
        actions.appendChild(deleteButton);

        itemBody.appendChild(actions);
        listItem.appendChild(itemBody);
        list.appendChild(listItem);
      });

      section.appendChild(list);
      fragment.appendChild(section);
    });

    trashList.appendChild(fragment);
  }

  function dedupeTrashEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    const seen = new Set();
    const result = [];
    entries.forEach(entry => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (id && seen.has(id)) {
        return;
      }
      if (id) {
        seen.add(id);
      }
      result.push(entry);
    });
    return result;
  }

  async function fetchTrashEntries() {
    if (!trashViewer || !TrashArchiveViewerClass) {
      throw new Error('Fant ikke visningen for slettede figurer.');
    }
    if (!trashApiBase) {
      return buildTrashFallbackResult({ reason: 'unconfigured' });
    }

    const url = TrashArchiveViewerClass.buildTrashApiUrl(trashApiBase);
    if (!url) {
      return buildTrashFallbackResult({ reason: 'invalid-url' });
    }

    let response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      return buildTrashFallbackResult({ reason: 'network-error', error });
    }

    if (response && response.status === 404) {
      return buildTrashFallbackResult({ reason: 'not-found', status: 404 });
    }

    if (!TrashArchiveViewerClass.responseLooksLikeJson(response)) {
      const status = response && response.status ? response.status : undefined;
      return buildTrashFallbackResult({ reason: 'invalid-response', status });
    }

    if (!response.ok) {
      return buildTrashFallbackResult({ reason: 'error-status', status: response.status });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      return buildTrashFallbackResult({ reason: 'parse-error', status: response.status, error });
    }

    const entries = dedupeTrashEntries(Array.isArray(payload && payload.entries) ? payload.entries : []);
    const metadata = TrashArchiveViewerClass.extractMetadata(payload);
    trashViewer.applyEntriesResult({ entries, metadata, usedFallback: false });
    setTrashViewerStatus('', null);
    return { entries, metadata, usedFallback: false };
  }

  function openTrashExample(path, id) {
    if (typeof path !== 'string' || !path) {
      return;
    }
    const group = trashViewerState.groupsMap.get(path);
    if (!group || !Array.isArray(group.items)) {
      return;
    }
    const item = group.items.find(entry => entry && entry.id === id);
    if (!item) {
      return;
    }
    let href = typeof item.sourceHref === 'string' && item.sourceHref.trim() ? item.sourceHref.trim() : '';
    if (!href) {
      href = typeof group.path === 'string' && group.path
        ? (group.path.endsWith('.html') ? group.path : `${group.path}.html`)
        : '';
    }
    if (!href) {
      return;
    }
    const index = Number.isInteger(item.removedAtIndex) ? item.removedAtIndex : 0;
    try {
      const url = new URL(href, window.location && window.location.href ? window.location.href : undefined);
      if (Number.isInteger(index)) {
        url.searchParams.set('example', String(index + 1));
      }
      window.open(url.toString(), '_blank', 'noopener');
    } catch (error) {
      const base = href.includes('?') ? '&' : '?';
      const suffix = Number.isInteger(index) ? `${base}example=${index + 1}` : '';
      window.open(`${href}${suffix}`, '_blank', 'noopener');
    }
  }

  async function ensureTrashViewerInitialized() {
    if (trashViewerInitialized) {
      return;
    }
    if (!TrashArchiveViewerClass) {
      setTrashViewerStatus('Visningen for slettede figurer er ikke tilgjengelig i denne nettleseren.', 'error');
      trashViewerInitialized = true;
      return;
    }

    trashViewer = new TrashArchiveViewerClass({
      apiBase: examplesApiBase,
      trashApiBase,
      state: trashViewerState,
      updateGroups: updateTrashViewerGroups,
      buildFilterOptions: () => {},
      renderEntries: renderTrashViewer,
      setStatus: setTrashViewerStatus,
      openExample: openTrashExample,
      onFetchEntries: fetchTrashEntries,
      notifyParent: () => {},
      messages: {
        fallbackStatus: '',
        restoreFallbackStatus: '',
        restoreInProgress: 'Gjenoppretter figuren …',
        restoreSuccess: 'Figur gjenopprettet.',
        restoreError: 'Kunne ikke gjenopprette figuren.',
        deleteCancelled: 'Sletting avbrutt.',
        deleteError: 'Kunne ikke slette figuren permanent.',
        deleteSuccess: 'Figur slettet.'
      }
    });

    if (trashList) {
      trashList.addEventListener('click', trashViewer.handleAction);
    }

    trashViewerInitialized = true;

    try {
      setTrashViewerStatus('Laster slettede figurer …', 'info');
      await fetchTrashEntries();
      renderTrashViewer();
      if (trashViewerState.lastFetchUsedFallback) {
        const hasGroups = Array.isArray(trashViewerState.groups) && trashViewerState.groups.length > 0;
        if (!hasGroups && trashStatus && trashStatus.hidden) {
          setTrashViewerStatus('Ingen slettede figurer tilgjengelige akkurat nå.', 'info');
        }
      } else if (!trashViewerState.groups.length) {
        setTrashViewerStatus('Ingen slettede figurer ennå.', 'info');
      } else {
        setTrashViewerStatus('Slettede figurer er klare.', 'success');
      }
    } catch (error) {
      showTrashArchiveWarning(error);
    }
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
      if (!trashViewerInitialized) {
        ensureTrashViewerInitialized().catch(error => {
          setTrashViewerStatus(
            error && error.message ? error.message : 'Kunne ikke hente slettede figurer.',
            'error'
          );
        });
      }
      trashRestoreFocusTo = triggeredBy || document.activeElement || trashToggle;
      trashArchive.removeAttribute('hidden');
      trashArchive.setAttribute('aria-hidden', 'false');
      syncTrashToggleState(true);
      if (announce && !trashViewerInitialized) {
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

      const descriptionSection = document.createElement('section');
      descriptionSection.className = 'svg-archive__dialog-section svg-archive__dialog-section--description';
      descriptionSection.setAttribute('hidden', '');

      const descriptionTitle = document.createElement('h3');
      descriptionTitle.className = 'svg-archive__dialog-section-title';
      descriptionTitle.textContent = 'Oppgavetekst';
      descriptionSection.appendChild(descriptionTitle);

      const descriptionBody = document.createElement('div');
      descriptionBody.id = 'svg-archive-dialog-description';
      descriptionBody.className = 'svg-archive__dialog-description';
      descriptionBody.dataset.state = 'loading';
      descriptionSection.appendChild(descriptionBody);

      const altTextSection = document.createElement('section');
      altTextSection.className = 'svg-archive__dialog-section svg-archive__dialog-section--alt-text';

      const altTextTitle = document.createElement('h3');
      altTextTitle.className = 'svg-archive__dialog-section-title';
      altTextTitle.textContent = 'Alternativ tekst';
      altTextSection.appendChild(altTextTitle);

      const altTextNote = document.createElement('p');
      altTextNote.className = 'svg-archive__dialog-alt-text-note';
      altTextNote.textContent = 'Teksten beskriver figuren for skjermlesere og kan redigeres ved behov.';
      altTextSection.appendChild(altTextNote);

      const altTextEditor = document.createElement('div');
      altTextEditor.dataset.altTextEditor = 'true';
      altTextSection.appendChild(altTextEditor);

      const altTextFigure = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      altTextFigure.classList.add('svg-archive__dialog-alt-text-figure');
      altTextFigure.setAttribute('aria-hidden', 'true');
      altTextFigure.setAttribute('focusable', 'false');
      altTextFigure.setAttribute('width', '0');
      altTextFigure.setAttribute('height', '0');
      altTextSection.appendChild(altTextFigure);

      const meta = document.createElement('dl');
      meta.id = 'svg-archive-dialog-meta';
      meta.className = 'svg-archive__dialog-meta';

      const actions = document.createElement('div');
      actions.className = 'svg-archive__dialog-actions';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Handlinger for figur');

      const actionConfig = [
        { action: 'open-svg', label: 'Åpne SVG' },
        { action: 'open-png', label: 'Åpne PNG' },
        { action: 'edit', label: 'Rediger i verktøy' },
        { action: 'download', label: 'Last ned' },
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
      body.appendChild(descriptionSection);
      body.appendChild(altTextSection);
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
    const descriptionSectionElement = dialog.querySelector('.svg-archive__dialog-section--description');
    const descriptionContentElement = descriptionSectionElement
      ? descriptionSectionElement.querySelector('.svg-archive__dialog-description')
      : null;
    const altTextSectionElement = dialog.querySelector('.svg-archive__dialog-section--alt-text');
    const altTextEditorContainer = altTextSectionElement
      ? altTextSectionElement.querySelector('[data-alt-text-editor]')
      : null;
    const altTextNoteElement = altTextSectionElement
      ? altTextSectionElement.querySelector('.svg-archive__dialog-alt-text-note')
      : null;
    const altTextFigureElement = altTextSectionElement
      ? altTextSectionElement.querySelector('.svg-archive__dialog-alt-text-figure')
      : null;
    const metaElement = dialog.querySelector('.svg-archive__dialog-meta');
    const actionsContainer = dialog.querySelector('.svg-archive__dialog-actions');
    const actionButtons = Array.from(actionsContainer.querySelectorAll('[data-action]'));

    function resolveCaptionText(entry, details) {
      const fallbackEntry = entry || {};
      const detailsSummary = details && details.summary;
      const fallbackSummary = fallbackEntry.summary;
      const pickFromObject = value => {
        if (value && typeof value === 'object') {
          if (typeof value.text === 'string' && value.text.trim()) {
            return value.text.trim();
          }
          if (typeof value.description === 'string' && value.description.trim()) {
            return value.description.trim();
          }
        }
        return '';
      };
      const detailsObjectText = pickFromObject(detailsSummary);
      if (detailsObjectText) {
        return detailsObjectText;
      }
      if (typeof detailsSummary === 'string' && detailsSummary.trim()) {
        return detailsSummary.trim();
      }
      const fallbackObjectText = pickFromObject(fallbackSummary);
      if (fallbackObjectText) {
        return fallbackObjectText;
      }
      if (typeof fallbackSummary === 'string' && fallbackSummary.trim()) {
        return fallbackSummary.trim();
      }
      return '';
    }

    function updateCaption(entry, details) {
      if (!captionElement) {
        return;
      }
      const text = resolveCaptionText(entry, details);
      captionElement.textContent = text;
      if (text) {
        captionElement.removeAttribute('hidden');
      } else {
        captionElement.setAttribute('hidden', '');
      }
      syncDialogDescriptionTargets();
    }

    function updateAltTextNoteDisplay(source) {
      if (!altTextNoteElement) {
        return;
      }
      if (source === 'manual') {
        altTextNoteElement.textContent = 'Teksten er lagret manuelt og brukes for skjermlesere.';
      } else {
        altTextNoteElement.textContent = 'Teksten er generert automatisk. Rediger og lagre ved behov.';
      }
    }

    let activeEntry = null;
    let restoreFocusTo = null;
    let currentDetails = null;
    let altTextManager = null;
    let pendingDetailsToken = 0;
    let altTextSaveToken = 0;

    async function persistAltTextForActiveEntry(text, source) {
      if (!activeEntry || !activeEntry.slug) {
        throw new Error('Fant ikke figuren som skulle lagres.');
      }
      const normalizedText = typeof text === 'string' ? text.trim() : '';
      const normalizedSource = source === 'manual' && normalizedText ? 'manual' : 'auto';
      const payload = {
        slug: activeEntry.slug,
        altText: normalizedText,
        altTextSource: normalizedSource
      };
      const token = ++altTextSaveToken;

      let response;
      try {
        response = await fetch('/api/svg', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        throw Object.assign(new Error('Kunne ikke lagre teksten. Kontroller tilkoblingen og prøv igjen.'), { cause: error });
      }

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (error) {
        responseBody = null;
      }

      if (!response.ok) {
        const message = responseBody && typeof responseBody.error === 'string' && responseBody.error.trim()
          ? responseBody.error.trim()
          : `Kunne ikke lagre teksten (status ${response.status}).`;
        throw new Error(message);
      }

      if (token !== altTextSaveToken) {
        return {
          text: normalizedText,
          source: normalizedSource
        };
      }

      const savedText = responseBody && typeof responseBody.altText === 'string'
        ? responseBody.altText.trim()
        : normalizedText;
      const rawSource = responseBody && typeof responseBody.altTextSource === 'string'
        ? responseBody.altTextSource.trim().toLowerCase()
        : normalizedSource;
      const savedSource = rawSource === 'manual' && savedText ? 'manual' : 'auto';

      updateAltTextRecord(activeEntry.slug, current => {
        current.text = savedText;
        current.source = savedSource;
        return current;
      });

      activeEntry.altText = savedText;
      activeEntry.altTextSource = savedSource;
      imageElement.alt = savedText || activeEntry.displayTitle || 'Forhåndsvisning';

      const cardImage = findCardPreviewImage(activeEntry.slug);
      if (cardImage) {
        cardImage.alt = savedText || `Forhåndsvisning av ${activeEntry.displayTitle || 'figur'}`;
      }

      if (currentDetails && currentDetails.slug === activeEntry.slug) {
        currentDetails.altText = savedText;
        currentDetails.altTextSource = savedSource;
        if (currentDetails.summary && typeof currentDetails.summary === 'object') {
          currentDetails.summary.altText = savedText;
          currentDetails.summary.altTextSource = savedSource;
        }
      }

      if (entryDetailsCache.has(activeEntry.slug)) {
        const cached = entryDetailsCache.get(activeEntry.slug);
        if (cached && typeof cached === 'object') {
          cached.altText = savedText;
          cached.altTextSource = savedSource;
          if (cached.summary && typeof cached.summary === 'object') {
            cached.summary.altText = savedText;
            cached.summary.altTextSource = savedSource;
          }
          entryDetailsCache.set(activeEntry.slug, cached);
        }
      }

      const listEntry = allEntries.find(item => item.slug === activeEntry.slug);
      if (listEntry && typeof listEntry === 'object') {
        listEntry.altText = savedText;
        listEntry.altTextSource = savedSource;
      }

      updateAltTextNoteDisplay(savedSource);

      return {
        text: savedText,
        source: savedSource
      };
    }

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
        syncDialogDescriptionTargets();
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

      syncDialogDescriptionTargets();
    }

    function syncDialogDescriptionTargets() {
      const descriptionIds = [];
      if (!captionElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-caption');
      }
      if (descriptionSectionElement && !descriptionSectionElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-description');
      }
      if (!metaElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-meta');
      }
      if (descriptionIds.length) {
        dialog.setAttribute('aria-describedby', descriptionIds.join(' '));
      } else {
        dialog.removeAttribute('aria-describedby');
      }
    }

    function showDescriptionMessage(message, { state = 'info', hidden = false, empty = false } = {}) {
      if (!descriptionSectionElement || !descriptionContentElement) {
        return;
      }
      if (hidden) {
        descriptionSectionElement.setAttribute('hidden', '');
      } else {
        descriptionSectionElement.removeAttribute('hidden');
      }
      descriptionContentElement.dataset.state = state;
      if (empty) {
        descriptionContentElement.dataset.empty = 'true';
      } else {
        delete descriptionContentElement.dataset.empty;
      }
      descriptionContentElement.textContent = message;
      syncDialogDescriptionTargets();
    }

    function renderDescriptionContent(description) {
      if (!descriptionSectionElement || !descriptionContentElement) {
        return;
      }
      const text = typeof description === 'string' ? description.trim() : '';
      if (!text) {
        showDescriptionMessage('Ingen oppgavetekst er lagret for denne figuren.', {
          state: 'empty',
          hidden: false,
          empty: true
        });
        return;
      }
      descriptionSectionElement.removeAttribute('hidden');
      descriptionContentElement.dataset.state = 'ready';
      delete descriptionContentElement.dataset.empty;
      if (window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function') {
        const success = window.MathVisDescriptionRenderer.renderInto(descriptionContentElement, text);
        if (!success) {
          descriptionContentElement.textContent = text;
        }
      } else {
        descriptionContentElement.textContent = text;
      }
      syncDialogDescriptionTargets();
    }

    function ensureAltTextManager() {
      if (!window.MathVisAltText || !altTextEditorContainer || !altTextFigureElement) {
        return null;
      }
      if (altTextManager) {
        altTextManager.ensureDom();
        return altTextManager;
      }
      altTextManager = window.MathVisAltText.create({
        svg: () => altTextFigureElement,
        container: altTextEditorContainer,
        getTitle: () => {
          if (!activeEntry) {
            return 'Figur';
          }
          return activeEntry.displayTitle || activeEntry.title || activeEntry.baseName || 'Figur';
        },
        getState: () => {
          if (!activeEntry || !activeEntry.slug) {
            return { text: '', source: 'auto' };
          }
          const record = entryAltTextCache.get(activeEntry.slug) || { text: '', source: 'auto' };
          return {
            text: record.text || '',
            source: record.source === 'manual' ? 'manual' : 'auto'
          };
        },
        setState: (text, source) => {
          if (!activeEntry || !activeEntry.slug) {
            return;
          }
          const normalizedText = typeof text === 'string' ? text.trim() : '';
          const normalizedSource = source === 'manual' ? 'manual' : 'auto';
          const record = updateAltTextRecord(activeEntry.slug, current => {
            current.text = normalizedText;
            current.source = normalizedSource;
            return current;
          });
          activeEntry.altText = normalizedText;
          if (currentDetails && currentDetails.slug === activeEntry.slug) {
            currentDetails.altText = normalizedText;
            if (currentDetails.summary && typeof currentDetails.summary === 'object') {
              currentDetails.summary.altText = normalizedText;
              currentDetails.summary.altTextSource = normalizedSource;
            }
          }
          imageElement.alt = normalizedText || activeEntry.displayTitle || 'Forhåndsvisning';
          const cardImage = findCardPreviewImage(activeEntry.slug);
          if (cardImage) {
            cardImage.alt = normalizedText || `Forhåndsvisning av ${activeEntry.displayTitle || 'figur'}`;
          }
          updateAltTextNoteDisplay(normalizedSource);
          return record;
        },
        generate: () => {
          if (!activeEntry || !activeEntry.slug) {
            return '';
          }
          const record = entryAltTextCache.get(activeEntry.slug);
          return record && record.autoText ? record.autoText : '';
        },
        getAutoMessage: () => 'Alternativ tekst oppdatert automatisk.',
        getManualMessage: () => 'Alternativ tekst oppdatert manuelt.',
        getSignature: () => {
          if (!activeEntry || !activeEntry.slug) {
            return '';
          }
          const record = entryAltTextCache.get(activeEntry.slug);
          return record && record.signature ? record.signature : '';
        },
        save: (text, context) => {
          const source = context && typeof context.source === 'string' ? context.source : 'auto';
          return persistAltTextForActiveEntry(text, source).then(result => ({
            text: result.text,
            source: result.source,
            message: 'Alternativ tekst lagret.'
          }));
        }
      });
      return altTextManager;
    }

    function resolvePersistedAltTextState(entry, details) {
      const detailObject = details && typeof details === 'object' ? details : null;
      const summaryObject = detailObject && typeof detailObject.summary === 'object' ? detailObject.summary : null;

      const normalizeSource = (rawSource, text) => {
        const normalized = typeof rawSource === 'string' ? rawSource.trim().toLowerCase() : '';
        return normalized === 'manual' && text ? 'manual' : 'auto';
      };

      if (detailObject) {
        const detailText = typeof detailObject.altText === 'string' ? detailObject.altText.trim() : '';
        const detailSource = normalizeSource(detailObject.altTextSource, detailText);
        if (detailText || detailSource === 'manual') {
          return { text: detailText, source: detailSource, authoritative: true };
        }

        if (summaryObject) {
          const summaryText = typeof summaryObject.altText === 'string' ? summaryObject.altText.trim() : '';
          const summarySource = normalizeSource(summaryObject.altTextSource, summaryText);
          if (summaryText || summarySource === 'manual') {
            return { text: summaryText, source: summarySource, authoritative: true };
          }
        }

        return { text: '', source: 'auto', authoritative: true };
      }

      const entryText = entry && typeof entry.altText === 'string' ? entry.altText.trim() : '';
      const entrySource = normalizeSource(entry && entry.altTextSource, entryText);
      return { text: entryText, source: entrySource, authoritative: false };
    }

    function applyAltTextState(entry, details, { reason = 'auto', signatureOverride = undefined } = {}) {
      if (!entry || !entry.slug) {
        return;
      }
      const persisted = resolvePersistedAltTextState(entry, details);
      const record = ensureAltTextRecord(entry.slug, entry, details);
      if (!record) {
        return;
      }
      entry.altText = record.text;
      const manager = ensureAltTextManager();
      if (manager) {
        manager.ensureDom();
        if (typeof manager.markSaved === 'function') {
          if (persisted && persisted.authoritative) {
            manager.markSaved({ text: persisted.text, source: persisted.source });
          } else if (reason === 'init') {
            manager.markSaved({ text: record.text, source: record.source });
          }
        }
        const signatureValue = signatureOverride !== undefined ? signatureOverride : record.signature;
        if (record.source === 'manual') {
          manager.notifyFigureChange(signatureValue);
          manager.applyCurrent();
        } else {
          manager.refresh(reason, signatureValue);
        }
      }
      imageElement.alt = record.text || entry.displayTitle || 'Forhåndsvisning';
      const cardImage = findCardPreviewImage(entry.slug);
      if (cardImage) {
        cardImage.alt = record.text || `Forhåndsvisning av ${entry.displayTitle || 'figur'}`;
      }
      updateCaption(entry, details);
      updateAltTextNoteDisplay(record.source === 'manual' ? 'manual' : 'auto');
      syncDialogDescriptionTargets();
    }

    function updateDialog(entry) {
      activeEntry = entry;
      currentDetails = null;
      const token = ++pendingDetailsToken;
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

      updateCaption(entry, null);

      if (entry.pngUrl) {
        imageElement.src = entry.pngUrl;
      } else if (entry.svgUrl) {
        imageElement.src = entry.svgUrl;
      } else {
        imageElement.removeAttribute('src');
      }

      renderMeta(entry);
      syncDialogDescriptionTargets();

      updateAltTextNoteDisplay(entry.altTextSource === 'manual' ? 'manual' : 'auto');

      let cachedDetails = null;
      if (entry.slug && entryDetailsCache.has(entry.slug)) {
        cachedDetails = entryDetailsCache.get(entry.slug);
        currentDetails = cachedDetails;
      }

      if (cachedDetails && typeof cachedDetails.description === 'string') {
        renderDescriptionContent(cachedDetails.description);
      } else if (entry.slug) {
        showDescriptionMessage('Laster oppgavetekst …', { state: 'loading', hidden: false });
      } else {
        showDescriptionMessage('Ingen oppgavetekst er tilgjengelig for denne figuren.', {
          state: 'empty',
          hidden: false,
          empty: true
        });
      }

      updateCaption(entry, cachedDetails);

      applyAltTextState(entry, cachedDetails, { reason: 'init' });

      const hasSvg = Boolean(entry.svgUrl);
      const hasPng = Boolean(entry.pngUrl);
      const targetConfig = resolveEntryOpenTarget(entry);
      const hasExampleState = entry.exampleState != null;
      const canEdit = Boolean(targetConfig && hasExampleState);
      const canDownload = hasSvg || hasPng;

      for (const button of actionButtons) {
        const action = button.dataset.action;
        let isAvailable = true;

        switch (action) {
          case 'open-svg':
            isAvailable = hasSvg;
            break;
          case 'open-png':
            isAvailable = hasPng;
            break;
          case 'edit':
            isAvailable = canEdit;
            break;
          case 'download':
            isAvailable = canDownload;
            break;
          default:
            isAvailable = true;
            break;
        }

        if (!isAvailable) {
          button.disabled = true;
          button.setAttribute('aria-hidden', 'true');
        } else {
          button.disabled = false;
          button.removeAttribute('aria-hidden');
        }
      }

      if (!entry.slug) {
        return;
      }

      fetchEntryDetails(entry.slug, { fallback: entry })
        .then(details => {
          if (!details || !activeEntry || activeEntry.slug !== entry.slug || token !== pendingDetailsToken) {
            return;
          }
          currentDetails = details;
          if (typeof details.description === 'string' && details.description.trim()) {
            renderDescriptionContent(details.description);
          } else {
            showDescriptionMessage('Ingen oppgavetekst er lagret for denne figuren.', {
              state: 'empty',
              hidden: false,
              empty: true
            });
          }
          updateCaption(entry, details);
          applyAltTextState(entry, details, {
            reason: 'details-update',
            signatureOverride: computeAltTextSignature(entry, details)
          });
        })
        .catch(() => {
          if (!activeEntry || activeEntry.slug !== entry.slug || token !== pendingDetailsToken) {
            return;
          }
          const fallbackDetails = currentDetails || cachedDetails || null;
          const existing = currentDetails && typeof currentDetails.description === 'string'
            ? currentDetails.description.trim()
            : cachedDetails && typeof cachedDetails.description === 'string'
              ? cachedDetails.description.trim()
              : '';
          if (existing) {
            renderDescriptionContent(existing);
            updateCaption(entry, fallbackDetails);
            return;
          }
          showDescriptionMessage('Kunne ikke hente oppgaveteksten.', {
            state: 'error',
            hidden: false,
            empty: true
          });
          updateCaption(entry, fallbackDetails);
        });
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

  function sortEntries(entries, sortValue) {
    const list = Array.isArray(entries) ? entries.slice() : [];
    const value = typeof sortValue === 'string' && sortValue.trim() ? sortValue.trim() : 'newest';

    const compareNames = (a, b) => {
      const nameA = extractEntryName(a);
      const nameB = extractEntryName(b);
      if (nameCollator) {
        return nameCollator.compare(nameA, nameB);
      }
      return nameA.localeCompare(nameB || '', 'nb');
    };

    switch (value) {
      case 'oldest':
        return list.sort((a, b) => resolveEntryTimestamp(a) - resolveEntryTimestamp(b));
      case 'az':
        return list.sort(compareNames);
      case 'size':
        return list.sort((a, b) => resolveEntryFileSize(b) - resolveEntryFileSize(a));
      case 'newest':
      default:
        return list.sort((a, b) => resolveEntryTimestamp(b) - resolveEntryTimestamp(a));
    }
  }

  function render({ announceSort = false } = {}) {
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

    const sortValue = sortSelect ? sortSelect.value : 'newest';
    const sortedEntries = sortEntries(filteredEntries, sortValue);

    if (announceSort && sortSelect) {
      const selectedOption = sortSelect.options && sortSelect.selectedIndex >= 0
        ? sortSelect.options[sortSelect.selectedIndex]
        : null;
      const sortLabel = selectedOption && selectedOption.textContent
        ? selectedOption.textContent.trim()
        : '';
      setStatus(sortLabel ? `Sortering oppdatert: ${sortLabel}.` : 'Sortering oppdatert.');
    } else if (announceSort) {
      setStatus('Sortering oppdatert.');
    } else {
      setStatus('');
    }

    const fragment = document.createDocumentFragment();
    for (const entry of sortedEntries) {
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

  function extractArchiveMetadata(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const limitation = typeof payload.limitation === 'string' && payload.limitation.trim()
      ? payload.limitation.trim()
      : '';
    if (payload.metadata && typeof payload.metadata === 'object') {
      const metadata = { ...payload.metadata };
      if (limitation && typeof metadata.limitation !== 'string') {
        metadata.limitation = limitation;
      }
      return metadata;
    }
    if (limitation) {
      return { limitation };
    }
    return null;
  }

  function parseFileSizeLabel(label) {
    if (typeof label !== 'string') {
      return null;
    }
    const normalized = label.trim();
    if (!normalized) {
      return null;
    }
    const withSpaces = normalized.replace(/\u00A0/g, ' ');
    const match = withSpaces.match(/([0-9]+(?:[\s.,][0-9]+)*)\s*(bytes?|b|kb|kib|mb|mib|gb|gib)?/i);
    if (!match) {
      return null;
    }
    let numericText = match[1].replace(/\s+/g, '');
    const commaCount = (numericText.match(/,/g) || []).length;
    const dotCount = (numericText.match(/\./g) || []).length;
    if (commaCount > 1 && dotCount === 0) {
      numericText = numericText.replace(/,/g, '');
    } else if (dotCount > 1 && commaCount === 0) {
      numericText = numericText.replace(/\./g, '');
    } else if (commaCount === 1 && dotCount === 1) {
      numericText = numericText.replace(/\./g, '').replace(',', '.');
    } else {
      numericText = numericText.replace(/,/g, '.');
    }
    const numericValue = Number(numericText);
    if (!Number.isFinite(numericValue)) {
      return null;
    }
    const unit = match[2] ? match[2].toLowerCase() : '';
    let multiplier = 1;
    if (unit.startsWith('g')) {
      multiplier = 1024 * 1024 * 1024;
    } else if (unit.startsWith('m')) {
      multiplier = 1024 * 1024;
    } else if (unit.startsWith('k')) {
      multiplier = 1024;
    }
    return numericValue * multiplier;
  }

  function extractEntryName(entry) {
    if (!entry || typeof entry !== 'object') {
      return '';
    }
    const candidates = [entry.name, entry.displayTitle, entry.title, entry.baseName, entry.slug];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  }

  function resolveEntryTimestamp(entry) {
    if (!entry || typeof entry !== 'object') {
      return 0;
    }
    const direct = Number(entry.createdAtTime);
    if (Number.isFinite(direct)) {
      return direct;
    }
    const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : '';
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function resolveEntryFileSize(entry) {
    if (!entry || typeof entry !== 'object') {
      return Number.NEGATIVE_INFINITY;
    }
    const direct = Number(entry.fileSizeBytes);
    if (Number.isFinite(direct)) {
      return direct;
    }
    const legacy = Number(entry.fileSize);
    if (Number.isFinite(legacy)) {
      return legacy;
    }
    const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : null;
    if (metadata) {
      const metadataNumeric = Number(metadata.size ?? metadata.fileSize);
      if (Number.isFinite(metadataNumeric)) {
        return metadataNumeric;
      }
      const metadataLabel = typeof metadata.size === 'string'
        ? metadata.size
        : typeof metadata.fileSize === 'string'
          ? metadata.fileSize
          : '';
      const metadataParsed = parseFileSizeLabel(metadataLabel);
      if (metadataParsed !== null) {
        return metadataParsed;
      }
    }
    const parsedLabel = parseFileSizeLabel(entry.fileSizeLabel);
    if (parsedLabel !== null) {
      return parsedLabel;
    }
    return Number.NEGATIVE_INFINITY;
  }

  function normalizeEntryDetails(payload, fallback = {}) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const normalized = {};
    const slugCandidates = [payload.slug, fallback.slug, payload.svgSlug, payload.baseName];
    for (const candidate of slugCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        normalized.slug = candidate.trim();
        break;
      }
    }

    const fieldsToCopy = ['title', 'displayTitle', 'baseName', 'tool', 'createdAt', 'updatedAt', 'svgUrl', 'pngUrl'];
    fieldsToCopy.forEach(key => {
      if (typeof payload[key] === 'string' && payload[key].trim()) {
        normalized[key] = payload[key].trim();
      } else if (typeof fallback[key] === 'string' && fallback[key].trim()) {
        normalized[key] = fallback[key].trim();
      }
    });

    if (!normalized.tool && payload.metadata && typeof payload.metadata.tool === 'string') {
      normalized.tool = payload.metadata.tool.trim();
    }

    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    if (description) {
      normalized.description = description;
    }

    const altText = typeof payload.altText === 'string' ? payload.altText.trim() : '';
    if (altText) {
      normalized.altText = altText;
    }

    const altTextSource = typeof payload.altTextSource === 'string' ? payload.altTextSource.trim() : '';
    if (altTextSource) {
      normalized.altTextSource = altTextSource;
    }

    if (payload.exampleState !== undefined) {
      normalized.exampleState = payload.exampleState;
    }

    if (payload.metadata && typeof payload.metadata === 'object') {
      normalized.metadata = { ...payload.metadata };
    }

    if (payload.summary !== undefined) {
      if (typeof payload.summary === 'string') {
        normalized.summary = payload.summary.trim();
      } else if (payload.summary && typeof payload.summary === 'object') {
        const summaryCopy = { ...payload.summary };
        if (typeof summaryCopy.altText === 'string') {
          summaryCopy.altText = summaryCopy.altText.trim();
        }
        if (typeof summaryCopy.description === 'string') {
          summaryCopy.description = summaryCopy.description.trim();
        }
        if (typeof summaryCopy.text === 'string') {
          summaryCopy.text = summaryCopy.text.trim();
        }
        if (typeof summaryCopy.altTextSource === 'string') {
          summaryCopy.altTextSource = summaryCopy.altTextSource.trim();
        }
        normalized.summary = summaryCopy;
      }
    }

    return normalized;
  }

  async function fetchEntryDetails(slug, { forceRefresh = false, fallback = {} } = {}) {
    if (typeof slug !== 'string' || !slug.trim()) {
      return null;
    }

    const normalizedSlug = slug.trim();

    if (!forceRefresh && entryDetailsCache.has(normalizedSlug)) {
      return entryDetailsCache.get(normalizedSlug);
    }

    if (!forceRefresh && entryDetailsPending.has(normalizedSlug)) {
      return entryDetailsPending.get(normalizedSlug);
    }

    const pending = (async () => {
      try {
        const response = await fetch(`/api/svg?slug=${encodeURIComponent(normalizedSlug)}`, {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        const payload = await response.json();
        const details = normalizeEntryDetails(payload, fallback) || null;
        if (details) {
          entryDetailsCache.set(normalizedSlug, details);
        }
        return details;
      } finally {
        entryDetailsPending.delete(normalizedSlug);
      }
    })();

    entryDetailsPending.set(normalizedSlug, pending);
    return pending;
  }

  function determineAltTextSource(entry, details) {
    const candidates = [];
    if (details && typeof details.altTextSource === 'string') {
      candidates.push(details.altTextSource);
    }
    if (details && details.summary && typeof details.summary === 'object' && typeof details.summary.altTextSource === 'string') {
      candidates.push(details.summary.altTextSource);
    }
    if (details && details.metadata && typeof details.metadata.altTextSource === 'string') {
      candidates.push(details.metadata.altTextSource);
    }
    if (entry && typeof entry.altTextSource === 'string') {
      candidates.push(entry.altTextSource);
    }
    const resolved = candidates.find(value => typeof value === 'string' && value.trim());
    return resolved && resolved.trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
  }

  function determineAltTextCandidates(entry, details) {
    const candidates = [];
    const append = value => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          candidates.push(trimmed);
        }
      }
    };

    if (details) {
      append(details.altText);
      append(details.autoAltText);
      append(details.description);
      if (typeof details.summary === 'string') {
        append(details.summary);
      }
      if (details.summary && typeof details.summary === 'object') {
        append(details.summary.altText);
        append(details.summary.description);
        append(details.summary.text);
      }
    }

    if (entry) {
      append(entry.altText);
      append(entry.summary);
      append(entry.description);
      if (entry.displayTitle) {
        append(`Figuren «${entry.displayTitle}».`);
      }
    }

    append('SVG-figur.');
    return candidates;
  }

  function determineAutoAltText(entry, details) {
    const candidates = determineAltTextCandidates(entry, details);
    return candidates.length ? candidates[0] : '';
  }

  function computeAltTextSignature(entry, details) {
    const parts = [];
    if (details && typeof details.updatedAt === 'string' && details.updatedAt.trim()) {
      parts.push(details.updatedAt.trim());
    } else if (entry && typeof entry.updatedAt === 'string' && entry.updatedAt.trim()) {
      parts.push(entry.updatedAt.trim());
    }
    if (details && typeof details.summary === 'string') {
      parts.push(details.summary.trim());
    } else if (details && details.summary && typeof details.summary === 'object') {
      try {
        parts.push(JSON.stringify(details.summary));
      } catch (error) {}
    }
    if (details && typeof details.description === 'string' && details.description.trim()) {
      parts.push(details.description.trim());
    }
    if (!parts.length && entry && typeof entry.slug === 'string') {
      parts.push(entry.slug);
    }
    return parts.join('::');
  }

  function ensureAltTextRecord(slug, entry, details) {
    if (typeof slug !== 'string' || !slug.trim()) {
      return null;
    }
    const normalizedSlug = slug.trim();
    const existing = entryAltTextCache.get(normalizedSlug) || null;
    const autoText = determineAutoAltText(entry, details);
    const signature = computeAltTextSignature(entry, details);
    const sourceHint = determineAltTextSource(entry, details);
    const baseText = details && details.altText ? details.altText : entry && entry.altText ? entry.altText : autoText;

    if (!existing) {
      const record = {
        text: typeof baseText === 'string' ? baseText.trim() : '',
        source: sourceHint === 'manual' && baseText ? 'manual' : 'auto',
        autoText,
        signature
      };
      if (!record.text) {
        record.text = autoText;
        record.source = 'auto';
      }
      entryAltTextCache.set(normalizedSlug, record);
      return record;
    }

    existing.autoText = autoText;
    existing.signature = signature;
    if ((existing.source !== 'manual' || !existing.text) && baseText) {
      existing.text = typeof baseText === 'string' ? baseText.trim() : existing.text;
      existing.source = sourceHint === 'manual' && existing.text ? 'manual' : existing.source;
    }
    if (!existing.text) {
      existing.text = autoText;
      existing.source = 'auto';
    }
    entryAltTextCache.set(normalizedSlug, existing);
    return existing;
  }

  function updateAltTextRecord(slug, updater) {
    if (typeof slug !== 'string' || !slug.trim() || typeof updater !== 'function') {
      return null;
    }
    const normalizedSlug = slug.trim();
    const current = entryAltTextCache.get(normalizedSlug) || { text: '', source: 'auto', autoText: '', signature: '' };
    const next = updater({ ...current }) || current;
    entryAltTextCache.set(normalizedSlug, next);
    return next;
  }

  function escapeSelectorValue(value) {
    if (typeof value !== 'string') {
      return '';
    }
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/(["\\])/g, '\\$1');
  }

  function findCardPreviewImage(slug) {
    if (!grid || typeof slug !== 'string' || !slug.trim()) {
      return null;
    }
    const escaped = escapeSelectorValue(slug.trim());
    if (!escaped) {
      return null;
    }
    const selector = `[data-svg-item="${escaped}"] img`;
    const node = grid.querySelector(selector);
    return node instanceof HTMLImageElement ? node : null;
  }

  function normalizeArchiveEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
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

        const entryName = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : '';
        const createdAtValue =
          typeof entry.createdAt === 'string' && entry.createdAt.trim()
            ? entry.createdAt.trim()
            : typeof entry.updatedAt === 'string'
              ? entry.updatedAt.trim()
              : '';

        const normalizedEntry = {
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
          createdAt: createdAtValue,
          name: entryName,
          summary,
          sequenceLabel,
          fileSizeLabel
        };

        if (Object.prototype.hasOwnProperty.call(entry, 'exampleState')) {
          normalizedEntry.exampleState = entry.exampleState;
        }

        if (!normalizedEntry.name) {
          normalizedEntry.name = normalizedEntry.displayTitle || normalizedEntry.title || normalizedEntry.baseName || normalizedEntry.slug || '';
        }

        const sizeBytes =
          typeof fileSizeValue === 'number' && Number.isFinite(fileSizeValue)
            ? fileSizeValue
            : parseFileSizeLabel(fileSizeLabel);
        if (Number.isFinite(sizeBytes)) {
          normalizedEntry.fileSizeBytes = sizeBytes;
        }

        normalizedEntry.createdAtTime = Date.parse(createdAtValue) || 0;

        return normalizedEntry;
      })
      .filter(entry => entry.slug && entry.svgUrl);
  }

  function applyArchiveEntries(entries, metadata) {
    allEntries = Array.isArray(entries) ? entries.slice() : [];

    allEntries.forEach(entry => {
      if (!entry || !entry.slug) {
        return;
      }
      const cachedDetails = entryDetailsCache.get(entry.slug) || null;
      ensureAltTextRecord(entry.slug, entry, cachedDetails);
    });

    updateFilterOptions();
    applyStorageNote(metadata);
    render();
  }

  async function loadEntries() {
    const cached = readArchiveCache();
    const hasCachedEntries = Boolean(cached && Array.isArray(cached.entries));
    if (hasCachedEntries) {
      applyArchiveEntries(cached.entries, cached.metadata);
    }

    setBusy(true);
    setStatus(hasCachedEntries ? 'Oppdaterer arkivet …' : 'Laster arkivet …');

    try {
      const response = await fetch('/api/svg', { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Uventet svar: ${response.status}`);
      }
      const payload = await response.json();
      const metadata = extractArchiveMetadata(payload);
      const normalizedEntries = normalizeArchiveEntries(payload.entries);
      applyArchiveEntries(normalizedEntries, metadata);
      writeArchiveCache({ entries: allEntries, metadata, timestamp: Date.now() });
    } catch (error) {
      console.error('Kunne ikke laste arkivet', error);
      if (hasCachedEntries) {
        setStatus('Viser hurtigbufret arkiv. Klarte ikke å oppdatere akkurat nå.', 'warning');
      } else {
        setStatus('Klarte ikke å hente arkivet akkurat nå. Prøv igjen senere.', 'error');
        grid.innerHTML = '';
        if (storageNote) {
          storageNote.hidden = true;
          storageNote.textContent = '';
        }
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

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      render({ announceSort: true });
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

  function rememberMainMenuTarget(targetConfig) {
    if (!targetConfig) {
      return false;
    }

    const navHref = typeof targetConfig.navHref === 'string' ? targetConfig.navHref.trim() : '';
    if (!navHref) {
      return false;
    }

    const storage = getLocalStorage();
    if (!storage) {
      return false;
    }

    try {
      storage.setItem('currentPage', navHref);
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveMainMenuUrl() {
    try {
      const url = new URL('index.html', window.location.href);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (error) {
      return 'index.html';
    }
  }

  function getMainMenuOpenUrl(targetConfig) {
    const remembered = rememberMainMenuTarget(targetConfig);
    if (!remembered) {
      return null;
    }
    return resolveMainMenuUrl();
  }

  async function performEntryAction(action, entry, helpers = {}) {
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    try {
      switch (action) {
        case 'open-svg':
        case 'open-png': {
          const isSvg = action === 'open-svg';
          const url = isSvg ? entry.svgUrl : entry.pngUrl;
          if (!url) {
            setStatus(isSvg ? 'Fant ikke SVG-adressen for figuren.' : 'Fant ikke PNG-adressen for figuren.', 'error');
            return;
          }

          const popup = window.open(url, '_blank', 'noopener');
          if (popup) {
            setStatus(isSvg ? 'Åpner SVG i ny fane.' : 'Åpner PNG i ny fane.', 'success');
          } else {
            setStatus('Klarte ikke å åpne figuren. Tillat sprettoppvinduer og prøv igjen.', 'error');
          }
          break;
        }
        case 'edit': {
          const targetConfig = resolveEntryOpenTarget(entry);
          const exampleState = entry.exampleState;
          const hasExampleState = exampleState != null;
          const hasTarget = Boolean(targetConfig && targetConfig.url && targetConfig.storagePath);

          if (!hasTarget || !hasExampleState) {
            setStatus('Figuren kan ikke redigeres i dette verktøyet.', 'error');
            return;
          }

          const slug = entry.slug || entry.svgSlug || entry.baseName || '';
          const title = entry.displayTitle || entry.title || entry.baseName || slug || 'Figur';
          const toolLabel = (entry.tool && entry.tool.trim()) || targetConfig.displayName || 'verktøyet';
          const requestId = generateArchiveRequestId(entry);

          const openRequest = {
            id: requestId,
            requestId,
            referenceId: requestId,
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

          let prepared = false;
          try {
            if (window.MathVisExamples && typeof window.MathVisExamples.prepareOpenRequest === 'function') {
              window.MathVisExamples.prepareOpenRequest(openRequest);
              prepared = true;
            }
          } catch (error) {
            console.error('Kunne ikke forberede åpning av eksempel via MathVisExamples', error);
          }
          if (!prepared) {
            try {
              const fallbackRequest = prepareArchiveOpenRequestFallback(openRequest);
              prepared = !!fallbackRequest;
              if (!prepared) {
                try {
                  console.error('Kunne ikke lagre åpningstilstanden for figuren via reserve-løsningen.');
                } catch (_) {}
              }
            } catch (error) {
              console.error('Kunne ikke lagre åpningstilstand for arkivet', error);
            }
          }

          if (!prepared) {
            setStatus('Kunne ikke lagre åpningstilstanden for figuren.', 'error');
            return;
          }

          let targetUrl = targetConfig.url;
          let launchedViaMainMenu = false;
          const mainMenuUrl = getMainMenuOpenUrl(targetConfig);
          if (mainMenuUrl) {
            targetUrl = mainMenuUrl;
            launchedViaMainMenu = true;
          }

          const popup = window.open(targetUrl, '_blank', 'noopener');
          if (popup) {
            const successMessage = launchedViaMainMenu
              ? `Figuren åpnes i ${toolLabel} via hovedmenyen med et midlertidig eksempel.`
              : `Figuren åpnes i ${toolLabel} med et midlertidig eksempel.`;
            setStatus(successMessage, 'success');
          } else {
            setStatus('Klarte ikke å åpne verktøyet. Tillat sprettoppvinduer og prøv igjen.', 'error');
          }
          break;
        }
        case 'download': {
          const preferSvg = Boolean(entry.svgUrl);
          const url = preferSvg ? entry.svgUrl : entry.pngUrl;
          if (!url) {
            setStatus('Fant ikke nedlastingslenken for figuren.', 'error');
            return;
          }

          const link = document.createElement('a');
          link.href = url;
          const fallbackName = `${entry.slug || 'figur'}${preferSvg ? '.svg' : '.png'}`;
          link.download = preferSvg
            ? (entry.svgSlug || `${entry.baseName || entry.slug || 'figur'}.svg`)
            : (entry.pngSlug || `${entry.baseName || entry.slug || 'figur'}.png`);
          if (!link.download) {
            link.download = fallbackName;
          }
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setStatus(preferSvg ? 'Starter nedlasting av SVG.' : 'Starter nedlasting av PNG.', 'success');
          break;
        }
        case 'delete': {
          const confirmed = window.confirm(`Er du sikker på at du vil slette «${entry.displayTitle}»?`);
          if (!confirmed) {
            return;
          }

          const response = await fetch(`/api/svg?slug=${encodeURIComponent(entry.slug)}`, { method: 'DELETE' });
          if (!response.ok) {
            throw new Error(`Uventet svar: ${response.status}`);
          }

          allEntries = allEntries.filter(item => item.slug !== entry.slug);
          entryDetailsCache.delete(entry.slug);
          entryAltTextCache.delete(entry.slug);
          render();
          setStatus('Figur slettet.', 'success');
          helpers.close?.({ returnFocus: false });
          return;
        }
        default:
          break;
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
