import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Check, Trash2, FileDown, Truck, Pencil, SlidersHorizontal, ChevronDown, ChevronRight, CheckCheck } from 'lucide-react-native';
import { Button, Input, Card, Pill, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { useApp } from '@/lib/stores/app';
import { generateAndShare } from '@/lib/services/receipt';
import { formatCurrency, formatDate, formatTime, parseDateTime, toDateInput } from '@/lib/utils';
import { ClientVehiclePicker, EMPTY_SELECTION, type PickerSelection } from '@/components/ClientPicker';
import { PAYMENT_TYPES, type Wash, type Service } from '@/lib/types';

interface Filters {
  fromStr: string;
  toStr: string;
  client_id: string | null;
  client_name: string;
  vehicle_id: string | null;
  payment_type: string | null;
  status: 'all' | 'open' | 'paid';
  credit_only: boolean;
}

const EMPTY_FILTERS: Filters = {
  fromStr: '', toStr: '', client_id: null, client_name: '', vehicle_id: null,
  payment_type: null, status: 'all', credit_only: false,
};

function startOfDayISO(dateStr: string): string | null {
  const d = parseDateTime(dateStr, '00:00');
  return d ? d.toISOString() : null;
}
function endOfDayISO(dateStr: string): string | null {
  const d = parseDateTime(dateStr, '23:59');
  return d ? d.toISOString() : null;
}
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WashesScreen() {
  const { services, company } = useApp();
  const [items, setItems] = useState<Wash[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Wash | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const buildParams = useCallback((f: Filters) => {
    const params: Record<string, string> = {};
    const from = startOfDayISO(f.fromStr); if (from) params.from = from;
    const to = endOfDayISO(f.toStr); if (to) params.to = to;
    if (f.client_id) params.client_id = f.client_id;
    if (f.vehicle_id) params.vehicle_id = f.vehicle_id;
    if (f.payment_type) params.payment_type = f.payment_type;
    if (f.status !== 'all') params.status = f.status;
    if (f.credit_only) params.credit_only = '1';
    return params;
  }, []);

  const load = useCallback(async (f: Filters) => {
    try {
      const data = await unwrap<Wash[]>(api.get('/washes', { params: buildParams(f) }));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, [buildParams]);

  useFocusEffect(useCallback(() => { load(filters); }, [load, filters]));

  // Agrupa por dia: cada linha-resumo expande para as lavagens do dia.
  const groups = useMemo(() => {
    const map: Record<string, Wash[]> = {};
    for (const w of items) (map[dayKey(w.date)] ||= []).push(w);
    return Object.entries(map)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, list]) => {
        const received = list.filter((w) => w.is_charged).reduce((a, w) => a + Number(w.price || 0), 0);
        const aprazo = list.filter((w) => !w.is_charged).reduce((a, w) => a + Number(w.price || 0), 0);
        return { key, list, count: list.length, received, aprazo, date: list[0].date };
      });
  }, [items]);

  const filtersActive =
    !!(filters.fromStr || filters.toStr || filters.client_id || filters.payment_type ||
       filters.status !== 'all' || filters.credit_only);

  async function emitReceipt(w: Wash) {
    if (!company?.name) {
      return Alert.alert('Cadastro incompleto', 'Preencha os dados da lavagem em Ajustes antes de emitir recibos.');
    }
    try {
      const its = (w.services || []).map((s) => ({ name: s.name, price: Number(s.price) || 0 }));
      if (!its.length) its.push({ name: 'Serviço de lavagem', price: w.price });
      const doc = await unwrap<any>(
        api.post('/documents', {
          kind: 'receipt', client_name: w.client_name, vehicle_info: w.vehicle_info,
          items: its, total: w.price, payment_type: w.payment_type,
        })
      );
      await generateAndShare(company, {
        kind: 'receipt', number: doc.number, clientName: w.client_name, vehicleInfo: w.vehicle_info,
        items: its, total: w.price, paymentType: w.payment_type, date: w.date,
      });
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível emitir o recibo.');
    }
  }

  function removeWash(id: string) {
    Alert.alert('Remover lavagem', 'Confirma a exclusão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/washes/${id}`); load(filters); } },
    ]);
  }

  function settleBatch() {
    const openItems = items.filter((w) => !w.is_charged);
    if (!openItems.length) return Alert.alert('Nada a baixar', 'Não há lavagens em aberto no filtro atual.');
    const total = openItems.reduce((a, w) => a + Number(w.price || 0), 0);
    Alert.alert(
      'Baixa em lote',
      `Marcar ${openItems.length} lavagem(ns) em aberto (${formatCurrency(total)}) como pagas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: async () => {
          try {
            await api.post('/washes/settle', { ids: openItems.map((w) => w.id) });
            load(filters);
          } catch (e) {
            Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível dar baixa.');
          }
        } },
      ]
    );
  }

  function openNew() { setEditing(null); setFormOpen(true); }
  function openEdit(w: Wash) { setEditing(w); setFormOpen(true); }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-ink">Lavagens</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={() => setFilterOpen(true)} className={`w-11 h-11 rounded-full items-center justify-center ${filtersActive ? 'bg-brand-600' : 'bg-slate-100'}`}>
            <SlidersHorizontal color={filtersActive ? '#fff' : '#475569'} size={20} />
          </Pressable>
          <Pressable onPress={openNew} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
            <Plus color="#fff" size={22} />
          </Pressable>
        </View>
      </View>

      {filtersActive && (
        <View className="flex-row items-center justify-between px-4 mb-2">
          <Text className="text-muted text-xs flex-1" numberOfLines={1}>
            Filtro ativo{filters.client_name ? ` · ${filters.client_name}` : ''}{filters.credit_only ? ' · a prazo' : ''}{filters.status === 'open' ? ' · em aberto' : filters.status === 'paid' ? ' · pagas' : ''}
          </Text>
          <Pressable onPress={() => setFilters(EMPTY_FILTERS)}><Text className="text-red-500 text-xs ml-2">Limpar</Text></Pressable>
        </View>
      )}

      {items.some((w) => !w.is_charged) && (
        <Pressable onPress={settleBatch} className="mx-4 mb-2 flex-row items-center justify-center bg-green-600 rounded-xl py-2.5">
          <CheckCheck color="#fff" size={18} />
          <Text className="text-white font-semibold ml-1.5">Dar baixa em lote (em aberto do filtro)</Text>
        </Pressable>
      )}

      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhuma lavagem" subtitle="Toque em + para registrar ou ajuste os filtros." />}
        renderItem={({ item: g }) => {
          const isOpen = !!expanded[g.key];
          return (
            <Card className="mb-2">
              <Pressable onPress={() => setExpanded((p) => ({ ...p, [g.key]: !p[g.key] }))} className="flex-row items-center">
                {isOpen ? <ChevronDown color="#0891b2" size={20} /> : <ChevronRight color="#0891b2" size={20} />}
                <View className="flex-1 ml-1">
                  <Text className="text-ink font-bold text-base">{formatDate(g.date)}</Text>
                  <Text className="text-muted text-xs mt-0.5">
                    {g.count} lavagem(ns) · Recebido {formatCurrency(g.received)}
                    {g.aprazo > 0 ? ` · A prazo ${formatCurrency(g.aprazo)}` : ''}
                  </Text>
                </View>
                <Text className="text-brand-700 font-bold">{formatCurrency(g.received + g.aprazo)}</Text>
              </Pressable>

              {isOpen && (
                <View className="mt-3 border-t border-line pt-2">
                  {g.list.map((item) => (
                    <View key={item.id} className="py-2 border-b border-line/60">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-2">
                          <Text className="text-ink font-semibold">{item.client_name || 'Sem cliente'}</Text>
                          {item.vehicle_info ? <Text className="text-muted text-sm">{item.vehicle_info}</Text> : null}
                          {item.services?.length ? (
                            <Text className="text-muted text-xs mt-0.5">{item.services.map((s) => s.name).join(', ')}</Text>
                          ) : null}
                          <Text className="text-muted text-xs mt-0.5">{formatTime(item.date)} · {item.payment_type || '—'}</Text>
                          {item.observations ? <Text className="text-muted text-xs italic mt-0.5">Obs: {item.observations}</Text> : null}
                        </View>
                        <View className="items-end">
                          <Text className="text-ink font-bold">{formatCurrency(item.price)}</Text>
                          {!item.is_charged && <Pill text="Em aberto" tone="red" />}
                        </View>
                      </View>
                      <View className="flex-row gap-2 mt-2">
                        <Pressable onPress={() => emitReceipt(item)} className="flex-row items-center bg-brand-50 px-3 py-1.5 rounded-xl">
                          <FileDown color="#0891b2" size={15} />
                          <Text className="text-brand-700 font-semibold text-xs ml-1">Recibo</Text>
                        </Pressable>
                        <Pressable onPress={() => api.patch(`/washes/${item.id}/charge`).then(() => load(filters))} className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl">
                          <Check color="#475569" size={15} />
                          <Text className="text-slate-600 font-semibold text-xs ml-1">{item.is_charged ? 'Pago' : 'Marcar pago'}</Text>
                        </Pressable>
                        <Pressable onPress={() => openEdit(item)} className="bg-slate-100 px-3 py-1.5 rounded-xl"><Pencil color="#475569" size={15} /></Pressable>
                        <Pressable onPress={() => removeWash(item.id)} className="ml-auto bg-red-50 px-3 py-1.5 rounded-xl"><Trash2 color="#dc2626" size={15} /></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        }}
      />

      <WashFormModal
        visible={formOpen}
        wash={editing}
        services={services}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(filters); }}
      />
      <FilterModal
        visible={filterOpen}
        initial={filters}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setFilters(f); setFilterOpen(false); }}
      />
    </SafeAreaView>
  );
}

// ---------------- Form (novo + edição) ----------------
function WashFormModal({
  visible, wash, services, onClose, onSaved,
}: { visible: boolean; wash: Wash | null; services: Service[]; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<PickerSelection>(EMPTY_SELECTION);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualPrice, setManualPrice] = useState('');
  const [payment, setPayment] = useState('Dinheiro');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [pickup, setPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupFee, setPickupFee] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    if (wash) {
      setSel({
        client_id: wash.client_id || null, vehicle_id: wash.vehicle_id || null,
        client_name: wash.client_name || '', vehicle_info: wash.vehicle_info || '',
        phone: wash.client_phone || null, allow_credit: wash.client_allow_credit,
      });
      const init: Record<string, boolean> = {};
      (wash.services || []).forEach((s) => { if (s.id) init[s.id] = true; });
      setSelected(init);
      setManualPrice(String(wash.price ?? ''));
      setPayment(wash.payment_type || 'Dinheiro');
      const d = new Date(wash.date);
      setDateStr(toDateInput(d));
      setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setPickup(!!wash.pickup);
      setPickupAddress(wash.pickup_address || '');
      setPickupFee(wash.pickup_fee ? String(wash.pickup_fee) : '');
      setObs(wash.observations || '');
    } else {
      setSel(EMPTY_SELECTION); setSelected({}); setManualPrice(''); setPayment('Dinheiro');
      setDateStr(''); setTimeStr(''); setPickup(false); setPickupAddress(''); setPickupFee('');
      setObs('');
    }
  }, [visible, wash]);

  const chosen = services.filter((s) => selected[s.id]);
  const fee = pickup ? Number(pickupFee.replace(',', '.')) || 0 : 0;
  const base = manualPrice ? Number(manualPrice.replace(',', '.')) || 0 : chosen.reduce((a, s) => a + Number(s.price), 0);
  const total = base + fee;

  async function save() {
    setSaving(true);
    try {
      const date = dateStr ? parseDateTime(dateStr, timeStr || '00:00')?.toISOString() : null;
      const body: any = {
        client_id: sel.client_id, vehicle_id: sel.vehicle_id,
        client_name: sel.client_name || null, vehicle_info: sel.vehicle_info || null,
        price: total, payment_type: payment,
        is_charged: payment !== 'Faturamento Posterior',
        services: chosen.map((s) => ({ id: s.id, name: s.name, price: Number(s.price) })),
        observations: obs.trim() || null,
        pickup, pickup_address: pickup ? pickupAddress || sel.address || null : null,
        pickup_fee: fee, pickup_status: pickup ? (wash?.pickup_status || 'a_buscar') : null,
      };
      if (date) body.date = date;
      if (wash) {
        await api.put(`/washes/${wash.id}`, body);
      } else {
        await api.post('/washes', body);
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
          <Text className="text-lg font-bold text-ink">{wash ? 'Editar lavagem' : 'Nova lavagem'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <ClientVehiclePicker value={sel} onChange={setSel} />

          <Text className="text-muted font-medium mb-2 text-sm">Serviços</Text>
          {services.length === 0 && (
            <Text className="text-muted text-xs mb-2">Cadastre serviços em Ajustes para selecioná-los aqui.</Text>
          )}
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

          <Input label="Valor total (deixe vazio p/ somar serviços)" value={manualPrice} onChangeText={setManualPrice}
            keyboardType="decimal-pad" placeholder={formatCurrency(total)} />

          {wash && (
            <View className="flex-row gap-3">
              <View className="flex-1"><Input label="Data" value={dateStr} onChangeText={setDateStr} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
              <View className="w-28"><Input label="Hora" value={timeStr} onChangeText={setTimeStr} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
            </View>
          )}

          <Text className="text-muted font-medium mb-2 text-sm">Forma de pagamento</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {PAYMENT_TYPES.map((p) => (
              <Pressable key={p} onPress={() => setPayment(p)}
                className={`px-3 py-2 rounded-xl border ${payment === p ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={payment === p ? 'text-white font-semibold' : 'text-ink'}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => setPickup((v) => !v)}
            className={`flex-row items-center justify-between rounded-2xl p-4 border mb-3 ${pickup ? 'bg-brand-50 border-brand-600' : 'bg-white border-line'}`}>
            <View className="flex-row items-center">
              <Truck color={pickup ? '#0891b2' : '#94a3b8'} size={20} />
              <Text className={`ml-2 font-semibold ${pickup ? 'text-brand-700' : 'text-ink'}`}>Tele-busca (busca e entrega)</Text>
            </View>
            <View className={`w-5 h-5 rounded-md border ${pickup ? 'bg-brand-600 border-brand-600' : 'border-line'} items-center justify-center`}>
              {pickup ? <Check color="#fff" size={14} /> : null}
            </View>
          </Pressable>
          {pickup && (
            <>
              <Input label="Endereço para busca" value={pickupAddress} onChangeText={setPickupAddress} placeholder={sel.address || 'Rua, número, bairro'} />
              <Input label="Taxa de tele-busca (R$)" value={pickupFee} onChangeText={setPickupFee} keyboardType="decimal-pad" placeholder="0,00" />
              <Text className="text-muted text-xs mb-2">Para agendar a busca com horário e aviso, use a aba Tele-busca / Agenda.</Text>
            </>
          )}

          <Input label="Observações" value={obs} onChangeText={setObs} placeholder="Opcional (ex.: detalhes do serviço, avarias)" multiline style={{ height: 90, textAlignVertical: 'top' }} />

          <View className="bg-white rounded-2xl p-4 border border-line mb-4 flex-row justify-between items-center">
            <Text className="text-muted">Total</Text>
            <Text className="text-2xl font-bold text-brand-700">{formatCurrency(total)}</Text>
          </View>

          <Button title={wash ? 'Salvar alterações' : 'Registrar lavagem'} onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------- Filtros ----------------
function FilterModal({
  visible, initial, onClose, onApply,
}: { visible: boolean; initial: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const [f, setF] = useState<Filters>(initial);

  React.useEffect(() => { if (visible) setF(initial); }, [visible, initial]);

  function preset(kind: 'today' | 'week' | 'month') {
    const now = new Date();
    let from = new Date();
    if (kind === 'week') from.setDate(now.getDate() - 7);
    if (kind === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
    setF((p) => ({ ...p, fromStr: toDateInput(from), toStr: toDateInput(now) }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Filtrar lavagens</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="text-muted font-medium mb-2 text-sm">Período</Text>
          <View className="flex-row gap-2 mb-2">
            {[['Hoje', 'today'], ['7 dias', 'week'], ['Mês', 'month']].map(([label, k]) => (
              <Pressable key={label} onPress={() => preset(k as any)} className="bg-brand-50 px-3 py-2 rounded-xl">
                <Text className="text-brand-700 font-semibold text-xs">{label}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="De" value={f.fromStr} onChangeText={(t) => setF((p) => ({ ...p, fromStr: t }))} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
            <View className="flex-1"><Input label="Até" value={f.toStr} onChangeText={(t) => setF((p) => ({ ...p, toStr: t }))} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
          </View>

          <Text className="text-muted font-medium mb-2 text-sm">Cliente / veículo</Text>
          <ClientVehiclePicker
            value={{ ...EMPTY_SELECTION, client_id: f.client_id, vehicle_id: f.vehicle_id, client_name: f.client_name }}
            onChange={(s) => setF((p) => ({ ...p, client_id: s.client_id, vehicle_id: s.vehicle_id, client_name: s.client_name }))}
          />

          <Text className="text-muted font-medium mb-2 text-sm">Pagamento</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {[null, ...PAYMENT_TYPES].map((p) => (
              <Pressable key={p ?? 'todos'} onPress={() => setF((s) => ({ ...s, payment_type: p }))}
                className={`px-3 py-2 rounded-xl border ${f.payment_type === p ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={f.payment_type === p ? 'text-white font-semibold' : 'text-ink'}>{p ?? 'Todos'}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-muted font-medium mb-2 text-sm">Situação</Text>
          <View className="flex-row gap-2 mb-3">
            {[['Todas', 'all'], ['Em aberto', 'open'], ['Pagas', 'paid']].map(([label, k]) => (
              <Pressable key={k} onPress={() => setF((s) => ({ ...s, status: k as any }))}
                className={`px-3 py-2 rounded-xl border ${f.status === k ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={f.status === k ? 'text-white font-semibold' : 'text-ink'}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center justify-between bg-white border border-line rounded-2xl px-4 py-3 mb-4">
            <Text className="text-ink font-medium flex-1 pr-2">Somente clientes a prazo</Text>
            <Switch value={f.credit_only} onValueChange={(v) => setF((s) => ({ ...s, credit_only: v }))} trackColor={{ true: '#0891b2' }} />
          </View>

          <Button title="Aplicar filtros" onPress={() => onApply(f)} />
          <Pressable onPress={() => onApply(EMPTY_FILTERS)} className="items-center mt-3">
            <Text className="text-red-500 font-medium">Limpar filtros</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
