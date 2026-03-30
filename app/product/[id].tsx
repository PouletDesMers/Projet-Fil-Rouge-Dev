import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api, Product } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Duration = '1_month' | '1_year' | '2_years';

const DURATION_LABELS: Record<Duration, string> = {
  '1_month': '1 mois',
  '1_year':  '1 an (-10%)',
  '2_years': '2 ans (-20%)',
};

const DURATION_FACTOR: Record<Duration, number> = {
  '1_month': 1,
  '1_year':  0.9,
  '2_years': 0.8,
};

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<Duration>('1_month');
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      // On passe par la route publique search avec l'id
      const data = await api.get<Product>(`/api/produits/${id}`);
      setProduct(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger ce produit');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#3b12a3" />
        </TouchableOpacity>
        <View style={styles.errorState}>
          <ThemedText style={styles.errorText}>Produit introuvable</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const finalPrice = product.prix * DURATION_FACTOR[selectedDuration];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.cartBtn}>
          <Ionicons name="cart-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Carrousel images */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setImgIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
              }
            >
              {images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.productImage} resizeMode="cover" />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="shield-checkmark-outline" size={72} color="#3b12a3" />
          </View>
        )}

        <View style={styles.content}>
          {/* Titre + badge dispo */}
          <View style={styles.titleRow}>
            <ThemedText style={styles.productName}>{product.nom}</ThemedText>
            {!product.disponible && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>Indisponible</ThemedText>
              </View>
            )}
          </View>

          {/* Catégorie */}
          {product.categorie && (
            <TouchableOpacity
              style={styles.catChip}
              onPress={() => router.push(`/category/${product.categorie!.id}` as never)}
            >
              <ThemedText style={styles.catChipText}>{product.categorie.nom}</ThemedText>
            </TouchableOpacity>
          )}

          {/* Description */}
          {product.description && (
            <ThemedText style={styles.description}>{product.description}</ThemedText>
          )}

          {/* Durée abonnement */}
          <View style={styles.durationSection}>
            <ThemedText style={styles.durationTitle}>Durée de l'abonnement</ThemedText>
            <View style={styles.durationRow}>
              {(Object.keys(DURATION_LABELS) as Duration[]).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationChip, selectedDuration === d && styles.durationChipActive]}
                  onPress={() => setSelectedDuration(d)}
                >
                  <ThemedText style={[styles.durationText, selectedDuration === d && styles.durationTextActive]}>
                    {DURATION_LABELS[d]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Prix */}
          <View style={styles.priceBox}>
            <ThemedText style={styles.priceLabel}>Prix</ThemedText>
            <ThemedText style={styles.price}>{finalPrice.toFixed(2)} €/mois</ThemedText>
            {selectedDuration !== '1_month' && (
              <ThemedText style={styles.originalPrice}>{product.prix.toFixed(2)} €/mois</ThemedText>
            )}
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.ctaButton, !product.disponible && styles.ctaDisabled]}
          disabled={!product.disponible}
          activeOpacity={0.8}
          onPress={() => {
            // TODO Sprint 4 : addToCart + navigation panier
            router.push('/(tabs)/cart');
          }}
        >
          <Ionicons name="cart" size={20} color="#fff" />
          <ThemedText style={styles.ctaText}>
            {product.disponible ? "S'abonner" : 'Indisponible'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar:   { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 },
  backBtn:  { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: 8 },
  cartBtn:  { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: 8 },

  productImage:     { width: SCREEN_WIDTH, height: 280 },
  imagePlaceholder: { height: 240, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ccc' },
  dotActive: { backgroundColor: '#3b12a3', width: 20 },

  content:    { padding: 20 },
  titleRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  productName:{ flex: 1, fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  badge:      { backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { color: '#fff', fontSize: 11, fontWeight: '700' },

  catChip:     { alignSelf: 'flex-start', backgroundColor: '#f0ecff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 14 },
  catChipText: { fontSize: 13, color: '#3b12a3', fontWeight: '600' },

  description: { fontSize: 15, color: '#444', lineHeight: 24, marginBottom: 20 },

  durationSection: { marginBottom: 20 },
  durationTitle:   { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  durationRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durationChip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  durationChipActive:   { backgroundColor: '#3b12a3', borderColor: '#3b12a3' },
  durationText:         { fontSize: 13, color: '#555' },
  durationTextActive:   { color: '#fff', fontWeight: '600' },

  priceBox:      { backgroundColor: '#f8f5ff', borderRadius: 12, padding: 16, marginBottom: 16 },
  priceLabel:    { fontSize: 13, color: '#888', marginBottom: 4 },
  price:         { fontSize: 28, fontWeight: '900', color: '#3b12a3' },
  originalPrice: { fontSize: 14, color: '#aaa', textDecorationLine: 'line-through', marginTop: 2 },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:  { fontSize: 16, color: '#888' },

  ctaContainer: { padding: 16, paddingBottom: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  ctaButton:    { backgroundColor: '#3b12a3', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaDisabled:  { backgroundColor: '#ccc' },
  ctaText:      { color: '#fff', fontSize: 17, fontWeight: '700' },
});
