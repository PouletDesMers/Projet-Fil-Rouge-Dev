import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/context/cart-context';
import { api } from '@/services/api';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size = 24 }: { name: IoniconsName; color: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function CartTabIcon({ color }: { color: string }) {
  const { count } = useCart();
  return (
    <View>
      <Ionicons name="cart-outline" size={24} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      )}
    </View>
  );
}

function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get<Record<string, unknown>[]>('/api/notifications')
      .then((raw) => {
        const count = (raw || []).filter((n) => !n.lu && !n.read).length;
        setUnread(count);
      })
      .catch(() => {});
  }, []);

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      style={styles.bellBtn}
    >
      <Ionicons name="notifications-outline" size={24} color="#fff" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
          tabBarActiveTintColor: '#3b12a3',
          tabBarInactiveTintColor: '#888',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#e0e0e0',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
            headerShown: true,
            headerTitle: '',
            headerStyle: { backgroundColor: '#3b12a3' },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.push('/menu')}
                style={{ marginLeft: 16 }}
              >
                <Ionicons name="menu" size={28} color="#fff" />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <View style={styles.headerActions}>
                <NotificationBell />
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/cart')}
                  style={{ marginRight: 16 }}
                >
                  <Ionicons name="cart-outline" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Catalogue',
            tabBarIcon: ({ color }) => <TabIcon name="grid-outline" color={color} />,
            headerShown: true,
            headerTitle: 'Catalogue',
            headerStyle: { backgroundColor: '#3b12a3' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            headerRight: () => <NotificationBell />,
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: 'Panier',
            tabBarIcon: ({ color }) => <CartTabIcon color={color} />,
            headerShown: true,
            headerTitle: 'Mon panier',
            headerStyle: { backgroundColor: '#3b12a3' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Compte',
            tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} />,
            headerShown: true,
            headerTitle: 'Mon compte',
            headerStyle: { backgroundColor: '#3b12a3' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            headerRight: () => <NotificationBell />,
          }}
        />
        {/* Screens cachés de la tab bar */}
        <Tabs.Screen name="dashboard" options={{ href: null }} />
      </Tabs>
  );
}

const styles = StyleSheet.create({
  bellBtn:   { marginRight: 12, position: 'relative' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#e53935',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
