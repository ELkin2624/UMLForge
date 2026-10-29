import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { HolstTheme } from '@umlforge/ui';
import { useApp } from '../../src/AppContext';

interface AuditLogEntry {
  diagram_id: string;
  actor: string;
  action_summary: string;
  timestamp: string;
}

export default function AuditFeedScreen() {
  const { manifest } = useApp();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Endpoint base para el backend FastAPI
  const API_URL = 'http://10.0.2.2:8000/api/v1'; // 10.0.2.2 para emulador Android, localhost para web/iOS
  const diagramId = manifest.id || '1';

  async function fetchAuditFeed() {
    try {
      const res = await fetch(`${API_URL}/ai/audit-feed/${diagramId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.warn('Error fetching audit feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAuditFeed();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditFeed();
  };

  const renderItem = ({ item }: { item: AuditLogEntry }) => {
    const isAI = item.actor.toLowerCase().includes('ia') || item.actor.toLowerCase().includes('gemini');
    let timeStr = item.timestamp;
    try {
      timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {}

    return (
      <View style={[styles.card, isAI ? styles.cardAI : styles.cardUser]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, isAI ? styles.badgeAI : styles.badgeUser]}>
            <Text style={styles.badgeText}>{isAI ? '🤖 IA' : '👤 Equipo'}</Text>
          </View>
          <Text style={styles.actorName}>{item.actor}</Text>
          <Text style={styles.timeText}>{timeStr}</Text>
        </View>
        <Text style={styles.actionSummary}>{item.action_summary}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muro de Actividad en Vivo</Text>
        <Text style={styles.headerSubtitle}>
          Decisiones de arquitectura y cambios realizados por el equipo y la IA
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Cargando bitácora de auditoría...</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay eventos de auditoría registrados.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f131c',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardAI: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  cardUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeAI: {
    backgroundColor: '#8B5CF6',
  },
  badgeUser: {
    backgroundColor: '#3b82f6',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
  },
  actionSummary: {
    fontSize: 13,
    color: '#f1f5f9',
    lineHeight: 18,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
});
