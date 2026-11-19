import * as THREE from 'three';

const NOISE_GLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    val += amp * valueNoise(p);
    p *= 2.04;
    amp *= 0.5;
  }
  return val;
}
`;

/**
 * Cielo atmosférico con gradiente, brillo solar y nubes FBM en movimiento lento.
 */
export function createSkyWithCloudsMaterial(timeUniform, horizonColor = null) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: timeUniform,
      uTopColor: { value: new THREE.Color(0x5eaee8) },
      uHorizonColor: { value: horizonColor ? horizonColor.clone() : new THREE.Color(0xe4f3f6) },
      uSunColor: { value: new THREE.Color(0xfff5db) },
      uSunDir: { value: new THREE.Vector3(-45, 58, 36).normalize() }
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        // Dirección local normalizada para centrar el domo celeste siempre en la cámara sin recortes
        vWorldDir = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldDir;
      ${NOISE_GLSL}

      void main() {
        vec3 dir = normalize(vWorldDir);
        float elev = clamp(dir.y, 0.0, 1.0);
        // Mantener el horizonte emparejado exactamente con fogColor y elevar a azul celeste luminoso
        vec3 sky = mix(uHorizonColor, uTopColor * 1.24, pow(elev, 0.68));

        // Halo solar cálido de mañana despejada
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        sky += uSunColor * pow(sunDot, 8.0) * 0.42;
        sky += uSunColor * pow(sunDot, 72.0) * 0.65;

        // Nubes blancas ligeras de buen tiempo (sin aspecto grisáceo ni de tormenta)
        if (dir.y > 0.03) {
          vec2 cloudUv = dir.xz / (dir.y + 0.24);
          float drift = uTime * 0.018;
          float n1 = fbm(cloudUv * 1.15 + vec2(drift, drift * 0.35));
          float n2 = fbm(cloudUv * 2.4 - vec2(drift * 0.7, -drift * 0.2));
          float cloudMask = smoothstep(0.50, 0.80, n1 * 0.68 + n2 * 0.34);
          cloudMask *= smoothstep(0.03, 0.22, dir.y);
          vec3 cloudTint = mix(vec3(1.18, 1.23, 1.28), uSunColor * 1.38, pow(sunDot, 3.0) * 0.42);
          sky = mix(sky, cloudTint, cloudMask * 0.56);
        }

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

/**
 * Nubes 3D suaves que flotan lentamente sobre las crestas montañosas.
 */
export function createCloudLayerMaterial(timeUniform) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: timeUniform,
      uColorLight: { value: new THREE.Color(0xffffff) },
      uColorShadow: { value: new THREE.Color(0xdbeaf4) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorLight;
      uniform vec3 uColorShadow;
      varying vec2 vUv;
      ${NOISE_GLSL}

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float radialFade = 1.0 - smoothstep(0.32, 0.98, length(centered));
        float n = fbm(vUv * 3.4 + vec2(uTime * 0.025, uTime * 0.008));
        float alpha = smoothstep(0.40, 0.76, n) * radialFade * 0.62;
        if (alpha < 0.01) discard;
        vec3 col = mix(uColorShadow, uColorLight, smoothstep(0.35, 0.78, n)) * 1.18;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

/**
 * Bancos de neblina de valle que fluyen suavemente entre las laderas y árboles lejanos.
 */
export function createValleyMistMaterial(timeUniform, horizonColor = null) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: timeUniform,
      uMistColor: { value: horizonColor ? horizonColor.clone() : new THREE.Color(0xe4f3f6) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uMistColor;
      varying vec2 vUv;
      ${NOISE_GLSL}

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float edge = 1.0 - smoothstep(0.25, 0.96, length(centered));
        float n = fbm(vUv * 2.6 + vec2(-uTime * 0.03, uTime * 0.015));
        float alpha = smoothstep(0.38, 0.8, n) * edge * 0.24;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uMistColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

/**
 * Shader GLSL personalizado para la caída de agua de la cascada con bordes orgánicos,
 * vetas espumosas en dos velocidades, ondulación en vértices y niebla de escena.
 */
export function createWaterfallShaderMaterial(timeUniform, waterTexture, fogColor, fogDensity) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: timeUniform,
      uWaterTex: { value: waterTexture },
      uFogColor: { value: fogColor.clone() },
      uFogDensity: { value: fogDensity }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vFogDepth;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(uv.y * 18.0 + uTime * 6.2) * 0.045 + cos(uv.x * 11.0 - uTime * 3.8) * 0.03;
        pos += normal * wave * smoothstep(0.06, 0.85, 1.0 - uv.y);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uWaterTex;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec2 vUv;
      varying float vFogDepth;
      ${NOISE_GLSL}

      void main() {
        // Muestreo dual de espuma blanca real con dos chorros asimétricos (como quebrada andina real)
        vec2 uvFast = vec2(vUv.x * 1.55, vUv.y * 2.4 + uTime * 1.38);
        vec2 uvSlow = vec2(vUv.x * 2.35 + 0.37, vUv.y * 1.65 + uTime * 0.86);
        vec3 texFast = texture2D(uWaterTex, uvFast).rgb;
        vec3 texSlow = texture2D(uWaterTex, uvSlow).rgb;

        float lumaFast = pow(max(0.001, dot(texFast, vec3(0.30, 0.59, 0.11))), 0.46);
        float lumaSlow = pow(max(0.001, dot(texSlow, vec3(0.30, 0.59, 0.11))), 0.46);
        float streamLace = clamp(lumaFast * 0.62 + lumaSlow * 0.52 - 0.08, 0.0, 1.0);

        float macroFlow = fbm(vec2(vUv.x * 7.5 + 1.1, vUv.y * 3.0 + uTime * 1.1));
        float splitShift = (macroFlow - 0.5) * 0.07;
        // Flujo equilibrado y centrado en el cauce (vUv.x = 0.5) con vetas orgánicas a ambos lados
        float centerEnvelope = smoothstep(0.05, 0.22, vUv.x + splitShift * 0.6) * smoothstep(0.95, 0.78, vUv.x + splitShift * 0.6);
        float leftBraid = smoothstep(0.14, 0.30, vUv.x + splitShift) * smoothstep(0.56, 0.42, vUv.x + splitShift);
        float rightBraid = smoothstep(0.44, 0.58, vUv.x - splitShift) * smoothstep(0.86, 0.70, vUv.x - splitShift);
        float coreStream = exp(-pow((vUv.x - 0.5 + splitShift * 0.5) / 0.26, 2.0));
        float channelWeight = clamp(centerEnvelope * (0.48 + 0.52 * max(coreStream, max(leftBraid, rightBraid))), 0.0, 1.0);

        float topFade = smoothstep(1.0, 0.92, vUv.y);
        float bottomFade = smoothstep(0.0, 0.05, vUv.y);

        float stepNoise = fbm(vec2(vUv.x * 9.5 + 2.3, vUv.y * 6.0 + uTime * 1.4));
        // Rupturas irregulares de espuma en saltos (evita líneas rectas horizontales)
        float stepY1 = 0.67 + (stepNoise - 0.5) * 0.09;
        float stepY2 = 0.41 + (macroFlow - 0.5) * 0.10;
        float step1Froth = exp(-pow((vUv.y - stepY1) * 7.5, 2.0)) * 0.36 * (0.4 + stepNoise * 0.9);
        float step2Froth = exp(-pow((vUv.y - stepY2) * 7.0, 2.0)) * 0.42 * (0.4 + macroFlow * 0.9);
        float crestFoam = smoothstep(0.86, 0.97, vUv.y) * 0.24;
        float splashFoam = smoothstep(0.18, 0.01, vUv.y) * 0.52 * (0.55 + streamLace * 0.65);

        float stepBursts = crestFoam + step1Froth + step2Froth + splashFoam;
        float aerated = clamp(streamLace * (0.76 + channelWeight * 0.36) + stepBursts * (0.48 + streamLace * 0.52), 0.0, 1.0);

        vec3 deepWater = vec3(0.11, 0.19, 0.18);
        vec3 mistWater = vec3(0.48, 0.56, 0.55);
        vec3 whiteFoam = vec3(0.94, 0.96, 0.96);
        vec3 waterCol = mix(deepWater, mistWater, smoothstep(0.10, 0.42, aerated));
        waterCol = mix(waterCol, whiteFoam, smoothstep(0.32, 0.78, aerated));

        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        waterCol = mix(waterCol, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float bodyAlpha = smoothstep(0.06, 0.54, streamLace * 0.75 + stepBursts * 0.72);
        float alpha = channelWeight * topFade * bottomFade * clamp(0.28 + bodyAlpha * 0.68, 0.0, 0.96);
        if (alpha < 0.03) discard;
        gl_FragColor = vec4(waterCol, alpha);
      }
    `
  });
}

