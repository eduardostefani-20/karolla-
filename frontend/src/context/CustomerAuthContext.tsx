import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CustomerAccount, CustomerSession } from '@karolla/shared';
import { configureCustomerAuth } from '@/services/api';
import { accountApi } from '@/services/accountApi';

/**
 * Sessão do cliente ("Minha conta"), separada da sessão da equipe. Guarda só os tokens.
 * O servidor confere em toda requisição que o cliente só acessa o próprio cadastro.
 */
const STORAGE_KEY = 'karolla:customer-session';

interface CustomerAuthState {
  account: CustomerAccount | null;
  status: 'checking' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  /** Entra com a sessão devolvida pelo cadastro (quando não precisa confirmar o e-mail). */
  startSession: (session: CustomerSession) => void;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthState | null>(null);

function readSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CustomerSession;
    if (!session.token || (!session.refreshToken && Date.parse(session.expiresAt) <= Date.now())) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(session: CustomerSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* sem storage: vale só nesta aba */
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(() => readSession());
  const [status, setStatus] = useState<CustomerAuthState['status']>(() => (readSession() ? 'checking' : 'anonymous'));
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage indisponível */
    }
    sessionRef.current = null;
    setSession(null);
    setStatus('anonymous');
  }, []);
  const clearRef = useRef(clear);
  clearRef.current = clear;

  // Configurado já na renderização (não em efeito): as páginas filhas buscam dados nos próprios
  // efeitos, que rodam antes dos efeitos deste provider.
  const configured = useRef(false);
  if (!configured.current) {
    configured.current = true;
    const refresh = async () => {
      const refreshToken = sessionRef.current?.refreshToken;
      if (!refreshToken) return null;
      const renewed = await accountApi.refresh(refreshToken);
      sessionRef.current = renewed;
      writeSession(renewed);
      setSession(renewed);
      return renewed.token;
    };
    configureCustomerAuth(() => sessionRef.current?.token ?? null, () => clearRef.current(), refresh);
  }

  const reload = useCallback(async () => {
    const account = await accountApi.me();
    setSession((s) => {
      const next = s ? { ...s, ...(sessionRef.current ?? {}), account } : s;
      if (next) writeSession(next);
      return next;
    });
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    if (status !== 'checking') return;
    reload().catch(clear);
  }, [status, reload, clear]);

  const startSession = useCallback((next: CustomerSession) => {
    sessionRef.current = next;
    writeSession(next);
    setSession(next);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (email: string, password: string) => startSession(await accountApi.login(email, password)), [startSession]);

  const logout = useCallback(async () => {
    await accountApi.logout().catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({ account: session?.account ?? null, status, login, startSession, logout, reload }),
    [session, status, login, startSession, logout, reload],
  );
  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthState {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth deve ser usado dentro de CustomerAuthProvider');
  return ctx;
}

/** Versão opcional (componentes fora do provider, ex.: testes). */
export function useOptionalCustomerAuth(): CustomerAuthState | null {
  return useContext(CustomerAuthContext);
}
