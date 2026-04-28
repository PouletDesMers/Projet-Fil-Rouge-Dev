import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api, LoginResponse, setAuthToken, UserProfile } from '@/services/api';

const TOKEN_KEY = 'cyna_auth_token';

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
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restaurer le token au démarrage
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (savedToken) {
          setAuthToken(savedToken);
          setToken(savedToken);
          const profile = await api.get<UserProfile>('/api/user/profile');
          setUser({
            id:        String(profile.id_utilisateur),
            email:     profile.email,
            firstName: profile.firstName,
            lastName:  profile.lastName,
          });
          setIsAuthenticated(true);
        }
      } catch {
        // Token expiré ou invalide — on nettoie
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        setAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    setIsLoading(true);
    try {
      const body: Record<string, string> = { email, password };
      if (totpCode) body.totpCode = totpCode;
      const data = await api.post<LoginResponse>('/api/login', body);

      if (data.requires_2fa) {
        throw new Error('2FA_REQUIRED');
      }

      setAuthToken(data.token);
      setToken(data.token);
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);

      const profile = await api.get<UserProfile>('/api/user/profile');
      setUser({
        id:        String(profile.id_utilisateur),
        email:     profile.email,
        firstName: profile.firstName,
        lastName:  profile.lastName,
      });
      setIsAuthenticated(true);
    } catch (err) {
      setAuthToken(null);
      setToken(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
