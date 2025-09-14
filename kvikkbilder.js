(function(){
  const cfgType = document.getElementById('cfg-type');
  const klosserConfig = document.getElementById('klosserConfig');
  const monsterConfig = document.getElementById('monsterConfig');

  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgBredde = document.getElementById('cfg-bredde');
  const cfgHoyde = document.getElementById('cfg-hoyde');
  const cfgDybde = document.getElementById('cfg-dybde');
  const cfgDurationKlosser = document.getElementById('cfg-duration-klosser');
  const cfgShowBtn = document.getElementById('cfg-showBtn');

  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDurationMonster = document.getElementById('cfg-duration-monster');
  const cfgShowBtnMonster = document.getElementById('cfg-showBtn-monster');

  const brickContainer = document.getElementById('brickContainer');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');

  const BRICK_SRC = 'images/brick1.svg';

  function iso(x,y,z,tileW,tileH,unitH){
    return {
      x:(x - y) * tileW/2,
      y:(x + y) * tileH/2 - z * unitH
    };
  }

  function createBrick(bredde, hoyde, dybde){
    const tileW = 26;
    const tileH = 13;
    const unitH = 13;
    const imgW = 26;
    const imgH = 32.5;
    const offsetX = 0.5;
    const offsetY = 25.75;
    const p = (x,y,z)=>iso(x,y,z,tileW,tileH,unitH);

    const bricks = [];
    for(let z=0; z<hoyde; z++){
      for(let y=0; y<dybde; y++){
        for(let x=0; x<bredde; x++){
          const pos = p(x,y,z);
          bricks.push({x,y,z,pos});
        }
      }
    }

    bricks.sort((a,b)=>(a.x+a.y+a.z)-(b.x+b.y+b.z));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    bricks.forEach(({pos})=>{
      const x = pos.x - offsetX;
      const y = pos.y - offsetY;
      if(x < minX) minX = x;
      if(y < minY) minY = y;
      if(x + imgW > maxX) maxX = x + imgW;
      if(y + imgH > maxY) maxY = y + imgH;
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    bricks.forEach(({pos})=>{
      const img = document.createElementNS(svg.namespaceURI,'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink','href', BRICK_SRC);
      img.setAttribute('href', BRICK_SRC);
      img.setAttribute('width', imgW);
      img.setAttribute('height', imgH);
      img.setAttribute('x', pos.x - offsetX - minX);
      img.setAttribute('y', pos.y - offsetY - minY);
      svg.appendChild(img);
    });

    return svg;
  }

  function renderKlosser(){
    const antallX = parseInt(cfgAntallX.value,10) || 0;
    const antallY = parseInt(cfgAntallY.value,10) || 0;
    const bredde = parseInt(cfgBredde.value,10) || 0;
    const hoyde = parseInt(cfgHoyde.value,10) || 0;
    const dybde = parseInt(cfgDybde.value,10) || 0;

    brickContainer.innerHTML = '';
    brickContainer.style.gridTemplateColumns = `repeat(${antallX}, 1fr)`;
    brickContainer.style.gridTemplateRows = `repeat(${antallY}, 1fr)`;
    for(let i = 0; i < antallX * antallY; i++){
      const fig = createBrick(bredde, hoyde, dybde);
      fig.setAttribute('aria-label', `${bredde}x${hoyde}x${dybde} kloss`);
      brickContainer.appendChild(fig);
    }

    const perFig = bredde * hoyde * dybde;
    const total = antallX * antallY * perFig;
    expression.textContent = `${antallX} × ${antallY} × (${bredde} × ${hoyde} × ${dybde}) = ${antallX * antallY} × ${perFig} = ${total}`;
  }

  function finnFaktorer(n){
    let cols=Math.floor(Math.sqrt(n));
    while(cols>1 && n%cols!==0) cols--;
    const rows=cols? n/cols : 0;
    return {cols, rows};
  }

  function byggMonster(n){
    if(n<=0) return [];
    const {cols, rows}=finnFaktorer(n);
    const points=[];
    const xOff=-(cols-1)/2;
    const yOff=-(rows-1)/2;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        points.push({x:xOff+c, y:yOff+r});
      }
    }
    return points;
  }

  function renderMonster(){
    const n=parseInt(cfgAntall.value,10)||0;
    patternContainer.innerHTML='';
    const points=byggMonster(n);
    if(!points.length){
      expression.textContent=`${n}`;
      return;
    }
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    points.forEach(({x,y})=>{
      if(x<minX) minX=x;
      if(x>maxX) maxX=x;
      if(y<minY) minY=y;
      if(y>maxY) maxY=y;
    });
    const pad=1;
    const vbX=minX-pad;
    const vbY=minY-pad;
    const vbW=maxX-minX+pad*2;
    const vbH=maxY-minY+pad*2;
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('width', vbW*20);
    svg.setAttribute('height', vbH*20);
    points.forEach(({x,y})=>{
      const c=document.createElementNS(svgNS,'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', 0.3);
      c.setAttribute('fill', '#534477');
      svg.appendChild(c);
    });
    patternContainer.appendChild(svg);
    const {cols, rows}=finnFaktorer(n);
    expression.textContent=(cols>1 && rows>1)?`${cols} × ${rows} = ${n}`:`${n}`;
  }

  function updateVisibilityKlosser(){
    if(cfgShowBtn.checked){
      playBtn.style.display = 'inline-flex';
      brickContainer.style.display = 'none';
      expression.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
      expression.style.display = 'block';
    }
    patternContainer.style.display='none';
  }

  function updateVisibilityMonster(){
    brickContainer.style.display='none';
    if(cfgShowBtnMonster.checked){
      playBtn.style.display='inline-flex';
      patternContainer.style.display='none';
      expression.style.display='none';
    } else {
      playBtn.style.display='none';
      patternContainer.style.display='block';
      expression.style.display='block';
    }
  }

  function updateType(){
    if(cfgType.value==='klosser'){
      klosserConfig.style.display='block';
      monsterConfig.style.display='none';
      renderKlosser();
      updateVisibilityKlosser();
    }else{
      klosserConfig.style.display='none';
      monsterConfig.style.display='block';
      renderMonster();
      updateVisibilityMonster();
    }
  }

  [cfgAntallX, cfgAntallY, cfgBredde, cfgHoyde, cfgDybde].forEach(el =>{
    el.addEventListener('input', renderKlosser);
  });
  cfgShowBtn.addEventListener('change', () => {
    updateVisibilityKlosser();
    renderKlosser();
  });
  cfgShowBtnMonster.addEventListener('change', () => {
    updateVisibilityMonster();
    renderMonster();
  });
  cfgAntall.addEventListener('input', renderMonster);
  cfgType.addEventListener('change', updateType);

  playBtn.addEventListener('click', () => {
    if(cfgType.value==='klosser'){
      const duration = parseInt(cfgDurationKlosser.value, 10) || 0;
      renderKlosser();
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
      expression.style.display = 'block';
      setTimeout(() => {
        updateVisibilityKlosser();
      }, duration * 1000);
    }else{
      const duration = parseInt(cfgDurationMonster.value,10)||0;
      renderMonster();
      playBtn.style.display='none';
      patternContainer.style.display='block';
      expression.style.display='block';
      setTimeout(()=>{
        updateVisibilityMonster();
      }, duration*1000);
    }
  });

  renderKlosser();
  renderMonster();
  updateType();
})();
