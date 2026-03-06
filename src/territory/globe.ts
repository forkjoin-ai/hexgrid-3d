export interface CanonicalHexGlobeConfig {
  boardId: string;
  curveUDeg: number;
  curveVDeg: number;
  rowCount: number;
  equatorColumns: number;
  minimumColumnsPerRow: number;
  poleMinScale: number;
  sphereRadius?: number;
}

export type HexSubdivisionSegment = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type HexNodePath = HexSubdivisionSegment[];

export type HexwarEmbedProvider =
  | 'youtube'
  | 'x'
  | 'instagram'
  | 'threads'
  | 'tiktok';

export interface HexwarEmbedRef {
  provider: HexwarEmbedProvider;
  submittedUrl: string;
  canonicalUrl: string;
  kind: 'video' | 'post' | 'thread' | 'short' | 'reel';
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
  embedAllowed: boolean;
}

export interface HexTerritoryTickState {
  stage: 'dormant' | 'active' | 'surging' | 'entrenched' | 'fading';
  energy: number;
  pressure: number;
  cohesion: number;
  lastResolvedAt: number;
}

export interface HexTerritoryCellPoint {
  x: number;
  y: number;
  z: number;
}

export interface HexTerritoryCell {
  cellId: string;
  rowIndex: number;
  columnIndex: number;
  columnCount: number;
  lat: number;
  lon: number;
  surfacePoint: HexTerritoryCellPoint;
  neighborCellIds: string[];
}

export interface HexTerritoryBoard {
  boardId: string;
  config: CanonicalHexGlobeConfig;
  configHash: string;
  cells: HexTerritoryCell[];
}

const boardCache = new Map<string, HexTerritoryBoard>();
const HEX_HORIZONTAL_RADIUS_RATIO = Math.sqrt(3);
const HEX_VERTICAL_RADIUS_RATIO = 1.5;
const TERRITORY_TILE_RADIUS_SAFETY_MARGIN = 0.96;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normalizeLongitude(value: number): number {
  let next = value;
  while (next < -180) {
    next += 360;
  }
  while (next >= 180) {
    next -= 360;
  }
  return next;
}

function buildConfigHash(config: CanonicalHexGlobeConfig): string {
  return [
    config.boardId,
    config.curveUDeg,
    config.curveVDeg,
    config.rowCount,
    config.equatorColumns,
    config.minimumColumnsPerRow,
    config.poleMinScale,
    config.sphereRadius ?? 1,
  ].join(':');
}

function toSurfacePoint(
  lat: number,
  lon: number,
  sphereRadius: number
): HexTerritoryCellPoint {
  const latRadians = toRadians(lat);
  const lonRadians = toRadians(lon);
  const cosLat = Math.cos(latRadians);

  return {
    x: sphereRadius * cosLat * Math.cos(lonRadians),
    y: sphereRadius * Math.sin(latRadians),
    z: sphereRadius * cosLat * Math.sin(lonRadians),
  };
}

function shortestWrappedDistance(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return Math.min(delta, 360 - delta);
}

