import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, X, Settings as SettingsIcon, MessageCircle, XCircle, Smile } from 'lucide-react-native';
import { Button, Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { useApp } from '@/lib/stores/app';
import { formatDate, whatsappNumber } from '@/lib/utils';

interface InactiveClient {
  client_id: string;
  name: string;
  phone?: string;
  last_wash_date: string;
  last_contact_date?: string | null;
}
interface CrmSettings {
  inactivity_days: number;
  snooze_days: number;
  message_body?: string;
}

function daysAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.ceil(diff / 864e5));
}

export default function CallbackScreen() {
  const company = useApp((s) => s.company);
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await unwrap<{ settings: CrmSettings; clients: InactiveClient[] }>(api.get('/crm/inactive'));
      setSettings(r.settings);
      setClients(r.clients || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function notify(c: InactiveClient) {
    const phone = whatsappNumber(c.phone);
    if (!phone) return Alert.alert('Sem telefone', 'Este cliente não tem telefone cadastrado.');

    const sign = [
      company?.name,
      company?.address,
      [company?.city, company?.state].filter(Boolean).join(' - '),
      company?.instagram ? `Instagram: ${company.instagram}` : null,
    ].filter(Boolean).join('\n');
    const body = settings?.message_body || 'Que tal agendar uma lavagem e deixar seu veículo brilhando novamente?';
    const message = `Olá ${c.name},\n\n${body}${sign ? `\n\n${sign}` : ''}`;
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return Alert.alert('WhatsApp', 'O WhatsApp não está instalado neste dispositivo.');
      await Linking.openURL(url);
      setTimeout(() => {
        Alert.alert('Mensagem enviada?', 'Registrar o contato e só lembrar novamente após o período de snooze?', [
          { text: 'Não', style: 'cancel' },
          { text: 'Sim, registrar', onPress: async () => { await api.post(`/crm/${c.client_id}/contact`); load(); } },
        ]);
      }, 600);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  }

  function ignore(c: InactiveClient) {
    Alert.alert('Ignorar cliente', `${c.name} não aparecerá mais nesta lista. Continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ignorar', style: 'destructive', onPress: async () => { await api.post(`/crm/${c.client_id}/ignore`); load(); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
          <Text className="text-2xl font-bold text-ink">Recuperação</Text>
        </View>
        <Pressable onPress={() => setSettingsOpen(true)} className="bg-slate-100 w-11 h-11 rounded-full items-center justify-center">
          <SettingsIcon color="#475569" size={20} />
        </Pressable>
      </View>
      <Text className="text-muted text-sm px-4 mb-2">
        Clientes sem lavar há mais de {settings?.inactivity_days ?? 30} dias.
      </Text>

      <FlatList
        data={clients}
        keyExtractor={(i) => i.client_id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          loading ? null : (
            <View className="items-center py-16 px-6">
              <Smile color="#16a34a" size={40} />
              <Text className="text-ink font-semibold text-center mt-3">Tudo em dia!</Text>
              <Text className="text-muted text-center mt-1">Nenhum cliente inativo para acionar agora.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card className="mb-2">
            <Text className="text-ink font-semibold text-base">{item.name}</Text>
            <Text className="text-red-600 text-sm mt-0.5">
              Última lavagem: {formatDate(item.last_wash_date)} ({daysAgo(item.last_wash_date)} dias)
            </Text>
            {item.last_contact_date ? (
              <Text className="text-muted text-xs mt-0.5 italic">Último aviso: {formatDate(item.last_contact_date)}</Text>
            ) : null}
            <View className="flex-row gap-2 mt-3">
              <Pressable onPress={() => notify(item)} className="flex-1 flex-row items-center justify-center bg-green-600 px-3 py-2 rounded-xl">
                <MessageCircle color="#fff" size={16} />
                <Text className="text-white font-semibold text-sm ml-1">Avisar no WhatsApp</Text>
              </Pressable>
              <Pressable onPress={() => ignore(item)} className="bg-red-50 px-3 py-2 rounded-xl items-center justify-center">
                <XCircle color="#dc2626" size={18} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <CrmSettingsModal
        visible={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => { setSettingsOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

function CrmSettingsModal({
  visible, settings, onClose, onSaved,
}: { visible: boolean; settings: CrmSettings | null; onClose: () => void; onSaved: () => void }) {
  const [inactivity, setInactivity] = useState('30');
  const [snooze, setSnooze] = useState('15');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible && settings) {
      setInactivity(String(settings.inactivity_days));
      setSnooze(String(settings.snooze_days));
      setMessage(settings.message_body || '');
    }
  }, [visible, settings]);

  async function save() {
    setSaving(true);
    try {
      await api.put('/crm/settings', {
        inactivity_days: parseInt(inactivity, 10) || 30,
        snooze_days: parseInt(snooze, 10) || 15,
        message_body: message,
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
          <Text className="text-lg font-bold text-ink">Configurações de avisos</Text>
          <Pressable onPress={onClose}><X color="#0f172a" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Input label="Dias sem lavar p/ considerar inativo" value={inactivity} onChangeText={setInactivity} keyboardType="number-pad" />
          <Input label="Dias p/ avisar novamente (snooze)" value={snooze} onChangeText={setSnooze} keyboardType="number-pad" />
          <Input label="Mensagem do aviso" value={message} onChangeText={setMessage} multiline style={{ height: 120, textAlignVertical: 'top' }}
            placeholder="Ex.: Faz um tempinho que seu veículo não nos visita..." />
          <Text className="text-muted text-xs mb-3">A saudação "Olá [nome]," e os dados da sua lavagem são adicionados automaticamente.</Text>
          <Button title="Salvar configurações" onPress={save} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
