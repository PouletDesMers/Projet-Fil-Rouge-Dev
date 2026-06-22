import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

interface Message {
  id: string;
  text: string;
  from: 'user' | 'bot';
  ts: number;
}

const FAQ: { keywords: string[]; response: string }[] = [
  {
    keywords: ['bonjour', 'salut', 'hello', 'bonsoir', 'hi'],
    response: "Bonjour ! Je suis l'assistant CYNA. Je peux vous aider sur nos produits, tarifs, commandes ou votre compte. Que souhaitez-vous savoir ?",
  },
  {
    keywords: ['prix', 'tarif', 'coût', 'combien', 'cher', 'abonnement', 'offre'],
    response: 'Nos tarifs débutent à 8,99 €/mois (EDR Basic). Certains services entreprise sont disponibles sur devis. Consultez le Catalogue pour comparer toutes nos offres.',
  },
  {
    keywords: ['soc', 'surveillance', 'monitoring', 'supervision', 'analyste', '24/7', '24h'],
    response: 'Notre SOC assure une surveillance 24/7 avec des analystes dédiés. Les incidents P1/P2 sont traités en moins de 4h avec reporting mensuel inclus.',
  },
  {
    keywords: ['edr', 'endpoint', 'terminal', 'poste', 'malware', 'virus', 'antivirus'],
    response: "L'EDR CYNA détecte et bloque les menaces sur vos endpoints en temps réel. Il inclut remédiation automatique, threat hunting et intégration SIEM.",
  },
  {
    keywords: ['xdr', 'réseau', 'cloud', 'étendu', 'siem', 'soar', 'corrél'],
    response: 'Notre XDR unifie la détection sur endpoints, réseau et cloud. Il corrèle les événements multi-sources pour une visibilité complète et une réponse orchestrée.',
  },
  {
    keywords: ['devis', 'enterprise', 'entreprise', 'sur mesure', 'personnali', 'négoci'],
    response: "Pour une offre Enterprise sur mesure, appuyez sur « Demander un devis » depuis la fiche produit ou contactez-nous via Support. Notre équipe répond sous 24h.",
  },
  {
    keywords: ['commande', 'achat', 'historique', 'suivi', 'commandes'],
    response: 'Vos commandes sont accessibles dans Mon compte → Commandes. Vous y trouverez le statut, le total et les détails de chaque commande passée.',
  },
  {
    keywords: ['facture', 'invoice', 'reçu', 'justificatif'],
    response: 'Vos factures sont disponibles dans Mon compte → Factures. Elles sont générées automatiquement après chaque paiement réussi.',
  },
  {
    keywords: ['paiement', 'carte', 'stripe', 'virement', 'cb', 'visa', 'mastercard'],
    response: 'Nous acceptons les paiements par carte bancaire (Visa, Mastercard, Amex) via Stripe, chiffré et sécurisé. Vos données ne sont jamais stockées chez nous.',
  },
  {
    keywords: ['mot de passe', 'oubli', 'reiniti', 'connexion', 'login', 'identifiant'],
    response: "Pour réinitialiser votre mot de passe, utilisez « Mot de passe oublié ? » sur l'écran de connexion. Pour créer un compte, appuyez sur « S'inscrire ».",
  },
  {
    keywords: ['2fa', 'double', 'authentification', 'totp', 'authenticator', 'authy'],
    response: 'La double authentification 2FA est activable dans Mon compte → Sécurité. Elle protège votre compte avec un code TOTP (Google Authenticator, Authy…).',
  },
  {
    keywords: ['contact', 'support', 'aide', 'problème', 'ticket', 'incident', 'signale'],
    response: 'Rendez-vous dans l\'onglet Support pour nous envoyer un message. Notre équipe répond généralement sous 24h ouvrées.',
  },
  {
    keywords: ['démo', 'demo', 'essai', 'gratuit', 'test', 'présentation', 'commercial'],
    response: 'Vous souhaitez une démonstration ? Contactez-nous via le formulaire Support en mentionnant votre intérêt. Notre équipe commerciale vous planifiera une démo.',
  },
  {
    keywords: ['résili', 'annul', 'arrêt', 'stopper', 'résilier'],
    response: 'Pour résilier un abonnement, rendez-vous dans Mon compte → Abonnements. Vous pouvez gérer vos abonnements actifs à tout moment.',
  },
  {
    keywords: ['livraison', 'délai', 'activation', 'quand', 'combien de temps'],
    response: "Nos services SaaS sont activés immédiatement après confirmation du paiement. Vous recevrez un email de confirmation avec les détails d'accès.",
  },
];

