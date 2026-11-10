import { Linking, View } from 'react-native';

import { logout } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { unregisterPush, usePushStatus, type PushStatus } from '@/features/notifications/push';
import { API_ORIGIN } from '@/shared/api/config';
import { spacing } from '@/shared/theme/tokens';
import { Avatar, Button, Card, Chip, Screen, Text } from '@/shared/ui';

const PUSH_HINTS: Partial<Record<PushStatus, string>> = {
  denied: 'Las notificaciones están desactivadas: no recibirás avisos con la app cerrada.',
  unsupported: 'Los avisos push solo funcionan en un dispositivo físico, no en un emulador.',
  error: 'No se pudo activar los avisos push. Se reintentará al volver a iniciar sesión.',
};

export default function ProfileScreen() {
  const pushStatus = usePushStatus((s) => s.status);
  const pushHint = PUSH_HINTS[pushStatus];
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const name = user?.display_name || user?.username || 'Usuario';

  return (
    <Screen>
      <Text variant="title">Perfil</Text>
      <Card>
        <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
          <Avatar name={name} size={56} />
          <View>
            <Text variant="heading">{name}</Text>
            <Text variant="caption">@{user?.username}</Text>
            {user?.email ? <Text variant="caption">{user.email}</Text> : null}
          </View>
          <Chip label="Modo solo lectura" tone="mint" />
        </View>
      </Card>
      <Card tone="cream">
        <View style={{ gap: 4 }}>
          <Text variant="label">Servidor</Text>
          <Text variant="mono">{API_ORIGIN}</Text>
        </View>
      </Card>
      {pushHint ? (
        <Card tone="cream">
          <View style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
            <Text variant="label">Avisos push</Text>
            <Text variant="caption">{pushHint}</Text>
            {pushStatus === 'denied' ? (
              <Button
                label="Abrir ajustes"
                variant="secondary"
                onPress={() => void Linking.openSettings()}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
      <Button
        label="Cerrar sesión"
        variant="secondary"
        onPress={() => {
          void unregisterPush().then(logout).finally(clearAuth);
        }}
      />
    </Screen>
  );
}
