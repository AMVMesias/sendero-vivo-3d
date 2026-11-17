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
export function createSkyWithCloudsMaterial(timeUniform) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: timeUniform,
      uTopColor: { value: new THREE.Color(0x4d878b) },
      uHorizonColor: { value: new THREE.Color(0xd7e8df) },
      uSunColor: { value: new THREE.Color(0xfff1cf) },
      uSunDir: { value: new THREE.Vector3(-45, 58, 36).normalize() }
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
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
        vec3 sky = mix(uHorizonColor, uTopColor, pow(elev, 0.62));

        // Halo solar cálido
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        sky += uSunColor * pow(sunDot, 10.0) * 0.35;
        sky += uSunColor * pow(sunDot, 90.0) * 0.45;

        // Proyección de capa de nubes en el domo superior
        if (dir.y > 0.03) {
          vec2 cloudUv = dir.xz / (dir.y + 0.22);
          float drift = uTime * 0.018;
          float n1 = fbm(cloudUv * 1.15 + vec2(drift, drift * 0.35));
          float n2 = fbm(cloudUv * 2.4 - vec2(drift * 0.7, -drift * 0.2));
          float cloudMask = smoothstep(0.46, 0.78, n1 * 0.7 + n2 * 0.35);
          cloudMask *= smoothstep(0.03, 0.22, dir.y);
          vec3 cloudTint = mix(vec3(0.95, 0.98, 0.97), uSunColor, pow(sunDot, 3.0) * 0.45);
          sky = mix(sky, cloudTint, cloudMask * 0.62);
        }

        gl_FragColor = vec4(sky, 1.0);
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
      uColorLight: { value: new THREE.Color(0xf7fbf9) },
      uColorShadow: { value: new THREE.Color(0xb8d0ca) }
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
        float alpha = smoothstep(0.36, 0.74, n) * radialFade * 0.68;
        if (alpha < 0.01) discard;
        vec3 col = mix(uColorShadow, uColorLight, smoothstep(0.35, 0.78, n));
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

/**
 * Bancos de neblina de valle que fluyen suavemente entre las laderas y árboles lejanos.
 */
