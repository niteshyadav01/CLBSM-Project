import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, PageHeader, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/format';

const empty = { name: '', username: '', password: '', role: 'staff', active: true };

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/users');
      setUsers(data.users);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    try {
      if (form.id) {
        const body = { name: form.name, role: form.role, active: form.active };
        if (form.password) body.password = form.password;
        await api(`/users/${form.id}`, { method: 'PUT', body });
      } else {
        await api('/users', { method: 'POST', body: { name: form.name, username: form.username, password: form.password, role: form.role } });
      }
      toast('User saved.');
      setForm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Users" description="Admins manage accounts. Staff can enter stock and view sales. Managers also handle items, adjustments, collections, and reports.">
        <button className="btn-primary" type="button" onClick={() => setForm(empty)}>Add user</button>
      </PageHeader>
      {loading && <Spinner label="Loading users" />}
      {error && <Banner>{error}</Banner>}
      {!loading && !error && (
        <div className="card table-wrap">
          <table className="grid-table">
            <thead>
              <tr><th>Name</th><th>User</th><th>Role</th><th>Status</th><th>Created</th><th /></tr>
            </thead>
            <tbody>
              {users.map((person) => (
                <tr key={person.id}>
                  <td className="font-semibold">{person.name}</td>
                  <td>{person.username}</td>
                  <td className="capitalize">{person.role}</td>
                  <td>{person.active ? 'Active' : 'Inactive'}</td>
                  <td>{formatDateTime(person.createdAt)}</td>
                  <td className="text-right"><button className="btn-secondary" type="button" onClick={() => setForm({ ...person, password: '' })}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form && (
        <Modal title={form.id ? 'Edit user' : 'Add user'} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={save}>
            <label className="block text-sm font-semibold">Name<input className="field mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label className="block text-sm font-semibold">User<input className="field mt-1" autoComplete="off" value={form.username || ''} disabled={Boolean(form.id)} onChange={(event) => setForm({ ...form, username: event.target.value })} required /></label>
            <label className="block text-sm font-semibold">
              {form.id ? 'New password (optional)' : 'Password'}
              <input className="field mt-1" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!form.id} />
            </label>
            <label className="block text-sm font-semibold">
              Role
              <select className="field mt-1" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            {form.id && (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                Active
              </label>
            )}
            <button className="btn-primary" type="submit">Save user</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
