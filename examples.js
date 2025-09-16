(function(){
  const key = 'examples_' + location.pathname;
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let tabsContainer = null;
  let tabButtons = [];
  let defaultEnsureScheduled = false;
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
.example-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;margin-bottom:0;align-items:flex-end;border-bottom:1px solid #e5e7eb;padding-bottom:0;}
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

  function moveSettingsIntoExampleCard(){
    if(!toolbar) return;
    const exampleCard = toolbar.closest('.card');
    if(!exampleCard || exampleCard.classList.contains('card-has-settings')) return;
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
      const heading = candidate.querySelector(':scope > h2');
      const text = heading ? heading.textContent.trim().toLowerCase() : '';
      if(text === 'innstillinger'){
        settingsCard = candidate;
        break;
      }
      candidate = candidate.nextElementSibling;
    }

    if(!settingsCard) return;

    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = 'example-settings';
    while(settingsCard.firstChild){
      settingsWrapper.appendChild(settingsCard.firstChild);
    }
    exampleCard.appendChild(settingsWrapper);
    settingsCard.remove();
    exampleCard.classList.add('card-has-settings');
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
    const cfg = {};
    for(const name of BINDING_NAMES){
      const binding = getBinding(name);
      if(binding != null && typeof binding !== 'function'){
        cfg[name] = cloneValue(binding);
      }
    }
    const svg = document.querySelector('svg');
    return {config: cfg, svg: svg ? svg.outerHTML : ''};
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
        examples.forEach((_, idx)=>{
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-tab';
          btn.textContent = String(idx + 1);
          btn.dataset.exampleIndex = String(idx);
          btn.setAttribute('role', 'tab');
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

      if(examples.length === 0){
        const defaultExample = collectConfig();
        defaultExample.isDefault = true;
        examples = [defaultExample];
        currentExampleIndex = 0;
        updated = true;
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
    };
    if(document.readyState === 'complete') setTimeout(ensure, 0);
    else window.addEventListener('load', ensure, {once:true});
  }

  ensureDefaultExample();
})();
