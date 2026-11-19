/**
 * Catálogos oficiales de Contratos NISIRA - Agroindustrias Chavín de Huántar S.A.
 * 22 Tipos de Contrato y 6 Códigos de Planilla con formato estricto de texto.
 */

export const TIPOS_CONTRATO = [
  { code: '01', description: 'OBREROS AGRARIO - MANDOS MEDIOS' },
  { code: '02', description: 'EMPLEADOS AGRARIO' },
  { code: '03', description: 'EMPLEADOS GENERAL' },
  { code: '04', description: 'OBREROS AGRARIO - MANDOS MEDIAS RENOVACION' },
  { code: '05', description: 'OBREROS AGRARIO PLANTA - DE EXPORTACIÓN NO TRADICIONAL D.LEY 22342' },
  { code: '06', description: 'RENOVACION OBREROS AGRARIO PLANTA - DE EXPORTACIÓN NO TRADICIONAL D.LEY 22342' },
  { code: '07', description: 'OBREROS AGR EXTRANJEROS - DE EXTRANJERO - D.LEG. 689' },
  { code: '08', description: 'RENOVACION DE CONTRATO AGR EXTRANJERO D.LEG.689' },
  { code: '09', description: 'CONTRATO OBREROS AGRARIO - CAMPO' },
  { code: '10', description: 'RENOVACION CONTRATO OBREROS AGRARIO - CAMPO' },
  { code: '11', description: 'OBREROS AGRARIO - INDETERMINADO' },
  { code: '12', description: 'EMPLEADOS GENERAL - RENOVACION DE CONTRATO' },
  { code: '13', description: 'CONTRATO ERG- ASISTENTE Y ANALISTA' },
  { code: '14', description: 'RENOVACION CONTRATO ERG- ASISTENTE Y ANALISTA' },
  { code: '15', description: '1ER-CONTRATO ERA - SUPERVISORES' },
  { code: '16', description: 'RENOVACION DE CONTRATO ERA - SUPERVISORES' },
  { code: '17', description: 'EMPLEADO AGRARIO - INDETERMINADO' },
  { code: '18', description: 'EMPLEADO GENERAL - INDETERMINADO' },
  { code: '19', description: 'RENOVACION OBRERO_MANGO' },
  { code: '20', description: 'RENOVACION OBREROS_FRESA_A_MANGO' },
  { code: '21', description: 'CONTRATO OBRERO_MANGO' },
  { code: '22', description: 'RENOVACION OBREROS AGRARIO - PLANTA-PALTA' }
];

export const CODIGOS_PLANILLA = [
  { code: 'ERA', description: 'EMPLEADOS REGIMEN AGRARIO' },
  { code: 'ERG', description: 'EMPLEADOS REGIMEN GENERAL' },
  { code: 'ORA', description: 'TEMPORAL' },
  { code: 'ORC', description: 'OBREROS AGRARIO CAMPO' },
  { code: 'ORP', description: 'OBREROS AGRARIO PLANTA' },
  { code: 'PAR', description: 'PRACTICANTES' }
];

export const SUGGESTED_BASICOS = [
  { value: 51.82, label: '51.82 (Jornal Agrario)', category: 'jornal' },
  { value: 53.08, label: '53.08 (Jornal Agrario)', category: 'jornal' },
  { value: 55.88, label: '55.88 (Jornal Agrario)', category: 'jornal' },
  { value: 1800, label: '1,800.00 (Mensual)', category: 'mensual' },
  { value: 2000, label: '2,000.00 (Mensual)', category: 'mensual' },
  { value: 2500, label: '2,500.00 (Mensual)', category: 'mensual' },
  { value: 3000, label: '3,000.00 (Mensual)', category: 'mensual' },
  { value: 3500, label: '3,500.00 (Mensual)', category: 'mensual' },
  { value: 4000, label: '4,000.00 (Mensual)', category: 'mensual' },
  { value: 4500, label: '4,500.00 (Mensual)', category: 'mensual' },
  { value: 5000, label: '5,000.00 (Mensual)', category: 'mensual' },
  { value: 6000, label: '6,000.00 (Mensual)', category: 'mensual' },
  { value: 7000, label: '7,000.00 (Mensual)', category: 'mensual' },
  { value: 8000, label: '8,000.00 (Mensual)', category: 'mensual' },
  { value: 9000, label: '9,000.00 (Mensual)', category: 'mensual' },
  { value: 10000, label: '10,000.00 (Mensual)', category: 'mensual' },
];

/**
 * Busca descripción de Tipo de Contrato por código (ej. "05" -> "OBREROS AGRARIO PLANTA...")
 */
export function getTipoContratoLabel(code) {
  if (!code) return '';
  const item = TIPOS_CONTRATO.find(t => t.code === String(code).padStart(2, '0'));
  return item ? `${item.code}: ${item.description}` : String(code);
}

/**
 * Busca descripción de Código de Planilla (ej. "ORP" -> "OBREROS AGRARIO PLANTA")
 */
export function getCodPlanillaLabel(code) {
  if (!code) return '';
  const item = CODIGOS_PLANILLA.find(p => p.code === String(code).toUpperCase().trim());
  return item ? `${item.code}: ${item.description}` : String(code);
}

/**
 * Normaliza Tipo de Contrato a 2 dígitos con ceros a la izquierda
 */
export function normalizeTipoContrato(val) {
  if (!val && val !== 0) return '';
  const clean = String(val).trim();
  if (!clean) return '';
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 22) {
    return String(num).padStart(2, '0');
  }
  return clean.slice(0, 2);
}

/**
 * Normaliza Código de Planilla a 3 letras mayúsculas
 */
export function normalizeCodPlanilla(val) {
  if (!val) return '';
  return String(val).trim().toUpperCase().slice(0, 3);
}

/**
 * Calcula la fecha de fin de contrato según la fórmula estándar laboral peruana:
 * Fecha Fin = Fecha Inicio + Duración (en meses) - 1 día
 * Ej: Inicio 01/01/2026 + 3 meses => Fin 31/03/2026
 * Retorna fecha en formato YYYY-MM-DD
 */
export function calculateContractEndDate(startDateStr, durationMonths) {
  if (!startDateStr) return '';
  const months = parseInt(durationMonths, 10);
  if (isNaN(months) || months <= 0) return '';

  try {
    // startDateStr puede ser YYYY-MM-DD o DD/MM/YYYY
    let year, month, day;
    if (startDateStr.includes('-')) {
      const parts = startDateStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1; // 0-based
      day = parseInt(parts[2], 10);
    } else if (startDateStr.includes('/')) {
      const parts = startDateStr.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else {
      return '';
    }

    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    // Sumar meses
    const targetMonth = month + months;
    // Creamos fecha con el día siguiente menos 1 día
    // Date constructor maneja overflow de mes correctamente
    const resultDate = new Date(year, targetMonth, day - 1);

    const resYear = resultDate.getFullYear();
    const resMonth = String(resultDate.getMonth() + 1).padStart(2, '0');
    const resDay = String(resultDate.getDate()).padStart(2, '0');

    return `${resYear}-${resMonth}-${resDay}`;
  } catch (e) {
    console.error('Error calculando fecha fin:', e);
    return '';
  }
}

// Re-exportar catálogos completos de NISIRA Personal
export * from './nisiraCatalogs';


