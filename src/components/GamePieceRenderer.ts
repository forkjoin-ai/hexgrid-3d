/**
 * GamePieceRenderer — Three.js mesh factory for game pieces on a geodesic sphere.
 *
 * Builds 3D meshes from PieceShape primitives, accepts custom Object3D instances,
 * handles instanced rendering for performance, surface-normal alignment, stacking,
 * and piece animations (spin, bob, pulse, wobble, orbit, glow).
 */
import * as THREE from '@a0n/aeon-3d/three';
import type {
  GamePiece,
  PieceShape,
  PieceAnimation,
  PieceAnimationConfig,
  CellGameState,
} from '../types';

// ---------------------------------------------------------------------------
// Geometry cache — shared across all pieces to avoid duplicate geometry alloc
// ---------------------------------------------------------------------------
const geometryCache = new Map<string, THREE.BufferGeometry>();

function getCachedGeometry(shape: PieceShape): THREE.BufferGeometry {
  if (geometryCache.has(shape)) return geometryCache.get(shape)!;

  let geo: THREE.BufferGeometry;
  switch (shape) {
    case 'sphere':
      geo = new THREE.SphereGeometry(0.5, 24, 16);
      break;
    case 'cube':
      geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(0.4, 0.9, 16);
      break;
    case 'cylinder':
      geo = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16);
      break;
    case 'pyramid':
      geo = new THREE.ConeGeometry(0.5, 0.9, 4);
      break;
    case 'torus':
      geo = new THREE.TorusGeometry(0.35, 0.12, 12, 24);
      break;
    case 'ring':
      geo = new THREE.TorusGeometry(0.45, 0.06, 8, 32);
      break;
    case 'flag': {
      // Flag = thin vertical pole + rectangular flag
      const group = new THREE.BufferGeometry();
      const pole = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6);
      const flag = new THREE.PlaneGeometry(0.5, 0.3);
      pole.translate(0, 0.5, 0);
      flag.translate(0.25, 0.85, 0);
      const merged = mergeGeometries([pole, flag]);
      geo = merged ?? pole;
      break;
    }
    case 'star': {
      // Octahedron as a star approximation
      geo = new THREE.OctahedronGeometry(0.5, 0);
      geo.scale(1, 1.3, 1); // elongate vertically
      break;
    }
    case 'diamond':
      geo = new THREE.OctahedronGeometry(0.45, 0);
      break;
    case 'capsule':
      geo = new THREE.CapsuleGeometry(0.25, 0.5, 8, 16);
      break;
    case 'octahedron':
      geo = new THREE.OctahedronGeometry(0.5, 0);
      break;
    case 'dodecahedron':
      geo = new THREE.DodecahedronGeometry(0.45, 0);
      break;
    case 'icosahedron':
      geo = new THREE.IcosahedronGeometry(0.45, 0);
      break;
    default:
      geo = new THREE.SphereGeometry(0.5, 24, 16);
  }

  geometryCache.set(shape, geo);
  return geo;
}

/** Simple merge helper — concat two BufferGeometries into one */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geos.length === 0) return null;
  if (geos.length === 1) return geos[0];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geo of geos) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const idx = geo.getIndex();

    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    if (norm) {
      for (let i = 0; i < norm.count; i++) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.array[i] + indexOffset);
      }
    }
    indexOffset += pos ? pos.count : 0;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  if (indices.length > 0) {
    merged.setIndex(indices);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Material factory
// ---------------------------------------------------------------------------

function createPieceMaterial(piece: GamePiece): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(piece.color ?? '#ffffff'),
    metalness: piece.metalness ?? 0.1,
    roughness: piece.roughness ?? 0.6,
    transparent: (piece.opacity ?? 1) < 1,
    opacity: piece.opacity ?? 1,
    wireframe: piece.wireframe ?? false,
  });

  if (piece.emissive) {
    mat.emissive = new THREE.Color(piece.emissive);
    mat.emissiveIntensity = piece.emissiveIntensity ?? 0.5;
  }

  return mat;
}

// ---------------------------------------------------------------------------
// Label sprite factory (billboarded text above piece)
// ---------------------------------------------------------------------------

