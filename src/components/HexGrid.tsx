import type { CSSProperties, RefObject } from 'react';
import React from 'react';
import type {
  Photo as PhotoType,
  HexGridProps as HexGridPropsType,
  HexGridFeatureFlags,
} from '../types';

export type Photo = PhotoType;

// Re-export the proper HexGridProps from types.ts
export type { HexGridProps } from '../types';

export function HexGrid(_props: HexGridPropsType): React.JSX.Element | null {
  return null;
}

export default HexGrid;
