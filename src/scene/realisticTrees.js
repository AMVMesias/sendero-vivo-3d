import * as THREE from 'three';

/**
 * Generador procedural de árboles y arbustos realistas con ramificación jerárquica
 * cónica y tarjetas foliares botánicas con recorte alfa y normales esféricas.
 *
 * El algoritmo recursivo de ramificación, torsión y generación de hojas deriva de
 * `@dgreenheck/ez-tree` (Copyright (c) 2024 Daniel Greenheck, MIT License),
 * adaptado para escala métrica real (1 unidad = 1 metro), ensanchamiento basal de raíces,
 * soporte de `THREE.InstancedMesh` y shaders GLSL de musgo y viento del proyecto.
 */

class TreeRNG {
  constructor(seed) {
    this.mask = 0xffffffff;
    this.m_w = (123456789 + seed) & this.mask;
    this.m_z = (987654321 - seed) & this.mask;
  }

  random(max = 1, min = 0) {
    this.m_z = (36969 * (this.m_z & 65535) + (this.m_z >> 16)) & this.mask;
    this.m_w = (18000 * (this.m_w & 65535) + (this.m_w >> 16)) & this.mask;
    let result = ((this.m_z << 16) + (this.m_w & 65535)) >>> 0;
    result /= 4294967296;
    return (max - min) * result + min;
  }
}

class BranchSegment {
  constructor(origin, orientation, length, radius, level, sectionCount, segmentCount) {
    this.origin = origin.clone();
    this.orientation = orientation.clone();
    this.length = length;
    this.radius = radius;
    this.level = level;
    this.sectionCount = sectionCount;
    this.segmentCount = segmentCount;
  }
}

