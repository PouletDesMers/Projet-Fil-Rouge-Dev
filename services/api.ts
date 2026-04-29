import { resolveApiBaseUrl } from '@/services/api-base-url';

const BASE_URL = resolveApiBaseUrl();

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
    let message = text || `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (typeof json.error === 'string' && json.error) message = json.error;
      else if (typeof json.message === 'string' && json.message) message = json.message;
    } catch {}
    throw new Error(message);
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

// ── Types frontend (ce qu'utilisent les composants) ───────────────────────────

export interface LoginResponse {
  token: string;
  user_id: number;
  requires_2fa?: boolean;
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
  id_utilisateur: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: string;
  totp_enabled?: boolean;
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

export interface Abonnement {
  id: number;
  startDate: string;
  endDate?: string | null;
  quantity?: number | null;
  status: string;
  autoRenewal: boolean;
  companyId: number;
  productId: number;
  pricingId: number;
}

// ── Normalizers backend → frontend pour les commandes ────────────────────────
// Le backend retourne orderDate / totalAmount / id numérique

export function normalizeOrder(raw: Record<string, unknown>): Order {
  return {
    id:     String(raw.id ?? ''),
    date:   (raw.orderDate ?? raw.date ?? '') as string,
    total:  (raw.totalAmount ?? raw.total ?? 0) as number,
    status: (raw.status ?? '') as string,
    items:  ((raw.items ?? []) as Record<string, unknown>[]).map(normalizeOrderItem),
  };
}

export function normalizeOrderItem(raw: Record<string, unknown>): OrderItem {
  return {
    productId:   String(raw.product_slug ?? raw.productId ?? ''),
    productName: (raw.product_name ?? raw.productName ?? '') as string,
    quantity:    (raw.quantity ?? 1) as number,
    price:       (raw.price ?? 0) as number,
    duration:    raw.duration as string | undefined,
  };
}

export function normalizeInvoice(raw: Record<string, unknown>): Invoice {
  return {
    id:      String(raw.id ?? ''),
    date:    (raw.invoiceDate ?? raw.date ?? '') as string,
    total:   (raw.amount ?? raw.total ?? 0) as number,
    orderId: String(raw.orderId ?? ''),
    pdfUrl:  (raw.pdfLink ?? raw.pdfUrl) as string | undefined,
  };
}

// ── Normalizers backend → frontend ───────────────────────────────────────────
// Le backend renvoie du snake_case; les composants utilisent du camelCase.

export function normalizeCarouselImage(raw: Record<string, unknown>): CarouselImage {
  return {
    id:       String(raw.id_image ?? raw.id ?? ''),
    url:      (raw.url_image ?? raw.url ?? '') as string,
    title:    (raw.titre ?? raw.title) as string | undefined,
    subtitle: (raw.description ?? raw.subtitle) as string | undefined,
    ordre:    (raw.ordre_affichage ?? raw.ordre ?? 0) as number,
    // link non présent dans le modèle backend
  };
}

export function normalizeCategory(raw: Record<string, unknown>): Category {
  return {
    id:          String(raw.id_categorie ?? raw.id ?? ''),
    nom:         (raw.nom ?? '') as string,
    slug:        (raw.slug ?? '') as string,
    description: (raw.description ?? '') as string | undefined,
    image:       (raw.image ?? raw.icone) as string | undefined,
  };
}

export function normalizeProduct(raw: Record<string, unknown>): Product {
  let images: string[] = [];
  try { images = JSON.parse((raw.images as string) || '[]'); } catch {}
  if (!Array.isArray(images)) images = [];

  const prix = raw.prix as number | null;
  const statut = (raw.statut as string | null | undefined) ?? '';

  return {
    id:          String(raw.id_produit ?? raw.id ?? ''),
    nom:         (raw.nom ?? '') as string,
    slug:        (raw.slug ?? '') as string,
    description: ((raw.description_courte || raw.description_longue || raw.description) ?? '') as string,
    prix:        prix ?? 0,
    image:       images[0],
    images:      images,
    disponible:  raw.actif !== false && statut !== 'Indisponible' && statut.toLowerCase() !== 'inactif',
    priorite:    (raw.ordre_affichage ?? 0) as number,
    categorie:   (raw.categorie_slug || raw.id_categorie) ? {
      id:          String(raw.id_categorie ?? ''),
      nom:         (raw.categorie_nom ?? '') as string,
      slug:        (raw.categorie_slug ?? '') as string,
      description: '',
    } : undefined,
  };
}
