import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Plus, X, Trash2, Pencil, Power, HandCoins, ArrowLeft } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { HELPER_EXPENSE_TYPES, type Helper } from '@/lib/types';

export default function HelpersScreen() {
  const [items, setItems] = useState<Helper[]>([]);
  const [editing, setEditing] = useState<Helper | null>(null);
  const [modal, setModal] = useState(false);
  const [launch, setLaunch] = useState<Helper | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await unwrap<Helper[]>(api.get('/helpers'));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() { setEditing(null); setModal(true); }
  function openEdit(h: Helper) { setEditing(h); setModal(true); }

  async function toggleActive(h: Helper) {
    await api.patch(`/helpers/${h.id}/active`);
    load();
  }

  async function remove(h: Helper) {
    Alert.alert('Remover colaborador', `Excluir ${h.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/helpers/${h.id}`); load(); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
          <Text className="text-2xl font-bold text-ink">Colaboradores</Text>
        </View>
        <Pressable onPress={openNew} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhum colaborador" subtitle="Cadastre quem trabalha na lavagem." />}
        renderItem={({ item }) => (
          <Card className={`mb-2 ${item.active ? '' : 'opacity-60'}`}>
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-ink font-semibold text-base">{item.name}</Text>
                  {!item.active && <Pill text="Inativo" tone="gray" />}
                </View>
                <Text className="text-muted text-sm mt-0.5">Diária: {formatCurrency(item.daily_rate)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-muted text-xs">Saldo a pagar</Text>
                <Text className={`font-bold text-base ${(item.saldo ?? 0) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrency(item.saldo ?? 0)}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2 mt-3">
              <Pressable onPress={() => setLaunch(item)} className="flex-row items-center bg-brand-50 px-3 py-2 rounded-xl">
                <HandCoins color="#0891b2" size={16} />
                <Text className="text-brand-700 font-semibold text-xs ml-1">Lançar</Text>
              </Pressable>
              <Pressable onPress={() => openEdit(item)} className="bg-slate-100 p-2 rounded-xl"><Pencil color="#475569" size={16} /></Pressable>
              <Pressable onPress={() => toggleActive(item)} className="bg-slate-100 p-2 rounded-xl"><Power color={item.active ? '#16a34a' : '#94a3b8'} size={16} /></Pressable>
              <Pressable onPress={() => remove(item)} className="ml-auto bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={16} /></Pressable>
            </View>
          </Card>
        )}
      />

      <HelperModal visible={modal} helper={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />
      <LaunchModal helper={launch} onClose={() => setLaunch(null)} onSaved={() => { setLaunch(null); load(); }} />
    </SafeAreaView>
  );
}

function HelperModal({
  visible, helper, onClose, onSaved,
}: { visible: boolean; helper: Helper | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(helper?.name || '');
      setRate(helper ? String(helper.daily_rate) : '');
    }
  }, [visible, helper]);

  async function save() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    setSaving(true);
    try {
      const body = { name, daily_rate: Number(rate.replace(',', '.')) || 0 };
      if (helper) await api.put(`/helpers/${helper.id}`, body);
      else await api.post('/helpers', body);
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
          <Text className="text-lg font-bold text-ink">{helper ? 'Editar colaborador' : 'Novo colaborador'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do colaborador" />
          <Input label="Diária (R$)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0,00" />
          <Button title="Salvar" onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function LaunchModal({
  helper, onClose, onSaved,
}: { helper: Helper | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('AjudaDiaria');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (helper) {
      setType('AjudaDiaria');
      setValue(helper.daily_rate ? String(helper.daily_rate) : '');
    }
  }, [helper]);

  async function save() {
    if (!helper) return;
    const v = Number(value.replace(',', '.')) || 0;
    if (v <= 0) return Alert.alert('Atenção', 'Informe um valor.');
    setSaving(true);
    try {
      const label = HELPER_EXPENSE_TYPES.find((t) => t.id === type)?.label || type;
      await api.post('/expenses', {
        type,
        value: v,
        description: `${label}: ${helper.name}`,
        helper_id: helper.id,
        helper_name: helper.name,
        is_paid: type !== 'AjudaDiaria', // diária entra como pendente (a pagar); vale/pagamento já saíram do caixa
      });
      onSaved();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível lançar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!helper} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Lançar — {helper?.name}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="text-muted font-medium mb-2 text-sm">Tipo de lançamento</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {HELPER_EXPENSE_TYPES.map((t) => (
              <Pressable key={t.id} onPress={() => setType(t.id)}
                className={`px-3 py-2 rounded-xl border ${type === t.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={type === t.id ? 'text-white font-semibold' : 'text-ink'}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Input label="Valor (R$)" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0,00" />
          <Text className="text-muted text-xs mb-3">
            Diária aumenta o saldo a pagar do colaborador. Vale e Pagamento abatem o saldo.
          </Text>
          <Button title="Registrar lançamento" onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