export const CLOUD_FOREST_PRESETS = {
  oakCloud: {
    type: 'deciduous',
    unitScale: 0.21,
    bark: { type: 'oak', tint: 0xf4eee6 },
    branch: {
      levels: 3,
      angle: { 1: 54, 2: 56, 3: 34 },
      children: { 0: 5, 1: 3, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.008 },
      gnarliness: { 0: 0.04, 1: -0.1, 2: -0.14, 3: 0.08 },
      length: { 0: 36, 1: 12.5, 2: 11.2, 3: 6.4 },
      radius: { 0: 1.45, 1: 0.85, 2: 0.65, 3: 0.95 },
      sections: { 0: 8, 1: 5, 2: 3, 3: 2 },
      segments: { 0: 8, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.45, 2: 0.14, 3: 0.15 },
      taper: { 0: 0.72, 1: 0.46, 2: 0.68, 3: 0.75 },
      twist: { 0: -0.18, 1: 0.35, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'oak',
      billboard: 'double',
      angle: 42,
      count: 7,
      start: 0.14,
      size: 3.15,
      sizeVariance: 0.65,
      tint: 0xdff0d4,
      alphaTest: 0.42
    }
  },
  ashAndean: {
    type: 'deciduous',
    unitScale: 0.195,
    bark: { type: 'oak', tint: 0xe2d8cc },
    branch: {
      levels: 3,
      angle: { 1: 48, 2: 70, 3: 55 },
      children: { 0: 6, 1: 3, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.045 },
      gnarliness: { 0: 0.03, 1: 0.22, 2: 0.18, 3: 0.09 },
      length: { 0: 40, 1: 23, 2: 9.2, 3: 4.5 },
      radius: { 0: 1.8, 1: 0.62, 2: 0.74, 3: 0.68 },
      sections: { 0: 9, 1: 6, 2: 4, 3: 2 },
      segments: { 0: 8, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.28, 2: 0.33, 3: 0.05 },
      taper: { 0: 0.7, 1: 0.7, 2: 0.7, 3: 0.7 },
      twist: { 0: 0.09, 1: -0.07, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'ash',
      billboard: 'double',
      angle: 55,
      count: 7,
      start: 0.05,
      size: 3.2,
      sizeVariance: 0.68,
      tint: 0xe4f2d8,
      alphaTest: 0.42
    }
  },
  birchAlder: {
    type: 'deciduous',
    unitScale: 0.155,
    bark: { type: 'birch', tint: 0xf6f3ea },
    branch: {
      levels: 2,
      angle: { 1: 68, 2: 34, 3: 10 },
      children: { 0: 9, 1: 3, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.014 },
      gnarliness: { 0: 0.05, 1: 0.12, 2: 0.12, 3: 0.02 },
      length: { 0: 38, 1: 7.4, 2: 10.6, 3: 1 },
      radius: { 0: 0.85, 1: 0.42, 2: 0.68, 3: 0.65 },
      sections: { 0: 10, 1: 7, 2: 5, 3: 3 },
      segments: { 0: 8, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.5, 2: 0.35, 3: 0 },
      taper: { 0: 0.44, 1: 0.25, 2: 0.7, 3: 0.7 },
      twist: { 0: 0, 1: 0, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'aspen',
      billboard: 'double',
      angle: 32,
      count: 9,
      start: 0.1,
      size: 3.05,
      sizeVariance: 0.65,
      tint: 0xcfe888,
      alphaTest: 0.42
    }
  },
  polylepis: {
    type: 'deciduous',
    unitScale: 0.205,
    bark: { type: 'cedar', tint: 0xf4ded3 },
    branch: {
      levels: 3,
      angle: { 1: 60, 2: 62, 3: 45 },
      children: { 0: 5, 1: 3, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.015 },
      gnarliness: { 0: 0.16, 1: 0.22, 2: 0.18, 3: 0.09 },
      length: { 0: 21, 1: 12.5, 2: 9.8, 3: 5.4 },
      radius: { 0: 1.35, 1: 0.76, 2: 0.66, 3: 0.65 },
      sections: { 0: 8, 1: 5, 2: 4, 3: 2 },
      segments: { 0: 8, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.26, 2: 0.18, 3: 0.12 },
      taper: { 0: 0.66, 1: 0.55, 2: 0.68, 3: 0.74 },
      twist: { 0: 0.14, 1: 0.18, 2: 0.05, 3: 0 }
    },
    leaves: {
      type: 'oak',
      billboard: 'double',
      angle: 46,
      count: 7,
      start: 0.12,
      size: 2.85,
      sizeVariance: 0.62,
      tint: 0xc2de9f,
      alphaTest: 0.42
    }
  },
  podocarpus: {
    type: 'evergreen',
    unitScale: 0.165,
    bark: { type: 'oak', tint: 0xbda892 },
    branch: {
      levels: 1,
      angle: { 1: 108, 2: 16, 3: 60 },
      children: { 0: 46, 1: 3, 2: 4 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.004 },
      gnarliness: { 0: 0.05, 1: 0.08, 2: 0, 3: 0 },
      length: { 0: 48, 1: 22.5, 2: 12, 3: 1 },
      radius: { 0: 1.05, 1: 0.36, 2: 0.65, 3: 0.6 },
      sections: { 0: 10, 1: 7, 2: 5, 3: 3 },
      segments: { 0: 7, 1: 5, 2: 4, 3: 3 },
      start: { 1: 0.25, 2: 0.14, 3: 0.3 },
      taper: { 0: 0.72, 1: 0.7, 2: 0.7, 3: 0.7 },
      twist: { 0: 0, 1: 0, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'pine',
      billboard: 'double',
      angle: 40,
      count: 14,
      start: 0.08,
      size: 1.95,
      sizeVariance: 0.22,
      tint: 0xdbeed5,
      alphaTest: 0.32
    }
  },
  grandfather: {
    type: 'deciduous',
    unitScale: 0.285,
    bark: { type: 'oak', tint: 0xf4eee4 },
    branch: {
      levels: 3,
      angle: { 1: 58, 2: 58, 3: 38 },
      children: { 0: 6, 1: 4, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.012 },
      gnarliness: { 0: 0.05, 1: -0.11, 2: -0.15, 3: 0.09 },
      length: { 0: 38, 1: 16.5, 2: 12.6, 3: 6.8 },
      radius: { 0: 1.95, 1: 0.92, 2: 0.68, 3: 0.85 },
      sections: { 0: 11, 1: 7, 2: 4, 3: 2 },
      segments: { 0: 12, 1: 7, 2: 5, 3: 3 },
      start: { 1: 0.38, 2: 0.14, 3: 0.14 },
      taper: { 0: 0.72, 1: 0.45, 2: 0.68, 3: 0.75 },
      twist: { 0: -0.18, 1: 0.36, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'oak',
      billboard: 'double',
      angle: 44,
      count: 12,
      start: 0.1,
      size: 3.15,
      sizeVariance: 0.68,
      tint: 0xdaf0cf,
      alphaTest: 0.42
    }
  },
  blossomCanopy: {
    type: 'deciduous',
    unitScale: 0.17,
    bark: { type: 'cedar', tint: 0xf2dcd0 },
    branch: {
      levels: 3,
      angle: { 1: 52, 2: 64, 3: 48 },
      children: { 0: 6, 1: 3, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.025 },
      gnarliness: { 0: 0.08, 1: 0.16, 2: 0.14, 3: 0.08 },
      length: { 0: 34, 1: 17, 2: 9.2, 3: 4.5 },
      radius: { 0: 1.45, 1: 0.72, 2: 0.66, 3: 0.62 },
      sections: { 0: 9, 1: 6, 2: 4, 3: 3 },
      segments: { 0: 8, 1: 6, 2: 4, 3: 3 },
      start: { 1: 0.35, 2: 0.28, 3: 0.1 },
      taper: { 0: 0.68, 1: 0.62, 2: 0.68, 3: 0.72 },
      twist: { 0: 0.08, 1: -0.06, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'ash',
      billboard: 'double',
      angle: 50,
      count: 9,
      start: 0.06,
      size: 2.95,
      sizeVariance: 0.65,
      tint: 0xdff2c8,
      alphaTest: 0.42
    }
  },
  shrubAsh: {
    type: 'deciduous',
    unitScale: 0.105,
    bark: { type: 'oak', tint: 0xc2b29d },
    branch: {
      levels: 3,
      angle: { 1: 30, 2: 60, 3: 52 },
      children: { 0: 5, 1: 2, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.02 },
      gnarliness: { 0: 0.11, 1: 0.1, 2: 0.08, 3: 0.08 },
      length: { 0: 0.25, 1: 13.2, 2: 5.2, 3: 4.0 },
      radius: { 0: 0.58, 1: 0.82, 2: 0.65, 3: 0.58 },
      sections: { 0: 3, 1: 4, 2: 4, 3: 3 },
      segments: { 0: 4, 1: 4, 2: 3, 3: 3 },
      start: { 1: 0.42, 2: 0.32, 3: 0 },
      taper: { 0: 0.7, 1: 0.7, 2: 0.7, 3: 0.7 },
      twist: { 0: 0.28, 1: -0.06, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'ash',
      billboard: 'double',
      angle: 54,
      count: 5,
      start: 0,
      size: 2.9,
      sizeVariance: 0.6,
      tint: 0xddf2d0,
      alphaTest: 0.42
    }
  },
  shrubOak: {
    type: 'deciduous',
    unitScale: 0.1,
    bark: { type: 'cedar', tint: 0xd4baa8 },
    branch: {
      levels: 3,
      angle: { 1: 34, 2: 56, 3: 50 },
      children: { 0: 5, 1: 2, 2: 2 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.018 },
      gnarliness: { 0: 0.12, 1: 0.12, 2: 0.08, 3: 0.08 },
      length: { 0: 0.25, 1: 12.0, 2: 5.0, 3: 3.8 },
      radius: { 0: 0.54, 1: 0.78, 2: 0.62, 3: 0.56 },
      sections: { 0: 3, 1: 4, 2: 4, 3: 3 },
      segments: { 0: 4, 1: 4, 2: 3, 3: 3 },
      start: { 1: 0.42, 2: 0.3, 3: 0 },
      taper: { 0: 0.7, 1: 0.7, 2: 0.7, 3: 0.7 },
      twist: { 0: -0.22, 1: 0.08, 2: 0, 3: 0 }
    },
    leaves: {
      type: 'oak',
      billboard: 'double',
      angle: 50,
      count: 5,
      start: 0,
      size: 2.95,
      sizeVariance: 0.6,
      tint: 0xcbe89d,
      alphaTest: 0.42
    }
  }
};

/**
 * Genera las geometrías separadas de ramas y hojas botánicas para un arquetipo arbóreo.
 * Devuelve geometrías escaladas a metros más puntos de anclaje en ramas primarias y follaje.
 */
export function buildProceduralTreeGeometries(presetKey, seed = 101) {
  const options = CLOUD_FOREST_PRESETS[presetKey] || CLOUD_FOREST_PRESETS.oakCloud;
  const rng = new TreeRNG(seed);
  const unitScale = options.unitScale || 0.17;

  const branches = { verts: [], normals: [], indices: [], uvs: [] };
  const leaves = { verts: [], normals: [], indices: [], uvs: [] };
  const primaryBranchAnchors = [];
  const leafTipAnchors = [];
  const queue = [];

  queue.push(
    new BranchSegment(
      new THREE.Vector3(),
      new THREE.Euler(),
      options.branch.length[0],
      options.branch.radius[0],
      0,
      options.branch.sections[0],
      options.branch.segments[0]
    )
  );

  const generateLeaf = (origin, orientation) => {
    let idx = leaves.verts.length / 3;
    const size =
      options.leaves.size *
      (1 + rng.random(options.leaves.sizeVariance, -options.leaves.sizeVariance));

    const createQuad = (rotY) => {
      const pts = [
        new THREE.Vector3(-size / 2, size, 0),
        new THREE.Vector3(-size / 2, 0, 0),
        new THREE.Vector3(size / 2, 0, 0),
        new THREE.Vector3(size / 2, size, 0)
      ].map((v) =>
        v.applyEuler(new THREE.Euler(0, rotY, 0)).applyEuler(orientation).add(origin)
      );

      for (const p of pts) {
        leaves.verts.push(p.x * unitScale, p.y * unitScale, p.z * unitScale);
      }
      const n = new THREE.Vector3(0, 0, 1).applyEuler(orientation);
      for (let k = 0; k < 4; k++) {
        leaves.normals.push(n.x, n.y, n.z);
      }
      leaves.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
      leaves.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
      idx += 4;
    };

    createQuad(0);
    if (options.leaves.billboard === 'double') {
      createQuad(Math.PI / 2);
    }

    const tipPos = new THREE.Vector3(0, size * 0.65, 0).applyEuler(orientation).add(origin);
    leafTipAnchors.push(tipPos.multiplyScalar(unitScale));
  };

  const generateLeaves = (sections) => {
    const radialOffset = rng.random();
    for (let i = 0; i < options.leaves.count; i++) {
      const leafStart = rng.random(1.0, options.leaves.start);
      const sectionIndex = Math.floor(leafStart * (sections.length - 1));
      const sectionA = sections[sectionIndex];
      const sectionB = sectionIndex === sections.length - 1 ? sectionA : sections[sectionIndex + 1];
      const alpha =
        (leafStart - sectionIndex / (sections.length - 1)) / (1 / (sections.length - 1));

      const leafOrigin = new THREE.Vector3().lerpVectors(sectionA.origin, sectionB.origin, alpha);
      const qA = new THREE.Quaternion().setFromEuler(sectionA.orientation);
      const qB = new THREE.Quaternion().setFromEuler(sectionB.orientation);
      const parentOrientation = new THREE.Euler().setFromQuaternion(qB.slerp(qA, alpha));

      const radialAngle = 2.0 * Math.PI * (radialOffset + i / options.leaves.count);
      const q1 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        (options.leaves.angle * Math.PI) / 180
      );
      const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radialAngle);
      const q3 = new THREE.Quaternion().setFromEuler(parentOrientation);

      const leafOrientation = new THREE.Euler().setFromQuaternion(q3.multiply(q2.multiply(q1)));
      generateLeaf(leafOrigin, leafOrientation);
    }
  };

  const generateChildBranches = (count, level, sections) => {
    const radialOffset = rng.random();
    for (let i = 0; i < count; i++) {
      const childStart = rng.random(1.0, options.branch.start[level]);
      const sectionIndex = Math.floor(childStart * (sections.length - 1));
      const sectionA = sections[sectionIndex];
      const sectionB = sectionIndex === sections.length - 1 ? sectionA : sections[sectionIndex + 1];
      const alpha =
        (childStart - sectionIndex / (sections.length - 1)) / (1 / (sections.length - 1));

      const origin = new THREE.Vector3().lerpVectors(sectionA.origin, sectionB.origin, alpha);
      const radius =
        options.branch.radius[level] *
        ((1 - alpha) * sectionA.radius + alpha * sectionB.radius);

      const qA = new THREE.Quaternion().setFromEuler(sectionA.orientation);
      const qB = new THREE.Quaternion().setFromEuler(sectionB.orientation);
      const parentOri = new THREE.Euler().setFromQuaternion(qB.slerp(qA, alpha));

      const radialAngle = 2.0 * Math.PI * (radialOffset + i / count);
      const q1 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        (options.branch.angle[level] * Math.PI) / 180
      );
      const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radialAngle);
      const q3 = new THREE.Quaternion().setFromEuler(parentOri);
      const orientation = new THREE.Euler().setFromQuaternion(q3.multiply(q2.multiply(q1)));

      const length =
        options.branch.length[level] *
        (options.type === 'evergreen' ? 1.0 - childStart : 1.0);

      queue.push(
        new BranchSegment(
          origin,
          orientation,
          length,
          radius,
          level,
          options.branch.sections[level],
          options.branch.segments[level]
        )
      );
    }
  };

  while (queue.length > 0) {
    const branch = queue.shift();
    const indexOffset = branches.verts.length / 3;
    const sectionOrientation = branch.orientation.clone();
    const sectionOrigin = branch.origin.clone();
    const sectionLength =
      branch.length /
      branch.sectionCount /
      (options.type === 'deciduous' ? options.branch.levels - 1 : 1);
    const sections = [];

    for (let i = 0; i <= branch.sectionCount; i++) {
      let sectionRadius = branch.radius;
      if (i === branch.sectionCount && branch.level === options.branch.levels) {
        sectionRadius = 0.004;
      } else if (options.type === 'deciduous') {
        sectionRadius *= 1 - options.branch.taper[branch.level] * (i / branch.sectionCount);
      } else {
        sectionRadius *= 1 - i / branch.sectionCount;
      }

      // Ensanchamiento orgánico de raíz en la base del tronco principal
      if (branch.level === 0) {
        const rootT = 1 - i / branch.sectionCount;
        sectionRadius *= 1 + 0.34 * Math.pow(rootT, 2.4);
      }

      let first = null;
      for (let j = 0; j < branch.segmentCount; j++) {
        const angle = (2.0 * Math.PI * j) / branch.segmentCount;
        const vLocal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const vertex = vLocal
          .clone()
          .multiplyScalar(sectionRadius)
          .applyEuler(sectionOrientation)
          .add(sectionOrigin);
        const normal = vLocal.clone().applyEuler(sectionOrientation).normalize();
        const uv = new THREE.Vector2(j / branch.segmentCount, i % 2 === 0 ? 0 : 1);

        branches.verts.push(vertex.x * unitScale, vertex.y * unitScale, vertex.z * unitScale);
        branches.normals.push(normal.x, normal.y, normal.z);
        branches.uvs.push(uv.x, uv.y);

        if (j === 0) first = { vertex, normal, uv };
      }

      branches.verts.push(
        first.vertex.x * unitScale,
        first.vertex.y * unitScale,
        first.vertex.z * unitScale
      );
      branches.normals.push(first.normal.x, first.normal.y, first.normal.z);
      branches.uvs.push(1, first.uv.y);

      sections.push({
        origin: sectionOrigin.clone(),
        orientation: sectionOrientation.clone(),
        radius: sectionRadius
      });

      sectionOrigin.add(new THREE.Vector3(0, sectionLength, 0).applyEuler(sectionOrientation));

      const safeRadius = Math.max(0.035, sectionRadius);
      const gnarl = Math.max(1, 1 / Math.sqrt(safeRadius)) * options.branch.gnarliness[branch.level];
      sectionOrientation.x += rng.random(gnarl, -gnarl);
      sectionOrientation.z += rng.random(gnarl, -gnarl);

      const qSection = new THREE.Quaternion().setFromEuler(sectionOrientation);
      const qTwist = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        options.branch.twist[branch.level]
      );
      const qForce = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(
          options.branch.force.direction.x,
          options.branch.force.direction.y,
          options.branch.force.direction.z
        ).normalize()
      );
      qSection.multiply(qTwist);
      qSection.rotateTowards(qForce, options.branch.force.strength / safeRadius);
      sectionOrientation.setFromQuaternion(qSection);
    }

    const rowStride = branch.segmentCount + 1;
    for (let i = 0; i < branch.sectionCount; i++) {
      for (let j = 0; j < branch.segmentCount; j++) {
        const v1 = indexOffset + i * rowStride + j;
        const v2 = indexOffset + i * rowStride + j + 1;
        const v3 = v1 + rowStride;
        const v4 = v2 + rowStride;
        branches.indices.push(v1, v3, v2, v2, v3, v4);
      }
    }

    if (branch.level === 1 && sections.length >= 3) {
      const mid = sections[Math.floor(sections.length * 0.55)];
      primaryBranchAnchors.push({
        mid: mid.origin.clone().multiplyScalar(unitScale),
        base: sections[1].origin.clone().multiplyScalar(unitScale),
        dir: new THREE.Vector3(0, 1, 0).applyEuler(mid.orientation)
      });
    }

    if (options.type === 'deciduous') {
      const lastSection = sections[sections.length - 1];
      if (branch.level < options.branch.levels) {
        queue.push(
          new BranchSegment(
            lastSection.origin,
            lastSection.orientation,
            options.branch.length[branch.level + 1],
            lastSection.radius,
            branch.level + 1,
            branch.sectionCount,
            branch.segmentCount
          )
        );
      } else {
        generateLeaf(lastSection.origin, lastSection.orientation);
      }
    }

    if (branch.level === options.branch.levels) {
      generateLeaves(sections);
    } else if (branch.level < options.branch.levels) {
      generateChildBranches(
        options.branch.children[branch.level],
        branch.level + 1,
        sections
      );
    }
  }

  // Normales esféricas suaves para el follaje: eliminan costuras oscuras entre cartas cruzadas
  const vertCount = leaves.verts.length / 3;
  if (vertCount > 0) {
    const center = new THREE.Vector3();
    for (let i = 0; i < vertCount; i++) {
      center.x += leaves.verts[i * 3];
      center.y += leaves.verts[i * 3 + 1];
      center.z += leaves.verts[i * 3 + 2];
    }
    center.divideScalar(vertCount);
    center.y *= 0.86;

    const dir = new THREE.Vector3();
    const quadN = new THREE.Vector3();
    for (let i = 0; i < vertCount; i++) {
      dir.set(
        leaves.verts[i * 3] - center.x,
        leaves.verts[i * 3 + 1] - center.y + 0.35,
        leaves.verts[i * 3 + 2] - center.z
      );
      if (dir.lengthSq() > 0.0001) dir.normalize();
      else dir.set(0, 1, 0);

      quadN.set(leaves.normals[i * 3], leaves.normals[i * 3 + 1], leaves.normals[i * 3 + 2]);
      quadN.lerp(dir, 0.78).normalize();
      leaves.normals[i * 3] = quadN.x;
      leaves.normals[i * 3 + 1] = quadN.y;
      leaves.normals[i * 3 + 2] = quadN.z;
    }
  }

  const branchGeo = new THREE.BufferGeometry();
  branchGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(branches.verts), 3));
  branchGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(branches.normals), 3));
  branchGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(branches.uvs), 2));
  const BranchIndexArr = branches.verts.length / 3 > 65535 ? Uint32Array : Uint16Array;
  branchGeo.setIndex(new THREE.BufferAttribute(new BranchIndexArr(branches.indices), 1));
  branchGeo.computeBoundingSphere();

  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(leaves.verts), 3));
  leafGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(leaves.normals), 3));
  leafGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(leaves.uvs), 2));
  const LeafIndexArr = leaves.verts.length / 3 > 65535 ? Uint32Array : Uint16Array;
  leafGeo.setIndex(new THREE.BufferAttribute(new LeafIndexArr(leaves.indices), 1));
  leafGeo.computeBoundingSphere();

  return {
    branchGeo,
    leafGeo,
    options,
    primaryBranchAnchors,
    leafTipAnchors
  };
}
