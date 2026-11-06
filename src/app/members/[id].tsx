import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MODEL_PRESETS, presetOf, VENDOR_LABEL } from '../../core/defaultMembers';
import { useApp } from '../../state/AppState';
import { Field } from '../../ui/Field';
import { useTheme } from '../../ui/theme';

export default function MemberEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { data, updateMember } = useApp();
  const member = data.members.find((m) => m.id === id);
  const [draft, setDraft] = useState(member);

  if (!member || !draft) return <Text style={{ padding: 24, color: t.sub }}>メンバーが見つかりません</Text>;

  const set = (k: keyof typeof draft) => (v: string) => setDraft({ ...draft, [k]: v });
  const save = () => {
    updateMember({ ...draft, name: draft.name.trim() || member.name, model: draft.model.trim() || member.model });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Text style={{ color: t.sub }}>中身: {VENDOR_LABEL[member.vendor]}</Text>
      <Field label="名前" value={draft.name} onChangeText={set('name')} hint="会議室では「@名前」で指名できます" />
      <Field label="性格・話し方" value={draft.persona} onChangeText={set('persona')} multiline />
      <Field label="担当" value={draft.role} onChangeText={set('role')} multiline />
      <Field
        label="記憶メモ"
        value={draft.memory}
        onChangeText={set('memory')}
        multiline
        placeholder="既存のチャットで「これまでの会話を要約して」と頼んだ結果を貼り付けると、話を引き継げます"
        hint="長いほど1回あたりの料金が上がります"
      />
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>モデル</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              ['casual', '普段用（安い）'],
              ['serious', '本気用（賢い・高い）'],
            ] as const
          ).map(([kind, label]) => {
            const on = presetOf(draft) === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => setDraft({ ...draft, model: MODEL_PRESETS[draft.vendor][kind] })}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: on ? t.accent : t.border,
                  backgroundColor: t.card,
                  alignItems: 'center',
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={{ color: on ? t.accent : t.text, fontWeight: on ? '700' : '400' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field
        label="モデルID（OpenRouter）"
        value={draft.model}
        onChangeText={set('model')}
        autoCapitalize="none"
        autoCorrect={false}
        hint="openrouter.ai/models で確認できます。上位モデルにすると賢くなりますが料金も上がります"
      />
      <Pressable onPress={save} style={{ backgroundColor: t.accent, padding: 14, borderRadius: 12, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>保存</Text>
      </Pressable>
    </ScrollView>
  );
}
