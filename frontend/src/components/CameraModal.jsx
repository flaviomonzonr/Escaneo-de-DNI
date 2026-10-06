import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  Sparkles,
  Scan,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function CameraModal({
  isOpen,
  onClose,
  onCompleteSequential,
  onSingleCapture,
  mode = 'sequential', // 'sequential' | 'front' | 'back'
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // Prioritizes rear camera
  const [errorMsg, setErrorMsg] = useState(null);
  const [flash, setFlash] = useState(false);

  // Flow State
  // 'front_live' | 'front_preview' | 'back_live' | 'back_preview'
  const [currentStep, setCurrentStep] = useState(
    mode === 'back' ? 'back_live' : 'front_live'
  );

  const [frontData, setFrontData] = useState(null); // { file, previewUrl }
  const [backData, setBackData] = useState(null);   // { file, previewUrl }

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialStep = mode === 'back' ? 'back_live' : 'front_live';
      setCurrentStep(initialStep);
      setFrontData(null);
      setBackData(null);
      startCamera();
    } else {
      stopCamera();
      if (frontData?.previewUrl) URL.revokeObjectURL(frontData.previewUrl);
      if (backData?.previewUrl) URL.revokeObjectURL(backData.previewUrl);
      setFrontData(null);
      setBackData(null);
      setErrorMsg(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  // Restart camera when switching between live steps
  useEffect(() => {
    if (!isOpen) return;
    if (currentStep === 'front_live' || currentStep === 'back_live') {
      startCamera();
    } else {
      // In preview modes, we can pause the stream or keep it
    }
  }, [currentStep, facingMode]);

  // Keyboard shortcut: Space / Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (currentStep === 'front_live' || currentStep === 'back_live') {
          takeSnapshot();
        } else if (currentStep === 'front_preview') {
          handleFrontContinue();
        } else if (currentStep === 'back_preview') {
          handleFinish();
        }
      } else if (e.code === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, frontData, backData]);

  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    try {
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setErrorMsg(
        'No se pudo acceder a la cámara. Verifique que concedió permisos de cámara en su navegador o intente subir una foto directamente.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    const isCapturingFront = currentStep === 'front_live';
    const sideName = isCapturingFront ? 'anverso' : 'reverso';

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `dni_${sideName}_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          const previewUrl = URL.createObjectURL(blob);

          if (isCapturingFront) {
            setFrontData({ file, previewUrl });
            setCurrentStep('front_preview');
          } else {
            setBackData({ file, previewUrl });
            setCurrentStep('back_preview');
          }
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const handleFrontRetake = () => {
    if (frontData?.previewUrl) URL.revokeObjectURL(frontData.previewUrl);
    setFrontData(null);
    setCurrentStep('front_live');
  };

  const handleFrontContinue = () => {
    if (mode === 'front') {
      // Single capture mode for front only
      if (onSingleCapture && frontData) {
        onSingleCapture('front', frontData.file, frontData.previewUrl);
      }
      onClose();
      return;
    }
    // Sequential mode: advance to back camera
    setCurrentStep('back_live');
  };

  const handleBackRetake = () => {
    if (backData?.previewUrl) URL.revokeObjectURL(backData.previewUrl);
    setBackData(null);
    setCurrentStep('back_live');
  };

  const handleFinish = () => {
    if (mode === 'back') {
      // Single capture mode for back only
      if (onSingleCapture && backData) {
        onSingleCapture('back', backData.file, backData.previewUrl);
      }
      onClose();
      return;
    }

    // Sequential mode finished
    if (onCompleteSequential && frontData && backData) {
      onCompleteSequential(frontData, backData);
    }
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  const isLive = currentStep === 'front_live' || currentStep === 'back_live';
  const isFront = currentStep === 'front_live' || currentStep === 'front_preview';
  const isBack = currentStep === 'back_live' || currentStep === 'back_preview';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0A1E5C] border-b border-blue-900/60 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center text-[#14B8A6] border border-white/15 shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-extrabold text-white tracking-wide">
                  {isFront ? 'Paso 1: Foto del Anverso' : 'Paso 2: Foto del Reverso'}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0D9488] text-white">
                  {mode === 'sequential' ? (isFront ? '1 de 2' : '2 de 2') : 'Reemplazar'}
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                {isFront
                  ? 'Cara frontal con foto y número de DNI'
                  : 'Cara posterior con código de barras / MRZ'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-95"
            title="Cerrar cámara"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Progress Bar */}
        {mode === 'sequential' && (
          <div className="grid grid-cols-2 bg-slate-950 border-b border-slate-800 text-[11px] font-bold">
            <div
              className={`py-2 px-3 text-center transition-colors flex items-center justify-center space-x-1.5 ${
                isFront
                  ? 'bg-blue-600/30 text-blue-300 border-b-2 border-blue-400'
                  : frontData
                  ? 'bg-emerald-950/40 text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              {frontData ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span>1.</span>}
              <span>1. Anverso (Frontal)</span>
            </div>

            <div
              className={`py-2 px-3 text-center transition-colors flex items-center justify-center space-x-1.5 ${
                isBack
                  ? 'bg-teal-600/30 text-teal-300 border-b-2 border-teal-400'
                  : backData
                  ? 'bg-emerald-950/40 text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              {backData ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span>2.</span>}
              <span>2. Reverso (Posterior)</span>
            </div>
          </div>
        )}

        {/* Viewport Area */}
        <div className="relative flex-1 bg-slate-950 min-h-[340px] sm:min-h-[420px] max-h-[580px] flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-slate-300 max-w-md">
              <AlertCircle className="w-14 h-14 text-rose-500 mx-auto mb-3" />
              <p className="text-sm leading-relaxed">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
              >
                Reintentar Acceso
              </button>
            </div>
          ) : isLive ? (
            <>
              {/* Real-time Video Stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain max-h-[520px]"
              />

              {/* Flash effect animation */}
              {flash && (
                <div className="absolute inset-0 bg-white transition-opacity duration-150 pointer-events-none z-20" />
              )}

              {/* DNI Document Frame Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3 sm:p-6 z-10">
                <div className="relative w-full max-w-[460px] aspect-[1.586] border-2 border-[#14B8A6]/90 rounded-2xl shadow-[0_0_30px_rgba(20,184,166,0.25)] flex flex-col justify-between p-3 sm:p-4 bg-slate-950/20 backdrop-contrast-105">
                  {/* 4 Glowing Corner Markers */}
                  <div className="absolute -top-1.5 -left-1.5 w-8 h-8 border-t-4 border-l-4 border-[#14B8A6] rounded-tl-xl shadow-[0_0_12px_#14B8A6]" />
                  <div className="absolute -top-1.5 -right-1.5 w-8 h-8 border-t-4 border-r-4 border-[#14B8A6] rounded-tr-xl shadow-[0_0_12px_#14B8A6]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-8 h-8 border-b-4 border-l-4 border-[#14B8A6] rounded-bl-xl shadow-[0_0_12px_#14B8A6]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 border-b-4 border-r-4 border-[#14B8A6] rounded-br-xl shadow-[0_0_12px_#14B8A6]" />

                  {/* Top Guide Pill */}
                  <div className="text-center">
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-black/85 backdrop-blur-md rounded-full text-[11px] font-bold text-white border border-[#14B8A6]/50 shadow-md">
                      <Scan className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>
                        {isFront
                          ? 'Encuadre el DNI (Anverso)'
                          : 'Encuadre el DNI (Reverso)'}
                      </span>
                    </span>
                  </div>

                  {/* Bottom Guide Text */}
                  <div className="text-center">
                    <span className="inline-block text-[11px] font-medium text-slate-200 bg-black/80 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                      Evite sombras y reflejos de luz
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Preview Mode */
            <div className="relative w-full h-full flex items-center justify-center bg-black p-2 sm:p-4">
              <img
                src={isFront ? frontData?.previewUrl : backData?.previewUrl}
                alt="Vista previa captura"
                className="w-full h-full object-contain max-h-[500px] rounded-2xl"
              />

              <div className="absolute top-4 left-4 bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-white text-xs font-bold flex items-center space-x-2 shadow-lg">
                <Sparkles className="w-4 h-4 text-[#14B8A6]" />
                <span>
                  {isFront
                    ? 'Foto del Anverso lista'
                    : 'Foto del Reverso lista'}
                </span>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Bottom Control Bar (Touch Optimized) */}
        <div className="px-4 sm:px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          {isLive ? (
            <>
              {/* Rotate Camera Button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="flex items-center justify-center space-x-1.5 px-3.5 py-3 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-2xl border border-slate-700 transition min-h-[48px] min-w-[48px]"
                title="Girar entre cámara trasera y frontal"
              >
                <RefreshCw className="w-4 h-4 text-[#14B8A6]" />
                <span className="hidden sm:inline">Girar</span>
              </button>

              {/* Big Main Shutter Button */}
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={!stream}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-[#1D4ED8] to-[#0A1E5C] hover:from-[#2563EB] hover:to-[#1E40AF] active:scale-98 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-xl border border-blue-400/30 transition min-h-[52px]"
              >
                <Camera className="w-5 h-5 text-[#14B8A6]" />
                <span>
                  {isFront ? '📸 Tomar Foto Anverso' : '📸 Tomar Foto Reverso'}
                </span>
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 rounded-2xl border border-slate-700/60 min-h-[48px]"
              >
                Cancelar
              </button>
            </>
          ) : (
            /* Preview Action Buttons */
            <div className="w-full flex items-center justify-between gap-3">
              {/* Retake Button */}
              <button
                type="button"
                onClick={isFront ? handleFrontRetake : handleBackRetake}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 text-xs sm:text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-98 border border-slate-700 rounded-2xl transition min-h-[50px]"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span>🔄 Repetir Foto</span>
              </button>

              {/* Continue / Finish Button */}
              {isFront ? (
                <button
                  type="button"
                  onClick={handleFrontContinue}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:from-[#14B8A6] hover:to-[#0D9488] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xl transition active:scale-98 min-h-[50px]"
                >
                  <span>Continuar al Reverso</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#34D399] hover:to-[#10B981] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xl transition active:scale-98 min-h-[50px]"
                >
                  <Check className="w-5 h-5 text-white" />
                  <span>✅ Confirmar y Finalizar</span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
