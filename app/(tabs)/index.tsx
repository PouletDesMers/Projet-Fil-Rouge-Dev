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
import { api, CarouselImage, Category, Product } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [carousel, setCarousel] = useState<CarouselImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [carouselData, categoriesData] = await Promise.all([
        api.get<CarouselImage[]>('/api/public/carousel-images'),
        api.get<Category[]>('/api/public/categories'),
      ]);
      setCarousel(carouselData || []);
      setCategories(categoriesData || []);
    } catch {
      // En cas d'erreur réseau, on continue avec les données vides
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (search.trim()) {
      router.push(`/explore?q=${encodeURIComponent(search.trim())}`);
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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Barre de recherche */}
        <View style={styles.searchBar}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un service..."
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Carrousel */}
        {carousel.length > 0 && (
          <View style={styles.carouselSection}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCarouselIndex(idx);
              }}
            >
              {carousel.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.carouselSlide}
                  activeOpacity={0.9}
                  onPress={() => item.link && router.push(item.link as never)}
                >
                  {item.url ? (
                    <Image source={{ uri: item.url }} style={styles.carouselImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.carouselPlaceholder} />
                  )}
                  {(item.title || item.subtitle) && (
                    <View style={styles.carouselOverlay}>
                      {item.title && <ThemedText style={styles.carouselTitle}>{item.title}</ThemedText>}
                      {item.subtitle && <ThemedText style={styles.carouselSubtitle}>{item.subtitle}</ThemedText>}
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
            <ThemedText style={styles.sectionTitle}>Nos catégories</ThemedText>
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
                  <ThemedText style={styles.categoryName} numberOfLines={2}>{item.nom}</ThemedText>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Top produits */}
        {topProducts.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Top produits du moment</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {topProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.productCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/product/${p.id}` as never)}
                >
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="cube-outline" size={36} color="#3b12a3" />
                    </View>
                  )}
                  <ThemedText style={styles.productName} numberOfLines={2}>{p.nom}</ThemedText>
                  <ThemedText style={styles.productPrice}>{p.prix.toFixed(2)} €/mois</ThemedText>
                  {!p.disponible && (
                    <View style={styles.badge}>
                      <ThemedText style={styles.badgeText}>Indisponible</ThemedText>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Placeholder si pas de données */}
        {carousel.length === 0 && categories.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={64} color="#3b12a3" />
            <ThemedText style={styles.emptyTitle}>Bienvenue sur CYNA</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Découvrez nos solutions de cybersécurité
            </ThemedText>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/(tabs)/explore')}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.ctaText}>Voir le catalogue</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchBar: { backgroundColor: '#3b12a3', paddingHorizontal: 16, paddingVertical: 12 },
  searchRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', paddingLeft: 14, height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: '#000' },
  searchBtn: {
    backgroundColor: '#2910e8', height: '100%', paddingHorizontal: 14,
    borderTopRightRadius: 20, borderBottomRightRadius: 20, justifyContent: 'center',
  },

  carouselSection: { backgroundColor: '#fff' },
  carouselSlide:   { width: SCREEN_WIDTH, height: 200 },
  carouselImage:   { width: '100%', height: '100%' },
  carouselPlaceholder: { width: '100%', height: '100%', backgroundColor: '#3b12a3' },
  carouselOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', padding: 14,
  },
  carouselTitle:    { color: '#fff', fontSize: 18, fontWeight: '700' },
  carouselSubtitle: { color: '#ddd', fontSize: 13, marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: '#fff' },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ccc' },
  dotActive: { backgroundColor: '#3b12a3', width: 20 },

  section:      { paddingHorizontal: 16, paddingVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 14 },

  categoryRow: { justifyContent: 'space-between', marginBottom: 12 },
  categoryCard: {
    width: '48%', backgroundColor: '#fff', borderRadius: 12,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  categoryImage:            { width: '100%', height: 90 },
  categoryImagePlaceholder: { width: '100%', height: 90, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  categoryName:             { padding: 10, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },

  productCard: {
    width: 160, marginRight: 12, backgroundColor: '#fff', borderRadius: 12,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  productImage:            { width: '100%', height: 110 },
  productImagePlaceholder: { width: '100%', height: 110, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  productName:  { padding: 8, paddingBottom: 4, fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  productPrice: { paddingHorizontal: 8, paddingBottom: 8, fontSize: 14, fontWeight: '700', color: '#3b12a3' },
  badge:        { position: 'absolute', top: 8, right: 8, backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:    { color: '#fff', fontSize: 10, fontWeight: '700' },

  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle:    { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginTop: 20, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 22 },
  ctaButton:     { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24 },
  ctaText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
});
