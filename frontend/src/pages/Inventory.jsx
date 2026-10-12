import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatDateTime, formatINR, formatNumber, monthStart, todayISO } from '../utils/format';

export default function Inventory() {
  const { user } = useAuth();
  const toast = useToast();
  const canAdjust = user.role === 'admin' || user.role === 'manager';
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [history, setHistory] = useState(null);
  const [adjustFor, setAdjustFor] = useState(null);
  const [adjustment, setAdjustment] = useState({ date: todayISO(), boxesDelta: '0', looseDelta: '0', reason: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await api(`/inventory?from=${from}&to=${to}`);
      setState({ loading: false, error: '', data });
    } catch (error) {
      setState({ loading: false, error: error.message, data: null });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openHistory(item) {
    try {
      const data = await api(`/inventory/${item.id}/history?from=${from}&to=${to}`);
      setHistory(data);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    try {
      await api('/inventory/adjustments', {
        method: 'POST',
        body: {
          itemId: adjustFor.id,
          date: adjustment.date,
          boxesDelta: Number(adjustment.boxesDelta),
          looseDelta: Number(adjustment.looseDelta),
          reason: adjustment.reason,
        },
      });
      toast('Adjustment recorded.');
      setAdjustFor(null);
      setAdjustment({ date: todayISO(), boxesDelta: '0', looseDelta: '0', reason: '' });
      load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  const items = (state.data?.items || []).filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Inventory</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
          Sealed boxes and loose bottles on hand. Received and sold use {formatDate(from)} to {formatDate(to)}.
        </p>
      </div>
      <form
        className="card mb-4 grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(12rem,1fr)_11rem_11rem_auto] lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <label className="text-sm font-semibold sm:col-span-2 lg:col-span-1">
          Search
          <input className="field mt-1" placeholder="Item name" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          From
          <input className="field mt-1" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          To
          <input className="field mt-1" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="btn-primary h-10 sm:col-span-2 lg:col-span-1" type="submit">Apply period</button>
      </form>
      {state.loading && <Spinner label="Loading inventory" />}
      {state.error && <Banner>{state.error}</Banner>}
      {state.data && (
        <>
          <div className="space-y-3 lg:hidden">
            {items.map((item) => (
              <article key={item.id} className={`card p-4 ${item.lowStock ? 'border-amber-300' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-xs text-stone-500">{item.size} · {item.unitsPerBox}/box {!item.active && '· Inactive'}</div>
                  </div>
                  {item.lowStock && <span className="shrink-0 text-xs font-bold text-amber-800">Low</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <div><div className="text-xs text-stone-500">Storage</div><div className="font-semibold text-sky-900">{formatNumber(item.currentBoxes)} boxes</div></div>
                  <div><div className="text-xs text-stone-500">Table</div><div className="font-semibold text-amber-900">{formatNumber(item.currentLoose)} loose</div></div>
                  <div><div className="text-xs text-stone-500">Total</div><div className="font-semibold">{formatNumber(item.totalBottles)}</div></div>
                  <div><div className="text-xs text-stone-500">Received</div><div className="font-semibold">{formatNumber(item.receivedBottles)}</div></div>
                  <div><div className="text-xs text-stone-500">Sold</div><div className="font-semibold">{formatNumber(item.soldBottles)}</div></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-secondary" type="button" onClick={() => openHistory(item)}>History</button>
                  {canAdjust && <button className="btn-secondary" type="button" onClick={() => setAdjustFor(item)}>Adjust</button>}
                </div>
              </article>
            ))}
          </div>
          <div className="card table-wrap hidden lg:block">
            <table className="grid-table">
              <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Storage</th>
                <th className="text-right">Table</th>
                <th className="text-right">Total</th>
                <th className="text-right">Received</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Actions</th>
              </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={item.lowStock ? 'bg-amber-50/60' : ''}>
                    <td>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-stone-500">{item.size} · {item.unitsPerBox}/box {!item.active && '· Inactive'}</div>
                    </td>
                    <td className="text-right font-semibold tabular-nums text-sky-900">{formatNumber(item.currentBoxes)}</td>
                    <td className="text-right font-semibold tabular-nums text-amber-900">{formatNumber(item.currentLoose)}</td>
                    <td className="text-right tabular-nums">
                      <span className="font-semibold">{formatNumber(item.totalBottles)}</span>
                      {item.lowStock && <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">Low</span>}
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(item.receivedBottles)}</td>
                    <td className="text-right tabular-nums">{formatNumber(item.soldBottles)}</td>
                    <td className="w-px whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary" type="button" onClick={() => openHistory(item)}>History</button>
                        {canAdjust && <button className="btn-secondary" type="button" onClick={() => setAdjustFor(item)}>Adjust</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {history && (
        <Modal title={`${history.item.name} history`} onClose={() => setHistory(null)}>
          <div className="space-y-3">
            {history.events.length === 0 && <p className="text-sm text-stone-500">No movements in this period.</p>}
            {history.events.map((event, index) => (
              <article key={`${event.type}-${event.date}-${index}`} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex justify-between gap-3 font-semibold">
                  <span>{event.type === 'count' ? 'Daily count' : 'Adjustment'}</span>
                  <span>{formatDate(event.date)}</span>
                </div>
                {event.type === 'count' ? (
                  <p className="mt-1 text-stone-600">
                    Close {event.closingBoxes} boxes and {event.closingLoose} loose. Sold {formatNumber(event.soldBottles)} · {formatINR(event.salesRevenue)}
                  </p>
                ) : (
                  <p className="mt-1 text-stone-600">
                    {event.boxesDelta} boxes, {event.looseDelta} loose ({formatNumber(event.bottleDelta)} bottles). {event.reason}
                    <span className="block text-xs">{event.userName} · {formatDateTime(event.createdAt)}</span>
                  </p>
                )}
              </article>
            ))}
          </div>
        </Modal>
      )}

      {adjustFor && (
        <Modal title={`Adjust ${adjustFor.name}`} onClose={() => setAdjustFor(null)}>
          <form className="space-y-3" onSubmit={saveAdjustment}>
            <p className="text-sm text-stone-600">
              Use a negative number to remove stock and a positive number to add it. On a date that already has a closing count, the adjustment explains the sales figure and is not added on top of that count. A reason is required.
            </p>
            <label className="block text-sm font-semibold">Date<input className="field mt-1" type="date" value={adjustment.date} onChange={(event) => setAdjustment({ ...adjustment, date: event.target.value })} /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Boxes change<input className="field mt-1" value={adjustment.boxesDelta} onChange={(event) => setAdjustment({ ...adjustment, boxesDelta: event.target.value })} required /></label>
              <label className="block text-sm font-semibold">Loose bottles change<input className="field mt-1" value={adjustment.looseDelta} onChange={(event) => setAdjustment({ ...adjustment, looseDelta: event.target.value })} required /></label>
            </div>
            <label className="block text-sm font-semibold">Reason<textarea className="field mt-1" rows={3} value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} required /></label>
            <button className="btn-primary" type="submit">Record adjustment</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
