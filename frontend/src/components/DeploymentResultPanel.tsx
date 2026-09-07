import { DeploymentResult } from '../types/api-responses';

interface Props {
  result: DeploymentResult | null;
  onClose: () => void;
}

export const DeploymentResultPanel = ({ result, onClose }: Props) => {
  if (!result) return null;

  return (
    <div style={{ border: '1px solid #ccc', margin: '10px', padding: '10px', background: '#f0f8ff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Resultados de Despliegue</h3>
        <button onClick={onClose}>X</button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <p><strong>Estado general:</strong> {result.success ? '✅ Éxito' : '❌ Falló'}</p>
        {result.error && <p style={{ color: 'red' }}><strong>Error:</strong> {result.error}</p>}
        <p><strong>Duración:</strong> {result.duration_ms} ms</p>
        
        <h4>Servicios</h4>
        <ul>
          <li>PostgreSQL: {result.postgres_status.status === 'up' ? '🟢 UP' : '🔴 DOWN'}</li>
          <li>Spring Boot: {result.spring_boot_status.status === 'up' ? '🟢 UP' : '🔴 DOWN'}</li>
        </ul>

        {result.test_summary && (
          <>
            <h4>Pruebas Newman</h4>
            <ul>
              <li>Total: {result.test_summary.total}</li>
              <li>Pasadas: {result.test_summary.passed}</li>
              <li>Fallidas: {result.test_summary.failed}</li>
              <li>Omitidas: {result.test_summary.skipped}</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
