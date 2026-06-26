import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/context/language-context';

export default function CguScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const sections = [
    { title: t('cgu.s1_title'), content: t('cgu.s1_content') },
    { title: t('cgu.s2_title'), content: t('cgu.s2_content') },
    { title: t('cgu.s3_title'), content: t('cgu.s3_content') },
    { title: t('cgu.s4_title'), content: t('cgu.s4_content') },
    { title: t('cgu.s5_title'), content: t('cgu.s5_content') },
    { title: t('cgu.s6_title'), content: t('cgu.s6_content') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('cgu.header')}</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.lastUpdate}>{t('cgu.last_update')}</ThemedText>
        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{s.title}</ThemedText>
            <ThemedText style={styles.sectionText}>{s.content}</ThemedText>
          </View>
        ))}
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
  lastUpdate:  { fontSize: 12, color: '#aaa', marginBottom: 20 },
  section:     { marginBottom: 22 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  sectionText: { fontSize: 14, color: '#555', lineHeight: 22 },
});
