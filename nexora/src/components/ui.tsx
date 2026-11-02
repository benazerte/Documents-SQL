'use client';

import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowUpRight, Check, X } from 'lucide-react';
import { brand, type TaskStatus } from '@/lib/types';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 32 34" width="29" height="31" aria-hidden="true">
        <path d="M3 28V7l8-4 10 17V6l8-4v23l-8 6L11 14v10Z" fill="currentColor" />
        <path d="m3 28 8-4 10 7 8-6" fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      {!compact && (
        <span>
          {brand.name}
          <span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <span className="eyebrow">CONNECTED WORK</span>
            <h2 id={id}>{title}</h2>
          </div>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  type ControlProps = {
    id?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
  };
  // A control's accessible name is only its label, never select options or hints.
  const nativeControl = isValidElement<ControlProps>(children) && typeof children.type === 'string';
  const controlId = nativeControl ? (children.props.id ?? id) : undefined;
  const control = nativeControl
    ? cloneElement(children, {
        id: controlId,
        ...(children.props['aria-label'] || children.props['aria-labelledby']
          ? {}
          : { 'aria-labelledby': labelId }),
        ...(hint
          ? {
              'aria-describedby': [children.props['aria-describedby'], hintId]
                .filter(Boolean)
                .join(' '),
            }
          : {}),
      })
    : children;
  return (
    <label className="field" htmlFor={controlId}>
      <span id={labelId}>{label}</span>
      {control}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <svg viewBox="0 0 100 60" width="100" height="60" aria-hidden="true">
        <path
          d="M15 30h20l15-18 15 36 15-18h10"
          stroke="var(--accent)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="15" cy="30" r="5" fill="var(--surface)" stroke="var(--border)" />
        <rect
          x="42"
          y="22"
          width="16"
          height="16"
          rx="4"
          fill="var(--surface)"
          stroke="var(--accent)"
        />
        <circle cx="85" cy="30" r="5" fill="var(--surface)" stroke="var(--border)" />
      </svg>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};
export const statuses = Object.keys(statusLabels) as TaskStatus[];
export const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
export function Status({ value }: { value: string }) {
  return (
    <span className={`badge status-${value}`}>
      <i />
      {statusLabels[value as TaskStatus] ?? value.replaceAll('_', ' ')}
    </span>
  );
}
export function Priority({ value }: { value: string }) {
  return (
    <span className={`priority priority-${value}`}>
      <span aria-hidden="true">
        {value === 'urgent' ? '↑↑' : value === 'high' ? '↑' : value === 'low' ? '↓' : '−'}
      </span>{' '}
      {value}
    </span>
  );
}
export function DateLabel({ value }: { value: string | null }) {
  return (
    <>
      {value
        ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })
        : 'No date'}
    </>
  );
}
export function today() {
  return new Date().toLocaleDateString('en-CA');
}
export function progress(tasks: { status: string }[]) {
  return tasks.length
    ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
    : 0;
}
export function ErrorMessage({ error }: { error: string | null }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
export function SuccessMessage({ message }: { message: string | null }) {
  return message ? (
    <p className="form-success" role="status">
      <Check size={14} />
      {message}
    </p>
  ) : null;
}
export function LinkArrow() {
  return <ArrowUpRight size={15} aria-hidden="true" />;
}
