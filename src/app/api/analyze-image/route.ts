import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateEnhancedPrompt, validateExtractedData } from '@/lib/training-config';
import { validateAndCorrectData } from '@/lib/data-correction';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    console.log("Analizando documento para extraer datos específicos...");
    const startTime = Date.now();

    // Crear timeout MÁS AGRESIVO para limitar tiempo de espera
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout: Análisis tardó más de 10 segundos")), 10000);
    });

    // Optimizaciones MÁXIMAS para velocidad
    const analysisPromise = openai.chat.completions.create({
      model: "gpt-4o-mini", // Modelo más rápido disponible
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: generateEnhancedPrompt()
            },
            {
              type: "image_url",
              image_url: { 
                url: image,
                detail: "high" // Mayor resolución para mejor precisión en lectura de números
              }
            }
          ]
        }
      ],
      max_tokens: 50, // MUY reducido
      temperature: 0, // Determinístico al máximo
      top_p: 0.1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    // Ejecutar con timeout AGRESIVO
    try {
      const analysisResponse = await Promise.race([analysisPromise, timeoutPromise]) as any;
      
      const endTime = Date.now();
      const analysisTime = endTime - startTime;
      console.log(`⚡ Análisis completado en ${analysisTime}ms`);

      const content = analysisResponse.choices[0]?.message?.content;
      console.log("Respuesta de OpenAI:", content);
      
      if (!content) {
        throw new Error("No se recibió respuesta de OpenAI");
      }

      // Parsing JSON súper optimizado
      let analysisData;
      try {
        const cleanContent = content.trim().replace(/```json\s*/, '').replace(/```\s*$/, '');
        analysisData = JSON.parse(cleanContent);
      } catch {
        // Fallback inmediato si no se puede parsear
        console.warn("⚠️ Usando valores por defecto debido a error de parsing");
        analysisData = {
          totales: {
            peso_bascula: 0,
            peso_neto_campo: 0,
            total_racimos: 0
          },
          tipo_detectado: "FRUTO"
        };
      }

      console.log("Datos extraídos:", analysisData);

      // Validación permisiva
      if (!analysisData.totales) {
        analysisData = {
          totales: {
            peso_bascula: analysisData.peso_bascula || 0,
            peso_neto_campo: analysisData.peso_neto_campo || 0,
            total_racimos: analysisData.total_racimos || 0
          },
          tipo_detectado: analysisData.tipo_detectado || "FRUTO"
        };
      }

      // Asegurar que el tipo detectado esté presente
      if (!analysisData.tipo_detectado) {
        analysisData.tipo_detectado = "FRUTO";
      }

      // Sistema de corrección automática
      const correctionResult = validateAndCorrectData({ totales: analysisData.totales });
      
      if (correctionResult.corrections.length > 0) {
        console.log('🔧 Correcciones aplicadas:', correctionResult.corrections);
        analysisData.totales = correctionResult.correctedData;
      }

      // Comentado: Validación deshabilitada por solicitud del usuario
      // const validation = validateExtractedData(
      //   analysisData.totales, 
      //   analysisData.tipo_detectado
      // );

      // console.log(`🎯 Validación: Confianza ${(validation.confidence * 100).toFixed(1)}%`, 
      //   validation.warnings.length > 0 ? validation.warnings : '✅ Datos válidos');

      return NextResponse.json({
        success: true,
        totales: analysisData.totales,
        tipo_detectado: analysisData.tipo_detectado,
        analysis: analysisData
        // validation: {
        //   confidence: validation.confidence,
        //   warnings: validation.warnings
        // }
      });

    } catch (timeoutError) {
      console.warn("⏰ Timeout en análisis IA, devolviendo estructura vacía para edición manual");
      
      // En caso de timeout, devolver estructura vacía para que el usuario pueda editar manualmente
      const fallbackData = {
        totales: {
          peso_bascula: 0,
          peso_neto_campo: 0,
          total_racimos: 0
        },
        tipo_detectado: "FRUTO"
      };

      return NextResponse.json({
        success: true,
        totales: fallbackData.totales,
        tipo_detectado: fallbackData.tipo_detectado,
        analysis: fallbackData,
        warning: "Análisis IA excedió tiempo límite. Por favor edita los valores manualmente."
      });
    }

  } catch (error) {
    console.error("Error en análisis:", error);
    return NextResponse.json({ 
      error: "Error al analizar imagen",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 });
  }
}
