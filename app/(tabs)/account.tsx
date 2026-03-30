import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { api, UserProfile } from '@/services/api';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface MenuItemProps {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onPress, danger }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? '#ff4444' : '#3b12a3'} />
      </View>
      <ThemedText style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</ThemedText>
      {!danger && <Ionicons name="chevron-forward" size={18} color="#ccc" />}
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) loadProfile();
    else setLoading(false);
  }, [isAuthenticated]);

  const loadProfile = async () => {
    try {
      const data = await api.get<UserProfile>('/api/user/profile');
      setProfile(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : user
    ? `${user.firstName} ${user.lastName}`
    : '';

  const displayEmail = profile?.email ?? user?.email ?? '';

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView>
        {/* Avatar + nom */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase() || '?'}
            </ThemedText>
          </View>
          <ThemedText style={styles.profileName}>{displayName}</ThemedText>
          <ThemedText style={styles.profileEmail}>{displayEmail}</ThemedText>
        </View>

        {/* Section compte */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Mon compte</ThemedText>
          <View style={styles.card}>
            <MenuItem icon="person-outline"       label="Informations personnelles"  onPress={() => {}} />
            <View style={styles.divider} />
            <MenuItem icon="location-outline"     label="Carnet d'adresses"          onPress={() => {}} />
            <View style={styles.divider} />
            <MenuItem icon="card-outline"         label="Méthodes de paiement"       onPress={() => {}} />
          </View>
        </View>

        {/* Section abonnements */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Abonnements & Commandes</ThemedText>
          <View style={styles.card}>
            <MenuItem icon="refresh-circle-outline" label="Mes abonnements actifs"  onPress={() => {}} />
            <View style={styles.divider} />
            <MenuItem icon="receipt-outline"        label="Historique des commandes" onPress={() => router.push('/orders')} />
            <View style={styles.divider} />
            <MenuItem icon="document-text-outline"  label="Mes factures"            onPress={() => {}} />
          </View>
        </View>

        {/* Section support */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Support</ThemedText>
          <View style={styles.card}>
            <MenuItem icon="chatbubble-outline"  label="Contacter le support"  onPress={() => router.push('/contact')} />
            <View style={styles.divider} />
            <MenuItem icon="help-circle-outline" label="À propos de Cyna"      onPress={() => router.push('/about')} />
            <View style={styles.divider} />
            <MenuItem icon="document-outline"    label="Conditions générales"  onPress={() => router.push('/cgu')} />
            <View style={styles.divider} />
            <MenuItem icon="shield-outline"      label="Mentions légales"      onPress={() => router.push('/legal')} />
          </View>
        </View>

        {/* Déconnexion */}
        <View style={styles.section}>
          <View style={styles.card}>
            <MenuItem icon="log-out-outline" label="Se déconnecter" onPress={handleLogout} danger />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  profileHeader: {
    backgroundColor: '#3b12a3', alignItems: 'center',
    paddingVertical: 32, paddingHorizontal: 20,
  },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:   { fontSize: 28, fontWeight: '900', color: '#fff' },
  profileName:  { fontSize: 20, fontWeight: '700', color: '#fff' },
  profileEmail: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  section:      { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  card:    { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 16 },

  menuItem:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuIcon:      { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  menuIconDanger:{ backgroundColor: '#fff0f0' },
  menuLabel:     { flex: 1, fontSize: 15, color: '#1a1a1a' },
  menuLabelDanger: { color: '#ff4444' },
});
