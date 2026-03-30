import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CartItem, DURATION_DISCOUNT, DURATION_LABELS, useCart } from '@/context/cart-context';

export default function CartScreen() {
  const router = useRouter();
  const { items, total, removeItem, updateQty, updateDuration } = useCart();

  const unavailableItems = items.filter((i) => !i.available);

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, !item.available && styles.cartItemUnavailable]}>
      <View style={styles.itemHeader}>
        <ThemedText style={styles.itemName} numberOfLines={2}>{item.name}</ThemedText>
        {!item.available && (
          <View style={styles.unavailableBadge}>
            <ThemedText style={styles.unavailableBadgeText}>Indisponible</ThemedText>
          </View>
        )}
      </View>

      {/* Durée */}
      <View style={styles.durationRow}>
        {(Object.keys(DURATION_LABELS) as CartItem['duration'][]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.durationChip, item.duration === d && styles.durationChipActive]}
            onPress={() => updateDuration(item.id, d)}
          >
            <ThemedText style={[styles.durationText, item.duration === d && styles.durationTextActive]}>
              {DURATION_LABELS[d]}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.itemFooter}>
        {/* Quantité */}
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
            <ThemedText style={styles.qtyBtnText}>−</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.qtyText}>{item.quantity}</ThemedText>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
            <ThemedText style={styles.qtyBtnText}>+</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.itemPrice}>
          {(item.price * item.quantity * DURATION_DISCOUNT[item.duration]).toFixed(2)} €
        </ThemedText>

        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={64} color="#ccc" />
          <ThemedText style={styles.emptyTitle}>Votre panier est vide</ThemedText>
          <ThemedText style={styles.emptySubtitle}>Découvrez nos services de cybersécurité</ThemedText>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/explore')}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.ctaText}>Voir le catalogue</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <View style={styles.summary}>
            {unavailableItems.length > 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={16} color="#e67e22" />
                <ThemedText style={styles.warningText}>
                  {unavailableItems.length} article(s) indisponible(s) exclu(s) du total
                </ThemedText>
              </View>
            )}
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>Total</ThemedText>
              <ThemedText style={styles.totalAmount}>{total.toFixed(2)} €</ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, unavailableItems.length === items.length && styles.checkoutBtnDisabled]}
              onPress={() => router.push('/checkout')}
              activeOpacity={0.8}
              disabled={unavailableItems.length === items.length}
            >
              <ThemedText style={styles.checkoutBtnText}>Procéder au paiement</ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16, gap: 12 },

  cartItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  cartItemUnavailable: { opacity: 0.6 },
  itemHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  itemName:            { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginRight: 8 },
  unavailableBadge:    { backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  unavailableBadgeText:{ color: '#fff', fontSize: 10, fontWeight: '700' },

  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  durationChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0',
  },
  durationChipActive: { backgroundColor: '#3b12a3', borderColor: '#3b12a3' },
  durationText:       { fontSize: 12, color: '#555' },
  durationTextActive: { color: '#fff', fontWeight: '600' },

  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: '#3b12a3', fontWeight: '700', lineHeight: 22 },
  qtyText:    { fontSize: 16, fontWeight: '700', color: '#1a1a1a', minWidth: 20, textAlign: 'center' },
  itemPrice:  { fontSize: 17, fontWeight: '700', color: '#3b12a3' },
  removeBtn:  { padding: 4 },

  summary:     { marginTop: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  warningBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef9f0', borderRadius: 8, padding: 10 },
  warningText: { fontSize: 13, color: '#e67e22', flex: 1 },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:  { fontSize: 16, color: '#666' },
  totalAmount: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
  checkoutBtn: {
    backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  checkoutBtnDisabled: { opacity: 0.4 },
  checkoutBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 12 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  emptySubtitle:{ fontSize: 14, color: '#666', textAlign: 'center' },
  ctaButton:    { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  ctaText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
});
