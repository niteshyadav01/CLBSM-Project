import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

export default function Login() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Spinner label="Loading" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-pine-900 px-10 py-12 text-white lg:flex xl:px-16">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-extrabold tracking-wide">CL</div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-brass-100">Country Liquor Bar</p>
          <h1 className="mt-4 max-w-lg text-4xl font-extrabold leading-tight xl:text-5xl">Stock and sales, kept for the day.</h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-pine-100">
            Closing stock becomes the next day’s opening. Sales, collections, and cash are calculated from that count.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-pine-100">
          <li>One admin sign-in</li>
          <li>Amounts in Indian Rupees</li>
          <li>Dates shown as DD-MM-YYYY</li>
        </ul>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pine-900 text-sm font-extrabold text-white">CL</div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-pine-700">Country Liquor Bar</p>
          </div>
          <form className="card p-6 sm:p-8" onSubmit={onSubmit}>
            <h2 className="text-2xl font-extrabold tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Enter the admin user name and password to open the ledger.</p>
            {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</div>}
            <label className="mt-6 block text-sm font-semibold" htmlFor="username">
              User name
              <span className="relative mt-1.5 block">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input
                  id="username"
                  className="field pl-10"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </span>
            </label>
            <label className="mt-4 block text-sm font-semibold" htmlFor="password">
              Password
              <span className="relative mt-1.5 block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input
                  id="password"
                  className="field pl-10 pr-11"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-ink"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            <button className="btn-primary mt-6 h-11 w-full" disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {import.meta.env.DEV && (
            <p className="mt-4 text-center text-xs leading-5 text-stone-500">First sign-in: admin / admin#2026. Change the password after you sign in.</p>
          )}
        </div>
      </section>
    </div>
  );
}
