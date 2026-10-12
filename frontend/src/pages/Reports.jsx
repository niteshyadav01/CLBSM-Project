import { useEffect, useState } from 'react';
import { api, download } from '../api/client';
import { Banner, EmptyState, PageHeader, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { formatDate, formatINR, formatNumber, monthStart, todayISO } from '../utils/format';

const REPORTS = [
  { id: 'daily-sales', label: 'Daily sales' },
  { id: 'sales-summary', label: 'Date-wise summary' },
  { id: 'item-wise', label: 'Item-wise sales' },
  { id: 'opening-closing', label: 'Opening and closing stock' },
  { id: 'movements', label: 'Stock movement and adjustments' },
  { id: 'monthly', label: 'Monthly revenue' },
  { id: 'reconciliation', label: 'Cash reconciliation' },
];

function cell(value, type) {
  if (type === 'money') return formatINR(value);
  if (type === 'number') return formatNumber(value);
  if (type === 'date') return formatDate(value);
  return value || '';
}

export default function Reports() {
  const toast = useToast();
  const [type, setType] = useState('daily-sales');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [year, setYear] = useState(todayISO().slice(0, 4));
  const [itemId, setItemId] = useState('');
  const [items, setItems] = useState([]);
  const [applied, setApplied] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/items').then((data) => setItems(data.items)).catch(() => {});
  }, []);

  function query(filters) {
    const params = new URLSearchParams();
    if (filters.type === 'monthly') params.set('year', filters.year);
    else {
      params.set('from', filters.from);
      params.set('to', filters.to);
    }
    if (filters.itemId) params.set('itemId', filters.itemId);
    return params.toString();
  }

  async function generate(event) {
    event?.preventDefault();
    const filters = { type, from, to, year, itemId };
    setApplied(filters);
    setLoading(true);
    setError('');
    try {
      setReport(await api(`/reports/${type}?${query(filters)}`));
    } catch (err) {
      setReport(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportFile(format) {
    if (!applied) return;
    try {
      await download(`/reports/${applied.type}/export?format=${format}&${query(applied)}`, `${applied.type}.${format}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="On-screen totals and Excel, CSV, and PDF exports use the same filtered figures. Dates are shown as DD-MM-YYYY and amounts in ₹." />
      <form className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={generate}>
        <label className="text-sm font-semibold md:col-span-2">
          Report
          <select className="field mt-1" value={type} onChange={(event) => setType(event.target.value)}>
            {REPORTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        {type === 'monthly' ? (
          <label className="text-sm font-semibold">
            Year
            <input className="field mt-1" value={year} onChange={(event) => setYear(event.target.value)} />
          </label>
        ) : (
          <>
            <label className="text-sm font-semibold">From<input className="field mt-1" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="text-sm font-semibold">To<input className="field mt-1" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </>
        )}
        <label className="text-sm font-semibold md:col-span-2">
          Item
          <select className="field mt-1" value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="">All items</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit">Show report</button>
        </div>
      </form>

      {loading && <Spinner label="Building report" />}
      {error && <Banner>{error}</Banner>}
      {!loading && !report && !error && <EmptyState title="Choose a report">Set the dates or year, then show the report. Exports stay locked to the figures on screen.</EmptyState>}
      {report && (
        <div className="card">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{report.meta.businessName}</div>
              <h2 className="font-bold">{report.meta.title}</h2>
              <p className="text-xs text-stone-500">
                {report.meta.from && `${formatDate(report.meta.from)} to ${formatDate(report.meta.to)} · `}
                {report.meta.filterDescription} · Generated {report.meta.generatedAt}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={() => exportFile('xlsx')}>Excel</button>
              <button className="btn-secondary" type="button" onClick={() => exportFile('csv')}>CSV</button>
              <button className="btn-secondary" type="button" onClick={() => exportFile('pdf')}>PDF</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {report.rows.length === 0 && <tr><td colSpan={report.columns.length}>No records for this filter.</td></tr>}
                {report.rows.map((row, index) => (
                  <tr key={index}>
                    {report.columns.map((column) => <td key={column.key}>{cell(row[column.key], column.type)}</td>)}
                  </tr>
                ))}
              </tbody>
              {report.rows.length > 0 && (
                <tfoot>
                  <tr>
                    {report.columns.map((column, index) => (
                      <td key={column.key} className="font-bold">
                        {index === 0 ? 'Total' : report.totals[column.key] == null ? '' : cell(report.totals[column.key], column.type)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
