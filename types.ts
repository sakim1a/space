
export enum ParticleShape {
  SPHERE = 'sphere',
  HEART = 'heart',
  FLOWER = 'flower',
  SATURN = 'saturn',
  FIREWORKS = 'fireworks',
  SPIRAL = 'spiral'
}

export interface ParticleState {
  shape: ParticleShape;
  color: string;
  expansion: number;
  rotationSpeed: number;
  pointSize: number;
}

export interface GeminiControlParams {
  shape?: ParticleShape;
  color?: string;
  expansion?: number;
  rotationSpeed?: number;
}
