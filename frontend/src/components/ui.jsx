import { cx } from '../utils/format';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 text-sm text-stone-600" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-pine-100 border-t-pine-800" />
      {label}
    </div>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">{description}</p>}
      {children && <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <article className="card flex h-full min-w-0 flex-col p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">{label}</div>
      <div className="mt-2 break-words text-xl font-extrabold tracking-tight sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </article>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-2 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-5" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-secondary px-2 py-1" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="card px-6 py-12 text-center">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-sm text-stone-600">{children}</div>
    </div>
  );
}

export function CountInput({ value, onChange, label, tone }) {
  return (
    <label className="block min-w-0">
      {label && <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</span>}
      <input
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, '').slice(0, 7))}
        onFocus={(event) => event.target.select()}
        className={cx('field text-right font-semibold tabular-nums', tone === 'storage' && 'bg-sky-50', tone === 'table' && 'bg-amber-50')}
      />
    </label>
  );
}

export function Banner({ tone = 'error', children }) {
  const styles = tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
