import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Car, Phone, Trash2, Pencil, Check } from 'lucide-react-native';
import { Button, Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { vehicleLabel } from '@/components/ClientPicker';
import type { Client, Vehicle } from '@/lib/types';

export default function ClientsScreen() {
  const [items, setItems] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [modal, setModal] = useState(false);

  const load = useCallback(async (q = '') => {
    try {
      const data = await unwrap<Client[]>(api.get(`/clients${q ? `?search=${encodeURIComponent(q)}` : ''}`));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(search); }, [load]));

  function openNew() { setEditing(null); setModal(true); }
  function openEdit(c: Client) { setEditing(c); setModal(true); }

  async function removeClient(c: Client) {
    Alert.alert('Remover cliente', `Excluir ${c.name} e seus veículos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/clients/${c.id}`); load(search); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Clientes</Text>
        <Pressable onPress={openNew} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>
      <View className="px-4 pb-2">
        <Input placeholder="Buscar por nome ou telefone" value={search} onChangeText={(t) => { setSearch(t); load(t); }} className="mb-0" />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhum cliente" subtitle="Cadastre seu primeiro cliente." />}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-ink font-semibold text-base">{item.name}</Text>
                  {item.allow_credit ? (
                    <View className="bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-amber-700 text-xs font-semibold">a prazo</Text>
                    </View>
                  ) : null}
                </View>
                {item.phone ? (
                  <View className="flex-row items-center mt-0.5">
                    <Phone color="#64748b" size={13} />
                    <Text className="text-muted text-sm ml-1">{item.phone}</Text>
                  </View>
                ) : null}
                {item.vehicles?.map((v) => (
                  <View key={v.id} className="flex-row items-center mt-1">
                    <Car color="#0891b2" size={14} />
                    <Text className="text-brand-700 text-sm ml-1">{vehicleLabel(v)}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-row gap-1">
                <Pressable onPress={() => openEdit(item)} className="bg-slate-100 p-2 rounded-xl"><Pencil color="#475569" size={16} /></Pressable>
                <Pressable onPress={() => removeClient(item)} className="bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={16} /></Pressable>
              </View>
            </View>
          </Card>
        )}
      />

      <ClientModal
        visible={modal}
        client={editing}
        onClose={() => setModal(false)}
        onSaved={() => { setModal(false); load(search); }}
      />
    </SafeAreaView>
  );
}

function ClientModal({
  visible, client, onClose, onSaved,
}: { visible: boolean; client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [allowCredit, setAllowCredit] = useState(false);
  const [notes, setNotes] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // veículo novo (para cliente novo, ou adição rápida)
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);

  const reloadVehicles = useCallback(async (clientId: string) => {
    try {
      const list = await unwrap<Client[]>(api.get(`/clients?search=`));
      const me = (list || []).find((c) => c.id === clientId);
      setVehicles(me?.vehicles || []);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (visible) {
      setName(client?.name || '');
      setPhone(client?.phone || '');
      setAddress(client?.address || '');
      setAllowCredit(!!client?.allow_credit);
      setNotes(client?.notes || '');
      setVehicles(client?.vehicles || []);
      setMake(''); setModel(''); setPlate('');
    }
  }, [visible, client]);

  async function addVehicle(clientId: string) {
    if (!(make || model || plate)) return;
    await api.post(`/clients/${clientId}/vehicles`, { make, model, license_plate: plate });
    setMake(''); setModel(''); setPlate('');
    await reloadVehicles(clientId);
  }

  function removeVehicle(v: Vehicle) {
    Alert.alert('Remover veículo', `Excluir ${vehicleLabel(v)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await api.delete(`/clients/vehicles/${v.id}`);
        if (client) reloadVehicles(client.id);
      } },
    ]);
  }

  async function save() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    setSaving(true);
    try {
      const payload = { name, phone, address, allow_credit: allowCredit, notes };
      let clientId = client?.id;
      if (client) {
        await api.put(`/clients/${client.id}`, payload);
      } else {
        const created = await unwrap<Client>(api.post('/clients', payload));
        clientId = created.id;
      }
      if (clientId && (make || model || plate)) {
        await api.post(`/clients/${clientId}/vehicles`, { make, model, license_plate: plate });
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
          <Text className="text-lg font-bold text-ink">{client ? 'Editar cliente' : 'Novo cliente'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do cliente" />
          <Input label="Telefone / WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(51) 99999-9999" />
          <Input label="Endereço (p/ tele-busca)" value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" />

          <View className="flex-row items-center justify-between bg-white border border-line rounded-2xl px-4 py-3 mb-3">
            <View className="flex-1 pr-2">
              <Text className="text-ink font-medium">Aceita pagamento a prazo</Text>
              <Text className="text-muted text-xs mt-0.5">Permite faturar e dar baixa depois (em lote).</Text>
            </View>
            <Switch value={allowCredit} onValueChange={setAllowCredit} trackColor={{ true: '#0891b2' }} />
          </View>

          <Input label="Observações" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />

          {/* Veículos do cliente */}
          <Text className="text-muted font-semibold text-xs uppercase mt-2 mb-2">Veículos</Text>
          {client && vehicles.length > 0 && vehicles.map((v) => (
            <View key={v.id} className="flex-row items-center bg-white border border-line rounded-2xl px-4 py-3 mb-2">
              <Car color="#0891b2" size={16} />
              <Text className="text-ink ml-2 flex-1">{vehicleLabel(v)}</Text>
              <Pressable onPress={() => removeVehicle(v)} className="bg-red-50 p-2 rounded-xl">
                <Trash2 color="#dc2626" size={14} />
              </Pressable>
            </View>
          ))}

          <Text className="text-muted text-xs mb-1">{client ? 'Adicionar outro veículo' : 'Veículo (opcional)'}</Text>
          <Input label="Marca" value={make} onChangeText={setMake} placeholder="Ex.: Volkswagen" />
          <Input label="Modelo" value={model} onChangeText={setModel} placeholder="Ex.: Gol" />
          <Input label="Placa" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="ABC1D23" />
          {client && (make || model || plate) ? (
            <Pressable onPress={() => addVehicle(client.id)} className="flex-row items-center justify-center bg-brand-50 rounded-2xl py-3 mb-2">
              <Check color="#0891b2" size={16} />
              <Text className="text-brand-700 font-semibold ml-1">Adicionar veículo</Text>
            </Pressable>
          ) : null}

          <Button title="Salvar" onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
