import { useState, useEffect } from 'react';
import { ActiveMenuType } from './types';

export function useTopMenuState() {
  const [activeMenu, setActiveMenu] = useState<ActiveMenuType>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cerrar dropdown si se hace clic fuera del contenedor
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.top-menu-item-container')) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: 'file' | 'validate' | 'deploy' | 'share') => {
    setActiveMenu(prev => (prev === menu ? null : menu));
  };

  const closeMenu = () => {
    setActiveMenu(null);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return {
    activeMenu,
    toggleMenu,
    closeMenu,
    mobileMenuOpen,
    setMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };
}
