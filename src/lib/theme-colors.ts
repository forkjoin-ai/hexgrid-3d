export const ThemeColors = {
  primary: '#000000',
  secondary: '#ffffff'
};

export function getAccentRgba(alpha: number = 1): string {
  return `rgba(0, 255, 255, ${alpha})`;
}

export function getAccentHex(): string {
  return '#00ffff';
}
