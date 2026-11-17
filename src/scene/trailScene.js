import * as THREE from 'three';

/**
 * Escena 3D inmersiva de "Sendero Vivo 3D" (recorrido ampliado ~250 m).
 * Incorpora texturas PBR reales, relieve (bump maps), agua animada, árboles con ramaje
 * orgánico, aves en vuelo, señalética ilustrada y navegación ergonómica por pasarela universal.
 */
export class TrailScene {
  constructor(container, stations, callbacks = {}) {
    this.container = container;
    this.stations = stations;
    this.onStationClick = callbacks.onStationClick || (() => {});
    this.onStationHover = callbacks.onStationHover || (() => {});
    this.onProgressChange = callbacks.onProgressChange || (() => {});

    this.reducedMotion = false;
    this.wheelchairMode = true;
    this.activeStationIndex = 0;

    // 6 paradas distribuidas a lo largo de la ruta de 250 m
    this.stationTs = [0.02, 0.21, 0.4, 0.6, 0.8, 0.96];
    this.currentT = this.stationTs[0];
    this.targetT = this.stationTs[0];
    this.travelMode = 'station'; // 'station' | 'free'
    this.eyeHeight = 1.15;
    this.targetEyeHeight = 1.15;

    this.yaw = 0;
    this.targetYaw = 0;
    this.pitch = -0.04;
    this.targetPitch = -0.04;

    this.isDragging = false;
    this.dragMoved = false;
    this.lastPointer = { x: 0, y: 0 };

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.markers = [];
    this.waterTextures = [];
    this.birds = [];
    this.mistParticles = null;
    this.pollenParticles = null;
    this.animationFrameId = null;

    this.loadTextures();
    this.initRenderer();
    this.initScene();
    this.buildCurve();
    this.buildTerrain();
    this.buildStreamBedWater();
    this.buildBoardwalk();
    this.buildStationsLandmarks();
    this.buildForestAndFlora();
    this.buildFlyingBirds();
    this.buildAtmosphereParticles();
    this.buildStationMarkers();
    this.bindEvents();

    this.snapToStation(0);
    this.animate();
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    const loadTex = (path, rx = 1, ry = 1, srgb = true) => {
      const tex = loader.load(path);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = 4;
      return tex;
    };

    this.textures = {
      ground: loadTex('/textures/forest_ground.jpg', 36, 36),
      wood: loadTex('/textures/wood_planks.jpg', 1, 1),
      woodBeam: loadTex('/textures/wood_planks.jpg', 1, 3),
      rock: loadTex('/textures/cliff_rock.jpg', 3, 3),
      bark: loadTex('/textures/tree_bark.jpg', 2, 4),
      foliage: loadTex('/textures/foliage_canopy.jpg', 2, 2),
      textile: loadTex('/textures/andean_textile.jpg', 1, 1.3),
      welcomeMap: loadTex('/textures/welcome_map.jpg', 1, 1),
      waterFoam: this.createWaterStreamTexture()
    };
  }

  /** Genera textura continua de espuma y vetas de corriente para cascada y río. */
  createWaterStreamTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#2a8f9d');
    grad.addColorStop(0.5, '#58c7d4');
    grad.addColorStop(1, '#2a8f9d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    // Vetas verticales espumosas
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 512;
      const w = 3 + Math.random() * 10;
      const h = 30 + Math.random() * 90;
      ctx.fillStyle =
        i % 3 === 0 ? 'rgba(242, 253, 255, 0.55)' : 'rgba(180, 244, 250, 0.35)';
      ctx.fillRect(x, y, w, h);
      if (y + h > 512) {
        ctx.fillRect(x, y - 512, w, h);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.waterTextures.push(tex);
    return tex;
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc5ddd4);
    this.scene.fog = new THREE.FogExp2(0xc5ddd4, 0.0115);

    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(56, aspect, 0.1, 260);

    const hemiLight = new THREE.HemisphereLight(0xf1f8f5, 0x384b34, 1.0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff0d4, 1.55);
    sunLight.position.set(-45, 58, 36);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 210;
    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xa3d4c4, 0.42);
    fillLight.position.set(45, 22, -40);
    this.scene.add(fillLight);

