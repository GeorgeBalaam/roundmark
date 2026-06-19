// Wizard step: compose the public event page (/e/:id) — hero image + tagline +
// ordered content blocks (text, image, text+image, CTA, video, venue, schedule,
// FAQ). A live preview on the right (desktop) renders the real page components,
// so it can never drift from production. Everything saves on change.

import { useState } from 'react';
import { Button, Card, FormField, SelectField, SponsorStrip, TextAreaField } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { EventPageHero } from '../../components/EventPageHero';
import { EventContent } from '../../components/EventContent';
import {
  AddIcon, CloseIcon, MoveUpIcon, MoveDownIcon, EventIcon, ICON_SM,
} from '../../lib/icons';
import { makeId, updateEvent } from '../../lib/store';
import { eventLandingUrl, eventLandingPath } from '../../lib/links';
import { eventThemeVars } from '../../lib/theme';
import { parseVideoUrl } from '../../lib/video';
import type { EventBlock, EventBlockType, RoundmarkEvent } from '../../lib/types';
import { EVENT_BLOCK_LABELS } from '../../lib/types';

function newBlock(type: EventBlockType): EventBlock {
  const id = makeId();
  switch (type) {
    case 'text': return { id, type: 'text', title: '', body: '' };
    case 'image': return { id, type: 'image', url: '', caption: '' };
    case 'feature': return { id, type: 'feature', title: '', body: '', url: '', imageSide: 'left' };
    case 'cta': return { id, type: 'cta', title: '', body: '', label: '', href: '' };
    case 'video': return { id, type: 'video', provider: 'youtube', videoId: '', title: '' };
    case 'venue': return { id, type: 'venue', title: 'Getting there', address: '', mapUrl: '' };
    case 'schedule': return { id, type: 'schedule', title: 'Schedule', items: [] };
    case 'faq': return { id, type: 'faq', title: 'FAQs', items: [] };
  }
}

const BLOCK_PALETTE: EventBlockType[] = ['text', 'feature', 'image', 'cta', 'video', 'venue', 'schedule', 'faq'];

