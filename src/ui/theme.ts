import { useColorScheme } from 'react-native';
import type { Vendor } from '../core/types';

const light = {
  bg: '#F6F4EF',
  card: '#FFFFFF',
  text: '#1D1B18',
  sub: '#6B665E',
  border: '#E3DED4',
  accent: '#3B6FD8',
  userBubble: '#3B6FD8',
  userText: '#FFFFFF',
  warn: '#C77700',
  danger: '#C2362B',
  summaryBg: '#FFF7E0',
};
const dark: typeof light = {
  bg: '#14161B',
  card: '#1E2129',
  text: '#ECEAE6',
  sub: '#9A968F',
  border: '#2C303A',
  accent: '#7EA2F0',
  userBubble: '#3B6FD8',
  userText: '#FFFFFF',
  warn: '#F0B047',
  danger: '#F0776B',
  summaryBg: '#2E2A1D',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** メンバーごとの色（ベンダーで決める） */
export const VENDOR_COLOR: Record<Vendor, string> = {
  chatgpt: '#10A37F',
  claude: '#D97757',
  gemini: '#4F7DF3',
  grok: '#8A8F98',
};

export const VENDOR_ICON: Record<Vendor, string> = {
  chatgpt: '🌿',
  claude: '🍊',
  gemini: '✨',
  grok: '🌑',
};
