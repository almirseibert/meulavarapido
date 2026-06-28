import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Building2, Wrench, Crown, Upload, MessageSquareHeart, LogOut, X, Trash2, ChevronRight, Truck,
  BarChart3, PhoneCall, HardHat, PackageOpen, Lock,
} from 'lucide-react-native';
import { Button, Input, Card } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { api, unwrap, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/stores/auth';
import { useApp } from '@/lib/stores/app';
import { formatCurrency } from '@/lib/utils';
import type { Company, Service } from '@/lib/types';

export default function SettingsScreen() {
  const owner = useAuth((s) => s.owner);
  const logout = useAuth((s) => s.logout);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  function Row({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle?: string; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} className="flex-row items-center bg-white rounded-2xl p-4 border border-line mb-2">
        <View className="w-10 h-10 rounded-xl bg-brand-50 items-center justify-center">{icon}</View>
        <View className="flex-1 ml-3">
          <Text className="text-ink font-semibold">{title}</Text>
          {subtitle ? <Text className="text-muted text-xs">{subtitle}</Text> : null}
        </View>
        <ChevronRight color="#94a3b8" size={20} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="items-center mb-5 mt-2">
          <LogoMark size={56} />
          <Text className="text-ink font-bold text-lg mt-2">{owner?.name}</Text>
          <Text className="text-muted text-sm">{owner?.email}</Text>
          {(() => {
            const tone = owner?.isPremium
              ? { bg: 'bg-amber-100', fg: 'text-amber-700', label: 'Plano Premium' }
              : owner?.trialActive
              ? { bg: 'bg-blue-100', fg: 'text-blue-700', label: `Teste grátis: ${owner?.trialDaysLeft ?? 0} ${owner?.trialDaysLeft === 1 ? 'dia' : 'dias'}` }
              : { bg: 'bg-red-100', fg: 'text-red-700', label: 'Somente leitura — assine' };
            return (
              <View className={`mt-2 px-3 py-1 rounded-full ${tone.bg}`}>
                <Text className={`text-xs font-semibold ${tone.fg}`}>{tone.label}</Text>
              </View>
            );
          })()}
        </View>

        <Text className="text-muted font-semibold text-xs uppercase mb-2">Lavagem</Text>
        <Row icon={<Building2 color="#0891b2" size={20} />} title="Dados da lavagem" subtitle="Nome, CNPJ, endereço, contato (usado nos recibos)" onPress={() => setCompanyOpen(true)} />
        <Row icon={<Wrench color="#0891b2" size={20} />} title="Serviços e valores" subtitle="Edite preços e serviços oferecidos" onPress={() => setServicesOpen(true)} />
        <Row icon={<Truck color="#0891b2" size={20} />} title="Fornecedores" subtitle="Cadastro e pedidos de produtos" onPress={() => router.push('/(app)/suppliers')} />

        <Text className="text-muted font-semibold text-xs uppercase mb-2 mt-4">Gestão</Text>
        <Row icon={<BarChart3 color="#0891b2" size={20} />} title="Relatórios" subtitle="Lavagens por período, cliente, veículo e em aberto" onPress={() => router.push('/(app)/reports')} />
        <Row icon={<PhoneCall color="#0891b2" size={20} />} title="Recuperação de clientes" subtitle="Acione no WhatsApp quem está sem lavar há dias" onPress={() => router.push('/(app)/callback')} />
        <Row icon={<HardHat color="#0891b2" size={20} />} title="Colaboradores" subtitle="Diárias, vales, pagamentos e saldo" onPress={() => router.push('/(app)/helpers')} />
        <Row icon={<PackageOpen color="#0891b2" size={20} />} title="Tele-busca" subtitle="Veículos com busca e entrega em andamento" onPress={() => router.push('/(app)/pickup')} />

        <Text className="text-muted font-semibold text-xs uppercase mb-2 mt-4">Conta</Text>
        {!owner?.isPremium && (
          <Row icon={<Crown color="#b45309" size={20} />} title="Assinar Premium" subtitle="Acesso total após o teste — a partir de R$ 49,90/mês" onPress={() => router.push('/premium')} />
        )}
        {owner?.isPremium ? (
          <Row icon={<Upload color="#0891b2" size={20} />} title="Importar backup (JSON)" subtitle="Migre os dados do app antigo para a nuvem" onPress={importBackup} />
        ) : (
          <Row icon={<Lock color="#94a3b8" size={20} />} title="Importar backup (JSON)" subtitle="Disponível no Premium" onPress={() => router.push('/premium')} />
        )}
        <Row icon={<MessageSquareHeart color="#0891b2" size={20} />} title="Contate o desenvolvedor" subtitle="Elogios, sugestões e melhorias" onPress={() => setContactOpen(true)} />

        <Pressable onPress={() => { logout(); router.replace('/(auth)/login'); }} className="flex-row items-center justify-center mt-6 py-4">
          <LogOut color="#dc2626" size={18} />
          <Text className="text-red-600 font-semibold ml-2">Sair da conta</Text>
        </Pressable>

        <Text className="text-center text-muted text-xs mt-4">Meu Lava Rápido · v1.0.0</Text>
      </ScrollView>

      <CompanyModal visible={companyOpen} onClose={() => setCompanyOpen(false)} />
      <ServicesModal visible={servicesOpen} onClose={() => setServicesOpen(false)} />
      <ContactModal visible={contactOpen} onClose={() => setContactOpen(false)} />
    </SafeAreaView>
  );
}

async function importBackup() {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (res.canceled) return;
    const uri = res.assets[0].uri;
    const content = await FileSystem.readAsStringAsync(uri);
    const json = JSON.parse(content);
    const counts = await unwrap<any>(api.post('/import', { data: json }));
    Alert.alert(
      'Importação concluída',
      `Clientes: ${counts.clients} · Veículos: ${counts.vehicles} · Lavagens: ${counts.washes} · Agend.: ${counts.schedules} · Despesas: ${counts.expenses} · Colaboradores: ${counts.helpers ?? 0}`
    );
  } catch (e) {
    Alert.alert('Erro ao importar', e instanceof ApiError ? e.message : 'Verifique se o arquivo é um backup JSON válido.');
  }
}

function CompanyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { company, loadCompany } = useApp();
  const [f, setF] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Company) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  React.useEffect(() => { if (visible) setF(company || {}); }, [visible, company]);

  async function save() {
    setSaving(true);
    try {
      await api.put('/company', f);
      await loadCompany();
      onClose();
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
          <Text className="text-lg font-bold text-ink">Dados da lavagem</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="text-muted text-xs mb-3">Esses dados aparecem nos recibos e orçamentos.</Text>
          <Input label="Nome da lavagem" value={f.name || ''} onChangeText={set('name')} />
          <Input label="CNPJ / CPF" value={f.document || ''} onChangeText={set('document')} />
          <Input label="Endereço" value={f.address || ''} onChangeText={set('address')} />
          <Input label="Cidade" value={f.city || ''} onChangeText={set('city')} />
          <Input label="Estado (UF)" value={f.state || ''} onChangeText={set('state')} autoCapitalize="characters" maxLength={2} />
          <Input label="Telefone" value={f.phone || ''} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Input label="WhatsApp" value={f.whatsapp || ''} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
          <Input label="E-mail" value={f.email || ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Instagram" value={f.instagram || ''} onChangeText={set('instagram')} autoCapitalize="none" placeholder="@sualavagem" />
          <Input label="Mensagem no rodapé do recibo" value={f.receipt_footer || ''} onChangeText={set('receipt_footer')} placeholder="Obrigado pela preferência!" multiline />
          <Button title="Salvar" onPress={save} loading={saving} className="mt-2" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ServicesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { services, loadServices } = useApp();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/services', { name, price: Number(price.replace(',', '.')) || 0 });
      setName(''); setPrice('');
      await loadServices();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível adicionar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Service) {
    await api.delete(`/services/${s.id}`);
    loadServices();
  }

  async function editPrice(s: Service) {
    Alert.prompt?.(
      'Editar preço',
      s.name,
      async (text) => {
        if (text == null) return;
        await api.put(`/services/${s.id}`, { price: Number(text.replace(',', '.')) || 0 });
        loadServices();
      },
      'plain-text',
      String(s.price)
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Serviços e valores</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Card className="mb-3">
            <Input label="Serviço" value={name} onChangeText={setName} placeholder="Ex.: Lavagem completa" />
            <Input label="Preço" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0,00" />
            <Button title="Adicionar serviço" onPress={add} loading={saving} variant="ghost" />
          </Card>

          {services.map((s) => (
            <View key={s.id} className="flex-row items-center bg-white rounded-2xl p-4 border border-line mb-2">
              <View className="flex-1">
                <Text className="text-ink font-semibold">{s.name}</Text>
                <Pressable onPress={() => editPrice(s)}>
                  <Text className="text-brand-700 font-bold mt-0.5">{formatCurrency(s.price)} · editar</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => remove(s)} className="bg-red-50 p-2 rounded-xl"><Trash2 color="#dc2626" size={16} /></Pressable>
            </View>
          ))}
          {services.length === 0 && <Text className="text-muted text-center mt-4">Nenhum serviço cadastrado ainda.</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ContactModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState('elogio');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function send() {
    if (!message.trim()) return Alert.alert('Atenção', 'Escreva sua mensagem.');
    setSaving(true);
    try {
      const res = await unwrap<any>(api.post('/support/message', { kind, subject, message }));
      Alert.alert('Obrigado!', 'Sua mensagem foi enviada ao desenvolvedor.');
      setSubject(''); setMessage('');
      onClose();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível enviar.');
    } finally {
      setSaving(false);
    }
  }

  const kinds = [
    { id: 'elogio', label: 'Elogio' },
    { id: 'melhoria', label: 'Sugestão' },
    { id: 'bug', label: 'Problema' },
    { id: 'outro', label: 'Outro' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
          <Text className="text-lg font-bold text-ink">Contate o desenvolvedor</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {kinds.map((k) => (
              <Pressable key={k.id} onPress={() => setKind(k.id)}
                className={`px-3 py-2 rounded-xl border ${kind === k.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                <Text className={kind === k.id ? 'text-white font-semibold' : 'text-ink'}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <Input label="Assunto" value={subject} onChangeText={setSubject} placeholder="Resumo" />
          <Input label="Mensagem" value={message} onChangeText={setMessage} placeholder="Escreva aqui..." multiline style={{ height: 140, textAlignVertical: 'top' }} />
          <Button title="Enviar" onPress={send} loading={saving} />
          <Pressable onPress={() => Linking.openURL('mailto:tecnologia@makservicos.com')} className="mt-4">
            <Text className="text-center text-brand-700">Ou envie um e-mail: tecnologia@makservicos.com</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
