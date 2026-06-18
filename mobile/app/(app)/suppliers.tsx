import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Plus, X, Trash2, Pencil, MessageCircle, Package, ChevronLeft } from 'lucide-react-native';
import { Button, Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { whatsappNumber } from '@/lib/utils';
import type { Supplier } from '@/lib/types';

export default function SuppliersScreen() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [modal, setModal] = useState(false);

  const load = useCallback(async (q = '') => {
    try {
      const data = await unwrap<Supplier[]>(api.get(`/suppliers${q ? `?search=${encodeURIComponent(q)}` : ''}`));
      setItems(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(search); }, [load]));

  function orderProducts(s: Supplier) {
    const num = whatsappNumber(s.whatsapp || s.phone);
    if (!num) return Alert.alert('Sem WhatsApp', 'Cadastre o WhatsApp do fornecedor.');
    const text = encodeURIComponent(`Olá ${s.name}, gostaria de solicitar um pedido dos seguintes produtos: `);
    Linking.openURL(`whatsapp://send?phone=${num}&text=${text}`).catch(() =>
      Linking.openURL(`https://wa.me/${num}?text=${text}`)
    );
  }

  async function remove(s: Supplier) {
    Alert.alert('Remover fornecedor', `Excluir ${s.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await api.delete(`/suppliers/${s.id}`); load(search); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center flex-1">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/settings'))} className="mr-1 -ml-1 p-1">
            <ChevronLeft color="#0f172a" size={26} />
          </Pressable>
          <Text className="text-2xl font-bold text-ink">Fornecedores</Text>
        </View>
        <Pressable onPress={() => { setEditing(null); setModal(true); }} className="bg-brand-600 w-11 h-11 rounded-full items-center justify-center">
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>
      <View className="px-4 pb-2">
        <Input placeholder="Buscar fornecedor ou produto" value={search} onChangeText={(t) => { setSearch(t); load(t); }} className="mb-0" />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Empty title="Nenhum fornecedor" subtitle="Cadastre seus fornecedores de produtos." />}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <Text className="text-ink font-semibold text-base">{item.name}</Text>
                {item.company_name ? <Text className="text-muted text-sm">{item.company_name}</Text> : null}
                {item.products ? (
                  <View className="flex-row items-center mt-1">
                    <Package color="#0891b2" size={14} />
                    <Text className="text-brand-700 text-sm ml-1 flex-1">{item.products}</Text>
                  </View>
                ) : null}
                {item.phone ? <Text className="text-muted text-xs mt-1">{item.phone}</Text> : null}
              </View>
              <View className="flex-row gap-1">
                <Pressable onPress={() => orderProducts(item)} className="bg-green-50 p-2 rounded-xl"><MessageCircle color="#16a34a" size={16} /></Pressable>
                <Pressable onPress={() => { setEditing(item); setModal(true); }} className="bg-slate-100 p-2 rounded-xl"><Pencil color="#475569" size={16} /></Pressable>
                <Pressable onPress={() => remove(item)} className="bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={16} /></Pressable>
              </View>
            </View>
          </Card>
        )}
      />

      <SupplierModal visible={modal} supplier={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(search); }} />
    </SafeAreaView>
  );
}

function SupplierModal({
  visible, supplier, onClose, onSaved,
}: { visible: boolean; supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Supplier>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Supplier) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  React.useEffect(() => { if (visible) setF(supplier || {}); }, [visible, supplier]);

  async function save() {
    if (!f.name?.trim()) return Alert.alert('Atenção', 'Informe o nome do fornecedor.');
    setSaving(true);
    try {
      if (supplier) await api.put(`/suppliers/${supplier.id}`, f);
      else await api.post('/suppliers', f);
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
          <Text className="text-lg font-bold text-ink">{supplier ? 'Editar fornecedor' : 'Novo fornecedor'}</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Input label="Nome / contato *" value={f.name || ''} onChangeText={set('name')} />
          <Input label="Razão social" value={f.company_name || ''} onChangeText={set('company_name')} />
          <Input label="CNPJ" value={f.document || ''} onChangeText={set('document')} keyboardType="numbers-and-punctuation" />
          <Input label="Telefone" value={f.phone || ''} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Input label="WhatsApp (p/ pedidos)" value={f.whatsapp || ''} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
          <Input label="E-mail" value={f.email || ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Endereço" value={f.address || ''} onChangeText={set('address')} />
          <Input label="Produtos que fornece" value={f.products || ''} onChangeText={set('products')} placeholder="Ex.: shampoo, cera, panos" multiline />
          <Input label="Observações" value={f.notes || ''} onChangeText={set('notes')} multiline />
          <Button title="Salvar" onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
