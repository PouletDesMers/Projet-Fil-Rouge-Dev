/**
 * Service API pour l'application mobile CYNA
 * Gère toutes les communications avec le backend
 */

import { resolveApiBaseUrl } from '@/services/api-base-url';

const API_BASE_URL = resolveApiBaseUrl();

export interface LoginResponse {
  token: string;
  user: User;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  status: string;
  companyId?: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  active: boolean;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  active: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  serviceId: number;
  active: boolean;
}

class ApiService {
  private token: string | null = null;
  private baseURL: string = API_BASE_URL;

  /**
   * Définir le token d'authentification
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Obtenir le token actuel
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Changer l'URL de base de l'API (pour les tests)
   */
  setBaseURL(url: string) {
    this.baseURL = url;
  }

  /**
   * Méthode générique pour faire des requêtes
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    // Ajouter le token si disponible
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      // Gérer les erreurs HTTP
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API Error ${response.status}: ${errorText || response.statusText}`
        );
      }

      // Parser la réponse JSON
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  /**
   * ========================================
   * AUTHENTIFICATION
   * ========================================
   */

  /**
   * Connexion utilisateur
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Sauvegarder le token
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  /**
   * Inscription utilisateur
   */
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    role?: string;
  }): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...userData,
        role: userData.role || 'client',
      }),
    });
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    try {
      await this.request('/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.setToken(null);
    }
  }

  /**
   * ========================================
   * PROFIL UTILISATEUR
   * ========================================
   */

  /**
   * Obtenir le profil de l'utilisateur connecté
   */
  async getUserProfile(): Promise<User> {
    return this.request<User>('/user/profile');
  }

  /**
   * Mettre à jour le profil utilisateur
   */
  async updateUserProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Changer le mot de passe
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return this.request('/user/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });
  }

  /**
   * ========================================
   * CATALOGUE
   * ========================================
   */

  /**
   * Récupérer toutes les catégories
   */
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  /**
   * Récupérer une catégorie par ID
   */
  async getCategoryById(id: number): Promise<Category> {
    return this.request<Category>(`/categories/${id}`);
  }

  /**
   * Récupérer tous les services
   */
  async getServices(): Promise<Service[]> {
    return this.request<Service[]>('/services');
  }

  /**
   * Récupérer les services d'une catégorie
   */
  async getServicesByCategory(categoryId: number): Promise<Service[]> {
    return this.request<Service[]>(`/categories/${categoryId}/services`);
  }

  /**
   * Récupérer un service par ID
   */
  async getServiceById(id: number): Promise<Service> {
    return this.request<Service>(`/services/${id}`);
  }

  /**
   * Récupérer tous les produits
   */
  async getProducts(): Promise<Product[]> {
    return this.request<Product[]>('/products');
  }

  /**
   * Récupérer les produits d'un service
   */
  async getProductsByService(serviceId: number): Promise<Product[]> {
    return this.request<Product[]>(`/services/${serviceId}/products`);
  }

  /**
   * Récupérer un produit par ID
   */
  async getProductById(id: number): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  /**
   * ========================================
   * TARIFICATION
   * ========================================
   */

  /**
   * Récupérer les tarifs d'un produit
   */
  async getProductPricing(productId: number) {
    return this.request(`/products/${productId}/pricing`);
  }

  /**
   * ========================================
   * COMMANDES
   * ========================================
   */

  /**
   * Créer une nouvelle commande
   */
  async createOrder(orderData: any) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  /**
   * Récupérer les commandes de l'utilisateur
   */
  async getUserOrders() {
    return this.request('/user/orders');
  }

  /**
   * Récupérer une commande par ID
   */
  async getOrderById(id: number) {
    return this.request(`/orders/${id}`);
  }

  /**
   * ========================================
   * SUPPORT
   * ========================================
   */

  /**
   * Créer un ticket de support
   */
  async createSupportTicket(ticketData: {
    subject: string;
    description: string;
    priority?: string;
  }) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  /**
   * Récupérer les tickets de support de l'utilisateur
   */
  async getUserTickets() {
    return this.request('/user/tickets');
  }

  /**
   * ========================================
   * NOTIFICATIONS
   * ========================================
   */

  /**
   * Récupérer les notifications de l'utilisateur
   */
  async getNotifications() {
    return this.request('/user/notifications');
  }

  /**
   * Marquer une notification comme lue
   */
  async markNotificationAsRead(id: number) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  /**
   * ========================================
   * UTILITAIRES
   * ========================================
   */

  /**
   * Vérifier la santé de l'API
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }

  /**
   * Test de connexion
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Instance singleton du service API
export const apiService = new ApiService();

// Export par défaut
export default apiService;
