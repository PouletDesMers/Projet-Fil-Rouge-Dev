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
import { useTranslation } from '@/context/language-context';
import { api } from '@/services/api';

type Step = 'email' | 'code' | 'password' | 'done';

const PWD_RULES = [
  { test: (p: string) => p.length >= 8,           label: 'common.rule_chars' },
  { test: (p: string) => /[A-Z]/.test(p),         label: 'common.rule_upper' },
  { test: (p: string) => /[0-9]/.test(p),         label: 'common.rule_digit' },
  { test: (p: string) => /[^a-zA-Z0-9]/.test(p), label: 'common.rule_special' },
];

const STEP_INDEX: Partial<Record<Step, number>> = { email: 0, code: 1, password: 2 };

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmError, setConfirmError] = useState(false);

  const currentStep = STEP_INDEX[step] ?? -1;

  const goBack = () => {
    if (step === 'code')     { setStep('email'); setError(null); setCodeError(false); }
    else if (step === 'password') { setStep('code'); setError(null); setPasswordError(false); setConfirmError(false); }
    else router.back();
  };

  const handleEmailNext = async () => {
    setError(null);
    setEmailError(false);
    if (!email.trim()) {
      setEmailError(true); setError(t('forgot.error_email')); return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setEmailError(true); setError(t('forgot.error_invalid_email')); return;
    }
    setIsLoading(true);
    try {
      await api.post('/api/password-reset/request', { email: email.trim().toLowerCase() });
      setStep('code');
    } catch {
      setError(t('common.network_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeNext = () => {
    setError(null);
    setCodeError(false);
    if (!code.trim() || code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
      setCodeError(true); setError(t('forgot.error_code')); return;
    }
    setStep('password');
  };

  const handleReset = async () => {
    setError(null);
    setPasswordError(false);
    setConfirmError(false);

    if (!password) {
      setPasswordError(true); setError(t('forgot.error_password')); return;
    }
    if (!PWD_RULES.every(r => r.test(password))) {
      setPasswordError(true); setError(t('forgot.error_weak')); return;
    }
    if (password !== confirmPassword) {
      setConfirmError(true); setError(t('forgot.error_mismatch')); return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/password-reset', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
      });
      setStep('done');
    } catch (err: unknown) {
      const isNetwork = err instanceof TypeError;
      const lc = err instanceof Error ? err.message.toLowerCase() : '';
      if (isNetwork || lc.includes('network') || lc.includes('failed to fetch')) {
        setError(t('common.network_error'));
      } else if (lc.includes('invalid') || lc.includes('expired') || lc.includes('already used')) {
        setStep('code');
        setCodeError(true);
        setError(t('forgot.error_expired'));
      } else {
        setError(t('forgot.error_generic'));
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
              <ThemedText style={styles.backText}>{t('common.back')}</ThemedText>
            </TouchableOpacity>
          )}

          <ThemedText style={styles.logo}>CYNA</ThemedText>

          {/* Indicateur d'étape */}
          {step !== 'done' && (
            <View style={styles.stepper}>
              <View style={[styles.stepDot, currentStep === 0 && styles.stepDotActive, currentStep > 0 && styles.stepDotDone]} />
              <View style={[styles.stepLine, currentStep > 0 && styles.stepLineActive]} />
              <View style={[styles.stepDot, currentStep === 1 && styles.stepDotActive, currentStep > 1 && styles.stepDotDone]} />
              <View style={[styles.stepLine, currentStep > 1 && styles.stepLineActive]} />
              <View style={[styles.stepDot, currentStep === 2 && styles.stepDotActive, currentStep > 2 && styles.stepDotDone]} />
            </View>
          )}

          {/* ── Étape 1 : e-mail ── */}
          {step === 'email' && (
            <>
              <ThemedText style={styles.title}>{t('forgot.title_email')}</ThemedText>
              <ThemedText style={styles.subtitle}>{t('forgot.subtitle_email')}</ThemedText>
              <View style={styles.form}>
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
                  placeholder={t('forgot.email_placeholder')}
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
                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleEmailNext}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? t('forgot.button_loading') : t('forgot.button_submit')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.link}>
                  <ThemedText style={styles.linkText}>{t('forgot.back_login')}</ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Étape 2 : code OTP ── */}
          {step === 'code' && (
            <>
              <ThemedText style={styles.title}>{t('forgot.title_code')}</ThemedText>
              <ThemedText style={styles.subtitle}>
                {t('forgot.subtitle_code', { email })}
              </ThemedText>
              <View style={styles.form}>
                <TextInput
                  style={[styles.input, styles.codeInput, codeError && styles.inputError]}
                  placeholder="000000"
                  placeholderTextColor="#888"
                  value={code}
                  onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); setCodeError(false); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleCodeNext}
                />
                <FormError message={error} />
                <TouchableOpacity style={styles.button} onPress={handleCodeNext} activeOpacity={0.8}>
                  <ThemedText style={styles.buttonText}>{t('forgot.button_code')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEmailNext}
                  style={styles.link}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.linkText}>{t('forgot.resend_code')}</ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Étape 3 : nouveau mot de passe ── */}
          {step === 'password' && (
            <>
              <ThemedText style={styles.title}>{t('forgot.title_new_password')}</ThemedText>
              <ThemedText style={styles.subtitle}>
                {t('forgot.subtitle_new_password', { email })}
              </ThemedText>
              <View style={styles.form}>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
                    placeholder={t('forgot.new_password_placeholder')}
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
                          <ThemedText style={[styles.reqText, ok && styles.reqOk]}>{t(label)}</ThemedText>
                        </View>
                      );
                    })}
                  </View>
                )}

                <TextInput
                  style={[styles.input, confirmError && styles.inputError]}
                  placeholder={t('forgot.confirm_placeholder')}
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
                    {isLoading ? t('forgot.button_reset_loading') : t('forgot.button_reset')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Étape 4 : succès ── */}
          {step === 'done' && (
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
              </View>
              <ThemedText style={styles.successTitle}>{t('forgot.success_title')}</ThemedText>
              <ThemedText style={styles.successText}>{t('forgot.success_text')}</ThemedText>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>{t('forgot.success_button')}</ThemedText>
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
  codeInput: { textAlign: 'center', fontSize: 28, fontWeight: '700', letterSpacing: 8 },
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

  stepper:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e0e0e0' },
  stepDotActive:  { backgroundColor: '#3b12a3', width: 24, borderRadius: 12 },
  stepDotDone:    { backgroundColor: '#3b12a3' },
  stepLine:       { height: 2, width: 36, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#3b12a3' },
});
