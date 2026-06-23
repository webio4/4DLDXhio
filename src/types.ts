export type TrackType = 'grassland' | 'desert_bumpy' | 'racetrack' | 'mountain' | 'custom_map' | 'metropolis_city' | 'countryside_village' | 'snow_arctic' | 'volcano_lava' | 'ocean_atlantis' | 'synth_wave_grid';
export type CarType = 'sport' | 'cyber' | 'suv' | 'classic' | 'custom';
export type WeatherType = 'sunny' | 'rain' | 'fog' | 'sunset' | 'night';
export type CameraMode = 'third_person' | 'first_person' | 'top_down' | 'front_view' | 'orbit';

export interface CharacterConfig {
  clothingStyle: 'casual' | 'racer' | 'neon' | 'suit';
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  accessory: 'none' | 'sunglasses' | 'neon_backpack' | 'wings';
  headwear: 'hair' | 'helmet' | 'cap';
  helmetColor: string;
}

export interface CustomBlock {
  id: string;
  type: 'cube' | 'ramp' | 'cyl_barrier' | 'star_checkpoint' | 'rock';
  x: number;
  y: number;
  z: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotationY?: number;
}

export interface CustomMapConfig {
  customHillHeight: number;
  customDuneScale: number;
  customRippleFreq: number;
  customFloorLevel: number;
  customObstacleDensity: number;
  trackTheme: 'digital' | 'magma' | 'neon' | 'matrix' | 'classic';
  mapName: string;
  roomCode?: string;
  placedBlocks?: CustomBlock[];
  
  // 10 Server Owner Configurations
  meteorFrequency?: 'none' | 'low' | 'med' | 'high';
  worldGravity?: number;      // weak (4), normal (10), heavy (30)
  npcDensity?: 'sparse' | 'normal' | 'crowded';
  npcSpeed?: number;          // 0.5, 1.0, 2.0, 5.0
  enginePower?: number;       // 1.0, 1.5, 2.5, 5.0
  lockedWeather?: 'dynamic' | 'sunny' | 'sunset' | 'rain' | 'night';
  autoRepair?: boolean;
  timeAttack?: boolean;
  doubleDrift?: boolean;
  invincibleCar?: boolean;
}

export interface CustomCarSpecs {
  bodyLength: number; // 3.0 to 5.0 (default 3.8)
  bodyWidth: number;  // 1.5 to 2.4 (default 1.9)
  bodyHeight: number; // 0.3 to 1.2 (default 0.5)
  wheelSize: number;  // 0.35 to 0.7 (default 0.48)
  spoilerStyle: 'none' | 'winged' | 'twin_fins' | 'brutalist';
  decalStyle: 'none' | 'stripes' | 'neon_grid' | 'beast';
  roofHeight: number; // 0.2 to 0.8 (default 0.45)
  frontCabinLength: number; // 0.8 to 2.2 (default 1.4)
  brand: 'ford' | 'toyota' | 'vinfast' | 'porsche' | 'honda';
  brandStyle: 'classic' | 'neon' | 'sport' | 'military';
  plateNumber: string;
}

export interface PhysicsConfig {
  mass: number;
  engineForce: number;
  brakingForce: number;
  maxSteerAngle: number;
  steeringSpeed: number;
  friction: number;
  driftMode: boolean;
}

export interface GameStats {
  speed: number;
  rpm: number;
  steerAngle: number;
  gear: 'D' | 'R' | 'N';
  distance: number;
  isDrifting: boolean;
  score: number;
  currentCheckpoint: number;
  activeCamera: CameraMode;
  playTime: number;
  posX?: number;
  posZ?: number;
  walkerX?: number;
  walkerY?: number;
  walkerZ?: number;
  fuel?: number;
  explodeCountdown?: number;
  isExploded?: boolean;
  hasGasCanister?: boolean;
  headlightsEnabled?: boolean;
  rotY?: number;
  walkerAngle?: number;
  indicatorMode?: 'none' | 'left' | 'right' | 'hazard';
  isGearManual?: boolean;
  manualGear?: number; // 1: D, -1: R, 0: N, 2: P
  hornActive?: boolean;
}
