// Image upload for event/sponsor logos. Uploads to the Supabase Storage
// 'event-assets' bucket and stores the public URL. When Supabase isn't
// configured (local/dev) it degrades to a plain URL text field so the app
// still works end-to-end.

import { useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { makeId } from '../lib/store';
import { FieldWrap, Button } from './ui';
import { useToast } from './toast-context';

const BUCKET = 'event-assets';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function ImageUpload({
  label,
  hint,
  value,
  onChange,
  pathPrefix,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  /** Folder within the bucket, e.g. the event id. */
  pathPrefix: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // No backend → fall back to a URL field.
  if (!isSupabaseConfigured || !supabase) {
    return (
      <FieldWrap label={label} hint={hint ?? 'Paste an image URL (uploads need the backend configured).'}>
        <input
          className="input"
          placeholder="https://…"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      </FieldWrap>
    );
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('Image must be under 2 MB', 'error');
      return;
    }
    setBusy(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${pathPrefix}/${makeId()}.${ext}`;
    const { error } = await supabase!.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    setBusy(false);
    if (error) {
      toast(`Upload failed: ${error.message}`, 'error');
      return;
    }
    const { data } = supabase!.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    toast('Image uploaded', 'success');
  }

  return (
    <FieldWrap label={label} hint={hint}>
      <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {value && (
          <img
            src={value}
            alt=""
            style={{
              height: 48,
              maxWidth: 140,
              objectFit: 'contain',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--rm-border)',
              background: '#fff',
              padding: 4,
            }}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        )}
      </div>
    </FieldWrap>
  );
}
