import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/context/language-context';

export default function LegalScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('legal.header')}</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('legal.editor_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.editor_name')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.editor_capital')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.editor_rcs')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.editor_address')}</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('legal.publisher_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.publisher_name')}</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('legal.hosting_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.hosting_name')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.hosting_address')}</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('legal.data_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.data_text')}</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('legal.cookies_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.cookies_text')}</ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('legal.ip_title')}</ThemedText>
          <ThemedText style={styles.text}>{t('legal.ip_text')}</ThemedText>
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