function pointDistance(
  left: HexTerritoryCellPoint,
  right: HexTerritoryCellPoint
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function columnCountForLatitude(
  latitude: number,
  config: CanonicalHexGlobeConfig
): number {
  const cosScale = Math.abs(Math.cos(toRadians(latitude)));
  const scaled = Math.max(config.poleMinScale, cosScale);
  return Math.max(
    config.minimumColumnsPerRow,
    Math.round(config.equatorColumns * scaled)
  );
}

function findClosestColumns(
  rowCells: HexTerritoryCell[],
  lon: number
): HexTerritoryCell[] {
  const ranked = rowCells
    .map((cell) => ({
      cell,
      distance: shortestWrappedDistance(cell.lon, lon),
    }))
    .sort((left, right) => left.distance - right.distance);

  return ranked.slice(0, Math.min(3, ranked.length)).map((item) => item.cell);
}

function buildNeighbors(
  cell: HexTerritoryCell,
  rows: HexTerritoryCell[][]
): string[] {
  const currentRow = rows[cell.rowIndex] ?? [];
  const neighborIds = new Set<string>();
  const sameRowCount = currentRow.length;

  if (sameRowCount > 1) {
    const left =
      currentRow[(cell.columnIndex - 1 + sameRowCount) % sameRowCount] ?? null;
    const right = currentRow[(cell.columnIndex + 1) % sameRowCount] ?? null;
    if (left) {
      neighborIds.add(left.cellId);
    }
    if (right) {
      neighborIds.add(right.cellId);
    }
  }

  const adjacentRows = [cell.rowIndex - 1, cell.rowIndex + 1];
  for (const rowIndex of adjacentRows) {
    const row = rows[rowIndex] ?? [];
    for (const adjacent of findClosestColumns(row, cell.lon)) {
      neighborIds.add(adjacent.cellId);
    }
  }

  return Array.from(neighborIds);
}

export function generateCanonicalHexGlobe(
  config: CanonicalHexGlobeConfig
): HexTerritoryBoard {
  const configHash = buildConfigHash(config);
  const cached = boardCache.get(configHash);
  if (cached) {
    return cached;
  }

  const sphereRadius = config.sphereRadius ?? 1;
  const rows: HexTerritoryCell[][] = [];

  for (let rowIndex = 0; rowIndex < config.rowCount; rowIndex += 1) {
    const latitudeProgress =
      config.rowCount <= 1 ? 0 : rowIndex / (config.rowCount - 1);
    const lat = -90 + latitudeProgress * 180;
    const columnCount = columnCountForLatitude(lat, config);
    const lonStep = 360 / columnCount;
    const lonOffset = rowIndex % 2 === 0 ? 0 : lonStep / 2;
    const rowCells: HexTerritoryCell[] = [];

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const lon = normalizeLongitude(
        -180 + lonOffset + columnIndex * lonStep + lonStep / 2
      );
      rowCells.push({
        cellId: `${config.boardId}:r${rowIndex}:c${columnIndex}`,
        rowIndex,
        columnIndex,
        columnCount,
        lat,
        lon,
        surfacePoint: toSurfacePoint(lat, lon, sphereRadius),
        neighborCellIds: [],
      });
    }

    rows.push(rowCells);
  }

  for (const row of rows) {
    for (const cell of row) {
      cell.neighborCellIds = buildNeighbors(cell, rows);
    }
  }

  const board: HexTerritoryBoard = {
    boardId: config.boardId,
    config,
    configHash,
    cells: rows.flat(),
  };
  boardCache.set(configHash, board);
  return board;
}

export function calculateAutoTileRadiusByRow(
  cells: readonly HexTerritoryCell[]
): Map<number, number> {
  const rowMap = new Map<number, HexTerritoryCell[]>();
  const cellById = new Map<string, HexTerritoryCell>();

  for (const cell of cells) {
    const row = rowMap.get(cell.rowIndex);
    if (row) {
      row.push(cell);
    } else {
      rowMap.set(cell.rowIndex, [cell]);
    }
    cellById.set(cell.cellId, cell);
  }

  const radiusByRow = new Map<number, number>();

  for (const [rowIndex, unsortedRow] of rowMap.entries()) {
    const row = [...unsortedRow].sort(
      (left, right) => left.columnIndex - right.columnIndex
    );
    let minimumSameRowDistance = Number.POSITIVE_INFINITY;
    let minimumAdjacentRowDistance = Number.POSITIVE_INFINITY;

    if (row.length > 1) {
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const current = row[columnIndex];
        const next = row[(columnIndex + 1) % row.length];
        if (current && next) {
          minimumSameRowDistance = Math.min(
            minimumSameRowDistance,
            pointDistance(current.surfacePoint, next.surfacePoint)
          );
        }
      }
    }

    for (const cell of row) {
      for (const neighborId of cell.neighborCellIds) {
        const neighbor = cellById.get(neighborId);
        if (!neighbor || Math.abs(neighbor.rowIndex - rowIndex) !== 1) {
          continue;
        }
        minimumAdjacentRowDistance = Math.min(
          minimumAdjacentRowDistance,
          pointDistance(cell.surfacePoint, neighbor.surfacePoint)
        );
      }
    }

    const horizontalRadius = Number.isFinite(minimumSameRowDistance)
      ? minimumSameRowDistance / HEX_HORIZONTAL_RADIUS_RATIO
      : Number.POSITIVE_INFINITY;
    const verticalRadius = Number.isFinite(minimumAdjacentRowDistance)
      ? minimumAdjacentRowDistance / HEX_VERTICAL_RADIUS_RATIO
      : Number.POSITIVE_INFINITY;
    const unconstrainedRadius = Math.min(horizontalRadius, verticalRadius);
    const safeRadius =
      Number.isFinite(unconstrainedRadius) && unconstrainedRadius > 0
        ? unconstrainedRadius * TERRITORY_TILE_RADIUS_SAFETY_MARGIN
        : 0;

    radiusByRow.set(rowIndex, safeRadius);
  }

  return radiusByRow;
}
