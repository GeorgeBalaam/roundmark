// Wizard step: compose the public event page (/e/:id) — hero image + ordered
// content blocks (text, image, schedule, FAQ). Everything saves on change.

import { Button, Card, FormField, TextAreaField } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import {
  AddIcon, CloseIcon, MoveUpIcon, MoveDownIcon, EventIcon, ICON_SM,
} from '../../lib/icons';
import { makeId, updateEvent } from '../../lib/store';
import { eventLandingUrl } from '../../lib/links';
import type { EventBlock, EventBlockType, RoundmarkEvent } from '../../lib/types';
import { EVENT_BLOCK_LABELS } from '../../lib/types';

function newBlock(type: EventBlockType): EventBlock {
  const id = makeId();
  switch (type) {
    case 'text': return { id, type: 'text', title: '', body: '' };
    case 'image': return { id, type: 'image', url: '', caption: '' };
    case 'schedule': return { id, type: 'schedule', title: 'Schedule', items: [] };
    case 'faq': return { id, type: 'faq', title: 'FAQs', items: [] };
  }
}

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
    <div className="stack-6" style={{ maxWidth: 760 }}>
      <Card padLg>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Hero image</h3>
        <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
          A wide photo (a fairway, clubhouse or last year's group) shown behind your event name. Optional.
        </p>
        <ImageUpload
          label="Hero background"
          hint="Landscape image, under 2 MB. Text sits on a darkened overlay so it stays readable."
          value={event.heroImageUrl}
          onChange={(url) => updateEvent(event.id, (e) => { e.heroImageUrl = url; })}
          pathPrefix={`${event.id}/page`}
        />
      </Card>

      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>Page content</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Build the public event page players see before the day. Drag-free reordering with the arrows.
          </p>
        </div>
        <Button variant="secondary" size="sm" to={eventLandingUrl(event.id)}>
          <EventIcon size={ICON_SM} /> View page
        </Button>
      </div>

      {blocks.length === 0 && (
        <Card soft style={{ textAlign: 'center' }}>
          <p className="text-muted" style={{ margin: 0 }}>
            No sections yet. Add a welcome message, the day's schedule, photos or FAQs below.
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
          {(['text', 'image', 'schedule', 'faq'] as EventBlockType[]).map((t) => (
            <Button key={t} size="sm" variant="secondary" onClick={() => add(t)}>
              <AddIcon size={ICON_SM} /> {EVENT_BLOCK_LABELS[t]}
            </Button>
          ))}
        </div>
      </Card>
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
