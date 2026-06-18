import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Plus, X, Check, Trash2, FileDown } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { useApp } from '@/lib/stores/app';
import { gateAction } from '@/lib/services/gate';
import { generateAndShare } from '@/lib/services/receipt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PAYMENT_TYPES, type Wash, type Service } from '@/lib/types';

export default function WashesScreen() {
  const { services, usage, company, loadUsage } = useApp();
  const [items, setItems] = useState<Wash[]>([]);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await unwrap<Wash[]>(api.get('/washes'));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); loadUsage(); }, [load]));

  async function emitReceipt(w: Wash) {
    if (!company?.name) {
      return Alert.alert('Cadastro incompleto', 'Preencha os dados da lavagem em Ajustes antes de emitir recibos.');
    }
    const gate = await gateAction('receipt', usage);
    if (!gate.allow) return;
    try {
      const items = (w.services || []).map((s) => ({ name: s.name, price: Number(s.price) || 0 }));
      if (!items.length) items.push({ name: 'Serviço de lavagem', price: w.price });
      const doc = await unwrap<any>(
        api.post('/documents', {
          kind: 'receipt',
          client_name: w.client_name,
          vehicle_info: w.vehicle_info,
          items,
          total: w.price,
          payment_type: w.payment_type,
          ad_watched: gate.adWatched,
        })
      );
      await generateAndShare(company, {
        kind: 'receipt',
        number: doc.number,
        clientName: w.client_name,
        vehicleInfo: w.vehicle_info,
        items,
        total: w.price,
        paymentType: w.payment_type,
        date: w.date,
      });
      loadUsage();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível emitir o recibo.');
    }
  }

  async function removeWash(id: string) {
    Alert.alert('Remover lavagem', 'Confirma a exclusão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/washes/${id}`); load(); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Lavagens</Text>
        <Pressable onPress={() => setModal(true)} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>

      {usage && !usage.isPremium && (
        <Pressable onPress={() => router.push('/premium')} className="mx-4 mb-2 bg-brand-50 rounded-xl px-3 py-2">
          <Text className="text-brand-800 text-xs">
            Plano grátis: {usage.washes.today}/{usage.limits.washesPerDay} lavagens hoje.{' '}
            {usage.washes.requiresAd ? 'Próxima exige vídeo.' : `${usage.washes.remaining} restantes sem anúncio.`}
          </Text>
        </Pressable>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhuma lavagem registrada" subtitle="Toque em + para registrar a primeira." />}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <Text className="text-ink font-semibold">{item.client_name || 'Sem cliente'}</Text>
                {item.vehicle_info ? <Text className="text-muted text-sm">{item.vehicle_info}</Text> : null}
                <Text className="text-muted text-xs mt-1">{formatDate(item.date)} · {item.payment_type || '—'}</Text>
              </View>
              <View className="items-end">
                <Text className="text-ink font-bold text-base">{formatCurrency(item.price)}</Text>
                {!item.is_charged && <Pill text="Em aberto" tone="red" />}
              </View>
            </View>
            <View className="flex-row gap-2 mt-3">
              <Pressable onPress={() => emitReceipt(item)} className="flex-row items-center bg-brand-50 px-3 py-2 rounded-xl">
                <FileDown color="#0891b2" size={16} />
                <Text className="text-brand-700 font-semibold text-xs ml-1">Recibo</Text>
              </Pressable>
              <Pressable onPress={() => api.patch(`/washes/${item.id}/charge`).then(load)} className="flex-row items-center bg-slate-100 px-3 py-2 rounded-xl">
                <Check color="#475569" size={16} />
                <Text className="text-slate-600 font-semibold text-xs ml-1">{item.is_charged ? 'Pago' : 'Marcar pago'}</Text>
              </Pressable>
              <Pressable onPress={() => removeWash(item.id)} className="ml-auto bg-red-50 px-3 py-2 rounded-xl">
                <Trash2 color="#dc2626" size={16} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <WashFormModal visible={modal} onClose={() => setModal(false)} services={services} onSaved={() => { setModal(false); load(); loadUsage(); }} />
    </SafeAreaView>
  );
}

function WashFormModal({
  visible, onClose, services, onSaved,
}: { visible: boolean; onClose: () => void; services: Service[]; onSaved: () => void }) {
  const usage = useApp((s) => s.usage);
  const [clientName, setClientName] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualPrice, setManualPrice] = useState('');
  const [payment, setPayment] = useState('Dinheiro');
  const [saving, setSaving] = useState(false);

  const chosen = services.filter((s) => selected[s.id]);
  const total = manualPrice ? Number(manualPrice.replace(',', '.')) || 0 : chosen.reduce((a, s) => a + Number(s.price), 0);

  function reset() {
    setClientName(''); setVehicleInfo(''); setSelected({}); setManualPrice(''); setPayment('Dinheiro');
  }

  async function save() {
    const gate = await gateAction('wash', usage);
    if (!gate.allow) return;
    setSaving(true);
    try {
      await api.post('/washes', {
        client_name: clientName || null,
        vehicle_info: vehicleInfo || null,
        price: total,
        payment_type: payment,
        is_charged: payment !== 'Faturamento Posterior',
        services: chosen.map((s) => ({ id: s.id, name: s.name, price: Number(s.price) })),
        ad_watched: gate.adWatched,
      });
      reset();
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
          <Text className="text-lg font-bold text-ink">Nova lavagem</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Input label="Cliente (nome)" value={clientName} onChangeText={setClientName} placeholder="Opcional" />
          <Input label="Veículo / placa" value={vehicleInfo} onChangeText={setVehicleInfo} placeholder="Ex.: Gol prata ABC1D23" />

          <Text className="text-muted font-medium mb-2 text-sm">Serviços</Text>
          {services.length === 0 && (
            <Text className="text-muted text-xs mb-2">Cadastre serviços em Ajustes para selecioná-los aqui.</Text>
          )}
          <View className="flex-row flex-wrap gap-2 mb-3">
            {services.map((s) => {
              const on = !!selected[s.id];
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelected((p) => ({ ...p, [s.id]: !p[s.id] }))}
                  className={`px-3 py-2 rounded-xl border ${on ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}
                >
                  <Text className={on ? 'text-white font-semibold' : 'text-ink'}>{s.name} · {formatCurrency(s.price)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Valor total (deixe vazio p/ somar serviços)"
            value={manualPrice}
            onChangeText={setManualPrice}
            keyboardType="decimal-pad"
            placeholder={formatCurrency(total)}
          />

          <Text className="text-muted font-medium mb-2 text-sm">Forma de pagamento</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {PAYMENT_TYPES.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPayment(p)}
                className={`px-3 py-2 rounded-xl border ${payment === p ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}
              >
                <Text className={payment === p ? 'text-white font-semibold' : 'text-ink'}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <View className="bg-white rounded-2xl p-4 border border-line mb-4 flex-row justify-between items-center">
            <Text className="text-muted">Total</Text>
            <Text className="text-2xl font-bold text-brand-700">{formatCurrency(total)}</Text>
          </View>

          <Button title="Registrar lavagem" onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
