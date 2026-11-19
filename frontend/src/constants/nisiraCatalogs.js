/**
 * Catálogos Oficiales de Datos de Personal NISIRA ERP - Agroindustrias Chavín de Huántar S.A.
 * Plantilla de Referencia: CARGA MASIVA DE DATOS NISIRA - 20261102.xlsx (77 Columnas)
 * Códigos con longitud estricta de texto y ceros iniciales garantizados.
 */

// =========================================================================
// 1. COD. AFP (Longitud: 3 caracteres)
// =========================================================================
export const CODIGOS_AFP = [
  { code: 'HAB', description: 'HABITAT' },
  { code: 'HOR', description: 'HORIZONTE' },
  { code: 'INT', description: 'INTEGRA' },
  { code: 'PRI', description: 'PRIMA' },
  { code: 'PRO', description: 'PROFUTURO' },
  { code: '', description: 'ONP (Sin AFP / Sistema Nacional de Pensiones)' }
];

// =========================================================================
// 2. CAT. OCUPACIONAL (Longitud: 2 caracteres)
// =========================================================================
export const CATEGORIAS_OCUPACIONALES = [
  { code: '01', description: 'EJECUTIVO' },
  { code: '02', description: 'OBRERO' },
  { code: '03', description: 'EMPLEADO' },
  { code: '11', description: 'FUNCIONARIO' },
  { code: '12', description: 'PROFESIONAL' },
  { code: '13', description: 'TECNICO' },
  { code: '14', description: 'AUXILIAR' }
];

// =========================================================================
// 3. PERIOD. PAGO / idperiodicidad (Longitud: 1 carácter)
// =========================================================================
export const PERIODICIDADES_PAGO = [
  { code: '1', description: 'MENSUAL' },
  { code: '2', description: 'QUINCENAL' },
  { code: '3', description: 'SEMANAL' },
  { code: '4', description: 'DIARIA' },
  { code: '5', description: 'OTROS' }
];

