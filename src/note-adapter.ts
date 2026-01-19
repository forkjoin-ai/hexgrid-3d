/**
 * Adapter for embedding notes directly in the grid
 * 
 * This adapter allows notes (Cyrano's internal notes, user notes, etc.)
 * to be embedded directly in GridItems with full metadata preservation.
 */

import type { GridItem } from './types'
import type { ItemAdapter, AdapterOptions } from './adapters'

/**
 * Note content structure
 */
export interface NoteContent {
  title?: string
  text: string
  summary?: string
}

/**
 * Note metadata structure
 */
export interface NoteMetadata {
  type?: string
  category?: string
  subcategory?: string
  tags?: string[]
  targetUserId?: string
  status?: 'active' | 'archived' | 'draft'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  context?: string
  permissions?: 'private' | 'shared' | 'public'
  sharedWith?: string[]
}

/**
 * Note structure matching Affectively's note format
 */
export interface Note {
  id: string
  content: NoteContent
  metadata?: NoteMetadata
  date: string
}

/**
 * Calculate velocity for a note based on recency, priority, and metadata richness
 */
function calculateNoteVelocity(note: Note): number {
  let velocity = 0.1 // Base minimum

  // Priority contribution (0-0.3)
  const priorityMap: Record<string, number> = {
    urgent: 0.3,
    high: 0.2,
    medium: 0.1,
    low: 0.05,
  }
  if (note.metadata?.priority) {
    velocity += priorityMap[note.metadata.priority] || 0.1
  }

  // Recency contribution (0-0.4)
  if (note.date) {
    const ageMs = Date.now() - new Date(note.date).getTime()
    const ageHours = ageMs / (1000 * 60 * 60)
    const recencyFactor = Math.max(0, 1 - ageHours / 168) // Decay over 1 week
    velocity += recencyFactor * 0.4
  }

  // Metadata richness contribution (0-0.2)
  let contextScore = 0
  if (note.metadata?.type) contextScore += 0.05
  if (note.metadata?.category) contextScore += 0.05
  if (note.metadata?.tags && note.metadata.tags.length > 0) contextScore += 0.05
  if (note.metadata?.context) contextScore += 0.05
  velocity += Math.min(contextScore, 0.2)

  // Clamp to [0.1, 1.0]
  return Math.max(0.1, Math.min(1.0, velocity))
}

/**
 * Adapter for embedding notes directly
 */
export const noteAdapter: ItemAdapter<Note> = {
  toGridItem(note: Note, options?: AdapterOptions): GridItem<Note> {
    const velocity = options?.velocity ?? calculateNoteVelocity(note)

    return {
      id: note.id,
      type: 'note',
      title: note.content.title || 'Untitled Note',
      description: note.content.summary || note.content.text.substring(0, 200),
      data: note,
      createdAt: note.date,
      velocity,
      // Notes can have generated visualizations
      imageUrl: options?.visualUrl || `/api/notes/${note.id}/visualization`,
      category: note.metadata?.category,
      // Store metadata in metrics for filtering/sorting
      metrics: {
        priority: note.metadata?.priority === 'urgent' ? 4 : note.metadata?.priority === 'high' ? 3 : note.metadata?.priority === 'medium' ? 2 : 1,
        tagCount: note.metadata?.tags?.length || 0,
      },
    }
  },

  fromGridItem(item: GridItem<Note>): Note {
    if (!item.data) {
      throw new Error('GridItem missing note data')
    }
    return item.data
  },

  calculateVelocity(note: Note): number {
    return calculateNoteVelocity(note)
  },

  extractVisualUrl(note: Note): string | undefined {
    // Notes can have generated visualizations
    return `/api/notes/${note.id}/visualization`
  },
}
