import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export default function LegalScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Mentions légales</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Éditeur</ThemedText>
          <ThemedText style={styles.text}>Cyna SAS</ThemedText>
          <ThemedText style={styles.text}>Capital social : 10 000 €</ThemedText>
          <ThemedText style={styles.text}>RCS Paris B XXX XXX XXX</ThemedText>
          <ThemedText style={styles.text}>Siège social : Paris, France</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Directeur de publication</ThemedText>
          <ThemedText style={styles.text}>Direction Cyna SAS</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hébergement</ThemedText>
          <ThemedText style={styles.text}>OVH SAS</ThemedText>
          <ThemedText style={styles.text}>2 rue Kellermann – 59100 Roubaix, France</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Données personnelles</ThemedText>
          <ThemedText style={styles.text}>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression
            de vos données. Pour exercer ces droits, contactez-nous à : dpo@cyna-it.fr
          </ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Cookies</ThemedText>
          <ThemedText style={styles.text}>
            L'application utilise des cookies techniques nécessaires à son fonctionnement.
            Aucune donnée n'est transmise à des tiers à des fins commerciales.
          </ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Propriété intellectuelle</ThemedText>
          <ThemedText style={styles.text}>
            Tout le contenu de l'application est protégé par les droits de propriété intellectuelle.
            Toute reproduction sans autorisation est interdite.
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  content:     { padding: 20, paddingBottom: 40 },
  section:     { marginBottom: 24 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  text:        { fontSize: 14, color: '#555', lineHeight: 22 },
});
