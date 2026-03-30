import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>À propos de Cyna</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoBox}>
          <ThemedText style={styles.logo}>CYNA</ThemedText>
          <ThemedText style={styles.tagline}>Cybersécurité as a Service</ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Notre mission</ThemedText>
          <ThemedText style={styles.text}>
            Cyna est une entreprise spécialisée dans les solutions de cybersécurité pour les PME et ETI.
            Notre mission est de rendre la cybersécurité accessible, efficace et abordable pour toutes les organisations.
          </ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Nos services</ThemedText>
          {[
            { icon: 'shield-checkmark-outline', label: 'SOC as a Service' },
            { icon: 'scan-outline',             label: 'EDR managé' },
            { icon: 'server-outline',           label: 'SIEM cloud' },
            { icon: 'bug-outline',              label: 'Pentest & Audit' },
            { icon: 'people-outline',           label: 'Formation & Sensibilisation' },
          ].map(({ icon, label }) => (
            <View key={label} style={styles.serviceItem}>
              <Ionicons name={icon as never} size={20} color="#3b12a3" />
              <ThemedText style={styles.serviceLabel}>{label}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
          <ThemedText style={styles.text}>support@cyna-it.fr</ThemedText>
          <ThemedText style={styles.text}>www.cyna-it.fr</ThemedText>
        </View>

        <ThemedText style={styles.version}>Version 1.0.0</ThemedText>
      </ScrollView>
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

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  logoBox:  { alignItems: 'center', paddingVertical: 24 },
  logo:     { fontSize: 42, fontWeight: '900', color: '#3b12a3', letterSpacing: 6 },
  tagline:  { fontSize: 14, color: '#666', marginTop: 6 },

  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  text:         { fontSize: 14, color: '#555', lineHeight: 22 },

  serviceItem:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceLabel: { fontSize: 14, color: '#333' },

  version: { textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 8 },
});
