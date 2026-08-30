import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Trash2, Check, Wallet, ChevronDown, ChevronRight } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, monthLabel, parseDateTime, toDateInput } from '@/lib/utils';
import { EXPENSE_TYPES, HELPER_TYPE_LABEL, type Supplier } from '@/lib/types';

interface Expense {
  id: string;
  type: string;
  date: string;
  description?: string;
  value: number;
  is_paid: boolean;
  supplier_name?: string;
  helper_name?: string;
}

// Quantos meses para trás a tela carrega de uma vez.
const MONTHS_BACK = 12;

const typeLabel = (t: string) => HELPER_TYPE_LABEL[t] || t;

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface TypeGroup { type: string; items: Expense[]; total: number; open: number }
interface MonthGroup { key: string; items: Expense[]; total: number; paid: number; open: number; types: TypeGroup[] }

export default function ExpensesScreen() {
  const [items, setItems] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modal, setModal] = useState(false);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1).toISOString();
      const [data, sup] = await Promise.all([
        unwrap<Expense[]>(api.get(`/expenses?from=${encodeURIComponent(from)}`)),
        unwrap<Supplier[]>(api.get('/suppliers')),
      ]);
      setItems(Array.isArray(data) ? data : []);
      setSuppliers(Array.isArray(sup) ? sup : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Mês → tipo de despesa → lançamentos daquele tipo.
  const months = useMemo<MonthGroup[]>(() => {
    const byMonth: Record<string, Expense[]> = {};
    for (const e of items) (byMonth[monthKey(e.date)] ||= []).push(e);

    return Object.entries(byMonth)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, list]) => {
        const byType: Record<string, Expense[]> = {};
        for (const e of list) (byType[e.type] ||= []).push(e);
        const types = Object.entries(byType)
          .map(([type, tItems]) => ({
            type,
            items: tItems,
            total: tItems.reduce((a, e) => a + Number(e.value), 0),
            open: tItems.filter((e) => !e.is_paid).reduce((a, e) => a + Number(e.value), 0),
          }))
          .sort((a, b) => b.total - a.total);
        return {
          key,
          items: list,
          types,
          total: list.reduce((a, e) => a + Number(e.value), 0),
          paid: list.filter((e) => e.is_paid).reduce((a, e) => a + Number(e.value), 0),
          open: list.filter((e) => !e.is_paid).reduce((a, e) => a + Number(e.value), 0),
        };
      });
  }, [items]);

  // Abre o mês atual por padrão (e mantém a escolha do usuário depois disso).
  React.useEffect(() => {
    if (openMonth === null && months.length) setOpenMonth(months[0].key);
  }, [months, openMonth]);

  async function togglePaid(e: Expense) {
    await api.put(`/expenses/${e.id}`, { is_paid: !e.is_paid });
    load();
  }

  function remove(id: string) {
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

      <FlatList
        data={months}
        keyExtractor={(m) => m.key}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhuma despesa" subtitle="Toque em + para registrar." />}
        renderItem={({ item: m }) => {
          const monthOpen = openMonth === m.key;
          return (
            <Card className="mb-2">
              {/* Nível 1 — mês */}
              <Pressable onPress={() => setOpenMonth(monthOpen ? null : m.key)} className="flex-row items-center">
                {monthOpen ? <ChevronDown color="#0891b2" size={20} /> : <ChevronRight color="#0891b2" size={20} />}
                <View className="flex-1 ml-1">
                  <Text className="text-ink font-bold text-base">{monthLabel(m.key)}</Text>
                  <Text className="text-muted text-xs mt-0.5">
                    Pagas {formatCurrency(m.paid)}
                    {m.open > 0 ? ` · Em aberto ${formatCurrency(m.open)}` : ''}
                  </Text>
                </View>
                <Text className="text-brand-700 font-bold">{formatCurrency(m.total)}</Text>
              </Pressable>

              {/* Nível 2 — tipo de despesa dentro do mês */}
              {monthOpen && (
                <View className="mt-3 border-t border-line pt-1">
                  {m.types.map((t) => {
                    const tKey = `${m.key}:${t.type}`;
                    const typeOpen = !!openTypes[tKey];
                    return (
                      <View key={tKey} className="border-b border-line/60 py-1.5">
                        <Pressable onPress={() => setOpenTypes((p) => ({ ...p, [tKey]: !p[tKey] }))}
                          className="flex-row items-center py-1">
                          {typeOpen ? <ChevronDown color="#64748b" size={16} /> : <ChevronRight color="#64748b" size={16} />}
                          <Text className="text-ink font-semibold ml-1 flex-1">{typeLabel(t.type)}</Text>
                          <View className="items-end">
                            <Text className="text-ink font-bold text-sm">{formatCurrency(t.total)}</Text>
                            <Text className="text-muted text-[10px]">
                              {t.items.length} lançamento(s){t.open > 0 ? ` · ${formatCurrency(t.open)} em aberto` : ''}
                            </Text>
                          </View>
                        </Pressable>

                        {/* Nível 3 — lançamentos daquele tipo */}
                        {typeOpen && t.items.map((item) => (
                          <View key={item.id} className="flex-row justify-between items-start py-2 pl-5 border-t border-line/40">
                            <View className="flex-1 pr-2">
                              <View className="flex-row items-center gap-2">
                                <Text className="text-ink text-sm font-medium">{formatDate(item.date)}</Text>
                                {item.is_paid ? <Pill text="Paga" tone="green" /> : <Pill text="Em aberto" tone="red" />}
                              </View>
                              {item.description ? <Text className="text-muted text-xs mt-0.5">{item.description}</Text> : null}
                              {item.supplier_name ? <Text className="text-brand-700 text-xs mt-0.5">{item.supplier_name}</Text> : null}
                              {item.helper_name ? <Text className="text-brand-700 text-xs mt-0.5">{item.helper_name}</Text> : null}
                            </View>
                            <View className="items-end">
                              <Text className="text-ink font-bold text-sm">{formatCurrency(item.value)}</Text>
                              <View className="flex-row gap-1 mt-1.5">
                                <Pressable onPress={() => togglePaid(item)} className="bg-slate-100 p-2 rounded-xl">
                                  <Check color={item.is_paid ? '#16a34a' : '#475569'} size={15} />
                                </Pressable>
                                <Pressable onPress={() => remove(item.id)} className="bg-red-50 p-2 rounded-xl">
                                  <Trash2 color="#dc2626" size={15} />
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        }}
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
  const [dateStr, setDateStr] = useState('');
  const [paid, setPaid] = useState(true);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setType('Produto'); setDescription(''); setValue('');
      setDateStr(toDateInput(new Date())); setPaid(true); setSupplierId(null);
    }
  }, [visible]);

  async function save() {
    const v = Number(value.replace(',', '.')) || 0;
    if (v <= 0) return Alert.alert('Atenção', 'Informe um valor válido.');
    const d = dateStr ? parseDateTime(dateStr, '12:00') : new Date();
    if (!d) return Alert.alert('Atenção', 'Data inválida. Use DD/MM/AAAA.');
    setSaving(true);
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      await api.post('/expenses', {
        type, description: description || null, value: v, is_paid: paid,
        date: d.toISOString(),
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
          <Input label="Data" value={dateStr} onChangeText={setDateStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />

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
