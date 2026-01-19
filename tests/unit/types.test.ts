import { Photo } from '../../src/types'

describe('Type Safety Tests', () => {
  describe('Photo interface', () => {
    it('accepts minimal valid photo', () => {
      const photo: Photo = {
        id: '1',
        url: 'https://example.com/photo.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      }
      
      expect(photo.id).toBe('1')
      expect(photo.url).toContain('example.com')
    })

    it('accepts photo with all optional fields', () => {
      const photo: Photo = {
        id: '1',
        url: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: 'Test Photo',
        description: 'A test photo',
        source: 'test',
        createdAt: new Date().toISOString(),
        userId: 'user123',
        username: 'testuser',
        videoUrl: 'https://example.com/video.mp4',
        platform: 'test-platform',
        author: 'Test Author',
        authorUrl: 'https://example.com/author',
        likes: 100,
        views: 1000,
        comments: 10,
        dominantColor: '#ff0000',
      }
      
      expect(photo.title).toBe('Test Photo')
      expect(photo.likes).toBe(100)
    })

    it('validates required fields', () => {
      const createPhoto = (overrides: Partial<Photo> = {}): Photo => ({
        id: '1',
        url: 'https://example.com/photo.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
        ...overrides,
      })
      
      expect(createPhoto()).toBeDefined()
      expect(createPhoto({ title: 'Custom Title' }).title).toBe('Custom Title')
    })
  })

  describe('Array handling', () => {
    it('handles empty photo arrays', () => {
      const photos: Photo[] = []
      expect(photos.length).toBe(0)
    })

    it('handles large photo arrays', () => {
      const photos: Photo[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        url: `https://example.com/photo${i}.jpg`,
        source: 'test',
        createdAt: new Date().toISOString(),
      }))
      
      expect(photos.length).toBe(1000)
      expect(photos[0].id).toBe('0')
      expect(photos[999].id).toBe('999')
    })

    it('supports filtering photos', () => {
      const photos: Photo[] = [
        { id: '1', url: 'url1', source: 'source1', createdAt: '2024-01-01' },
        { id: '2', url: 'url2', source: 'source2', createdAt: '2024-01-02' },
        { id: '3', url: 'url3', source: 'source1', createdAt: '2024-01-03' },
      ]
      
      const filtered = photos.filter(p => p.source === 'source1')
      expect(filtered.length).toBe(2)
    })

    it('supports mapping photos', () => {
      const photos: Photo[] = [
        { id: '1', url: 'url1', source: 'test', createdAt: '2024-01-01' },
        { id: '2', url: 'url2', source: 'test', createdAt: '2024-01-02' },
      ]
      
      const ids = photos.map(p => p.id)
      expect(ids).toEqual(['1', '2'])
    })
  })

  describe('Metadata handling', () => {
    it('handles numeric metadata', () => {
      const photo: Photo = {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: '2024-01-01',
        likes: 0,
        views: 0,
        comments: 0,
      }
      
      expect(photo.likes).toBe(0)
      expect(typeof photo.views).toBe('number')
    })

    it('handles undefined optional fields', () => {
      const photo: Photo = {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: '2024-01-01',
      }
      
      expect(photo.title).toBeUndefined()
      expect(photo.likes).toBeUndefined()
    })

    it('preserves all fields through spread', () => {
      const original: Photo = {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: '2024-01-01',
        likes: 100,
      }
      
      const copy = { ...original }
      expect(copy).toEqual(original)
      expect(copy.likes).toBe(100)
    })
  })
})

describe('Edge Cases', () => {
  it('handles special characters in URLs', () => {
    const photo: Photo = {
      id: '1',
      url: 'https://example.com/photo?param=value&other=test',
      source: 'test',
      createdAt: '2024-01-01',
    }
    
    expect(photo.url).toContain('?')
    expect(photo.url).toContain('&')
  })

  it('handles very long strings', () => {
    const longTitle = 'A'.repeat(1000)
    const photo: Photo = {
      id: '1',
      url: 'url',
      source: 'test',
      createdAt: '2024-01-01',
      title: longTitle,
    }
    
    expect(photo.title?.length).toBe(1000)
  })

  it('handles Unicode characters', () => {
    const photo: Photo = {
      id: '1',
      url: 'url',
      source: 'test',
      createdAt: '2024-01-01',
      title: '测试 🎨 тест',
      description: 'Çédille naïve résumé',
    }
    
    expect(photo.title).toContain('🎨')
    expect(photo.description).toContain('é')
  })

  it('handles date formats', () => {
    const dates = [
      new Date().toISOString(),
      '2024-01-01T00:00:00Z',
      '2024-01-01',
    ]
    
    dates.forEach(date => {
      const photo: Photo = {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: date,
      }
      
      expect(photo.createdAt).toBe(date)
    })
  })
})
