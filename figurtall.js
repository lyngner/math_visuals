(function(){
  const boxes=[];
  let rows=10;
  let cols=10;
  let circleMode=false;
  let offset=false;
  let showGrid=true;

  const colorCountInp=document.getElementById('colorCount');
  const colorInputs=[];
  for(let i=1;;i++){
    const inp=document.getElementById('color_'+i);
    if(!inp) break;
    colorInputs.push(inp);
  }
  const DEFAULT_COLOR_SETS={
    1:['#6C1BA2'],
    2:['#534477','#BF4474'],
    3:['#534477','#6C1BA2','#BF4474'],
    4:['#534477','#B25FE3','#6C1BA2','#BF4474'],
    5:['#534477','#B25FE3','#6C1BA2','#873E79','#BF4474'],
    6:['#534477','#B25FE3','#6C1BA2','#873E79','#BF4474','#E31C3D']
  };
  function setDefaultColors(n){
    const arr=DEFAULT_COLOR_SETS[n]||DEFAULT_COLOR_SETS[6];
    colorInputs.forEach((inp,idx)=>{
      if(arr[idx]) inp.value=arr[idx];
    });
  }
  let colorCount=parseInt(colorCountInp?.value,10)||1;

  function getColors(){
    return colorInputs.slice(0,colorCount).map(inp=>inp.value);
  }

  function updateCellShape(cell){
    if(circleMode && cell.dataset.color!=='0'){
      cell.classList.add('circle');
    }else{
      cell.classList.remove('circle');
    }
  }

  function updateCellColors(){
    const colors=getColors();
    boxes.forEach(box=>{
      box.querySelectorAll('.cell').forEach(cell=>{
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
        updateCellShape(cell);
      });
    });
  }

  function updateColorVisibility(){
    setDefaultColors(colorCount);
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
    el.style.setProperty('--cols',cols);
    el.style.setProperty('--rows',rows);
    el.style.setProperty('--aspect',rows/cols);
    el.style.setProperty('--cellSize',(100/cols)+'%');
    el.classList.toggle('hide-grid', !showGrid);
    for(let r=0;r<rows;r++){
      const row=document.createElement('div');
      row.className='row';
      if(offset && r%2===1) row.classList.add('offset');
      for(let c=0;c<cols;c++){
        const cell=document.createElement('div');
        cell.className='cell';
        cell.dataset.color='0';
        cell.addEventListener('click',()=>{
          const colors=getColors();
          let idx=parseInt(cell.dataset.color,10)||0;
          idx=(idx+1)%(colors.length+1);
          cell.dataset.color=String(idx);
          cell.style.backgroundColor=idx?colors[idx-1]:'#fff';
          updateCellShape(cell);
        });
        row.appendChild(cell);
      }
      el.appendChild(row);
    }
  }

  function updateGridVisibility(){
    boxes.forEach(box=>{
      box.classList.toggle('hide-grid', !showGrid);
    });
  }

  function redrawAll(){
    boxes.forEach(box=>createGrid(box));
    updateCellColors();
    updateGridVisibility();
  }

  const circleInp=document.getElementById('circleMode');
  circleMode=!!circleInp?.checked;
  circleInp?.addEventListener('change',()=>{
    circleMode=circleInp.checked;
    updateCellColors();
  });

  const offsetInp=document.getElementById('offsetRows');
  offset=!!offsetInp?.checked;
  offsetInp?.addEventListener('change',()=>{
    offset=offsetInp.checked;
    redrawAll();
  });

  const gridInp=document.getElementById('showGrid');
  showGrid=!!gridInp?.checked;
  gridInp?.addEventListener('change',()=>{
    showGrid=gridInp.checked;
    updateGridVisibility();
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
    container.insertBefore(panel,addBtn);
    updateCellColors();
  }

  for(let i=0;i<3;i++) addFigure();

  addBtn.addEventListener('click',addFigure);

  const rowsMinus=document.getElementById('rowsMinus');
  const rowsPlus=document.getElementById('rowsPlus');
  const rowsVal=document.getElementById('rowsVal');
  function updateRows(){
    rowsVal.textContent=rows;
    redrawAll();
  }
  rowsMinus?.addEventListener('click',()=>{ if(rows>1){ rows--; updateRows(); }});
  rowsPlus?.addEventListener('click',()=>{ if(rows<20){ rows++; updateRows(); }});

  const colsMinus=document.getElementById('colsMinus');
  const colsPlus=document.getElementById('colsPlus');
  const colsVal=document.getElementById('colsVal');
  function updateCols(){
    colsVal.textContent=cols;
    redrawAll();
  }
  colsMinus?.addEventListener('click',()=>{ if(cols>1){ cols--; updateCols(); }});
  colsPlus?.addEventListener('click',()=>{ if(cols<20){ cols++; updateCols(); }});

  updateRows();
  updateCols();
})();

