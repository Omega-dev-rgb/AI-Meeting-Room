import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from './theme';

/** ラベル付きの入力欄 */
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.sub}
        {...props}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }, props.multiline && styles.multi, props.style]}
      />
      {hint ? <Text style={[styles.hint, { color: t.sub }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, lineHeight: 17 },
});
