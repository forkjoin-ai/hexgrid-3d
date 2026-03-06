# Changelog

All notable changes to the HexGrid Visualization package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.6.1] - 2026-03-06

### Fixed
- Auto-fit default `HexTerritoryGlobe` tile radii by latitude row to prevent overlap on dense spherical boards such as Hexwar.
- Preserved explicit `tileRadius` overrides while removing the hardcoded default radius that could overdraw at the equator.

## [3.5.1] - 2026-02-26

### Changed
- Moved blank-neighbor count precompute from main-thread draw loop into the worker evolve payload.
- Reduced per-frame draw-loop overhead by hoisting repeated reads and caching fallback neighbor counts.
- Improved idle redraw throttling to avoid unnecessary full-canvas redraw work when visuals are static.

## [3.2.4] - 2026-01-25

### Fixed
- Fixed naga-cli invocation syntax in build-shaders script

## [3.2.3] - 2026-01-25

### Fixed
- Fixed WGSL type mismatch bug: `vec3<i32>` constructor was receiving `f32` values without explicit cast
- Extracted WGSL shader to separate `.wgsl` file for IDE support and validation

### Added
- `build:shaders` script to generate TypeScript from WGSL files
- `lint:wgsl` script for WGSL validation (requires `naga-cli`)

## [3.2.1] - 2026-01-25

### Fixed
- Added missing `./algorithms` export to package.json exports field
- Inlined WGSL shader source in FluidSimulation3DGPU.ts to fix missing shader file issue
- Exported FluidSimulation3DGPU, FluidSimulationWebNN, and FluidEngineFactory from algorithms module

## [1.1.0] - 2026-01-19

### Added
- FlowField3D algorithm for 3D flow field visualization
- FluidSimulation3D algorithm for 3D fluid dynamics simulation
- ParticleSystem3D algorithm for 3D particle system effects
- Comprehensive tests for new 3D algorithms

### Changed
- Updated algorithms and components from stub implementations
- Enhanced test coverage across all modules
- Improved type definitions and exports

## [1.0.0] - 2026-01-19

### Added
- Initial package extraction from main portfolio project
- HexGrid component with 3D spherical projection
- NarrationOverlay component for real-time commentary
- UIStore for global state management
- Web Worker integration for high-performance rendering
- TypeScript type definitions
- Comprehensive README with usage examples
- Basic usage example file

### Features
- 3D hexagonal grid layout on spherical surface
- Interactive camera controls (pan, zoom, inside/outside views)
- Image texture mapping with caching
- Real-time statistics and telemetry
- Touch and mouse gesture support
- Responsive design for mobile and desktop
- Dynamic theme color extraction from images
- Autoplay mode with queue management

### Documentation
- Full API documentation
- Camera controls guide
- Performance optimization tips
- Architecture overview
