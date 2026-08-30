import { useRef } from 'react';
import { Upload, Save } from 'lucide-react';
import { useModelStore } from '../store/model-store';

interface FileImportExportProps {
  disabled?: boolean;
}

export const FileImportExport: React.FC<FileImportExportProps> = ({ disabled = false }) => {
  const { model, setModel } = useModelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (
        parsed &&
        typeof parsed === 'object' &&
        (Array.isArray(parsed.classes) || Array.isArray(parsed.components) || parsed.id)
      ) {
        // Asegurar que las listas no presentes en el JSON importado
        // mantengan su valor del modelo actual (para no borrar submodelos).
        // Usamos ?? para solo reemplazar si el valor es null o undefined.
        const currentModel = useModelStore.getState().model;
        
        const getMergedList = <T,>(parsedList: T[] | undefined, currentList: T[] | undefined): T[] => {
          if (parsedList && parsedList.length > 0) return parsedList;
          return currentList ?? [];
        };
        
        const canonicalModel: typeof model = {
          id: parsed.id ?? currentModel?.id ?? crypto.randomUUID(),
          name: parsed.name ?? currentModel?.name ?? 'Imported Model',
          uml_version: parsed.uml_version ?? currentModel?.uml_version ?? '2.5.1',
          classes: getMergedList(parsed.classes, currentModel?.classes),
          relationships: getMergedList(parsed.relationships, currentModel?.relationships),
          components: getMergedList(parsed.components, currentModel?.components),
          interfaces: getMergedList(parsed.interfaces, currentModel?.interfaces),
          ports: getMergedList(parsed.ports, currentModel?.ports),
          connectors: getMergedList(parsed.connectors, currentModel?.connectors),
          dependencies: getMergedList(parsed.dependencies, currentModel?.dependencies),
          diagrams: getMergedList(parsed.diagrams, currentModel?.diagrams),
        };
        setModel(canonicalModel);
      } else {
        alert('Formato de modelo inválido.');
      }
    } catch {
      alert('Error leyendo el archivo JSON.');
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (!model) return;
    const json = JSON.stringify(model, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name || 'model'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button disabled={disabled} onClick={() => fileInputRef.current?.click()}>
        <Upload size={16} /> Importar JSON
      </button>
      <input 
        type="file" 
        accept=".json" 
        style={{ display: 'none' }} 
        ref={fileInputRef} 
        onChange={handleImport}
      />
      
      <button disabled={!model || disabled} onClick={handleExport}>
        <Save size={16} /> Exportar JSON
      </button>
    </>
  );
};

