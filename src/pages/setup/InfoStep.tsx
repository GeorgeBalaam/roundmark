// Wizard step 1: basic event info.

import { Card, FormField, SelectField } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { updateEvent } from '../../lib/store';
import { readableTextOn } from '../../lib/theme';
import type { EventType, RoundmarkEvent, ScoringFormat } from '../../lib/types';
import { EVENT_TYPE_LABELS, FORMAT_LABELS } from '../../lib/types';

export default function InfoStep({ event }: { event: RoundmarkEvent }) {
  function set<K extends keyof RoundmarkEvent>(key: K, value: RoundmarkEvent[K]) {
    updateEvent(event.id, (e) => {
      e[key] = value;
    });
  }

  return (
    <Card padLg style={{ maxWidth: 860 }}>
      <h3 style={{ marginBottom: 'var(--space-6)' }}>Basic info</h3>
      <div className="form-grid">
        <FormField
          label="Event name"
          required
          placeholder="e.g. Northbeam Summer Golf Day"
          value={event.name}
          onChange={(e) => set('name', e.target.value)}
          wrapClassName="span-2"
        />
        <FormField
          label="Date"
          type="date"
          required
          value={event.date}
          onChange={(e) => set('date', e.target.value)}
        />
        <FormField
          label="Venue / course name"
          required
          placeholder="e.g. Fairhaven Golf Club"
          value={event.venue}
          onChange={(e) => set('venue', e.target.value)}
        />
        <SelectField
          label="Event type"
          value={event.type}
          onChange={(e) => set('type', e.target.value as EventType)}
          options={Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Scoring format"
          hint={
            event.format === 'scramble'
              ? 'One team score per hole — great for mixed-ability groups.'
              : event.format === 'stableford'
                ? 'Points per hole — a bad hole never ruins the day.'
                : 'Classic gross strokes — lowest total wins.'
          }
          value={event.format}
          onChange={(e) => set('format', e.target.value as ScoringFormat)}
          options={Object.entries(FORMAT_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {event.format !== 'scramble' && (
          <SelectField
            label="Handicap scoring"
            hint={
              (event.scoringMode ?? 'gross') === 'net'
                ? 'Net — strokes allocated by handicap and stroke index.'
                : 'Gross — raw scores, no handicap applied.'
            }
            value={event.scoringMode ?? 'gross'}
            onChange={(e) => set('scoringMode', e.target.value as 'gross' | 'net')}
            options={[
              { value: 'net', label: 'Net (handicap)' },
              { value: 'gross', label: 'Gross (scratch)' },
            ]}
          />
        )}
        <FormField
          label="Charity name"
          placeholder="Optional"
          value={event.charityName ?? ''}
          onChange={(e) => set('charityName', e.target.value || undefined)}
        />
        <FormField
          label="Charity URL"
          placeholder="https://… (optional)"
          value={event.charityUrl ?? ''}
          onChange={(e) => set('charityUrl', e.target.value || undefined)}
        />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--rm-border-soft)', margin: 'var(--space-8) 0 var(--space-6)' }} />

      <h3 style={{ marginBottom: 4 }}>Branding</h3>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-6)' }}>
        Colours and logo are applied to your public leaderboard, scorecards and results.
      </p>

      <div className="form-grid">
        <FormField
          label="Primary colour"
          type="color"
          hint="Headers & buttons."
          value={event.brandColor ?? '#27542A'}
          onChange={(e) => set('brandColor', e.target.value)}
          style={{ padding: 4, height: 44 }}
        />
        <FormField
          label="Accent colour"
          type="color"
          hint="Highlights & scores."
          value={event.accentColor ?? '#8DB259'}
          onChange={(e) => set('accentColor', e.target.value)}
          style={{ padding: 4, height: 44 }}
        />
        <FormField
          label="Background colour"
          type="color"
          hint="Page background."
          value={event.bgColor ?? '#F7F3EA'}
          onChange={(e) => set('bgColor', e.target.value)}
          style={{ padding: 4, height: 44 }}
        />
        <ImageUpload
          label="Event logo"
          hint="PNG/SVG, under 2 MB. Shown on the leaderboard and scorecards."
          value={event.logoUrl}
          onChange={(url) => set('logoUrl', url)}
          pathPrefix={event.id}
        />
      </div>

      {/* Live brand preview */}
      <div
        style={{
          marginTop: 'var(--space-6)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          border: '1px solid var(--rm-border)',
          background: event.bgColor ?? '#F7F3EA',
        }}
      >
        <div
          style={{
            background: event.brandColor ?? '#27542A',
            color: readableTextOn(event.brandColor ?? '#27542A'),
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
          }}
        >
          {event.logoUrl && (
            <img src={event.logoUrl} alt="" style={{ height: 24, width: 'auto' }} />
          )}
          {event.name || 'Your event'} — Live leaderboard
        </div>
        <div className="row" style={{ padding: 'var(--space-4) var(--space-5)', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Birdie Brigade</span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '1.3rem',
              color: event.accentColor ?? '#8DB259',
            }}
          >
            58
          </span>
        </div>
      </div>
    </Card>
  );
}
