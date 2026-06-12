// Roundmark UI primitives. All screens compose these — avoid one-off styling.
// See DESIGN_SYSTEM.md for usage rules.

import {
  useCallback,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import type { EventStatus } from '../lib/types';
import { STATUS_LABELS } from '../lib/types';
import { ToastContext, type ToastTone } from './toast-context';

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
  to?: string; // renders a router Link styled as a button
}

export function Button({ variant = 'primary', size = 'md', block, to, className = '', children, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
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
  if (locked) return <Badge tone="neutral-dark">🔒 Locked</Badge>;
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
  icon = '⛳',
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
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
  return (
    <div className="stepper" role="tablist" aria-label="Setup steps">
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
            <span className="stepper-dot">{step.done ? '✓' : i + 1}</span>
            {step.label}
          </button>
        );
      })}
    </div>
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
            {t.tone === 'success' && '✓'}
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

export function SponsorStrip({
  sponsors,
  dark,
}: {
  sponsors: { id: string; name: string; logoUrl?: string; websiteUrl?: string }[];
  dark?: boolean;
}) {
  if (sponsors.length === 0) return null;
  return (
    <div
      className="sponsor-strip"
      style={dark ? { background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' } : undefined}
    >
      <span className="sponsor-label" style={dark ? { color: '#9fb894' } : undefined}>
        With thanks to our sponsors
      </span>
      {sponsors
        .slice()
        .sort((a, b) => ('slot' in a && 'slot' in b ? (a as { slot: number }).slot - (b as { slot: number }).slot : 0))
        .map((s) => {
          const inner = s.logoUrl ? (
            <img src={s.logoUrl} alt={s.name} />
          ) : (
            <span style={dark ? { color: '#dfe7d8' } : undefined}>{s.name}</span>
          );
          return s.websiteUrl ? (
            <a key={s.id} className="sponsor-item" href={s.websiteUrl} target="_blank" rel="noreferrer">
              {inner}
            </a>
          ) : (
            <span key={s.id} className="sponsor-item">
              {inner}
            </span>
          );
        })}
    </div>
  );
}
