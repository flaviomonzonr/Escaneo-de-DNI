import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  X,
  Sparkles,
  ArrowRight,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  FileText,
  Scan,
  FileSearch,
  RotateCcw,
  Zap,
} from 'lucide-react';
import CameraModal from './CameraModal';

export default function CaptureZone({
  docType,
  setDocType,
  frontFile,
  setFrontFile,
  frontPreview,
  setFrontPreview,
  backFile,
  setBackFile,
  backPreview,
  setBackPreview,
  onStartScan,
  isScanning,
  scanStep,
}) {
  // Camera modal state: { isOpen: boolean, mode: 'sequential' | 'front' | 'back' }
  const [cameraState, setCameraState] = useState({ isOpen: false, mode: 'sequential' });
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  // Handle file select (Gallery / File picker)
  const handleFileChange = (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(previewUrl);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file);
      setBackPreview(previewUrl);
    }
  };

  // Drag & drop handlers
  const handleDrop = (e, side) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(previewUrl);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file);
      setBackPreview(previewUrl);
    }
  };

  // Sequential camera capture complete
  const handleSequentialCapture = (frontData, backData) => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);

    setFrontFile(frontData.file);
    setFrontPreview(frontData.previewUrl);

    setBackFile(backData.file);
    setBackPreview(backData.previewUrl);
  };

  // Single retake capture
  const handleSingleCapture = (side, file, previewUrl) => {
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(previewUrl);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file);
      setBackPreview(previewUrl);
    }
  };

  const removeImage = (side) => {
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(null);
      setFrontPreview(null);
      if (frontInputRef.current) frontInputRef.current.value = '';
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(null);
      setBackPreview(null);
      if (backInputRef.current) backInputRef.current.value = '';
    }
  };

  // Synthetic demo loader
  const loadDemoScenario = (scenario) => {
    const createDemoCanvas = (title, subtitle, color, isBack) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 1000, 630);
      if (color === 'blue') {
        grad.addColorStop(0, '#0F2B66');
        grad.addColorStop(1, '#1E4DB8');
      } else {
        grad.addColorStop(0, '#0A4B40');
        grad.addColorStop(1, '#10806E');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 630);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 12;
      ctx.strokeRect(20, 20, 960, 590);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('REPÚBLICA DEL PERÚ - REGISTRO NACIONAL (RENIEC)', 50, 80);

      ctx.font = 'bold 44px sans-serif';
      ctx.fillText(title, 50, 160);

      ctx.font = '28px sans-serif';
      ctx.fillText(subtitle, 50, 220);

      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(isBack ? 'CÓDIGO MRZ / UBIGEO / DIRECCIÓN' : 'DNI N°: 47859632 • FECHA: 15/04/1992', 50, 320);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(new File([blob], `demo_${isBack ? 'back' : 'front'}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
      });
    };

    Promise.all([
      createDemoCanvas('DNI DE PRUEBA (ANVERSO)', 'JUAN CARLOS PÉREZ QUISPE', 'blue', false),
      createDemoCanvas('DNI DE PRUEBA (REVERSO)', 'DIRECCIÓN: AV. LOS LAURELES 450 - LIMA', 'teal', true),
    ]).then(([fFile, bFile]) => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
      setFrontFile(fFile);
      setFrontPreview(URL.createObjectURL(fFile));
      setBackFile(bFile);
      setBackPreview(URL.createObjectURL(bFile));
    });
  };

  const hasPhotos = Boolean(frontFile && backFile);
  const canScan = hasPhotos && !isScanning;

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in select-none">
      
      {/* ============================================================ */}
      {/* 1. PANEL SUPERIOR: TITULO, INSIGNIAS Y BOTON PRINCIPAL */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Left: Clear Title, Subtitle & Elegant Badges */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-[#1D4ED8]" />
              <span>Alta Precisión</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/70 text-[11px] font-bold">
              <Zap className="w-3 h-3 text-[#0D9488]" />
              <span>Reconocimiento Automático</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
              <span>OpenCV + RapidOCR AI</span>
            </span>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Escaneo de Documento DNI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Captura o sube las fotos del Anverso y Reverso para extraer los datos y llenar plantillas Excel automáticamente.
            </p>
          </div>
        </div>

        {/* Right: Prominent Primary Action Button */}
        <button
          type="button"
          onClick={() => setCameraState({ isOpen: true, mode: 'sequential' })}
          className="flex items-center justify-center space-x-2.5 px-6 py-3.5 bg-gradient-to-r from-[#1E40AF] to-[#0D9488] hover:from-[#1E3A8A] hover:to-[#0F766E] active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition transform min-h-[48px] shrink-0"
        >
          <Camera className="w-4 h-4 text-white" />
          <span>📸 Escanear DNI con Cámara</span>
          <ArrowRight className="w-4 h-4 text-blue-100" />
        </button>

      </div>

      {/* ============================================================ */}
      {/* 2. TARJETAS ANVERSO Y REVERSO (1 COL CELULAR, 2 COLS PC) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Anverso (Cara Frontal - Azul Corporativo) */}
        <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200 bg-white flex flex-col justify-between">
          
          {/* Card Header */}
          <div className="bg-[#1E40AF] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-white/20 text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <div>
                <h3 className="font-bold text-white text-xs sm:text-sm leading-tight">
                  Anverso (Cara Frontal)
                </h3>
                <span className="text-[10px] text-blue-200 font-medium">Foto, Nombres, Apellidos y DNI</span>
              </div>
            </div>

            {frontPreview && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                <CheckCircle2 className="w-3 h-3" />
                <span>Listo</span>
              </span>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            {!frontPreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'front')}
                className="relative border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl p-4 text-center transition-all bg-blue-50/30 hover:bg-blue-50/60 flex flex-col items-center justify-center min-h-[170px]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1E40AF] flex items-center justify-center mb-1.5 shadow-2xs">
                  <CreditCard className="w-5 h-5" />
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Sin foto del Anverso
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Toma una foto con la cámara o selecciona desde tu galería
                </p>

                {/* Touch Buttons */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setCameraState({ isOpen: true, mode: 'front' })}
                    className="flex-1 min-w-[130px] flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white text-xs font-bold rounded-lg shadow-xs active:scale-95 transition min-h-[44px]"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Tomar Anverso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => frontInputRef.current?.click()}
                    className="flex items-center justify-center space-x-1 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg shadow-2xs active:scale-95 transition min-h-[44px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Galería</span>
                  </button>
                  <input
                    ref={frontInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'front')}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              /* Image Preview Container */
              <div className="space-y-2.5">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[1.586] flex items-center justify-center shadow-inner">
                  <img
                    src={frontPreview}
                    alt="Anverso DNI"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => removeImage('front')}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-white transition shadow-sm backdrop-blur-xs active:scale-95"
                    title="Eliminar foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraState({ isOpen: true, mode: 'front' })}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition min-h-[40px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Repetir Foto Anverso</span>
                  </button>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-1 pt-2 border-t border-slate-100 text-[10px] font-semibold text-slate-600">
              <div className="flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-[#1E40AF]" />
                <span>Auto-recorte OpenCV</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-[#1E40AF]" />
                <span>Alineación de bordes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Reverso (Cara Posterior - Turquesa) */}
        <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200 bg-white flex flex-col justify-between">
          
          {/* Card Header */}
          <div className="bg-[#0D9488] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-white/20 text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <div>
                <h3 className="font-bold text-white text-xs sm:text-sm leading-tight">
                  Reverso (Cara Posterior)
                </h3>
                <span className="text-[10px] text-teal-100 font-medium">MRZ, Dirección, Ubigeo y Estado Civil</span>
              </div>
            </div>

            {backPreview && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                <CheckCircle2 className="w-3 h-3" />
                <span>Listo</span>
              </span>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            {!backPreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'back')}
                className="relative border-2 border-dashed border-teal-200 hover:border-teal-400 rounded-xl p-4 text-center transition-all bg-teal-50/30 hover:bg-teal-50/60 flex flex-col items-center justify-center min-h-[170px]"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-[#0D9488] flex items-center justify-center mb-1.5 shadow-2xs">
                  <CreditCard className="w-5 h-5" />
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Sin foto del Reverso
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Toma una foto con la cámara o selecciona desde tu galería
                </p>

                {/* Touch Buttons */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setCameraState({ isOpen: true, mode: 'back' })}
                    className="flex-1 min-w-[130px] flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold rounded-lg shadow-xs active:scale-95 transition min-h-[44px]"
                  >
                    <Camera className="w-3.5 h-3.5 text-teal-200" />
                    <span>Tomar Reverso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => backInputRef.current?.click()}
                    className="flex items-center justify-center space-x-1 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg shadow-2xs active:scale-95 transition min-h-[44px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Galería</span>
                  </button>
                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'back')}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              /* Image Preview Container */
              <div className="space-y-2.5">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[1.586] flex items-center justify-center shadow-inner">
                  <img
                    src={backPreview}
                    alt="Reverso DNI"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => removeImage('back')}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-white transition shadow-sm backdrop-blur-xs active:scale-95"
                    title="Eliminar foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraState({ isOpen: true, mode: 'back' })}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition min-h-[40px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Repetir Foto Reverso</span>
                  </button>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-1 pt-2 border-t border-slate-100 text-[10px] font-semibold text-slate-600">
              <div className="flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-[#0D9488]" />
                <span>Lectura MRZ OCR</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-[#0D9488]" />
                <span>Extracción de Ubigeo</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* 3. BARRA INFERIOR DE ACCION (RESPONSIVE) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Left: Quick Test Button */}
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500">
            <FileSearch className="w-4 h-4 text-[#1E40AF]" />
            <span>¿Probar sin cámara?</span>
          </div>

          <button
            type="button"
            onClick={() => loadDemoScenario('DNI_DEMO')}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs transition shadow-2xs active:scale-95 min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-[#1E40AF]" />
            <span>Cargar DNI de Prueba</span>
          </button>
        </div>

        {/* Right: Primary Scan OCR Button */}
        <button
          onClick={onStartScan}
          disabled={!canScan}
          className={`w-full sm:w-auto flex items-center justify-center space-x-2.5 px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md min-h-[48px] ${
            canScan
              ? 'bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:from-[#0F766E] hover:to-[#0D9488] text-white shadow-teal-900/20 active:scale-98 cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
          }`}
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>{scanStep || 'Procesando con OpenCV y OCR...'}</span>
            </>
          ) : (
            <>
              <Scan className="w-4 h-4" />
              <span>Escanear y Extraer Datos Automáticamente</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={cameraState.isOpen}
        onClose={() => setCameraState({ isOpen: false, mode: 'sequential' })}
        mode={cameraState.mode}
        onCompleteSequential={handleSequentialCapture}
        onSingleCapture={handleSingleCapture}
      />

    </div>
  );
}
