// Parses pasted video URLs into a provider + id. We only ever embed recognised
// providers (YouTube / Vimeo) by id — never an arbitrary iframe src — so a junk
// URL yields null and nothing renderable.

import type { VideoProvider } from './types';

export interface ParsedVideo {
  provider: VideoProvider;
  videoId: string;
}

/** Extract { provider, videoId } from a YouTube or Vimeo URL, else null. */
export function parseVideoUrl(input: string): ParsedVideo | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
    const v = url.searchParams.get('v');
    if (v && isYouTubeId(v)) return { provider: 'youtube', videoId: v };
    const m = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})/);
    if (m && isYouTubeId(m[1])) return { provider: 'youtube', videoId: m[1] };
    return null;
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return isYouTubeId(id) ? { provider: 'youtube', videoId: id } : null;
  }

  // Vimeo: vimeo.com/123456789 (numeric id)
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/(\d{6,})/);
    return m ? { provider: 'vimeo', videoId: m[1] } : null;
  }

  return null;
}

function isYouTubeId(id: string): boolean {
  return /^[\w-]{11}$/.test(id);
}

/** Privacy-friendly embed URL for a recognised provider + id. */
export function videoEmbedUrl(provider: VideoProvider, videoId: string): string {
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : `https://player.vimeo.com/video/${videoId}`;
}

/** Normalise a user-entered link: add https:// if no scheme was given. */
export function normaliseHref(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** Google Maps search link for a free-text address. */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}
