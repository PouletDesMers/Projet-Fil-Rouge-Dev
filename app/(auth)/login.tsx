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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Email ou mot de passe incorrect';
      Alert.alert('Erreur de connexion', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.logo}>CYNA</ThemedText>
          <ThemedText style={styles.title}>Bienvenue</ThemedText>
          <ThemedText style={styles.subtitle}>Connectez-vous pour continuer</ThemedText>

          <View style={styles.form}>
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
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <ThemedText style={styles.checkmark}>✓</ThemedText>}
              </View>
              <ThemedText style={styles.rememberText}>Se souvenir de moi</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.buttonText}>
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.link}>
              <ThemedText style={styles.linkText}>Mot de passe oublié ?</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
              <ThemedText style={styles.linkSubText}>
                Pas encore de compte ?{' '}
                <ThemedText style={styles.linkText}>S'inscrire</ThemedText>
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#fff' },
  flex:      { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 40 },
  logo: {
    fontSize: 36, fontWeight: '900', color: '#3b12a3',
    textAlign: 'center', letterSpacing: 4, marginBottom: 30,
  },
  title:    { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 36 },
  form:     { gap: 14 },
  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  rememberRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  checkbox:        { width: 20, height: 20, borderWidth: 2, borderColor: '#3b12a3', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#3b12a3' },
  checkmark:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  rememberText:    { fontSize: 14, color: '#555' },
  button:          { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled:  { opacity: 0.6 },
  buttonText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:            { alignItems: 'center', marginTop: 6 },
  linkText:        { color: '#3b12a3', fontWeight: '600', fontSize: 14 },
  linkSubText:     { color: '#555', fontSize: 14 },
});
