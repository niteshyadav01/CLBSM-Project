import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="mt-0.5 block text-xs leading-5 text-stone-500">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user.role === 'admin';
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/settings')
      .then((data) => setForm(data))
      .catch((err) => setError(err.message));
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    try {
      const data = await api('/settings', {
        method: 'PUT',
        body: { ...form, lowStockThresholdBottles: Number(form.lowStockThresholdBottles) },
      });
      setForm(data.settings);
      toast('Settings saved.');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="These details identify the bar on reports. They do not change item prices, stock counts, or past sales."
      />
      {error && <Banner>{error}</Banner>}
      {!form && !error && <Spinner label="Loading settings" />}
      {form && (
        <form className="grid items-start gap-4 lg:grid-cols-2" onSubmit={save}>
          <section className="card space-y-5 p-4 sm:p-6">
            <div>
              <h2 className="font-bold">Business</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">Printed at the top of Excel, CSV, and PDF reports.</p>
            </div>
            <Field label="Business name" hint="The name shown on every report.">
              <input className="field" value={form.businessName} disabled={!canEdit} onChange={(event) => update('businessName', event.target.value)} required />
            </Field>
            <Field label="Address" hint="Optional. Left blank if you do not want an address on reports.">
              <textarea className="field min-h-24" rows={3} value={form.address} disabled={!canEdit} onChange={(event) => update('address', event.target.value)} />
            </Field>
            <Field label="Phone" hint="Optional contact number for the report header.">
              <input className="field" value={form.phone} disabled={!canEdit} onChange={(event) => update('phone', event.target.value)} />
            </Field>
          </section>

          <section className="card space-y-5 p-4 sm:p-6">
            <div>
              <h2 className="font-bold">Low-stock alert</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                An item is marked low when the bottles on hand are at or below this number. The dashboard and inventory use it. Saving here does not change the stock itself.
              </p>
            </div>
            <Field label="Alert level (bottles)" hint="Example: 48 means one box of 180 ml, or fewer, is low stock.">
              <input
                className="field sm:max-w-xs"
                inputMode="numeric"
                value={form.lowStockThresholdBottles}
                disabled={!canEdit}
                onChange={(event) => update('lowStockThresholdBottles', event.target.value.replace(/[^\d]/g, ''))}
                required
              />
            </Field>
            {canEdit ? (
              <button className="btn-primary w-full sm:w-auto" type="submit">Save settings</button>
            ) : (
              <p className="text-sm text-stone-500">Only the admin can change these settings.</p>
            )}
          </section>
        </form>
      )}
    </div>
  );
}
