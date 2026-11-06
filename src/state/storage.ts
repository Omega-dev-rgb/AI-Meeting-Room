import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Member, Message, Room, Settings } from '../core/types';

/** 会話・設定は AsyncStorage（端末内の保存領域）に JSON で保存する */
export type PersistedData = {
  version: 1;
  members: Member[];
  rooms: Room[];
  messages: Message[];
  settings: Settings;
  /** 朝会サーバーから最後に受け取った発言の時刻 */
  morningSince?: string;
};

const DATA_KEY = 'ai-meeting-room/data';
const API_KEY = 'openrouter_api_key';
const MEETING_TOKEN = 'meeting_token';

export async function loadData(): Promise<PersistedData | null> {
  const raw = await AsyncStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedData;
  } catch {
    return null;
  }
}

export async function saveData(data: PersistedData): Promise<void> {
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
}

/**
 * APIキーは iPhone の Keychain（金庫）に保存する。
 * Web版（動作確認用）には Keychain がないため、ブラウザ内にだけ保存する。
 */
export async function loadApiKey(): Promise<string> {
  if (Platform.OS === 'web') return (await AsyncStorage.getItem(API_KEY)) ?? '';
  return (await SecureStore.getItemAsync(API_KEY)) ?? '';
}

export async function saveApiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (key) await AsyncStorage.setItem(API_KEY, key);
    else await AsyncStorage.removeItem(API_KEY);
    return;
  }
  if (key) await SecureStore.setItemAsync(API_KEY, key);
  else await SecureStore.deleteItemAsync(API_KEY);
}

/** 朝会サーバーの合言葉も Keychain に保存する */
export async function loadMeetingToken(): Promise<string> {
  if (Platform.OS === 'web') return (await AsyncStorage.getItem(MEETING_TOKEN)) ?? '';
  return (await SecureStore.getItemAsync(MEETING_TOKEN)) ?? '';
}

export async function saveMeetingToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (token) await AsyncStorage.setItem(MEETING_TOKEN, token);
    else await AsyncStorage.removeItem(MEETING_TOKEN);
    return;
  }
  if (token) await SecureStore.setItemAsync(MEETING_TOKEN, token);
  else await SecureStore.deleteItemAsync(MEETING_TOKEN);
}
