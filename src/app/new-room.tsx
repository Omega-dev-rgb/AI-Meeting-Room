import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useApp } from '../state/AppState';
import { Field } from '../ui/Field';
import { useTheme, VENDOR_COLOR, VENDOR_ICON } from '../ui/theme';

export default function NewRoomScreen() {
  const t = useTheme();
  const { data, createRoom } = useApp();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>(data.members.map((m) => m.id));
  const canCreate = title.trim().length > 0 && picked.length > 0;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Field label="トピック" value={title} onChangeText={setTitle} placeholder="例：レシピカード v1.1 の仕様" autoFocus />
      <View style={{ gap: 8 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>参加メンバー</Text>
        {data.members.map((m) => {
          const on = picked.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => toggle(m.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: on ? VENDOR_COLOR[m.vendor] : t.border,
                backgroundColor: t.card,
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text>{on ? '☑︎' : '☐'}</Text>
              <Text>{VENDOR_ICON[m.vendor]}</Text>
              <Text style={{ color: t.text }}>{m.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        disabled={!canCreate}
        onPress={() => {
          const id = createRoom(title.trim(), picked);
          router.replace({ pathname: '/room/[id]', params: { id } });
        }}
        style={{ backgroundColor: t.accent, opacity: canCreate ? 1 : 0.4, padding: 14, borderRadius: 12, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>作成</Text>
      </Pressable>
    </ScrollView>
  );
}
