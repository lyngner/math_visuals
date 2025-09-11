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

  function setupFigure(panel){
    const box=panel.querySelector('.box');
    const minus=panel.querySelector('.sizeMinus');
    const plus=panel.querySelector('.sizePlus');
    const val=panel.querySelector('.sizeVal');
    let size=10;
    function redraw(){
      createGrid(box,size);
      val.textContent=size;
    }
    minus.addEventListener('click', ()=>{ if(size>1){ size--; redraw(); }});
    plus.addEventListener('click', ()=>{ if(size<20){ size++; redraw(); }});
    redraw();
  }

  const container=document.getElementById('figureContainer');
  const addBtn=document.getElementById('addFigure');
  let figureCount=0;

  function addFigure(){
    figureCount++;
    const panel=document.createElement('div');
    panel.className='figurePanel';
    panel.dataset.id=figureCount;
    panel.innerHTML=`
      <div class="figure"><div class="box" style="--size:10"></div></div>
      <div class="stepper" aria-label="Størrelse">
        <button class="sizeMinus" type="button" aria-label="Færre ruter">−</button>
        <span class="sizeVal">10</span>
        <button class="sizePlus" type="button" aria-label="Flere ruter">+</button>
      </div>
      <input class="nameInput" type="text" placeholder="Navn" />
    `;
    container.insertBefore(panel, addBtn);
    setupFigure(panel);
  }

  for(let i=0;i<3;i++) addFigure();

  addBtn.addEventListener('click', addFigure);
})();

