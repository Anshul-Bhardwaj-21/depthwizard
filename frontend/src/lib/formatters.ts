/**
 * Utility: format a byte count to a human-readable string.
 * e.g. formatBytes(1536) → "1.5 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  const clamped = Math.min(exp, units.length - 1);
  const value = bytes / Math.pow(1024, clamped);
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[clamped]}`;
}

/**
 * Format a pixel dimension pair.
 * e.g. formatDimensions(3200, 2400) → "3200 × 2400 px"
 */
export function formatDimensions(w: number, h: number): string {
  return `${w.toLocaleString()} × ${h.toLocaleString()} px`;
}

/**
 * Format a ground sampling distance.
 * e.g. formatGSD(0.5) → "0.50 m/px"
 */
export function formatGSD(metres: number): string {
  return `${metres.toFixed(2)} m/px`;
}
