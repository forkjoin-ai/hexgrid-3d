# HexGrid 3D Package Structure

## Overview
This package contains the reusable 3D hexagonal grid visualization component extracted from the portfolio project for easier reuse and maintenance.

## Directory Structure

```
packages/hexgrid-3d/
├── src/
│   ├── components/          # React components
│   │   ├── HexGrid.tsx     # Main 3D grid visualization component
│   │   ├── NarrationOverlay.tsx  # Commentary overlay component
│   │   └── index.ts        # Component exports
│   ├── stores/             # State management
│   │   ├── uiStore.ts     # Global UI state store
│   │   └── index.ts       # Store exports
│   ├── workers/            # Web Workers
│   │   └── hexgrid-worker.worker.ts  # Rendering calculations worker
│   ├── types.ts           # TypeScript type definitions
│   └── index.ts          # Main package entry point
├── public/                # Static assets
│   └── hexgrid-worker.js # Compiled worker script
├── examples/              # Usage examples
│   └── basic-usage.tsx   # Basic implementation example
├── tests/                 # Test suites
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/             # End-to-end tests
├── package.json          # Package configuration
├── tsconfig.json        # TypeScript configuration
├── jest.config.js       # Jest configuration
├── playwright.config.ts # Playwright configuration
├── README.md           # Package documentation
├── CHANGELOG.md       # Version history
└── .gitignore        # Git ignore rules
```

## Components Moved

### From `components/three/`
- HexGrid.tsx → `packages/hexgrid-3d/src/components/HexGrid.tsx`
- NarrationOverlay.tsx → `packages/hexgrid-3d/src/components/NarrationOverlay.tsx`
- uiStore.ts → `packages/hexgrid-3d/src/stores/uiStore.ts`
- hexgrid-worker.worker.ts → `packages/hexgrid-3d/src/workers/hexgrid-worker.worker.ts`

### From `public/`
- hexgrid-worker.js → `packages/hexgrid-3d/public/hexgrid-worker.js` (copy)

## Import Updates

All imports have been updated in the following files:
- `components/three/PortfolioScene.tsx`
- `components/three/PhotoModal.tsx`
- `components/three/NowPlayingNotification.tsx`
- `components/page/Navbar.tsx`
- `components/page/PoolNavbar.tsx`
- `lib/content-filter.ts`
- `app/photo/[id]/page.tsx`

## Usage

### In the Portfolio App

```tsx
import { HexGrid, Photo } from '@buley/hexgrid-3d'
import { uiStore } from '@buley/hexgrid-3d/stores'
```

### External Projects

To use in external projects:
1. Install: `npm install hexgrid-3d`
2. Import and use as documented in README.md

## Dependencies

### Internal (Monorepo)
- `@/lib/stats-tracker` - Statistics tracking
- `@/lib/narration` - Narration engine
- `@/lib/logger` - Logging utilities
- `@/lib/theme-colors` - Theme system
- `@/lib/html-utils` - HTML utilities
- `@/components/debug/PoolStatsOverlay` - Debug overlay

### External
- `react` ^18.0.0
- `react-dom` ^18.0.0
- `next` ^14.0.0
- `three` (Three.js library)

## Configuration

### TypeScript Path Mapping

Added to main `tsconfig.json`:
```json
{
  "paths": {
    "hexgrid-3d": ["./packages/hexgrid-3d/src"],
    "hexgrid-3d/*": ["./packages/hexgrid-3d/src/*"]
  }
}
```

## Testing

The package includes comprehensive testing:

- **Unit Tests** - Test individual components and utilities
- **Integration Tests** - Test component interactions
- **E2E Tests** - Test full user workflows with Playwright

Run tests:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # E2E tests
```

## Features

- 3D hexagonal grid with spherical projection
- Interactive camera controls (inside/outside views)
- Automatic image texture loading and caching
- Real-time performance telemetry
- Play-by-play narration system
- Web Worker for 60fps rendering
- Touch and mouse gesture support
- Responsive mobile/desktop design
- Dynamic theme color extraction
- Autoplay queue management

## Repository

GitHub: https://github.com/buley/hexgrid-3d

## License

MIT
