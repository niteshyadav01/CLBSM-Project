import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Banner, EmptyState, PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatINR, formatNumber, todayISO } from '../utils/format';

function amount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export default function DailySales() {
  const { user } = useAuth();
  const toast = useToast();
  const canCollect = user.role === 'admin' || user.role === 'manager';
  const [date, setDate] = useState(todayISO());
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [form, setForm] = useState({ upi: '', expense: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '', data: null });
    api(`/sales?date=${date}`)
      .then((data) => {
        if (!active) return;
        setState({ loading: false, error: '', data });
        setForm({
          upi: String(data.collection.upi ?? 0),
          expense: String(data.collection.expense ?? 0),
          notes: data.collection.notes || '',
        });
      })
      .catch((error) => active && setState({ loading: false, error: error.message, data: null }));
    return () => {
      active = false;
    };
  }, [date]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api('/sales/collection', {
        method: 'PUT',
        body: {
          date,
          cash: sales,
          upi: Number(form.upi || 0),
          card: 0,
          other: 0,
          expense: Number(form.expense || 0),
          notes: form.notes,
        },
      });
      setState({ loading: false, error: '', data });
      toast('Collections saved.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const data = state.data;
  const expense = amount(form.expense);
  const upi = amount(form.upi);
  const sales = data?.totalRevenue || 0;
  const afterExpense = Math.round((sales - expense + Number.EPSILON) * 100) / 100;
  const afterUpiAndExpense = Math.round((sales - upi - expense + Number.EPSILON) * 100) / 100;
  return (
    <div>
      <PageHeader title="Daily sales" description="Bottles sold and revenue are calculated from the stock entry. Record what was actually collected beside it.">
        <input className="field sm:w-44" aria-label="Sales date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </PageHeader>
      {state.loading && <Spinner label="Loading sales" />}
      {state.error && <Banner>{state.error}</Banner>}
      {data && !data.hasEntry && (
        <EmptyState title="No sales can be calculated yet">
          <Link className="font-semibold text-pine-800 underline" to={`/daily-stock?date=${date}`}>Enter stock for {formatDate(date)}</Link>
        </EmptyState>
      )}
      {data?.hasEntry && (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2">
            <article className="card p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">Sales − expense</div>
              <div className={`mt-2 text-xl font-extrabold sm:text-2xl ${afterExpense < 0 ? 'text-red-700' : ''}`}>{formatINR(afterExpense)}</div>
              <p className="mt-1 text-xs text-stone-500">{formatINR(sales)} − {formatINR(expense)}</p>
            </article>
            <article className="card bg-pine-800 p-4 text-white">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-pine-100">Sales − UPI − expense</div>
              <div className="mt-2 text-xl font-extrabold sm:text-2xl">{formatINR(afterUpiAndExpense)}</div>
              <p className="mt-1 text-xs text-pine-100">{formatINR(sales)} − {formatINR(upi)} − {formatINR(expense)}</p>
            </article>
          </section>
          <div className="grid gap-4 xl:grid-cols-3">
          <div className="card xl:col-span-2">
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Sold</th>
                    <th>Price</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <div className="font-semibold">{line.itemName}</div>
                        <div className="text-xs text-stone-500">{line.size}</div>
                        {line.currentPrice !== line.sellingPrice && (
                          <div className="text-xs text-pine-800">Saved price {formatINR(line.sellingPrice)}. Current master price is {formatINR(line.currentPrice)}.</div>
                        )}
                      </td>
                      <td>{formatNumber(line.soldBottles)}</td>
                      <td>{formatINR(line.sellingPrice)}</td>
                      <td className="font-semibold">{formatINR(line.salesRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-bold">Total</td>
                    <td className="font-bold">{formatNumber(data.totalBottles)}</td>
                    <td />
                    <td className="font-bold">{formatINR(data.totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <form className="card h-fit p-4" onSubmit={save}>
            <h2 className="font-bold">Collections</h2>
            <p className="mt-1 text-xs text-stone-500">Cash is the same as the sales total. It is not typed separately.</p>
            <div className="mt-3">
              <div className="text-sm font-semibold">Cash</div>
              <div className="field mt-1 bg-stone-50 font-semibold">{formatINR(sales)}</div>
            </div>
            {[['upi', 'UPI'], ['expense', 'Expense']].map(([key, label]) => (
              <label key={key} className="mt-3 block text-sm font-semibold">
                {label}
                <input className="field mt-1" inputMode="decimal" value={form[key]} disabled={!canCollect} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              </label>
            ))}
            <label className="mt-3 block text-sm font-semibold">
              Notes
              <textarea className="field mt-1" rows={3} value={form.notes} disabled={!canCollect} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <div className="mt-4 space-y-2 rounded-xl bg-paper px-3 py-3 text-sm">
              <div className="flex justify-between gap-3"><span>Total</span><strong>{formatINR(sales)}</strong></div>
              <div className="flex justify-between gap-3"><span>Cash</span><strong>{formatINR(sales)}</strong></div>
              <div className={`flex justify-between gap-3 ${afterExpense < 0 ? 'text-red-700' : ''}`}><span>Sales − expense</span><strong>{formatINR(afterExpense)}</strong></div>
              <div className={`flex justify-between gap-3 border-t border-line pt-2 text-base ${afterUpiAndExpense < 0 ? 'text-red-700' : 'text-pine-800'}`}><span>Sales − UPI − expense</span><strong>{formatINR(afterUpiAndExpense)}</strong></div>
            </div>
            {canCollect && <button className="btn-primary mt-4 w-full" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save collections'}</button>}
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
