import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Toolbar } from '../../src/components/Toolbar';
import { useModelStore } from '../../src/store/model-store';
import * as modelsApi from '../../src/api/models-api';

vi.mock('../../src/api/models-api', () => ({
  validateModel: vi.fn(),
  generateProject: vi.fn(),
  deployProject: vi.fn(),
  validateE2E: vi.fn(),
}));

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useModelStore.getState().resetE2E();
    useModelStore.setState({ model: null });
  });

  it('debería tener botones deshabilitados si no hay modelo', () => {
    render(<Toolbar onValidation={vi.fn()} onDeploy={vi.fn()} onError={vi.fn()} />);
    
    expect(screen.getByRole('button', { name: /Validar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Generar ZIP/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Deploy & Test/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Validación E2E/i })).toBeDisabled();
  });

  it('debería habilitar botones cuando hay modelo y llamar al API de validación', async () => {
    useModelStore.setState({ 
      model: { id: 'm1', name: 'M', classes: [], relationships: [], components: [], interfaces: [], diagrams: [] }
    });
    const onValidation = vi.fn();
    
    (modelsApi.validateModel as any).mockResolvedValue({ is_valid: true, errors: [] });
    
    render(<Toolbar onValidation={onValidation} onDeploy={vi.fn()} onError={vi.fn()} />);
    
    const btn = screen.getByRole('button', { name: /Validar/i });
    expect(btn).not.toBeDisabled();
    
    fireEvent.click(btn);
    
    await waitFor(() => {
      expect(modelsApi.validateModel).toHaveBeenCalled();
      expect(onValidation).toHaveBeenCalledWith({ is_valid: true, errors: [] });
    });
  });

  it('debería llamar a validateE2E al hacer clic en Validación E2E', async () => {
    const mockModel = { id: 'm1', name: 'M', classes: [], relationships: [], components: [], interfaces: [], diagrams: [] };
    useModelStore.setState({ model: mockModel });

    (modelsApi.validateE2E as any).mockResolvedValue({
      success: true,
      project_name: 'M',
      total_duration_ms: 1000,
      stages: [],
      test_summary: null
    });

    render(<Toolbar onValidation={vi.fn()} onDeploy={vi.fn()} onError={vi.fn()} />);

    const e2eBtn = screen.getByRole('button', { name: /Validación E2E/i });
    expect(e2eBtn).not.toBeDisabled();

    fireEvent.click(e2eBtn);

    await waitFor(() => {
      expect(modelsApi.validateE2E).toHaveBeenCalledWith(mockModel);
    });
  });

  it('debería bloquear todas las acciones incompatibles mientras e2eState es running', () => {
    useModelStore.setState({ 
      model: { id: 'm1', name: 'M', classes: [], relationships: [], components: [], interfaces: [], diagrams: [] },
      e2eState: 'running',
    });

    render(<Toolbar onValidation={vi.fn()} onDeploy={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Validar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Generar ZIP/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Deploy & Test/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Validando E2E.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Importar JSON/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Exportar JSON/i })).toBeDisabled();
  });
});

