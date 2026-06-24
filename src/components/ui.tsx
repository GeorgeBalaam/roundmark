// Roundmark UI primitives. All screens compose these — avoid one-off styling.
// See DESIGN_SYSTEM.md for usage rules.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { EventStatus } from '../lib/types';
import { STATUS_LABELS } from '../lib/types';
import { ToastContext, type ToastTone } from './toast-context';
import { EventIcon, CheckIcon, LockIcon, DisclosureIcon, ICON_SM, ICON_XL } from '../lib/icons';

// ---------- Logo ----------

export function Logo({
  variant = 'horizontal',
  height = 34,
}: {
  variant?: 'horizontal' | 'icon' | 'horizontal-white' | 'icon-white' | 'stacked';
  height?: number;
}) {
  const src = {
    horizontal: '/brand/roundmark-logo-horizontal-colour.svg',
    'horizontal-white': '/brand/roundmark-logo-horizontal-white.svg',
    icon: '/brand/roundmark-icon-colour.svg',
    'icon-white': '/brand/roundmark-icon-white.svg',
    stacked: '/brand/roundmark-stacked-colour.svg',
  }[variant];
  return <img src={src} alt="Roundmark" style={{ height, width: 'auto', display: 'block' }} />;
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  to?: string; // renders a router Link styled as a button (internal SPA nav)
  href?: string; // renders a styled <a> that opens in a new tab (external)
}

export function Button({ variant = 'primary', size = 'md', block, to, href, className = '', children, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

// ---------- Card ----------

export function Card({
  children,
  hover,
  soft,
  padLg,
  className = '',
  style,
}: {
  children: ReactNode;
  hover?: boolean;
  soft?: boolean;
  padLg?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cls = ['card', hover ? 'card-hover' : '', soft ? 'card-soft' : '', padLg ? 'card-pad-lg' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

// ---------- Badge / status ----------

type BadgeTone = 'grey' | 'blue' | 'green' | 'dark-green' | 'amber' | 'orange' | 'red' | 'neutral-dark';

export function Badge({ tone = 'grey', children, pulse }: { tone?: BadgeTone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={`badge badge-${tone}`}>
      {pulse && <span className="pulse-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<EventStatus, BadgeTone> = {
  draft: 'grey',
  ready: 'blue',
  live: 'orange',
  completed: 'dark-green',
};

export function EventStatusBadge({ status, locked }: { status: EventStatus; locked?: boolean }) {
  if (locked) return <Badge tone="neutral-dark"><LockIcon size={ICON_SM} /> Locked</Badge>;
  return (
    <Badge tone={STATUS_TONES[status]} pulse={status === 'live'}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function ProvisionalBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <Badge tone="dark-green">Final result</Badge>
  ) : (
    <Badge tone="amber" pulse>
      Provisional — until results are locked
    </Badge>
  );
}

// ---------- Stat card ----------

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="text-small text-muted">{hint}</div>}
    </div>
  );
}

// ---------- Form fields ----------

interface FieldWrapProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FieldWrap({ label, hint, error, required, children, htmlFor, className = '' }: FieldWrapProps) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span style={{ color: 'var(--rm-error)' }}> *</span>}
      </label>
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  wrapClassName?: string;
}

export function FormField({ label, hint, error, id, required, wrapClassName, ...rest }: FormFieldProps) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={wrapClassName}>
      <input id={fieldId} className="input" aria-invalid={!!error} required={required} {...rest} />
    </FieldWrap>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  wrapClassName?: string;
}

export function SelectField({ label, hint, error, options, id, wrapClassName, ...rest }: SelectFieldProps) {
  const fieldId = id ?? `s-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <FieldWrap label={label} hint={hint} error={error} htmlFor={fieldId} className={wrapClassName}>
      <select id={fieldId} className="select" aria-invalid={!!error} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, id, ...rest }: TextAreaFieldProps) {
  const fieldId = id ?? `t-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <FieldWrap label={label} hint={hint} error={error} htmlFor={fieldId}>
      <textarea id={fieldId} className="textarea" aria-invalid={!!error} {...rest} />
    </FieldWrap>
  );
}

// ---------- Empty state ----------

