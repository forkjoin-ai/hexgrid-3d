export { HexGrid, default } from './HexGrid';
export type { Photo } from './HexGrid';
export type { HexGridProps } from '../types';

// Game piece rendering system
export { GameSphere } from './GameSphere';
export {
  buildPieceMesh,
  placePieceOnSphere,
  animatePiece,
  buildCellMesh,
  buildCellBorder,
  buildHighlightRing,
  buildFogOverlay,
  buildAttackTrail,
  buildOrbitalStrike,
  disposePieceGroup,
  applyCellState,
} from './GamePieceRenderer';
export type { AttackAnimationConfig, OrbitalStrikeConfig } from './GamePieceRenderer';

// Re-export game types
export type {
  GamePiece,
  PieceShape,
  PieceAnimation,
  PieceAnimationConfig,
  CellGameState,
  CellHighlight,
  CellBorder,
  FogLevel,
  GameSphereProps,
  GameSphereConfig,
  GameSphereEvents,
} from '../types';

export { HexTerritoryGlobe } from '../territory/HexTerritoryGlobe';
