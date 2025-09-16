(function(){
  if (typeof THREE === 'undefined') {
    console.error('THREE.js er ikke lastet inn.');
    return;
  }

  const ORBIT_CONTROLS_MODULE_URL = 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';
  const ORBIT_CONTROLS_SCRIPT_SRC = (() => {
    if (typeof document === 'undefined') {
      return 'vendor/three/examples/js/controls/OrbitControls.js';
    }
    const current = document.currentScript;
    if (current && current.src) {
      try {
        return new URL('./vendor/three/examples/js/controls/OrbitControls.js', current.src).href;
      } catch (_) {
        // ignore and fall back to relative path below
      }
    }
    return 'vendor/three/examples/js/controls/OrbitControls.js';
  })();
  let orbitControlsPromise = null;

  function ensureOrbitControlsScript() {
    if (typeof document === 'undefined') {
      return Promise.resolve('failed');
    }
    const existing = document.querySelector('script[data-orbit-controls]');
    if (existing) {
      const state = existing.dataset.loaded;
      if (state === 'true') return Promise.resolve('loaded');
      if (state === 'false') return Promise.resolve('failed');
      return new Promise(resolve => {
        const handleLoad = () => {
          existing.dataset.loaded = 'true';
          resolve('loaded');
        };
        const handleError = () => {
          existing.dataset.loaded = 'false';
          resolve('failed');
        };
        existing.addEventListener('load', handleLoad, { once: true });
        existing.addEventListener('error', handleError, { once: true });
      });
    }

    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = ORBIT_CONTROLS_SCRIPT_SRC;
      script.async = true;
      script.dataset.orbitControls = 'true';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve('loaded');
      }, { once: true });
      script.addEventListener('error', () => {
        script.dataset.loaded = 'false';
        resolve('failed');
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  function getGlobalOrbitControls() {
    return (typeof THREE !== 'undefined' && typeof THREE.OrbitControls === 'function')
      ? THREE.OrbitControls
      : null;
  }

  function loadOrbitControls() {
    if (orbitControlsPromise) {
      return orbitControlsPromise;
    }

    orbitControlsPromise = (async () => {
      const globalControls = getGlobalOrbitControls();
      if (globalControls) {
        return globalControls;
      }

      const scriptStatus = await ensureOrbitControlsScript();
      const scriptedControls = getGlobalOrbitControls();
      if (scriptedControls) {
        return scriptedControls;
      }

      if (scriptStatus === 'failed') {
        try {
          const module = await import(ORBIT_CONTROLS_MODULE_URL);
          if (module && typeof module.OrbitControls === 'function') {
            THREE.OrbitControls = module.OrbitControls;
            return module.OrbitControls;
          }
          console.warn('Fant ikke OrbitControls-modulen.');
        } catch (error) {
          console.warn('Klarte ikke laste OrbitControls-modulen.', error);
        }
      }

      return getGlobalOrbitControls();
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
      const geometryBox = this._computeGeometryBoundingBox(this.currentShape);
      const fullBox = new THREE.Box3().setFromObject(this.currentShape);
      const effectiveBox = fullBox.isEmpty() ? geometryBox : fullBox;
      if (!effectiveBox || effectiveBox.isEmpty()) return;
      const size = new THREE.Vector3();
      effectiveBox.getSize(size);
      const center = geometryBox && !geometryBox.isEmpty()
        ? geometryBox.getCenter(new THREE.Vector3())
        : effectiveBox.getCenter(new THREE.Vector3());
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

    _computeGeometryBoundingBox(object) {
      if (!object) return null;
      object.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const tempBox = new THREE.Box3();
      let hasBox = false;
      object.traverse(node => {
        if (!node.visible) return;
        if (node.userData && node.userData.isMeasurement) return;
        const geometry = node.geometry;
        if (!geometry) return;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (!geometry.boundingBox) return;
        tempBox.copy(geometry.boundingBox);
        tempBox.applyMatrix4(node.matrixWorld);
        if (!hasBox) {
          box.copy(tempBox);
          hasBox = true;
        } else {
          box.union(tempBox);
        }
      });
      return hasBox ? box : null;
    }

    _applyFloatingOffset() {
      if (!this.currentShape) return;
      this.currentShape.position.set(0, 0, 0);
      this.currentShape.updateMatrixWorld(true);
      if (this.isFloating) {
        const geometryBox = this._computeGeometryBoundingBox(this.currentShape);
        if (geometryBox && !geometryBox.isEmpty()) {
          const center = new THREE.Vector3();
          geometryBox.getCenter(center);
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
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach(mat => {
            if (mat && mat.map && typeof mat.map.dispose === 'function') {
              mat.map.dispose();
            }
            if (mat && typeof mat.dispose === 'function') {
              mat.dispose();
            }
          });
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

    createLabelSprite(text) {
      if (typeof text !== 'string') return null;
      const trimmed = text.trim();
      if (!trimmed) return null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      const fontSize = 48;
      const paddingX = 26;
      const paddingY = 18;
      context.font = `${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
      const metrics = context.measureText(trimmed);
      const rawWidth = metrics.width + paddingX * 2;
      const rawHeight = fontSize + paddingY * 2;
      const deviceRatio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const ratio = Math.min(Math.max(deviceRatio, 1), 2);
      canvas.width = Math.ceil(rawWidth * ratio);
      canvas.height = Math.ceil(rawHeight * ratio);
      context.scale(ratio, ratio);
      context.font = `${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const width = rawWidth;
      const height = rawHeight;
      const borderRadius = Math.min(18, Math.min(width, height) / 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.96)';
      context.strokeStyle = 'rgba(148, 163, 184, 0.85)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(borderRadius, 0);
      context.lineTo(width - borderRadius, 0);
      context.quadraticCurveTo(width, 0, width, borderRadius);
      context.lineTo(width, height - borderRadius);
      context.quadraticCurveTo(width, height, width - borderRadius, height);
      context.lineTo(borderRadius, height);
      context.quadraticCurveTo(0, height, 0, height - borderRadius);
      context.lineTo(0, borderRadius);
      context.quadraticCurveTo(0, 0, borderRadius, 0);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = '#111827';
      context.fillText(trimmed, width / 2, height / 2 + 2);

      const texture = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const worldScale = 0.0052;
      sprite.scale.set(width * worldScale, height * worldScale, 1);
      sprite.renderOrder = 10;
      sprite.userData.isMeasurement = true;
      return sprite;
    }

    addMeasurementLine(targetGroup, start, end, options = {}) {
      if (!targetGroup || !start || !end) return;
      const points = [start.clone(), end.clone()];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: options.color ?? 0x111827 });
      const line = new THREE.Line(geometry, material);
      line.userData.isMeasurement = true;
      targetGroup.add(line);

      const labelText = typeof options.label === 'string' ? options.label.trim() : '';
      if (labelText.length) {
        const sprite = this.createLabelSprite(labelText);
        if (sprite) {
          if (options.labelPosition) {
            sprite.position.copy(options.labelPosition.clone());
          } else {
            const mid = start.clone().add(end).multiplyScalar(0.5);
            if (options.labelOffset) {
              mid.add(options.labelOffset.clone());
            }
            sprite.position.copy(mid);
          }
          targetGroup.add(sprite);
        }
      }
    }

    addRadiusMeasurement(targetGroup, dims, spec, type) {
      const radiusValue = typeof dims.radius === 'number' && Number.isFinite(dims.radius) ? dims.radius : null;
      if (!(radiusValue > 0)) return;
      const label = typeof spec?.label === 'string' ? spec.label : '';
      const hasLabel = label.trim().length > 0;
      let start;
      let end;
      let labelOffset = null;
      if (type === 'sphere') {
        start = new THREE.Vector3(0, radiusValue, 0);
        end = new THREE.Vector3(radiusValue, radiusValue, 0);
        if (hasLabel) {
          labelOffset = new THREE.Vector3(0, 0.24, 0);
        }
      } else {
        const heightValue = typeof dims.height === 'number' && Number.isFinite(dims.height) ? dims.height : null;
        let baseY = 0.2;
        if (heightValue && heightValue > 0.2) {
          baseY = Math.min(Math.max(heightValue * 0.12, 0.15), heightValue - 0.15);
        }
        start = new THREE.Vector3(0, baseY, 0);
        end = new THREE.Vector3(radiusValue, baseY, 0);
        if (hasLabel) {
          labelOffset = new THREE.Vector3(0, 0.22, 0);
        }
      }
      const options = { color: 0xef4444, label };
      if (labelOffset) options.labelOffset = labelOffset;
      this.addMeasurementLine(targetGroup, start, end, options);
    }

    addHeightMeasurement(targetGroup, dims, spec) {
      const heightValue = typeof dims.height === 'number' && Number.isFinite(dims.height) ? dims.height : null;
      if (!(heightValue > 0)) return;
      const label = typeof spec?.label === 'string' ? spec.label : '';
      const radiusValue = typeof dims.radius === 'number' && Number.isFinite(dims.radius) ? dims.radius : null;
      const halfWidth = typeof dims.width === 'number' && Number.isFinite(dims.width) ? dims.width / 2 : null;
      const halfDepth = typeof dims.depth === 'number' && Number.isFinite(dims.depth) ? dims.depth / 2 : null;
      let offset = radiusValue;
      if (!(offset > 0)) {
        const extent = Math.max(halfWidth || 0, halfDepth || 0);
        offset = extent;
      }
      if (!(offset > 0)) offset = 1.2;
      const margin = 0.35;
      const lineX = offset + margin;
      const start = new THREE.Vector3(lineX, 0, 0);
      const end = new THREE.Vector3(lineX, heightValue, 0);
      let labelPosition = null;
      if (label.trim().length) {
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const center = new THREE.Vector3(0, heightValue / 2, 0);
        const away = start.clone().sub(center);
        away.y = 0;
        if (!away.lengthSq()) {
          away.set(0.3, 0, 0);
        } else {
          away.setLength(0.35);
        }
        away.y = 0.18;
        labelPosition = midpoint.add(away);
      }
      const options = { color: 0xf97316, label };
      if (labelPosition) options.labelPosition = labelPosition;
      this.addMeasurementLine(targetGroup, start, end, options);
    }

    applyMeasurements(group, spec, dims, type) {
      if (!group || !spec || typeof spec !== 'object') return;
      const dimensionSpec = spec.dimensions;
      if (!dimensionSpec) return;
      const measurementGroup = new THREE.Group();
      measurementGroup.name = 'measurements';
      measurementGroup.userData.isMeasurement = true;
      if (dimensionSpec.radius && dimensionSpec.radius.requested) {
        this.addRadiusMeasurement(measurementGroup, dims, dimensionSpec.radius, type);
      }
      if (dimensionSpec.height && dimensionSpec.height.requested) {
        this.addHeightMeasurement(measurementGroup, dims, dimensionSpec.height, type);
      }
      if (measurementGroup.children.length) {
        group.add(measurementGroup);
      }
    }

    createShape(spec) {
      const resolvedType = spec && typeof spec === 'object' && spec.type ? spec.type : spec;
      const type = typeof resolvedType === 'string' ? resolvedType : 'prism';
      const group = new THREE.Group();
      const dims = { radius: null, height: null, width: null, depth: null };
      let geometry;
      let rotationY = 0;
      let materialColor = 0x3b82f6;

      switch (type) {
        case 'sphere': {
          const radius = 1.35;
          geometry = new THREE.SphereGeometry(radius, 40, 32);
          geometry.translate(0, radius, 0);
          materialColor = 0x6366f1;
          dims.radius = radius;
          dims.height = radius * 2;
          break;
        }
        case 'pyramid': {
          const height = 2.8;
          const radius = 1.7;
          geometry = new THREE.ConeGeometry(radius, height, 4, 1);
          geometry.translate(0, height / 2, 0);
          rotationY = Math.PI / 4;
          materialColor = 0xf59e0b;
          dims.radius = radius;
          dims.height = height;
          const baseWidth = Math.sqrt(2) * radius;
          dims.width = baseWidth;
          dims.depth = baseWidth;
          break;
        }
        case 'triangular-cylinder': {
          const height = 3;
          const radius = 1.6;
          geometry = new THREE.CylinderGeometry(radius, radius, height, 3, 1, false);
          geometry.translate(0, height / 2, 0);
          rotationY = Math.PI / 6;
          materialColor = 0x0ea5e9;
          dims.radius = radius;
          dims.height = height;
          break;
        }
        case 'square-cylinder': {
          const height = 3.2;
          const radius = 1.55;
          geometry = new THREE.CylinderGeometry(radius, radius, height, 4, 1, false);
          geometry.translate(0, height / 2, 0);
          rotationY = Math.PI / 4;
          materialColor = 0x10b981;
          dims.radius = radius;
          dims.height = height;
          break;
        }
        case 'cylinder': {
          const height = 3.2;
          const radius = 1.6;
          geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, false);
          geometry.translate(0, height / 2, 0);
          materialColor = 0x0ea5e9;
          dims.radius = radius;
          dims.height = height;
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
          dims.height = height;
          dims.width = width;
          dims.depth = depth;
          break;
        }
      }

      const mesh = new THREE.Mesh(geometry, this.createMaterial(materialColor));
      group.add(mesh);
      if (type !== 'sphere') {
        const edges = this.createEdges(geometry);
        group.add(edges);
      }

      this.applyMeasurements(group, spec && typeof spec === 'object' ? spec : null, dims, type);

      group.rotation.y = rotationY;
      return group;
    }

    setShape(spec) {
      this.disposeCurrentShape();
      if (!spec) return;
      this.currentShape = this.createShape(spec);
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

  const defaultInput = textarea ? textarea.value : 'sylinder radius: r høyde: h';
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

  function parseDimensions(line) {
    const result = {};
    if (!line) return result;
    const segments = line.split(/(?=\b(?:radius|rad|høyde|hoyde)\b)/i);
    for (const segment of segments) {
      const match = segment.match(/^\s*\b(radius|rad|høyde|hoyde)\b/i);
      if (!match) continue;
      const keyword = match[1].toLowerCase();
      const normalized = keyword.startsWith('r') ? 'radius' : 'height';
      let remainder = segment.slice(match[0].length);
      let hadSeparator = false;
      const sepMatch = remainder.match(/^\s*([:=])/);
      if (sepMatch) {
        hadSeparator = true;
        remainder = remainder.slice(sepMatch[0].length);
      }
      let label = remainder.trim();
      if (label.startsWith('"') && label.endsWith('"') && label.length >= 2) {
        label = label.slice(1, -1);
      } else if (label.startsWith("'") && label.endsWith("'") && label.length >= 2) {
        label = label.slice(1, -1);
      } else if (label.startsWith('(') && label.endsWith(')') && label.length >= 2) {
        label = label.slice(1, -1).trim();
      } else if (label.startsWith('[') && label.endsWith(']') && label.length >= 2) {
        label = label.slice(1, -1).trim();
      }
      label = label.replace(/[,;|]+$/g, '').replace(/\s{2,}/g, ' ').trim();
      let finalLabel = label;
      if (!finalLabel) {
        finalLabel = hadSeparator ? '' : (normalized === 'radius' ? 'r' : 'h');
      }
      if (!result[normalized]) {
        result[normalized] = { requested: true, label: finalLabel };
      }
    }
    return result;
  }

  function parseInput(rawInput) {
    const lines = rawInput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const figures = [];
    for (const line of lines) {
      const type = detectType(line);
      const dimensions = parseDimensions(line);
      figures.push({ input: line, type, dimensions });
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
        renderer.setShape(info);
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
