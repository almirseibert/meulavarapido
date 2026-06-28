import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Crown, TrendingUp, Droplets, Wallet, CalendarClock, BarChart3, PhoneCall, HardHat, Truck } from 'lucide-react-native';
import { LogoMark } from '@/components/Logo';
import { Card } from '@/components/ui';
import { AccessBanner } from '@/components/AccessBanner';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/stores/auth';
import { formatCurrency, formatDateTime, monthLabel, currentMonth } from '@/lib/utils';

interface Dashboard {
  month: string;
  clients: number;
  washesMonth: number;
  revenueMonth: number;
  washesToday: number;
  revenueToday: number;
  receivable: number;
  expensesMonth: number;
  upcoming: { id: string; client_name?: string; vehicle_info?: string; date: string }[];
}

function Kpi({ icon, label, value, tone = 'brand' }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <Card className="flex-1">
      <View className="flex-row items-center mb-2">{icon}</View>
      <Text className="text-2xl font-bold text-ink">{value}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const owner = useAuth((s) => s.owner);
  const [data, setData] = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await unwrap<Dashboard>(api.get(`/dashboard?month=${currentMonth()}`));
      setData(d);
    } catch {
      /* silencioso */
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <LogoMark size={40} />
            <View className="ml-2">
              <Text className="text-ink font-bold text-lg">Olá, {owner?.name?.split(' ')[0]}</Text>
              <Text className="text-muted text-xs">{data ? monthLabel(data.month) : ' '}</Text>
            </View>
          </View>
          {!owner?.isPremium && (
            <Pressable onPress={() => router.push('/premium')} className="flex-row items-center bg-amber-100 px-3 py-2 rounded-full">
              <Crown color="#b45309" size={16} />
              <Text className="text-amber-700 font-semibold text-xs ml-1">Premium</Text>
            </Pressable>
          )}
        </View>

        <AccessBanner />

        <View className="flex-row gap-3 mb-3">
          <Kpi icon={<Droplets color="#0891b2" size={20} />} label="Lavagens no mês" value={String(data?.washesMonth ?? 0)} />
          <Kpi icon={<TrendingUp color="#16a34a" size={20} />} label="Receita do mês" value={formatCurrency(data?.revenueMonth ?? 0)} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <Kpi icon={<Droplets color="#0891b2" size={20} />} label="Lavagens hoje" value={String(data?.washesToday ?? 0)} />
          <Kpi icon={<Wallet color="#dc2626" size={20} />} label="A receber" value={formatCurrency(data?.receivable ?? 0)} />
        </View>
        <View className="flex-row gap-3 mb-5">
          <Kpi icon={<Wallet color="#ea580c" size={20} />} label="Despesas pagas (mês)" value={formatCurrency(data?.expensesMonth ?? 0)} />
          <Kpi icon={<TrendingUp color="#16a34a" size={20} />} label="Receita hoje" value={formatCurrency(data?.revenueToday ?? 0)} />
        </View>

        <Text className="text-muted font-semibold mb-2">Atalhos</Text>
        <View className="flex-row flex-wrap gap-3 mb-5">
          {[
            { icon: <BarChart3 color="#0891b2" size={22} />, label: 'Relatórios', href: '/(app)/reports' },
            { icon: <PhoneCall color="#0891b2" size={22} />, label: 'Recuperação', href: '/(app)/callback' },
            { icon: <HardHat color="#0891b2" size={22} />, label: 'Colaboradores', href: '/(app)/helpers' },
            { icon: <Truck color="#0891b2" size={22} />, label: 'Tele-busca', href: '/(app)/pickup' },
          ].map((a) => (
            <Pressable key={a.label} onPress={() => router.push(a.href as any)} style={{ width: '47%' }}>
              <Card className="items-center py-4">
                {a.icon}
                <Text className="text-ink font-semibold text-sm mt-2">{a.label}</Text>
              </Card>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center mb-2">
          <CalendarClock color="#64748b" size={16} />
          <Text className="text-muted font-semibold ml-1.5">Próximos agendamentos</Text>
        </View>
        {data?.upcoming?.length ? (
          data.upcoming.map((s) => (
            <Card key={s.id} className="mb-2">
              <Text className="text-ink font-semibold">{s.client_name || 'Cliente'}</Text>
              {s.vehicle_info ? <Text className="text-muted text-sm">{s.vehicle_info}</Text> : null}
              <Text className="text-brand-700 text-sm mt-1">{formatDateTime(s.date)}</Text>
            </Card>
          ))
        ) : (
          <Card><Text className="text-muted text-center py-2">Nenhum agendamento próximo.</Text></Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
