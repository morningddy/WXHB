/**
 * Qwen Multi-Angle Camera Widget - Pure JS Port
 * 从 ComfyUI-qwenmultiangle 移植，适配 WXHB 无限画布
 * 原作者：jtydhr88 | MIT License
 */
class CameraWidget {
  constructor(options) {
    this.container = options.container;
    this.onStateChange = options.onStateChange || null;
    this.state = {
      azimuth: options.initialState?.azimuth ?? 0,
      elevation: options.initialState?.elevation ?? 0,
      distance: options.initialState?.distance ?? 5,
      imageUrl: options.initialState?.imageUrl ?? null
    };
    this.liveAzimuth = this.state.azimuth;
    this.liveElevation = this.state.elevation;
    this.liveDistance = this.state.distance;

    this.CENTER = new THREE.Vector3(0, 0.5, 0);
    this.AZIMUTH_RADIUS = 1.8;
    this.ELEVATION_RADIUS = 1.4;
    this.ELEV_ARC_X = -0.8;

    this.isDragging = false;
    this.dragTarget = null;
    this.hoveredHandle = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.useCameraView = false;
    this.isOrbitDragging = false;
    this.animationId = null;

    this.initThreeJS();
    this.bindEvents();
    this.animate();
  }

  initThreeJS() {
    const width = this.container.clientWidth || 300;
    const height = this.container.clientHeight || 300;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(4, 3.5, 4);
    this.camera.lookAt(0, 0.3, 0);

    this.previewCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.activeCamera = this.camera;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 10, 5);
    this.scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0xe93d82, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    this.gridHelper = new THREE.GridHelper(5, 20, 0x1a1a2e, 0x12121a);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    this.createSubject();
    this.createCameraIndicator();
    this.createAzimuthRing();
    this.createElevationArc();
    this.createDistanceHandle();
    this.updateVisuals();
  }

  createGridTexture() {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    const gridSize = 16;
    for (let i = 0; i <= size; i += gridSize) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  createSubject() {
    const cardGeo = new THREE.BoxGeometry(1.2, 1.2, 0.02);
    const frontMat = new THREE.MeshBasicMaterial({ color: 0x3a3a4a });
    const backMat = new THREE.MeshBasicMaterial({ map: this.createGridTexture() });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
    this.imagePlane = new THREE.Mesh(cardGeo, [edgeMat, backMat, edgeMat, edgeMat, frontMat, backMat]);
    this.imagePlane.position.copy(this.CENTER);
    this.scene.add(this.imagePlane);
    this.planeMat = frontMat;

    const frameGeo = new THREE.EdgesGeometry(cardGeo);
    const frameMat = new THREE.LineBasicMaterial({ color: 0xe93d82 });
    this.imageFrame = new THREE.LineSegments(frameGeo, frameMat);
    this.imageFrame.position.copy(this.CENTER);
    this.scene.add(this.imageFrame);

    const glowRingGeo = new THREE.RingGeometry(0.55, 0.58, 64);
    const glowRingMat = new THREE.MeshBasicMaterial({ color: 0xe93d82, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    this.glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    this.glowRing.position.set(0, 0.01, 0);
    this.glowRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.glowRing);
  }

  createCameraIndicator() {
    const camGeo = new THREE.ConeGeometry(0.15, 0.4, 4);
    const camMat = new THREE.MeshStandardMaterial({ color: 0xe93d82, emissive: 0xe93d82, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
    this.cameraIndicator = new THREE.Mesh(camGeo, camMat);
    this.scene.add(this.cameraIndicator);

    const camGlowGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const camGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6ba8, transparent: true, opacity: 0.8 });
    this.camGlow = new THREE.Mesh(camGlowGeo, camGlowMat);
    this.scene.add(this.camGlow);
  }

  createAzimuthRing() {
    const azRingGeo = new THREE.TorusGeometry(this.AZIMUTH_RADIUS, 0.04, 16, 100);
    const azRingMat = new THREE.MeshBasicMaterial({ color: 0xe93d82, transparent: true, opacity: 0.7 });
    this.azimuthRing = new THREE.Mesh(azRingGeo, azRingMat);
    this.azimuthRing.rotation.x = Math.PI / 2;
    this.azimuthRing.position.y = 0.02;
    this.scene.add(this.azimuthRing);

    const azHandleGeo = new THREE.SphereGeometry(0.16, 32, 32);
    const azHandleMat = new THREE.MeshStandardMaterial({ color: 0xe93d82, emissive: 0xe93d82, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4 });
    this.azimuthHandle = new THREE.Mesh(azHandleGeo, azHandleMat);
    this.scene.add(this.azimuthHandle);

    const azGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const azGlowMat = new THREE.MeshBasicMaterial({ color: 0xe93d82, transparent: true, opacity: 0.2 });
    this.azGlow = new THREE.Mesh(azGlowGeo, azGlowMat);
    this.scene.add(this.azGlow);
  }

  createElevationArc() {
    const arcPoints = [];
    for (let i = 0; i <= 32; i++) {
      const angle = (-30 + (90 * i / 32)) * Math.PI / 180;
      arcPoints.push(new THREE.Vector3(
        this.ELEV_ARC_X,
        this.ELEVATION_RADIUS * Math.sin(angle) + this.CENTER.y,
        this.ELEVATION_RADIUS * Math.cos(angle)
      ));
    }
    const arcCurve = new THREE.CatmullRomCurve3(arcPoints);
    const elArcGeo = new THREE.TubeGeometry(arcCurve, 32, 0.04, 8, false);
    const elArcMat = new THREE.MeshBasicMaterial({ color: 0x00ffd0, transparent: true, opacity: 0.8 });
    this.elevationArc = new THREE.Mesh(elArcGeo, elArcMat);
    this.scene.add(this.elevationArc);

    const elHandleGeo = new THREE.SphereGeometry(0.16, 32, 32);
    const elHandleMat = new THREE.MeshStandardMaterial({ color: 0x00ffd0, emissive: 0x00ffd0, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4 });
    this.elevationHandle = new THREE.Mesh(elHandleGeo, elHandleMat);
    this.scene.add(this.elevationHandle);

    const elGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const elGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ffd0, transparent: true, opacity: 0.2 });
    this.elGlow = new THREE.Mesh(elGlowGeo, elGlowMat);
    this.scene.add(this.elGlow);
  }

  createDistanceHandle() {
    const distHandleGeo = new THREE.SphereGeometry(0.15, 32, 32);
    const distHandleMat = new THREE.MeshStandardMaterial({ color: 0xffb800, emissive: 0xffb800, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 });
    this.distanceHandle = new THREE.Mesh(distHandleGeo, distHandleMat);
    this.scene.add(this.distanceHandle);

    const distGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const distGlowMat = new THREE.MeshBasicMaterial({ color: 0xffb800, transparent: true, opacity: 0.25 });
    this.distGlow = new THREE.Mesh(distGlowGeo, distGlowMat);
    this.scene.add(this.distGlow);
  }

  updateDistanceLine(start, end) {
    if (this.distanceTube) {
      this.scene.remove(this.distanceTube);
      this.distanceTube.geometry.dispose();
      this.distanceTube.material.dispose();
    }
    const path = new THREE.LineCurve3(start, end);
    const tubeGeo = new THREE.TubeGeometry(path, 1, 0.025, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffb800, transparent: true, opacity: 0.8 });
    this.distanceTube = new THREE.Mesh(tubeGeo, tubeMat);
    this.scene.add(this.distanceTube);
  }

  updateVisuals() {
    const azRad = (this.liveAzimuth * Math.PI) / 180;
    const elRad = (this.liveElevation * Math.PI) / 180;
    const visualDist = 2.6 - (this.liveDistance / 10) * 2.0;

    const camX = visualDist * Math.sin(azRad) * Math.cos(elRad);
    const camY = this.CENTER.y + visualDist * Math.sin(elRad);
    const camZ = visualDist * Math.cos(azRad) * Math.cos(elRad);

    this.cameraIndicator.position.set(camX, camY, camZ);
    this.cameraIndicator.lookAt(this.CENTER);
    this.cameraIndicator.rotateX(Math.PI / 2);
    this.camGlow.position.copy(this.cameraIndicator.position);

    const azX = this.AZIMUTH_RADIUS * Math.sin(azRad);
    const azZ = this.AZIMUTH_RADIUS * Math.cos(azRad);
    this.azimuthHandle.position.set(azX, 0.16, azZ);
    this.azGlow.position.copy(this.azimuthHandle.position);

    const elY = this.CENTER.y + this.ELEVATION_RADIUS * Math.sin(elRad);
    const elZ = this.ELEVATION_RADIUS * Math.cos(elRad);
    this.elevationHandle.position.set(this.ELEV_ARC_X, elY, elZ);
    this.elGlow.position.copy(this.elevationHandle.position);

    const distT = 0.15 + ((10 - this.liveDistance) / 10) * 0.7;
    this.distanceHandle.position.lerpVectors(this.CENTER, this.cameraIndicator.position, distT);
    this.distGlow.position.copy(this.distanceHandle.position);

    this.updateDistanceLine(this.CENTER.clone(), this.cameraIndicator.position.clone());

    if (this.previewCamera) {
      this.previewCamera.position.copy(this.cameraIndicator.position);
      this.previewCamera.lookAt(this.CENTER);
    }

    if (this.glowRing) this.glowRing.rotation.z += 0.005;
  }

  bindEvents() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
    canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
    canvas.addEventListener('mouseleave', this.onPointerUp.bind(this));
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onPointerDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.onPointerMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    canvas.addEventListener('touchend', () => this.onPointerUp());
    canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    new ResizeObserver(() => this.onResize()).observe(this.container);
  }

  getMousePos(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  setHandleScale(handle, glow, scale) {
    handle.scale.setScalar(scale);
    if (glow) glow.scale.setScalar(scale);
  }

  onPointerDown(event) {
    this.getMousePos(event);
    if (this.useCameraView) {
      this.isOrbitDragging = true;
      this.orbitStartX = event.clientX;
      this.orbitStartY = event.clientY;
      this.orbitStartAzimuth = this.liveAzimuth;
      this.orbitStartElevation = this.liveElevation;
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const handles = [
      { mesh: this.azimuthHandle, glow: this.azGlow, name: 'azimuth' },
      { mesh: this.elevationHandle, glow: this.elGlow, name: 'elevation' },
      { mesh: this.distanceHandle, glow: this.distGlow, name: 'distance' }
    ];
    for (const h of handles) {
      if (this.raycaster.intersectObject(h.mesh).length > 0) {
        this.isDragging = true;
        this.dragTarget = h.name;
        this.setHandleScale(h.mesh, h.glow, 1.3);
        this.renderer.domElement.style.cursor = 'grabbing';
        return;
      }
    }
  }

  onPointerMove(event) {
    this.getMousePos(event);
    if (this.useCameraView && this.isOrbitDragging) {
      const deltaX = event.clientX - this.orbitStartX;
      const deltaY = event.clientY - this.orbitStartY;
      const sensitivity = 0.5;
      let newAzimuth = this.orbitStartAzimuth - deltaX * sensitivity;
      while (newAzimuth < 0) newAzimuth += 360;
      while (newAzimuth >= 360) newAzimuth -= 360;
      this.liveAzimuth = newAzimuth;
      this.state.azimuth = Math.round(this.liveAzimuth);
      let newElevation = this.orbitStartElevation + deltaY * sensitivity;
      newElevation = Math.max(-30, Math.min(60, newElevation));
      this.liveElevation = newElevation;
      this.state.elevation = Math.round(this.liveElevation);
      this.updateVisuals();
      this.notifyStateChange();
      return;
    }
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this.isDragging) {
      const handles = [
        { mesh: this.azimuthHandle, glow: this.azGlow, name: 'azimuth' },
        { mesh: this.elevationHandle, glow: this.elGlow, name: 'elevation' },
        { mesh: this.distanceHandle, glow: this.distGlow, name: 'distance' }
      ];
      let foundHover = null;
      for (const h of handles) {
        if (this.raycaster.intersectObject(h.mesh).length > 0) { foundHover = h; break; }
      }
      if (this.hoveredHandle && this.hoveredHandle !== foundHover) {
        this.setHandleScale(this.hoveredHandle.mesh, this.hoveredHandle.glow, 1.0);
      }
      if (foundHover) {
        this.setHandleScale(foundHover.mesh, foundHover.glow, 1.15);
        this.renderer.domElement.style.cursor = 'grab';
        this.hoveredHandle = foundHover;
      } else {
        this.renderer.domElement.style.cursor = 'default';
        this.hoveredHandle = null;
      }
      return;
    }
    const plane = new THREE.Plane();
    const intersect = new THREE.Vector3();
    if (this.dragTarget === 'azimuth') {
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
      if (this.raycaster.ray.intersectPlane(plane, intersect)) {
        let angle = Math.atan2(intersect.x, intersect.z) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        this.liveAzimuth = Math.max(0, Math.min(360, angle));
        this.state.azimuth = Math.round(this.liveAzimuth);
        this.updateVisuals();
        this.notifyStateChange();
      }
    } else if (this.dragTarget === 'elevation') {
      const elevPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -this.ELEV_ARC_X);
      if (this.raycaster.ray.intersectPlane(elevPlane, intersect)) {
        const relY = intersect.y - this.CENTER.y;
        const relZ = intersect.z;
        let angle = Math.atan2(relY, relZ) * (180 / Math.PI);
        angle = Math.max(-30, Math.min(60, angle));
        this.liveElevation = angle;
        this.state.elevation = Math.round(this.liveElevation);
        this.updateVisuals();
        this.notifyStateChange();
      }
    } else if (this.dragTarget === 'distance') {
      const newDist = 5 - this.mouse.y * 5;
      this.liveDistance = Math.max(0, Math.min(10, newDist));
      this.state.distance = Math.round(this.liveDistance * 10) / 10;
      this.updateVisuals();
      this.notifyStateChange();
    }
  }

  onPointerUp() {
    if (this.isOrbitDragging) {
      this.isOrbitDragging = false;
      this.renderer.domElement.style.cursor = this.useCameraView ? 'grab' : 'default';
      return;
    }
    if (this.isDragging) {
      const handles = [
        { mesh: this.azimuthHandle, glow: this.azGlow },
        { mesh: this.elevationHandle, glow: this.elGlow },
        { mesh: this.distanceHandle, glow: this.distGlow }
      ];
      handles.forEach(h => this.setHandleScale(h.mesh, h.glow, 1.0));
    }
    this.isDragging = false;
    this.dragTarget = null;
    this.renderer.domElement.style.cursor = 'default';
  }

  onWheel(event) {
    if (!this.useCameraView) return;
    event.preventDefault();
    const sensitivity = 0.01;
    let newDistance = this.liveDistance - event.deltaY * sensitivity;
    newDistance = Math.max(0, Math.min(10, newDistance));
    this.liveDistance = newDistance;
    this.state.distance = Math.round(this.liveDistance * 10) / 10;
    this.updateVisuals();
    this.notifyStateChange();
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.previewCamera) {
      this.previewCamera.aspect = w / h;
      this.previewCamera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h, false);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.time = (this.time || 0) + 0.01;
    if (this.camGlow) {
      const pulse = 1 + Math.sin(this.time * 2) * 0.03;
      this.camGlow.scale.setScalar(pulse);
    }
    if (this.glowRing) this.glowRing.rotation.z += 0.003;
    this.renderer.render(this.scene, this.activeCamera);
  }

  notifyStateChange() {
    if (this.onStateChange) this.onStateChange({ ...this.state });
  }

  generatePrompt() {
    const hAngle = this.state.azimuth % 360;
    let hDirection;
    if (hAngle < 22.5 || hAngle >= 337.5) hDirection = "front view";
    else if (hAngle < 67.5) hDirection = "front-right quarter view";
    else if (hAngle < 112.5) hDirection = "right side view";
    else if (hAngle < 157.5) hDirection = "back-right quarter view";
    else if (hAngle < 202.5) hDirection = "back view";
    else if (hAngle < 247.5) hDirection = "back-left quarter view";
    else if (hAngle < 292.5) hDirection = "left side view";
    else hDirection = "front-left quarter view";

    let vDirection;
    if (this.state.elevation < -15) vDirection = "low-angle shot";
    else if (this.state.elevation < 15) vDirection = "eye-level shot";
    else if (this.state.elevation < 45) vDirection = "elevated shot";
    else vDirection = "high-angle shot";

    let distance;
    if (this.state.distance < 2) distance = "wide shot";
    else if (this.state.distance < 6) distance = "medium shot";
    else distance = "close-up";

    let prompt = `${hDirection}, ${vDirection}, ${distance}`;
    prompt += ` -- change camera angle to this viewpoint, re-render from this angle`;
    return prompt;
  }

  generatePromptZh() {
    const hAngle = this.state.azimuth % 360;
    let hDirection;
    if (hAngle < 22.5 || hAngle >= 337.5) hDirection = "正面视角";
    else if (hAngle < 67.5) hDirection = "右前方视角";
    else if (hAngle < 112.5) hDirection = "右侧视角";
    else if (hAngle < 157.5) hDirection = "右后方视角";
    else if (hAngle < 202.5) hDirection = "背面视角";
    else if (hAngle < 247.5) hDirection = "左后方视角";
    else if (hAngle < 292.5) hDirection = "左侧视角";
    else hDirection = "左前方视角";

    let vDirection;
    if (this.state.elevation < -15) vDirection = "仰拍";
    else if (this.state.elevation < 15) vDirection = "平视";
    else if (this.state.elevation < 45) vDirection = "高角度";
    else vDirection = "俯拍";

    let distance;
    if (this.state.distance < 2) distance = "远景";
    else if (this.state.distance < 6) distance = "中景";
    else distance = "特写";

    return `相机角度：${hDirection}，${vDirection}，${distance} —— 请从该角度重新生成图片`;
  }

  setState(newState) {
    if (newState.azimuth !== undefined) { this.state.azimuth = newState.azimuth; this.liveAzimuth = newState.azimuth; }
    if (newState.elevation !== undefined) { this.state.elevation = newState.elevation; this.liveElevation = newState.elevation; }
    if (newState.distance !== undefined) { this.state.distance = newState.distance; this.liveDistance = newState.distance; }
    if (newState.imageUrl !== undefined) { this.state.imageUrl = newState.imageUrl; this.updateImage(newState.imageUrl); }
    this.updateVisuals();
  }

  getState() { return { ...this.state }; }
  getPrompt() { return this.generatePrompt(); }
  getPromptZh() { return this.generatePromptZh(); }

  resetToDefaults() {
    this.state.azimuth = 0; this.state.elevation = 0; this.state.distance = 5;
    this.liveAzimuth = 0; this.liveElevation = 0; this.liveDistance = 5;
    this.updateVisuals(); this.notifyStateChange();
  }

  setCameraView(enabled) {
    this.useCameraView = enabled;
    this.isOrbitDragging = false;
    if (enabled) {
      this.activeCamera = this.previewCamera;
      [this.azimuthRing, this.azimuthHandle, this.azGlow, this.elevationArc, this.elevationHandle, this.elGlow,
       this.distanceHandle, this.distGlow, this.distanceTube, this.cameraIndicator, this.camGlow, this.glowRing,
       this.gridHelper, this.imageFrame].forEach(obj => { if (obj) obj.visible = false; });
      this.renderer.domElement.style.cursor = 'grab';
    } else {
      this.activeCamera = this.camera;
      [this.azimuthRing, this.azimuthHandle, this.azGlow, this.elevationArc, this.elevationHandle, this.elGlow,
       this.distanceHandle, this.distGlow, this.cameraIndicator, this.camGlow, this.glowRing,
       this.gridHelper, this.imageFrame].forEach(obj => { if (obj) obj.visible = true; });
      if (this.distanceTube) this.distanceTube.visible = true;
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  updateImage(url) {
    if (url) {
      const img = new Image();
      if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        this.planeMat.map = tex;
        this.planeMat.color.set(0xffffff);
        this.planeMat.needsUpdate = true;
        const ar = img.width / img.height;
        const maxSize = 1.5;
        let scaleX, scaleY;
        if (ar > 1) { scaleX = maxSize; scaleY = maxSize / ar; }
        else { scaleY = maxSize; scaleX = maxSize * ar; }
        this.imagePlane.scale.set(scaleX, scaleY, 1);
        this.imageFrame.scale.set(scaleX, scaleY, 1);
      };
      img.onerror = () => {
        this.planeMat.map = null;
        this.planeMat.color.set(0xe93d82);
        this.planeMat.needsUpdate = true;
      };
      img.src = url;
    } else {
      this.planeMat.map = null;
      this.planeMat.color.set(0x3a3a4a);
      this.planeMat.needsUpdate = true;
      this.imagePlane.scale.set(1, 1, 1);
      this.imageFrame.scale.set(1, 1, 1);
    }
  }

  dispose() {
    if (this.animationId !== null) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    try { this.renderer.dispose(); } catch(e) {}
    try { this.scene.clear(); } catch(e) {}
  }
}

window.CameraWidget = CameraWidget;
