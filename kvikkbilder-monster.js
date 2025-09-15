(function(){
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
  const cfgShowBtn = document.getElementById('cfg-showBtn');
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
    const widthRaw=maxX-minX;
    const heightRaw=maxY-minY;
    const padBase=Math.max(widthRaw,heightRaw);
    const pad=Math.max(0.05,padBase*0.12);
    const vbX=minX-pad;
    const vbY=minY-pad;
    const vbW=widthRaw+pad*2;
    const vbH=heightRaw+pad*2;
    let availableWidth=patternContainer.clientWidth;
    if(!availableWidth){
      availableWidth=patternContainer.parentElement?.clientWidth||360;
    }
    const maxPreferred=420;
    const minPreferred=280;
    let targetPx=Math.min(availableWidth,maxPreferred);
    if(availableWidth>=minPreferred){
      targetPx=Math.max(targetPx,minPreferred);
    }
    if(!Number.isFinite(targetPx)||targetPx<=0){
      targetPx=360;
    }
    const maxDim=Math.max(vbW,vbH);
    const pxPerUnit=targetPx/maxDim;
    const widthPx=vbW*pxPerUnit;
    const heightPx=vbH*pxPerUnit;
    const dotRadiusPx=4;
    const dotRadius=dotRadiusPx/pxPerUnit;
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('width', widthPx);
    svg.setAttribute('height', heightPx);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.style.maxWidth='100%';
    svg.style.height='auto';
    svg.style.display='block';
    points.forEach(({x,y})=>{
      const c=document.createElementNS(svgNS,'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', dotRadius);
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
