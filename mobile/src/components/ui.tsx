import React from 'react';
import {
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  View,
  ActivityIndicator,
  ViewProps,
} from 'react-native';

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
  className = '',
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
}) {
  const base = 'rounded-2xl py-4 px-5 items-center justify-center flex-row';
  const styles: Record<string, string> = {
    primary: 'bg-brand-600',
    outline: 'border border-brand-600 bg-transparent',
    ghost: 'bg-brand-50',
    danger: 'bg-red-500',
  };
  const textStyles: Record<string, string> = {
    primary: 'text-white',
    outline: 'text-brand-700',
    ghost: 'text-brand-700',
    danger: 'text-white',
  };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${styles[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading && <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#0891b2'} style={{ marginRight: 8 }} />}
      <Text className={`font-semibold text-base ${textStyles[variant]}`}>{title}</Text>
    </Pressable>
  );
}

export function Input({
  label,
  className = '',
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View className={`mb-3 ${className}`}>
      {label ? <Text className="text-muted font-medium mb-1 text-sm">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        className="border border-line rounded-2xl px-4 py-3 text-ink bg-white text-base"
        {...props}
      />
    </View>
  );
}

export function Card({ children, className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`bg-white rounded-2xl p-4 border border-line ${className}`} {...props}>
      {children}
    </View>
  );
}

export function Pill({ text, tone = 'brand' }: { text: string; tone?: 'brand' | 'green' | 'red' | 'gray' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-slate-100 text-slate-600',
  };
  return (
    <View className={`px-2.5 py-1 rounded-full ${tones[tone].split(' ')[0]}`}>
      <Text className={`text-xs font-semibold ${tones[tone].split(' ')[1]}`}>{text}</Text>
    </View>
  );
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center py-16 px-6">
      <Text className="text-ink font-semibold text-base text-center">{title}</Text>
      {subtitle ? <Text className="text-muted text-center mt-1">{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-muted font-semibold text-xs uppercase tracking-wide mb-2">{children}</Text>;
}
