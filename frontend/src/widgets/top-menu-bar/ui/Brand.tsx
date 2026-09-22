import React from 'react';
import { Layers } from 'lucide-react';

export const Brand: React.FC = () => {
  return (
    <div className="top-menu-brand">
      <div className="brand-shape-box">
        <Layers size={16} className="brand-logo-icon" />
      </div>
      <div className="brand-text-group">
        <span className="brand-name">
          UML<span className="brand-highlight">Forge</span>
        </span>
      </div>
      <span className="top-menu-badge">v2.5</span>
    </div>
  );
};


