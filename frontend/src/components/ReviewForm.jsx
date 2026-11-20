import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Cpu,
  ArrowLeft,
  MapPin,
  Search,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import OCRDiagnosticModal from './OCRDiagnosticModal';
import ContractOptionSelect from './ContractOptionSelect';
import {
  TIPOS_CONTRATO,
  CODIGOS_PLANILLA,
  SUGGESTED_BASICOS,
  calculateContractEndDate,
  normalizeTipoContrato,
  normalizeCodPlanilla
} from '../constants/contractCatalogs';

const normalizeSexValue = (val) => {
  if (!val) return '';
  const s = String(val).trim().toUpperCase();
  if (['M', 'MASCULINO', '1', 'H', 'HOMBRE'].includes(s)) return 'M';
  if (['F', 'FEMENINO', '2', 'MUJER'].includes(s)) return 'F';
  return s;
};

const normalizeBirthDate = (val) => {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return s;
};

export default function ReviewForm({
  scanResult,
  onReset,
  onRecordSaved,
}) {
  const [formData, setFormData] = useState({
    doc_type: scanResult?.doc_type || 'DNI',
    doc_number: scanResult?.doc_number || '',
    paternal_surname: scanResult?.paternal_surname || '',
    maternal_surname: scanResult?.maternal_surname || '',
    first_names: scanResult?.first_names || '',
    nationality: scanResult?.nationality || (scanResult?.doc_type === 'DNI' ? 'PERUANA' : ''),
    birth_date: normalizeBirthDate(scanResult?.birth_date),
    sex: normalizeSexValue(scanResult?.sex),
    address: scanResult?.address || '',
    ubigeo: scanResult?.ubigeo || '',
    department: scanResult?.department || '',
    province: scanResult?.province || '',
    district: scanResult?.district || '',
    ubigeo_inei: scanResult?.ubigeo_inei || '',
    ubigeo_reniec: scanResult?.ubigeo_reniec || '',
    issue_date: scanResult?.issue_date || '',
    expiry_date: scanResult?.expiry_date || '',
    blood_type: scanResult?.blood_type || '',
    civil_status: scanResult?.civil_status || '',
    migratory_status: scanResult?.migratory_status || '',
    phone: scanResult?.phone || '999999999',
    email: scanResult?.email || 'sincorreo@gmail.com',
    pension_system: scanResult?.pension_system || '',
    pension_commission: scanResult?.pension_commission || '',
    cuspp: scanResult?.cuspp || '',
    bank_account: scanResult?.bank_account || '',
    cargo: scanResult?.cargo || '',
    observations: scanResult?.observations || '',
    // Contract NISIRA assignment
    cod_planilla: normalizeCodPlanilla(scanResult?.cod_planilla || 'ORP'),
    nro_contrato: scanResult?.nro_contrato || '',
    basico: scanResult?.basico !== undefined ? scanResult?.basico : 1025.0,
    inicio_contrato: scanResult?.inicio_contrato || (new Date().toISOString().split('T')[0]),
    duracion: scanResult?.duracion || '3',
    fin_contrato: scanResult?.fin_contrato || calculateContractEndDate(new Date().toISOString().split('T')[0], '3'),
    fecha_firma_contrato: scanResult?.fecha_firma_contrato || (new Date().toISOString().split('T')[0]),
    tipo_contrato: normalizeTipoContrato(scanResult?.tipo_contrato || '05'),
    nro_contrato_ref: scanResult?.nro_contrato_ref || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // SBS Previsional query state
  const [isQueryingSBS, setIsQueryingSBS] = useState(false);
  const [sbsNotification, setSbsNotification] = useState(null);

  const handleQuerySBS = async (force = false) => {
    if (!formData.doc_number || !formData.paternal_surname) {
      setSbsNotification({ type: 'error', text: 'Se requiere DNI y Apellido Paterno para consultar en la SBS.' });
      setTimeout(() => setSbsNotification(null), 4000);
      return;
    }
    setIsQueryingSBS(true);
    setSbsNotification(null);
    try {
      const res = await api.querySBS({
        doc_number: formData.doc_number,
        paternal_surname: formData.paternal_surname,
        maternal_surname: formData.maternal_surname || '',
        first_names: formData.first_names || '',
        doc_type: formData.doc_type || 'DNI',
        force_refresh: force,
      });
      if (res?.success) {
        setFormData((prev) => ({
          ...prev,
          pension_system: res.afp_actual || prev.pension_system,
          cuspp: res.cuspp !== '-' ? res.cuspp : prev.cuspp,
        }));
        setFieldsMeta((prev) => ({
          ...prev,
          pension_system: { value: res.afp_actual, confidence: 99, is_valid: true, status: 'CONFIRMADO', source: 'sbs' },
          cuspp: { value: res.cuspp, confidence: 99, is_valid: true, status: 'CONFIRMADO', source: 'sbs' },
        }));
        setSbsNotification({
          type: 'success',
          text: `SBS: ${res.afp_actual} | CUSPP: ${res.cuspp} (${res.cached ? 'Caché local' : 'En vivo'}) - Guardado en REPORTE_SBS_HISTORICO.xlsx`,
        });
      } else {
        setSbsNotification({ type: 'error', text: res?.error || 'No se pudo obtener información de la SBS.' });
      }
    } catch (err) {
      setSbsNotification({ type: 'error', text: 'Error al conectar con el servicio SBS.' });
    } finally {
      setIsQueryingSBS(false);
      setTimeout(() => setSbsNotification(null), 5000);
    }
  };

  // Ubigeo autocomplete state
  const [ubigeoQuery, setUbigeoQuery] = useState('');
  const [ubigeoSuggestions, setUbigeoSuggestions] = useState([]);
  const [showUbigeoDropdown, setShowUbigeoDropdown] = useState(false);
  const [isSearchingUbigeo, setIsSearchingUbigeo] = useState(false);
  const ubigeoDropdownRef = useRef(null);

  // Auto resolve Ubigeo details if initial scan has raw Ubigeo but missing department/district/codes
  useEffect(() => {
    if (formData.ubigeo && (!formData.department || !formData.ubigeo_inei)) {
      api.resolveUbigeo(formData.ubigeo).then((res) => {
        if (res && res.success && res.item) {
          const it = res.item;
          setFormData((prev) => ({
            ...prev,
            department: prev.department || it.departamento,
            province: prev.province || it.provincia,
            district: prev.district || it.distrito,
            ubigeo_inei: prev.ubigeo_inei || it.ubigeo_inei,
            ubigeo_reniec: prev.ubigeo_reniec || it.ubigeo_reniec,
          }));
        }
      }).catch(() => {});
    } else if (!formData.ubigeo && (formData.district || formData.ubigeo_inei)) {
      const synth = [formData.department, formData.province, formData.district].filter(Boolean).join(' / ') || formData.ubigeo_inei;
      if (synth) {
        setFormData((prev) => ({ ...prev, ubigeo: synth }));
      }
    }
  }, []);

  // Close Ubigeo dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ubigeoDropdownRef.current && !ubigeoDropdownRef.current.contains(e.target)) {
        setShowUbigeoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUbigeoSearch = async (val) => {
    handleChange('ubigeo', val);
    setUbigeoQuery(val);
    if (!val || val.trim().length < 2) {
      setUbigeoSuggestions([]);
      setShowUbigeoDropdown(false);
      return;
    }
    setIsSearchingUbigeo(true);
    try {
      const data = await api.searchUbigeos(val.trim(), 10);
      if (data && data.items) {
        setUbigeoSuggestions(data.items);
        setShowUbigeoDropdown(data.items.length > 0);
      }
    } catch (e) {
      console.error('Ubigeo search error:', e);
    } finally {
      setIsSearchingUbigeo(false);
    }
  };

  const handleSelectUbigeo = (item) => {
    setFormData((prev) => ({
      ...prev,
      ubigeo: item.full_text,
      department: item.departamento,
      province: item.provincia,
      district: item.distrito,
      ubigeo_inei: item.ubigeo_inei,
      ubigeo_reniec: item.ubigeo_reniec,
    }));
    setShowUbigeoDropdown(false);
  };

  const [fieldsMeta, setFieldsMeta] = useState(scanResult?.fields || {});
  useEffect(() => {
    if (scanResult?.fields) {
      setFieldsMeta(scanResult.fields);
    }
  }, [scanResult]);
  const isDni = formData.doc_type === 'DNI' || formData.doc_type === 'DNI Electrónico';

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateOrDurationChange = (field, val) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: val };
      if (field === 'inicio_contrato' || field === 'duracion') {
        const s = field === 'inicio_contrato' ? val : prev.inicio_contrato;
        const d = field === 'duracion' ? val : prev.duracion;
        if (s && d) {
          const calc = calculateContractEndDate(s, d);
          if (calc) next.fin_contrato = calc;
        }
      }
      return next;
    });
  };

  // Origin badge: OCR vs API vs Data Histórica vs Manual
  const renderSourceBadge = (fieldKey) => {
    const meta = fieldsMeta[fieldKey];
    const isTarget = ['doc_number', 'birth_date', 'issue_date', 'expiry_date'].includes(fieldKey);
    const source = meta?.source || (meta?.origin_type?.includes('HISTORICO') ? 'data_historica' : (meta?.origin_type?.includes('API') ? 'api' : (meta?.origin_type ? 'ocr' : null)));

    if (source === 'sbs' || source === 'sbs_live' || source === 'sbs_local' || meta?.origin_type?.includes('SBS')) {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-400/50 inline-flex items-center space-x-1" title="Situación previsional obtenida del Portal Oficial SBS y guardada en disco local">
          <span>🏛️ SBS</span>
        </span>
      );
    }
    if (source === 'data_historica' || source === 'historico') {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-400/50 inline-flex items-center space-x-1" title="Campo obtenido de la Base de Datos Histórica (0 tokens consumidos)">
          <span>🏛️ HISTÓRICO</span>
        </span>
      );
    }
    if (source === 'api') {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-400/50 inline-flex items-center space-x-1" title="Campo obtenido y complementado desde Factiliza / RENIEC">
          <span>🌐 API</span>
        </span>
      );
    }
    if (source === 'ocr') {
      return (
        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded inline-flex items-center space-x-1 ${
          isTarget ? 'bg-cyan-950 text-cyan-300 border border-cyan-400/60' : 'bg-[#060D1A] text-slate-300 border-[#1E3557]'
        }`} title="Campo extraído directamente por OCR del documento">
          <span>📷 OCR</span>
        </span>
      );
    }
    return null;
  };

  // Helper for 3-tier status and confidence badge (Chavín Palette)
  const renderConfidenceBadge = (fieldKey) => {
    const meta = fieldsMeta[fieldKey];
    if (!meta) return null;

    const conf = Math.round(meta.confidence || 0);
    const status = meta.status || (conf >= 80 ? 'CONFIRMADO' : conf >= 40 ? 'REVISAR' : 'NO_DETECTADO');

    let badgeClass = 'bg-[#0A3D44]/90 text-teal-200 border-teal-400/50';
    let iconText = '✓';

    if (status === 'NO_DETECTADO' || conf < 40) {
      badgeClass = 'bg-[#060D1A] text-slate-400 border-[#1E3557]';
      iconText = '✕';
    } else if (status === 'REVISAR' || conf < 80) {
      badgeClass = 'bg-[#101F3B] text-cyan-200 border-cyan-400/50';
      iconText = 'ℹ';
    }

    return (
      <div className="flex items-center space-x-1">
        {renderSourceBadge(fieldKey)}
        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border inline-flex items-center space-x-1 ${badgeClass}`}>
          <span>{iconText}</span>
          <span>{status === 'CONFIRMADO' ? `OK (${conf}%)` : `${status} (${conf}%)`}</span>
        </span>
      </div>
    );
  };

  // Detección de campos pendientes para resaltado en AMARILLO (solicitado por el usuario)
  const isFieldMissing = (fieldKey) => {
    switch (fieldKey) {
      case 'doc_number':
        return !formData.doc_number || !formData.doc_number.trim();
      case 'paternal_surname':
        return !formData.paternal_surname || !formData.paternal_surname.trim();
      case 'first_names':
        return !formData.first_names || !formData.first_names.trim();
      case 'sex':
        return !formData.sex || !formData.sex.trim();
      case 'birth_date':
        return !formData.birth_date || !formData.birth_date.trim();
      case 'address':
        return !formData.address || !formData.address.trim();
      case 'ubigeo':
        return (!formData.ubigeo || !formData.ubigeo.trim()) && !formData.ubigeo_inei;
      case 'phone':
        if (scanResult?.is_historical || scanResult?.source === 'data_historica') {
          return !formData.phone || !formData.phone.trim();
        }
        return !formData.phone || formData.phone.trim() === '' || formData.phone === '999999999';
      case 'email':
        if (scanResult?.is_historical || scanResult?.source === 'data_historica') {
          return !formData.email || !formData.email.trim();
        }
        return !formData.email || formData.email.trim() === '' || formData.email === 'sincorreo@gmail.com';
      case 'civil_status':
        return !formData.civil_status || !formData.civil_status.trim();
      case 'pension_system':
        return !formData.pension_system || !formData.pension_system.trim();
      case 'cuspp': {
        const ps = (formData.pension_system || '').toUpperCase();
        const isAfp = ps.includes('INTEGRA') || ps.includes('HABITAT') || ps.includes('PROFUTURO') || ps.includes('PRIMA') || ps.includes('AFP');
        return isAfp && (!formData.cuspp || !formData.cuspp.trim());
      }
      default:
        return false;
    }
  };

  const getFieldClass = (fieldKey, baseClasses = 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition') => {
    if (isFieldMissing(fieldKey)) {
      return `${baseClasses} border-2 border-amber-400 bg-amber-500/10 text-white placeholder-amber-400/60 focus:border-amber-300 ring-1 ring-amber-400/50 shadow-sm shadow-amber-500/10`;
    }
    return `${baseClasses} border border-[#1D334E] bg-[#060D1A] text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40`;
  };

  const renderMissingBadge = (fieldKey) => {
    if (isFieldMissing(fieldKey)) {
      return (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-400/50 inline-flex items-center space-x-1 animate-pulse" title="Campo requerido o pendiente de completar">
          <span>⚠️</span>
          <span>Falta completar</span>
        </span>
      );
    }
    return null;
  };

  const fieldLabelsMap = {
    doc_number: 'N° Documento',
    paternal_surname: 'Apellido Paterno',
    first_names: 'Nombres',
    sex: 'Sexo',
    birth_date: 'Fecha Nacimiento',
    address: 'Dirección',
    ubigeo: 'Ubigeo',
    phone: 'Celular / Teléfono',
    email: 'Correo Electrónico',
    civil_status: 'Estado Civil',
    pension_system: 'Sistema de Pensión',
    cuspp: 'CUSPP (AFP)',
  };

  const pendingFieldsList = Object.keys(fieldLabelsMap).filter(isFieldMissing);

  // Standard Save to DB & Master Excel
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    if (isDni && formData.doc_number.length !== 8) {
      setErrorMsg('El número de DNI debe contener exactamente 8 dígitos.');
      setIsSaving(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        front_image_orig: scanResult?.front_image_orig || '',
        front_image_enhanced: scanResult?.front_image_enhanced || '',
        back_image_orig: scanResult?.back_image_orig || '',
        back_image_enhanced: scanResult?.back_image_enhanced || '',
        quality_score_front: scanResult?.quality_front?.laplacian_var || 0,
        quality_score_back: scanResult?.quality_back?.laplacian_var || 0,
        is_blurry_front: scanResult?.quality_front?.is_blurry || false,
        is_blurry_back: scanResult?.quality_back?.is_blurry || false,
        field_confidences: scanResult?.fields || {},
      };

      const saved = await api.saveRecord(payload);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06B6D4', '#0D9488', '#22D3EE', '#FFFFFF'],
      });

      setSaveSuccess(true);
      setTimeout(() => {
        if (onRecordSaved) onRecordSaved(saved);
      }, 800);
    } catch (err) {
      console.error('Error saving record:', err);
      setErrorMsg(
        err.response?.data?.detail || 'Error al guardar el registro en la base de datos o Excel.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card-enterprise p-4 sm:p-6 bg-[#0B1528] border border-[#1E3557] shadow-xl space-y-4 text-white">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E3557]">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={onReset}
            title="Retroceder a la pantalla de escaneo"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#101F3B] hover:bg-[#162A4F] text-white border border-[#274468] transition shadow-xs hover:border-cyan-400 btn-precision"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>← Atrás</span>
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                Paso 2 // REVISIÓN
              </span>
              <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                Datos Extraídos del DNI
              </h2>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Verifique o edite la información antes de archivar o generar el Excel NISIRA.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowDiagnostic(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#101F3B] hover:bg-[#162A4F] text-cyan-200 border border-[#274468] transition btn-precision shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Diagnóstico OCR</span>
          </button>

          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#101F3B] text-cyan-300 border border-cyan-400/40 font-mono">
            {formData.doc_type}
          </span>
        </div>
      </div>

      {/* OCR Warnings Banner - Chavín Palette (Strict: No yellow) */}
      {scanResult?.warnings && scanResult.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-[#101F3B] border border-cyan-500/40 space-y-1.5 shadow-sm">
          <div className="flex items-center space-x-1.5 text-[11px] font-black text-cyan-300">
            <AlertTriangle className="w-4 h-4 text-cyan-400" />
            <span>Alertas de Extracción OCR:</span>
          </div>
          <ul className="text-[11px] text-slate-200 list-disc list-inside space-y-0.5 pl-1 font-medium">
            {scanResult.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/50 flex items-center space-x-2 text-rose-200 text-xs font-bold">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ESTADO DE CONSULTA Y COMPLEMENTACIÓN API / DATA HISTÓRICA */}
      {scanResult?.api_status && (() => {
        const isHist = scanResult.api_status?.source === 'data_historica' || scanResult?.is_historical;
        const isApi = scanResult.api_complemented && !isHist;

        return (
          <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md ${
            isHist
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : isApi
              ? 'bg-sky-950/40 border-sky-500/50 text-sky-200'
              : 'bg-[#101F3B] border-[#274468] text-slate-300'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`p-1.5 rounded-lg shrink-0 ${
                isHist
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-base'
                  : isApi
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                  : 'bg-[#060D1A] text-slate-400'
              }`}>
                {isHist ? (
                  <span>🏛️</span>
                ) : isApi ? (
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black tracking-wide uppercase">
                    {isHist
                      ? '🏛️ Base de Datos Histórica: ENCONTRADO (0 TOKENS CONSUMIDOS)'
                      : isApi
                      ? '🌐 Consulta API Factiliza / RENIEC: EXITOSA'
                      : 'ℹ️ Consulta API no disponible'}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full ${
                    isHist
                      ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/60'
                      : isApi
                      ? 'bg-sky-500/30 text-sky-200 border border-sky-400/60'
                      : 'bg-[#060D1A] text-slate-400 border border-[#1E3557]'
                  }`}>
                    {isHist ? 'DATA HISTÓRICA LOCAL' : isApi ? 'COMPLEMENTADO AUTOMÁTICO' : 'MODO MANUAL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {scanResult.api_status.message}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
              {scanResult.doc_type || 'DNI'} // {formData.doc_number || 'S/N'}
            </span>
          </div>
        );
      })()}

      {/* PANEL DESTACADO: 4 CAMPOS OBJETIVO PRIORITARIOS DEL DOCUMENTO (OCR) */}
      <div className="p-3.5 rounded-xl bg-[#071324] border-2 border-cyan-500/40 shadow-lg space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#1E3557]">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/50">
              🎯 EXTRACCIÓN OCR FOCALIZADA
            </span>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Cuatro Campos Objetivo del Documento
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">
            Lectura prioritaria y validada directamente desde la imagen física
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
          {/* 1. N° Documento */}
          <div className="p-2.5 rounded-lg bg-[#0B1528] border border-[#1E3557] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">1. N° DOCUMENTO</span>
              {renderConfidenceBadge('doc_number')}
            </div>
            <div className="text-sm font-black text-cyan-300 truncate">
              {formData.doc_number || <span className="text-amber-400 font-normal">Sin detectar</span>}
            </div>
            <div className="text-[9px] text-slate-400">
              {isDni ? 'DNI Peruano (8 dígitos)' : 'Carnet Extranjería'}
            </div>
          </div>

          {/* 2. Fecha Nacimiento */}
          <div className="p-2.5 rounded-lg bg-[#0B1528] border border-[#1E3557] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">2. FECHA NACIMIENTO</span>
              {renderConfidenceBadge('birth_date')}
            </div>
            <div className="text-sm font-black text-white truncate">
              {formData.birth_date || <span className="text-amber-400 font-normal">Sin detectar</span>}
            </div>
            <div className="text-[9px] text-slate-400">
              {fieldsMeta?.birth_date?.anchor_matched || 'DD/MM/AAAA'}
            </div>
          </div>

          {/* 3. Fecha Emisión */}
          <div className="p-2.5 rounded-lg bg-[#0B1528] border border-[#1E3557] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">3. FECHA EMISIÓN</span>
              {renderConfidenceBadge('issue_date')}
            </div>
            <div className="text-sm font-black text-white truncate">
              {formData.issue_date || <span className="text-slate-500 font-normal">No detectada</span>}
            </div>
            <div className="text-[9px] text-slate-400">
              {fieldsMeta?.issue_date?.anchor_matched || 'DD/MM/AAAA'}
            </div>
          </div>

          {/* 4. Fecha Caducidad */}
          <div className="p-2.5 rounded-lg bg-[#0B1528] border border-[#1E3557] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">4. CADUCIDAD / VENCIMIENTO</span>
              {renderConfidenceBadge('expiry_date')}
            </div>
            <div className="text-sm font-black text-white truncate">
              {formData.expiry_date || <span className="text-slate-500 font-normal">No detectada</span>}
            </div>
            <div className="text-[9px] text-slate-400">
              {formData.expiry_date === 'NO CADUCA' ? 'ID Permanente' : (fieldsMeta?.expiry_date?.anchor_matched || 'DD/MM/AAAA')}
            </div>
          </div>
        </div>
      </div>

      {/* AVISO DE CAMPOS PENDIENTES DE COMPLETAR EN AMARILLO */}
      {pendingFieldsList.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-400/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 shadow-lg shadow-amber-950/30">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-400/50 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  ⚠️ Atención: Hay {pendingFieldsList.length} campo(s) pendiente(s) de completar
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950">
                  RESALTADOS EN AMARILLO
                </span>
              </div>
              <p className="text-[11px] text-amber-100/90 mt-0.5 font-medium">
                Por favor complete o verifique los campos marcados con borde y fondo amarillo antes de registrar (ej. {pendingFieldsList.map(k => fieldLabelsMap[k]).slice(0, 4).join(', ')}).
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-950/70 border border-amber-400/50 px-2.5 py-1 rounded-md shrink-0 self-end sm:self-center">
            {pendingFieldsList.length} PENDIENTES
          </span>
        </div>
      )}

      {/* Form Grid (High-Density & Cleanly Spaced) */}
      <form onSubmit={handleSave} className="space-y-4">
        
        {/* Row 1: Document Number & Sex & Nationality */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          {/* Doc Number */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">
                  {isDni ? 'Número de DNI (8 dígitos)' : 'Número de Carnet CE'} *
                </label>
                {renderMissingBadge('doc_number')}
              </div>
              {renderConfidenceBadge('doc_number')}
            </div>
            <input
              type="text"
              value={formData.doc_number}
              onChange={(e) => handleChange('doc_number', e.target.value)}
              required
              className={getFieldClass(
                'doc_number',
                isDni && formData.doc_number.length !== 8
                  ? 'w-full px-3 py-2 rounded-lg font-mono text-xs font-bold focus:outline-none transition border-rose-500 focus:border-rose-500 ring-1 ring-rose-500'
                  : 'w-full px-3 py-2 rounded-lg font-mono text-xs font-bold focus:outline-none transition'
              )}
              placeholder={isDni ? 'Ej. 72345678' : 'Ej. 001234567'}
            />
          </div>

          {/* Sex */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Sexo *</label>
                {renderMissingBadge('sex')}
              </div>
              {renderConfidenceBadge('sex')}
            </div>
            <select
              value={formData.sex}
              onChange={(e) => handleChange('sex', e.target.value)}
              className={getFieldClass('sex', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition')}
            >
              <option value="">Seleccione (Pendiente)</option>
              <option value="M">M - Masculino</option>
              <option value="F">F - Femenino</option>
            </select>
          </div>

          {/* Nationality */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Nacionalidad</label>
                {renderMissingBadge('nationality')}
              </div>
              {renderConfidenceBadge('nationality')}
            </div>
            <input
              type="text"
              value={formData.nationality}
              onChange={(e) => handleChange('nationality', e.target.value)}
              className={getFieldClass('nationality', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition uppercase')}
              placeholder="Ej. PERUANA"
            />
          </div>

        </div>

        {/* Row 2: Surnames & First Names */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Apellido Paterno *</label>
                {renderMissingBadge('paternal_surname')}
              </div>
              {renderConfidenceBadge('paternal_surname')}
            </div>
            <input
              type="text"
              value={formData.paternal_surname}
              onChange={(e) => handleChange('paternal_surname', e.target.value)}
              className={getFieldClass('paternal_surname', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition uppercase')}
              placeholder="Ej. MENDEZ"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200">Apellido Materno</label>
              {renderConfidenceBadge('maternal_surname')}
            </div>
            <input
              type="text"
              value={formData.maternal_surname}
              onChange={(e) => handleChange('maternal_surname', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#060D1A] border border-[#1D334E] text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 uppercase"
              placeholder="Ej. LOPEZ"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Nombres / Prenombres *</label>
                {renderMissingBadge('first_names')}
              </div>
              {renderConfidenceBadge('first_names')}
            </div>
            <input
              type="text"
              value={formData.first_names}
              onChange={(e) => handleChange('first_names', e.target.value)}
              className={getFieldClass('first_names', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition uppercase')}
              placeholder="Ej. BETY VALERIANA"
            />
          </div>

        </div>

        {/* Row 3: Dates (Birth, Issue, Expiry) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Fecha de Nacimiento *</label>
                {renderMissingBadge('birth_date')}
              </div>
              {renderConfidenceBadge('birth_date')}
            </div>
            <input
              type="text"
              value={formData.birth_date}
              onChange={(e) => handleChange('birth_date', e.target.value)}
              className={getFieldClass('birth_date', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition')}
              placeholder="DD/MM/AAAA (02/06/1997)"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200">Fecha de Emisión</label>
              {renderConfidenceBadge('issue_date')}
            </div>
            <input
              type="text"
              value={formData.issue_date}
              onChange={(e) => handleChange('issue_date', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#060D1A] border border-[#1D334E] text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              placeholder="DD/MM/AAAA (20/09/2023)"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200">Fecha Caducidad / Vencimiento</label>
              {renderConfidenceBadge('expiry_date')}
            </div>
            <input
              type="text"
              value={formData.expiry_date}
              onChange={(e) => handleChange('expiry_date', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#060D1A] border border-[#1D334E] text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              placeholder="DD/MM/AAAA o NO CADUCA"
            />
          </div>

        </div>

        {/* Row 4: Address, Calidad Migratoria (si es CE) & Ubigeo Inteligente */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          <div className="sm:col-span-1 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Dirección / Domicilio</label>
                {renderMissingBadge('address')}
              </div>
              {renderConfidenceBadge('address')}
            </div>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className={getFieldClass('address', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition uppercase')}
              placeholder="Ej. CASERIO CORACOLLO SN"
            />
          </div>

          {!isDni && (
            <div className="sm:col-span-1 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-200">Calidad Migratoria</label>
                {renderConfidenceBadge('migratory_status')}
              </div>
              <input
                type="text"
                value={formData.migratory_status}
                onChange={(e) => handleChange('migratory_status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#060D1A] border border-[#1D334E] text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 uppercase"
                placeholder="Ej. TRABAJADOR / ESPECIAL RESIDENTE"
              />
            </div>
          )}

          <div className={`${!isDni ? 'sm:col-span-1' : 'sm:col-span-2'} space-y-1 relative`} ref={ubigeoDropdownRef}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">
                  Ubigeo Inteligente (Distrito / Prov / Dpto o Código 6 dígitos)
                </label>
                {renderMissingBadge('ubigeo')}
                <a
                  href={api.getUbigeoExcelUrl()}
                  target="_blank"
                  rel="noreferrer"
                  title="Descargar Catálogo Oficial Excel de Ubigeos Perú"
                  className="inline-flex items-center space-x-1 text-[10px] text-cyan-300 hover:text-cyan-200 font-semibold underline decoration-dotted"
                >
                  <FileSpreadsheet className="w-3 h-3 inline text-teal-400" />
                  <span>Excel Ubigeos</span>
                </a>
              </div>
              {renderConfidenceBadge('ubigeo')}
            </div>

            <div className="relative">
              <input
                type="text"
                value={formData.ubigeo}
                onChange={(e) => handleUbigeoSearch(e.target.value)}
                onFocus={() => {
                  if (formData.ubigeo && formData.ubigeo.length >= 2) {
                    handleUbigeoSearch(formData.ubigeo);
                  }
                }}
                className={getFieldClass('ubigeo', 'w-full px-3 py-2 pr-8 rounded-lg text-xs font-semibold focus:outline-none uppercase')}
                placeholder="Escribe distrito, provincia o código INEI/RENIEC (ej. QUILLO o 020502)..."
              />
              {isSearchingUbigeo && (
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-2.5 top-2.5" />
              )}
            </div>

            {/* Ubigeo Autocomplete Dropdown */}
            {showUbigeoDropdown && ubigeoSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0B1528] border border-[#274468] rounded-lg shadow-2xl max-h-56 overflow-y-auto divide-y divide-[#1E3557]">
                {ubigeoSuggestions.map((item, idx) => (
                  <button
                    key={`${item.ubigeo_inei}-${idx}`}
                    type="button"
                    onClick={() => handleSelectUbigeo(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#101F3B] transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                        📍 {item.distrito}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.departamento} • {item.provincia}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#101F3B] text-cyan-300 border border-[#274468]">
                        INEI: {item.ubigeo_inei}
                      </span>
                      {item.ubigeo_reniec && (
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                          RENIEC: {item.ubigeo_reniec}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Ubigeo Breakdown Pill Badges */}
            {(formData.department || formData.district || formData.ubigeo_inei) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {formData.department && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#101F3B] text-slate-200 border border-[#274468]">
                    🏛️ Dpto: <strong className="text-white">{formData.department}</strong>
                  </span>
                )}
                {formData.province && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#101F3B] text-slate-200 border border-[#274468]">
                    🏙️ Prov: <strong className="text-white">{formData.province}</strong>
                  </span>
                )}
                {formData.district && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#101F3B] text-slate-200 border border-[#274468]">
                    📍 Dist: <strong className="text-white">{formData.district}</strong>
                  </span>
                )}
                {formData.ubigeo_inei && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#0A3D44]/90 text-teal-200 border border-teal-400/50">
                    🆔 IDUBIGEO: {formData.ubigeo_inei}
                  </span>
                )}
                {formData.ubigeo_reniec && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#101F3B] text-cyan-300 border border-[#274468]">
                    🔢 RENIEC: {formData.ubigeo_reniec}
                  </span>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Row 5: Contacto & Estado Civil (3 cols) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Celular / Teléfono *</label>
                {renderMissingBadge('phone')}
              </div>
              {renderConfidenceBadge('phone')}
            </div>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={getFieldClass('phone', 'w-full px-3 py-2 rounded-lg font-mono text-xs font-semibold focus:outline-none transition')}
              placeholder="999999999"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Correo Electrónico</label>
                {renderMissingBadge('email')}
              </div>
              {renderConfidenceBadge('email')}
            </div>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={getFieldClass('email', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition')}
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-200">Estado Civil</label>
                {renderMissingBadge('civil_status')}
              </div>
              {renderConfidenceBadge('civil_status')}
            </div>
            <select
              value={formData.civil_status}
              onChange={(e) => handleChange('civil_status', e.target.value)}
              className={getFieldClass('civil_status', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition')}
            >
              <option value="">Seleccione (Pendiente)...</option>
              <option value="SOLTERO">SOLTERO(A)</option>
              <option value="CASADO">CASADO(A)</option>
              <option value="VIUDO">VIUDO(A)</option>
              <option value="DIVORCIADO">DIVORCIADO(A)</option>
              <option value="CONVIVIENTE">CONVIVIENTE</option>
            </select>
          </div>

        </div>

        {/* Notificación de consulta SBS en vivo */}
        {sbsNotification && (
          <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold animate-in fade-in ${
            sbsNotification.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
          }`}>
            <span className="flex items-center space-x-2">
              <span>{sbsNotification.type === 'success' ? '🏛️' : '⚠️'}</span>
              <span>{sbsNotification.text}</span>
            </span>
          </div>
        )}

        {/* Row 6: Pensión / AFP, Cuenta Bancaria & Observaciones */}
        <div className="p-3 rounded-xl bg-[#071324] border border-cyan-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1E3557]">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/40">
                🏛️ SITUACIÓN PREVISIONAL (SBS)
              </span>
              <span className="text-xs text-slate-300 font-bold">
                Afiliación SPP / AFP y CUSPP
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={api.downloadSBSExcelUrl()}
                target="_blank"
                rel="noreferrer"
                download="REPORTE_SBS_HISTORICO.xlsx"
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-[#101F3B] hover:bg-[#162A4F] text-teal-300 border border-[#274468] transition flex items-center space-x-1"
                title="Descargar reporte histórico SBS acumulado en disco local"
              >
                <span>📥 Reporte SBS (.xlsx)</span>
              </a>

              <button
                type="button"
                onClick={() => handleQuerySBS(true)}
                disabled={isQueryingSBS || !formData.doc_number || !formData.paternal_surname}
                className="px-3 py-1 rounded-lg text-[11px] font-mono font-bold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-40 text-slate-950 transition shadow-sm flex items-center space-x-1 btn-precision"
                title="Consultar portal oficial de la SBS en tiempo real"
              >
                {isQueryingSBS ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>CONSULTANDO SBS...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ ACTUALIZAR DESDE SBS</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <label className="text-[11px] font-bold text-slate-200">Sistema Pensionario *</label>
                  {renderMissingBadge('pension_system')}
                </div>
                {renderSourceBadge('pension_system')}
              </div>
              <input
                type="text"
                value={formData.pension_system}
                onChange={(e) => handleChange('pension_system', e.target.value)}
                className={getFieldClass('pension_system', 'w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none transition uppercase')}
                placeholder="ONP / INTEGRA / HABITAT / PROFUTURO / PRIMA"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <label className="text-[11px] font-bold text-slate-200">CUSPP (AFP)</label>
                  {renderMissingBadge('cuspp')}
                </div>
                {renderSourceBadge('cuspp')}
              </div>
              <input
                type="text"
                value={formData.cuspp}
                onChange={(e) => handleChange('cuspp', e.target.value)}
                className={getFieldClass('cuspp', 'w-full px-3 py-2 rounded-lg font-mono text-xs font-semibold focus:outline-none transition')}
                placeholder="Código CUSPP si aplica"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-200">Cuenta de Banco</label>
                {formData.bank_account && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-400/50">
                    🏛️ HISTÓRICO
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.bank_account || ''}
                onChange={(e) => handleChange('bank_account', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#060D1A] border border-[#1D334E] text-white font-mono text-xs font-semibold focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                placeholder="N° Cuenta Bancaria"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-200">Observaciones</label>
              <input
                type="text"
                value={formData.observations}
                onChange={(e) => handleChange('observations', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#060D1A] border border-[#1D334E] text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                placeholder="Anotaciones internas"
              />
            </div>

          </div>
        </div>

        {/* =========================================================================
            SECCIÓN: ASIGNACIÓN DE DATOS DE CONTRATO NISIRA
            PALETA CHAVÍN: Azul Marino, Acero, Turquesa y Verde Petróleo
            ========================================================================= */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#060D1A] border border-teal-500/50 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E3557]">
            <h4 className="text-xs font-black text-teal-300 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-400" />
              <span>Asignación de Datos de Contrato NISIRA</span>
            </h4>
            <span className="text-[10px] text-teal-200 font-mono bg-[#0A3D44]/90 px-2.5 py-0.5 rounded border border-teal-400/50 font-bold">
              🔷 Celdas Mapeadas NISIRA
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            {/* Cod. Planilla */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-teal-400"></span>
                <span>Cod. Planilla (3 car.)</span>
              </label>
              <ContractOptionSelect
                options={CODIGOS_PLANILLA}
                value={formData.cod_planilla}
                onChange={(v) => handleChange('cod_planilla', v)}
                placeholder="Seleccionar planilla..."
              />
            </div>

            {/* Tipo de Contrato */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-teal-400"></span>
                <span>Tipo de Contrato (2 dig.)</span>
              </label>
              <ContractOptionSelect
                options={TIPOS_CONTRATO}
                value={formData.tipo_contrato}
                onChange={(v) => handleChange('tipo_contrato', v)}
                placeholder="Seleccionar tipo..."
              />
            </div>

            {/* Básico */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-xs bg-teal-400"></span>
                  <span>Básico (S/.)</span>
                </label>
                <div className="flex gap-1">
                  {[51.82, 53.08, 1800, 2000].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleChange('basico', b)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[#0A3D44] hover:bg-teal-500 hover:text-slate-950 text-teal-200 border border-teal-500/40 font-mono font-bold transition btn-precision"
                      title={`Asignar S/. ${b}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                list="sugerencias-basicos"
                value={formData.basico}
                onChange={(e) => handleChange('basico', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white font-mono font-bold focus:outline-none focus:border-cyan-400 h-10"
              />
              <datalist id="sugerencias-basicos">
                {SUGGESTED_BASICOS.map((sb) => (
                  <option key={sb.value} value={sb.value}>
                    {sb.label}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Inicio Contrato */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-xs bg-teal-400"></span>
                  <span>Inicio Contrato</span>
                </label>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#0A3D44]/90 text-teal-200 font-bold border border-teal-400/50 font-mono">
                  {formData.inicio_contrato ? 'Confirmado' : 'Revisar'}
                </span>
              </div>
              <input
                type="date"
                value={formData.inicio_contrato}
                onChange={(e) => handleDateOrDurationChange('inicio_contrato', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white focus:outline-none focus:border-cyan-400 h-10 font-mono text-xs"
              />
            </div>

            {/* Duración */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-cyan-400"></span>
                <span>Duración (Meses)</span>
              </label>
              <select
                value={formData.duracion}
                onChange={(e) => handleDateOrDurationChange('duracion', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white focus:outline-none focus:border-cyan-400 h-10 font-semibold text-xs"
              >
                <option value="1">1 Mes</option>
                <option value="2">2 Meses</option>
                <option value="3">3 Meses (Estándar)</option>
                <option value="4">4 Meses</option>
                <option value="6">6 Meses</option>
                <option value="12">12 Meses</option>
              </select>
            </div>

            {/* Fin Contrato */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-xs bg-teal-400"></span>
                  <span>Fin Contrato</span>
                </label>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#101F3B] text-cyan-300 font-bold border border-cyan-400/40 font-mono">
                  Calculado
                </span>
              </div>
              <input
                type="date"
                value={formData.fin_contrato}
                onChange={(e) => handleChange('fin_contrato', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white focus:outline-none focus:border-cyan-400 h-10 font-mono text-xs"
              />
            </div>

            {/* F. Firma Contrato */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-teal-400"></span>
                <span>F. Firma Contrato</span>
              </label>
              <input
                type="date"
                value={formData.fecha_firma_contrato}
                onChange={(e) => handleChange('fecha_firma_contrato', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white focus:outline-none focus:border-cyan-400 h-10 font-mono text-xs"
              />
            </div>

            {/* Nro. Contrato */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-cyan-400"></span>
                <span>Nro. Contrato</span>
              </label>
              <input
                type="text"
                placeholder="Ej. 001-2026"
                value={formData.nro_contrato}
                onChange={(e) => handleChange('nro_contrato', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white font-mono text-xs focus:outline-none focus:border-cyan-400 h-10"
              />
            </div>

            {/* Nro. Contrato Ref */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-cyan-400"></span>
                <span>Nro. Contrato Ref</span>
              </label>
              <input
                type="text"
                placeholder="Referencia opcional..."
                value={formData.nro_contrato_ref}
                onChange={(e) => handleChange('nro_contrato_ref', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1528] border border-[#1D334E] text-white font-mono text-xs focus:outline-none focus:border-cyan-400 h-10"
              />
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#1E3557]">
          
          <button
            type="button"
            onClick={onReset}
            className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl border border-[#274468] bg-[#101F3B] hover:bg-[#162A4F] text-slate-200 hover:text-white text-xs font-bold transition shadow-xs hover:border-cyan-400 min-h-[48px] active:scale-98 btn-precision"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>← Volver a Escanear</span>
          </button>

          <button
            type="submit"
            disabled={isSaving || saveSuccess}
            className={`flex items-center justify-center space-x-2 px-7 py-3 rounded-xl font-black text-xs sm:text-sm shadow-lg transition min-h-[48px] active:scale-98 btn-precision ${
              saveSuccess
                ? 'bg-teal-500 text-slate-950 font-black shadow-glow-petroleum'
                : 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-cyan-500/25 border border-cyan-200/50'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>¡Guardado en Base de Datos!</span>
              </>
            ) : isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Guardar en Base de Datos</span>
              </>
            )}
          </button>

        </div>

      </form>

      {/* Technical OCR Diagnostic Modal */}
      <OCRDiagnosticModal
        isOpen={showDiagnostic}
        onClose={() => setShowDiagnostic(false)}
        scanResult={scanResult}
      />

    </div>
  );
}
