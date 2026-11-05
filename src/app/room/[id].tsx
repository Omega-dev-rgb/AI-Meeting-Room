import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Member, Message } from '../../core/types';
import { useApp, useRoomMessages } from '../../state/AppState';
import { BudgetBadge } from '../../ui/BudgetBadge';
import { useTheme, VENDOR_COLOR, VENDOR_ICON, type Theme } from '../../ui/theme';

function Bubble({ msg, member, t }: { msg: Message; member?: Member; t: Theme }) {
  if (msg.kind === 'notice') {
    return <Text style={[styles.notice, { color: t.sub }]}>{msg.text}</Text>;
  }
  if (msg.authorId === 'user') {
    return (
      <View style={[styles.bubble, styles.userBubble, { backgroundColor: t.userBubble }]}>
        <Text style={{ color: t.userText, fontSize: 15, lineHeight: 21 }}>{msg.text}</Text>
      </View>
    );
  }
  const color = member ? VENDOR_COLOR[member.vendor] : t.sub;
  const isSummary = msg.kind === 'summary';
  return (
    <View style={styles.aiRow}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text>{member ? VENDOR_ICON[member.vendor] : '?'}</Text>
      </View>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text style={[styles.name, { color }]}>
          {member?.name ?? '退出したメンバー'}
          {isSummary ? '（要約）' : ''}
        </Text>
        <View
          style={[
            styles.bubble,
            { backgroundColor: isSummary ? t.summaryBg : t.card, borderColor: isSummary ? t.warn : t.border, borderWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>{msg.text}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data, send, askStatus, stop, busyRoomId, budget } = useApp();
  const room = data.rooms.find((r) => r.id === id);
  const messages = useRoomMessages(id);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const busy = busyRoomId === id;
  const members = data.members.filter((m) => room?.memberIds.includes(m.id));

  useEffect(() => {
    const h = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(h);
  }, [messages.length]);

  if (!room) return <Text style={{ padding: 24, color: t.sub }}>会議室が見つかりません</Text>;

  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    setText('');
    send(room.id, v);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: room.title, headerRight: () => <BudgetBadge /> }} />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        ListEmptyComponent={
          <Text style={[styles.notice, { color: t.sub, marginTop: 32 }]}>
            話題を投げると、メンバーが順番に話します。{'\n'}「@名前」で1人だけ指名もできます。
          </Text>
        }
        renderItem={({ item }) => <Bubble msg={item} member={data.members.find((m) => m.id === item.authorId)} t={t} />}
      />
      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.sub }}>考え中…</Text>
          <Pressable onPress={stop} accessibilityRole="button">
            <Text style={{ color: t.danger, fontWeight: '600' }}>止める</Text>
          </Pressable>
        </View>
      )}
      <View style={[styles.mentions, { borderColor: t.border }]}>
        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setText((s) => `@${m.name} ${s}`)}
            style={[styles.chip, { borderColor: VENDOR_COLOR[m.vendor] }]}
          >
            <Text style={{ color: VENDOR_COLOR[m.vendor], fontSize: 13 }}>@{m.name}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => askStatus(room.id)}
          disabled={busy || messages.length === 0}
          style={[styles.chip, { borderColor: t.warn, opacity: busy || messages.length === 0 ? 0.4 : 1 }]}
        >
          <Text style={{ color: t.warn, fontSize: 13 }}>📝 今どうなってる？</Text>
        </Pressable>
      </View>
      <View style={[styles.inputRow, { backgroundColor: t.card, borderColor: t.border, paddingBottom: 8 + insets.bottom }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={budget === 'stop' ? '今月の予算に達しました' : '話題を投げる…'}
          placeholderTextColor={t.sub}
          style={[styles.input, { color: t.text, borderColor: t.border }]}
          multiline
        />
        <Pressable
          onPress={submit}
          disabled={busy || !text.trim()}
          style={[styles.send, { backgroundColor: t.accent, opacity: busy || !text.trim() ? 0.4 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="送信"
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>送信</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  notice: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
  bubble: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, maxWidth: '100%' },
  userBubble: { alignSelf: 'flex-end', maxWidth: '82%', borderBottomRightRadius: 4 },
  aiRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', maxWidth: '90%' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '600' },
  busyRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  mentions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15 },
  send: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
