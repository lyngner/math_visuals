class ThinkBlock {
  constructor(total = 60) {
    this.total = total;
    this.parts = 1;
    this.root = document.createElement('div');
    this.root.className = 'tb-block-wrapper';

    this.block = document.createElement('div');
    this.block.className = 'tb-block';
    this.root.appendChild(this.block);

    this.stepper = document.createElement('div');
    this.stepper.className = 'tb-stepper';
    this.minus = document.createElement('button');
    this.minus.type = 'button';
    this.minus.textContent = '-';
    this.plus = document.createElement('button');
    this.plus.type = 'button';
    this.plus.textContent = '+';
    this.stepper.append(this.minus, this.plus);
    this.root.appendChild(this.stepper);

    this.minus.addEventListener('click', () => this.setParts(this.parts - 1));
    this.plus.addEventListener('click', () => this.setParts(this.parts + 1));

    this.render();
  }

  setParts(p) {
    this.parts = Math.max(1, p);
    this.render();
  }

  render() {
    this.block.innerHTML = '';
    const value = this.total / this.parts;
    for (let i = 0; i < this.parts; i++) {
      const seg = document.createElement('div');
      seg.className = 'tb-segment';
      seg.textContent = value;
      this.block.appendChild(seg);
    }
  }
}

const container = document.getElementById('blocks');

function addBlock() {
  const tb = new ThinkBlock();
  container.appendChild(tb.root);
}

document.getElementById('addBlock').addEventListener('click', addBlock);
addBlock();