// =========================================================================
// 4. COD. CARGO (Longitud: 3 caracteres, 000 a 129)
// =========================================================================
export const CODIGOS_CARGO = [
  { code: '000', description: 'ALMACENERO' },
  { code: '001', description: 'ANALISTA DE CONTABILIDAD' },
  { code: '002', description: 'ANALISTA DE BIENESTAR SOCIAL' },
  { code: '003', description: 'ANALISTA SENIOR DE PLANILLAS' },
  { code: '004', description: 'ANALISTA TRIBUTARIO' },
  { code: '005', description: 'ANALISTA DE EXPORTACIONES' },
  { code: '006', description: 'ANALISTA DE FINANZAS' },
  { code: '007', description: 'ASESOR TRIBUTARIO' },
  { code: '008', description: 'ASISTENTE ADMINISTRATIVO' },
  { code: '009', description: 'ASISTENTE DE COMPRAS' },
  { code: '010', description: 'ASISTENTE DE BIENESTAR' },
  { code: '011', description: 'ASISTENTE DE INFORMACIÓN - PRODUCCION' },
  { code: '012', description: 'ASISTENTE DE OPERACIONES DE CMP' },
  { code: '013', description: 'ASISTENTE DE SOSTENIBILIDAD' },
  { code: '014', description: 'ASISTENTE DE RECURSOS HUMANOS' },
  { code: '015', description: 'ASISTENTE TESORERIA' },
  { code: '016', description: 'ASISTENTE CONTABLE' },
  { code: '017', description: 'CHOFERES' },
  { code: '018', description: 'COMPENSACIONES' },
  { code: '019', description: 'CONTADOR GENERAL' },
  { code: '020', description: 'COORD. DE COMPRA DE FRESA' },
  { code: '021', description: 'COORDINADOR DE EXPORTACIONES' },
  { code: '022', description: 'COORDINADOR MTTO' },
  { code: '023', description: 'COORDINADOR CERTIFICACIONES' },
  { code: '024', description: 'COORDINADOR DE CALIDAD' },
  { code: '025', description: 'COORDINADOR DE INFO DE LA PROD' },
  { code: '026', description: 'COORDINADOR GENERAL DE RECEP. Y MADURACION' },
  { code: '027', description: 'COORDINADOR GENERAL' },
  { code: '028', description: 'ENFERMERA' },
  { code: '029', description: 'GERENCIA GENERAL' },
  { code: '030', description: 'GERENTE DE CONTABILIDAD Y FINANZAS' },
  { code: '031', description: 'GERENTE DE PRODUCCIÓN' },
  { code: '032', description: 'INSPECTOR AC LINEA PROCESO' },
  { code: '033', description: 'INSPECTOR AC DE EMPAQUE' },
  { code: '034', description: 'INSPECTOR DE AC PCC PROCESO' },
  { code: '035', description: 'INSPECTOR DE AC RECEPCIÓN Y MADURACIÓN' },
  { code: '036', description: 'INSPECTOR DE PROCESO' },
  { code: '037', description: 'INSPECTOR DE RECEPCION Y MADURACIÓN' },
  { code: '038', description: 'INSPECTOR DE SANIDAD Y SSGG' },
  { code: '039', description: 'JEFATURA DE ASEGURAMIENTO DE LA CALIDAD' },
  { code: '040', description: 'JEFATURA DE PLANTA' },
  { code: '041', description: 'JEFE DE LOGISTICA Y COSTOS' },
  { code: '042', description: 'JEFE DE MANTENIMIENTO' },
  { code: '043', description: 'JEFE DE RR.HH' },
  { code: '044', description: 'JEFE DE SIST. INTEGRAL DE GESTION' },
  { code: '045', description: 'JEFE DE TESORERIA' },
  { code: '046', description: 'LABORATORISTA' },
  { code: '047', description: 'OBRERO DE CAMPO' },
  { code: '048', description: 'OBRERO DE PLANTA' },
  { code: '049', description: 'PRESIDENTE DE DIRECTORIO' },
  { code: '050', description: 'SECRETARIA' },
  { code: '051', description: 'SUB CONTADORA' },
  { code: '052', description: 'SUPERVISOR DE EMPAQUE' },
  { code: '053', description: 'SUP. DE ALMACEN P.T' },
  { code: '054', description: 'SUP. DE PROCESO' },
  { code: '055', description: 'SUPERVISOR' },
  { code: '056', description: 'SUPERVISOR DE ASEGURAMIENTO DE LA CALIDAD' },
  { code: '057', description: 'SUPERVISOR DE ALMACEN' },
  { code: '058', description: 'SUPERVISOR DE S.S.T' },
  { code: '059', description: 'SUPERVISOR DE UNIDADES' },
  { code: '060', description: 'SUPERVISOR. DE PROCESO' },
  { code: '061', description: 'TECNICO ELECTRICISTA' },
  { code: '062', description: 'TECNICO FRIGORISTA' },
  { code: '063', description: 'TÉCNICO MECÁNICO' },
  { code: '064', description: 'SUPERVISOR DE CAMPO' },
  { code: '065', description: 'VIGILANTE' },
  { code: '066', description: 'AUXILIAR DE CAMPO' },
  { code: '067', description: 'ANALISTA DE CERTIFICACIONES' },
  { code: '068', description: 'ASIST . EXPORTACIONES' },
  { code: '069', description: 'AUXILIAR CONTABLE' },
  { code: '070', description: 'INSPECTOR DE MATERIAS EXTRAÑAS' },
  { code: '071', description: 'SUPERVISOR PLANNER' },
  { code: '072', description: 'SOLDADOR' },
  { code: '073', description: 'MICROBIOLOGO' },
  { code: '074', description: 'INSPECTOR DE PRODUCCION' },
  { code: '075', description: 'INSPECTOR DE S.S.T' },
  { code: '076', description: 'SUPERVISOR DE ACOPIO' },
  { code: '077', description: 'INSPECTOR DE SOSTENIBILIDAD' },
  { code: '078', description: 'SUPERVISOR SANEAMIENTO' },
  { code: '079', description: 'INSPECTOR DE PRODUCCION - CAMARA CONGELADO' },
  { code: '080', description: 'SUPERVISOR DE PRODUCCION' },
  { code: '081', description: 'ANALISTA DE COMERCIO EXTERIOR' },
  { code: '089', description: 'INSPECTOR DE ASEG. DE LA CALIDAD' },
  { code: '090', description: 'AXULIAR DE PRODUCCION' },
  { code: '091', description: 'COORDINADOR DE LOGISTICA' },
  { code: '092', description: 'JEFE DE CONTABILIDAD' },
  { code: '093', description: 'ANALISTA DE COSTOS' },
  { code: '094', description: 'ANALISTA DE LOGISTICA' },
  { code: '095', description: 'ASIST. RECLUTAMIENTO - PRODUCCIÓN' },
  { code: '096', description: 'OBRERO REGADOR' },
  { code: '097', description: 'JEFE DE BIENESTAR SOCIAL Y CORD. GERENCIA' },
  { code: '098', description: 'AUXILIAR DE MANTENIMIENTO' },
  { code: '099', description: 'COORD. GESTION DE MANTENIMIENTO' },
  { code: '100', description: 'EJECUTIVA DE VENTAS' },
  { code: '101', description: 'JEFE DE ACOPIO' },
  { code: '102', description: 'INGENIERO AGRONOMO' },
  { code: '103', description: 'SUPERVISOR DE BIENESTAR SOCIAL' },
  { code: '104', description: 'ANALISTA ADMINISTRATIVA' },
  { code: '105', description: 'ASISTENTE DOCUMENTARIO' },
  { code: '106', description: 'COORDINADOR DE BIENESTAR SOCIAL' },
  { code: '107', description: 'ANALISTA JR DE SOSTENIBILIDAD.' },
  { code: '108', description: 'SUPERVISOR DE CALIDAD' },
  { code: '109', description: 'ASISTENTE DE LOGISTICA' },
  { code: '110', description: 'COORDINADOR DE COSTOS Y PRESUPUESTOS' },
  { code: '111', description: 'ASISTENTE DE COSTOS Y PRESUPUESTOS' },
  { code: '112', description: 'EJECUTIVO COMERCIAL DE EXPORTACIONES' },
  { code: '113', description: 'JEFE DE PRODUCCION' },
  { code: '114', description: 'INSPECTOR DE SANEAMIENTO' },
  { code: '115', description: 'INSPECTOR DE LABORATORIO' },
  { code: '116', description: 'SUPERVISOR DE CERTIFICACIONES' },
  { code: '117', description: 'SUPERVISOR DE SANIDAD' },
  { code: '118', description: 'JEFE DE CAMARA DE PRODUCTO TERMINADO' },
  { code: '119', description: 'ANALISTA DE CALIDAD' },
  { code: '120', description: 'AUXILIAR DE BIENESTAR SOCIAL - PRODUCCION' },
  { code: '121', description: 'ENFERMERO' },
  { code: '122', description: 'JEFE DE PLANIFICACIÓN DE PROCESOS' },
  { code: '123', description: 'COORD. RECURSOS HUMANOS' },
  { code: '124', description: 'ENFERMERA - PRODUCCION' },
  { code: '125', description: 'PLANNER DE MANTENIMIENTO' },
  { code: '126', description: 'SUPERVISOR DE CALIDAD JUNIOR' },
  { code: '127', description: 'ANALISTA JUNIOR DE OPERACIONES DE COMPRA DE MATERIA PRIMA' },
  { code: '128', description: 'JEFE DE TI' },
  { code: '129', description: 'JEFE DE ASEGURAMIENTO DE CALIDAD' }
];

