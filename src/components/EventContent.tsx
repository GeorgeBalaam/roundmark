// Renders an event's ordered content blocks for the public microsite (/e/:id).
// Read-only and brand-aware (inherits the --rm-* theme set by the page wrapper).

import { useState } from 'react';
import { Button } from './ui';
import { DisclosureIcon, NearestPinIcon, TrophyIcon, ICON_SM } from '../lib/icons';
import { videoEmbedUrl, mapsSearchUrl } from '../lib/video';
import type { Award, EventBlock, VideoProvider } from '../lib/types';

function TextBlock({ title, body }: { title?: string; body: string }) {
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      {title && <h2 style={{ marginBottom: 'var(--space-4)' }}>{title}</h2>}
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, margin: 0, fontSize: '1.05rem' }}>{body}</p>
    </section>
  );
}

function ImageBlock({ url, caption }: { url: string; caption?: string }) {
  if (!url) return null;
  return (
    <figure style={{ margin: '0 0 var(--space-10)' }}>
      <img
        src={url}
        alt={caption ?? ''}
        style={{ width: '100%', borderRadius: 'var(--radius-card)', display: 'block', boxShadow: 'var(--shadow-sm)' }}
      />
      {caption && (
        <figcaption className="text-small text-muted" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function FeatureBlock({ title, body, url, imageSide }: { title?: string; body: string; url?: string; imageSide: 'left' | 'right' }) {
  const text = (
    <div>
      {title && <h2 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>{title}</h2>}
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, margin: 0, fontSize: '1.05rem' }}>{body}</p>
    </div>
  );
  const image = url ? (
    <img src={url} alt={title ?? ''} style={{ width: '100%', borderRadius: 'var(--radius-card)', display: 'block', boxShadow: 'var(--shadow-sm)' }} />
  ) : null;
  return (
    <section className={`event-feature ${imageSide === 'right' ? 'img-right' : ''}`} style={{ marginBottom: 'var(--space-10)' }}>
      {imageSide === 'right' ? (<>{text}{image}</>) : (<>{image}{text}</>)}
    </section>
  );
}

function CtaBlock({ title, body, label, href }: { title?: string; body?: string; label: string; href: string }) {
  if (!label || !href) return null;
  return (
    <section
      style={{
        marginBottom: 'var(--space-10)',
        textAlign: 'center',
        padding: 'var(--space-8)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--rm-accent-soft, rgba(141,178,89,0.12))',
        border: '1px solid var(--rm-border-soft)',
      }}
    >
      {title && <h2 style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>{title}</h2>}
      {body && <p style={{ margin: '0 auto var(--space-5)', maxWidth: 520, lineHeight: 1.7 }}>{body}</p>}
      <Button size="lg" href={href}>{label}</Button>
    </section>
  );
}

function VideoBlock({ provider, videoId, title }: { provider: VideoProvider; videoId: string; title?: string }) {
  if (!videoId) return null;
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      {title && <h2 style={{ marginBottom: 'var(--space-4)' }}>{title}</h2>}
      <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', background: '#000' }}>
        <iframe
          src={videoEmbedUrl(provider, videoId)}
          title={title ?? 'Event video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </section>
  );
}

function VenueBlock({ title, address, mapUrl }: { title?: string; address: string; mapUrl?: string }) {
  if (!address.trim()) return null;
  const href = mapUrl?.trim() || mapsSearchUrl(address);
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      {title && <h2 style={{ marginBottom: 'var(--space-4)' }}>{title}</h2>}
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0, flex: '1 1 240px' }}>{address}</p>
        <Button variant="secondary" href={href}>
          <NearestPinIcon size={ICON_SM} /> Get directions
        </Button>
      </div>
    </section>
  );
}

function ScheduleBlock({ title, items }: { title?: string; items: { id: string; time: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      {title && <h2 style={{ marginBottom: 'var(--space-5)' }}>{title}</h2>}
      <div style={{ borderLeft: '2px solid var(--rm-border)', paddingLeft: 'var(--space-6)' }}>
        {items.map((it) => (
          <div key={it.id} style={{ position: 'relative', paddingBottom: 'var(--space-5)' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 'calc(-1 * var(--space-6) - 7px)',
                top: 4,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--rm-accent, var(--rm-green-fairway))',
                border: '2px solid var(--rm-bg, #fff)',
              }}
            />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{it.time}</div>
            <div className="text-muted">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqBlock({ title, items }: { title?: string; items: { id: string; q: string; a: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      {title && <h2 style={{ marginBottom: 'var(--space-4)' }}>{title}</h2>}
      <div>
        {items.map((it) => {
          const isOpen = open === it.id;
          return (
            <div key={it.id} style={{ borderBottom: '1px solid var(--rm-border-soft)' }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : it.id)}
                aria-expanded={isOpen}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4) 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: '1rem',
                  color: 'inherit',
                }}
              >
                {it.q}
                <DisclosureIcon
                  size={ICON_SM}
                  aria-hidden="true"
                  style={{ flexShrink: 0, transition: 'transform 0.18s ease', transform: isOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {isOpen && (
                <p style={{ margin: '0 0 var(--space-4)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }} className="text-muted">
                  {it.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PrizesBlock({ title, awards }: { title?: string; awards: Award[] }) {
  // Pre-event teaser: prizes only, winners stay hidden until results.
  const withPrizes = awards.filter((a) => a.prize);
  if (!withPrizes.length) return null;
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>{title || 'Prizes up for grabs'}</h2>
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {withPrizes.map((a) => (
          <div key={a.id} className="card" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--rm-accent, var(--rm-green-fairway))', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <TrophyIcon size={ICON_SM} />
            </div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              {a.title}{a.hole ? ` — hole ${a.hole}` : ''}
            </div>
            <div className="text-muted" style={{ marginTop: 2 }}>{a.prize}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EventContent({ blocks, awards = [] }: { blocks: EventBlock[]; awards?: Award[] }) {
  if (!blocks.length) return null;
  return (
    <div className="event-content">
      {blocks.map((block) => {
        switch (block.type) {
          case 'prizes':
            return <PrizesBlock key={block.id} title={block.title} awards={awards} />;
          case 'text':
            return <TextBlock key={block.id} title={block.title} body={block.body} />;
          case 'image':
            return <ImageBlock key={block.id} url={block.url} caption={block.caption} />;
          case 'feature':
            return <FeatureBlock key={block.id} title={block.title} body={block.body} url={block.url} imageSide={block.imageSide} />;
          case 'cta':
            return <CtaBlock key={block.id} title={block.title} body={block.body} label={block.label} href={block.href} />;
          case 'video':
            return <VideoBlock key={block.id} provider={block.provider} videoId={block.videoId} title={block.title} />;
          case 'venue':
            return <VenueBlock key={block.id} title={block.title} address={block.address} mapUrl={block.mapUrl} />;
          case 'schedule':
            return <ScheduleBlock key={block.id} title={block.title} items={block.items} />;
          case 'faq':
            return <FaqBlock key={block.id} title={block.title} items={block.items} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
