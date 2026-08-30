import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Car, Phone, Trash2, Pencil, Check, FileText } from 'lucide-react-native';
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
                {item.document ? (
                  <View className="flex-row items-center mt-0.5">
                    <FileText color="#64748b" size={13} />
                    <Text className="text-muted text-sm ml-1">{item.document}</Text>
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

interface VehicleForm {
  nickname: string; make: string; model: string; year: string; plate: string; color: string; notes: string;
}
const EMPTY_VEHICLE: VehicleForm = { nickname: '', make: '', model: '', year: '', plate: '', color: '', notes: '' };

function vehicleFormToPayload(v: VehicleForm) {
  return {
    nickname: v.nickname.trim() || null, make: v.make.trim() || null, model: v.model.trim() || null,
    year: v.year.trim() || null, license_plate: v.plate.trim().toUpperCase() || null,
    color: v.color.trim() || null, notes: v.notes.trim() || null,
  };
}
function vehicleHasData(v: VehicleForm) {
  return !!(v.nickname || v.make || v.model || v.year || v.plate || v.color || v.notes);
}

function ClientModal({
  visible, client, onClose, onSaved,
}: { visible: boolean; client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isCompany, setIsCompany] = useState(false);
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [allowCredit, setAllowCredit] = useState(false);
  const [notes, setNotes] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Formulário do veículo (adiciona novo ou edita um existente quando editingVehicleId != null).
  const [vform, setVform] = useState<VehicleForm>(EMPTY_VEHICLE);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setV = (patch: Partial<VehicleForm>) => setVform((p) => ({ ...p, ...patch }));

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
      setEmail(client?.email || '');
      setIsCompany(!!client?.is_company);
      setDocument(client?.document || '');
      setAddress(client?.address || '');
      setCity(client?.city || '');
      setBirthDate(client?.birth_date || '');
      setAllowCredit(!!client?.allow_credit);
      setNotes(client?.notes || '');
      setVehicles(client?.vehicles || []);
      setVform(EMPTY_VEHICLE);
      setEditingVehicleId(null);
    }
  }, [visible, client]);

  function startEditVehicle(v: Vehicle) {
    setEditingVehicleId(v.id);
    setVform({
      nickname: v.nickname || '', make: v.make || '', model: v.model || '',
      year: v.year || '', plate: v.license_plate || '', color: v.color || '', notes: v.notes || '',
    });
  }
  function cancelEditVehicle() { setEditingVehicleId(null); setVform(EMPTY_VEHICLE); }

  // Salva o veículo do formulário (cria ou atualiza) num cliente já existente.
  // Placa repetida na conta é recusada pelo servidor (409) — mostramos a mensagem.
  async function submitVehicle(clientId: string): Promise<boolean> {
    if (!vehicleHasData(vform)) return true;
    const payload = vehicleFormToPayload(vform);
    try {
      if (editingVehicleId) {
        await api.put(`/clients/vehicles/${editingVehicleId}`, payload);
      } else {
        await api.post(`/clients/${clientId}/vehicles`, payload);
      }
    } catch (e) {
      Alert.alert('Veículo não salvo', e instanceof ApiError ? e.message : 'Não foi possível salvar o veículo.');
      return false;
    }
    setVform(EMPTY_VEHICLE);
    setEditingVehicleId(null);
    await reloadVehicles(clientId);
    return true;
  }

  function removeVehicle(v: Vehicle) {
    Alert.alert('Remover veículo', `Excluir ${vehicleLabel(v)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await api.delete(`/clients/vehicles/${v.id}`);
        if (editingVehicleId === v.id) cancelEditVehicle();
        if (client) reloadVehicles(client.id);
      } },
    ]);
  }

  async function save() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    setSaving(true);
    try {
      const payload = {
        name, phone, email, is_company: isCompany, document,
        address, city, birth_date: birthDate, allow_credit: allowCredit, notes,
      };
      let clientId = client?.id;
      if (client) {
        await api.put(`/clients/${client.id}`, payload);
        // Veículo pendente no formulário (novo ou edição) — persiste junto.
        // Se a placa duplicar, o cliente já foi salvo: mantém o modal aberto.
        if (vehicleHasData(vform) && !(await submitVehicle(client.id))) return;
      } else {
        const created = await unwrap<Client>(api.post('/clients', payload));
        clientId = created.id;
        if (clientId && vehicleHasData(vform)) {
          try {
            await api.post(`/clients/${clientId}/vehicles`, vehicleFormToPayload(vform));
          } catch (e) {
            Alert.alert(
              'Cliente salvo, veículo não',
              e instanceof ApiError ? e.message : 'Não foi possível salvar o veículo.'
            );
          }
        }
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
          <Text className="text-muted font-semibold text-xs uppercase mb-2">Dados do cliente</Text>
          <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do cliente" />

          <View className="flex-row items-center justify-between bg-white border border-line rounded-2xl px-4 py-3 mb-3">
            <View className="flex-1 pr-2">
              <Text className="text-ink font-medium">Pessoa jurídica (empresa)</Text>
              <Text className="text-muted text-xs mt-0.5">Muda o rótulo do documento para CNPJ.</Text>
            </View>
            <Switch value={isCompany} onValueChange={setIsCompany} trackColor={{ true: '#0891b2' }} />
          </View>

          <Input label={isCompany ? 'CNPJ' : 'CPF'} value={document} onChangeText={setDocument}
            keyboardType="numbers-and-punctuation" placeholder={isCompany ? '00.000.000/0000-00' : '000.000.000-00'} />
          <Input label="Telefone / WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(51) 99999-9999" />
          <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="cliente@email.com" />
          <Input label="Endereço (p/ tele-busca)" value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" />
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="Cidade" value={city} onChangeText={setCity} placeholder="Opcional" /></View>
            <View className="flex-1"><Input label="Aniversário" value={birthDate} onChangeText={setBirthDate} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
          </View>

          <View className="flex-row items-center justify-between bg-white border border-line rounded-2xl px-4 py-3 mb-3">
            <View className="flex-1 pr-2">
              <Text className="text-ink font-medium">Aceita pagamento a prazo</Text>
              <Text className="text-muted text-xs mt-0.5">Permite faturar e dar baixa depois (em lote).</Text>
            </View>
            <Switch value={allowCredit} onValueChange={setAllowCredit} trackColor={{ true: '#0891b2' }} />
          </View>

          <Input label="Observações do cliente" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />

          {/* Veículos do cliente */}
          <Text className="text-muted font-semibold text-xs uppercase mt-3 mb-2">Veículos</Text>
          {client && vehicles.length > 0 && vehicles.map((v) => (
            <View key={v.id} className={`flex-row items-center bg-white border rounded-2xl px-4 py-3 mb-2 ${editingVehicleId === v.id ? 'border-brand-600' : 'border-line'}`}>
              <Car color="#0891b2" size={16} />
              <View className="flex-1 ml-2">
                <Text className="text-ink">{vehicleLabel(v)}</Text>
                {v.color ? <Text className="text-muted text-xs">{v.color}</Text> : null}
              </View>
              <Pressable onPress={() => startEditVehicle(v)} className="bg-slate-100 p-2 rounded-xl mr-1">
                <Pencil color="#475569" size={14} />
              </Pressable>
              <Pressable onPress={() => removeVehicle(v)} className="bg-red-50 p-2 rounded-xl">
                <Trash2 color="#dc2626" size={14} />
              </Pressable>
            </View>
          ))}

          <Text className="text-muted text-xs mb-1">
            {editingVehicleId ? 'Editando veículo' : client ? 'Adicionar outro veículo' : 'Veículo (opcional)'}
          </Text>
          <Input label="Apelido" value={vform.nickname} onChangeText={(t) => setV({ nickname: t })} placeholder="Ex.: Carro da esposa" />
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="Marca" value={vform.make} onChangeText={(t) => setV({ make: t })} placeholder="Ex.: Volkswagen" /></View>
            <View className="flex-1"><Input label="Modelo" value={vform.model} onChangeText={(t) => setV({ model: t })} placeholder="Ex.: Gol" /></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="Ano" value={vform.year} onChangeText={(t) => setV({ year: t })} keyboardType="number-pad" placeholder="2020" /></View>
            <View className="flex-1"><Input label="Cor" value={vform.color} onChangeText={(t) => setV({ color: t })} placeholder="Ex.: Prata" /></View>
          </View>
          <Input label="Placa" value={vform.plate} onChangeText={(t) => setV({ plate: t })} autoCapitalize="characters" placeholder="ABC1D23" />
          <Input label="Observações do veículo" value={vform.notes} onChangeText={(t) => setV({ notes: t })}
            placeholder="Opcional (ex.: risco na porta, sem cera no capô)" multiline />

          {client && vehicleHasData(vform) ? (
            <View className="flex-row gap-2 mb-2">
              <Pressable onPress={() => { submitVehicle(client.id); }} className="flex-1 flex-row items-center justify-center bg-brand-50 rounded-2xl py-3">
                <Check color="#0891b2" size={16} />
                <Text className="text-brand-700 font-semibold ml-1">{editingVehicleId ? 'Salvar veículo' : 'Adicionar veículo'}</Text>
              </Pressable>
              {editingVehicleId ? (
                <Pressable onPress={cancelEditVehicle} className="px-4 flex-row items-center justify-center bg-slate-100 rounded-2xl py-3">
                  <Text className="text-slate-600 font-semibold">Cancelar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Button title="Salvar" onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