/**
 * Shader GLSL para río en movimiento y poza con cáusticas, Fresnel,
 * ondas concéntricas en la caída de la cascada y orillas difuminadas.
 */
export function createRiverShaderMaterial(timeUniform, waterTexture, fogColor, fogDensity, isPool = false) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: timeUniform,
      uWaterTex: { value: waterTexture },
      uFogColor: { value: fogColor.clone() },
      uFogDensity: { value: fogDensity },
      uIsPool: { value: isPool ? 1.0 : 0.0 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vFogDepth;

      void main() {
        vUv = uv;
        vec3 pos = position;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        pos.y += sin(worldPos.x * 2.2 + uTime * 2.4) * 0.025 + cos(worldPos.z * 2.5 - uTime * 2.1) * 0.02;
        worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPos = viewMatrix * worldPos;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uWaterTex;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uIsPool;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vFogDepth;
      ${NOISE_GLSL}

      void main() {
        vec2 flowUv1 = vUv * vec2(1.8, 5.2) + vec2(0.0, -uTime * 0.42);
        vec2 flowUv2 = vUv * vec2(2.8, 3.8) + vec2(0.19, -uTime * 0.27);
        vec3 t1 = texture2D(uWaterTex, flowUv1).rgb;
        vec3 t2 = texture2D(uWaterTex, flowUv2).rgb;
        float lumaSurface = pow(max(0.001, dot(t1 * 0.6 + t2 * 0.4, vec3(0.33))), 0.48);
        float surfaceLace = smoothstep(0.42, 0.84, lumaSurface);

        float ripple = fbm(vWorldPos.xz * 0.95 + vec2(-uTime * 0.35, uTime * 0.32));
        float caustics = smoothstep(0.54, 0.85, ripple);

        // Fresnel de reflexión difusa del dosel nublado
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);

        // Agua natural verde-oliva oscura de quebrada andina sin reflejo lechoso
        vec3 deepBed = vec3(0.05, 0.14, 0.11);
        vec3 shallowTint = vec3(0.11, 0.23, 0.18);
        vec3 baseCol = mix(deepBed, shallowTint, ripple * 0.70 + surfaceLace * 0.24);
        baseCol = mix(baseCol, vec3(0.56, 0.68, 0.63), fresnel * 0.34);

        float alpha = 0.90;
        if (uIsPool > 0.5) {
          float distCenter = length(vUv - vec2(0.5));
          float ringWave = sin(distCenter * 28.0 - uTime * 4.4) * 0.5 + 0.5;
          float coreChurn = smoothstep(0.18, 0.02, distCenter);
          float rippleLace = smoothstep(0.36, 0.08, distCenter) * (ringWave * 0.35 + surfaceLace * 0.85);
          float splashFoam = clamp(coreChurn * (0.45 + surfaceLace * 0.55) + rippleLace * 0.52, 0.0, 0.95);
          baseCol = mix(baseCol, vec3(0.92, 0.96, 0.96), splashFoam);
          alpha *= smoothstep(0.5, 0.36, distCenter);
        } else {
          float edgeFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          float riffleFoam = clamp(surfaceLace * (0.38 + caustics * 0.52), 0.0, 0.82);
          baseCol = mix(baseCol, vec3(0.91, 0.95, 0.95), riffleFoam);
          alpha *= edgeFade;
        }

        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        baseCol = mix(baseCol, uFogColor, clamp(fogFactor, 0.0, 1.0));

        if (alpha < 0.02) discard;
        gl_FragColor = vec4(baseCol, alpha);
      }
    `
  });
}

/**
 * Mezcla multizona del terreno mediante onBeforeCompile usando 4 texturas reales/procedurales:
 * suelo de bosque oscuro, pradera con trébol y flores, cantos rodados de río y roca andina.
 */
export function enhanceTerrainMaterialWithShader(material, { meadowTex, pebblesTex, rockTex }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMeadowTex = { value: meadowTex };
    shader.uniforms.uPebblesTex = { value: pebblesTex };
    shader.uniforms.uRockTex = { value: rockTex };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec4 aTerrainZones;
         varying vec3 vTerrainWorldPos;
         varying vec4 vTerrainZones;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vTerrainZones = aTerrainZones;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uMeadowTex;
         uniform sampler2D uPebblesTex;
         uniform sampler2D uRockTex;
         varying vec3 vTerrainWorldPos;
         varying vec4 vTerrainZones;
         ${NOISE_GLSL}`
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
           vec3 colForest = texture2D(map, vTerrainWorldPos.xz * 0.16).rgb;
           vec3 colMeadow = texture2D(uMeadowTex, vTerrainWorldPos.xz * 0.17).rgb;
           vec3 colPebbles = texture2D(uPebblesTex, vTerrainWorldPos.xz * 0.28).rgb;
           vec3 colRock = texture2D(uRockTex, vTerrainWorldPos.xz * 0.11).rgb;

           float patchNoise = fbm(vTerrainWorldPos.xz * 0.085);
           float detailNoise = valueNoise(vTerrainWorldPos.xz * 0.38);

           float wForest = max(0.0, vTerrainZones.x + (0.52 - patchNoise) * 0.42);
           float wMeadow = max(0.0, vTerrainZones.y + (patchNoise - 0.40) * 0.62);
           float wPebbles = max(0.0, vTerrainZones.z + (detailNoise - 0.5) * 0.16);
           float wRock = max(0.0, vTerrainZones.w + (patchNoise - 0.46) * 0.34);

           float wSum = max(0.001, wForest + wMeadow + wPebbles + wRock);
           vec3 zoneTex = (
             colForest * wForest +
             colMeadow * wMeadow +
             colPebbles * wPebbles +
             colRock * wRock
           ) / wSum;

           vec3 lushTint = mix(vec3(0.92, 0.90, 0.86), vec3(0.96, 1.04, 0.90), smoothstep(0.32, 0.74, patchNoise));
           zoneTex *= lushTint * (0.91 + detailNoise * 0.16);

           // Oscurecimiento húmedo cerca de la cota del arroyo y poza
           float wetness = 1.0 - smoothstep(0.85, 1.48, vTerrainWorldPos.y);
           zoneTex *= mix(1.0, 0.62, wetness);

           diffuseColor.rgb *= zoneTex;
         #endif`
      );
  };
  material.customProgramCacheKey = () => 'terrain-multizone-shader-v2';
}

