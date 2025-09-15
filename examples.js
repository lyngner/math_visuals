(function(){
  const key = 'examples_' + location.pathname;
  function getExamples(){
    try{ return JSON.parse(localStorage.getItem(key)) || []; }
    catch{ return []; }
  }
  function store(examples){
    localStorage.setItem(key, JSON.stringify(examples));
  }
  function collectConfig(){
    const cfg = {};
    if(window.STATE) cfg.STATE = window.STATE;
    if(window.CFG)   cfg.CFG   = window.CFG;
    if(window.CONFIG) cfg.CONFIG = window.CONFIG;
    const svg = document.querySelector('svg');
    return {config: cfg, svg: svg ? svg.outerHTML : ''};
  }

  function loadExample(index){
    const examples = getExamples();
    const ex = examples[index];
    if(!ex || !ex.config) return;
    const cfg = ex.config;
    if(cfg.STATE && window.STATE) Object.assign(window.STATE, cfg.STATE);
    if(cfg.CFG && window.CFG) Object.assign(window.CFG, cfg.CFG);
    if(cfg.CONFIG && window.CONFIG) Object.assign(window.CONFIG, cfg.CONFIG);
    if(typeof window.render === 'function') window.render();
    if(typeof window.draw === 'function') window.draw();
    if(typeof window.update === 'function') window.update();
  }
  // Load example if viewer requested
  (function(){
    const loadInfo = localStorage.getItem('example_to_load');
    if(!loadInfo) return;
    try{
      const {path, index} = JSON.parse(loadInfo);
      if(path === location.pathname){
        const examples = getExamples();
        const ex = examples[index];
        if(ex && ex.config){
          const cfg = ex.config;
          if(cfg.STATE && window.STATE) Object.assign(window.STATE, cfg.STATE);
          if(cfg.CFG && window.CFG) Object.assign(window.CFG, cfg.CFG);
          if(cfg.CONFIG && window.CONFIG) Object.assign(window.CONFIG, cfg.CONFIG);
          if(typeof window.render === 'function') window.render();
          if(typeof window.draw === 'function') window.draw();
          if(typeof window.update === 'function') window.update();
        }
      }
    }catch{}
    localStorage.removeItem('example_to_load');
  })();

  const saveBtn = document.getElementById('btnSaveExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if(!saveBtn && !deleteBtn) return;

  const toolbar = saveBtn?.parentElement;
  const select = document.createElement('select');
  select.id = 'exampleSelect';
  select.addEventListener('change', ()=>{
    const idx = Number(select.value);
    if(!Number.isNaN(idx)) loadExample(idx);
  });
  toolbar?.appendChild(select);

  function renderOptions(){
    const examples = getExamples();
    select.innerHTML = '';
    examples.forEach((_, idx)=>{
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = idx + 1;
      select.appendChild(opt);
    });
  }

  saveBtn?.addEventListener('click', ()=>{
    const examples = getExamples();
    const ex = collectConfig();
    examples.push(ex);
    store(examples);
    renderOptions();
    alert('Eksempel lagret');

    // Also offer download of the example as a JS file
    try{
      const lines = [];
      const cfg = ex.config || {};
      if(cfg.STATE)  lines.push(`window.STATE=${JSON.stringify(cfg.STATE)};`);
      if(cfg.CFG)    lines.push(`window.CFG=${JSON.stringify(cfg.CFG)};`);
      if(cfg.CONFIG) lines.push(`window.CONFIG=${JSON.stringify(cfg.CONFIG)};`);
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
    if(examples.length>0){
      examples.pop();
      store(examples);
      renderOptions();
      alert('Siste eksempel slettet');
    }
  });

  renderOptions();
})();
