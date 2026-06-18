// Wizard step: public registration settings + the approval queue.
// Organisers choose which fields to capture, open/close sign-ups, share the
// landing link, and approve/decline registrations (approval adds a player).

import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Badge, Button, Card, EmptyState, TextAreaField } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { RegistrationIcon } from '../../lib/icons';
import {
  fetchRegistrations,
  updateEvent,
  useRegistrations,
  useSession,
} from '../../lib/store';
import { approveRegistration, declineRegistration } from '../../lib/events';
import { eventLandingPath, eventLandingUrl } from '../../lib/links';
import { DEFAULT_REGISTRATION_FIELDS, REGISTRATION_FIELD_LABELS } from '../../lib/types';
import type { RegistrationFieldKey, RoundmarkEvent } from '../../lib/types';

const OPTIONAL_FIELDS: RegistrationFieldKey[] = ['company', 'handicap', 'dietary', 'phone'];

export default function RegistrationsStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();
  const session = useSession();
  const registrations = useRegistrations(event.id);
  const reg = event.registration ?? {
    open: false,
    autoApprove: false,
    fields: DEFAULT_REGISTRATION_FIELDS.map((f) => ({ ...f })),
  };

  // Load any sign-ups from the backend for the owner.
  useEffect(() => {
    void fetchRegistrations(event.id);
  }, [event.id]);

  const url = eventLandingUrl(event.id);
  const pending = registrations.filter((r) => r.status === 'pending');
  const approved = registrations.filter((r) => r.status === 'approved');
  const declined = registrations.filter((r) => r.status === 'declined');

  function patch(next: Partial<typeof reg>) {
    updateEvent(event.id, (e) => {
      e.registration = { ...reg, ...next };
    });
  }

  function toggleField(key: RegistrationFieldKey, change: { show?: boolean; required?: boolean }) {
    updateEvent(event.id, (e) => {
      const fields = (e.registration?.fields ?? DEFAULT_REGISTRATION_FIELDS).map((f) =>
        f.key === key ? { ...f, ...change } : f,
      );
      e.registration = { ...reg, fields };
    });
  }

  function fieldCfg(key: RegistrationFieldKey) {
    return reg.fields.find((f) => f.key === key) ?? { key, show: false, required: false };
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Registration link copied', 'success');
    } catch {
      toast('Could not copy — long-press the link', 'error');
    }
  }

  const by = session?.organiserName ?? 'Organiser';

  return (
    <div className="stack-6">
      <div>
        <h3 style={{ margin: 0 }}>Registration & sign-ups</h3>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          Share a public page where players register themselves. You approve each
          sign-up — registering doesn't guarantee a place.
        </p>
      </div>

      {/* Settings + share link */}
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Card>
          <h4 style={{ marginTop: 0 }}>Settings</h4>
          <label className="row" style={{ cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
            <input type="checkbox" checked={reg.open} onChange={(e) => patch({ open: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span><strong>Registration open</strong> — accept new sign-ups</span>
          </label>
          <label className="row" style={{ cursor: 'pointer', marginBottom: 'var(--space-5)' }}>
            <input type="checkbox" checked={reg.autoApprove} onChange={(e) => patch({ autoApprove: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span>Auto-approve sign-ups (skip manual review)</span>
          </label>

          <div className="field-label" style={{ marginBottom: 'var(--space-2)' }}>Fields to capture</div>
          <div className="stack-2" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-small text-muted">Name and email are always collected.</div>
            {OPTIONAL_FIELDS.map((key) => {
              const cfg = fieldCfg(key);
              return (
                <div key={key} className="row-between" style={{ gap: 'var(--space-3)' }}>
                  <label className="row" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={cfg.show} onChange={(e) => toggleField(key, { show: e.target.checked, required: e.target.checked ? cfg.required : false })} style={{ width: 16, height: 16 }} />
                    {REGISTRATION_FIELD_LABELS[key]}
                  </label>
                  {cfg.show && (
                    <label className="row text-small text-muted" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={cfg.required} onChange={(e) => toggleField(key, { required: e.target.checked })} style={{ width: 16, height: 16 }} />
                      required
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <TextAreaField
            label="Welcome message (optional)"
            placeholder="A line or two shown on the registration page…"
            value={reg.note ?? ''}
            onChange={(e) => patch({ note: e.target.value || undefined })}
            rows={3}
          />
        </Card>

        <Card style={{ textAlign: 'center' }}>
          <h4 style={{ marginTop: 0 }}>Share the registration page</h4>
          <div className="qr-box" style={{ display: 'inline-block', margin: '0 auto var(--space-3)' }}>
            <QRCodeSVG value={url} size={148} fgColor="#17211b" />
          </div>
          <div className="text-small" style={{ wordBreak: 'break-all', color: 'var(--rm-muted)', marginBottom: 'var(--space-3)' }}>{url}</div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button variant="secondary" size="sm" onClick={copy}>Copy link</Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(eventLandingPath(event.id), '_blank')}>Preview</Button>
          </div>
          {!reg.open && <p className="text-small text-muted" style={{ marginTop: 'var(--space-3)' }}>Registration is currently closed — toggle it on to accept sign-ups.</p>}
        </Card>
      </div>

      {/* Approval queue */}
      <div>
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <h4 style={{ margin: 0 }}>Sign-ups</h4>
          <div className="row text-small text-muted">
            <Badge tone="amber">{pending.length} pending</Badge>
            <Badge tone="green">{approved.length} approved</Badge>
          </div>
        </div>

        {registrations.length === 0 ? (
          <EmptyState
            icon={RegistrationIcon}
            title="No sign-ups yet"
            body="Share the registration link above. As people register they'll appear here for you to approve."
          />
        ) : (
          <div className="stack-2">
            {[...pending, ...approved, ...declined].map((r) => (
              <Card key={r.id}>
                <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {r.firstName} {r.lastName}{' '}
                      {r.status === 'approved' && <Badge tone="green">Approved</Badge>}
                      {r.status === 'declined' && <Badge tone="neutral-dark">Declined</Badge>}
                    </div>
                    <div className="text-small text-muted">
                      {[r.email, r.company, r.handicap != null ? `HCP ${r.handicap}` : null, r.dietary]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {r.status === 'pending' ? (
                    <div className="row">
                      <Button size="sm" onClick={() => { approveRegistration(r.id, by); toast(`${r.firstName} approved & added to roster`, 'success'); }}>
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { declineRegistration(r.id, by); toast(`${r.firstName} declined`); }}>
                        Decline
                      </Button>
                    </div>
                  ) : r.status === 'declined' ? (
                    <Button size="sm" variant="ghost" onClick={() => { approveRegistration(r.id, by); toast(`${r.firstName} approved`, 'success'); }}>
                      Approve instead
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
