
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleShape } from '../types';

// Add global augmentation for React Three Fiber intrinsic elements to fix JSX errors
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

const COUNT = 12000;

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ shape, color, expansion, pointSize }) => {
  const meshRef = useRef<THREE.Points>(null!);
  
  // Create static buffers
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  const targetPositions = useMemo(() => new Float32Array(COUNT * 3), []);
  
  // Shape generators
  const generateShape = (targetShape: ParticleShape) => {
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      let x = 0, y = 0, z = 0;

      switch (targetShape) {
        case ParticleShape.HEART:
          const t = Math.random() * Math.PI * 2;
          const u = Math.random() * 2 - 1;
          const r = Math.pow(Math.random(), 1/3) * 2;
          x = 16 * Math.pow(Math.sin(t), 3) * 0.1 * r;
          y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 0.1 * r;
          z = (Math.random() - 0.5) * 0.5 * r;
          break;

        case ParticleShape.FLOWER:
          const angle = i * 0.1;
          const radius = Math.sqrt(i / COUNT) * 3;
          const petalCount = 6;
          const petalStrength = Math.sin(angle * petalCount) * 0.5;
          x = radius * (1 + petalStrength) * Math.cos(angle);
          y = radius * (1 + petalStrength) * Math.sin(angle);
          z = (Math.random() - 0.5) * 0.5;
          break;

        case ParticleShape.SATURN:
          if (i < COUNT * 0.6) {
            // Sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const sr = Math.random() * 2;
            x = sr * Math.sin(phi) * Math.cos(theta);
            y = sr * Math.sin(phi) * Math.sin(theta);
            z = sr * Math.cos(phi);
          } else {
            // Ring
            const inner = 3;
            const outer = 5;
            const ringR = inner + Math.random() * (outer - inner);
            const ringAngle = Math.random() * Math.PI * 2;
            x = ringR * Math.cos(ringAngle);
            y = ringR * Math.sin(ringAngle) * 0.2; // Tilted ring
            z = ringR * Math.sin(ringAngle);
          }
          break;

        case ParticleShape.FIREWORKS:
          const explodeR = Math.pow(Math.random(), 0.5) * 6;
          const exAngle = Math.random() * Math.PI * 2;
          const exPhi = Math.acos(2 * Math.random() - 1);
          x = explodeR * Math.sin(exPhi) * Math.cos(exAngle);
          y = explodeR * Math.sin(exPhi) * Math.sin(exAngle);
          z = explodeR * Math.cos(exPhi);
          break;

        case ParticleShape.SPIRAL:
          const sAngle = 0.1 * i;
          const sR = 0.05 * i / 100;
          x = sR * Math.cos(sAngle);
          y = 0.005 * i - 3;
          z = sR * Math.sin(sAngle);
          break;

        case ParticleShape.SPHERE:
        default:
          const stheta = Math.random() * Math.PI * 2;
          const sphi = Math.acos(2 * Math.random() - 1);
          const rr = Math.random() * 3;
          x = rr * Math.sin(sphi) * Math.cos(stheta);
          y = rr * Math.sin(sphi) * Math.sin(stheta);
          z = rr * Math.cos(sphi);
          break;
      }
      targetPositions[i3] = x;
      targetPositions[i3 + 1] = y;
      targetPositions[i3 + 2] = z;
    }
  };

  // Initial shape
  useMemo(() => generateShape(shape), []);

  useEffect(() => {
    generateShape(shape);
  }, [shape]);

  useFrame((state, delta) => {
    const posAttr = meshRef.current.geometry.attributes.position;
    const lerpSpeed = 0.05;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      
      // Interpolate current position towards target * expansion
      posAttr.array[i3] += (targetPositions[i3] * expansion - posAttr.array[i3]) * lerpSpeed;
      posAttr.array[i3 + 1] += (targetPositions[i3 + 1] * expansion - posAttr.array[i3 + 1]) * lerpSpeed;
      posAttr.array[i3 + 2] += (targetPositions[i3 + 2] * expansion - posAttr.array[i3 + 2]) * lerpSpeed;
    }
    posAttr.needsUpdate = true;
  });

  const particleColor = new THREE.Color(color);

  return (
    /* Fixed: Property 'points' error by adding global JSX augmentation */
    <points ref={meshRef}>
      {/* Fixed: Property 'bufferGeometry' error by adding global JSX augmentation */}
      <bufferGeometry>
        {/* Fixed: Property 'bufferAttribute' error by adding global JSX augmentation */}
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      {/* Fixed: Property 'pointsMaterial' error by adding global JSX augmentation */}
      <pointsMaterial
        size={pointSize}
        color={particleColor}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

interface ParticleSystemProps {
  shape: ParticleShape;
  color: string;
  expansion: number;
  pointSize: number;
}