export default function PageStep({ event }: { event: RoundmarkEvent }) {
  const blocks = event.content ?? [];

  function setBlocks(next: EventBlock[]) {
    updateEvent(event.id, (e) => { e.content = next; });
  }
  function add(type: EventBlockType) { setBlocks([...blocks, newBlock(type)]); }
  function remove(id: string) { setBlocks(blocks.filter((b) => b.id !== id)); }
  function replace(updated: EventBlock) {
    setBlocks(blocks.map((b) => (b.id === updated.id ? updated : b)));
  }
  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  return (
    <div className="page-builder">
      {/* Editor column */}
      <div className="stack-6">
        <Card padLg>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Hero</h3>
          <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
            The banner behind your event name. A wide photo and a short strapline are optional.
          </p>
          <ImageUpload
            label="Hero background"
            hint="Landscape image, under 2 MB. Text sits on a darkened overlay so it stays readable."
            value={event.heroImageUrl}
            onChange={(url) => updateEvent(event.id, (e) => { e.heroImageUrl = url; })}
            pathPrefix={`${event.id}/page`}
          />
          <FormField
            label="Tagline"
            placeholder="e.g. Our biggest day yet — play, network, raise money."
            hint="One line shown under the date and venue."
            value={event.heroTagline ?? ''}
            onChange={(e) => updateEvent(event.id, (ev) => { ev.heroTagline = e.target.value || undefined; })}
          />
        </Card>

        <div className="row-between">
          <div>
            <h3 style={{ margin: 0 }}>Page content</h3>
            <p className="text-muted" style={{ margin: '4px 0 0' }}>
              Build the page players see before the day. Reorder with the arrows.
            </p>
          </div>
          <Button variant="secondary" size="sm" href={eventLandingUrl(event.id)}>
            <EventIcon size={ICON_SM} /> View page
          </Button>
        </div>

        {blocks.length === 0 && (
          <Card soft style={{ textAlign: 'center' }}>
            <p className="text-muted" style={{ margin: 0 }}>
              No sections yet. Add a welcome message, a text + image tile, the day's schedule, photos, a video or FAQs below.
            </p>
          </Card>
        )}

        <div className="stack-4">
          {blocks.map((block, i) => (
            <Card key={block.id}>
              <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="text-small" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--rm-muted)' }}>
                  {EVENT_BLOCK_LABELS[block.type]}
                </span>
                <div className="row">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(block.id, -1)} aria-label="Move up">
                    <MoveUpIcon size={ICON_SM} />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === blocks.length - 1} onClick={() => move(block.id, 1)} aria-label="Move down">
                    <MoveDownIcon size={ICON_SM} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(block.id)} aria-label="Remove section">
                    <CloseIcon size={ICON_SM} />
                  </Button>
                </div>
              </div>
              <BlockEditor block={block} eventId={event.id} onChange={replace} />
            </Card>
          ))}
        </div>

        <Card soft>
          <div className="text-small" style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Add a section</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {BLOCK_PALETTE.map((t) => (
              <Button key={t} size="sm" variant="secondary" onClick={() => add(t)}>
                <AddIcon size={ICON_SM} /> {EVENT_BLOCK_LABELS[t]}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {/* Live preview column (desktop only) */}
      <div className="page-builder-preview">
        <div className="text-small" style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--rm-muted)' }}>
          Live preview
        </div>
        <div className="preview-frame">
          <div className="preview-chrome">
            <span className="dot" /><span className="dot" /><span className="dot" />
            <span className="preview-url">{eventLandingPath(event.id)}</span>
          </div>
          <div className="preview-scroll" style={{ ...eventThemeVars(event), background: 'var(--rm-bg)' }}>
            <EventPageHero event={event} preview />
            <div className="container" style={{ maxWidth: 720, paddingTop: 'var(--space-6)' }}>
              {event.registration?.note && (
                <p style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>{event.registration.note}</p>
              )}
              <EventContent blocks={blocks} />
              {event.sponsors.length > 0 && <SponsorStrip sponsors={event.sponsors} />}
            </div>
            <div className="preview-stub">Registration form appears here (configured on the Sign-ups step).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ block, eventId, onChange }: { block: EventBlock; eventId: string; onChange: (b: EventBlock) => void }) {
  if (block.type === 'text') {
    return (
      <div className="stack-3">
        <FormField label="Heading" placeholder="e.g. Welcome" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
        <TextAreaField label="Text" rows={4} placeholder="Tell players what to expect…" value={block.body} onChange={(e) => onChange({ ...block, body: e.target.value })} />
      </div>
    );
  }
  if (block.type === 'image') {
    return (
      <div className="stack-3">
        <ImageUpload label="Image" value={block.url || undefined} onChange={(url) => onChange({ ...block, url: url ?? '' })} pathPrefix={`${eventId}/page`} />
        <FormField label="Caption" placeholder="Optional" value={block.caption ?? ''} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
      </div>
    );
  }
  if (block.type === 'feature') {
    return (
      <div className="stack-3">
        <FormField label="Heading" placeholder="e.g. About the venue" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
        <TextAreaField label="Text" rows={4} placeholder="A paragraph beside the image…" value={block.body} onChange={(e) => onChange({ ...block, body: e.target.value })} />
        <ImageUpload label="Image" value={block.url || undefined} onChange={(url) => onChange({ ...block, url: url ?? '' })} pathPrefix={`${eventId}/page`} />
        <SelectField
          label="Image position"
          value={block.imageSide}
          options={[{ value: 'left', label: 'Image on the left' }, { value: 'right', label: 'Image on the right' }]}
          onChange={(e) => onChange({ ...block, imageSide: e.target.value as 'left' | 'right' })}
        />
      </div>
    );
  }
  if (block.type === 'cta') {
    return (
      <div className="stack-3">
        <FormField label="Heading" placeholder="e.g. Support our charity" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
        <TextAreaField label="Text" rows={2} placeholder="Optional supporting line" value={block.body ?? ''} onChange={(e) => onChange({ ...block, body: e.target.value })} />
        <div className="form-grid">
          <FormField label="Button label" placeholder="e.g. Donate now" value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} />
          <FormField label="Button link" placeholder="https://…" value={block.href} onChange={(e) => onChange({ ...block, href: e.target.value })} />
        </div>
      </div>
    );
  }
  if (block.type === 'video') {
    return <VideoBlockEditor block={block} onChange={onChange} />;
  }
  if (block.type === 'venue') {
    return (
      <div className="stack-3">
        <FormField label="Heading" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
        <TextAreaField label="Address" rows={3} placeholder="Demo Fairway Golf Club, …" value={block.address} onChange={(e) => onChange({ ...block, address: e.target.value })} />
        <FormField label="Map link (optional)" placeholder="Leave blank to auto-link to Google Maps" value={block.mapUrl ?? ''} onChange={(e) => onChange({ ...block, mapUrl: e.target.value })} />
      </div>
    );
  }
  if (block.type === 'schedule') {
    return (
      <div className="stack-3">
        <FormField label="Heading" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
        {block.items.map((it) => (
          <div key={it.id} className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: 120 }} placeholder="09:00" value={it.time}
              onChange={(e) => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, time: e.target.value } : x)) })} />
            <input className="input grow" placeholder="Registration & bacon rolls" value={it.label}
              onChange={(e) => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)) })} />
            <Button size="sm" variant="ghost" aria-label="Remove item" onClick={() => onChange({ ...block, items: block.items.filter((x) => x.id !== it.id) })}>
              <CloseIcon size={ICON_SM} />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => onChange({ ...block, items: [...block.items, { id: makeId(), time: '', label: '' }] })}>
          <AddIcon size={ICON_SM} /> Add time
        </Button>
      </div>
    );
  }
  // faq
  return (
    <div className="stack-3">
      <FormField label="Heading" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
      {block.items.map((it) => (
        <div key={it.id} className="stack-2" style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--rm-border-soft)' }}>
          <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
            <input className="input grow" placeholder="Question" value={it.q}
              onChange={(e) => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, q: e.target.value } : x)) })} />
            <Button size="sm" variant="ghost" aria-label="Remove question" onClick={() => onChange({ ...block, items: block.items.filter((x) => x.id !== it.id) })}>
              <CloseIcon size={ICON_SM} />
            </Button>
          </div>
          <textarea className="textarea" rows={2} placeholder="Answer" value={it.a}
            onChange={(e) => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, a: e.target.value } : x)) })} />
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange({ ...block, items: [...block.items, { id: makeId(), q: '', a: '' }] })}>
        <AddIcon size={ICON_SM} /> Add question
      </Button>
    </div>
  );
}

// Video editor keeps the raw pasted URL in local state and only commits a
// recognised provider + id to the block (junk URLs surface an inline error).
function VideoBlockEditor({ block, onChange }: { block: Extract<EventBlock, { type: 'video' }>; onChange: (b: EventBlock) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function applyUrl(value: string) {
    setUrl(value);
    if (!value.trim()) { setError(null); return; }
    const parsed = parseVideoUrl(value);
    if (!parsed) {
      setError('Not a recognised YouTube or Vimeo link.');
      return;
    }
    setError(null);
    onChange({ ...block, provider: parsed.provider, videoId: parsed.videoId });
  }

  return (
    <div className="stack-3">
      <FormField label="Heading" value={block.title ?? ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
      <FormField
        label="YouTube or Vimeo URL"
        placeholder="https://www.youtube.com/watch?v=…"
        value={url}
        error={error ?? undefined}
        onChange={(e) => applyUrl(e.target.value)}
      />
      {block.videoId && (
        <p className="text-small text-muted" style={{ margin: 0 }}>
          ✓ {block.provider === 'youtube' ? 'YouTube' : 'Vimeo'} video linked. The player shows in the preview.
        </p>
      )}
    </div>
  );
}
