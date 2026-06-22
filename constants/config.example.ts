/**
 * Configuration de l'API pour l'application mobile
 * 
 * IMPORTANT: Changez l'adresse IP par votre IP locale !
 * Pour trouver votre IP: exécutez ipconfig dans PowerShell
 */

// Mode développement : utilisez votre IP locale
// Mode production : utilisez l'URL de production
export const API_URL = __DEV__ 
  ? 'http://192.168.1.100:8080/api'  // ⚠️ CHANGEZ CETTE IP !
  : 'https://api.cyna.com/api';

export const API_CONFIG = {
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// URLs des différents services
export const SERVICES = {
  api: __DEV__ ? 'http://192.168.1.100:8080' : 'https://api.cyna.com',
  web: __DEV__ ? 'http://192.168.1.100:3000' : 'https://cyna.com',
};

// Configuration Expo
export const EXPO_CONFIG = {
  scheme: 'cyna',
  name: 'CYNA',
};

// Pour trouver votre IP locale:
// Windows: ipconfig
// Mac/Linux: ifconfig | grep inet
// Cherchez "Adresse IPv4" ou "inet" (ex: 192.168.1.100)
