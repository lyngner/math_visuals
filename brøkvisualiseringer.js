(function(){
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

  function setupFigure(id){
    const shapeSel = document.getElementById(`shape${id}`);
    const partsInp = document.getElementById(`parts${id}`);
    const divSel   = document.getElementById(`division${id}`);
    const filledInp= document.getElementById(`filled${id}`);
    const wrongInp = document.getElementById(`allowWrong${id}`);
    const minusBtn = document.getElementById(`partsMinus${id}`);
    const plusBtn  = document.getElementById(`partsPlus${id}`);
    const partsVal = document.getElementById(`partsVal${id}`);
    const btnSvg   = document.getElementById(`btnSvg${id}`);
    const btnPng   = document.getElementById(`btnPng${id}`);
    const showInp  = document.getElementById(`show${id}`);
    const panel    = document.getElementById(`panel${id}`);
    const toolbar  = btnSvg?.parentElement;
    const colorInputs = [];
    for (let i = 1; ; i++) {
      const inp = document.getElementById(`color${id}_` + i);
      if (!inp) break;
      colorInputs.push(inp);
    }
    let board;
    let filled = new Map();

    function initBoard(){
      if(board) JXG.JSXGraph.freeBoard(board);
      board = JXG.JSXGraph.initBoard(`box${id}`, {
        boundingbox:[0,1,1,0], axis:false, showCopyright:false,
        showNavigation:false, keepaspectratio:true
      });
    }

    function getColors(){
      return colorInputs.map(inp=>inp?.value).filter(Boolean);
    }

    function parseFilled(){
      filled = new Map(
        filledInp.value
          .split(',')
          .map(pair=>pair.split(':').map(t=>parseInt(t.trim(),10)))
          .filter(([i,c])=>!isNaN(i) && !isNaN(c))
      );
    }

    function updateFilledInput(){
      filledInp.value = Array.from(filled.entries())
        .sort((a,b)=>a[0]-b[0])
        .map(([i,c])=>`${i}:${c}`)
        .join(',');
    }

    function togglePart(i, element){
      const colors = getColors();
      const current = filled.get(i) || 0;
      const next = (current + 1) % (colors.length + 1);
      if(next===0){
        filled.delete(i);
        element.setAttribute({fillColor:'#fff', fillOpacity:1});
      }else{
        filled.set(i,next);
        element.setAttribute({fillColor:colors[next-1], fillOpacity:1});
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

    function hasProperFactor(n){
      if(n < 4) return false;
      for(let i=2;i*i<=n;i++){
        if(n % i === 0) return true;
      }
      return false;
    }

    function draw(){
      initBoard();
      let n = Math.max(1, parseInt(partsInp.value,10));
      parseFilled();
      const shape = shapeSel.value;
      let division = divSel.value;
      const allowWrong = wrongInp?.checked;
      if((shape==='rectangle' || shape==='square') && division==='diagonal') n = 4;
      const gridOpt = divSel.querySelector('option[value="grid"]');
      const vertOpt = divSel.querySelector('option[value="vertical"]');
      const triOpt  = divSel.querySelector('option[value="triangular"]');
      if(gridOpt){
        gridOpt.hidden = !hasProperFactor(n) || (shape==='circle' && !allowWrong) || (shape==='triangle');
        if(gridOpt.hidden && division==='grid') divSel.value = 'horizontal';
      }
      if(vertOpt){
        vertOpt.hidden = (shape==='circle' && !allowWrong);
        if(vertOpt.hidden && division==='vertical') divSel.value = 'horizontal';
      }
      if(triOpt){
        triOpt.hidden = (shape!=='triangle');
        if(triOpt.hidden && division==='triangular') divSel.value = 'horizontal';
      }
      division = divSel.value;
      if(shape==='triangle' && division==='triangular'){
        const m = Math.max(1, Math.round(Math.sqrt(n)));
        n = m*m;
      }
      partsInp.value = String(n);
      if(partsVal) partsVal.textContent = n;
      const colors = getColors();
      const colorFor = idx => {
        const c = filled.get(idx);
        return c ? colors[c-1] || '#fff' : '#fff';
      };
      if(shape==='circle') drawCircle(n, division, allowWrong, colorFor);
      else if(shape==='rectangle' || shape==='square') drawRect(n, division, colorFor);
      else drawTriangle(n, division, allowWrong, colorFor);
      applyClip(shape, division);
    }

    function drawCircle(n, division, allowWrong, colorFor){
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
              fillColor: colorFor(idx),
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
          board.create('segment', [[x,0],[x,1]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'});
        }
        for(let j=1;j<rows;j++){
          const y=j/rows;
          board.create('segment', [[0,y],[1,y]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'});
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
              fillColor: colorFor(i),
              fillOpacity:1,
              highlight:false,
              hasInnerPoints:true,
              fixed:true
          });
          sector.on('down', () => togglePart(i, sector));
        }
        for(const p of boundaryPts){
          board.create('segment', [center, p], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
          });
        }
        board.create('circle', [center, r], {
          strokeColor:'#333', strokeWidth:6, fillColor:'none', highlight:false,
          fixed:true, hasInnerPoints:false,
          cssStyle:'pointer-events:none;'
        });
      }
    }

    function drawRect(n, division, colorFor){
      if(division==='diagonal'){
        const c = [0.5,0.5];
        const corners = [[0,0],[1,0],[1,1],[0,1]];
        for(let i=0;i<4;i++){
          const pts = [corners[i], corners[(i+1)%4], c];
          const poly = board.create('polygon', pts, {
            borders:{strokeColor:'#fff', strokeWidth:6},
            vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
            fillColor: colorFor(i),
            fillOpacity:1,
            highlight:false,
            hasInnerPoints:true,
            fixed:true
          });
          poly.on('down', () => togglePart(i, poly));
          board.create('segment', [c, corners[i]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
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
              fillColor: colorFor(idx),
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
          board.create('segment', [[x,0],[x,1]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'});
        }
        for(let j=1;j<rows;j++){
          const y=j/rows;
          board.create('segment', [[0,y],[1,y]], {strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'});
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
            fillColor: colorFor(i),
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
              strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
            });
          }else{
            const y=i/n;
            board.create('segment', [[0,y],[1,y]], {
              strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
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

    function drawTriangle(n, division, allowWrong, colorFor){
      if(division==='triangular'){
        const m = Math.round(Math.sqrt(n));
        const rows=[];
        for(let r=0;r<=m;r++){
          const y=r/m;
          const xStart=0.5 - r/(2*m);
          const row=[];
          for(let c=0;c<=r;c++){
            row.push([xStart + c/m, y]);
          }
          rows.push(row);
        }
        let idx=0;
        for(let r=1;r<=m;r++){
          for(let c=0;c<r;c++){
            const pts=[rows[r][c], rows[r][c+1], rows[r-1][c]];
            const poly=board.create('polygon', pts, {
              borders:{strokeColor:'#fff', strokeWidth:6},
              vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
              fillColor: colorFor(idx),
              fillOpacity:1,
              highlight:false,
              hasInnerPoints:true,
              fixed:true
            });
            poly.on('down', () => togglePart(idx, poly));
            idx++;
          }
        }
        for(let r=0;r<m;r++){
          for(let c=0;c<rows[r].length-1;c++){
            const pts=[rows[r][c], rows[r][c+1], rows[r+1][c+1]];
            const poly=board.create('polygon', pts, {
              borders:{strokeColor:'#fff', strokeWidth:6},
              vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
              fillColor: colorFor(idx),
              fillOpacity:1,
              highlight:false,
              hasInnerPoints:true,
              fixed:true
            });
            poly.on('down', () => togglePart(idx, poly));
            idx++;
          }
        }
        for(let r=1;r<m;r++){
          board.create('segment', [rows[r][0], rows[r][r]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
          });
          board.create('segment', [rows[r][0], rows[m][r]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
          });
          board.create('segment', [rows[r][r], rows[m][m-r]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
          });
        }
        board.create('polygon', [[0,1],[1,1],[0.5,0]], {
          borders:{strokeColor:'#333', strokeWidth:6},
          vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
          fillColor:'none',
          highlight:false,
          fixed:true,
          hasInnerPoints:false,
          cssStyle:'pointer-events:none;'
        });
        return;
      }
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
          fillColor: colorFor(i),
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
              strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
            });
          }else{
            board.create('segment', [[x,0],[0,1]], {
              strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
            });
          }
        }
      }else if(division==='horizontal'){
        for(let i=1;i<n;i++){
          const y=i/n;
          if(allowWrong){
            board.create('segment', [[0,y],[1-y,y]], {
              strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
            });
          }else{
            board.create('segment', [[0,y],[1,0]], {
              strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
            });
          }
        }
      }else{ // diagonal
        for(let i=1;i<n;i++){
          const t=i/n;
          board.create('segment', [[1-t,t],[0,0]], {
            strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true, cssStyle:'pointer-events:none;'
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

    function applyClip(shape, division){
      const svg = board?.renderer?.svgRoot;
      if(!svg) return;
      if(shape==='triangle'){
        if(division==='triangular'){
          svg.style.clipPath = 'polygon(50% -2%, -2% 102%, 102% 102%)';
        }else{
          svg.style.clipPath = 'polygon(-2% 102%, 102% 102%, -2% -2%)';
        }
      }else if(shape==='rectangle' || shape==='square'){
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
    colorInputs.forEach(inp => inp?.addEventListener('input', draw));
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
    btnSvg?.addEventListener('click', () => {
      const svg = board?.renderer?.svgRoot;
      if(svg) downloadSVG(svg, `brok${id}.svg`);
    });
    btnPng?.addEventListener('click', () => {
      const svg = board?.renderer?.svgRoot;
      if(svg) downloadPNG(svg, `brok${id}.png`, 2);
    });
    showInp?.addEventListener('change', () => {
      panel.style.display = showInp.checked ? '' : 'none';
      if(toolbar) toolbar.style.display = showInp.checked ? '' : 'none';
    });
    if(showInp && !showInp.checked){
      panel.style.display='none';
      if(toolbar) toolbar.style.display='none';
    }

    draw();
  }

  setupFigure(1);
  setupFigure(2);
})();