// =========================================================================
// 5. COD. TIPO TRAB. (Longitud: 2 caracteres)
// =========================================================================
export const CODIGOS_TIPO_TRAB = [
  { code: '21', description: 'EMPLEADO GENERAL' },
  { code: '22', description: 'PRACTICANTE GENERAL' },
  { code: '24', description: 'EMPLEADOS AGRARIO LEY N° 31110' },
  { code: '64', description: 'AGRARIO DEPENDIENTE - LEY 27360' },
  { code: '76', description: 'OBREROS AGRARIO LEY N° 31110' }
];

// =========================================================================
// 6. COD. SUCURSAL (Longitud: 3 caracteres)
// =========================================================================
export const CODIGOS_SUCURSAL = [
  { code: 'CA1', description: 'OFICINA CASMA' },
  { code: 'CA2', description: 'FUNDO 4 PALOS' },
  { code: 'CA3', description: 'PLANTA SECHIN' },
  { code: 'CA4', description: 'FUNDO SAN ISAIAS' },
  { code: 'CA5', description: 'FUNDO CUNCAN' },
  { code: 'LIM', description: 'OFICINA LIMA' }
];

// =========================================================================
// 7. GRUPO TRABAJO (Longitud: 3 caracteres)
// =========================================================================
export const GRUPOS_TRABAJO = [
  { code: '001', description: 'ADMINISTRACION' },
  { code: '002', description: 'ALMACEN' },
  { code: '003', description: 'ASEG. DE LA CALIDAD - A' },
  { code: '004', description: 'CAMPO' },
  { code: '005', description: 'CONTABILIDAD' },
  { code: '006', description: 'COSTOS' },
  { code: '007', description: 'DIRECTORIO' },
  { code: '008', description: 'EXPORTACIONES' },
  { code: '009', description: 'FINANZAS' },
  { code: '010', description: 'GERENCIAS' },
  { code: '011', description: 'LOGISTICA' },
  { code: '012', description: 'MANTENIMIENTO - A' },
  { code: '013', description: 'PRODUCCION - OBREROS A' },
  { code: '014', description: 'PRODUCCION - EMPLEADOS A' },
  { code: '015', description: 'RECURSOS HUMANOS' },
  { code: '016', description: 'SISTEMA INTEGRA DE GESTION' },
  { code: '017', description: 'SERVICIOS GENERALES - A' },
  { code: '018', description: 'TESORERIA' },
  { code: '019', description: 'TRANSPORTES' },
  { code: '020', description: 'VIGILANCIA - A' },
  { code: '021', description: 'PRODUCCION - OBREROS B' },
  { code: '022', description: 'PRODUCCION - EMPLEADOS B' },
  { code: '023', description: 'MANTENIMIENTO - B' },
  { code: '024', description: 'VIGILANCIA - B' },
  { code: '025', description: 'ASEG. DE LA CALIDAD - B' },
  { code: '026', description: 'SERVICIOS GENERALES - B' }
];

