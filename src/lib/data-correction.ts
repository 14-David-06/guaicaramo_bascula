// Sistema de validación y corrección automática
export function validateAndCorrectData(data: any): {
  correctedData: any;
  corrections: string[];
} {
  const corrections: string[] = [];
  const corrected = { ...data.totales };

  // Validación 1: Peso Báscula debe ser mayor que Peso Campo
  if (corrected.peso_bascula < corrected.peso_neto_campo && corrected.peso_neto_campo > 0) {
    // Posible intercambio de valores
    const temp = corrected.peso_bascula;
    corrected.peso_bascula = corrected.peso_neto_campo;
    corrected.peso_neto_campo = temp;
    corrections.push('Intercambiado Peso Báscula y Peso Campo (lógica de peso)');
  }

  // Validación 2: Total Racimos no puede ser mayor a 2000 (límite lógico)
  if (corrected.total_racimos > 2000) {
    // Posible confusión con peso
    if (corrected.peso_neto_campo === 0 && corrected.total_racimos > 5000) {
      corrected.peso_neto_campo = corrected.total_racimos;
      corrected.total_racimos = 0;
      corrections.push('Movido valor alto de racimos a peso campo');
    }
  }

  // Validación 3: Peso Báscula típico entre 5000-30000
  if (corrected.peso_bascula < 1000 && corrected.peso_neto_campo > 5000) {
    // Muy probable que estén intercambiados
    const temp = corrected.peso_bascula;
    corrected.peso_bascula = corrected.peso_neto_campo;
    corrected.peso_neto_campo = temp;
    corrections.push('Corregido orden de pesos por rango típico');
  }

  // Validación 4: Números parciales (ej: 7340 en vez de 13740)
  if (corrected.peso_bascula.toString().length === 4 && 
      corrected.peso_bascula < 10000 && 
      corrected.peso_neto_campo === 0) {
    // Buscar si hay un número similar en total_racimos que podría ser parte del peso
    const pesoStr = corrected.peso_bascula.toString();
    const racimosStr = corrected.total_racimos.toString();
    
    // Si el peso empieza igual que los últimos dígitos de racimos, podría ser un número incompleto
    if (racimosStr.length >= 3 && pesoStr.startsWith(racimosStr.slice(-3))) {
      // Reconstruir número completo
      corrected.peso_bascula = parseInt(`1${pesoStr}`);
      corrections.push('Reconstruido peso báscula completo');
    }
  }

  return {
    correctedData: corrected,
    corrections
  };
}

// Patrones específicos para documentos GUAICARAMO
export const DOCUMENT_PATTERNS = {
  PESO_BASCULA: {
    typical_range: [8000, 25000],
    position_keywords: ['peso báscula', 'peso bascula', 'báscula'],
    format: /\d{4,5}/
  },
  PESO_CAMPO: {
    typical_range: [0, 20000],
    position_keywords: ['peso en campo', 'peso campo', 'campo'],
    format: /\d{0,5}/,
    can_be_empty: true
  },
  TOTAL_RACIMOS: {
    typical_range: [200, 1500],
    position_keywords: ['total racimos', 'racimos', 'total'],
    format: /\d{2,4}/
  }
};