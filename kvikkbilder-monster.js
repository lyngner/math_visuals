(function(){
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
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
    for(let i=0;i<p;i++){
      const angle=i*step;
      const rot=angle+Math.PI/2;
      const cos=Math.cos(rot);
      const sin=Math.sin(rot);
      const tx=Math.cos(angle);
      const ty=Math.sin(angle);
      sub.forEach(pt=>{
        const xr=pt.x*cos-pt.y*sin;
        const yr=pt.x*sin+pt.y*cos;
        res.push({x:tx+xr,y:ty+yr});
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

  cfgAntall.addEventListener('input',render);

  playBtn.addEventListener('click',()=>{
    const duration=parseInt(cfgDuration.value,10)||0;
    render();
    playBtn.style.display='none';
    patternContainer.style.display='block';
    expression.style.display='block';
    setTimeout(()=>{
      patternContainer.style.display='none';
      expression.style.display='none';
      playBtn.style.display='inline-block';
    }, duration*1000);
  });

  patternContainer.style.display='none';
  expression.style.display='none';
  render();
})();
