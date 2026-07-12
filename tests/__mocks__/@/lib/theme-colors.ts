export const themeColors = {
  accent: '#3b82f6',
  background: '#000000',
  text: '#ffffff',
};

/**
 * Handles the hexgrid 3d get Accent Rgba workflow.
 */
export function getAccentRgba(alpha: number = 1): string {
  return `rgba(59, 130, 246, ${alpha})`;
}

/**
 * Handles the hexgrid 3d get Accent Color workflow.
 */
export function getAccentColor(): string {
  return themeColors.accent;
}

/**
 * Handles the hexgrid 3d set Accent Color workflow.
 */
export function setAccentColor(color: string): void {
  themeColors.accent = color;
}
