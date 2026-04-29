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

type Step = 'email' | 'password' | 'done';

const PWD_RULES = [
  { test: (p: string) => p.length >= 8,           label: '8 caractères minimum' },
  { test: (p: string) => /[A-Z]/.test(p),         label: '1 lettre majuscule'   },
  { test: (p: string) => /[0-9]/.test(p),         label: '1 chiffre'            },
  { test: (p: string) => /[^a-zA-Z0-9]/.test(p), label: '1 caractère spécial'  },
];

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmError, setConfirmError] = useState(false);

  const goBack = () => {
    if (step === 'password') { setStep('email'); setError(null); setPasswordError(false); setConfirmError(false); }
    else router.back();
  };

  const handleEmailNext = () => {
    setError(null);
    setEmailError(false);
    if (!email.trim()) {
      setEmailError(true); setError('Veuillez saisir votre adresse e-mail'); return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setEmailError(true); setError('Adresse e-mail invalide'); return;
    }
    setStep('password');
  };

  const handleReset = async () => {
    setError(null);
    setPasswordError(false);
    setConfirmError(false);

    if (!password) {
      setPasswordError(true); setError('Veuillez saisir un nouveau mot de passe'); return;
    }
    if (!PWD_RULES.every(r => r.test(password))) {
      setPasswordError(true); setError('Votre mot de passe ne respecte pas tous les critères'); return;
    }
    if (password !== confirmPassword) {
      setConfirmError(true); setError('Les mots de passe ne correspondent pas'); return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/password-reset', { email: email.trim().toLowerCase(), password });
      setStep('done');
    } catch (err: unknown) {
      const isNetwork = err instanceof TypeError;
      const lc = err instanceof Error ? err.message.toLowerCase() : '';
      if (isNetwork || lc.includes('network') || lc.includes('failed to fetch')) {
        setError('Impossible de contacter le serveur. Vérifiez votre connexion Internet.');
      } else if (lc.includes('not found') || lc.includes('introuvable')) {
        setStep('email');
        setEmailError(true);
        setError('Aucun compte associé à cette adresse e-mail.');
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {step !== 'done' && (
            <TouchableOpacity onPress={goBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#3b12a3" />
              <ThemedText style={styles.backText}>Retour</ThemedText>
            </TouchableOpacity>
          )}

          <ThemedText style={styles.logo}>CYNA</ThemedText>

          {/* ── Étape 1 : e-mail ── */}
          {step === 'email' && (
            <>
              <ThemedText style={styles.title}>Mot de passe oublié</ThemedText>
              <ThemedText style={styles.subtitle}>
                Saisissez votre adresse e-mail pour réinitialiser votre mot de passe.
              </ThemedText>
              <View style={styles.form}>
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
                  placeholder="Adresse e-mail"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={v => { setEmail(v); setError(null); setEmailError(false); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={handleEmailNext}
                />
                <FormError message={error} />
                <TouchableOpacity style={styles.button} onPress={handleEmailNext} activeOpacity={0.8}>
                  <ThemedText style={styles.buttonText}>Continuer</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.link}>
                  <ThemedText style={styles.linkText}>Retour à la connexion</ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Étape 2 : nouveau mot de passe ── */}
          {step === 'password' && (
            <>
              <ThemedText style={styles.title}>Nouveau mot de passe</ThemedText>
              <ThemedText style={styles.subtitle}>
                Choisissez un nouveau mot de passe pour{' '}
                <ThemedText style={styles.emailHighlight}>{email}</ThemedText>.
              </ThemedText>
              <View style={styles.form}>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={v => { setPassword(v); setError(null); setPasswordError(false); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
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

                <TextInput
                  style={[styles.input, confirmError && styles.inputError]}
                  placeholder="Confirmer le mot de passe"
                  placeholderTextColor="#888"
                  value={confirmPassword}
                  onChangeText={v => { setConfirmPassword(v); setError(null); setConfirmError(false); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />

                <FormError message={error} />

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleReset}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? 'Enregistrement...' : 'Réinitialiser'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Étape 3 : succès ── */}
          {step === 'done' && (
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
              </View>
              <ThemedText style={styles.successTitle}>Mot de passe mis à jour !</ThemedText>
              <ThemedText style={styles.successText}>
                Votre mot de passe a été réinitialisé avec succès.
              </ThemedText>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>Se connecter</ThemedText>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#fff' },
  flex:      { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 30, paddingVertical: 30 },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { color: '#3b12a3', fontSize: 15 },

  logo:           { fontSize: 36, fontWeight: '900', color: '#3b12a3', textAlign: 'center', letterSpacing: 4, marginBottom: 24, lineHeight: 46 },
  title:          { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 10 },
  subtitle:       { fontSize: 15, textAlign: 'center', color: '#666', lineHeight: 22, marginBottom: 28 },
  emailHighlight: { fontWeight: '700', color: '#3b12a3' },

  form: { gap: 12 },

  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1.5, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  inputError:    { borderColor: '#ef4444', backgroundColor: '#FEF2F2' },
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

  link:     { alignItems: 'center', marginTop: 6 },
  linkText: { color: '#3b12a3', fontWeight: '600', fontSize: 14 },

  successBox:   { alignItems: 'center', paddingTop: 20, gap: 16 },
  successIcon:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  successText:  { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
});
