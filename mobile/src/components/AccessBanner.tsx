import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Crown, Lock } from 'lucide-react-native';
import { useAuth } from '@/lib/stores/auth';

/**
 * Faixa de acesso: mostra a contagem do teste grátis ou o aviso de bloqueio
 * (somente leitura) quando o teste termina. Assinantes premium não veem nada.
 */
export function AccessBanner() {
  const owner = useAuth((s) => s.owner);
  if (!owner || owner.isPremium) return null;

  const locked = !owner.hasAccess;
  const days = owner.trialDaysLeft ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/premium')}
      className={`flex-row items-center rounded-2xl p-3 mb-3 border ${
        locked ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <View className={`w-9 h-9 rounded-xl items-center justify-center ${locked ? 'bg-red-100' : 'bg-amber-100'}`}>
        {locked ? <Lock color="#dc2626" size={18} /> : <Crown color="#b45309" size={18} />}
      </View>
      <View className="flex-1 ml-3">
        <Text className={`font-bold ${locked ? 'text-red-700' : 'text-amber-800'}`}>
          {locked ? 'Seu teste terminou' : `Teste grátis: ${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`}
        </Text>
        <Text className={`text-xs ${locked ? 'text-red-600' : 'text-amber-700'}`}>
          {locked
            ? 'Assine para voltar a registrar lavagens e emitir documentos.'
            : 'Assine para manter tudo liberado após o teste.'}
        </Text>
      </View>
      <View className={`px-3 py-1.5 rounded-full ${locked ? 'bg-red-600' : 'bg-amber-500'}`}>
        <Text className="text-white font-semibold text-xs">Assinar</Text>
      </View>
    </Pressable>
  );
}
