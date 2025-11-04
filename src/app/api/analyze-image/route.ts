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

    console.log('Procesando imagen con OpenAI...');

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Por favor, analiza esta imagen y extrae TODA la información visible de manera detallada y estructurada. 
              
              Incluye:
              1. TEXTO: Todo el texto visible (números, letras, palabras, códigos, etc.)
              2. OBJETOS: Describe todos los objetos que ves
              3. DATOS TÉCNICOS: Medidas, pesos, códigos, fechas, etc.
              4. CARACTERÍSTICAS: Colores, formas, materiales, estado
              5. CONTEXTO: Qué tipo de documento/objeto/escena es
              
              Responde en formato JSON estructurado y en español:
              {
                "tipo_documento": "",
                "texto_extraido": [],
                "datos_tecnicos": {},
                "objetos_identificados": [],
                "informacion_adicional": ""
              }`
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
      max_tokens: 1000,
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