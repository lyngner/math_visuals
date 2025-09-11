(function(){
  const boxes=[];
  let size=10;

  function createGrid(el){
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

  function redrawAll(){
    boxes.forEach(box=>createGrid(box));
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
      <div class="figure"><div class="box"></div></div>
      <input class="nameInput" type="text" placeholder="Navn" />
    `;
    const box=panel.querySelector('.box');
    boxes.push(box);
    createGrid(box);
    container.insertBefore(panel, addBtn);
  }

  for(let i=0;i<3;i++) addFigure();

  addBtn.addEventListener('click', addFigure);

  const minus=document.getElementById('sizeMinus');
  const plus=document.getElementById('sizePlus');
  const val=document.getElementById('sizeVal');
  function updateSize(){
    val.textContent=size;
    redrawAll();
  }
  minus?.addEventListener('click', ()=>{ if(size>1){ size--; updateSize(); }});
  plus?.addEventListener('click', ()=>{ if(size<20){ size++; updateSize(); }});
  updateSize();

  const colorInp=document.getElementById('color');
  colorInp?.addEventListener('input', ()=>{
    document.documentElement.style.setProperty('--purple', colorInp.value);
  });
})();
