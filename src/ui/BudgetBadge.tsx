import { StyleSheet, Text, View } from 'react-native';
import { formatJpy } from '../core/budget';
import { useApp } from '../state/AppState';
import { useTheme } from './theme';

/** 今月の利用料メーター */
export function BudgetBadge() {
  const t = useTheme();
  const { spentThisMonth, budget, data } = useApp();
  const color = budget === 'stop' ? t.danger : budget === 'warn' ? t.warn : t.sub;
  const ratio = Math.min(1, spentThisMonth / Math.max(1, data.settings.monthlyBudgetJpy));
  return (
    <View style={styles.wrap} accessibilityLabel={`今月の利用料 ${formatJpy(spentThisMonth)}`}>
      <Text style={[styles.text, { color }]}>
        {data.settings.providerMode === 'mock' ? 'モック ' : ''}
        {formatJpy(spentThisMonth)} / {formatJpy(data.settings.monthlyBudgetJpy)}
      </Text>
      <View style={[styles.bar, { backgroundColor: t.border }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 2 },
  text: { fontSize: 11, fontVariant: ['tabular-nums'] },
  bar: { width: 80, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3 },
});
