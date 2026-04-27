import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api, CarouselImage, Category, normalizeCarouselImage, normalizeCategory, normalizeProduct, Product } from '@/services/api';

const { width: W } = Dimensions.get('window');
const CARD_W = Math.floor((W - 48) / 2); // 2 colonnes avec gap

export default function HomeScreen() {
  const router = useRouter();
  const [carousel, setCarousel] = useState<CarouselImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [carouselRaw, categoriesRaw, produitsRaw] = await Promise.all([
        api.get<Record<string, unknown>[]>('/api/public/carousel-images'),
        api.get<Record<string, unknown>[]>('/api/public/categories'),
        api.get<Record<string, unknown>[]>('/api/public/top-products'),
      ]);
      setCarousel((carouselRaw || []).map(normalizeCarouselImage));
      setCategories((categoriesRaw || []).map(normalizeCategory));
      const sorted = (produitsRaw || [])
        .map(normalizeProduct)
        .sort((a, b) => (b.priorite ?? 0) - (a.priorite ?? 0))
        .slice(0, 8);
      setTopProducts(sorted);
    } catch {
      // continue avec données vides
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (search.trim()) router.push(`/explore?q=${encodeURIComponent(search.trim())}`);
  };

  const formatPrice = (prix: number) =>
    prix === 0 ? 'Sur devis' : `${prix.toFixed(2)} €/mois`;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Barre de recherche */}
        <View style={styles.searchBar}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color="#aaa" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un service..."
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={16} color="#bbb" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Ionicons name="search" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Carrousel */}
        {carousel.length > 0 && (
          <View style={styles.carouselSection}>
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / W))
              }
            >
              {carousel.map((item) => (
                <TouchableOpacity
                  key={item.id} style={styles.carouselSlide} activeOpacity={0.95}
                  onPress={() => item.link && router.push(item.link as never)}
                >
                  {item.url ? (
                    <Image source={{ uri: item.url }} style={styles.carouselImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.carouselImage, styles.carouselPlaceholder]}>
                      <Ionicons name="shield-checkmark-outline" size={48} color="rgba(255,255,255,0.6)" />
                    </View>
                  )}
                  {(item.title || item.subtitle) && (
                    <View style={styles.carouselOverlay}>
                      {item.title && (
                        <ThemedText style={styles.carouselTitle} numberOfLines={2}>{item.title}</ThemedText>
                      )}
                      {item.subtitle && (
                        <ThemedText style={styles.carouselSubtitle} numberOfLines={2}>{item.subtitle}</ThemedText>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {carousel.length > 1 && (
              <View style={styles.dots}>
                {carousel.map((_, i) => (
                  <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Catégories */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Nos catégories</ThemedText>
              <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                <ThemedText style={styles.seeAll}>Voir tout</ThemedText>
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.categoryRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/category/${item.id}` as never)}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.categoryImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.categoryImagePlaceholder}>
                      <Ionicons name="grid-outline" size={32} color="#3b12a3" />
                    </View>
                  )}
                  <View style={styles.categoryFooter}>
                    <ThemedText style={styles.categoryName} numberOfLines={2}>{item.nom}</ThemedText>
                    <Ionicons name="chevron-forward" size={14} color="#3b12a3" />
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Top produits */}
        {topProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Nos services phares</ThemedText>
              <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                <ThemedText style={styles.seeAll}>Voir tout</ThemedText>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productList}>
              {topProducts.map((p) => (
                <TouchableOpacity
                  key={p.id} style={styles.productCard} activeOpacity={0.8}
                  onPress={() => router.push(`/product/${p.id}` as never)}
                >
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="shield-checkmark-outline" size={36} color="#3b12a3" />
                    </View>
                  )}
                  <View style={styles.productBody}>
                    <ThemedText style={styles.productName} numberOfLines={2}>{p.nom}</ThemedText>
                    <ThemedText style={styles.productPrice} numberOfLines={1}>{formatPrice(p.prix)}</ThemedText>
                    {!p.disponible && (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>Épuisé</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {carousel.length === 0 && categories.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={72} color="#3b12a3" />
            <ThemedText style={styles.emptyTitle}>Bienvenue sur CYNA</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Découvrez nos solutions de cybersécurité managées
            </ThemedText>
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/explore')} activeOpacity={0.8}>
              <ThemedText style={styles.ctaText}>Voir le catalogue</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f0f2f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchBar: {
    backgroundColor: '#3b12a3',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 24, height: 44, overflow: 'hidden',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#000', paddingHorizontal: 8 },
  clearBtn:   { padding: 8 },
  searchBtn: {
    backgroundColor: '#3b12a3', height: '100%', width: 48,
    alignItems: 'center', justifyContent: 'center',
  },

  carouselSection: { backgroundColor: '#fff' },
  carouselSlide:   { width: W, height: 210 },
  carouselImage:   { width: '100%', height: '100%' },
  carouselPlaceholder: { backgroundColor: '#3b12a3', alignItems: 'center', justifyContent: 'center' },
  carouselOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 16,
  },
  carouselTitle:    { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 23 },
  carouselSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3, lineHeight: 18 },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: '#fff',
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ddd' },
  dotActive: { width: 20, backgroundColor: '#3b12a3' },

  section:      { paddingHorizontal: 16, paddingTop: 22 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  seeAll:       { fontSize: 13, color: '#3b12a3', fontWeight: '600' },

  categoryRow:  { justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  categoryCard: {
    width: CARD_W, backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  categoryImage:            { width: '100%', height: 100 },
  categoryImagePlaceholder: { width: '100%', height: 100, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  categoryFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  categoryName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 },

  productList: { paddingRight: 16, gap: 12 },
  productCard: {
    width: Math.floor(W * 0.44), backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  productImage:            { width: '100%', height: 120 },
  productImagePlaceholder: { width: '100%', height: 120, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  productBody:  { padding: 10 },
  productName:  { fontSize: 13, fontWeight: '700', color: '#1a1a1a', lineHeight: 19, marginBottom: 4 },
  productPrice: { fontSize: 13, fontWeight: '700', color: '#3b12a3' },
  badge:        { marginTop: 4, backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText:    { color: '#fff', fontSize: 10, fontWeight: '700' },

  emptyState:    { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle:    { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginTop: 20, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 22 },
  ctaButton:     { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24 },
  ctaText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
});
