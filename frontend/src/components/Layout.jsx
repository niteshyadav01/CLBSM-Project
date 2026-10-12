import { ChevronDown, ClipboardList, FileBarChart, IndianRupee, KeyRound, LayoutDashboard, LogOut, MoreHorizontal, Package, PanelLeftClose, PanelLeftOpen, Settings, Warehouse, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Modal } from './ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../utils/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/items', label: 'Item Master', icon: Package },
  { to: '/daily-stock', label: 'Daily Stock', icon: ClipboardList },
  { to: '/sales', label: 'Daily Sales', icon: IndianRupee },
  { to: '/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const BOTTOM = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/daily-stock', label: 'Stock', icon: ClipboardList },
  { to: '/sales', label: 'Sales', icon: IndianRupee },
  { to: '/inventory', label: 'Stockroom', icon: Warehouse },
];

function SideNav({ onNavigate, collapsed }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold',
                collapsed && 'justify-center px-2',
                isActive ? 'bg-white/10 text-white' : 'text-pine-100 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon size={18} />
            {!collapsed && item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('clbsm_sidebar') === 'closed');
  const [drawer, setDrawer] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const initials = user.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    localStorage.setItem('clbsm_sidebar', collapsed ? 'closed' : 'open');
  }, [collapsed]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setDrawer(false);
        setAccountOpen(false);
      }
    };
    const onPointer = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 hidden flex-col bg-pine-900 text-white lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64'
        )}
      >
        <div className="border-b border-white/10 px-4 py-4">
          <div className={cx('flex items-center gap-2', collapsed ? 'justify-center' : 'justify-between')}>
            {!collapsed && <div className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-brass-100">Country liquor bar</div>}
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-white hover:bg-white/10"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          {!collapsed && <div className="mt-2 text-lg font-extrabold leading-tight">Stock & Sales</div>}
        </div>
        <SideNav collapsed={collapsed} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/50" aria-label="Close sidebar" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[min(18rem,88vw)] flex-col bg-pine-900 text-white">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brass-100">Country liquor bar</div>
                <div className="font-extrabold">Stock & Sales</div>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setDrawer(false)} aria-label="Close sidebar">
                <X size={18} />
              </button>
            </div>
            <SideNav onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className={cx('min-w-0 flex-1 transition-[padding] duration-200', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-3 py-3 backdrop-blur sm:px-4 md:px-6">
          <button type="button" className="icon-btn lg:hidden" onClick={() => setDrawer(true)} aria-label="Open sidebar">
            <PanelLeftOpen size={18} />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-bold lg:hidden">Stock & Sales</div>
          <div className="relative ml-auto" ref={accountRef}>
            <button
              type="button"
              className="flex max-w-[16rem] items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-2 shadow-sm hover:bg-pine-50"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-800 text-xs font-bold text-white">{initials}</span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-sm font-bold leading-4">{user.name}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Admin</span>
              </span>
              <ChevronDown size={16} className={cx('shrink-0 text-stone-500 transition', accountOpen && 'rotate-180')} />
            </button>
            {accountOpen && (
              <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-card" role="menu">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-pine-50"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    setPasswordOpen(true);
                  }}
                >
                  <KeyRound size={16} />
                  Change password
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                  role="menuitem"
                  onClick={onLogout}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="min-w-0 overflow-x-hidden px-3 py-4 pb-24 sm:px-4 md:px-6 md:py-7 lg:pb-7">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {BOTTOM.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-semibold', isActive ? 'text-pine-800' : 'text-stone-500')
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
          <button type="button" className="flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-semibold text-stone-500" onClick={() => setDrawer(true)}>
            <MoreHorizontal size={18} />
            More
          </button>
        </nav>
      </div>
      {passwordOpen && <PasswordDialog onClose={() => setPasswordOpen(false)} onSaved={(message) => toast(message)} />}
    </div>
  );
}

function PasswordDialog({ onClose, onSaved }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      onSaved(result.message || 'Password changed.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      <form className="space-y-3" onSubmit={save}>
        <p className="text-sm text-stone-600">Use at least 8 characters, with a letter and a number.</p>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        <label className="block text-sm font-semibold">
          Current password
          <input className="field mt-1" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <label className="block text-sm font-semibold">
          New password
          <input className="field mt-1" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </label>
        <label className="block text-sm font-semibold">
          Confirm new password
          <input className="field mt-1" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </label>
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Modal>
  );
}
