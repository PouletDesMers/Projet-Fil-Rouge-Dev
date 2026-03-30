import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

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
  login: (user: User) => void;
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
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  const login = useCallback((userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