function createLabelSprite(
  text: string,
  color: string = '#ffffff',
  fontSize: number = 48,
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, 256, 64);

  ctx.font = `bold ${fontSize}px Consolas, "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.0, 0.25, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Count badge sprite (for army counts, resource counts, etc.)
// ---------------------------------------------------------------------------

function createCountBadge(count: number, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 128;
  canvas.height = 128;

  // Circle background
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Number
  ctx.font = 'bold 56px Consolas, "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(count), 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.5, 0.5, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Three.js Object3D from a GamePiece definition.
 * Returns a Group containing the mesh, optional label, and optional count badge.
 */
export function buildPieceMesh(piece: GamePiece): THREE.Group {
  const group = new THREE.Group();
  group.name = `piece-${piece.id}`;
  group.userData = { pieceId: piece.id, piece };

  // --- Main mesh ---
  let mesh: THREE.Object3D;

  if (piece.object3D) {
    // Custom Object3D — clone it
    mesh = (piece.object3D as THREE.Object3D).clone();
  } else if (piece.modelUrl) {
    // GLTF placeholder — will be replaced asynchronously
    const placeholder = new THREE.Mesh(
      getCachedGeometry('sphere'),
      new THREE.MeshStandardMaterial({ color: piece.color ?? '#888888', wireframe: true }),
    );
    placeholder.name = 'gltf-placeholder';
    placeholder.userData.modelUrl = piece.modelUrl;
    mesh = placeholder;
  } else {
    // Primitive shape
    const shape = piece.shape ?? 'sphere';
    const geo = getCachedGeometry(shape);
    const mat = createPieceMaterial(piece);
    mesh = new THREE.Mesh(geo, mat);
  }

  // --- Scale ---
  if (piece.scale !== undefined) {
    if (typeof piece.scale === 'number') {
      mesh.scale.setScalar(piece.scale);
    } else {
      mesh.scale.set(piece.scale[0], piece.scale[1], piece.scale[2]);
    }
  }

  // --- Rotation ---
  if (piece.rotationY !== undefined) {
    mesh.rotation.y = piece.rotationY;
  }

  mesh.name = 'piece-mesh';
  group.add(mesh);

  // --- Stack rendering for count > 1 ---
  const count = piece.count ?? 1;
  const stackStyle = piece.stackStyle ?? 'badge';

  if (count > 1 && stackStyle === 'stack') {
    // Render stacked copies offset upward
    const stackCount = Math.min(count, 5); // visual cap
    for (let i = 1; i < stackCount; i++) {
      const clone = mesh.clone();
      clone.position.y += i * 0.15;
      clone.name = `piece-stack-${i}`;
      group.add(clone);
    }
  } else if (count > 1 && stackStyle === 'ring') {
    // Render copies in a ring around the center
    const ringCount = Math.min(count, 8);
    const ringRadius = 0.25;
    for (let i = 1; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const clone = mesh.clone();
      clone.position.x += Math.cos(angle) * ringRadius;
      clone.position.z += Math.sin(angle) * ringRadius;
      clone.scale.multiplyScalar(0.6);
      clone.name = `piece-ring-${i}`;
      group.add(clone);
    }
  }

  // --- Count badge (default for count > 1) ---
  if (count > 1 && stackStyle === 'badge') {
    const badge = createCountBadge(count, piece.color ?? '#ffffff');
    badge.position.y = 0.6;
    badge.name = 'count-badge';
    group.add(badge);
  }

  // --- Label sprite ---
  if (piece.label) {
    const labelSprite = createLabelSprite(
      piece.label,
      piece.labelColor ?? piece.color ?? '#ffffff',
    );
    labelSprite.position.y = count > 1 && stackStyle === 'stack'
      ? 0.15 * Math.min(count, 5) + 0.5
      : 0.7;
    labelSprite.name = 'piece-label';
    group.add(labelSprite);
  }

  // --- Store animation config ---
  if (piece.animation && piece.animation !== 'none') {
    const animConfig: PieceAnimationConfig = typeof piece.animation === 'string'
      ? { type: piece.animation }
      : piece.animation;
    group.userData.animation = animConfig;
  }

  return group;
}

/**
 * Place a piece group onto the sphere surface at a given hex center position.
 * Orients the piece so "up" points away from the sphere center (surface normal).
 *
 * @param pieceGroup - The group returned by buildPieceMesh
 * @param hexCenter  - The 3D position of the hex center on the unit sphere
 * @param sphereRadius - Radius of the rendered sphere
 * @param offsetY    - Additional height above surface (from GamePiece.offsetY)
 */
export function placePieceOnSphere(
  pieceGroup: THREE.Group,
  hexCenter: { x: number; y: number; z: number },
  sphereRadius: number,
  offsetY: number = 0,
): void {
  // Normal = direction from sphere center to hex center (unit sphere, so it IS the normal)
  const normal = new THREE.Vector3(hexCenter.x, hexCenter.y, hexCenter.z).normalize();

  // Position on sphere surface + offset
  const surfacePos = normal.clone().multiplyScalar(sphereRadius + offsetY);
  pieceGroup.position.copy(surfacePos);

  // Orient so local Y axis aligns with surface normal
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
  pieceGroup.quaternion.copy(quat);
}

/**
 * Animate a piece group based on its stored animation config.
 * Call this every frame with the elapsed time.
 *
 * @param pieceGroup - The group with userData.animation
 * @param time       - Elapsed time in seconds
 * @param deltaTime  - Frame delta in seconds
 */
export function animatePiece(
  pieceGroup: THREE.Group,
  time: number,
  _deltaTime: number,
): void {
  const config = pieceGroup.userData.animation as PieceAnimationConfig | undefined;
  if (!config || config.type === 'none') return;

  const speed = config.speed ?? 1.0;
  const amplitude = config.amplitude ?? 1.0;
  const phase = config.phase ?? 0;
  const t = time * speed + phase;

  const mesh = pieceGroup.getObjectByName('piece-mesh');
  if (!mesh) return;

  switch (config.type) {
    case 'spin': {
      const axis = config.axis ?? [0, 1, 0];
      const axisVec = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
      mesh.rotateOnAxis(axisVec, 0.02 * speed);
      break;
    }
    case 'bob': {
      // Sinusoidal up-down motion
      mesh.position.y = Math.sin(t * 2) * 0.1 * amplitude;
      break;
    }
    case 'pulse': {
      // Scale oscillation
      const s = 1.0 + Math.sin(t * 3) * 0.1 * amplitude;
      mesh.scale.setScalar(s);
      break;
    }
    case 'wobble': {
      mesh.rotation.x = Math.sin(t * 2.5) * 0.15 * amplitude;
      mesh.rotation.z = Math.cos(t * 2.5) * 0.15 * amplitude;
      break;
    }
    case 'orbit': {
      const radius = 0.2 * amplitude;
      mesh.position.x = Math.cos(t * 2) * radius;
      mesh.position.z = Math.sin(t * 2) * radius;
      break;
    }
    case 'glow': {
      // Pulse emissive intensity
      if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.emissiveIntensity = 0.3 + Math.sin(t * 3) * 0.3 * amplitude;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Cell surface mesh builder (hex/pentagon face on sphere)
// ---------------------------------------------------------------------------

/**
 * Create a flat polygon mesh for a hex or pentagon cell on the sphere surface.
 * Used by GameSphere to render the board itself.
 *
 * @param center    - Hex center on unit sphere
 * @param vertices  - Ordered vertices of the hex/pentagon (on unit sphere)
 * @param radius    - Sphere radius for scaling
 * @param color     - Fill color
 * @param elevation - How far above the sphere surface (0 = flush)
 */
export function buildCellMesh(
  center: { x: number; y: number; z: number },
  vertices: { x: number; y: number; z: number }[],
  radius: number,
  color: string = '#1a1a2e',
  elevation: number = 0,
): THREE.Mesh {
  const normal = new THREE.Vector3(center.x, center.y, center.z).normalize();
  const offset = normal.clone().multiplyScalar(radius + elevation);

  // Build fan geometry from center to vertices
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Center vertex
  positions.push(offset.x, offset.y, offset.z);
  normals.push(normal.x, normal.y, normal.z);

  for (const v of vertices) {
    const vn = new THREE.Vector3(v.x, v.y, v.z).normalize();
    const pos = vn.multiplyScalar(radius + elevation);
    positions.push(pos.x, pos.y, pos.z);
    normals.push(normal.x, normal.y, normal.z);
  }

  // Triangle fan
  for (let i = 1; i <= vertices.length; i++) {
    indices.push(0, i, i < vertices.length ? i + 1 : 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
    metalness: 0.05,
    roughness: 0.8,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'cell-face';
  return mesh;
}

/**
 * Build a cell border (wireframe outline) for a hex/pentagon on the sphere.
 */
export function buildCellBorder(
  vertices: { x: number; y: number; z: number }[],
  radius: number,
  color: string = '#333355',
  lineWidth: number = 1,
  elevation: number = 0,
): THREE.LineLoop {
  const points: THREE.Vector3[] = [];

  for (const v of vertices) {
    const vn = new THREE.Vector3(v.x, v.y, v.z).normalize();
    const pos = vn.multiplyScalar(radius + elevation + 0.001); // tiny offset to avoid z-fighting
    points.push(pos);
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    linewidth: lineWidth,
  });

  const line = new THREE.LineLoop(geo, mat);
  line.name = 'cell-border';
  return line;
}

// ---------------------------------------------------------------------------
// Fog overlay mesh
// ---------------------------------------------------------------------------

/**
 * Create a fog overlay sphere slightly larger than the game sphere.
 * Individual cell fog is handled by modifying cell material opacity,
 * but this provides a global atmospheric effect.
 */
export function buildFogOverlay(
  radius: number,
  fogColor: string = 'rgba(0,0,0,0.5)',
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius + 0.01, 64, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(fogColor.replace(/rgba?\([^)]+\)/, '#000000')),
    transparent: true,
    opacity: 0.0, // controlled per-cell via cell materials
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'fog-overlay';
  return mesh;
}

// ---------------------------------------------------------------------------
// Highlight ring
// ---------------------------------------------------------------------------

/**
 * Build a glowing ring around a cell for highlights (attack target, selection, etc.)
 */
export function buildHighlightRing(
  center: { x: number; y: number; z: number },
  radius: number,
  ringRadius: number = 0.15,
  color: string = '#ffffff',
  intensity: number = 1.0,
): THREE.Mesh {
  const normal = new THREE.Vector3(center.x, center.y, center.z).normalize();
  const pos = normal.clone().multiplyScalar(radius + 0.02);

  const geo = new THREE.TorusGeometry(ringRadius, 0.015, 8, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.6 * intensity,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);

  // Orient ring flat on sphere surface
  const up = new THREE.Vector3(0, 0, 1); // torus default normal
  const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
  mesh.quaternion.copy(quat);
  mesh.name = 'highlight-ring';

  return mesh;
}

// ---------------------------------------------------------------------------
// Attack animation (particle trail between cells)
// ---------------------------------------------------------------------------

export interface AttackAnimationConfig {
  fromCenter: { x: number; y: number; z: number };
  toCenter: { x: number; y: number; z: number };
  sphereRadius: number;
  color?: string;
  particleCount?: number;
  duration?: number; // seconds
}

/**
 * Create an attack trail particle system between two cells on the sphere.
 * Returns a Points object and an update function.
 */
export function buildAttackTrail(
  config: AttackAnimationConfig,
): { points: THREE.Points; update: (progress: number) => void; dispose: () => void } {
  const {
    fromCenter,
    toCenter,
    sphereRadius,
    color = '#ff4444',
    particleCount = 20,
  } = config;

  const from = new THREE.Vector3(fromCenter.x, fromCenter.y, fromCenter.z)
    .normalize()
    .multiplyScalar(sphereRadius + 0.05);
  const to = new THREE.Vector3(toCenter.x, toCenter.y, toCenter.z)
    .normalize()
    .multiplyScalar(sphereRadius + 0.05);

  // Arc midpoint lifted above sphere
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const midNormal = mid.clone().normalize();
  const arcHeight = from.distanceTo(to) * 0.3;
  mid.copy(midNormal.multiplyScalar(sphereRadius + arcHeight));

  const positions = new Float32Array(particleCount * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size: 0.06,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'attack-trail';

  const update = (progress: number) => {
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      const t = Math.max(0, Math.min(1, progress - i * 0.03));
      // Quadratic Bezier: from → mid → to
      const p = new THREE.Vector3();
      p.x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x;
      p.y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y;
      p.z = (1 - t) * (1 - t) * from.z + 2 * (1 - t) * t * mid.z + t * t * to.z;
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - progress * 0.5);
  };

  const dispose = () => {
    geo.dispose();
    mat.dispose();
  };

  return { points, update, dispose };
}

// ---------------------------------------------------------------------------
// Orbital strike animation (projectile from above)
// ---------------------------------------------------------------------------

export interface OrbitalStrikeConfig {
  targetCenter: { x: number; y: number; z: number };
  sphereRadius: number;
  color?: string;
  trailColor?: string;
}

/**
 * Create an orbital strike projectile that falls from high above to a cell.
 * Returns the mesh, update function, and disposal.
 */
export function buildOrbitalStrike(
  config: OrbitalStrikeConfig,
): { group: THREE.Group; update: (progress: number) => void; dispose: () => void } {
  const { targetCenter, sphereRadius, color = '#ff8800', trailColor = '#ffaa44' } = config;

  const normal = new THREE.Vector3(targetCenter.x, targetCenter.y, targetCenter.z).normalize();
  const surfacePos = normal.clone().multiplyScalar(sphereRadius);
  const startPos = normal.clone().multiplyScalar(sphereRadius * 3); // Start far above

  const group = new THREE.Group();
  group.name = 'orbital-strike';

  // Projectile
  const projGeo = new THREE.ConeGeometry(0.08, 0.3, 8);
  const projMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 1.5,
  });
  const projectile = new THREE.Mesh(projGeo, projMat);
  projectile.name = 'projectile';
  group.add(projectile);

  // Trail particles
  const trailCount = 30;
  const trailPositions = new Float32Array(trailCount * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMat = new THREE.PointsMaterial({
    color: new THREE.Color(trailColor),
    size: 0.04,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const trail = new THREE.Points(trailGeo, trailMat);
  trail.name = 'trail';
  group.add(trail);

  const update = (progress: number) => {
    // Lerp projectile position
    const pos = startPos.clone().lerp(surfacePos, progress);
    projectile.position.copy(pos);

    // Orient cone downward toward surface
    const dir = surfacePos.clone().sub(pos).normalize();
    const up = new THREE.Vector3(0, -1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    projectile.quaternion.copy(quat);

    // Scale glow as it approaches
    projMat.emissiveIntensity = 0.5 + progress * 2;

    // Trail
    const trailAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < trailCount; i++) {
      const t = Math.max(0, progress - i * 0.02);
      const tp = startPos.clone().lerp(surfacePos, t);
      // Add slight random jitter
      tp.x += (Math.random() - 0.5) * 0.03;
      tp.y += (Math.random() - 0.5) * 0.03;
      tp.z += (Math.random() - 0.5) * 0.03;
      trailAttr.setXYZ(i, tp.x, tp.y, tp.z);
    }
    trailAttr.needsUpdate = true;
    trailMat.opacity = Math.max(0, 0.7 - progress * 0.3);
  };

  const dispose = () => {
    projGeo.dispose();
    projMat.dispose();
    trailGeo.dispose();
    trailMat.dispose();
  };

  return { group, update, dispose };
}

// ---------------------------------------------------------------------------
// Utility: Dispose all geometries and materials in a group
// ---------------------------------------------------------------------------

export function disposePieceGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      // Don't dispose cached geometries
      if (!geometryCache.has(obj.geometry?.type ?? '')) {
        obj.geometry?.dispose();
      }
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      } else if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      }
    }
    if (obj instanceof THREE.Sprite) {
      (obj.material as THREE.SpriteMaterial).map?.dispose();
      obj.material.dispose();
    }
    if (obj instanceof THREE.Points) {
      obj.geometry?.dispose();
      (obj.material as THREE.Material).dispose();
    }
    if (obj instanceof THREE.LineLoop || obj instanceof THREE.Line) {
      obj.geometry?.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}

// ---------------------------------------------------------------------------
// Cell state application helper
// ---------------------------------------------------------------------------

/**
 * Apply CellGameState to a cell's mesh and border.
 * Updates color, opacity (fog), and highlight state.
 */
export function applyCellState(
  cellMesh: THREE.Mesh,
  cellBorder: THREE.LineLoop | null,
  state: CellGameState,
  config?: {
    fogDimOpacity?: number;
    fogHiddenOpacity?: number;
    fogExploredOpacity?: number;
  },
): void {
  const mat = cellMesh.material as THREE.MeshStandardMaterial;

  // Owner color
  if (state.ownerColor) {
    const intensity = state.ownerColorIntensity ?? 0.7;
    const baseColor = mat.color.clone();
    const ownerColor = new THREE.Color(state.ownerColor);
    mat.color.lerpColors(baseColor, ownerColor, intensity);
  }

  // Terrain color override
  if (state.terrainColor) {
    mat.color.set(state.terrainColor);
  }

  // Fog of war
  switch (state.fogLevel) {
    case 'hidden':
      mat.opacity = config?.fogHiddenOpacity ?? 0.15;
      mat.transparent = true;
      break;
    case 'dim':
      mat.opacity = config?.fogDimOpacity ?? 0.4;
      mat.transparent = true;
      break;
    case 'explored':
      mat.opacity = config?.fogExploredOpacity ?? 0.65;
      mat.transparent = true;
      break;
    case 'visible':
    default:
      mat.opacity = 1.0;
      mat.transparent = false;
      break;
  }

  // Border color from state
  if (cellBorder && state.border) {
    const borderMat = cellBorder.material as THREE.LineBasicMaterial;
    borderMat.color.set(state.border.color);
    if (state.border.emissive) {
      // Swap to emissive-capable material would be needed; for line we just brighten
      borderMat.color.offsetHSL(0, 0, 0.3);
    }
  }

  // Elevation
  if (state.elevation && state.elevation > 0) {
    const normal = cellMesh.position.clone().normalize();
    cellMesh.position.copy(normal.multiplyScalar(cellMesh.position.length() + state.elevation));
  }
}
