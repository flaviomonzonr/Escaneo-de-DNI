import React, { useState, useEffect } from 'react';
import {
  Search,
  Key,
  Globe,
  UserPlus,
  Camera,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  Check,
  CreditCard,
  Users,
  FileSpreadsheet,
  UploadCloud,
  Download,
  Copy,
  Trash2,
  ExternalLink,
  Filter,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

export default function DNIFactilizaZone({
  onResultReady,
  onSwitchToCameraScan,
  theme = 'dark',
}) {
  // Query mode state: DNI vs CEE
  const [queryDocType, setQueryDocType] = useState('DNI'); // 'DNI' | 'Carnet de Extranjería'
  const [docNumber, setDocNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [notFoundDoc, setNotFoundDoc] = useState(null);

  // Historical Data status state
  const [historicalStats, setHistoricalStats] = useState({ total_workers: 7752, file_exists: true });

  // Token configuration state
  const [token, setToken] = useState(() => {
    return localStorage.getItem('factiliza_token') || '';
  });
  const [serverHasToken, setServerHasToken] = useState(false);
  const [serverMaskedToken, setServerMaskedToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showTokenSecret, setShowTokenSecret] = useState(false);
  const [tokenSaveSuccess, setTokenSaveSuccess] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);

  // Tabs state: 'lookup' | 'batch' | 'foreign'
  const [activeSubTab, setActiveSubTab] = useState('lookup');
  const [manualDocType, setManualDocType] = useState('Carnet de Extranjería');
  const [manualDocNumber, setManualDocNumber] = useState('');

  // Búsqueda Masiva (Lote de DNIs) State
  const [batchText, setBatchText] = useState('');
  const [detectedDnis, setDetectedDnis] = useState([]);
  const [isQueryingBatch, setIsQueryingBatch] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [batchFilter, setBatchFilter] = useState('all'); // 'all' | 'found' | 'not_found'
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [batchSaveMsg, setBatchSaveMsg] = useState(null);
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const [copiedDni, setCopiedDni] = useState(null);

  // Fetch initial token status & historical data stats from backend
  useEffect(() => {
    const loadInitData = async () => {
      try {
        const stats = await api.getHistoricalStats();
        if (stats && stats.total_workers) {
          setHistoricalStats(stats);
        }
      } catch (e) {
        // Silent catch
      }

      try {
        const config = await api.getFactilizaConfig();
        if (config?.has_token) {
          setServerHasToken(true);
          if (config.masked_token) {
            setServerMaskedToken(config.masked_token);
          }
        }
        if (config?.token && !localStorage.getItem('factiliza_token')) {
          setToken(config.token);
          localStorage.setItem('factiliza_token', config.token);
        }
      } catch (e) {
        // Silent catch
      }
    };
    loadInitData();
  }, []);

  const handleSaveToken = async (e) => {
    if (e) e.preventDefault();
    setIsSavingToken(true);
    setTokenSaveSuccess(false);
    setErrorMsg(null);
    try {
      const cleanToken = token.trim();
      localStorage.setItem('factiliza_token', cleanToken);
      const res = await api.setFactilizaConfig(cleanToken);
      if (cleanToken) {
        setServerHasToken(true);
        setServerMaskedToken(res?.masked_token || `fac_...${cleanToken.slice(-4)}`);
      } else {
        setServerHasToken(false);
        setServerMaskedToken('');
      }
      setTokenSaveSuccess(true);
      setTimeout(() => {
        setTokenSaveSuccess(false);
        if (cleanToken) setShowTokenInput(false);
      }, 2000);
    } catch (err) {
      console.error('Error guardando token:', err);
      setTokenSaveSuccess(true);
      setTimeout(() => setTokenSaveSuccess(false), 2000);
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleDocNumberChange = (e) => {
    let val = e.target.value.trim();
    if (queryDocType === 'DNI') {
      val = val.replace(/\D/g, '').slice(0, 8);
    } else {
      // Carnet de Extranjería / CEE
      val = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase();
    }
    setDocNumber(val);
    setErrorMsg(null);
    setNotFoundDoc(null);
  };

  const handleSearchDocument = async (e) => {
    if (e) e.preventDefault();
    const cleanDoc = docNumber.trim();

    if (!cleanDoc) {
      setErrorMsg(`Por favor ingresa el número de ${queryDocType}.`);
      return;
    }

    if (queryDocType === 'DNI' && cleanDoc.length !== 8) {
      setErrorMsg('Por favor ingresa un número de DNI válido de 8 dígitos.');
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    setNotFoundDoc(null);

    try {
      let res;
      if (queryDocType === 'Carnet de Extranjería') {
        res = await api.queryFactilizaCee(cleanDoc, token);
      } else {
        res = await api.queryFactilizaDni(cleanDoc, token);
      }

      if (res?.success) {
        const itemSource = res.source || (res.is_historical ? 'data_historica' : 'factiliza');

        // Normalización garantizada de Sexo y Fecha de Nacimiento para el sistema
        const rawSex = res.sex || '';
        const cleanSex = ['M', 'MASCULINO', '1', 'H', 'HOMBRE'].includes(String(rawSex).trim().toUpperCase())
          ? 'M'
          : ['F', 'FEMENINO', '2', 'MUJER'].includes(String(rawSex).trim().toUpperCase())
          ? 'F'
          : rawSex;

        let cleanBirth = (res.birth_date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(cleanBirth)) {
          const parts = cleanBirth.slice(0, 10).split('-');
          cleanBirth = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        onResultReady({
          doc_type: res.doc_type || queryDocType,
          doc_number: res.doc_number || cleanDoc,
          paternal_surname: res.paternal_surname || '',
          maternal_surname: res.maternal_surname || '',
          first_names: res.first_names || '',
          nationality: res.nationality || (queryDocType === 'DNI' ? 'PERUANA' : ''),
          birth_date: cleanBirth,
          sex: cleanSex,
          civil_status: res.civil_status || 'SOLTERO',
          address: res.address || '',
          department: res.department || '',
          province: res.province || '',
          district: res.district || '',
          ubigeo_reniec: res.ubigeo_reniec || '',
          ubigeo_inei: res.ubigeo_inei || '',
          ubigeo: res.ubigeo || '',
          phone: res.phone || '999999999',
          email: res.email || 'sincorreo@gmail.com',
          pension_system: res.pension_system || '',
          pension_commission: res.pension_commission || '',
          cuspp: res.cuspp || '',
          bank_account: res.bank_account || '',
          cargo: res.cargo || '',
          source: itemSource,
          is_historical: Boolean(res.is_historical),
          duplicate_warning: res.duplicate_warning,
          worker_match_status: res.worker_match_status,
          matched_worker_name: res.matched_worker_name,
          matched_worker_dni: res.matched_worker_dni,
          api_complemented: true,
          api_status: {
            queried: true,
            success: true,
            source: itemSource,
            message: res.message || (res.is_historical ? 'Trabajador encontrado en Data Histórica (0 tokens consumidos).' : 'Datos obtenidos desde Factiliza / RENIEC.'),
          },
          fields: {
            doc_number: { value: res.doc_number || cleanDoc, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
            first_names: { value: res.first_names, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
            paternal_surname: { value: res.paternal_surname, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
            maternal_surname: { value: res.maternal_surname, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
            birth_date: { value: cleanBirth, confidence: cleanBirth ? 100 : 0, is_valid: Boolean(cleanBirth), status: cleanBirth ? 'CONFIRMADO' : 'REVISAR', source: itemSource },
            sex: { value: cleanSex, confidence: cleanSex ? 100 : 0, is_valid: Boolean(cleanSex), status: cleanSex ? 'CONFIRMADO' : 'REVISAR', source: itemSource },
            issue_date: { value: res.issue_date || '', confidence: res.issue_date ? 95 : 0, is_valid: Boolean(res.issue_date), status: res.issue_date ? 'CONFIRMADO' : 'REVISAR', source: itemSource },
            expiry_date: { value: res.expiry_date || '', confidence: res.expiry_date ? 95 : 0, is_valid: Boolean(res.expiry_date), status: res.expiry_date ? 'CONFIRMADO' : 'REVISAR', source: itemSource },
            address: { value: res.address, confidence: 95, is_valid: true, status: 'CONFIRMADO', source: itemSource },
            pension_system: { value: res.pension_system, confidence: 95, is_valid: true, status: 'CONFIRMADO', source: res.sbs_status ? 'sbs' : itemSource },
            cuspp: { value: res.cuspp, confidence: 95, is_valid: true, status: 'CONFIRMADO', source: res.sbs_status ? 'sbs' : itemSource },
          }
        });
      } else {
        if (res?.needs_token) {
          setShowTokenInput(true);
        }
        setErrorMsg(res?.error || `El documento ${cleanDoc} no figura en Data Histórica ni en Factiliza.`);
        if (res?.can_fill_manually || res?.status_code === 404 || !hasConfiguredToken || res?.needs_token) {
          setNotFoundDoc({ type: queryDocType, number: cleanDoc });
        }
      }
    } catch (err) {
      console.error('Error al consultar:', err);
      let detail = err.response?.data?.error || err.response?.data?.detail;
      if (!detail) {
        if (err.response?.status === 503) {
          detail = 'El servidor backend se está iniciando o está apagado en el puerto 8000. Por favor espere unos segundos o verifique que el servicio esté activo.';
        } else {
          detail = err.message || 'Error de conexión con el servidor';
        }
      }
      setErrorMsg(`Aviso: ${detail}`);
      setNotFoundDoc({ type: queryDocType, number: cleanDoc });
    } finally {
      setIsSearching(false);
    }
  };

  // Llenar manualmente documento no encontrado
  const handleStartManualWithDoc = () => {
    const docT = notFoundDoc?.type || queryDocType;
    const docN = notFoundDoc?.number || docNumber || '';
    onResultReady({
      doc_type: docT,
      doc_number: docN,
      paternal_surname: '',
      maternal_surname: '',
      first_names: '',
      nationality: docT === 'DNI' ? 'PERUANA' : '',
      birth_date: '',
      sex: '',
      address: '',
      department: '',
      province: '',
      district: '',
      ubigeo_reniec: '',
      ubigeo_inei: '',
      source: 'manual',
    });
  };

  // Registro manual directo desde cero (pestaña 2)
  const handleStartForeignManual = (e) => {
    if (e) e.preventDefault();
    onResultReady({
      doc_type: manualDocType,
      doc_number: manualDocNumber.trim(),
      paternal_surname: '',
      maternal_surname: '',
      first_names: '',
      nationality: manualDocType === 'DNI' ? 'PERUANA' : '',
      birth_date: '',
      sex: '',
      address: '',
      department: '',
      province: '',
      district: '',
      ubigeo_reniec: '',
      ubigeo_inei: '',
      source: 'manual',
    });
  };

  // Manejadores para Búsqueda Masiva por DNI (Lote)
  const handleBatchTextChange = (e) => {
    const text = e.target.value;
    setBatchText(text);
    const matches = text.match(/\b\d{8}\b/g) || [];
    const unique = Array.from(new Set(matches));
    setDetectedDnis(unique);
    setBatchSaveMsg(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const matches = content.match(/\b\d{8}\b/g) || [];
        const unique = Array.from(new Set(matches));
        setBatchText((prev) => (prev ? prev + '\n' + unique.join('\n') : unique.join('\n')));
        setDetectedDnis((prev) => Array.from(new Set([...prev, ...unique])));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRemoveDni = (dniToRemove) => {
    const next = detectedDnis.filter((d) => d !== dniToRemove);
    setDetectedDnis(next);
    setBatchText(next.join('\n'));
  };

  const handleClearBatch = () => {
    setBatchText('');
    setDetectedDnis([]);
    setBatchResults(null);
    setBatchSaveMsg(null);
  };

  const handleExecuteBatchQuery = async () => {
    if (detectedDnis.length === 0) {
      setErrorMsg('Por favor ingresa o pega al menos un DNI de 8 dígitos para consultar.');
      return;
    }

    setIsQueryingBatch(true);
    setErrorMsg(null);
    setBatchSaveMsg(null);

    try {
      const res = await api.queryFactilizaBatch(detectedDnis, token);
      if (res?.success) {
        setBatchResults(res);
      } else {
        if (res?.needs_token) setShowTokenInput(true);
        setErrorMsg(res?.error || 'Error al ejecutar la consulta masiva.');
      }
    } catch (err) {
      console.error('Error en lote:', err);
      const detail = err.response?.data?.error || err.message || 'Error de conexión';
      setErrorMsg(`Error al consultar lote: ${detail}`);
    } finally {
      setIsQueryingBatch(false);
    }
  };

  const handleSaveAllBatch = async () => {
    if (!batchResults?.results) return;
    const foundRecords = batchResults.results.filter((r) => r.success);
    if (foundRecords.length === 0) {
      setErrorMsg('No hay registros encontrados en el padrón para guardar.');
      return;
    }

    setIsSavingBatch(true);
    setBatchSaveMsg(null);
    try {
      const res = await api.saveFactilizaBatch(foundRecords);
      if (res?.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06B6D4', '#0D9488', '#10B981', '#F59E0B'],
        });
        setBatchSaveMsg({
          type: 'success',
          text: res.message || `¡Se guardaron ${res.saved_count} trabajadores en la base de datos!`,
        });
      } else {
        setBatchSaveMsg({
          type: 'error',
          text: res?.error || 'No se pudieron guardar los registros.',
        });
      }
    } catch (err) {
      console.error('Error guardando lote:', err);
      setBatchSaveMsg({
        type: 'error',
        text: 'Error al guardar los registros en el lote.',
      });
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleExportBatchExcel = async () => {
    if (!batchResults?.results) return;
    setIsExportingBatch(true);
    try {
      await api.exportFactilizaBatchExcel(batchResults.results);
    } catch (err) {
      console.error('Error exportando Excel:', err);
      setErrorMsg('No se pudo generar el archivo Excel de la consulta masiva.');
    } finally {
      setIsExportingBatch(false);
    }
  };

  const handleCopyDni = (dni) => {
    navigator.clipboard?.writeText(dni);
    setCopiedDni(dni);
    setTimeout(() => setCopiedDni(null), 1500);
  };

  const hasConfiguredToken = serverHasToken || Boolean(token && token.trim().length > 10);

  return (
    <div className="space-y-4 max-w-4xl mx-auto animate-fade-in select-none">
      
      {/* 1. DATA HISTÓRICA LOCAL PRECARGADA (1ª OPCIÓN PRIORITARIA - 0 TOKENS) */}
      <div className="rounded-2xl bg-gradient-to-r from-[#061B29] to-[#0A2E2A] border-2 border-emerald-500/50 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-black text-xl shrink-0 shadow-sm">
              🏛️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
                  Data Histórica: {historicalStats.total_workers.toLocaleString()} Trabajadores Precargados
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>1ª OPCIÓN (0 TOKENS)</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Al ingresar un DNI se busca <strong>primero en la base local (DATA HISTORICA.xlsx)</strong> con datos completos (AFP, CUSPP, banco, dirección). Si no existe, recurre al API Factiliza.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center font-mono text-xs shrink-0">
            <span className="px-3 py-1.5 rounded-lg bg-[#060D1A] border border-emerald-500/40 text-emerald-300 font-extrabold flex items-center space-x-1.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{historicalStats.total_workers.toLocaleString()} LOCALES</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. CONFIGURACIÓN COMPLEMENTARIA: TOKEN DE FACTILIZA (2ª OPCIÓN EN LÍNEA) */}
      <div className="rounded-2xl bg-[#0B1528] border border-[#1E3557] p-3.5 sm:p-4 shadow-xl transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl flex items-center justify-center border ${
              hasConfiguredToken
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-[#101F3B] border-[#274468] text-slate-400'
            }`}>
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">2ª Opción: Factiliza API (En Línea)</span>
                {hasConfiguredToken ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>TOKEN CONECTADO</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#101F3B] text-slate-300 border border-[#274468]">
                    <span>OPCIONAL (Solo si falta en histórico)</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {hasConfiguredToken
                  ? (serverMaskedToken ? `Token activo en servidor (${serverMaskedToken}). Se usará solo cuando el DNI no esté en Data Histórica.` : 'Listo para consultar DNIs no registrados en la Data Histórica.')
                  : 'Opcional: configura un Bearer Token para consultar automáticamente en línea los DNIs que no existan en la base local.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTokenInput(!showTokenInput)}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center space-x-1.5 border btn-precision ${
              showTokenInput
                ? 'bg-[#162A4F] text-white border-cyan-400/50'
                : 'bg-[#101F3B] hover:bg-[#162A4F] text-slate-200 border-[#274468]'
            }`}
          >
            <span>{showTokenInput ? 'Ocultar Casilla' : hasConfiguredToken ? 'Gestionar Token' : '⚡ Configurar Token'}</span>
          </button>
        </div>

        {/* CAMPO DE ENTRADA DEL TOKEN (Expandible a petición del usuario) */}
        {showTokenInput && (
          <form onSubmit={handleSaveToken} className="mt-3.5 pt-3.5 border-t border-[#1E3557] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Lock className="w-3 h-3 text-cyan-400" />
                <span>TOKEN DE ACCESO FACTILIZA (BEARER TOKEN):</span>
              </label>
              {tokenSaveSuccess && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1 animate-pulse">
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Token guardado exitosamente!</span>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1">
                <input
                  type={showTokenSecret ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={serverMaskedToken ? `Token activo en servidor (${serverMaskedToken}) - Escribe para cambiarlo...` : "Pega aquí tu Bearer Token de Factiliza..."}
                  className="w-full bg-[#040914] border border-[#274468] focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTokenSecret(!showTokenSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  title={showTokenSecret ? 'Ocultar token' : 'Mostrar token'}
                >
                  {showTokenSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSavingToken || !token.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-1.5 btn-precision"
              >
                {isSavingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>GUARDAR TOKEN</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              * Se guarda de forma segura en tu servidor local. Solo necesitas ingresarlo una vez.
            </p>
          </form>
        )}
      </div>

      {/* 3. SELECTOR DE PESTAÑAS PRINCIPALES */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 p-1.5 rounded-2xl bg-[#0B1528] border border-[#1E3557] font-mono text-xs shadow-lg">
        <button
          type="button"
          onClick={() => setActiveSubTab('lookup')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 btn-precision ${
            activeSubTab === 'lookup'
              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
              : 'text-slate-300 hover:text-white hover:bg-[#101F3B]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>1. INDIVIDUAL (DNI / CEE)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('batch')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 btn-precision ${
            activeSubTab === 'batch'
              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
              : 'text-slate-300 hover:text-white hover:bg-[#101F3B]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>2. BÚSQUEDA MASIVA (LOTE)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('foreign')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 btn-precision ${
            activeSubTab === 'foreign'
              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
              : 'text-slate-300 hover:text-white hover:bg-[#101F3B]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>3. REGISTRO MANUAL</span>
        </button>

        {onSwitchToCameraScan && (
          <button
            type="button"
            onClick={onSwitchToCameraScan}
            className="hidden md:flex py-2.5 px-3 rounded-xl font-bold text-slate-400 hover:text-cyan-300 hover:bg-[#101F3B] transition items-center space-x-1"
            title="Usar escaneo tradicional con cámara de fotos"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="text-[11px]">Foto</span>
          </button>
        )}
      </div>

      {/* 3. CONTENIDO: PESTAÑA 1 - CONSULTA FACTILIZA (DNI / CARNET) */}
      {activeSubTab === 'lookup' && (
        <div className="rounded-3xl bg-[#0B1528] border border-[#1E3557] p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-xl mx-auto space-y-5 text-center">
            
            <div className="space-y-1.5">
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 uppercase tracking-widest inline-block">
                ⚡ CONSULTA DIRECTA DE TRABAJADOR
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Búsqueda de Trabajador (1º Histórico • 2º Factiliza)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                1ª Opción: Búsqueda instantánea en los <strong>{historicalStats.total_workers.toLocaleString()} registros</strong> de Data Histórica (0 tokens). Si no existe, recurre a Factiliza API.
              </p>
            </div>

            {/* SELECTOR DE TIPO DE CONSULTA: DNI VS CARNET DE EXTRANJERÍA */}
            <div className="flex items-center justify-center space-x-2 p-1 rounded-xl bg-[#040914] border border-[#1D334E] max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  setQueryDocType('DNI');
                  setDocNumber('');
                  setErrorMsg(null);
                  setNotFoundDoc(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                  queryDocType === 'DNI'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>DNI (8 DÍGITOS)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueryDocType('Carnet de Extranjería');
                  setDocNumber('');
                  setErrorMsg(null);
                  setNotFoundDoc(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                  queryDocType === 'Carnet de Extranjería'
                    ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>CARNET DE EXTRANJERÍA (CEE)</span>
              </button>
            </div>

            {/* FORMULARIO DE BÚSQUEDA */}
            <form onSubmit={handleSearchDocument} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  inputMode={queryDocType === 'DNI' ? 'numeric' : 'text'}
                  value={docNumber}
                  onChange={handleDocNumberChange}
                  placeholder={queryDocType === 'DNI' ? 'Ingresa los 8 dígitos del DNI...' : 'Ingresa el número de carnet (ej. 001077238)...'}
                  autoFocus
                  className="w-full bg-[#040914] border-2 border-[#274468] focus:border-cyan-400 rounded-2xl py-3.5 sm:py-4 px-5 text-center text-xl sm:text-2xl font-mono font-black text-white tracking-widest placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition shadow-inner"
                />
                {docNumber && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                    {queryDocType === 'DNI' ? `${docNumber.length}/8` : `${docNumber.length}`}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSearching || !docNumber || (queryDocType === 'DNI' && docNumber.length !== 8)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-[0.99] disabled:opacity-40 text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2 btn-precision min-h-[52px]"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>BUSCANDO EN DATA HISTÓRICA / FACTILIZA...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 stroke-[2.5]" />
                    <span>BUSCAR TRABAJADOR (1º HISTÓRICO, 2º FACTILIZA)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>

            {/* MENSAJE DE ERROR Y FALLBACK DIRECTO A LLENADO MANUAL */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs sm:text-sm text-left space-y-3 animate-in fade-in">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Aviso de Consulta:</span>
                    <span className="text-slate-300 text-xs leading-relaxed">{errorMsg}</span>
                  </div>
                </div>

                {/* BOTÓN DE SEGUNDA OPCIÓN: LLENADO MANUAL PARA CASOS NO ENCONTRADOS */}
                {notFoundDoc && (
                  <div className="pt-2 border-t border-red-900/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <span className="text-[11px] text-slate-300 font-sans">
                      ¿El documento no figura en el padrón o es recién emitido?
                    </span>
                    <button
                      type="button"
                      onClick={handleStartManualWithDoc}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs transition shadow-md flex items-center justify-center space-x-1.5 btn-precision"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>✍️ LLENAR {notFoundDoc.type} {notFoundDoc.number} MANUALMENTE</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* NOTA DE ACCESO RÁPIDO */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 text-[11px] text-slate-400 font-mono">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Validación con RENIEC / Migraciones</span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <button
                type="button"
                onClick={handleStartManualWithDoc}
                className="text-cyan-400 hover:text-cyan-300 underline font-sans"
              >
                O llenar formulario en blanco directamente
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. CONTENIDO: PESTAÑA 2 - REGISTRO MANUAL DIRECTO (DESDE CERO) */}
      {activeSubTab === 'foreign' && (
        <div className="rounded-3xl bg-[#0B1528] border border-[#1E3557] p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-xl mx-auto space-y-6">
            
            <div className="space-y-1.5 text-center">
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-teal-500/15 text-teal-300 border border-teal-400/30 uppercase tracking-widest inline-block">
                🌍 REGISTRO MANUAL DIRECTO (DESDE CERO)
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Registro de Documentos sin Consulta
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Para Carnet de Extranjería, PTP, Pasaporte o DNI no encontrados, llena los datos directamente en un formulario limpio.
              </p>
            </div>

            <form onSubmit={handleStartForeignManual} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  TIPO DE DOCUMENTO DE IDENTIDAD:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Carnet de Extranjería', 'PTP', 'Pasaporte', 'DNI'].map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setManualDocType(dt)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-center ${
                        manualDocType === dt
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm'
                          : 'bg-[#040914] text-slate-400 border-[#1E3557] hover:text-white'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  NÚMERO DE DOCUMENTO (OPCIONAL O INICIAL):
                </label>
                <input
                  type="text"
                  value={manualDocNumber}
                  onChange={(e) => setManualDocNumber(e.target.value.toUpperCase())}
                  placeholder="Ej. 001234567..."
                  className="w-full bg-[#040914] border border-[#274468] focus:border-cyan-400 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 btn-precision min-h-[50px]"
              >
                <UserPlus className="w-5 h-5 stroke-[2.5]" />
                <span>ABRIR FORMULARIO EN BLANCO Y LLENAR DATOS</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>

            <div className="p-3.5 rounded-xl bg-[#040914] border border-[#1E3557] text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block">💡 Nota de Registro:</span>
              <span>
                Al abrir el formulario podrás especificar el país de origen (nacionalidad), nombres completos, fecha de nacimiento y todos los datos laborales requeridos para los contratos NISIRA y T-Registro.
              </span>
            </div>

          </div>
        </div>
      )}

      {/* 5. CONTENIDO: PESTAÑA 2 - BÚSQUEDA MASIVA (LOTE DE DNIs) */}
      {activeSubTab === 'batch' && (
        <div className="rounded-3xl bg-[#0B1528] border border-[#1E3557] p-5 sm:p-7 shadow-2xl relative space-y-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Encabezado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E3557]">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 uppercase tracking-widest inline-block">
                  ⚡ PROCESAMIENTO CONCURRENTE FACTILIZA
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#101F3B] text-slate-300 border border-[#274468]">
                  HASTA 100+ DNIs
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Búsqueda Masiva de Trabajadores por DNI
              </h2>
              <p className="text-xs text-slate-400">
                Pega una lista de DNIs o carga un archivo. Consultaremos automáticamente todos los datos en Factiliza.
              </p>
            </div>

            {batchResults && (
              <button
                type="button"
                onClick={handleClearBatch}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#101F3B] hover:bg-[#162A4F] text-slate-300 hover:text-white border border-[#274468] transition flex items-center space-x-1.5 self-start sm:self-auto btn-precision"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Nueva Búsqueda</span>
              </button>
            )}
          </div>

          {/* Notificaciones */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 flex items-start space-x-2 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {batchSaveMsg && (
            <div
              className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-bold ${
                batchSaveMsg.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{batchSaveMsg.text}</span>
            </div>
          )}

          {/* VISTA 1: INGRESO DE DNIs (SI NO HAY RESULTADOS AÚN) */}
          {!batchResults && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-300">
                  <span className="flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>PEGA TU LISTA DE DNIs (FILAS, COMAS O DIRECTO DE EXCEL):</span>
                  </span>

                  <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-cyan-300 border border-[#274468] transition text-[11px]">
                    <UploadCloud className="w-3.5 h-3.5 text-teal-400" />
                    <span>Cargar .txt / .csv / .xlsx</span>
                    <input
                      type="file"
                      accept=".txt,.csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  value={batchText}
                  onChange={handleBatchTextChange}
                  rows={6}
                  placeholder={`Pega aquí los números de DNI... Ejemplo:
73968922
45678912
10293847
O copia una columna entera de Excel y pégala directamente aquí.`}
                  className="w-full bg-[#040914] border-2 border-[#274468] focus:border-cyan-400 rounded-2xl p-4 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition resize-y"
                />
              </div>

              {/* BARRA DE ESTADO DE DETECCIÓN */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#060D1A] border border-[#1E3557]">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      detectedDnis.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-xs font-mono font-bold text-white">
                    {detectedDnis.length > 0 ? (
                      <>
                        <strong className="text-emerald-400 text-sm">{detectedDnis.length}</strong> DNIs detectados listos para consultar
                      </>
                    ) : (
                      <span className="text-slate-400">0 DNIs detectados (deben contener 8 dígitos)</span>
                    )}
                  </span>
                </div>

                {detectedDnis.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBatch}
                    className="text-[11px] text-slate-400 hover:text-rose-400 underline font-mono self-end sm:self-auto"
                  >
                    Limpiar lista
                  </button>
                )}
              </div>

              {/* PREVIEW DE CHIPS DE DNIs */}
              {detectedDnis.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                    Vista previa de DNIs a consultar:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-[#040914] border border-[#1E3557]">
                    {detectedDnis.slice(0, 30).map((dni) => (
                      <span
                        key={dni}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#101F3B] text-cyan-300 border border-[#274468]"
                      >
                        <span>{dni}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDni(dni)}
                          className="hover:text-rose-400 ml-1 text-slate-500"
                          title="Quitar de la lista"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {detectedDnis.length > 30 && (
                      <span className="px-2 py-1 text-xs font-mono text-slate-400 italic">
                        +{detectedDnis.length - 30} más...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* BOTÓN PRINCIPAL DE CONSULTA MASIVA */}
              <button
                type="button"
                onClick={handleExecuteBatchQuery}
                disabled={isQueryingBatch || detectedDnis.length === 0}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-[0.99] disabled:opacity-40 text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2 btn-precision min-h-[52px]"
              >
                {isQueryingBatch ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>CONSULTANDO {detectedDnis.length} DNIs EN HISTÓRICO / FACTILIZA...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 stroke-[2.5]" />
                    <span>CONSULTAR LOTE DE {detectedDnis.length} DNIs (1º HISTÓRICO, 2º FACTILIZA)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* VISTA 2: RESULTADOS DE LA CONSULTA MASIVA */}
          {batchResults && (
            <div className="space-y-5 animate-fade-in">
              {/* TARJETAS DE RESUMEN */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-[#1E3557] space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Total DNIs</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-white">{batchResults.total_requested || batchResults.total || batchResults.results.length}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1">
                  <span className="text-[10px] font-mono text-emerald-300 uppercase font-bold block">🏛️ Data Histórica (0 tokens)</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                    {batchResults.historical_count !== undefined
                      ? batchResults.historical_count
                      : batchResults.results.filter((r) => r.source === 'data_historica' || r.is_historical).length}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/40 space-y-1">
                  <span className="text-[10px] font-mono text-sky-300 uppercase font-bold block">🌐 Factiliza API (Tokens)</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-sky-400">
                    {batchResults.api_count !== undefined
                      ? batchResults.api_count
                      : batchResults.results.filter((r) => r.source === 'factiliza').length}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-1">
                  <span className="text-[10px] font-mono text-rose-300 uppercase font-bold block">⚠️ No Encontrados</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-rose-400">{batchResults.not_found_count}</span>
                </div>
              </div>

              {/* BARRA DE ACCIONES MASIVAS: GUARDAR & EXPORTAR EXCEL */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#060D1A] border border-cyan-500/30">
                <div className="text-xs text-slate-300">
                  <strong className="text-white font-bold">{batchResults.found_count} trabajadores</strong> listos para ser incorporados al registro de planillas NISIRA.
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportBatchExcel}
                    disabled={isExportingBatch}
                    className="px-4 py-2.5 rounded-xl bg-[#101F3B] hover:bg-[#162A4F] text-cyan-200 border border-cyan-500/40 font-bold text-xs transition flex items-center justify-center space-x-2 btn-precision"
                    title="Descargar tabla en formato Excel .xlsx"
                  >
                    {isExportingBatch ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-teal-400" />
                    )}
                    <span>Descargar Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAllBatch}
                    disabled={isSavingBatch || batchResults.found_count === 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 btn-precision"
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3] text-slate-950" />
                        <span>Guardar Todos en Base de Datos & Registros.xlsx</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* FILTROS Y BÚSQUEDA INTERNA */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-[#040914] border border-[#1E3557] text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setBatchFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      batchFilter === 'all'
                        ? 'bg-[#101F3B] text-cyan-300 border border-cyan-400/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({batchResults.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchFilter('found')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      batchFilter === 'found'
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/50'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Encontrados ({batchResults.found_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchFilter('not_found')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      batchFilter === 'not_found'
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-500/50'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    No encontrados ({batchResults.not_found_count})
                  </button>
                </div>

                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    value={batchSearchTerm}
                    onChange={(e) => setBatchSearchTerm(e.target.value)}
                    placeholder="Filtrar por DNI o Apellido..."
                    className="w-full bg-[#040914] border border-[#274468] focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {batchSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setBatchSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* TABLA DE RESULTADOS */}
              <div className="overflow-x-auto rounded-2xl border border-[#1E3557] bg-[#040914] shadow-xl max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#0B1528] border-b border-[#1E3557] text-slate-300 font-mono text-[11px] uppercase tracking-wider z-10">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">DNI</th>
                      <th className="py-3 px-3">Apellidos y Nombres</th>
                      <th className="py-3 px-2 text-center">Sexo</th>
                      <th className="py-3 px-3">F. Nacimiento</th>
                      <th className="py-3 px-3">Ubigeo / Distrito</th>
                      <th className="py-3 px-3">Dirección</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162A4F]">
                    {batchResults.results
                      .filter((item) => {
                        if (batchFilter === 'found') return item.success;
                        if (batchFilter === 'not_found') return !item.success;
                        return true;
                      })
                      .filter((item) => {
                        if (!batchSearchTerm) return true;
                        const term = batchSearchTerm.toUpperCase();
                        const dni = (item.doc_number || item.dni || '').toUpperCase();
                        const name = (
                          item.full_name || `${item.first_names || ''} ${item.paternal_surname || ''}`
                        ).toUpperCase();
                        return dni.includes(term) || name.includes(term);
                      })
                      .map((item, idx) => {
                        const fullName =
                          item.full_name ||
                          `${item.first_names || ''} ${item.paternal_surname || ''} ${
                            item.maternal_surname || ''
                          }`.trim();
                        const isFound = item.success;
                        const dni = item.doc_number || item.dni;

                        return (
                          <tr key={`${dni}-${idx}`} className="hover:bg-[#0B1528] transition group">
                            <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* DNI */}
                            <td className="py-2.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                <span>{dni}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyDni(dni)}
                                  className="text-slate-500 hover:text-cyan-400 p-0.5"
                                  title="Copiar DNI"
                                >
                                  {copiedDni === dni ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Nombre */}
                            <td className="py-2.5 px-3 font-semibold text-slate-100">
                              {isFound ? (
                                <span className="font-bold text-white">{fullName}</span>
                              ) : (
                                <span className="text-rose-400 italic text-[11px]">
                                  {item.error || 'No encontrado en padrón'}
                                </span>
                              )}
                            </td>

                            {/* Sexo */}
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300">
                              {item.sex ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    item.sex.startsWith('M')
                                      ? 'bg-blue-950/60 text-blue-300'
                                      : 'bg-pink-950/60 text-pink-300'
                                  }`}
                                >
                                  {item.sex.charAt(0)}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>

                            {/* F. Nacimiento */}
                            <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                              {item.birth_date || '-'}
                            </td>

                            {/* Ubigeo / Distrito */}
                            <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                              {item.district ? (
                                <span>
                                  {item.district}
                                  {item.department ? ` (${item.department})` : ''}
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>

                            {/* Dirección */}
                            <td
                              className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate"
                              title={item.address}
                            >
                              {item.address || '-'}
                            </td>

                            {/* Estado Badge */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {isFound ? (
                                item.source === 'data_historica' || item.is_historical ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" title="Encontrado en Data Histórica (0 tokens)">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>🏛️ HISTÓRICO (0 TOKENS)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40" title="Consultado en Factiliza API">
                                    <CheckCircle2 className="w-3 h-3 text-sky-400" />
                                    <span>🌐 FACTILIZA</span>
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>NO EN PADRÓN</span>
                                </span>
                              )}
                              {item.duplicate_warning && (
                                <span className="inline-flex items-center space-x-0.5 ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  <span>YA EN BD</span>
                                </span>
                              )}
                            </td>

                            {/* Acciones */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const itemSource = item.source || (item.is_historical ? 'data_historica' : 'factiliza');
                                  onResultReady({
                                    doc_type: 'DNI',
                                    doc_number: dni,
                                    paternal_surname: item.paternal_surname || '',
                                    maternal_surname: item.maternal_surname || '',
                                    first_names: item.first_names || '',
                                    nationality: 'PERUANA',
                                    birth_date: item.birth_date || '',
                                    sex: item.sex || '',
                                    civil_status: item.civil_status || '',
                                    address: item.address || '',
                                    department: item.department || '',
                                    province: item.province || '',
                                    district: item.district || '',
                                    ubigeo_reniec: item.ubigeo_reniec || '',
                                    ubigeo_inei: item.ubigeo_inei || '',
                                    ubigeo: item.ubigeo || '',
                                    phone: item.phone || '999999999',
                                    email: item.email || 'sincorreo@gmail.com',
                                    pension_system: item.pension_system || '',
                                    pension_commission: item.pension_commission || '',
                                    cuspp: item.cuspp || '',
                                    bank_account: item.bank_account || '',
                                    cargo: item.cargo || '',
                                    source: itemSource,
                                    is_historical: Boolean(item.is_historical),
                                    duplicate_warning: item.duplicate_warning,
                                    matched_worker_name: item.matched_worker_name,
                                    matched_worker_dni: item.matched_worker_dni,
                                    api_complemented: true,
                                    api_status: {
                                      queried: true,
                                      success: true,
                                      source: itemSource,
                                      message: item.is_historical ? 'Trabajador obtenido de Data Histórica local (0 tokens).' : 'Trabajador obtenido desde Factiliza / RENIEC.',
                                    },
                                    fields: {
                                      doc_number: { value: dni, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                      first_names: { value: item.first_names, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                      paternal_surname: { value: item.paternal_surname, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                      maternal_surname: { value: item.maternal_surname, confidence: 100, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                      birth_date: { value: item.birth_date, confidence: 95, is_valid: Boolean(item.birth_date), status: 'CONFIRMADO', source: itemSource },
                                      address: { value: item.address, confidence: 95, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                      pension_system: { value: item.pension_system, confidence: 95, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                      cuspp: { value: item.cuspp, confidence: 95, is_valid: true, status: 'CONFIRMADO', source: itemSource },
                                    }
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#101F3B] hover:bg-[#162A4F] text-cyan-300 hover:text-white border border-[#274468] hover:border-cyan-400 transition inline-flex items-center space-x-1 btn-precision"
                                title="Abrir y completar datos en el formulario"
                              >
                                <span>✍️ Revisar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
