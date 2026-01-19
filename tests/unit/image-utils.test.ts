/**
 * Tests for HexGrid utility functions.
 * These tests verify pure, deterministic helper functions.
 */

import { getProxiedImageUrl } from '../../src/utils/image-utils'

describe('HexGrid Utilities - Pure Functions', () => {
  describe('getProxiedImageUrl', () => {
    it('proxies preview.redd.it URLs', () => {
      const url = 'https://preview.redd.it/abc123.jpg'
      const proxied = getProxiedImageUrl(url)
      
      expect(proxied).toContain('/api/proxy-image')
      expect(proxied).toContain('url=')
      expect(proxied).toContain(encodeURIComponent(url))
    })

    it('does not proxy external-preview.redd.it URLs', () => {
      const url = 'https://external-preview.redd.it/xyz789.jpg'
      const result = getProxiedImageUrl(url)
      
      expect(result).toBe(url) // No proxying
    })

    it('passes through non-reddit URLs', () => {
      const url = 'https://example.com/image.jpg'
      const result = getProxiedImageUrl(url)
      
      expect(result).toBe(url)
    })

    it('passes through https://i.redd.it URLs', () => {
      const url = 'https://i.redd.it/direct-image.jpg'
      const result = getProxiedImageUrl(url)
      
      expect(result).toBe(url)
    })

    it('handles URLs with query parameters', () => {
      const url = 'https://preview.redd.it/image.jpg?width=640&format=jpg'
      const proxied = getProxiedImageUrl(url)
      
      expect(proxied).toContain('/api/proxy-image')
      expect(proxied).toContain(encodeURIComponent(url))
    })

    it('properly encodes special characters in URL', () => {
      const url = 'https://preview.redd.it/image with spaces & symbols.jpg'
      const proxied = getProxiedImageUrl(url)
      
      expect(proxied).toContain('/api/proxy-image')
      expect(proxied).not.toContain(' ') // Spaces should be encoded
      expect(proxied).toContain(encodeURIComponent(url))
    })

    it('handles empty string', () => {
      const result = getProxiedImageUrl('')
      expect(result).toBe('')
    })

    it('handles non-string input gracefully', () => {
      const result = getProxiedImageUrl(null as any)
      expect(result).toBe(null)
    })

    it('handles undefined input gracefully', () => {
      const result = getProxiedImageUrl(undefined as any)
      expect(result).toBe(undefined)
    })

    it('handles URL with preview.redd.it in subdomain position', () => {
      const url = 'https://i.preview.redd.it/some-image.jpg'
      const proxied = getProxiedImageUrl(url)
      
      // Should proxy since it contains preview.redd.it
      expect(proxied).toContain('/api/proxy-image')
    })

    it('does not proxy if both preview and external-preview are in URL', () => {
      // Edge case: URL contains both strings
      const url = 'https://external-preview.redd.it/redirect?url=preview.redd.it'
      const result = getProxiedImageUrl(url)
      
      // Should NOT proxy because external-preview is present
      expect(result).toBe(url)
    })

    it('is case-sensitive for domain matching', () => {
      const url = 'https://PREVIEW.REDD.IT/image.jpg'
      const result = getProxiedImageUrl(url)
      
      // JavaScript includes() is case-sensitive, so this won't match
      expect(result).toBe(url)
    })

    it('handles URLs with fragments', () => {
      const url = 'https://preview.redd.it/image.jpg#section'
      const proxied = getProxiedImageUrl(url)
      
      expect(proxied).toContain('/api/proxy-image')
      expect(proxied).toContain(encodeURIComponent(url))
    })

    it('handles very long URLs', () => {
      const longPath = 'a'.repeat(1000)
      const url = `https://preview.redd.it/${longPath}.jpg`
      const proxied = getProxiedImageUrl(url)
      
      expect(proxied).toContain('/api/proxy-image')
      expect(proxied.length).toBeGreaterThan(url.length) // Due to encoding
    })

    it('does not modify imgur URLs', () => {
      const url = 'https://i.imgur.com/abc123.jpg'
      const result = getProxiedImageUrl(url)
      
      expect(result).toBe(url)
    })

    it('does not modify data URLs', () => {
      const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'
      const result = getProxiedImageUrl(url)
      
      expect(result).toBe(url)
    })

    it('handles relative URLs', () => {
      const url = '/local/image.jpg'
      const result = getProxiedImageUrl(url)
      
      expect(result).toBe(url)
    })

    it('correctly encodes URL with equals sign', () => {
      const url = 'https://preview.redd.it/image.jpg?token=abc=def'
      const proxied = getProxiedImageUrl(url)
      
      expect(proxied).toContain('/api/proxy-image')
      // The original URL should be properly encoded
      const encoded = encodeURIComponent(url)
      expect(proxied).toContain(encoded)
    })
  })
})