export function createValleyMistMaterial(timeUniform) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: timeUniform,
      uMistColor: { value: new THREE.Color(0xdcebe4) }
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
        float alpha = smoothstep(0.38, 0.8, n) * edge * 0.28;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uMistColor, alpha);
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
        float wave = sin(uv.y * 16.0 + uTime * 6.5) * 0.11 + cos(uv.x * 12.0 - uTime * 4.0) * 0.06;
        pos += normal * wave * smoothstep(0.05, 0.9, 1.0 - uv.y);
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
        // Dos capas verticales de flujo descendente
        vec2 uvFast = vec2(vUv.x * 1.6, vUv.y * 2.4 + uTime * 1.15);
        vec2 uvSlow = vec2(vUv.x * 2.5 + 0.22, vUv.y * 1.5 + uTime * 0.72);
        vec3 texFast = texture2D(uWaterTex, uvFast).rgb;
        vec3 texSlow = texture2D(uWaterTex, uvSlow).rgb;

        float streakNoise = fbm(vec2(vUv.x * 9.0, vUv.y * 3.5 + uTime * 1.8));
        float edgePerturb = (valueNoise(vec2(vUv.y * 7.0 + uTime * 0.9, vUv.x * 4.0)) - 0.5) * 0.16;

        // Difuminado suave lateral y superior para eliminar aspecto rectangular
        float sideFade = smoothstep(0.02, 0.24, vUv.x + edgePerturb) *
                         smoothstep(0.98, 0.76, vUv.x + edgePerturb);
        float topFade = smoothstep(1.0, 0.87, vUv.y);
        float bottomFade = smoothstep(0.0, 0.12, vUv.y);

        // Espuma blanca intensa en la cresta y al chocar contra la poza
        float crestFoam = smoothstep(0.75, 0.96, vUv.y) * 0.55;
        float splashFoam = smoothstep(0.32, 0.04, vUv.y) * 0.85;
        float foamIntensity = clamp(
          crestFoam + splashFoam + smoothstep(0.55, 0.85, streakNoise) * 0.6,
          0.0,
          1.0
        );

        vec3 deepWater = vec3(0.16, 0.58, 0.67);
        vec3 midWater = mix(texSlow, texFast, 0.55);
        vec3 waterCol = mix(deepWater, midWater, 0.65);
        waterCol = mix(waterCol, vec3(0.92, 0.99, 1.0), foamIntensity);

        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        waterCol = mix(waterCol, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float alpha = sideFade * topFade * bottomFade * (0.68 + foamIntensity * 0.28);
        if (alpha < 0.02) discard;
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
        vec2 flowUv1 = vUv * vec2(2.0, 6.0) + vec2(0.0, -uTime * 0.42);
        vec2 flowUv2 = vUv * vec2(3.2, 4.5) + vec2(0.15, -uTime * 0.28);
        vec3 t1 = texture2D(uWaterTex, flowUv1).rgb;
        vec3 t2 = texture2D(uWaterTex, flowUv2).rgb;

        float ripple = fbm(vWorldPos.xz * 0.85 + vec2(-uTime * 0.35, uTime * 0.35));
        float caustics = smoothstep(0.58, 0.86, ripple);

        // Fresnel de reflexión del cielo brumoso
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);

        vec3 baseCol = mix(vec3(0.12, 0.44, 0.49), mix(t1, t2, 0.5), 0.48);
        baseCol += vec3(0.32, 0.56, 0.58) * caustics * 0.42;
        baseCol = mix(baseCol, vec3(0.80, 0.91, 0.89), fresnel * 0.58);

        float alpha = 0.84;
        if (uIsPool > 0.5) {
          float distCenter = length(vUv - vec2(0.5));
          float ringWave = sin(distCenter * 28.0 - uTime * 4.5) * 0.5 + 0.5;
          float splashFoam = smoothstep(0.28, 0.04, distCenter) * 0.65 +
                             smoothstep(0.38, 0.14, distCenter) * ringWave * 0.32;
          baseCol = mix(baseCol, vec3(0.93, 0.99, 1.0), clamp(splashFoam, 0.0, 1.0));
          alpha *= smoothstep(0.5, 0.36, distCenter);
        } else {
          float edgeFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          float bankFoam = (1.0 - smoothstep(0.06, 0.24, min(vUv.x, 1.0 - vUv.x))) * caustics * 0.45;
          baseCol = mix(baseCol, vec3(0.90, 0.98, 0.99), bankFoam);
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
 * Mejora el material del terreno mediante onBeforeCompile para romper repetición
 * de texturas con variación orgánica de musgo, claros soleados y humedad en orillas.
 */
export function enhanceTerrainMaterialWithShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vTerrainWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vTerrainWorldPos;
         ${NOISE_GLSL}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float macroPatch = fbm(vTerrainWorldPos.xz * 0.085);
         float microDapple = valueNoise(vTerrainWorldPos.xz * 0.38);
         vec3 lushMoss = vec3(0.76, 0.92, 0.72);
         vec3 richEarth = vec3(0.66, 0.58, 0.49);
         vec3 macroTint = mix(richEarth, lushMoss, smoothstep(0.32, 0.72, macroPatch));
         diffuseColor.rgb *= mix(vec3(0.88), macroTint, 0.48);
         diffuseColor.rgb *= (0.90 + microDapple * 0.18);
         // Oscurecimiento húmedo cerca de la cota del arroyo
         float wetness = 1.0 - smoothstep(0.8, 1.45, vTerrainWorldPos.y);
         diffuseColor.rgb *= mix(1.0, 0.68, wetness);`
      );
  };
  material.customProgramCacheKey = () => 'terrain-macro-shader-v1';
}

/**
 * Añade balanceo suave por brisa en el shader de vértices de copas y helechos.
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
         vec4 instWorld = modelMatrix * vec4(transformed, 1.0);
         float sway = sin(uWindTime * 1.35 + instWorld.x * 0.45 + instWorld.z * 0.4) * 0.085;
         transformed.x += sway * max(0.0, position.y + 0.5);
         transformed.z += cos(uWindTime * 1.1 + instWorld.z * 0.5) * 0.055 * max(0.0, position.y + 0.5);`
      );
  };
  material.customProgramCacheKey = () => 'foliage-wind-shader-v1';
}
