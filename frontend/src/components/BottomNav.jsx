import React from 'react';
import {
  Scan,
  FileSpreadsheet,
  Layers,
  History,
  Camera,
} from 'lucide-react';

export default function BottomNav({
  activeTab,
  setActiveTab,
  onTriggerCamera,
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-safe lg:hidden select-none pointer-events-auto"
      aria-label="Navegación Móvil Chavín"
    >
      <div className="mx-auto max-w-sm px-3 pb-3 pt-1">
        <div className="relative flex items-center justify-around rounded-xl bg-[#040914]/95 backdrop-blur-xl border border-[#1E3557] px-2 py-1 shadow-2xl text-slate-300 font-mono text-[10px]">
          
          {/* Tab 1: Escanear */}
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-all min-h-[46px] min-w-[54px] active:scale-95 ${
              activeTab === 'scan'
                ? 'bg-[#101F3B] text-cyan-300 font-black border border-cyan-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scan className={`w-4 h-4 mb-0.5 ${activeTab === 'scan' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>SCAN</span>
          </button>

          {/* Tab 2: Lotes */}
          <button
            type="button"
            onClick={() => setActiveTab('batch_excel')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-all min-h-[46px] min-w-[54px] active:scale-95 ${
              activeTab === 'batch_excel'
                ? 'bg-[#101F3B] text-teal-300 font-black border border-teal-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 mb-0.5 ${activeTab === 'batch_excel' ? 'text-teal-400' : 'text-slate-400'}`} />
            <span>LOTES</span>
          </button>

          {/* Center Precision Shutter FAB */}
          {onTriggerCamera && (
            <button
              type="button"
              onClick={onTriggerCamera}
              className="-mt-5 p-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 transition-all transform active:scale-90 border-2 border-[#040914] shadow-lg shadow-cyan-500/30"
              title="Obturador Rápido"
            >
              <Camera className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </button>
          )}

          {/* Tab 3: Plantillas */}
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-all min-h-[46px] min-w-[54px] active:scale-95 ${
              activeTab === 'templates'
                ? 'bg-[#101F3B] text-cyan-300 font-black border border-cyan-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className={`w-4 h-4 mb-0.5 ${activeTab === 'templates' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>MAP</span>
          </button>

          {/* Tab 4: Historial */}
          <button
            type="button"
            onClick={() => setActiveTab('scan_history')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-all min-h-[46px] min-w-[54px] active:scale-95 ${
              activeTab === 'scan_history'
                ? 'bg-[#101F3B] text-teal-300 font-black border border-teal-400/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className={`w-4 h-4 mb-0.5 ${activeTab === 'scan_history' ? 'text-teal-400' : 'text-slate-400'}`} />
            <span>DATA</span>
          </button>

        </div>
      </div>
    </nav>
  );
}
