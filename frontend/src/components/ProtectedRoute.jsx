import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Loading your session" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold">You do not have access to this page.</h1>
        <p className="mt-2 text-sm text-stone-600">Ask an admin if you need a different role.</p>
      </div>
    );
  }
  return <Outlet />;
}
