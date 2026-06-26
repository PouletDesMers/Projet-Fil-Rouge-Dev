import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { LANGUAGES, SupportedLocale, useTranslation } from '@/context/language-context';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSelector({ visible, onClose }: Props) {
  const { locale, setLocale, t } = useTranslation();

  const select = async (code: SupportedLocale) => {
    await setLocale(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <ThemedText style={styles.title}>{t('lang.title')}</ThemedText>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.item, locale === lang.code && styles.itemActive]}
              onPress={() => select(lang.code)}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.flag}>{lang.flag}</ThemedText>
              <ThemedText style={[styles.name, locale === lang.code && styles.nameActive]}>
                {lang.name}
              </ThemedText>
              {locale === lang.code && <ThemedText style={styles.check}>✓</ThemedText>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 4,
  },
  title: {
    fontSize: 16, fontWeight: '700', color: '#1a1a1a',
    marginBottom: 12, textAlign: 'center',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, backgroundColor: '#f5f5f5',
  },
  itemActive: { backgroundColor: '#f0ecff' },
  flag: { fontSize: 24 },
  name: { flex: 1, fontSize: 16, color: '#333' },
  nameActive: { color: '#3b12a3', fontWeight: '700' },
  check: { fontSize: 18, color: '#3b12a3', fontWeight: '700' },
});
