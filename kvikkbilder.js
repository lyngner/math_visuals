(function(){
  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgBredde = document.getElementById('cfg-bredde');
  const cfgHoyde = document.getElementById('cfg-hoyde');
  const cfgDybde = document.getElementById('cfg-dybde');
  const brickContainer = document.getElementById('brickContainer');
  const expression = document.getElementById('expression');

  function iso(x,y,z,tileW,tileH,unitH){
    return {
      x:(x - y) * tileW/2,
      y:(x + y) * tileH/2 - z * unitH
    };
  }

  function createBrick(bredde, hoyde, dybde){
    const tileW = 50;
    const tileH = 25;
    const unitH = 25;
    const p = (x,y,z)=>iso(x,y,z,tileW,tileH,unitH);

    const corners = {
      tfl: p(0,0,hoyde),
      tfr: p(bredde,0,hoyde),
      tbr: p(bredde,dybde,hoyde),
      tbl: p(0,dybde,hoyde),
      bfl: p(0,0,0),
      bfr: p(bredde,0,0),
      bbr: p(bredde,dybde,0),
      bbl: p(0,dybde,0)
    };

    const xs = Object.values(corners).map(c=>c.x);
    const ys = Object.values(corners).map(c=>c.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;

    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    function pt(c){ return `${c.x - minX},${c.y - minY}`; }

    const left = document.createElementNS(svg.namespaceURI,'polygon');
    left.setAttribute('points',[corners.tbl,corners.tfl,corners.bfl,corners.bbl].map(pt).join(' '));
    left.setAttribute('fill','#cf3a8f');
    left.setAttribute('stroke','#af207a');
    left.setAttribute('stroke-linejoin','round');
    svg.appendChild(left);

    const right = document.createElementNS(svg.namespaceURI,'polygon');
    right.setAttribute('points',[corners.tfr,corners.tbr,corners.bbr,corners.bfr].map(pt).join(' '));
    right.setAttribute('fill','#df76ae');
    right.setAttribute('stroke','#af207a');
    right.setAttribute('stroke-linejoin','round');
    svg.appendChild(right);

    const top = document.createElementNS(svg.namespaceURI,'polygon');
    top.setAttribute('points',[corners.tfl,corners.tfr,corners.tbr,corners.tbl].map(pt).join(' '));
    top.setAttribute('fill','#eca7cb');
    top.setAttribute('stroke','#af207a');
    top.setAttribute('stroke-linejoin','round');
    svg.appendChild(top);

    // Grid lines on top
    for(let x=1;x<bredde;x++){
      const l = document.createElementNS(svg.namespaceURI,'line');
      const a = p(x,0,hoyde), b = p(x,dybde,hoyde);
      l.setAttribute('x1',a.x-minX); l.setAttribute('y1',a.y-minY);
      l.setAttribute('x2',b.x-minX); l.setAttribute('y2',b.y-minY);
      l.setAttribute('stroke','#af207a');
      svg.appendChild(l);
    }
    for(let y=1;y<dybde;y++){
      const l = document.createElementNS(svg.namespaceURI,'line');
      const a = p(0,y,hoyde), b = p(bredde,y,hoyde);
      l.setAttribute('x1',a.x-minX); l.setAttribute('y1',a.y-minY);
      l.setAttribute('x2',b.x-minX); l.setAttribute('y2',b.y-minY);
      l.setAttribute('stroke','#af207a');
      svg.appendChild(l);
    }

    // Grid lines on sides
    for(let z=1; z<hoyde; z++){
      // left side horizontal
      const l1 = document.createElementNS(svg.namespaceURI,'line');
      const la = p(0,0,z), lb = p(0,dybde,z);
      l1.setAttribute('x1',la.x-minX); l1.setAttribute('y1',la.y-minY);
      l1.setAttribute('x2',lb.x-minX); l1.setAttribute('y2',lb.y-minY);
      l1.setAttribute('stroke','#af207a');
      svg.appendChild(l1);

      // right side horizontal
      const l2 = document.createElementNS(svg.namespaceURI,'line');
      const ra = p(bredde,0,z), rb = p(bredde,dybde,z);
      l2.setAttribute('x1',ra.x-minX); l2.setAttribute('y1',ra.y-minY);
      l2.setAttribute('x2',rb.x-minX); l2.setAttribute('y2',rb.y-minY);
      l2.setAttribute('stroke','#af207a');
      svg.appendChild(l2);
    }
    for(let x=1;x<bredde;x++){
      const l = document.createElementNS(svg.namespaceURI,'line');
      const a = p(x,0,0), b = p(x,0,hoyde);
      l.setAttribute('x1',a.x-minX); l.setAttribute('y1',a.y-minY);
      l.setAttribute('x2',b.x-minX); l.setAttribute('y2',b.y-minY);
      l.setAttribute('stroke','#af207a');
      svg.appendChild(l);
    }
    for(let y=1;y<dybde;y++){
      const l = document.createElementNS(svg.namespaceURI,'line');
      const a = p(0,y,0), b = p(0,y,hoyde);
      l.setAttribute('x1',a.x-minX); l.setAttribute('y1',a.y-minY);
      l.setAttribute('x2',b.x-minX); l.setAttribute('y2',b.y-minY);
      l.setAttribute('stroke','#af207a');
      svg.appendChild(l);
    }

    // Studs
    const rx = tileW/4;
    const ry = tileH/4;
    for(let x=0;x<bredde;x++){
      for(let y=0;y<dybde;y++){
        const c = p(x+0.5, y+0.5, hoyde);
        const e = document.createElementNS(svg.namespaceURI,'ellipse');
        e.setAttribute('cx', c.x - minX);
        e.setAttribute('cy', c.y - minY);
        e.setAttribute('rx', rx);
        e.setAttribute('ry', ry);
        e.setAttribute('fill','#eca7cb');
        e.setAttribute('stroke','#af207a');
        svg.appendChild(e);
      }
    }

    return svg;
  }

  function render(){
    const antallX = parseInt(cfgAntallX.value,10) || 0;
    const antallY = parseInt(cfgAntallY.value,10) || 0;
    const bredde = parseInt(cfgBredde.value,10) || 0;
    const hoyde = parseInt(cfgHoyde.value,10) || 0;
    const dybde = parseInt(cfgDybde.value,10) || 0;

    brickContainer.innerHTML = '';
    brickContainer.style.gridTemplateColumns = `repeat(${antallX}, auto)`;
    for(let i = 0; i < antallX * antallY; i++){
      const fig = createBrick(bredde, hoyde, dybde);
      fig.setAttribute('aria-label', `${bredde}x${hoyde}x${dybde} kloss`);
      brickContainer.appendChild(fig);
    }

    const total = antallX * antallY * bredde * hoyde * dybde;
    expression.textContent = `${antallX} × ${antallY} × ${bredde} × ${hoyde} × ${dybde} = ${total}`;
  }

  [cfgAntallX, cfgAntallY, cfgBredde, cfgHoyde, cfgDybde].forEach(el =>{
    el.addEventListener('input', render);
  });

  render();
})();
