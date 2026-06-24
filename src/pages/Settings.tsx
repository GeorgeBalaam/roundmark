// Account & company settings — /app/settings.
// Saves to Supabase profiles table; pre-fills colours/logo on new events.

import { useEffect, useState } from 'react';
import { DashboardShell } from '../components/shells';
import { Button, Card, FieldWrap, FormField, PageHeader } from '../components/ui';
import { ImageUpload } from '../components/ImageUpload';
import { useToast } from '../components/toast-context';
import { readableTextOn } from '../lib/theme';
import { updateAccountSettings, fetchEarlyAccessLeads, useAccountSettings, useIsAdmin, useSession, useStoreLoading } from '../lib/store';
import { buildLeadsCSV, downloadCSV } from '../lib/csv';
import { DownloadIcon, ICON_SM } from '../lib/icons';

type FormState = {
  displayName: string;
  companyName: string;
  website: string;
  defaultBrandColor: string;
  defaultAccentColor: string;
  defaultBgColor: string;
  defaultLogoUrl: string;
};

function settingsToForm(s: ReturnType<typeof useAccountSettings>): FormState {
  return {
    displayName: s.displayName ?? '',
    companyName: s.companyName ?? '',
    website: s.website ?? '',
    defaultBrandColor: s.defaultBrandColor ?? '#27542A',
    defaultAccentColor: s.defaultAccentColor ?? '#8DB259',
    defaultBgColor: s.defaultBgColor ?? '#F7F3EA',
    defaultLogoUrl: s.defaultLogoUrl ?? '',
  };
}

export default function SettingsPage() {
  const settings = useAccountSettings();
  const session = useSession();
  const loading = useStoreLoading();
  const toast = useToast();

  const isAdmin = useIsAdmin();
  const [form, setForm] = useState<FormState>(() => settingsToForm(settings));
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [exportingLeads, setExportingLeads] = useState(false);

  async function exportLeads() {
    setExportingLeads(true);
    const leads = await fetchEarlyAccessLeads();
    setExportingLeads(false);
    if (!leads.length) { toast('No early-access leads yet', 'error'); return; }
    downloadCSV('roundmark-early-access.csv', buildLeadsCSV(leads));
    toast(`${leads.length} lead${leads.length === 1 ? '' : 's'} exported`, 'success');
  }

  // Once Supabase has loaded the real settings, sync them into the form once.
  useEffect(() => {
    if (!loading && !initialized) {
      setForm(settingsToForm(settings));
      setInitialized(true);
    }
  }, [loading, initialized, settings]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateAccountSettings({
      displayName: form.displayName || undefined,
      companyName: form.companyName || undefined,
      website: form.website || undefined,
      defaultBrandColor: form.defaultBrandColor || undefined,
      defaultAccentColor: form.defaultAccentColor || undefined,
      defaultBgColor: form.defaultBgColor || undefined,
      defaultLogoUrl: form.defaultLogoUrl || undefined,
    });
    setSaving(false);
    toast('Settings saved', 'success');
  }

  const divider = (
    <hr style={{ border: 'none', borderTop: '1px solid var(--rm-border-soft)', margin: 'var(--space-8) 0 var(--space-6)' }} />
  );

  return (
    <DashboardShell>
      <PageHeader
        title="Account settings"
        subtitle="Company details and default branding for new events."
      />

      <form onSubmit={handleSubmit}>
        <Card padLg style={{ maxWidth: 720 }}>

          {/* Profile */}
          <h3 style={{ marginBottom: 'var(--space-5)' }}>Profile</h3>
          <div className="form-grid">
            <FormField
              label="Display name"
              placeholder="e.g. Jane Smith"
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
            />
            <FieldWrap label="Email" htmlFor="s-email">
              <input
                id="s-email"
                className="input"
                type="email"
                readOnly
                value={session?.organiserName ?? ''}
                style={{ opacity: 0.6, cursor: 'default' }}
              />
            </FieldWrap>
          </div>

          {divider}

          {/* Company */}
          <h3 style={{ marginBottom: 4 }}>Company</h3>
          <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
            Shown on event pages and reports.
          </p>
          <div className="form-grid">
            <FormField
              label="Company name"
              placeholder="e.g. Northbeam Ltd"
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
            />
            <FormField
              label="Website"
              type="url"
              placeholder="https://…"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </div>

          {divider}

          {/* Event defaults */}
          <h3 style={{ marginBottom: 4 }}>Event defaults</h3>
          <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
            Pre-filled when you create a new event. You can always override per-event.
          </p>
          <div className="form-grid">
            <FormField
              label="Primary colour"
              type="color"
              hint="Headers & buttons."
              value={form.defaultBrandColor}
              onChange={(e) => set('defaultBrandColor', e.target.value)}
              style={{ padding: 4, height: 44 }}
            />
            <FormField
              label="Accent colour"
              type="color"
              hint="Highlights & scores."
              value={form.defaultAccentColor}
              onChange={(e) => set('defaultAccentColor', e.target.value)}
              style={{ padding: 4, height: 44 }}
            />
            <FormField
              label="Background colour"
              type="color"
              hint="Page background."
              value={form.defaultBgColor}
              onChange={(e) => set('defaultBgColor', e.target.value)}
              style={{ padding: 4, height: 44 }}
            />
            <ImageUpload
              label="Default logo"
              hint="PNG/SVG under 2 MB — used on leaderboards and scorecards."
              value={form.defaultLogoUrl || undefined}
              onChange={(url) => set('defaultLogoUrl', url ?? '')}
              pathPrefix="account"
            />
          </div>

          {/* Brand preview */}
          <div
            style={{
              marginTop: 'var(--space-6)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              border: '1px solid var(--rm-border)',
              background: form.defaultBgColor,
            }}
          >
            <div
              style={{
                background: form.defaultBrandColor,
                color: readableTextOn(form.defaultBrandColor),
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
              }}
            >
              {form.defaultLogoUrl && (
                <img src={form.defaultLogoUrl} alt="" style={{ height: 24, width: 'auto' }} />
              )}
              Your next event — Live leaderboard
            </div>
            <div className="row" style={{ padding: 'var(--space-4) var(--space-5)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Birdie Brigade</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '1.3rem',
                  color: form.defaultAccentColor,
                }}
              >
                58
              </span>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-8)' }}>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </Card>
      </form>

      {isAdmin && (
        <Card padLg style={{ maxWidth: 720, marginTop: 'var(--space-8)' }}>
          <h3 style={{ marginBottom: 4 }}>Early-access leads</h3>
          <p className="text-muted text-small" style={{ marginTop: 0 }}>
            Everyone who registered interest on the coming-soon page. Admin only.
          </p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="secondary" disabled={exportingLeads} onClick={exportLeads}>
              <DownloadIcon size={ICON_SM} /> {exportingLeads ? 'Preparing…' : 'Export leads CSV'}
            </Button>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
