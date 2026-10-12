import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('clbsm_token');
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    api('/auth/me')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        sessionStorage.removeItem('clbsm_token');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('clbsm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('clbsm:unauthorized', onUnauthorized);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(username, password) {
        const data = await api('/auth/login', { method: 'POST', body: { username, password } });
        sessionStorage.setItem('clbsm_token', data.token);
        setUser(data.user);
      },
      async logout() {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        sessionStorage.removeItem('clbsm_token');
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
