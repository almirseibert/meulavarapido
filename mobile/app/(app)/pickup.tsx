import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, MapPin, MessageCircle, ArrowRight, Truck, Plus, X, Pencil, Clock, Trash2 } from 'lucide-react-native';
import { Button, Input, Card } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { useApp } from '@/lib/stores/app';
import { formatCurrency, formatDateTime, whatsappNumber, parseDateTime, toDateInput } from '@/lib/utils';
import { syncPickupNotifications } from '@/lib/services/notify';
import { ClientVehiclePicker, EMPTY_SELECTION, type PickerSelection } from '@/components/ClientPicker';
import { PICKUP_STATUS, type Wash, type PickupStatus } from '@/lib/types';

const STATUS_TONE: Record<PickupStatus, string> = {
  a_buscar: 'bg-amber-100 text-amber-700',
  em_servico: 'bg-brand-50 text-brand-700',
  a_entregar: 'bg-violet-100 text-violet-700',
  concluido: 'bg-green-50 text-green-700',
};

// Mensagem de WhatsApp ao cliente conforme a etapa da tele-busca.
function clientMessage(w: Wash): string {
  const nome = w.client_name || '';
  const veic = w.vehicle_info ? ` (${w.vehicle_info})` : '';
  switch ((w.pickup_status || 'a_buscar') as PickupStatus) {
    case 'a_buscar': return `Olá ${nome}, estamos a caminho para buscar seu veículo${veic}. Já já chegamos! 🚗`;
    case 'em_servico': return `Olá ${nome}, recebemos seu veículo${veic} e já estamos cuidando dele. Avisaremos quando estiver pronto. ✨`;
    case 'a_entregar': return `Olá ${nome}, seu veículo${veic} está pronto e a caminho da entrega! 🚗💨`;
    default: return `Olá ${nome}, obrigado pela preferência!`;
  }
}

export default function PickupScreen() {
  const [items, setItems] = useState<Wash[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Wash | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const washes = await unwrap<Wash[]>(api.get('/washes', { params: { pickup: 1 } }));
      const list = Array.isArray(washes) ? washes : [];
      setItems(list);
      syncPickupNotifications(list); // (re)agenda os avisos locais
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openMaps(address?: string) {
    if (!address) return Alert.alert('Sem endereço', 'Esta tele-busca não tem endereço cadastrado.');
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  }

  function openWhats(w: Wash) {
    const phone = whatsappNumber(w.client_phone || '');
    if (!phone) return Alert.alert('Sem telefone', 'Cliente sem telefone cadastrado. Cadastre o telefone na aba Clientes.');
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(clientMessage(w))}`;
    Linking.openURL(url).catch(() => Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.'));
  }

  async function advance(w: Wash) {
    const cur = (w.pickup_status || 'a_buscar') as PickupStatus;
    const next = PICKUP_STATUS.find((s) => s.id === cur)?.next;
    if (!next) return;
    await api.patch(`/washes/${w.id}/pickup-status`, { status: next });
    load();
  }

  function removePickup(w: Wash) {
    Alert.alert('Remover tele-busca', 'Confirma a exclusão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/washes/${w.id}`); load(); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
          <Text className="text-2xl font-bold text-ink">Tele-busca</Text>
        </View>
        <Pressable onPress={() => { setEditing(null); setModal(true); }} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>
      <Text className="text-muted text-sm px-4 mb-2">Você é avisado no horário marcado de cada busca.</Text>

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
              <Text className="text-muted text-center mt-1">Toque em + para agendar uma busca.</Text>
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
                  {item.pickup_time ? (
                    <View className="flex-row items-center mt-1">
                      <Clock color="#64748b" size={13} />
                      <Text className="text-muted text-sm ml-1">{formatDateTime(item.pickup_time)}</Text>
                    </View>
                  ) : null}
                  {item.pickup_address ? (
                    <View className="flex-row items-center mt-1">
                      <MapPin color="#64748b" size={13} />
                      <Text className="text-muted text-sm ml-1 flex-1">{item.pickup_address}</Text>
                    </View>
                  ) : null}
                  {item.pickup_fee ? <Text className="text-muted text-xs mt-1">Taxa de busca: {formatCurrency(item.pickup_fee)}</Text> : null}
                </View>
                <View className="items-end">
                  <View className={`px-2.5 py-1 rounded-full ${tone.split(' ')[0]}`}>
                    <Text className={`text-xs font-semibold ${tone.split(' ')[1]}`}>{meta.label}</Text>
                  </View>
                  <View className="flex-row gap-1 mt-2">
                    <Pressable onPress={() => { setEditing(item); setModal(true); }} className="bg-slate-100 p-2 rounded-xl"><Pencil color="#475569" size={14} /></Pressable>
                    <Pressable onPress={() => removePickup(item)} className="bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={14} /></Pressable>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Pressable onPress={() => openMaps(item.pickup_address)} className="flex-row items-center bg-slate-100 px-3 py-2 rounded-xl">
                  <MapPin color="#475569" size={16} />
                  <Text className="text-slate-600 font-semibold text-xs ml-1">Maps</Text>
                </Pressable>
                <Pressable onPress={() => openWhats(item)} className="flex-row items-center bg-green-50 px-3 py-2 rounded-xl">
                  <MessageCircle color="#16a34a" size={16} />
                  <Text className="text-green-700 font-semibold text-xs ml-1">Avisar cliente</Text>
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

      <PickupFormModal
        visible={modal}
        wash={editing}
        onClose={() => setModal(false)}
        onSaved={() => { setModal(false); load(); }}
      />
    </SafeAreaView>
  );
}

