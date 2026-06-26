import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { useTranslation } from '@/context/language-context';
import { api } from '@/services/api';

export default function ContactScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isAuthenticated && !email.trim()) {
      Alert.alert(t('common.error'), t('contact.error_email'));
      return;
    }
    if (!subject.trim() || !message.trim()) {
      Alert.alert(t('common.error'), t('contact.error_fields'));
      return;
    }
    setIsLoading(true);
    try {
      const payload: Record<string, string> = { subject, message };
      const endpoint = isAuthenticated ? '/api/tickets' : '/api/public/contact';
      if (!isAuthenticated) payload.email = email.trim();
      await api.post(endpoint, payload);
      Alert.alert(
        t('contact.success_title'),
        t('contact.success_message'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.network_error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('contact.header')}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={20} color="#3b12a3" />
              <ThemedText style={styles.infoText}>support@cyna-it.fr</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#3b12a3" />
              <ThemedText style={styles.infoText}>{t('contact.hours')}</ThemedText>
            </View>
          </View>

          <View style={styles.form}>
            <ThemedText style={styles.formTitle}>{t('contact.form_title')}</ThemedText>
            {!isAuthenticated && (
              <TextInput
                style={styles.input}
                placeholder={t('contact.email_placeholder')}
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder={t('contact.subject_placeholder')}
              placeholderTextColor="#aaa"
              value={subject}
              onChangeText={setSubject}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('contact.message_placeholder')}
              placeholderTextColor="#aaa"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="send-outline" size={18} color="#fff" />
              <ThemedText style={styles.buttonText}>
                {isLoading ? t('contact.loading') : t('contact.submit')}
              </ThemedText>
            </TouchableOpacity>
            {!isAuthenticated && (
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                <ThemedText style={styles.loginLink}>{t('contact.login_link')}</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

  content:  { padding: 16, gap: 16 },
  infoBox:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 15, color: '#333' },

  form:      { gap: 12 },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#000',
  },
  textArea: { minHeight: 130, paddingTop: 13 },
  button: {
    backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  loginLink: { fontSize: 14, color: '#3b12a3', textAlign: 'center', fontWeight: '600' },
});
