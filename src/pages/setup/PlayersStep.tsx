// Wizard step 3: player management — manual add, paste/CSV import, edit, delete.

import { useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, FormField, SelectField, TextAreaField } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { TeamsIcon, DownloadIcon, ICON_SM } from '../../lib/icons';
import { PLAYER_IMPORT_SAMPLE, parsePlayerImport, downloadCSV } from '../../lib/csv';
import { syncScorecards } from '../../lib/events';
import { makeId, updateEvent } from '../../lib/store';
import type { Player, RoundmarkEvent } from '../../lib/types';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  handicap: '',
  dietary: '',
  role: '',
};

type PlayerForm = typeof EMPTY_FORM;

function toPlayer(form: PlayerForm, id?: string): Player {
  return {
    id: id ?? makeId(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim() || undefined,
    company: form.company.trim() || undefined,
    handicap: form.handicap === '' ? null : Number(form.handicap),
    dietary: form.dietary.trim() || undefined,
    role: form.role === 'host' ? 'host' : form.role === 'guest' ? 'guest' : null,
  };
}

function toForm(p: Player): PlayerForm {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email ?? '',
    company: p.company ?? '',
    handicap: p.handicap === null || p.handicap === undefined ? '' : String(p.handicap),
    dietary: p.dietary ?? '',
    role: p.role ?? '',
  };
}

export default function PlayersStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();
  const [form, setForm] = useState<PlayerForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const formError =
    form.handicap !== '' && Number.isNaN(Number(form.handicap)) ? 'Handicap must be a number.' : undefined;

  function submitForm() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('A first and last name are needed', 'error');
      return;
    }
    if (formError) return;
    updateEvent(event.id, (e) => {
      if (editingId) {
        const idx = e.players.findIndex((p) => p.id === editingId);
        if (idx !== -1) e.players[idx] = toPlayer(form, editingId);
      } else {
        e.players.push(toPlayer(form));
      }
    });
    toast(editingId ? 'Player updated' : 'Player added', 'success');
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function removePlayer(id: string) {
    updateEvent(event.id, (e) => {
      e.players = e.players.filter((p) => p.id !== id);
      e.teams = e.teams.map((t) => ({ ...t, playerIds: t.playerIds.filter((pid) => pid !== id) }));
      syncScorecards(e);
    });
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  function runImport(text: string) {
    const { players, errors } = parsePlayerImport(text);
    setImportErrors(errors);
    if (players.length > 0) {
      updateEvent(event.id, (e) => {
        e.players.push(...players);
      });
      toast(`${players.length} player${players.length === 1 ? '' : 's'} imported`, 'success');
      setImportText('');
    } else if (errors.length === 0) {
      setImportErrors(['Nothing to import — paste one player per line.']);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => runImport(String(reader.result ?? ''));
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="stack-6">
      <div className="row-between">
        <h3 style={{ margin: 0 }}>
          Players <Badge tone="green">{event.players.length}</Badge>
        </h3>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* Manual add / edit */}
        <Card padLg>
          <h4 style={{ marginBottom: 'var(--space-5)' }}>{editingId ? 'Edit player' : 'Add a player'}</h4>
          <div className="form-grid">
            <FormField label="First name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <FormField label="Last name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <FormField label="Email" type="email" placeholder="Optional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <FormField label="Company" placeholder="Optional" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <FormField
              label="Handicap"
              placeholder="Optional"
              inputMode="decimal"
              error={formError}
              value={form.handicap}
              onChange={(e) => setForm({ ...form, handicap: e.target.value })}
            />
            <SelectField
              label="Host / guest"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={[
                { value: '', label: 'Not set' },
                { value: 'host', label: 'Host' },
                { value: 'guest', label: 'Guest' },
              ]}
            />
            <FormField
              label="Dietary notes"
              placeholder="Optional"
              wrapClassName="span-2"
              value={form.dietary}
              onChange={(e) => setForm({ ...form, dietary: e.target.value })}
            />
          </div>
          <div className="row">
            <Button onClick={submitForm}>{editingId ? 'Save changes' : 'Add player'}</Button>
            {editingId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </Card>

        {/* Import */}
        <Card padLg soft>
          <h4 style={{ marginBottom: 'var(--space-3)' }}>Import a list</h4>
          <p className="text-small text-muted">
            Paste from a spreadsheet (or upload a CSV). One player per line:{' '}
            <em>First name, Last name, Email, Company, Handicap, Host/Guest</em>.
          </p>
          <TextAreaField
            label="Paste players"
            placeholder={PLAYER_IMPORT_SAMPLE}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importErrors.length > 0 && (
            <div className="field-error" style={{ marginBottom: 'var(--space-4)' }}>
              {importErrors.map((err) => (
                <div key={err}>{err}</div>
              ))}
            </div>
          )}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => runImport(importText)} disabled={!importText.trim()}>
              Import pasted list
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Upload CSV file
            </Button>
            <Button variant="ghost" onClick={() => downloadCSV('roundmark-players-template.csv', PLAYER_IMPORT_SAMPLE)}>
              <DownloadIcon size={ICON_SM} /> Download template
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setImportText(PLAYER_IMPORT_SAMPLE)}>
              Show sample
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ display: 'none' }}
              aria-label="Upload player CSV"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        </Card>
      </div>

      {/* Player list */}
      {event.players.length === 0 ? (
        <EmptyState
          icon={TeamsIcon}
          title="No players yet"
          body="Add players one at a time or paste a whole list from your spreadsheet."
        />
      ) : (
        <div className="table-panel table-scroll">
          <table className="data-table" aria-label="Players">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th className="num">Handicap</th>
                <th>Host/Guest</th>
                <th>Dietary</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {event.players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>
                      {p.firstName} {p.lastName}
                    </strong>
                    {p.email && <div className="text-small text-muted">{p.email}</div>}
                  </td>
                  <td className="text-muted">{p.company ?? '—'}</td>
                  <td className="num">{p.handicap ?? '—'}</td>
                  <td>{p.role ? <Badge tone={p.role === 'host' ? 'green' : 'grey'}>{p.role === 'host' ? 'Host' : 'Guest'}</Badge> : '—'}</td>
                  <td className="text-muted text-small">{p.dietary ?? '—'}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(p.id);
                          setForm(toForm(p));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => removePlayer(p.id)}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
