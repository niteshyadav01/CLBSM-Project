import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { Banner, EmptyState, Spinner, StatCard } from '../components/ui';
import { formatDate, formatDateTime, formatINR, formatNumber, monthStart, todayISO } from '../utils/format';

export default function Dashboard() {
  const today = todayISO();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: monthStart(), to: today });
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    api(`/dashboard?from=${applied.from}&to=${applied.to}`)
      .then((data) => active && setState({ loading: false, error: '', data }))
      .catch((error) => active && setState({ loading: false, error: error.message, data: null }));
    return () => {
      active = false;
    };
  }, [applied]);

  const data = state.data;
  const period = `${formatDate(applied.from)} to ${formatDate(applied.to)}`;
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-600">Sales for {period}. Closing stock is the end date.</p>
      </div>
      <form
        className="card mb-5 grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[11rem_11rem_auto] lg:justify-start lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ from, to });
        }}
      >
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
      {state.loading && <Spinner label="Loading dashboard" />}
      {state.error && <Banner>{state.error}</Banner>}
      {data && (
        <div className="space-y-6">
          <section className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Bottles sold" value={formatNumber(data.totals.soldBottles)} hint={data.hasEntry ? 'In the selected period' : 'No entry in this period'} />
            <StatCard label="Revenue" value={formatINR(data.totals.revenue)} hint={`Day before start ${formatINR(data.totals.previousRevenue)}`} />
            <StatCard label="Opening stock" value={formatNumber(data.totals.openingBottles)} hint={`On ${formatDate(applied.from)}`} />
            <StatCard label="Available stock" value={formatNumber(data.totals.availableBottles)} hint={`On ${formatDate(applied.to)} · received ${formatNumber(data.totals.receivedBottles)}`} />
            <StatCard label="Closing stock" value={formatNumber(data.totals.closingBottles)} hint={`On ${formatDate(applied.to)}`} />
            <StatCard label="Sealed boxes" value={formatNumber(data.totals.closingBoxes)} hint={`Storage on ${formatDate(applied.to)}`} />
            <StatCard label="Loose bottles" value={formatNumber(data.totals.closingLoose)} hint={`Table on ${formatDate(applied.to)}`} />
            <StatCard label="Low-stock items" value={formatNumber(data.lowStock.length)} hint={`At or below ${formatNumber(data.lowStockThreshold)} bottles`} />
          </section>

          {!data.hasEntry && (
            <EmptyState title="No stock entry in this period">
              <Link className="font-semibold text-pine-800 underline" to={`/daily-stock?date=${applied.to}`}>
                Enter daily stock for {formatDate(applied.to)}
              </Link>
            </EmptyState>
          )}

          <section className="grid w-full gap-4 lg:grid-cols-5">
            <div className="card p-4 lg:col-span-3">
              <h2 className="font-bold">Revenue</h2>
              <p className="text-xs text-stone-500">{period}</p>
              <div className="mt-4 h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart}>
                    <CartesianGrid stroke="#e4dccb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatINR(value)} labelFormatter={(label) => label} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#164c3c" fill="#dceee4" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-4 lg:col-span-2">
              <h2 className="font-bold">Low stock</h2>
              <div className="mt-3 space-y-2">
                {data.lowStock.length === 0 && <p className="text-sm text-stone-500">No active item is at the alert level.</p>}
                {data.lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-stone-500">{item.currentBoxes} boxes · {item.currentLoose} loose</div>
                    </div>
                    <div className="font-bold">{formatNumber(item.totalBottles)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid w-full gap-4 lg:grid-cols-5">
            <div className="card lg:col-span-3">
              <div className="border-b border-line px-4 py-3 font-bold">Item-wise sales</div>
              <div className="table-wrap">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Size</th>
                      <th>Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-stone-500">Nothing sold in this period.</td>
                      </tr>
                    )}
                    {data.items.map((item) => (
                      <tr key={item.itemId}>
                        <td className="font-semibold">{item.name}</td>
                        <td>{item.size}</td>
                        <td>{formatNumber(item.soldBottles)}</td>
                        <td>{formatINR(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card p-4 lg:col-span-2">
              <h2 className="font-bold">Recent activity</h2>
              <ul className="mt-3 space-y-3">
                {data.activity.map((entry) => (
                  <li key={entry.id} className="border-b border-line pb-3 last:border-0">
                    <div className="text-sm">{entry.summary}</div>
                    <div className="mt-1 text-xs text-stone-500">{entry.userName} · {formatDateTime(entry.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
