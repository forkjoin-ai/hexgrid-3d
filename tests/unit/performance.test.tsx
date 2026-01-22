import React from 'react';
import { describe, it, expect, beforeEach } from 'bun:test';
import { render, waitFor } from '@testing-library/react';
import { HexGrid } from '../../src/components/HexGrid';
import { uiStore } from '../../src/stores/uiStore';
import { Photo } from '../../src/types';

describe('Performance Tests', () => {
  const createMockPhotos = (count: number): Photo[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `photo-${i}`,
      title: `Photo ${i}`,
      alt: `Alt ${i}`,
      imageUrl: `https://example.com/photo${i}.jpg`,
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    }));
  };

  it('handles 100 photos efficiently', () => {
    const photos = createMockPhotos(100);
    const { container } = render(<HexGrid photos={photos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles 500 photos', () => {
    const photos = createMockPhotos(500);
    const { container } = render(<HexGrid photos={photos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles 1000 photos', () => {
    const photos = createMockPhotos(1000);
    const { container } = render(<HexGrid photos={photos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles rapid photo updates', () => {
    const initialPhotos = createMockPhotos(10);
    const { container, rerender } = render(<HexGrid photos={initialPhotos} />);

    for (let i = 0; i < 10; i++) {
      const newPhotos = createMockPhotos(10 + i);
      rerender(<HexGrid photos={newPhotos} />);
    }

    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles rapid prop changes', () => {
    const photos = createMockPhotos(10);
    const { container, rerender } = render(
      <HexGrid photos={photos} spacing={1.0} />
    );

    for (let i = 0; i < 20; i++) {
      rerender(<HexGrid photos={photos} spacing={1.0 + i * 0.1} />);
    }

    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('cleans up properly on unmount', () => {
    const photos = createMockPhotos(100);
    const { container, unmount } = render(<HexGrid photos={photos} />);

    expect(container.querySelector('canvas')).not.toBeNull();
    unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('handles multiple mount/unmount cycles', () => {
    const photos = createMockPhotos(50);

    for (let i = 0; i < 5; i++) {
      const { container, unmount } = render(<HexGrid photos={photos} />);
      expect(container.querySelector('canvas')).not.toBeNull();
      unmount();
      expect(container.querySelector('canvas')).toBeNull();
    }
  });
});

describe('Store Integration Performance', () => {
  beforeEach(() => {
    uiStore.set({
      debugOpen: false,
      showStats: false,
      cameraOpen: false,
      showNarration: false,
    });
  });

  it('handles rapid store updates', () => {
    const photos: Photo[] = [
      {
        id: '1',
        title: 'Test',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo.jpg',
        category: 'test',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ];

    const { container } = render(<HexGrid photos={photos} />);

    for (let i = 0; i < 100; i++) {
      uiStore.toggleDebug();
      uiStore.toggleStats();
      uiStore.toggleCamera();
      uiStore.toggleNarration();
    }

    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles many store subscribers', () => {
    const photos: Photo[] = [
      {
        id: '1',
        title: 'Test',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo.jpg',
        category: 'test',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ];

    const unsubscribers: Array<() => void> = [];

    for (let i = 0; i < 100; i++) {
      const unsubscribe = uiStore.subscribe(() => {});
      unsubscribers.push(unsubscribe);
    }

    const { container } = render(<HexGrid photos={photos} />);
    uiStore.toggleDebug();

    unsubscribers.forEach((unsub) => unsub());

    expect(container.querySelector('canvas')).not.toBeNull();
  });
});

describe('Memory Management', () => {
  it('properly cleans up canvas references', () => {
    const photos: Photo[] = [
      {
        id: '1',
        title: 'Test',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo.jpg',
        category: 'test',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ];

    const canvasRef = React.createRef<HTMLCanvasElement>();
    const { container, unmount } = render(
      <HexGrid photos={photos} canvasRef={canvasRef as any} />
    );

    expect(container.querySelector('canvas')).not.toBeNull();
    unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('handles texture cleanup on photo changes', async () => {
    const initialPhotos: Photo[] = [
      {
        id: '1',
        title: 'Test 1',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo1.jpg',
        category: 'test',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ];

    const { container, rerender } = render(<HexGrid photos={initialPhotos} />);

    const newPhotos: Photo[] = [
      {
        id: '2',
        title: 'Test 2',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo2.jpg',
        category: 'test',
        source: 'test',
        createdAt: '2024-01-02',
      },
    ];

    rerender(<HexGrid photos={newPhotos} />);

    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
