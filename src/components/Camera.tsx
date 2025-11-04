'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

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
      console.log('videoRef.current:', videoRef.current);
      
      if (!videoRef.current) {
        console.error('videoRef.current es null - el elemento video no está disponible');
        // Don't set error for auto-start, just log and return silently
        if (!isMounted) {
          console.log('Component not mounted yet, skipping camera start');
          return;
        }
        setError('Error: Elemento de video no disponible. Intenta usar el botón manual.');
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

  const analyzeImage = useCallback(async (imageDataUrl: string) => {
    try {
      setIsAnalyzing(true);
      setError('');
      setAnalysisResult(null);
      setDocumentType('');
      
      console.log('Enviando imagen para análisis...');
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('Análisis completado:', data.extractedInfo);
        
        // Intentar parsear el JSON de la respuesta
        try {
          const parsedInfo = JSON.parse(data.extractedInfo);
          setAnalysisResult(parsedInfo);
          setDocumentType(parsedInfo.tipo_documento || 'Documento no identificado');
        } catch (parseError) {
          // Si no se puede parsear como JSON, usar como texto
          setAnalysisResult({ raw_text: data.extractedInfo });
          setDocumentType('Análisis de texto');
        }
        
        // Notificar al componente padre si existe callback
        if (onPhotoCapture) {
          onPhotoCapture(data.extractedInfo);
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

  const renderAnalysisResults = () => {
    if (!analysisResult) return null;

    const data = analysisResult;

    // Renderizar documento de MALLAS
    if (data.tipo_documento && data.tipo_documento.includes('Mallas')) {
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">📄 Información General</h4>
            <div className="text-sm space-y-1">
              <p><strong>Fecha:</strong> {data.fecha || 'N/A'}</p>
              <p><strong>Conductor:</strong> {data.conductor || 'N/A'}</p>
              <p><strong>Placa:</strong> {data.placa_vehiculo || 'N/A'}</p>
              <p><strong>Código Tractor:</strong> {data.codigo_tractor || 'N/A'}</p>
              <p><strong>Reporta:</strong> {data.reporta || 'N/A'}</p>
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">📊 Totales</h4>
            <div className="text-sm space-y-1">
              <p><strong>Peso Neto Campo:</strong> {data.totales?.peso_neto_campo || 'N/A'}</p>
              <p><strong>Total Racimos:</strong> {data.totales?.total_racimos || 'N/A'}</p>
            </div>
          </div>
          
          {data.mallas && data.mallas.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">🥭 Mallas Registradas</h4>
              <div className="text-sm">
                <p><strong>Total mallas:</strong> {data.mallas.length}</p>
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                  {data.mallas.slice(0, 3).map((malla: any, index: number) => (
                    <div key={index} className="border-l-2 border-yellow-400 pl-2">
                      <p><strong>Malla {malla.numero_malla}:</strong> {malla.pesos ? malla.pesos.join(', ') : 'Sin pesos'}</p>
                    </div>
                  ))}
                  {data.mallas.length > 3 && <p className="text-gray-500">... y {data.mallas.length - 3} mallas más</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Renderizar documento de FRUTO NORMAL
    else if (data.tipo_documento && data.tipo_documento.includes('Control Diario Cargue de Fruto')) {
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">📄 Información General</h4>
            <div className="text-sm space-y-1">
              <p><strong>Fecha:</strong> {data.fecha || 'N/A'}</p>
              <p><strong>Conductor:</strong> {data.conductor || 'N/A'}</p>
              <p><strong>Placa:</strong> {data.placa_vehiculo || 'N/A'}</p>
              <p><strong>Código Tractor:</strong> {data.codigo_tractor || 'N/A'}</p>
              <p><strong>Reporta:</strong> {data.reporta || 'N/A'}</p>
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">⚖️ Totales de Peso</h4>
            <div className="text-sm space-y-1">
              <p><strong>Total Peso Bruto:</strong> {data.totales?.total_peso_bruto || 'N/A'}</p>
              <p><strong>Total Peso Neto:</strong> {data.totales?.total_peso_neto || 'N/A'}</p>
              <p><strong>Total Canastillas:</strong> {data.totales?.total_canastillas || 'N/A'}</p>
            </div>
          </div>
          
          {data.registros && data.registros.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">📦 Registros de Carga</h4>
              <div className="text-sm">
                <p><strong>Total registros:</strong> {data.registros.length}</p>
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                  {data.registros.slice(0, 3).map((registro: any, index: number) => (
                    <div key={index} className="border-l-2 border-orange-400 pl-2">
                      <p><strong>Registro {registro.numero_registro || index + 1}:</strong></p>
                      <p className="text-xs">Bruto: {registro.peso_bruto} | Neto: {registro.peso_neto} | Canastillas: {registro.canastillas}</p>
                    </div>
                  ))}
                  {data.registros.length > 3 && <p className="text-gray-500">... y {data.registros.length - 3} registros más</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Formato genérico para otros tipos de documentos
    else {
      return (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/20 p-3 rounded">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📄 Información Extraída</h4>
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      );
    }
  };

  if (!isMounted) {
    return <div>Cargando cámara...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">📸 Análisis de Documentos</h2>
        <p className="text-blue-100">Captura o carga imágenes de control de fruto y mallas para análisis automático</p>
      </div>

      <div className="p-6">
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
              <div>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Error</h3>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Intentar Cámara
              </button>
              <button
                onClick={triggerFileUpload}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Cargar Archivo
              </button>
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
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 bg-white hover:bg-gray-100 border-4 border-blue-500 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center justify-center"
                >
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </button>
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
                  🔍 Analizando Documento...
                </h3>
                <p className="text-blue-600 dark:text-blue-300">
                  La IA está extrayendo toda la información de la imagen
                </p>
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
                  Enviar Data
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
                
                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    onClick={() => {
                      const dataToShare = typeof analysisResult === 'object' ? JSON.stringify(analysisResult, null, 2) : analysisResult;
                      navigator.clipboard.writeText(dataToShare);
                      alert('📋 Información copiada al portapapeles');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar
                  </button>
                  
                  <button
                    onClick={() => {
                      const dataToDownload = typeof analysisResult === 'object' ? JSON.stringify(analysisResult, null, 2) : analysisResult;
                      const blob = new Blob([dataToDownload], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `control-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar
                  </button>
                  
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
            )}
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}