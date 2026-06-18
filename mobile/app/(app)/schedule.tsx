import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Trash2, CalendarClock } from 'lucide-react-native';
import { Button, Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatDateTime, parseDateTime, toDateInput } from '@/lib/utils';

interface Schedule {
  id: string;
  client_name?: string;
  vehicle_info?: string;
  date: string;
  observations?: string;
}

export default function ScheduleScreen() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [modal, setModal] = useState(false);

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

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Agenda</Text>
        <Pressable onPress={() => setModal(true)} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
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
                </View>
                <Text className="text-ink font-semibold mt-1">{item.client_name || 'Cliente'}</Text>
                {item.vehicle_info ? <Text className="text-muted text-sm">{item.vehicle_info}</Text> : null}
                {item.observations ? <Text className="text-muted text-xs mt-1">{item.observations}</Text> : null}
              </View>
              <Pressable onPress={() => remove(item.id)} className="bg-red-50 p-2 rounded-xl">
                <Trash2 color="#dc2626" size={16} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <ScheduleModal visible={modal} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function ScheduleModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [clientName, setClientName] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('08:00');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setClientName(''); setVehicleInfo(''); setObs(''); setTimeStr('08:00');
      setDateStr(toDateInput(new Date()));
    }
  }, [visible]);

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
      await api.post('/schedules', {
        client_name: clientName || null,
        vehicle_info: vehicleInfo || null,
        date: dt.toISOString(),
        observations: obs || null,
      });
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
          <Text className="text-lg font-bold text-ink">Novo agendamento</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Input label="Cliente" value={clientName} onChangeText={setClientName} placeholder="Nome do cliente" />
          <Input label="Veículo / placa" value={vehicleInfo} onChangeText={setVehicleInfo} placeholder="Ex.: Gol prata ABC1D23" />

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
          <Button title="Agendar" onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
