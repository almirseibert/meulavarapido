import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, Inbox, Mail, MessageCircle, Trash2, CheckCheck } from 'lucide-react-native';
import { Card, Empty, Pill } from '@/components/ui';
import { api, unwrap, ApiError } from '@/lib/api';
import { formatDateTime, whatsappNumber } from '@/lib/utils';

/**
 * Caixa de entrada do "Contate o desenvolvedor".
 * Só o administrador (ADMIN_EMAILS no servidor) chega aqui — a entrada em
 * Ajustes só aparece para ele e o backend recusa o acesso de qualquer outro.
 */

interface SupportMessage {
  id: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  kind: 'elogio' | 'melhoria' | 'bug' | 'outro';
  subject: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
}

const KIND: Record<SupportMessage['kind'], { label: string; tone: 'brand' | 'green' | 'red' | 'gray' }> = {
  elogio: { label: 'Elogio', tone: 'green' },
  melhoria: { label: 'Sugestão', tone: 'brand' },
  bug: { label: 'Problema', tone: 'red' },
  outro: { label: 'Outro', tone: 'gray' },
};

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Não lidas' },
] as const;

export default function SupportInboxScreen() {
  const [items, setItems] = useState<SupportMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (f: 'all' | 'unread') => {
    try {
      const data = await unwrap<{ messages: SupportMessage[]; unread: number }>(
        api.get('/admin/support-messages', { params: f === 'unread' ? { only: 'unread' } : {} })
      );
      setItems(data?.messages || []);
      setUnread(data?.unread ?? 0);
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível carregar as mensagens.');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [load, filter]));

  async function refresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  async function toggleRead(m: SupportMessage) {
    try {
      await api.patch(`/admin/support-messages/${m.id}/read`, { read: !m.read_at });
      load(filter);
    } catch (e) {
      Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível atualizar.');
    }
  }

  function markAll() {
    if (!unread) return Alert.alert('Nada a marcar', 'Não há mensagens não lidas.');
    Alert.alert('Marcar todas como lidas', `Confirma marcar ${unread} mensagem(ns)?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        try {
          await api.post('/admin/support-messages/read-all');
          load(filter);
        } catch (e) {
          Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível atualizar.');
        }
      } },
    ]);
  }

  function remove(m: SupportMessage) {
    Alert.alert('Remover mensagem', 'Confirma a exclusão? Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/admin/support-messages/${m.id}`);
          load(filter);
        } catch (e) {
          Alert.alert('Erro', e instanceof ApiError ? e.message : 'Não foi possível remover.');
        }
      } },
    ]);
  }

  // Responder vai direto para o e-mail/WhatsApp de quem escreveu.
  function replyByEmail(m: SupportMessage) {
    if (!m.owner_email) return;
    const subject = encodeURIComponent(`Re: ${m.subject || 'sua mensagem no Meu Lava Rápido'}`);
    Linking.openURL(`mailto:${m.owner_email}?subject=${subject}`).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o app de e-mail.')
    );
  }

  function replyByWhatsApp(m: SupportMessage) {
    const num = whatsappNumber(m.owner_phone);
    if (!num) return;
    Linking.openURL(`whatsapp://send?phone=${num}`).catch(() =>
      Alert.alert('WhatsApp', 'O WhatsApp não está instalado neste dispositivo.')
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <Pressable onPress={() => router.back()} className="mr-2 p-1"><ArrowLeft color="#0f172a" size={24} /></Pressable>
        <Text className="text-2xl font-bold text-ink flex-1">Mensagens recebidas</Text>
        {unread > 0 && (
          <View className="bg-red-600 rounded-full px-2.5 py-0.5">
            <Text className="text-white text-xs font-bold">{unread}</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center px-4 pb-2 gap-2">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable key={f.id} onPress={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-xl border ${on ? 'bg-brand-600 border-brand-600' : 'bg-white border-line'}`}>
              <Text className={on ? 'text-white font-semibold' : 'text-ink'}>{f.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={markAll} className="ml-auto flex-row items-center bg-slate-100 px-3 py-2 rounded-xl">
          <CheckCheck color="#475569" size={16} />
          <Text className="text-slate-600 font-semibold text-xs ml-1">Marcar lidas</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {!items.length ? (
          <Empty
            title="Nenhuma mensagem"
            subtitle={filter === 'unread' ? 'Tudo lido por aqui.' : 'As mensagens enviadas pelos usuários aparecem aqui.'}
          />
        ) : (
          items.map((m) => {
            const k = KIND[m.kind] || KIND.outro;
            const isUnread = !m.read_at;
            return (
              <Card key={m.id} className={`mb-2 ${isUnread ? 'border-brand-300' : ''}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 flex-1 pr-2">
                    <Pill text={k.label} tone={k.tone} />
                    {isUnread && <View className="w-2 h-2 rounded-full bg-brand-600" />}
                  </View>
                  <Text className="text-muted text-xs">{formatDateTime(m.created_at)}</Text>
                </View>

                {m.subject ? <Text className="text-ink font-bold mt-2">{m.subject}</Text> : null}
                <Text className="text-ink mt-1">{m.message}</Text>

                <View className="mt-2 pt-2 border-t border-line/60">
                  <Text className="text-muted text-xs">
                    {m.owner_name || 'Conta removida'}
                    {m.owner_email ? ` · ${m.owner_email}` : ''}
                    {m.owner_phone ? ` · ${m.owner_phone}` : ''}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-2 mt-2">
                  {m.owner_email ? (
                    <Pressable onPress={() => replyByEmail(m)} className="flex-row items-center bg-brand-50 px-3 py-1.5 rounded-xl">
                      <Mail color="#0891b2" size={15} />
                      <Text className="text-brand-700 font-semibold text-xs ml-1">E-mail</Text>
                    </Pressable>
                  ) : null}
                  {whatsappNumber(m.owner_phone) ? (
                    <Pressable onPress={() => replyByWhatsApp(m)} className="flex-row items-center bg-green-100 px-3 py-1.5 rounded-xl">
                      <MessageCircle color="#15803d" size={15} />
                      <Text className="text-green-700 font-semibold text-xs ml-1">WhatsApp</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => toggleRead(m)} className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl">
                    <Inbox color="#475569" size={15} />
                    <Text className="text-slate-600 font-semibold text-xs ml-1">
                      {isUnread ? 'Marcar lida' : 'Marcar não lida'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => remove(m)} className="ml-auto bg-red-50 px-3 py-1.5 rounded-xl">
                    <Trash2 color="#dc2626" size={15} />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
