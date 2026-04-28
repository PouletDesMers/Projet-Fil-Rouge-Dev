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
import { api } from '@/services/api';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validatePassword = (pwd: string) =>
    pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Erreur', 'Adresse e-mail invalide');
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert(
        'Mot de passe insuffisant',
        'Au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial'
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/users', { firstName, lastName, email, password });
      Alert.alert(
        'Inscription réussie',
        'Votre compte a été créé. Vous pouvez maintenant vous connecter.',
        [{ text: 'Se connecter', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de créer le compte';
      Alert.alert('Erreur', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText style={styles.backText}>← Retour</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.logo}>CYNA</ThemedText>
          <ThemedText style={styles.title}>Créer un compte</ThemedText>
          <ThemedText style={styles.subtitle}>Rejoignez Cyna dès aujourd'hui</ThemedText>

          <View style={styles.form}>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Prénom *"
                placeholderTextColor="#888"
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Nom *"
                placeholderTextColor="#888"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Adresse e-mail *"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe *"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <ThemedText style={styles.hint}>8+ car., 1 majuscule, 1 chiffre, 1 spécial</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Confirmer le mot de passe *"
              placeholderTextColor="#888"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  flex:       { flex: 1 },
  container:  { flexGrow: 1, paddingHorizontal: 30, paddingVertical: 30 },
  backBtn:    { marginBottom: 10 },
  backText:   { color: '#3b12a3', fontSize: 15 },
  logo:       { fontSize: 36, fontWeight: '900', color: '#3b12a3', textAlign: 'center', letterSpacing: 4, marginBottom: 20, lineHeight: 46 },
  title:      { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', marginBottom: 6 },
  subtitle:   { fontSize: 15, textAlign: 'center', color: '#666', marginBottom: 28 },
  form:       { gap: 12 },
  row:        { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1a1a1a',
  },
  halfInput:      { flex: 1 },
  hint:           { fontSize: 12, color: '#888', marginTop: -4 },
  button:         { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:           { alignItems: 'center', marginTop: 6 },
  linkText:       { color: '#3b12a3', fontWeight: '600', fontSize: 14 },
  linkSubText:    { color: '#555', fontSize: 14 },
});
