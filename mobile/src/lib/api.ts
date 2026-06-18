import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 20000,
});

const TOKEN_KEY = '@mlr:token';

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Injeta o Bearer token em toda requisição.
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Erro padronizado a partir do envelope { success, message, data }.
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message =
      body?.message ||
      (status === 0 ? 'Sem conexão com o servidor.' : 'Erro ao comunicar com o servidor.');
    return Promise.reject(new ApiError(message, status, body?.data));
  }
);

// Helper que devolve direto o `data` do envelope.
export async function unwrap<T = any>(promise: Promise<{ data: any }>): Promise<T> {
  const res = await promise;
  return res.data?.data as T;
}
