import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { Abonnement, api, normalizeOrder, Order } from '@/services/api';

const STATUS_COLOR: Record<string, string> = {
  actif: '#27ae60', active: '#27ae60',
  confirmed: '#27ae60', paid: '#27ae60',
  pending: '#f39c12',
  inactif: '#888', inactive: '#888',
  cancelled: '#e74c3c',
};

const STATUS_LABEL: Record<string, string> = {
  actif: 'Actif', active: 'Actif',
  confirmed: 'Confirmé', paid: 'Payé',
  pending: 'En attente',
  inactif: 'Inactif', inactive: 'Inactif',
  cancelled: 'Annulé',
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Abonnement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [subs, rawOrders] = await Promise.all([
        api.get<Abonnement[]>('/api/abonnements').catch(() => []),
        api.get<Record<string, unknown>[]>('/api/commandes').catch(() => []),
      ]);
      setSubscriptions(subs || []);
      setOrders((rawOrders || []).map(normalizeOrder).slice(0, 5));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const activeCount = subscriptions.filter(
    s => ['actif', 'active'].includes(s.status?.toLowerCase?.() ?? '')
  ).length;

  const formatDate = (str: string) => {
    if (!str) return '—';
    try { return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return str; }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b12a3" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.greeting}>Bonjour,</ThemedText>
            <ThemedText style={styles.name}>{user?.firstName ?? 'Utilisateur'} {user?.lastName ?? ''}</ThemedText>
          </View>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {(user?.firstName?.[0] ?? 'U').toUpperCase()}
            </ThemedText>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#3b12a3" />
            <ThemedText style={styles.statNum}>{loading ? '—' : activeCount}</ThemedText>
            <ThemedText style={styles.statLabel}>Abonnement{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}</ThemedText>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Ionicons name="receipt-outline" size={24} color="#3b12a3" />
            <ThemedText style={styles.statNum}>{loading ? '—' : orders.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Commande{orders.length !== 1 ? 's' : ''}</ThemedText>
          </View>
        </View>

        {/* Quick actions */}
        <ThemedText style={styles.sectionTitle}>Accès rapide</ThemedText>
        <View style={styles.actionsGrid}>
          {[
            { icon: 'search-outline' as const, label: 'Explorer', color: '#3b12a3', onPress: () => router.push('/(tabs)/explore') },
            { icon: 'cart-outline' as const, label: 'Panier', color: '#5610C0', onPress: () => router.push('/(tabs)/cart') },
            { icon: 'person-outline' as const, label: 'Mon compte', color: '#7602F9', onPress: () => router.push('/(tabs)/account') },
            { icon: 'chatbubble-outline' as const, label: 'Support', color: '#2980b9', onPress: () => router.push('/contact') },
          ].map(({ icon, label, color, onPress }) => (
            <TouchableOpacity key={label} style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: color + '1a' }]}>
                <Ionicons name={icon} size={22} color={color} />
              </View>
              <ThemedText style={styles.actionLabel}>{label}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent orders */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Commandes récentes</ThemedText>
          <TouchableOpacity onPress={() => router.push('/orders')}>
            <ThemedText style={styles.seeAll}>Voir tout</ThemedText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#3b12a3" style={{ marginVertical: 20 }} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={40} color="#ccc" />
            <ThemedText style={styles.emptyText}>Aucune commande pour l'instant</ThemedText>
            <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)/explore')} activeOpacity={0.8}>
              <ThemedText style={styles.exploreBtnText}>Découvrir nos offres</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map(order => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => router.push(`/orders/${order.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={styles.orderLeft}>
                <ThemedText style={styles.orderId}>Commande #{order.id}</ThemedText>
                <ThemedText style={styles.orderDate}>{formatDate(order.date)}</ThemedText>
              </View>
              <View style={styles.orderRight}>
                <ThemedText style={styles.orderTotal}>{order.total?.toFixed(2)} €</ThemedText>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[order.status?.toLowerCase()] ?? '#888') + '22' }]}>
                  <ThemedText style={[styles.badgeText, { color: STATUS_COLOR[order.status?.toLowerCase()] ?? '#888' }]}>
                    {STATUS_LABEL[order.status?.toLowerCase()] ?? order.status}
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Active subscriptions preview */}
        {!loading && activeCount > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Abonnements actifs</ThemedText>
              <TouchableOpacity onPress={() => router.push('/account/subscriptions')}>
                <ThemedText style={styles.seeAll}>Voir tout</ThemedText>
              </TouchableOpacity>
            </View>
            {subscriptions
              .filter(s => ['actif', 'active'].includes(s.status?.toLowerCase?.() ?? ''))
              .slice(0, 3)
              .map(sub => (
                <View key={sub.id} style={styles.subCard}>
                  <View style={styles.subDot} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.subId}>Abonnement #{sub.id}</ThemedText>
                    <ThemedText style={styles.subDate}>Depuis {formatDate(sub.startDate)}</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#27ae6022' }]}>
                    <ThemedText style={[styles.badgeText, { color: '#27ae60' }]}>Actif</ThemedText>
                  </View>
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f5f6fa' },
  scroll:  { flex: 1 },
  content: { paddingBottom: 32 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#3b12a3', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28,
  },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  name:     { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  avatar:   {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, marginTop: -14,
  },
  statCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statNum:   { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 12, color: '#888', textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  seeAll:        { fontSize: 13, color: '#3b12a3', fontWeight: '600' },

  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 16, marginTop: 10,
  },
  actionCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionIcon:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },

  orderCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderLeft:  { gap: 3 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderId:    { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  orderDate:  { fontSize: 12, color: '#888' },
  orderTotal: { fontSize: 15, fontWeight: '800', color: '#3b12a3' },

  badge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyBox:      { alignItems: 'center', paddingVertical: 32, gap: 10, paddingHorizontal: 20 },
  emptyText:     { fontSize: 14, color: '#aaa', textAlign: 'center' },
  exploreBtn:    { marginTop: 6, backgroundColor: '#3b12a3', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  exploreBtnText:{ color: '#fff', fontSize: 14, fontWeight: '700' },

  subCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  subDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#27ae60' },
  subId:   { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  subDate: { fontSize: 12, color: '#888', marginTop: 2 },
});
