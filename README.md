# HexGrid 3D

A reusable 3D hexagonal grid visualization component for displaying content in an immersive spherical layout.

## Features

- **3D Hexagonal Grid Layout** - Spherical projection with customizable curvature
- **Interactive Camera Controls** - Pan, zoom, inside/outside views with smooth transitions
- **Image Texture Mapping** - Automatic texture loading and caching
- **Real-time Statistics** - Live telemetry and performance metrics
- **Narration System** - Play-by-play commentary overlay
- **Web Worker Rendering** - High-performance offloaded calculations
- **Multi-Input Support** - Touch gestures, mouse, and keyboard controls
- **Responsive Design** - Adapts to mobile and desktop viewports
- **Dynamic Theming** - Accent color extraction from images
- **Autoplay Mode** - Queue-based content cycling

## Installation

```bash
npm install @buley/hexgrid-3d
```

## Usage

### Basic Example

```tsx
import { HexGrid, Photo } from '@buley/hexgrid-3d'

function MyComponent() {
  const photos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo.jpg',
      source: 'example',
      createdAt: new Date().toISOString()
    }
  ]

  return (
    <HexGrid
      photos={photos}
      onHexClick={(photo) => console.log('Clicked:', photo)}
    />
  )
}
```

### Advanced Example with Controls

```tsx
import { HexGrid, Photo, uiStore } from '@buley/hexgrid-3d'
import { useRef, useState } from 'react'

function AdvancedExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div>
      {/* Control buttons */}
      <button onClick={() => uiStore.toggleDebug()}>
        Toggle Debug
      </button>
      <button onClick={() => uiStore.toggleCamera()}>
        Camera Controls
      </button>
      
      {/* Visualization */}
      <HexGrid
        photos={photos}
        canvasRef={canvasRef}
        spacing={1.2}
        modalOpen={modalOpen}
        onHexClick={(photo) => setModalOpen(true)}
        autoplayQueueLimit={100}
      />
    </div>
  )
}
```

## Components

### HexGrid

Main visualization component that renders a 3D hexagonal grid on a spherical surface.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `photos` | `Photo[]` | `[]` | Array of photos to display in the grid |
| `onHexClick` | `(photo: Photo) => void` | - | Callback when a hex tile is clicked |
| `spacing` | `number` | `1.0` | Grid spacing multiplier (affects tile density) |
| `canvasRef` | `React.RefObject<HTMLCanvasElement>` | - | Optional external canvas reference |
| `onLeaderboardUpdate` | `(leaderboard: any) => void` | - | Callback for leaderboard statistics updates |
| `autoplayQueueLimit` | `number` | - | Maximum items in autoplay queue |
| `onAutoplayQueueLimitChange` | `(limit: number) => void` | - | Callback when autoplay limit changes |
| `modalOpen` | `boolean` | `false` | Whether a modal is currently open |
| `userId` | `string` | - | Current user ID for personalization |
| `username` | `string` | - | Current username for display |

### NarrationOverlay

Displays narration messages and real-time statistics in a dashboard-style overlay.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `messages` | `NarrationMessage[]` | Array of narration messages to display |
| `statsTracker` | `StatsTracker` | Statistics tracker instance |
| `isVisible` | `boolean` | Whether overlay is visible |
| `onClose` | `() => void` | Callback when overlay is closed |

## Types

### Photo

```typescript
interface Photo {
  id: string
  url: string
  thumbnailUrl?: string
  title?: string
  description?: string
  source: string
  createdAt: string
  userId?: string
  username?: string
  videoUrl?: string
  platform?: string
  author?: string
  authorUrl?: string
  likes?: number
  views?: number
  comments?: number
  dominantColor?: string
}
```

## Stores

### uiStore

Global UI state management for visualization components.

**Methods:**

- `uiStore.toggleDebug()` - Toggle debug panel
- `uiStore.toggleStats()` - Toggle statistics overlay
- `uiStore.toggleCamera()` - Toggle camera controls
- `uiStore.toggleNarration()` - Toggle narration overlay
- `uiStore.set(state)` - Update multiple state values
- `uiStore.subscribe(callback)` - Subscribe to state changes

**State:**

```typescript
interface UIState {
  debugOpen: boolean
  showStats: boolean
  cameraOpen: boolean
  showNarration: boolean
}
```

## Camera Controls

### Mouse/Trackpad
- **Left Click + Drag** - Rotate camera (yaw and pitch)
- **Scroll** - Zoom in/out
- **Click on Hex** - Select photo

### Touch
- **Single Touch Drag** - Rotate camera
- **Pinch** - Zoom in/out
- **Tap on Hex** - Select photo

### Keyboard
- **D** - Toggle debug panel
- **Escape** - Close debug panel

## Performance

The component uses a Web Worker for heavy calculations to maintain 60fps rendering:

- **Streaming Rendering** - Progressively renders tiles
- **Texture Caching** - Reuses loaded images
- **Adaptive Quality** - Adjusts detail based on performance
- **Low-Res Mode** - Optional reduced quality for slower devices

## Theming

The component integrates with your app's theme system and can extract accent colors from images:

```tsx
import { getAccentRgba, setCustomAccentColor } from '@/lib/theme-colors'

// Custom accent color from image
setCustomAccentColor('#ff00ff')
```

## Dependencies

### Peer Dependencies
- `react` ^18.0.0
- `react-dom` ^18.0.0
- `next` ^14.0.0
- `three` (Three.js for 3D calculations)

### Internal Dependencies
- `@/lib/stats-tracker` - Statistics tracking
- `@/lib/narration` - Narration engine
- `@/lib/logger` - Logging utilities
- `@/lib/theme-colors` - Theme system integration
- `@/lib/html-utils` - HTML utilities

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Architecture

```
hexgrid-3d/
├── src/
│   ├── components/      # React components
│   │   ├── HexGrid.tsx
│   │   └── NarrationOverlay.tsx
│   ├── stores/          # State management
│   │   └── uiStore.ts
│   ├── workers/         # Web Workers
│   │   └── hexgrid-worker.worker.ts
│   ├── types.ts         # TypeScript definitions
│   └── index.ts         # Main exports
├── public/              # Static assets
│   └── hexgrid-worker.js
├── examples/            # Usage examples
│   └── basic-usage.tsx
└── tests/              # Test suites
    ├── unit/
    ├── integration/
    └── e2e/
```

## Testing

### Run Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Coverage

```bash
npm run test:coverage
```

### Run E2E Tests

```bash
npm run test:e2e
```

## License

Personal Use Only - See LICENSE file for full terms.

This software is provided for personal, non-commercial use only. Commercial use,
redistribution, and sublicensing are prohibited. All intellectual property
rights are reserved by the copyright holder.
