import { Stack, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { authorName } from '../core/prompt';
import { useApp } from '../state/AppState';
import { BudgetBadge } from '../ui/BudgetBadge';
import { useTheme, VENDOR_COLOR, VENDOR_ICON } from '../ui/theme';

export default function RoomsScreen() {
  const t = useTheme();
  const { data, ready } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ headerRight: () => <BudgetBadge /> }} />
      <FlatList
        data={ready ? data.rooms : []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.sub }]}>{ready ? '会議室がまだありません' : '読み込み中…'}</Text>
        }
        renderItem={({ item }) => {
          const msgs = data.messages.filter((m) => m.roomId === item.id && m.kind !== 'notice');
          const last = msgs.at(-1);
          const members = data.members.filter((m) => item.memberIds.includes(m.id));
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/room/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
            >
              <View style={styles.row}>
                <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.avatars}>
                  {members.map((m) => (
                    <View key={m.id} style={[styles.dot, { backgroundColor: VENDOR_COLOR[m.vendor] }]}>
                      <Text style={styles.dotText}>{VENDOR_ICON[m.vendor]}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={[styles.preview, { color: t.sub }]} numberOfLines={2}>
                {item.latestSummary
                  ? `📝 ${item.latestSummary.replace(/\n/g, ' ')}`
                  : last
                    ? `${authorName(last.authorId, data.members)}: ${last.text}`
                    : '話題を投げてみましょう'}
              </Text>
            </Pressable>
          );
        }}
      />
      <View style={[styles.footer, { borderColor: t.border, backgroundColor: t.card }]}>
        <Pressable onPress={() => router.push('/members')} style={styles.footBtn} accessibilityRole="button">
          <Text style={[styles.footText, { color: t.text }]}>👥 メンバー</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/new-room')}
          style={[styles.primary, { backgroundColor: t.accent }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>＋ 会議室</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} style={styles.footBtn} accessibilityRole="button">
          <Text style={[styles.footText, { color: t.text }]}>⚙️ 設定</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 40 },
  card: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  avatars: { flexDirection: 'row', gap: 4 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 11 },
  preview: { fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footBtn: { padding: 10 },
  footText: { fontSize: 15 },
  primary: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
