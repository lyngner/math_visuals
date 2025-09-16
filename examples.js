(function(){
  const key = 'examples_' + location.pathname;
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let select = null;
  let defaultEnsureScheduled = false;
  function getExamples(){
    try{ return JSON.parse(localStorage.getItem(key)) || []; }
    catch{ return []; }
  }
  function store(examples){
    localStorage.setItem(key, JSON.stringify(examples));
  }
  const BINDING_NAMES = ['STATE','CFG','CONFIG','SIMPLE'];

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
      if(select && select.value !== String(index)){
        select.value = String(index);
      }
      triggerRefresh(index);
    }
    return applied;
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

  const toolbar = saveBtn?.parentElement || deleteBtn?.parentElement;
  select = document.createElement('select');
  select.id = 'exampleSelect';
  select.addEventListener('change', ()=>{
    const idx = Number(select.value);
    if(!Number.isNaN(idx)) loadExample(idx);
  });
  toolbar?.appendChild(select);

  function updateDeleteButtonState(count){
    if(deleteBtn) deleteBtn.disabled = count <= 1;
  }

  const requestedInitialIndex = parseInitialExampleIndex();

  function attemptInitialLoad(){
    if(initialLoadPerformed) return;
    if(requestedInitialIndex == null) return;
    const examples = getExamples();
    if(requestedInitialIndex < 0 || requestedInitialIndex >= examples.length) return;
    if(select) select.value = String(requestedInitialIndex);
    const loadNow = ()=>{
      if(initialLoadPerformed) return;
      if(loadExample(requestedInitialIndex)) initialLoadPerformed = true;
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNow, {once:true});
    else setTimeout(loadNow, 0);
  }

  function renderOptions(){
    const examples = getExamples();
    if(select){
      select.innerHTML = '';
      examples.forEach((_, idx)=>{
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = idx + 1;
        select.appendChild(opt);
      });
      if(examples.length === 0){
        select.disabled = true;
        select.value = '';
        currentExampleIndex = null;
      }else{
        select.disabled = false;
        if(currentExampleIndex == null || currentExampleIndex >= examples.length){
          const fallback = currentExampleIndex == null ? 0 : examples.length - 1;
          currentExampleIndex = Math.min(examples.length - 1, Math.max(0, fallback));
        }
        select.value = String(currentExampleIndex);
      }
    }
    updateDeleteButtonState(examples.length);
    attemptInitialLoad();
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

    const selectIndex = select ? Number(select.value) : NaN;
    let indexToRemove = Number.isInteger(selectIndex) ? selectIndex : currentExampleIndex;
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
      let inserted = false;
      if(!examples[0] || examples[0].isDefault !== true){
        const defaultExample = collectConfig();
        defaultExample.isDefault = true;
        examples.unshift(defaultExample);
        store(examples);
        inserted = true;
      }
      examples = getExamples();
      if(inserted){
        currentExampleIndex = currentExampleIndex == null ? 0 : currentExampleIndex + 1;
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
