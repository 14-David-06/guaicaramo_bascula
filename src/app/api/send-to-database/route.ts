import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

export async function POST(request: NextRequest) {
  try {
    const { analysisData } = await request.json();

    if (!analysisData) {
      return NextResponse.json({ error: 'No analysis data provided' }, { status: 400 });
    }

    console.log('Enviando datos a Airtable:', analysisData);

    // Determinar el tipo de peso basado en el tipo de documento
    let tipoPeso = 'Fruto'; // Default
    if (analysisData.tipo_documento && analysisData.tipo_documento.includes('Mallas')) {
      tipoPeso = 'Malla Fruto';
    }

    // Extraer solo los 3 datos específicos requeridos
    let pesoBascula = 0;
    let totalRacimos = 0;
    let pesoCampo = 0;

    console.log('Análisis de datos recibidos:', analysisData);

    // Buscar primero en totales (la fuente más confiable)
    if (analysisData.totales) {
      console.log('Datos encontrados en totales:', analysisData.totales);
      
      // Peso Báscula - buscar en diferentes posibles nombres
      const pesoBasculaValues = [
        analysisData.totales.peso_bascula,
        analysisData.totales.peso_báscula,
        analysisData.totales['peso bascula'],
        analysisData.totales['peso báscula']
      ];
      
      for (const value of pesoBasculaValues) {
        if (value !== undefined && value !== null) {
          pesoBascula = parseInt(value.toString().replace(/\D/g, '')) || 0;
          break;
        }
      }
      
      // Peso Neto Campo
      const pesoCampoValues = [
        analysisData.totales.peso_neto_campo,
        analysisData.totales.peso_campo,
        analysisData.totales['peso neto campo'],
        analysisData.totales['peso en campo']
      ];
      
      for (const value of pesoCampoValues) {
        if (value !== undefined && value !== null) {
          pesoCampo = parseInt(value.toString().replace(/\D/g, '')) || 0;
          break;
        }
      }
      
      // Total Racimos
      const racimosValues = [
        analysisData.totales.total_racimos,
        analysisData.totales.racimos,
        analysisData.totales['total racimos']
      ];
      
      for (const value of racimosValues) {
        if (value !== undefined && value !== null) {
          totalRacimos = parseInt(value.toString().replace(/\D/g, '')) || 0;
          break;
        }
      }
    }

    console.log('Valores extraídos:', { pesoBascula, pesoCampo, totalRacimos, tipoPeso });

    // Actualizar el tipo de peso basado en el análisis
    // Si hay información de mallas o el tipo de documento menciona mallas
    if (analysisData.mallas || 
        (analysisData.tipo_documento && analysisData.tipo_documento.toLowerCase().includes('mallas'))) {
      tipoPeso = 'Malla Fruto';
      console.log('Tipo de peso actualizado a: Malla Fruto');
    } else {
      console.log('Tipo de peso mantenido como:', tipoPeso);
    }

    // Validar que las variables de entorno estén configuradas
    if (!process.env.AIRTABLE_TIPO_PESO_FIELD || 
        !process.env.AIRTABLE_PESO_BASCULA_FIELD || 
        !process.env.AIRTABLE_PESO_CAMPO_FIELD || 
        !process.env.AIRTABLE_TOTAL_RACIMOS_FIELD) {
      console.error('Error: Variables de entorno de campos Airtable no configuradas');
      return NextResponse.json({ 
        error: 'Configuración de campos Airtable incompleta' 
      }, { status: 500 });
    }

    // Preparar datos para Airtable (los 4 campos requeridos)
    const airtableData = {
      fields: {
        [process.env.AIRTABLE_TIPO_PESO_FIELD]: tipoPeso,
        [process.env.AIRTABLE_PESO_BASCULA_FIELD]: pesoBascula,
        [process.env.AIRTABLE_PESO_CAMPO_FIELD]: pesoCampo,
        [process.env.AIRTABLE_TOTAL_RACIMOS_FIELD]: totalRacimos
      }
    };

    console.log('Datos formateados para Airtable:', airtableData);
    console.log('Field IDs utilizados:');
    console.log('- TIPO_PESO:', process.env.AIRTABLE_TIPO_PESO_FIELD);
    console.log('- PESO_BASCULA:', process.env.AIRTABLE_PESO_BASCULA_FIELD);
    console.log('- PESO_CAMPO:', process.env.AIRTABLE_PESO_CAMPO_FIELD);
    console.log('- TOTAL_RACIMOS:', process.env.AIRTABLE_TOTAL_RACIMOS_FIELD);

    // Debug: Verificar variables de entorno
    console.log('Variables de entorno:');
    console.log('- AIRTABLE_API_KEY:', AIRTABLE_API_KEY ? 'Configurada' : 'NO CONFIGURADA');
    console.log('- BASE_ID:', BASE_ID);
    console.log('- TABLE_ID:', TABLE_ID);
    console.log('- URL completa:', `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);

    // Verificar que las variables estén configuradas
    if (!AIRTABLE_API_KEY || !BASE_ID || !TABLE_ID) {
      throw new Error('Variables de entorno de Airtable no configuradas correctamente');
    }

    // Enviar a Airtable
    const airtableResponse = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(airtableData)
    });

    if (!airtableResponse.ok) {
      const errorData = await airtableResponse.text();
      console.error('Error de Airtable:', errorData);
      console.error('Status:', airtableResponse.status);
      console.error('Headers:', airtableResponse.headers);
      throw new Error(`Airtable API error: ${airtableResponse.status} - ${errorData}`);
    }

    const airtableResult = await airtableResponse.json();
    console.log('Respuesta de Airtable:', airtableResult);

    return NextResponse.json({ 
      success: true, 
      message: 'Datos enviados exitosamente a la base de datos',
      airtableRecord: airtableResult,
      processedData: {
        tipoPeso,
        pesoBascula,
        totalRacimos,
        pesoCampo
      }
    });

  } catch (error) {
    console.error('Error al enviar a base de datos:', error);
    return NextResponse.json({ 
      error: `Error al enviar a la base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}` 
    }, { status: 500 });
  }
}