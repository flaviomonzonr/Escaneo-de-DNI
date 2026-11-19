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
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';

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
      label: 'Consulta DNI & Registro',
      code: 'VIEW_SCAN',
      icon: Scan,
      description: 'Factiliza API y Registro Manual',
    },
    {
      id: 'batch_excel',
      label: 'Generar Excel por Lote',
      code: 'BATCH_GEN',
      icon: FileSpreadsheet,
      description: 'Lotes cronológicos',
    },
    {
      id: 'templates',
      label: 'Plantillas Excel',
      code: 'XLSX_MAP',
      icon: Layers,
      description: 'Mapeo de celdas NISIRA',
    },
    {
      id: 'scan_history',
      label: 'Historial de Registros',
      code: 'DB_RECORDS',
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
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Main Vertical Sidebar - Responde dinámicamente a todos los temas */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between transition-all duration-200 ease-in-out select-none shadow-2xl border-r ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Top Section: Brand & Nav Items */}
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          
          {/* Header Brand */}
          <div
            className="flex items-center justify-between p-3.5 border-b min-h-[58px]"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              {/* Chavín Lithic Stepped Emblem */}
              <div className="relative flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-[#162A4F] to-[#0B1528] p-0.5 border border-cyan-400/40 shadow-glow-turquoise flex items-center justify-center">
                <div className="w-full h-full bg-[#060D1A] rounded-[6px] flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-1 bg-cyan-400 rounded-2xs mb-0.5"></div>
                    <div className="w-4 h-1 bg-teal-400 rounded-2xs mb-0.5"></div>
                    <div className="w-2.5 h-1 bg-cyan-400 rounded-2xs"></div>
                  </div>
                </div>
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1 font-mono">
                  <div className="flex items-center space-x-1.5 leading-none">
                    <span className="text-xs font-black text-white tracking-wider">
                      ESCANDNI
                    </span>
                    <span className="text-[10px] text-cyan-400 font-black">
                      CHAVÍN
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold truncate mt-1">
                    ENTERPRISE_OCR_v2.6
                  </p>
                </div>
              )}
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#101F3B] lg:hidden transition min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop / Tablet Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#101F3B] transition btn-precision border border-transparent hover:border-[#1E3557]"
              title={collapsed ? 'Expandir menú' : 'Contraer a riel de iconos'}
            >
              {collapsed ? (
                <ChevronsRight className="w-4 h-4 text-cyan-400" />
              ) : (
                <ChevronsLeft className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-1.5">
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
                  className={`w-full flex items-center rounded-lg transition-all duration-150 group relative text-left min-h-[44px] btn-precision ${
                    collapsed
                      ? 'justify-center p-2.5'
                      : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#101F3B] text-white font-bold border border-cyan-400/60 shadow-md shadow-cyan-950/50'
                      : 'text-slate-300 hover:text-white hover:bg-[#0B1528] border border-transparent hover:border-[#1E3557]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`flex-shrink-0 transition-colors ${
                        isActive
                          ? 'text-cyan-400'
                          : 'text-slate-400 group-hover:text-cyan-300'
                      }`}
                    >
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </div>

                    {!collapsed && (
                      <div className="min-w-0">
                        <span className="text-xs font-bold block leading-tight truncate">
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold block leading-tight truncate mt-0.5">
                          {item.code}
                        </span>
                      </div>
                    )}
                  </div>

                  {!collapsed && (
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isActive ? 'text-cyan-400 translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                  )}

                  {/* Tooltip in Collapsed / Rail Mode */}
                  {collapsed && (
                    <div className="absolute left-full ml-2.5 px-2.5 py-1 rounded-md bg-[#0B1528] border border-[#274468] text-white font-mono text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-xl z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Telemetry & Ubigeo reference */}
        <div
          className="p-2.5 border-t space-y-2 font-mono text-xs"
          style={{ backgroundColor: 'var(--bg-viewfinder)', borderColor: 'var(--border-subtle)' }}
        >
          {!collapsed && (
            <a
              href={api.getUbigeoExcelUrl()}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-2 px-2.5 py-2 rounded-md transition group btn-precision text-xs shadow-xs"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              title="Descargar base oficial de Ubigeos en Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block font-bold">UBIGEO_DB.XLSX</span>
                <span className="block text-[9px] text-[var(--text-muted)] font-semibold">1,839 DISTRITOS</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300" />
            </a>
          )}

          <div
            className={`flex items-center rounded-md border ${
              collapsed
                ? 'justify-center p-2'
                : 'px-2.5 py-1.5 justify-between'
            }`}
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    isOnline ? 'bg-teal-400 opacity-75' : 'bg-cyan-500 opacity-75'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-teal-400' : 'bg-cyan-400'
                  }`}
                />
              </span>
              {!collapsed && (
                <span className="text-[11px] font-bold truncate block" style={{ color: 'var(--text-secondary)' }}>
                  {isOnline ? 'RAPIDOCR: ONLINE' : 'ENGINE: OFFLINE'}
                </span>
              )}
            </div>

            {!collapsed && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40">
                v2.6
              </span>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
