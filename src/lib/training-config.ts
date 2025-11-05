// Ejemplos de entrenamiento para mejorar la precisión de la IA
export const TRAINING_EXAMPLES = {
  MALLA_FRUTO: {
    keywords: [
      'malla',
      'mallas',
      'control diario cargue de fruto mallas',
      'embalaje malla',
      'peso malla',
      'tipo: malla'
    ],
    characteristics: [
      'Formato específico para pesaje de mallas',
      'Múltiples entradas de peso por malla',
      'Campos específicos de malla',
      'Referencias a embalaje tipo malla'
    ],
    common_values: {
      peso_ranges: {
        peso_bascula: [10000, 25000], // Rangos típicos
        peso_neto_campo: [8000, 20000],
        total_racimos: [300, 1000]
      }
    }
  },
  
  FRUTO: {
    keywords: [
      'fruto',
      'control diario cargue de fruto',
      'peso fruto',
      'cargue directo',
      'tipo: fruto'
    ],
    characteristics: [
      'Formato estándar de pesaje',
      'Pesaje directo sin embalaje especial',
      'Campos básicos de peso',
      'No referencias a mallas'
    ],
    common_values: {
      peso_ranges: {
        peso_bascula: [5000, 30000],
        peso_neto_campo: [4000, 25000],
        total_racimos: [200, 1500]
      }
    }
  }
};

// Función para generar prompt dinámico basado en ejemplos
export function generateEnhancedPrompt(): string {
  return `EXTRACCIÓN ULTRA PRECISA DE DATOS DE BÁSCULA

DOCUMENTO OBJETIVO: "CONTROL DIARIO CARGUE DE FRUTO"

EJEMPLO REAL A SEGUIR:
- En la imagen verás un documento con una tabla y al FINAL tres campos horizontales
- Campo 1 "Peso Báscula": Ejemplo 13940 (número de 4-5 dígitos)
- Campo 2 "Peso en campo": Ejemplo vacío = 0  
- Campo 3 "Total racimos": Ejemplo 735 (número de 2-4 dígitos)

INSTRUCCIONES CRÍTICAS:
1. IGNORAR toda la tabla superior del documento
2. BUSCAR SOLO la fila horizontal al FINAL del documento
3. LEER números COMPLETOS (no cortar cifras)
4. MAPEAR correctamente cada campo:
   - Peso Báscula = número más grande (típicamente 10000-25000)
   - Peso campo = puede estar vacío (usar 0)
   - Total racimos = número menor (típicamente 200-1500)

TIPOS:
- FRUTO: Título "Control Diario Cargue de Fruto"
- MALLA FRUTO: Título contiene "Malla"

FORMATO DE RESPUESTA OBLIGATORIO:
{"totales":{"peso_bascula":13940,"peso_neto_campo":0,"total_racimos":735},"tipo_detectado":"FRUTO"}

CONCENTRARSE EN LA PARTE INFERIOR DEL DOCUMENTO ÚNICAMENTE.`;
}

// Función para validar la precisión basada en rangos esperados
export function validateExtractedData(data: any, detectedType: string): {
  isValid: boolean;
  confidence: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  let confidence = 1.0;
  
  const examples = TRAINING_EXAMPLES[detectedType as keyof typeof TRAINING_EXAMPLES];
  if (!examples) {
    return { isValid: false, confidence: 0, warnings: ['Tipo de documento no reconocido'] };
  }
  
  const ranges = examples.common_values.peso_ranges;
  
  // Validar rangos típicos
  if (data.peso_bascula < ranges.peso_bascula[0] || data.peso_bascula > ranges.peso_bascula[1]) {
    warnings.push(`Peso báscula fuera del rango típico para ${detectedType}`);
    confidence -= 0.2;
  }
  
  if (data.peso_neto_campo < ranges.peso_neto_campo[0] || data.peso_neto_campo > ranges.peso_neto_campo[1]) {
    warnings.push(`Peso campo fuera del rango típico para ${detectedType}`);
    confidence -= 0.2;
  }
  
  if (data.total_racimos < ranges.total_racimos[0] || data.total_racimos > ranges.total_racimos[1]) {
    warnings.push(`Total racimos fuera del rango típico para ${detectedType}`);
    confidence -= 0.2;
  }
  
  return {
    isValid: warnings.length === 0,
    confidence: Math.max(confidence, 0),
    warnings
  };
}