import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SqlGenerationDialog } from './SqlGenerationDialog';
import { generateSql } from './api';
import type { UMLModel } from '../../types/canonical-model';

vi.mock('./api', () => ({ generateSql: vi.fn() }));
const model = { id: 'demo', name: 'Demo', classes: [], relationships: [] } as unknown as UMLModel;

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  URL.createObjectURL = vi.fn(() => 'blob:sql');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('Generación SQL', () => {
  it('descarga ambas salidas con cantidad configurable', async () => {
    vi.mocked(generateSql).mockResolvedValue(new Blob(['zip']));
    render(<SqlGenerationDialog model={model} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Registros por entidad'), { target: { value: '7' } });
    fireEvent.click(screen.getByText('Descargar SQL'));
    expect(generateSql).toHaveBeenCalledWith(model, 'both', 7);
    await screen.findByText('Descarga preparada.');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('permite descargar solo estructura sin solicitar filas', async () => {
    vi.mocked(generateSql).mockResolvedValue(new Blob(['sql']));
    render(<SqlGenerationDialog model={model} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'schema' } });
    expect(screen.queryByLabelText('Registros por entidad')).toBeNull();
    fireEvent.click(screen.getByText('Descargar SQL'));
    await waitFor(() => expect(generateSql).toHaveBeenCalledWith(model, 'schema', 3));
  });

  it('muestra errores y permite reintentar', async () => {
    vi.mocked(generateSql).mockRejectedValueOnce(new Error('Ciclo obligatorio'))
      .mockResolvedValueOnce(new Blob(['sql']));
    render(<SqlGenerationDialog model={model} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'data' } });
    fireEvent.click(screen.getByText('Descargar SQL'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ciclo obligatorio');
    fireEvent.click(screen.getByText('Descargar SQL'));
    await screen.findByText('Descarga preparada.');
    expect(generateSql).toHaveBeenLastCalledWith(model, 'data', 3);
  });

  it('bloquea envíos repetidos mientras genera y permite cerrar', async () => {
    vi.mocked(generateSql).mockReturnValue(new Promise(() => {}));
    const close = vi.fn();
    render(<SqlGenerationDialog model={model} onClose={close} />);
    fireEvent.click(screen.getByText('Descargar SQL'));
    expect(screen.getByText('Generando…')).toBeDisabled();
    expect(generateSql).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Cerrar'));
    expect(close).toHaveBeenCalledOnce();
  });
});