// =========================================================================
// 8. TIPO PERS. / SUBPLANILLA (Longitud: 2 caracteres)
// =========================================================================
export const TIPOS_PERSONAL_SUBPLANILLA = [
  { code: '01', description: 'EMPLEADOS GENERAL LIMA' },
  { code: '02', description: 'EMPLEADOS GENERAL CASMA - PLANTA' },
  { code: '03', description: 'EMPLEADOS AGRARIO CASMA - PLANTA' },
  { code: '04', description: 'EMPLEADOS AGRARIO CASMA - CAMPO' },
  { code: '05', description: 'OBREROS AGRARIO CASMA - PLANTA' },
  { code: '06', description: 'OBREROS AGRARIO CASMA - CAMPO' },
  { code: '07', description: 'PRACTICANTE - PLANTA' },
  { code: '08', description: 'PRACTICANTE - CAMPO' },
  { code: '09', description: 'PRACTICANTE - LIMA' }
];

// =========================================================================
// 9. REG. LABORAL (Longitud: 2 caracteres)
// =========================================================================
export const REGIMENES_LABORALES = [
  { code: '01', description: 'PRIVADO GENERAL - DECRETO LEGISLATIVO N.° 728' },
  { code: '02', description: 'PÚBLICO GENERAL - DECRETO LEGISLATIVO N.° 276' },
  { code: '03', description: 'PROFESORADO - LEY N.° 24029' },
  { code: '04', description: 'MAGISTERIO - LEY N.° 29062' },
  { code: '05', description: 'DOCENTES UNIVERSITARIOS - LEY N.° 23733' },
  { code: '06', description: 'PROFESIONALES DE LA SALUD LEY N.° 23536' },
  { code: '07', description: 'TECNICOS Y AUXILIARES ASIST. DE LA SALUD - LEY N.° 28561' },
  { code: '08', description: 'SERUM - LEY N.° 23330' },
  { code: '09', description: 'JUECES - CARRERA JUDICIAL - LEY N.° 29277' },
  { code: '10', description: 'FISCALES - D. LEG. N.° 052' },
  { code: '11', description: 'SERVICIO DIPLOMÁTICO DE LA REPÚBLICA - LEY N.° 28091' },
  { code: '12', description: 'MILITARES' },
  { code: '13', description: 'POLICIA NACIONAL DEL PERÚ - LEY N.° 27238' },
  { code: '14', description: 'ESPECIAL GER. PÚBLICOS DECRETO LEGISLATIVO N.° 1024 (2)' },
  { code: '15', description: 'CONTRATO ADMINISTRATIVO DE SERVICIOS - D.LEG. N.° 1057' },
  { code: '16', description: 'MICROEMPRESA D. LEG. 1086 (1)' },
  { code: '17', description: 'PEQUEÑA EMPRESA D. LEG. 1086 (1)' },
  { code: '18', description: 'AGRARIO LEY 27360' },
  { code: '19', description: 'EXPORTACION NO TRADICIONAL D. LEY 22342' },
  { code: '20', description: 'MINEROS' },
  { code: '21', description: 'CONSTRUCCION CIVIL' },
  { code: '26', description: 'AGRARIO LEY 31110' },
  { code: '99', description: 'OTROS NO PREVISTOS' }
];

