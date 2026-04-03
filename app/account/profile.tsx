import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { api, UserProfile } from '@/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.get<UserProfile>('/api/user/profile');
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
      setPhone(data.phone ?? '');
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Champs requis', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/api/user/profile', { firstName, lastName, phone });
      Alert.alert('Succès', 'Profil mis à jour avec succès.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b12a3" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Informations personnelles</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <ThemedText style={styles.label}>Adresse e-mail</ThemedText>
            <View style={styles.readonlyField}>
              <ThemedText style={styles.readonlyText}>{profile?.email}</ThemedText>
              <Ionicons name="lock-closed-outline" size={16} color="#aaa" />
            </View>

            <View style={styles.divider} />

            <ThemedText style={styles.label}>Prénom</ThemedText>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Votre prénom"
              autoCapitalize="words"
              returnKeyType="next"
            />

            <View style={styles.divider} />

            <ThemedText style={styles.label}>Nom</ThemedText>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Votre nom"
              autoCapitalize="words"
              returnKeyType="next"
            />

            <View style={styles.divider} />

            <ThemedText style={styles.label}>Téléphone</ThemedText>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+33 6 00 00 00 00"
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <ThemedText style={styles.saveBtnText}>Enregistrer</ThemedText>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  content: { padding: 16, gap: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: {
    fontSize: 15, color: '#1a1a1a', paddingVertical: 10,
  },
  readonlyField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  readonlyText:  { fontSize: 15, color: '#888' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },

  saveBtn: {
    backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