    const skyGeo = new THREE.SphereGeometry(210, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x5f9996) },
        bottomColor: { value: new THREE.Color(0xd7e8df) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.72), 0.0)), 1.0);
        }
      `
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  buildCurve() {
    this.boardwalkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-59, 2.35, 57),
      new THREE.Vector3(-43, 2.55, 42),
      new THREE.Vector3(-26, 2.75, 26),
      new THREE.Vector3(-15, 2.65, 17),
      new THREE.Vector3(-4, 2.58, 10),
      new THREE.Vector3(6, 2.78, 0),
      new THREE.Vector3(16, 2.9, -9),
      new THREE.Vector3(28, 2.78, -1),
      new THREE.Vector3(40, 2.68, 7),
      new THREE.Vector3(51, 2.58, 19),
      new THREE.Vector3(61, 2.5, 30)
    ]);

    this.boardwalkSamples = [];
    for (let i = 0; i <= 90; i++) {
      this.boardwalkSamples.push(this.boardwalkCurve.getPointAt(i / 90));
    }
  }

  getTerrainHeight(x, z) {
    let h = 1.3 + Math.sin(x * 0.055) * 0.7 + Math.cos(z * 0.05) * 0.65;

    // Cordilleras norte detrás de la quebrada y la cascada
    if (z < -23) {
      const ridge = (-23 - z) * 0.27;
      h += Math.min(20, ridge * (0.85 + 0.35 * Math.sin(x * 0.11)));
    }

    // Risco detrás de la cascada en (26.5, -24)
    const distWf = Math.hypot(x - 26.5, z + 24);
    if (distWf < 9.5) {
      h += (9.5 - distWf) * 1.05;
    }

    // Cuenco abierto de la poza de cascada
    const distPool = Math.hypot(x - 23.5, z + 15.5);
    if (distPool < 6.5) {
      h -= (1 - distPool / 6.5) * 1.15;
    }

    // Colinas circundantes en los bordes exteriores
    const radial = Math.hypot(x, z);
    if (radial > 76) {
      h += (radial - 76) * 0.22;
    }

    // Cauce de la quebrada pasando bajo el puente (16, -9)
    const distStream = this.distanceToStream(x, z);
    if (distStream < 5.0) {
      h -= (1 - distStream / 5.0) * 1.6;
    }

    // Despeje suave bajo toda la pasarela de madera para evitar intersecciones
    let minBwDist = Infinity;
    let nearestBwY = h;
    for (const pt of this.boardwalkSamples) {
      const d = Math.hypot(x - pt.x, z - pt.z);
      if (d < minBwDist) {
        minBwDist = d;
        nearestBwY = pt.y;
      }
    }
    if (minBwDist < 4.5) {
      const maxAllowed = nearestBwY - 0.55;
      const blend = 1 - minBwDist / 4.5;
      h = Math.min(h, THREE.MathUtils.lerp(h, maxAllowed, blend));
    }

    return h;
  }

  distanceToStream(x, z) {
    const d1 = this.pointToSegmentDist(x, z, 23.5, -16, 16, -9);
    const d2 = this.pointToSegmentDist(x, z, 16, -9, -14, -36);
    return Math.min(d1, d2);
  }

  pointToSegmentDist(px, pz, x1, z1, x2, z2) {
    const vx = x2 - x1;
    const vz = z2 - z1;
    const lenSq = vx * vx + vz * vz;
    if (lenSq === 0) return Math.hypot(px - x1, pz - z1);
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
    return Math.hypot(px - (x1 + t * vx), pz - (z1 + t * vz));
  }

  buildTerrain() {
    const size = 240;
    const segments = 150;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];
    const cMeadow = new THREE.Color(0xd7e3ce);
    const cRockTint = new THREE.Color(0xaab0aa);
    const cBankTint = new THREE.Color(0xbca88d);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      const streamDist = this.distanceToStream(x, z);
      if (y > 6.5) {
        tmp.copy(cRockTint);
      } else if (streamDist < 4.2) {
        tmp.copy(cBankTint);
      } else {
        tmp.copy(cMeadow);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.ground,
      bumpMap: this.textures.ground,
      bumpScale: 0.08,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  buildStreamBedWater() {
    const streamMat = new THREE.MeshStandardMaterial({
      map: this.textures.waterFoam,
      color: 0x7bdce8,
      roughness: 0.14,
      metalness: 0.12,
      transparent: true,
      opacity: 0.86
    });

    const poolGeo = new THREE.CircleGeometry(5.6, 28);
    poolGeo.rotateX(-Math.PI / 2);
    const pool = new THREE.Mesh(poolGeo, streamMat);
    pool.position.set(23.5, 0.92, -15.5);
    pool.receiveShadow = true;
    this.scene.add(pool);

    const stream1 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 14), streamMat);
    stream1.rotation.x = -Math.PI / 2;
    stream1.rotation.z = -0.82;
    stream1.position.set(19.5, 0.88, -12.3);
    this.scene.add(stream1);

    const stream2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 38), streamMat);
    stream2.rotation.x = -Math.PI / 2;
    stream2.rotation.z = 0.83;
    stream2.position.set(2.5, 0.82, -21);
    this.scene.add(stream2);
  }

  buildBoardwalk() {
    const plankCount = 320;
    const plankGeo = new THREE.BoxGeometry(2.55, 0.12, 0.5);
    const plankMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood,
      bumpMap: this.textures.wood,
      bumpScale: 0.03,
      roughness: 0.82
    });

    const planks = new THREE.InstancedMesh(plankGeo, plankMat, plankCount);
    planks.castShadow = true;
    planks.receiveShadow = true;

    const postGeo = new THREE.CylinderGeometry(0.07, 0.08, 1.08, 8);
    const postMat = new THREE.MeshStandardMaterial({
      map: this.textures.bark,
      color: 0x8e6b4a,
      roughness: 0.88
    });

    const dummy = new THREE.Object3D();
    const railPointsLeft = [];
    const railPointsRight = [];

    for (let i = 0; i < plankCount; i++) {
      const t = i / (plankCount - 1);
      const pt = this.boardwalkCurve.getPointAt(t);
      const tangent = this.boardwalkCurve.getTangentAt(t).normalize();
      const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      dummy.position.copy(pt);
      dummy.lookAt(pt.clone().add(tangent));
      dummy.updateMatrix();
      planks.setMatrixAt(i, dummy.matrix);

      if (i % 10 === 0 || i === plankCount - 1) {
        for (const dir of [-1, 1]) {
          const offsetPos = pt.clone().addScaledVector(side, dir * 1.18);
          const railPt = offsetPos.clone().add(new THREE.Vector3(0, 0.84, 0));
          if (dir === -1) railPointsLeft.push(railPt);
          else railPointsRight.push(railPt);

          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(offsetPos.x, offsetPos.y + 0.36, offsetPos.z);
          post.castShadow = true;
          this.scene.add(post);

          const groundY = this.getTerrainHeight(offsetPos.x, offsetPos.z);
          const legHeight = Math.max(0.45, offsetPos.y - groundY + 0.25);
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.085, legHeight, 6),
            postMat
          );
          leg.position.set(offsetPos.x, groundY + legHeight / 2 - 0.1, offsetPos.z);
          this.scene.add(leg);
        }
      }
    }

    planks.instanceMatrix.needsUpdate = true;
    this.scene.add(planks);

    const railMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodBeam,
      color: 0xc59768,
      roughness: 0.72
    });
    for (const pts of [railPointsLeft, railPointsRight]) {
      const railCurve = new THREE.CatmullRomCurve3(pts);
      const railGeo = new THREE.TubeGeometry(railCurve, 180, 0.048, 8, false);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.castShadow = true;
      this.scene.add(railMesh);
    }
  }

  createDeckPlatform(x, y, z, width, depth, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const deckMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood,
      bumpMap: this.textures.wood,
      bumpScale: 0.03,
      roughness: 0.82
    });
    const trimMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodBeam,
      color: 0x734f32,
      roughness: 0.9
    });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), deckMat);
    deck.receiveShadow = true;
    deck.castShadow = true;
    group.add(deck);

    const border = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.2, depth + 0.14), trimMat);
    border.position.y = -0.08;
    group.add(border);

    this.scene.add(group);
    return group;
  }

  buildStationsLandmarks() {
    this.buildMiradorDeck();
    this.buildArbolAbuelo();
    this.buildHuertaElevada();
    this.buildWaterfall();
    this.buildMiradorAves();
    this.buildRamadaComunitaria();
  }

  buildMiradorDeck() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[0]);
    const group = this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 6.2, 6.2, 0.75);
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodBeam,
      color: 0x7d5533,
      roughness: 0.85
    });

    // Banca accesible dejando bahía libre contigua
    const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.56), woodMat);
    benchSeat.position.set(-1.6, 0.52, -1.7);
    benchSeat.castShadow = true;
    const benchBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.08), woodMat);
    benchBack.position.set(-1.6, 0.78, -1.96);
    group.add(benchSeat, benchBack);

    // Panel de mapa botánico ilustrado a altura cómoda de lectura
    const mapFrame = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.55, 0.12), woodMat);
    mapFrame.position.set(1.75, 1.45, -1.65);
    mapFrame.rotation.y = -0.45;
    mapFrame.castShadow = true;

    const mapFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.05, 1.38),
      new THREE.MeshStandardMaterial({
        map: this.textures.welcomeMap,
        roughness: 0.65
      })
    );
    mapFace.position.set(0, 0, 0.068);
    mapFrame.add(mapFace);

    for (const px of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.5, 8), woodMat);
      leg.position.set(px, -0.75, 0);
      mapFrame.add(leg);
    }
    group.add(mapFrame);
  }

  buildArbolAbuelo() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[1]);
    this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 5.2, 5.2, 0.75);

    // Árbol centenario imponente junto a la pasarela en (-18.5, 19.5)
    const treeX = -18.5;
    const treeZ = 19.5;
    const groundY = this.getTerrainHeight(treeX, treeZ);
    const treeGroup = new THREE.Group();
    treeGroup.position.set(treeX, groundY - 0.2, treeZ);

    const barkMat = new THREE.MeshStandardMaterial({
      map: this.textures.bark,
      bumpMap: this.textures.bark,
      bumpScale: 0.1,
      roughness: 0.92
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: this.textures.foliage,
      bumpMap: this.textures.foliage,
      bumpScale: 0.06,
      roughness: 0.82
    });

    // Tronco grueso y raíces tablares
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.45, 7.2, 12), barkMat);
    trunk.position.y = 3.6;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const root = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.1, 2.2), barkMat);
      root.position.set(Math.cos(angle) * 1.4, 0.9, Math.sin(angle) * 1.4);
      root.rotation.y = -angle;
      root.rotation.x = 0.45;
      root.castShadow = true;
      treeGroup.add(root);
    }

    // Ramas principales y copa frondosa orgánica
    const branchSpecs = [
      { rx: 0.55, rz: 0.2, y: 5.8, len: 4.5, ry: 0.4 },
      { rx: -0.5, rz: 0.35, y: 6.2, len: 4.2, ry: 2.2 },
      { rx: 0.25, rz: -0.55, y: 6.0, len: 4.4, ry: 4.1 },
      { rx: -0.35, rz: -0.45, y: 6.5, len: 3.9, ry: 5.2 }
    ];

    branchSpecs.forEach((b) => {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, b.len, 8), barkMat);
      branch.position.set(Math.cos(b.ry) * 1.4, b.y, Math.sin(b.ry) * 1.4);
      branch.rotation.set(b.rx, b.ry, b.rz);
      branch.castShadow = true;
      treeGroup.add(branch);

      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(2.35, 1), leafMat);
      canopy.scale.set(1.25, 0.85, 1.25);
      canopy.position.set(Math.cos(b.ry) * 2.9, b.y + 1.5, Math.sin(b.ry) * 2.9);
      canopy.castShadow = true;
      treeGroup.add(canopy);
    });

    const crownTop = new THREE.Mesh(new THREE.IcosahedronGeometry(2.9, 1), leafMat);
    crownTop.scale.set(1.3, 0.9, 1.3);
    crownTop.position.set(0, 8.6, 0);
    crownTop.castShadow = true;
    treeGroup.add(crownTop);

    // Bromelias epífitas de acento sobre el tronco
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xe26345, roughness: 0.65 });
    for (let i = 0; i < 4; i++) {
      const ang = i * 1.5;
      const bromelia = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 6), flowerMat);
      bromelia.position.set(Math.cos(ang) * 1.15, 2.9 + i * 0.65, Math.sin(ang) * 1.15);
      bromelia.rotation.z = -Math.cos(ang) * 0.4;
      treeGroup.add(bromelia);
    }

    this.scene.add(treeGroup);
  }

  buildHuertaElevada() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[2]);
    const group = this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 6.4, 5.8, -0.78);
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodBeam,
      color: 0x895c38,
      roughness: 0.84
    });
    const soilMat = new THREE.MeshStandardMaterial({
      map: this.textures.ground,
      color: 0x5c4636,
      roughness: 0.95
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: this.textures.foliage,
      roughness: 0.8
    });

    const planterConfigs = [
      { x: 1.75, z: -1.35, tint: 0x9cd184, flowerColor: 0xf4c44e },
      { x: 1.75, z: 1.2, tint: 0x87c293, flowerColor: 0xe67e51 },
      { x: -1.75, z: 1.55, tint: 0xa4d692, flowerColor: 0xc28ae8 }
    ];

    planterConfigs.forEach((cfg) => {
      const bed = new THREE.Group();
      bed.position.set(cfg.x, 0, cfg.z);

      const legGeo = new THREE.BoxGeometry(0.12, 0.58, 0.12);
      for (const lx of [-0.78, 0.78]) {
        for (const lz of [-0.44, 0.44]) {
          const leg = new THREE.Mesh(legGeo, woodMat);
          leg.position.set(lx, 0.29, lz);
          leg.castShadow = true;
          bed.add(leg);
        }
      }

      const box = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.32, 1.1), woodMat);
      box.position.y = 0.72;
      box.castShadow = true;
      bed.add(box);

      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.06, 0.94), soilMat);
      soil.position.y = 0.88;
      bed.add(soil);

      const herbMat = leafMat.clone();
      herbMat.color.setHex(cfg.tint);

      for (let i = 0; i < 6; i++) {
        const px = -0.6 + (i % 3) * 0.6;
        const pz = i < 3 ? -0.22 : 0.22;
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + (i % 2) * 0.05, 1), herbMat);
        bush.position.set(px, 1.07, pz);
        bush.castShadow = true;
        bed.add(bush);

        if (i % 2 === 0) {
          const bloom = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 8, 8),
            new THREE.MeshStandardMaterial({ color: cfg.flowerColor, roughness: 0.45 })
          );
          bloom.position.set(px + 0.05, 1.28, pz);
          bed.add(bloom);
        }
      }

      group.add(bed);
    });
  }

  buildWaterfall() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[3]);
    this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 5.2, 4.6, -0.74);

    const rockMat = new THREE.MeshStandardMaterial({
      map: this.textures.rock,
      bumpMap: this.textures.rock,
      bumpScale: 0.14,
      roughness: 0.9,
      flatShading: false
    });

    const rockLayout = [
      { x: 19.8, y: 4.5, z: -20.2, sx: 2.9, sy: 6.4, sz: 2.8 },
      { x: 29.8, y: 5.0, z: -18.2, sx: 3.1, sy: 7.2, sz: 2.9 },
      { x: 25.2, y: 6.2, z: -22.5, sx: 5.8, sy: 8.4, sz: 2.8 },
      { x: 20.5, y: 1.5, z: -15.6, sx: 1.6, sy: 1.2, sz: 1.4 },
      { x: 27.6, y: 1.6, z: -14.2, sx: 1.7, sy: 1.3, sz: 1.5 }
    ];

    rockLayout.forEach((r) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 2), rockMat);
      rock.position.set(r.x, r.y, r.z);
      rock.scale.set(r.sx, r.sy, r.sz);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    });

    // Cortina de agua texturizada con desplazamiento animado continuo
    for (let i = 0; i < 3; i++) {
      const waterMat = new THREE.MeshStandardMaterial({
        map: this.textures.waterFoam,
        color: i === 1 ? 0xebfcff : 0x62d5e6,
        transparent: true,
        opacity: i === 1 ? 0.85 : 0.78,
        roughness: 0.15,
        emissive: 0x1e6573,
        emissiveIntensity: 0.35
      });
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(3.2 - i * 0.55, 9.6, 0.34), waterMat);
      sheet.position.set(24.5 + (i - 1) * 0.3, 5.5, -18.0 + i * 0.25);
      sheet.rotation.y = -0.62;
      this.scene.add(sheet);
    }

    const foamRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.28, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xecfbff, transparent: true, opacity: 0.74 })
    );
    foamRing.rotation.x = Math.PI / 2;
    foamRing.position.set(23.7, 1.04, -16.2);
    this.scene.add(foamRing);

    const mistCount = 120;
    const mistPos = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
      mistPos[i * 3] = 23.8 + (Math.random() - 0.5) * 5.2;
      mistPos[i * 3 + 1] = 1.1 + Math.random() * 3.4;
      mistPos[i * 3 + 2] = -15.8 + (Math.random() - 0.5) * 4.8;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.PointsMaterial({
      color: 0xeefbff,
      size: 0.6,
      transparent: true,
      opacity: 0.45
    });
    this.mistParticles = new THREE.Points(mistGeo, mistMat);
    this.scene.add(this.mistParticles);
  }

  buildMiradorAves() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[4]);
    const group = this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 6.0, 5.8, -0.78);
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodBeam,
      color: 0x7d5533,
      roughness: 0.85
    });

    // Pérgola de descanso accesible
    for (const px of [-2.2, 2.2]) {
      for (const pz of [-2.1, 2.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.1, 8), woodMat);
        post.position.set(px, 1.55, pz);
        post.castShadow = true;
        group.add(post);
      }
    }

    for (let i = -3; i <= 3; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 0.24), woodMat);
      slat.position.set(0, 3.12, i * 0.62);
      slat.castShadow = true;
      group.add(slat);
    }

    // Banca ergonómica dejando bahía libre junto a ella
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 0.58), woodMat);
    bench.position.set(-1.3, 0.52, -1.35);
    bench.castShadow = true;
    group.add(bench);

    // Árbol florido frente al mirador para atraer aves en (47.5, 5.5)
    const treeX = 47.5;
    const treeZ = 5.5;
    const gy = this.getTerrainHeight(treeX, treeZ);
    const blossomTree = new THREE.Group();
    blossomTree.position.set(treeX, gy - 0.1, treeZ);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.48, 4.4, 8),
      new THREE.MeshStandardMaterial({ map: this.textures.bark, roughness: 0.9 })
    );
    trunk.position.y = 2.2;
    trunk.castShadow = true;
    blossomTree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ map: this.textures.foliage, roughness: 0.8 });
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), leafMat);
    crown.position.y = 4.9;
    crown.castShadow = true;
    blossomTree.add(crown);

    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf4845f, roughness: 0.5 });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), blossomMat);
      flower.position.set(
        Math.cos(ang) * (1.2 + (i % 3) * 0.35),
        4.4 + (i % 3) * 0.55,
        Math.sin(ang) * (1.2 + (i % 3) * 0.35)
      );
      blossomTree.add(flower);
    }
    this.scene.add(blossomTree);
  }

  buildRamadaComunitaria() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[5]);
    const group = this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 7.4, 7.2, 0.72);
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodBeam,
      color: 0x764e2e,
      roughness: 0.85
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this.textures.wood,
      color: 0xb08048,
      roughness: 0.88,
      emissive: 0x2a1b0a,
      emissiveIntensity: 0.35
    });

    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.17, 3.7, 8);
    for (const px of [-2.7, 2.7]) {
      for (const pz of [-2.6, 2.6]) {
        const pillar = new THREE.Mesh(pillarGeo, woodMat);
        pillar.position.set(px, 1.85, pz);
        pillar.castShadow = true;
        group.add(pillar);
      }
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.1, 2.1, 4), roofMat);
    roof.position.y = 4.7;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Mesa expositora de artesanías con camino textil real
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.12, 1.15),
      new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.75 })
    );
    tableTop.position.set(1.15, 0.86, 0.7);
    tableTop.castShadow = true;
    group.add(tableTop);

    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.02, 0.62),
      new THREE.MeshStandardMaterial({ map: this.textures.textile, roughness: 0.82 })
    );
    runner.position.set(1.15, 0.93, 0.7);
    group.add(runner);

    for (const lx of [0.05, 2.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 0.8), woodMat);
      leg.position.set(lx, 0.41, 0.7);
      group.add(leg);
    }

    // Tres tapices tejidos colgantes con textura andina generada
    const textileMat = new THREE.MeshStandardMaterial({
      map: this.textures.textile,
      bumpMap: this.textures.textile,
      bumpScale: 0.02,
      roughness: 0.82
    });
    for (let idx = 0; idx < 3; idx++) {
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.65, 0.04), textileMat);
      cloth.position.set(-1.1 + idx * 1.1, 2.5, 2.52);
      cloth.castShadow = true;
      group.add(cloth);
    }

    // Ánforas de cerámica sobre el camino textil
    const clayMat = new THREE.MeshStandardMaterial({ color: 0xc26942, roughness: 0.72 });
    const clayTrimMat = new THREE.MeshStandardMaterial({ color: 0xf0c987, roughness: 0.65 });
    for (let i = 0; i < 3; i++) {
      const jar = new THREE.Group();
      jar.position.set(0.45 + i * 0.68, 0.94, 0.7);

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), clayMat);
      body.scale.set(1, 1.15, 1);
      body.position.y = 0.17;
      body.castShadow = true;

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.14, 12), clayMat);
      neck.position.y = 0.36;

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 16), clayTrimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.43;

      jar.add(body, neck, rim);
      group.add(jar);
    }

    const lanternMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffeba8 })
    );
    lanternMesh.position.set(0, 3.35, 0);
    group.add(lanternMesh);

    const lanternLight = new THREE.PointLight(0xffcf7d, 3.1, 18);
    lanternLight.position.set(0, 3.1, 0);
    group.add(lanternLight);
  }

  buildForestAndFlora() {
    const trunkMat = new THREE.MeshStandardMaterial({
      map: this.textures.bark,
      bumpMap: this.textures.bark,
      bumpScale: 0.06,
      roughness: 0.92
    });
    const foliageMats = [
      new THREE.MeshStandardMaterial({
        map: this.textures.foliage,
        color: 0xdcf0d3,
        roughness: 0.85
      }),
      new THREE.MeshStandardMaterial({
        map: this.textures.foliage,
        color: 0xb7deb0,
        roughness: 0.85
      }),
      new THREE.MeshStandardMaterial({
        map: this.textures.foliage,
        color: 0xcbe6bd,
        roughness: 0.85
      })
    ];
    const boulderMat = new THREE.MeshStandardMaterial({
      map: this.textures.rock,
      bumpMap: this.textures.rock,
      bumpScale: 0.08,
      roughness: 0.9
    });

    let seed = 77;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // Árboles frondosos orgánicos con múltiples racimos de follaje
    for (let i = 0; i < 240; i++) {
      const x = (rand() - 0.5) * 195;
      const z = (rand() - 0.5) * 195;
      if (this.isNearTrailOrWater(x, z)) continue;

      const y = this.getTerrainHeight(x, z);
      const scale = 0.85 + rand() * 1.15;

      const tree = new THREE.Group();
      tree.position.set(x, y - 0.15, z);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 * scale, 0.34 * scale, 3.4 * scale, 8),
        trunkMat
      );
      trunk.position.y = 1.7 * scale;
      trunk.castShadow = true;
      tree.add(trunk);

      const leafMat = foliageMats[i % foliageMats.length];
      const clusterOffsets = [
        [0, 4.1, 0, 1.85],
        [-0.85, 3.5, 0.65, 1.35],
        [0.9, 3.6, -0.55, 1.4],
        [0.15, 5.1, 0.2, 1.4]
      ];
      clusterOffsets.forEach(([cx, cy, cz, r]) => {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 1), leafMat);
        crown.scale.set(1.15, 0.85, 1.15);
        crown.position.set(cx * scale, cy * scale, cz * scale);
        crown.castShadow = true;
        tree.add(crown);
      });

      this.scene.add(tree);
    }

    // Rocas musgosas y helechos cerca del sendero
    for (let i = 0; i < 95; i++) {
      const x = (rand() - 0.5) * 155;
      const z = (rand() - 0.5) * 155;
      if (this.isOnBoardwalkCore(x, z)) continue;
      const y = this.getTerrainHeight(x, z);

      if (i % 3 === 0) {
        const boulder = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.55 + rand() * 0.6, 1),
          boulderMat
        );
        boulder.scale.set(1.2, 0.72, 1.0);
        boulder.position.set(x, y + 0.15, z);
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        this.scene.add(boulder);
      } else {
        const fern = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.45 + rand() * 0.38, 0),
          foliageMats[1]
        );
        fern.scale.set(1.3, 0.55, 1.3);
        fern.position.set(x, y + 0.15, z);
        this.scene.add(fern);
      }
    }
  }

  buildFlyingBirds() {
    const birdColors = [0x2ea8a1, 0xe89b3c, 0x3b7dd8, 0xd45d4c];
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color: birdColors[i % birdColors.length],
        roughness: 0.5
      });

      const body = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 6), bodyMat);
      body.rotation.x = Math.PI / 2;
      bird.add(body);

      const wingGeo = new THREE.BoxGeometry(0.42, 0.025, 0.16);
      const wingLeft = new THREE.Mesh(wingGeo, bodyMat);
      wingLeft.position.set(-0.22, 0, 0);
      const wingRight = new THREE.Mesh(wingGeo, bodyMat);
      wingRight.position.set(0.22, 0, 0);
      bird.add(wingLeft, wingRight);

      bird.userData = {
        centerX: 46 + (i % 3) * 3.5,
        centerY: 6.2 + (i % 3) * 0.9,
        centerZ: 5 + (i % 2) * 3.5,
        radius: 3.5 + i * 0.8,
        speed: 0.45 + i * 0.08,
        phase: i * 1.1,
        wingLeft,
        wingRight
      };

      this.scene.add(bird);
      this.birds.push(bird);
    }
  }

  isOnBoardwalkCore(x, z) {
    for (const pt of this.boardwalkSamples) {
      if (Math.hypot(x - pt.x, z - pt.z) < 3.0) return true;
    }
    return false;
  }

  isNearTrailOrWater(x, z) {
    if (this.distanceToStream(x, z) < 5.5) return true;
    if (Math.hypot(x - 24, z + 17) < 11) return true;
    if (Math.hypot(x + 18.5, z - 19.5) < 7.5) return true;
    if (Math.hypot(x - 47.5, z - 5.5) < 6.0) return true;

    for (const pt of this.boardwalkSamples) {
      if (Math.hypot(x - pt.x, z - pt.z) < 5.2) return true;
    }

    for (let i = 0; i < this.stationTs.length; i++) {
      const sPt = this.boardwalkCurve.getPointAt(this.stationTs[i]);
      if (Math.hypot(x - sPt.x, z - sPt.z) < 6.5) return true;
    }
    return false;
  }

  buildAtmosphereParticles() {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 1] = 2.0 + Math.random() * 9.0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 150;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfff3b0,
      size: 0.18,
      transparent: true,
      opacity: 0.68
    });
    this.pollenParticles = new THREE.Points(geo, mat);
    this.scene.add(this.pollenParticles);
  }

  buildStationMarkers() {
    this.stations.forEach((station, index) => {
      const pt = this.boardwalkCurve.getPointAt(this.stationTs[index]);
      const markerGroup = new THREE.Group();
      markerGroup.position.set(pt.x, pt.y + 2.25, pt.z);
      markerGroup.userData = { stationIndex: index };

      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: 0xf7b944,
          emissive: 0xd9822b,
          emissiveIntensity: 0.65,
          roughness: 0.3
        })
      );
      orb.userData = { stationIndex: index };

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.035, 8, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffdf8e,
          transparent: true,
          opacity: 0.85
        })
      );
      halo.rotation.x = Math.PI / 2;
      halo.userData = { stationIndex: index };

      markerGroup.add(orb, halo);
      this.scene.add(markerGroup);
      this.markers.push(markerGroup);
    });
  }

  getLookAnglesForStation(index) {
    const t = this.stationTs[index];
    const camPos = this.boardwalkCurve.getPointAt(t);
    const target = this.stations[index].lookAt;
    const dx = target.x - camPos.x;
    const dy = target.y - (camPos.y + this.targetEyeHeight);
    const dz = target.z - camPos.z;
    const horiz = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.max(-0.48, Math.min(0.42, Math.atan2(dy, horiz)));
    return { yaw, pitch };
  }

  snapToStation(index) {
    this.travelMode = 'station';
    this.activeStationIndex = index;
    this.currentT = this.stationTs[index];
    this.targetT = this.stationTs[index];
    this.eyeHeight = this.targetEyeHeight;
    const { yaw, pitch } = this.getLookAnglesForStation(index);
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.pitch = pitch;
    this.targetPitch = pitch;
    this.updateMarkerHighlights();
    this.applyCameraTransform();
    this.emitProgress();
  }

  goToStation(index) {
    if (index < 0 || index >= this.stations.length) return;
    this.travelMode = 'station';
    this.activeStationIndex = index;
    this.targetT = this.stationTs[index];
    const { yaw, pitch } = this.getLookAnglesForStation(index);
    this.targetYaw = yaw;
    this.targetPitch = pitch;

    if (this.reducedMotion) {
      this.snapToStation(index);
    } else {
      this.updateMarkerHighlights();
    }
  }

  /** Desplaza suavemente al usuario tramo a tramo a lo largo de los 250 m de pasarela. */
  stepAlongTrail(deltaT) {
    this.travelMode = 'free';
    this.targetT = Math.max(0.01, Math.min(0.98, this.targetT + deltaT));
    const tangent = this.boardwalkCurve.getTangentAt(this.targetT).normalize();
    this.targetYaw = Math.atan2(-tangent.x, -tangent.z);
    this.targetPitch = -0.05;
    if (this.reducedMotion) {
      this.currentT = this.targetT;
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.applyCameraTransform();
      this.emitProgress();
    }
  }

  setWheelchairMode(enabled) {
    this.wheelchairMode = Boolean(enabled);
    this.targetEyeHeight = this.wheelchairMode ? 1.15 : 1.65;
    if (this.reducedMotion) {
      this.eyeHeight = this.targetEyeHeight;
      this.applyCameraTransform();
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
    if (this.reducedMotion) {
      this.snapToStation(this.activeStationIndex);
    }
  }

  lookBy(deltaYaw, deltaPitch = 0) {
    this.targetYaw += deltaYaw;
    this.targetPitch = Math.max(-0.5, Math.min(0.45, this.targetPitch + deltaPitch));
    if (this.reducedMotion) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.applyCameraTransform();
    }
  }

  recenterLook() {
    if (this.travelMode === 'free') {
      const tangent = this.boardwalkCurve.getTangentAt(this.currentT).normalize();
      this.targetYaw = Math.atan2(-tangent.x, -tangent.z);
      this.targetPitch = -0.05;
    } else {
      const { yaw, pitch } = this.getLookAnglesForStation(this.activeStationIndex);
      this.targetYaw = yaw;
      this.targetPitch = pitch;
    }
    if (this.reducedMotion) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.applyCameraTransform();
    }
  }

  updateMarkerHighlights() {
    this.markers.forEach((group, idx) => {
      const isActive = idx === this.activeStationIndex;
      const orb = group.children[0];
      const halo = group.children[1];
      orb.material.color.setHex(isActive ? 0x6ce5b1 : 0xf7b944);
      orb.material.emissive.setHex(isActive ? 0x1c7c54 : 0xd9822b);
      halo.material.color.setHex(isActive ? 0xaef6d7 : 0xffdf8e);
    });
  }

  lerpAngle(current, target, alpha) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * alpha;
  }

  applyCameraTransform() {
    const pos = this.boardwalkCurve.getPointAt(Math.max(0, Math.min(1, this.currentT)));
    this.camera.position.set(pos.x, pos.y + this.eyeHeight, pos.z);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  emitProgress() {
    const meters = Math.round(((this.currentT - 0.02) / 0.94) * 250);
    const clampedMeters = Math.max(0, Math.min(250, meters));

    let nearestIndex = 0;
    let bestDist = Infinity;
    this.stationTs.forEach((tVal, idx) => {
      const d = Math.abs(tVal - this.currentT);
      if (d < bestDist) {
        bestDist = d;
        nearestIndex = idx;
      }
    });

    const waterfallProximity = Math.max(0.1, 1 - Math.abs(this.currentT - this.stationTs[3]) * 3.2);
    this.onProgressChange(clampedMeters, nearestIndex, waterfallProximity);
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    this.onPointerDown = (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };

    this.onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.dragMoved = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.targetYaw += dx * 0.0042;
        this.targetPitch = Math.max(-0.5, Math.min(0.45, this.targetPitch + dy * 0.0034));
        return;
      }

      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.markers, true);
      dom.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
      this.onStationHover(hits.length > 0 ? hits[0].object.userData.stationIndex : null);
    };

    this.onPointerUp = (e) => {
      const wasClick = this.isDragging && !this.dragMoved;
      this.isDragging = false;
      if (wasClick) {
        const rect = dom.getBoundingClientRect();
        this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointerNDC, this.camera);
        const hits = this.raycaster.intersectObjects(this.markers, true);
        if (hits.length > 0) {
          this.onStationClick(hits[0].object.userData.stationIndex);
        }
      }
    };

    this.onResize = () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (!this.reducedMotion) {
      const diffT = this.targetT - this.currentT;
      if (Math.abs(diffT) > 0.0005) {
        const speed = Math.min(Math.abs(diffT) * 3.0, 0.095);
        this.currentT += Math.sign(diffT) * speed * dt * (diffT > 0 ? 1.0 : 1.0);
        if (Math.abs(this.targetT - this.currentT) < 0.0008) {
          this.currentT = this.targetT;
        }
        this.emitProgress();
      }

      // Al desplazarse por tramos largos, orientar suavemente hacia la dirección del sendero
      if (this.travelMode === 'station' && Math.abs(this.targetT - this.currentT) > 0.035) {
        const tangent = this.boardwalkCurve
          .getTangentAt(Math.max(0, Math.min(1, this.currentT)))
          .normalize();
        const trailYaw = Math.atan2(-tangent.x, -tangent.z) + (diffT < 0 ? Math.PI : 0);
        this.yaw = this.lerpAngle(this.yaw, trailYaw, 1 - Math.exp(-3.2 * dt));
        this.pitch += (-0.05 - this.pitch) * (1 - Math.exp(-3.2 * dt));
      } else {
        const lookAlpha = 1 - Math.exp(-5.5 * dt);
        this.yaw = this.lerpAngle(this.yaw, this.targetYaw, lookAlpha);
        this.pitch += (this.targetPitch - this.pitch) * lookAlpha;
      }

      const eyeAlpha = 1 - Math.exp(-6.0 * dt);
      this.eyeHeight += (this.targetEyeHeight - this.eyeHeight) * eyeAlpha;

      // Flujo continuo del agua en cascada y quebrada
      this.waterTextures.forEach((tex) => {
        tex.offset.y -= dt * 0.85;
      });

      // Marcadores flotantes
      this.markers.forEach((group, idx) => {
        const basePt = this.boardwalkCurve.getPointAt(this.stationTs[idx]);
        group.position.y = basePt.y + 2.25 + Math.sin(elapsed * 2 + idx) * 0.1;
        group.children[0].rotation.y = elapsed * 0.85;
      });

      // Aves en vuelo suave junto al Mirador de Aves
      this.birds.forEach((bird) => {
        const d = bird.userData;
        const t = elapsed * d.speed + d.phase;
        const nx = d.centerX + Math.cos(t) * d.radius;
        const nz = d.centerZ + Math.sin(t) * d.radius;
        const ny = d.centerY + Math.sin(t * 2) * 0.55;
        bird.position.set(nx, ny, nz);
        bird.rotation.y = -t;
        const flap = Math.sin(elapsed * 11 + d.phase) * 0.45;
        d.wingLeft.rotation.z = flap;
        d.wingRight.rotation.z = -flap;
      });

      if (this.mistParticles) {
        const pos = this.mistParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) + dt * 0.5;
          if (y > 4.4) y = 1.1;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      if (this.pollenParticles) {
        this.pollenParticles.rotation.y = elapsed * 0.012;
      }
    }

    this.applyCameraTransform();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
