import { StyleSheet, Text, View } from 'react-native';
import type { Member, Message } from '../core/types';
import { VENDOR_COLOR, VENDOR_ICON, type Theme } from './theme';

/** 発言1つ分の吹き出し（会議室と共有画像で共通） */
export function BubbleBody({ msg, member, t }: { msg: Message; member?: Member; t: Theme }) {
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

const styles = StyleSheet.create({
  notice: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
  bubble: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, maxWidth: '100%' },
  userBubble: { alignSelf: 'flex-end', maxWidth: '82%', borderBottomRightRadius: 4 },
  aiRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', maxWidth: '90%' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '600' },
});
