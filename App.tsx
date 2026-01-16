
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas, ThreeElements } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Float } from '@react-three/drei';
import { ParticleSystem } from './components/ParticleSystem';
import { ParticleShape, ParticleState } from './types';
import { GeminiController } from './components/GeminiController';
import { Menu, Sparkles, Camera, Mic, Info, Play } from 'lucide-react';

// Add global augmentation for React Three Fiber intrinsic elements to fix JSX errors
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

const App: React.FC = () => {
  const [particleState, setParticleState] = useState<ParticleState>({
    shape: ParticleShape.SPHERE,
    color: '#4f46e5',
    expansion: 1.0,
    rotationSpeed: 0.5,
    pointSize: 0.05
  });

  const [isActive, setIsActive] = useState(false);
  const [showUI, setShowUI] = useState(true);

  const updateState = useCallback((params: Partial<ParticleState>) => {
    setParticleState(prev => ({ ...prev, ...params }));
  }, []);

  if (!isActive) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 z-50">
        <div className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center animate-pulse">
            <Sparkles className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Particle Alchemy</h1>
          <p className="text-zinc-400">
            Experience a 3D generative world controlled by your hands and voice. Powered by Gemini 2.5 Flash.
          </p>
          <button
            onClick={() => setIsActive(true)}
            className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group"
          >
            <Play className="fill-black group-hover:scale-110 transition-transform" />
            Enter Experience
          </button>
          <div className="flex justify-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Camera size={14} /> Camera required</span>
            <span className="flex items-center gap-1"><Mic size={14} /> Microphone optional</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      {/* 3D Scene */}
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={60} />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          rotateSpeed={0.5} 
          autoRotate={true}
          autoRotateSpeed={particleState.rotationSpeed * 2}
        />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        {/* Fixed: Property 'ambientLight' error by adding global JSX augmentation */}
        <ambientLight intensity={0.5} />
        {/* Fixed: Property 'pointLight' error by adding global JSX augmentation */}
        <pointLight position={[10, 10, 10]} intensity={1} />

        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <ParticleSystem 
            shape={particleState.shape} 
            color={particleState.color}
            expansion={particleState.expansion}
            pointSize={particleState.pointSize}
          />
        </Float>
      </Canvas>

      {/* Gemini Integration Overlay */}
      <GeminiController onUpdate={updateState} currentState={particleState} />

      {/* UI Controls Overlay */}
      <div className={`fixed bottom-0 left-0 right-0 p-6 pointer-events-none transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-end justify-between gap-4 pointer-events-auto">
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl w-full md:w-auto shadow-2xl">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Menu size={16} /> Quick Templates
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {Object.values(ParticleShape).map((s) => (
                <button
                  key={s}
                  onClick={() => updateState({ shape: s })}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                    particleState.shape === s 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl space-y-4 w-full md:w-64 shadow-2xl">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                <span>Expansion</span>
                <span>{particleState.expansion.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.1" max="5.0" step="0.1"
                value={particleState.expansion}
                onChange={(e) => updateState({ expansion: parseFloat(e.target.value) })}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                <span>Core Color</span>
                <span className="uppercase">{particleState.color}</span>
              </div>
              <div className="flex gap-2">
                {['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#ef4444'].map(c => (
                  <button
                    key={c}
                    onClick={() => updateState({ color: c })}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-125 ${particleState.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={() => setShowUI(!showUI)}
        className="fixed top-6 right-6 p-3 bg-zinc-900/80 backdrop-blur-lg border border-white/10 rounded-full text-zinc-400 hover:text-white transition-colors z-20"
      >
        <Info size={20} />
      </button>

      {/* Aesthetic gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
    </div>
  );
};

export default App;
