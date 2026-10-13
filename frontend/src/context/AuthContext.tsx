import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { hasPermission, type AdminUser, type AuthSession, type Permission } from '@karolla/shared';
import { configureApiAuth } from '@/services/api';
import { authApi } from '@/services/adminApi';

/**
 * Sessão da equipe. Guarda apenas os tokens da sessão (nunca a senha).
 * O servidor confere token e permissões a cada requisição; o token de acesso vencido é renovado
 * automaticamente com o refresh token. Conta desativada/sessão revogada → volta ao login.
 * As permissões aqui servem só para esconder menus e botões — quem decide é sempre o servidor.
 */
const STORAGE_KEY = 'karolla:admin-session';
const ACTIVITY_KEY = 'karolla:admin-activity';
/** Sem uso do painel por este tempo, a sessão é encerrada (ex.: computador da loja esquecido aberto). */
export const ADMIN_IDLE_LIMIT_MS = 8 * 60 * 60 * 1000;

function lastActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function touchActivity() {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* storage indisponível */
  }
}

interface AuthState {
  user: AdminUser | null;
  status: 'checking' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    // parado há mais tempo que o limite: exige login de novo
    const last = lastActivity();
    if (last && Date.now() - last > ADMIN_IDLE_LIMIT_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // token vencido sem refresh token: não há como renovar
    if (!session.token || (!session.refreshToken && Date.parse(session.expiresAt) <= Date.now())) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* sem storage: sessão vale só nesta aba */
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

  // Sessão atual em ref: a camada HTTP lê sempre o token mais novo (também sem localStorage).
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    const refresh = async () => {
      const refreshToken = sessionRef.current?.refreshToken;
      if (!refreshToken) return null;
      const renewed = await authApi.refresh(refreshToken);
      sessionRef.current = renewed;
      writeSession(renewed);
      setSession(renewed);
      return renewed.token;
    };
    configureApiAuth(() => sessionRef.current?.token ?? null, clear, refresh);
  }, [clear]);

  // Valida a sessão salva ao abrir o painel (e atualiza perfil/permissões)
  useEffect(() => {
    if (status !== 'checking') return;
    authApi
      .me()
      .then(({ user }) => {
        setSession((s) => {
          const next = s ? { ...s, ...(sessionRef.current ?? {}), user } : s;
          if (next) writeSession(next);
          return next;
        });
        setStatus('authenticated');
      })
      .catch(clear);
  }, [status, clear]);

  // Encerra a sessão por inatividade (vale entre abas: a última atividade fica no navegador).
  useEffect(() => {
    if (status !== 'authenticated') return;
    let lastWrite = 0;
    const onActivity = () => {
      if (Date.now() - lastWrite < 60_000) return;
      lastWrite = Date.now();
      touchActivity();
    };
    onActivity();
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity() > ADMIN_IDLE_LIMIT_MS) {
        void authApi.logout().catch(() => undefined);
        clear();
      }
    }, 60_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, [status, clear]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    touchActivity();
    sessionRef.current = result;
    writeSession(result);
    setSession(result);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clear();
  }, [clear]);

  const can = useCallback((permission: Permission) => hasPermission(session?.user.permissions, permission), [session]);

  const value = useMemo(() => ({ user: session?.user ?? null, status, login, logout, can }), [session, status, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
