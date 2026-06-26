import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/context/language-context';

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const services = [
    { icon: 'shield-checkmark-outline', label: t('about.service_soc') },
    { icon: 'scan-outline',             label: t('about.service_edr') },
    { icon: 'server-outline',           label: t('about.service_siem') },
    { icon: 'bug-outline',              label: t('about.service_pentest') },
    { icon: 'people-outline',           label: t('about.service_training') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('about.header')}</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoBox}>
          <ThemedText style={styles.logo}>CYNA</ThemedText>
          <ThemedText style={styles.tagline}>{t('about.tagline')}</ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>{t('about.mission_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('about.mission_text')}</ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>{t('about.services_title')}</ThemedText>
          {services.map(({ icon, label }) => (
            <View key={label} style={styles.serviceItem}>
              <Ionicons name={icon as never} size={20} color="#3b12a3" />
              <ThemedText style={styles.serviceLabel}>{label}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>{t('about.contact_title')}</ThemedText>
          <ThemedText style={styles.text}>support@cyna-it.fr</ThemedText>
          <ThemedText style={styles.text}>www.cyna-it.fr</ThemedText>
        </View>

        <ThemedText style={styles.version}>{t('about.version')}</ThemedText>
      </ScrollView>
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

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  logoBox:  { alignItems: 'center', paddingVertical: 24 },
  logo:     { fontSize: 42, fontWeight: '900', color: '#3b12a3', letterSpacing: 6 },
  tagline:  { fontSize: 14, color: '#666', marginTop: 6 },

  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  text:         { fontSize: 14, color: '#555', lineHeight: 22 },

  serviceItem:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceLabel: { fontSize: 14, color: '#333' },

  version: { textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 8 },
});
