import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

const SECTIONS = [
  {
    title: '1. Objet',
    content: `Les présentes conditions générales d'utilisation (CGU) ont pour objet de définir les modalités et conditions d'utilisation de l'application mobile Cyna et des services proposés par la société Cyna.`,
  },
  {
    title: '2. Acceptation des CGU',
    content: `L'utilisation de l'application implique l'acceptation pleine et entière des présentes CGU. Cyna se réserve le droit de modifier à tout moment les présentes CGU.`,
  },
  {
    title: '3. Description des services',
    content: `Cyna propose des services de cybersécurité en mode SaaS (Software as a Service) à destination des professionnels. Les services sont accessibles via l'application mobile ou le site web.`,
  },
  {
    title: '4. Abonnements et paiements',
    content: `Les abonnements sont proposés avec différentes durées (mensuel, annuel, bi-annuel). Le paiement est effectué à la souscription. Aucun remboursement n'est possible sauf mention contraire.`,
  },
  {
    title: '5. Protection des données',
    content: `Cyna s'engage à protéger vos données personnelles conformément au RGPD. Pour toute demande relative à vos données, contactez-nous à dpo@cyna-it.fr.`,
  },
  {
    title: '6. Propriété intellectuelle',
    content: `L'ensemble du contenu de l'application (marques, logos, textes, images) est la propriété exclusive de Cyna et est protégé par le droit de la propriété intellectuelle.`,
  },
];

export default function CguScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Conditions générales</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.lastUpdate}>Dernière mise à jour : Janvier 2025</ThemedText>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{s.title}</ThemedText>
            <ThemedText style={styles.sectionText}>{s.content}</ThemedText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#3b12a3', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  content:     { padding: 20, paddingBottom: 40 },
  lastUpdate:  { fontSize: 12, color: '#aaa', marginBottom: 20 },
  section:     { marginBottom: 22 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  sectionText: { fontSize: 14, color: '#555', lineHeight: 22 },
});
