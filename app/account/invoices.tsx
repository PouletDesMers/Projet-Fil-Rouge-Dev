import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api, Invoice, normalizeInvoice } from '@/services/api';

export default function InvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, unknown>[]>('/api/factures')
      .then(data => setInvoices((data || []).map(normalizeInvoice)))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (invoice: Invoice) => {
    if (!invoice.pdfUrl) {
      Alert.alert('Facture indisponible', 'Le PDF de cette facture n\'est pas encore disponible.');
      return;
    }
    try {
      await Linking.openURL(invoice.pdfUrl);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le PDF.');
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
        <ThemedText style={styles.headerTitle}>Mes factures</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={invoices}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const date = item.date
            ? new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            : '—';
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="document-text-outline" size={22} color="#3b12a3" />
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.cardTitle}>Facture #{item.id}</ThemedText>
                  <ThemedText style={styles.cardSub}>{date}</ThemedText>
                  <ThemedText style={styles.cardAmount}>{item.total.toFixed(2)} €</ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.downloadBtn, !item.pdfUrl && styles.downloadBtnDisabled]}
                  onPress={() => handleDownload(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="download-outline" size={18} color={item.pdfUrl ? '#3b12a3' : '#bbb'} />
                  <ThemedText style={[styles.downloadText, !item.pdfUrl && styles.downloadTextDisabled]}>PDF</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={56} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Aucune facture</ThemedText>
            <ThemedText style={styles.emptySub}>Vos factures apparaîtront ici après vos commandes</ThemedText>
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

  downloadBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: 8, backgroundColor: '#f0ecff' },
  downloadBtnDisabled: { backgroundColor: '#f5f5f5' },
  downloadText:        { fontSize: 12, fontWeight: '600', color: '#3b12a3' },
  downloadTextDisabled:{ color: '#bbb' },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySub:   { fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 32 },
});
