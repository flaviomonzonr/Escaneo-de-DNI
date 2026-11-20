import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Clock,
  Search,
  CheckSquare,
  Square,
  Download,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  ArrowRight,
  Filter,
  Check,
  FileDown,
  Info,
  Cloud,
  HardDrive,
  Copy,
  Table,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Edit3,
  CalendarDays,
  DollarSign,
  Briefcase,
  HelpCircle,
  X,
  ShieldCheck,
  ArrowDown,
  Zap,
  Building,
  UserCheck,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import ContractOptionSelect from './ContractOptionSelect';
import {
  TIPOS_CONTRATO,
  CODIGOS_PLANILLA,
  SUGGESTED_BASICOS,
  getTipoContratoLabel,
  getCodPlanillaLabel,
  calculateContractEndDate,
  normalizeTipoContrato,
  normalizeCodPlanilla,
} from '../constants/contractCatalogs';
import {
  CODIGOS_CARGO,
  CODIGOS_TIPO_TRAB,
  CATEGORIAS_OCUPACIONALES,
  PERIODICIDADES_PAGO,
  REGIMENES_LABORALES,
  CODIGOS_AFP,
  TIPOS_COMISION,
  CODIGOS_SUCURSAL,
  GRUPOS_TRABAJO,
  TIPOS_PERSONAL_SUBPLANILLA,
  NIVELES_EDUCATIVOS,
  ESTADOS_CIVILES,
  CATALOGO_SEXO,
  NACIONALIDADES,
  DEFAULT_OBRERO_PLANTA,
  generateSuggestionsForWorker,
  getCargoLabel,
} from '../constants/nisiraCatalogs';

