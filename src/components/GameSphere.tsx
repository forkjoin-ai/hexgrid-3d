/**
 * GameSphere — Full Three.js 3D board game renderer on a geodesic sphere.
 *
 * Renders hex/pentagon cells as colored polygons on a sphere mesh, places
 * literal 3D game pieces (primitives, custom Object3D, GLTF models) on cells,
 * handles fog of war, highlights, raycasting for click/hover, orbit camera,
 * and piece animations. This is THE platform for any board game on a sphere.
 */
import React, { useRef, useEffect, useCallback, useMemo } from '@a0n/raect';
import * as THREE from '@a0n/aeon-3d/three';
import type {
  GameSphereProps,
  GameSphereConfig,
  CellHighlight,
} from '../types';
import { GeodesicHexGrid } from '../math/HexCoordinates';
import { Vector3 } from '../math/Vector3';
import {
  buildPieceMesh,
  placePieceOnSphere,
  animatePiece,
  buildCellMesh,
  buildCellBorder,
  buildHighlightRing,
  applyCellState,
  disposePieceGroup,
} from './GamePieceRenderer';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<GameSphereConfig> = {
  subdivisions: 3,
  sphereRadius: 5,
  cameraDistance: 12,
  cameraFov: 50,
  enableOrbitControls: true,
  autoRotate: false,
  autoRotateSpeed: 0.5,
  ambientLightIntensity: 0.4,
  directionalLightIntensity: 0.8,
  directionalLightPosition: [5, 10, 7],
  hexBaseColor: '#1a1a2e',
  hexBorderColor: '#333355',
  hexBorderWidth: 0.02,
  pentagonBaseColor: '#2a1a3e',
  pentagonBorderColor: '#553377',
  fogDimColor: 'rgba(0,0,0,0.5)',
  fogHiddenColor: 'rgba(0,0,0,0.85)',
  fogExploredColor: 'rgba(0,0,0,0.3)',
  defaultPieceScale: 0.3,
  defaultPieceColor: '#ffffff',
  enableRaycasting: true,
  enableDragDrop: false,
  hoverHighlightColor: '#ffffff33',
  enableBloom: false,
  enableShadows: false,
  enableAntialias: true,
  enableInstancing: true,
  maxVisiblePieces: 500,
  pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
};

// ---------------------------------------------------------------------------
// Highlight color map
// ---------------------------------------------------------------------------

const HIGHLIGHT_COLORS: Record<string, string> = {
  selected: '#00ffff',
  hover: '#ffffff',
  'attack-target': '#ff4444',
  'move-target': '#44ff44',
  'great-circle': '#ffaa00',
  path: '#8844ff',
  danger: '#ff0000',
  friendly: '#00ff88',
  contested: '#ff8800',
};

function getHighlightColor(highlight: CellHighlight): string {
  if (highlight === 'none') return '#000000';
  return HIGHLIGHT_COLORS[highlight] ?? highlight; // If it's a custom color string, use directly
}

// ---------------------------------------------------------------------------
// Simple orbit controls (no dependency on three/examples/jsm)
// ---------------------------------------------------------------------------

interface OrbitState {
  theta: number;   // Horizontal angle
  phi: number;     // Vertical angle
  distance: number;
  target: THREE.Vector3;
  isDragging: boolean;
  lastX: number;
  lastY: number;
  isPinching: boolean;
  lastPinchDist: number;
}

function createOrbitControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  initialDistance: number,
): {
  state: OrbitState;
  update: () => void;
  dispose: () => void;
} {
  const state: OrbitState = {
    theta: 0,
    phi: Math.PI / 3,
    distance: initialDistance,
    target: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    lastX: 0,
    lastY: 0,
    isPinching: false,
    lastPinchDist: 0,
  };

  const onMouseDown = (e: MouseEvent) => {
    state.isDragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!state.isDragging) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.theta -= dx * 0.005;
    state.phi = Math.max(0.1, Math.min(Math.PI - 0.1, state.phi - dy * 0.005));
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  };

  const onMouseUp = () => {
    state.isDragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    state.distance = Math.max(6, Math.min(30, state.distance + e.deltaY * 0.01));
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      state.isDragging = true;
      state.lastX = e.touches[0].clientX;
      state.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      state.isPinching = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      state.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && state.isDragging) {
      const dx = e.touches[0].clientX - state.lastX;
      const dy = e.touches[0].clientY - state.lastY;
      state.theta -= dx * 0.005;
      state.phi = Math.max(0.1, Math.min(Math.PI - 0.1, state.phi - dy * 0.005));
      state.lastX = e.touches[0].clientX;
      state.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2 && state.isPinching) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = state.lastPinchDist - dist;
      state.distance = Math.max(6, Math.min(30, state.distance + delta * 0.02));
      state.lastPinchDist = dist;
    }
  };

  const onTouchEnd = () => {
    state.isDragging = false;
    state.isPinching = false;
  };

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd);

  const update = () => {
    camera.position.set(
      state.distance * Math.sin(state.phi) * Math.cos(state.theta),
      state.distance * Math.cos(state.phi),
      state.distance * Math.sin(state.phi) * Math.sin(state.theta),
    );
    camera.lookAt(state.target);
  };

  const dispose = () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
  };

  return { state, update, dispose };
}

// ---------------------------------------------------------------------------
// Raycaster helpers
// ---------------------------------------------------------------------------

