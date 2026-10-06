import React from 'react';
import {
  Scan,
  FileSpreadsheet,
  History,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  X,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  healthInfo,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const mainNavItems = [
    {
      id: 'scan',
      label: 'Escanear DNI',
      icon: Scan,
      description: 'Captura y OCR Automático',
    },
    {
      id: 'batch_excel',
      label: 'Generar Excel por Lote',
      icon: FileSpreadsheet,
      description: 'Listado por fecha y hora',
    },
    {
      id: 'templates',
      label: 'Plantillas Excel',
      icon: FileSpreadsheet,
      description: 'Mapeo de celdas amarillas',
    },
    {
      id: 'scan_history',
      label: 'Historial de Registros',
      icon: History,
      description: 'Base de datos de escaneos',
    },
  ];

  const isOnline = healthInfo && (healthInfo.status === 'healthy' || healthInfo.status === 'degraded');

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Main Vertical Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between transition-all duration-300 ease-in-out select-none shadow-2xl bg-[#0B132B] border-r border-[#1E293B] ${
          collapsed ? 'w-[80px]' : 'w-[280px]'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Section: Brand & Nav Items */}
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          
          {/* Header Brand */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800/80 min-h-[76px]">
            <div className="flex items-center space-x-3 overflow-hidden">
              {/* Logo Emblem */}
              <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E40AF] to-[#0A1E5C] border border-blue-400/30 flex items-center justify-center shadow-md">
                <div className="flex w-5 h-3.5 rounded-xs overflow-hidden shadow-inner">
                  <div className="w-1/3 bg-[#DC2626]"></div>
                  <div className="w-1/3 bg-white flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1E40AF]"></div>
                  </div>
                  <div className="w-1/3 bg-[#DC2626]"></div>
                </div>
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-base font-extrabold text-white tracking-tight">
                      EscanDNI
                    </span>
                    <span className="text-base font-extrabold text-[#EF4444] tracking-tight">
                      Perú
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    Sistema Empresarial OCR
                  </p>
                </div>
              )}
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 lg:hidden transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Cerrar menú"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {collapsed ? (
                <ChevronsRight className="w-4 h-4 text-[#0D9488]" />
              ) : (
                <ChevronsLeft className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl transition-all duration-200 group relative text-left min-h-[48px] ${
                    collapsed
                      ? 'justify-center p-3'
                      : 'justify-between px-3.5 py-3'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-[#1E40AF] to-[#0D9488] text-white font-bold shadow-md shadow-blue-950/50 border border-blue-400/20'
                      : 'bg-white/3 hover:bg-white/8 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`flex-shrink-0 p-1 rounded-lg ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 group-hover:text-teal-300 transition-colors'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {!collapsed && (
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold block leading-tight truncate">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] block leading-tight truncate mt-0.5 ${
                            isActive ? 'text-blue-100 font-medium' : 'text-slate-500 group-hover:text-slate-400'
                          }`}
                        >
                          {item.description}
                        </span>
                      </div>
                    )}
                  </div>

                  {!collapsed && (
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition ${
                        isActive ? 'text-white translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'
                      }`}
                    />
                  )}

                  {/* Tooltip in Collapsed Mode */}
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-3 py-2 rounded-xl bg-[#0B132B] border border-slate-700 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-2xl z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Compact Status Pill */}
        <div className="p-3 border-t border-slate-800/80 space-y-2 bg-black/20">
          <div
            className={`flex items-center rounded-xl transition border border-slate-800 bg-slate-900/60 ${
              collapsed
                ? 'justify-center p-2.5'
                : 'px-3 py-2.5 justify-between'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full block flex-shrink-0 ${
                  isOnline ? 'bg-[#10B981] shadow-glow-green' : 'bg-rose-500 animate-ping'
                }`}
              />
              {!collapsed && (
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-medium">Estado del Sistema</span>
                  <span className="text-xs font-bold text-slate-200 truncate block">
                    {isOnline ? 'RapidOCR AI • Conectado' : 'Backend Desconectado'}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  isOnline
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}
              >
                {isOnline ? 'Activo' : 'Offline'}
              </span>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
