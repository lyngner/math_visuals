(function(){
  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
  const cfgShowBtn = document.getElementById('cfg-showBtn');
  const cfgShowExpression = document.getElementById('cfg-show-expression');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');

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

  function buildLevel(prev,factor,r){
    if(factor===1) return prev;
    const res=[];
    for(let i=0;i<factor;i++){
      const ang=-2*Math.PI*i/factor;
      const rotated=rotate(prev,ang);
      const a=2*Math.PI*i/factor;
      let tx,ty;
      if(factor===2){
        tx=r*Math.cos(a); ty=r*Math.sin(a);
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
    pts=buildLevel(pts,f[1],ks[1]);
    pts=buildLevel(pts,f[2],ks[2]);
    pts=buildLevel(pts,f[3],ks[3]);
    pts=buildLevel(pts,f[4],ks[4]);
    pts=buildLevel(pts,f[5],ks[5]);
    const scale=0.3;
    return pts.map(p=>({x:p.x*scale,y:p.y*scale}));
  }

  function createPatternSvg(points){
    if(!points.length) return null;

    const radius=10;
    const spacing=3;
    const desiredCenterDistance=radius*2+spacing;

    const seen=new Set();
    const uniquePoints=[];
    const precision=1e4;
    points.forEach(p=>{
      const key=`${Math.round(p.x*precision)}:${Math.round(p.y*precision)}`;
      if(!seen.has(key)){
        seen.add(key);
        uniquePoints.push(p);
      }
    });

    let minDist=Infinity;
    for(let i=0;i<uniquePoints.length;i++){
      for(let j=i+1;j<uniquePoints.length;j++){
        const dx=uniquePoints[i].x-uniquePoints[j].x;
        const dy=uniquePoints[i].y-uniquePoints[j].y;
        const dist=Math.hypot(dx,dy);
        if(dist>0 && dist<minDist) minDist=dist;
      }
    }
    if(!Number.isFinite(minDist) || minDist<=0) minDist=desiredCenterDistance;
    let scale=desiredCenterDistance/minDist;
    if(!Number.isFinite(scale) || scale<=0) scale=1;
    else if(scale<1) scale=1;

    const scaledPoints=points.map(p=>({x:p.x*scale,y:p.y*scale}));

    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    scaledPoints.forEach(({x,y})=>{
      if(x<minX) minX=x;
      if(x>maxX) maxX=x;
      if(y<minY) minY=y;
      if(y>maxY) maxY=y;
    });

    const pad=radius+spacing;
    const contentWidth=maxX-minX;
    const contentHeight=maxY-minY;
    const baseW=contentWidth+pad*2;
    const baseH=contentHeight+pad*2;
    const minSize=radius*4;
    const vbW=Math.max(baseW,minSize);
    const vbH=Math.max(baseH,minSize);
    const extraX=(vbW-baseW)/2;
    const extraY=(vbH-baseH)/2;
    const offsetX=pad+extraX-minX;
    const offsetY=pad+extraY-minY;

    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');

    scaledPoints.forEach(({x,y})=>{
      const c=document.createElementNS(svgNS,'circle');
      c.setAttribute('cx', x+offsetX);
      c.setAttribute('cy', y+offsetY);
      c.setAttribute('r', radius);
      c.setAttribute('fill', '#534477');
      svg.appendChild(c);
    });

    return svg;
  }

  function render(){
    const n=parseInt(cfgAntall.value,10)||0;
    const antallX=parseInt(cfgAntallX.value,10)||0;
    const antallY=parseInt(cfgAntallY.value,10)||0;
    patternContainer.innerHTML='';

    const cols=antallX>0?antallX:1;
    const rows=antallY>0?antallY:1;
    patternContainer.style.gridTemplateColumns=`repeat(${cols},minmax(0,1fr))`;
    patternContainer.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;

    const points=byggMonster(n);
    const factors=primeFactors(n).filter(x=>x>1);
    const baseExpression=factors.length?`${factors.join(' · ')} = ${n}`:`${n}`;

    if(!points.length || antallX<=0 || antallY<=0){
      expression.textContent=baseExpression;
      return;
    }

    const svg=createPatternSvg(points);
    if(!svg){
      expression.textContent=baseExpression;
      return;
    }

    const totalFigures=antallX*antallY;
    svg.setAttribute('aria-label', `Kvikkbilde ${n}`);
    for(let i=0;i<totalFigures;i++){
      patternContainer.appendChild(svg.cloneNode(true));
    }

    if(totalFigures>1){
      expression.textContent=`${antallX} · ${antallY} · (${baseExpression}) = ${totalFigures} · ${n} = ${totalFigures*n}`;
    }else{
      expression.textContent=baseExpression;
    }
  }

  function applyExpressionVisibility(){
    if(!expression) return;
    const enabled = !cfgShowExpression || cfgShowExpression.checked;
    const playVisible = playBtn.style.display !== 'none';
    expression.style.display = (enabled && !playVisible) ? 'block' : 'none';
  }

  function updateVisibility(){
    if(cfgShowBtn.checked){
      playBtn.style.display='flex';
      patternContainer.style.display='none';
    }else{
      playBtn.style.display='none';
      patternContainer.style.display='grid';
    }
    applyExpressionVisibility();
  }

  [cfgAntall,cfgAntallX,cfgAntallY].forEach(el=>{
    el?.addEventListener('input',render);
  });
  cfgShowBtn.addEventListener('change', () => {
    updateVisibility();
    if(!cfgShowBtn.checked) render();
  });
  cfgShowExpression?.addEventListener('change', applyExpressionVisibility);

  playBtn.addEventListener('click',()=>{
    const duration=parseInt(cfgDuration.value,10)||0;
    render();
    playBtn.style.display='none';
    patternContainer.style.display='grid';
    applyExpressionVisibility();
    setTimeout(()=>{
      updateVisibility();
    }, duration*1000);
  });
  btnSvg?.addEventListener('click', ()=>{
    const svg = patternContainer.querySelector('svg');
    if(svg) downloadSVG(svg, 'kvikkbilder-monster.svg');
  });
  btnPng?.addEventListener('click', ()=>{
    const svg = patternContainer.querySelector('svg');
    if(svg) downloadPNG(svg, 'kvikkbilder-monster.png', 2);
  });
  updateVisibility();
  render();
  applyExpressionVisibility();

  function svgToString(svgEl){
    const clone = svgEl.cloneNode(true);
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    const style = document.createElement('style');
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function downloadSVG(svgEl, filename){
    const data = svgToString(svgEl);
    const blob = new Blob([data], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.svg') ? filename : filename + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadPNG(svgEl, filename, scale=2, bg='#fff'){
    const vb = svgEl.viewBox?.baseVal;
    const w = vb?.width || svgEl.clientWidth || 420;
    const h = vb?.height|| svgEl.clientHeight || 420;
    const data = svgToString(svgEl);
    const blob = new Blob([data], {type:'image/svg+xml;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob=>{
        const urlPng = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlPng;
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(urlPng),1000);
      },'image/png');
    };
    img.src = url;
  }
})();
