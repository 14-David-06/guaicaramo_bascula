import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json({ 
        error: 'AIRTABLE_API_KEY no configurada',
        help: 'Asegúrate de que la variable de entorno AIRTABLE_API_KEY esté configurada en .env.local'
      }, { status: 400 });
    }

    // Obtener las bases de Airtable del usuario
    const response = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ 
        error: 'Error al obtener bases de Airtable',
        details: errorData,
        status: response.status
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      success: true,
      message: 'Bases de Airtable encontradas',
      bases: data.bases,
      help: 'Encuentra tu base "Control Diario Cargue de Fruto" en la lista y usa su ID'
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}` 
    }, { status: 500 });
  }
}