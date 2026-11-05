import { Alert, Platform } from 'react-native';

/** 取り消せない操作の前の確認ダイアログ（Web版は標準の confirm を使う） */
export function confirmDestructive(title: string, message: string, actionLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'キャンセル', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
