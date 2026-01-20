import type { Axial } from './math/HexCoordinates';
import type { Vector2 } from './math/Vector3';

export interface EnhancedHexCell {
  index: number;
  axial: Axial;
  position: Vector2;
  owner: number;
  population: number;
  infection: number;
  infectedBy: number;
}

export interface EnhancedHexGridEngine {
  cells?: EnhancedHexCell[];
}
