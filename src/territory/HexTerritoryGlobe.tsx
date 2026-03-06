import React, { useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, CircleGeometry, InstancedMesh, Matrix4, Object3D } from 'three';
import type { HexTerritoryCell } from './globe';

export interface HexTerritoryGlobeProps {
  cells: HexTerritoryCell[];
  selectedCellId?: string | null;
  hoverCellId?: string | null;
  claimedCellIds?: Iterable<string>;
  lockedCellIds?: Iterable<string>;
  colorsByCellId?: Record<string, string>;
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
  tileRadius = 0.022,
  onSelectCell,
  onHoverCell,
}: HexTerritoryGlobeProps): React.JSX.Element {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new CircleGeometry(tileRadius, 6), [tileRadius]);
  const workingObject = useMemo(() => new Object3D(), []);
  const claimed = useMemo(() => asSet(claimedCellIds), [claimedCellIds]);
  const locked = useMemo(() => asSet(lockedCellIds), [lockedCellIds]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const matrix = new Matrix4();

    cells.forEach((cell, index) => {
      const point = cell.surfacePoint;
      workingObject.position.set(point.x, point.y, point.z);
      workingObject.lookAt(point.x * 2, point.y * 2, point.z * 2);
      workingObject.updateMatrix();
      matrix.copy(workingObject.matrix);
      mesh.setMatrixAt(index, matrix);

      const baseColor = locked.has(cell.cellId)
        ? '#23345c'
        : colorsByCellId?.[cell.cellId] ??
          (selectedCellId === cell.cellId
            ? '#7ee7ff'
            : hoverCellId === cell.cellId
              ? '#59d0ff'
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
    hoverCellId,
    locked,
    selectedCellId,
    workingObject,
  ]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, cells.length]}
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
  );
}
