import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/stores/auth';
import { ApiError } from '@/lib/api';

export default function Register() {
  const register = useAuth((s) => s.register);
  const loading = useAuth((s) => s.loading);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister() {
    if (!name || !email || !password) return Alert.alert('Atenção', 'Preencha todos os campos.');
    if (password.length < 6) return Alert.alert('Atenção', 'A senha deve ter ao menos 6 caracteres.');
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(app)');
    } catch (e) {
      Alert.alert('Erro no cadastro', e instanceof ApiError ? e.message : 'Tente novamente.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="items-center mb-6">
            <Logo size={72} />
            <Text className="text-muted mt-3">Crie sua conta gratuita</Text>
          </View>

          <Input label="Seu nome" placeholder="Nome do responsável" value={name} onChangeText={setName} />
          <Input
            label="E-mail"
            placeholder="voce@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input label="Senha" placeholder="mínimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} />

          <Text className="text-muted text-xs mb-3">
            O cadastro completo da lavagem (CNPJ, endereço, contato) é feito depois, em Configurações —
            necessário para emitir recibos e orçamentos.
          </Text>

          <Button title="Criar conta" onPress={handleRegister} loading={loading} />

          <View className="flex-row justify-center mt-6">
            <Text className="text-muted">Já tem conta? </Text>
            <Link href="/(auth)/login" className="text-brand-700 font-semibold">
              Entrar
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
