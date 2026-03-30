import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';

type Step = 'address' | 'payment' | 'confirm';

const STEPS: { key: Step; label: string }[] = [
  { key: 'address', label: 'Adresse' },
  { key: 'payment', label: 'Paiement' },
  { key: 'confirm', label: 'Confirmation' },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('address');

  // Adresse
  const [street, setStreet]       = useState('');
  const [city, setCity]           = useState('');
  const [zip, setZip]             = useState('');
  const [country, setCountry]     = useState('France');

  // Paiement (UI only - intégration Stripe en Sprint 4)
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry]  = useState('');
  const [cardCvc, setCardCvc]        = useState('');
  const [cardName, setCardName]      = useState('');

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };

  const back = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
    else router.back();
  };

  const formatCard = (v: string) =>
    v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const formatExpiry = (v: string) =>
    v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Commande</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Stepper */}
      <View style={styles.stepper}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, i <= currentIndex && styles.stepCircleActive]}>
                {i < currentIndex ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <ThemedText style={[styles.stepNum, i <= currentIndex && styles.stepNumActive]}>
                    {i + 1}
                  </ThemedText>
                )}
              </View>
              <ThemedText style={[styles.stepLabel, i <= currentIndex && styles.stepLabelActive]}>
                {s.label}
              </ThemedText>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < currentIndex && styles.stepLineActive]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Étape 1 : Adresse */}
          {step === 'address' && (
            <View style={styles.form}>
              <ThemedText style={styles.formTitle}>Adresse de facturation</ThemedText>
              <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor="#aaa" value={cardName} onChangeText={setCardName} />
              <TextInput style={styles.input} placeholder="Rue et numéro" placeholderTextColor="#aaa" value={street} onChangeText={setStreet} />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} placeholder="Code postal" placeholderTextColor="#aaa" value={zip} onChangeText={setZip} keyboardType="numeric" />
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="Ville" placeholderTextColor="#aaa" value={city} onChangeText={setCity} />
              </View>
              <TextInput style={styles.input} placeholder="Pays" placeholderTextColor="#aaa" value={country} onChangeText={setCountry} />
            </View>
          )}

          {/* Étape 2 : Paiement */}
          {step === 'payment' && (
            <View style={styles.form}>
              <ThemedText style={styles.formTitle}>Informations de paiement</ThemedText>
              <View style={styles.cardNote}>
                <Ionicons name="lock-closed-outline" size={14} color="#3b12a3" />
                <ThemedText style={styles.cardNoteText}>Paiement sécurisé SSL</ThemedText>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Numéro de carte"
                placeholderTextColor="#aaa"
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCard(v))}
                keyboardType="numeric"
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  placeholder="MM/AA"
                  placeholderTextColor="#aaa"
                  value={cardExpiry}
                  onChangeText={(v) => setCardExpiry(formatExpiry(v))}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="CVC"
                  placeholderTextColor="#aaa"
                  value={cardCvc}
                  onChangeText={(v) => setCardCvc(v.slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Nom sur la carte"
                placeholderTextColor="#aaa"
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="characters"
              />
            </View>
          )}

          {/* Étape 3 : Confirmation */}
          {step === 'confirm' && (
            <View style={styles.confirmSection}>
              <Ionicons name="checkmark-circle" size={80} color="#3b12a3" style={{ alignSelf: 'center' }} />
              <ThemedText style={styles.confirmTitle}>Commande confirmée !</ThemedText>
              <ThemedText style={styles.confirmSubtitle}>
                Merci pour votre commande. Vous allez recevoir un email de confirmation.
              </ThemedText>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonText}>Retour à l'accueil</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.buttonOutline}
                onPress={() => router.push('/orders')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.buttonOutlineText}>Voir mes commandes</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bouton suivant */}
      {step !== 'confirm' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={next} activeOpacity={0.8}>
            <ThemedText style={styles.buttonText}>
              {step === 'payment' ? 'Confirmer la commande' : 'Continuer'}
            </ThemedText>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  stepItem:        { alignItems: 'center', gap: 4 },
  stepCircle:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive:{ backgroundColor: '#3b12a3' },
  stepNum:         { fontSize: 13, fontWeight: '700', color: '#aaa' },
  stepNumActive:   { color: '#fff' },
  stepLabel:       { fontSize: 11, color: '#aaa' },
  stepLabelActive: { color: '#3b12a3', fontWeight: '600' },
  stepLine:        { flex: 1, height: 2, backgroundColor: '#e0e0e0', marginBottom: 14, marginHorizontal: 4 },
  stepLineActive:  { backgroundColor: '#3b12a3' },

  content: { padding: 16 },
  form:    { gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  row:       { flexDirection: 'row' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#000',
  },
  cardNote:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardNoteText: { fontSize: 12, color: '#3b12a3' },

  confirmSection: { alignItems: 'center', paddingTop: 40, gap: 16 },
  confirmTitle:   { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  confirmSubtitle:{ fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },

  footer: { padding: 16, paddingBottom: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  button: {
    backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  buttonText:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonOutline:     { backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 13, borderWidth: 2, borderColor: '#3b12a3', alignItems: 'center', width: '100%' },
  buttonOutlineText: { color: '#3b12a3', fontSize: 15, fontWeight: '600' },
});