// =========================================================================
// 10. TIPO DE COMISIÓN (Longitud: 1 carácter)
// =========================================================================
export const TIPOS_COMISION = [
  { code: '0', description: 'COMISIÓN POR FLUJO' },
  { code: '1', description: 'COMISIÓN MIXTA' },
  { code: 'ONP', description: 'ONP (No aplica comisión AFP)' }
];

// =========================================================================
// 11. SEXO (Longitud: 1 carácter)
// =========================================================================
export const CATALOGO_SEXO = [
  { code: 'M', description: 'MASCULINO' },
  { code: 'F', description: 'FEMENINO' }
];

// =========================================================================
// 12. NIV. EDUCATIVO (Longitud: 3 caracteres)
// =========================================================================
export const NIVELES_EDUCATIVOS = [
  { code: '001', description: 'SIN EDUCACIÓN FORMAL' },
  { code: '002', description: 'EDUCACIÓN ESPECIAL INCOMPLETA' },
  { code: '003', description: 'EDUCACIÓN ESPECIAL COMPLETA' },
  { code: '004', description: 'EDUCACIÓN PRIMARIA INCOMPLETA' },
  { code: '005', description: 'EDUCACIÓN PRIMARIA COMPLETA' },
  { code: '006', description: 'EDUCACIÓN SECUNDARIA INCOMPLETA' },
  { code: '007', description: 'EDUCACIÓN SECUNDARIA COMPLETA' },
  { code: '008', description: 'EDUCACIÓN TÉCNICA INCOMPLETA' },
  { code: '009', description: 'EDUCACIÓN TÉCNICA COMPLETA' },
  { code: '010', description: 'EDUCACIÓN SUPERIOR INCOMPLETA' },
  { code: '011', description: 'EDUCACIÓN SUPERIOR COMPLETA' },
  { code: '012', description: 'EDUCACIÓN UNIVERSITARIA INCOMPLETA' },
  { code: '013', description: 'EDUCACIÓN UNIVERSITARIA COMPLETA' },
  { code: '014', description: 'GRADO DE BACHILLER' },
  { code: '015', description: 'TITULADO' },
  { code: '016', description: 'ESTUDIOS DE MAESTRÍA INCOMPLETA' },
  { code: '017', description: 'ESTUDIOS DE MAESTRÍA COMPLETA' },
  { code: '018', description: 'GRADO DE MAESTRÍA' },
  { code: '019', description: 'ESTUDIOS DE DOCTORADO INCOMPLETO' },
  { code: '020', description: 'ESTUDIOS DE DOCTORADO COMPLETO' },
  { code: '021', description: 'GRADO DE DOCTOR' },
  { code: '022', description: 'OTROS' }
];

// =========================================================================
// 13. EST. CIVIL (Longitud: 2 caracteres)
// =========================================================================
export const ESTADOS_CIVILES = [
  { code: 'SO', description: 'SOLTERO(A)' },
  { code: 'CA', description: 'CASADO(A)' },
  { code: 'CO', description: 'CONVIVIENTE' },
  { code: 'DI', description: 'DIVORCIADO(A)' },
  { code: 'VI', description: 'VIUDO(A)' }
];

