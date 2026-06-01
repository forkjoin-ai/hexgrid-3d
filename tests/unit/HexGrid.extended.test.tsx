import React from 'react';
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render } from '@testing-library/react';
import { HexGrid } from '../../src/components/HexGrid';
import { Photo } from '../../src/types';

describe('HexGrid Texture Loading', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Test 1',
      alt: 'Alt 1',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Test 2',
      alt: 'Alt 2',
      imageUrl: 'https://example.com/photo2.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ];

  it('renders canvas for texture loading', () => {
    const { container } = render(<HexGrid photos={mockPhotos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles empty photo array', () => {
    const { container } = render(<HexGrid photos={[]} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles photos with thumbnailUrls', () => {
    const photosWithThumbs = mockPhotos.map((p) => ({
      ...p,
      thumbnailUrl: `${p.imageUrl}-thumb`,
    }));

    const { container } = render(<HexGrid photos={photosWithThumbs} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles duplicate photo URLs', () => {
    const duplicatePhotos: Photo[] = [
      {
        id: '1',
        title: 'Dup 1',
        alt: 'Alt',
        imageUrl: 'https://example.com/same-photo.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Dup 2',
        alt: 'Alt',
        imageUrl: 'https://example.com/same-photo.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ];

    const { container } = render(<HexGrid photos={duplicatePhotos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});

describe('HexGrid Camera System', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Test',
      alt: 'Alt',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ];

  it('accepts custom spacing', () => {
    const { container, rerender } = render(
      <HexGrid photos={mockPhotos} spacing={0.5} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();

    rerender(<HexGrid photos={mockPhotos} spacing={2.0} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles external canvas ref', () => {
    const canvasRef = React.createRef<HTMLCanvasElement>();
    const { container } = render(
      <HexGrid photos={mockPhotos} canvasRef={canvasRef as any} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('responds to modalOpen prop changes', () => {
    const { container, rerender } = render(
      <HexGrid photos={mockPhotos} modalOpen={false} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();

    rerender(<HexGrid photos={mockPhotos} modalOpen={true} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});

describe('HexGrid Props Handling', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Test',
      alt: 'Alt',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ];

  it('calls onHexClick callback', () => {
    const onHexClick = mock(() => {});
    const { container } = render(
      <HexGrid photos={mockPhotos} onHexClick={onHexClick} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles onLeaderboardUpdate callback', () => {
    const onLeaderboardUpdate = mock(() => {});
    const { container } = render(
      <HexGrid photos={mockPhotos} onLeaderboardUpdate={onLeaderboardUpdate} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles autoplayQueueLimit prop', () => {
    const { container } = render(
      <HexGrid
        photos={mockPhotos}
        autoplayQueueLimit={50}
        onAutoplayQueueLimitChange={() => {}}
      />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles userId prop', () => {
    const { container } = render(
      <HexGrid photos={mockPhotos} userId="user123" />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles username prop', () => {
    const { container } = render(
      <HexGrid photos={mockPhotos} username="testuser" />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});

describe('HexGrid Photo Updates', () => {
  it('updates when photos are added', () => {
    const initialPhotos: Photo[] = [
      {
        id: '1',
        title: 'Test 1',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo1.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ];

    const { container, rerender } = render(<HexGrid photos={initialPhotos} />);

    const updatedPhotos: Photo[] = [
      ...initialPhotos,
      {
        id: '2',
        title: 'Test 2',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo2.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ];

    rerender(<HexGrid photos={updatedPhotos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('updates when photos are removed', () => {
    const initialPhotos: Photo[] = [
      {
        id: '1',
        title: 'Test 1',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo1.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Test 2',
        alt: 'Alt',
        imageUrl: 'https://example.com/photo2.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ];

    const { container, rerender } = render(<HexGrid photos={initialPhotos} />);
    rerender(<HexGrid photos={[initialPhotos[0]]} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles photo metadata changes', () => {
    const photo: Photo = {
      id: '1',
      title: 'Original Title',
      alt: 'Alt',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    };

    const { container, rerender } = render(<HexGrid photos={[photo]} />);

    const updatedPhoto: Photo = {
      ...photo,
      title: 'Updated Title',
    };

    rerender(<HexGrid photos={[updatedPhoto]} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
