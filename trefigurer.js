(function(){
  if (typeof THREE === 'undefined') {
    console.error('THREE.js er ikke lastet inn.');
    return;
  }

  class ShapeRenderer {
    constructor(container) {
      this.container = container;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf6f7fb);

      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      this.camera.position.set(4.2, 3.6, 5.6);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = false;
      this.container.appendChild(this.renderer.domElement);

      this.controls = typeof THREE.OrbitControls === 'function'
        ? new THREE.OrbitControls(this.camera, this.renderer.domElement)
        : null;

      this.defaultCameraPosition = this.camera.position.clone();
      this.defaultTarget = new THREE.Vector3(0, 1.1, 0);

      if (this.controls) {
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 2.5;
        this.controls.maxDistance = 12;
        this.controls.target.copy(this.defaultTarget);
        this.controls.addEventListener('start', () => { this.userIsInteracting = true; });
        this.controls.addEventListener('end', () => { this.userIsInteracting = false; });
      } else {
        this.camera.lookAt(this.defaultTarget);
      }

      this.defaultCameraOffset = this.defaultCameraPosition.clone().sub(this.defaultTarget);
      this.defaultCameraDistance = this.defaultCameraOffset.length();

      const ambient = new THREE.AmbientLight(0xffffff, 0.55);
      this.scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
      keyLight.position.set(5, 8, 6);
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
      fillLight.position.set(-4, 4, -2);
      this.scene.add(fillLight);

      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide
      });
      const ground = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      this.scene.add(ground);

      this.shapeGroup = new THREE.Group();
      this.scene.add(this.shapeGroup);

      this._animate = this._animate.bind(this);
      this._handleResize = this._handleResize.bind(this);

      if (typeof ResizeObserver === 'function') {
        this.resizeObserver = new ResizeObserver(() => this._handleResize());
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener('resize', this._handleResize);
      }

      this._handleResize();
      this.renderer.setAnimationLoop(this._animate);
    }

    _handleResize() {
      const width = this.container.clientWidth;
      if (!width) return;

      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : null;
      const maxHeight = viewportHeight ? viewportHeight * 0.7 : Infinity;
      const preferred = width * 0.72;
      const height = Math.max(280, Math.min(Math.round(preferred), 560, maxHeight));

      this.container.style.height = `${height}px`;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    _animate() {
      if (!this.userIsInteracting && this.shapeGroup.children.length) {
        this.shapeGroup.rotation.y += 0.006;
      }
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }

    disposeCurrentShape() {
      if (!this.currentShape) return;
      this.shapeGroup.remove(this.currentShape);
      this.currentShape.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose());
          } else if (typeof obj.material.dispose === 'function') {
            obj.material.dispose();
          }
        }
      });
      this.currentShape = null;
      this.shapeGroup.rotation.set(0, 0, 0);
    }

    createMaterial(color) {
      return new THREE.MeshStandardMaterial({
        color,
        metalness: 0,
        roughness: 0.36,
        flatShading: true
      });
    }

    createEdges(geometry, color = 0x1f2937) {
      return new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color })
      );
    }

    createShape(type) {
      const group = new THREE.Group();
      let geometry;
      let rotationY = 0;
      let materialColor = 0x3b82f6;

      switch (type) {
        case 'sphere': {
          const radius = 1.35;
          geometry = new THREE.SphereGeometry(radius, 40, 32);
          geometry.translate(0, radius, 0);
          materialColor = 0x6366f1;
          break;
        }
        case 'pyramid': {
          const height = 2.8;
          const radius = 1.7;
          geometry = new THREE.ConeGeometry(radius, height, 4, 1);
          geometry.translate(0, height / 2, 0);
          rotationY = Math.PI / 4;
          materialColor = 0xf59e0b;
          break;
        }
        case 'triangular-cylinder': {
          const height = 3;
          const radius = 1.6;
          geometry = new THREE.CylinderGeometry(radius, radius, height, 3, 1, false);
          geometry.translate(0, height / 2, 0);
          rotationY = Math.PI / 6;
          materialColor = 0x0ea5e9;
          break;
        }
        case 'square-cylinder': {
          const height = 3.2;
          const radius = 1.55;
          geometry = new THREE.CylinderGeometry(radius, radius, height, 4, 1, false);
          geometry.translate(0, height / 2, 0);
          rotationY = Math.PI / 4;
          materialColor = 0x10b981;
          break;
        }
        case 'cylinder': {
          const height = 3.2;
          const radius = 1.6;
          geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, false);
          geometry.translate(0, height / 2, 0);
          materialColor = 0x0ea5e9;
          break;
        }
        case 'prism':
        default: {
          const width = 2.6;
          const height = 2.2;
          const depth = 1.8;
          geometry = new THREE.BoxGeometry(width, height, depth);
          geometry.translate(0, height / 2, 0);
          materialColor = 0x3b82f6;
          break;
        }
      }

      const mesh = new THREE.Mesh(geometry, this.createMaterial(materialColor));
      group.add(mesh);
      if (type !== 'sphere') {
        const edges = this.createEdges(geometry);
        group.add(edges);
      }
      group.rotation.y = rotationY;
      return group;
    }

    focusCurrentShape() {
      if (!this.currentShape || !this.defaultCameraOffset) return;

      const box = new THREE.Box3().setFromObject(this.currentShape);
      if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) / 2;

      const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
      const minDistance = radius > 0 ? radius / Math.sin(Math.max(halfFov, 0.0001)) : 0;
      const desiredDistance = Math.max(this.defaultCameraDistance, minDistance * 1.1);

      const offsetDir = this.defaultCameraOffset.clone();
      if (!offsetDir.lengthSq()) return;
      const offset = offsetDir.normalize().multiplyScalar(desiredDistance);
      const cameraPosition = center.clone().add(offset);
      this.camera.position.copy(cameraPosition);

      if (this.controls) {
        this.controls.target.copy(center);
        this.controls.update();
      } else {
        this.camera.lookAt(center);
      }
    }

    setShape(type) {
      this.disposeCurrentShape();
      if (!type) return;
      this.currentShape = this.createShape(type);
      this.shapeGroup.add(this.currentShape);
      this.focusCurrentShape();
    }

    clear() {
      this.disposeCurrentShape();
      this.camera.position.copy(this.defaultCameraPosition);
      if (this.controls) {
        this.controls.target.copy(this.defaultTarget);
        this.controls.update();
      } else {
        this.camera.lookAt(this.defaultTarget);
      }
    }
  }

  const grid = document.getElementById('figureGrid');
  const figureWrappers = Array.from(document.querySelectorAll('[data-figure-index]'));
  const renderers = figureWrappers.map(wrapper => {
    const canvasWrap = wrapper.querySelector('.figureCanvas');
    return new ShapeRenderer(canvasWrap);
  });

  const textarea = document.getElementById('inpSpecs');
  const drawBtn = document.getElementById('btnDraw');

  const defaultInput = textarea ? textarea.value : 'kule';
  window.STATE = window.STATE || {};
  if (typeof window.STATE.rawInput !== 'string') {
    window.STATE.rawInput = defaultInput;
  }
  if (!Array.isArray(window.STATE.figures)) {
    window.STATE.figures = [];
  }

  function detectType(line) {
    const normalized = line.toLowerCase();
    if (normalized.includes('kule')) return 'sphere';
    if (normalized.includes('pyram')) return 'pyramid';
    if (normalized.includes('trekant') && normalized.includes('sylinder')) return 'triangular-cylinder';
    if (normalized.includes('firkant') && normalized.includes('sylinder')) return 'square-cylinder';
    if (normalized.includes('kvadrat') && normalized.includes('sylinder')) return 'square-cylinder';
    if (normalized.includes('sylinder')) return 'cylinder';
    if (normalized.includes('prism')) return 'prism';
    return 'prism';
  }

  function parseInput(rawInput) {
    const lines = rawInput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const figures = [];
    for (const line of lines) {
      const type = detectType(line);
      figures.push({ input: line, type });
      if (figures.length >= renderers.length) break;
    }
    return figures;
  }

  function updateForm(rawInput) {
    if (textarea && textarea.value !== rawInput) {
      textarea.value = rawInput;
    }
  }

  function updateFigures(figures) {
    const count = Math.max(figures.length, 1);
    if (grid) {
      grid.dataset.figures = String(count);
    }
    figureWrappers.forEach((wrapper, index) => {
      const renderer = renderers[index];
      const info = figures[index];
      const label = wrapper.querySelector('.figureLabel');
      if (info) {
        wrapper.classList.remove('is-hidden');
        renderer.setShape(info.type);
        if (typeof renderer._handleResize === 'function') {
          renderer._handleResize();
        }
        if (label) label.textContent = info.input;
      } else {
        renderer.clear();
        wrapper.classList.add('is-hidden');
        if (label) label.textContent = '';
      }
    });
  }

  function draw() {
    const rawInput = typeof window.STATE.rawInput === 'string' ? window.STATE.rawInput : defaultInput;
    const figures = parseInput(rawInput);
    window.STATE.rawInput = rawInput;
    window.STATE.figures = figures;
    updateForm(rawInput);
    updateFigures(figures);
  }

  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      window.STATE.rawInput = textarea ? textarea.value : '';
      draw();
    });
  }

  if (textarea) {
    textarea.addEventListener('keydown', evt => {
      if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
        evt.preventDefault();
        window.STATE.rawInput = textarea.value;
        draw();
      }
    });
  }

  window.draw = draw;

  draw();
})();
