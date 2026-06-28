import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/stores/auth';
import { ApiError } from '@/lib/api';
import { phoneAuthAvailable, sendPhoneCode, confirmPhoneCode, toE164 } from '@/lib/services/phoneAuth';

export default function Register() {
  const register = useAuth((s) => s.register);
  const loading = useAuth((s) => s.loading);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // Traduz erros do Firebase Phone Auth para mensagens úteis (e mostra o código bruto,
  // que é o que indica a causa real quando o SMS não chega).
  function describePhoneError(e: any): string {
    const code: string = e?.code || '';
    const map: Record<string, string> = {
      'auth/invalid-phone-number': 'Número de telefone inválido. Use DDD + número.',
      'auth/missing-phone-number': 'Informe o número de telefone.',
      'auth/quota-exceeded': 'Cota de SMS do Firebase esgotada. Tente mais tarde ou ative o faturamento (plano Blaze).',
      'auth/too-many-requests': 'Muitas tentativas para este número. Aguarde e tente novamente.',
      'auth/app-not-authorized': 'App não autorizado no Firebase. Registre a SHA-1 do app no Firebase e baixe o google-services.json novamente.',
      'auth/missing-client-identifier': 'Falta a verificação do app (SHA-1 / Play Integrity / reCAPTCHA). Configure no Firebase.',
      'auth/network-request-failed': 'Falha de rede. Verifique a conexão.',
      'auth/internal-error': 'Erro interno do Firebase. Confira a configuração do projeto (Phone Auth habilitado?).',
    };
    const friendly = map[code] || 'Não foi possível enviar o código. Verifique o telefone e a configuração do Firebase.';
    return code ? `${friendly}\n\n(código: ${code})` : friendly;
  }

  async function finishRegister(verify: { firebaseIdToken?: string; phone?: string }) {
    await register(name.trim(), email.trim(), password, verify);
    router.replace('/(app)');
  }

  // Passo 1: valida dados e dispara o SMS (ou cadastra direto em modo dev).
  async function handleContinue() {
    if (!name || !email || !password) return Alert.alert('Atenção', 'Preencha todos os campos.');
    if (password.length < 6) return Alert.alert('Atenção', 'A senha deve ter ao menos 6 caracteres.');
    const phoneE164 = toE164(phone);
    if (!phoneE164) return Alert.alert('Atenção', 'Informe um telefone válido com DDD.');

    setBusy(true);
    try {
      if (phoneAuthAvailable()) {
        const conf = await sendPhoneCode(phoneE164);
        setConfirmation(conf);
        setStep('code');
      } else {
        // Expo Go / sem Firebase: cadastra com telefone não verificado (modo dev).
        await finishRegister({ phone: phoneE164 });
      }
    } catch (e) {
      Alert.alert('Erro no cadastro', e instanceof ApiError ? e.message : describePhoneError(e));
    } finally {
      setBusy(false);
    }
  }

  // Passo 2: confirma o código e conclui o cadastro.
  async function handleVerify() {
    if (code.trim().length < 4) return Alert.alert('Atenção', 'Digite o código recebido por SMS.');
    setBusy(true);
    try {
      const idToken = await confirmPhoneCode(confirmation, code.trim());
      await finishRegister({ firebaseIdToken: idToken });
    } catch (e) {
      Alert.alert('Código inválido', e instanceof ApiError ? e.message : 'Não foi possível confirmar o código. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="items-center mb-6">
            <Logo size={72} />
            <Text className="text-muted mt-3">
              {step === 'form' ? 'Crie sua conta · 14 dias grátis' : 'Confirme seu telefone'}
            </Text>
          </View>

          {step === 'form' ? (
            <>
              <Input label="Seu nome" placeholder="Nome do responsável" value={name} onChangeText={setName} />
              <Input
                label="E-mail"
                placeholder="voce@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Input
                label="Telefone (com DDD)"
                placeholder="(51) 99999-9999"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Input label="Senha" placeholder="mínimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} />

              <Text className="text-muted text-xs mb-3">
                Enviaremos um código por SMS para confirmar seu número. Cada telefone pode ter apenas uma conta.
                O cadastro completo da lavagem (CNPJ, endereço) é feito depois, em Configurações.
              </Text>

              <Button title="Continuar" onPress={handleContinue} loading={busy || loading} />
            </>
          ) : (
            <>
              <Text className="text-ink text-center mb-3">
                Digite o código enviado por SMS para{'\n'}
                <Text className="font-semibold">{toE164(phone)}</Text>
              </Text>
              <Input
                label="Código de verificação"
                placeholder="000000"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />
              <Button title="Confirmar e criar conta" onPress={handleVerify} loading={busy || loading} />
              <Button title="Voltar" variant="ghost" onPress={() => { setStep('form'); setCode(''); }} className="mt-2" />
            </>
          )}

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
