import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, User, Car, Search, Check, Pencil } from 'lucide-react-native';
import { Input, Empty } from '@/components/ui';
import { api, unwrap } from '@/lib/api';
import type { Client, Vehicle } from '@/lib/types';

export interface PickerSelection {
  client_id: string | null;
  vehicle_id: string | null;
  client_name: string;
  vehicle_info: string;
  phone?: string | null;
  address?: string | null;
  allow_credit?: boolean;
}

export const EMPTY_SELECTION: PickerSelection = {
  client_id: null, vehicle_id: null, client_name: '', vehicle_info: '',
  phone: null, address: null, allow_credit: false,
};

export function vehicleLabel(v: Vehicle): string {
  return [v.make, v.model, v.license_plate].filter(Boolean).join(' ') || 'Veículo';
}

// Seletor reutilizável: escolhe um cliente cadastrado (e um de seus veículos)
// ou permite digitar avulso. Usado em lavagem, agendamento, recibo, orçamento e tele-busca.
export function ClientVehiclePicker({
  value, onChange, requireVehicle = false,
}: {
  value: PickerSelection;
  onChange: (s: PickerSelection) => void;
  requireVehicle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);

  const summary = value.client_name
    ? `${value.client_name}${value.vehicle_info ? ` · ${value.vehicle_info}` : ''}`
    : 'Selecionar cliente';

  return (
    <View className="mb-3">
      <Text className="text-muted font-medium mb-1 text-sm">Cliente / veículo</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between border border-line rounded-2xl px-4 py-3 bg-white"
      >
        <View className="flex-row items-center flex-1 pr-2">
          <User color="#0891b2" size={18} />
          <Text className={`ml-2 flex-1 ${value.client_name ? 'text-ink font-medium' : 'text-muted'}`} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {value.allow_credit ? (
          <View className="bg-amber-100 px-2 py-0.5 rounded-full mr-2">
            <Text className="text-amber-700 text-xs font-semibold">a prazo</Text>
          </View>
        ) : null}
        <Search color="#94a3b8" size={18} />
      </Pressable>

      <View className="flex-row gap-2 mt-1.5">
        <Pressable onPress={() => { setManual(true); setOpen(true); }} className="flex-row items-center">
          <Pencil color="#64748b" size={13} />
          <Text className="text-muted text-xs ml-1">Cliente avulso (digitar)</Text>
        </Pressable>
        {value.client_name ? (
          <Pressable onPress={() => onChange({ ...EMPTY_SELECTION })} className="ml-auto">
            <Text className="text-red-500 text-xs">Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      <PickerModal
        visible={open}
        manualStart={manual}
        onClose={() => { setOpen(false); setManual(false); }}
        onPick={(s) => { onChange(s); setOpen(false); setManual(false); }}
        requireVehicle={requireVehicle}
      />
    </View>
  );
}

function PickerModal({
  visible, manualStart, onClose, onPick, requireVehicle,
}: {
  visible: boolean;
  manualStart: boolean;
  onClose: () => void;
  onPick: (s: PickerSelection) => void;
  requireVehicle: boolean;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mVehicle, setMVehicle] = useState('');

  const load = useCallback(async (q = '') => {
    try {
      const data = await unwrap<Client[]>(api.get(`/clients${q ? `?search=${encodeURIComponent(q)}` : ''}`));
      setClients(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (visible) {
      setSearch(''); setSelected(null); setMName(''); setMVehicle('');
      setManual(manualStart);
      load('');
    }
  }, [visible, manualStart, load]);

  function pickClientNoVehicle(c: Client) {
    if (requireVehicle && (c.vehicles?.length || 0) > 0) { setSelected(c); return; }
    onPick({
      client_id: c.id, vehicle_id: null, client_name: c.name, vehicle_info: '',
      phone: c.phone || null, address: c.address || null, allow_credit: !!c.allow_credit,
    });
  }

  function pickVehicle(c: Client, v: Vehicle) {
    onPick({
      client_id: c.id, vehicle_id: v.id, client_name: c.name, vehicle_info: vehicleLabel(v),
      phone: c.phone || null, address: c.address || null, allow_credit: !!c.allow_credit,
    });
  }

  function saveManual() {
    if (!mName.trim()) return Alert.alert('Atenção', 'Informe o nome do cliente.');
    onPick({
      client_id: null, vehicle_id: null, client_name: mName.trim(), vehicle_info: mVehicle.trim(),
      phone: null, address: null, allow_credit: false,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">
            {selected ? 'Escolher veículo' : manual ? 'Cliente avulso' : 'Selecionar cliente'}
          </Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>

        {manual ? (
          <View className="p-4">
            <Input label="Nome do cliente *" value={mName} onChangeText={setMName} placeholder="Nome" />
            <Input label="Veículo / placa" value={mVehicle} onChangeText={setMVehicle} placeholder="Ex.: Gol prata ABC1D23" />
            <Pressable onPress={saveManual} className="bg-brand-600 rounded-2xl py-4 items-center mt-1">
              <Text className="text-white font-semibold text-base">Usar este cliente</Text>
            </Pressable>
            <Pressable onPress={() => setManual(false)} className="items-center mt-3">
              <Text className="text-brand-700 font-medium">Escolher cliente cadastrado</Text>
            </Pressable>
          </View>
        ) : selected ? (
          <View className="flex-1 p-4">
            <Text className="text-ink font-semibold text-base mb-1">{selected.name}</Text>
            <Text className="text-muted text-sm mb-3">Selecione o veículo:</Text>
            {(selected.vehicles || []).map((v) => (
              <Pressable key={v.id} onPress={() => pickVehicle(selected, v)} className="flex-row items-center border border-line rounded-2xl px-4 py-3 bg-white mb-2">
                <Car color="#0891b2" size={18} />
                <Text className="text-ink ml-2 flex-1">{vehicleLabel(v)}</Text>
                <Check color="#94a3b8" size={18} />
              </Pressable>
            ))}
            {!requireVehicle && (
              <Pressable onPress={() => pickClientNoVehicle({ ...selected, vehicles: [] })} className="items-center mt-2">
                <Text className="text-muted">Sem veículo específico</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setSelected(null)} className="items-center mt-3">
              <Text className="text-brand-700 font-medium">Voltar para a lista</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="px-4 pt-3">
              <Input placeholder="Buscar por nome ou telefone" value={search}
                onChangeText={(t) => { setSearch(t); load(t); }} className="mb-2" />
              <Pressable onPress={() => setManual(true)} className="flex-row items-center justify-center bg-brand-50 rounded-2xl py-3 mb-1">
                <Pencil color="#0891b2" size={16} />
                <Text className="text-brand-700 font-semibold ml-1">Cliente avulso (não cadastrado)</Text>
              </Pressable>
            </View>
            <FlatList
              data={clients}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: 16, paddingTop: 4 }}
              ListEmptyComponent={<Empty title="Nenhum cliente" subtitle="Cadastre clientes na aba Clientes." />}
              renderItem={({ item }) => (
                <Pressable onPress={() => pickClientNoVehicle(item)} className="border border-line rounded-2xl px-4 py-3 bg-white mb-2">
                  <View className="flex-row items-center">
                    <User color="#0891b2" size={16} />
                    <Text className="text-ink font-semibold ml-2 flex-1">{item.name}</Text>
                    {item.allow_credit ? (
                      <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                        <Text className="text-amber-700 text-xs font-semibold">a prazo</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.phone ? <Text className="text-muted text-sm mt-0.5 ml-6">{item.phone}</Text> : null}
                  {(item.vehicles || []).map((v) => (
                    <Text key={v.id} className="text-brand-700 text-sm ml-6 mt-0.5">{vehicleLabel(v)}</Text>
                  ))}
                </Pressable>
              )}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
