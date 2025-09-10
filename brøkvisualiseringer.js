(function(){
  const shapeSel = document.getElementById('shape');
  const partsInp = document.getElementById('parts');
  const divSel   = document.getElementById('division');
  const filledInp= document.getElementById('filled');
  const wrongInp = document.getElementById('allowWrong');
  const minusBtn = document.getElementById('partsMinus');
  const plusBtn  = document.getElementById('partsPlus');
  const partsVal = document.getElementById('partsVal');
  let board;
  let filled = new Set();

  function initBoard(){
    if(board) JXG.JSXGraph.freeBoard(board);
    board = JXG.JSXGraph.initBoard('box', {
      boundingbox:[0,1,1,0], axis:false, showCopyright:false,
      showNavigation:false, keepaspectratio:true
    });
  }

  function parseFilled(){
    filled = new Set(
      filledInp.value
        .split(',')
        .map(s=>parseInt(s.trim(),10))
        .filter(n=>!isNaN(n))
    );
  }

  function updateFilledInput(){
    filledInp.value = Array.from(filled).sort((a,b)=>a-b).join(',');
  }

  function togglePart(i, element){
    if(filled.has(i)){
      filled.delete(i);
      element.setAttribute({fillColor:'#fff', fillOpacity:1});
    }else{
      filled.add(i);
      element.setAttribute({fillColor:'#5B2AA5', fillOpacity:1});
    }
    updateFilledInput();
    board.update();
  }

  function gridDims(n){
    let cols = Math.floor(Math.sqrt(n));
    while(n % cols !== 0) cols--;
    const rows = n / cols;
    return {rows, cols};
  }

  function draw(){
    initBoard();
    let n = Math.max(1, parseInt(partsInp.value,10));
    parseFilled();
    const shape = shapeSel.value;
    let division = divSel.value;
    const allowWrong = wrongInp?.checked;
    if(shape==='rectangle' && division==='diagonal') n = 4;
    const gridOpt = divSel.querySelector('option[value="grid"]');
    const vertOpt = divSel.querySelector('option[value="vertical"]');
    if(gridOpt){
      gridOpt.hidden = n % 2 === 1 || (shape==='circle' && !allowWrong) || (shape==='triangle');
      if(gridOpt.hidden && division==='grid') divSel.value = 'horizontal';
    }
    if(vertOpt){
      vertOpt.hidden = (shape==='circle' && !allowWrong);
      if(vertOpt.hidden && division==='vertical') divSel.value = 'horizontal';
    }
    division = divSel.value;
    partsInp.value = String(n);
    if(partsVal) partsVal.textContent = n;
    if(shape==='circle') drawCircle(n, division, allowWrong);
    else if(shape==='rectangle') drawRect(n, division);
    else drawTriangle(n, division, allowWrong);
    applyClip(shape);
  }

  function drawCircle(n, division, allowWrong){
    const r = 0.45;
    const cx = 0.5, cy = 0.5;
    const pointOpts = {visible:false, fixed:true, name:'', label:{visible:false}};
    if(allowWrong && (division==='vertical' || division==='horizontal' || division==='grid')){
      let rows=1, cols=n;
      if(division==='horizontal'){ rows=n; cols=1; }
      else if(division==='grid'){ const d=gridDims(n); rows=d.rows; cols=d.cols; }
      for(let rIdx=0;rIdx<rows;rIdx++){
        for(let cIdx=0;cIdx<cols;cIdx++){
          const idx=rIdx*cols+cIdx;
          const x1=cIdx/cols, x2=(cIdx+1)/cols;
          const y1=rIdx/rows, y2=(rIdx+1)/rows;
          const poly=board.create('polygon', [[x1,y1],[x2,y1],[x2,y2],[x1,y2]], {
            borders:{strokeColor:'#fff', strokeWidth:6},
            vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
            fillColor: filled.has(idx)?'#5B2AA5':'#fff',
            fillOpacity:1,
            highlight:false,
            hasInnerPoints:true,
            fixed:true
          });
          poly.on('down', () => togglePart(idx, poly));
        }
      }
      for(let i=1;i<cols;i++){
        const x=i/cols;
        board.create('segment', [[x,0],[x,1]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true});
      }
      for(let j=1;j<rows;j++){
        const y=j/rows;
        board.create('segment', [[0,y],[1,y]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true});
      }
      board.create('circle', [[cx,cy], r], {
        strokeColor:'#333', strokeWidth:6, fillColor:'none', highlight:false,
        fixed:true, hasInnerPoints:false,
        cssStyle:'pointer-events:none;'
      });
    }else{
      const center = board.create('point', [cx,cy], pointOpts);
      const boundaryPts = [];
      for(let i=0;i<n;i++){
        const a1 = 2*Math.PI*i/n;
        const a2 = 2*Math.PI*(i+1)/n;
        const p1 = board.create('point', [cx + r*Math.cos(a1), cy + r*Math.sin(a1)], pointOpts);
        const p2 = board.create('point', [cx + r*Math.cos(a2), cy + r*Math.sin(a2)], pointOpts);
        boundaryPts.push(p1);
        const sector = board.create('sector', [center, p1, p2], {
          withLines:true,
          strokeColor:'#fff',
          strokeWidth:6,
          fillColor: filled.has(i)?'#5B2AA5':'#fff',
          fillOpacity:1,
          highlight:false,
          hasInnerPoints:true,
          fixed:true
        });
        sector.on('down', () => togglePart(i, sector));
      }
      for(const p of boundaryPts){
        board.create('segment', [center, p], {
          strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
        });
      }
      board.create('circle', [center, r], {
        strokeColor:'#333', strokeWidth:6, fillColor:'none', highlight:false,
        fixed:true, hasInnerPoints:false,
        cssStyle:'pointer-events:none;'
      });
    }
  }

  function drawRect(n, division){
    if(division==='diagonal'){
      const c = [0.5,0.5];
      const corners = [[0,0],[1,0],[1,1],[0,1]];
      for(let i=0;i<4;i++){
        const pts = [corners[i], corners[(i+1)%4], c];
        const poly = board.create('polygon', pts, {
          borders:{strokeColor:'#fff', strokeWidth:6},
          vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
          fillColor: filled.has(i)?'#5B2AA5':'#fff',
          fillOpacity:1,
          highlight:false,
          hasInnerPoints:true,
          fixed:true
        });
        poly.on('down', () => togglePart(i, poly));
        board.create('segment', [c, corners[i]], {
          strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
        });
      }
    }else if(division==='grid'){
      const {rows, cols} = gridDims(n);
      for(let rIdx=0;rIdx<rows;rIdx++){
        for(let cIdx=0;cIdx<cols;cIdx++){
          const idx=rIdx*cols+cIdx;
          const x1=cIdx/cols, x2=(cIdx+1)/cols;
          const y1=rIdx/rows, y2=(rIdx+1)/rows;
          const pts=[[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
          const poly=board.create('polygon', pts, {
            borders:{strokeColor:'#fff', strokeWidth:6},
            vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
            fillColor: filled.has(idx)?'#5B2AA5':'#fff',
            fillOpacity:1,
            highlight:false,
            hasInnerPoints:true,
            fixed:true
          });
          poly.on('down', () => togglePart(idx, poly));
        }
      }
      for(let i=1;i<cols;i++){
        const x=i/cols;
        board.create('segment', [[x,0],[x,1]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true});
      }
      for(let j=1;j<rows;j++){
        const y=j/rows;
        board.create('segment', [[0,y],[1,y]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true});
      }
    }else{
      for(let i=0;i<n;i++){
        let pts;
        if(division==='vertical'){
          const x1 = i/n, x2 = (i+1)/n;
          pts = [[x1,0],[x2,0],[x2,1],[x1,1]];
        }else{ // horizontal
          const y1 = i/n, y2 = (i+1)/n;
          pts = [[0,y1],[1,y1],[1,y2],[0,y2]];
        }
        const poly = board.create('polygon', pts, {
          borders:{strokeColor:'#fff', strokeWidth:6},
          vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
          fillColor: filled.has(i)?'#5B2AA5':'#fff',
          fillOpacity:1,
          highlight:false,
          hasInnerPoints:true,
          fixed:true
        });
        poly.on('down', () => togglePart(i, poly));
      }
      for(let i=1;i<n;i++){
        if(division==='vertical'){
          const x=i/n;
          board.create('segment', [[x,0],[x,1]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
          });
        }else{
          const y=i/n;
          board.create('segment', [[0,y],[1,y]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
          });
        }
      }
    }
    board.create('polygon', [[0,0],[1,0],[1,1],[0,1]], {
      borders:{strokeColor:'#333', strokeWidth:6},
      vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
      fillColor:'none',
      highlight:false,
      fixed:true,
      hasInnerPoints:false,
      cssStyle:'pointer-events:none;'
    });
  }

  function drawTriangle(n, division, allowWrong){
    for(let i=0;i<n;i++){
      let pts;
      if(division==='vertical'){
        const x1=i/n, x2=(i+1)/n;
        if(allowWrong){
          pts=[[x1,0],[x2,0],[x2,1-x2],[x1,1-x1]];
        }else{
          pts=[[x1,0],[x2,0],[0,1]];
        }
      }else if(division==='horizontal'){
        const y1=i/n, y2=(i+1)/n;
        if(allowWrong){
          pts=[[0,y1],[1-y1,y1],[1-y2,y2],[0,y2]];
        }else{
          pts=[[0,y1],[0,y2],[1,0]];
        }
      }else{ // diagonal
        const t1=i/n, t2=(i+1)/n;
        pts=[[1-t1,t1],[1-t2,t2],[0,0]];
      }
      const poly = board.create('polygon', pts, {
        borders:{strokeColor:'#fff', strokeWidth:6},
        vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
        fillColor: filled.has(i)?'#5B2AA5':'#fff',
        fillOpacity:1,
        highlight:false,
        hasInnerPoints:true,
        fixed:true
      });
      poly.on('down', () => togglePart(i, poly));
    }
    if(division==='vertical'){
      for(let i=1;i<n;i++){
        const x=i/n;
        if(allowWrong){
          board.create('segment', [[x,0],[x,1-x]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
          });
        }else{
          board.create('segment', [[x,0],[0,1]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
          });
        }
      }
    }else if(division==='horizontal'){
      for(let i=1;i<n;i++){
        const y=i/n;
        if(allowWrong){
          board.create('segment', [[0,y],[1-y,y]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
          });
        }else{
          board.create('segment', [[0,y],[1,0]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
          });
        }
      }
    }else{ // diagonal
      for(let i=1;i<n;i++){
        const t=i/n;
        board.create('segment', [[1-t,t],[0,0]], {
          strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
        });
      }
    }
    board.create('polygon', [[0,0],[1,0],[0,1]], {
      borders:{strokeColor:'#333', strokeWidth:6},
      vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
      fillColor:'none',
      highlight:false,
      fixed:true,
      hasInnerPoints:false,
      cssStyle:'pointer-events:none;'
    });
  }

  function applyClip(shape){
    const svg = board?.renderer?.svgRoot;
    if(!svg) return;
    if(shape==='triangle'){
      svg.style.clipPath = 'polygon(-2% 102%, 102% 102%, -2% -2%)';
    }else if(shape==='rectangle'){
      svg.style.clipPath = 'polygon(-2% 102%, 102% 102%, 102% -2%, -2% -2%)';
    }else if(shape==='circle'){
      svg.style.clipPath = 'circle(45% at 50% 50%)';
    }else{
      svg.style.clipPath = '';
    }
  }

  shapeSel.addEventListener('change', draw);
  partsInp.addEventListener('input', draw);
  divSel.addEventListener('change', draw);
  filledInp.addEventListener('input', draw);
  wrongInp.addEventListener('change', draw);
  minusBtn?.addEventListener('click', () => {
    let n = parseInt(partsInp.value, 10);
    n = isNaN(n) ? 1 : Math.max(1, n - 1);
    partsInp.value = String(n);
    partsInp.dispatchEvent(new Event('input'));
  });
  plusBtn?.addEventListener('click', () => {
    let n = parseInt(partsInp.value, 10);
    n = isNaN(n) ? 1 : n + 1;
    partsInp.value = String(n);
    partsInp.dispatchEvent(new Event('input'));
  });

  draw();
})();
