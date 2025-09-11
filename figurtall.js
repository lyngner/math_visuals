(function(){
  const boxes=[];
  let size=10;
  let circleMode=false;

  const colorCountInp=document.getElementById('colorCount');
  const colorInputs=[];
  for(let i=1;;i++){
    const inp=document.getElementById('color_'+i);
    if(!inp) break;
    colorInputs.push(inp);
  }
  let colorCount=parseInt(colorCountInp?.value,10)||colorInputs.length;

  function getColors(){
    return colorInputs.slice(0,colorCount).map(inp=>inp.value);
  }

  function updateCellColors(){
    const colors=getColors();
    boxes.forEach(box=>{
      [...box.children].forEach(cell=>{
        let idx=parseInt(cell.dataset.color,10)||0;
        if(idx===0){
          cell.style.backgroundColor='#fff';
        }else if(idx>colors.length){
          idx=0;
          cell.dataset.color='0';
          cell.style.backgroundColor='#fff';
        }else{
          cell.style.backgroundColor=colors[idx-1];
        }
      });
    });
  }

  function updateColorVisibility(){
    colorInputs.forEach((inp,idx)=>{
      inp.style.display=idx<colorCount?'':'none';
    });
    updateCellColors();
  }

  colorCountInp?.addEventListener('input',()=>{
    colorCount=Math.max(1,Math.min(colorInputs.length,parseInt(colorCountInp.value,10)||1));
    updateColorVisibility();
  });
  colorInputs.forEach(inp=>inp.addEventListener('input',updateCellColors));
  updateColorVisibility();

  function createGrid(el){
    el.innerHTML='';
    el.style.setProperty('--size',size);
    for(let i=0;i<size*size;i++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.color='0';
      cell.addEventListener('click',()=>{
        const colors=getColors();
        let idx=parseInt(cell.dataset.color,10)||0;
        idx=(idx+1)%(colors.length+1);
        cell.dataset.color=String(idx);
        cell.style.backgroundColor=idx?colors[idx-1]:'#fff';
      });
      el.appendChild(cell);
    }
  }

  function redrawAll(){
    boxes.forEach(box=>createGrid(box));
    updateCellColors();
  }

  function updateShape(){
    boxes.forEach(box=>box.classList.toggle('circle',circleMode));
  }

  const circleInp=document.getElementById('circleMode');
  circleMode=!!circleInp?.checked;
  circleInp?.addEventListener('change',()=>{
    circleMode=circleInp.checked;
    updateShape();
  });

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
    box.classList.toggle('circle',circleMode);
    container.insertBefore(panel,addBtn);
  }

  for(let i=0;i<3;i++) addFigure();

  addBtn.addEventListener('click',addFigure);

  const minus=document.getElementById('sizeMinus');
  const plus=document.getElementById('sizePlus');
  const val=document.getElementById('sizeVal');
  function updateSize(){
    val.textContent=size;
    redrawAll();
  }
  minus?.addEventListener('click',()=>{ if(size>1){ size--; updateSize(); }});
  plus?.addEventListener('click',()=>{ if(size<20){ size++; updateSize(); }});
  updateSize();
})();

