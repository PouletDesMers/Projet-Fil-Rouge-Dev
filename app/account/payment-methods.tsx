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
import { api } from '@/services/api';

interface Paiement {
  id: number;
  method: string;
  status: string;
  paymentDate: string;
  externalReference?: string;
  orderId: number;
}

const METHOD_ICON: Record<string, string> = {
  card:         'card-outline',
  carte:        'card-outline',
  stripe:       'card-outline',
  virement:     'swap-horizontal-outline',
  prélèvement:  'repeat-outline',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Réussi',
  pending:   'En attente',
  failed:    'Échoué',
  refunded:  'Remboursé',
};

const STATUS_COLOR: Record<string, string> = {
  completed: '#27ae60',
  pending:   '#e67e22',
  failed:    '#e74c3c',
  refunded:  '#888',
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Paiement[]>('/api/paiements')
      .then(data => setPayments(data || []))
      .catch(() => setPayments([]))
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
        <ThemedText style={styles.headerTitle}>Méthodes de paiement</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={payments}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          payments.length > 0 ? (
            <ThemedText style={styles.sectionLabel}>Historique des paiements</ThemedText>
          ) : null
        }
        renderItem={({ item }) => {
          const iconName = METHOD_ICON[item.method?.toLowerCase()] ?? 'card-outline';
          const date = item.paymentDate
            ? new Date(item.paymentDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            : '—';
          const statusKey = item.status?.toLowerCase() ?? '';
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name={iconName as any} size={22} color="#3b12a3" />
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.cardTitle}>{item.method ?? 'Carte'}</ThemedText>
                  <ThemedText style={styles.cardSub}>{date} · Commande #{item.orderId}</ThemedText>
                  {item.externalReference ? (
                    <ThemedText style={styles.cardRef}>Réf : {item.externalReference}</ThemedText>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[statusKey] ?? '#888' }]}>
                  <ThemedText style={styles.statusText}>
                    {STATUS_LABEL[statusKey] ?? item.status}
                  </ThemedText>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={56} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Aucun paiement enregistré</ThemedText>
            <ThemedText style={styles.emptySub}>Vos paiements apparaîtront ici après vos commandes</ThemedText>
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

  list:         { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  cardBody:      { flex: 1, gap: 2 },
  cardTitle:     { fontSize: 14, fontWeight: '700', color: '#1a1a1a', textTransform: 'capitalize' },
  cardSub:       { fontSize: 12, color: '#666' },
  cardRef:       { fontSize: 11, color: '#aaa', marginTop: 2 },
  statusBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:    { color: '#fff', fontSize: 11, fontWeight: '700' },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySub:   { fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 32 },
});
