import { View } from 'react-native';

import { logout } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { unregisterPush } from '@/features/notifications/push';
import { API_ORIGIN } from '@/shared/api/config';
import { spacing } from '@/shared/theme/tokens';
import { Avatar, Button, Card, Chip, Screen, Text } from '@/shared/ui';

export default function ProfileScreen() {
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
