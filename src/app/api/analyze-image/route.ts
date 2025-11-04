import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    console.log('Identificando tipo de documento...');

    // Primer paso: Identificar el tipo de documento
    const identificationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analiza esta imagen y determina qué tipo de documento es. Busca en el encabezado del documento las palabras clave.

Responde ÚNICAMENTE con una de estas dos opciones:
- "MALLAS" si es un documento de "Control Diario Cargue de Fruto Mallas" o contiene la palabra "MALLAS"
- "FRUTO_NORMAL" si es un documento de "Control Diario Cargue de Fruto" sin la palabra "MALLAS"`
            },
            {
              type: "image_url",
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      max_tokens: 50
    });

    const documentType = identificationResponse.choices[0]?.message?.content?.trim();
    console.log('Tipo de documento detectado:', documentType);
    
    // Determinar el prompt según el tipo de documento
    let analysisPrompt = "";
    
    if (documentType === "MALLAS") {
      analysisPrompt = `Analiza este formato de "CONTROL DIARIO CARGUE DE FRUTO MALLAS" y extrae TODOS los datos importantes de manera estructurada.

              INFORMACIÓN A EXTRAER:
              
              1. **DATOS DE ENCABEZADO:**
                 - Conductor/Transportador
                 - Fecha
                 - Placa del vehículo
                 - Código tractor
                 - Código legal
                 - Reporta

              2. **DATOS DE MALLAS (por cada fila):**
                 - Número de malla
                 - Pesos registrados (todos los valores numéricos)
                 - Códigos de hora/tiempo (formato ##:##)
                 - Observaciones si las hay

              3. **TOTALES Y CÁLCULOS:**
                 - Peso neto campo
                 - Total racimos
                 - Cualquier total calculado
                 - Firmas y nombres de responsables

              4. **CÓDIGOS Y REFERENCIAS:**
                 - Todos los códigos numéricos identificables
                 - Referencias de tiempo y fecha
                 - Números de identificación

              Responde en formato JSON estructurado:
              {
                "tipo_documento": "Control Diario Cargue de Fruto Mallas",
                "fecha": "",
                "conductor": "",
                "placa_vehiculo": "",
                "codigo_tractor": "",
                "codigo_legal": "",
                "reporta": "",
                "mallas": [
                  {
                    "numero_malla": "",
                    "pesos": [],
                    "horarios": [],
                    "observaciones": ""
                  }
                ],
                "totales": {
                  "peso_neto_campo": "",
                  "total_racimos": "",
                  "otros_totales": []
                },
                "responsables": {
                  "firma_conductor": "",
                  "firma_supervisor": "",
                  "otros": []
                },
                "codigos_adicionales": [],
                "observaciones_generales": ""
              }

              IMPORTANTE: Extrae TODOS los números, códigos y texto visible, incluso si no estás seguro de su significado exacto.`;
    } else {
      analysisPrompt = `Analiza este formato de "CONTROL DIARIO CARGUE DE FRUTO" y extrae TODOS los datos importantes de manera estructurada.

              INFORMACIÓN A EXTRAER:
              
              1. **DATOS DE ENCABEZADO:**
                 - Conductor/Transportador
                 - Fecha
                 - Placa del vehículo
                 - Código tractor
                 - Código legal
                 - Reporta

              2. **DATOS DE LA TABLA (por cada fila):**
                 - Número de registro/línea
                 - Peso bruto
                 - Canastillas
                 - Carro
                 - Andamio
                 - Balanza
                 - Peso neto
                 - Tractor
                 - Horario
                 - Observaciones

              3. **TOTALES Y CÁLCULOS:**
                 - Total peso bruto
                 - Total peso neto
                 - Total canastillas
                 - Cualquier subtotal

              4. **CÓDIGOS Y REFERENCIAS:**
                 - Todos los códigos numéricos identificables
                 - Referencias de tiempo y fecha
                 - Números de identificación

              Responde en formato JSON estructurado:
              {
                "tipo_documento": "Control Diario Cargue de Fruto",
                "fecha": "",
                "conductor": "",
                "placa_vehiculo": "",
                "codigo_tractor": "",
                "codigo_legal": "",
                "reporta": "",
                "registros": [
                  {
                    "numero_registro": "",
                    "peso_bruto": 0,
                    "canastillas": 0,
                    "carro": 0,
                    "andamio": 0,
                    "balanza": 0,
                    "peso_neto": 0,
                    "tractor": "",
                    "horario": "",
                    "observaciones": ""
                  }
                ],
                "totales": {
                  "total_peso_bruto": 0,
                  "total_peso_neto": 0,
                  "total_canastillas": 0,
                  "otros_totales": []
                },
                "responsables": {
                  "firma_conductor": "",
                  "firma_supervisor": "",
                  "otros": []
                },
                "codigos_adicionales": [],
                "observaciones_generales": ""
              }

              IMPORTANTE: Extrae TODOS los números, códigos y texto visible, incluso si no estás seguro de su significado exacto.`;
    }

    console.log('Procesando imagen con OpenAI...');

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: analysisPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
    });

    const extractedInfo = response.choices[0].message.content;
    
    console.log('Información extraída:', extractedInfo);

    return NextResponse.json({ 
      success: true, 
      extractedInfo: extractedInfo,
      rawResponse: response.choices[0].message.content
    });

  } catch (error) {
    console.error('Error al procesar imagen:', error);
    return NextResponse.json({ 
      error: 'Error al procesar la imagen', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}