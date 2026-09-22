import React from 'react';
import { Tabs } from 'expo-router';
import { HolstTheme } from '@umlforge/ui';
import { useApp } from '../../src/AppContext';

export default function TabsLayout() {
  const { manifest } = useApp();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: manifest.branding.primary_color || HolstTheme.colors.primary700,
        tabBarInactiveTintColor: HolstTheme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: HolstTheme.colors.surface,
          borderTopColor: HolstTheme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: HolstTheme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: HolstTheme.colors.border,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: HolstTheme.colors.textMain,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Negocio',
          headerTitle: manifest.branding.app_title,
          tabBarLabel: 'Entidades',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Asistente IA',
          headerTitle: `Asistente IA (${manifest.display_name})`,
          tabBarLabel: 'Asistente IA',
        }}
      />
      <Tabs.Screen
        name="[entity]"
        options={{
          href: null, // Oculto de la barra inferior, se navega dinámicamente
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
