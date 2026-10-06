import React, { useState } from 'react';
import {
  Menu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';

export default function Header({
  activeTab,
  setMobileOpen,
  healthInfo,
  onRetryConnection,
}) {
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const isOnline = healthInfo && (healthInfo.status === 'healthy' || healthInfo.status === 'degraded');

  const handleDownloadBackup = () => {
    try {
      setDownloadingBackup(true);
      const url = api.getDownloadFullBackupZipUrl();
      window.open(url, '_blank');
    } catch (e) {
      console.error('Error downloading backup:', e);
    } finally {
      setTimeout(() => setDownloadingBackup(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200/90 shadow-2xs select-none">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Left: Mobile Menu Trigger & Context Title */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl text-slate-700 hover:text-[#0A1E5C] hover:bg-slate-100 active:bg-slate-200 lg:hidden transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-xs font-bold text-[#0A1E5C]">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#10B981]' : 'bg-rose-500 animate-ping'}`} />
              <span className="truncate max-w-[200px] sm:max-w-none">
                Agroindustrias Chavín • EscanDNI
              </span>
            </div>
          </div>

          {/* Right: User Profile, Backup & System Status */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Quick Backup Download Button */}
            <button
              onClick={handleDownloadBackup}
              disabled={downloadingBackup}
              className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 hover:text-[#1D4ED8] transition shadow-2xs active:scale-95"
              title="Descargar copia de seguridad (.ZIP)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>{downloadingBackup ? 'Descargando...' : 'Backup (.ZIP)'}</span>
            </button>

            {/* Backend Status Pill */}
            {isOnline ? (
              <div
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 shadow-2xs"
                title="Servidor conectado y listo"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                <span className="hidden sm:inline">Conectado</span>
              </div>
            ) : (
              <button
                onClick={onRetryConnection}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-[11px] font-bold text-rose-700 shadow-2xs transition animate-pulse"
                title="Reintentar conexión"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="text-[10px] sm:text-[11px]">Reconectar</span>
                <RefreshCw className="w-3 h-3 text-rose-600" />
              </button>
            )}

            {/* User Profile */}
            <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800">
              <div className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-[10px] font-bold">
                <User className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold hidden sm:inline">Flavio</span>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
