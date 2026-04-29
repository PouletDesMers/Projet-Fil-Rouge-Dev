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
import { api, normalizeOrder, Order } from '@/services/api';
import { downloadOrderPdf } from '@/services/pdf';

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

function groupByYear(orders: Order[]): Record<string, Order[]> {
  return orders.reduce((acc, order) => {
    const year = new Date(order.date).getFullYear().toString();
    return { ...acc, [year]: [...(acc[year] || []), order] };
  }, {} as Record<string, Order[]>);
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await api.get<Record<string, unknown>[]>('/api/commandes');
      setOrders((data || []).map(normalizeOrder));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = groupByYear(orders);
  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  const flatData = years.flatMap((year) => [
    { type: 'header' as const, year },
    ...grouped[year].map((order) => ({ type: 'order' as const, order })),
  ]);

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
        <ThemedText style={styles.headerTitle}>Mes commandes</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={flatData}
        keyExtractor={(item, i) =>
          item.type === 'header' ? `year-${item.year}` : `order-${item.order.id}-${i}`
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <ThemedText style={styles.yearHeader}>{item.year}</ThemedText>;
          }
          const { order } = item;
          const date = new Date(order.date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long',
          });
          return (
            <TouchableOpacity style={styles.orderCard} activeOpacity={0.8} onPress={() => router.push(`/orders/${order.id}` as any)}>
              <View style={styles.orderRow}>
                <View style={styles.orderLeft}>
                  <ThemedText style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</ThemedText>
                  <ThemedText style={styles.orderDate}>{date}</ThemedText>
                  <ThemedText style={styles.orderItems}>
                    {order.items?.length ?? 0} article(s)
                  </ThemedText>
                </View>
                <View style={styles.orderRight}>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[order.status] ?? '#888' }]}>
                    <ThemedText style={styles.statusText}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.orderTotal}>{order.total.toFixed(2)} €</ThemedText>
                  <TouchableOpacity
                    style={styles.invoiceBtn}
                    disabled={downloading === order.id}
                    onPress={async () => {
                      setDownloading(order.id);
                      try {
                        const detail = await api.get<Record<string, unknown>>(`/api/commandes/${order.id}`);
                        await downloadOrderPdf(normalizeOrder(detail));
                      } catch {
                        await downloadOrderPdf(order);
                      } finally {
                        setDownloading(null);
                      }
                    }}
                  >
                    {downloading === order.id
                      ? <ActivityIndicator size="small" color="#3b12a3" />
                      : <>
                          <Ionicons name="download-outline" size={16} color="#3b12a3" />
                          <ThemedText style={styles.invoiceBtnText}>Facture</ThemedText>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={56} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Aucune commande</ThemedText>
            <ThemedText style={styles.emptySubtitle}>Vos commandes apparaîtront ici</ThemedText>
            <TouchableOpacity
              style={styles.ctaButton}
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

  yearHeader: {
    fontSize: 13, fontWeight: '800', color: '#888', textTransform: 'uppercase',
    letterSpacing: 1, marginTop: 8, marginBottom: 2,
  },

  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  orderRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  orderLeft:  { flex: 1, gap: 3 },
  orderRight: { alignItems: 'flex-end', gap: 6 },
  orderId:    { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  orderDate:  { fontSize: 13, color: '#666' },
  orderItems: { fontSize: 12, color: '#aaa' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  orderTotal:  { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  invoiceBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invoiceBtnText: { fontSize: 12, color: '#3b12a3' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySubtitle:{ fontSize: 14, color: '#666' },
  ctaButton:    { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
  ctaText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
});
