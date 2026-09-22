import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HolstTheme } from '@umlforge/ui';
import { useApp } from '../../src/AppContext';

export default function DynamicEntityScreen() {
  const router = useRouter();
  const { entity: entityParam } = useLocalSearchParams<{ entity: string }>();
  const { schemaEngine, apiClient } = useApp();

  const entityConfig = schemaEngine.getEntity(entityParam || '');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [entityParam]);

  async function loadData() {
    if (!entityConfig) return;
    setLoading(true);
    try {
      const data = await apiClient.get(entityConfig.resource_path);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      // Mock data fallback para visualización rápida si el backend no está corriendo
      setItems([
        { id: 1, nombre: 'Registro de Prueba 1', precio: 25.0, especialidad: 'General', estado: 'Activo' },
        { id: 2, nombre: 'Registro de Prueba 2', precio: 40.0, especialidad: 'Especial', estado: 'Pendiente' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setFormData({});
    setFormErrors({});
    setModalVisible(true);
  }

  async function handleSubmit() {
    if (!entityConfig) return;

    // 1. Validar formulario con SchemaEngine
    const validation = schemaEngine.validateForm(entityConfig, formData);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(entityConfig.resource_path, formData);
      setModalVisible(false);
      loadData();
    } catch (err: any) {
      // Si falla llamada de red, agregamos localmente para feedback inmediato de UI
      setItems((prev: any[]) => [{ id: Date.now(), ...formData }, ...prev]);
      setModalVisible(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!entityConfig) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Entidad '{entityParam}' no encontrada en el esquema.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const visibleFields = schemaEngine.getVisibleListFields(entityConfig);

  return (
    <View style={styles.container}>
      {/* Barra de cabecera */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{entityConfig.plural_name}</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Registros */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={HolstTheme.colors.primary700} />
          <Text style={styles.loadingText}>Cargando datos desde {entityConfig.resource_path}...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: any) => String(item.id || Math.random())}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: any }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardId}>#{item.id}</Text>
                <Text style={styles.cardTitle}>{item.nombre || item.name || `${entityConfig.name} #${item.id}`}</Text>
              </View>

              <View style={styles.fieldsContainer}>
                {visibleFields.map((field: any) => (
                  <View key={field.name} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{field.label}:</Text>
                    <Text style={styles.fieldValue}>
                      {schemaEngine.formatFieldValue(field, item[field.name])}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay registros creados aún.</Text>
            </View>
          }
        />
      )}

      {/* Modal para Crear Registro Dinámico */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear {entityConfig.name}</Text>

            <ScrollView style={styles.formScroll}>
              {entityConfig.fields
                .filter((f: any) => !f.is_primary_key)
                .map((field: any) => (
                  <View key={field.name} style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {field.label} {field.required ? '*' : ''}
                    </Text>
                    <TextInput
                      style={[styles.input, formErrors[field.name] ? styles.inputError : null]}
                      placeholder={`Ingrese ${field.label.toLowerCase()}`}
                      keyboardType={
                        field.ui_type === 'number' || field.ui_type === 'currency'
                          ? 'numeric'
                          : field.ui_type === 'email'
                          ? 'email-address'
                          : 'default'
                      }
                      value={String(formData[field.name] || '')}
                      onChangeText={(val: string) => setFormData({ ...formData, [field.name]: val })}
                    />
                    {formErrors[field.name] ? (
                      <Text style={styles.fieldErrorText}>{formErrors[field.name]}</Text>
                    ) : null}
                  </View>
                ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>{submitting ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HolstTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: HolstTheme.spacing.md,
    backgroundColor: HolstTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: HolstTheme.colors.border,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    color: HolstTheme.colors.primary700,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: HolstTheme.colors.textMain,
  },
  createButton: {
    backgroundColor: HolstTheme.colors.primary700,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: HolstTheme.borderRadius.sm,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: HolstTheme.spacing.lg,
  },
  loadingText: {
    marginTop: 10,
    color: HolstTheme.colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: HolstTheme.colors.error,
    fontSize: 15,
    marginBottom: 10,
  },
  listContent: {
    padding: HolstTheme.spacing.md,
    gap: HolstTheme.spacing.sm,
  },
  card: {
    backgroundColor: HolstTheme.colors.surface,
    borderRadius: HolstTheme.borderRadius.md,
    padding: HolstTheme.spacing.md,
    borderWidth: 1,
    borderColor: HolstTheme.colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardId: {
    color: HolstTheme.colors.primary600,
    fontWeight: 'bold',
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: HolstTheme.colors.textMain,
  },
  fieldsContainer: {
    gap: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 13,
    color: HolstTheme.colors.textMuted,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '500',
    color: HolstTheme.colors.textMain,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: HolstTheme.colors.textMuted,
  },
  button: {
    backgroundColor: HolstTheme.colors.primary700,
    padding: 10,
    borderRadius: 6,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: HolstTheme.colors.surface,
    borderRadius: HolstTheme.borderRadius.lg,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: HolstTheme.colors.primary900,
    marginBottom: 16,
  },
  formScroll: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: HolstTheme.colors.textMain,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: HolstTheme.colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: HolstTheme.colors.surface,
  },
  inputError: {
    borderColor: HolstTheme.colors.error,
  },
  fieldErrorText: {
    color: HolstTheme.colors.error,
    fontSize: 11,
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: HolstTheme.colors.surfaceSubtle,
  },
  cancelButtonText: {
    color: HolstTheme.colors.textMain,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: HolstTheme.colors.primary700,
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
