import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { defaultShareSelection, SHARE_HASHTAG, shareableMessages, shareText } from '../../core/share';
import { useApp, useRoomMessages } from '../../state/AppState';
import { BubbleBody } from '../../ui/MessageBubble';
import { useTheme, VENDOR_COLOR, VENDOR_ICON } from '../../ui/theme';

/** 会話を画像にして、X などに共有する画面。①発言を選ぶ → ②画像を確認して共有 */
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { data } = useApp();
  const room = data.rooms.find((r) => r.id === id);
  const all = useRoomMessages(id);
  const messages = useMemo(() => shareableMessages(all), [all]);
  const [selected, setSelected] = useState<string[]>(() => defaultShareSelection(all));
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [status, setStatus] = useState('');
  const cardRef = useRef<any>(null);

  if (!room) return <Text style={{ padding: 24, color: t.sub }}>会議室が見つかりません</Text>;
  const picked = messages.filter((m) => selected.includes(m.id));
  const members = data.members.filter((m) => room.memberIds.includes(m.id));
  const toggle = (mid: string) => setSelected((s) => (s.includes(mid) ? s.filter((x) => x !== mid) : [...s, mid]));

  const copyText = async () => {
    await Clipboard.setStringAsync(shareText(room, all, selected, data.members));
    setStatus('テキストをコピーしました');
  };

  const shareImage = async () => {
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        await copyText();
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: '会話を共有' });
      setStatus('');
    } catch (e) {
      setStatus(`共有できませんでした: ${(e as Error).message}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: step === 'select' ? '共有する発言を選ぶ' : '共有する画像' }} />
      {step === 'select' ? (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          <Text style={{ color: t.sub, fontSize: 13 }}>タップで選ぶ／外す。最初は最後の投稿とその返事（6件まで）を選んでいます。</Text>
          {messages.map((m) => {
            const on = selected.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggle(m.id)}
                style={[styles.pick, { borderColor: on ? t.accent : 'transparent', opacity: on ? 1 : 0.45 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <BubbleBody msg={m} member={data.members.find((x) => x.id === m.authorId)} t={t} />
              </Pressable>
            );
          })}
          {messages.length === 0 && <Text style={{ color: t.sub }}>まだ共有できる発言がありません</Text>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {/* この枠の中がそのまま画像になる */}
          <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>💬 {room.title}</Text>
            <View style={{ gap: 10 }}>
              {picked.map((m) => (
                <BubbleBody key={m.id} msg={m} member={data.members.find((x) => x.id === m.authorId)} t={t} />
              ))}
            </View>
            <View style={[styles.cardFooter, { borderColor: t.border }]}>
              <Text style={{ color: t.sub, fontSize: 12 }}>
                {members.map((m) => `${VENDOR_ICON[m.vendor]}${m.name}`).join(' ')}
              </Text>
              <Text style={{ color: VENDOR_COLOR.gemini, fontSize: 12, fontWeight: '600' }}>{SHARE_HASHTAG}</Text>
            </View>
          </View>
        </ScrollView>
      )}
      {status ? <Text style={[styles.status, { color: t.sub }]}>{status}</Text> : null}
      <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}>
        {step === 'select' ? (
          <Pressable
            disabled={selected.length === 0}
            onPress={() => setStep('preview')}
            style={[styles.primary, { backgroundColor: t.accent, opacity: selected.length ? 1 : 0.4 }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{selected.length}件で画像を作る</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={() => setStep('select')} style={[styles.secondary, { borderColor: t.border }]} accessibilityRole="button">
              <Text style={{ color: t.text }}>選び直す</Text>
            </Pressable>
            <Pressable onPress={copyText} style={[styles.secondary, { borderColor: t.border }]} accessibilityRole="button">
              <Text style={{ color: t.text }}>文字でコピー</Text>
            </Pressable>
            <Pressable onPress={shareImage} style={[styles.primary, { backgroundColor: t.accent }]} accessibilityRole="button">
              <Text style={styles.primaryText}>共有する</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pick: { borderWidth: 2, borderRadius: 18, padding: 4 },
  card: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  status: { textAlign: 'center', fontSize: 13, paddingVertical: 6 },
  bar: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
