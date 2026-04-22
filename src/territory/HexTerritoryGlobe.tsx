/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef } from '@a0n/raect';
import type { ThreeEvent } from '@a0n/aeon-3d/fiber';
import {
  Color,
  CircleGeometry,
  InstancedMesh,
  Matrix4,
  Object3D,
} from '@a0n/aeon-3d/three';
import {
  calculateAutoTileRadiusByRow,
  type HexTerritoryAffiliation,
  type HexTerritoryAllianceBinding,
  type HexTerritoryCell,
  type HexTerritoryRallyMarker,
} from './globe';

export interface HexTerritoryGlobeProps {
  cells: HexTerritoryCell[];
  selectedCellId?: string | null;
  hoverCellId?: string | null;
  claimedCellIds?: Iterable<string>;
  lockedCellIds?: Iterable<string>;
  colorsByCellId?: Record<string, string>;
  affiliationByCellId?: Record<string, HexTerritoryAffiliation>;
  allianceBindings?: HexTerritoryAllianceBinding[];
  rallyMarkers?: HexTerritoryRallyMarker[];
  tileRadius?: number;
  onSelectCell?: (cell: HexTerritoryCell) => void;
  onHoverCell?: (cell: HexTerritoryCell | null) => void;
}

function asSet(values: Iterable<string> | undefined): Set<string> {
  return values ? new Set(values) : new Set<string>();
}

export function HexTerritoryGlobe({
  cells,
  selectedCellId = null,
  hoverCellId = null,
  claimedCellIds,
  lockedCellIds,
  colorsByCellId,
  affiliationByCellId,
  allianceBindings,
  rallyMarkers,
  tileRadius,
  onSelectCell,
  onHoverCell,
}: HexTerritoryGlobeProps): React.JSX.Element {
  const meshRef = useRef<InstancedMesh | null>(null);
  const geometry = useMemo(() => new CircleGeometry(1, 6), []);
  const workingObject = useMemo(() => new Object3D(), []);
  const claimed = useMemo(() => asSet(claimedCellIds), [claimedCellIds]);
  const locked = useMemo(() => asSet(lockedCellIds), [lockedCellIds]);
  const cellById = useMemo(
    () => new Map(cells.map((cell) => [cell.cellId, cell])),
    [cells]
  );
  const autoTileRadiusByRow = useMemo(
    () =>
      tileRadius === undefined ? calculateAutoTileRadiusByRow(cells) : undefined,
    [cells, tileRadius]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const matrix = new Matrix4();

    cells.forEach((cell, index) => {
      const point = cell.surfacePoint;
      const effectiveTileRadius =
        tileRadius ?? autoTileRadiusByRow?.get(cell.rowIndex) ?? 0;
      workingObject.position.set(point.x, point.y, point.z);
      workingObject.lookAt(point.x * 2, point.y * 2, point.z * 2);
      workingObject.scale.setScalar(effectiveTileRadius);
      workingObject.updateMatrix();
      matrix.copy(workingObject.matrix);
      mesh.setMatrixAt(index, matrix);

      const affiliation = affiliationByCellId?.[cell.cellId] ?? 'neutral';
      const baseColor = locked.has(cell.cellId)
        ? '#23345c'
        : colorsByCellId?.[cell.cellId] ??
          (selectedCellId === cell.cellId
            ? '#7ee7ff'
            : hoverCellId === cell.cellId
              ? '#59d0ff'
              : affiliation === 'self'
                ? '#7ee7ff'
                : affiliation === 'ally'
                  ? '#63f2c6'
                  : affiliation === 'hostile'
                    ? '#ff9675'
              : claimed.has(cell.cellId)
                ? '#63f2c6'
                : '#1f2a4a');
      mesh.setColorAt(index, new Color(baseColor));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [
    cells,
    claimed,
    colorsByCellId,
    affiliationByCellId,
    hoverCellId,
    locked,
    selectedCellId,
    tileRadius,
    autoTileRadiusByRow,
    workingObject,
  ]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, undefined, cells.length] as const}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (typeof event.instanceId !== 'number') {
            return;
          }
          const cell = cells[event.instanceId];
          if (cell) {
            onSelectCell?.(cell);
          }
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          if (typeof event.instanceId !== 'number') {
            onHoverCell?.(null);
            return;
          }
          const cell = cells[event.instanceId];
          onHoverCell?.(cell ?? null);
        }}
        onPointerOut={() => {
          onHoverCell?.(null);
        }}
      >
        <meshStandardMaterial
          transparent
          opacity={0.92}
          metalness={0.14}
          roughness={0.42}
        />
      </instancedMesh>
      {(rallyMarkers ?? []).map((marker) => {
        const cell = cellById.get(marker.cellId);
        if (!cell) {
          return null;
        }
        const intensity = Math.max(0.35, Math.min(marker.intensity ?? 1, 2));
        const scale = 0.028 * intensity;
        const point = cell.surfacePoint;
        return (
          <mesh
            key={`${marker.cellId}:${marker.directive}`}
            position={[point.x * 1.015, point.y * 1.015, point.z * 1.015]}
          >
            <sphereGeometry args={[scale, 10, 10] as const} />
            <meshBasicMaterial
              color={
                marker.directive === 'surge'
                  ? '#ffc857'
                  : marker.directive === 'fortify'
                    ? '#7ee7ff'
                    : marker.directive === 'support'
                      ? '#63f2c6'
                      : '#c9d4ff'
              }
            />
          </mesh>
        );
      })}
      {(allianceBindings ?? []).flatMap((binding) =>
        binding.rootCellIds.map((cellId) => {
          const cell = cellById.get(cellId);
          if (!cell) {
            return null;
          }
          const point = cell.surfacePoint;
          return (
            <mesh
              key={`${binding.phyleId}:${cellId}:halo`}
              position={[point.x * 1.005, point.y * 1.005, point.z * 1.005]}
            >
              <sphereGeometry args={[0.018, 8, 8] as const} />
              <meshBasicMaterial color="#7ee7ff" transparent opacity={0.75} />
            </mesh>
          );
        })
      )}
    </>
  );
}
