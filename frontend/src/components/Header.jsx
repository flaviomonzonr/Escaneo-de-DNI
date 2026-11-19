import React, { useState } from 'react';
import {
  Menu,
  RefreshCw,
  Wifi,
  Copy,
  Check,
  Smartphone,
  Tablet,
  Monitor,
  X,
  Moon,
  Sun,
} from 'lucide-react';

export default function Header({
  setMobileOpen,
  healthInfo,
  onRetryConnection,
  theme = 'dark',
  setTheme,
  deviceMode = 'desktop',
  setDeviceMode,
}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');
  const isOnline = healthInfo && (healthInfo.status === 'healthy' || healthInfo.status === 'degraded');

  const wifiUrls = healthInfo?.wifi_urls?.length
    ? healthInfo.wifi_urls
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? [window.location.origin]
    : [];

  const publicTunnelUrl = healthInfo?.tunnel_url || 'https://ons-subjects-pizza-specialties.trycloudflare.com';

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2500);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-[#060D1A]/95 backdrop-blur-md border-b border-[#1E3557] select-none shadow-md">
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">
          
          {/* Left: Mobile Navigation Button & Chavín Brand Emblem */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#101F3B] lg:hidden transition min-h-[40px] min-w-[40px] flex items-center justify-center btn-precision border border-transparent hover:border-[#1E3557]"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 font-mono text-xs">
              {/* Chavín Stepped Monolith Glyph */}
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-[#101F3B] p-0.5 shadow-glow-turquoise flex items-center justify-center">
                <div className="w-full h-full bg-[#060D1A] rounded-[4px] flex items-center justify-center">
                  <span className="text-[10px] font-black text-cyan-300">CH</span>
                </div>
              </div>

              <span className="font-extrabold text-white tracking-wider flex items-center gap-1.5">
                <span className="text-sm font-black tracking-widest text-white">ESCANDNI</span>
                <span className="text-cyan-400 font-bold">//</span>
                <span className="text-slate-300 font-semibold tracking-wide hidden sm:inline">CHAVÍN_OCR</span>
              </span>
            </div>
          </div>

          {/* Center: Device Switcher Segmented Control (Solo visible en monitores/escritorio) */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="flex items-center p-1 rounded-lg bg-[#040914] border border-[#1D334E] shadow-inner font-mono text-xs">
              
              {/* Celular Tab */}
              <button
                type="button"
                onClick={() => setDeviceMode('mobile')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all btn-precision ${
                  deviceMode === 'mobile'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-300 hover:text-white font-semibold'
                }`}
                title="Modo Móvil (~390px) con obturador táctil"
              >
                <Smartphone className={`w-3.5 h-3.5 ${deviceMode === 'mobile' ? 'text-slate-950' : 'text-cyan-400'}`} />
                <span className="hidden sm:inline">Móvil</span>
              </button>

              {/* Tablet Tab */}
              <button
                type="button"
                onClick={() => setDeviceMode('tablet')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all btn-precision ${
                  deviceMode === 'tablet'
                    ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-300 hover:text-white font-semibold'
                }`}
                title="Modo Tablet (~768px)"
              >
                <Tablet className={`w-3.5 h-3.5 ${deviceMode === 'tablet' ? 'text-slate-950' : 'text-teal-400'}`} />
                <span className="hidden sm:inline">Tablet</span>
              </button>

              {/* Escritorio Tab */}
              <button
                type="button"
                onClick={() => setDeviceMode('desktop')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all btn-precision ${
                  deviceMode === 'desktop'
                    ? 'bg-gradient-to-r from-slate-200 to-slate-100 text-slate-950 font-black shadow-sm'
                    : 'text-slate-300 hover:text-white font-semibold'
                }`}
                title="Modo Escritorio"
              >
                <Monitor className={`w-3.5 h-3.5 ${deviceMode === 'desktop' ? 'text-slate-950' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Escritorio</span>
              </button>

            </div>
          </div>

          {/* Right: Discrete Backend LED, Theme Switch & Profile */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            
            {/* Discrete Backend LED Indicator - Strict: No yellow/amber */}
            {isOnline ? (
              <div
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#0A3D44]/80 border border-teal-400/50 text-teal-200 font-mono text-xs font-bold shadow-xs"
                title="Backend FastAPI en línea (Puerto 8000)"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-300 shadow-xs"></span>
                </span>
                <span className="hidden sm:inline">API_ONLINE</span>
              </div>
            ) : (
              <button
                onClick={onRetryConnection}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#101F3B] hover:bg-[#162A4F] border border-cyan-400/60 text-cyan-200 font-mono text-xs font-bold transition btn-precision"
                title="Backend desconectado. Haz clic para reconectar."
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </span>
                <span className="hidden sm:inline">RECONECTAR</span>
                <RefreshCw className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
              </button>
            )}

            {/* Dark / Light Minimal Toggle - Strict: No yellow sun */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-slate-300 hover:text-white bg-[#0B1528] hover:bg-[#101F3B] border border-[#1E3557] transition btn-precision"
              title={theme === 'dark' ? 'Cambiar a modo Claro' : 'Cambiar a modo Oscuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-cyan-300" />
              ) : (
                <Moon className="w-4 h-4 text-slate-300" />
              )}
            </button>

            {/* Wi-Fi Share Link */}
            <button
              onClick={() => setShowShareModal(true)}
              className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#0B1528] hover:bg-[#101F3B] border border-[#1E3557] text-slate-200 hover:text-white font-mono text-xs font-bold transition btn-precision shadow-xs"
              title="Compartir link en red local"
            >
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span>WI-FI</span>
            </button>

            {/* User Avatar */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-[#0B1528] border border-[#1E3557] text-white font-mono text-xs font-bold">
              <div className="w-4 h-4 rounded-xs bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-black text-[10px] border border-cyan-400/50">
                F
              </div>
              <span className="hidden xl:inline text-slate-200">ADMIN</span>
            </div>

          </div>

        </div>
      </div>

      {/* Share Wi-Fi Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="card-enterprise max-w-md w-full bg-[#0B1528] border border-[#274468] overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#1E3557] flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white">RED_LOCAL_SHARED_LINK</span>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#101F3B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-mono text-xs">
              {/* Local Wi-Fi Link - Prioritario y Rápido */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 block text-[11px] font-bold">⚡ ENLACE WI-FI LOCAL (RECOMENDADO - INSTANTÁNEO):</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-sans font-semibold">1 segundo</span>
                </div>
                {wifiUrls.map((url, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-md bg-[#040914] border border-emerald-500/50 shadow-sm">
                    <span className="text-emerald-300 font-bold truncate pr-2 text-xs">{url}</span>
                    <button
                      onClick={() => handleCopy(url)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center space-x-1 transition shadow"
                    >
                      {copiedUrl === url ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl === url ? 'COPIADO' : 'COPIAR'}</span>
                    </button>
                  </div>
                ))}
                <span className="text-[10px] text-slate-400 font-sans block">
                  Conecta tu celular al mismo Wi-Fi y abre este enlace. No depende de internet ni tiene demoras.
                </span>
              </div>

              {/* Enlace Nube Temporal (Para Celular 4G/5G u otra laptop) */}
              <div className="space-y-1.5 pt-2 border-t border-[#1E3557]">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 block text-[11px] font-bold">🌐 ENLACE NUBE (CELULAR 4G/5G U OTRA LAPTOP):</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded font-sans font-semibold">Túnel Activo</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-[#040914] border border-cyan-500/40">
                  <span className="text-cyan-300 font-mono truncate pr-2 text-[11px]">{publicTunnelUrl}</span>
                  <button
                    onClick={() => handleCopy(publicTunnelUrl)}
                    className="px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-bold flex items-center space-x-1 border border-cyan-500/60"
                  >
                    {copiedUrl === publicTunnelUrl ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl === publicTunnelUrl ? 'COPIADO' : 'COPIAR'}</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Abre este enlace desde cualquier lugar (datos móviles 4G/5G o en otra laptop). 100% seguro con HTTPS sin pantallas en blanco.
                </span>
              </div>

              <div className="text-[11px] text-slate-300 bg-[#060D1A] p-3 rounded-md border border-[#1E3557] font-sans leading-relaxed">
                💡 <strong>Consejo:</strong> Usa el enlace verde Wi-Fi para que cargue en 1 segundo en tu celular o tablet.
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#1E3557] flex justify-end bg-[#040914]/40">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-1.5 rounded-md bg-[#101F3B] hover:bg-[#162A4F] text-white font-mono text-xs font-bold btn-precision border border-[#1E3557]"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
