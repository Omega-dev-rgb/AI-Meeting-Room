import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '../state/AppState';
import { useTheme } from '../ui/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.card },
            headerTintColor: t.text,
            contentStyle: { backgroundColor: t.bg },
            headerBackTitle: '戻る',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'AI会議室' }} />
          <Stack.Screen name="room/[id]" options={{ title: '' }} />
          <Stack.Screen name="members/index" options={{ title: 'メンバー' }} />
          <Stack.Screen name="members/[id]" options={{ title: 'メンバー編集' }} />
          <Stack.Screen name="settings" options={{ title: '設定' }} />
          <Stack.Screen name="new-room" options={{ title: '会議室を作る', presentation: 'modal' }} />
        </Stack>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
