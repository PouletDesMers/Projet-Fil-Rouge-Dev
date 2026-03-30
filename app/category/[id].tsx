import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api, Category, Product } from '@/services/api';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadCategory();
  }, [id]);

  const loadCategory = async () => {
    try {
      // Chargement catégories pour avoir le nom
      const cats = await api.get<Category[]>('/api/public/categories');
      const cat = (cats || []).find((c) => c.id === id);
      setCategory(cat ?? null);

      if (cat?.slug) {
        const data = await api.get<Product[]>(`/api/public/products/${cat.slug}`);
        // Tri par priorité décroissante
        const sorted = (data || []).sort((a, b) => (b.priorite ?? 0) - (a.priorite ?? 0));
        setProducts(sorted);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.8}
      onPress={() => router.push(`/product/${item.id}` as never)}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Ionicons name="cube-outline" size={36} color="#3b12a3" />
        </View>
      )}
      <View style={styles.productInfo}>
        <ThemedText style={styles.productName} numberOfLines={2}>{item.nom}</ThemedText>
        {item.description && (
          <ThemedText style={styles.productDesc} numberOfLines={2}>{item.description}</ThemedText>
        )}
        <View style={styles.productFooter}>
          <ThemedText style={styles.productPrice}>{item.prix.toFixed(2)} €/mois</ThemedText>
          {!item.disponible && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Épuisé</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          {category?.nom ?? 'Catégorie'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#ccc" />
            <ThemedText style={styles.emptyText}>Aucun produit dans cette catégorie</ThemedText>
          </View>
        }
        ListHeaderComponent={
          category?.description ? (
            <View style={styles.catDesc}>
              <ThemedText style={styles.catDescText}>{category.description}</ThemedText>
            </View>
          ) : null
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
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  catDesc:     { backgroundColor: '#fff', padding: 16, marginBottom: 12 },
  catDescText: { fontSize: 14, color: '#555', lineHeight: 20 },

  list: { padding: 12, gap: 12 },
  productCard: {
    backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row',
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  productImage:            { width: 110, height: 110 },
  productImagePlaceholder: { width: 110, height: 110, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  productInfo:   { flex: 1, padding: 12, justifyContent: 'space-between' },
  productName:   { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  productDesc:   { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  productPrice:  { fontSize: 16, fontWeight: '700', color: '#3b12a3' },
  badge:         { backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:     { color: '#fff', fontSize: 11, fontWeight: '700' },

  empty:     { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: '#aaa', textAlign: 'center' },
});
