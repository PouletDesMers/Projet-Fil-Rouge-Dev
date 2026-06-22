import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Abonnement, api } from '@/services/api';

const STATUS_LABEL: Record<string, string> = {
  actif:    'Actif',
  active:   'Actif',
  inactif:  'Inactif',
  inactive: 'Inactif',
  suspendu: 'Suspendu',
  suspended:'Suspendu',
  cancelled:'Résilié',
};

const STATUS_COLOR: Record<string, string> = {
  actif:    '#27ae60',
  active:   '#27ae60',
  inactif:  '#888',
  inactive: '#888',
  suspendu: '#e67e22',
  suspended:'#e67e22',
  cancelled:'#e74c3c',
};

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Abonnement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Abonnement[]>('/api/abonnements')
      .then(data => setSubscriptions(data || []))
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Mes abonnements</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={subscriptions}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const statusKey = item.status?.toLowerCase() ?? '';
          const start = item.startDate
            ? new Date(item.startDate).toLocaleDateString('fr-FR')
            : '—';
          const end = item.endDate
            ? new Date(item.endDate).toLocaleDateString('fr-FR')
            : 'En cours';
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#3b12a3" />
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.cardTitle}>Abonnement #{item.id}</ThemedText>
                  <ThemedText style={styles.cardSub}>Du {start} au {end}</ThemedText>
                  {item.quantity != null && (
                    <ThemedText style={styles.cardSub}>Quantité : {item.quantity}</ThemedText>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[statusKey] ?? '#888' }]}>
                  <ThemedText style={styles.statusText}>
                    {STATUS_LABEL[statusKey] ?? item.status}
                  </ThemedText>
                </View>
              </View>
              {item.autoRenewal && (
                <View style={styles.renewalRow}>
                  <Ionicons name="refresh-outline" size={14} color="#3b12a3" />
                  <ThemedText style={styles.renewalText}>Renouvellement automatique activé</ThemedText>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="refresh-circle-outline" size={56} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Aucun abonnement actif</ThemedText>
            <ThemedText style={styles.emptySub}>Vos abonnements apparaîtront ici</ThemedText>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.push('/(tabs)/explore')}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.ctaText}>Découvrir nos services</ThemedText>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  list: { padding: 16, gap: 10 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  cardBody:      { flex: 1, gap: 2 },
  cardTitle:     { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  cardSub:       { fontSize: 12, color: '#666' },
  statusBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  renewalRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  renewalText:   { fontSize: 12, color: '#3b12a3' },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySub:   { fontSize: 14, color: '#666' },
  ctaBtn:     { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
  ctaText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
});
