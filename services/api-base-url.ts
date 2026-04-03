import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeApiUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function getExpoDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest2?: { debuggerHost?: string; hostUri?: string } }).manifest2?.hostUri ||
    (Constants as { manifest2?: { debuggerHost?: string; hostUri?: string } }).manifest2?.debuggerHost ||
    null;

  if (!hostUri) return null;

  const withoutProtocol = hostUri.replace(/^https?:\/\//, '');
  const host = withoutProtocol.split(':')[0]?.split('/')[0] || '';

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  return host;
}

export function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return normalizeApiUrl(configured);
  }

  if (__DEV__) {
    const host = getExpoDevHost() || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
    return normalizeApiUrl(`http://${host}:8080`);
  }

  return 'https://api.cyna.com/api';
}