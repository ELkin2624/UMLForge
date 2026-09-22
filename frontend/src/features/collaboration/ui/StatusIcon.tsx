import React from 'react';
import { Wifi, WifiOff, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import type { CollaborationStatus } from '../model/types';

interface StatusIconProps {
  status: CollaborationStatus;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  switch (status) {
    case 'connecting':
      return <Loader size={14} className="animate-spin text-amber-500" />;
    case 'connected':
      return <Wifi size={14} className="text-emerald-500" />;
    case 'synced':
      return <CheckCircle size={14} className="text-emerald-500" />;
    case 'error':
      return <AlertCircle size={14} className="text-rose-500" />;
    case 'disconnected':
    case 'idle':
    default:
      return <WifiOff size={14} className="text-slate-400" />;
  }
};
