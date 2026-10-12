import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { formatINR, formatNumber } from '../utils/format';

const emptyForm = { name: '', category: 'Liquor', size: '', unitsPerBox: 48, sellingPrice: '', active: true };

export default function Items() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = user.role === 'admin' || user.role === 'manager';
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/items');
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function save(event) {
    event.preventDefault();
    const body = {
      name: form.name,
      category: form.category,
      size: form.size,
      unitsPerBox: Number(form.unitsPerBox),
      sellingPrice: Number(form.sellingPrice),
      active: form.active,
    };
    try {
      if (form.id) await api(`/items/${form.id}`, { method: 'PUT', body });
      else await api('/items', { method: 'POST', body });
      toast(form.id ? 'Item updated. Earlier sales keep their saved price.' : 'Item added.');
      setForm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggle(item) {
    const ok = await confirm({
      title: item.active ? 'Deactivate item?' : 'Activate item?',
      message: item.active ? `${item.name} will stay in old reports but drop off new stock sheets.` : `${item.name} will appear on new stock sheets again.`,
      confirmLabel: item.active ? 'Deactivate' : 'Activate',
      danger: item.active,
    });
    if (!ok) return;
    try {
      await api(`/items/${item.id}/status`, { method: 'PATCH', body: { active: !item.active } });
      toast(item.active ? 'Item deactivated.' : 'Item activated.');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Item Master" description="Bottle price, pack size, and whether the item is in daily use. Price changes apply to new entries only.">
        <input className="field sm:w-52" placeholder="Search items" value={search} onChange={(event) => setSearch(event.target.value)} />
        {canEdit && (
          <button className="btn-primary" type="button" onClick={() => setForm(emptyForm)}>
            Add item
          </button>
        )}
      </PageHeader>
      {loading && <Spinner label="Loading items" />}
      {error && <Banner>{error}</Banner>}
      {!loading && !error && (
        <>
          <div className="space-y-3 md:hidden">
            {visible.map((item) => (
              <article key={item.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-xs text-stone-500">{item.category} · {item.size}</div>
                  </div>
                  <span className={item.active ? 'shrink-0 rounded-full bg-pine-50 px-2 py-1 text-xs font-bold text-pine-800' : 'shrink-0 rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-500'}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><div className="text-xs text-stone-500">Per box</div><div className="font-semibold">{formatNumber(item.unitsPerBox)}</div></div>
                  <div><div className="text-xs text-stone-500">Bottle price</div><div className="font-semibold">{formatINR(item.sellingPrice)}</div></div>
                </div>
                {canEdit && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn-secondary" type="button" onClick={() => setForm(item)}>Edit</button>
                    <button className="btn-secondary" type="button" onClick={() => toggle(item)}>{item.active ? 'Deactivate' : 'Activate'}</button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="card table-wrap hidden md:block">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Per box</th>
                  <th>Bottle price</th>
                  <th>Status</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.size}</td>
                    <td>{formatNumber(item.unitsPerBox)}</td>
                    <td>{formatINR(item.sellingPrice)}</td>
                    <td>
                      <span className={item.active ? 'rounded-full bg-pine-50 px-2 py-1 text-xs font-bold text-pine-800' : 'rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-500'}>
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button className="btn-secondary" type="button" onClick={() => setForm(item)}>Edit</button>
                          <button className="btn-secondary" type="button" onClick={() => toggle(item)}>{item.active ? 'Deactivate' : 'Activate'}</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {form && (
        <Modal title={form.id ? 'Edit item' : 'Add item'} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={save}>
            <label className="block text-sm font-semibold">Name<input className="field mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label className="block text-sm font-semibold">Category<input className="field mt-1" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label>
            <label className="block text-sm font-semibold">Size<input className="field mt-1" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="180 ml" required /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Units per box<input className="field mt-1" inputMode="numeric" value={form.unitsPerBox} onChange={(event) => setForm({ ...form, unitsPerBox: event.target.value.replace(/[^\d]/g, '') })} required /></label>
              <label className="block text-sm font-semibold">Price per bottle (₹)<input className="field mt-1" inputMode="decimal" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} required /></label>
            </div>
            <button className="btn-primary" type="submit">Save item</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
