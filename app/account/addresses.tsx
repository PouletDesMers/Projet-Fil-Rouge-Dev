import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export default function AddressesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Carnet d'adresses</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="location-outline" size={56} color="#ccc" />
        <ThemedText style={styles.title}>Aucune adresse enregistrée</ThemedText>
        <ThemedText style={styles.subtitle}>
          Vos adresses de facturation seront sauvegardées ici lors de vos commandes.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  content:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title:    { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
});
