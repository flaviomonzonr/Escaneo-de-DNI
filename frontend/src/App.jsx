import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CaptureZone from './components/CaptureZone';
import DNIFactilizaZone from './components/DNIFactilizaZone';
import BatchScanZone from './components/BatchScanZone';
import ImageCompare from './components/ImageCompare';
import ReviewForm from './components/ReviewForm';
import TemplatesView from './components/TemplatesView';
import HistoryView from './components/HistoryView';
import ExcelGeneratorView from './components/ExcelGeneratorView';
import BottomNav from './components/BottomNav';
import { api } from './services/api';
import {
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Files,
  Maximize2,
  Minimize2,
  Search,
  Camera,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  FileText,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'batch_excel' | 'templates' | 'scan_history'
  const [scanMode, setScanMode] = useState('factiliza'); // 'factiliza' | 'ocr' | 'batch'
  const [healthInfo, setHealthInfo] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // 1. Theme State: 'dark' (Chavín Navy #060D1A) | 'light' (Chavín Calcite #F4F7FB)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('escan_theme') || 'dark';
  });

  // 2. Device Mode State: 'mobile' | 'tablet' | 'desktop'
  const [deviceMode, setDeviceMode] = useState(() => {
    return localStorage.getItem('escan_device_mode') || 'desktop';
  });

  // Screen and device detection to avoid showing desktop simulator on real mobile phones
  const checkIsMobileOrTouch = () => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth < 1024 ||
      'ontouchstart' in window ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  };

  const [isMobileScreen, setIsMobileScreen] = useState(checkIsMobileOrTouch);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(checkIsMobileOrTouch());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle mockup frame in mobile mode on desktop
  const [showDeviceFrame, setShowDeviceFrame] = useState(true);

  // Scan state
  const [docType, setDocType] = useState('AUTO');
  const [frontFile, setFrontFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [backPreview, setBackPreview] = useState(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanStepText, setScanStepText] = useState('');
  const [scanResult, setScanResult] = useState(null);

  // Synchronize theme with data-theme attribute on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('escan_theme', theme);
  }, [theme]);

  // Synchronize device mode
  useEffect(() => {
    localStorage.setItem('escan_device_mode', deviceMode);
    if (deviceMode === 'tablet') {
      setCollapsed(true);
    } else if (deviceMode === 'desktop') {
      setCollapsed(false);
    }
  }, [deviceMode]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(() => {
      checkHealth();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const data = await api.checkHealth();
      setHealthInfo((prev) => {
        if (!prev || prev.status === 'offline') {
          setReconnectTrigger((t) => t + 1);
        }
        return data;
      });
    } catch (err) {
      setHealthInfo({ status: 'offline', ocr_engine: 'Sin conexión' });
    }
  };

  const handleManualRetry = () => {
    checkHealth();
    setReconnectTrigger((t) => t + 1);
  };

  const handleStartScan = async (overrideFrontFile = null, overrideBackFile = null) => {
    const targetFront = overrideFrontFile || frontFile;
    const targetBack = overrideBackFile || backFile;
    if (!targetFront) return;

    setIsScanning(true);
    setScanStepText('DETECTANDO_DNI_Y_VERIFICANDO_HISTORICO...');

    try {
      setTimeout(() => setScanStepText('CONSULTANDO_DATA_HISTORICA_LOCAL...'), 300);
      setTimeout(() => setScanStepText('AUTOCOMPLETANDO_CAMPOS...'), 650);

      const result = await api.scanDocument(targetFront, targetBack, docType);
      setScanResult(result);
    } catch (err) {
      console.error('Scan error:', err);
      let errorText = err.response?.data?.detail || err.message || 'Error desconocido';
      if (err.message === 'Network Error' || !err.response) {
        errorText = 'No se pudo conectar con el servidor backend en el puerto 8000.';
      }
      alert('Error durante el escaneo: ' + errorText);
    } finally {
      setIsScanning(false);
      setScanStepText('');
    }
  };

  const handleResetScan = () => {
    setScanResult(null);
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null);
    setFrontPreview(null);
    setBackFile(null);
    setBackPreview(null);
  };

  const handleRecordSaved = () => {
    handleResetScan();
    setActiveTab('scan');
  };

  // Determine container width based on device mode - Optimized for Fullscreen Widescreen
  const getMainContainerClass = () => {
    if (isMobileScreen) {
      return 'w-full max-w-full px-2 sm:px-4 mx-auto';
    }
    switch (deviceMode) {
      case 'mobile':
        return showDeviceFrame ? 'max-w-md mx-auto w-full' : 'max-w-xl mx-auto w-full';
      case 'tablet':
        return 'max-w-5xl mx-auto w-full';
      case 'desktop':
      default:
        // Fully wide and expansive for 1080p, 2K, 4K full screen monitors
        return 'w-full max-w-[1920px] mx-auto';
    }
  };

  return (
    <div className={`min-h-screen text-slate-100 flex flex-col lg:flex-row transition-colors duration-250 ${
      theme === 'dark' ? 'bg-[#060D1A]' : 'bg-[#F4F7FB] text-[#070E1C]'
    }`}>
      
      {/* 1. Left Vertical Sidebar (Hidden on simulated mobile or collapsed in tablet) */}
      {deviceMode !== 'mobile' && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          healthInfo={healthInfo}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          theme={theme}
        />
      )}

      {/* 2. Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ease-in-out ${
          deviceMode === 'mobile'
            ? 'pl-0'
            : collapsed
            ? 'lg:pl-[72px]'
            : 'lg:pl-[260px]'
        }`}
      >
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setMobileOpen={setMobileOpen}
          healthInfo={healthInfo}
          onRetryConnection={handleManualRetry}
          theme={theme}
          setTheme={setTheme}
          deviceMode={deviceMode}
          setDeviceMode={setDeviceMode}
        />

        {/* Device Mode Contextual Banner (Mobile Mode Simulator controls - Solo en escritorio) */}
        {!isMobileScreen && deviceMode === 'mobile' && (
          <div className="bg-[#040914] border-b border-[#1E3557] text-slate-300 py-1.5 px-4 flex items-center justify-between font-mono text-[11px] select-none">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="font-bold text-white tracking-wide">SIMULADOR_MÓVIL_CHAVÍN (~390px)</span>
              <span className="text-slate-400 hidden sm:inline">| Visor vertical y controles táctiles</span>
            </div>
            <button
              onClick={() => setShowDeviceFrame(!showDeviceFrame)}
              className="px-2.5 py-0.5 rounded bg-[#101F3B] hover:bg-[#162A4F] text-cyan-200 text-[10px] font-bold flex items-center space-x-1.5 border border-[#274468] transition btn-precision"
            >
              {showDeviceFrame ? (
                <>
                  <Maximize2 className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">VISTA_FLUIDA</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">MARCO_SMARTPHONE</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Main Workspace Body - Full width & padding optimized for Fullscreen */}
        <main className={`flex-1 w-full px-3 sm:px-6 lg:px-8 xl:px-10 pt-4 pb-24 lg:pb-8 ${getMainContainerClass()} transition-all duration-200`}>
          
          {/* Simulated Smartphone Shell Wrapper when deviceMode === 'mobile' & showDeviceFrame (Desktop only) */}
          <div className={!isMobileScreen && deviceMode === 'mobile' && showDeviceFrame ? 'bg-[#040914] rounded-[38px] shadow-2xl border-[6px] border-[#1D334E] overflow-hidden relative p-3 sm:p-4 my-2 min-h-[740px]' : ''}>
            
            {/* Top Phone Notch / Speaker simulation when framed on desktop */}
            {!isMobileScreen && deviceMode === 'mobile' && showDeviceFrame && (
              <div className="flex items-center justify-between pb-2.5 px-3 border-b border-[#1E3557] font-mono text-[9px] text-slate-400 mb-3">
                <span className="font-bold text-slate-300">09:41</span>
                <div className="w-16 h-3.5 bg-[#0B1528] rounded-full flex items-center justify-center border border-[#1E3557]">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1"></div>
                  <div className="w-1 h-1 rounded-full bg-slate-500"></div>
                </div>
                <span className="font-bold text-cyan-300">5G 100%</span>
              </div>
            )}

            {/* TAB 1: CONSULTA DNI & REGISTRO */}
            {activeTab === 'scan' && (
              !scanResult ? (
                <div className="space-y-4">
                  
                  {/* Mode Selector Tabs (Factiliza DNI vs Escáner Foto vs Por Lotes) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-[#0B1528] border border-[#1E3557] shadow-lg">
                    <div className="flex items-center space-x-2 p-1 rounded-lg bg-[#060D1A] border border-[#1D334E] font-mono text-xs w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setScanMode('factiliza')}
                        className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-md transition-all flex items-center justify-center space-x-1.5 min-h-[40px] btn-precision ${
                          scanMode === 'factiliza'
                            ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-300/40'
                            : 'bg-[#101F3B]/60 text-slate-300 hover:text-white font-bold border border-[#1E3557]'
                        }`}
                      >
                        <Zap className={`w-4 h-4 ${scanMode === 'factiliza' ? 'text-slate-950 stroke-[2.5]' : 'text-cyan-400'}`} />
                        <span>CONSULTA_FACTILIZA</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${scanMode === 'factiliza' ? 'bg-slate-950/30 text-slate-950' : 'bg-cyan-900/60 text-cyan-200 border border-cyan-500/40'}`}>
                          RÁPIDO
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScanMode('ocr')}
                        className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-md transition-all flex items-center justify-center space-x-1.5 min-h-[40px] btn-precision ${
                          scanMode === 'ocr'
                            ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md shadow-cyan-500/25 border border-cyan-300/40'
                            : 'bg-[#101F3B]/60 text-slate-300 hover:text-white font-bold border border-[#1E3557]'
                        }`}
                      >
                        <Camera className={`w-4 h-4 ${scanMode === 'ocr' ? 'text-slate-950 stroke-[2.5]' : 'text-cyan-400'}`} />
                        <span>ESCANEAR_FOTO_OCR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScanMode('batch')}
                        className={`flex-1 sm:flex-initial py-2 px-3.5 rounded-md transition-all flex items-center justify-center space-x-1.5 min-h-[40px] btn-precision ${
                          scanMode === 'batch'
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black shadow-md shadow-teal-500/25 border border-teal-300/40'
                            : 'bg-[#101F3B]/60 text-slate-300 hover:text-white font-bold border border-[#1E3557]'
                        }`}
                      >
                        <Files className={`w-4 h-4 ${scanMode === 'batch' ? 'text-slate-950 stroke-[2.5]' : 'text-teal-400'}`} />
                        <span>PROCESAR_LOTES</span>
                      </button>
                    </div>

                    <div className="text-xs font-mono font-bold text-slate-200 hidden md:flex items-center space-x-2 pr-3">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      <span>MODO: <strong className="text-white font-extrabold">{
                        scanMode === 'factiliza' ? 'CONSULTA DNI REST API' : scanMode === 'ocr' ? 'CAPTURA ASISTIDA OCR' : 'LOTES EN COLA'
                      }</strong></span>
                    </div>
                  </div>

                  {/* Render Selected Scan Mode */}
                  {scanMode === 'factiliza' ? (
                    <DNIFactilizaZone
                      onResultReady={(res) => setScanResult(res)}
                      onSwitchToCameraScan={() => setScanMode('ocr')}
                      theme={theme}
                    />
                  ) : scanMode === 'ocr' ? (
                    <CaptureZone
                      docType={docType}
                      setDocType={setDocType}
                      frontFile={frontFile}
                      setFrontFile={setFrontFile}
                      frontPreview={frontPreview}
                      setFrontPreview={setFrontPreview}
                      backFile={backFile}
                      setBackFile={setBackFile}
                      backPreview={backPreview}
                      setBackPreview={setBackPreview}
                      onStartScan={handleStartScan}
                      isScanning={isScanning}
                      scanStep={scanStepText}
                      theme={theme}
                      deviceMode={deviceMode}
                    />
                  ) : (
                    <BatchScanZone
                      onNavigateToExcelGenerator={() => setActiveTab('batch_excel')}
                    />
                  )}

                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Compact Status Banner with Back Navigation */}
                  <div className="card-enterprise px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-[#1E3557] bg-[#0B1528]/95 backdrop-blur-md shadow-lg">
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={handleResetScan}
                        title="Volver a la pantalla de consulta"
                        className="py-1.5 px-3.5 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-white font-mono text-xs font-bold border border-[#274468] flex items-center justify-center space-x-1.5 transition btn-precision shrink-0 min-h-[38px] shadow-sm"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                        <span>← VOLVER</span>
                      </button>
                      <div className="h-5 w-px bg-[#1E3557] hidden sm:block"></div>
                      <div className="font-mono text-xs">
                        <span className="text-slate-400 font-semibold">{scanResult.doc_type || 'DOC'}: </span>
                        <span className="text-cyan-300 font-extrabold">{scanResult.doc_number || 'EN REVISIÓN'}</span>
                        <span className="text-slate-500"> • </span>
                        <span className="text-white font-bold">{scanResult.first_names || ''} {scanResult.paternal_surname || ''} {scanResult.maternal_surname || ''}</span>
                        {scanResult.source === 'factiliza' && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ⚡ FACTILIZA
                          </span>
                        )}
                        {scanResult.source === 'manual' && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ✍️ MANUAL
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('templates')}
                      className="py-1.5 px-3.5 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-cyan-200 font-mono text-xs font-bold border border-[#274468] flex items-center justify-center space-x-1.5 transition btn-precision shrink-0 min-h-[38px] shadow-sm"
                    >
                      <span>MAPEO_PLANTILLAS</span>
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                    </button>
                  </div>

                  {/* Responsive Split for Results */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left Column: OpenCV Inspection (si hay fotos escaneadas) o Ficha Informativa (si es Factiliza/Manual) */}
                    {scanResult.front_image_orig ? (
                      <div className="lg:col-span-5 xl:col-span-4">
                        <ImageCompare scanResult={scanResult} />
                      </div>
                    ) : (
                      <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                        <div className="card-enterprise bg-[#0B1528] p-5 rounded-2xl border border-[#1E3557] shadow-xl text-white space-y-4">
                          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#1E3557]">
                            <div className={`p-2 rounded-xl flex items-center justify-center border ${
                              (scanResult.source === 'data_historica' || scanResult.is_historical)
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                                : scanResult.source === 'factiliza'
                                ? 'bg-sky-950/60 border-sky-500/40 text-sky-400'
                                : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                            }`}>
                              {(scanResult.source === 'data_historica' || scanResult.is_historical) ? (
                                <Database className="w-5 h-5 stroke-[2.5]" />
                              ) : scanResult.source === 'factiliza' ? (
                                <Zap className="w-5 h-5 stroke-[2.5]" />
                              ) : (
                                <FileText className="w-5 h-5 stroke-[2.5]" />
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-black uppercase tracking-wider block text-white">
                                {(scanResult.source === 'data_historica' || scanResult.is_historical)
                                  ? 'Data Histórica Local'
                                  : scanResult.source === 'factiliza'
                                  ? 'Origen Factiliza API'
                                  : 'Registro Manual'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {(scanResult.source === 'data_historica' || scanResult.is_historical)
                                  ? 'Planilla / Registro local (0 tokens)'
                                  : scanResult.source === 'factiliza'
                                  ? 'Datos RENIEC / SUNAT'
                                  : 'Llenado desde cero'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2.5 font-mono text-xs">
                            <div className="p-3 rounded-xl bg-[#040914] border border-[#1D334E] space-y-1">
                              <span className="text-[10px] text-slate-400 block uppercase">Documento</span>
                              <div className="text-base font-extrabold text-cyan-300">
                                {scanResult.doc_type}: {scanResult.doc_number}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#040914] border border-[#1D334E] space-y-1">
                              <span className="text-[10px] text-slate-400 block uppercase">Nombres y Apellidos</span>
                              <div className="text-sm font-bold text-white">
                                {scanResult.first_names} {scanResult.paternal_surname} {scanResult.maternal_surname}
                              </div>
                            </div>

                            {scanResult.duplicate_warning && (
                              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-300 text-xs flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">Posible Trabajador Repetido:</span>
                                  <span className="text-[11px] text-amber-200/90 leading-tight block">
                                    Ya existe en la base de datos o Excel maestro.
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="p-3 rounded-xl bg-[#060D1A] border border-[#1E3557] text-[11px] text-slate-300 space-y-1.5 font-sans leading-relaxed">
                              <span className="font-bold text-white flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                                <span>Verificación de Datos:</span>
                              </span>
                              <p className="text-slate-400 text-[10px]">
                                Revisa los datos en el formulario contiguo, asigna los campos de contrato NISIRA si corresponde y pulsa <strong>Guardar Registro</strong>.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Right Column: Editable Review Form & Template Filler */}
                    <div className={scanResult.front_image_orig ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-8 xl:col-span-9"}>
                      <ReviewForm
                        scanResult={scanResult}
                        onReset={handleResetScan}
                        onRecordSaved={handleRecordSaved}
                      />
                    </div>
                  </div>

                </div>
              )
            )}

            {/* TAB 2: GENERAR EXCEL POR LOTE */}
            {activeTab === 'batch_excel' && (
              <ExcelGeneratorView
                onNavigateToScan={() => setActiveTab('scan')}
                onNavigateToTemplates={() => setActiveTab('templates')}
                reconnectTrigger={reconnectTrigger}
              />
            )}

            {/* TAB 3: PLANTILLAS EXCEL */}
            {activeTab === 'templates' && (
              <TemplatesView
                reconnectTrigger={reconnectTrigger}
              />
            )}

            {/* TAB 4: HISTORIAL DE REGISTROS */}
            {activeTab === 'scan_history' && (
              <HistoryView
                reconnectTrigger={reconnectTrigger}
              />
            )}

          </div>

        </main>

        {/* Floating Bottom Nav in Mobile Mode or small screens */}
        {(deviceMode === 'mobile' || typeof window !== 'undefined') && (
          <BottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onTriggerCamera={() => setActiveTab('scan')}
          />
        )}

        {/* Chavín Corporate Minimalist Footer (Hidden in framed mobile view) */}
        {!(deviceMode === 'mobile' && showDeviceFrame) && (
          <footer className="border-t border-[#1E3557] bg-[#040914]/90 backdrop-blur-md py-3 text-center font-mono text-[11px] text-slate-400 mt-auto select-none">
            <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-xs bg-cyan-400 shadow-glow-turquoise"></span>
                <span className="text-white font-bold tracking-wide">SISTEMA_CHAVÍN // ENTERPRISE_OCR</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300">OPENCV 4.10 • RAPIDOCR AI • NISIRA INTEGRATION</span>
              </div>
              <span className="text-cyan-400/90 font-semibold tracking-wider">
                CALIBRADOR LÍTICO DE ALTA PRECISIÓN
              </span>
            </div>
          </footer>
        )}

      </div>

    </div>
  );
}
