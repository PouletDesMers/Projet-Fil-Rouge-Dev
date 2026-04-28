import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const pendingCreds = useRef<{ email: string; password: string } | null>(null);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === '2FA_REQUIRED') {
        pendingCreds.current = { email: email.trim().toLowerCase(), password };
        setNeeds2fa(true);
        setIsLoading(false);
        return;
      }
      Alert.alert('Erreur de connexion', err instanceof Error ? err.message : 'Email ou mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpSubmit = async () => {
    if (!totpCode.trim() || totpCode.length < 6) {
      Alert.alert('Code invalide', 'Saisissez le code à 6 chiffres');
      return;
    }
    if (!pendingCreds.current) return;
    setIsLoading(true);
    try {
      await login(pendingCreds.current.email, pendingCreds.current.password, totpCode.trim());
    } catch {
      Alert.alert('Code incorrect', 'Le code est invalide ou expiré. Réessayez.');
      setTotpCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack2fa = () => {
    setNeeds2fa(false);
    setTotpCode('');
    pendingCreds.current = null;
  };

  // ── Vue 2FA ───────────────────────────────────────────────────────────────
  if (needs2fa) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={handleBack2fa} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#3b12a3" />
              <ThemedText style={styles.backText}>Retour</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.logo}>CYNA</ThemedText>
            <ThemedText style={styles.title}>Vérification</ThemedText>
            <ThemedText style={styles.subtitle}>
              Ouvrez votre application d'authentification et saisissez le code à 6 chiffres.
            </ThemedText>

            <View style={styles.form}>
              <View style={styles.totpContainer}>
                <TextInput
                  style={styles.totpInput}
                  placeholder="000000"
                  placeholderTextColor="#ccc"
                  value={totpCode}
                  onChangeText={(v) => setTotpCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  textAlign="center"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (isLoading || totpCode.length < 6) && styles.buttonDisabled]}
                onPress={handleTotpSubmit}
                disabled={isLoading || totpCode.length < 6}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>
                  {isLoading ? 'Vérification...' : 'Valider'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Vue connexion normale ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              returnKeyType="next"
            />

            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Mot de passe"
                placeholderTextColor="#888"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
              <ThemedText style={styles.forgotText}>Mot de passe oublié ?</ThemedText>
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
  container: { flexGrow: 1, paddingHorizontal: 30, paddingTop: 60, paddingBottom: 40 },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { color: '#3b12a3', fontSize: 15 },

  logo:     { fontSize: 36, fontWeight: '900', color: '#3b12a3', textAlign: 'center', letterSpacing: 4, marginBottom: 30, lineHeight: 46 },
  title:    { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 36, lineHeight: 22 },

  form: { gap: 14 },
  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  passwordRow:  { position: 'relative' },
  passwordInput:{ paddingRight: 48 },
  eyeBtn:       { position: 'absolute', right: 14, top: 14 },

  forgotLink: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: '#3b12a3', fontWeight: '600' },

  button:         { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  link:        { alignItems: 'center', marginTop: 6 },
  linkText:    { color: '#3b12a3', fontWeight: '600', fontSize: 14 },
  linkSubText: { color: '#555', fontSize: 14 },

  // 2FA
  totpContainer: { alignItems: 'center', marginVertical: 8 },
  totpInput: {
    width: 180, height: 64, fontSize: 32, fontWeight: '700',
    letterSpacing: 12, color: '#1a1a1a',
    backgroundColor: '#f8f8f8', borderWidth: 2, borderColor: '#3b12a3',
    borderRadius: 12,
  },
});
