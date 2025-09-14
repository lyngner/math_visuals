(function(){
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
  const cfgShowBtn = document.getElementById('cfg-showBtn');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');

  function faktoriser(n){
    const res=[];
    let p=2;
    while(n>1){
      while(n%p===0){
        res.push(p);
        n/=p;
      }
      p++;
    }
    return res.sort((a,b)=>b-a);
  }

  function byggMonster(faktorer){
    if(faktorer.length===0) return [{x:0,y:0}];
    const p=faktorer[0];
    const rest=faktorer.slice(1);
    const sub=byggMonster(rest);
    const res=[];
    const step=2*Math.PI/p;
    const scale=1-1/p;
    for(let i=0;i<p;i++){
      const angle=i*step;
      const tx=Math.cos(angle);
      const ty=Math.sin(angle);
      sub.forEach(pt=>{
        res.push({x:tx+pt.x*scale,y:ty+pt.y*scale});
      });
    }
    return res;
  }

  function render(){
    const n=parseInt(cfgAntall.value,10)||0;
    const faktorer=faktoriser(n);
    patternContainer.innerHTML='';
    const points=byggMonster(faktorer);
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
    expression.textContent=faktorer.length?`${faktorer.join(' × ')} = ${n}`:`${n}`;
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
