import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

interface Props { message: string | null }

export function FormError({ message }: Props) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle" size={17} color="#dc2626" />
      <ThemedText style={styles.text}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    color: '#b91c1c', fontSize: 13, fontWeight: '500',
    flex: 1, lineHeight: 19,
  },
});
