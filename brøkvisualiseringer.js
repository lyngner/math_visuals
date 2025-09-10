(function(){
  const shapeSel = document.getElementById('shape');
  const partsInp = document.getElementById('parts');
  const divSel   = document.getElementById('division');
  const filledInp= document.getElementById('filled');
  const wrongInp = document.getElementById('allowWrong');
  let board;

  function initBoard(){
    if(board) JXG.JSXGraph.freeBoard(board);
    board = JXG.JSXGraph.initBoard('box', {
      boundingbox:[0,1,1,0], axis:false, showCopyright:false,
      showNavigation:false, keepaspectratio:true
    });
  }

  function parseFilled(){
    return filledInp.value.split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  }

  function draw(){
    initBoard();
    let n = Math.max(1, parseInt(partsInp.value,10));
    const filled = parseFilled();
    const shape = shapeSel.value;
    const division = divSel.value;
    const allowWrong = wrongInp?.checked;
    if(shape==='rectangle' && division==='diagonal') n = 4;
    if(shape==='circle') drawCircle(n, filled);
    else if(shape==='rectangle') drawRect(n, division, filled);
    else drawTriangle(n, division, filled, allowWrong);
    applyClip(shape);
  }

  function drawCircle(n, filled){
    const r = 0.45;
    const cx = 0.5, cy = 0.5;
    const pointOpts = {visible:false, fixed:true, name:'', label:{visible:false}};
    const center = board.create('point', [cx,cy], pointOpts);
    const boundaryPts = [];
    for(let i=0;i<n;i++){
      const a1 = 2*Math.PI*i/n;
      const a2 = 2*Math.PI*(i+1)/n;
      const p1 = board.create('point', [cx + r*Math.cos(a1), cy + r*Math.sin(a1)], pointOpts);
      const p2 = board.create('point', [cx + r*Math.cos(a2), cy + r*Math.sin(a2)], pointOpts);
      boundaryPts.push(p1);
      board.create('sector', [center, p1, p2], {
        withLines:true,
        strokeColor:'#fff',
        strokeWidth:6,
        fillColor: filled.includes(i)?'#5B2AA5':'#fff',
        fillOpacity:1,
        highlight:false
      });
    }
    for(const p of boundaryPts){
      board.create('segment', [center, p], {
        strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
      });
    }
    board.create('circle', [center, r], {strokeColor:'#333', strokeWidth:6, fillColor:'none', highlight:false});
  }

  function drawRect(n, division, filled){
    if(division==='diagonal'){
      const c = [0.5,0.5];
      const corners = [[0,0],[1,0],[1,1],[0,1]];
      for(let i=0;i<4;i++){
        const pts = [corners[i], corners[(i+1)%4], c];
        board.create('polygon', pts, {
          borders:{strokeColor:'#fff', strokeWidth:6},
          vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
          fillColor: filled.includes(i)?'#5B2AA5':'#fff',
          fillOpacity:1,
          highlight:false
        });
        board.create('segment', [c, corners[i]], {
          strokeColor:'#000', strokeWidth:2, dash:2, highlight:false, fixed:true
        });
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
        board.create('polygon', pts, {
          borders:{strokeColor:'#fff', strokeWidth:6},
          vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
          fillColor: filled.includes(i)?'#5B2AA5':'#fff',
          fillOpacity:1,
          highlight:false
        });
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
      highlight:false
    });
  }

  function drawTriangle(n, division, filled, allowWrong){
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
      board.create('polygon', pts, {
        borders:{strokeColor:'#fff', strokeWidth:6},
        vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
        fillColor: filled.includes(i)?'#5B2AA5':'#fff',
        fillOpacity:1,
        highlight:false
      });
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
      highlight:false
    });
  }

  function applyClip(shape){
    const svg = board?.renderer?.svgRoot;
    if(!svg) return;
    if(shape==='triangle'){
      svg.style.clipPath = 'polygon(-2% 102%, 102% 102%, -2% -2%)';
    }else if(shape==='rectangle'){
      svg.style.clipPath = 'polygon(-2% 102%, 102% 102%, 102% -2%, -2% -2%)';
    }else{
      svg.style.clipPath = '';
    }
  }

  shapeSel.addEventListener('change', draw);
  partsInp.addEventListener('input', draw);
  divSel.addEventListener('change', draw);
  filledInp.addEventListener('input', draw);
  wrongInp.addEventListener('change', draw);

  draw();
})();
