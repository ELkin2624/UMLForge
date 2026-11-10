import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { CheckCircle2, Globe, RefreshCw, Settings2, XCircle } from 'lucide-react-native';

import { login } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { AuthShell } from '@/features/auth/ui/AuthShell';
import { getApiOrigin, loadSavedApiOrigin, setApiOrigin } from '@/shared/api/config';
import { border, colors, radius, spacing } from '@/shared/theme/tokens';
import { Button, ErrorBox, Input, Text } from '@/shared/ui';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estado del servidor y conectividad
  const [serverUrl, setServerUrl] = useState(getApiOrigin());
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [modalVisible, setModalVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(serverUrl);
  const [testingUrl, setTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const checkConnection = useCallback(async (origin: string) => {
    setServerStatus('checking');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${origin}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        setServerStatus('connected');
        return true;
      } else {
        setServerStatus('disconnected');
        return false;
      }
    } catch {
      setServerStatus('disconnected');
      return false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const saved = await loadSavedApiOrigin();
      setServerUrl(saved);
      setTempUrl(saved);
      void checkConnection(saved);
    })();
  }, [checkConnection]);

  async function handleSaveServer() {
    let clean = tempUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    clean = clean.replace(/\/+$/, '');
    setTestingUrl(true);
    setTestResult(null);

    const ok = await checkConnection(clean);
    setTestingUrl(false);
    if (ok) {
      await setApiOrigin(clean);
      setServerUrl(clean);
      setTestResult('¡Conexión exitosa!');
      setTimeout(() => {
        setModalVisible(false);
        setTestResult(null);
      }, 700);
    } else {
      setTestResult('No se pudo conectar a este servidor. Verifica la IP y puerto.');
    }
  }

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await login(identifier.trim(), password);
      setAuth(res.access_token, res.user, res.refresh_token);
      router.replace('/(tabs)');
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

      {/* Indicador de conexión con el backend */}
      <View style={styles.serverBar}>
        <View style={styles.serverStatusInfo}>
          {serverStatus === 'checking' ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : serverStatus === 'connected' ? (
            <CheckCircle2 size={16} color={colors.successText} />
          ) : (
            <XCircle size={16} color={colors.error} />
          )}
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ fontWeight: '600', color: colors.ink }}>
              {serverStatus === 'connected'
                ? 'Backend conectado'
                : serverStatus === 'checking'
                  ? 'Comprobando backend...'
                  : 'Sin conexión con el backend'}
            </Text>
            <Text variant="mono" style={{ fontSize: 11, color: colors.gray }} numberOfLines={1}>
              {serverUrl}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.configBtn}
          onPress={() => {
            setTempUrl(serverUrl);
            setTestResult(null);
            setModalVisible(true);
          }}
          hitSlop={8}
        >
          <Settings2 size={18} color={colors.ink} />
        </Pressable>
      </View>

      {/* Modal para configurar la IP/URL del Backend */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Globe size={20} color={colors.ink} />
              <Text variant="title">Servidor Backend</Text>
            </View>

            <Text variant="body" style={{ color: colors.gray, marginBottom: spacing.sm, fontSize: 13 }}>
              Indica la URL de la API de UMLForge (FastAPI puerto 8000).
            </Text>

            <Input
              label="URL del Servidor"
              value={tempUrl}
              onChangeText={setTempUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.0.32:8000"
            />

            {/* Accesos rápidos */}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: spacing.sm }}>
              <Pressable
                style={styles.presetChip}
                onPress={() => setTempUrl('http://localhost:8000')}
              >
                <Text variant="caption" style={{ fontWeight: '600' }}>USB (localhost:8000)</Text>
              </Pressable>
              <Pressable
                style={styles.presetChip}
                onPress={() => setTempUrl('http://192.168.0.32:8000')}
              >
                <Text variant="caption" style={{ fontWeight: '600' }}>Wi-Fi (192.168.0.32:8000)</Text>
              </Pressable>
            </View>

            {testResult ? (
              <Text
                variant="caption"
                style={{
                  color: testResult.includes('exitosa') ? colors.successText : colors.errorText,
                  fontWeight: '600',
                  marginVertical: 4,
                }}
              >
                {testResult}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, justifyContent: 'flex-end' }}>
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => setModalVisible(false)}
                disabled={testingUrl}
              />
              <Button
                label="Probar y Guardar"
                onPress={() => void handleSaveServer()}
                loading={testingUrl}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  serverBar: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  serverStatusInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.cream,
    borderWidth: border.thin,
    borderColor: colors.ink,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: border.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    borderWidth: border.thin,
    borderColor: colors.ink,
  },
});
