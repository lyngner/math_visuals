// Viewer for stored examples
function renderExamples(){
  const container = document.getElementById('examples');
  container.innerHTML = '';
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i);
    if(!key.startsWith('examples_')) continue;
    const path = key.slice('examples_'.length);
    let arr;
    try { arr = JSON.parse(localStorage.getItem(key)) || []; }
    catch { arr = []; }
    if(arr.length === 0) continue;

    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = path;
    section.appendChild(h2);

    arr.forEach((ex, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'example';
      if(ex.svg){
        const divSvg = document.createElement('div');
        divSvg.innerHTML = ex.svg;
        const svgEl = divSvg.firstElementChild;
        if(svgEl) wrap.appendChild(svgEl);
      }
      const iframe = document.createElement('iframe');
      iframe.setAttribute('loading', 'lazy');
      iframe.title = `Eksempel ${idx + 1} – ${path}`;
      try {
        const url = new URL(path, window.location.href);
        url.searchParams.set('example', String(idx + 1));
        iframe.src = url.href;
      } catch {
        const sep = path.includes('?') ? '&' : '?';
        iframe.src = `${path}${sep}example=${idx + 1}`;
      }
      wrap.appendChild(iframe);
      const btns = document.createElement('div');
      btns.className = 'buttons';
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Last inn';
      loadBtn.addEventListener('click', ()=>{
        localStorage.setItem('example_to_load', JSON.stringify({path, index: idx}));
        const iframe = window.parent.document.querySelector('iframe');
        iframe.src = path;
        window.parent.localStorage.setItem('currentPage', path);
        if(window.parent.setActive) window.parent.setActive(path);
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Slett';
      delBtn.addEventListener('click', ()=>{
        arr.splice(idx,1);
        if(arr.length) localStorage.setItem(key, JSON.stringify(arr));
        else localStorage.removeItem(key);
        renderExamples();
      });
      btns.appendChild(loadBtn);
      btns.appendChild(delBtn);
      wrap.appendChild(btns);
      section.appendChild(wrap);
    });
    container.appendChild(section);
  }
}

document.addEventListener('DOMContentLoaded', renderExamples);
