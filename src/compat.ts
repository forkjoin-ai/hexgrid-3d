/**
 * Backward compatibility layer for Photo and GridItem
 * 
 * Provides conversion utilities to ensure existing Photo-based code
 * continues to work while new code can use GridItem.
 */

import type { Photo } from './types'
import type { GridItem } from './types'

/**
 * Convert Photo to GridItem for backward compatibility
 */
export function photoToGridItem(photo: Photo): GridItem<Photo> {
  return {
    id: photo.id,
    type: 'photo',
    imageUrl: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    title: photo.title,
    description: photo.description,
    data: photo,
    // Map all Photo fields
    url: photo.url,
    userId: photo.userId,
    username: photo.username,
    videoUrl: photo.videoUrl,
    platform: photo.platform,
    author: photo.author,
    authorUrl: photo.authorUrl,
    likes: photo.likes,
    views: photo.views,
    comments: photo.comments,
    dominantColor: photo.dominantColor,
    source: photo.source,
    createdAt: photo.createdAt,
  }
}

/**
 * Convert GridItem back to Photo if possible
 */
export function gridItemToPhoto(item: GridItem<Photo>): Photo | null {
  // If item contains original Photo data, return it
  if (item.type === 'photo' && item.data) {
    return item.data
  }
  
  // Fallback: construct Photo from GridItem fields
  if (item.imageUrl || item.url) {
    return {
      id: item.id,
      url: item.imageUrl || item.url || '',
      title: item.title,
      description: item.description,
      source: item.source || 'unknown',
      createdAt: item.createdAt || new Date().toISOString(),
      thumbnailUrl: item.thumbnailUrl,
      userId: item.userId,
      username: item.username,
      videoUrl: item.videoUrl,
      platform: item.platform,
      author: item.author,
      authorUrl: item.authorUrl,
      likes: item.likes,
      views: item.views,
      comments: item.comments,
      dominantColor: item.dominantColor,
    }
  }
  
  return null
}

/**
 * Convert an array of Photos to GridItems
 */
export function photosToGridItems(photos: Photo[]): GridItem<Photo>[] {
  return photos.map(photoToGridItem)
}

/**
 * Convert an array of GridItems to Photos (filtering out non-photo items)
 */
export function gridItemsToPhotos(items: GridItem<Photo>[]): Photo[] {
  return items
    .map(gridItemToPhoto)
    .filter((photo): photo is Photo => photo !== null)
}
