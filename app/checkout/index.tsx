import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
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
import { CartItem, DURATION_DISCOUNT, DURATION_LABELS, useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { api } from '@/services/api';
import { createStripeToken } from '@/services/stripe';

type Step = 'recap' | 'address' | 'payment' | 'confirm';

const STEPS: { key: Step; label: string }[] = [
  { key: 'recap',   label: 'Récap'     },
  { key: 'address', label: 'Adresse'   },
  { key: 'payment', label: 'Paiement'  },
  { key: 'confirm', label: 'Confirmé'  },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>('recap');

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Commande</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.authGate}>
          <Ionicons name="lock-closed-outline" size={56} color="#3b12a3" />
          <ThemedText style={styles.authGateTitle}>Connexion requise</ThemedText>
          <ThemedText style={styles.authGateText}>
            Vous devez être connecté pour finaliser votre commande.
          </ThemedText>
          <TouchableOpacity
            style={styles.authGateBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.authGateBtnText}>Se connecter</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.authGateBtnOutline}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.authGateBtnOutlineText}>Créer un compte</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Adresse
  const [fullName, setFullName] = useState('');
  const [street, setStreet]     = useState('');
  const [city, setCity]         = useState('');
  const [zip, setZip]           = useState('');
  const [country, setCountry]   = useState('France');

  // Paiement
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry]  = useState('');
  const [cardCvc, setCardCvc]        = useState('');
  const [cardName, setCardName]      = useState('');

  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const availableItems = items.filter((i) => i.available);

  const back = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
    else router.back();
  };

  const validateAddress = () => {
    if (!fullName.trim() || !street.trim() || !city.trim() || !zip.trim()) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs d\'adresse');
      return false;
    }
    return true;
  };

  const validatePayment = () => {
    if (!cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim() || !cardName.trim()) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs de paiement');
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (!validatePayment()) return;
    setSubmitting(true);
    try {
      const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
      const [expMonth, expYear] = cardExpiry.split('/');

      // 1. Tokenisation de la carte via Stripe
      const tokenId = await createStripeToken(
        { number: cardNumber, expMonth: expMonth ?? '', expYear: expYear ?? '', cvc: cardCvc, name: cardName },
        publishableKey,
      );

      // 2. Débit via le backend
      const amountCents = Math.round(total * 1.2 * 100);
      await api.post('/api/payments/charge', { tokenId, amount: amountCents, currency: 'eur' });

      // 3. Création de la commande + enregistrement du paiement
      const created = await api.post<{ id: number }>('/api/commandes', {
        totalAmount: Math.round(total * 1.2 * 100) / 100,
        status: 'confirmed',
      });
      if (created?.id) {
        await api.post('/api/paiements', {
          orderId: created.id,
          method:  'card',
          status:  'paid',
        });
        setOrderId(String(created.id));
      }
      clearCart();
      setStep('confirm');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du paiement';
      Alert.alert('Paiement refusé', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === 'recap') {
      if (availableItems.length === 0) {
        Alert.alert('Panier vide', 'Aucun article disponible dans votre panier');
        return;
      }
      setStep('address');
    } else if (step === 'address') {
      if (validateAddress()) setStep('payment');
    } else if (step === 'payment') {
      submitOrder();
    }
  };

  const formatCard = (v: string) =>
    v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const formatExpiry = (v: string) =>
    v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn} disabled={step === 'confirm'}>
          {step !== 'confirm' && <Ionicons name="arrow-back" size={24} color="#fff" />}
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Commande</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Stepper */}
      <View style={styles.stepper}>
        {STEPS.map((s, i) => (
          <Fragment key={s.key}>
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
          </Fragment>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Étape 1 : Récapitulatif ── */}
          {step === 'recap' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Récapitulatif de votre commande</ThemedText>

              {items.length === 0 ? (
                <View style={styles.emptyCart}>
                  <Ionicons name="cart-outline" size={48} color="#ccc" />
                  <ThemedText style={styles.emptyCartText}>Votre panier est vide</ThemedText>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => router.push('/(tabs)/explore')}
                  >
                    <ThemedText style={styles.linkBtnText}>Voir le catalogue</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {items.map((item) => (
                    <RecapItem key={item.id} item={item} />
                  ))}

                  {items.some((i) => !i.available) && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning-outline" size={16} color="#e67e22" />
                      <ThemedText style={styles.warningText}>
                        Les articles indisponibles ne seront pas inclus dans la commande
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.totalCard}>
                    <View style={styles.totalRow}>
                      <ThemedText style={styles.totalLabel}>Sous-total</ThemedText>
                      <ThemedText style={styles.totalValue}>{total.toFixed(2)} €</ThemedText>
                    </View>
                    <View style={styles.totalRow}>
                      <ThemedText style={styles.totalLabel}>TVA (20%)</ThemedText>
                      <ThemedText style={styles.totalValue}>{(total * 0.2).toFixed(2)} €</ThemedText>
                    </View>
                    <View style={[styles.totalRow, styles.totalBorderTop]}>
                      <ThemedText style={styles.totalLabelBold}>Total TTC</ThemedText>
                      <ThemedText style={styles.totalAmountBold}>{(total * 1.2).toFixed(2)} €</ThemedText>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Étape 2 : Adresse ── */}
          {step === 'address' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Adresse de facturation</ThemedText>
              <View style={styles.form}>
                <LabeledInput label="Nom complet" value={fullName} onChangeText={setFullName} placeholder="Jean Dupont" />
                <LabeledInput label="Rue et numéro" value={street} onChangeText={setStreet} placeholder="12 rue de la Paix" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <LabeledInput label="Code postal" value={zip} onChangeText={setZip} placeholder="75001" keyboardType="numeric" />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 2 }}>
                    <LabeledInput label="Ville" value={city} onChangeText={setCity} placeholder="Paris" />
                  </View>
                </View>
                <LabeledInput label="Pays" value={country} onChangeText={setCountry} placeholder="France" />
              </View>
            </View>
          )}

          {/* ── Étape 3 : Paiement ── */}
          {step === 'payment' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Informations de paiement</ThemedText>

              <View style={styles.secureNote}>
                <Ionicons name="lock-closed" size={14} color="#27ae60" />
                <ThemedText style={styles.secureNoteText}>Paiement sécurisé par Stripe</ThemedText>
              </View>

              <View style={styles.form}>
                <LabeledInput
                  label="Numéro de carte"
                  value={cardNumber}
                  onChangeText={(v) => setCardNumber(formatCard(v))}
                  placeholder="4242 4242 4242 4242"
                  keyboardType="numeric"
                />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <LabeledInput
                      label="Expiration"
                      value={cardExpiry}
                      onChangeText={(v) => setCardExpiry(formatExpiry(v))}
                      placeholder="MM/AA"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <LabeledInput
                      label="CVC"
                      value={cardCvc}
                      onChangeText={(v) => setCardCvc(v.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      keyboardType="numeric"
                      secureTextEntry
                    />
                  </View>
                </View>
                <LabeledInput
                  label="Nom sur la carte"
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="JEAN DUPONT"
                  autoCapitalize="characters"
                />
              </View>

              {/* Récap montant */}
              <View style={styles.paymentSummary}>
                <ThemedText style={styles.paymentSummaryLabel}>Montant à débiter</ThemedText>
                <ThemedText style={styles.paymentSummaryAmount}>{(total * 1.2).toFixed(2)} €</ThemedText>
              </View>
            </View>
          )}

          {/* ── Étape 4 : Confirmation ── */}
          {step === 'confirm' && (
            <View style={styles.confirmSection}>
              <View style={styles.confirmIcon}>
                <Ionicons name="checkmark-circle" size={72} color="#3b12a3" />
              </View>
              <ThemedText style={styles.confirmTitle}>Commande confirmée !</ThemedText>
              {orderId && (
                <View style={styles.orderIdBox}>
                  <ThemedText style={styles.orderIdLabel}>Numéro de commande</ThemedText>
                  <ThemedText style={styles.orderIdValue}>#{orderId.slice(0, 8).toUpperCase()}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.confirmSubtitle}>
                Merci pour votre confiance. Un email de confirmation vous a été envoyé avec les détails de votre abonnement.
              </ThemedText>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.ctaButtonText}>Retour à l'accueil</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaButtonOutline}
                onPress={() => router.push('/orders')}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.ctaButtonOutlineText}>Voir mes commandes</ThemedText>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer bouton suivant */}
      {step !== 'confirm' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, (submitting || (step === 'recap' && availableItems.length === 0)) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={submitting || (step === 'recap' && availableItems.length === 0)}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <ThemedText style={styles.nextBtnText}>
                  {step === 'payment' ? 'Confirmer la commande' : 'Continuer'}
                </ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function RecapItem({ item }: { item: CartItem }) {
  const lineTotal = item.price * item.quantity * DURATION_DISCOUNT[item.duration];
  return (
    <View style={[styles.recapItem, !item.available && styles.recapItemUnavailable]}>
      <View style={styles.recapItemLeft}>
        <ThemedText style={styles.recapItemName} numberOfLines={2}>{item.name}</ThemedText>
        <ThemedText style={styles.recapItemMeta}>
          {DURATION_LABELS[item.duration]} · Qté {item.quantity}
        </ThemedText>
        {!item.available && (
          <View style={styles.unavailableBadge}>
            <ThemedText style={styles.unavailableBadgeText}>Non inclus</ThemedText>
          </View>
        )}
      </View>
      <ThemedText style={[styles.recapItemPrice, !item.available && styles.recapItemPriceStrike]}>
        {lineTotal.toFixed(2)} €
      </ThemedText>
    </View>
  );
}

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

function LabeledInput({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry, autoCapitalize }: LabeledInputProps) {
  return (
    <View style={styles.inputGroup}>
      <ThemedText style={styles.inputLabel}>{label}</ThemedText>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 40, padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },

  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  stepItem:         { alignItems: 'center', gap: 4 },
  stepCircle:       { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#3b12a3' },
  stepNum:          { fontSize: 13, fontWeight: '700', color: '#aaa' },
  stepNumActive:    { color: '#fff' },
  stepLabel:        { fontSize: 10, color: '#aaa' },
  stepLabelActive:  { color: '#3b12a3', fontWeight: '600' },
  stepLine:         { flex: 1, height: 2, backgroundColor: '#e0e0e0', marginBottom: 14, marginHorizontal: 4 },
  stepLineActive:   { backgroundColor: '#3b12a3' },

  content: { padding: 16, paddingBottom: 32 },
  section: { gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  // Récap items
  recapItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  recapItemUnavailable: { opacity: 0.5 },
  recapItemLeft:        { flex: 1, marginRight: 12, gap: 3 },
  recapItemName:        { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  recapItemMeta:        { fontSize: 12, color: '#888' },
  recapItemPrice:       { fontSize: 15, fontWeight: '800', color: '#3b12a3' },
  recapItemPriceStrike: { textDecorationLine: 'line-through', color: '#aaa' },
  unavailableBadge:     { alignSelf: 'flex-start', backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  unavailableBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fef9f0', borderRadius: 10, padding: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: '#e67e22', lineHeight: 18 },

  totalCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
    gap: 10,
  },
  totalRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBorderTop: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  totalLabel:     { fontSize: 14, color: '#666' },
  totalValue:     { fontSize: 14, color: '#666' },
  totalLabelBold: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  totalAmountBold:{ fontSize: 20, fontWeight: '900', color: '#3b12a3' },

  emptyCart:     { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyCartText: { fontSize: 16, color: '#888' },
  linkBtn:       { backgroundColor: '#3b12a3', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  linkBtnText:   { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Formulaires
  form:       { gap: 12 },
  row:        { flexDirection: 'row' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e0e0e0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#000',
  },

  secureNote:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secureNoteText: { fontSize: 13, color: '#27ae60', fontWeight: '600' },

  paymentSummary: {
    backgroundColor: '#f8f5ff', borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
  },
  paymentSummaryLabel:  { fontSize: 15, fontWeight: '600', color: '#555' },
  paymentSummaryAmount: { fontSize: 22, fontWeight: '900', color: '#3b12a3' },

  // Confirmation
  confirmSection: { alignItems: 'center', paddingTop: 32, gap: 16, paddingHorizontal: 8 },
  confirmIcon:    { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0ecff', alignItems: 'center', justifyContent: 'center' },
  confirmTitle:   { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  orderIdBox:     { backgroundColor: '#f0ecff', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', gap: 4 },
  orderIdLabel:   { fontSize: 12, color: '#888' },
  orderIdValue:   { fontSize: 18, fontWeight: '800', color: '#3b12a3', letterSpacing: 2 },
  confirmSubtitle:{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  ctaButton:      { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center' },
  ctaButtonText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaButtonOutline:     { backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, width: '100%', alignItems: 'center', borderWidth: 2, borderColor: '#3b12a3' },
  ctaButtonOutlineText: { color: '#3b12a3', fontSize: 15, fontWeight: '600' },

  authGate:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  authGateTitle:      { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  authGateText:       { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  authGateBtn:        { backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center', marginTop: 8 },
  authGateBtnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  authGateBtnOutline: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, width: '100%', alignItems: 'center', borderWidth: 2, borderColor: '#3b12a3' },
  authGateBtnOutlineText: { color: '#3b12a3', fontSize: 15, fontWeight: '600' },

  footer: { padding: 16, paddingBottom: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  nextBtn: {
    backgroundColor: '#3b12a3', borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