function PickupFormModal({
  visible, wash, onClose, onSaved,
}: { visible: boolean; wash: Wash | null; onClose: () => void; onSaved: () => void }) {
  const services = useApp((s) => s.services);
  const [sel, setSel] = useState<PickerSelection>(EMPTY_SELECTION);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('08:00');
  const [address, setAddress] = useState('');
  const [fee, setFee] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    if (wash) {
      setSel({
        client_id: wash.client_id || null, vehicle_id: wash.vehicle_id || null,
        client_name: wash.client_name || '', vehicle_info: wash.vehicle_info || '',
        phone: wash.client_phone || null, address: wash.pickup_address || null,
      });
      const d = wash.pickup_time ? new Date(wash.pickup_time) : new Date();
      setDateStr(toDateInput(d));
      setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setAddress(wash.pickup_address || '');
      setFee(wash.pickup_fee ? String(wash.pickup_fee) : '');
    } else {
      setSel(EMPTY_SELECTION); setDateStr(toDateInput(new Date())); setTimeStr('08:00');
      setAddress(''); setFee('');
    }
  }, [visible, wash]);

  // Ao escolher um cliente com endereço, sugere o endereço de busca.
  React.useEffect(() => {
    if (sel.address && !address) setAddress(sel.address);
  }, [sel.address]);

  async function save() {
    if (!sel.client_name) return Alert.alert('Atenção', 'Selecione o cliente.');
    const dt = parseDateTime(dateStr, timeStr);
    if (!dt) return Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA e HH:MM.');
    setSaving(true);
    try {
      const body: any = {
        client_id: sel.client_id, vehicle_id: sel.vehicle_id,
        client_name: sel.client_name || null, vehicle_info: sel.vehicle_info || null,
        pickup: true, pickup_address: address || null,
        pickup_fee: Number(fee.replace(',', '.')) || 0,
        pickup_time: dt.toISOString(),
        pickup_status: wash?.pickup_status || 'a_buscar',
      };
      if (wash) {
        await api.put(`/washes/${wash.id}`, body);
      } else {
        // Tele-busca nasce como uma lavagem em andamento (valor definido na conclusão).
        await api.post('/washes', { ...body, price: Number(fee.replace(',', '.')) || 0, payment_type: 'Dinheiro', is_charged: false, services: [], ad_watched: false });
      }
      onSaved();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">{wash ? 'Editar tele-busca' : 'Nova tele-busca'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <ClientVehiclePicker value={sel} onChange={setSel} />

          <Text className="text-muted font-medium mb-1 text-sm">Horário da busca (você será avisado)</Text>
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="Data" value={dateStr} onChangeText={setDateStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
            <View className="w-28"><Input label="Hora" value={timeStr} onChangeText={setTimeStr} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
          </View>

          <Input label="Endereço para busca" value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" />
          <Input label="Taxa de tele-busca (R$)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0,00" />

          <Text className="text-muted text-xs mb-3">
            O valor dos serviços é definido depois, ao concluir a lavagem (aba Lavagens).
          </Text>

          <Button title={wash ? 'Salvar alterações' : 'Agendar tele-busca'} onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
