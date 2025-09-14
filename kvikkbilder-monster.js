(function(){
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
  const cfgShowBtn = document.getElementById('cfg-showBtn');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');

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

  function render(){
    const n=parseInt(cfgAntall.value,10)||0;
    patternContainer.innerHTML='';
    const points=byggMonster(n);
    if(!points.length) return;
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

  function updateVisibility(){
    if(cfgShowBtn.checked){
      playBtn.style.display='inline-block';
      patternContainer.style.display='none';
      expression.style.display='none';
    }else{
      playBtn.style.display='none';
      patternContainer.style.display='block';
      expression.style.display='block';
    }
  }

  cfgAntall.addEventListener('input',render);
  cfgShowBtn.addEventListener('change', () => {
    updateVisibility();
    if(!cfgShowBtn.checked) render();
  });

  playBtn.addEventListener('click',()=>{
    const duration=parseInt(cfgDuration.value,10)||0;
    render();
    playBtn.style.display='none';
    patternContainer.style.display='block';
    expression.style.display='block';
    setTimeout(()=>{
      updateVisibility();
    }, duration*1000);
  });
  updateVisibility();
  render();
})();
