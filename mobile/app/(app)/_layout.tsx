import React, { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard, Droplets, CalendarClock, Users, FileText, Wallet, Settings,
} from 'lucide-react-native';
import { useAuth } from '@/lib/stores/auth';
import { useApp } from '@/lib/stores/app';
import { configurePurchases, syncSubscription } from '@/lib/services/subscription';
import { registerPushDevice } from '@/lib/services/notify';
import { setAnalyticsUser, logTrialStartOnce } from '@/lib/services/analytics';

export default function AppLayout() {
  const owner = useAuth((s) => s.owner);
  const refresh = useAuth((s) => s.refresh);
  const refreshAll = useApp((s) => s.refreshAll);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!owner) return;
    refresh().catch(() => {});   // atualiza estado de trial/assinatura
    refreshAll().catch(() => {});
    configurePurchases(owner.id);
    // Registra o aparelho para receber novidades/promoções (falha em silêncio).
    registerPushDevice();

    // Mensuração: identifica a conta no GA4 e reporta o início do teste grátis
    // (uma vez só por conta). Falha em silêncio.
    setAnalyticsUser(owner);
    logTrialStartOnce(owner);

    // Rede de segurança da assinatura: se o webhook do RevenueCat falhou ou
    // atrasou, confere a compra na abertura e libera o premium. Só vale a pena
    // para quem ainda não está premium; falha em silêncio.
    if (!owner.isPremium) {
      syncSubscription()
        .then((r) => { if (r?.changed) { refresh().catch(() => {}); } })
        .catch(() => {});
    }
  }, [owner?.id]);

  if (!owner) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0891b2',
        tabBarInactiveTintColor: '#94a3b8',
        // Soma o inset inferior (edge-to-edge no SDK 56) p/ não ficar sob os botões do Android.
        tabBarStyle: {
          borderTopColor: '#e2e8f0',
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontFamily: 'PlusJakarta_500Medium' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen name="washes" options={{ title: 'Lavagens', tabBarIcon: ({ color, size }) => <Droplets color={color} size={size} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Agenda', tabBarIcon: ({ color, size }) => <CalendarClock color={color} size={size} /> }} />
      <Tabs.Screen name="clients" options={{ title: 'Clientes', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="documents" options={{ title: 'Docs', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
      <Tabs.Screen name="expenses" options={{ title: 'Despesas', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
      {/* Rotas acessíveis por link (Ajustes/Atalhos), fora da barra para não lotar */}
      <Tabs.Screen name="suppliers" options={{ href: null }} />
      <Tabs.Screen name="helpers" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="callback" options={{ href: null }} />
      <Tabs.Screen name="pickup" options={{ href: null }} />
      <Tabs.Screen name="broadcast" options={{ href: null }} />
    </Tabs>
  );
}
