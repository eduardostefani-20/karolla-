import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminUser, AuthSession } from '@karolla/shared';
import { configureApiAuth } from '@/services/api';
import { authApi } from '@/services/adminApi';

/**
 * Sessão administrativa. Guarda apenas o token de acesso (nunca senha ou chaves).
 * O token é validado pelo back-end a cada requisição; expirado → volta ao login.
 */
const STORAGE_KEY = 'karolla:admin-session';

interface AuthState {
  user: AdminUser | null;
  status: 'checking' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || Date.parse(session.expiresAt) <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [status, setStatus] = useState<AuthState['status']>(() => (readSession() ? 'checking' : 'anonymous'));

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage indisponível */
    }
    setSession(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    configureApiAuth(() => readSession()?.token ?? null, clear);
  }, [clear]);

  // Valida o token salvo ao abrir o painel
  useEffect(() => {
    if (status !== 'checking') return;
    authApi
      .me()
      .then(({ user }) => {
        setSession((s) => (s ? { ...s, user } : s));
        setStatus('authenticated');
      })
      .catch(clear);
  }, [status, clear]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
      /* sem storage: sessão vale só nesta aba */
    }
    configureApiAuth(() => result.token, clear);
    setSession(result);
    setStatus('authenticated');
  }, [clear]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo(() => ({ user: session?.user ?? null, status, login, logout }), [session, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