/**
 * Proyección triplanar en espacio de mundo para rocas y riscos de la cascada:
 * elimina estiramiento UV, mezcla dos texturas pétreas y textura real de musgo en repisas,
 * genera relieve normal triplanar por derivadas y oscurecimiento húmedo junto al agua.
 */
export function enhanceRockMaterialWithShader(material, options = {}) {
  const {
    mossTex = null,
    altRockTex = null,
    rockScale = 0.22,
    mossStrength = 0.86,
    wetWaterlineY = 1.95
  } = options;

  material.onBeforeCompile = (shader) => {
    if (mossTex) shader.uniforms.uMossTex = { value: mossTex };
    if (altRockTex) shader.uniforms.uAltRockTex = { value: altRockTex };
    shader.uniforms.uRockScale = { value: rockScale };
    shader.uniforms.uMossStrength = { value: mossStrength };
    shader.uniforms.uWetWaterlineY = { value: wetWaterlineY };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vRockWorldPos;
         varying vec3 vRockWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vRockWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vRockWorldNormal = normalize(transformedNormal * mat3(viewMatrix));`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         ${mossTex ? 'uniform sampler2D uMossTex;' : ''}
         ${altRockTex ? 'uniform sampler2D uAltRockTex;' : ''}
         uniform float uRockScale;
         uniform float uMossStrength;
         uniform float uWetWaterlineY;
         varying vec3 vRockWorldPos;
         varying vec3 vRockWorldNormal;
         ${NOISE_GLSL}`
      )
      .replace(
        '#include <map_fragment>',
        `float rockBumpH = 0.5;
         float rockMossMask = 0.0;
         float rockWetMask = 0.0;
         #ifdef USE_MAP
           vec3 wNorm = normalize(vRockWorldNormal);
           vec3 blendW = pow(abs(wNorm), vec3(5.0));
           blendW /= max(0.001, blendW.x + blendW.y + blendW.z);

           vec3 sp = vRockWorldPos * uRockScale;
           vec3 tx = texture2D(map, sp.zy).rgb;
           vec3 ty = texture2D(map, sp.xz).rgb;
           vec3 tz = texture2D(map, sp.xy).rgb;
           vec3 triRock = tx * blendW.x + ty * blendW.y + tz * blendW.z;

           ${
             altRockTex
               ? `
             vec3 spAlt = vRockWorldPos * (uRockScale * 0.72) + vec3(0.37, 0.19, 0.61);
             vec3 ax = texture2D(uAltRockTex, spAlt.zy).rgb;
             vec3 ay = texture2D(uAltRockTex, spAlt.xz).rgb;
             vec3 az = texture2D(uAltRockTex, spAlt.xy).rgb;
             vec3 altRock = ax * blendW.x + ay * blendW.y + az * blendW.z;
             float macroZone = smoothstep(0.28, 0.76, fbm(vRockWorldPos.xz * 0.14 + vec2(vRockWorldPos.y * 0.08)));
             triRock = mix(triRock, altRock, macroZone * 0.55);`
               : ''
           }

           // Estratificación natural, pátina mineral ocre y chorreaduras húmedas verticales (sin empastar a negro)
           float strataWave = sin(vRockWorldPos.y * 4.6 + fbm(vRockWorldPos.xz * 0.34) * 3.0) * 0.5 + 0.5;
           float undercutShade = smoothstep(-0.65, 0.18, wNorm.y);
           triRock *= mix(0.76, 1.18, strataWave * 0.55 + undercutShade * 0.45);
           float mineralWarm = smoothstep(0.56, 0.85, fbm(vRockWorldPos.xz * 0.45 + vec2(vRockWorldPos.y * 0.35 + 3.1)));
           triRock = mix(triRock, triRock * vec3(1.24, 1.02, 0.76), mineralWarm * 0.42);

           // Parches asimétricos de musgo oscuro natural en fisuras y repisas superiores
           float topFace = smoothstep(0.22, 0.72, wNorm.y);
           float fissurePocket = smoothstep(0.32, 0.72, fbm(vRockWorldPos.xz * 0.44 + vec2(vRockWorldPos.y * 0.22)));
           float aboveSplash = smoothstep(1.25, 1.72, vRockWorldPos.y);
           float centerCascadeClear = smoothstep(1.4, 3.6, length(vRockWorldPos.xz - vec2(24.2, -16.6)));
           rockMossMask = clamp(
             topFace * fissurePocket * aboveSplash * mix(0.22, 1.0, centerCascadeClear) * uMossStrength,
             0.0,
             0.84
           );

           vec3 mossCol = mix(vec3(0.14, 0.28, 0.10), vec3(0.24, 0.40, 0.14), fissurePocket);
           ${
             mossTex
               ? `
             vec2 mossWarp = vec2(
               fbm(vRockWorldPos.xz * 0.18),
               fbm(vRockWorldPos.xz * 0.18 + vec2(4.2, -2.7))
             ) * 0.45;
             vec2 mUvTop = vRockWorldPos.xz * 0.46 + mossWarp;
             vec2 mUvSide = vec2(vRockWorldPos.x + vRockWorldPos.z, vRockWorldPos.y) * 0.48 + mossWarp;
             vec3 mTex = mix(texture2D(uMossTex, mUvSide).rgb, texture2D(uMossTex, mUvTop).rgb, clamp(wNorm.y * 1.4, 0.0, 1.0));
             mossCol = mix(mossCol, mTex * vec3(0.78, 0.94, 0.66), 0.84);`
               : ''
           }

           float rockLum = dot(triRock, vec3(0.299, 0.587, 0.114));
           float mossLum = dot(mossCol, vec3(0.299, 0.587, 0.114));
           rockBumpH = mix(rockLum, mossLum * 0.62, rockMossMask * 0.55);

           triRock = mix(triRock, mossCol, rockMossMask);

           // Escorrentías húmedas verticales y brillo especular natural (evitando aspecto plástico)
           float verticalFace = 1.0 - smoothstep(0.15, 0.65, abs(wNorm.y));
           float weepStreak = smoothstep(0.54, 0.85, fbm(vec2(vRockWorldPos.x * 1.2 + vRockWorldPos.z * 0.8, vRockWorldPos.y * 0.18))) * verticalFace;
           float distWf = length(vRockWorldPos.xz - vec2(24.2, -16.6));
           float splashZone = (1.0 - smoothstep(2.4, 8.8, distWf)) * (1.0 - smoothstep(1.0, 9.2, vRockWorldPos.y));
           float shoreWet = 1.0 - smoothstep(1.15, uWetWaterlineY, vRockWorldPos.y);
           rockWetMask = clamp(max(max(splashZone * 0.94, shoreWet * 0.90), weepStreak * 0.68), 0.0, 1.0);
           triRock *= mix(1.0, 0.68, rockWetMask * (1.0 - rockMossMask * 0.6));

           diffuseColor.rgb *= triRock;
         #endif`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.42, rockWetMask * (1.0 - rockMossMask));
         roughnessFactor = mix(roughnessFactor, 0.94, rockMossMask);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_BUMPMAP
           vec2 dTriHdxy = clamp(vec2(dFdx(rockBumpH), dFdy(rockBumpH)), vec2(-0.22), vec2(0.22)) * bumpScale * 4.2;
           normal = perturbNormalArb(-vViewPosition, normal, dTriHdxy, faceDirection);
         #endif`
      );
  };
  material.customProgramCacheKey = () =>
    `rock-triplanar-wet-v2-${mossTex ? 1 : 0}-${altRockTex ? 1 : 0}`;
}

