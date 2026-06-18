import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Trash2, Check, Wallet } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, currentMonth } from '@/lib/utils';
import { EXPENSE_TYPES, type Supplier } from '@/lib/types';

interface Expense {
  id: string;
  type: string;
  date: string;
  description?: string;
  value: number;
  is_paid: boolean;
  supplier_name?: string;
}

export default function ExpensesScreen() {
  const [items, setItems] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modal, setModal] = useState(false);

  const monthBounds = () => {
    const m = currentMonth();
    const start = `${m}-01`;
    const [y, mo] = m.split('-').map(Number);
    const end = new Date(y, mo, 0).toISOString().slice(0, 10);
    return { from: start, to: `${end}T23:59:59` };
  };

  const load = useCallback(async () => {
    try {
      const { from, to } = monthBounds();
      const [data, sup] = await Promise.all([
        unwrap<Expense[]>(api.get(`/expenses?from=${from}&to=${to}`)),
        unwrap<Supplier[]>(api.get('/suppliers')),
      ]);
      setItems(Array.isArray(data) ? data : []);
      setSuppliers(Array.isArray(sup) ? sup : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalPaid = items.filter((e) => e.is_paid).reduce((a, e) => a + Number(e.value), 0);
  const totalOpen = items.filter((e) => !e.is_paid).reduce((a, e) => a + Number(e.value), 0);

  async function togglePaid(e: Expense) {
    await api.put(`/expenses/${e.id}`, { is_paid: !e.is_paid });
    load();
  }
  async function remove(id: string) {
    Alert.alert('Remover despesa', 'Confirma a exclusão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/expenses/${id}`); load(); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Despesas</Text>
        <Pressable onPress={() => setModal(true)} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>

      <View className="flex-row gap-3 px-4 mb-2">
        <Card className="flex-1">
          <Text className="text-muted text-xs">Pagas no mês</Text>
          <Text className="text-xl font-bold text-ink mt-1">{formatCurrency(totalPaid)}</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-muted text-xs">Em aberto</Text>
          <Text className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalOpen)}</Text>
        </Card>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhuma despesa no mês" subtitle="Toque em + para registrar." />}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-ink font-semibold">{item.type}</Text>
                  {item.is_paid ? <Pill text="Paga" tone="green" /> : <Pill text="Em aberto" tone="red" />}
                </View>
                {item.description ? <Text className="text-muted text-sm mt-0.5">{item.description}</Text> : null}
                {item.supplier_name ? <Text className="text-brand-700 text-xs mt-0.5">{item.supplier_name}</Text> : null}
                <Text className="text-muted text-xs mt-1">{formatDate(item.date)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-ink font-bold">{formatCurrency(item.value)}</Text>
                <View className="flex-row gap-1 mt-2">
                  <Pressable onPress={() => togglePaid(item)} className="bg-slate-100 p-2 rounded-xl"><Check color="#475569" size={15} /></Pressable>
                  <Pressable onPress={() => remove(item.id)} className="bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={15} /></Pressable>
                </View>
              </View>
            </View>
          </Card>
        )}
      />

      <ExpenseModal visible={modal} suppliers={suppliers} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function ExpenseModal({
  visible, suppliers, onClose, onSaved,
}: { visible: boolean; suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('Produto');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [paid, setPaid] = useState(true);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) { setType('Produto'); setDescription(''); setValue(''); setPaid(true); setSupplierId(null); }
  }, [visible]);

  async function save() {
    const v = Number(value.replace(',', '.')) || 0;
    if (v <= 0) return Alert.alert('Atenção', 'Informe um valor válido.');
    setSaving(true);
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      await api.post('/expenses', {
        type, description: description || null, value: v, is_paid: paid,
        supplier_id: supplierId, supplier_name: supplier?.name || null,
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
          <Text className="text-lg font-bold text-ink">Nova despesa</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="text-muted font-medium mb-2 text-sm">Tipo</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {EXPENSE_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)}
                className={`px-3 py-2 rounded-xl border ${type === t ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={type === t ? 'text-white font-semibold' : 'text-ink'}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: compra de shampoo" />
          <Input label="Valor" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0,00" />

          {suppliers.length > 0 && (
            <>
              <Text className="text-muted font-medium mb-2 text-sm">Fornecedor (opcional)</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {suppliers.map((s) => (
                  <Pressable key={s.id} onPress={() => setSupplierId(supplierId === s.id ? null : s.id)}
                    className={`px-3 py-2 rounded-xl border ${supplierId === s.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                    <Text className={supplierId === s.id ? 'text-white font-semibold' : 'text-ink'}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Pressable onPress={() => setPaid((p) => !p)} className="flex-row items-center justify-between bg-white border border-line rounded-2xl p-4 mb-4">
            <View className="flex-row items-center">
              <Wallet color="#0891b2" size={18} />
              <Text className="text-ink ml-2">Já está paga?</Text>
            </View>
            <View className={`w-12 h-7 rounded-full px-0.5 justify-center ${paid ? 'bg-brand-600' : 'bg-slate-300'}`}>
              <View className={`w-6 h-6 rounded-full bg-white ${paid ? 'self-end' : 'self-start'}`} />
            </View>
          </Pressable>

          <Button title="Salvar despesa" onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
