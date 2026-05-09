import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, verify the session cookie by calling /me.
  // No token in localStorage — the browser sends the HttpOnly cookie automatically.
  useEffect(() => {
    api.me()
      .then(data => {
        const u = data.user;
        setUser({
          id:              u.id,
          email:           u.email,
          firstName:       u.first_name ?? u.firstName,
          lastName:        u.last_name  ?? u.lastName,
          role:            u.role,
          organization_id: u.organization_id,
          orgName:         u.org_name ?? u.orgName,
        });
      })
      .catch(() => {
        // Cookie absent, expired, or invalid — stay logged out
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const clearExpiredSession = () => setUser(null);
    window.addEventListener('auth:expired', clearExpiredSession);
    return () => window.removeEventListener('auth:expired', clearExpiredSession);
  }, []);

  async function login(email, password, loginCode) {
    const data = await api.login(email, password, loginCode);
    // Server sets the HttpOnly cookie; we just store user profile in memory.
    // Normalise org_name → orgName so both sources (login + /me) have the same shape.
    const u = data.user;
    const normalised = {
      ...u,
      orgName: u.org_name ?? u.orgName,
    };
    setUser(normalised);
    return normalised;
  }

  const logout = useCallback(async () => {
    try {
      await api.logout(); // server clears the cookie
    } catch {
      // Even if the API call fails, clear local state
    }
    setUser(null);
  }, []);

  /**
   * Handle a 401 from any API call: clear local user state and let ProtectedRoute
   * redirect to /login. Call this from catch handlers wherever needed.
   */
  const handleAuthError = useCallback((err) => {
    if (err?.status === 401) {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, handleAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
