import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Plus, X, Trash2, Pencil, Power, HandCoins, ArrowLeft, BadgeCheck, ReceiptText } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, parseDateTime, toDateInput } from '@/lib/utils';
import { HELPER_EXPENSE_TYPES, HELPER_TYPE_LABEL, type Helper, type HelperEntry } from '@/lib/types';

const DEBIT_TYPES = HELPER_EXPENSE_TYPES.filter((t) => t.kind === 'debito').map((t) => t.id);

export default function HelpersScreen() {
  const [items, setItems] = useState<Helper[]>([]);
  const [editing, setEditing] = useState<Helper | null>(null);
  const [modal, setModal] = useState(false);
  const [launch, setLaunch] = useState<Helper | null>(null);
  const [settle, setSettle] = useState<Helper | null>(null);
  const [statement, setStatement] = useState<Helper | null>(null);

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
        renderItem={({ item }) => {
          const saldo = item.saldo ?? 0;
          const quitado = saldo <= 0.004;
          return (
            <Card className={`mb-2 ${item.active ? '' : 'opacity-60'}`}>
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-ink font-semibold text-base">{item.name}</Text>
                    {!item.active && <Pill text="Inativo" tone="gray" />}
                  </View>
                  <Text className="text-muted text-sm mt-0.5">Diária: {formatCurrency(item.daily_rate)}</Text>
                  <Text className="text-muted text-xs mt-0.5">
                    Lançado {formatCurrency(item.total_debitos ?? 0)} · Pago{' '}
                    {formatCurrency((item.total_vales ?? 0) + (item.total_pagamentos ?? 0) + (item.total_debitos_pagos ?? 0))}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-muted text-xs">Saldo a pagar</Text>
                  <Text className={`font-bold text-base ${quitado ? 'text-green-700' : 'text-red-600'}`}>
                    {formatCurrency(saldo)}
                  </Text>
                  {quitado ? <Text className="text-green-700 text-[10px]">quitado</Text> : null}
                </View>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Pressable onPress={() => setLaunch(item)} className="flex-row items-center bg-brand-50 px-3 py-2 rounded-xl">
                  <HandCoins color="#0891b2" size={16} />
                  <Text className="text-brand-700 font-semibold text-xs ml-1">Lançar</Text>
                </Pressable>
                <Pressable
                  onPress={() => (quitado
                    ? Alert.alert('Tudo certo', 'Este colaborador não tem saldo em aberto.')
                    : setSettle(item))}
                  className={`flex-row items-center px-3 py-2 rounded-xl ${quitado ? 'bg-slate-100' : 'bg-green-600'}`}>
                  <BadgeCheck color={quitado ? '#94a3b8' : '#fff'} size={16} />
                  <Text className={`font-semibold text-xs ml-1 ${quitado ? 'text-slate-400' : 'text-white'}`}>Pagar</Text>
                </Pressable>
                <Pressable onPress={() => setStatement(item)} className="bg-slate-100 p-2 rounded-xl"><ReceiptText color="#475569" size={16} /></Pressable>
                <Pressable onPress={() => openEdit(item)} className="bg-slate-100 p-2 rounded-xl"><Pencil color="#475569" size={16} /></Pressable>
                <Pressable onPress={() => toggleActive(item)} className="bg-slate-100 p-2 rounded-xl"><Power color={item.active ? '#16a34a' : '#94a3b8'} size={16} /></Pressable>
                <Pressable onPress={() => remove(item)} className="ml-auto bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={16} /></Pressable>
              </View>
            </Card>
          );
        }}
      />

      <HelperModal visible={modal} helper={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />
      <LaunchModal helper={launch} onClose={() => setLaunch(null)} onSaved={() => { setLaunch(null); load(); }} />
      <SettleModal helper={settle} onClose={() => setSettle(null)} onSaved={() => { setSettle(null); load(); }} />
      <StatementModal helper={statement} onClose={() => setStatement(null)} />
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
  const [dateStr, setDateStr] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (helper) {
      setType('AjudaDiaria');
      setValue(helper.daily_rate ? String(helper.daily_rate) : '');
      setDateStr(toDateInput(new Date()));
    }
  }, [helper]);

  const kind = HELPER_EXPENSE_TYPES.find((t) => t.id === type)?.kind || 'debito';

  async function save() {
    if (!helper) return;
    const v = Number(value.replace(',', '.')) || 0;
    if (v <= 0) return Alert.alert('Atenção', 'Informe um valor.');
    const d = dateStr ? parseDateTime(dateStr, '12:00') : new Date();
    if (!d) return Alert.alert('Atenção', 'Data inválida. Use DD/MM/AAAA.');
    setSaving(true);
    try {
      await api.post('/expenses', {
        type,
        value: v,
        date: d.toISOString(),
        description: `${HELPER_TYPE_LABEL[type] || type}: ${helper.name}`,
        helper_id: helper.id,
        helper_name: helper.name,
        // Débito (diária/bônus) entra como despesa EM ABERTO — é o que a lavagem
        // deve. Crédito (vale/pagamento) já saiu do caixa, então entra como paga.
        is_paid: kind === 'credito',
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
          <Input label="Data" value={dateStr} onChangeText={setDateStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
          <Text className="text-muted text-xs mb-3">
            Diária e bônus aumentam o saldo a pagar. Vale e pagamento abatem o saldo —
            assim como marcar a despesa como paga na aba Despesas.
          </Text>
          <Button title="Registrar lançamento" onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Liquidação: paga o saldo devido (total ou parcial). O servidor baixa os
// lançamentos em aberto do mais antigo para o mais novo e registra a sobra.
function SettleModal({
  helper, onClose, onSaved,
}: { helper: Helper | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [saving, setSaving] = useState(false);
  const saldo = helper?.saldo ?? 0;

  React.useEffect(() => {
    if (helper) {
      setValue(String((helper.saldo ?? 0).toFixed(2)));
      setDateStr(toDateInput(new Date()));
    }
  }, [helper]);

  async function save() {
    if (!helper) return;
    const v = Number(value.replace(',', '.')) || 0;
    if (v <= 0) return Alert.alert('Atenção', 'Informe um valor.');
    const d = dateStr ? parseDateTime(dateStr, '12:00') : new Date();
    setSaving(true);
    try {
      const r = await unwrap<any>(api.post(`/helpers/${helper.id}/settle`, {
        value: v,
        date: d ? d.toISOString() : null,
      }));
      Alert.alert(
        'Pagamento registrado',
        `Pago ${formatCurrency(r.paid)}. Saldo restante: ${formatCurrency(r.saldo)}.`
      );
      onSaved();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível registrar o pagamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!helper} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Pagar — {helper?.name}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Card className="mb-3">
            <Text className="text-muted text-xs">Saldo em aberto</Text>
            <Text className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(saldo)}</Text>
          </Card>
          <Input label="Valor a pagar (R$)" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0,00" />
          <Pressable onPress={() => setValue(String(saldo.toFixed(2)))} className="mb-3">
            <Text className="text-brand-700 font-medium text-sm">Pagar tudo ({formatCurrency(saldo)})</Text>
          </Pressable>
          <Input label="Data do pagamento" value={dateStr} onChangeText={setDateStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
          <Text className="text-muted text-xs mb-3">
            Os lançamentos em aberto são liquidados do mais antigo para o mais novo.
            Se sobrar troco, ele fica registrado como pagamento adiantado.
          </Text>
          <Button title="Registrar pagamento" onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function StatementModal({ helper, onClose }: { helper: Helper | null; onClose: () => void }) {
  const [items, setItems] = useState<HelperEntry[]>([]);
  const [saldo, setSaldo] = useState(0);

  React.useEffect(() => {
    if (!helper) return;
    setItems([]); setSaldo(helper.saldo ?? 0);
    unwrap<{ helper: Helper; items: HelperEntry[] }>(api.get(`/helpers/${helper.id}/statement`))
      .then((r) => { setItems(r?.items || []); setSaldo(r?.helper?.saldo ?? 0); })
      .catch(() => {});
  }, [helper]);

  return (
    <Modal visible={!!helper} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Extrato — {helper?.name}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Card className="mb-3">
            <Text className="text-muted text-xs">Saldo a pagar</Text>
            <Text className={`text-2xl font-bold mt-1 ${saldo > 0.004 ? 'text-red-600' : 'text-green-700'}`}>
              {formatCurrency(saldo)}
            </Text>
          </Card>
          {items.length === 0 ? (
            <Empty title="Sem lançamentos" subtitle="Diárias, bônus, vales e pagamentos aparecem aqui." />
          ) : (
            items.map((e) => {
              const debit = DEBIT_TYPES.includes(e.type);
              // Débito já pago não pesa mais no saldo — mostra como liquidado.
              const abate = !debit || e.is_paid;
              return (
                <Card key={e.id} className="mb-2">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-2">
                      <Text className="text-ink font-semibold text-sm">{HELPER_TYPE_LABEL[e.type] || e.type}</Text>
                      <Text className="text-muted text-xs mt-0.5">{formatDate(e.date)}</Text>
                      {e.description ? <Text className="text-muted text-xs mt-0.5">{e.description}</Text> : null}
                    </View>
                    <View className="items-end">
                      <Text className={`font-bold ${abate ? 'text-green-700' : 'text-red-600'}`}>
                        {abate ? '-' : '+'} {formatCurrency(e.value)}
                      </Text>
                      {debit ? <Pill text={e.is_paid ? 'Pago' : 'Em aberto'} tone={e.is_paid ? 'green' : 'red'} /> : null}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
