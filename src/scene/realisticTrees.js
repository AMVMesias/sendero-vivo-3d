import * as THREE from 'three';

/**
 * Generador procedural de árboles y arbustos realistas con ramificación jerárquica
 * cónica (UV continuas sin inversión por sección, raíces ensanchadas) y ramilletes
 * foliares volumétricos orientados a cámara (`fluffy foliage clusters`) con normales
 * esféricas y oclusión ambiental interna de copa.
 *
 * La base recursiva de ramificación deriva de `@dgreenheck/ez-tree`
 * (Copyright (c) 2024 Daniel Greenheck, MIT License).
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
    bark: { type: 'oak' },
    branch: {
      levels: 2,
      angle: { 1: 50, 2: 46 },
      children: { 0: 5, 1: 3 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.015 },
      gnarliness: { 0: 0.04, 1: 0.09, 2: 0.07 },
      length: { 0: 21, 1: 11.5, 2: 6.2 },
      radius: { 0: 1.4, 1: 0.72, 2: 0.56 },
      sections: { 0: 8, 1: 5, 2: 4 },
      segments: { 0: 9, 1: 6, 2: 5 },
      start: { 1: 0.52, 2: 0.28 },
      taper: { 0: 0.65, 1: 0.58, 2: 0.72 },
      twist: { 0: 0.08, 1: 0.14, 2: 0 }
    },
    leaves: {
      type: 'broadleaf',
      puffCountPerTip: 5,
      puffSpread: 1.15,
      size: 1.52,
      sizeVariance: 0.34,
      crownExtra: 18
    }
  },
  ashAndean: {
    type: 'deciduous',
    unitScale: 0.195,
    bark: { type: 'oak' },
    branch: {
      levels: 2,
      angle: { 1: 46, 2: 52 },
      children: { 0: 6, 1: 3 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.018 },
      gnarliness: { 0: 0.03, 1: 0.11, 2: 0.08 },
      length: { 0: 24, 1: 13.5, 2: 6.8 },
      radius: { 0: 1.55, 1: 0.65, 2: 0.52 },
      sections: { 0: 8, 1: 5, 2: 4 },
      segments: { 0: 9, 1: 6, 2: 5 },
      start: { 1: 0.44, 2: 0.3 },
      taper: { 0: 0.64, 1: 0.62, 2: 0.72 },
      twist: { 0: -0.06, 1: 0.1, 2: 0 }
    },
    leaves: {
      type: 'olive',
      puffCountPerTip: 5,
      puffSpread: 1.25,
      size: 1.56,
      sizeVariance: 0.35,
      crownExtra: 20
    }
  },
  birchAlder: {
    type: 'deciduous',
    unitScale: 0.175,
    bark: { type: 'birch' },
    branch: {
      levels: 2,
      angle: { 1: 52, 2: 36 },
      children: { 0: 7, 1: 3 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.025 },
      gnarliness: { 0: 0.04, 1: 0.08, 2: 0.06 },
      length: { 0: 32, 1: 9.2, 2: 5.8 },
      radius: { 0: 0.88, 1: 0.48, 2: 0.46 },
      sections: { 0: 9, 1: 5, 2: 4 },
      segments: { 0: 8, 1: 5, 2: 4 },
      start: { 1: 0.46, 2: 0.25 },
      taper: { 0: 0.48, 1: 0.52, 2: 0.72 },
      twist: { 0: 0.04, 1: 0.06, 2: 0 }
    },
    leaves: {
      type: 'olive',
      puffCountPerTip: 4,
      puffSpread: 1.05,
      size: 1.38,
      sizeVariance: 0.3,
      crownExtra: 16
    }
  },
  polylepis: {
    type: 'deciduous',
    unitScale: 0.205,
    bark: { type: 'cedar' },
    branch: {
      levels: 2,
      angle: { 1: 58, 2: 50 },
      children: { 0: 5, 1: 3 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.01 },
      gnarliness: { 0: 0.14, 1: 0.16, 2: 0.1 },
      length: { 0: 15, 1: 10.5, 2: 5.5 },
      radius: { 0: 1.32, 1: 0.72, 2: 0.56 },
      sections: { 0: 8, 1: 5, 2: 4 },
      segments: { 0: 8, 1: 6, 2: 5 },
      start: { 1: 0.3, 2: 0.22 },
      taper: { 0: 0.62, 1: 0.6, 2: 0.7 },
      twist: { 0: 0.12, 1: 0.14, 2: 0 }
    },
    leaves: {
      type: 'broadleaf',
      puffCountPerTip: 5,
      puffSpread: 1.15,
      size: 1.44,
      sizeVariance: 0.32,
      crownExtra: 16
    }
  },
  podocarpus: {
    type: 'evergreen',
    unitScale: 0.175,
    bark: { type: 'oak' },
    branch: {
      levels: 1,
      angle: { 1: 98 },
      children: { 0: 26 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.008 },
      gnarliness: { 0: 0.03, 1: 0.05 },
      length: { 0: 44, 1: 16.5 },
      radius: { 0: 1.05, 1: 0.36 },
      sections: { 0: 10, 1: 5 },
      segments: { 0: 8, 1: 5 },
      start: { 1: 0.24 },
      taper: { 0: 0.72, 1: 0.68 },
      twist: { 0: 0, 1: 0 }
    },
    leaves: {
      type: 'conifer',
      puffCountPerTip: 3,
      puffSpread: 0.78,
      size: 1.32,
      sizeVariance: 0.25,
      crownExtra: 12
    }
  },
  grandfather: {
    type: 'deciduous',
    unitScale: 0.3,
    bark: { type: 'oak' },
    branch: {
      levels: 2,
      angle: { 1: 54, 2: 48 },
      children: { 0: 6, 1: 3 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.012 },
      gnarliness: { 0: 0.04, 1: 0.1, 2: 0.08 },
      length: { 0: 24, 1: 13.5, 2: 7.0 },
      radius: { 0: 1.9, 1: 0.85, 2: 0.58 },
      sections: { 0: 10, 1: 6, 2: 4 },
      segments: { 0: 11, 1: 7, 2: 5 },
      start: { 1: 0.42, 2: 0.24 },
      taper: { 0: 0.66, 1: 0.56, 2: 0.72 },
      twist: { 0: -0.1, 1: 0.14, 2: 0 }
    },
    leaves: {
      type: 'broadleaf',
      puffCountPerTip: 6,
      puffSpread: 1.75,
      size: 2.05,
      sizeVariance: 0.32,
      crownExtra: 28
    }
  },
  blossomCanopy: {
    type: 'deciduous',
    unitScale: 0.18,
    bark: { type: 'cedar' },
    branch: {
      levels: 2,
      angle: { 1: 52, 2: 48 },
      children: { 0: 5, 1: 3 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.014 },
      gnarliness: { 0: 0.07, 1: 0.12, 2: 0.08 },
      length: { 0: 21, 1: 11.5, 2: 6.0 },
      radius: { 0: 1.35, 1: 0.66, 2: 0.5 },
      sections: { 0: 8, 1: 5, 2: 4 },
      segments: { 0: 8, 1: 6, 2: 5 },
      start: { 1: 0.42, 2: 0.26 },
      taper: { 0: 0.64, 1: 0.6, 2: 0.7 },
      twist: { 0: 0.08, 1: -0.06, 2: 0 }
    },
    leaves: {
      type: 'olive',
      puffCountPerTip: 5,
      puffSpread: 1.15,
      size: 1.48,
      sizeVariance: 0.3,
      crownExtra: 18
    }
  },
  shrubAsh: {
    type: 'deciduous',
    unitScale: 0.11,
    bark: { type: 'oak' },
    branch: {
      levels: 1,
      angle: { 1: 42 },
      children: { 0: 5 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.015 },
      gnarliness: { 0: 0.08, 1: 0.12 },
      length: { 0: 0.6, 1: 6.2 },
      radius: { 0: 0.5, 1: 0.48 },
      sections: { 0: 3, 1: 4 },
      segments: { 0: 5, 1: 4 },
      start: { 1: 0.35 },
      taper: { 0: 0.5, 1: 0.72 },
      twist: { 0: 0.1, 1: 0.05 }
    },
    leaves: {
      type: 'olive',
      puffCountPerTip: 3,
      puffSpread: 0.44,
      size: 0.86,
      sizeVariance: 0.28,
      crownExtra: 4
    }
  },
  shrubOak: {
    type: 'deciduous',
    unitScale: 0.105,
    bark: { type: 'cedar' },
    branch: {
      levels: 1,
      angle: { 1: 46 },
      children: { 0: 5 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.012 },
      gnarliness: { 0: 0.1, 1: 0.12 },
      length: { 0: 0.6, 1: 5.8 },
      radius: { 0: 0.48, 1: 0.46 },
      sections: { 0: 3, 1: 4 },
      segments: { 0: 5, 1: 4 },
      start: { 1: 0.35 },
      taper: { 0: 0.5, 1: 0.72 },
      twist: { 0: -0.1, 1: 0.08 }
    },
    leaves: {
      type: 'broadleaf',
      puffCountPerTip: 3,
      puffSpread: 0.42,
      size: 0.84,
      sizeVariance: 0.28,
      crownExtra: 4
    }
  }
};

/**
 * Construye geometría de corteza (ramas continuas) + tarjetas foliares billboard orientadas a cámara
 * alrededor de las copas y puntas de ramas reales.
 */
