import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { call, setToken, setUnauthorizedHandler } from '../api/index.js';

const KEY = 'c1pemilu_session';
const AuthCtx = createContext(null);

function readSession() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const s = readSession();
    if (s) setToken(s.token);
    return s;
  });
  const [checking, setChecking] = useState(!!session);

  const clear = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ }
    setToken(null);
    setSession(null);
  }, []);

  useEffect(() => { setUnauthorizedHandler(clear); }, [clear]);

  useEffect(() => {
    if (!session) return;
    call('me')
      .then((user) => {
        const s = { ...session, user };
        setSession(s);
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* abaikan */ }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await call('login', { username, password });
    setToken(data.token);
    const s = { token: data.token, user: data.user };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* abaikan */ }
    setSession(s);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await call('logout'); } catch (e) { /* abaikan */ }
    clear();
  }, [clear]);

  const value = useMemo(() => ({
    user: session?.user || null,
    checking,
    login,
    logout,
    can: (...roles) => !!session?.user && roles.includes(session.user.role)
  }), [session, checking, login, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
