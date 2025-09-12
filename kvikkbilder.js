(function(){
  const grid = document.getElementById('brickGrid');
  const inputs = {
    antallX: document.getElementById('antallX'),
    antallY: document.getElementById('antallY'),
    bredde: document.getElementById('bredde'),
    hoyde: document.getElementById('hoyde'),
    dybde: document.getElementById('dybde')
  };

  function render(){
    const x = parseInt(inputs.antallX.value,10) || 0;
    const y = parseInt(inputs.antallY.value,10) || 0;
    const b = parseInt(inputs.bredde.value,10) || 0;
    const h = parseInt(inputs.hoyde.value,10) || 0;
    const d = parseInt(inputs.dybde.value,10) || 0;

    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${x}, auto)`;
    const total = x * y;
    for(let i=0;i<total;i++){
      const img = document.createElement('img');
      img.src = 'images/brick1.svg';
      img.alt = `${b}x${h}x${d} kloss`;
      grid.appendChild(img);
    }
  }

  Object.values(inputs).forEach(inp=>inp.addEventListener('input', render));
  render();
})();
