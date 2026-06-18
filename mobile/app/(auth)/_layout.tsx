import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/stores/auth';

export default function AuthLayout() {
  const owner = useAuth((s) => s.owner);
  if (owner) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
