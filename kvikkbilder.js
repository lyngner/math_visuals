(function(){
  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgBredde = document.getElementById('cfg-bredde');
  const cfgHoyde = document.getElementById('cfg-hoyde');
  const cfgDybde = document.getElementById('cfg-dybde');
  const brickContainer = document.getElementById('brickContainer');
  const expression = document.getElementById('expression');

  function render(){
    const antallX = parseInt(cfgAntallX.value,10) || 0;
    const antallY = parseInt(cfgAntallY.value,10) || 0;
    const bredde = parseInt(cfgBredde.value,10) || 0;
    const hoyde = parseInt(cfgHoyde.value,10) || 0;
    const dybde = parseInt(cfgDybde.value,10) || 0;

    brickContainer.innerHTML = '';
    brickContainer.style.gridTemplateColumns = `repeat(${antallX}, auto)`;
    for(let i = 0; i < antallX * antallY; i++){
      const img = document.createElement('img');
      img.src = 'images/brick1.svg';
      img.alt = `${bredde}x${hoyde}x${dybde} kloss`;
      brickContainer.appendChild(img);
    }

    const total = antallX * antallY * bredde * hoyde * dybde;
    expression.textContent = `${antallX} × ${antallY} × ${bredde} × ${hoyde} × ${dybde} = ${total}`;
  }

  [cfgAntallX, cfgAntallY, cfgBredde, cfgHoyde, cfgDybde].forEach(el =>{
    el.addEventListener('input', render);
  });

  render();
})();
