// Wizard step 5: sponsor slots (up to 6).

import { Button, Card, EmptyState, FormField, SponsorStrip } from '../../components/ui';
import { SponsorIcon, MoveUpIcon, MoveDownIcon, ICON_SM } from '../../lib/icons';
import { ImageUpload } from '../../components/ImageUpload';
import { useToast } from '../../components/toast-context';
import { makeId, updateEvent } from '../../lib/store';
import type { RoundmarkEvent, Sponsor } from '../../lib/types';

const MAX_SPONSORS = 6;

export default function SponsorsStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();

  function addSponsor() {
    if (event.sponsors.length >= MAX_SPONSORS) {
      toast(`Up to ${MAX_SPONSORS} sponsors are supported`, 'error');
      return;
    }
    updateEvent(event.id, (e) => {
      e.sponsors.push({ id: makeId(), name: '', slot: e.sponsors.length + 1 });
    });
  }

  function patchSponsor(id: string, patch: Partial<Sponsor>) {
    updateEvent(event.id, (e) => {
      const s = e.sponsors.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    });
  }

  function removeSponsor(id: string) {
    updateEvent(event.id, (e) => {
      e.sponsors = e.sponsors.filter((x) => x.id !== id);
      e.sponsors.forEach((s, i) => (s.slot = i + 1));
    });
  }

  function move(id: string, dir: -1 | 1) {
    updateEvent(event.id, (e) => {
      const sorted = [...e.sponsors].sort((a, b) => a.slot - b.slot);
      const idx = sorted.findIndex((s) => s.id === id);
      const swap = sorted[idx + dir];
      if (!swap) return;
      const tmp = sorted[idx].slot;
      sorted[idx].slot = swap.slot;
      swap.slot = tmp;
    });
  }

  const sorted = [...event.sponsors].sort((a, b) => a.slot - b.slot);

  return (
    <div className="stack-6">
      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>Sponsors</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Sponsors appear on the scorecards, leaderboard and TV mode. Up to {MAX_SPONSORS} slots.
          </p>
        </div>
        <Button onClick={addSponsor} disabled={event.sponsors.length >= MAX_SPONSORS}>
          + Add sponsor
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={SponsorIcon}
          title="No sponsors yet"
          body="Optional — but a great way to make sponsor-backed and charity days feel professional."
          action={<Button onClick={addSponsor}>Add the first sponsor</Button>}
        />
      ) : (
        <>
          <div className="stack-4">
            {sorted.map((s, i) => (
              <Card key={s.id}>
                <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', width: 56 }}>
                    #{s.slot}
                  </div>
                  <div className="grow" style={{ minWidth: 180 }}>
                    <FormField
                      label="Sponsor name"
                      required
                      value={s.name}
                      onChange={(e) => patchSponsor(s.id, { name: e.target.value })}
                      wrapClassName=""
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div className="grow" style={{ minWidth: 180 }}>
                    <ImageUpload
                      label="Logo"
                      value={s.logoUrl}
                      onChange={(url) => patchSponsor(s.id, { logoUrl: url })}
                      pathPrefix={`${event.id}/sponsors`}
                    />
                  </div>
                  <div className="grow" style={{ minWidth: 180 }}>
                    <FormField
                      label="Website"
                      placeholder="https://… (optional)"
                      value={s.websiteUrl ?? ''}
                      onChange={(e) => patchSponsor(s.id, { websiteUrl: e.target.value || undefined })}
                    />
                  </div>
                  <div className="row" style={{ paddingBottom: 'var(--space-5)' }}>
                    <Button size="sm" variant="ghost" onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="Move sponsor up">
                      <MoveUpIcon size={ICON_SM} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => move(s.id, 1)} disabled={i === sorted.length - 1} aria-label="Move sponsor down">
                      <MoveDownIcon size={ICON_SM} />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeSponsor(s.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div>
            <h4>Preview</h4>
            <SponsorStrip sponsors={sorted.filter((s) => s.name)} />
          </div>
        </>
      )}
    </div>
  );
}
