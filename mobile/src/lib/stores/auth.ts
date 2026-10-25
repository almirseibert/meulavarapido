import { create } from 'zustand';
import { api, saveToken, getToken, clearToken, unwrap } from '../api';
import { unregisterPushDevice } from '../services/notify';
import { logLogin, logSignUp, clearAnalyticsUser } from '../services/analytics';
import type { Owner } from '../types';

interface AuthState {
  owner: Owner | null;
  loading: boolean;     // carregando sessão inicial
  ready: boolean;       // já tentou restaurar a sessão
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    verify?: { firebaseIdToken?: string; phone?: string }
  ) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setOwner: (o: Owner) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  owner: null,
  loading: false,
  ready: false,

  restore: async () => {
    const token = await getToken();
    if (!token) return set({ ready: true });
    try {
      const owner = await unwrap<Owner>(api.get('/auth/me'));
      set({ owner, ready: true });
    } catch {
      await clearToken();
      set({ owner: null, ready: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const data = await unwrap<{ token: string; owner: Owner }>(
        api.post('/auth/login', { email, password })
      );
      await saveToken(data.token);
      set({ owner: data.owner });
      logLogin('email');
    } finally {
      set({ loading: false });
    }
  },

  register: async (name, email, password, verify) => {
    set({ loading: true });
    try {
      const data = await unwrap<{ token: string; owner: Owner }>(
        api.post('/auth/register', {
          name, email, password,
          firebaseIdToken: verify?.firebaseIdToken,
          phone: verify?.phone,
        })
      );
      await saveToken(data.token);
      set({ owner: data.owner });
      // Telefone verificado pelo Firebase conta como cadastro por telefone.
      logSignUp(verify?.firebaseIdToken ? 'phone' : 'email');
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      const owner = await unwrap<Owner>(api.get('/auth/me'));
      set({ owner });
    } catch {
      /* mantém estado atual */
    }
  },

  logout: async () => {
    // Desvincula o aparelho antes de limpar o token (senão a chamada vai sem auth).
    await unregisterPushDevice();
    await clearAnalyticsUser();
    await clearToken();
    set({ owner: null });
  },

  setOwner: (owner) => set({ owner }),
}));
