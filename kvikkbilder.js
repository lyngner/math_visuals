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
  const cfgShowExpression = document.getElementById('cfg-show-expression');

  const cfgMonsterAntallX = document.getElementById('cfg-monster-antallX');
  const cfgMonsterAntallY = document.getElementById('cfg-monster-antallY');
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDurationMonster = document.getElementById('cfg-duration-monster');
  const cfgShowBtnMonster = document.getElementById('cfg-showBtn-monster');

  const brickContainer = document.getElementById('brickContainer');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');

  let BRICK_SRC;

  const DEFAULT_CFG = {
    type: 'klosser',
    showExpression: true,
    klosser: {
      antallX: 5,
      antallY: 2,
      bredde: 2,
      hoyde: 3,
      dybde: 2,
      duration: 3,
      showBtn: false
    },
    monster: {
      antallX: 2,
      antallY: 2,
      antall: 9,
      duration: 3,
      showBtn: false
    }
  };

  function deepClone(value){
    if(value == null) return value;
    if(typeof structuredClone === 'function'){
      try{
        return structuredClone(value);
      }catch(_){ }
    }
    try{
      return JSON.parse(JSON.stringify(value));
    }catch(_){
      return value;
    }
  }

  function createExampleCfg(overrides){
    const base = deepClone(DEFAULT_CFG) || {};
    const normalized = overrides && typeof overrides === 'object' ? overrides : {};
    if(typeof normalized.type === 'string'){
      base.type = normalized.type === 'monster' ? 'monster' : 'klosser';
    }
    if(Object.prototype.hasOwnProperty.call(normalized, 'showExpression')){
      base.showExpression = normalized.showExpression !== false;
    }
    if(normalized.klosser && typeof normalized.klosser === 'object'){
      base.klosser = Object.assign({}, base.klosser, normalized.klosser);
    }
    if(normalized.monster && typeof normalized.monster === 'object'){
      base.monster = Object.assign({}, base.monster, normalized.monster);
    }
    return base;
  }

  const DEFAULT_KVIKKBILDER_EXAMPLES = [
    {
      id: 'kvikkbilder-klosser-1',
      exampleNumber: '1',
      title: '4 · 2 · (2 · 3 · 2)',
      isDefault: true,
      config: {
        CFG: createExampleCfg({
          type: 'klosser',
          showExpression: true,
          klosser: {
            antallX: 4,
            antallY: 2,
            bredde: 2,
            hoyde: 3,
            dybde: 2,
            showBtn: false
          }
        })
      }
    },
    {
      id: 'kvikkbilder-klosser-2',
      exampleNumber: '2',
      title: '3 · 3 · (3 · 2 · 1)',
      config: {
        CFG: createExampleCfg({
          type: 'klosser',
          showExpression: true,
          klosser: {
            antallX: 3,
            antallY: 3,
            bredde: 3,
            hoyde: 2,
            dybde: 1,
            showBtn: false
          }
        })
      }
    },
    {
      id: 'kvikkbilder-monster-3',
      exampleNumber: '3',
      title: 'Kvikkbilde 12',
      config: {
        CFG: createExampleCfg({
          type: 'monster',
          showExpression: true,
          monster: {
            antallX: 2,
            antallY: 2,
            antall: 12,
            showBtn: false
          }
        })
      }
    }
  ];

  if(typeof window !== 'undefined'){
    window.__EXAMPLES_FORCE_PROVIDED__ = true;
    window.DEFAULT_EXAMPLES = DEFAULT_KVIKKBILDER_EXAMPLES.map(example => ({
      ...example,
      config: {
        ...example.config,
        CFG: deepClone(example.config?.CFG)
      }
    }));
  }

  const globalCfg = (typeof window.CFG === 'object' && window.CFG) ? window.CFG : {};
  const CFG = window.CFG = globalCfg;

  function iso(x,y,z,tileW,tileH,unitH){
    return {
      x:(x - y) * tileW/2,
      y:(x + y) * tileH/2 - z * unitH
    };
  }

  function createBrick(bredde, hoyde, dybde){
    if(!BRICK_SRC) return document.createElementNS('http://www.w3.org/2000/svg','svg');
    const tileW = 26;
    const tileH = 13;
    const unitH = 13;
    const imgW = 26;
    const imgH = 32.5;
    const offsetX = 0.5;
    const offsetY = 25.75;
    const p = (x,y,z)=>iso(x,y,z,tileW,tileH,unitH);

    const widthCount = Math.max(1, Math.trunc(bredde));
    const heightCount = Math.max(1, Math.trunc(hoyde));
    const depthCount = Math.max(1, Math.trunc(dybde));

    const bricks = [];
    for(let z=0; z<heightCount; z++){
      for(let y=0; y<depthCount; y++){
        for(let x=0; x<widthCount; x++){
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

    const w = Math.max(1, maxX - minX);
    const diagonalLayers = Math.max(0, widthCount - 1) + Math.max(0, depthCount - 1);
    const diagonalHeight = diagonalLayers * (tileH / 2);
    const targetHeight = Math.max(1, imgH + (heightCount - 1) * unitH + diagonalHeight);

    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${targetHeight}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    const group = document.createElementNS(svg.namespaceURI, 'g');
    const translateX = -minX;
    const translateY = -minY;
    const transforms = [];
    if(translateX !== 0 || translateY !== 0){
      transforms.push(`translate(${translateX},${translateY})`);
    }
    if(transforms.length){
      group.setAttribute('transform', transforms.join(' '));
    }

    bricks.forEach(({pos})=>{
      const img = document.createElementNS(svg.namespaceURI,'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink','href', BRICK_SRC);
      img.setAttribute('href', BRICK_SRC);
      img.setAttribute('width', imgW);
      img.setAttribute('height', imgH);
      img.setAttribute('x', pos.x - offsetX);
      img.setAttribute('y', pos.y - offsetY);
      group.appendChild(img);
    });

    svg.appendChild(group);

    return svg;
  }

  function renderKlosser(){
    const {antallX = 0, antallY = 0, bredde = 0, hoyde = 0, dybde = 0} = CFG.klosser || {};
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    const width = Math.max(1, Math.trunc(bredde));
    const height = Math.max(1, Math.trunc(hoyde));
    const depth = Math.max(1, Math.trunc(dybde));

    brickContainer.innerHTML = '';
    brickContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols}, 1fr)` : '';
    brickContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows}, 1fr)` : '';

    const perFig = width * height * depth;
    const total = cols * rows * perFig;
    const dot = ' · ';
    expression.textContent = `${cols}${dot}${rows}${dot}(${width}${dot}${height}${dot}${depth}) = ${cols * rows}${dot}${perFig} = ${total}`;

    if(!BRICK_SRC) return;

    const totalFigures = cols * rows;
    for(let i = 0; i < totalFigures; i++){
      const fig = createBrick(width, height, depth);
      fig.setAttribute('aria-label', `${width}x${height}x${depth} kloss`);
      brickContainer.appendChild(fig);
    }
  }

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
    if(f3===2 && f4===2) k1*=(f5<3?0.25:0.5);
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
    else{
      if(f4===1) k3=1-k1;
      else{
        k3=1;
        if(f2*f3===4 && f5===1) k3*=Math.max(...f)/f1;
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
      const mul=(f1===2 && f2===2 && f3===2 && f4===2)?0.5:1;
      k5=1-mul*k3;
    }else{
      k5=1/f6;
    }

    const k6=f6===1?1:1-k3;

    return [k1,k2,k3,k4,k5,k6];
  }

  function rotate(points,angle){
    const cos=Math.cos(angle);
    const sin=Math.sin(angle);
    return points.map(p=>({x:p.x*cos - p.y*sin, y:p.x*sin + p.y*cos}));
  }

  function translate(points,tx,ty){
    return points.map(p=>({x:p.x+tx, y:p.y+ty}));
  }

  function buildLevel(points,factor,r){
    if(factor===1) return points;
    const res=[];
    for(let i=0;i<factor;i++){
      const rotAngle=-2*Math.PI*i/factor;
      const rotated=rotate(points,rotAngle);
      const baseAngle=2*Math.PI*i/factor;
      let tx,ty;
      if(factor===2){
        tx=r*Math.cos(baseAngle);
        ty=r*Math.sin(baseAngle);
      }else{
        tx=r*Math.sin(baseAngle);
        ty=r*Math.cos(baseAngle);
      }
      res.push(...translate(rotated,tx,ty));
    }
    return res;
  }

  function byggMonster(n){
    if(n<=0) return [];
    const factors=primeFactors(n);
    const ks=computeKs(n,factors);
    let pts=[];
    const f1=factors[0];
    for(let i=0;i<f1;i++){
      const angle=2*Math.PI*i/f1;
      pts.push({x:ks[0]*Math.sin(angle), y:ks[0]*Math.cos(angle)});
    }
    pts=buildLevel(pts,factors[1],ks[1]);
    pts=buildLevel(pts,factors[2],ks[2]);
    pts=buildLevel(pts,factors[3],ks[3]);
    pts=buildLevel(pts,factors[4],ks[4]);
    pts=buildLevel(pts,factors[5],ks[5]);
    const scale=0.3;
    return pts.map(p=>({x:p.x*scale, y:p.y*scale}));
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

  function renderMonster(){
    const {antallX = 0, antallY = 0, antall = 0} = CFG.monster || {};
    patternContainer.innerHTML='';

    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    patternContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols},minmax(0,1fr))` : '';
    patternContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows},minmax(0,1fr))` : '';

    const count = Math.max(0, Math.trunc(antall));
    const points = byggMonster(count);
    const factors = primeFactors(count).filter(x=>x>1);
    const baseExpression = factors.length ? `${factors.join(' · ')} = ${count}` : `${count}`;

    if(!points.length || cols<=0 || rows<=0){
      expression.textContent = baseExpression;
      return;
    }

    const svg = createPatternSvg(points);
    if(!svg){
      expression.textContent = baseExpression;
      return;
    }

    const totalFigures = cols * rows;
    svg.setAttribute('aria-label', `Kvikkbilde ${count}`);
    for(let i=0;i<totalFigures;i++){
      patternContainer.appendChild(svg.cloneNode(true));
    }

    if(totalFigures>1){
      expression.textContent = `${cols} · ${rows} · (${baseExpression}) = ${totalFigures} · ${count} = ${totalFigures*count}`;
    }else{
      expression.textContent = baseExpression;
    }
  }

  function applyExpressionVisibility(){
    if(!expression) return;
    const enabled = CFG.showExpression !== false;
    const playVisible = playBtn.style.display !== 'none';
    expression.style.display = (enabled && !playVisible) ? 'block' : 'none';
  }

  function updateVisibilityKlosser(){
    patternContainer.style.display = 'none';
    if(CFG.klosser?.showBtn){
      playBtn.style.display = 'flex';
      brickContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }

  function updateVisibilityMonster(){
    brickContainer.style.display = 'none';
    if(CFG.monster?.showBtn){
      playBtn.style.display = 'flex';
      patternContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }

  function clampInt(value, min, fallback){
    const num = Number.parseInt(value, 10);
    if(Number.isFinite(num)){
      const safeMin = Number.isFinite(min) ? min : -Infinity;
      return Math.max(safeMin, Math.trunc(num));
    }
    return fallback;
  }

  function sanitizeCfg(){
    if(CFG.type !== 'monster' && CFG.type !== 'klosser'){
      CFG.type = DEFAULT_CFG.type;
    }
    CFG.showExpression = CFG.showExpression !== false;

    if(!CFG.klosser || typeof CFG.klosser !== 'object') CFG.klosser = {};
    if(!CFG.monster || typeof CFG.monster !== 'object') CFG.monster = {};

    const k = CFG.klosser;
    const dk = DEFAULT_CFG.klosser;
    k.antallX = clampInt(k.antallX, 0, dk.antallX);
    k.antallY = clampInt(k.antallY, 0, dk.antallY);
    k.bredde = clampInt(k.bredde, 1, dk.bredde);
    k.hoyde = clampInt(k.hoyde, 1, dk.hoyde);
    k.dybde = clampInt(k.dybde, 1, dk.dybde);
    k.duration = clampInt(k.duration, 0, dk.duration);
    k.showBtn = k.showBtn === true;

    const m = CFG.monster;
    const dm = DEFAULT_CFG.monster;
    m.antallX = clampInt(m.antallX, 0, dm.antallX);
    m.antallY = clampInt(m.antallY, 0, dm.antallY);
    m.antall = clampInt(m.antall, 0, dm.antall);
    m.duration = clampInt(m.duration, 0, dm.duration);
    m.showBtn = m.showBtn === true;

    return CFG;
  }

  function syncControlsToCfg(){
    sanitizeCfg();
    if(cfgType) cfgType.value = CFG.type;
    if(cfgShowExpression) cfgShowExpression.checked = CFG.showExpression !== false;

    if(cfgAntallX) cfgAntallX.value = CFG.klosser.antallX;
    if(cfgAntallY) cfgAntallY.value = CFG.klosser.antallY;
    if(cfgBredde) cfgBredde.value = CFG.klosser.bredde;
    if(cfgHoyde) cfgHoyde.value = CFG.klosser.hoyde;
    if(cfgDybde) cfgDybde.value = CFG.klosser.dybde;
    if(cfgDurationKlosser) cfgDurationKlosser.value = CFG.klosser.duration;
    if(cfgShowBtn) cfgShowBtn.checked = CFG.klosser.showBtn;

    if(cfgMonsterAntallX) cfgMonsterAntallX.value = CFG.monster.antallX;
    if(cfgMonsterAntallY) cfgMonsterAntallY.value = CFG.monster.antallY;
    if(cfgAntall) cfgAntall.value = CFG.monster.antall;
    if(cfgDurationMonster) cfgDurationMonster.value = CFG.monster.duration;
    if(cfgShowBtnMonster) cfgShowBtnMonster.checked = CFG.monster.showBtn;
  }

  function renderView(){
    sanitizeCfg();
    if(CFG.type === 'klosser'){
      if(klosserConfig) klosserConfig.style.display = 'block';
      if(monsterConfig) monsterConfig.style.display = 'none';
      renderKlosser();
      updateVisibilityKlosser();
    }else{
      if(klosserConfig) klosserConfig.style.display = 'none';
      if(monsterConfig) monsterConfig.style.display = 'block';
      renderMonster();
      updateVisibilityMonster();
    }
  }

  function render(){
    syncControlsToCfg();
    renderView();
  }

  window.render = render;

  function bindNumberInput(input, targetGetter, key, min = 0){
    if(!input) return;
    input.addEventListener('input', () => {
      const target = targetGetter();
      if(!target) return;
      const num = Number.parseInt(input.value, 10);
      if(Number.isFinite(num)){
        target[key] = Math.max(min, Math.trunc(num));
        input.value = String(target[key]);
      }
      renderView();
    });
  }

  sanitizeCfg();

  bindNumberInput(cfgAntallX, () => CFG.klosser, 'antallX', 0);
  bindNumberInput(cfgAntallY, () => CFG.klosser, 'antallY', 0);
  bindNumberInput(cfgBredde, () => CFG.klosser, 'bredde', 1);
  bindNumberInput(cfgHoyde, () => CFG.klosser, 'hoyde', 1);
  bindNumberInput(cfgDybde, () => CFG.klosser, 'dybde', 1);

  cfgDurationKlosser?.addEventListener('input', () => {
    const num = Number.parseInt(cfgDurationKlosser.value, 10);
    if(Number.isFinite(num)){
      CFG.klosser.duration = Math.max(0, Math.trunc(num));
      cfgDurationKlosser.value = String(CFG.klosser.duration);
    }
  });

  cfgShowBtn?.addEventListener('change', () => {
    CFG.klosser.showBtn = !!cfgShowBtn.checked;
    renderView();
  });

  bindNumberInput(cfgMonsterAntallX, () => CFG.monster, 'antallX', 0);
  bindNumberInput(cfgMonsterAntallY, () => CFG.monster, 'antallY', 0);
  bindNumberInput(cfgAntall, () => CFG.monster, 'antall', 0);

  cfgDurationMonster?.addEventListener('input', () => {
    const num = Number.parseInt(cfgDurationMonster.value, 10);
    if(Number.isFinite(num)){
      CFG.monster.duration = Math.max(0, Math.trunc(num));
      cfgDurationMonster.value = String(CFG.monster.duration);
    }
  });

  cfgShowBtnMonster?.addEventListener('change', () => {
    CFG.monster.showBtn = !!cfgShowBtnMonster.checked;
    renderView();
  });

  cfgType?.addEventListener('change', () => {
    CFG.type = cfgType.value === 'monster' ? 'monster' : 'klosser';
    cfgType.value = CFG.type;
    renderView();
  });

  cfgShowExpression?.addEventListener('change', () => {
    CFG.showExpression = !!cfgShowExpression.checked;
    applyExpressionVisibility();
  });

  playBtn.addEventListener('click', () => {
    sanitizeCfg();
    if(CFG.type === 'klosser'){
      const duration = Math.max(0, Number.isFinite(CFG.klosser.duration) ? CFG.klosser.duration : 0);
      renderKlosser();
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityKlosser();
      }, duration * 1000);
    }else{
      const duration = Math.max(0, Number.isFinite(CFG.monster.duration) ? CFG.monster.duration : 0);
      renderMonster();
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityMonster();
      }, duration * 1000);
    }
  });

  btnSvg?.addEventListener('click', ()=>{
    const svg = brickContainer.querySelector('svg') || patternContainer.querySelector('svg');
    if(svg) downloadSVG(svg, 'kvikkbilder.svg');
  });
  btnPng?.addEventListener('click', ()=>{
    const svg = brickContainer.querySelector('svg') || patternContainer.querySelector('svg');
    if(svg) downloadPNG(svg, 'kvikkbilder.png', 2);
  });

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

  render();
  fetch('images/brick1.svg')
    .then(r=>r.text())
    .then(txt=>{
      BRICK_SRC = `data:image/svg+xml;base64,${btoa(txt)}`;
      renderView();
    });
})();
