import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { api } from '@/services/api';

interface Notif {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  date: string;
}

const TYPE_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  info:    { icon: 'information-circle', color: '#3b82f6', bg: '#eff6ff' },
  success: { icon: 'checkmark-circle',   color: '#16a34a', bg: '#f0fdf4' },
  warning: { icon: 'warning',            color: '#d97706', bg: '#fffbeb' },
  error:   { icon: 'alert-circle',       color: '#dc2626', bg: '#fef2f2' },
};

function formatDate(str: string) {
  try {
    return new Date(str).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, unknown>[]>('/api/notifications')
      .then((raw) => {
        const mapped: Notif[] = (raw || []).map((r) => ({
          id:      String(r.id ?? r.id_notification ?? ''),
          title:   (r.titre ?? r.title ?? 'Notification') as string,
          message: (r.message ?? r.contenu ?? '') as string,
          type:    (['info', 'success', 'warning', 'error'].includes(r.type as string)
            ? r.type as 'info' | 'success' | 'warning' | 'error'
            : 'info'),
          read:    Boolean(r.lu ?? r.read ?? false),
          date:    (r.date_creation ?? r.date ?? '') as string,
        }));
        setNotifs(mapped);
      })
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: Notif }) => {
    const meta = TYPE_ICON[item.type] ?? TYPE_ICON.info;
    return (
      <View style={[styles.card, !item.read && styles.cardUnread]}>
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as never} size={22} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>{item.title}</ThemedText>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          {item.message ? (
            <ThemedText style={styles.cardMsg} numberOfLines={2}>{item.message}</ThemedText>
          ) : null}
          {item.date ? (
            <ThemedText style={styles.cardDate}>{formatDate(item.date)}</ThemedText>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
        {unreadCount > 0 && (
          <View style={styles.headerBadge}>
            <ThemedText style={styles.headerBadgeText}>{unreadCount}</ThemedText>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b12a3" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color="#ddd" />
          <ThemedText style={styles.emptyTitle}>Aucune notification</ThemedText>
          <ThemedText style={styles.emptyText}>
            Vous serez notifié des mises à jour importantes de votre compte et de vos abonnements.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f5f6fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#3b12a3', paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:          { padding: 2 },
  headerTitle:      { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  headerBadge: {
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  headerBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '700' },

  list: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: '#3b12a3' },
  iconWrap:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody:   { flex: 1, gap: 3 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b12a3', marginLeft: 6 },
  cardMsg:    { fontSize: 13, color: '#555', lineHeight: 18 },
  cardDate:   { fontSize: 11, color: '#aaa', marginTop: 2 },

  separator:  { height: 0 },

  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  emptyText:  { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
});
