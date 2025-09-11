(function(){
  function createGrid(el, size){
    el.innerHTML='';
    el.style.setProperty('--size', size);
    for(let i=0;i<size*size;i++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.addEventListener('click', ()=>{
        cell.classList.toggle('filled');
      });
      el.appendChild(cell);
    }
  }

  function setupFigure(id){
    const box=document.getElementById(`box${id}`);
    const minus=document.getElementById(`sizeMinus${id}`);
    const plus=document.getElementById(`sizePlus${id}`);
    const val=document.getElementById(`sizeVal${id}`);
    let size=parseInt(val.textContent,10)||10;
    function redraw(){
      createGrid(box,size);
      val.textContent=size;
    }
    minus?.addEventListener('click', ()=>{ if(size>1){ size--; redraw(); }});
    plus?.addEventListener('click', ()=>{ if(size<20){ size++; redraw(); }});
    redraw();
  }

  setupFigure(1);
  const addBtn=document.getElementById('addFigure');
  addBtn?.addEventListener('click', ()=>{
    const panel2=document.getElementById('panel2');
    panel2.style.display='';
    setupFigure(2);
    addBtn.style.display='none';
  });
})();
