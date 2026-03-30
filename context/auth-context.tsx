import React, { createContext, useCallback, useContext, useState } from 'react';

import { api, LoginResponse, setAuthToken, UserProfile } from '@/services/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.post<LoginResponse>('/api/login', { email, password });

      if (data.requires_2fa) {
        throw new Error('2FA_REQUIRED');
      }

      // Stocker le token avant de fetch le profil (qui nécessite l'auth)
      setAuthToken(data.token);
      setToken(data.token);

      // Récupérer le profil complet
      const profile = await api.get<UserProfile>('/api/user/profile');
      setUser({
        id:        String(profile.id_utilisateur),
        email:     profile.email,
        firstName: profile.firstName,
        lastName:  profile.lastName,
      });
      setIsAuthenticated(true);
    } catch (err) {
      // En cas d'erreur, on nettoie le token
      setAuthToken(null);
      setToken(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
