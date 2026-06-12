// Wizard step 1: basic event info.

import { Card, FormField, SelectField } from '../../components/ui';
import { updateEvent } from '../../lib/store';
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
        <FormField
          label="Branding colour"
          type="color"
          hint="Used on the public event pages."
          value={event.brandColor ?? '#27542A'}
          onChange={(e) => set('brandColor', e.target.value)}
          style={{ padding: 4, height: 44 }}
        />
        <FormField
          label="Logo URL"
          placeholder="https://… (optional)"
          hint="Shown on the leaderboard and scorecards. Upload support is coming later."
          value={event.logoUrl ?? ''}
          onChange={(e) => set('logoUrl', e.target.value || undefined)}
        />
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
    </Card>
  );
}