export function EmptyState({
  icon: Icon = EventIcon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Icon size={ICON_XL} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

// ---------- Progress stepper ----------

export interface StepDef {
  key: string;
  label: string;
  done?: boolean;
}

export function ProgressStepper({
  steps,
  activeKey,
  onSelect,
}: {
  steps: StepDef[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const compactRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === activeKey));
  const activeStep = steps[activeIndex];
  const progressPct = steps.length ? ((activeIndex + 1) / steps.length) * 100 : 0;

  // Close the mobile jump-menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (compactRef.current && !compactRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function pick(key: string) {
    onSelect(key);
    setMenuOpen(false);
  }

  return (
    <>
      {/* Desktop: full horizontal strip */}
      <div className="stepper stepper-desktop" role="tablist" aria-label="Setup steps">
        {steps.map((step, i) => {
          const active = step.key === activeKey;
          return (
            <button
              key={step.key}
              role="tab"
              aria-selected={active}
              className={`stepper-item ${active ? 'active' : ''} ${step.done ? 'done' : ''}`}
              onClick={() => onSelect(step.key)}
            >
              <span className="stepper-dot">{step.done ? <CheckIcon size={ICON_SM} /> : i + 1}</span>
              {step.label}
            </button>
          );
        })}
      </div>

      {/* Mobile: compact header with progress + jump menu */}
      <div className="stepper-compact" ref={compactRef} data-open={menuOpen}>
        <button
          type="button"
          className="stepper-compact-trigger"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="stepper-compact-meta">
            <span className="stepper-compact-count">Step {activeIndex + 1} of {steps.length}</span>
            <span className="stepper-compact-title">{activeStep?.label}</span>
          </span>
          <DisclosureIcon size={20} className="stepper-compact-chev" aria-hidden="true" />
        </button>
        <div className="stepper-progress" aria-hidden="true">
          <div className="stepper-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        {menuOpen && (
          <ul className="stepper-menu" role="listbox" aria-label="Jump to setup step">
            {steps.map((step, i) => {
              const active = step.key === activeKey;
              return (
                <li key={step.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`stepper-menu-item ${active ? 'active' : ''} ${step.done ? 'done' : ''}`}
                    onClick={() => pick(step.key)}
                  >
                    <span className="stepper-dot">{step.done ? <CheckIcon size={ICON_SM} /> : i + 1}</span>
                    {step.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

// ---------- Page header ----------

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="row-between">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </div>
  );
}

// ---------- Toast ----------

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastItem['tone'] = 'default') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone !== 'default' ? `toast-${t.tone}` : ''}`}>
            {t.tone === 'success' && <CheckIcon size={ICON_SM} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- Confirm dialog ----------

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {body && <div style={{ color: 'var(--rm-muted)', marginBottom: 'var(--space-6)' }}>{body}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Sponsor strip ----------

interface SponsorStripItem {
  id: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  slot?: number;
  tier?: string;
  headline?: boolean;
}

export function SponsorStrip({ sponsors, dark }: { sponsors: SponsorStripItem[]; dark?: boolean }) {
  if (sponsors.length === 0) return null;
  // Headline sponsors first (shown larger), then the rest by slot.
  const ordered = sponsors
    .slice()
    .sort((a, b) => Number(!!b.headline) - Number(!!a.headline) || (a.slot ?? 0) - (b.slot ?? 0));

  const renderItem = (s: SponsorStripItem) => {
    const logo = s.logoUrl ? (
      <img src={s.logoUrl} alt={s.name} />
    ) : (
      <span style={dark ? { color: '#dfe7d8' } : undefined}>{s.name}</span>
    );
    const inner = (
      <>
        {s.tier && <span className="sponsor-tier" style={dark ? { color: '#9fb894' } : undefined}>{s.tier}</span>}
        {logo}
      </>
    );
    const cls = `sponsor-item ${s.headline ? 'sponsor-item--headline' : ''}`;
    return s.websiteUrl ? (
      <a key={s.id} className={cls} href={s.websiteUrl} target="_blank" rel="noreferrer">{inner}</a>
    ) : (
      <span key={s.id} className={cls}>{inner}</span>
    );
  };

  return (
    <div
      className="sponsor-strip"
      style={dark ? { background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' } : undefined}
    >
      <span className="sponsor-label" style={dark ? { color: '#9fb894' } : undefined}>
        With thanks to our sponsors
      </span>
      {ordered.map(renderItem)}
    </div>
  );
}
