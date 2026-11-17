import * as THREE from 'three';
import {
  createSkyWithCloudsMaterial,
  createCloudLayerMaterial,
  createValleyMistMaterial,
  createWaterfallShaderMaterial,
  createRiverShaderMaterial,
  enhanceTerrainMaterialWithShader,
  enhanceRockMaterialWithShader,
  enhanceBarkWithMossShader,
  enhanceFluffyLeafMaterial,
  enhanceFluffyDepthMaterial,
  enhanceFoliageWithWindShader
} from './shaders.js';
import { buildProceduralTreeGeometries } from './realisticTrees.js';

/**
 * Escena 3D inmersiva de "Sendero Vivo 3D" (recorrido de 250 m).
 * Incluye shaders GLSL para cielo con nubes, neblina de valle, cascada curva con espuma,
 * río con flujo y Fresnel, terreno con variación macro y follaje mecido por la brisa,
 * además de variedad orgánica de troncos y especies del bosque de niebla.
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

    this.stationTs = [0.02, 0.21, 0.4, 0.6, 0.8, 0.96];
    this.currentT = this.stationTs[0];
    this.targetT = this.stationTs[0];
    this.travelMode = 'station';
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
    this.uTime = { value: 0 };
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.markers = [];
    this.birds = [];
    this.cloudMeshes = [];
    this.skyMesh = null;
    this.mistParticles = null;
    this.pollenParticles = null;
    this.grandfatherTreeLookTarget = null;
    this.animationFrameId = null;

    this.loadTextures();
    this.initRenderer();
    this.initScene();
    this.treeMaterials = this.createTreeMaterialLibrary();
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

    const loadLeafTex = (path) => {
      const tex = loader.load(path);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    };

    this.textures = {
      ground: loadTex('/textures/forest_ground.jpg', 36, 36),
      meadowGround: loadTex('/textures/ground_meadow_flowers.jpg', 28, 28),
      pebbleGround: this.createRiverPebblesTexture(),
      wood: loadTex('/textures/wood_planks.jpg', 1, 1),
      woodBeam: loadTex('/textures/wood_planks.jpg', 1, 3),
      rock: loadTex('/textures/cliff_rock.jpg', 3, 3),
      waterfallRock: loadTex('/textures/waterfall_basalt.jpg', 1, 1),
      bark: loadTex('/textures/tree_bark.jpg', 1, 1),
      barkBirch: loadTex('/textures/bark_birch_pale.jpg', 1, 1),
      barkCedar: loadTex('/textures/bark_red_cedar.jpg', 1, 1),
      foliage: loadTex('/textures/foliage_canopy.jpg', 2, 2),
      foliageGolden: loadTex('/textures/foliage_golden_olive.jpg', 2, 2),
      leafBroadleaf: loadLeafTex('/textures/leaves/cluster_broadleaf.png'),
      leafOlive: loadLeafTex('/textures/leaves/cluster_olive.png'),
      leafConifer: loadLeafTex('/textures/leaves/cluster_conifer.png'),
      fernFrond: this.createFernFrondTexture(),
      textile: loadTex('/textures/andean_textile.jpg', 1, 1.3),
      welcomeMap: loadTex('/textures/welcome_map.jpg', 1, 1),
      waterFoam: this.createWaterStreamTexture(),
      softParticle: this.createSoftParticleTexture()
    };
  }

  /** Biblioteca compartida de cortezas con musgo GLSL y ramilletes foliares volumétricos. */
  createTreeMaterialLibrary() {
    const barkSpecs = {
      oak: { tex: this.textures.bark, color: 0xf4eee4, bump: 0.09 },
      birch: { tex: this.textures.barkBirch, color: 0xf6f3ea, bump: 0.065 },
      cedar: { tex: this.textures.barkCedar, color: 0xf4ded3, bump: 0.085 }
    };
    const bark = {};
    for (const [key, spec] of Object.entries(barkSpecs)) {
      const mat = new THREE.MeshStandardMaterial({
        map: spec.tex,
        bumpMap: spec.tex,
        bumpScale: spec.bump,
        color: spec.color,
        roughness: 0.91
      });
      enhanceBarkWithMossShader(mat);
      bark[key] = mat;
    }

    const leafSpecs = {
      broadleaf: { tex: this.textures.leafBroadleaf, tint: 0xf2f9eb, alphaTest: 0.44 },
      olive: { tex: this.textures.leafOlive, tint: 0xf4fae8, alphaTest: 0.44 },
      conifer: { tex: this.textures.leafConifer, tint: 0xeaf5e2, alphaTest: 0.36 }
    };
    const leaves = {};
    const leafDepth = {};
    for (const [key, spec] of Object.entries(leafSpecs)) {
      const mat = new THREE.MeshStandardMaterial({
        map: spec.tex,
        color: spec.tint,
        alphaTest: spec.alphaTest,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.02
      });
      enhanceFluffyLeafMaterial(mat, this.uTime);
      leaves[key] = mat;

      const depthMat = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: spec.tex,
        alphaTest: spec.alphaTest
      });
      enhanceFluffyDepthMaterial(depthMat, this.uTime);
      leafDepth[key] = depthMat;
    }
    return { bark, leaves, leafDepth };
  }

  /** Textura procedural continua de cantos rodados, grava y arena de río para las orillas. */
  createRiverPebblesTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#5c5549';
    ctx.fillRect(0, 0, size, size);

    let s = 421;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const pebbleColors = ['#7c7870', '#968f82', '#646a64', '#504b44', '#857766', '#a89f8d', '#4f5d52'];
    // Arena y grava fina de base
    for (let i = 0; i < 1600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1.5 + rand() * 4.5;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(130, 122, 106, 0.45)' : 'rgba(65, 62, 54, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cantos rodados suaves con reflejo húmedo y repetición en bordes
    for (let i = 0; i < 420; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rx = 7 + rand() * 17;
      const ry = 5 + rand() * 13;
      const rot = rand() * Math.PI;
      const col = pebbleColors[Math.floor(rand() * pebbleColors.length)];

      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = cx + ox;
          const py = cy + oy;
          if (px < -30 || px > size + 30 || py < -30 || py > size + 30) continue;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);

          ctx.fillStyle = 'rgba(22, 24, 20, 0.42)';
          ctx.beginPath();
          ctx.ellipse(2, 3, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(232, 238, 230, 0.22)';
          ctx.beginPath();
          ctx.ellipse(-rx * 0.25, -ry * 0.28, rx * 0.48, ry * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** Fronda botánica plumosa recortada (alpha) para helechos arborescentes y del sotobosque. */
  createFernFrondTexture() {
    const w = 512;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // Raquis central (tallo desde y=506 en base hasta y=18 en punta)
    const stemGrad = ctx.createLinearGradient(w / 2, h, w / 2, 16);
    stemGrad.addColorStop(0, '#4f5e24');
    stemGrad.addColorStop(0.5, '#4b7a2c');
    stemGrad.addColorStop(1, '#78a83b');
    ctx.strokeStyle = stemGrad;
    ctx.lineCap = 'round';
    for (let y = h - 6; y >= 18; y -= 12) {
      const t = 1 - y / h;
      ctx.lineWidth = Math.max(2, 9 * (1 - t * 0.8));
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2, y - 13);
      ctx.stroke();
    }

    // 22 pares de folíolos (pinnas) ligeramente arqueados hacia la punta
    const pairs = 22;
    for (let i = 0; i < pairs; i++) {
      const t = i / (pairs - 1); // 0 base -> 1 punta
      const y = h - 32 - t * (h - 62);
      const envelope = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.94 + 0.14);
      const leafletLen = Math.max(16, envelope * 212 * (1 - t * 0.15));
      const leafletWidth = Math.max(7, 23 * (1 - t * 0.45));

      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(w / 2, y);
        ctx.rotate(dir * (0.28 + t * 0.24));

        const lGrad = ctx.createLinearGradient(0, 0, dir * leafletLen, -leafletWidth);
        if (i % 3 === 0) {
          lGrad.addColorStop(0, '#2e5d24');
          lGrad.addColorStop(0.55, '#4b8631');
          lGrad.addColorStop(1, '#79b343');
        } else {
          lGrad.addColorStop(0, '#265321');
          lGrad.addColorStop(0.6, '#3f762b');
          lGrad.addColorStop(1, '#689e39');
        }

        ctx.fillStyle = lGrad;
        ctx.beginPath();
        ctx.moveTo(0, leafletWidth * 0.32);
        // Contorno dentado/ondulado orgánico del folíolo
        const lobes = 5;
        for (let l = 1; l <= lobes; l++) {
          const u = l / lobes;
          const lx = dir * leafletLen * u;
          const taper = (1 - u * 0.85) * leafletWidth;
          ctx.quadraticCurveTo(
            dir * leafletLen * (u - 0.1),
            -taper * 0.95 - (u * 14),
            lx,
            -taper * 0.25 - u * 16
          );
        }
        ctx.quadraticCurveTo(dir * leafletLen * 0.52, leafletWidth * 0.42 - 8, 0, -leafletWidth * 0.3);
        ctx.closePath();
        ctx.fill();

        // Nervadura sutil clara
        ctx.strokeStyle = 'rgba(176, 218, 102, 0.42)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dir * leafletLen * 0.86, -13);
        ctx.stroke();

        ctx.restore();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** Textura vertical espumosa para muestreo dual en los shaders de agua. */
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

    for (let i = 0; i < 180; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 512;
      const w = 2 + Math.random() * 9;
      const h = 28 + Math.random() * 95;
      ctx.fillStyle =
        i % 3 === 0 ? 'rgba(244, 253, 255, 0.58)' : 'rgba(182, 245, 250, 0.36)';
      ctx.fillRect(x, y, w, h);
      if (y + h > 512) {
        ctx.fillRect(x, y - 512, w, h);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Sprite circular radial difuso para eliminar partículas cuadradas. */
  createSoftParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.16)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  getResponsiveFov(aspect) {
    if (aspect < 0.72) return 72;
    if (aspect < 1.0) return 64;
    return 56;
  }

  initRenderer() {
    const isCompactViewport = window.innerWidth < 768;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompactViewport ? 1.5 : 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.fogColor = new THREE.Color(0xc5ddd4);
    this.fogDensity = 0.011;
    this.scene.background = this.fogColor.clone();
    this.scene.fog = new THREE.FogExp2(this.fogColor.getHex(), this.fogDensity);

    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.getResponsiveFov(aspect), aspect, 0.1, 750);

    const hemiLight = new THREE.HemisphereLight(0xf1f8f5, 0x384b34, 1.02);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff0d4, 1.58);
    sunLight.position.set(-45, 58, 36);
    sunLight.castShadow = true;
    const shadowRes = window.innerWidth < 768 ? 1024 : 2048;
    sunLight.shadow.mapSize.width = shadowRes;
    sunLight.shadow.mapSize.height = shadowRes;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 220;
    const d = 100;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xa3d4c4, 0.44);
    fillLight.position.set(45, 22, -40);
    this.scene.add(fillLight);

    this.buildSkyAndClouds();
  }

  buildSkyAndClouds() {
    // Domo celeste amplio centrado siempre en la cámara (elimina cualquier recorte de plano lejano)
    const skyGeo = new THREE.SphereGeometry(420, 48, 32);
    const skyMat = createSkyWithCloudsMaterial(this.uTime);
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    // Bancos de nubes altas flotando sobre las cumbres
    const cloudMat = createCloudLayerMaterial(this.uTime);
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const dist = 76 + (i % 3) * 26;
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(46 + (i % 3) * 14, 26), cloudMat);
      cloud.position.set(Math.cos(ang) * dist, 40 + (i % 3) * 7, Math.sin(ang) * dist);
      cloud.rotation.x = Math.PI / 2;
      cloud.rotation.z = ang * 0.5;
      cloud.userData = { baseAngle: ang, dist, speed: 0.008 + (i % 3) * 0.004 };
      this.scene.add(cloud);
      this.cloudMeshes.push(cloud);
    }

    // Neblina baja de valle entre quebrada y laderas
    const mistMat = createValleyMistMaterial(this.uTime);
    const mistCoords = [
      [20, 3.2, -16, 26],
      [-28, 3.5, -18, 34],
      [-45, 3.6, 22, 32],
      [48, 3.4, -10, 34],
      [15, 3.1, -34, 38],
      [-10, 3.3, 45, 30]
    ];
    mistCoords.forEach(([x, y, z, s]) => {
      const layer = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.75), mistMat);
      layer.position.set(x, y, z);
      layer.rotation.x = -Math.PI / 2;
      this.scene.add(layer);
    });
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
    for (let i = 0; i <= 95; i++) {
      this.boardwalkSamples.push(this.boardwalkCurve.getPointAt(i / 95));
    }
  }

  getTerrainHeight(x, z) {
    let h = 1.3 + Math.sin(x * 0.055) * 0.7 + Math.cos(z * 0.05) * 0.65;

    if (z < -24) {
      const ridge = (-24 - z) * 0.28;
      h += Math.min(20, ridge * (0.85 + 0.35 * Math.sin(x * 0.11)));
    }

    const distWf = Math.hypot(x - 26.5, z + 24.5);
    if (distWf < 9.5) {
      h += (9.5 - distWf) * 1.05;
    }

    const distPool = Math.hypot(x - 23.6, z + 15.6);
    if (distPool < 7.6) {
      h = Math.min(h, 0.35 + (distPool / 7.6) * 1.15);
    }

    const radial = Math.hypot(x, z);
    if (radial > 76) {
      h += (radial - 76) * 0.22;
    }

    const distStream = this.distanceToStream(x, z);
    if (distStream < 6.0) {
      h = Math.min(h, 0.25 + (distStream / 6.0) * 1.35);
    }

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
    const d2 = this.pointToSegmentDist(x, z, 16, -9, -18, -42);
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
    const zoneWeights = [];
    const cMeadow = new THREE.Color(0xf4f8ef);
    const cRockTint = new THREE.Color(0xe6ece7);
    const cBankTint = new THREE.Color(0xf0eadf);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      const streamDist = this.distanceToStream(x, z);
      const slope =
        Math.abs(this.getTerrainHeight(x + 1.4, z) - y) +
        Math.abs(this.getTerrainHeight(x, z + 1.4) - y);

      if (y > 6.5) tmp.copy(cRockTint);
      else if (streamDist < 4.8) tmp.copy(cBankTint);
      else tmp.copy(cMeadow);
      colors.push(tmp.r, tmp.g, tmp.b);

      // Pesos multizona para shader GLSL: [bosque, pradera con flores, cantos de río, roca]
      const rockW = THREE.MathUtils.clamp((y - 5.2) / 3.2 + Math.max(0, slope - 0.85) * 0.7, 0, 1);
      const pebbleW = THREE.MathUtils.clamp(1 - (streamDist - 1.2) / 4.2, 0, 1) * (1 - rockW * 0.5);
      const meadowPatch = 0.5 + 0.5 * Math.sin(x * 0.065 + Math.cos(z * 0.055) * 1.4);
      const rawMeadow =
        y < 4.6 && streamDist > 3.6 ? THREE.MathUtils.clamp((meadowPatch - 0.35) * 1.45, 0, 1) : 0;
      const meadowW = rawMeadow * (1 - rockW) * (1 - pebbleW);
      const forestW = Math.max(0.05, 1 - Math.min(0.95, rockW + pebbleW + meadowW));

      zoneWeights.push(forestW, meadowW, pebbleW, rockW);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aTerrainZones', new THREE.Float32BufferAttribute(zoneWeights, 4));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.ground,
      bumpMap: this.textures.ground,
      bumpScale: 0.09,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02
    });
    enhanceTerrainMaterialWithShader(mat, {
      meadowTex: this.textures.meadowGround,
      pebblesTex: this.textures.pebbleGround,
      rockTex: this.textures.rock
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  /** Construye cinta curva continua para el río con shader de flujo, cáusticas y Fresnel. */
  buildStreamBedWater() {
    const poolMat = createRiverShaderMaterial(
      this.uTime,
      this.textures.waterFoam,
      this.fogColor,
      this.fogDensity,
      true
    );
    const poolGeo = new THREE.PlaneGeometry(13.2, 13.2, 24, 24);
    poolGeo.rotateX(-Math.PI / 2);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(23.6, 1.18, -15.6);
    this.scene.add(pool);

    const riverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(23.2, 1.16, -15.4),
      new THREE.Vector3(19.5, 1.14, -12.2),
      new THREE.Vector3(16.0, 1.12, -9.0),
      new THREE.Vector3(8.5, 1.09, -15.0),
      new THREE.Vector3(-2.0, 1.06, -25.5),
      new THREE.Vector3(-18.0, 1.03, -41.5)
    ]);
    const riverGeo = this.createRibbonGeometry(riverCurve, 5.2, 70);
    const riverMat = createRiverShaderMaterial(
      this.uTime,
      this.textures.waterFoam,
      this.fogColor,
      this.fogDensity,
      false
    );
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    this.scene.add(riverMesh);
  }

  createRibbonGeometry(curve, width, segments) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const halfW = width * (0.5 + 0.08 * Math.sin(t * 14));

      const left = pt.clone().addScaledVector(side, -halfW);
      const right = pt.clone().addScaledVector(side, halfW);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, t * 5, 1, t * 5);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
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

  /** Perturba vértices de geometrías de roca para obtener crestas angulares realistas. */
  perturbGeometry(geometry, amplitude = 0.22, seed = 13) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n =
        Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 - seed) * Math.sin(z * 2.9 + seed * 0.5);
      const factor = 1 + n * amplitude;
      pos.setXYZ(i, x * factor, y * factor, z * factor);
    }
    geometry.computeVertexNormals();
    return geometry;
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

    const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.56), woodMat);
    benchSeat.position.set(-1.6, 0.52, -1.7);
    benchSeat.castShadow = true;
    const benchBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.08), woodMat);
    benchBack.position.set(-1.6, 0.78, -1.96);
    group.add(benchSeat, benchBack);

    const mapFrame = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.55, 0.12), woodMat);
    mapFrame.position.set(1.75, 1.45, -1.65);
    mapFrame.rotation.y = -0.45;
    mapFrame.castShadow = true;

    const mapFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.05, 1.38),
      new THREE.MeshStandardMaterial({ map: this.textures.welcomeMap, roughness: 0.65 })
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

  /**
   * Estación 2: Árbol Abuelo procedural realista fuera de la pasarela (8,8 m al noroeste)
   * con raíces tablares, ramificación jerárquica natural, hojas con recorte alfa, lianas y bromelias.
   */
  buildArbolAbuelo() {
    const t2 = this.stationTs[1];
    const pt = this.boardwalkCurve.getPointAt(t2);
    const tangent = this.boardwalkCurve.getTangentAt(t2).normalize();
    const leftSide = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();

    this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 5.4, 5.4, 0.75);

    const treePos = pt.clone().addScaledVector(leftSide, 8.8);
    const groundY = this.getTerrainHeight(treePos.x, treePos.z);
    this.grandfatherTreePos = new THREE.Vector3(treePos.x, groundY, treePos.z);
    this.grandfatherTreeLookTarget = new THREE.Vector3(treePos.x, groundY + 4.4, treePos.z);

    const treeGroup = new THREE.Group();
    treeGroup.position.set(treePos.x, groundY - 0.16, treePos.z);

    const treeData = buildProceduralTreeGeometries('grandfather', 7142);
    const barkMat = this.treeMaterials.bark.oak;
    const leafMat = this.treeMaterials.leaves.broadleaf;

    const branchMesh = new THREE.Mesh(treeData.branchGeo, barkMat);
    branchMesh.castShadow = true;
    branchMesh.receiveShadow = true;
    treeGroup.add(branchMesh);

    const leafMesh = new THREE.Mesh(treeData.leafGeo, leafMat);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    leafMesh.customDepthMaterial = this.treeMaterials.leafDepth.broadleaf;
    treeGroup.add(leafMesh);

    // Raíces tablares musgosas abrazando la base ensanchada del tronco
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.25;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(ang) * 0.38, 1.55, Math.sin(ang) * 0.38),
        new THREE.Vector3(Math.cos(ang) * 1.15, 0.55, Math.sin(ang) * 1.15),
        new THREE.Vector3(Math.cos(ang) * 2.1, -0.05, Math.sin(ang) * 2.1)
      ]);
      const rootMesh = new THREE.Mesh(new THREE.TubeGeometry(rootCurve, 9, 0.18, 7, false), barkMat);
      rootMesh.castShadow = true;
      treeGroup.add(rootMesh);
    }

    // Lianas colgantes y bromelias epífitas ancladas a ramas primarias reales generadas
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3b6938, roughness: 0.88 });
    const anchors = treeData.primaryBranchAnchors.slice(0, 5);
    anchors.forEach((anchor, idx) => {
      const vineStart = anchor.mid;
      const dropLen = 2.0 + (idx % 2) * 0.55;
      const vineCurve = new THREE.CatmullRomCurve3([
        vineStart.clone(),
        vineStart.clone().add(new THREE.Vector3(0.08, -dropLen * 0.5, -0.06)),
        vineStart.clone().add(new THREE.Vector3(-0.04, -dropLen, 0.05))
      ]);
      treeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(vineCurve, 7, 0.03, 5, false), vineMat));

      const rosette = this.createBromeliadRosette(idx % 2 === 0 ? 0xe05a47 : 0xe89a38);
      rosette.position.copy(anchor.base).add(new THREE.Vector3(0, 0.12, 0));
      rosette.rotation.z = (idx % 2 === 0 ? -1 : 1) * 0.2;
      treeGroup.add(rosette);
    });

    this.scene.add(treeGroup);
  }

  createBromeliadRosette(flowerHex) {
    const group = new THREE.Group();
    const petalLeafMat = new THREE.MeshStandardMaterial({ color: 0x5d9c49, roughness: 0.7 });
    const centerMat = new THREE.MeshStandardMaterial({ color: flowerHex, roughness: 0.55 });

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.36), petalLeafMat);
      blade.position.set(Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14);
      blade.rotation.y = -a + Math.PI / 2;
      blade.rotation.x = -0.4;
      group.add(blade);
    }
    const spike = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), centerMat);
    spike.scale.y = 1.6;
    spike.position.y = 0.14;
    group.add(spike);
    return group;
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
    const leafMat = new THREE.MeshStandardMaterial({ map: this.textures.foliage, roughness: 0.8 });
    enhanceFoliageWithWindShader(leafMat, this.uTime);

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
      enhanceFoliageWithWindShader(herbMat, this.uTime);

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

  /**
   * Geometría curvada para la cascada: nace horizontal sobre la cornisa rocosa,
   * cae curvándose de forma natural y se ensancha hacia la poza de espuma.
   */
  createCurvedWaterfallGeometry(width = 3.8, height = 9.4) {
    const segX = 18;
    const segY = 28;
    const geo = new THREE.PlaneGeometry(width, height, segX, segY);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const v = (y + height / 2) / height; // 0 = base en poza, 1 = cresta superior

      // Ensanchamiento suave en la base y curvatura hacia atrás sobre el risco en la cresta
      const flare = 1.0 + (1.0 - v) * 0.32;
      const lipBack = v > 0.72 ? -Math.pow((v - 0.72) / 0.28, 2) * 2.1 : 0;
      const arcForward = Math.sin(v * Math.PI) * 0.55;
      pos.setXYZ(i, x * flare, y, lipBack + arcForward);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Geometría angulosa estratificada para riscos y saltos de cascada (con repisas y fisuras).
   */
  createStratifiedCliffGeometry(seed = 17) {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Estratos horizontales escalonados y fracturas verticales angulosas
      const strataStep = Math.sin(y * 10.5 + seed * 0.7) * 0.085 + Math.cos(y * 19.0 + x * 4.0) * 0.04;
      const shelfTerrace = (Math.round((y + 1.0) * 3.5) / 3.5 - (y + 1.0)) * 0.22;
      const cragNoise =
        Math.sin(x * 5.3 + seed) * Math.cos(z * 4.7 - seed * 0.5) * 0.14 +
        Math.abs(Math.sin((x + z) * 6.5 + y * 2.2)) * 0.09;

      const factor = 0.92 + strataStep + shelfTerrace + cragNoise;
      const baseWiden = y < 0 ? 1.0 + Math.abs(y) * 0.18 : 1.0;
      pos.setXYZ(i, x * factor * baseWiden, y * (0.96 + cragNoise * 0.25), z * factor * baseWiden);
    }
    geo.computeVertexNormals();
    return geo;
  }

  buildWaterfall() {
    const pt = this.boardwalkCurve.getPointAt(this.stationTs[3]);
    this.createDeckPlatform(pt.x, pt.y - 0.02, pt.z, 5.2, 4.6, -0.74);

    const waterfallRockMat = new THREE.MeshStandardMaterial({
      map: this.textures.waterfallRock,
      bumpMap: this.textures.waterfallRock,
      bumpScale: 0.18,
      roughness: 0.84,
      metalness: 0.04
    });
    enhanceRockMaterialWithShader(waterfallRockMat);

    // Risco basáltico estratificado alrededor de la garganta de agua y poza
    const cliffLayout = [
      // Paredes laterales y macizo trasero principal
      { x: 19.4, y: 4.3, z: -20.2, sx: 3.3, sy: 6.2, sz: 3.1, ry: 0.35, seed: 11 },
      { x: 29.8, y: 4.9, z: -18.2, sx: 3.4, sy: 6.8, sz: 3.1, ry: -0.45, seed: 23 },
      { x: 25.8, y: 5.9, z: -23.0, sx: 5.6, sy: 8.2, sz: 2.9, ry: 0.12, seed: 37 },
      // Saliente superior por donde brota la cascada y repisas recedidas detrás del chorro
      { x: 25.7, y: 8.95, z: -19.8, sx: 3.5, sy: 1.35, sz: 2.3, ry: -0.3, seed: 43 },
      { x: 25.2, y: 4.8, z: -20.2, sx: 2.5, sy: 1.5, sz: 1.7, ry: 0.25, seed: 51 },
      { x: 27.1, y: 3.1, z: -19.4, sx: 2.3, sy: 1.4, sz: 1.6, ry: -0.6, seed: 67 },
      // Contrafuertes rocosos bajos flanqueando la caída
      { x: 20.3, y: 2.0, z: -16.8, sx: 2.0, sy: 2.2, sz: 1.8, ry: 0.7, seed: 73 },
      { x: 28.6, y: 2.2, z: -15.6, sx: 2.0, sy: 2.3, sz: 1.8, ry: -0.8, seed: 89 }
    ];

    cliffLayout.forEach((c) => {
      const geo = this.createStratifiedCliffGeometry(c.seed);
      const rock = new THREE.Mesh(geo, waterfallRockMat);
      rock.position.set(c.x, c.y, c.z);
      rock.scale.set(c.sx, c.sy, c.sz);
      rock.rotation.y = c.ry;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    });

    // Rocas ribereñas húmedas alrededor de la poza y arranque del arroyo (despejando el centro de caída)
    const poolBoulders = [
      [20.0, 0.85, -14.8, 1.3, 0.82, 1.1, 0.3],
      [21.4, 0.52, -13.1, 0.9, 0.56, 0.84, 1.1],
      [27.6, 0.9, -13.9, 1.4, 0.86, 1.2, -0.5],
      [26.3, 0.48, -12.4, 0.88, 0.5, 0.82, 2.0],
      [18.9, 0.7, -11.4, 1.05, 0.65, 0.92, 0.8],
      [22.4, 0.42, -11.9, 0.72, 0.42, 0.68, -1.2],
      [26.6, 0.58, -17.3, 1.05, 0.65, 0.95, 0.5],
      [21.4, 0.62, -17.7, 1.15, 0.74, 1.0, -0.4]
    ];
    poolBoulders.forEach(([bx, by, bz, sx, sy, sz, ry], idx) => {
      const bGeo = this.createStratifiedCliffGeometry(100 + idx * 13);
      const boulder = new THREE.Mesh(bGeo, waterfallRockMat);
      boulder.position.set(bx, by, bz);
      boulder.scale.set(sx, sy, sz);
      boulder.rotation.y = ry;
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.scene.add(boulder);
    });

    // Cortina principal de cascada con Shader GLSL personalizado
    const wfShaderMat = createWaterfallShaderMaterial(
      this.uTime,
      this.textures.waterFoam,
      this.fogColor,
      this.fogDensity
    );
    const mainWf = new THREE.Mesh(this.createCurvedWaterfallGeometry(3.8, 9.2), wfShaderMat);
    mainWf.position.set(24.6, 5.15, -17.6);
    mainWf.rotation.y = -0.62;
    this.scene.add(mainWf);

    // Segundo velo más ancho de rocío luminoso delante del chorro principal
    const veilWf = new THREE.Mesh(this.createCurvedWaterfallGeometry(4.5, 8.8), wfShaderMat);
    veilWf.position.set(24.4, 5.0, -17.35);
    veilWf.rotation.y = -0.62;
    this.scene.add(veilWf);

    // Partículas circulares difusas (sin cuadrados!) de bruma ascendente en la poza
    const mistCount = 130;
    const mistPos = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
      mistPos[i * 3] = 23.6 + (Math.random() - 0.5) * 5.6;
      mistPos[i * 3 + 1] = 1.05 + Math.random() * 3.4;
      mistPos[i * 3 + 2] = -15.8 + (Math.random() - 0.5) * 5.2;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.PointsMaterial({
      map: this.textures.softParticle,
      color: 0xeefbff,
      size: 1.35,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
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

    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 0.58), woodMat);
    bench.position.set(-1.3, 0.52, -1.35);
    bench.castShadow = true;
    group.add(bench);

    const treeX = 47.5;
    const treeZ = 5.5;
    const gy = this.getTerrainHeight(treeX, treeZ);
    const blossomTree = new THREE.Group();
    blossomTree.position.set(treeX, gy - 0.12, treeZ);

    const blossomData = buildProceduralTreeGeometries('blossomCanopy', 2048);
    const branchMesh = new THREE.Mesh(blossomData.branchGeo, this.treeMaterials.bark.cedar);
    branchMesh.castShadow = true;
    branchMesh.receiveShadow = true;
    blossomTree.add(branchMesh);

    const leafMesh = new THREE.Mesh(blossomData.leafGeo, this.treeMaterials.leaves.olive);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    leafMesh.customDepthMaterial = this.treeMaterials.leafDepth.olive;
    blossomTree.add(leafMesh);

    // Flores andinas ancladas directamente sobre puntas reales de ramas y hojas
    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf27d58, roughness: 0.55 });
    const anchors = blossomData.leafTipAnchors;
    if (anchors.length > 0) {
      const step = Math.max(1, Math.floor(anchors.length / 22));
      const flowerGeo = new THREE.SphereGeometry(0.11, 7, 6);
      for (let i = 0; i < anchors.length; i += step) {
        const flower = new THREE.Mesh(flowerGeo, blossomMat);
        flower.position.copy(anchors[i]);
        blossomTree.add(flower);
      }
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

  /**
   * Construye geometría curva de fronda botánica para helechos arborescentes y sotobosque.
   */
  createCurvedFrondGeometry(length = 1.85, width = 0.72, archRise = 0.34, droop = 0.56) {
    const geo = new THREE.PlaneGeometry(width, length, 4, 9);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const yOrig = pos.getY(i);
      const t = (yOrig + length * 0.5) / length; // 0 en tallo -> 1 en punta
      const forwardZ = t * length;
      const curveY =
        (Math.sin(t * Math.PI * 0.74) * archRise - Math.pow(t, 1.85) * droop) * length;
      const vFold = -Math.abs(x) * 0.16;
      pos.setXYZ(i, x, curveY + vFold, forwardZ);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /** Verifica que arbustos/helechos no invadan la pasarela ni el cauce profundo ni cabañas. */
  isBlockedForUnderstory(x, z) {
    if (this.distanceToStream(x, z) < 2.55) return true;
    if (Math.hypot(x - 23.6, z + 15.6) < 6.4) return true;
    if (this.grandfatherTreePos && Math.hypot(x - this.grandfatherTreePos.x, z - this.grandfatherTreePos.z) < 2.9) {
      return true;
    }
    if (Math.hypot(x - 47.5, z - 5.5) < 4.5) return true;
    for (const pt of this.boardwalkSamples) {
      if (Math.hypot(x - pt.x, z - pt.z) < 2.28) return true;
    }
    for (let i = 0; i < this.stationTs.length; i++) {
      const sPt = this.boardwalkCurve.getPointAt(this.stationTs[i]);
      if (Math.hypot(x - sPt.x, z - sPt.z) < 3.6) return true;
    }
    return false;
  }

  /**
   * Construye el bosque nublado con 9 prototipos arbóreos procedurales instanciados
   * (roble, cedro/nogal, aliso plateado, Polylepis rojizo y romerillo), helechos arborescentes
   * arqueados y abundante sotobosque de arbustos ramificados reales y helechos rastreros.
   */
  buildForestAndFlora() {
    const fernMat = new THREE.MeshStandardMaterial({
      map: this.textures.fernFrond,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.78,
      color: 0xe8f5dc
    });
    enhanceFoliageWithWindShader(fernMat, this.uTime);

    const rockMat = new THREE.MeshStandardMaterial({
      map: this.textures.waterfallRock,
      bumpMap: this.textures.waterfallRock,
      bumpScale: 0.12,
      roughness: 0.88
    });
    enhanceRockMaterialWithShader(rockMat);

    const blossomColors = [0xe46b8f, 0xf3bf42, 0xf7f5e8, 0xe88b58];
    const blossomMats = blossomColors.map(
      (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 })
    );

    const frondGeoTree = this.createCurvedFrondGeometry(1.9, 0.76, 0.34, 0.56);
    const frondGeoGround = this.createCurvedFrondGeometry(1.05, 0.44, 0.44, 0.52);

    // 9 prototipos arbóreos reales con ramas cónicas y tarjetas foliares alfa
    const treeSpecs = [
      { preset: 'oakCloud', seed: 101 },
      { preset: 'oakCloud', seed: 307 },
      { preset: 'ashAndean', seed: 203 },
      { preset: 'ashAndean', seed: 409 },
      { preset: 'birchAlder', seed: 511 },
      { preset: 'birchAlder', seed: 613 },
      { preset: 'polylepis', seed: 719 },
      { preset: 'polylepis', seed: 823 },
      { preset: 'podocarpus', seed: 929 }
    ];
    const treeProtos = treeSpecs.map((spec) => ({
      data: buildProceduralTreeGeometries(spec.preset, spec.seed),
      matrices: []
    }));

    // 2 prototipos de arbustos ramificados reales (reemplazan esferas poligonales en el suelo)
    const shrubProtos = [
      { data: buildProceduralTreeGeometries('shrubAsh', 41), matrices: [] },
      { data: buildProceduralTreeGeometries('shrubOak', 73), matrices: [] }
    ];
    const flowerBuckets = blossomMats.map(() => []);

    let seed = 91;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const dummy = new THREE.Object3D();

    // 1) Distribuir 255 árboles: ~90% arbóreos procedurales realistas + ~10% helechos arborescentes
    for (let i = 0; i < 255; i++) {
      const x = (rand() - 0.5) * 195;
      const z = (rand() - 0.5) * 195;
      if (this.isNearTrailOrWater(x, z)) continue;

      const y = this.getTerrainHeight(x, z);
      const scale = 0.85 + rand() * 0.45;
      const rotY = rand() * Math.PI * 2;

      if (i % 10 === 9) {
        const fernScale = 0.8 + rand() * 0.9;
        const treeFern = this.createMountainTreeFern(
          fernScale,
          this.treeMaterials.bark.oak,
          fernMat,
          frondGeoTree,
          rand
        );
        treeFern.position.set(x, y - 0.16, z);
        treeFern.rotation.y = rotY;
        this.scene.add(treeFern);
      } else {
        const protoIdx = Math.floor(rand() * treeProtos.length);
        dummy.position.set(x, y - 0.14, z);
        dummy.rotation.set((rand() - 0.5) * 0.04, rotY, (rand() - 0.5) * 0.04);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        treeProtos[protoIdx].matrices.push(dummy.matrix.clone());
      }
    }

    const pushShrubInstance = (sx, sy, sz, sScale, rotY, addFlowers) => {
      const bucket = shrubProtos[Math.floor(rand() * shrubProtos.length)];
      dummy.position.set(sx, sy - 0.04, sz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(sScale);
      dummy.updateMatrix();
      bucket.matrices.push(dummy.matrix.clone());

      if (addFlowers) {
        const fBucket = flowerBuckets[Math.floor(rand() * flowerBuckets.length)];
        const count = 4 + Math.floor(rand() * 3);
        for (let f = 0; f < count; f++) {
          const ang = (f / count) * Math.PI * 2 + rand() * 0.4;
          const rad = (0.28 + rand() * 0.42) * sScale;
          dummy.position.set(
            sx + Math.cos(ang) * rad,
            sy + (0.65 + rand() * 0.38) * sScale,
            sz + Math.sin(ang) * rad
          );
          dummy.rotation.set(0, rand() * Math.PI, 0);
          dummy.scale.setScalar(sScale * 0.95);
          dummy.updateMatrix();
          fBucket.push(dummy.matrix.clone());
        }
      }
    };

    // 2) Bordes verdes vivos a lo largo de ambos lados de toda la pasarela
    for (let i = 2; i < this.boardwalkSamples.length - 1; i++) {
      if (i % 2 !== 0 && rand() > 0.45) continue;
      const pt = this.boardwalkSamples[i];
      const nextPt = this.boardwalkSamples[Math.min(this.boardwalkSamples.length - 1, i + 1)];
      const tx = nextPt.x - pt.x;
      const tz = nextPt.z - pt.z;
      const len = Math.max(0.01, Math.hypot(tx, tz));
      const nx = -tz / len;
      const nz = tx / len;

      for (const side of [-1, 1]) {
        if (rand() < 0.22) continue;
        const offset = 2.6 + rand() * 3.8;
        const sx = pt.x + nx * side * offset + (rand() - 0.5) * 1.4;
        const sz = pt.z + nz * side * offset + (rand() - 0.5) * 1.4;
        if (this.isBlockedForUnderstory(sx, sz)) continue;

        const sy = this.getTerrainHeight(sx, sz);
        if (rand() < 0.4) {
          const fernClump = this.createGroundFernClump(0.78 + rand() * 0.55, fernMat, frondGeoGround, rand);
          fernClump.position.set(sx, sy - 0.04, sz);
          fernClump.rotation.y = rand() * Math.PI * 2;
          this.scene.add(fernClump);
        } else {
          pushShrubInstance(sx, sy, sz, 0.85 + rand() * 0.5, rand() * Math.PI * 2, rand() > 0.48);
        }
      }
    }

    // 3) Sotobosque amplio del valle: arbustos ramificados, helechos, troncos caídos y rocas
    for (let i = 0; i < 245; i++) {
      const x = (rand() - 0.5) * 165;
      const z = (rand() - 0.5) * 165;
      if (this.isOnBoardwalkCore(x, z)) continue;
      const y = this.getTerrainHeight(x, z);

      if (i % 14 === 0 && !this.isNearTrailOrWater(x, z)) {
        const logCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.4, 0.18, 0),
          new THREE.Vector3(0, 0.28, 0.15),
          new THREE.Vector3(1.5, 0.15, -0.1)
        ]);
        const log = new THREE.Mesh(
          new THREE.TubeGeometry(logCurve, 8, 0.24 + rand() * 0.12, 7, false),
          this.treeMaterials.bark.oak
        );
        log.position.set(x, y, z);
        log.rotation.y = rand() * Math.PI;
        log.castShadow = true;
        this.scene.add(log);
      } else if (i % 9 === 0 && !this.isBlockedForUnderstory(x, z)) {
        const geo = this.perturbGeometry(
          new THREE.DodecahedronGeometry(0.55 + rand() * 0.55, 1),
          0.25,
          i
        );
        const boulder = new THREE.Mesh(geo, rockMat);
        boulder.scale.set(1.2, 0.68, 1.0);
        boulder.position.set(x, y + 0.12, z);
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        this.scene.add(boulder);
      } else if (!this.isBlockedForUnderstory(x, z)) {
        if (i % 3 === 0) {
          const fernClump = this.createGroundFernClump(0.8 + rand() * 0.65, fernMat, frondGeoGround, rand);
          fernClump.position.set(x, y - 0.04, z);
          fernClump.rotation.y = rand() * Math.PI * 2;
          this.scene.add(fernClump);
        } else {
          pushShrubInstance(x, y, z, 0.85 + rand() * 0.6, rand() * Math.PI * 2, rand() > 0.52);
        }
      }
    }

    // Emitir InstancedMesh por cada prototipo arbóreo y arbustivo (bajas llamadas draw)
    const addInstancedGroup = (proto) => {
      const count = proto.matrices.length;
      if (count === 0) return;

      const { branchGeo, leafGeo, options } = proto.data;
      const barkMat = this.treeMaterials.bark[options.bark.type] || this.treeMaterials.bark.oak;
      const leafMat =
        this.treeMaterials.leaves[options.leaves.type] || this.treeMaterials.leaves.broadleaf;
      const depthMat =
        this.treeMaterials.leafDepth[options.leaves.type] ||
        this.treeMaterials.leafDepth.broadleaf;

      const barkInst = new THREE.InstancedMesh(branchGeo, barkMat, count);
      const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, count);
      barkInst.castShadow = true;
      barkInst.receiveShadow = true;
      barkInst.frustumCulled = false;

      leafInst.castShadow = true;
      leafInst.receiveShadow = true;
      leafInst.frustumCulled = false;
      leafInst.customDepthMaterial = depthMat;

      proto.matrices.forEach((mat, idx) => {
        barkInst.setMatrixAt(idx, mat);
        leafInst.setMatrixAt(idx, mat);
      });
      barkInst.instanceMatrix.needsUpdate = true;
      leafInst.instanceMatrix.needsUpdate = true;
      this.scene.add(barkInst, leafInst);
    };

    treeProtos.forEach(addInstancedGroup);
    shrubProtos.forEach(addInstancedGroup);

    const flowerGeo = new THREE.SphereGeometry(0.065, 6, 5);
    flowerBuckets.forEach((matrices, idx) => {
      if (matrices.length === 0) return;
      const flowerInst = new THREE.InstancedMesh(flowerGeo, blossomMats[idx], matrices.length);
      flowerInst.frustumCulled = false;
      matrices.forEach((m, i) => flowerInst.setMatrixAt(i, m));
      flowerInst.instanceMatrix.needsUpdate = true;
      this.scene.add(flowerInst);
    });
  }

  /** Roseta de helecho rastrero natural con frondas arqueadas hacia afuera. */
  createGroundFernClump(scale, fernMat, frondGeo, rand) {
    const group = new THREE.Group();
    const count = 6 + Math.floor(rand() * 3);
    for (let f = 0; f < count; f++) {
      const ang = (f / count) * Math.PI * 2 + (rand() - 0.5) * 0.28;
      const frond = new THREE.Mesh(frondGeo, fernMat);
      const s = scale * (0.85 + rand() * 0.3);
      frond.scale.set(s, s, s);
      frond.position.set(0, 0.08 * scale, 0);
      frond.rotation.y = ang;
      frond.rotation.x = -0.25 - rand() * 0.2;
      frond.castShadow = true;
      group.add(frond);
    }
    return group;
  }

  /** Helecho arborescente Cyathea realista con corona fibrosa y frondas arqueadas plumosas. */
  createMountainTreeFern(scale, barkMat, fernMat, frondGeo, rand) {
    const group = new THREE.Group();
    const topY = (3.6 + rand() * 0.8) * scale;
    const tipX = 0.18 * scale;
    const tipZ = (rand() - 0.5) * 0.16 * scale;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.24 * scale, topY * 0.55, tipZ * 0.5),
      new THREE.Vector3(tipX, topY, tipZ)
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 9, 0.13 * scale, 7, false), barkMat);
    trunk.castShadow = true;
    group.add(trunk);

    // Yema apical fibrosa en la cima del tronco de donde brotan todas las frondas
    const crownHub = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 9, 8),
      barkMat
    );
    crownHub.position.set(tipX, topY, tipZ);
    group.add(crownHub);

    // Corona exterior de 9 frondas largas arqueadas
    const outerCount = 9;
    for (let f = 0; f < outerCount; f++) {
      const ang = (f / outerCount) * Math.PI * 2 + (rand() - 0.5) * 0.16;
      const frond = new THREE.Mesh(frondGeo, fernMat);
      const s = scale * (0.92 + rand() * 0.16);
      frond.scale.set(s, s, s);
      frond.position.set(tipX, topY + 0.02 * scale, tipZ);
      frond.rotation.y = ang;
      frond.rotation.x = -0.14 - rand() * 0.12;
      frond.castShadow = true;
      group.add(frond);
    }

    // Corona interior de 4 frondas jóvenes erguidas
    for (let f = 0; f < 4; f++) {
      const ang = (f / 4) * Math.PI * 2 + 0.4;
      const frond = new THREE.Mesh(frondGeo, fernMat);
      const s = scale * 0.62;
      frond.scale.set(s, s, s);
      frond.position.set(tipX, topY + 0.06 * scale, tipZ);
      frond.rotation.y = ang;
      frond.rotation.x = -0.58;
      frond.castShadow = true;
      group.add(frond);
    }
    return group;
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
    if (this.distanceToStream(x, z) < 5.6) return true;
    if (Math.hypot(x - 24, z + 17) < 11.5) return true;
    if (this.grandfatherTreePos && Math.hypot(x - this.grandfatherTreePos.x, z - this.grandfatherTreePos.z) < 7.5) {
      return true;
    }
    if (Math.hypot(x - 47.5, z - 5.5) < 6.0) return true;

    for (const pt of this.boardwalkSamples) {
      if (Math.hypot(x - pt.x, z - pt.z) < 5.2) return true;
    }

    for (let i = 0; i < this.stationTs.length; i++) {
      const sPt = this.boardwalkCurve.getPointAt(this.stationTs[i]);
      if (Math.hypot(x - sPt.x, z - sPt.z) < 6.8) return true;
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
      map: this.textures.softParticle,
      color: 0xfff3b0,
      size: 0.42,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
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
    const target =
      index === 1 && this.grandfatherTreeLookTarget
        ? this.grandfatherTreeLookTarget
        : this.stations[index].lookAt;
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
    this.activePointerId = null;

    this.onPointerDown = (e) => {
      if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
      this.activePointerId = e.pointerId;
      this.isDragging = true;
      this.dragMoved = false;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };

    this.onPointerMove = (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isDragging && e.pointerId === this.activePointerId) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.dragMoved = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        const isTouch = e.pointerType === 'touch';
        const yawSens = isTouch ? 0.0058 : 0.0042;
        const pitchSens = isTouch ? 0.0044 : 0.0034;
        this.targetYaw += dx * yawSens;
        this.targetPitch = Math.max(-0.5, Math.min(0.45, this.targetPitch + dy * pitchSens));
        return;
      }

      if (e.pointerType === 'touch') return;
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.markers, true);
      dom.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
      this.onStationHover(hits.length > 0 ? hits[0].object.userData.stationIndex : null);
    };

    this.onPointerUp = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      const wasClick = this.isDragging && !this.dragMoved;
      this.isDragging = false;
      this.activePointerId = null;
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

    this.onPointerCancel = (e) => {
      if (e.pointerId === this.activePointerId) {
        this.isDragging = false;
        this.activePointerId = null;
      }
    };

    this.onResize = () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = Math.max(1, this.container.clientHeight);
      const aspect = w / h;
      this.camera.aspect = aspect;
      this.camera.fov = this.getResponsiveFov(aspect);
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 2));
      this.renderer.setSize(w, h);
    };

    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('resize', this.onResize);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (!this.reducedMotion) {
      this.uTime.value = elapsed;

      const diffT = this.targetT - this.currentT;
      if (Math.abs(diffT) > 0.0005) {
        const speed = Math.min(Math.abs(diffT) * 3.0, 0.095);
        this.currentT += Math.sign(diffT) * speed * dt;
        if (Math.abs(this.targetT - this.currentT) < 0.0008) {
          this.currentT = this.targetT;
        }
        this.emitProgress();
      }

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

      // Nubes flotando suavemente por el cielo
      this.cloudMeshes.forEach((cloud) => {
        const d = cloud.userData;
        const a = d.baseAngle + elapsed * d.speed;
        cloud.position.x = Math.cos(a) * d.dist;
        cloud.position.z = Math.sin(a) * d.dist;
      });

      this.markers.forEach((group, idx) => {
        const basePt = this.boardwalkCurve.getPointAt(this.stationTs[idx]);
        group.position.y = basePt.y + 2.25 + Math.sin(elapsed * 2 + idx) * 0.1;
        group.children[0].rotation.y = elapsed * 0.85;
      });

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
          let y = pos.getY(i) + dt * 0.55;
          if (y > 4.6) y = 1.05;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      if (this.pollenParticles) {
        this.pollenParticles.rotation.y = elapsed * 0.012;
      }
    }

    this.applyCameraTransform();
    if (this.skyMesh) {
      this.skyMesh.position.copy(this.camera.position);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
