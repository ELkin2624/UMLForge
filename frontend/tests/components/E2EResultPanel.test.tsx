import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { E2EResultPanel } from '../../src/components/E2EResultPanel';
import { E2EResult } from '../../src/types/api-responses';

describe('E2EResultPanel', () => {
  const mockSuccessResult: E2EResult = {
    success: true,
    project_name: 'barberia',
    total_duration_ms: 18500,
    stages: [
      { name: 'validation', status: 'success', duration_ms: 10, error: null, logs: null },
      { name: 'generation', status: 'success', duration_ms: 410, error: null, logs: null },
      { name: 'extraction', status: 'success', duration_ms: 80, error: null, logs: null },
      { name: 'postgres', status: 'success', duration_ms: 6350, error: null, logs: null },
      { name: 'maven', status: 'success', duration_ms: 26550, error: null, logs: 'Maven Build Success Log' },
      { name: 'spring', status: 'success', duration_ms: 10, error: null, logs: null },
      { name: 'health', status: 'success', duration_ms: 19890, error: null, logs: null },
      { name: 'newman', status: 'success', duration_ms: 4370, error: null, logs: 'Newman execution summary' },
    ],
    test_summary: {
      total: 21,
      passed: 21,
      failed: 0,
      skipped: 0,
    },
  };

  it('no debería renderizar nada si el resultado es null', () => {
    const { container } = render(<E2EResultPanel result={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('debería renderizar panel de éxito con resumen de tests y etapas traducidas', () => {
    render(<E2EResultPanel result={mockSuccessResult} onClose={vi.fn()} />);

    expect(screen.getByText('Validación E2E completada con éxito')).toBeInTheDocument();
    expect(screen.getByText('barberia')).toBeInTheDocument();
    expect(screen.getByText('18.50s')).toBeInTheDocument();
    expect(screen.getByText('✓ Verified')).toBeInTheDocument();

    // Test summary
    expect(screen.getByText('Assertions')).toBeInTheDocument();
    expect(screen.getAllByText('21')).toHaveLength(2); // total: 21, passed: 21

    // Etapas traducidas
    expect(screen.getByText('Validación')).toBeInTheDocument();
    expect(screen.getByText('Generación')).toBeInTheDocument();
    expect(screen.getByText('Extracción')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Maven')).toBeInTheDocument();
    expect(screen.getByText('Spring Boot')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.getByText('Newman')).toBeInTheDocument();

    // Logs disponibles
    expect(screen.getAllByText('Ver logs')).toHaveLength(2);
  });

  it('debería renderizar panel de fallo con badges y errores', () => {
    const mockFailureResult: E2EResult = {
      success: false,
      project_name: 'test_fail',
      total_duration_ms: 5000,
      stages: [
        { name: 'validation', status: 'success', duration_ms: 10, error: null, logs: null },
        { name: 'maven', status: 'failure', duration_ms: 4990, error: 'Compilation failure', logs: 'Stacktrace error' },
      ],
      test_summary: null,
    };

    render(<E2EResultPanel result={mockFailureResult} onClose={vi.fn()} />);

    expect(screen.getByText('Validación E2E fallida')).toBeInTheDocument();
    expect(screen.getByText(/Compilation failure/)).toBeInTheDocument();
    expect(screen.getByText('● Runtime verification')).toBeInTheDocument();
  });

  it('debería llamar a onClose al hacer clic en el botón de cerrar', () => {
    const onClose = vi.fn();
    render(<E2EResultPanel result={mockSuccessResult} onClose={onClose} />);

    const closeBtn = screen.getByTitle('Cerrar panel');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
