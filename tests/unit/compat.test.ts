import { describe, it, expect } from 'bun:test'
import {
  photoToGridItem,
  gridItemToPhoto,
  photosToGridItems,
  gridItemsToPhotos
} from '../../src/compat'
import type { Photo, GridItem } from '../../src/types'

describe('Compatibility Layer', () => {
  const mockPhoto: Photo = {
    id: 'photo-1',
    title: 'Test Photo',
    alt: 'Test Alt Text',
    imageUrl: 'https://example.com/photo.jpg',
    category: 'nature',
    source: 'test-source',
    description: 'A beautiful photo',
    createdAt: '2024-01-01T00:00:00Z',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    userId: 'user-1',
    username: 'testuser',
    videoUrl: undefined,
    platform: 'web',
    author: 'Test Author',
    authorUrl: 'https://example.com/author',
    likes: 100,
    views: 1000,
    comments: 50,
    dominantColor: '#ff0000',
    sourceUrl: 'https://example.com/source',
    velocity: { x: 0, y: 0, z: 0 },
  }

  describe('photoToGridItem', () => {
    it('converts a Photo to GridItem correctly', () => {
      const result = photoToGridItem(mockPhoto)
      
      expect(result.id).toBe('photo-1')
      expect(result.type).toBe('photo')
      expect(result.imageUrl).toBe('https://example.com/photo.jpg')
      expect(result.thumbnailUrl).toBe('https://example.com/thumb.jpg')
      expect(result.title).toBe('Test Photo')
      expect(result.alt).toBe('Test Alt Text')
      expect(result.description).toBe('A beautiful photo')
      expect(result.category).toBe('nature')
      expect(result.data).toBe(mockPhoto)
      expect(result.url).toBe('https://example.com/photo.jpg')
      expect(result.userId).toBe('user-1')
      expect(result.username).toBe('testuser')
      expect(result.platform).toBe('web')
      expect(result.author).toBe('Test Author')
      expect(result.authorUrl).toBe('https://example.com/author')
      expect(result.likes).toBe(100)
      expect(result.views).toBe(1000)
      expect(result.comments).toBe(50)
      expect(result.dominantColor).toBe('#ff0000')
      expect(result.source).toBe('test-source')
      expect(result.sourceUrl).toBe('https://example.com/source')
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('handles minimal Photo with required fields only', () => {
      const minimalPhoto: Photo = {
        id: 'min-1',
        title: 'Minimal',
        alt: 'Alt',
        imageUrl: 'https://example.com/min.jpg',
        category: 'test',
        source: 'test',
      }
      
      const result = photoToGridItem(minimalPhoto)
      expect(result.id).toBe('min-1')
      expect(result.type).toBe('photo')
      expect(result.thumbnailUrl).toBeUndefined()
      expect(result.userId).toBeUndefined()
    })
  })

  describe('gridItemToPhoto', () => {
    it('returns original Photo data when available', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-1',
        type: 'photo',
        imageUrl: 'https://example.com/item.jpg',
        data: mockPhoto,
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result).toBe(mockPhoto)
    })

    it('constructs Photo from GridItem fields when no data', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-2',
        type: 'photo',
        imageUrl: 'https://example.com/constructed.jpg',
        title: 'Constructed Title',
        alt: 'Constructed Alt',
        category: 'constructed',
        source: 'test',
        description: 'Constructed description',
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('item-2')
      expect(result!.imageUrl).toBe('https://example.com/constructed.jpg')
      expect(result!.title).toBe('Constructed Title')
      expect(result!.alt).toBe('Constructed Alt')
      expect(result!.category).toBe('constructed')
    })

    it('uses url field as fallback for imageUrl', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-3',
        type: 'photo',
        url: 'https://example.com/url-fallback.jpg',
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result).not.toBeNull()
      expect(result!.imageUrl).toBe('https://example.com/url-fallback.jpg')
    })

    it('returns null when no imageUrl or url', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-4',
        type: 'video', // not a photo type
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result).toBeNull()
    })

    it('uses title as alt fallback', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-5',
        type: 'photo',
        imageUrl: 'https://example.com/photo.jpg',
        title: 'Title as Alt',
        // no alt specified
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result!.alt).toBe('Title as Alt')
    })

    it('uses empty string when no title or alt', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-6',
        type: 'photo',
        imageUrl: 'https://example.com/photo.jpg',
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result!.title).toBe('')
      expect(result!.alt).toBe('')
      expect(result!.category).toBe('uncategorized')
    })

    it('preserves all optional fields', () => {
      const gridItem: GridItem<Photo> = {
        id: 'item-7',
        type: 'photo',
        imageUrl: 'https://example.com/full.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        userId: 'user-x',
        username: 'userx',
        videoUrl: 'https://example.com/video.mp4',
        platform: 'ios',
        author: 'Author X',
        authorUrl: 'https://example.com/authorx',
        likes: 500,
        views: 5000,
        comments: 250,
        dominantColor: '#00ff00',
        velocity: { x: 1, y: 2, z: 3 },
      }
      
      const result = gridItemToPhoto(gridItem)
      expect(result!.thumbnailUrl).toBe('https://example.com/thumb.jpg')
      expect(result!.userId).toBe('user-x')
      expect(result!.username).toBe('userx')
      expect(result!.videoUrl).toBe('https://example.com/video.mp4')
      expect(result!.platform).toBe('ios')
      expect(result!.author).toBe('Author X')
      expect(result!.authorUrl).toBe('https://example.com/authorx')
      expect(result!.likes).toBe(500)
      expect(result!.views).toBe(5000)
      expect(result!.comments).toBe(250)
      expect(result!.dominantColor).toBe('#00ff00')
      expect(result!.velocity).toEqual({ x: 1, y: 2, z: 3 })
    })
  })

  describe('photosToGridItems', () => {
    it('converts an array of Photos to GridItems', () => {
      const photos: Photo[] = [
        { id: '1', title: 'P1', alt: 'A1', imageUrl: 'url1', category: 'c1', source: 's1' },
        { id: '2', title: 'P2', alt: 'A2', imageUrl: 'url2', category: 'c2', source: 's2' },
        { id: '3', title: 'P3', alt: 'A3', imageUrl: 'url3', category: 'c3', source: 's3' },
      ]
      
      const result = photosToGridItems(photos)
      
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('1')
      expect(result[0].type).toBe('photo')
      expect(result[1].id).toBe('2')
      expect(result[2].id).toBe('3')
    })

    it('handles empty array', () => {
      const result = photosToGridItems([])
      expect(result).toHaveLength(0)
    })
  })

  describe('gridItemsToPhotos', () => {
    it('converts GridItems back to Photos', () => {
      const items: GridItem<Photo>[] = [
        { id: '1', type: 'photo', imageUrl: 'url1', data: mockPhoto },
        { id: '2', type: 'photo', imageUrl: 'url2' },
      ]
      
      const result = gridItemsToPhotos(items)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(mockPhoto)
      expect(result[1].imageUrl).toBe('url2')
    })

    it('filters out items that cannot be converted to Photos', () => {
      const items: GridItem<Photo>[] = [
        { id: '1', type: 'photo', imageUrl: 'url1' },
        { id: '2', type: 'video' }, // no imageUrl, will return null
        { id: '3', type: 'photo', url: 'url3' }, // has url fallback
      ]
      
      const result = gridItemsToPhotos(items)
      
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('3')
    })

    it('handles empty array', () => {
      const result = gridItemsToPhotos([])
      expect(result).toHaveLength(0)
    })
  })
})
