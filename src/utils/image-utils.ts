/**
 * Pure utility functions for HexGrid component.
 * These functions have NO side effects and are deterministic.
 */

/**
 * Get proxied image URL for preview.redd.it images (CORS issues).
 * External preview URLs work fine without proxying.
 * @pure - No side effects, deterministic
 * @param imageUrl Original image URL
 * @returns Proxied URL if needed, otherwise original URL
 */
export function getProxiedImageUrl(imageUrl: string): string {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return imageUrl;
  }

  // Only proxy preview.redd.it URLs (they have CORS issues)
  // external-preview.redd.it URLs work fine, so don't proxy them
  if (
    imageUrl.includes('preview.redd.it') &&
    !imageUrl.includes('external-preview.redd.it')
  ) {
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  }

  return imageUrl;
}
