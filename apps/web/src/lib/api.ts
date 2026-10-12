import type { ApiErrorBody } from '@audience/shared';

const BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api';

/** A failed API call, with the HTTP status and the server's JSON error body. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    super(body?.error ?? `Request failed (${status})`);
    this.name = 'ApiError';
  }
}

type Json = Record<string, unknown> | unknown[];

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: Json;
  query?: Record<string, string | number | boolean | undefined>;
}

/** JSON fetch wrapper. Sends the login cookie (credentials: 'include') and throws ApiError on non-2xx. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...init } = options;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const url = `${BASE_URL}${path}${qs.size > 0 ? `?${qs.toString()}` : ''}`;

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) throw new ApiError(res.status, isErrorBody(data) ? data : null);
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}
