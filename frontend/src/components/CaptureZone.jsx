import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  X,
  ArrowRight,
  RefreshCw,
  FileText,
  Scan,
  RotateCcw,
  Check,
  Crosshair,
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
  theme = 'dark',
  deviceMode = 'desktop',
}) {
  const [cameraState, setCameraState] = useState({ isOpen: false, mode: 'front' });
  const [includeBackForAddress, setIncludeBackForAddress] = useState(false);
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  // File Select Handler
  const handleFileChange = (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(previewUrl);
      // Auto-iniciar escaneo y comprobación histórica inmediata
      if (onStartScan) {
        setTimeout(() => onStartScan(file, backFile), 150);
      }
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file);
      setBackPreview(previewUrl);
    }
  };

  // Drag & Drop
  const handleDrop = (e, side) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(previewUrl);
      if (onStartScan) {
        setTimeout(() => onStartScan(file, backFile), 150);
      }
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file);
      setBackPreview(previewUrl);
    }
  };

  // Sequential capture handler
  const handleSequentialCapture = (frontData, backData) => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);

    setFrontFile(frontData.file);
    setFrontPreview(frontData.previewUrl);

    setBackFile(backData.file);
    setBackPreview(backData.previewUrl);

    if (onStartScan) {
      setTimeout(() => onStartScan(frontData.file, backData.file), 150);
    }
  };

  // Single retake capture handler
  const handleSingleCapture = (side, file, previewUrl) => {
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(previewUrl);
      // Al tomar foto del anverso, procesar de inmediato sin pedir seguir escaneando
      if (onStartScan) {
        setTimeout(() => onStartScan(file, backFile), 150);
      }
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

  // Synthetic demo loader - Chavín Navy & Steel styling on canvas
  const loadDemoScenario = () => {
    const createDemoCanvas = (title, subtitle, isBack) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');

      // Clean Chavín Navy / Steel gradient
      const grad = ctx.createLinearGradient(0, 0, 1000, 630);
      grad.addColorStop(0, '#060D1A');
      grad.addColorStop(1, '#101F3B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 630);

      // Subtle framing in Chrysocolla Turquoise
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 940, 570);

      // Typography
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('DOCUMENTO NACIONAL DE IDENTIDAD • REPÚBLICA DEL PERÚ', 60, 80);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(title, 60, 160);

      ctx.font = '26px sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText(subtitle, 60, 220);

      ctx.font = 'bold 30px monospace';
      ctx.fillStyle = '#22D3EE';
      ctx.fillText(isBack ? 'IDPER47859632<<<<<<<<<<<<<<<<<<<' : 'DNI: 47859632 • NACIONALIDAD: PERUANA', 60, 320);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(new File([blob], `demo_${isBack ? 'back' : 'front'}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
      });
    };

    createDemoCanvas('PÉREZ QUISPE, JUAN CARLOS', 'FECHA DE NACIMIENTO: 15/04/1992', false)
      .then((fFile) => {
        if (frontPreview) URL.revokeObjectURL(frontPreview);
        setFrontFile(fFile);
        setFrontPreview(URL.createObjectURL(fFile));
        if (showBackViewfinder) {
          createDemoCanvas('DIRECCIÓN: AV. LOS LAURELES 450 - LIMA', 'UBIGEO: 150101 • ESTADO CIVIL: SOLTERO', true)
            .then((bFile) => {
              if (backPreview) URL.revokeObjectURL(backPreview);
              setBackFile(bFile);
              setBackPreview(URL.createObjectURL(bFile));
            });
        }
      });
  };

  const isForeigner = docType === 'Carnet de Extranjería';
  const showBackViewfinder = isForeigner && includeBackForAddress;
  // Solo se requiere la foto del Anverso para habilitar el escaneo
  const canScan = Boolean(frontFile) && !isScanning;

  // Grid layout adapts: 1 columna centrada si es solo Anverso, 2 columnas si se considera Reverso para Extranjero
  const gridClasses = showBackViewfinder
    ? (deviceMode === 'mobile' ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 gap-5 xl:gap-6')
    : 'max-w-2xl mx-auto w-full';

  return (
    <div className="space-y-4 select-none">
      
      {/* ============================================================ */}
      {/* 0. SELECTOR DE TIPO DE DOCUMENTO Y CONTROL DE REVERSO        */}
      {/* ============================================================ */}
      <div className="card-enterprise p-3 sm:p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border border-[#1E3557] bg-[#0B1528] shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono font-bold text-slate-300">DOCUMENTO:</span>
          <div className="flex items-center p-1 rounded-lg bg-[#060D1A] border border-[#1D334E] text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                if (setDocType) setDocType('DNI');
                setIncludeBackForAddress(false);
              }}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center space-x-1.5 btn-precision ${
                !isForeigner
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-sm border border-cyan-300/40'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🇵🇪 DNI Peruano (Solo Anverso)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (setDocType) setDocType('Carnet de Extranjería');
              }}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center space-x-1.5 btn-precision ${
                isForeigner
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black shadow-sm border border-teal-300/40'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🌐 Carnet de Extranjería</span>
            </button>
          </div>
        </div>

        {/* Solo para Extranjero: Opción para considerar el reverso para dirección */}
        {isForeigner ? (
          <label className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-200 cursor-pointer bg-[#101F3B] hover:bg-[#162A4F] px-3.5 py-2 rounded-lg border border-[#274468] hover:border-teal-400 transition select-none animate-in fade-in duration-200">
            <input
              type="checkbox"
              checked={includeBackForAddress}
              onChange={(e) => setIncludeBackForAddress(e.target.checked)}
              className="w-4 h-4 rounded border-[#274468] text-teal-400 focus:ring-teal-400 bg-[#040914] cursor-pointer"
            />
            <span className="text-teal-200">Considerar Reverso (Solo detalles de dirección)</span>
          </label>
        ) : (
          <div className="text-[11px] font-mono text-cyan-300/90 flex items-center space-x-1.5 bg-[#060D1A] px-3 py-1.5 rounded-lg border border-[#1E3557]">
            <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />
            <span>DNI: Reverso obviado. Solo se requiere foto del Anverso.</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. CALIBRATOR METRIC BAR & PRIMARY SHUTTER LAUNCHER          */}
      {/* ============================================================ */}
      <div className="card-enterprise p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border border-[#1E3557] bg-[#0B1528] shadow-lg">
        
        {/* Left: Technical Telemetry & Metadata */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#101F3B] border border-[#274468] text-white font-mono text-xs shadow-xs">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <span className="font-extrabold text-white">CALIBRADOR_CHAVÍN</span>
            <span className="text-cyan-300 font-bold">v2.6</span>
          </div>

          <div className="hidden sm:flex items-center space-x-2.5 font-mono text-xs">
            <span className="text-slate-600 font-bold">|</span>
            <span className="text-slate-300 font-medium">ESTÁNDAR: <strong className="text-white font-bold">ISO/IEC 7810 ID-1</strong></span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="text-slate-300 font-medium">PIPELINE: <strong className="text-cyan-300 font-bold">OPENCV+RAPIDOCR</strong></span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-teal-200 bg-[#0A3D44]/90 px-2.5 py-1 rounded-md border border-teal-400/50 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span>FEED_ACTIVE</span>
          </div>
        </div>

        {/* Right: Primary Shutter Button */}
        <div className="flex items-center space-x-2">
          {showBackViewfinder ? (
            <button
              type="button"
              onClick={() => setCameraState({ isOpen: true, mode: 'sequential' })}
              className="w-full md:w-auto inline-flex items-center justify-center space-x-2.5 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-mono font-black text-xs rounded-lg shadow-lg shadow-teal-500/20 btn-precision min-h-[44px] tracking-wide border border-teal-300/40"
            >
              <Camera className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>OBTURADOR SECUENCIAL (ANVERSO + REVERSO)</span>
              <ArrowRight className="w-4 h-4 text-slate-950 opacity-80" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCameraState({ isOpen: true, mode: 'front' })}
              className="w-full md:w-auto inline-flex items-center justify-center space-x-2.5 px-6 py-2.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-slate-950 font-mono font-black text-xs rounded-lg shadow-lg shadow-cyan-500/20 btn-precision min-h-[44px] tracking-wide border border-cyan-300/40"
            >
              <Camera className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>📸 OBTURAR ANVERSO (CÁMARA)</span>
              <ArrowRight className="w-4 h-4 text-slate-950 opacity-80" />
            </button>
          )}
        </div>

      </div>

      {/* ============================================================ */}
      {/* 2. VIEWFINDERS: ANVERSO (Y REVERSO SI EXTRANJERO ACTIVO)     */}
      {/* ============================================================ */}
      <div className={gridClasses}>
        
        {/* ==================== VIEWFINDER 1: ANVERSO ==================== */}
        <div className="card-enterprise p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-[#0B1528] border border-[#1E3557] shadow-xl hover:border-cyan-500/50 transition-all">
          
          {/* Header minimalista y técnico */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1E3557] text-xs">
            <div className="flex items-center space-x-2.5 font-mono">
              <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 text-[11px] font-extrabold">
                VIEW_01
              </span>
              <span className="font-extrabold text-white text-sm tracking-wider">
                ANVERSO (CARA FRONTAL)
              </span>
            </div>

            {/* Telemetry Badge */}
            {frontPreview ? (
              <span className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-teal-200 bg-[#0A3D44]/90 px-2.5 py-1 rounded-md border border-teal-400/50">
                <Check className="w-3.5 h-3.5 text-teal-300 stroke-[3]" />
                <span>CAPTURED_OK</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 font-mono text-xs font-semibold text-slate-200 bg-[#101F3B] px-2.5 py-1 rounded-md border border-[#274468]">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>STANDBY</span>
              </span>
            )}
          </div>

          {/* Viewfinder Viewport with Corner Reticles */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'front')}
            className="viewfinder-viewport aspect-[1.586] technical-grid flex flex-col items-center justify-center p-3 text-center border-[#1E3557] min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"
          >
            {/* Corner Reticles (L-shaped precision brackets) */}
            <div className="reticle-corner reticle-tl" />
            <div className="reticle-corner reticle-tr" />
            <div className="reticle-corner reticle-bl" />
            <div className="reticle-corner reticle-br" />

            {/* Subtle Center Crosshair */}
            <div className="center-crosshair" />

            {/* HUD Telemetry Coordinates */}
            <div className="absolute top-2.5 left-6 text-xs font-mono font-bold text-slate-200 bg-[#060D1A]/90 px-2 py-0.5 rounded border border-[#1E3557] pointer-events-none hidden sm:block">
              POS: [FRONT_CANVAS]
            </div>
            <div className="absolute top-2.5 right-6 text-xs font-mono font-bold text-slate-200 bg-[#060D1A]/90 px-2 py-0.5 rounded border border-[#1E3557] pointer-events-none hidden sm:block">
              DIM: 85.60×53.98mm (ID-1)
            </div>

            {!frontPreview ? (
              <>
                {/* Precision Laser Line (Turquoise sweep) */}
                <div className="laser-line-precision">
                  <div className="laser-aura-beam" />
                </div>

                <div className="z-10 flex flex-col items-center space-y-3 max-w-sm px-2">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-950/40">
                    <Crosshair className="w-6 h-6 text-cyan-300" />
                  </div>
                  
                  <div className="bg-[#060D1A]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#1E3557] shadow-md">
                    <h4 className="font-mono text-sm font-extrabold text-white tracking-wide">
                      CALIBRADOR ANVERSO
                    </h4>
                    <p className="text-xs text-slate-200 font-semibold mt-1 font-sans leading-snug">
                      Alinee el documento dentro del marco para corrección de perspectiva
                    </p>
                  </div>

                  {/* Ergonomic Shutter Actions */}
                  <div className="pt-2 flex items-center gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={() => setCameraState({ isOpen: true, mode: 'front' })}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-mono text-xs font-black btn-precision flex items-center justify-center space-x-2 min-h-[44px] shadow-md shadow-cyan-500/25 border border-cyan-300/40"
                    >
                      <Camera className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                      <span>Obturar Anverso</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className="py-2.5 px-4 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-white font-mono text-xs font-bold btn-precision flex items-center justify-center space-x-1.5 min-h-[44px] border border-[#274468] shadow-sm"
                      title="Importar archivo de imagen"
                    >
                      <Upload className="w-4 h-4 text-cyan-400" />
                      <span>Archivo</span>
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
              </>
            ) : (
              /* Image Loaded in Viewfinder */
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={frontPreview}
                  alt="Anverso DNI Calibrado"
                  className="w-full h-full object-contain"
                />

                {/* Laser animation while scanning */}
                {isScanning && (
                  <div className="laser-line-precision scanning">
                    <div className="laser-aura-beam" />
                  </div>
                )}

                {/* Viewport Overlay Controls */}
                <div className="absolute top-2 right-2 flex items-center space-x-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => removeImage('front')}
                    className="p-1.5 rounded-md bg-[#040914]/90 hover:bg-rose-600 text-white border border-white/20 transition btn-precision"
                    title="Descartar imagen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-auto">
                  <span className="font-mono text-xs font-bold text-teal-200 bg-[#040914]/90 px-2.5 py-1 rounded border border-teal-500/40">
                    STATUS: READY_FOR_EXTRACT
                  </span>
                  <button
                    type="button"
                    onClick={() => setCameraState({ isOpen: true, mode: 'front' })}
                    className="font-mono text-xs font-bold text-white bg-[#0B1528] hover:bg-[#101F3B] px-3 py-1.5 rounded border border-[#274468] flex items-center space-x-1.5 btn-precision shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Re-obturar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Technical Pipeline Checklist */}
          <div className="flex items-center justify-between pt-1.5 font-mono text-xs font-bold text-slate-200 border-t border-[#1E3557]">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-glow-turquoise"></span>
              <span>AUTO_DESKEW: ENABLED</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-glow-turquoise"></span>
              <span>FOUR_POINT_TRANSFORM</span>
            </span>
          </div>

        </div>

        {/* ==================== VIEWFINDER 2: REVERSO (SOLO EXTRANJEROS SI ACTIVO) ==================== */}
        {showBackViewfinder && (
        <div className="card-enterprise p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-[#0B1528] border border-[#1E3557] shadow-xl hover:border-teal-500/50 transition-all animate-in fade-in duration-200">
          
          {/* Header minimalista y técnico */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1E3557] text-xs">
            <div className="flex items-center space-x-2.5 font-mono">
              <span className="px-2.5 py-0.5 rounded bg-teal-500/20 border border-teal-400/60 text-teal-300 text-[11px] font-extrabold">
                VIEW_02
              </span>
              <span className="font-extrabold text-white text-sm tracking-wider">
                REVERSO (DETALLES DE DIRECCIÓN - EXTRANJERO)
              </span>
            </div>

            {/* Telemetry Badge */}
            {backPreview ? (
              <span className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-teal-200 bg-[#0A3D44]/90 px-2.5 py-1 rounded-md border border-teal-400/50">
                <Check className="w-3.5 h-3.5 text-teal-300 stroke-[3]" />
                <span>CAPTURED_OK</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 font-mono text-xs font-semibold text-slate-200 bg-[#101F3B] px-2.5 py-1 rounded-md border border-[#274468]">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>STANDBY</span>
              </span>
            )}
          </div>

          {/* Viewfinder Viewport with Corner Reticles */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'back')}
            className="viewfinder-viewport aspect-[1.586] technical-grid flex flex-col items-center justify-center p-3 text-center border-[#1E3557] min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"
          >
            {/* Corner Reticles in Petroleum Teal */}
            <div className="reticle-corner reticle-tl" style={{ borderColor: '#14B8A6' }} />
            <div className="reticle-corner reticle-tr" style={{ borderColor: '#14B8A6' }} />
            <div className="reticle-corner reticle-bl" style={{ borderColor: '#14B8A6' }} />
            <div className="reticle-corner reticle-br" style={{ borderColor: '#14B8A6' }} />

            {/* Subtle Center Crosshair */}
            <div className="center-crosshair" style={{ opacity: 0.5, borderColor: '#14B8A6' }} />

            {/* HUD Telemetry Coordinates */}
            <div className="absolute top-2.5 left-6 text-xs font-mono font-bold text-slate-200 bg-[#060D1A]/90 px-2 py-0.5 rounded border border-[#1E3557] pointer-events-none hidden sm:block">
              POS: [REVERSE_CANVAS]
            </div>
            <div className="absolute top-2.5 right-6 text-xs font-mono font-bold text-teal-300 bg-[#060D1A]/90 px-2 py-0.5 rounded border border-teal-500/50 pointer-events-none hidden sm:block">
              PARSER: ICAO_9303_TD1
            </div>

            {!backPreview ? (
              <>
                {/* Precision Laser Line (Teal sweep) */}
                <div className="laser-line-precision">
                  <div className="laser-aura-beam" />
                </div>

                <div className="z-10 flex flex-col items-center space-y-3 max-w-sm px-2">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-400/40 flex items-center justify-center shadow-lg shadow-teal-950/40">
                    <Crosshair className="w-6 h-6 text-teal-300" />
                  </div>
                  
                  <div className="bg-[#060D1A]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#1E3557] shadow-md">
                    <h4 className="font-mono text-sm font-extrabold text-white tracking-wide">
                      CALIBRADOR REVERSO
                    </h4>
                    <p className="text-xs text-slate-200 font-semibold mt-1 font-sans leading-snug">
                      Alinee las 3 líneas MRZ y el bloque de dirección en el encuadre
                    </p>
                  </div>

                  {/* Ergonomic Shutter Actions */}
                  <div className="pt-2 flex items-center gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={() => setCameraState({ isOpen: true, mode: 'back' })}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-mono text-xs font-black btn-precision flex items-center justify-center space-x-2 min-h-[44px] shadow-md shadow-teal-500/25 border border-teal-300/40"
                    >
                      <Camera className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                      <span>Obturar Reverso</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className="py-2.5 px-4 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-white font-mono text-xs font-bold btn-precision flex items-center justify-center space-x-1.5 min-h-[44px] border border-[#274468] shadow-sm"
                      title="Importar archivo de imagen"
                    >
                      <Upload className="w-4 h-4 text-teal-400" />
                      <span>Archivo</span>
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
              </>
            ) : (
              /* Image Loaded in Viewfinder */
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={backPreview}
                  alt="Reverso DNI Calibrado"
                  className="w-full h-full object-contain"
                />

                {/* Laser animation while scanning */}
                {isScanning && (
                  <div className="laser-line-precision scanning">
                    <div className="laser-aura-beam" />
                  </div>
                )}

                {/* Viewport Overlay Controls */}
                <div className="absolute top-2 right-2 flex items-center space-x-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => removeImage('back')}
                    className="p-1.5 rounded-md bg-[#040914]/90 hover:bg-rose-600 text-white border border-white/20 transition btn-precision"
                    title="Descartar imagen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-auto">
                  <span className="font-mono text-xs font-bold text-teal-200 bg-[#040914]/90 px-2.5 py-1 rounded border border-teal-500/40">
                    STATUS: READY_FOR_EXTRACT
                  </span>
                  <button
                    type="button"
                    onClick={() => setCameraState({ isOpen: true, mode: 'back' })}
                    className="font-mono text-xs font-bold text-white bg-[#0B1528] hover:bg-[#101F3B] px-3 py-1.5 rounded border border-[#274468] flex items-center space-x-1.5 btn-precision shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                    <span>Re-obturar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Technical Pipeline Checklist */}
          <div className="flex items-center justify-between pt-1.5 font-mono text-xs font-bold text-slate-200 border-t border-[#1E3557]">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-petroleum"></span>
              <span>MRZ_DECODER: ACTIVE</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-petroleum"></span>
              <span>UBIGEO_AUTO_RESOLVE</span>
            </span>
          </div>

        </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* 3. BARRA DE ACCIÓN Y TELEMETRÍA                              */}
      {/* ============================================================ */}
      <div className="card-enterprise p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-[#1E3557] bg-[#0B1528] shadow-lg">
        
        {/* Left: Quick Demo Loader */}
        <div className="flex items-center justify-between sm:justify-start space-x-2">
          <button
            type="button"
            onClick={loadDemoScenario}
            className="px-4 py-2.5 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-white border border-[#274468] font-mono text-xs font-bold btn-precision flex items-center space-x-2 min-h-[44px] shadow-sm"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>CARGAR_MUESTRA_DEMO.RAW</span>
          </button>
          
          <div className="hidden lg:flex items-center space-x-2.5 text-xs font-mono font-bold text-slate-300 pl-3">
            <span>MOTOR: <strong className="text-white">RAPIDOCR_PERU</strong></span>
            <span className="text-slate-600">•</span>
            <span>MODELO: <strong className="text-cyan-300">PP-OCRv4 LÍTICO</strong></span>
          </div>
        </div>

        {/* Right: Primary Execute OCR Extraction Button */}
        <button
          onClick={onStartScan}
          disabled={!canScan}
          className={`flex items-center justify-center space-x-2.5 px-6 py-2.5 rounded-lg font-mono text-xs font-black transition-all min-h-[44px] tracking-wider ${
            canScan
              ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-lg shadow-cyan-500/30 btn-precision cursor-pointer border border-cyan-200/50'
              : 'bg-[#101F3B]/60 text-slate-400 border border-[#1E3557] cursor-not-allowed font-bold'
          }`}
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>{scanStep || 'PROCESANDO_PIPELINE_OCR...'}</span>
            </>
          ) : (
            <>
              <Scan className="w-4 h-4" />
              <span>INICIAR EXTRACCIÓN OCR</span>
              <ArrowRight className="w-4 h-4 opacity-80" />
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
