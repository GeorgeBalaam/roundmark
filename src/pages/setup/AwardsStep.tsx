// Wizard step: define the day's awards & prizes (optional). Presets (nearest pin,
// longest drive, overall winners, most birdies, wooden spoon) for two-click add,
// plus a custom award. Each award can carry a prize. Winners are assigned later
// on the day from the Console (auto awards compute themselves from the standings).

import { Badge, Button, Card, EmptyState, FormField } from '../../components/ui';
import { AddIcon, CloseIcon, TrophyIcon, ICON_SM } from '../../lib/icons';
import { makeId, updateEvent } from '../../lib/store';
import { isManualAward } from '../../lib/awards';
import type { Award, AwardPreset, RoundmarkEvent } from '../../lib/types';
import { AWARD_PRESETS, AWARD_SOURCE_LABEL } from '../../lib/types';

export default function AwardsStep({ event }: { event: RoundmarkEvent }) {
  const awards = event.awards ?? [];

  function setAwards(next: Award[]) {
    updateEvent(event.id, (e) => { e.awards = next; });
  }
  function addPreset(p: AwardPreset) {
    setAwards([...awards, { id: makeId(), title: p.title, source: p.source, prize: '' }]);
  }
  function addCustom() {
    setAwards([...awards, { id: makeId(), title: '', source: 'manual', prize: '' }]);
  }
  function remove(id: string) { setAwards(awards.filter((a) => a.id !== id)); }
  function replace(updated: Award) {
    setAwards(awards.map((a) => (a.id === updated.id ? updated : a)));
  }

  return (
    <div className="stack-6" style={{ maxWidth: 720 }}>
      <Card padLg soft>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Awards &amp; prizes</h3>
        <p className="text-muted" style={{ margin: 0 }}>
          Optional, but they make the day. Add the awards you'll give out and the prizes up for grabs —
          they show on your event page to drum up entries, and on the results at the end. Winners are
          set on the day; the auto ones work themselves out from the leaderboard.
        </p>
      </Card>

      {awards.length === 0 && (
        <EmptyState icon={TrophyIcon} title="No awards yet" body="Add one below — most days have nearest the pin, longest drive and overall winners." />
      )}

      <div className="stack-4">
        {awards.map((award) => (
          <Card key={award.id}>
            <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
              <Badge tone={isManualAward(award) ? 'amber' : 'green'}>{AWARD_SOURCE_LABEL[award.source]}</Badge>
              <Button size="sm" variant="ghost" aria-label="Remove award" onClick={() => remove(award.id)}>
                <CloseIcon size={ICON_SM} />
              </Button>
            </div>
            <div className="stack-3">
              <FormField
                label="Award"
                placeholder="e.g. Nearest the Pin, Best Swing, Wooden Spoon"
                value={award.title}
                onChange={(e) => replace({ ...award, title: e.target.value })}
              />
              <div className="form-grid">
                <FormField
                  label="Prize (optional)"
                  placeholder="e.g. DeWalt drill, £1,000 to a charity of choice"
                  value={award.prize ?? ''}
                  onChange={(e) => replace({ ...award, prize: e.target.value || undefined })}
                />
                {isManualAward(award) && (
                  <FormField
                    label="Hole (optional)"
                    type="number"
                    min={1}
                    max={event.holes.length}
                    placeholder="e.g. 7"
                    value={award.hole ?? ''}
                    onChange={(e) => replace({ ...award, hole: e.target.value ? Number(e.target.value) : undefined })}
                  />
                )}
              </div>
              {!isManualAward(award) && (
                <p className="text-small text-muted" style={{ margin: 0 }}>
                  Winner is decided automatically from the leaderboard.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card soft>
        <div className="text-small" style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Add an award</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {AWARD_PRESETS.map((p) => (
            <Button key={p.key} size="sm" variant="secondary" onClick={() => addPreset(p)} title={p.description}>
              <AddIcon size={ICON_SM} /> {p.title}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={addCustom}>
            <AddIcon size={ICON_SM} /> Custom award
          </Button>
        </div>
      </Card>
    </div>
  );
}
