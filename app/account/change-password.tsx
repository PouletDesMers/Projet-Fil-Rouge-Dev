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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api } from '@/services/api';

const PWD_RULES = [
  { test: (p: string) => p.length >= 8,           label: '8 caractères minimum'  },
  { test: (p: string) => /[A-Z]/.test(p),         label: '1 lettre majuscule'    },
  { test: (p: string) => /[0-9]/.test(p),         label: '1 chiffre'             },
  { test: (p: string) => /[^a-zA-Z0-9]/.test(p), label: '1 caractère spécial'   },
];

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword]     = useState('');
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [showCurrent, setShowCurrent]             = useState(false);
  const [showNew, setShowNew]                     = useState(false);
  const [saving, setSaving]                       = useState(false);

  const allRulesOk = PWD_RULES.every(r => r.test(newPassword));

  const handleSave = async () => {
    if (!currentPassword) {
      Alert.alert('Champ requis', 'Veuillez saisir votre mot de passe actuel.');
      return;
    }
    if (!newPassword) {
      Alert.alert('Champ requis', 'Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (!allRulesOk) {
      Alert.alert('Mot de passe invalide', 'Votre nouveau mot de passe ne respecte pas tous les critères de sécurité.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit être différent de l\'actuel.');
      return;
    }

    setSaving(true);
    try {
      await api.put('/api/user/profile', {
        motDePasse: newPassword,
        ancienMotDePasse: currentPassword,
      });
      Alert.alert('Succès', 'Votre mot de passe a été modifié avec succès.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const lc = err instanceof Error ? err.message.toLowerCase() : '';
      if (lc.includes('incorrect') || lc.includes('unauthorized')) {
        Alert.alert('Erreur', 'Mot de passe actuel incorrect. Veuillez réessayer.');
      } else if (err instanceof TypeError || lc.includes('network') || lc.includes('fetch')) {
        Alert.alert('Erreur réseau', 'Impossible de contacter le serveur. Vérifiez votre connexion Internet.');
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le mot de passe. Veuillez réessayer.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Changer le mot de passe</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>

          <View style={styles.card}>
            <ThemedText style={styles.label}>Mot de passe actuel</ThemedText>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Votre mot de passe actuel"
                placeholderTextColor="#aaa"
                secureTextEntry={!showCurrent}
                returnKeyType="next"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
                <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <ThemedText style={styles.label}>Nouveau mot de passe</ThemedText>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nouveau mot de passe"
                placeholderTextColor="#aaa"
                secureTextEntry={!showNew}
                returnKeyType="next"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 && (
              <View style={styles.requirements}>
                {PWD_RULES.map(({ test, label }) => {
                  const ok = test(newPassword);
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

            <View style={styles.divider} />

            <ThemedText style={styles.label}>Confirmer le nouveau mot de passe</ThemedText>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmer le mot de passe"
                placeholderTextColor="#aaa"
                secureTextEntry={!showNew}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <ThemedText style={styles.mismatchText}>Les mots de passe ne correspondent pas</ThemedText>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.saveBtnText}>
              {saving ? 'Modification...' : 'Modifier le mot de passe'}
            </ThemedText>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  content: { padding: 16, gap: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  label: {
    fontSize: 12, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },

  passwordRow: { position: 'relative' },
  input: {
    fontSize: 15, color: '#1a1a1a', paddingVertical: 10, paddingRight: 44,
  },
  eyeBtn: { position: 'absolute', right: 0, top: 8 },

  requirements: { gap: 4, marginTop: 8, paddingHorizontal: 2 },
  reqRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText:      { fontSize: 12, color: '#9ca3af' },
  reqOk:        { color: '#16a34a' },

  mismatchText: { fontSize: 12, color: '#ef4444', marginTop: 4 },

  saveBtn: {
    backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