const QUICK_REPLIES = [
  'Nos tarifs ?',
  'C\'est quoi l\'EDR ?',
  'Suivre ma commande',
  'Contacter le support',
];

function getBotResponse(text: string): string {
  const lower = text.toLowerCase();
  for (const entry of FAQ) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.response;
    }
  }
  return "Je ne suis pas certain de comprendre. Pouvez-vous reformuler ? Vous pouvez aussi contacter notre équipe via le formulaire de support pour une aide personnalisée.";
}

let msgCounter = 0;
const mkId = () => `msg_${++msgCounter}_${Date.now()}`;

const WELCOME: Message = {
  id: mkId(),
  text: "Bonjour 👋 Je suis l'assistant CYNA. Posez-moi vos questions sur nos produits, tarifs, commandes ou votre compte !",
  from: 'bot',
  ts: Date.now(),
};

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setInput('');

    const userMsg: Message = { id: mkId(), text: trimmed, from: 'user', ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const botMsg: Message = { id: mkId(), text: getBotResponse(trimmed), from: 'bot', ts: Date.now() };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600 + Math.random() * 400);
  };

  const renderMsg = ({ item }: { item: Message }) => {
    const isUser = item.from === 'user';
    return (
      <View style={[styles.row, isUser && styles.rowUser]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <ThemedText style={styles.botAvatarText}>C</ThemedText>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <ThemedText style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.text}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <ThemedText style={styles.headerAvatarText}>C</ThemedText>
          </View>
          <View>
            <ThemedText style={styles.headerName}>Assistant CYNA</ThemedText>
            <ThemedText style={styles.headerStatus}>
              {isTyping ? 'en train d\'écrire…' : 'En ligne'}
            </ThemedText>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMsg}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.row}>
                <View style={styles.botAvatar}>
                  <ThemedText style={styles.botAvatarText}>C</ThemedText>
                </View>
                <View style={styles.typingBubble}>
                  <ThemedText style={styles.typingDots}>● ● ●</ThemedText>
                </View>
              </View>
            ) : null
          }
        />

        {/* Réponses rapides */}
        {messages.length <= 2 && !isTyping && (
          <View style={styles.quickRow}>
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity key={q} style={styles.quickChip} onPress={() => send(q)} activeOpacity={0.8}>
                <ThemedText style={styles.quickChipText}>{q}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Posez votre question…"
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || isTyping}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#3b12a3', paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { padding: 2 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerName:       { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerStatus:     { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },

  messageList: { padding: 16, gap: 12, paddingBottom: 8 },

  row:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser: { flexDirection: 'row-reverse' },

  botAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#3b12a3', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  botAvatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: '#3b12a3', borderBottomRightRadius: 4,
  },
  bubbleText:     { color: '#1a1a1a', fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },

  typingBubble: {
    backgroundColor: '#fff', borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  typingDots: { color: '#3b12a3', fontSize: 10, letterSpacing: 3 },

  quickRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  quickChip: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#3b12a3',
  },
  quickChipText: { color: '#3b12a3', fontSize: 13, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e8e8e8',
  },
  input: {
    flex: 1, backgroundColor: '#f5f6fa', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#1a1a1a', maxHeight: 100,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#3b12a3', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#c4b5e8' },
});
