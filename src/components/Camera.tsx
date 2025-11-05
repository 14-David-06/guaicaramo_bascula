'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { guaicaramoGradients, guaicaramoShadows } from '@/lib/guaicaramo-theme';

interface CameraProps {
  onPhotoCapture?: (photoDataUrl: string) => void;
}

export default function Camera({ onPhotoCapture }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [editableValues, setEditableValues] = useState({
    peso_bascula: 0,
    peso_neto_campo: 0,
    total_racimos: 0
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<'Fruto' | 'Malla Fruto'>('Fruto');
  const [aiDetectedType, setAiDetectedType] = useState<string>('');

  // Función para enviar feedback de entrenamiento
  const sendTrainingFeedback = useCallback(async (
    aiDetected: string, 
    userCorrected: string, 
    isCorrect: boolean
  ) => {
    try {
      await fetch('/api/training-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiDetectedType: aiDetected,
          userCorrectedType: userCorrected,
          isCorrect,
          extractedData: editableValues,
          imageData: capturedPhoto?.length || 0
        })
      });
      console.log('📚 Feedback enviado para entrenamiento');
    } catch (error) {
      console.warn('Error enviando feedback:', error);
    }
  }, [editableValues, capturedPhoto]);

  useEffect(() => {
    setIsMounted(true);
    
    // Use a more robust auto-start approach
    const attemptAutoStart = () => {
      // Check if video element is available before starting
      if (videoRef.current) {
        console.log('Video element found, starting camera...');
        startCamera();
      } else {
        console.log('Video element not ready, retrying in 500ms...');
        // Retry a few times if element isn't ready
        setTimeout(() => {
          if (videoRef.current) {
            startCamera();
          } else {
            console.log('Video element still not ready, giving up auto-start');
          }
        }, 500);
      }
    };

    const timer = setTimeout(attemptAutoStart, 1000);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      console.log('Intentando iniciar cámara...');
      
      // Validación temprana: verificar que el componente esté montado
      if (!isMounted) {
        console.log('Component not mounted yet, skipping camera start');
        return;
      }
      
      console.log('videoRef.current:', videoRef.current);
      
      if (!videoRef.current) {
        console.error('videoRef.current es null - el elemento video no está disponible');
        // Si el componente está montado pero el videoRef no, reintentamos después de un delay
        setTimeout(() => {
          if (isMounted && videoRef.current) {
            startCamera();
          }
        }, 100);
        return;
      }
      
      setError('');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de cámara no disponible');
      }

      console.log('Solicitando acceso a la cámara...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        },
        audio: false
      });

      console.log('Stream obtenido:', stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          setHasPermission(true);
          console.log('Cámara iniciada exitosamente');
        };
      }
      
    } catch (error) {
      console.error('Error al iniciar cámara:', error);
      setHasPermission(false);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setError('Acceso a la cámara denegado. Por favor, permite el acceso a la cámara en tu navegador.');
        } else if (error.name === 'NotFoundError') {
          setError('No se encontró una cámara. Verifica que tu dispositivo tenga una cámara conectada.');
        } else {
          setError(`Error al acceder a la cámara: ${error.message}`);
        }
      } else {
        setError('Error desconocido al acceder a la cámara');
      }
    }
  }, [isMounted]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Error: No se puede capturar la foto en este momento');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Error: No se puede procesar la imagen');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(photoDataUrl);
    
    // Stop camera after capture
    stopCamera();

    if (onPhotoCapture) {
      onPhotoCapture(photoDataUrl);
    }
  }, [onPhotoCapture, stopCamera]);

  const resetPhoto = useCallback(() => {
    setCapturedPhoto('');
    setAnalysisResult(null);
    setDocumentType('');
    setError('');
    // Automatically restart camera after resetting photo
    if (!isStreaming) {
      startCamera();
    }
  }, [isStreaming, startCamera]);

  // Función para comprimir imagen manteniendo calidad para lectura de números
  const compressImage = useCallback((imageDataUrl: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Dimensiones optimizadas para precisión en lectura de texto
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Dibujar imagen comprimida
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // JPEG con mayor calidad para mejor lectura de números
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const sizeKB = Math.round(compressedDataUrl.length/1024);
        console.log(`🗜️ Imagen súper comprimida: ${sizeKB}KB (max 600px)`);
        resolve(compressedDataUrl);
      };
      
      img.src = imageDataUrl;
    });
  }, []);

  const analyzeImage = useCallback(async (imageDataUrl: string) => {
    try {
      setIsAnalyzing(true);
      setError('');
      setAnalysisResult(null);
      setDocumentType('');
      
      console.log('🚀 Iniciando análisis optimizado...');
      const startTime = Date.now();
      
      // Comprimir imagen para mayor velocidad
      const compressedImage = await compressImage(imageDataUrl);
      console.log('📐 Imagen preparada para análisis');
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: compressedImage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const totalTime = Date.now() - startTime;
      console.log(`✅ Análisis total completado en ${totalTime}ms`);
      
      if (data.success && data.analysis) {
        console.log('Análisis completado:', data.analysis);
        setAnalysisResult(data.analysis);
        setDocumentType('Documento Analizado');
        
        // Usar el tipo detectado por la IA, con fallback
        const tipoDetectado = data.tipo_detectado || 'FRUTO';
        setAiDetectedType(tipoDetectado); // Guardar tipo detectado por IA
        
        if (tipoDetectado === 'MALLA FRUTO' || tipoDetectado.toLowerCase().includes('malla')) {
          setSelectedDocumentType('Malla Fruto');
        } else {
          setSelectedDocumentType('Fruto');
        }
        
        // Mostrar advertencia si hubo timeout
        if (data.warning) {
          setError(`⚠️ ${data.warning}`);
        }

        // Comentado: Mostrar advertencias de validación 
        // if (data.validation && data.validation.warnings.length > 0) {
        //   const confidence = (data.validation.confidence * 100).toFixed(1);
        //   const warnings = data.validation.warnings.join('. ');
        //   setError(`🎯 Confianza: ${confidence}% - ${warnings}`);
        // }
        
        // Inicializar valores editables con los datos extraídos
        if (data.analysis.totales) {
          setEditableValues({
            peso_bascula: data.analysis.totales.peso_bascula || 0,
            peso_neto_campo: data.analysis.totales.peso_neto_campo || 0,
            total_racimos: data.analysis.totales.total_racimos || 0
          });
        }
        
        // Notificar al componente padre si existe callback
        if (onPhotoCapture) {
          onPhotoCapture(data.analysis);
        }
      } else {
        throw new Error(data.error || 'Error en el análisis');
      }
      
    } catch (error) {
      console.error('Error al analizar imagen:', error);
      setError(`Error al analizar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onPhotoCapture]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo es muy grande. Por favor selecciona una imagen menor a 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setCapturedPhoto(result);
        setError('');
        // Reset analysis
        setAnalysisResult(null);
        setDocumentType('');
      }
    };
    reader.onerror = () => {
      setError('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
    
    // Reset the input value
    if (event.target) {
      event.target.value = '';
    }
  }, []);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const sendToDatabase = useCallback(async () => {
    if (!analysisResult) {
      alert('❌ No hay datos para enviar. Primero analiza una imagen.');
      return;
    }

    try {
      setIsSending(true);
      setError('');

      // Usar los valores editables y el tipo de documento seleccionado
      const dataToSend = {
        ...analysisResult,
        tipo_documento: selectedDocumentType === 'Malla Fruto' ? 'Control Diario Cargue de Fruto Mallas' : 'Control Diario Cargue de Fruto',
        totales: {
          peso_bascula: editableValues.peso_bascula,
          peso_neto_campo: editableValues.peso_neto_campo,
          total_racimos: editableValues.total_racimos
        },
        // Agregar información del tipo seleccionado para la lógica de backend
        mallas: selectedDocumentType === 'Malla Fruto' ? [{}] : undefined
      };

      console.log('Enviando a base de datos:', dataToSend);

      const response = await fetch('/api/send-to-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysisData: dataToSend }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('Respuesta de la base de datos:', result);
        
        // Mostrar mensaje de éxito y volver al inicio
        setShowSuccess(true);
        
        // Después de 3 segundos, volver al inicio
        setTimeout(() => {
          resetToInitialState();
        }, 3000);
      } else {
        throw new Error(result.error || 'Error en el envío');
      }

    } catch (error) {
      console.error('Error al enviar a base de datos:', error);
      setError(`❌ Error al enviar a la base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSending(false);
    }
  }, [analysisResult, editableValues]);

  // Función para resetear todo al estado inicial
  const resetToInitialState = useCallback(() => {
    setCapturedPhoto('');
    setAnalysisResult(null);
    setDocumentType('');
    setSelectedDocumentType('Fruto');
    setAiDetectedType(''); // Limpiar tipo detectado por IA
    setShowSuccess(false);
    setEditableValues({
      peso_bascula: 0,
      peso_neto_campo: 0,
      total_racimos: 0
    });
    setError('');
    // Volver a activar la cámara solo si el componente está montado y el video ref está disponible
    if (isMounted && videoRef.current) {
      startCamera();
    }
  }, [startCamera, isMounted]);

  const renderAnalysisResults = () => {
    if (!analysisResult) return null;

    const data = analysisResult;
    
    // Usar el tipo de documento seleccionado por el usuario
    const tipoPeso = selectedDocumentType;
    
    // Mostrar solo los 3 datos específicos requeridos
    if (data.totales) {
      return (
        <div className="space-y-4">
          {/* Dropdown para tipo de documento */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              📝 Tipo de Documento:
            </label>
            <select
              value={selectedDocumentType}
              onChange={(e) => {
                const newType = e.target.value as 'Fruto' | 'Malla Fruto';
                const oldType = selectedDocumentType;
                setSelectedDocumentType(newType);
                
                // Enviar feedback si el usuario cambió el tipo detectado por IA
                if (aiDetectedType && oldType !== newType) {
                  const aiTypeFormatted = aiDetectedType === 'MALLA FRUTO' ? 'Malla Fruto' : 'Fruto';
                  sendTrainingFeedback(aiTypeFormatted, newType, false);
                }
              }}
              className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Fruto">Fruto</option>
              <option value="Malla Fruto">Malla Fruto</option>
            </select>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-4 text-center">📊 Totales</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                <div className="text-center">
                  <input
                    type="number"
                    value={editableValues.peso_bascula}
                    onChange={(e) => setEditableValues(prev => ({...prev, peso_bascula: parseInt(e.target.value) || 0}))}
                    className="text-2xl font-bold text-blue-600 dark:text-blue-400 bg-transparent text-center w-full border-none focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
                  />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                    Peso Báscula (kg)
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-green-200 dark:border-green-700">
                <div className="text-center">
                  <input
                    type="number"
                    value={editableValues.peso_neto_campo}
                    onChange={(e) => setEditableValues(prev => ({...prev, peso_neto_campo: parseInt(e.target.value) || 0}))}
                    className="text-2xl font-bold text-green-600 dark:text-green-400 bg-transparent text-center w-full border-none focus:outline-none focus:ring-2 focus:ring-green-300 rounded"
                  />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                    Peso en Campo (kg)
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-700">
                <div className="text-center">
                  <input
                    type="number"
                    value={editableValues.total_racimos}
                    onChange={(e) => setEditableValues(prev => ({...prev, total_racimos: parseInt(e.target.value) || 0}))}
                    className="text-2xl font-bold text-purple-600 dark:text-purple-400 bg-transparent text-center w-full border-none focus:outline-none focus:ring-2 focus:ring-purple-300 rounded"
                  />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                    Total Racimos
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      );
    }

    // Si no hay datos en totales, mostrar mensaje
    return (
      <div className="text-center py-4">
        <p className="text-gray-500 dark:text-gray-400">No se pudieron extraer los datos específicos del documento</p>
      </div>
    );
  };

  if (!isMounted) {
    return <div>Cargando cámara...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                  ✅ ¡Datos Enviados Exitosamente!
                </h3>
                <p className="text-green-600 dark:text-green-300 mb-2">
                  Los datos han sido guardados en la base de datos correctamente
                </p>
                <p className="text-sm text-green-500 dark:text-green-400">
                  Regresando al inicio en unos segundos...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Camera Section */}
        {!capturedPhoto && (
          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden mb-6">
            {/* Video element always present but conditionally shown */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-auto max-h-96 object-cover ${isStreaming ? 'block' : 'hidden'}`}
            />
            
            {isStreaming ? (
              <div className="relative">
                {/* Solo mostrar el video sin botones superpuestos */}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Cámara no disponible</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={startCamera}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L13.5 12.5a1 1 0 01.293.707V14" />
                      </svg>
                      Activar Cámara
                    </button>
                    <button
                      onClick={triggerFileUpload}
                      className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Cargar Imagen
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Options below camera when streaming */}
            {isStreaming && (
              <div className="bg-white dark:bg-gray-700 p-4 border-t border-gray-200 dark:border-gray-600">
                <div className="text-center space-y-3">
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={capturePhoto}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      Tomar Foto
                    </button>
                    <button
                      onClick={triggerFileUpload}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Cargar Archivo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Captured Photo Section */}
        {capturedPhoto && (
          <div className="mb-6">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden mb-4">
              <img
                src={capturedPhoto}
                alt="Foto capturada"
                className="w-full h-auto max-h-96 object-contain"
              />
            </div>

            {/* Analysis Loading */}
            {isAnalyzing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  ⚡ Análisis Rápido en Proceso...
                </h3>
                <p className="text-blue-600 dark:text-blue-300 text-sm">
                  Extrayendo solo los 3 datos específicos • Optimizado para velocidad
                </p>
                <div className="mt-3">
                  <div className="text-xs text-blue-500 dark:text-blue-400">
                    🗜️ Imagen comprimida • 🎯 Análisis dirigido • ⚡ Respuesta rápida
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!analysisResult && !isAnalyzing && (
              <div className="text-center space-y-4">
                <button
                  onClick={() => analyzeImage(capturedPhoto)}
                  disabled={isAnalyzing}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-3 mx-auto"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Analizar Data
                </button>
                
                <div className="flex items-center gap-2 justify-center">
                  <button
                    onClick={triggerFileUpload}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Cambiar por archivo
                  </button>
                  
                  <button
                    onClick={resetPhoto}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    Tomar otra foto
                  </button>
                </div>
              </div>
            )}

            {/* Analysis Results */}
            {analysisResult && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                    📋 {documentType ? `${documentType} - Datos Extraídos` : 'Datos Extraídos'}
                  </h3>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                  {renderAnalysisResults()}
                </div>
                
                <div className="flex flex-col gap-4 justify-center items-center">
                  {/* Botón principal grande para enviar a base de datos */}
                  <button
                    onClick={sendToDatabase}
                    disabled={isSending || !analysisResult}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Enviar a Base de Datos
                      </>
                    )}
                  </button>
                  
                  {/* Botones secundarios más pequeños */}
                  <div className="flex gap-3 flex-wrap justify-center">
                    <button
                      onClick={triggerFileUpload}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Otra Imagen
                    </button>
                    
                    <button
                      onClick={resetPhoto}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      Nueva Foto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}