import type { Message, Settings } from './types';

export type BudgetStatus = 'ok' | 'warn' | 'stop';

/** 'YYYY-MM'（ローカル時刻ではなくISO文字列の先頭で判定し、テストで結果がぶれないようにする） */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** 指定月のAPI利用額（円） */
export function spentJpy(messages: Message[], month: string, usdJpy: number): number {
  let usd = 0;
  for (const m of messages) {
    if (m.usage && monthKey(m.createdAt) === month) usd += m.usage.costUsd;
  }
  return usd * usdJpy;
}

export function budgetStatus(spent: number, settings: Settings): BudgetStatus {
  if (spent >= settings.monthlyBudgetJpy) return 'stop';
  if (spent >= settings.monthlyBudgetJpy * settings.warnRatio) return 'warn';
  return 'ok';
}

/** 1円未満も見えるように表示する */
export function formatJpy(v: number): string {
  if (v < 10) return `${v.toFixed(2)}円`;
  return `${Math.round(v).toLocaleString('ja-JP')}円`;
}
