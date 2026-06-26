import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
import { useAuth } from '@/context/auth-context';
import { useTranslation } from '@/context/language-context';
import { api } from '@/services/api';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const pendingCreds = useRef<{ email: string; password: string } | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const clearErrors = () => {
    setError(null);
    setEmailError(false);
    setPasswordError(false);
    setEmailNotVerified(false);
    setResendDone(false);
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await api.post('/api/resend-verification-email', { email: email.trim().toLowerCase() });
      setResendDone(true);
    } catch {
      // fail silently — server always returns 200
      setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogin = async () => {
    clearErrors();
    const emptyEmail = !email.trim();
    const emptyPassword = !password;
    if (emptyEmail || emptyPassword) {
      setEmailError(emptyEmail);
      setPasswordError(emptyPassword);
      setError(
        emptyEmail && emptyPassword
          ? t('login.error_fields')
          : emptyEmail
          ? t('login.error_email')
          : t('login.error_password')
      );
      return;
    }
    if (!email.includes('@')) {
      setEmailError(true);
      setError(t('login.error_invalid_email'));
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
      const isNetwork = err instanceof TypeError;
      const lc = err instanceof Error ? err.message.toLowerCase() : '';
      if (isNetwork || lc.includes('network') || lc.includes('failed to fetch')) {
        setError(t('common.network_error'));
      } else if (lc.includes('not verified') || lc.includes('verify your email') || lc.includes('email not verified')) {
        setEmailNotVerified(true);
        setError(t('login.error_not_verified'));
      } else if (lc.includes('disabled') || lc.includes('account is disabled')) {
        setError(t('login.error_disabled'));
      } else {
        setEmailError(true);
        setPasswordError(true);
        setError(t('login.error_credentials'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpSubmit = async () => {
    setTotpError(null);
    if (!pendingCreds.current) return;
    setIsLoading(true);
    try {
      await login(pendingCreds.current.email, pendingCreds.current.password, totpCode.trim());
    } catch {
      setTotpError(t('login.twofa_error'));
      setTotpCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack2fa = () => {
    setNeeds2fa(false);
    setTotpCode('');
    setTotpError(null);
    pendingCreds.current = null;
  };

  // ── Vue 2FA ───────────────────────────────────────────────────────────────
  if (needs2fa) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.topSection}>
              <Ionicons name="shield-checkmark" size={56} color="rgba(255,255,255,0.9)" />
              <ThemedText style={styles.logo}>CYNA</ThemedText>
              <ThemedText style={styles.tagline}>{t('login.twofa_tagline')}</ThemedText>
            </View>

            <View style={styles.card}>
              <TouchableOpacity onPress={handleBack2fa} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#3b12a3" />
                <ThemedText style={styles.backText}>{t('common.back')}</ThemedText>
              </TouchableOpacity>

              <ThemedText style={styles.title}>{t('login.twofa_title')}</ThemedText>
              <ThemedText style={styles.subtitle}>{t('login.twofa_subtitle')}</ThemedText>

              <View style={styles.form}>
                <View style={styles.totpContainer}>
                  <TextInput
                    style={[styles.totpInput, totpError && styles.totpInputError]}
                    placeholder="000000"
                    placeholderTextColor="#ccc"
                    value={totpCode}
                    onChangeText={(v) => {
                      setTotpCode(v.replace(/\D/g, '').slice(0, 6));
                      setTotpError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textAlign="center"
                  />
                </View>

                <FormError message={totpError} />

                <TouchableOpacity
                  style={[styles.button, (isLoading || totpCode.length < 6) && styles.buttonDisabled]}
                  onPress={handleTotpSubmit}
                  disabled={isLoading || totpCode.length < 6}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? t('login.twofa_loading') : t('login.twofa_submit')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.topSection}>
            <Ionicons name="shield-checkmark" size={56} color="rgba(255,255,255,0.9)" />
            <ThemedText style={styles.logo}>CYNA</ThemedText>
            <ThemedText style={styles.tagline}>{t('login.tagline')}</ThemedText>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.title}>{t('login.title')}</ThemedText>
            <ThemedText style={styles.subtitle}>{t('login.subtitle')}</ThemedText>

            <View style={styles.form}>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder={t('login.email_placeholder')}
                placeholderTextColor="#888"
                value={email}
                onChangeText={v => { setEmail(v); clearErrors(); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />

              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
                  placeholder={t('login.password_placeholder')}
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={v => { setPassword(v); clearErrors(); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
                <ThemedText style={styles.forgotText}>{t('login.forgot')}</ThemedText>
              </TouchableOpacity>

              <FormError message={error} />

              {emailNotVerified && (
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleResendVerification}
                  disabled={resendLoading || resendDone}
                >
                  <ThemedText style={styles.resendText}>
                    {resendDone
                      ? t('login.resend_done')
                      : resendLoading
                      ? t('login.resend_loading')
                      : t('login.resend_action')}
                  </ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('login.submit')}
              >
                <ThemedText style={styles.buttonText}>
                  {isLoading ? t('login.loading') : t('login.submit')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
                <ThemedText style={styles.linkSubText}>
                  {t('login.no_account')}{' '}
                  <ThemedText style={styles.linkText}>{t('login.register')}</ThemedText>
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
    paddingBottom: 36,
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
    paddingTop: 28,
    paddingBottom: 40,
  },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { color: '#3b12a3', fontSize: 15 },

  title:    { fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 6 },
  subtitle: { fontSize: 15, textAlign: 'center', color: '#666', marginBottom: 24, lineHeight: 22 },

  form: { gap: 14 },
  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1.5, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  inputError:    { borderColor: '#ef4444', backgroundColor: '#FEF2F2' },
  passwordRow:   { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn:        { position: 'absolute', right: 14, top: 14 },

  forgotLink: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: '#3b12a3', fontWeight: '600' },

  button:         { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  link:        { alignItems: 'center', marginTop: 6 },
  linkText:    { color: '#3b12a3', fontWeight: '600', fontSize: 14 },
  linkSubText: { color: '#555', fontSize: 14 },

  resendBtn:  { alignItems: 'center', paddingVertical: 8, marginTop: -4 },
  resendText: { color: '#3b12a3', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  totpContainer: { alignItems: 'center', marginVertical: 8 },
  totpInput: {
    width: 180, height: 64, fontSize: 32, fontWeight: '700',
    letterSpacing: 12, color: '#1a1a1a',
    backgroundColor: '#f8f8f8', borderWidth: 2, borderColor: '#3b12a3',
    borderRadius: 12,
  },
  totpInputError: { borderColor: '#ef4444', backgroundColor: '#FEF2F2' },
});
