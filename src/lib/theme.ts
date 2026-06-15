// Per-event theming. Turns an event's brand/accent/background colours into a
// set of CSS-variable overrides that public pages spread onto a wrapper, so the
// existing --rm-* design tokens re-skin without touching component styles.

import type { CSSProperties } from 'react';
import type { RoundmarkEvent } from './types';

export const DEFAULT_BRAND = '#27542A';
export const DEFAULT_ACCENT = '#8DB259';
export const DEFAULT_BG = '#F7F3EA';

/** Parse a #rgb / #rrggbb string to [r,g,b]; null if unparseable. */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('');
}

/** Darken a hex colour by `amount` (0–1). Used for button hover states. */
export function darken(hex: string, amount = 0.16): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex([rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount)]);
}

/** Pick black or white text for readable contrast on a coloured background. */
export function readableTextOn(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#ffffff';
  // Relative luminance (sRGB) — light backgrounds get dark text and vice versa.
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.4072 * b;
  return lum > 0.5 ? '#17211b' : '#ffffff';
}

/**
 * CSS-variable overrides for an event's branding. Spread onto a page wrapper:
 *   <div style={eventThemeVars(event)}>…</div>
 */
export function eventThemeVars(event: RoundmarkEvent): CSSProperties {
  const brand = event.brandColor || DEFAULT_BRAND;
  const accent = event.accentColor || DEFAULT_ACCENT;
  const bg = event.bgColor || DEFAULT_BG;
  return {
    '--rm-primary': brand,
    '--rm-primary-hover': darken(brand),
    '--rm-accent': accent,
    '--rm-green-fresh': accent,
    '--rm-bg': bg,
  } as CSSProperties;
}
