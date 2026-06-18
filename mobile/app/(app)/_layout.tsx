import React, { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import {
  LayoutDashboard, Droplets, CalendarClock, Users, FileText, Wallet, Settings,
} from 'lucide-react-native';
import { useAuth } from '@/lib/stores/auth';
import { useApp } from '@/lib/stores/app';
import { configurePurchases } from '@/lib/services/subscription';

export default function AppLayout() {
  const owner = useAuth((s) => s.owner);
  const refreshAll = useApp((s) => s.refreshAll);

  useEffect(() => {
    if (owner) {
      refreshAll().catch(() => {});
      configurePurchases(owner.id);
    }
  }, [owner?.id]);

  if (!owner) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0891b2',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0', height: 62, paddingBottom: 8, paddingTop: 6 },
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
      {/* Rota acessível por link (Ajustes), fora da barra para não lotar */}
      <Tabs.Screen name="suppliers" options={{ href: null }} />
    </Tabs>
  );
}
