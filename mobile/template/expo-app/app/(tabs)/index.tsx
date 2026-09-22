import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { HolstTheme } from '@umlforge/ui';
import { useApp } from '../../src/AppContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { manifest, schemaEngine, activeDriverName } = useApp();
  const entities = schemaEngine.getAllEntities();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header del Negocio */}
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{manifest.branding.app_title}</Text>
        <Text style={styles.heroSubtitle}>
          Dominio: <Text style={styles.bold}>{manifest.domain.toUpperCase()}</Text> • Schema v{manifest.schema_version}
        </Text>
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>IA: {activeDriverName}</Text>
          </View>
        </View>
      </View>

      {/* Sección de Entidades UML Generadas */}
      <Text style={styles.sectionTitle}>Módulos del Sistema ({entities.length})</Text>
      <Text style={styles.sectionSubtitle}>
        Tablas y vistas CRUD generadas automáticamente a partir del diagrama UML:
      </Text>

      <View style={styles.grid}>
        {entities.map((entity: any) => {
          const fieldCount = entity.fields.length;
          const relationCount = entity.relations.length;

          return (
            <TouchableOpacity
              key={entity.name}
              style={styles.entityCard}
              onPress={() => router.push(`/(tabs)/${entity.name.toLowerCase()}`)}
            >
              <View style={styles.entityHeader}>
                <View style={styles.iconPlaceholder}>
                  <Text style={styles.iconText}>
                    {entity.icon === 'scissors' ? '✂️' : entity.icon === 'calendar' ? '📅' : entity.icon === 'user' ? '👤' : '📦'}
                  </Text>
                </View>
                <Text style={styles.entityName}>{entity.plural_name}</Text>
              </View>

              <Text style={styles.entityMeta}>
                {fieldCount} atributos • {relationCount} relaciones
              </Text>
              <Text style={styles.entityEndpoint}>Endpoint: {entity.resource_path}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.cardActionText}>Ver registros & administrar →</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HolstTheme.colors.background,
  },
  content: {
    padding: HolstTheme.spacing.md,
  },
  heroCard: {
    backgroundColor: HolstTheme.colors.primary100,
    borderRadius: HolstTheme.borderRadius.lg,
    padding: HolstTheme.spacing.lg,
    marginBottom: HolstTheme.spacing.lg,
    borderWidth: 1,
    borderColor: HolstTheme.colors.primary300,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: HolstTheme.colors.primary900,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: HolstTheme.colors.primary800,
    marginBottom: HolstTheme.spacing.sm,
  },
  bold: {
    fontWeight: 'bold',
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 6,
  },
  badge: {
    backgroundColor: HolstTheme.colors.primary700,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: HolstTheme.borderRadius.full,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: HolstTheme.colors.textMain,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: HolstTheme.colors.textMuted,
    marginBottom: HolstTheme.spacing.md,
  },
  grid: {
    gap: HolstTheme.spacing.md,
  },
  entityCard: {
    backgroundColor: HolstTheme.colors.surface,
    borderRadius: HolstTheme.borderRadius.md,
    padding: HolstTheme.spacing.md,
    borderWidth: 1,
    borderColor: HolstTheme.colors.border,
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: HolstTheme.spacing.xs,
  },
  iconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: HolstTheme.colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 18,
  },
  entityName: {
    fontSize: 17,
    fontWeight: '700',
    color: HolstTheme.colors.textMain,
  },
  entityMeta: {
    fontSize: 13,
    color: HolstTheme.colors.textMuted,
    marginTop: 4,
  },
  entityEndpoint: {
    fontSize: 12,
    color: HolstTheme.colors.primary700,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  cardFooter: {
    marginTop: HolstTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: HolstTheme.colors.surfaceSubtle,
    paddingTop: HolstTheme.spacing.xs,
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: HolstTheme.colors.primary700,
  },
});
