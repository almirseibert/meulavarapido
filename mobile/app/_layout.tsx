import '../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useAuth } from '@/lib/stores/auth';
import { initAds } from '@/lib/services/ads';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Garante que a rota base do app é a index (que redireciona para login/área logada),
// e não a tela modal "premium".
export const unstable_settings = {
  initialRouteName: 'index',
  anchor: 'index',
};

export default function RootLayout() {
  const restore = useAuth((s) => s.restore);
  const ready = useAuth((s) => s.ready);

  const [fontsLoaded] = useFonts({
    PlusJakarta_400Regular: PlusJakartaSans_400Regular,
    PlusJakarta_500Medium: PlusJakartaSans_500Medium,
    PlusJakarta_600SemiBold: PlusJakartaSans_600SemiBold,
    PlusJakarta_700Bold: PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    restore();
    initAds();
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f8fafc' } }}>
          <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