export function buildProceduralTreeGeometries(presetKey, seed = 101) {
  const options = CLOUD_FOREST_PRESETS[presetKey] || CLOUD_FOREST_PRESETS.oakCloud;
  const rng = new TreeRNG(seed);
  const unitScale = options.unitScale || 0.18;

  const branches = { verts: [], normals: [], indices: [], uvs: [] };
  const primaryBranchAnchors = [];
  const leafClusters = [];
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

  const pushPuffAroundPoint = (centerLocal, spreadM, baseSizeM, count) => {
    for (let k = 0; k < count; k++) {
      const ang = (k / Math.max(1, count)) * Math.PI * 2 + rng.random(0.8, -0.8);
      const rad = rng.random(spreadM, 0.12 * spreadM);
      const dy = rng.random(spreadM * 0.55, -spreadM * 0.38);
      const pos = new THREE.Vector3(
        centerLocal.x * unitScale + Math.cos(ang) * rad,
        centerLocal.y * unitScale + dy,
        centerLocal.z * unitScale + Math.sin(ang) * rad
      );
      const size = baseSizeM * (1 + rng.random(options.leaves.sizeVariance, -options.leaves.sizeVariance));
      const roll = rng.random(Math.PI * 2, 0);
      leafClusters.push({ pos, size, roll });
      leafTipAnchors.push(pos);
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
        (options.type === 'evergreen' ? 1.0 - childStart * 0.72 : 1.0);

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
    const sectionLength = branch.length / branch.sectionCount;
    const sections = [];

    for (let i = 0; i <= branch.sectionCount; i++) {
      let sectionRadius = branch.radius;
      if (i === branch.sectionCount && branch.level === options.branch.levels) {
        sectionRadius = 0.015;
      } else if (options.type === 'deciduous') {
        sectionRadius *= 1 - options.branch.taper[branch.level] * (i / branch.sectionCount);
      } else {
        sectionRadius *= 1 - (i / branch.sectionCount) * 0.92;
      }

      if (branch.level === 0) {
        const rootT = 1 - i / branch.sectionCount;
        sectionRadius *= 1 + 0.34 * Math.pow(rootT, 2.4);
      }

      // UV vertical continua en metros (sin alternar 0..1..0 que deformaba la corteza)
      const vCoord = i * sectionLength * unitScale * 0.65;
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
        const uCoord = (j / branch.segmentCount) * (branch.level === 0 ? 1.4 : 1.0);

        branches.verts.push(vertex.x * unitScale, vertex.y * unitScale, vertex.z * unitScale);
        branches.normals.push(normal.x, normal.y, normal.z);
        branches.uvs.push(uCoord, vCoord);

        if (j === 0) first = { vertex, normal, vCoord };
      }

      branches.verts.push(
        first.vertex.x * unitScale,
        first.vertex.y * unitScale,
        first.vertex.z * unitScale
      );
      branches.normals.push(first.normal.x, first.normal.y, first.normal.z);
      branches.uvs.push(branch.level === 0 ? 1.4 : 1.0, first.vCoord);

      sections.push({
        origin: sectionOrigin.clone(),
        orientation: sectionOrientation.clone(),
        radius: sectionRadius
      });

      sectionOrigin.add(new THREE.Vector3(0, sectionLength, 0).applyEuler(sectionOrientation));

      const safeRadius = Math.max(0.05, sectionRadius);
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

    if (branch.level === options.branch.levels) {
      // Colocar nubes foliares envolviendo tanto la mitad exterior como la punta de la rama
      const midSection = sections[Math.floor(sections.length * 0.55)];
      const endSection = sections[sections.length - 1];
      const tierFactor = options.type === 'evergreen' ? Math.max(0.55, 1.15 - (endSection.origin.y / Math.max(1, options.branch.length[0])) * 0.55) : 1.0;

      pushPuffAroundPoint(
        midSection.origin,
        options.leaves.puffSpread * 0.72 * tierFactor,
        options.leaves.size * 0.92 * tierFactor,
        Math.max(2, Math.floor(options.leaves.puffCountPerTip * 0.65))
      );
      pushPuffAroundPoint(
        endSection.origin,
        options.leaves.puffSpread * tierFactor,
        options.leaves.size * tierFactor,
        options.leaves.puffCountPerTip
      );
    } else {
      if (options.type === 'deciduous') {
        const lastSection = sections[sections.length - 1];
        queue.push(
          new BranchSegment(
            lastSection.origin,
            lastSection.orientation,
            options.branch.length[branch.level + 1],
            lastSection.radius,
            branch.level + 1,
            options.branch.sections[branch.level + 1],
            options.branch.segments[branch.level + 1]
          )
        );
      } else if (branch.level === 0) {
        // Copa apical de conífera
        const topSec = sections[sections.length - 1];
        pushPuffAroundPoint(topSec.origin, 0.45, options.leaves.size * 0.85, 6);
      }

      generateChildBranches(
        options.branch.children[branch.level],
        branch.level + 1,
        sections
      );
    }
  }

  // Relleno orgánico superior de copa para siluetas irregulares y frondosas
  if (leafClusters.length > 0 && options.leaves.crownExtra > 0) {
    const center = new THREE.Vector3();
    for (const c of leafClusters) center.add(c.pos);
    center.divideScalar(leafClusters.length);
    const crownRadius = options.leaves.puffSpread * 1.65;

    for (let i = 0; i < options.leaves.crownExtra; i++) {
      const ang = (i / options.leaves.crownExtra) * Math.PI * 2 + rng.random(0.6, -0.6);
      const rad = rng.random(crownRadius, 0.25);
      const dy = rng.random(crownRadius * 0.78, -crownRadius * 0.25);
      const pos = new THREE.Vector3(
        center.x + Math.cos(ang) * rad,
        center.y + dy,
        center.z + Math.sin(ang) * rad
      );
      const size = options.leaves.size * rng.random(1.12, 0.78);
      leafClusters.push({ pos, size, roll: rng.random(Math.PI * 2, 0) });
      leafTipAnchors.push(pos);
    }
  }

  // Construir geometría billboard compacta con normales esféricas suaves y oclusión ambiental
  const leafVerts = [];
  const leafNormals = [];
  const leafUvs = [];
  const leafCorners = [];
  const leafShades = [];
  const leafIndices = [];

  if (leafClusters.length > 0) {
    const crownCenter = new THREE.Vector3();
    let maxDist = 0.01;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of leafClusters) {
      crownCenter.add(c.pos);
      if (c.pos.y < minY) minY = c.pos.y;
      if (c.pos.y > maxY) maxY = c.pos.y;
    }
    crownCenter.divideScalar(leafClusters.length);
    for (const c of leafClusters) {
      const d = c.pos.distanceTo(crownCenter);
      if (d > maxDist) maxDist = d;
    }

    const corners = [
      [-0.5, -0.5, 0, 0],
      [0.5, -0.5, 1, 0],
      [0.5, 0.5, 1, 1],
      [-0.5, 0.5, 0, 1]
    ];

    const hSpan = Math.max(0.25, maxY - minY);
    leafClusters.forEach((c, idx) => {
      const baseV = idx * 4;
      const sphN = c.pos
        .clone()
        .sub(crownCenter)
        .add(new THREE.Vector3(0, maxDist * 0.35, 0));
      if (sphN.lengthSq() > 0.0001) sphN.normalize();
      else sphN.set(0, 1, 0);

      const radialNorm = Math.min(1, c.pos.distanceTo(crownCenter) / maxDist);
      const heightNorm = Math.max(0, Math.min(1, (c.pos.y - minY) / hSpan));
      // Oclusión ambiental interna (0.64) hacia puntas soleadas (1.18)
      const ao = 0.64 + heightNorm * 0.32 + radialNorm * 0.22;

      for (const [cx, cy, u, v] of corners) {
        leafVerts.push(c.pos.x, c.pos.y, c.pos.z);
        leafNormals.push(sphN.x, sphN.y, sphN.z);
        leafUvs.push(u, v);
        leafCorners.push(cx, cy, c.size, c.roll);
        leafShades.push(ao);
      }
      leafIndices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
    });
  }

  const branchGeo = new THREE.BufferGeometry();
  branchGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(branches.verts), 3));
  branchGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(branches.normals), 3));
  branchGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(branches.uvs), 2));
  const BranchIndexArr = branches.verts.length / 3 > 65535 ? Uint32Array : Uint16Array;
  branchGeo.setIndex(new THREE.BufferAttribute(new BranchIndexArr(branches.indices), 1));
  branchGeo.computeBoundingSphere();

  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(leafVerts), 3));
  leafGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(leafNormals), 3));
  leafGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(leafUvs), 2));
  leafGeo.setAttribute('aLeafCorner', new THREE.BufferAttribute(new Float32Array(leafCorners), 4));
  leafGeo.setAttribute('aLeafShade', new THREE.BufferAttribute(new Float32Array(leafShades), 1));
  leafGeo.setIndex(leafIndices);
  leafGeo.computeBoundingSphere();
  if (leafGeo.boundingSphere) {
    leafGeo.boundingSphere.radius += options.leaves.size * 0.85;
  }

  return {
    branchGeo,
    leafGeo,
    options,
    primaryBranchAnchors,
    leafTipAnchors
  };
}
