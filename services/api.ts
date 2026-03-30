// Base URL — changer selon l'environnement
// iOS simulateur : http://localhost:8080
// Android émulateur : http://10.0.2.2:8080
// Appareil physique : http://<IP_LOCAL>:8080
const BASE_URL = 'http://localhost:8080';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)  => request<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown)  => request<T>('PUT',    path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};

// ── Types réponses API ──────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CarouselImage {
  id: string;
  url: string;
  title?: string;
  subtitle?: string;
  link?: string;
  ordre: number;
}

export interface Category {
  id: string;
  nom: string;
  slug: string;
  description?: string;
  image?: string;
}

export interface Product {
  id: string;
  nom: string;
  slug: string;
  description?: string;
  prix: number;
  image?: string;
  images?: string[];
  disponible: boolean;
  priorite?: number;
  categorie?: Category;
}

export interface SearchResult {
  produits: Product[];
  total: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: string;
  items: OrderItem[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  duration?: string;
}

export interface Invoice {
  id: string;
  date: string;
  total: number;
  orderId: string;
  pdfUrl?: string;
}
