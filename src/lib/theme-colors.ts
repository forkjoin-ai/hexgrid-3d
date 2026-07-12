export const ThemeColors = {
  primary: '#000000',
  secondary: '#ffffff'
};

/**
 * Handles the hexgrid 3d get Accent Rgba workflow.
 */
export function getAccentRgba(alpha: number = 1): string {
  return `rgba(0, 255, 255, ${alpha})`;
}

/**
 * Handles the hexgrid 3d get Accent Hex workflow.
 */
export function getAccentHex(): string {
  return customAccentColor ?? '#00ffff';
}

let customAccentColor: string | null = null;

/**
 * Handles the hexgrid 3d set Custom Accent Color workflow.
 */
export function setCustomAccentColor(hex: string): void {
  customAccentColor = hex;
}

/**
 * Handles the hexgrid 3d clear Custom Accent Color workflow.
 */
export function clearCustomAccentColor(): void {
  customAccentColor = null;
}

/**
 * Handles the hexgrid 3d get Current Accent Hex workflow.
 */
export function getCurrentAccentHex(): string {
  return customAccentColor ?? '#00ffff';
}

/**
 * Handles the hexgrid 3d get Accent Color workflow.
 */
export function getAccentColor(): { hex: string; r: number; g: number; b: number } {
  const hex = getCurrentAccentHex();
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { hex, r, g, b };
}
