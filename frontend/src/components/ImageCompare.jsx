import React, { useState } from 'react';
import { Layers, Eye, Zap, CheckCircle, ShieldAlert, Crop, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export default function ImageCompare({ scanResult }) {
  const [activeSide, setActiveSide] = useState('front'); // 'front' | 'back'
  const [viewMode, setViewMode] = useState('enhanced'); // 'enhanced' | 'original'

  if (!scanResult) return null;

  const quality = activeSide === 'front' ? scanResult.quality_front : scanResult.quality_back;
  const origImgUrl = activeSide === 'front' ? api.getImageUrl(scanResult.front_image_orig) : api.getImageUrl(scanResult.back_image_orig);
  const enhImgUrl = activeSide === 'front' ? api.getImageUrl(scanResult.front_image_enhanced) : api.getImageUrl(scanResult.back_image_enhanced);

  const isBlurry = quality?.is_blurry;
  const laplacianScore = quality?.laplacian_var || 0;

  return (
    <div className="card-enterprise bg-[#0B1528] p-4 rounded-xl border border-[#1E3557] shadow-xl space-y-3.5 lg:sticky lg:top-20 text-white">
      
      {/* Header & Controls Toolbar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1E3557]">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="font-black text-white text-xs uppercase tracking-wider">Inspección OpenCV</h3>
        </div>

        {/* Side switcher (Anverso / Reverso) */}
        <div className="flex items-center space-x-1 bg-[#060D1A] p-0.5 rounded-lg border border-[#1D334E]">
          <button
            type="button"
            onClick={() => setActiveSide('front')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition btn-precision ${
              activeSide === 'front'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Anverso
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('back')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition btn-precision ${
              activeSide === 'back'
                ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Reverso
          </button>
        </div>
      </div>

      {/* Quality & Crop Status Banner */}
      <div className="space-y-1.5">
        {isBlurry ? (
          <div className="px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-500/50 flex items-center space-x-2 text-rose-200 text-[11px] font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="truncate">Posible baja nitidez (Varianza: {laplacianScore})</span>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-[#0A3D44]/90 border border-teal-400/50 flex items-center justify-between text-teal-200 text-[11px] font-bold">
            <div className="flex items-center space-x-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-teal-300 stroke-[2.5]" />
              <span>Nitidez Óptima (Varianza: <strong className="text-white">{laplacianScore}</strong>)</span>
            </div>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-teal-900/80 text-teal-200 text-[9px] font-black border border-teal-500/40">
              <Crop className="w-2.5 h-2.5" />
              <span>RECORTADO</span>
            </span>
          </div>
        )}
      </div>

      {/* Image Display Canvas (Only the Clean Cropped DNI) */}
      <div className="relative rounded-xl overflow-hidden border border-[#1E3557] bg-[#040914] aspect-[1.586] flex items-center justify-center group shadow-inner">
        <img
          src={viewMode === 'enhanced' ? enhImgUrl : origImgUrl}
          alt={`DNI Recortado ${viewMode} ${activeSide}`}
          className="w-full h-full object-contain transition-all duration-200"
        />

        {/* View Mode Toggle Pill inside bottom */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between">
          <div className="px-2.5 py-1 rounded-md bg-[#040914]/90 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-500/40 flex items-center space-x-1.5 shadow-sm">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{viewMode === 'enhanced' ? 'CLAHE + Nitidez' : 'Color Original'}</span>
          </div>

          <div className="flex items-center space-x-1 bg-[#040914]/90 backdrop-blur-md p-0.5 rounded-lg border border-[#274468] shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('enhanced')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center space-x-1 ${
                viewMode === 'enhanced'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3 text-slate-950 stroke-[2.5]" />
              <span>Mejorada</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center space-x-1 ${
                viewMode === 'original'
                  ? 'bg-[#162A4F] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3 text-slate-400" />
              <span>Original</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
