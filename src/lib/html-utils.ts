const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null

/**
 * Handles the hexgrid 3d decode HTMLEntities workflow.
 */
export function decodeHTMLEntities(str: string): string {
  if (!textarea) return str
  textarea.innerHTML = str
  return textarea.value
}