export default function ExcelGeneratorView({ onNavigateToScan, onNavigateToTemplates, reconnectTrigger }) {
  // Available dates from backend
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('all'); // 'all' or 'YYYY-MM-DD'
  const [customDate, setCustomDate] = useState('');

  // Time range filter
  const [timePreset, setTimePreset] = useState('all'); // 'morning' | 'afternoon' | 'all' | 'custom'
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Records list & selection
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Combined Templates (Supabase + Local)
  const [combinedTemplates, setCombinedTemplates] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // View Mode: 'table' (Matriz Contratos 11 Col) | 'personal' (Plantilla Datos Personal NISIRA) | 'cards' (Fichas)
  const [viewMode, setViewMode] = useState('table');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sugerencia interactiva de cargo
  const [cargoSuggestion, setCargoSuggestion] = useState(null);

  // Seguimiento del origen de fechas
  const [dateProvenance, setDateProvenance] = useState({});

  // Mensaje flotante de notificación rápida (Toast)
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (text) => {
    setToastMsg(text);
    setTimeout(() => {
      setToastMsg((prev) => (prev === text ? null : prev));
    }, 3500);
  };

  // =========================================================================
  // BARRAS DE DESPLAZAMIENTO HORIZONTAL CONTINUAS Y SINCRONIZADAS
  // (Para ambas tablas: Matriz Contratos y Plantilla Datos de Personal)
  // Sin botones: Barras gruesas de alta visibilidad y slider interactivo de izq a der
  // =========================================================================
  const contractTableScrollRef = useRef(null);
  const [contractScrollPercent, setContractScrollPercent] = useState(0);

  const personalTableScrollRef = useRef(null);
  const [personalScrollPercent, setPersonalScrollPercent] = useState(0);

  const isSyncingContract = useRef(false);
  const isSyncingPersonal = useRef(false);

  const syncContractScroll = (source, scrollLeft) => {
    if (isSyncingContract.current) return;
    isSyncingContract.current = true;

    if (source !== 'table' && contractTableScrollRef.current) {
      contractTableScrollRef.current.scrollLeft = scrollLeft;
    }

    if (contractTableScrollRef.current) {
      const max = contractTableScrollRef.current.scrollWidth - contractTableScrollRef.current.clientWidth;
      if (max > 0) {
        setContractScrollPercent(Math.min(100, Math.max(0, (scrollLeft / max) * 100)));
      }
    }

    requestAnimationFrame(() => {
      isSyncingContract.current = false;
    });
  };

  const handleContractTableScroll = () => {
    if (contractTableScrollRef.current) {
      syncContractScroll('table', contractTableScrollRef.current.scrollLeft);
    }
  };

  const handleContractSliderChange = (e) => {
    const pct = parseFloat(e.target.value);
    setContractScrollPercent(pct);
    if (contractTableScrollRef.current) {
      const max = contractTableScrollRef.current.scrollWidth - contractTableScrollRef.current.clientWidth;
      syncContractScroll('slider', (pct / 100) * max);
    }
  };

  const handleJumpContractScroll = (pct) => {
    setContractScrollPercent(pct);
    if (contractTableScrollRef.current) {
      const max = contractTableScrollRef.current.scrollWidth - contractTableScrollRef.current.clientWidth;
      syncContractScroll('jump', (pct / 100) * max);
    }
  };

  const syncPersonalScroll = (source, scrollLeft) => {
    if (isSyncingPersonal.current) return;
    isSyncingPersonal.current = true;

    if (source !== 'table' && personalTableScrollRef.current) {
      personalTableScrollRef.current.scrollLeft = scrollLeft;
    }

    if (personalTableScrollRef.current) {
      const max = personalTableScrollRef.current.scrollWidth - personalTableScrollRef.current.clientWidth;
      if (max > 0) {
        setPersonalScrollPercent(Math.min(100, Math.max(0, (scrollLeft / max) * 100)));
      }
    }

    requestAnimationFrame(() => {
      isSyncingPersonal.current = false;
    });
  };

  const handlePersonalTableScroll = () => {
    if (personalTableScrollRef.current) {
      syncPersonalScroll('table', personalTableScrollRef.current.scrollLeft);
    }
  };

  const handlePersonalSliderChange = (e) => {
    const pct = parseFloat(e.target.value);
    setPersonalScrollPercent(pct);
    if (personalTableScrollRef.current) {
      const max = personalTableScrollRef.current.scrollWidth - personalTableScrollRef.current.clientWidth;
      syncPersonalScroll('slider', (pct / 100) * max);
    }
  };

  const handleJumpPersonalScroll = (pct) => {
    setPersonalScrollPercent(pct);
    if (personalTableScrollRef.current) {
      const max = personalTableScrollRef.current.scrollWidth - personalTableScrollRef.current.clientWidth;
      syncPersonalScroll('jump', (pct / 100) * max);
    }
  };

  useEffect(() => {
    const updateScrollPercentages = () => {
      if (contractTableScrollRef.current) {
        const el = contractTableScrollRef.current;
        const max = el.scrollWidth - el.clientWidth;
        if (max > 0) {
          setContractScrollPercent(Math.min(100, Math.max(0, (el.scrollLeft / max) * 100)));
        } else {
          setContractScrollPercent(0);
        }
      }
      if (personalTableScrollRef.current) {
        const el = personalTableScrollRef.current;
        const max = el.scrollWidth - el.clientWidth;
        if (max > 0) {
          setPersonalScrollPercent(Math.min(100, Math.max(0, (el.scrollLeft / max) * 100)));
        } else {
          setPersonalScrollPercent(0);
        }
      }
    };
    updateScrollPercentages();
    const timer1 = setTimeout(updateScrollPercentages, 150);
    const timer2 = setTimeout(updateScrollPercentages, 600);
    window.addEventListener('resize', updateScrollPercentages);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateScrollPercentages);
    };
  }, [records, viewMode]);

  useEffect(() => {
    loadDates();
    loadAllTemplates();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [selectedDate, customDate, startTime, endTime, searchTerm]);

  // Auto-reload when connection recovers or reconnectTrigger changes
  useEffect(() => {
    if (reconnectTrigger !== undefined && reconnectTrigger > 0) {
      loadDates();
      loadAllTemplates();
      loadRecords();
    }
  }, [reconnectTrigger]);

  // Load available dates
  const loadDates = async () => {
    try {
      const data = await api.getScannedDates();
      const list = data.dates || [];
      setAvailableDates(list);
      if (list.length > 0 && selectedDate === 'all') {
        setSelectedDate(list[0].date);
      }
    } catch (err) {
      console.error('Error loading scan dates:', err);
    }
  };

  // Cargar plantillas rápidamente (Local prioritario y paralelo)
  const loadAllTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // Peticiones en paralelo con tolerancia a fallos
      const [localRes, supaRes] = await Promise.allSettled([
        api.getExcelTemplates(),
        api.supabase.getTemplates().catch(() => null),
      ]);

      const combined = [];

      // 1. Plantillas Locales (Instantáneas con caché backend)
      if (localRes.status === 'fulfilled' && localRes.value?.templates) {
        localRes.value.templates.forEach((t) => {
          combined.push({
            key: `local:${t.filename}`,
            source: 'local',
            id: t.filename,
            name: t.filename,
            filename: t.filename,
            version: 'Local',
            file_size_kb: t.file_size_kb || 0,
            template_type: 'EXCEL_CARGA_MASIVA',
            sheets: t.sheets || [],
            yellow_columns_count: t.sheets?.[0]?.yellow_columns_count || 0,
          });
        });
      }

      // 2. Plantillas Supabase Cloud
      if (supaRes.status === 'fulfilled' && supaRes.value?.templates) {
        supaRes.value.templates.forEach((t) => {
          combined.push({
            key: `supabase:${t.id}`,
            source: 'supabase',
            id: t.id,
            name: t.name || t.filename,
            filename: t.filename,
            version: t.version || '1.0',
            file_size_kb: t.file_size_kb || 0,
            template_type: t.template_type || 'EXCEL_CARGA_MASIVA',
            sheets: t.sheets_metadata || [],
            yellow_columns_count: t.sheets_metadata?.[0]?.yellow_columns_count || 0,
          });
        });
      }

      setCombinedTemplates(combined);

      // Selección inteligente por defecto
      if (combined.length > 0) {
        setSelectedTemplateKey((prevKey) => {
          if (prevKey && combined.some((t) => t.key === prevKey)) return prevKey;
          const contractTpl = combined.find((t) => (t.name || '').toUpperCase().includes('CONTRATO'));
          return contractTpl ? contractTpl.key : combined[0].key;
        });
      }
    } catch (err) {
      console.error('Error loading combined templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Cambio de plantilla con cambio de vista automático
  const handleSelectTemplateKey = (newKey) => {
    setSelectedTemplateKey(newKey);
    const tpl = combinedTemplates.find((t) => t.key === newKey);
    if (tpl) {
      const name = (tpl.name || tpl.filename || '').toUpperCase();
      if (name.includes('CONTRATO')) {
        setViewMode('table');
      } else if (name.includes('DATOS') || name.includes('PERSONAL') || name.includes('NISIRA') || tpl.yellow_columns_count > 15) {
        setViewMode('personal');
      }
    }
  };

  // Load records filtered by date and time
  const loadRecords = async () => {
    setLoadingRecords(true);
    setErrorMsg(null);
    try {
      const actualDate = selectedDate === 'custom' ? customDate : selectedDate;
      const params = {
        date: actualDate === 'all' ? '' : actualDate,
        start_time: startTime,
        end_time: endTime,
        search: searchTerm,
      };
      const res = await api.getRecordsByDateTime(params);
      const items = res.items || [];

      // Inicializar y normalizar campos de contrato y personal en cada fila
      const initialized = items.map((r) => {
        const defaultInicio = r.inicio_contrato || r.fec_ingreso || (r.scan_date ? r.scan_date.split('T')[0] : '');
        const defaultDuracion = r.duracion || '3';
        const defaultFin = r.fin_contrato || (defaultInicio ? calculateContractEndDate(defaultInicio, defaultDuracion) : '');
        const defaultFirma = r.fecha_firma_contrato || defaultInicio;

        return {
          ...r,
          // Datos de Contrato
          cod_planilla: normalizeCodPlanilla(r.cod_planilla || DEFAULT_OBRERO_PLANTA.cod_planilla || 'ORP'),
          nro_contrato: r.nro_contrato || '',
          basico: r.basico !== undefined && r.basico !== null ? r.basico : 51.82,
          inicio_contrato: defaultInicio,
          duracion: defaultDuracion,
          fin_contrato: defaultFin,
          fecha_firma_contrato: defaultFirma,
          tipo_contrato: normalizeTipoContrato(r.tipo_contrato || '05'),
          nro_contrato_ref: r.nro_contrato_ref || '',

          // Datos de Personal NISIRA (77 columnas oficiales)
          cod_cargo: r.cod_cargo || DEFAULT_OBRERO_PLANTA.cod_cargo || '048',
          cat_ocupacional: r.cat_ocupacional || DEFAULT_OBRERO_PLANTA.cat_ocupacional || '02',
          cod_tipo_trab: r.cod_tipo_trab || DEFAULT_OBRERO_PLANTA.cod_tipo_trab || '76',
          period_pago: r.period_pago || r.idperiodicidad || DEFAULT_OBRERO_PLANTA.period_pago || '3',
          idperiodicidad: r.idperiodicidad || r.period_pago || DEFAULT_OBRERO_PLANTA.period_pago || '3',
          reg_laboral: r.reg_laboral || r.idregimenlaboral || DEFAULT_OBRERO_PLANTA.reg_laboral || '26',
          idregimenlaboral: r.idregimenlaboral || r.reg_laboral || DEFAULT_OBRERO_PLANTA.reg_laboral || '26',
          fec_ingreso: r.fec_ingreso || defaultInicio,
          cod_sucursal: r.cod_sucursal || r.idsucursal || DEFAULT_OBRERO_PLANTA.cod_sucursal || 'CA3',
          idsucursal: r.idsucursal || r.cod_sucursal || DEFAULT_OBRERO_PLANTA.cod_sucursal || 'CA3',
          grupo_trabajo: r.grupo_trabajo || r.idgrupotrabajo || DEFAULT_OBRERO_PLANTA.grupo_trabajo || '013',
          idgrupotrabajo: r.idgrupotrabajo || r.grupo_trabajo || DEFAULT_OBRERO_PLANTA.grupo_trabajo || '013',
          tipo_personal: r.tipo_personal || r.idtipopersonal || DEFAULT_OBRERO_PLANTA.tipo_personal || '05',
          idtipopersonal: r.idtipopersonal || r.tipo_personal || DEFAULT_OBRERO_PLANTA.tipo_personal || '05',
          idafp: r.idafp || '',
          cuspp: r.cuspp || '',
          tipo_comision: r.tipo_comision !== undefined && r.tipo_comision !== null ? String(r.tipo_comision) : '0',
          niv_educativo: r.niv_educativo || r.idnivelestudio || DEFAULT_OBRERO_PLANTA.niv_educativo || '007',
          idnivelestudio: r.idnivelestudio || r.niv_educativo || DEFAULT_OBRERO_PLANTA.niv_educativo || '007',
          asignacion_familiar: r.asignacion_familiar || DEFAULT_OBRERO_PLANTA.asignacion_familiar || 'NO',
          estado_civil: r.estado_civil || 'SO',
          sexo: r.sexo || 'M',
          nationality: r.nationality || 'PER',
          phone_number: r.phone_number || '',
          address: r.address || '',
        };
      });

      setRecords(initialized);

      // Auto-seleccionar todos los filtrados por defecto
      const allIds = new Set(initialized.map((r) => r.id));
      setSelectedIds(allIds);
    } catch (err) {
      console.error('Error loading filtered records:', err);
      setErrorMsg('No se pudo conectar con el servidor Backend (Python). Tus escaneos están 100% seguros y guardados en el equipo.');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Quick Time Preset Handlers
  const handleTimePreset = (preset) => {
    setTimePreset(preset);
    if (preset === 'morning') {
      setStartTime('08:00');
      setEndTime('12:00');
    } else if (preset === 'afternoon') {
      setStartTime('12:00');
      setEndTime('17:00');
    } else if (preset === 'all') {
      setStartTime('');
      setEndTime('');
    }
  };

  // Toggle single item selection
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  // Selected Template Object
  const selectedTemplateObj = combinedTemplates.find((t) => t.key === selectedTemplateKey);

  // =========================================================================
  // EDICIÓN INDIVIDUAL POR CELDA CON REGLAS Y RECALCULO AUTOMÁTICO
  // =========================================================================
  const handleRowChange = (recId, field, value) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== recId) return r;

        const updated = { ...r, [field]: value };

        // Si cambia inicio_contrato o duración, recalcular fin_contrato automáticamente
        if (field === 'inicio_contrato' || field === 'duracion') {
          const start = field === 'inicio_contrato' ? value : r.inicio_contrato;
          const dur = field === 'duracion' ? value : r.duracion;
          if (start && dur) {
            const calculatedEnd = calculateContractEndDate(start, dur);
            if (calculatedEnd) {
              updated.fin_contrato = calculatedEnd;
              setDateProvenance((p) => ({
                ...p,
                [`${recId}_fin_contrato`]: 'calculated',
              }));
            }
          }
        }

        // Marcar procedencia de fecha editada
        if (['inicio_contrato', 'fin_contrato', 'fecha_firma_contrato', 'fec_ingreso'].includes(field)) {
          setDateProvenance((p) => ({
            ...p,
            [`${recId}_${field}`]: 'edited',
          }));
        }

        // Sincronizar campos equivalentes
        if (field === 'period_pago') updated.idperiodicidad = value;
        if (field === 'idperiodicidad') updated.period_pago = value;
        if (field === 'reg_laboral') updated.idregimenlaboral = value;
        if (field === 'idregimenlaboral') updated.reg_laboral = value;
        if (field === 'cod_sucursal') updated.idsucursal = value;
        if (field === 'idsucursal') updated.cod_sucursal = value;
        if (field === 'grupo_trabajo') updated.idgrupotrabajo = value;
        if (field === 'idgrupotrabajo') updated.grupo_trabajo = value;
        if (field === 'tipo_personal') updated.idtipopersonal = value;
        if (field === 'idtipopersonal') updated.tipo_personal = value;
        if (field === 'niv_educativo') updated.idnivelestudio = value;
        if (field === 'idnivelestudio') updated.niv_educativo = value;

        // Limpiar CUSPP si selecciona ONP (idafp vacío)
        if (field === 'idafp' && !value) {
          updated.cuspp = '';
        }

        // Detectar cambio de Cargo para Sugerencias Inteligentes
        if (field === 'cod_cargo') {
          const sug = generateSuggestionsForWorker(value, r);
          if (sug.hasSuggestions && sug.diffFields && sug.diffFields.length > 0) {
            const wName = `${r.paternal_surname || ''} ${r.first_names || ''}`.trim() || `DNI ${r.doc_number}`;
            setCargoSuggestion({
              recId,
              workerName: wName,
              cargoName: getCargoLabel(value),
              categoryName: sug.categoryName,
              suggestions: sug.suggestions,
              diffFields: sug.diffFields,
            });
          }
        }

        return updated;
      })
    );
  };

  // Aplicar sugerencias recomendadas de cargo
  const handleApplyCargoSuggestions = () => {
    if (!cargoSuggestion) return;
    const { recId, suggestions } = cargoSuggestion;
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== recId) return r;
        return {
          ...r,
          ...suggestions,
          idperiodicidad: suggestions.period_pago || r.idperiodicidad,
          idregimenlaboral: suggestions.reg_laboral || r.idregimenlaboral,
          idtipopersonal: suggestions.tipo_personal || r.idtipopersonal,
        };
      })
    );
    showToast(`💡 Se aplicaron los ajustes recomendados para ${cargoSuggestion.workerName}`);
    setCargoSuggestion(null);
  };

  const handleDismissCargoSuggestions = () => {
    setCargoSuggestion(null);
  };

  // =========================================================================
  // REPLICACIÓN DESDE LA FILA 1 (RÁPIDA Y PRECISA)
  // =========================================================================

  /**
   * Replicar un campo específico de la Fila 1 a todas las filas seleccionadas
   */
  const handleCopyFieldFromRow1 = async (fieldName, fieldLabel = '') => {
    if (records.length === 0) {
      alert('No hay filas en la tabla para replicar.');
      return;
    }

    const row1 = records[0];
    const value = row1[fieldName];

    const targetIds = selectedIds.size > 0 
      ? Array.from(selectedIds) 
      : records.map((r) => r.id);

    if (targetIds.length === 0) return;

    // Preparar actualizaciones
    const updates = { [fieldName]: value };

    // Si se replica inicio_contrato o duración, recalcular fin_contrato
    if (fieldName === 'inicio_contrato' || fieldName === 'duracion') {
      const s = fieldName === 'inicio_contrato' ? value : row1.inicio_contrato;
      const d = fieldName === 'duracion' ? value : row1.duracion;
      if (s && d) {
        const calcEnd = calculateContractEndDate(s, d);
        if (calcEnd) updates.fin_contrato = calcEnd;
      }
    }

    // 1. Actualizar estado reactivo local en la tabla
    setRecords((prev) =>
      prev.map((r) => {
        if (!targetIds.includes(r.id)) return r;
        const updated = { ...r, [fieldName]: value };
        if (updates.fin_contrato) {
          updated.fin_contrato = updates.fin_contrato;
        }
        return updated;
      })
    );

    // 2. Persistir en base de datos SQLite backend
    try {
      await api.batchUpdateContracts(targetIds, updates);
      showToast(`✅ ${fieldLabel || fieldName} copiado de la Fila 1 a ${targetIds.length} filas`);
    } catch (err) {
      console.error('Error guardando replicación de campo:', err);
      showToast(`⚠️ Actualizado en pantalla`);
    }
  };

  /**
   * Replicar TODOS los campos relevantes de la Fila 1 a todas las filas seleccionadas
   */
  const handleCopyFullRow1ToAll = async () => {
    if (records.length === 0) {
      alert('No hay contratos en la tabla para replicar.');
      return;
    }

    const row1 = records[0];
    const targetIds = selectedIds.size > 0 
      ? Array.from(selectedIds) 
      : records.map((r) => r.id);

    if (targetIds.length === 0) return;

    let fullBundle = {};
    if (viewMode === 'personal') {
      // Replicar paquete completo de datos de personal NISIRA
      fullBundle = {
        cod_cargo: row1.cod_cargo || '048',
        cod_planilla: row1.cod_planilla || 'ORP',
        cat_ocupacional: row1.cat_ocupacional || '02',
        cod_tipo_trab: row1.cod_tipo_trab || '76',
        period_pago: row1.period_pago || '3',
        idperiodicidad: row1.idperiodicidad || '3',
        reg_laboral: row1.reg_laboral || '26',
        idregimenlaboral: row1.idregimenlaboral || '26',
        basico: row1.basico !== undefined ? row1.basico : 51.82,
        fec_ingreso: row1.fec_ingreso || row1.inicio_contrato || '',
        idafp: row1.idafp || '',
        cuspp: row1.cuspp || '',
        tipo_comision: row1.tipo_comision || '0',
        cod_sucursal: row1.cod_sucursal || 'CA3',
        idsucursal: row1.idsucursal || 'CA3',
        grupo_trabajo: row1.grupo_trabajo || '013',
        idgrupotrabajo: row1.idgrupotrabajo || '013',
        tipo_personal: row1.tipo_personal || '05',
        idtipopersonal: row1.idtipopersonal || '05',
        niv_educativo: row1.niv_educativo || '007',
        idnivelestudio: row1.idnivelestudio || '007',
        estado_civil: row1.estado_civil || 'SO',
        sexo: row1.sexo || 'M',
        nationality: row1.nationality || 'PER',
      };
    } else {
      // Replicar paquete completo de datos de contratos
      fullBundle = {
        cod_planilla: row1.cod_planilla || 'ORP',
        nro_contrato: row1.nro_contrato || '',
        basico: row1.basico !== undefined ? row1.basico : 51.82,
        inicio_contrato: row1.inicio_contrato || '',
        duracion: row1.duracion || '3',
        fin_contrato: row1.fin_contrato || '',
        fecha_firma_contrato: row1.fecha_firma_contrato || '',
        tipo_contrato: row1.tipo_contrato || '05',
        nro_contrato_ref: row1.nro_contrato_ref || '',
      };
    }

    // 1. Actualizar estado reactivo local
    setRecords((prev) =>
      prev.map((r) => {
        if (!targetIds.includes(r.id)) return r;
        return { ...r, ...fullBundle };
      })
    );

    // 2. Persistir en SQLite backend
    try {
      await api.batchUpdateContracts(targetIds, fullBundle);
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#F59E0B', '#10B981', '#3B82F6', '#ffffff'],
      });
      showToast(`⚡ ¡Toda la Fila 1 fue replicada en ${targetIds.length} filas seleccionadas!`);
    } catch (err) {
      console.error('Error guardando replicación total:', err);
      showToast(`⚠️ Actualizado en pantalla`);
    }
  };

  /**
   * Aplicar monto de Básico sugerido con 1 solo clic (Jornal o Mensual)
   */
  const handleApplySuggestedBasico = async (amount) => {
    const targetIds = selectedIds.size > 0 
      ? Array.from(selectedIds) 
      : records.map((r) => r.id);

    if (targetIds.length === 0) {
      alert('No hay filas seleccionadas para aplicar el básico.');
      return;
    }

    // 1. Actualizar estado local
    setRecords((prev) =>
      prev.map((r) => {
        if (!targetIds.includes(r.id)) return r;
        return { ...r, basico: amount };
      })
    );

    // 2. Guardar en SQLite
    try {
      await api.batchUpdateContracts(targetIds, { basico: amount });
      showToast(`💰 Básico S/. ${amount} aplicado a ${targetIds.length} filas`);
    } catch (err) {
      console.error('Error guardando básico sugerido:', err);
      showToast(`⚠️ Básico actualizado en pantalla`);
    }
  };

  // =========================================================================
  // GENERACIÓN Y DESCARGA DEL EXCEL LLENADO
  // =========================================================================
  const handleGenerateExcel = async () => {
    if (!selectedTemplateObj) {
      alert('Por favor seleccione una plantilla Excel.');
      return;
    }

    if (selectedIds.size === 0) {
      alert('Por favor seleccione al menos un trabajador escaneado.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setGenerateSuccess(null);

    try {
      // Tomamos los registros seleccionados con los valores actuales editados en tabla
      const orderedSelectedRecords = records.filter((r) => selectedIds.has(r.id));
      const orderedRecordIds = orderedSelectedRecords.map((r) => r.id);

      let res;
      if (selectedTemplateObj.source === 'supabase') {
        res = await api.supabase.generateBatchExcel(
          selectedTemplateObj.id,
          orderedRecordIds,
          orderedSelectedRecords
        );
      } else {
        res = await api.generateBatchExcel(
          selectedTemplateObj.filename,
          orderedRecordIds,
          orderedSelectedRecords
        );
      }

      setGenerateSuccess(res);

      // Celebración con confeti
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#3B82F6', '#ffffff'],
      });

      // Descarga automática en navegador
      if (res.filename) {
        const downloadUrl = api.getExportDownloadUrl(res.filename);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', res.filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error('Error generating batch excel:', err);
      setErrorMsg(err.response?.data?.detail || 'Error al generar el archivo Excel.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in font-sans text-slate-100 pb-16">
      {/* Toast Flotante de Notificación Rápida */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-cyan-500/80 text-cyan-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-cyan-300" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Banner de Éxito al Generar Excel */}
      {generateSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-scale-in">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-200">¡Excel Generado y Descargado con Éxito!</h4>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                Archivo: <span className="font-mono font-bold text-teal-200">{generateSuccess.filename}</span> ({generateSuccess.total_workers} filas procesadas)
              </p>
              <p className="text-[11px] text-slate-300 mt-1">
                Todas las celdas amarillas fueron completadas respetando los formatos, ceros a la izquierda y códigos oficiales de NISIRA.
              </p>
            </div>
          </div>

          <a
            href={api.getExportDownloadUrl(generateSuccess.filename)}
            download={generateSuccess.filename}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow flex items-center space-x-2 transition transform active:scale-95"
          >
            <FileDown className="w-4 h-4" />
            <span>Volver a Descargar</span>
          </a>
        </div>
      )}

      {/* Banner de Error */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-200 text-xs sm:text-sm animate-fade-in shadow-md">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => {
              loadRecords();
              loadAllTemplates();
            }}
            className="px-3 py-1 rounded bg-red-800 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1.5 transition self-end sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Modal/Banner de Sugerencia Automática de Cargo NISIRA */}
      {cargoSuggestion && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#0A3D44]/90 via-[#0B1528] to-[#060D1A] border-2 border-teal-500 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#0A3D44] border border-cyan-400 text-teal-200 flex-shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300 bg-teal-500/15 px-2 py-0.5 rounded border border-teal-500/30">
                  {cargoSuggestion.categoryName}
                </span>
                <span className="text-xs text-slate-300">para <b>{cargoSuggestion.workerName}</b></span>
              </div>
              <p className="text-xs text-white font-semibold mt-1">
                El cargo asignado es <b>{cargoSuggestion.cargoName}</b>. ¿Deseas aplicar la configuración estándar de NISIRA?
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-[11px] font-mono">
                {cargoSuggestion.suggestions.cod_planilla && (
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-700 text-teal-200">
                    Planilla: <b>{cargoSuggestion.suggestions.cod_planilla}</b>
                  </span>
                )}
                {cargoSuggestion.suggestions.cod_tipo_trab && (
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-700 text-cyan-300">
                    Tipo Trab.: <b>{cargoSuggestion.suggestions.cod_tipo_trab}</b>
                  </span>
                )}
                {cargoSuggestion.suggestions.cat_ocupacional && (
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-700 text-emerald-300">
                    Cat. Ocup.: <b>{cargoSuggestion.suggestions.cat_ocupacional}</b>
                  </span>
                )}
                {cargoSuggestion.suggestions.period_pago && (
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-700 text-purple-300">
                    Period.: <b>{cargoSuggestion.suggestions.period_pago === '1' ? 'MENSUAL' : 'SEMANAL'}</b>
                  </span>
                )}
                {cargoSuggestion.suggestions.reg_laboral && (
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-700 text-blue-300">
                    Régimen: <b>{cargoSuggestion.suggestions.reg_laboral}</b>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
            <button
              type="button"
              onClick={handleDismissCargoSuggestions}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Mantener Actuales
            </button>
            <button
              type="button"
              onClick={handleApplyCargoSuggestions}
              className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black shadow-lg transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Recomendados</span>
            </button>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR UNIFICADA DE CONTROL Y GENERACIÓN */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-xl space-y-3">
        {/* Fila 1: Selector de Plantilla + Botón de Acción Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
              <span>Plantilla Excel:</span>
            </span>

            {loadingTemplates ? (
              <span className="text-xs text-slate-400 animate-pulse">Cargando plantillas...</span>
            ) : combinedTemplates.length === 0 ? (
              <span className="text-xs text-cyan-400 font-bold">No hay plantillas registradas.</span>
            ) : (
              <select
                value={selectedTemplateKey}
                onChange={(e) => handleSelectTemplateKey(e.target.value)}
                className="flex-1 max-w-md px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 truncate"
              >
                {combinedTemplates.map((tpl) => (
                  <option key={tpl.key} value={tpl.key}>
                    {tpl.source === 'supabase' ? '☁️ [Nube] ' : '📁 [Local] '}
                    {tpl.name} {tpl.version ? `(v${tpl.version})` : ''} — {tpl.file_size_kb} KB
                  </option>
                ))}
              </select>
            )}

            {selectedTemplateObj && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-teal-200 bg-teal-500/15 border border-teal-500/30">
                <span>🔷 {selectedTemplateObj.yellow_columns_count} celdas NISIRA</span>
              </span>
            )}
          </div>

          {/* Botón Principal Generar Excel */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={handleGenerateExcel}
              disabled={isGenerating || selectedIds.size === 0 || !selectedTemplateObj}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold text-white shadow-lg flex items-center justify-center gap-2 transition transform active:scale-95 ${
                isGenerating || selectedIds.size === 0 || !selectedTemplateObj
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black shadow-cyan-500/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Generando Excel...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Generar Excel ({selectedIds.size} Filas) ➔</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Fila 2: Filtros de Fecha, Hora, Búsqueda y Selector de Modos de Vista */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800 text-xs">
          {/* Selector de Fecha */}
          <div className="flex items-center gap-1.5 min-w-[170px]">
            <Calendar className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (e.target.value !== 'custom') setCustomDate('');
              }}
              className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value="all">📅 Todas las fechas</option>
              {availableDates.map((d) => (
                <option key={d.date} value={d.date}>
                  📅 {d.formatted} ({d.count})
                </option>
              ))}
              <option value="custom">📅 Personalizada...</option>
            </select>
          </div>

          {selectedDate === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          )}

          {/* Preset de Hora */}
          <div className="flex items-center gap-1.5 min-w-[140px]">
            <Clock className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
            <select
              value={timePreset}
              onChange={(e) => handleTimePreset(e.target.value)}
              className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value="all">⏰ Todo el día</option>
              <option value="morning">🌅 Mañana (08:00 - 12:00)</option>
              <option value="afternoon">🌇 Tarde (12:00 - 17:00)</option>
              <option value="custom">⚙️ Rango personalizado</option>
            </select>
          </div>

          {/* Campo de Búsqueda */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por DNI, Nombres, Apellidos..."
              className="w-full pl-8 pr-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Toggle de Modos de Vista */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700 gap-1">
            <button
              type="button"
              onClick={() => {
                setViewMode('table');
                const contractTpl = combinedTemplates.find((t) => (t.name || t.filename || '').toUpperCase().includes('CONTRATO'));
                if (contractTpl && selectedTemplateKey !== contractTpl.key) {
                  setSelectedTemplateKey(contractTpl.key);
                }
              }}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'table'
                  ? 'bg-teal-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Ver Matriz de Contratos (11 Columnas Oficiales NISIRA)"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Matriz Contratos (11 Col)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('personal');
                const personalTpl = combinedTemplates.find((t) => {
                  const n = (t.name || t.filename || '').toUpperCase();
                  return (n.includes('DATOS') || n.includes('PERSONAL') || n.includes('NISIRA')) && !n.includes('CONTRATO');
                });
                if (personalTpl && selectedTemplateKey !== personalTpl.key) {
                  setSelectedTemplateKey(personalTpl.key);
                }
              }}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'personal'
                  ? 'bg-teal-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Ver Plantilla Oficial de Datos de Personal NISIRA (77 Columnas)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Plantilla Datos de Personal</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'cards'
                  ? 'bg-teal-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Ver Fichas individuales de personal"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Fichas</span>
            </button>
          </div>

          {/* Botón Actualizar */}
          <button
            onClick={() => {
              loadDates();
              loadAllTemplates();
              loadRecords();
            }}
            className="py-1 px-3 rounded bg-slate-800 hover:bg-slate-700 text-teal-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Refrescar lista de escaneos y plantillas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin text-cyan-300' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          BARRA RÁPIDA: BÁSICOS SUGERIDOS (1-CLIC) Y REPLICACIÓN MAESTRA DE FILA 1
          (El panel masivo pesado fue eliminado para una experiencia 100% ágil)
          ========================================================================= */}
      <div className="p-3 bg-slate-900 border border-teal-500/40 rounded-xl shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 mr-1 flex-shrink-0">
            <DollarSign className="w-4 h-4 text-cyan-300" />
            <span className="tracking-wide uppercase">Básicos Sugeridos:</span>
          </div>

          {/* Grupo Jornal Agrario Diario */}
          <div className="flex items-center gap-1 bg-[#0A3D44]/60 border border-teal-500/40 px-2.5 py-1 rounded-lg">
            <span className="text-[10px] font-extrabold text-teal-200 uppercase tracking-wider mr-1">
              🌾 Jornal Diario:
            </span>
            {[51.82, 53.08, 55.88].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleApplySuggestedBasico(amt)}
                className="px-2 py-0.5 rounded bg-[#0A3D44] hover:bg-teal-400 hover:text-slate-950 text-cyan-200 font-mono font-black text-xs border border-teal-500/50 transition transform active:scale-95 shadow-sm"
                title={`Aplicar S/. ${amt} (Jornal Agrario) a todas las filas seleccionadas`}
              >
                S/. {amt}
              </button>
            ))}
          </div>

          {/* Grupo Sueldos Mensuales */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider mr-1">
              💼 Mensual:
            </span>
            {[1800, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleApplySuggestedBasico(amt)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-400 hover:text-slate-950 text-slate-200 font-mono font-bold text-xs border border-slate-700 transition transform active:scale-95 shadow-sm"
                title={`Aplicar S/. ${amt.toLocaleString()} mensual a todas las filas seleccionadas`}
              >
                {amt >= 1000 ? `${amt / 1000}k` : amt}
              </button>
            ))}
          </div>
        </div>

        {/* Botón Maestro Replicar Toda la Fila 1 */}
        <button
          type="button"
          onClick={handleCopyFullRow1ToAll}
          disabled={records.length === 0}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-2 transition transform active:scale-95 flex-shrink-0"
          title={
            viewMode === 'personal'
              ? 'Copia Cargo, Planilla, Cat. Ocupacional, Tipo Trab., Básico, AFP y sucursal de Fila 1 a las seleccionadas'
              : 'Copia Cod. Planilla, Básico, Fechas, Duración y Tipo de Contrato de Fila 1 a las seleccionadas'
          }
        >
          <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
          <span>⚡ Copiar Toda la Fila 1 a Filas Seleccionadas ({selectedIds.size})</span>
        </button>
      </div>

      {/* =========================================================================
          VISTA 1: TABLA MATRIZ DE CONTRATOS NISIRA (11 COLUMNAS OFICIALES)
          ========================================================================= */}
      {viewMode === 'table' ? (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative">
          {/* Barra de cabecera de la tabla con controles de scroll horizontal */}
          <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={records.length === 0}
                className="flex items-center gap-2 font-bold text-teal-200 hover:text-cyan-200 transition"
              >
                {selectedIds.size > 0 && selectedIds.size === records.length ? (
                  <CheckSquare className="w-4 h-4 text-cyan-300" />
                ) : selectedIds.size > 0 ? (
                  <div className="w-4 h-4 rounded border border-cyan-400 bg-[#0A3D44] flex items-center justify-center text-teal-200 text-[10px] font-bold">
                    -
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  {selectedIds.size === records.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </span>
              </button>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300">
                {selectedIds.size} de {records.length} contratos seleccionados
              </span>
            </div>

            {/* BARRA SUPERIOR DE NAVEGACIÓN HORIZONTAL INTUITIVA (DESLIZADOR + SALTOS RÁPIDOS) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Posición: <strong className="text-cyan-300 font-bold">{Math.round(contractScrollPercent)}%</strong></span>
              </span>

              <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/20 text-teal-200 border border-teal-400/40 font-bold">
                  🔷 Celdas Mapeadas
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  🟢 Identidad
                </span>
              </div>
            </div>
          </div>

          {/* BARRA DE DESPLAZAMIENTO HORIZONTAL SUPERIOR GRUESA Y FÁCIL DE AGARRAR (ENCIMA DE LA TABLA) */}
          <div
            className="px-4 py-3 border-b flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-md select-none"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 shadow-xs">
                <ArrowLeftRight className="w-4 h-4 animate-pulse" />
              </span>
              <span className="text-xs font-bold font-mono">
                Desplazar Columnas: <strong className="text-cyan-400 font-extrabold text-sm">{Math.round(contractScrollPercent)}%</strong>
              </span>
            </div>

            <div className="flex-1 w-full flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleJumpContractScroll(0)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  contractScrollPercent <= 10
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Columna 1 (DNI / Nombres)"
              >
                ◀ Inicio (Col 1)
              </button>

              <button
                type="button"
                onClick={() => handleJumpContractScroll(35)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden sm:inline ${
                  contractScrollPercent > 10 && contractScrollPercent <= 50
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Básico y Planilla"
              >
                Básico (Col 5)
              </button>

              {/* TRACK Y CONTROL DESLIZANTE GRUESO */}
              <div className="relative flex-1 flex items-center min-w-[140px]">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.2"
                  value={contractScrollPercent}
                  onChange={handleContractSliderChange}
                  className="custom-range-slider w-full touch-pan-x"
                  title="Arrastra el control deslizante hacia la izquierda o derecha para mover las columnas"
                />
              </div>

              <button
                type="button"
                onClick={() => handleJumpContractScroll(70)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden sm:inline ${
                  contractScrollPercent > 50 && contractScrollPercent < 90
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Fechas de Contrato"
              >
                Fechas (Col 8)
              </button>

              <button
                type="button"
                onClick={() => handleJumpContractScroll(100)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  contractScrollPercent >= 90
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a la última columna (Tipo de Contrato y Ref)"
              >
                Final (Col 11) ▶
              </button>
            </div>
          </div>

          {/* Tabla de 11 Columnas con scroll horizontal responsive */}
          <div
            ref={contractTableScrollRef}
            onScroll={handleContractTableScroll}
            className="overflow-x-auto max-h-[calc(100vh-280px)] min-h-[400px] custom-table-scrollbar"
          >
            <table className="min-w-[1850px] w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-20 shadow-md">
                <tr className="divide-x divide-slate-700 text-[11px] font-extrabold uppercase">
                  {/* Selector checkbox */}
                  <th className="p-2 w-10 text-center bg-slate-800 text-slate-300 border-b-2 border-slate-600">#</th>

                  {/* 1. Nro. Documento (Verde) */}
                  <th className="p-2 min-w-[120px] bg-slate-800/95 text-cyan-200 border-b-2 border-cyan-400">
                    Nro. Documento
                  </th>

                  {/* 2. Apellidos y Nombres (Verde) */}
                  <th className="p-2 min-w-[240px] bg-slate-800/95 text-cyan-200 border-b-2 border-cyan-400">
                    Apellidos y Nombres
                  </th>

                  {/* 3. Cod. Planilla (Amarillo) */}
                  <th className="p-1.5 min-w-[140px] bg-teal-950/80 text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Cod. Planilla</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cod_planilla', 'Cod. Planilla')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Cod. Planilla de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 4. Nro. Contrato (Verde) */}
                  <th className="p-1.5 min-w-[130px] bg-slate-800/95 text-cyan-200 border-b-2 border-cyan-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>Nro. Contrato</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('nro_contrato', 'Nro. Contrato')}
                          className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Nro. Contrato de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 5. Básico (Amarillo) */}
                  <th className="p-1.5 min-w-[130px] bg-teal-950/80 text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Básico</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('basico', 'Básico')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Básico de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 6. Inicio Contrato (Amarillo) */}
                  <th className="p-1.5 min-w-[140px] bg-teal-950/80 text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Inicio Contrato</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('inicio_contrato', 'Inicio Contrato')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Inicio Contrato de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 7. Duración (Verde) */}
                  <th className="p-1.5 min-w-[100px] bg-slate-800/95 text-cyan-200 border-b-2 border-cyan-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>Duración</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('duracion', 'Duración')}
                          className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Duración de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 8. Fin Contrato (Amarillo) */}
                  <th className="p-1.5 min-w-[140px] bg-teal-950/80 text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Fin Contrato</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('fin_contrato', 'Fin Contrato')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Fin Contrato de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 9. F. Firma Contrato (Amarillo) */}
                  <th className="p-1.5 min-w-[140px] bg-teal-950/80 text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 F. Firma Contrato</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('fecha_firma_contrato', 'F. Firma Contrato')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar F. Firma Contrato de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 10. Tipo de Contrato (Amarillo) */}
                  <th className="p-1.5 min-w-[240px] bg-teal-950/80 text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Tipo de Contrato</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('tipo_contrato', 'Tipo de Contrato')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Tipo de Contrato de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 11. Nro. Contrato Ref (Verde) */}
                  <th className="p-1.5 min-w-[140px] bg-slate-800/95 text-cyan-200 border-b-2 border-cyan-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>Nro. Contrato Ref</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('nro_contrato_ref', 'Nro. Contrato Ref')}
                          className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Nro. Contrato Ref de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* Celda buffer para pantallas pequeñas y amplio recorrido sin corte */}
                  <th
                    className="p-2 w-32 min-w-[128px] text-center border-b-2 font-mono text-[9px]"
                    style={{ backgroundColor: 'var(--table-header-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
                  >
                    ✔ FIN
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {loadingRecords ? (
                  <tr>
                    <td colSpan="12" className="p-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-300 mb-2" />
                      <span>Cargando registros de contratos...</span>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="p-12 text-center text-slate-400 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="font-bold text-white">No hay escaneos con los filtros aplicados</p>
                      <p className="text-xs text-slate-500">Ajuste la fecha u hora en la barra superior.</p>
                    </td>
                  </tr>
                ) : (
                  records.map((rec, index) => {
                    const isSelected = selectedIds.has(rec.id);
                    const fullName = `${rec.paternal_surname || ''} ${rec.maternal_surname || ''} ${rec.first_names || ''}`.trim() || 'Sin Nombre';

                    return (
                      <tr
                        key={rec.id}
                        className={`divide-x divide-slate-700/80 transition ${
                          isSelected
                            ? 'bg-cyan-950/50 border-l-4 border-l-cyan-400'
                            : index % 2 === 0
                            ? 'bg-slate-900/95 hover:bg-slate-800/90'
                            : 'bg-[#152033] hover:bg-slate-800/90'
                        }`}
                      >
                        {/* Selector checkbox */}
                        <td className="p-2 text-center bg-slate-900/50">
                          <button
                            type="button"
                            onClick={() => toggleSelect(rec.id)}
                            className="text-slate-400 hover:text-cyan-300"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-300" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        </td>

                        {/* 1. Nro. Documento */}
                        <td className="p-2 font-mono font-bold text-emerald-300 text-xs">
                          {rec.doc_number || 'N/A'}
                        </td>

                        {/* 2. Apellidos y Nombres */}
                        <td className="p-2 font-medium text-slate-100 truncate max-w-[240px]" title={fullName}>
                          {fullName}
                        </td>

                        {/* 3. Cod. Planilla (Amarillo) */}
                        <td className="p-1 bg-teal-950/20">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={CODIGOS_PLANILLA}
                                value={rec.cod_planilla}
                                onChange={(val) => handleRowChange(rec.id, 'cod_planilla', val)}
                                placeholder="Planilla..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cod_planilla', 'Cod. Planilla')}
                                className="p-1 rounded bg-teal-900/80 hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/50 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Cod. Planilla a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 4. Nro. Contrato */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={rec.nro_contrato || ''}
                              onChange={(e) => handleRowChange(rec.id, 'nro_contrato', e.target.value)}
                              placeholder="Nro..."
                              className="w-full px-2 py-1 h-7 rounded bg-slate-800 text-slate-100 border border-slate-600 focus:bg-slate-750 focus:border-cyan-400 text-xs font-mono transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('nro_contrato', 'Nro. Contrato')}
                                className="p-1 rounded bg-slate-800 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-slate-700 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Nro. Contrato a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 5. Básico (Amarillo) */}
                        <td className="p-1 bg-teal-950/20">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={rec.basico !== undefined ? rec.basico : 51.82}
                              onChange={(e) => handleRowChange(rec.id, 'basico', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 h-7 rounded bg-teal-950/40 text-teal-200 border border-teal-600/70 focus:bg-teal-900/50 focus:border-teal-300 text-xs font-mono font-bold transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('basico', 'Básico')}
                                className="p-1 rounded bg-teal-900/80 hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/50 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Básico a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 6. Inicio Contrato (Amarillo) */}
                        <td className="p-1 bg-teal-950/20">
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={rec.inicio_contrato || ''}
                              onChange={(e) => handleRowChange(rec.id, 'inicio_contrato', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-teal-950/40 text-teal-100 border border-teal-600/70 focus:bg-teal-900/50 focus:border-cyan-400 text-xs transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('inicio_contrato', 'Inicio Contrato')}
                                className="p-1 rounded bg-teal-900/80 hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/50 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta fecha de inicio a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 7. Duración */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <select
                              value={rec.duracion || '3'}
                              onChange={(e) => handleRowChange(rec.id, 'duracion', e.target.value)}
                              className="w-full px-1 py-1 h-7 rounded bg-slate-800 text-slate-100 border border-slate-600 focus:bg-slate-750 focus:border-cyan-400 text-xs transition shadow-sm"
                            >
                              <option value="1">1 m</option>
                              <option value="2">2 m</option>
                              <option value="3">3 m</option>
                              <option value="6">6 m</option>
                              <option value="12">12 m</option>
                            </select>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('duracion', 'Duración')}
                                className="p-1 rounded bg-slate-800 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-slate-700 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta duración a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 8. Fin Contrato (Amarillo) */}
                        <td className="p-1 bg-teal-950/20">
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={rec.fin_contrato || ''}
                              onChange={(e) => handleRowChange(rec.id, 'fin_contrato', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-teal-950/40 text-teal-100 border border-teal-600/70 focus:bg-teal-900/50 focus:border-cyan-400 text-xs transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('fin_contrato', 'Fin Contrato')}
                                className="p-1 rounded bg-teal-900/80 hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/50 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta fecha fin a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 9. F. Firma Contrato (Amarillo) */}
                        <td className="p-1 bg-teal-950/20">
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={rec.fecha_firma_contrato || ''}
                              onChange={(e) => handleRowChange(rec.id, 'fecha_firma_contrato', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-teal-950/40 text-teal-100 border border-teal-600/70 focus:bg-teal-900/50 focus:border-cyan-400 text-xs transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('fecha_firma_contrato', 'F. Firma Contrato')}
                                className="p-1 rounded bg-teal-900/80 hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/50 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta fecha de firma a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 10. Tipo de Contrato (Amarillo - 22 Opciones) */}
                        <td className="p-1 bg-teal-950/20">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={TIPOS_CONTRATO}
                                value={rec.tipo_contrato}
                                onChange={(val) => handleRowChange(rec.id, 'tipo_contrato', val)}
                                placeholder="Tipo de contrato..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('tipo_contrato', 'Tipo de Contrato')}
                                className="p-1 rounded bg-teal-900/80 hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/50 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Tipo de Contrato a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 11. Nro. Contrato Ref */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={rec.nro_contrato_ref || ''}
                              onChange={(e) => handleRowChange(rec.id, 'nro_contrato_ref', e.target.value)}
                              placeholder="Ref..."
                              className="w-full px-2 py-1 h-7 rounded bg-slate-800 text-slate-100 border border-slate-600 focus:bg-slate-750 focus:border-cyan-400 text-xs font-mono transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('nro_contrato_ref', 'Nro. Contrato Ref')}
                                className="p-1 rounded bg-slate-800 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-slate-700 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Nro. Contrato Ref a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Celda buffer para pantallas pequeñas y amplio recorrido sin corte */}
                        <td className="p-2 w-32 min-w-[128px] text-center font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          ✔ COMPLETO
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* BARRA DE DESPLAZAMIENTO HORIZONTAL INFERIOR GRUESA Y FÁCIL DE AGARRAR (PARTE INFERIOR DE LA TABLA) */}
          <div
            className="px-4 py-3 border-t flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-2xl select-none"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 shadow-xs">
                <ArrowLeftRight className="w-4 h-4 animate-pulse" />
              </span>
              <span className="text-xs font-bold font-mono">
                Desplazamiento horizontal: <strong className="text-cyan-400 font-extrabold text-sm">{Math.round(contractScrollPercent)}%</strong>
              </span>
            </div>

            <div className="flex-1 w-full flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleJumpContractScroll(0)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  contractScrollPercent <= 10
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir al inicio (Columna 1: DNI / Nombres)"
              >
                ◀ Inicio (Col 1)
              </button>

              <button
                type="button"
                onClick={() => handleJumpContractScroll(35)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden lg:inline ${
                  contractScrollPercent > 10 && contractScrollPercent <= 50
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Básico y Planilla"
              >
                Básico (Col 5)
              </button>

              <div className="relative flex-1 flex items-center min-w-[140px]">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.2"
                  value={contractScrollPercent}
                  onChange={handleContractSliderChange}
                  className="custom-range-slider w-full touch-pan-x"
                  title="Arrastra el control deslizante hacia la izquierda o derecha para mover las columnas"
                />
              </div>

              <button
                type="button"
                onClick={() => handleJumpContractScroll(70)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden lg:inline ${
                  contractScrollPercent > 50 && contractScrollPercent < 90
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Fechas de Contrato"
              >
                Fechas (Col 8)
              </button>

              <button
                type="button"
                onClick={() => handleJumpContractScroll(100)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  contractScrollPercent >= 90
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir al final (Columna 11: Tipo de Contrato y Ref)"
              >
                Final (Col 11) ▶
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'personal' ? (
        /* =========================================================================
            VISTA 2: TABLA MATRIZ DE DATOS DE PERSONAL NISIRA (77 COLUMNAS OFICIALES)
            ========================================================================= */
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-fade-in relative">
          {/* Barra de cabecera de la tabla con controles de scroll horizontal */}
          <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={records.length === 0}
                className="flex items-center gap-2 font-bold text-teal-200 hover:text-cyan-200 transition"
              >
                {selectedIds.size > 0 && selectedIds.size === records.length ? (
                  <CheckSquare className="w-4 h-4 text-cyan-300" />
                ) : selectedIds.size > 0 ? (
                  <div className="w-4 h-4 rounded border border-cyan-400 bg-[#0A3D44] flex items-center justify-center text-teal-200 text-[10px] font-bold">
                    -
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  {selectedIds.size === records.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </span>
              </button>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300">
                {selectedIds.size} de {records.length} trabajadores seleccionados
              </span>
            </div>

            {/* INDICADOR DE NAVEGACIÓN HORIZONTAL (SIN BOTONES) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Posición: <strong className="text-cyan-300 font-bold">{Math.round(personalScrollPercent)}%</strong></span>
              </span>

              <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/20 text-teal-200 border border-teal-400/40 font-bold">
                  🔷 Celdas Amarillas (Datos Laborales)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  🟢 Identidad
                </span>
              </div>
            </div>
          </div>

          {/* BARRA DE DESPLAZAMIENTO HORIZONTAL SUPERIOR GRUESA Y FÁCIL DE AGARRAR (ENCIMA DE LA TABLA) */}
          <div
            className="px-4 py-3 border-b flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-md select-none"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 shadow-xs">
                <ArrowLeftRight className="w-4 h-4 animate-pulse" />
              </span>
              <span className="text-xs font-bold font-mono">
                Desplazar Personal: <strong className="text-cyan-400 font-extrabold text-sm">{Math.round(personalScrollPercent)}%</strong>
              </span>
            </div>

            <div className="flex-1 w-full flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(0)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  personalScrollPercent <= 10
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir al inicio (Columna 1: DNI / Nombres)"
              >
                ◀ Inicio (Col 1)
              </button>

              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(25)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden md:inline ${
                  personalScrollPercent > 10 && personalScrollPercent <= 40
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Datos Laborales"
              >
                Laboral (Col 20)
              </button>

              {/* TRACK Y CONTROL DESLIZANTE GRUESO */}
              <div className="relative flex-1 flex items-center min-w-[140px]">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.2"
                  value={personalScrollPercent}
                  onChange={handlePersonalSliderChange}
                  className="custom-range-slider w-full touch-pan-x"
                  title="Arrastra el control deslizante hacia la izquierda o derecha para mover las 77 columnas"
                />
              </div>

              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(60)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden md:inline ${
                  personalScrollPercent > 40 && personalScrollPercent < 85
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Ubigeo y Dirección"
              >
                Ubigeo (Col 40)
              </button>

              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(100)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  personalScrollPercent >= 85
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir al final (Columna 77)"
              >
                Final (Col 77) ▶
              </button>
            </div>
          </div>

          {/* Tabla de Datos de Personal NISIRA con scroll horizontal completo */}
          <div
            ref={personalTableScrollRef}
            onScroll={handlePersonalTableScroll}
            className="overflow-x-auto max-h-[calc(100vh-280px)] min-h-[400px] custom-table-scrollbar"
          >
            <table className="min-w-[1850px] w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-20 shadow-md">
                <tr className="divide-x divide-slate-800 text-[11px] font-extrabold uppercase">
                  {/* Selector checkbox */}
                  <th className="p-2 w-10 text-center bg-slate-950 text-slate-300">#</th>

                  {/* 1. Nro. Documento */}
                  <th className="p-2 min-w-[110px] bg-[#101F3B] text-cyan-200 border-b-2 border-cyan-400">
                    Nro. Documento
                  </th>

                  {/* 2. Apellidos y Nombres */}
                  <th className="p-2 min-w-[210px] bg-[#101F3B] text-cyan-200 border-b-2 border-cyan-400">
                    Apellidos y Nombres
                  </th>

                  {/* 3. Cod. Cargo (Amarillo) */}
                  <th className="p-1.5 min-w-[200px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Cod. Cargo</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cod_cargo', 'Cod. Cargo')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Cod. Cargo de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 4. Cod. Planilla (Amarillo) */}
                  <th className="p-1.5 min-w-[130px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Cod. Planilla</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cod_planilla', 'Cod. Planilla')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Cod. Planilla de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 5. Cat. Ocupacional (Amarillo) */}
                  <th className="p-1.5 min-w-[150px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Cat. Ocupacional</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cat_ocupacional', 'Cat. Ocupacional')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Cat. Ocupacional de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 6. Cod. Tipo Trab. (Amarillo) */}
                  <th className="p-1.5 min-w-[180px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Tipo de Trabajador</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cod_tipo_trab', 'Tipo Trabajador')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Tipo de Trabajador de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 7. Period. Pago (Amarillo) */}
                  <th className="p-1.5 min-w-[130px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Period. Pago</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('period_pago', 'Periodicidad Pago')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Periodicidad Pago de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 8. Reg. Laboral (Amarillo) */}
                  <th className="p-1.5 min-w-[160px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Régimen Laboral</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('reg_laboral', 'Régimen Laboral')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Régimen Laboral de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 9. Básico (Amarillo) */}
                  <th className="p-1.5 min-w-[110px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Básico</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('basico', 'Básico')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Básico de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 10. F. Ingreso (Amarillo) */}
                  <th className="p-1.5 min-w-[130px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 F. Ingreso</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('fec_ingreso', 'F. Ingreso')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar F. Ingreso de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 11. Sistema Pensiones (AFP / ONP) (Amarillo) */}
                  <th className="p-1.5 min-w-[150px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Pensión / AFP</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('idafp', 'AFP / ONP')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar AFP / ONP de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 12. CUSPP (Amarillo) */}
                  <th className="p-1.5 min-w-[120px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 CUSPP</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cuspp', 'CUSPP')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar CUSPP de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 13. Tipo Comisión (Amarillo) */}
                  <th className="p-1.5 min-w-[110px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Comisión</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('tipo_comision', 'Tipo Comisión')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Tipo Comisión de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 14. Sucursal (Amarillo) */}
                  <th className="p-1.5 min-w-[160px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Sucursal</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('cod_sucursal', 'Sucursal')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Sucursal de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 15. Grupo Trabajo (Amarillo) */}
                  <th className="p-1.5 min-w-[180px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Grupo Trabajo</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('grupo_trabajo', 'Grupo Trabajo')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Grupo Trabajo de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 16. Tipo Personal (Amarillo) */}
                  <th className="p-1.5 min-w-[180px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Subplanilla</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('tipo_personal', 'Subplanilla')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Subplanilla de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 17. Niv. Educativo (Amarillo) */}
                  <th className="p-1.5 min-w-[180px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Nivel Educativo</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('niv_educativo', 'Nivel Educativo')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Nivel Educativo de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 18. Estado Civil (Amarillo) */}
                  <th className="p-1.5 min-w-[120px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Est. Civil</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('estado_civil', 'Estado Civil')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Estado Civil de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 19. Sexo (Amarillo) */}
                  <th className="p-1.5 min-w-[90px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 Sexo</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('sexo', 'Sexo')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Sexo de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* 20. Nacionalidad (Amarillo) */}
                  <th className="p-1.5 min-w-[120px] bg-[#0A3D44] text-teal-100 border-b-2 border-teal-400">
                    <div className="flex items-center justify-between gap-1">
                      <span>🔷 País</span>
                      {records.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyFieldFromRow1('nationality', 'Nacionalidad')}
                          className="px-1.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-extrabold shadow flex items-center gap-0.5 transition"
                          title="Copiar Nacionalidad de Fila 1 a seleccionados"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                          <span>1°</span>
                        </button>
                      )}
                    </div>
                  </th>

                  {/* Celda buffer para pantallas pequeñas y amplio recorrido sin corte */}
                  <th
                    className="p-2 w-32 min-w-[128px] text-center border-b-2 font-mono text-[9px]"
                    style={{ backgroundColor: 'var(--table-header-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
                  >
                    ✔ FIN
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {loadingRecords ? (
                  <tr>
                    <td colSpan="22" className="p-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-300 mb-2" />
                      <span>Cargando registros de personal...</span>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="22" className="p-12 text-center text-slate-400 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="font-bold text-white">No hay escaneos con los filtros aplicados</p>
                      <p className="text-xs text-slate-500">Ajuste la fecha u hora en la barra superior.</p>
                    </td>
                  </tr>
                ) : (
                  records.map((rec, index) => {
                    const isSelected = selectedIds.has(rec.id);
                    const fullName = `${rec.paternal_surname || ''} ${rec.maternal_surname || ''} ${rec.first_names || ''}`.trim() || 'Sin Nombre';

                    return (
                      <tr
                        key={rec.id}
                        className={`divide-x divide-slate-800 transition ${
                          isSelected
                            ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400'
                            : index % 2 === 0
                            ? 'bg-slate-900/95 hover:bg-slate-850'
                            : 'bg-[#152033] hover:bg-slate-850'
                        }`}
                      >
                        {/* Selector checkbox */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelect(rec.id)}
                            className="text-slate-400 hover:text-cyan-300"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-300" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </td>

                        {/* 1. Nro. Documento */}
                        <td className="p-2 font-mono font-bold text-emerald-300">
                          {rec.doc_number || 'N/A'}
                        </td>

                        {/* 2. Apellidos y Nombres */}
                        <td className="p-2 font-medium text-slate-200 truncate max-w-[210px]" title={fullName}>
                          {fullName}
                        </td>

                        {/* 3. Cod. Cargo (Amarillo - 49 Cargos NISIRA) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={CODIGOS_CARGO}
                                value={rec.cod_cargo}
                                onChange={(val) => handleRowChange(rec.id, 'cod_cargo', val)}
                                placeholder="Cargo..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cod_cargo', 'Cod. Cargo')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Cargo a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 4. Cod. Planilla (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={CODIGOS_PLANILLA}
                                value={rec.cod_planilla}
                                onChange={(val) => handleRowChange(rec.id, 'cod_planilla', val)}
                                placeholder="Planilla..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cod_planilla', 'Cod. Planilla')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Cod. Planilla a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 5. Cat. Ocupacional (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={CATEGORIAS_OCUPACIONALES}
                                value={rec.cat_ocupacional}
                                onChange={(val) => handleRowChange(rec.id, 'cat_ocupacional', val)}
                                placeholder="Cat..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cat_ocupacional', 'Cat. Ocupacional')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta Cat. Ocupacional a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 6. Tipo de Trabajador (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={CODIGOS_TIPO_TRAB}
                                value={rec.cod_tipo_trab}
                                onChange={(val) => handleRowChange(rec.id, 'cod_tipo_trab', val)}
                                placeholder="Tipo..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cod_tipo_trab', 'Tipo Trabajador')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Tipo de Trabajador a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 7. Period. Pago (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={PERIODICIDADES_PAGO}
                                value={rec.period_pago}
                                onChange={(val) => handleRowChange(rec.id, 'period_pago', val)}
                                placeholder="Pago..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('period_pago', 'Periodicidad')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta Periodicidad de Pago a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 8. Reg. Laboral (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={REGIMENES_LABORALES}
                                value={rec.reg_laboral}
                                onChange={(val) => handleRowChange(rec.id, 'reg_laboral', val)}
                                placeholder="Régimen..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('reg_laboral', 'Régimen Laboral')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Régimen Laboral a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 9. Básico (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={rec.basico !== undefined ? rec.basico : 51.82}
                              onChange={(e) => handleRowChange(rec.id, 'basico', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 h-7 rounded bg-slate-800 border border-teal-500/60 text-xs font-mono font-bold text-teal-200 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('basico', 'Básico')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este Básico a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 10. F. Ingreso (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={rec.fec_ingreso || rec.inicio_contrato || ''}
                              onChange={(e) => handleRowChange(rec.id, 'fec_ingreso', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-slate-800 border border-slate-600 text-xs text-slate-100 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm"
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('fec_ingreso', 'F. Ingreso')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar esta Fecha de Ingreso a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 11. Pensión / AFP (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <select
                                value={rec.idafp || ''}
                                onChange={(e) => handleRowChange(rec.id, 'idafp', e.target.value)}
                                className={`w-full px-2 py-1 h-7 rounded bg-slate-800 border text-xs font-bold focus:bg-slate-750 focus:border-cyan-400 truncate transition shadow-sm ${
                                  !rec.idafp
                                    ? 'border-emerald-500/70 text-emerald-300'
                                    : 'border-teal-500/70 text-teal-200'
                                }`}
                              >
                                <option value="">🟢 ONP (Sin AFP)</option>
                                {CODIGOS_AFP.map((afp) => (
                                  <option key={afp.code} value={afp.code}>
                                    🔷 {afp.code}: {afp.description}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('idafp', 'AFP / ONP')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar AFP / ONP de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 12. CUSPP (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={rec.cuspp || ''}
                              disabled={!rec.idafp}
                              onChange={(e) => handleRowChange(rec.id, 'cuspp', e.target.value.toUpperCase())}
                              placeholder={!rec.idafp ? 'ONP' : 'CUSPP...'}
                              className={`w-full px-2 py-1 h-7 rounded bg-slate-800 border text-xs font-mono text-slate-100 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm ${
                                !rec.idafp ? 'border-slate-700 text-slate-500 cursor-not-allowed' : 'border-slate-600'
                              }`}
                            />
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cuspp', 'CUSPP')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar este CUSPP a todas las filas seleccionadas"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 13. Tipo Comisión (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <select
                              value={rec.tipo_comision || '0'}
                              disabled={!rec.idafp}
                              onChange={(e) => handleRowChange(rec.id, 'tipo_comision', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-slate-800 border border-slate-600 text-xs text-slate-100 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm"
                            >
                              <option value="0">FLUJO (0)</option>
                              <option value="1">MIXTA (1)</option>
                            </select>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('tipo_comision', 'Tipo Comisión')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Tipo Comisión de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 14. Sucursal (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={CODIGOS_SUCURSAL}
                                value={rec.cod_sucursal}
                                onChange={(val) => handleRowChange(rec.id, 'cod_sucursal', val)}
                                placeholder="Sucursal..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('cod_sucursal', 'Sucursal')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Sucursal de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 15. Grupo Trabajo (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={GRUPOS_TRABAJO}
                                value={rec.grupo_trabajo}
                                onChange={(val) => handleRowChange(rec.id, 'grupo_trabajo', val)}
                                placeholder="Grupo..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('grupo_trabajo', 'Grupo Trabajo')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Grupo de Trabajo de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 16. Subplanilla (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={TIPOS_PERSONAL_SUBPLANILLA}
                                value={rec.tipo_personal}
                                onChange={(val) => handleRowChange(rec.id, 'tipo_personal', val)}
                                placeholder="Subplanilla..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('tipo_personal', 'Subplanilla')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Subplanilla de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 17. Niv. Educativo (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <ContractOptionSelect
                                options={NIVELES_EDUCATIVOS}
                                value={rec.niv_educativo}
                                onChange={(val) => handleRowChange(rec.id, 'niv_educativo', val)}
                                placeholder="Educación..."
                                compact={true}
                              />
                            </div>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('niv_educativo', 'Nivel Educativo')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Nivel Educativo de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 18. Estado Civil (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <select
                              value={rec.estado_civil || 'SO'}
                              onChange={(e) => handleRowChange(rec.id, 'estado_civil', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-slate-800 border border-slate-600 text-xs text-slate-100 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm"
                            >
                              {ESTADOS_CIVILES.map((ec) => (
                                <option key={ec.code} value={ec.code}>
                                  {ec.code}: {ec.description}
                                </option>
                              ))}
                            </select>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('estado_civil', 'Estado Civil')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Estado Civil de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 19. Sexo (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <select
                              value={rec.sexo || 'M'}
                              onChange={(e) => handleRowChange(rec.id, 'sexo', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-slate-800 border border-slate-600 text-xs text-slate-100 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm"
                            >
                              <option value="M">M</option>
                              <option value="F">F</option>
                            </select>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('sexo', 'Sexo')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Sexo de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 20. Nacionalidad (Amarillo) */}
                        <td className="p-1 bg-[#0A3D44]/15">
                          <div className="flex items-center gap-1">
                            <select
                              value={rec.nationality || 'PER'}
                              onChange={(e) => handleRowChange(rec.id, 'nationality', e.target.value)}
                              className="w-full px-1.5 py-1 h-7 rounded bg-slate-800 border border-slate-600 text-xs text-slate-100 focus:bg-slate-750 focus:border-cyan-400 transition shadow-sm"
                            >
                              {NACIONALIDADES.map((nac) => (
                                <option key={nac.code} value={nac.code}>
                                  {nac.code}
                                </option>
                              ))}
                            </select>
                            {index === 0 && records.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleCopyFieldFromRow1('nationality', 'Nacionalidad')}
                                className="p-1 rounded bg-[#0A3D44] hover:bg-teal-400 text-teal-200 hover:text-slate-950 border border-teal-500/40 text-[9px] font-bold flex-shrink-0 transition"
                                title="Copiar Nacionalidad de Fila 1 a seleccionados"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Celda buffer para pantallas pequeñas y amplio recorrido sin corte */}
                        <td className="p-2 w-32 min-w-[128px] text-center font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          ✔ COMPLETO
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* BARRA DE DESPLAZAMIENTO HORIZONTAL INFERIOR GRUESA Y FÁCIL DE AGARRAR (PARTE INFERIOR DE LA TABLA) */}
          <div
            className="px-4 py-3 border-t flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-2xl select-none"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 shadow-xs">
                <ArrowLeftRight className="w-4 h-4 animate-pulse" />
              </span>
              <span className="text-xs font-bold font-mono">
                Desplazamiento horizontal: <strong className="text-cyan-400 font-extrabold text-sm">{Math.round(personalScrollPercent)}%</strong>
              </span>
            </div>

            <div className="flex-1 w-full flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(0)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  personalScrollPercent <= 10
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir al inicio (Columna 1: DNI / Nombres)"
              >
                ◀ Inicio (Col 1)
              </button>

              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(25)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden lg:inline ${
                  personalScrollPercent > 10 && personalScrollPercent <= 40
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Datos Laborales"
              >
                Laboral (Col 20)
              </button>

              <div className="relative flex-1 flex items-center min-w-[140px]">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.2"
                  value={personalScrollPercent}
                  onChange={handlePersonalSliderChange}
                  className="custom-range-slider w-full touch-pan-x"
                  title="Arrastra el control deslizante hacia la izquierda o derecha para ver las 77 columnas"
                />
              </div>

              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(60)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs hidden lg:inline ${
                  personalScrollPercent > 40 && personalScrollPercent < 85
                    ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-teal-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir a Ubigeo y Dirección"
              >
                Ubigeo (Col 40)
              </button>

              <button
                type="button"
                onClick={() => handleJumpPersonalScroll(100)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap transition border shadow-xs ${
                  personalScrollPercent >= 85
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/25 font-black'
                    : 'bg-slate-800/80 text-slate-200 hover:text-white border-slate-700'
                }`}
                title="Ir al final (Columna 77)"
              >
                Final (Col 77) ▶
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            VISTA 3: LISTA DE FICHAS DE PERSONAL (VISTA ORIGINAL CONSERVADA)
            ========================================================================= */
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-xl space-y-0">
          <div className="py-2.5 px-4 bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={records.length === 0}
                className="flex items-center space-x-2 text-xs font-bold text-teal-200 hover:text-cyan-200 transition"
              >
                {selectedIds.size > 0 && selectedIds.size === records.length ? (
                  <CheckSquare className="w-4 h-4 text-cyan-300" />
                ) : selectedIds.size > 0 ? (
                  <div className="w-4 h-4 rounded border border-cyan-400 bg-[#0A3D44] flex items-center justify-center text-teal-200 text-[10px] font-bold">
                    -
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  {selectedIds.size === records.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </span>
              </button>

              <span className="text-slate-600">•</span>

              <span className="text-xs font-bold text-teal-200">
                {selectedIds.size} de {records.length} trabajadores seleccionados
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <a
                href={api.getUbigeoExcelUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-200 font-bold text-xs transition border border-slate-700"
                title="Descargar base de datos completa de Ubigeos de Perú en Excel"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Base Ubigeos (Excel)</span>
              </a>
            </div>
          </div>

          <div className="divide-y divide-slate-800 max-h-[calc(100vh-270px)] min-h-[400px] overflow-y-auto">
            {records.map((rec, index) => {
              const isSelected = selectedIds.has(rec.id);
              const fullName = `${rec.paternal_surname || ''} ${rec.maternal_surname || ''} ${rec.first_names || ''}`.trim() || 'Sin Nombre';

              return (
                <div
                  key={rec.id}
                  onClick={() => toggleSelect(rec.id)}
                  className={`py-3 px-4 flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected ? 'bg-slate-850' : 'bg-slate-950/40 hover:bg-slate-850/60'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(rec.id);
                      }}
                      className="text-slate-500 hover:text-cyan-300 flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-300" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-mono font-bold text-slate-400 text-xs flex-shrink-0 border border-slate-700">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-white truncate">{fullName}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-teal-200 border border-slate-700 flex-shrink-0">
                          {rec.doc_number || 'S/N'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-0.5">
                        <span>Cargo: <b className="text-slate-300">{getCargoLabel(rec.cod_cargo)}</b></span>
                        <span>•</span>
                        <span>Planilla: <b className="text-teal-200">{rec.cod_planilla}</b></span>
                        <span>•</span>
                        <span>Básico: <b className="text-emerald-400">S/. {rec.basico}</b></span>
                        <span>•</span>
                        <span>Fec. Escaneo: {rec.scan_date ? rec.scan_date.split('T')[0] : 'Hoy'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
