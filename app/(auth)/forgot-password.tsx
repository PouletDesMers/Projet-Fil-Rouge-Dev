import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez saisir une adresse e-mail valide');
      return;
    }
    setIsLoading(true);
    try {
      // TODO : endpoint reset password à ajouter côté API
      // await api.post('/api/users/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
      Alert.alert('Erreur', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText style={styles.backText}>← Retour</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.logo}>CYNA</ThemedText>
          <ThemedText style={styles.title}>Mot de passe oublié</ThemedText>

          {sent ? (
            <View style={styles.successBox}>
              <ThemedText style={styles.successIcon}>✉️</ThemedText>
              <ThemedText style={styles.successTitle}>Email envoyé !</ThemedText>
              <ThemedText style={styles.successText}>
                Si un compte existe avec l'adresse {email}, vous recevrez un lien de réinitialisation.
              </ThemedText>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>Retour à la connexion</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <ThemedText style={styles.subtitle}>
                Saisissez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Adresse e-mail"
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>
                  {isLoading ? 'Envoi...' : 'Envoyer le lien'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  flex:        { flex: 1 },
  container:   { flex: 1, paddingHorizontal: 30, paddingVertical: 30 },
  backBtn:     { marginBottom: 20 },
  backText:    { color: '#3b12a3', fontSize: 15 },
  logo:        { fontSize: 36, fontWeight: '900', color: '#3b12a3', textAlign: 'center', letterSpacing: 4, marginBottom: 20 },
  title:       { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 24 },
  form:        { gap: 16 },
  subtitle:    { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  button:         { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  successBox:  { alignItems: 'center', gap: 16, marginTop: 20 },
  successIcon: { fontSize: 48 },
  successTitle:{ fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  successText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
});
