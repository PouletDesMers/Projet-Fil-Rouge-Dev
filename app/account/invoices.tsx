import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/context/language-context';
import { api, normalizeOrder, Order } from '@/services/api';
import { downloadOrderPdf } from '@/services/pdf';

export default function InvoicesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadInvoices = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<Record<string, unknown>[]>('/api/commandes');
      setOrders((data || []).map(normalizeOrder));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadInvoices(); }, []);

  const handleDownload = async (order: Order) => {
    setDownloading(order.id);
    try {
      const detail = await api.get<Record<string, unknown>>(`/api/commandes/${order.id}`);
      await downloadOrderPdf(normalizeOrder(detail));
    } catch {
      await downloadOrderPdf(order);
    } finally {
      setDownloading(null);
    }
  };

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
        <ThemedText style={styles.headerTitle}>{t('invoices.header')}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadInvoices(true)} colors={['#3b12a3']} tintColor="#3b12a3" />
        }
        renderItem={({ item }) => {
          const date = item.date
            ? new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            : '—';
          const isDownloading = downloading === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="document-text-outline" size={22} color="#3b12a3" />
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.cardTitle}>
                    {t('invoices.card_title', { id: item.id.slice(0, 8).toUpperCase() })}
                  </ThemedText>
                  <ThemedText style={styles.cardSub}>{date}</ThemedText>
                  <ThemedText style={styles.cardAmount}>{item.total.toFixed(2)} €</ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.downloadBtn, isDownloading && styles.downloadBtnLoading]}
                  onPress={() => handleDownload(item)}
                  activeOpacity={0.7}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#3b12a3" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#3b12a3" />
                      <ThemedText style={styles.downloadText}>{t('invoices.download')}</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={56} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>{t('invoices.empty_title')}</ThemedText>
            <ThemedText style={styles.emptySub}>{t('invoices.empty_subtitle')}</ThemedText>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadInvoices(true)} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={16} color="#3b12a3" />
              <ThemedText style={styles.retryText}>{t('common.retry')}</ThemedText>
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
  cardAmount:    { fontSize: 16, fontWeight: '800', color: '#3b12a3', marginTop: 2 },

  downloadBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: 8, backgroundColor: '#f0ecff', minWidth: 60, justifyContent: 'center' },
  downloadBtnLoading: { backgroundColor: '#f5f5f5' },
  downloadText:       { fontSize: 12, fontWeight: '600', color: '#3b12a3' },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySub:   { fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0ecff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginTop: 4 },
  retryText:  { fontSize: 14, color: '#3b12a3', fontWeight: '600' },
});
