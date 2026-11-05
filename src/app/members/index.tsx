import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VENDOR_LABEL } from '../../core/defaultMembers';
import { useApp } from '../../state/AppState';
import { useTheme, VENDOR_COLOR, VENDOR_ICON } from '../../ui/theme';

export default function MembersScreen() {
  const t = useTheme();
  const { data, resetMembers } = useApp();

  const confirmReset = () => {
    const msg = 'キャラ設定を初期値に戻します。記憶メモも消えます。';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(msg)) resetMembers();
      return;
    }
    Alert.alert('初期値に戻す', msg, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '戻す', style: 'destructive', onPress: resetMembers },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      {data.members.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => router.push({ pathname: '/members/[id]', params: { id: m.id } })}
          style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <View style={[styles.avatar, { backgroundColor: VENDOR_COLOR[m.vendor] }]}>
            <Text style={{ fontSize: 20 }}>{VENDOR_ICON[m.vendor]}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: t.text }]}>
              {m.name} <Text style={{ color: t.sub, fontWeight: '400', fontSize: 13 }}>{VENDOR_LABEL[m.vendor]}</Text>
            </Text>
            <Text style={{ color: t.sub, fontSize: 13 }} numberOfLines={2}>
              {m.role}
            </Text>
          </View>
        </Pressable>
      ))}
      <Pressable onPress={confirmReset} style={styles.reset}>
        <Text style={{ color: t.danger }}>キャラ設定を初期値に戻す</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  reset: { alignItems: 'center', padding: 16 },
});
