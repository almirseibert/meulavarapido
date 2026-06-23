import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Trash2, CalendarClock, Truck, Check, Pencil } from 'lucide-react-native';
import { Button, Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatDateTime, parseDateTime, toDateInput } from '@/lib/utils';
import { ClientVehiclePicker, EMPTY_SELECTION, type PickerSelection } from '@/components/ClientPicker';

interface Schedule {
  id: string;
  client_id?: string | null;
  vehicle_id?: string | null;
  client_name?: string;
  vehicle_info?: string;
  date: string;
  observations?: string;
  pickup?: boolean;
  pickup_address?: string;
  pickup_fee?: number;
}

export default function ScheduleScreen() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await unwrap<Schedule[]>(api.get('/schedules?upcoming=1'));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function remove(id: string) {
    Alert.alert('Remover agendamento', 'Confirma a exclusão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/schedules/${id}`); load(); } },
    ]);
  }

  function openNew() { setEditing(null); setModal(true); }
  function openEdit(s: Schedule) { setEditing(s); setModal(true); }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Agenda</Text>
        <Pressable onPress={openNew} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhum agendamento futuro" subtitle="Toque em + para agendar." />}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center">
                  <CalendarClock color="#0891b2" size={16} />
                  <Text className="text-brand-700 font-semibold ml-1.5">{formatDateTime(item.date)}</Text>
                  {item.pickup ? (
                    <View className="flex-row items-center bg-brand-50 px-2 py-0.5 rounded-full ml-2">
                      <Truck color="#0891b2" size={12} />
                      <Text className="text-brand-700 text-xs font-semibold ml-1">tele-busca</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-ink font-semibold mt-1">{item.client_name || 'Cliente'}</Text>
                {item.vehicle_info ? <Text className="text-muted text-sm">{item.vehicle_info}</Text> : null}
                {item.observations ? <Text className="text-muted text-xs mt-1">{item.observations}</Text> : null}
              </View>
              <View className="flex-row gap-1">
                <Pressable onPress={() => openEdit(item)} className="bg-slate-100 p-2 rounded-xl"><Pencil color="#475569" size={16} /></Pressable>
                <Pressable onPress={() => remove(item.id)} className="bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={16} /></Pressable>
              </View>
            </View>
          </Card>
        )}
      />

      <ScheduleModal visible={modal} schedule={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function ScheduleModal({
  visible, schedule, onClose, onSaved,
}: { visible: boolean; schedule: Schedule | null; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<PickerSelection>(EMPTY_SELECTION);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('08:00');
  const [obs, setObs] = useState('');
  const [pickup, setPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupFee, setPickupFee] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    if (schedule) {
      setSel({
        client_id: schedule.client_id || null, vehicle_id: schedule.vehicle_id || null,
        client_name: schedule.client_name || '', vehicle_info: schedule.vehicle_info || '',
      });
      const d = new Date(schedule.date);
      setDateStr(toDateInput(d));
      setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setObs(schedule.observations || '');
      setPickup(!!schedule.pickup);
      setPickupAddress(schedule.pickup_address || '');
      setPickupFee(schedule.pickup_fee ? String(schedule.pickup_fee) : '');
    } else {
      setSel(EMPTY_SELECTION); setObs(''); setTimeStr('08:00'); setDateStr(toDateInput(new Date()));
      setPickup(false); setPickupAddress(''); setPickupFee('');
    }
  }, [visible, schedule]);

  function quick(daysAhead: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDateStr(toDateInput(d));
  }

  async function save() {
    const dt = parseDateTime(dateStr, timeStr);
    if (!dt) return Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA e HH:MM.');
    setSaving(true);
    try {
      const body = {
        client_id: sel.client_id, vehicle_id: sel.vehicle_id,
        client_name: sel.client_name || null, vehicle_info: sel.vehicle_info || null,
        date: dt.toISOString(), observations: obs || null,
        pickup, pickup_address: pickup ? pickupAddress || sel.address || null : null,
        pickup_fee: pickup ? Number(pickupFee.replace(',', '.')) || 0 : 0,
        pickup_status: pickup ? 'a_buscar' : null,
      };
      if (schedule) await api.put(`/schedules/${schedule.id}`, body);
      else await api.post('/schedules', body);
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
          <Text className="text-lg font-bold text-ink">{schedule ? 'Editar agendamento' : 'Novo agendamento'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <ClientVehiclePicker value={sel} onChange={setSel} />

          <View className="flex-row gap-2 mb-2">
            {[['Hoje', 0], ['Amanhã', 1], ['+7 dias', 7]].map(([label, d]) => (
              <Pressable key={label as string} onPress={() => quick(d as number)} className="bg-brand-50 px-3 py-2 rounded-xl">
                <Text className="text-brand-700 font-semibold text-xs">{label as string}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="Data" value={dateStr} onChangeText={setDateStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
            <View className="w-28"><Input label="Hora" value={timeStr} onChangeText={setTimeStr} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
          </View>

          <Input label="Observações" value={obs} onChangeText={setObs} placeholder="Opcional" multiline />

          <Pressable onPress={() => setPickup((v) => !v)}
            className={`flex-row items-center justify-between rounded-2xl p-4 border mb-3 mt-1 ${pickup ? 'bg-brand-50 border-brand-600' : 'bg-white border-line'}`}>
            <View className="flex-row items-center">
              <Truck color={pickup ? '#0891b2' : '#94a3b8'} size={20} />
              <Text className={`ml-2 font-semibold ${pickup ? 'text-brand-700' : 'text-ink'}`}>Tele-busca (busca e entrega)</Text>
            </View>
            <View className={`w-5 h-5 rounded-md border ${pickup ? 'bg-brand-600 border-brand-600' : 'border-line'} items-center justify-center`}>
              {pickup ? <Check color="#fff" size={14} /> : null}
            </View>
          </Pressable>
          {pickup && (
            <>
              <Input label="Endereço para busca" value={pickupAddress} onChangeText={setPickupAddress} placeholder={sel.address || 'Rua, número, bairro'} />
              <Input label="Taxa de tele-busca (R$)" value={pickupFee} onChangeText={setPickupFee} keyboardType="decimal-pad" placeholder="0,00" />
            </>
          )}

          <Button title={schedule ? 'Salvar alterações' : 'Agendar'} onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
