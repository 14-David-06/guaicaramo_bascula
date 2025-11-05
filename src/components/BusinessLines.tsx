'use client';

import { guaicaramoShadows } from '@/lib/guaicaramo-theme';

const businessLines = [
  {
    icon: "🥥",
    name: "Aceites",
    description: "Producción de aceites de palma de alta calidad"
  },
  {
    icon: "🐄", 
    name: "Ganadería",
    description: "Cría y manejo sostenible de ganado"
  },
  {
    icon: "🍊",
    name: "Cítricos", 
    description: "Cultivo y procesamiento de frutas cítricas"
  },
  {
    icon: "🌿",
    name: "Agricultura",
    description: "Productos agrícolas diversos y sostenibles"
  }
];

export default function BusinessLines() {
  return (
    <section className="py-12 bg-green-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Nuestras Líneas de Negocio
          </h2>
          <p className="text-gray-600 text-lg">
            Diversificación productiva con enfoque sostenible
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {businessLines.map((line, index) => (
            <div 
              key={index}
              className={`${guaicaramoShadows.md} bg-white rounded-xl p-6 text-center hover:scale-105 transition-all duration-300 border border-green-100`}
            >
              <div className="text-4xl mb-4">{line.icon}</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{line.name}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{line.description}</p>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-8">
          <p className="text-green-700 font-medium">
            "Trabajamos con responsabilidad por amor a nuestra labor"
          </p>
        </div>
      </div>
    </section>
  );
}