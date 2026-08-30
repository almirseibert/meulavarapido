import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Crown, TrendingUp, Droplets, Wallet, CalendarClock, BarChart3, PhoneCall, HardHat, Truck, CalendarRange, X, Check } from 'lucide-react-native';
import { LogoMark } from '@/components/Logo';
import { Button, Input, Card } from '@/components/ui';
import { AccessBanner } from '@/components/AccessBanner';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/stores/auth';
import { formatCurrency, formatDate, formatDateTime, monthLabel, currentMonth, parseDateTime, toDateInput } from '@/lib/utils';

interface Dashboard {
  month: string | null;
  clients: number;
  washesMonth: number;
  revenueMonth: number;
  washesToday: number;
  revenueToday: number;
  receivable: number;
  receivableCount?: number;
  expensesMonth: number;
  upcoming: { id: string; client_name?: string; vehicle_info?: string; date: string }[];
}

// Período exibido: por mês (padrão, sempre o mês atual ao abrir) ou intervalo livre.
type Period =
  | { kind: 'month'; month: string }
  | { kind: 'range'; from: string; to: string };  // ISO

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="flex-1">
      <View className="flex-row items-center mb-2">{icon}</View>
      <Text className="text-2xl font-bold text-ink">{value}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
      {hint ? <Text className="text-muted text-[10px] mt-0.5">{hint}</Text> : null}
    </Card>
  );
}

export default function DashboardScreen() {
  const owner = useAuth((s) => s.owner);
  const [data, setData] = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>({ kind: 'month', month: currentMonth() });
  const [pickerOpen, setPickerOpen] = useState(false);

  const periodLabel = useMemo(
    () => (period.kind === 'month'
      ? monthLabel(period.month)
      : `${formatDate(period.from)} a ${formatDate(period.to)}`),
    [period]
  );

  const load = useCallback(async () => {
    try {
      const params =
        period.kind === 'month' ? { month: period.month } : { from: period.from, to: period.to };
      const d = await unwrap<Dashboard>(api.get('/dashboard', { params }));
      setData(d);
    } catch {
      /* silencioso */
    }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isMonth = period.kind === 'month';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <LogoMark size={40} />
            <View className="ml-2">
              <Text className="text-ink font-bold text-lg">Olá, {owner?.name?.split(' ')[0]}</Text>
              <Text className="text-muted text-xs">{periodLabel}</Text>
            </View>
          </View>
          {!owner?.isPremium && (
            <Pressable onPress={() => router.push('/premium')} className="flex-row items-center bg-amber-100 px-3 py-2 rounded-full">
              <Crown color="#b45309" size={16} />
              <Text className="text-amber-700 font-semibold text-xs ml-1">Premium</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => setPickerOpen(true)}
          className="flex-row items-center justify-between bg-white border border-line rounded-2xl px-4 py-3 mb-3">
          <View className="flex-row items-center flex-1 pr-2">
            <CalendarRange color="#0891b2" size={18} />
            <Text className="text-ink font-medium ml-2 flex-1" numberOfLines={1}>{periodLabel}</Text>
          </View>
          <Text className="text-brand-700 text-xs font-semibold">alterar</Text>
        </Pressable>

        <AccessBanner />

        <View className="flex-row gap-3 mb-3">
          <Kpi icon={<Droplets color="#0891b2" size={20} />} label={isMonth ? 'Lavagens no mês' : 'Lavagens no período'} value={String(data?.washesMonth ?? 0)} />
          <Kpi icon={<TrendingUp color="#16a34a" size={20} />} label={isMonth ? 'Receita do mês' : 'Receita do período'} value={formatCurrency(data?.revenueMonth ?? 0)} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <Kpi icon={<Droplets color="#0891b2" size={20} />} label="Lavagens hoje" value={String(data?.washesToday ?? 0)} />
          <Kpi
            icon={<Wallet color="#dc2626" size={20} />}
            label="A receber (total)"
            value={formatCurrency(data?.receivable ?? 0)}
            hint={data?.receivableCount ? `${data.receivableCount} lavagem(ns) em aberto` : 'tudo recebido'}
          />
        </View>
        <View className="flex-row gap-3 mb-5">
          <Kpi icon={<Wallet color="#ea580c" size={20} />} label={isMonth ? 'Despesas pagas (mês)' : 'Despesas pagas (período)'} value={formatCurrency(data?.expensesMonth ?? 0)} />
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

      <PeriodModal
        visible={pickerOpen}
        current={period}
        onClose={() => setPickerOpen(false)}
        onApply={(p) => { setPeriod(p); setPickerOpen(false); }}
      />
    </SafeAreaView>
  );
}

// Lista os últimos 24 meses (mais recente primeiro) para escolha rápida.
function lastMonths(count = 24): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function PeriodModal({
  visible, current, onClose, onApply,
}: { visible: boolean; current: Period; onClose: () => void; onApply: (p: Period) => void }) {
  const [fromStr, setFromStr] = useState('');
  const [toStr, setToStr] = useState('');
  const months = useMemo(() => lastMonths(), []);

  React.useEffect(() => {
    if (!visible) return;
    if (current.kind === 'range') {
      setFromStr(toDateInput(new Date(current.from)));
      setToStr(toDateInput(new Date(current.to)));
    } else {
      setFromStr(''); setToStr('');
    }
  }, [visible, current]);

  function applyRange() {
    const from = parseDateTime(fromStr, '00:00');
    const to = parseDateTime(toStr, '23:59');
    if (!from || !to) return;
    if (to < from) return;
    onApply({ kind: 'range', from: from.toISOString(), to: new Date(to.getTime() + 59_000).toISOString() });
  }

  const rangeValid = !!parseDateTime(fromStr, '00:00') && !!parseDateTime(toStr, '23:59');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Período exibido</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="text-muted font-medium mb-2 text-sm">Mês</Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {months.map((m) => {
              const on = current.kind === 'month' && current.month === m;
              return (
                <Pressable key={m} onPress={() => onApply({ kind: 'month', month: m })}
                  className={`px-3 py-2 rounded-xl border flex-row items-center ${on ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                  <Text className={on ? 'text-white font-semibold' : 'text-ink'}>{monthLabel(m)}</Text>
                  {on ? <Check color="#fff" size={14} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Text className="text-muted font-medium mb-2 text-sm">Ou um período personalizado</Text>
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="De" value={fromStr} onChangeText={setFromStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
            <View className="flex-1"><Input label="Até" value={toStr} onChangeText={setToStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
          </View>
          <Button title="Aplicar período" onPress={applyRange} variant={rangeValid ? 'primary' : 'ghost'} />

          <Pressable onPress={() => onApply({ kind: 'month', month: currentMonth() })} className="items-center mt-4">
            <Text className="text-brand-700 font-medium">Voltar para o mês atual</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
