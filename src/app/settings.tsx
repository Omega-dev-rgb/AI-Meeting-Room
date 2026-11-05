import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatJpy } from '../core/budget';
import type { ProviderMode } from '../core/types';
import { useApp } from '../state/AppState';
import { Field } from '../ui/Field';
import { useTheme } from '../ui/theme';

const num = (s: string, fallback: number) => {
  const v = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export default function SettingsScreen() {
  const t = useTheme();
  const { data, apiKey, setApiKey, updateSettings, spentThisMonth } = useApp();
  const s = data.settings;
  const [key, setKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  useEffect(() => setKey(apiKey), [apiKey]);

  const mode = (m: ProviderMode, label: string, desc: string) => (
    <Pressable
      onPress={() => updateSettings({ providerMode: m })}
      style={[styles.mode, { borderColor: s.providerMode === m ? t.accent : t.border, backgroundColor: t.card }]}
      accessibilityRole="radio"
      accessibilityState={{ selected: s.providerMode === m }}
    >
      <Text style={{ color: t.text, fontWeight: '600' }}>
        {s.providerMode === m ? '● ' : '○ '}
        {label}
      </Text>
      <Text style={{ color: t.sub, fontSize: 12 }}>{desc}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 8 }}>
        <Text style={[styles.h, { color: t.text }]}>AIの接続</Text>
        {mode('mock', 'モック（無料）', 'APIキーなしで画面の動きを試せます。返事は決まった文です')}
        {mode('openrouter', 'OpenRouter（本物のAI）', '1つのキーで Claude・ChatGPT・Gemini・Grok を呼びます。使った分だけ課金されます')}
      </View>

      <Field
        label="OpenRouter APIキー"
        value={key}
        onChangeText={(v) => {
          setKey(v);
          setSaved(false);
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="sk-or-..."
        hint="iPhoneのKeychain（金庫）にだけ保存され、外には送られません（AIの呼び出し時を除く）"
      />
      <Pressable
        onPress={async () => {
          await setApiKey(key.trim());
          setSaved(true);
        }}
        style={[styles.btn, { backgroundColor: t.accent }]}
      >
        <Text style={styles.btnText}>{saved ? '保存しました' : 'キーを保存'}</Text>
      </Pressable>

      <View style={{ gap: 4 }}>
        <Text style={[styles.h, { color: t.text }]}>料金</Text>
        <Text style={{ color: t.sub }}>
          今月の利用額: {formatJpy(spentThisMonth)}（予算の{Math.round(s.warnRatio * 100)}%で警告、100%で自動停止）
        </Text>
      </View>
      <Field
        label="月の予算（円）"
        defaultValue={String(s.monthlyBudgetJpy)}
        keyboardType="number-pad"
        onEndEditing={(e) => updateSettings({ monthlyBudgetJpy: num(e.nativeEvent.text, s.monthlyBudgetJpy) })}
      />
      <Field
        label="為替レート（円/ドル）"
        defaultValue={String(s.usdJpy)}
        keyboardType="decimal-pad"
        onEndEditing={(e) => updateSettings({ usdJpy: num(e.nativeEvent.text, s.usdJpy) })}
      />
      <Field
        label="1回の投稿で全員が話す周回数（1〜5）"
        defaultValue={String(s.maxRounds)}
        keyboardType="number-pad"
        onEndEditing={(e) => updateSettings({ maxRounds: Math.min(5, Math.round(num(e.nativeEvent.text, s.maxRounds))) })}
        hint="2周×4人＝8発言。増やすほど料金が上がります"
      />
      <Field
        label="AIに渡す直近の発言数"
        defaultValue={String(s.historyLimit)}
        keyboardType="number-pad"
        onEndEditing={(e) => updateSettings({ historyLimit: Math.round(num(e.nativeEvent.text, s.historyLimit)) })}
        hint="古い話は「今どうなってる？」の要約で引き継がれます"
      />
      <Field
        label="わたしについて（全員に共有）"
        defaultValue={s.userProfile}
        multiline
        onEndEditing={(e) => updateSettings({ userProfile: e.nativeEvent.text })}
        placeholder="例：育休中に個人開発をしている。プログラミングは初心者"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: '700' },
  mode: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
  btn: { padding: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
