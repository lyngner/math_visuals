(function(){
  const saveBtn = document.getElementById('btnSaveExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if(!saveBtn && !deleteBtn) return;
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
  saveBtn?.addEventListener('click', ()=>{
    const examples = getExamples();
    examples.push(collectConfig());
    store(examples);
    alert('Eksempel lagret');
  });
  deleteBtn?.addEventListener('click', ()=>{
    const examples = getExamples();
    if(examples.length>0){
      examples.pop();
      store(examples);
      alert('Siste eksempel slettet');
    }
  });
})();
