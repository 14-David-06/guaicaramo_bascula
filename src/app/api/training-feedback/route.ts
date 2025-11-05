import { NextRequest, NextResponse } from 'next/server';

// API para recopilar feedback de entrenamiento
export async function POST(request: NextRequest) {
  try {
    const { 
      imageData, 
      aiDetectedType, 
      userCorrectedType, 
      extractedData, 
      isCorrect 
    } = await request.json();

    // Log para análisis posterior
    const feedbackData = {
      timestamp: new Date().toISOString(),
      ai_detected: aiDetectedType,
      user_corrected: userCorrectedType,
      correction_needed: aiDetectedType !== userCorrectedType,
      extracted_data: extractedData,
      accuracy: isCorrect,
      image_size: imageData?.length || 0
    };

    console.log('📚 Feedback de Entrenamiento:', feedbackData);

    // Aquí puedes guardar en una base de datos para análisis
    // await saveTrainingFeedback(feedbackData);

    // Detectar patrones para mejorar el prompt
    if (feedbackData.correction_needed) {
      console.log('🔍 Corrección detectada:', {
        de: aiDetectedType,
        a: userCorrectedType,
        datos: extractedData
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback registrado para entrenamiento'
    });

  } catch (error) {
    console.error('Error al procesar feedback:', error);
    return NextResponse.json(
      { error: 'Error al procesar feedback de entrenamiento' },
      { status: 500 }
    );
  }
}

// Función para analizar patrones de error
export async function GET() {
  try {
    // Aquí podrías devolver estadísticas de precisión
    const stats = {
      total_analyses: 0, // Implementar contador
      accuracy_rate: 0, // Calcular precisión
      common_errors: [], // Errores más frecuentes
      improvement_suggestions: []
    };

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}