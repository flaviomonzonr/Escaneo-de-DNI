import React, { useState } from 'react';
import {
  Menu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  ShieldCheck,
  Wifi,
  Copy,
  Check,
  Smartphone,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';

export default function Header({
  activeTab,
  setMobileOpen,
  healthInfo,
  onRetryConnection,
}) {
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');
  const isOnline = healthInfo && (healthInfo.status === 'healthy' || healthInfo.status === 'degraded');

  const wifiUrls = healthInfo?.wifi_urls?.length
    ? healthInfo.wifi_urls
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? [window.location.origin]
    : [];

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2500);
  };

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
            
            {/* Share Wi-Fi Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold text-[#101BCB] transition shadow-2xs active:scale-95"
              title="Compartir link con celular o tablet en la misma red Wi-Fi"
            >
              <Wifi className="w-3.5 h-3.5 text-[#101BCB]" />
              <span className="hidden sm:inline">Compartir Wi-Fi</span>
              <span className="sm:hidden">Wi-Fi</span>
            </button>

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

      {/* Share Wi-Fi Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#080F72] to-[#101BCB] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Compartir en Red Wi-Fi Local</h3>
                  <p className="text-[11px] text-blue-200">Acceso desde Celular, Tablet u otra PC</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-slate-700 flex items-start space-x-2.5">
                <Smartphone className="w-5 h-5 text-[#101BCB] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#080F72] block">¿Cómo ingresar desde el celular?</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    1. Conecta tu celular a la <strong>misma red Wi-Fi</strong> de esta computadora.
                  </span>
                  <span className="text-[11px] text-slate-600 block">
                    2. Abre Chrome o Safari en tu celular y escribe el enlace de abajo.
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Enlace para tu Celular / Dispositivos:
                </label>

                {wifiUrls.length > 0 ? (
                  wifiUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                    >
                      <span className="font-mono text-xs font-bold text-[#101BCB] select-all truncate pr-2">
                        {url}
                      </span>
                      <button
                        onClick={() => handleCopy(url)}
                        className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                          copiedUrl === url
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#101BCB] hover:bg-[#080F72] text-white'
                        }`}
                      >
                        {copiedUrl === url ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    <span className="font-mono text-xs font-bold text-[#101BCB] block">
                      http://{window.location.hostname}:5173
                    </span>
                    <button
                      onClick={() => handleCopy(`http://${window.location.hostname}:5173`)}
                      className="mt-2 inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-[#101BCB] text-white text-xs font-bold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar Enlace</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-700 block">💡 Nota de funcionamiento:</span>
                <span>
                  El sistema funciona 100% en tu red local privada. Todos los escaneos y datos se guardan directamente en esta laptop.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
