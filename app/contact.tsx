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
import { api } from '@/services/api';

export default function ContactScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isAuthenticated && !email.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir votre adresse e-mail');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le sujet et le message');
      return;
    }
    setIsLoading(true);
    try {
      const payload: Record<string, string> = { subject, message };
      const endpoint = isAuthenticated ? '/api/tickets' : '/api/public/contact';
      if (!isAuthenticated) payload.email = email.trim();
      await api.post(endpoint, payload);
      Alert.alert(
        'Message envoyé',
        'Notre équipe vous répondra dans les plus brefs délais.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible d\'envoyer le message';
      Alert.alert('Erreur', msg);
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
        <ThemedText style={styles.headerTitle}>Contact</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Infos contact */}
          <View style={styles.infoBox}>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={20} color="#3b12a3" />
              <ThemedText style={styles.infoText}>support@cyna-it.fr</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#3b12a3" />
              <ThemedText style={styles.infoText}>Lun–Ven : 9h–18h</ThemedText>
            </View>
          </View>

          <View style={styles.form}>
            <ThemedText style={styles.formTitle}>Envoyer un message</ThemedText>
            {!isAuthenticated && (
              <TextInput
                style={styles.input}
                placeholder="Votre e-mail *"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Sujet *"
              placeholderTextColor="#aaa"
              value={subject}
              onChangeText={setSubject}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Votre message *"
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
                {isLoading ? 'Envoi...' : 'Envoyer'}
              </ThemedText>
            </TouchableOpacity>
            {!isAuthenticated && (
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                <ThemedText style={styles.loginLink}>Déjà client ? Se connecter</ThemedText>
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
