(function(){
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
  const cfgShowBtn = document.getElementById('cfg-showBtn');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');

  function primeFactors(n){
    const factors=[];
    let num=n;
    let p=2;
    while(num>1 && factors.length<6){
      while(num%p===0 && factors.length<6){
        factors.push(p);
        num/=p;
      }
      p++;
    }
    while(factors.length<6) factors.push(1);
    return factors;
  }

  function computeKs(n,f){
    const [f1,f2,f3,f4,f5,f6]=f;

    let k1=(n<=9?0.5:1)/(f2*f3*f4*f5);
    if(f3===2 && f4===2) k1*= (f5<3?0.25:0.5);
    if(f4===2 && f5===2) k1*=0.5;
    if(f1===2 && f2===2 && f3===2 && f4<3) k1*=2;
    if(f1===2 && f2===2 && f3===2 && f4===2) k1*=2;
    if(f3===3) k1*=f2/f1;
    if(f1===f2 && f2===f3 && f3===f4 && f4===f5) k1*=2;
    if(n===1) k1=0;

    let k2;
    if(f2===1) k2=1;
    else if(f1===2 && f2===2) k2=k1;
    else if(f3===1) k2=1-1/f2;
    else if(f2===f1) k2=k1*f2;
    else if(f3===f2 && f2===3) k2=k1*f1;
    else if(f3===f2) k2=k1*f2;
    else if(f1*f2===6 && f3<3) k2=k1*f3/f1;
    else k2=1/(f3*f4*f5*f6);

    let k3;
    if(f3===1) k3=1;
    else {
      if(f4===1) k3=1-k1;
      else{
        k3=1;
        if(f2*f3===4 && f5===1) k3*=Math.max(f1,f2,f3,f4,f5,f6)/f1;
        if(f1*f2*f3===8 && f6===1) k3*=1/f2;
        if(f1===2 && f2===2 && f3===2 && f4===2) k3*=2;
        k3*=1/(f4*f5);
      }
      k3*=1/f6;
    }
    if(f1*f2*f3*f4===16 && f5>2) k3*=2;

    let k4;
    if(f4===1) k4=1;
    else if(f5===1 && f1*f2===4) k4=1-k3;
    else if(f5===1) k4=1-k1;
    else k4=1/(f5*f6);

    let k5;
    if(f5===1) k5=1;
    else if(f6===1){
      const mul=(f1===2&&f2===2&&f3===2&&f4===2)?0.5:1;
      k5=1-mul*k3;
    }else{
      k5=1/f6;
    }

    const k6 = f6===1?1:1-k3;

    return [k1,k2,k3,k4,k5,k6];
  }

  function rotate(points,ang){
    const ca=Math.cos(ang), sa=Math.sin(ang);
    return points.map(p=>({x:p.x*ca-p.y*sa,y:p.x*sa+p.y*ca}));
  }

  function translate(points,tx,ty){
    return points.map(p=>({x:p.x+tx,y:p.y+ty}));
  }

  function buildLevel(prev,factor,r,level){
    if(factor===1) return prev;
    const res=[];
    for(let i=0;i<factor;i++){
      const ang=-2*Math.PI*i/factor;
      const rotated=rotate(prev,ang);
      const a=2*Math.PI*i/factor;
      let tx,ty;
      if(level%2===0){
        if(factor===2){
          tx=r*Math.cos(a); ty=r*Math.sin(a);
        }else{
          tx=r*Math.sin(a); ty=r*Math.cos(a);
        }
      }else{
        tx=r*Math.sin(a); ty=r*Math.cos(a);
      }
      res.push(...translate(rotated,tx,ty));
    }
    return res;
  }

  function byggMonster(n){
    if(n<=0) return [];
    const f=primeFactors(n);
    const ks=computeKs(n,f);
    let pts=[];
    const f1=f[0];
    for(let i=0;i<f1;i++){
      const ang=2*Math.PI*i/f1;
      pts.push({x:ks[0]*Math.sin(ang), y:ks[0]*Math.cos(ang)});
    }
    pts=buildLevel(pts,f[1],ks[1],2);
    pts=buildLevel(pts,f[2],ks[2],3);
    pts=buildLevel(pts,f[3],ks[3],4);
    pts=buildLevel(pts,f[4],ks[4],5);
    pts=buildLevel(pts,f[5],ks[5],6);
    const scale=0.3;
    return pts.map(p=>({x:p.x*scale,y:p.y*scale}));
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
    const factors=primeFactors(n).filter(x=>x>1);
    expression.textContent=factors.length?`${factors.join(' × ')} = ${n}`:`${n}`;
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
