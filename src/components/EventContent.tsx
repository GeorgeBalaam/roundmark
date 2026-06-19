// Renders an event's ordered content blocks for the public microsite (/e/:id).
// Read-only and brand-aware (inherits the --rm-* theme set by the page wrapper).

import { useState } from 'react';
import { DisclosureIcon, ICON_SM } from '../lib/icons';
import type { EventBlock } from '../lib/types';

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

export function EventContent({ blocks }: { blocks: EventBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div>
      {blocks.map((block) => {
        switch (block.type) {
          case 'text':
            return <TextBlock key={block.id} title={block.title} body={block.body} />;
          case 'image':
            return <ImageBlock key={block.id} url={block.url} caption={block.caption} />;
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
