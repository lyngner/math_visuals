(function(){
  const key = 'examples_' + location.pathname;
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let tabsContainer = null;
  let tabButtons = [];
  let defaultEnsureScheduled = false;
  let tabsHostCard = null;

  const hasUrlOverrides = (() => {
    if(typeof URLSearchParams === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    for(const key of search.keys()){
      if(key === 'example') continue;
      if(/^fun\d+$/i.test(key) || /^dom\d+$/i.test(key)) return true;
      switch(key){
        case 'coords':
        case 'points':
        case 'startx':
        case 'screen':
        case 'xName':
        case 'yName':
        case 'pan':
        case 'q1':
        case 'lock':
          return true;
        default:
          break;
      }
    }
    return false;
  })();
  if(hasUrlOverrides){
    initialLoadPerformed = true;
  }
  function getExamples(){
    try{ return JSON.parse(localStorage.getItem(key)) || []; }
    catch{ return []; }
  }
  function store(examples){
    localStorage.setItem(key, JSON.stringify(examples));
  }
  const BINDING_NAMES = ['STATE','CFG','CONFIG','SIMPLE'];

  function flushPendingChanges(){
    const fields = document.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      ['input', 'change'].forEach(type => {
        try{
          field.dispatchEvent(new Event(type, {bubbles:true}));
        }catch(_){ }
      });
    });
    const syncFns = ['applyCfg', 'applyConfig'];
    syncFns.forEach(name => {
      const fn = window[name];
      if(typeof fn === 'function'){
        try{ fn(); }
        catch(_){ }
      }
    });
  }

  function ensureTabStyles(){
    if(document.getElementById('exampleTabStyles')) return;
    const style = document.createElement('style');
    style.id = 'exampleTabStyles';
    style.textContent = `
.example-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;margin-bottom:0;align-items:flex-end;padding-bottom:0;}
.example-tab{appearance:none;border:1px solid #d1d5db;border-bottom:none;background:#f3f4f6;color:#374151;border-radius:10px 10px 0 0;padding:6px 14px;font-size:14px;line-height:1;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s;box-shadow:0 -1px 0 rgba(15,23,42,.08) inset;margin-bottom:-1px;}
.example-tab:hover{background:#e5e7eb;}
.example-tab.is-active{background:#fff;color:#111827;border-color:var(--purple,#5B2AA5);border-bottom:1px solid #fff;box-shadow:0 -2px 0 var(--purple,#5B2AA5) inset;}
.example-tab:focus-visible{outline:2px solid var(--purple,#5B2AA5);outline-offset:2px;}
.example-tabs-empty{font-size:13px;color:#6b7280;padding:6px 0;}
.card-has-settings .example-settings{margin-top:6px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:10px;}
.card-has-settings .example-settings > h2:first-child{margin-top:0;}
.card-has-settings .example-tabs{margin-bottom:-6px;}
`;
    document.head.appendChild(style);
  }

  function adjustTabsSpacing(){
    if(!tabsContainer || !tabsHostCard) return;
    if(!tabsHostCard.isConnected){
      tabsHostCard = null;
      tabsContainer.style.removeProperty('margin-bottom');
      return;
    }
    if(!tabsHostCard.classList.contains('card-has-settings')){
      tabsContainer.style.removeProperty('margin-bottom');
      return;
    }
    let gapValue = '';
    try{
      const styles = window.getComputedStyle(tabsHostCard);
      gapValue = styles.getPropertyValue('row-gap');
      if(!gapValue || gapValue === '0px' || gapValue === 'normal'){
        gapValue = styles.getPropertyValue('gap');
      }
    }catch(_){ }
    if(gapValue){
      gapValue = gapValue.trim();
    }
    if(gapValue && gapValue !== '0px' && gapValue !== 'normal'){
      const match = gapValue.match(/^(-?\d*\.?\d+)(.*)$/);
      if(match){
        const numeric = Number.parseFloat(match[1]);
        if(Number.isFinite(numeric)){
          const unit = match[2].trim() || 'px';
          tabsContainer.style.marginBottom = `${numeric * -1}${unit}`;
          return;
        }
      }
      if(!gapValue.startsWith('-')){
        tabsContainer.style.marginBottom = `-${gapValue}`;
        return;
      }
      tabsContainer.style.marginBottom = gapValue;
      return;
    }
    tabsContainer.style.marginBottom = '-6px';
  }

  function moveSettingsIntoExampleCard(){
    if(!toolbar) return;
    const exampleCard = toolbar.closest('.card');
    if(!exampleCard) return;
    tabsHostCard = exampleCard;
    if(exampleCard.classList.contains('card-has-settings')){
      adjustTabsSpacing();
      return;
    }
    let candidate = exampleCard.nextElementSibling;
    let settingsCard = null;
    while(candidate){
      if(candidate.nodeType !== Node.ELEMENT_NODE){
        candidate = candidate.nextElementSibling;
        continue;
      }
      if(!candidate.classList.contains('card')){
        candidate = candidate.nextElementSibling;
        continue;
      }
      if(candidate.classList.contains('card--settings') || candidate.getAttribute('data-card') === 'settings'){
        settingsCard = candidate;
        break;
      }
      const heading = candidate.querySelector(':scope > h2');
      const text = heading ? heading.textContent.trim().toLowerCase() : '';
      if(text === 'innstillinger' || text === 'innstilling'){
        settingsCard = candidate;
        break;
      }
      candidate = candidate.nextElementSibling;
    }

    if(!settingsCard){
      adjustTabsSpacing();
      return;
    }

    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = 'example-settings';
    while(settingsCard.firstChild){
      settingsWrapper.appendChild(settingsCard.firstChild);
    }
    exampleCard.appendChild(settingsWrapper);
    settingsCard.remove();
    exampleCard.classList.add('card-has-settings');
    adjustTabsSpacing();
  }

  function getBinding(name){
    if(name in window && window[name]) return window[name];
    try{
      switch(name){
        case 'STATE':
          return (typeof STATE !== 'undefined' && STATE) ? STATE : undefined;
        case 'CFG':
          return (typeof CFG !== 'undefined' && CFG) ? CFG : undefined;
        case 'CONFIG':
          return (typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG : undefined;
        case 'SIMPLE':
          return (typeof SIMPLE !== 'undefined' && SIMPLE) ? SIMPLE : undefined;
        default:
          return undefined;
      }
    }catch{
      return undefined;
    }
  }

  function cloneValue(value){
    if(value == null) return value;
    try{
      return JSON.parse(JSON.stringify(value));
    }catch{
      return value;
    }
  }

  function sanitizeProvidedExample(example, idx){
    if(!example || typeof example !== 'object') return null;
    const sourceConfig = example.config;
    if(!sourceConfig || typeof sourceConfig !== 'object') return null;
    const config = {};
    for(const name of BINDING_NAMES){
      if(sourceConfig[name] != null){
        config[name] = cloneValue(sourceConfig[name]);
      }
    }
    if(Object.keys(config).length === 0) return null;
    const sanitized = {config};
    if(typeof example.svg === 'string') sanitized.svg = example.svg;
    if(typeof example.title === 'string') sanitized.title = example.title;
    if(typeof example.description === 'string') sanitized.description = example.description;
    if(typeof example.exampleNumber === 'string' || typeof example.exampleNumber === 'number'){
      sanitized.exampleNumber = String(example.exampleNumber).trim();
    }else if(typeof example.label === 'string'){
      sanitized.exampleNumber = example.label.trim();
    }
    if(example.isDefault === true) sanitized.isDefault = true;
    if(typeof example.id === 'string' && example.id.trim().length){
      sanitized.__builtinKey = example.id.trim();
    }else{
      sanitized.__builtinKey = `provided-${idx}`;
    }
    return sanitized;
  }

  function getProvidedExamples(){
    if(typeof window === 'undefined') return [];
    const provided = window.DEFAULT_EXAMPLES;
    if(!Array.isArray(provided)) return [];
    const sanitized = [];
    provided.forEach((ex, idx)=>{
      const normalized = sanitizeProvidedExample(ex, idx);
      if(normalized) sanitized.push(normalized);
    });
    if(sanitized.length > 0 && !sanitized.some(ex => ex.isDefault)){
      sanitized[0].isDefault = true;
    }
    return sanitized;
  }

  function replaceContents(target, source){
    if(!target || source == null) return false;
    if(Array.isArray(target) && Array.isArray(source)){
      target.length = 0;
      target.push(...source);
      return true;
    }
    if(typeof target === 'object' && typeof source === 'object'){
      Object.keys(target).forEach(key => {
        if(!Object.prototype.hasOwnProperty.call(source, key)) delete target[key];
      });
      Object.assign(target, source);
      return true;
    }
    return false;
  }

  function applyBinding(name, value){
    if(value == null) return;
    const target = getBinding(name);
    if(replaceContents(target, value)){
      if(name in window && window[name] !== target){
        window[name] = target;
      }
      return;
    }
    const winVal = name in window ? window[name] : undefined;
    if(replaceContents(winVal, value)) return;
    window[name] = Array.isArray(value) ? value.slice() : (typeof value === 'object' ? {...value} : value);
  }

  function triggerRefresh(index){
    const tried = new Set();
    const candidates = ['render','renderAll','draw','drawAll','update','updateAll','init','initAll','initFromCfg','initFromHtml','refresh','redraw','rerender','recalc','applyCfg','applyConfig','applyState','setup','rebuild'];
    for(const name of candidates){
      const fn = window[name];
      if(typeof fn === 'function' && !tried.has(fn)){
        try{ fn(); }
        catch(_){}
        tried.add(fn);
      }
    }
    let dispatched = false;
    if(typeof CustomEvent === 'function'){
      try{
        window.dispatchEvent(new CustomEvent('examples:loaded', {detail:{index}}));
        dispatched = true;
      }catch(_){ }
    }
    if(!dispatched){
      try{ window.dispatchEvent(new Event('examples:loaded')); }
      catch(_){ }
    }
  }

  function collectConfig(){
    flushPendingChanges();
    const collectionDetail = {svgOverride:null};
    try{
      if(typeof window !== 'undefined' && window){
        let evt;
        if(typeof CustomEvent === 'function'){
          evt = new CustomEvent('examples:collect', {detail:collectionDetail});
        }else{
          evt = new Event('examples:collect');
          try{ evt.detail = collectionDetail; }
          catch(_){ }
        }
        window.dispatchEvent(evt);
      }
    }catch(_){
      try{
        const evt = new Event('examples:collect');
        try{ evt.detail = collectionDetail; }
        catch(_){ }
        window.dispatchEvent(evt);
      }
      catch(_){ }
    }
    const cfg = {};
    for(const name of BINDING_NAMES){
      const binding = getBinding(name);
      if(binding != null && typeof binding !== 'function'){
        cfg[name] = cloneValue(binding);
      }
    }
    let svgMarkup = '';
    if(collectionDetail.svgOverride != null){
      if(typeof collectionDetail.svgOverride === 'string') svgMarkup = collectionDetail.svgOverride;
      else if(collectionDetail.svgOverride && typeof collectionDetail.svgOverride.outerHTML === 'string'){
        svgMarkup = collectionDetail.svgOverride.outerHTML;
      }
    }
    if(!svgMarkup){
      const svg = document.querySelector('svg');
      svgMarkup = svg ? svg.outerHTML : '';
    }
    return {config: cfg, svg: svgMarkup};
  }

  function loadExample(index){
    const examples = getExamples();
    const ex = examples[index];
    if(!ex || !ex.config) return false;
    const cfg = ex.config;
    let applied = false;
    for(const name of BINDING_NAMES){
      if(cfg[name] != null){
        applyBinding(name, cfg[name]);
        applied = true;
      }
    }
    if(applied){
      currentExampleIndex = index;
      updateTabSelection();
      triggerRefresh(index);
    }
    return applied;
  }

  function updateTabSelection(){
    if(!tabsContainer || !Array.isArray(tabButtons)) return;
    tabButtons.forEach((btn, idx)=>{
      if(!btn) return;
      const isActive = idx === currentExampleIndex;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    });
  }
  // Load example if viewer requested
  (function(){
    if(hasUrlOverrides) return;
    const loadInfo = localStorage.getItem('example_to_load');
    if(!loadInfo) return;
    try{
      const {path, index} = JSON.parse(loadInfo);
      if(path === location.pathname){
        if(loadExample(index)) initialLoadPerformed = true;
      }
    }catch{}
    localStorage.removeItem('example_to_load');
  })();

  const saveBtn = document.getElementById('btnSaveExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if(!saveBtn && !deleteBtn) return;

  ensureTabStyles();

  const toolbar = saveBtn?.parentElement || deleteBtn?.parentElement;
  tabsContainer = document.createElement('div');
  tabsContainer.id = 'exampleTabs';
  tabsContainer.className = 'example-tabs';
  tabsContainer.setAttribute('role', 'tablist');
  tabsContainer.setAttribute('aria-orientation', 'horizontal');
  tabsContainer.setAttribute('aria-label', 'Lagrede eksempler');
  const toolbarParent = toolbar?.parentElement || toolbar;
  if(toolbarParent){
    if(toolbar?.nextSibling){
      toolbarParent.insertBefore(tabsContainer, toolbar.nextSibling);
    }else{
      toolbarParent.appendChild(tabsContainer);
    }
  }else{
    document.body.appendChild(tabsContainer);
  }

  moveSettingsIntoExampleCard();
  window.addEventListener('resize', adjustTabsSpacing);

  function updateDeleteButtonState(count){
    if(deleteBtn) deleteBtn.disabled = count <= 1;
  }

  const requestedInitialIndex = parseInitialExampleIndex();

  function attemptInitialLoad(){
    if(initialLoadPerformed) return;
    if(requestedInitialIndex == null) return;
    const examples = getExamples();
    if(requestedInitialIndex < 0 || requestedInitialIndex >= examples.length) return;
    const loadNow = ()=>{
      if(initialLoadPerformed) return;
      if(loadExample(requestedInitialIndex)) initialLoadPerformed = true;
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNow, {once:true});
    else setTimeout(loadNow, 0);
  }

  function renderOptions(){
    const examples = getExamples();
    if(examples.length === 0){
      currentExampleIndex = null;
    }else if(currentExampleIndex == null || currentExampleIndex >= examples.length){
      const fallback = currentExampleIndex == null ? 0 : examples.length - 1;
      currentExampleIndex = Math.min(examples.length - 1, Math.max(0, fallback));
    }

    if(tabsContainer){
      tabsContainer.innerHTML = '';
      tabButtons = [];
      if(examples.length === 0){
        const empty = document.createElement('div');
        empty.className = 'example-tabs-empty';
        empty.textContent = 'Ingen eksempler';
        tabsContainer.appendChild(empty);
      }else{
        examples.forEach((ex, idx)=>{
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-tab';
          let label = String(idx + 1);
          if(ex && typeof ex.exampleNumber === 'string' && ex.exampleNumber.trim()){
            label = ex.exampleNumber.trim();
          }
          btn.textContent = label;
          btn.dataset.exampleIndex = String(idx);
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-label', `Eksempel ${label}`);
          btn.addEventListener('click', ()=>{
            loadExample(idx);
          });
          btn.addEventListener('keydown', (event)=>{
            if(event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            if(!tabButtons.length) return;
            const dir = event.key === 'ArrowRight' ? 1 : -1;
            const total = tabButtons.length;
            let next = idx;
            do{
              next = (next + dir + total) % total;
            }while(next !== idx && !tabButtons[next]);
            loadExample(next);
            tabButtons[next]?.focus();
          });
          tabsContainer.appendChild(btn);
          tabButtons.push(btn);
        });
        updateTabSelection();
      }
    }
    updateDeleteButtonState(examples.length);
    attemptInitialLoad();

    if(!initialLoadPerformed && examples.length > 0){
      let idx = Number.isInteger(currentExampleIndex) ? currentExampleIndex : 0;
      if(idx < 0) idx = 0;
      if(idx >= examples.length) idx = examples.length - 1;
      if(loadExample(idx)) initialLoadPerformed = true;
    }
  }

  saveBtn?.addEventListener('click', async ()=>{
    const examples = getExamples();
    const ex = collectConfig();
    examples.push(ex);
    store(examples);
    currentExampleIndex = examples.length - 1;
    renderOptions();
    alert('Eksempel lagret');

    // Also offer download of the example as a JS file
    try{
      const lines = [];
      const cfg = ex.config || {};
      if(cfg.STATE)  lines.push(`window.STATE=${JSON.stringify(cfg.STATE)};`);
      if(cfg.CFG)    lines.push(`window.CFG=${JSON.stringify(cfg.CFG)};`);
      if(cfg.CONFIG) lines.push(`window.CONFIG=${JSON.stringify(cfg.CONFIG)};`);
      if(cfg.SIMPLE) lines.push(`window.SIMPLE=${JSON.stringify(cfg.SIMPLE)};`);

      // Include all external scripts in the downloaded file
      const scripts = Array.from(document.querySelectorAll('script[src]'))
        .filter(s => !s.src.endsWith('examples.js'));
      for(const s of scripts){
        try{
          const res = await fetch(s.src);
          const txt = await res.text();
          lines.push(`// Source: ${s.src}`);
          lines.push(txt);
        }catch{}
      }

      const blob = new Blob([lines.join('\n')], {type:'application/javascript'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const base = location.pathname.split('/').pop().replace(/\.html$/,'');
      a.download = `${base}-example-${examples.length}.js`;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
      }, 1000);
    }catch{}
  });
  deleteBtn?.addEventListener('click', ()=>{
    const examples = getExamples();
    if(examples.length <= 1){
      return;
    }

    let indexToRemove = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
    if(!Number.isInteger(indexToRemove)){
      const activeTab = tabsContainer?.querySelector('.example-tab.is-active');
      const parsed = activeTab ? Number(activeTab.dataset.exampleIndex) : NaN;
      if(Number.isInteger(parsed)) indexToRemove = parsed;
    }
    if(!Number.isInteger(indexToRemove)){
      indexToRemove = examples.length - 1;
    }
    indexToRemove = Math.max(0, Math.min(examples.length - 1, indexToRemove));

    examples.splice(indexToRemove, 1);

    examples.forEach((ex, idx)=>{
      if(!ex || typeof ex !== 'object') return;
      if(idx === 0){
        ex.isDefault = true;
      }else if(Object.prototype.hasOwnProperty.call(ex, 'isDefault')){
        delete ex.isDefault;
      }
    });

    store(examples);

    if(examples.length === 0){
      currentExampleIndex = null;
    }else if(indexToRemove >= examples.length){
      currentExampleIndex = examples.length - 1;
    }else{
      currentExampleIndex = indexToRemove;
    }

    renderOptions();
    if(currentExampleIndex != null && currentExampleIndex >= 0 && examples.length > 0){
      loadExample(currentExampleIndex);
    }
    alert('Eksempel slettet');
  });

  renderOptions();

  function parseInitialExampleIndex(){
    const parseValue = (value)=>{
      if(value == null) return null;
      const num = Number(value);
      if(!Number.isFinite(num) || !Number.isInteger(num)) return null;
      if(num > 0) return num - 1;
      if(num === 0) return 0;
      return null;
    };
    if(typeof URLSearchParams !== 'undefined'){
      const search = new URLSearchParams(window.location.search);
      const fromSearch = parseValue(search.get('example'));
      if(fromSearch != null) return fromSearch;
    }
    const hashMatch = window.location.hash && window.location.hash.match(/example=([0-9]+)/i);
    if(hashMatch) return parseValue(hashMatch[1]);
    return null;
  }

  function ensureDefaultExample(){
    if(defaultEnsureScheduled) return;
    defaultEnsureScheduled = true;
    const ensure = ()=>{
      let examples = getExamples();
      let updated = false;

      const firstValidIndex = examples.findIndex(ex => ex && typeof ex === 'object');
      if(firstValidIndex === -1){
        if(examples.length){
          examples = [];
          updated = true;
        }
      }else if(firstValidIndex > 0){
        examples = examples.slice(firstValidIndex);
        if(Number.isInteger(currentExampleIndex)){
          currentExampleIndex = Math.max(0, currentExampleIndex - firstValidIndex);
        }
        updated = true;
      }

      const providedDefaults = getProvidedExamples();
      if(examples.length === 0){
        if(providedDefaults.length > 0){
          let defaultIdx = providedDefaults.findIndex(ex => ex.isDefault);
          if(defaultIdx < 0) defaultIdx = 0;
          examples = providedDefaults.map((ex, idx)=>{
            const copy = {
              config: cloneValue(ex.config),
              svg: typeof ex.svg === 'string' ? ex.svg : ''
            };
            if(ex.__builtinKey) copy.__builtinKey = ex.__builtinKey;
            if(ex.title) copy.title = ex.title;
            if(ex.description) copy.description = ex.description;
            if(ex.exampleNumber) copy.exampleNumber = ex.exampleNumber;
            if(idx === defaultIdx){
              copy.isDefault = true;
            }
            return copy;
          });
          currentExampleIndex = Math.min(Math.max(defaultIdx, 0), examples.length - 1);
          updated = true;
        }else{
          const defaultExample = collectConfig();
          defaultExample.isDefault = true;
          examples = [defaultExample];
          currentExampleIndex = 0;
          updated = true;
        }
      }else{
        const first = examples[0];
        if(first.isDefault !== true){
          first.isDefault = true;
          updated = true;
        }
        for(let i = 1; i < examples.length; i++){
          const ex = examples[i];
          if(ex && typeof ex === 'object' && Object.prototype.hasOwnProperty.call(ex, 'isDefault')){
            delete ex.isDefault;
            updated = true;
          }
        }
        const hasCustomExamples = examples.some(ex => ex && typeof ex === 'object' && typeof ex.__builtinKey !== 'string');

        if(providedDefaults.length > 0 && !hasCustomExamples){
          const existingKeys = new Set();
          examples.forEach(ex => {
            if(ex && typeof ex.__builtinKey === 'string'){ existingKeys.add(ex.__builtinKey); }
          });
          let appended = false;
          providedDefaults.forEach(ex => {
            const key = ex.__builtinKey;
            if(key && existingKeys.has(key)) return;
            const copy = {
              config: cloneValue(ex.config),
              svg: typeof ex.svg === 'string' ? ex.svg : ''
            };
            if(key) copy.__builtinKey = key;
            if(ex.title) copy.title = ex.title;
            if(ex.description) copy.description = ex.description;
            if(ex.exampleNumber) copy.exampleNumber = ex.exampleNumber;
            examples.push(copy);
            if(key) existingKeys.add(key);
            appended = true;
          });
          if(appended) updated = true;
        }
      }

      if(updated){
        store(examples);
        examples = getExamples();
      }

      if(currentExampleIndex == null && examples.length > 0){
        currentExampleIndex = 0;
      }
      if(currentExampleIndex != null && examples.length > 0){
        const maxIdx = examples.length - 1;
        currentExampleIndex = Math.min(Math.max(currentExampleIndex, 0), maxIdx);
      }
      renderOptions();

      if(!initialLoadPerformed){
        const refreshed = getExamples();
        if(refreshed.length > 0){
          let targetIndex = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
          if(!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= refreshed.length){
            targetIndex = refreshed.findIndex(ex => ex && ex.isDefault === true);
          }
          if(!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= refreshed.length){
            targetIndex = 0;
          }
          if(loadExample(targetIndex)){
            initialLoadPerformed = true;
          }
        }
      }
    };
    if(document.readyState === 'complete') setTimeout(ensure, 0);
    else window.addEventListener('load', ensure, {once:true});
  }

  ensureDefaultExample();
})();
