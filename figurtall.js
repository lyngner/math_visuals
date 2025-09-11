(function(){
  const boxes=[];
  // Default grid size set to 3x3 for triangular numbers
  let rows=3;
  let cols=3;
  let circleMode=true;
  let offset=true;
  let showGrid=false;

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
    // Store existing colors before rebuilding the grid
    const prevColors=[];
    el.querySelectorAll('.row').forEach((row,r)=>{
      prevColors[r]=[];
      row.querySelectorAll('.cell').forEach((cell,c)=>{
        prevColors[r][c]=cell.dataset.color||'0';
      });
    });

    el.innerHTML='';
    el.style.setProperty('--cols',cols);
    el.style.setProperty('--rows',rows);
    // Maintain square cells by ensuring width/height ratio equals cols/rows
    el.style.setProperty('--aspect',cols/rows);
    el.style.setProperty('--cellSize',(100/cols)+'%');
    el.classList.toggle('hide-grid', !showGrid);
    for(let r=0;r<rows;r++){
      const row=document.createElement('div');
      row.className='row';
      if(offset && r%2===1) row.classList.add('offset');
      for(let c=0;c<cols;c++){
        const cell=document.createElement('div');
        cell.className='cell';
        // Restore previously set color if available
        cell.dataset.color=prevColors?.[r]?.[c]||'0';
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

  function addFigure(name='',pattern=[]){
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
    if(name) panel.querySelector('.nameInput').value=name;
    if(pattern && pattern.length){
      pattern.forEach(([r,c])=>{
        const row=box.querySelectorAll('.row')[r];
        const cell=row?.querySelectorAll('.cell')[c];
        if(cell) cell.dataset.color='1';
      });
    }
    updateCellColors();
    return panel;
  }

  addBtn.addEventListener('click',()=>addFigure());

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

  const btnSvg=document.getElementById('btnSvg');
  const btnPng=document.getElementById('btnPng');
  const resetBtn=document.getElementById('resetBtn');

  function svgToString(svgEl){
    const clone=svgEl.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(clone);
  }

  function downloadSVG(svgEl,filename){
    const data=svgToString(svgEl);
    const blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename.endsWith('.svg')?filename:filename+'.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function downloadPNG(svgEl,filename,scale=2,bg='#fff'){
    const vb=svgEl.viewBox.baseVal;
    const w=vb?.width||svgEl.clientWidth||cols*40;
    const h=vb?.height||svgEl.clientHeight||rows*40;
    const data=svgToString(svgEl);
    const blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(w*scale);
      canvas.height=Math.round(h*scale);
      const ctx=canvas.getContext('2d');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob=>{
        const urlPng=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=urlPng;
        a.download=filename.endsWith('.png')?filename:filename+'.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(urlPng),1000);
      },'image/png');
    };
    img.src=url;
  }

  function buildExportSvg(){
    const colors=getColors();
    const cellSize=40;
    const figW=cols*cellSize + (offset? cellSize/2 : 0);
    const figH=rows*cellSize;
    const nameH=24;
    const gap=20;
    const totalH=boxes.length*(figH+nameH+gap)-gap;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${figW} ${totalH}`);
    svg.setAttribute('width',figW);
    svg.setAttribute('height',totalH);
    let y=0;
    boxes.forEach(box=>{
      const panel=box.closest('.figurePanel');
      const name=panel.querySelector('.nameInput')?.value||'';
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('transform',`translate(0,${y})`);
      box.querySelectorAll('.row').forEach((rowEl,r)=>{
        rowEl.querySelectorAll('.cell').forEach((cellEl,c)=>{
          const idx=parseInt(cellEl.dataset.color,10)||0;
          const x=c*cellSize + (offset && r%2===1 ? cellSize/2 : 0);
          const yPos=r*cellSize;
          const base=document.createElementNS('http://www.w3.org/2000/svg','rect');
          base.setAttribute('x',x);
          base.setAttribute('y',yPos);
          base.setAttribute('width',cellSize);
          base.setAttribute('height',cellSize);
          base.setAttribute('fill','#fff');
          if(showGrid){
            base.setAttribute('stroke','#d1d5db');
            base.setAttribute('stroke-width','1');
          }
          g.appendChild(base);
          if(idx>0){
            if(circleMode){
              const circ=document.createElementNS('http://www.w3.org/2000/svg','circle');
              circ.setAttribute('cx',x+cellSize/2);
              circ.setAttribute('cy',yPos+cellSize/2);
              circ.setAttribute('r',cellSize/2);
              circ.setAttribute('fill',colors[idx-1]);
              g.appendChild(circ);
            }else{
              const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
              rect.setAttribute('x',x);
              rect.setAttribute('y',yPos);
              rect.setAttribute('width',cellSize);
              rect.setAttribute('height',cellSize);
              rect.setAttribute('fill',colors[idx-1]);
              if(showGrid){
                rect.setAttribute('stroke','#d1d5db');
                rect.setAttribute('stroke-width','1');
              }
              g.appendChild(rect);
            }
          }
        });
      });
      if(name){
        const text=document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x',figW/2);
        text.setAttribute('y',figH+16);
        text.setAttribute('text-anchor','middle');
        text.setAttribute('font-size','16');
        text.setAttribute('font-family','system-ui, sans-serif');
        text.textContent=name;
        g.appendChild(text);
      }
      svg.appendChild(g);
      y+=figH+nameH+gap;
    });
    return svg;
  }

  btnSvg?.addEventListener('click',()=>{
    const svg=buildExportSvg();
    downloadSVG(svg,'figurtall.svg');
  });
  btnPng?.addEventListener('click',()=>{
    const svg=buildExportSvg();
    downloadPNG(svg,'figurtall.png',2);
  });

  function resetAll(){
    rows=3; cols=3;
    rowsVal.textContent=rows;
    colsVal.textContent=cols;
    circleMode=true; offset=true; showGrid=false;
    circleInp.checked=true;
    offsetInp.checked=true;
    gridInp.checked=false;
    colorCount=1;
    colorCountInp.value='1';
    updateColorVisibility();

    boxes.length=0;
    container.querySelectorAll('.figurePanel').forEach(p=>p.remove());
    figureCount=0;

    // Recreate three blank figures so all color fields start empty
    addFigure('Figur 1');
    addFigure('Figur 2');
    addFigure('Figur 3');

    updateGridVisibility();
  }

  resetBtn?.addEventListener('click',resetAll);

  updateRows();
  updateCols();
  resetAll();
})();

