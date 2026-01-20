import type { CSSProperties } from 'react';
import React from 'react';

export interface Photo {
  id: string;
  title: string;
  alt: string;
  imageUrl: string;
  thumbnailUrl: string;
  category: string;
  description: string;
  source: string;
  createdAt: string;
  velocity: number;
  sourceUrl: string;
  likes: number;
  age_in_hours: number;
}

export interface HexGridProps {
  photos?: Photo[];
  className?: string;
  style?: CSSProperties;
  onPhotoClick?: (photo: Photo) => void;
}

export function HexGrid(_props: HexGridProps): JSX.Element | null {
  return null;
}

export default HexGrid;
