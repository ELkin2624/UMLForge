import { ValidationResult } from '../types/api-responses';

interface Props {
  result: ValidationResult | null;
  onClose: () => void;
}

export const ValidationPanel = ({ result, onClose }: Props) => {
  if (!result) return null;

  return (
    <div style={{ border: '1px solid #ccc', margin: '10px', padding: '10px', background: '#f9f9f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Resultados de Validación</h3>
        <button onClick={onClose}>X</button>
      </div>
      
      {result.is_valid ? (
        <p style={{ color: 'green' }}>✅ El modelo es válido.</p>
      ) : (
        <div>
          <p style={{ color: 'red' }}>❌ El modelo tiene errores:</p>
          <ul>
            {result.errors.map((err, i) => (
              <li key={i}>
                <strong>{err.field}</strong>: {err.message} 
                {err.model_element_id && ` (ID: ${err.model_element_id})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
