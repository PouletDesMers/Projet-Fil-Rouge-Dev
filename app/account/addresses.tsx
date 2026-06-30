import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/context/language-context';
import { api } from '@/services/api';

interface Address {
  id: string;
  fullName: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

function normalizeAddress(raw: Record<string, unknown>): Address {
  return {
    id:       String(raw.id ?? raw.id_adresse ?? ''),
    fullName: (raw.fullName ?? raw.nom_complet ?? raw.full_name ?? '') as string,
    street:   (raw.street ?? raw.rue ?? raw.adresse ?? '') as string,
    city:     (raw.city ?? raw.ville ?? '') as string,
    zip:      (raw.zip ?? raw.code_postal ?? '') as string,
    country:  (raw.country ?? raw.pays ?? 'France') as string,
  };
}

export default function AddressesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, unknown>[]>('/api/user/addresses')
      .then((raw) => setAddresses((raw || []).map(normalizeAddress)))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }: { item: Address }) => (
    <View style={styles.card}>
      <Ionicons name="location" size={20} color="#3b12a3" style={styles.cardIcon} />
      <View style={styles.cardBody}>
        <ThemedText style={styles.cardName}>{item.fullName}</ThemedText>
        <ThemedText style={styles.cardLine}>{item.street}</ThemedText>
        <ThemedText style={styles.cardLine}>{item.zip} {item.city}</ThemedText>
        <ThemedText style={styles.cardLine}>{item.country}</ThemedText>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('addresses.header')}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b12a3" />
        </View>
      ) : addresses.length > 0 ? (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={56} color="#ccc" />
          <ThemedText style={styles.title}>{t('addresses.empty_title')}</ThemedText>
          <ThemedText style={styles.subtitle}>{t('addresses.empty_subtitle')}</ThemedText>
          <TouchableOpacity
            style={styles.webBtn}
            onPress={() => Linking.openURL('https://cyna.atkk.fr')}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={16} color="#fff" />
            <ThemedText style={styles.webBtnText}>{t('addresses.web_link')}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },

  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  cardIcon: { marginTop: 2 },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardLine: { fontSize: 13, color: '#555' },

  title:    { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },

  webBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#3b12a3', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 20, marginTop: 8,
  },
  webBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
