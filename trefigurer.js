(function(){
  if (typeof THREE === 'undefined') {
    console.error('THREE.js er ikke lastet inn.');
    return;
  }

  const ORBIT_CONTROLS_URL = 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';
  let orbitControlsPromise = null;

  function loadOrbitControls() {
    if (orbitControlsPromise) {
      return orbitControlsPromise;
    }

    if (typeof THREE.OrbitControls === 'function') {
      orbitControlsPromise = Promise.resolve(THREE.OrbitControls);
      return orbitControlsPromise;
    }

    orbitControlsPromise = (async () => {
      try {
        const module = await import(ORBIT_CONTROLS_URL);
        if (module && typeof module.OrbitControls === 'function') {
          THREE.OrbitControls = module.OrbitControls;
          return module.OrbitControls;
        }
        console.warn('Fant ikke OrbitControls-modulen.');
      } catch (error) {
        console.warn('Klarte ikke laste OrbitControls-modulen.', error);
      }
      return null;
    })();

    return orbitControlsPromise;
  }

  const controlsPromise = loadOrbitControls();

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

      if (this.renderer.domElement && this.renderer.domElement.style) {
        this.renderer.domElement.style.touchAction = 'none';
      }

      this.controls = null;
      controlsPromise.then(ControlsClass => {
        if (ControlsClass) {
          this._attachControls(ControlsClass);
        }
      });

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
      this.ground = ground;

      this.shapeGroup = new THREE.Group();
      this.scene.add(this.shapeGroup);

      this.currentFrame = null;
      this.rotationLocked = false;
      this.isFloating = false;
      this.fitMargin = 1.2;

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

    _attachControls(ControlsClass) {
      if (!ControlsClass || this.controls) return;
      const controls = new ControlsClass(this.camera, this.renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.screenSpacePanning = true;
      controls.panSpeed = 0.7;
      controls.rotateSpeed = 0.9;
      controls.zoomSpeed = 0.9;
      controls.minDistance = 2.5;
      controls.maxDistance = 12;
      if (this.currentFrame && this.currentFrame.center) {
        controls.target.copy(this.currentFrame.center);
      } else {
        controls.target.set(0, 1.1, 0);
      }
      controls.addEventListener('start', () => { this.userIsInteracting = true; });
      controls.addEventListener('end', () => {
        this.userIsInteracting = false;
        this._syncStateFromControls();
      });
      controls.addEventListener('change', () => {
        this._syncStateFromControls();
      });
      this.controls = controls;
      if (this.rotationLocked) {
        this.controls.enableRotate = false;
      }
      if (this.currentFrame) {
        const base = this.currentFrame.baseDistance || this.currentFrame.distance;
        this._updateControlsDistances(base, this.currentFrame.distance);
        this.controls.update();
      } else {
        this.controls.update();
      }
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
      this.camera.aspect = width / Math.max(height, 1);
      this.camera.updateProjectionMatrix();
      this._ensureFrameFits();
    }

    _animate() {
      if (!this.rotationLocked && !this.userIsInteracting && this.shapeGroup.children.length) {
        this.shapeGroup.rotation.y += 0.006;
      }
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }

    _computeFitDistance(size) {
      if (!size) return 0;
      const halfFov = THREE.MathUtils.degToRad((this.camera.fov || 35) / 2);
      const safeHalfFov = Math.max(halfFov, 0.001);
      const aspect = this.camera.aspect || 1;
      const halfHeight = Math.max(size.y / 2, 0.01);
      const maxHorizontal = Math.max(size.x, size.z) / 2 || 0.01;
      const distanceForHeight = halfHeight / Math.tan(safeHalfFov);
      const halfHorizontalFov = Math.atan(Math.tan(safeHalfFov) * aspect);
      const safeHalfHorizontal = Math.max(halfHorizontalFov, 0.001);
      const distanceForWidth = maxHorizontal / Math.tan(safeHalfHorizontal);
      return Math.max(distanceForHeight, distanceForWidth);
    }

    _updateControlsDistances(baseDistance, currentDistance = baseDistance) {
      if (!this.controls || !(baseDistance > 0)) return;
      const minDistance = Math.max(0.6, baseDistance * 0.45);
      const maxDistance = Math.max(baseDistance * 3, currentDistance * 1.1, minDistance + 1.5);
      this.controls.minDistance = minDistance;
      this.controls.maxDistance = maxDistance;
    }

    _syncStateFromControls() {
      if (!this.controls || !this.currentFrame) return;
      if (this.currentFrame.center) {
        this.currentFrame.center.copy(this.controls.target);
      }
      this.currentFrame.distance = this.camera.position.distanceTo(this.controls.target);
      const baseDistance = this.currentFrame.baseDistance || this.currentFrame.distance || this.controls.minDistance;
      this._updateControlsDistances(baseDistance, this.currentFrame.distance);
    }

    frameCurrentShape() {
      if (!this.currentShape) return;
      this.currentShape.updateMatrixWorld(true);
      this.shapeGroup.updateMatrixWorld(true);
      const boundingBox = new THREE.Box3().setFromObject(this.currentShape);
      if (boundingBox.isEmpty()) return;
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      const direction = this.camera.position.clone().sub(this.controls ? this.controls.target : center);
      if (!direction.lengthSq()) {
        direction.set(0, 0, 1);
      }
      const requiredDistance = Math.max(this._computeFitDistance(size) * this.fitMargin, 0.5);
      const offset = direction.normalize().multiplyScalar(requiredDistance);
      const newPosition = center.clone().add(offset);
      this.camera.position.copy(newPosition);
      if (this.controls) {
        this.controls.target.copy(center);
        this._updateControlsDistances(requiredDistance, requiredDistance);
        this.controls.update();
      } else {
        this.camera.lookAt(center);
      }
      this.currentFrame = {
        center: center.clone(),
        size: size.clone(),
        baseDistance: requiredDistance,
        distance: requiredDistance
      };
      this.camera.updateProjectionMatrix();
    }

    _ensureFrameFits() {
      if (!this.currentFrame) return;
      const center = this.currentFrame.center;
      const desiredDistance = Math.max(this._computeFitDistance(this.currentFrame.size) * this.fitMargin, 0.5);
      this.currentFrame.baseDistance = desiredDistance;
      const toCamera = this.camera.position.clone().sub(center);
      if (!toCamera.lengthSq()) {
        toCamera.set(0, 0, 1);
      }
      const currentDistance = toCamera.length();
      if (currentDistance + 1e-4 < desiredDistance) {
        const adjusted = toCamera.normalize().multiplyScalar(desiredDistance);
        const newPosition = center.clone().add(adjusted);
        this.camera.position.copy(newPosition);
        if (this.controls) {
          this.controls.update();
        } else {
          this.camera.lookAt(center);
        }
      }
      this.currentFrame.distance = this.camera.position.distanceTo(center);
      this._updateControlsDistances(this.currentFrame.baseDistance, this.currentFrame.distance);
    }

    _applyFloatingOffset() {
      if (!this.currentShape) return;
      this.currentShape.position.set(0, 0, 0);
      this.currentShape.updateMatrixWorld(true);
      if (this.isFloating) {
        const box = new THREE.Box3().setFromObject(this.currentShape);
        if (!box.isEmpty()) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          this.currentShape.position.copy(center.multiplyScalar(-1));
          this.currentShape.updateMatrixWorld(true);
        }
      }
      this.shapeGroup.updateMatrixWorld(true);
    }

    setFloating(isFloating) {
      this.isFloating = Boolean(isFloating);
      if (this.ground) {
        this.ground.visible = !this.isFloating;
      }
      this._applyFloatingOffset();
      this.frameCurrentShape();
    }

    setRotationLocked(isLocked) {
      this.rotationLocked = Boolean(isLocked);
      if (this.rotationLocked) {
        this.userIsInteracting = false;
      }
      if (this.controls) {
        this.controls.enableRotate = !this.rotationLocked;
        this.controls.update();
      }
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
      this.currentFrame = null;
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

    setShape(type) {
      this.disposeCurrentShape();
      if (!type) return;
      this.currentShape = this.createShape(type);
      this.shapeGroup.add(this.currentShape);
      this._applyFloatingOffset();
      this.frameCurrentShape();
    }

    clear() {
      this.disposeCurrentShape();
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
  const lockRotationCheckbox = document.getElementById('chkLockRotation');
  const freeFigureCheckbox = document.getElementById('chkFreeFigure');

  const defaultInput = textarea ? textarea.value : 'kule';
  window.STATE = window.STATE || {};
  if (typeof window.STATE.rawInput !== 'string') {
    window.STATE.rawInput = defaultInput;
  }
  if (!Array.isArray(window.STATE.figures)) {
    window.STATE.figures = [];
  }
  if (typeof window.STATE.rotationLocked !== 'boolean') {
    window.STATE.rotationLocked = lockRotationCheckbox ? lockRotationCheckbox.checked : false;
  }
  if (typeof window.STATE.freeFigure !== 'boolean') {
    window.STATE.freeFigure = freeFigureCheckbox ? freeFigureCheckbox.checked : false;
  }
  if (lockRotationCheckbox) {
    lockRotationCheckbox.checked = window.STATE.rotationLocked;
  }
  if (freeFigureCheckbox) {
    freeFigureCheckbox.checked = window.STATE.freeFigure;
  }

  const applyRotationLock = locked => {
    renderers.forEach(renderer => renderer.setRotationLocked(locked));
  };
  applyRotationLock(window.STATE.rotationLocked);

  const applyFloating = floating => {
    renderers.forEach(renderer => renderer.setFloating(floating));
  };
  applyFloating(window.STATE.freeFigure);

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
      if (info) {
        wrapper.classList.remove('is-hidden');
        renderer.setShape(info.type);
        if (typeof renderer._handleResize === 'function') {
          renderer._handleResize();
        }
      } else {
        renderer.clear();
        wrapper.classList.add('is-hidden');
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

  if (lockRotationCheckbox) {
    lockRotationCheckbox.addEventListener('change', evt => {
      const locked = Boolean(evt.target.checked);
      window.STATE.rotationLocked = locked;
      applyRotationLock(locked);
    });
  }

  if (freeFigureCheckbox) {
    freeFigureCheckbox.addEventListener('change', evt => {
      const floating = Boolean(evt.target.checked);
      window.STATE.freeFigure = floating;
      applyFloating(floating);
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
