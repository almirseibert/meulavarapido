import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/stores/auth';

export default function Index() {
  const owner = useAuth((s) => s.owner);
  return <Redirect href={owner ? '/(app)' : '/(auth)/login'} />;
}
