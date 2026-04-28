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
import { Duration, DURATION_DISCOUNT, DURATION_LABELS, useCart } from '@/context/cart-context';
import { api, normalizeProduct, Product } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addItem, count } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<Duration>('1_month');
  const [imgIndex, setImgIndex] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      // Pas de GET /api/produits/{id} → on charge la liste complète et on filtre
      const all = await api.get<Record<string, unknown>[]>('/api/produits');
      const found = (all || []).find(p => String(p.id_produit) === id);
      if (!found) throw new Error('not_found');
      const normalized = normalizeProduct(found);
      setProduct(normalized);
      if (normalized.categorie?.slug) {
        loadSimilar(normalized.categorie.slug, normalized.id);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger ce produit');
    } finally {
      setLoading(false);
    }
  };

  const loadSimilar = async (categorySlug: string, currentId: string) => {
    try {
      const data = await api.get<Record<string, unknown>[]>(`/api/public/products/${categorySlug}`);
      const similar = (data || [])
        .map(normalizeProduct)
        .filter(p => p.id !== currentId)
        .slice(0, 6);
      setSimilarProducts(similar);
    } catch {
      // similaires non bloquants
    }
  };

  const handleAddToCart = () => {
    if (!product || !product.disponible) return;
    addItem({
      productId: product.id,
      name: product.nom,
      price: product.prix,
      duration: selectedDuration,
      available: product.disponible,
      image: product.image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
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
  const finalPrice = product.prix * DURATION_DISCOUNT[selectedDuration];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.cartBtn}>
          <Ionicons name="cart-outline" size={24} color="#fff" />
          {count > 0 && (
            <View style={styles.cartBadge}>
              <ThemedText style={styles.cartBadgeText}>{count > 99 ? '99+' : String(count)}</ThemedText>
            </View>
          )}
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
          {product.prix > 0 && (
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
          )}

          {/* Prix */}
          <View style={styles.priceBox}>
            <ThemedText style={styles.priceLabel}>Prix</ThemedText>
            {product.prix === 0 ? (
              <ThemedText style={styles.price}>Sur devis</ThemedText>
            ) : (
              <>
                <ThemedText style={styles.price}>{finalPrice.toFixed(2)} €/mois</ThemedText>
                {selectedDuration !== '1_month' && (
                  <ThemedText style={styles.originalPrice}>{product.prix.toFixed(2)} €/mois</ThemedText>
                )}
              </>
            )}
          </View>

          {/* Services similaires */}
          {similarProducts.length > 0 && (
            <View style={styles.similarSection}>
              <ThemedText style={styles.similarTitle}>Services similaires</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similarProducts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.similarCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/product/${p.id}` as never)}
                  >
                    {p.image ? (
                      <Image source={{ uri: p.image }} style={styles.similarImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.similarImagePlaceholder}>
                        <Ionicons name="cube-outline" size={28} color="#3b12a3" />
                      </View>
                    )}
                    <View style={styles.similarInfo}>
                      <ThemedText style={styles.similarName} numberOfLines={2}>{p.nom}</ThemedText>
                      <ThemedText style={styles.similarPrice}>
                        {p.prix === 0 ? 'Sur devis' : `${p.prix.toFixed(2)} €/mois`}
                      </ThemedText>
                      {!p.disponible && (
                        <View style={styles.similarBadge}>
                          <ThemedText style={styles.similarBadgeText}>Indisponible</ThemedText>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        {product.prix === 0 ? (
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.8}
            onPress={() => router.push('/contact' as never)}
          >
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <ThemedText style={styles.ctaText}>Demander un devis</ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, (!product.disponible || added) && styles.ctaDisabled]}
            disabled={!product.disponible}
            activeOpacity={0.8}
            onPress={handleAddToCart}
          >
            <Ionicons name={added ? 'checkmark-circle' : 'cart'} size={20} color="#fff" />
            <ThemedText style={styles.ctaText}>
              {!product.disponible ? 'Indisponible' : added ? 'Ajouté au panier !' : "S'abonner"}
            </ThemedText>
          </TouchableOpacity>
        )}
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
  cartBadge: {
    position: 'absolute', top: -2, right: -2, backgroundColor: '#e53935',
    borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 12 },

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

  priceBox:      { backgroundColor: '#f8f5ff', borderRadius: 12, padding: 16, marginBottom: 24 },
  priceLabel:    { fontSize: 13, color: '#888', marginBottom: 4 },
  price:         { fontSize: 28, fontWeight: '900', color: '#3b12a3' },
  originalPrice: { fontSize: 14, color: '#aaa', textDecorationLine: 'line-through', marginTop: 2 },

  similarSection: { marginBottom: 16 },
  similarTitle:   { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  similarCard: {
    width: 160, marginRight: 12, backgroundColor: '#fff', borderRadius: 12,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  similarImage:            { width: '100%', height: 100 },
  similarImagePlaceholder: { width: '100%', height: 100, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  similarInfo:      { padding: 10 },
  similarName:      { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 4, lineHeight: 18 },
  similarPrice:     { fontSize: 13, fontWeight: '700', color: '#3b12a3' },
  similarBadge:     { marginTop: 4, backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start' },
  similarBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:  { fontSize: 16, color: '#888' },

  ctaContainer: { padding: 16, paddingBottom: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  ctaButton:    { backgroundColor: '#3b12a3', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaDisabled:  { backgroundColor: '#aaa' },
  ctaText:      { color: '#fff', fontSize: 17, fontWeight: '700' },
});