// =========================================================================
// 14. NACIONALIDAD (Longitud: 3 caracteres)
// =========================================================================
export const NACIONALIDADES = [
  { code: 'PER', description: 'PERÚ' },
  { code: 'ARG', description: 'ARGENTINA' },
  { code: 'BOL', description: 'BOLIVIA' },
  { code: 'BRA', description: 'BRASIL' },
  { code: 'CHI', description: 'CHILE' },
  { code: 'COL', description: 'COLOMBIA' },
  { code: 'ECU', description: 'ECUADOR' },
  { code: 'PAR', description: 'PARAGUAY' },
  { code: 'URU', description: 'URUGUAY' },
  { code: 'VEN', description: 'VENEZUELA' },
  { code: 'OTR', description: 'OTRO PAÍS' }
];

// =========================================================================
// 15. TIP. DOCUMENTO (Longitud: 2 caracteres)
// =========================================================================
export const TIPOS_DOCUMENTO = [
  { code: '01', description: 'LIBRETA ELECTORAL O DNI' },
  { code: '02', description: 'DOC. PROVISIONAL DE IDENTIDAD' },
  { code: '03', description: 'CARNET FUERZAS ARMADAS' },
  { code: '04', description: 'CARNET DE EXTRANJERÍA' },
  { code: '07', description: 'PASAPORTE' },
  { code: '11', description: 'PARTIDA DE NACIMIENTO' },
  { code: '13', description: 'TRAB. MENOR DE EDAD/INTERDICT' }
];

// =========================================================================
// CONFIGURACIÓN INICIAL PREDETERMINADA: OBRERO DE PLANTA
// =========================================================================
export const DEFAULT_OBRERO_PLANTA = {
  cod_cargo: '048',             // OBRERO DE PLANTA
  cod_planilla: 'ORP',          // OBREROS AGRARIO PLANTA
  cat_ocupacional: '02',        // OBRERO
  cod_tipo_trab: '76',          // OBREROS AGRARIO LEY N° 31110
  period_pago: '3',             // SEMANAL
  cod_sucursal: 'CA3',          // PLANTA SECHIN
  grupo_trabajo: '013',         // PRODUCCION - OBREROS A
  tipo_personal: '05',          // OBREROS AGRARIO CASMA - PLANTA
  reg_laboral: '26',            // AGRARIO LEY 31110
  tipo_comision: '0',           // FLUJO
  niv_educativo: '007',         // EDUCACIÓN SECUNDARIA COMPLETA
  asignacion_familiar: 'NO',
};

// =========================================================================
// MOTOR DE REGLAS Y SUGERENCIAS AUTOMÁTICAS POR CARGO Y TIPO DE TRABAJADOR
// =========================================================================

/**
 * Determina si un cargo corresponde a personal administrativo no directamente de producción
 */
export function isAdministrativeCargo(cargoCode) {
  const code = String(cargoCode).padStart(3, '0');
  // Analistas, Asistentes admin/RRHH/contable, Jefes no de campo, Contabilidad, Tesorería, Logística, etc.
  const adminCodes = new Set([
    '001', '002', '003', '004', '005', '006', '007', '008', '009', '010',
    '013', '014', '015', '016', '018', '019', '021', '023', '029', '030',
    '041', '043', '044', '045', '050', '051', '067', '068', '069', '081',
    '091', '092', '093', '094', '095', '097', '100', '104', '105', '106',
    '107', '109', '110', '111', '112', '116', '123', '128'
  ]);
  return adminCodes.has(code);
}

/**
 * Determina si un cargo corresponde a supervisores de producción / puestos técnicos agrarios
 */
export function isAgrarianSupervisorCargo(cargoCode) {
  const code = String(cargoCode).padStart(3, '0');
  const superCodes = new Set([
    '011', '012', '020', '024', '025', '026', '027', '031', '032', '033',
    '034', '035', '036', '037', '038', '039', '040', '042', '052', '053',
    '054', '055', '056', '057', '058', '059', '060', '064', '070', '071',
    '074', '075', '076', '077', '078', '079', '080', '089', '101', '102',
    '103', '108', '113', '114', '115', '117', '118', '119', '122', '125',
    '126', '127', '129'
  ]);
  return superCodes.has(code);
}

/**
 * Genera sugerencias inteligentes cuando el usuario modifica el Cargo o Tipo de Trabajador.
 * Retorna { hasSuggestions: bool, categoryName: string, suggestions: object, diffFields: array }
 */
