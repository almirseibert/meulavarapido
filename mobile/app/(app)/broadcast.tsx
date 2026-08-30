import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, Megaphone, Send, Users } from 'lucide-react-native';
import { Input, Card, Empty } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type AudienceId = 'all' | 'premium' | 'free' | 'trial' | 'expired';

const AUDIENCES: { id: AudienceId; label: string; hint: string }[] = [
  { id: 'all', label: 'Todos', hint: 'Todo mundo que instalou o app.' },
  { id: 'premium', label: 'Assinantes', hint: 'Somente contas com Premium ativo.' },
  { id: 'free', label: 'Plano free', hint: 'Quem ainda não assina (teste + expirados).' },
  { id: 'trial', label: 'Em teste grátis', hint: 'Free que ainda está dentro dos 14 dias.' },
  { id: 'expired', label: 'Teste expirado', hint: 'Free cujo teste já acabou — bom p/ promoção.' },
];

interface AudienceStat { accounts: number; devices: number }
interface Broadcast {
  id: string; audience: string; title: string; body: string;
  sent: number; failed: number; created_at: string;
}

export default function BroadcastScreen() {
  const [audience, setAudience] = useState<AudienceId>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [stats, setStats] = useState<Record<string, AudienceStat>>({});
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        unwrap<Record<string, AudienceStat>>(api.get('/admin/audiences')),
        unwrap<Broadcast[]>(api.get('/admin/broadcasts')),
      ]);
      setStats(s || {});
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) {
      Alert.alert('Acesso restrito', e instanceof ApiError ? e.message : 'Não foi possível carregar.');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const target = stats[audience];
  const audienceLabel = AUDIENCES.find((a) => a.id === audience)?.label || audience;

  async function sendTest() {
    if (!title.trim() || !body.trim()) return Alert.alert('Atenção', 'Preencha título e mensagem.');
    try {
      const r = await unwrap<any>(api.post('/admin/broadcast/test', { title, body }));
      Alert.alert('Teste enviado', `Enviado para ${r.sent} aparelho(s) seu(s).`);
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível enviar o teste.');
    }
  }

  function confirmSend() {
    if (!title.trim() || !body.trim()) return Alert.alert('Atenção', 'Preencha título e mensagem.');
    const devices = target?.devices ?? 0;
    if (!devices) return Alert.alert('Sem destinatários', 'Nenhum aparelho registrado neste público.');
    Alert.alert(
      'Confirmar envio',
      `Enviar "${title}" para ${devices} aparelho(s) do público "${audienceLabel}"?\n\nO envio não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: send },
      ]
    );
  }

  async function send() {
    setSending(true);
    try {
      const r = await unwrap<Broadcast>(api.post('/admin/broadcast', { audience, title, body }));
      Alert.alert('Enviado', `${r.sent} entregue(s)${r.failed ? `, ${r.failed} falharam` : ''}.`);
      setTitle(''); setBody('');
      load();
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
        <Text className="text-2xl font-bold text-ink">Novidades e promoções</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}>
        <Card className="mb-3">
          <View className="flex-row items-center mb-1">
            <Megaphone color="#0891b2" size={18} />
            <Text className="text-ink font-semibold ml-2">Para quem enviar</Text>
          </View>
          <View className="flex-row flex-wrap gap-2 mt-2">
            {AUDIENCES.map((a) => {
              const on = audience === a.id;
              const st = stats[a.id];
              return (
                <Pressable key={a.id} onPress={() => setAudience(a.id)}
                  className={`px-3 py-2 rounded-xl border ${on ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
                  <Text className={on ? 'text-white font-semibold' : 'text-ink'}>
                    {a.label}{st ? ` (${st.devices})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-muted text-xs mt-2">
            {AUDIENCES.find((a) => a.id === audience)?.hint}
          </Text>
          <View className="flex-row items-center mt-2">
            <Users color="#64748b" size={14} />
            <Text className="text-muted text-xs ml-1.5">
              {target ? `${target.accounts} conta(s) · ${target.devices} aparelho(s) com aviso ligado` : 'Carregando…'}
            </Text>
          </View>
        </Card>

        <Input label="Título" value={title} onChangeText={setTitle} maxLength={60}
          placeholder="Ex.: Promoção de assinatura 🎉" />
        <Input label="Mensagem" value={body} onChangeText={setBody} maxLength={180} multiline
          style={{ height: 100, textAlignVertical: 'top' }}
          placeholder="Ex.: 30% off no plano anual até domingo." />

        <Card className="mb-3">
          <Text className="text-muted text-xs mb-1">Prévia da notificação</Text>
          <Text className="text-ink font-semibold">{title || 'Título da notificação'}</Text>
          <Text className="text-muted text-sm">{body || 'Texto que o usuário vai ler.'}</Text>
        </Card>

        <Pressable onPress={sendTest} className="items-center py-3 mb-1">
          <Text className="text-brand-700 font-medium">Enviar teste só para mim</Text>
        </Pressable>

        <Pressable onPress={confirmSend} disabled={sending}
          className={`flex-row items-center justify-center bg-brand-600 rounded-2xl py-4 ${sending ? 'opacity-50' : ''}`}>
          <Send color="#fff" size={18} />
          <Text className="text-white font-semibold ml-2">
            {sending ? 'Enviando…' : `Enviar para ${audienceLabel}`}
          </Text>
        </Pressable>

        <Text className="text-muted font-semibold text-xs uppercase mt-6 mb-2">Últimos envios</Text>
        {history.length === 0 ? (
          <Empty title="Nenhum envio ainda" subtitle="Os comunicados enviados aparecem aqui." />
        ) : (
          history.map((b) => (
            <Card key={b.id} className="mb-2">
              <View className="flex-row justify-between">
                <Text className="text-ink font-semibold flex-1 pr-2">{b.title}</Text>
                <Text className="text-muted text-xs">{formatDateTime(b.created_at)}</Text>
              </View>
              <Text className="text-muted text-sm mt-0.5">{b.body}</Text>
              <Text className="text-brand-700 text-xs mt-1">
                {AUDIENCES.find((a) => a.id === b.audience)?.label || b.audience} · {b.sent} entregue(s)
                {b.failed ? ` · ${b.failed} falha(s)` : ''}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
