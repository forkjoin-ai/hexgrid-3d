// Component exports
export { HexGrid } from './HexGrid'
export { NarrationOverlay } from './NarrationOverlay'

// Re-export types from HexGrid
export type { Photo, HexGridProps } from './HexGrid'

// Re-export types from types.ts
export type { GridItem } from '../types'

// Re-export adapters
export { createAdapter, type ItemAdapter, type AdapterOptions } from '../adapters'
export { ontologyEntityAdapter } from '../ontology-adapter'
export { noteAdapter, type Note, type NoteContent, type NoteMetadata } from '../note-adapter'

// Re-export compatibility utilities
export { photoToGridItem, gridItemToPhoto, photosToGridItems, gridItemsToPhotos } from '../compat'
