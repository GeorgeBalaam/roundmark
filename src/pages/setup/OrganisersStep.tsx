// Wizard step: manage who can co-organise this event. The owner can invite
// co-organisers by email (they get a branded invite email and are auto-accepted
// as a full editor when they next sign in) and remove them. Co-organisers see the
// list read-only. Reads/writes event_members + event_organiser_invites directly
// (admin-only, online action — no need for the offline outbox).

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getCurrentUserId } from '../../lib/store';
import { Badge, Button, Card, EmptyState, FormField } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { InviteIcon, OwnerIcon, CloseIcon, TeamsIcon, ICON_SM } from '../../lib/icons';
import type { RoundmarkEvent } from '../../lib/types';

interface Member { userId: string; role: string; name: string }
interface Invite { id: string; email: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABEL: Record<string, string> = { organiser: 'Organiser', host: 'Host' };

export default function OrganisersStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();
  const me = getCurrentUserId();
  const isDemo = event.id.startsWith('demo-');
  const isOwner = !event.ownerId || event.ownerId === me;

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || isDemo) { setLoading(false); return; }
    setLoading(true);

    const { data: memberRows } = await supabase
      .from('event_members').select('user_id, role').eq('event_id', event.id);
    const coOrgs = (memberRows ?? []).filter(
      (m) => (m.role === 'organiser' || m.role === 'host') && m.user_id !== event.ownerId,
    );
    const ids = [event.ownerId, ...coOrgs.map((m) => m.user_id as string)].filter(Boolean) as string[];

    const nameById: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      for (const p of profs ?? []) nameById[p.id as string] = (p.display_name as string) || '';
    }

    const list: Member[] = [];
    if (event.ownerId) list.push({ userId: event.ownerId, role: 'owner', name: nameById[event.ownerId] || 'You' });
    for (const m of coOrgs) {
      list.push({ userId: m.user_id as string, role: m.role as string, name: nameById[m.user_id as string] || 'Co-organiser' });
    }
    setMembers(list);

    const { data: inviteRows } = await supabase
      .from('event_organiser_invites').select('id, email').eq('event_id', event.id).is('accepted_at', null);
    setInvites((inviteRows ?? []).map((i) => ({ id: i.id as string, email: i.email as string })));
    setLoading(false);
  }, [event.id, event.ownerId, isDemo]);

  useEffect(() => { void load(); }, [load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) { toast('Enter a valid email address', 'error'); return; }
    if (invites.some((i) => i.email.toLowerCase() === value)) { toast('That email is already invited', 'error'); return; }
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('event_organiser_invites').insert({ event_id: event.id, email: value, invited_by: me });
    setBusy(false);
    if (error) { toast(`Couldn't send invite: ${error.message}`, 'error'); return; }
    setEmail('');
    toast('Invite sent', 'success');
    void load();
  }

  async function revokeInvite(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('event_organiser_invites').delete().eq('id', id);
    if (error) { toast(`Couldn't remove invite: ${error.message}`, 'error'); return; }
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  async function removeMember(userId: string) {
    if (!supabase) return;
    const { error } = await supabase.from('event_members').delete().eq('event_id', event.id).eq('user_id', userId);
    if (error) { toast(`Couldn't remove organiser: ${error.message}`, 'error'); return; }
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    toast('Organiser removed', 'success');
  }

  if (isDemo) {
    return (
      <Card padLg>
        <EmptyState icon={TeamsIcon} title="Organisers" body="Co-organiser management isn't available on the sample event." />
      </Card>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <Card padLg>
        <EmptyState icon={TeamsIcon} title="Organisers" body="Connect the backend to invite co-organisers." />
      </Card>
    );
  }

  return (
    <div className="stack-6" style={{ maxWidth: 640 }}>
      <Card padLg>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>People with access</h3>
        <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
          Co-organisers get full access to set up and run this event — everything except deleting it or removing the owner.
        </p>

        {loading ? (
          <p className="text-muted" style={{ margin: 0 }}>Loading…</p>
        ) : (
          <div className="stack-3">
            {members.map((m) => (
              <div key={m.userId} className="row-between" style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--rm-border-soft)' }}>
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                  {m.role === 'owner' ? <OwnerIcon size={ICON_SM} aria-hidden="true" /> : <TeamsIcon size={ICON_SM} aria-hidden="true" />}
                  <span style={{ fontWeight: 600 }}>{m.name}{m.userId === me ? ' (you)' : ''}</span>
                </div>
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                  <Badge tone={m.role === 'owner' ? 'dark-green' : 'green'}>{m.role === 'owner' ? 'Owner' : (ROLE_LABEL[m.role] ?? m.role)}</Badge>
                  {isOwner && m.role !== 'owner' && (
                    <Button size="sm" variant="ghost" aria-label="Remove organiser" onClick={() => removeMember(m.userId)}>
                      <CloseIcon size={ICON_SM} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padLg>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Invite a co-organiser</h3>
        {isOwner ? (
          <>
            <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
              They'll get an email invite. When they sign in to Roundmark with this address, they're added automatically.
            </p>
            <form onSubmit={sendInvite} className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <FormField label="Email address" type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>
                <InviteIcon size={ICON_SM} /> {busy ? 'Sending…' : 'Send invite'}
              </Button>
            </form>
          </>
        ) : (
          <p className="text-muted" style={{ margin: 0 }}>
            Only the event owner can invite or remove organisers.
          </p>
        )}

        {invites.length > 0 && (
          <div className="stack-3" style={{ marginTop: 'var(--space-6)' }}>
            <div className="text-small" style={{ fontWeight: 600, color: 'var(--rm-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending invites
            </div>
            {invites.map((i) => (
              <div key={i.id} className="row-between" style={{ padding: 'var(--space-2) 0' }}>
                <span>{i.email}</span>
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                  <Badge tone="amber">Invited</Badge>
                  {isOwner && (
                    <Button size="sm" variant="ghost" aria-label="Cancel invite" onClick={() => revokeInvite(i.id)}>
                      <CloseIcon size={ICON_SM} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
