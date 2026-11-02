import React, { useMemo } from 'react';
import { Apollon } from '@tumaet/apollon';
import { canonicalToApollon } from '../../../adapters/apollon-adapter';
import { canonicalComponentToApollon } from '../../../adapters/component-apollon-adapter';
import type { UMLModel } from '../../../types/canonical-model';

interface VersionPreviewProps {
  data: UMLModel;
  /** Clave para forzar el remontaje al cambiar de versión. */
  versionKey: number;
}

/** Vista de solo lectura de un snapshot del diagrama (Apollon con readonly). */
export const VersionPreview: React.FC<VersionPreviewProps> = ({ data, versionKey }) => {
  const isEmpty = !data?.classes?.length && !data?.components?.length;
  const apollonModel = useMemo(() => {
    if (isEmpty) return undefined;
    const isComponent = !data.classes?.length && Boolean(data.components?.length);
    return isComponent ? canonicalComponentToApollon(data) : canonicalToApollon(data);
  }, [data, isEmpty]);

  if (isEmpty) {
    return <div className="vh-preview-empty">Esta versión no tiene elementos.</div>;
  }

  return (
    <div className="vh-preview-canvas">
      <Apollon
        key={`preview-${versionKey}`}
        style={{ width: '100%', height: '100%' }}
        readonly
        defaultModel={apollonModel}
        defaultType="ClassDiagram"
      />
    </div>
  );
};
