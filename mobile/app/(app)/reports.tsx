import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, X, FileDown, CheckCheck, ChevronDown } from 'lucide-react-native';
import { Button, Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { useApp } from '@/lib/stores/app';
import { generateReportPdf, type ReportRow } from '@/lib/services/report';
import { formatCurrency, formatDate, parseDateTime, toDateInput } from '@/lib/utils';
import type { Client } from '@/lib/types';

type ReportType = 'periodo' | 'cliente' | 'veiculo' | 'aberto';

const TYPES: { id: ReportType; label: string }[] = [
  { id: 'periodo', label: 'Por período' },
  { id: 'cliente', label: 'Por cliente' },
  { id: 'veiculo', label: 'Por tipo de veículo' },
  { id: 'aberto', label: 'Lavagens em aberto' },
];

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

export default function ReportsScreen() {
  const company = useApp((s) => s.company);
  const [type, setType] = useState<ReportType>('periodo');
  const [fromStr, setFromStr] = useState(toDateInput(startOfMonth()));
  const [toStr, setToStr] = useState(toDateInput(new Date()));
  const [client, setClient] = useState<Client | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [openItems, setOpenItems] = useState<{ id: string }[]>([]); // ids p/ baixa em massa
  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const usesClient = type === 'periodo' || type === 'cliente' || type === 'aberto';
  const usesDates = type !== 'aberto';

  const period = useMemo(() => (usesDates ? `${fromStr} a ${toStr}` : undefined), [usesDates, fromStr, toStr]);

  const buildRange = useCallback(() => {
    const from = parseDateTime(fromStr, '00:00');
    const to = parseDateTime(toStr, '23:59');
    return { from: from?.toISOString(), to: to ? new Date(to.getTime() + 59_000).toISOString() : undefined };
  }, [fromStr, toStr]);

  const run = useCallback(async () => {
    setLoading(true);
    setOpenItems([]);
    try {
      if (type === 'veiculo') {
        const { from, to } = buildRange();
        const r = await unwrap<any>(api.get('/reports/by-vehicle', { params: { from, to } }));
        setTitle('Lavagens por tipo de veículo');
        setRows((r.groups || []).map((g: any) => ({ left: g.make, sub: `${g.count} lavagem(ns)`, value: g.total })));
        setTotal(r.total || 0);
      } else if (type === 'aberto') {
        const r = await unwrap<any>(api.get('/reports/open', { params: { client_id: client?.id } }));
        setTitle(client ? `Em aberto — ${client.name}` : 'Lavagens em aberto (a receber)');
        setOpenItems((r.items || []).map((w: any) => ({ id: w.id })));
        setRows((r.items || []).map((w: any) => ({
          left: w.client_name || 'Sem cliente', sub: `${w.vehicle_info || ''} · ${formatDate(w.date)}`.trim(), value: Number(w.price) || 0, flag: '(Aberto)',
        })));
        setTotal(r.total || 0);
      } else {
        const { from, to } = buildRange();
        const r = await unwrap<any>(api.get('/reports/washes', { params: { from, to, client_id: client?.id } }));
        setTitle(client ? `Lavagens — ${client.name}` : 'Lavagens no período');
        setRows((r.items || []).map((w: any) => ({
          left: `${w.client_name || 'Sem cliente'}${w.vehicle_info ? ' · ' + w.vehicle_info : ''}`,
          sub: formatDate(w.date), value: Number(w.price) || 0, flag: w.is_charged ? undefined : '(Aberto)',
        })));
        setTotal(r.total || 0);
      }
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [type, client, buildRange]);

  useFocusEffect(useCallback(() => { run(); }, [run]));

  async function exportPdf() {
    if (!company?.name) {
      return Alert.alert('Cadastro incompleto', 'Preencha os dados da lavagem em Ajustes para gerar o PDF.');
    }
    setGenerating(true);
    try {
      await generateReportPdf(company, { title, period, rows, total });
    } catch {
      Alert.alert('Erro', 'Falha ao gerar PDF.');
    } finally {
      setGenerating(false);
    }
  }

  function confirmBulk() {
    if (!openItems.length) return;
    Alert.alert('Baixar pendências', `Confirmar recebimento de ${openItems.length} lavagem(ns)?\n\nTotal: ${formatCurrency(total)}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          try {
            await Promise.all(openItems.map((w) => api.patch(`/washes/${w.id}/charge`)));
            Alert.alert('Pronto', 'Recebimentos baixados.');
            run();
          } catch { Alert.alert('Erro', 'Falha ao baixar alguns lançamentos.'); }
        },
      },
    ]);
  }

  const presets: { label: string; apply: () => void }[] = [
    { label: 'Hoje', apply: () => { const t = toDateInput(new Date()); setFromStr(t); setToStr(t); } },
    { label: 'Este mês', apply: () => { setFromStr(toDateInput(startOfMonth())); setToStr(toDateInput(new Date())); } },
    { label: 'Mês passado', apply: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); setFromStr(toDateInput(s)); setToStr(toDateInput(e)); } },
    { label: '90 dias', apply: () => { const e = new Date(); const s = new Date(e.getTime() - 90 * 864e5); setFromStr(toDateInput(s)); setToStr(toDateInput(e)); } },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
        <Text className="text-2xl font-bold text-ink">Relatórios</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 8 }}>
        <Text className="text-muted font-medium mb-2 text-sm">Tipo de relatório</Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {TYPES.map((t) => (
            <Pressable key={t.id} onPress={() => { setType(t.id); if (t.id === 'veiculo') setClient(null); }}
              className={`px-3 py-2 rounded-xl border ${type === t.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
              <Text className={type === t.id ? 'text-white font-semibold' : 'text-ink'}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {usesClient && (
          <Pressable onPress={() => setPickerOpen(true)} className="flex-row items-center justify-between bg-white border border-line rounded-2xl px-4 py-3 mb-3">
            <Text className={client ? 'text-ink' : 'text-muted'}>{client ? client.name : 'Filtrar por cliente (opcional)'}</Text>
            <View className="flex-row items-center">
              {client ? <Pressable onPress={() => setClient(null)} className="mr-2"><X color="#94a3b8" size={18} /></Pressable> : null}
              <ChevronDown color="#94a3b8" size={18} />
            </View>
          </Pressable>
        )}

        {usesDates && (
          <>
            <View className="flex-row gap-3">
              <View className="flex-1"><Input label="De" value={fromStr} onChangeText={setFromStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
              <View className="flex-1"><Input label="Até" value={toStr} onChangeText={setToStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
            </View>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {presets.map((p) => (
                <Pressable key={p.label} onPress={p.apply} className="px-3 py-1.5 rounded-full bg-brand-50">
                  <Text className="text-brand-700 text-xs font-semibold">{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Button title="Gerar relatório" onPress={run} loading={loading} variant="ghost" className="mb-3" />

        <Card className="mb-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-ink font-bold">{title || 'Relatório'}</Text>
          </View>
          <Text className="text-2xl font-bold text-green-700 mb-2">{formatCurrency(total)}</Text>
          {rows.length === 0 ? (
            <Text className="text-muted text-center py-3">Nenhum registro no filtro selecionado.</Text>
          ) : (
            rows.map((r, i) => (
              <View key={i} className="flex-row justify-between py-2 border-t border-line">
                <View className="flex-1 pr-2">
                  <Text className="text-ink text-sm font-medium">{r.left}</Text>
                  {r.sub ? <Text className="text-muted text-xs">{r.sub}</Text> : null}
                </View>
                <Text className={`font-semibold text-sm ${r.flag ? 'text-red-600' : 'text-ink'}`}>{formatCurrency(r.value)}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <View className="px-4 pb-3 pt-2 border-t border-line bg-bg" style={{ gap: 8 }}>
        {type === 'aberto' && openItems.length > 0 && (
          <Pressable onPress={confirmBulk} className="flex-row items-center justify-center bg-green-600 rounded-2xl py-3">
            <CheckCheck color="#fff" size={20} />
            <Text className="text-white font-semibold ml-2">Confirmar recebimento (todos)</Text>
          </Pressable>
        )}
        <Pressable onPress={exportPdf} disabled={generating || rows.length === 0}
          className={`flex-row items-center justify-center bg-brand-600 rounded-2xl py-3 ${generating || rows.length === 0 ? 'opacity-50' : ''}`}>
          <FileDown color="#fff" size={20} />
          <Text className="text-white font-semibold ml-2">{generating ? 'Gerando…' : 'Gerar PDF e compartilhar'}</Text>
        </Pressable>
      </View>

      <ClientPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(c) => { setClient(c); setPickerOpen(false); }} />
    </SafeAreaView>
  );
}

function ClientPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: Client) => void }) {
  const [items, setItems] = useState<Client[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async (q = '') => {
    try {
      const data = await unwrap<Client[]>(api.get(`/clients${q ? `?search=${encodeURIComponent(q)}` : ''}`));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  React.useEffect(() => { if (visible) { setSearch(''); load(); } }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Escolher cliente</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <View className="px-4 py-2"><Input placeholder="Buscar" value={search} onChangeText={(t) => { setSearch(t); load(t); }} className="mb-0" /></View>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          ListEmptyComponent={<Empty title="Nenhum cliente" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item)} className="bg-white rounded-2xl p-4 border border-line mb-2">
              <Text className="text-ink font-semibold">{item.name}</Text>
              {item.phone ? <Text className="text-muted text-sm">{item.phone}</Text> : null}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
