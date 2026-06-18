import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Crown, Check, X } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/lib/stores/auth';
import { useApp } from '@/lib/stores/app';
import { getPlans, purchase, restore, type PlanOption } from '@/lib/services/subscription';
import { formatCurrency } from '@/lib/utils';

const BENEFITS = [
  'Lavagens ilimitadas por dia',
  'Recibos e orçamentos ilimitados',
  'Sem anúncios em vídeo',
  'Backup na nuvem e suporte prioritário',
];

export default function PremiumScreen() {
  const refresh = useAuth((s) => s.refresh);
  const refreshAll = useApp((s) => s.refreshAll);
  const [plans, setPlans] = useState<Record<string, PlanOption>>({});
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('yearly');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const ok = await purchase(selected);
      if (ok) {
        await refresh();
        await refreshAll();
        Alert.alert('Bem-vindo ao Premium!', 'Tudo liberado, sem anúncios.', [
          { text: 'Ótimo!', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Não foi possível assinar', e?.message || 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    const ok = await restore();
    if (ok) { await refresh(); await refreshAll(); Alert.alert('Assinatura restaurada!'); router.back(); }
    else Alert.alert('Nada para restaurar', 'Nenhuma assinatura ativa encontrada nesta conta de loja.');
  }

  const monthly = plans.monthly?.price ?? 19.9;
  const yearly = plans.yearly?.price ?? 119.9;

  return (
    <SafeAreaView className="flex-1 bg-brand-900">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Pressable onPress={() => router.back()} className="self-end p-2"><X color="#cffafe" size={24} /></Pressable>

        <View className="items-center mb-6">
          <LogoMark size={72} />
          <View className="flex-row items-center mt-3 bg-amber-400 px-3 py-1 rounded-full">
            <Crown color="#7c2d12" size={16} />
            <Text className="text-amber-900 font-bold ml-1">PREMIUM</Text>
          </View>
          <Text className="text-white text-2xl font-bold mt-3 text-center">Libere todo o potencial</Text>
          <Text className="text-brand-100 text-center mt-1">Sem limites e sem anúncios para sua lavagem.</Text>
        </View>

        <View className="bg-white/10 rounded-2xl p-4 mb-6">
          {BENEFITS.map((b) => (
            <View key={b} className="flex-row items-center py-1.5">
              <View className="w-6 h-6 rounded-full bg-brand-400 items-center justify-center mr-3">
                <Check color="#083344" size={15} />
              </View>
              <Text className="text-white flex-1">{b}</Text>
            </View>
          ))}
        </View>

        <PlanCard
          title="Anual" badge="Melhor oferta" price={`${formatCurrency(yearly)}/ano`}
          hint={`≈ ${formatCurrency(yearly / 12)}/mês · economize ${Math.round((1 - yearly / (monthly * 12)) * 100)}%`}
          active={selected === 'yearly'} onPress={() => setSelected('yearly')}
        />
        <PlanCard
          title="Mensal" price={`${formatCurrency(monthly)}/mês`} hint="Cobrança mensal, cancele quando quiser"
          active={selected === 'monthly'} onPress={() => setSelected('monthly')}
        />

        <Button title="Assinar agora" onPress={subscribe} loading={busy} className="mt-4" />
        <Pressable onPress={handleRestore} className="py-4">
          <Text className="text-brand-100 text-center">Restaurar compra</Text>
        </Pressable>
        <Text className="text-brand-200 text-xs text-center mt-2">
          A assinatura é cobrada pela App Store / Google Play e renova automaticamente.
          Você pode cancelar a qualquer momento nas configurações da loja.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  title, price, hint, badge, active, onPress,
}: { title: string; price: string; hint: string; badge?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-2xl p-4 mb-3 border-2 ${active ? 'bg-white border-amber-400' : 'bg-white/10 border-transparent'}`}>
      <View className="flex-row items-center justify-between">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className={`font-bold text-lg ${active ? 'text-ink' : 'text-white'}`}>{title}</Text>
            {badge ? <View className="bg-amber-400 px-2 py-0.5 rounded-full"><Text className="text-amber-900 text-xs font-bold">{badge}</Text></View> : null}
          </View>
          <Text className={active ? 'text-muted text-xs mt-0.5' : 'text-brand-100 text-xs mt-0.5'}>{hint}</Text>
        </View>
        <Text className={`font-bold ${active ? 'text-brand-700' : 'text-white'}`}>{price}</Text>
      </View>
    </Pressable>
  );
}
