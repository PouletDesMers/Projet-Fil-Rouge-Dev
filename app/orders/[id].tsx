import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api, normalizeOrder, Order } from '@/services/api';

const STATUS_LABEL: Record<string, string> = {
  pending:   'En attente',
  confirmed: 'Confirmée',
  active:    'Active',
  cancelled: 'Annulée',
  completed: 'Terminée',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   '#e67e22',
  confirmed: '#3b12a3',
  active:    '#27ae60',
  cancelled: '#e74c3c',
  completed: '#888',
};

const DURATION_LABEL: Record<string, string> = {
  '1month':  '1 mois',
  '1year':   '1 an',
  '2years':  '2 ans',
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Record<string, unknown>>(`/api/commandes/${id}`)
      .then(raw => setOrder(normalizeOrder(raw)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Détail commande</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
          <ThemedText style={styles.errorText}>Commande introuvable</ThemedText>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <ThemedText style={styles.backLinkText}>Retour aux commandes</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusKey = order.status?.toLowerCase() ?? '';
  const date = order.date
    ? new Date(order.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const taxAmount = order.total * 0.2 / 1.2;
  const htAmount = order.total - taxAmount;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Commande #{order.id}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Statut + date */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[statusKey] ?? '#888' }]}>
              <ThemedText style={styles.statusText}>
                {STATUS_LABEL[statusKey] ?? order.status}
              </ThemedText>
            </View>
            <ThemedText style={styles.dateText}>{date}</ThemedText>
          </View>
        </View>

        {/* Articles */}
        {order.items && order.items.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Articles commandés</ThemedText>
            <View style={styles.card}>
              {order.items.map((item, index) => (
                <View key={index}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <ThemedText style={styles.itemName}>{item.productName || item.productId}</ThemedText>
                      <ThemedText style={styles.itemMeta}>
                        Qté : {item.quantity}
                        {item.duration ? ` · ${DURATION_LABEL[item.duration] ?? item.duration}` : ''}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.itemPrice}>
                      {(item.price * item.quantity).toFixed(2)} €
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Récapitulatif financier */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Récapitulatif</ThemedText>
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>Sous-total HT</ThemedText>
              <ThemedText style={styles.totalValue}>{htAmount.toFixed(2)} €</ThemedText>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>TVA (20%)</ThemedText>
              <ThemedText style={styles.totalValue}>{taxAmount.toFixed(2)} €</ThemedText>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabelBold}>Total TTC</ThemedText>
              <ThemedText style={styles.totalValueBold}>{order.total.toFixed(2)} €</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
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

  content: { padding: 16, gap: 16 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },

  statusRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  statusText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  dateText:    { fontSize: 14, color: '#666' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },

  itemRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  itemInfo:  { flex: 1, gap: 2 },
  itemName:  { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  itemMeta:  { fontSize: 12, color: '#888' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },

  totalRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  totalLabel:     { fontSize: 14, color: '#666' },
  totalValue:     { fontSize: 14, color: '#1a1a1a' },
  totalLabelBold: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  totalValueBold: { fontSize: 18, fontWeight: '900', color: '#3b12a3' },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText:      { fontSize: 16, color: '#666' },
  backLink:       { marginTop: 8 },
  backLinkText:   { fontSize: 14, color: '#3b12a3', fontWeight: '600' },
});
