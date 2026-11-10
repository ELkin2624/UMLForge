import { Bell, Check, Users } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptInvitation,
  listNotifications,
  markAllRead,
  markRead,
  rejectInvitation,
} from '@/features/notifications/api';
import { relativeTime } from '@/shared/format';
import { useAsync } from '@/shared/useAsync';
import { colors, spacing } from '@/shared/theme/tokens';
import { Button, Card, Chip, EmptyState, ErrorBox, Loading, Text } from '@/shared/ui';
import type { AppNotification } from '@/types/api';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAsync(listNotifications, []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(id: number, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setBusyId(null);
    }
  }

  const unread = (data ?? []).filter((n) => !n.read).length;

  function renderItem({ item: n }: { item: AppNotification }) {
    const invitationId = n.type === 'DIAGRAM_INVITATION' ? Number(n.data?.invitation_id) || null : null;
    return (
      <Card tone={n.read ? 'white' : 'yellow'}>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {invitationId ? <Users size={16} color={colors.ink} /> : <Bell size={16} color={colors.ink} />}
            <Text style={{ fontWeight: '700', flex: 1 }}>{n.title}</Text>
            {!n.read ? <Chip label="Nueva" tone="peach" /> : null}
          </View>
          <Text>{n.message}</Text>
          <Text variant="caption">{relativeTime(n.created_at)}</Text>
          {invitationId && !n.read ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Aceptar"
                loading={busyId === n.id}
                onPress={() => void run(n.id, () => acceptInvitation(invitationId))}
              />
              <Button
                label="Rechazar"
                variant="secondary"
                disabled={busyId === n.id}
                onPress={() => void run(n.id, () => rejectInvitation(invitationId))}
              />
            </View>
          ) : !n.read ? (
            <Button
              label="Marcar como leída"
              variant="secondary"
              icon={<Check size={16} color={colors.ink} />}
              loading={busyId === n.id}
              onPress={() => void run(n.id, () => markRead(n.id))}
            />
          ) : null}
        </View>
      </Card>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text variant="title" style={{ flex: 1 }}>
          Notificaciones
        </Text>
        {unread > 0 ? (
          <Button label="Leer todas" variant="secondary" onPress={() => void run(-1, markAllRead)} />
        ) : null}
      </View>
      {actionError ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorBox message={actionError} />
        </View>
      ) : null}
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBox message={error} onRetry={() => void reload()} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(n) => String(n.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
          ListEmptyComponent={<EmptyState title="Todo al día" hint="No tienes notificaciones." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
});
