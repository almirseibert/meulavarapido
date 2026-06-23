import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Plus, X, FileDown, Trash2 } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { useApp } from '@/lib/stores/app';
import { gateAction } from '@/lib/services/gate';
import { generateAndShare } from '@/lib/services/receipt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ClientVehiclePicker, EMPTY_SELECTION, type PickerSelection } from '@/components/ClientPicker';
import { PAYMENT_TYPES, type AppDocument, type Service } from '@/lib/types';

export default function DocumentsScreen() {
  const { services, usage, company, loadUsage } = useApp();
  const [tab, setTab] = useState<'receipt' | 'quote'>('quote');
  const [items, setItems] = useState<AppDocument[]>([]);
  const [modal, setModal] = useState(false);

  const load = useCallback(async (kind: 'receipt' | 'quote') => {
    try {
      const data = await unwrap<AppDocument[]>(api.get(`/documents?kind=${kind}`));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(tab); loadUsage(); }, [load, tab]));

  async function reprint(d: AppDocument) {
    if (!company) return;
    await generateAndShare(company, {
      kind: d.kind, number: d.number, clientName: d.client_name, vehicleInfo: d.vehicle_info,
      items: d.items, total: d.total, paymentType: d.payment_type, date: d.created_at,
    });
  }

  const section = usage ? (tab === 'quote' ? usage.quotes : usage.receipts) : null;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Documentos</Text>
        <Pressable onPress={() => setModal(true)} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>

      <View className="flex-row mx-4 mb-2 bg-slate-100 rounded-xl p-1">
        {(['quote', 'receipt'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} className={`flex-1 py-2 rounded-lg ${tab === k ? 'bg-white' : ''}`}>
            <Text className={`text-center font-semibold ${tab === k ? 'text-brand-700' : 'text-muted'}`}>
              {k === 'quote' ? 'Orçamentos' : 'Recibos'}
            </Text>
          </Pressable>
        ))}
      </View>

      {usage && !usage.isPremium && section && (
        <Pressable onPress={() => router.push('/premium')} className="mx-4 mb-2 bg-brand-50 rounded-xl px-3 py-2">
          <Text className="text-brand-800 text-xs">
            Plano grátis: {section.total}/{tab === 'quote' ? usage.limits.quotes : usage.limits.receipts} emitidos.{' '}
            {section.requiresAd ? 'Próximo exige vídeo.' : `${section.remaining} restantes sem anúncio.`}
          </Text>
        </Pressable>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nada emitido ainda" subtitle="Toque em + para criar." />}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-ink font-semibold">Nº {String(item.number).padStart(4, '0')}</Text>
                  {item.via_ad ? <Pill text="via vídeo" tone="gray" /> : null}
                </View>
                <Text className="text-muted text-sm">{item.client_name || 'Sem cliente'}</Text>
                <Text className="text-muted text-xs mt-0.5">{formatDate(item.created_at)}</Text>
              </View>
              <View className="items-end justify-between">
                <Text className="text-ink font-bold">{formatCurrency(item.total)}</Text>
                <Pressable onPress={() => reprint(item)} className="flex-row items-center bg-brand-50 px-3 py-1.5 rounded-xl mt-1">
                  <FileDown color="#0891b2" size={15} />
                  <Text className="text-brand-700 font-semibold text-xs ml-1">PDF</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        )}
      />

      <DocFormModal
        visible={modal}
        kind={tab}
        services={services}
        onClose={() => setModal(false)}
        onSaved={() => { setModal(false); load(tab); loadUsage(); }}
      />
    </SafeAreaView>
  );
}

function DocFormModal({
  visible, kind, services, onClose, onSaved,
}: { visible: boolean; kind: 'receipt' | 'quote'; services: Service[]; onClose: () => void; onSaved: () => void }) {
  const { usage, company } = useApp();
  const [sel, setSel] = useState<PickerSelection>(EMPTY_SELECTION);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [payment, setPayment] = useState('Dinheiro');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) { setSel(EMPTY_SELECTION); setSelected({}); setPayment('Dinheiro'); setObs(''); }
  }, [visible]);

  const chosen = services.filter((s) => selected[s.id]);
  const total = chosen.reduce((a, s) => a + Number(s.price), 0);

  async function save() {
    if (!company?.name) {
      return Alert.alert('Cadastro incompleto', 'Preencha os dados da lavagem em Ajustes antes de emitir.');
    }
    if (!chosen.length) return Alert.alert('Atenção', 'Selecione ao menos um serviço.');
    const gate = await gateAction(kind, usage);
    if (!gate.allow) return;
    setSaving(true);
    try {
      const items = chosen.map((s) => ({ name: s.name, price: Number(s.price) }));
      const doc = await unwrap<any>(
        api.post('/documents', {
          kind, client_name: sel.client_name, vehicle_info: sel.vehicle_info, items, total,
          payment_type: payment, observations: obs, ad_watched: gate.adWatched,
        })
      );
      await generateAndShare(company, {
        kind, number: doc.number, clientName: sel.client_name, vehicleInfo: sel.vehicle_info, items, total, paymentType: payment, observations: obs,
      });
      onSaved();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível emitir.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">{kind === 'quote' ? 'Novo orçamento' : 'Novo recibo'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <ClientVehiclePicker value={sel} onChange={setSel} />

          <Text className="text-muted font-medium mb-2 text-sm">Serviços</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {services.map((s) => {
              const on = !!selected[s.id];
              return (
                <Pressable key={s.id} onPress={() => setSelected((p) => ({ ...p, [s.id]: !p[s.id] }))}
                  className={`px-3 py-2 rounded-xl border ${on ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                  <Text className={on ? 'text-white font-semibold' : 'text-ink'}>{s.name} · {formatCurrency(s.price)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-muted font-medium mb-2 text-sm">Pagamento</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {PAYMENT_TYPES.map((p) => (
              <Pressable key={p} onPress={() => setPayment(p)}
                className={`px-3 py-2 rounded-xl border ${payment === p ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={payment === p ? 'text-white font-semibold' : 'text-ink'}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <Input label="Observações" value={obs} onChangeText={setObs} placeholder="Opcional" multiline />

          <View className="bg-white rounded-2xl p-4 border border-line my-3 flex-row justify-between items-center">
            <Text className="text-muted">Total</Text>
            <Text className="text-2xl font-bold text-brand-700">{formatCurrency(total)}</Text>
          </View>

          <Button title={kind === 'quote' ? 'Gerar orçamento (PDF)' : 'Gerar recibo (PDF)'} onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