/**
 * Añade musgo orgánico húmedo en la base y caras sombreadas de los troncos mediante shader.
 */
export function enhanceBarkWithMossShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vBarkLocalPos;
         varying vec3 vBarkWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vBarkLocalPos = position;
         vec4 barkWp = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           barkWp = instanceMatrix * barkWp;
         #endif
         vBarkWorldPos = (modelMatrix * barkWp).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vBarkLocalPos;
         varying vec3 vBarkWorldPos;
         ${NOISE_GLSL}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float mossNoise = fbm(vBarkWorldPos.xz * 1.1 + vec2(0.0, vBarkLocalPos.y * 0.85));
         float baseFactor = 1.0 - smoothstep(0.15, 1.75, max(0.0, vBarkLocalPos.y));
         float patchMoss = smoothstep(0.42, 0.75, mossNoise + baseFactor * 0.48);
         vec3 mossColor = vec3(0.16, 0.28, 0.12);
         diffuseColor.rgb = mix(diffuseColor.rgb, mossColor, clamp(patchMoss * 0.62, 0.0, 0.65));`
      );
  };
  material.customProgramCacheKey = () => 'bark-moss-shader-v2';
}

const FLUFFY_LEAF_PROJECT_VERTEX_GLSL = `
  vec4 worldCenter = vec4(transformed, 1.0);
  float instScale = 1.0;
  #ifdef USE_INSTANCING
    instScale = length(vec3(instanceMatrix[0].xyz));
    worldCenter = instanceMatrix * worldCenter;
  #endif
  worldCenter = modelMatrix * worldCenter;

  float windWave = sin(uWindTime * 1.45 + worldCenter.x * 0.42 + worldCenter.z * 0.38 + worldCenter.y * 0.25);
  worldCenter.x += windWave * 0.055;
  worldCenter.z += cos(uWindTime * 1.15 + worldCenter.z * 0.48) * 0.04;

  vec4 mvPosition = viewMatrix * worldCenter;

  float roll = aLeafCorner.w + windWave * 0.045;
  float rc = cos(roll);
  float rs = sin(roll);
  vec2 rotatedCorner = vec2(
    aLeafCorner.x * rc - aLeafCorner.y * rs,
    aLeafCorner.x * rs + aLeafCorner.y * rc
  );
  mvPosition.xy += rotatedCorner * aLeafCorner.z * instScale;
  gl_Position = projectionMatrix * mvPosition;
