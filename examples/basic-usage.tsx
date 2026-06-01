import React, { useState } from 'react';
import { HexGrid } from '@buley/hexgrid-3d';
import type { Photo } from '@buley/hexgrid-3d';

/**
 * Example usage of the HexGrid visualization component
 */
export default function HexGridExample() {
  const [photos, setPhotos] = useState<Photo[]>([
    {
      id: '1',
      imageUrl: 'https://example.com/photo1.jpg',
      url: 'https://example.com/photo1.jpg',
      thumbnailUrl: 'https://example.com/photo1_thumb.jpg',
      title: 'Example Photo 1',
      alt: 'Example Photo 1',
      category: 'example',
      description: 'First example photo',
      source: 'example',
      createdAt: new Date().toISOString(),
      userId: 'user123',
    },
    {
      id: '2',
      imageUrl: 'https://example.com/photo2.jpg',
      url: 'https://example.com/photo2.jpg',
      thumbnailUrl: 'https://example.com/photo2_thumb.jpg',
      title: 'Example Photo 2',
      alt: 'Example Photo 2',
      category: 'example',
      description: 'Second example photo',
      source: 'example',
      createdAt: new Date().toISOString(),
      userId: 'user123',
    },
  ]);

  const handleHexClick = (photo: Photo) => {
    console.log('Clicked photo:', photo);
    // Handle photo click - open modal, navigate, etc.
  };

  const handleLeaderboardUpdate = (leaderboard: any) => {
    console.log('Leaderboard updated:', leaderboard);
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <HexGrid photos={photos} onPhotoClick={handleHexClick} />
    </div>
  );
}
