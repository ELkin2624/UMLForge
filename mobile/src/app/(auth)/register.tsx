import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { login, register } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { AuthShell } from '@/features/auth/ui/AuthShell';
import { Button, ErrorBox, Input, Text } from '@/shared/ui';
import { colors } from '@/shared/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const errors = {
    username: username.trim().length < 3 ? 'Mínimo 3 caracteres' : null,
    email: !EMAIL.test(email.trim()) ? 'Correo no válido' : null,
    password: password.length < 6 ? 'Mínimo 6 caracteres' : null,
  };
  const valid = !errors.username && !errors.email && !errors.password;

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      });
      const res = await login(username.trim(), password);
      setAuth(res.access_token, res.user, res.refresh_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Regístrate para ver los diagramas compartidos contigo.">
      <Input label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} error={touched ? errors.username : null} />
      <Input label="Nombre para mostrar (opcional)" value={displayName} onChangeText={setDisplayName} />
      <Input label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} error={touched ? errors.email : null} />
      <Input label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry error={touched ? errors.password : null} />
      {error ? <ErrorBox message={error} /> : null}
      <Button label="Crear cuenta" onPress={() => void submit()} loading={busy} />
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        <Text variant="caption">¿Ya tienes cuenta?</Text>
        <Link href="/login" style={{ fontWeight: '700', color: colors.ink }}>
          Inicia sesión
        </Link>
      </View>
    </AuthShell>
  );
}
