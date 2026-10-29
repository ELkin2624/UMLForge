import React from 'react';
import { Tabs } from 'expo-router';
import { HolstTheme } from '@umlforge/ui';
import { useApp } from '../../src/AppContext'; 

export default function TabsLayout() {
  const { manifest } = useApp();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: manifest.branding.primary_color || '#8B5CF6',
        tabBarInactiveTintColor: HolstTheme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#0f131c',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#0f131c',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#f8fafc',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lienzo',
          headerTitle: `${manifest.branding.app_title} - Lienzo`,
          tabBarLabel: 'Lienzo',
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          title: 'Actividad',
          headerTitle: 'Actividad del Equipo (Live Feed)',
          tabBarLabel: 'Actividad',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Mi Arquitecto IA',
          headerTitle: 'Mi Arquitecto IA (Privado)',
          tabBarLabel: 'Mi IA',
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