function getCellUnderMouse(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  cellMeshes: THREE.Mesh[],
): number | null {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(cellMeshes, false);
  if (intersects.length > 0) {
    return intersects[0].object.userData.cellIndex as number;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GameSphere Component
// ---------------------------------------------------------------------------

export const GameSphere: React.FC<GameSphereProps> = ({
  cellGameState,
  config: configProp,
  events,
  width = '100%',
  height = '100%',
  className,
  style,
  rendererRef,
  sceneRef,
  paused = false,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererInternalRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneInternalRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef<ReturnType<typeof createOrbitControls> | null>(null);
  const gridRef = useRef<GeodesicHexGrid | null>(null);
  const rafRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Mutable refs for cell/piece groups (avoid re-creating scene each frame)
  const cellGroupRef = useRef<THREE.Group>(new THREE.Group());
  const pieceGroupRef = useRef<THREE.Group>(new THREE.Group());
  const highlightGroupRef = useRef<THREE.Group>(new THREE.Group());
  const cellMeshesRef = useRef<THREE.Mesh[]>([]);
  const cellBordersRef = useRef<(THREE.LineLoop | null)[]>([]);
  const pieceMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const highlightMeshMapRef = useRef<Map<number, THREE.Mesh>>(new Map());

  // Hover state
  const hoveredCellRef = useRef<number | null>(null);

  const config = useMemo<Required<GameSphereConfig>>(() => {
    return { ...DEFAULT_CONFIG, ...configProp };
  }, [configProp]);

  // -----------------------------------------------------------------------
  // Initialize Three.js scene
  // -----------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: config.enableAntialias,
      alpha: true,
    });
    renderer.setPixelRatio(config.pixelRatio);
    renderer.setClearColor(0x000000, 0);
    if (config.enableShadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    rendererInternalRef.current = renderer;
    if (rendererRef) {
      (rendererRef as React.MutableRefObject<unknown>).current = renderer;
    }

    // Scene
    const scene = new THREE.Scene();
    sceneInternalRef.current = scene;
    if (sceneRef) {
      (sceneRef as React.MutableRefObject<unknown>).current = scene;
    }

    // Camera
    const camera = new THREE.PerspectiveCamera(
      config.cameraFov,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, config.ambientLightIntensity);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, config.directionalLightIntensity);
    const [lx, ly, lz] = config.directionalLightPosition;
    dirLight.position.set(lx, ly, lz);
    if (config.enableShadows) {
      dirLight.castShadow = true;
    }
    scene.add(dirLight);

    // Add a subtle hemisphere light for more natural illumination
    const hemiLight = new THREE.HemisphereLight(0x8888cc, 0x222233, 0.3);
    scene.add(hemiLight);

    // Groups
    cellGroupRef.current = new THREE.Group();
    cellGroupRef.current.name = 'cells';
    scene.add(cellGroupRef.current);

    pieceGroupRef.current = new THREE.Group();
    pieceGroupRef.current.name = 'pieces';
    scene.add(pieceGroupRef.current);

    highlightGroupRef.current = new THREE.Group();
    highlightGroupRef.current.name = 'highlights';
    scene.add(highlightGroupRef.current);

    // Orbit controls
    if (config.enableOrbitControls) {
      orbitRef.current = createOrbitControls(camera, canvas, config.cameraDistance);
    } else {
      camera.position.set(0, 0, config.cameraDistance);
      camera.lookAt(0, 0, 0);
    }

    // Generate geodesic grid
    const grid = new GeodesicHexGrid(config.subdivisions);
    gridRef.current = grid;

    // Build cell meshes
    buildAllCells(grid, config);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      orbitRef.current?.dispose();
      renderer.dispose();
      // Clean up scene
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        }
      });
      cancelAnimationFrame(rafRef.current);
    };
  }, [config.subdivisions, config.sphereRadius]); // Re-init only on structural changes

  // -----------------------------------------------------------------------
  // Build all cell meshes from geodesic grid
  // -----------------------------------------------------------------------
  const buildAllCells = useCallback(
    (grid: GeodesicHexGrid, cfg: Required<GameSphereConfig>) => {
      const cellGroup = cellGroupRef.current;

      // Clear existing
      while (cellGroup.children.length > 0) {
        cellGroup.remove(cellGroup.children[0]);
      }
      cellMeshesRef.current = [];
      cellBordersRef.current = [];

      for (let i = 0; i < grid.hexCenters.length; i++) {
        const center = grid.hexCenters[i];
        const isPentagon = grid.isPentagon(i);
        const sides = grid.getHexSides(i);

        // Generate vertex positions for this cell
        const cellVertices = generateCellVertices(center, grid, i, sides);

        const baseColor = isPentagon ? cfg.pentagonBaseColor : cfg.hexBaseColor;
        const borderColor = isPentagon ? cfg.pentagonBorderColor : cfg.hexBorderColor;

        // Cell face
        const face = buildCellMesh(center, cellVertices, cfg.sphereRadius, baseColor);
        face.userData.cellIndex = i;
        face.userData.isPentagon = isPentagon;
        face.userData.baseColor = baseColor;
        cellGroup.add(face);
        cellMeshesRef.current.push(face);

        // Cell border
        const border = buildCellBorder(cellVertices, cfg.sphereRadius, borderColor);
        border.userData.cellIndex = i;
        cellGroup.add(border);
        cellBordersRef.current.push(border);
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Generate cell vertices (approximate hex/pentagon shape on sphere)
  // -----------------------------------------------------------------------
  function generateCellVertices(
    center: Vector3,
    grid: GeodesicHexGrid,
    cellIndex: number,
    sides: number,
  ): Vector3[] {
    const neighbors = grid.neighbors[cellIndex] || [];
    const normal = new THREE.Vector3(center.x, center.y, center.z).normalize();

    // If we have enough neighbors, compute vertices from neighbor midpoints
    if (neighbors.length >= sides) {
      const midpoints: Vector3[] = [];
      for (let j = 0; j < Math.min(neighbors.length, sides); j++) {
        const n = grid.hexCenters[neighbors[j]];
        midpoints.push(
          new Vector3(
            (center.x + n.x) / 2,
            (center.y + n.y) / 2,
            (center.z + n.z) / 2,
          ),
        );
      }

      // Sort midpoints by angle around the normal for consistent winding
      const tangent = new THREE.Vector3(0, 1, 0);
      if (Math.abs(normal.dot(tangent)) > 0.99) {
        tangent.set(1, 0, 0);
      }
      const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
      const realTangent = new THREE.Vector3().crossVectors(bitangent, normal).normalize();

      midpoints.sort((a, b) => {
        const aProj = new THREE.Vector3(a.x - center.x, a.y - center.y, a.z - center.z);
        const bProj = new THREE.Vector3(b.x - center.x, b.y - center.y, b.z - center.z);
        const aAngle = Math.atan2(aProj.dot(bitangent), aProj.dot(realTangent));
        const bAngle = Math.atan2(bProj.dot(bitangent), bProj.dot(realTangent));
        return aAngle - bAngle;
      });

      return midpoints;
    }

    // Fallback: generate regular polygon vertices
    const radius = 0.15; // Approximate hex radius on unit sphere
    const vertices: Vector3[] = [];

    const tangent = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(tangent)) > 0.99) {
      tangent.set(1, 0, 0);
    }
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const realTangent = new THREE.Vector3().crossVectors(bitangent, normal).normalize();

    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * radius * realTangent.x + Math.sin(angle) * radius * bitangent.x;
      const y = center.y + Math.cos(angle) * radius * realTangent.y + Math.sin(angle) * radius * bitangent.y;
      const z = center.z + Math.cos(angle) * radius * realTangent.z + Math.sin(angle) * radius * bitangent.z;
      vertices.push(new Vector3(x, y, z));
    }

    return vertices;
  }

  // -----------------------------------------------------------------------
  // Apply cell game state
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!cellGameState || cellMeshesRef.current.length === 0) return;

    const cellMeshes = cellMeshesRef.current;
    const cellBorders = cellBordersRef.current;
    const pieceGroup = pieceGroupRef.current;
    const highlightGroup = highlightGroupRef.current;
    const grid = gridRef.current;
    if (!grid) return;

    // Track which pieces are still active
    const activePieceIds = new Set<string>();

    // Track which cells have highlights
    const activeHighlightCells = new Set<number>();

    for (const [cellIndex, state] of cellGameState) {
      if (cellIndex >= cellMeshes.length) continue;

      const cellMesh = cellMeshes[cellIndex];
      const cellBorder = cellBorders[cellIndex] ?? null;

      // Reset cell to base color first
      const baseColor = cellMesh.userData.baseColor as string;
      (cellMesh.material as THREE.MeshStandardMaterial).color.set(baseColor);
      (cellMesh.material as THREE.MeshStandardMaterial).opacity = 1;
      (cellMesh.material as THREE.MeshStandardMaterial).transparent = false;

      // Apply state (owner color, fog, border, elevation)
      applyCellState(cellMesh, cellBorder, state, {
        fogDimOpacity: 0.4,
        fogHiddenOpacity: 0.15,
        fogExploredOpacity: 0.65,
      });

      // --- Highlights ---
      if (state.highlight && state.highlight !== 'none') {
        activeHighlightCells.add(cellIndex);
        const hlColor = state.highlightColor ?? getHighlightColor(state.highlight);
        const hlIntensity = state.highlightIntensity ?? 0.8;

        if (!highlightMeshMapRef.current.has(cellIndex)) {
          const center = grid.hexCenters[cellIndex];
          const ring = buildHighlightRing(
            center,
            config.sphereRadius,
            0.12,
            hlColor,
            hlIntensity,
          );
          ring.userData.cellIndex = cellIndex;
          highlightGroup.add(ring);
          highlightMeshMapRef.current.set(cellIndex, ring);
        } else {
          // Update existing highlight
          const ring = highlightMeshMapRef.current.get(cellIndex)!;
          (ring.material as THREE.MeshBasicMaterial).color.set(hlColor);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 * hlIntensity;
        }
      }

      // --- Game pieces ---
      if (state.pieces) {
        for (const piece of state.pieces) {
          activePieceIds.add(piece.id);

          if (!pieceMeshMapRef.current.has(piece.id)) {
            // Build new piece
            const meshGroup = buildPieceMesh(piece);
            const center = grid.hexCenters[cellIndex];
            const defaultScale = config.defaultPieceScale;
            if (!piece.scale) {
              meshGroup.scale.setScalar(defaultScale);
            }
            placePieceOnSphere(
              meshGroup,
              center,
              config.sphereRadius,
              piece.offsetY ?? 0.05,
            );
            pieceGroup.add(meshGroup);
            pieceMeshMapRef.current.set(piece.id, meshGroup);
          } else {
            // Update existing piece position (cell may have changed)
            const meshGroup = pieceMeshMapRef.current.get(piece.id)!;
            const center = grid.hexCenters[cellIndex];
            placePieceOnSphere(
              meshGroup,
              center,
              config.sphereRadius,
              piece.offsetY ?? 0.05,
            );

            // Update count badge if count changed
            const existingBadge = meshGroup.getObjectByName('count-badge');
            if (piece.count && piece.count > 1) {
              if (existingBadge) {
                meshGroup.remove(existingBadge);
              }
              // Rebuild badge
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d')!;
              canvas.width = 128;
              canvas.height = 128;
              ctx.beginPath();
              ctx.arc(64, 64, 50, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.fill();
              ctx.strokeStyle = piece.color ?? '#ffffff';
              ctx.lineWidth = 4;
              ctx.stroke();
              ctx.font = 'bold 56px Consolas, "Courier New", monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = piece.color ?? '#ffffff';
              ctx.fillText(String(piece.count), 64, 64);
              const texture = new THREE.CanvasTexture(canvas);
              const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false,
              });
              const badge = new THREE.Sprite(spriteMat);
              badge.scale.set(0.5, 0.5, 1);
              badge.position.y = 0.6;
              badge.name = 'count-badge';
              meshGroup.add(badge);
            }
          }
        }
      }
    }

    // Remove pieces no longer in state
    for (const [pieceId, meshGroup] of pieceMeshMapRef.current) {
      if (!activePieceIds.has(pieceId)) {
        pieceGroup.remove(meshGroup);
        disposePieceGroup(meshGroup);
        pieceMeshMapRef.current.delete(pieceId);
      }
    }

    // Remove highlights no longer active
    for (const [cellIndex, ring] of highlightMeshMapRef.current) {
      if (!activeHighlightCells.has(cellIndex)) {
        highlightGroup.remove(ring);
        ring.geometry?.dispose();
        (ring.material as THREE.Material).dispose();
        highlightMeshMapRef.current.delete(cellIndex);
      }
    }

    // Reset cells not in game state to base appearance
    for (let i = 0; i < cellMeshes.length; i++) {
      if (!cellGameState.has(i)) {
        const mat = cellMeshes[i].material as THREE.MeshStandardMaterial;
        mat.color.set(cellMeshes[i].userData.baseColor as string);
        mat.opacity = 1;
        mat.transparent = false;
      }
    }
  }, [cellGameState, config.sphereRadius, config.defaultPieceScale]);

  // -----------------------------------------------------------------------
  // Mouse interaction (raycasting)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera || !config.enableRaycasting) return;

    const handleClick = (e: MouseEvent) => {
      const cellIndex = getCellUnderMouse(e, canvas, camera, cellMeshesRef.current);
      if (cellIndex !== null && events?.onCellClick) {
        events.onCellClick(cellIndex, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey });
      }

      // Check piece clicks
      if (cellIndex !== null && events?.onPieceClick && cellGameState) {
        const state = cellGameState.get(cellIndex);
        if (state?.pieces?.length) {
          events.onPieceClick(cellIndex, state.pieces[0]);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!events?.onCellHover) return;
      const cellIndex = getCellUnderMouse(e, canvas, camera, cellMeshesRef.current);
      if (cellIndex !== hoveredCellRef.current) {
        hoveredCellRef.current = cellIndex;
        events.onCellHover(cellIndex);
      }
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [events, cellGameState, config.enableRaycasting]);

  // -----------------------------------------------------------------------
  // Render loop
  // -----------------------------------------------------------------------
  useEffect(() => {
    const renderer = rendererInternalRef.current;
    const scene = sceneInternalRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      if (paused) return;

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // Update orbit controls
      if (orbitRef.current) {
        if (config.autoRotate && !orbitRef.current.state.isDragging) {
          orbitRef.current.state.theta += config.autoRotateSpeed * 0.001;
        }
        orbitRef.current.update();
      }

      // Animate pieces
      for (const [, meshGroup] of pieceMeshMapRef.current) {
        animatePiece(meshGroup, elapsed, delta);
      }

      // Pulse highlight rings
      for (const [, ring] of highlightMeshMapRef.current) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.4 + Math.sin(elapsed * 3) * 0.2;
      }

      // Camera change callback
      if (events?.onCameraChange && camera) {
        events.onCameraChange(
          [camera.position.x, camera.position.y, camera.position.z],
          [0, 0, 0],
        );
      }

      // Frame callback
      events?.onFrame?.(delta);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused, config.autoRotate, config.autoRotateSpeed, events]);

  // -----------------------------------------------------------------------
  // Public API via ref
  // -----------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        overflow: 'hidden',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none', // Prevent browser gesture interference
        }}
      />
      {children && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>{children}</div>
        </div>
      )}
    </div>
  );
};

// Re-export GeodesicHexGrid for game consumers
export { GeodesicHexGrid } from '../math/HexCoordinates';
