import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/stores/auth';
import { ApiError } from '@/lib/api';

export default function Login() {
  const login = useAuth((s) => s.login);
  const loading = useAuth((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    if (!email || !password) return Alert.alert('Atenção', 'Informe e-mail e senha.');
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (e) {
      Alert.alert('Não foi possível entrar', e instanceof ApiError ? e.message : 'Tente novamente.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="items-center mb-8">
            <Logo size={84} />
            <Text className="text-muted mt-3 text-center">Gestão da sua lavagem e estética automotiva</Text>
          </View>

          <Input
            label="E-mail"
            placeholder="voce@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Senha"
            placeholder="••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Button title="Entrar" onPress={handleLogin} loading={loading} className="mt-2" />

          <View className="flex-row justify-center mt-6">
            <Text className="text-muted">Ainda não tem conta? </Text>
            <Link href="/(auth)/register" className="text-brand-700 font-semibold">
              Cadastre-se
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
