import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api, Category, normalizeCategory, normalizeProduct, Product } from '@/services/api';

interface SearchParams {
  q?: string;
}

export default function CatalogueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SearchParams>();

  const [search, setSearch] = useState(params.q ?? '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  type SortKey = 'default' | 'price_asc' | 'price_desc' | 'name_asc';
  const [sortKey, setSortKey] = useState<SortKey>('default');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search, selectedCat, minPrice, maxPrice, onlyAvailable, sortKey]);

  const loadCategories = async () => {
    try {
      const data = await api.get<Record<string, unknown>[]>('/api/public/categories');
      setCategories((data || []).map(normalizeCategory));
    } catch {
      // ignore
    } finally {
      setInitialLoading(false);
    }
  };

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      let raw: Record<string, unknown>[] = [];

      if (search.trim()) {
        // Recherche textuelle via endpoint public
        const qp = new URLSearchParams({ q: search.trim() });
        if (minPrice)      qp.append('minPrice', minPrice);
        if (maxPrice)      qp.append('maxPrice', maxPrice);
        raw = await api.get<Record<string, unknown>[]>(`/api/public/search?${qp.toString()}`);
      } else {
        // Pas de terme de recherche : utiliser l'endpoint auth (liste complète)
        const url = selectedCat
          ? `/api/produits?category=${encodeURIComponent(selectedCat)}`
          : '/api/produits';
        raw = await api.get<Record<string, unknown>[]>(url);
      }

      let products = (raw || []).map(normalizeProduct);

      if (onlyAvailable) products = products.filter(p => p.disponible);
      if (minPrice)      products = products.filter(p => p.prix >= Number(minPrice));
      if (maxPrice)      products = products.filter(p => p.prix <= Number(maxPrice));
      if (search.trim() && selectedCat) {
        products = products.filter(p => p.categorie?.slug === selectedCat);
      }

      if (sortKey === 'price_asc')  products = [...products].sort((a, b) => a.prix - b.prix);
      if (sortKey === 'price_desc') products = [...products].sort((a, b) => b.prix - a.prix);
      if (sortKey === 'name_asc')   products = [...products].sort((a, b) => a.nom.localeCompare(b.nom));

      setProducts(products);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCat, minPrice, maxPrice, onlyAvailable, sortKey]);

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
          <ThemedText style={styles.productPrice}>
            {item.prix === 0 ? 'Sur devis' : `${item.prix.toFixed(2)} €/mois`}
          </ThemedText>
          {!item.disponible && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Épuisé</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (initialLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color="#888" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un service..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={showFilters ? '#3b12a3' : '#666'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtres avancés */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.priceInput, { marginRight: 8 }]}
              placeholder="Prix min"
              placeholderTextColor="#aaa"
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.priceInput}
              placeholder="Prix max"
              placeholderTextColor="#aaa"
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity style={styles.availableToggle} onPress={() => setOnlyAvailable(!onlyAvailable)}>
            <View style={[styles.checkbox, onlyAvailable && styles.checkboxChecked]}>
              {onlyAvailable && <ThemedText style={styles.checkmark}>✓</ThemedText>}
            </View>
            <ThemedText style={styles.availableLabel}>Disponibles uniquement</ThemedText>
          </TouchableOpacity>
          <View style={styles.sortRow}>
            {([
              { key: 'default',    label: 'Pertinence' },
              { key: 'price_asc',  label: 'Prix ↑' },
              { key: 'price_desc', label: 'Prix ↓' },
              { key: 'name_asc',   label: 'A→Z' },
            ] as { key: SortKey; label: string }[]).map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortChip, sortKey === s.key && styles.sortChipActive]}
                onPress={() => setSortKey(s.key)}
              >
                <ThemedText style={[styles.sortChipText, sortKey === s.key && styles.sortChipTextActive]}>
                  {s.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Filtres catégories */}
      <View style={styles.catsWrapper}>
        <FlatList
          data={[{ id: '', nom: 'Tous', slug: '' } as Category, ...categories]}
          keyExtractor={(c) => c.id || 'all'}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catChip, selectedCat === (item.slug || null) && styles.catChipActive]}
              onPress={() => setSelectedCat(item.slug || null)}
            >
              <ThemedText style={[styles.catChipText, selectedCat === (item.slug || null) && styles.catChipTextActive]}>
                {item.nom}
              </ThemedText>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Liste produits */}
      {loading ? (
        <View style={styles.listLoader}>
          <ActivityIndicator size="small" color="#3b12a3" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <ThemedText style={styles.emptyText}>Aucun résultat</ThemedText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#f5f5f5' },
  loader:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listLoader: { padding: 20, alignItems: 'center' },

  searchBar: { backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5',
    borderRadius: 10, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#000' },
  filterBtn:   { padding: 4 },

  filtersPanel:    { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 10 },
  priceRow:        { flexDirection: 'row' },
  priceInput:      { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#000' },
  availableToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox:        { width: 20, height: 20, borderWidth: 2, borderColor: '#3b12a3', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#3b12a3' },
  checkmark:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  availableLabel:  { fontSize: 14, color: '#444' },
  sortRow:          { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sortChip:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  sortChipActive:   { backgroundColor: '#3b12a3', borderColor: '#3b12a3' },
  sortChipText:     { fontSize: 12, color: '#555', fontWeight: '500' },
  sortChipTextActive: { color: '#fff', fontWeight: '600' },

  catsWrapper: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  catsList:    { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  catChipActive:   { backgroundColor: '#3b12a3', borderColor: '#3b12a3' },
  catChipText:     { fontSize: 13, color: '#555', fontWeight: '500' },
  catChipTextActive: { color: '#fff' },

  list: { padding: 12, gap: 12 },
  productCard: {
    backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row',
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  productImage:            { width: 120, height: 120 },
  productImagePlaceholder: { width: 120, height: 120, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  productInfo:   { flex: 1, padding: 12, justifyContent: 'space-between', minHeight: 120 },
  productName:   { fontSize: 14, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 },
  productDesc:   { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 17 },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  productPrice:  { fontSize: 14, fontWeight: '700', color: '#3b12a3', flexShrink: 1 },
  badge:         { backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:     { color: '#fff', fontSize: 11, fontWeight: '700' },

  empty:     { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: '#aaa' },
});
