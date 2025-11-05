'use client';

import Camera from "../components/Camera";
import Image from 'next/image';

export default function Home() {
  const handlePhotoCapture = (photoDataUrl: string) => {
    console.log('Fotografía capturada:', photoDataUrl);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <Image
          src="/21032025-DSC_4061.jpg"
          alt="Guaicaramo Background"
          fill
          className="object-cover"
          priority
          quality={100}
        />
        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        {/* Gradient overlay for professional look */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-green-900/30"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        
        {/* Main Content */}
        <main className="container mx-auto px-6 py-12">
          <div className="max-w-5xl mx-auto">
            
            {/* Camera Section */}
            <div className="bg-white/98 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/40 overflow-hidden">
              
              {/* Section Header */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Centro de Procesamiento</h2>
                    <p className="text-slate-300">Capture o cargue documentos para análisis inmediato</p>
                  </div>
                  
                  {/* Processing indicator */}
                  <div className="hidden md:flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-full">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-white text-sm font-medium">Listo para procesar</span>
                  </div>
                </div>
              </div>

              {/* Camera Content */}
              <div className="p-8">
                <Camera onPhotoCapture={handlePhotoCapture} />
              </div>
            </div>


          </div>
        </main>
      </div>
    </div>
  );
}
