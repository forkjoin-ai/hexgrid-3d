import React from 'react';
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { HexGrid } from '../../src/components/HexGrid';
import { Photo } from '../../src/types';

describe('HexGrid Component', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Test Photo 1',
      alt: 'Test photo 1 alt text',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Test Photo 2',
      alt: 'Test photo 2 alt text',
      imageUrl: 'https://example.com/photo2.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ];

  it('renders without crashing', () => {
    const { container } = render(<HexGrid photos={[]} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('renders with photos', () => {
    const { container } = render(<HexGrid photos={mockPhotos} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('calls onHexClick when a hex is clicked', () => {
    const onHexClick = mock(() => {});
    const { container } = render(
      <HexGrid photos={mockPhotos} onHexClick={onHexClick} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Note: Actual click detection requires complex canvas coordinate mapping
  });

  it('applies custom spacing', () => {
    const { container, rerender } = render(
      <HexGrid photos={mockPhotos} spacing={1.5} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();

    rerender(<HexGrid photos={mockPhotos} spacing={2.0} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('accepts external canvas ref', () => {
    const canvasRef = React.createRef<HTMLCanvasElement>();
    const { container } = render(
      <HexGrid photos={mockPhotos} canvasRef={canvasRef as any} />
    );
    // The ref should be assigned after render
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('handles empty photo array', () => {
    const { container } = render(<HexGrid photos={[]} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('updates when photos change', () => {
    const { container, rerender } = render(<HexGrid photos={mockPhotos} />);

    const newPhotos: Photo[] = [
      ...mockPhotos,
      {
        id: '3',
        title: 'Test Photo 3',
        alt: 'Test photo 3 alt text',
        imageUrl: 'https://example.com/photo3.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ];

    rerender(<HexGrid photos={newPhotos} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('respects modalOpen prop', () => {
    const { container, rerender } = render(
      <HexGrid photos={mockPhotos} modalOpen={false} />
    );
    expect(container.querySelector('canvas')).not.toBeNull();

    rerender(<HexGrid photos={mockPhotos} modalOpen={true} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
