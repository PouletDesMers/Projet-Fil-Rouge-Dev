import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface MenuLinkProps {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
}

function MenuLink({ icon, label, onPress }: MenuLinkProps) {
  return (
    <TouchableOpacity style={styles.menuLink} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color="#fff" />
      <ThemedText style={styles.menuLinkText}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

export default function MenuModal() {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();

  const go = (path: string) => {
    router.back();
    setTimeout(() => router.push(path as never), 100);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.logo}>CYNA</ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Profil rapide si connecté */}
      {isAuthenticated && user && (
        <View style={styles.profileBanner}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{user.firstName.charAt(0).toUpperCase()}</ThemedText>
          </View>
          <View>
            <ThemedText style={styles.profileName}>{user.firstName} {user.lastName}</ThemedText>
            <ThemedText style={styles.profileEmail}>{user.email}</ThemedText>
          </View>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.nav}>
        <MenuLink icon="home-outline"    label="Accueil"    onPress={() => go('/(tabs)')} />
        <MenuLink icon="grid-outline"    label="Catalogue"  onPress={() => go('/(tabs)/explore')} />
        <MenuLink icon="cart-outline"    label="Panier"     onPress={() => go('/(tabs)/cart')} />

        {isAuthenticated ? (
          <>
            <View style={styles.separator} />
            <MenuLink icon="person-outline"         label="Mon compte"            onPress={() => go('/(tabs)/account')} />
            <MenuLink icon="receipt-outline"        label="Mes commandes"         onPress={() => go('/orders')} />
            <MenuLink icon="refresh-circle-outline" label="Mes abonnements"       onPress={() => go('/(tabs)/account')} />
          </>
        ) : (
          <>
            <View style={styles.separator} />
            <MenuLink icon="log-in-outline"    label="Se connecter"  onPress={() => go('/(auth)/login')} />
            <MenuLink icon="person-add-outline" label="S'inscrire"   onPress={() => go('/(auth)/register')} />
          </>
        )}

        <View style={styles.separator} />
        <MenuLink icon="chatbubble-outline"  label="Contact"           onPress={() => go('/contact')} />
        <MenuLink icon="information-circle-outline" label="À propos"  onPress={() => go('/about')} />
        <MenuLink icon="document-text-outline" label="CGU"            onPress={() => go('/cgu')} />
        <MenuLink icon="shield-outline"      label="Mentions légales"  onPress={() => go('/legal')} />

        {isAuthenticated && (
          <>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={20} color="#ff4444" />
              <ThemedText style={styles.logoutText}>Se déconnecter</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#3b12a3' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  logo:     { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  closeBtn: { padding: 4 },

  profileBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  avatar:       { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileName:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  profileEmail: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  nav: { paddingHorizontal: 16, paddingTop: 8 },

  menuLink: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 4,
  },
  menuLinkText: { fontSize: 17, color: '#fff', fontWeight: '500' },

  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 4,
  },
  logoutText: { fontSize: 17, color: '#ff6b6b', fontWeight: '500' },
});
