import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { login } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { AuthShell } from '@/features/auth/ui/AuthShell';
import { Button, ErrorBox, Input, Text } from '@/shared/ui';
import { colors } from '@/shared/theme/tokens';

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await login(identifier.trim(), password);
      setAuth(res.access_token, res.user, res.refresh_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Iniciar sesión" subtitle="Consulta tus diagramas desde el móvil (solo lectura).">
      <Input
        label="Usuario o correo"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        returnKeyType="next"
      />
      <Input
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void submit()}
      />
      {error ? <ErrorBox message={error} /> : null}
      <Button label="Entrar" onPress={() => void submit()} loading={busy} disabled={!canSubmit} />
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        <Text variant="caption">¿No tienes cuenta?</Text>
        <Link href="/register" style={{ fontWeight: '700', color: colors.ink }}>
          Regístrate
        </Link>
      </View>
    </AuthShell>
  );
}
