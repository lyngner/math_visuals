(function(){
  const shapeSel = document.getElementById('shape');
  const partsInp = document.getElementById('parts');
  const divSel   = document.getElementById('division');
  const filledInp= document.getElementById('filled');
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
    const n = Math.max(1, parseInt(partsInp.value,10));
    const filled = parseFilled();
    const shape = shapeSel.value;
    const division = divSel.value;
    if(shape==='circle') drawCircle(n, filled);
    else if(shape==='rectangle') drawRect(n, division, filled);
    else drawTriangle(n, division, filled);
  }

  function drawCircle(n, filled){
    const r = 0.45;
    const cx = 0.5, cy = 0.5;
    const pointOpts = {visible:false, fixed:true, name:'', label:{visible:false}};
    const center = board.create('point', [cx,cy], pointOpts);
    for(let i=0;i<n;i++){
      const a1 = 2*Math.PI*i/n;
      const a2 = 2*Math.PI*(i+1)/n;
      const p1 = board.create('point', [cx + r*Math.cos(a1), cy + r*Math.sin(a1)], pointOpts);
      const p2 = board.create('point', [cx + r*Math.cos(a2), cy + r*Math.sin(a2)], pointOpts);
      board.create('sector', [center, p1, p2], {
        withLines:true,
        strokeColor:'#fff',
        strokeWidth:6,
        fillColor: filled.includes(i)?'#5B2AA5':'#fff',
        fillOpacity:1,
        highlight:false
      });
    }
    board.create('circle', [center, r], {strokeColor:'#333', strokeWidth:6, fillColor:'none', highlight:false});
  }

  function drawRect(n, division, filled){
    for(let i=0;i<n;i++){
      let pts;
      if(division==='vertical'){
        const x1 = i/n, x2 = (i+1)/n;
        pts = [[x1,0],[x2,0],[x2,1],[x1,1]];
      }else if(division==='horizontal'){
        const y1 = i/n, y2 = (i+1)/n;
        pts = [[0,y1],[1,y1],[1,y2],[0,y2]];
      }else{ // diagonal
        const cFromArea = A => (A<=0.5)?Math.sqrt(2*A):2-Math.sqrt(2*(1-A));
        const A1 = i/n, A2 = (i+1)/n;
        const c1 = cFromArea(A1), c2 = cFromArea(A2);
        if(c2<=1){
          pts = [[0,c1],[0,c2],[c2,0],[c1,0]];
        }else if(c1>=1){
          pts = [[c1-1,1],[c2-1,1],[1,c2-1],[1,c1-1]];
        }else{
          pts = [[0,c1],[0,1],[c2-1,1],[1,c2-1],[1,0],[c1,0]];
        }
      }
      board.create('polygon', pts, {
        borders:{strokeColor:'#fff', strokeWidth:6},
        vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
        fillColor: filled.includes(i)?'#5B2AA5':'#fff',
        fillOpacity:1,
        highlight:false
      });
    }
    board.create('polygon', [[0,0],[1,0],[1,1],[0,1]], {
      borders:{strokeColor:'#333', strokeWidth:6},
      vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
      fillColor:'none',
      highlight:false
    });
  }

  function drawTriangle(n, division, filled){
    for(let i=0;i<n;i++){
      let pts;
      if(division==='vertical'){
        const x1=i/n, x2=(i+1)/n;
        pts=[[x1,0],[x2,0],[0,1]];
      }else if(division==='horizontal'){
        const y1=i/n, y2=(i+1)/n;
        pts=[[0,y1],[0,y2],[1,0]];
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
    board.create('polygon', [[0,0],[1,0],[0,1]], {
      borders:{strokeColor:'#333', strokeWidth:6},
      vertices:{visible:false, name:'', fixed:true, label:{visible:false}},
      fillColor:'none',
      highlight:false
    });
  }

  shapeSel.addEventListener('change', draw);
  partsInp.addEventListener('input', draw);
  divSel.addEventListener('change', draw);
  filledInp.addEventListener('input', draw);

  draw();
})();
