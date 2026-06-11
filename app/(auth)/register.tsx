import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError } from '@/components/form-error';
import { ThemedText } from '@/components/themed-text';
import { api } from '@/services/api';

const PWD_RULES = [
  { test: (p: string) => p.length >= 8,             label: '8 caractères minimum' },
  { test: (p: string) => /[A-Z]/.test(p),           label: '1 lettre majuscule'   },
  { test: (p: string) => /[0-9]/.test(p),           label: '1 chiffre'            },
  { test: (p: string) => /[^a-zA-Z0-9]/.test(p),   label: '1 caractère spécial'  },
];

type Step = 'form' | 'done';

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const fe = (fields: string[]) => {
    const map: Record<string, boolean> = {};
    fields.forEach(f => { map[f] = true; });
    setFieldErrors(map);
  };

  const clearField = (name: string) => {
    setError(null);
    setFieldErrors(prev => ({ ...prev, [name]: false }));
  };

  const handleRegister = async () => {
    setError(null);
    setFieldErrors({});

    if (!firstName.trim()) { fe(['firstName']); setError('Veuillez saisir votre prénom'); return; }
    if (!lastName.trim())  { fe(['lastName']);  setError('Veuillez saisir votre nom');    return; }
    if (!email.trim())     { fe(['email']);     setError('Veuillez saisir votre e-mail'); return; }
    if (!email.includes('@') || !email.includes('.')) {
      fe(['email']); setError('Adresse e-mail invalide'); return;
    }
    if (!password) { fe(['password']); setError('Veuillez choisir un mot de passe'); return; }
    if (!PWD_RULES.every(r => r.test(password))) {
      fe(['password']); setError('Votre mot de passe ne respecte pas tous les critères'); return;
    }
    if (password !== confirmPassword) {
      fe(['confirmPassword']); setError('Les mots de passe ne correspondent pas'); return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/users', { firstName, lastName, email: email.trim().toLowerCase(), password });
      setStep('done');
    } catch (err: unknown) {
      const isNetwork = err instanceof TypeError;
      const lc = err instanceof Error ? err.message.toLowerCase() : '';
      if (isNetwork || lc.includes('network') || lc.includes('failed to fetch')) {
        setError('Impossible de contacter le serveur. Vérifiez votre connexion Internet.');
      } else if (lc.includes('already exists') || lc.includes('email already')) {
        fe(['email']);
        setError('Cette adresse e-mail est déjà utilisée.');
      } else {
        setError("Inscription impossible. Veuillez vérifier vos informations.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Étape succès ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topSection}>
          <Ionicons name="shield-checkmark" size={56} color="rgba(255,255,255,0.9)" />
          <ThemedText style={styles.logo}>CYNA</ThemedText>
          <ThemedText style={styles.tagline}>Bienvenue dans la famille</ThemedText>
        </View>
        <View style={[styles.card, styles.successCard]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
          </View>
          <ThemedText style={styles.successTitle}>Compte créé !</ThemedText>
          <ThemedText style={styles.successText}>
            Bienvenue chez CYNA. Vous pouvez maintenant vous connecter et découvrir nos services.
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { width: '100%', marginTop: 8 }]}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.buttonText}>Se connecter</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.topSection}>
            <Ionicons name="shield-checkmark" size={56} color="rgba(255,255,255,0.9)" />
            <ThemedText style={styles.logo}>CYNA</ThemedText>
            <ThemedText style={styles.tagline}>Rejoignez nos clients protégés</ThemedText>
          </View>

          <View style={styles.card}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#3b12a3" />
              <ThemedText style={styles.backText}>Retour</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.title}>Créer un compte</ThemedText>
            <ThemedText style={styles.subtitle}>Rejoignez CYNA dès aujourd'hui</ThemedText>

            <View style={styles.form}>
              {/* Prénom / Nom */}
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput, fieldErrors.firstName && styles.inputError]}
                  placeholder="Prénom *"
                  placeholderTextColor="#888"
                  value={firstName}
                  onChangeText={v => { setFirstName(v); clearField('firstName'); }}
                />
                <TextInput
                  style={[styles.input, styles.halfInput, fieldErrors.lastName && styles.inputError]}
                  placeholder="Nom *"
                  placeholderTextColor="#888"
                  value={lastName}
                  onChangeText={v => { setLastName(v); clearField('lastName'); }}
                />
              </View>

              {/* Email */}
              <TextInput
                style={[styles.input, fieldErrors.email && styles.inputError]}
                placeholder="Adresse e-mail *"
                placeholderTextColor="#888"
                value={email}
                onChangeText={v => { setEmail(v); clearField('email'); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              {/* Mot de passe */}
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]}
                  placeholder="Mot de passe *"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={v => { setPassword(v); clearField('password'); }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Critères mot de passe */}
              {password.length > 0 && (
                <View style={styles.requirements}>
                  {PWD_RULES.map(({ test, label }) => {
                    const ok = test(password);
                    return (
                      <View key={label} style={styles.reqRow}>
                        <Ionicons
                          name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                          size={14}
                          color={ok ? '#16a34a' : '#9ca3af'}
                        />
                        <ThemedText style={[styles.reqText, ok && styles.reqOk]}>{label}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Confirmation */}
              <TextInput
                style={[styles.input, fieldErrors.confirmPassword && styles.inputError]}
                placeholder="Confirmer le mot de passe *"
                placeholderTextColor="#888"
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); clearField('confirmPassword'); }}
                secureTextEntry={!showPassword}
              />

              <FormError message={error} />

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>
                  {isLoading ? 'Inscription...' : "S'inscrire"}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.link}>
                <ThemedText style={styles.linkSubText}>
                  Déjà un compte ?{' '}
                  <ThemedText style={styles.linkText}>Se connecter</ThemedText>
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#3b12a3' },
  flex:          { flex: 1 },
  scrollContent: { flexGrow: 1 },

  topSection: {
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  logo:    { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  successCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 48,
  },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { color: '#3b12a3', fontSize: 15 },

  title:    { fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 15, textAlign: 'center', color: '#666', marginBottom: 20 },

  form: { gap: 12 },
  row:  { flexDirection: 'row', gap: 10 },

  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1.5, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  inputError:  { borderColor: '#ef4444', backgroundColor: '#FEF2F2' },
  halfInput:   { flex: 1 },

  passwordRow:   { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn:        { position: 'absolute', right: 14, top: 14 },

  requirements: { gap: 5, paddingHorizontal: 4, marginTop: -4 },
  reqRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText:      { fontSize: 12, color: '#9ca3af' },
  reqOk:        { color: '#16a34a' },

  button:         { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  link:        { alignItems: 'center', marginTop: 6 },
  linkText:    { color: '#3b12a3', fontWeight: '600', fontSize: 14 },
  linkSubText: { color: '#555', fontSize: 14 },

  successIcon:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  successText:  { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
});
