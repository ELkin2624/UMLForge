import { Tabs } from 'expo-router';
import { Bell, FolderOpen, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { unreadCount } from '@/features/notifications/api';
import { border, colors } from '@/shared/theme/tokens';

export default function TabsLayout() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      unreadCount()
        .then((r) => alive && setUnread(r.count))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.gray,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.card, borderTopWidth: border.thick, borderTopColor: colors.ink },
        tabBarActiveBackgroundColor: colors.btnPeach,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Proyectos', tabBarIcon: ({ color }) => <FolderOpen size={20} color={color} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ color }) => <Bell size={20} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, color: colors.card },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <UserRound size={20} color={color} /> }} />
    </Tabs>
  );
}