`;

/**
 * Renderiza ramilletes foliares volumétricos orientados suavemente hacia la cámara
 * (elimina aristas planas en cruz) con oclusión ambiental de copa y brisa en instancias.
 */
export function enhanceFluffyLeafMaterial(material, timeUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWindTime;
         attribute vec4 aLeafCorner;
         attribute float aLeafShade;
         varying float vLeafShade;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLeafShade = aLeafShade;`
      )
      .replace('#include <project_vertex>', FLUFFY_LEAF_PROJECT_VERTEX_GLSL);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vLeafShade;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         diffuseColor.rgb *= vLeafShade;
         diffuseColor.rgb += diffuseColor.rgb * 0.14 * max(0.0, vLeafShade - 0.85);`
      );
  };
  material.customProgramCacheKey = () => 'fluffy-leaf-cluster-v1';
}

/**
 * Sincroniza la geometría billboard en el pase de sombras direccionales para sombras caladas reales.
 */
export function enhanceFluffyDepthMaterial(depthMaterial, timeUniform) {
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWindTime;
         attribute vec4 aLeafCorner;`
      )
      .replace('#include <project_vertex>', FLUFFY_LEAF_PROJECT_VERTEX_GLSL);
  };
  depthMaterial.customProgramCacheKey = () => 'fluffy-leaf-depth-v1';
}

/**
 * Añade balanceo suave por brisa en el shader de vértices de helechos e hierbas.
 */
export function enhanceFoliageWithWindShader(material, timeUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWindTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 instWorldBase = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           instWorldBase = instanceMatrix * instWorldBase;
         #endif
         vec4 instWorld = modelMatrix * instWorldBase;
         float sway = sin(uWindTime * 1.35 + instWorld.x * 0.45 + instWorld.z * 0.4) * 0.07;
         float lift = clamp(length(position.xz) * 0.42 + max(0.0, position.y) * 0.55, 0.0, 2.2);
         transformed.x += sway * lift;
         transformed.z += cos(uWindTime * 1.1 + instWorld.z * 0.5) * 0.048 * lift;`
      );
  };
  material.customProgramCacheKey = () => 'foliage-wind-shader-v3';
}
