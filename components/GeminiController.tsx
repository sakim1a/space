
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ParticleShape, ParticleState, GeminiControlParams } from '../types';
import { Mic, MicOff, Video, VideoOff, Brain, AlertCircle, RefreshCw, Eye } from 'lucide-react';

// Decoding/Encoding helpers as per guidelines
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const CONTROL_PARTICLES_DECLARATION: FunctionDeclaration = {
  name: 'controlParticles',
  parameters: {
    type: Type.OBJECT,
    description: 'Update the particle system properties based on user gestures or verbal commands.',
    properties: {
      shape: {
        type: Type.STRING,
        description: 'The shape template: sphere, heart, flower, saturn, fireworks, spiral',
        enum: Object.values(ParticleShape)
      },
      color: {
        type: Type.STRING,
        description: 'Hex color string for the particles (e.g. #ff0000)'
      },
      expansion: {
        type: Type.NUMBER,
        description: 'Expansion factor from 0.1 to 5.0'
      },
      rotationSpeed: {
        type: Type.NUMBER,
        description: 'Rotation speed factor from 0.0 to 2.0'
      }
    }
  }
};

interface Props {
  onUpdate: (params: Partial<ParticleState>) => void;
  currentState: ParticleState;
}

export const GeminiController: React.FC<Props> = ({ onUpdate, currentState }) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [lastAction, setLastAction] = useState<string>('Ready for input...');
  const [isSendingFrames, setIsSendingFrames] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const startSession = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;

    try {
      setStatus('connecting');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 480, height: 360, frameRate: 15 } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [CONTROL_PARTICLES_DECLARATION] }],
          systemInstruction: `You are a visionary artist controlling a 3D particle system. 
          STRICTLY monitor the camera feed for these specific hand gestures:
          - SPREAD FINGERS / OPEN PALM: Call controlParticles with expansion > 2.0.
          - CLOSED FIST: Call controlParticles with expansion < 0.5.
          - HEART SHAPE (two hands together): Switch shape to 'heart' and color to pink/red.
          - TWO HANDS waving or moving fast: Increase rotationSpeed to 1.5+.
          - ONE FINGER POINTING: Switch shape to 'spiral'.
          - CIRCULAR HAND MOTION: Switch shape to 'saturn'.
          - CLAPPING or EXCITABLE MOVEMENT: Switch shape to 'fireworks'.
          Always confirm your action verbally with a short, poetic remark. If you see a gesture, call the tool IMMEDIATELY.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!isMicOn) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({ 
                  media: { 
                    data: encode(new Uint8Array(int16.buffer)), 
                    mimeType: 'audio/pcm;rate=16000' 
                  } 
                });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);

            // Increased frame rate to 2 FPS (500ms) for better gesture tracking
            const ctx = canvasRef.current?.getContext('2d');
            frameIntervalRef.current = window.setInterval(() => {
              if (!isCameraOn || !videoRef.current || !ctx || !canvasRef.current) {
                setIsSendingFrames(false);
                return;
              }
              setIsSendingFrames(true);
              ctx.drawImage(videoRef.current, 0, 0, 320, 240);
              canvasRef.current.toBlob(async (blob) => {
                if (blob) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64Data = (reader.result as string).split(',')[1];
                    sessionPromise.then(session => {
                      session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                    });
                  };
                  reader.readAsDataURL(blob);
                }
              }, 'image/jpeg', 0.6);
              
              // Flick the indicator
              setTimeout(() => setIsSendingFrames(false), 150);
            }, 500); 
          },
          onmessage: async (message: LiveServerMessage) => {
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of sourcesRef.current.values()) {
                source.stop();
                sourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;
            }

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64EncodedAudioString), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'controlParticles') {
                  const args = fc.args as GeminiControlParams;
                  onUpdate(args);
                  setLastAction(`Transformed: ${args.shape || 'current shape'}`);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result: 'ok' } }
                    });
                  });
                }
              }
            }
          },
          onerror: (e) => {
            console.error('Gemini Error:', e);
            setStatus('error');
          },
          onclose: () => {
            setStatus('idle');
          }
        }
      });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [isMicOn, isCameraOn, status, onUpdate]);

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      for (const source of sourcesRef.current.values()) {
        source.stop();
      }
    };
  }, []);

  return (
    <div className="fixed top-6 left-6 z-50 pointer-events-none">
      <div className="space-y-4 pointer-events-auto">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl w-64 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              status === 'connected' ? 'bg-emerald-500' : 
              status === 'connecting' ? 'bg-amber-500' : 'bg-zinc-700'
            }`} />
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-tighter">Gemini Live</h2>
              <p className="text-[10px] text-zinc-500 capitalize">{status}</p>
            </div>
          </div>
          {status === 'idle' && (
            <button 
              onClick={startSession}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2 text-xs"
            >
              <RefreshCw size={12} /> Connect
            </button>
          )}
        </div>

        <div className="relative w-64 aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-white/5 shadow-2xl group">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-700 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`} />
          <canvas ref={canvasRef} width={320} height={240} className="hidden" />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="text-indigo-400 w-3 h-3" />
              <p className="text-[10px] text-white/90 font-medium truncate drop-shadow-md">{lastAction}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <button 
                  onClick={() => setIsMicOn(!isMicOn)}
                  className={`p-1.5 rounded-lg transition-colors ${isMicOn ? 'bg-indigo-600/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {isMicOn ? <Mic size={14} /> : <MicOff size={14} />}
                </button>
                <button 
                  onClick={() => setIsCameraOn(!isCameraOn)}
                  className={`p-1.5 rounded-lg transition-colors ${isCameraOn ? 'bg-indigo-600/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {isCameraOn ? <Video size={14} /> : <VideoOff size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isSendingFrames ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-600'}`} />
                 <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Vision</span>
              </div>
            </div>
          </div>

          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
              <VideoOff className="text-zinc-600" size={32} />
            </div>
          )}
        </div>

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" size={16} />
            <p className="text-[10px] text-red-400 leading-tight">Connection failed. Check permissions and API Key.</p>
          </div>
        )}
      </div>
    </div>
  );
};
