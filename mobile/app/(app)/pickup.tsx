import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, MapPin, MessageCircle, ArrowRight, Truck } from 'lucide-react-native';
import { Card, Empty } from '@/components/ui';
import { api, unwrap } from '@/lib/api';
import { formatCurrency, whatsappNumber } from '@/lib/utils';
import { PICKUP_STATUS, type Wash, type Client, type PickupStatus } from '@/lib/types';

const STATUS_TONE: Record<PickupStatus, string> = {
  a_buscar: 'bg-amber-100 text-amber-700',
  em_servico: 'bg-brand-50 text-brand-700',
  a_entregar: 'bg-violet-100 text-violet-700',
  concluido: 'bg-green-50 text-green-700',
};

export default function PickupScreen() {
  const [items, setItems] = useState<Wash[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [washes, clients] = await Promise.all([
        unwrap<Wash[]>(api.get('/washes', { params: { pickup: 1 } })),
        unwrap<Client[]>(api.get('/clients')),
      ]);
      setItems(Array.isArray(washes) ? washes : []);
      const map: Record<string, string> = {};
      (clients || []).forEach((c) => { if (c.phone) map[c.id] = c.phone; });
      setPhones(map);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openMaps(address?: string) {
    if (!address) return Alert.alert('Sem endereço', 'Esta tele-busca não tem endereço cadastrado.');
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  }

  function openWhats(w: Wash) {
    const phone = whatsappNumber(w.client_id ? phones[w.client_id] : '');
    if (!phone) return Alert.alert('Sem telefone', 'Cliente sem telefone cadastrado.');
    Linking.openURL(`whatsapp://send?phone=${phone}`).catch(() => Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.'));
  }

  async function advance(w: Wash) {
    const cur = (w.pickup_status || 'a_buscar') as PickupStatus;
    const next = PICKUP_STATUS.find((s) => s.id === cur)?.next;
    if (!next) return;
    await api.patch(`/washes/${w.id}/pickup-status`, { status: next });
    load();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
        <Text className="text-2xl font-bold text-ink">Tele-busca</Text>
      </View>
      <Text className="text-muted text-sm px-4 mb-2">Veículos com busca e entrega em andamento.</Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          loading ? null : (
            <View className="items-center py-16 px-6">
              <Truck color="#94a3b8" size={40} />
              <Text className="text-ink font-semibold text-center mt-3">Nenhuma tele-busca ativa</Text>
              <Text className="text-muted text-center mt-1">Marque "Tele-busca" ao registrar uma lavagem.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const status = (item.pickup_status || 'a_buscar') as PickupStatus;
          const meta = PICKUP_STATUS.find((s) => s.id === status)!;
          const tone = STATUS_TONE[status];
          return (
            <Card className="mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <Text className="text-ink font-semibold text-base">{item.client_name || 'Sem cliente'}</Text>
                  {item.vehicle_info ? <Text className="text-muted text-sm">{item.vehicle_info}</Text> : null}
                  {item.pickup_address ? (
                    <View className="flex-row items-center mt-1">
                      <MapPin color="#64748b" size={13} />
                      <Text className="text-muted text-sm ml-1 flex-1">{item.pickup_address}</Text>
                    </View>
                  ) : null}
                  {item.pickup_fee ? <Text className="text-muted text-xs mt-1">Taxa de busca: {formatCurrency(item.pickup_fee)}</Text> : null}
                </View>
                <View className={`px-2.5 py-1 rounded-full ${tone.split(' ')[0]}`}>
                  <Text className={`text-xs font-semibold ${tone.split(' ')[1]}`}>{meta.label}</Text>
                </View>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Pressable onPress={() => openMaps(item.pickup_address)} className="flex-row items-center bg-slate-100 px-3 py-2 rounded-xl">
                  <MapPin color="#475569" size={16} />
                  <Text className="text-slate-600 font-semibold text-xs ml-1">Maps</Text>
                </Pressable>
                <Pressable onPress={() => openWhats(item)} className="flex-row items-center bg-green-50 px-3 py-2 rounded-xl">
                  <MessageCircle color="#16a34a" size={16} />
                  <Text className="text-green-700 font-semibold text-xs ml-1">WhatsApp</Text>
                </Pressable>
                {meta.next && (
                  <Pressable onPress={() => advance(item)} className="ml-auto flex-row items-center bg-brand-600 px-3 py-2 rounded-xl">
                    <Text className="text-white font-semibold text-xs mr-1">{PICKUP_STATUS.find((s) => s.id === meta.next)!.label}</Text>
                    <ArrowRight color="#fff" size={16} />
                  </Pressable>
                )}
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}
