export const themeColors = {
  accent: '#3b82f6',
  background: '#000000',
  text: '#ffffff',
}

export function getAccentRgba(alpha: number = 1): string {
  return `rgba(59, 130, 246, ${alpha})`
}

export function getAccentColor(): string {
  return themeColors.accent
}

export function setAccentColor(color: string): void {
  themeColors.accent = color
}
