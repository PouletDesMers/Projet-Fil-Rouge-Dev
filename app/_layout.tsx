import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';

import { AuthProvider } from '@/context/auth-context';
import { CartProvider } from '@/context/cart-context';
import { LanguageProvider } from '@/context/language-context';
import { ChatFAB } from '@/components/chat-fab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

const HIDE_FAB_ROUTES = ['/chat', '/(auth)', '/login', '/register', '/forgot-password'];

function AppShell() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const showFAB = isAuthenticated && !HIDE_FAB_ROUTES.some(r => pathname.startsWith(r));

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
      </Stack>
      {showFAB && <ChatFAB />}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <AppShell />
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
