import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size = 24 }: { name: IoniconsName; color: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const router = useRouter();

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
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/cart')}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="cart-outline" size={26} color="#fff" />
            </TouchableOpacity>
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
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Panier',
          tabBarIcon: ({ color }) => <TabIcon name="cart-outline" color={color} />,
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
        }}
      />
      {/* Screens cachés de la tab bar */}
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  );
}
