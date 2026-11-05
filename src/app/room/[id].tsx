import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
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
import { confirmDestructive } from '../../ui/confirm';
import { useTheme, VENDOR_COLOR, VENDOR_ICON, type Theme } from '../../ui/theme';

function Bubble({ msg, member, t, onCopy }: { msg: Message; member?: Member; t: Theme; onCopy: (m: Message) => void }) {
  return (
    <Pressable onLongPress={() => onCopy(msg)} delayLongPress={350} accessibilityHint="長押しでコピー">
      <BubbleBody msg={msg} member={member} t={t} />
    </Pressable>
  );
}

function BubbleBody({ msg, member, t }: { msg: Message; member?: Member; t: Theme }) {
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
  const { data, send, askStatus, stop, busyRoomId, budget, renameRoom, deleteRoom } = useApp();
  const room = data.rooms.find((r) => r.id === id);
  const messages = useRoomMessages(id);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [toast, setToast] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const busy = busyRoomId === id;
  const members = data.members.filter((m) => room?.memberIds.includes(m.id));

  useEffect(() => {
    const h = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(h);
  }, [messages.length]);

  if (!room) return <Text style={{ padding: 24, color: t.sub }}>会議室が見つかりません</Text>;

  const copy = async (m: Message) => {
    await Clipboard.setStringAsync(m.text);
    setToast('コピーしました');
    setTimeout(() => setToast(''), 1500);
  };

  const startEdit = () => {
    setTitleDraft(room.title);
    setEditing((v) => !v);
  };

  const saveTitle = () => {
    const v = titleDraft.trim();
    if (v) renameRoom(room.id, v);
    setEditing(false);
  };

  const remove = () =>
    confirmDestructive('会議室を削除', `「${room.title}」と、その会話をすべて削除します。元に戻せません。`, '削除', () => {
      stop();
      deleteRoom(room.id);
      router.back();
    });

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
      <Stack.Screen
        options={{
          title: room.title,
          headerRight: () => (
            <View style={styles.headerRight}>
              <BudgetBadge />
              <Pressable onPress={startEdit} accessibilityRole="button" accessibilityLabel="会議室の編集" hitSlop={8}>
                <Text style={{ color: t.accent, fontSize: 15 }}>{editing ? '閉じる' : '編集'}</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {editing && (
        <View style={[styles.editPanel, { backgroundColor: t.card, borderColor: t.border }]}>
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onSubmitEditing={saveTitle}
            style={[styles.titleInput, { color: t.text, borderColor: t.border }]}
            accessibilityLabel="会議室の名前"
          />
          <View style={styles.editRow}>
            <Pressable onPress={remove} accessibilityRole="button">
              <Text style={{ color: t.danger }}>この会議室を削除</Text>
            </Pressable>
            <Pressable onPress={saveTitle} style={[styles.saveBtn, { backgroundColor: t.accent }]} accessibilityRole="button">
              <Text style={{ color: '#fff', fontWeight: '600' }}>名前を保存</Text>
            </Pressable>
          </View>
        </View>
      )}
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
        renderItem={({ item }) => (
          <Bubble msg={item} member={data.members.find((m) => m.id === item.authorId)} t={t} onCopy={copy} />
        )}
      />
      {toast ? <Text style={[styles.toast, { backgroundColor: t.text, color: t.bg }]}>{toast}</Text> : null}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editPanel: { margin: 12, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  titleInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  toast: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', fontSize: 13, marginBottom: 6 },
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
