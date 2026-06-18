// Wizard step 2: course / hole setup.

import { Badge, Button, Card } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { CheckIcon, ICON_SM } from '../../lib/icons';
import { PAR_72_TEMPLATE } from '../../lib/seed';
import { updateEvent } from '../../lib/store';
import type { RoundmarkEvent } from '../../lib/types';

export default function CourseStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();

  function setHole(index: number, field: 'par' | 'strokeIndex', value: number) {
    updateEvent(event.id, (e) => {
      e.holes[index] = { ...e.holes[index], [field]: value };
    });
  }

  function applyTemplate() {
    updateEvent(event.id, (e) => {
      e.holes = PAR_72_TEMPLATE.map((h) => ({ ...h }));
    });
    toast('Standard par-72 template applied', 'success');
  }

  function setHoleCount(count: 9 | 18) {
    updateEvent(event.id, (e) => {
      if (count === 9) {
        e.holes = e.holes.slice(0, 9).map((h, i) => ({ ...h, strokeIndex: Math.min(h.strokeIndex, 9) || i + 1 }));
      } else {
        e.holes = PAR_72_TEMPLATE.map((h, i) => e.holes[i] ?? { ...h });
      }
    });
  }

  const totalPar = event.holes.reduce((s, h) => s + (h.par || 0), 0);
  const maxSI = event.holes.length;
  const problems: string[] = [];
  const siSeen = new Set<number>();
  event.holes.forEach((h) => {
    if (!h.par || h.par < 3 || h.par > 6) problems.push(`Hole ${h.number}: par should be between 3 and 6.`);
    if (!h.strokeIndex || h.strokeIndex < 1 || h.strokeIndex > maxSI)
      problems.push(`Hole ${h.number}: stroke index should be between 1 and ${maxSI}.`);
    else if (siSeen.has(h.strokeIndex)) problems.push(`Stroke index ${h.strokeIndex} is used more than once.`);
    siSeen.add(h.strokeIndex);
  });

  return (
    <div className="stack-6">
      <Card padLg>
        <div className="row-between" style={{ marginBottom: 'var(--space-5)' }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Course setup</h3>
            <p className="text-muted" style={{ margin: 0 }}>
              Set the par and stroke index for each hole. Total par: <strong>{totalPar}</strong>
            </p>
          </div>
          <div className="row">
            <Button variant="secondary" size="sm" onClick={() => setHoleCount(event.holes.length === 18 ? 9 : 18)}>
              Switch to {event.holes.length === 18 ? '9' : '18'} holes
            </Button>
            <Button variant="secondary" size="sm" onClick={applyTemplate}>
              Use standard par-72 template
            </Button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" aria-label="Holes">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Par</th>
                <th>Stroke index</th>
              </tr>
            </thead>
            <tbody>
              {event.holes.map((hole, i) => (
                <tr key={hole.number}>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{hole.number}</td>
                  <td>
                    <select
                      className="select"
                      style={{ width: 90, minHeight: 38, padding: '6px 10px' }}
                      value={hole.par}
                      aria-label={`Hole ${hole.number} par`}
                      onChange={(e) => setHole(i, 'par', Number(e.target.value))}
                    >
                      {[3, 4, 5, 6].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ width: 90, minHeight: 38, padding: '6px 10px' }}
                      type="number"
                      min={1}
                      max={maxSI}
                      value={hole.strokeIndex}
                      aria-label={`Hole ${hole.number} stroke index`}
                      onChange={(e) => setHole(i, 'strokeIndex', Number(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {problems.length > 0 ? (
        <Card soft>
          <Badge tone="amber">Needs attention</Badge>
          <ul className="text-small" style={{ margin: 'var(--space-3) 0 0', paddingLeft: 18, color: 'var(--rm-muted)' }}>
            {problems.slice(0, 6).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {problems.length > 6 && <li>…and {problems.length - 6} more.</li>}
          </ul>
        </Card>
      ) : (
        <div>
          <Badge tone="green"><CheckIcon size={ICON_SM} /> All holes have a par and stroke index</Badge>
        </div>
      )}
    </div>
  );
}
