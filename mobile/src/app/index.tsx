import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/store';

export default function Index() {
  const signedIn = useAuthStore((s) => !!s.token);
  return <Redirect href={signedIn ? '/(tabs)' : '/login'} />;
}