export function generateSuggestionsForWorker(cargoCode, currentValues = {}) {
  const code = String(cargoCode || '048').padStart(3, '0');
  let proposed = {};
  let categoryName = '';

  if (isAdministrativeCargo(code)) {
    categoryName = 'Puesto Administrativo (Régimen General)';
    proposed = {
      cod_planilla: 'ERG',         // EMPLEADOS REGIMEN GENERAL
      period_pago: '1',            // MENSUAL
      cod_tipo_trab: '21',         // EMPLEADO GENERAL
      cat_ocupacional: '03',       // EMPLEADO
      tipo_personal: '02',         // EMPLEADOS GENERAL CASMA - PLANTA
      reg_laboral: '01',           // PRIVADO GENERAL D.LEG 728
    };
  } else if (isAgrarianSupervisorCargo(code)) {
    categoryName = 'Supervisor / Mando Medio Agrario';
    proposed = {
      cod_planilla: 'ERA',         // EMPLEADOS REGIMEN AGRARIO
      period_pago: '1',            // MENSUAL
      cod_tipo_trab: '24',         // EMPLEADOS AGRARIO LEY N° 31110
      cat_ocupacional: '03',       // EMPLEADO
      tipo_personal: '03',         // EMPLEADOS AGRARIO CASMA - PLANTA
      reg_laboral: '26',           // AGRARIO LEY 31110
    };
  } else if (code === '047' || code === '096' || code === '066') {
    categoryName = 'Obrero Agrario Campo';
    proposed = {
      cod_planilla: 'ORC',         // OBREROS AGRARIO CAMPO
      period_pago: '3',            // SEMANAL
      cod_tipo_trab: '76',         // OBREROS AGRARIO LEY N° 31110
      cat_ocupacional: '02',       // OBRERO
      tipo_personal: '06',         // OBREROS AGRARIO CASMA - CAMPO
      reg_laboral: '26',           // AGRARIO LEY 31110
      grupo_trabajo: '004',        // CAMPO
    };
  } else {
    categoryName = 'Obrero de Planta (Estándar)';
    proposed = { ...DEFAULT_OBRERO_PLANTA };
  }

  // Detectar cuáles campos difieren de los valores actuales
  const diffFields = [];
  Object.keys(proposed).forEach((key) => {
    if (currentValues[key] !== proposed[key]) {
      diffFields.push({
        field: key,
        current: currentValues[key],
        proposed: proposed[key]
      });
    }
  });

  return {
    hasSuggestions: diffFields.length > 0,
    categoryName,
    suggestions: proposed,
    diffFields
  };
}

// Helpers de búsqueda de etiquetas por código
export function getCargoLabel(code) {
  if (!code && code !== 0) return '';
  const c = String(code).padStart(3, '0');
  const found = CODIGOS_CARGO.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getTipoTrabLabel(code) {
  if (!code) return '';
  const c = String(code).trim();
  const found = CODIGOS_TIPO_TRAB.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getCatOcupacionalLabel(code) {
  if (!code) return '';
  const c = String(code).padStart(2, '0');
  const found = CATEGORIAS_OCUPACIONALES.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getAfpLabel(code) {
  if (!code) return 'ONP';
  const c = String(code).trim().toUpperCase();
  const found = CODIGOS_AFP.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getSucursalLabel(code) {
  if (!code) return '';
  const c = String(code).trim().toUpperCase();
  const found = CODIGOS_SUCURSAL.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getGrupoTrabajoLabel(code) {
  if (!code) return '';
  const c = String(code).padStart(3, '0');
  const found = GRUPOS_TRABAJO.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getTipoPersonalLabel(code) {
  if (!code) return '';
  const c = String(code).padStart(2, '0');
  const found = TIPOS_PERSONAL_SUBPLANILLA.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getRegLaboralLabel(code) {
  if (!code) return '';
  const c = String(code).padStart(2, '0');
  const found = REGIMENES_LABORALES.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getNivelEducativoLabel(code) {
  if (!code) return '';
  const c = String(code).padStart(3, '0');
  const found = NIVELES_EDUCATIVOS.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getEstadoCivilLabel(code) {
  if (!code) return '';
  const c = String(code).trim().toUpperCase();
  const found = ESTADOS_CIVILES.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}

export function getNacionalidadLabel(code) {
  if (!code) return '';
  const c = String(code).trim().toUpperCase();
  const found = NACIONALIDADES.find(item => item.code === c);
  return found ? `${found.code}: ${found.description}` : c;
}
