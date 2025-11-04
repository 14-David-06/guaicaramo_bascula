'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface CameraProps {
  onPhotoCapture?: (photoDataUrl: string) => void;
}

export default function Camera({ onPhotoCapture }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      console.log('Intentando iniciar cámara...');
      console.log('videoRef.current:', videoRef.current);
      
      if (!videoRef.current) {
        console.error('videoRef.current es null - el elemento video no está disponible');
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
          facingMode: 'environment' // Use back camera on mobile devices
        },
        audio: false
      });

      console.log('Stream obtenido:', stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Stream asignado al video element');
        setIsStreaming(true);
        setHasPermission(true);
      } else {
        console.error('videoRef.current se volvió null después de obtener el stream');
        // Clean up the stream if video element is not available
        stream.getTracks().forEach(track => track.stop());
        setError('Error: Elemento de video no disponible después de obtener permisos.');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setHasPermission(false);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Se necesita acceso a la cámara para tomar fotografías. Por favor, permite el acceso y recarga la página.');
        } else if (err.name === 'NotFoundError') {
          setError('No se encontró ninguna cámara en el dispositivo.');
        } else {
          setError('Error al acceder a la cámara: ' + err.message);
        }
      } else {
        setError('Error desconocido al acceder a la cámara.');
      }
    }
  }, []);

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
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(photoDataUrl);
    
    if (onPhotoCapture) {
      onPhotoCapture(photoDataUrl);
    }
  }, [onPhotoCapture]);

  const resetPhoto = useCallback(() => {
    setCapturedPhoto('');
    setAnalysisResult(null);
    // Automatically restart camera after resetting photo
    if (!isStreaming) {
      startCamera();
    }
  }, [isStreaming, startCamera]);

  const analyzeImage = useCallback(async (imageDataUrl: string) => {
    try {
      setIsAnalyzing(true);
      setError('');
      
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
        setAnalysisResult(data.extractedInfo);
        
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-start camera when component mounts
  useEffect(() => {
    console.log('Effect ejecutándose - isMounted:', isMounted);
    
    if (isMounted) {
      console.log('Componente montado, intentando iniciar cámara...');
      // Add a small delay to ensure video element is fully mounted
      const timer = setTimeout(() => {
        console.log('Timer ejecutándose, videoRef.current:', videoRef.current);
        startCamera();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isMounted, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Don't render anything until mounted (prevents hydration mismatch)
  if (!isMounted) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-2xl font-bold text-center text-white flex items-center justify-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Cámara Profesional
            </h2>
          </div>
          <div className="p-8">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 text-lg">Cargando sistema...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-6">
            <h2 className="text-2xl font-bold text-center text-white flex items-center justify-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Error de Compatibilidad
            </h2>
          </div>
          <div className="p-8">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 text-lg">
                Tu navegador no soporta el acceso a la cámara. Por favor, usa un navegador moderno como Chrome, Firefox o Safari.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <h2 className="text-2xl font-bold text-center text-white flex items-center justify-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Cámara Profesional
          </h2>
        </div>

        <div className="p-8">
          {/* Video element - always present for ref, visibility controlled by isStreaming */}
          <div className={`relative bg-gray-900 rounded-xl overflow-hidden shadow-inner ${isStreaming ? 'block mb-6' : 'hidden'}`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto max-h-[500px] object-cover"
            />
            {isStreaming && (
              <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                EN VIVO
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-red-800 dark:text-red-200 font-semibold">Error de Cámara</h3>
              </div>
              <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reintentar
              </button>
            </div>
          )}

          {!isStreaming && !capturedPhoto && !error && (
            <div className="text-center py-12">
              <div className="mb-8">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Iniciando Cámara...
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Solicitando permisos de cámara. Por favor, permite el acceso.
                </p>
              </div>
              
              <button
                onClick={startCamera}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-3 mx-auto"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h6m2 5H7a2 2 0 01-2-2V9a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V16a2 2 0 01-2 2z" />
                </svg>
                Activar Cámara Manualmente
              </button>
              <p className="text-xs text-gray-400 mt-2">Si no se activa automáticamente</p>
            </div>
          )}

          {isStreaming && (
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={capturePhoto}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Capturar Foto
              </button>
              <button
                onClick={stopCamera}
                className="px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                Detener
              </button>
            </div>
          )}

          {capturedPhoto && (
            <div className="space-y-6">
              <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-inner">
                <img
                  src={capturedPhoto}
                  alt="Fotografía capturada"
                  className="w-full h-auto max-h-[500px] object-cover"
                />
              </div>
              
              {!analysisResult && !isAnalyzing && (
                <div className="text-center">
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
                </div>
              )}

              {isAnalyzing && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent mb-4"></div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Analizando Imagen...
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    La IA está extrayendo toda la información de la imagen
                  </p>
                </div>
              )}

              {analysisResult && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                      Información Extraída
                    </h3>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                      {analysisResult}
                    </pre>
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(analysisResult);
                        alert('Información copiada al portapapeles');
                      }}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar
                    </button>
                    
                    <button
                      onClick={resetPhoto}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  );
}