import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export const TOKEN_KEY = 'ptp_token';

export const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiEnvelope<unknown>;
    return envelope?.data as never;
  },
  (error: AxiosError<{ code?: number; message?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message ?? error.message ?? '网络请求失败';
    return Promise.reject(new Error(message));
  },
);

/** GET，返回业务 data（已剥离统一包裹） */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await http.get(url, config)) as unknown as T;
}

/** POST，返回业务 data */
export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await http.post(url, body, config)) as unknown as T;
}

/** PATCH，返回业务 data */
export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await http.patch(url, body, config)) as unknown as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}
