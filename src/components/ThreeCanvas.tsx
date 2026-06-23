import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TrackType, CarType, WeatherType, PhysicsConfig, GameStats, CameraMode, CustomCarSpecs, CharacterConfig, CustomMapConfig } from '../types';
import { soundEngine } from '../utils/AudioEngine';

interface ThreeCanvasProps {
  selectedCar: CarType;
  carColor: string;
  selectedTrack: TrackType;
  weather: WeatherType;
  physicsConfig: PhysicsConfig;
  cameraMode: CameraMode;
  resetCounter: number;
  isMuted: boolean;
  onStatsChange: (stats: Partial<GameStats>) => void;
  onCollision: () => void;
  onCheckpoint: () => void;
  isAccelerating: boolean; // For mobile controls
  isBraking: boolean;      // For mobile controls
  steerLeft: boolean;      // For mobile controls
  steerRight: boolean;     // For mobile controls
  customCarSpecs: CustomCarSpecs;
  damage: number;
  onRepairTick: (amount: number) => void;
  playerMode: 'driving' | 'walking';
  setPlayerMode: (mode: 'driving' | 'walking') => void;
  characterConfig: CharacterConfig;
  customMapConfig: CustomMapConfig;
  customLogoText?: string;
}

let activeCanvasCustomMapConfig: CustomMapConfig | undefined = undefined;

// Math equations to get terrain heights & normal dynamically
export function getTerrainHeight(x: number, z: number, track: TrackType, customMap?: CustomMapConfig): number {
  const finalMap = customMap || activeCanvasCustomMapConfig;
  switch (track) {
    case 'custom_map': {
      const hillH = Math.sin(x * 0.01) * Math.cos(z * 0.01) * (finalMap?.customHillHeight ?? 4.0);
      const dunes = Math.sin(x * 0.02) * (finalMap?.customDuneScale ?? 2.5) + Math.cos(z * 0.015) * (finalMap?.customDuneScale ?? 2.0);
      const ripples = Math.sin(x * (finalMap?.customRippleFreq ?? 0.15)) * Math.cos(z * (finalMap?.customRippleFreq ?? 0.15)) * 0.45;
      const base = finalMap?.customFloorLevel ?? 0;
      return hillH + dunes + ripples + base;
    }
    case 'grassland': {
      // Gentle slopes with some hills nearby
      const hillH = Math.sin(x * 0.012) * Math.cos(z * 0.012) * 3;
      const waveH = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 0.5;
      return hillH + waveH;
    }
    case 'desert_bumpy': {
      // Heavy sand dunes and bumpy mounds
      const dunes = Math.sin(x * 0.02) * 2.5 + Math.cos(z * 0.015) * 2.0;
      const ripples = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 0.45;
      return dunes + ripples;
    }
    case 'mountain': {
      // Steep canyon shapes with flat roads
      // Road is around z = sin(x * 0.02) * 50
      const roadZ = Math.sin(x * 0.02) * 45;
      const distanceFromRoad = Math.abs(z - roadZ);
      
      const valleyFloor = -1;
      const cliffHeight = Math.pow(Math.max(0, (distanceFromRoad - 18) * 0.4), 1.6);
      const bumpyTerrain = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.5;

      return valleyFloor + cliffHeight + bumpyTerrain;
    }
    case 'racetrack': {
      // Racetrack contains a custom paved track.
      // Let's create an elegant smooth loop at z = sin(x * 0.02) * 40
      // We check distance to the track. If on track, height is extremely flat. If off key, bumpy grass!
      const roadR = 50; // loop
      const distToCenter = Math.sqrt(x * x + z * z);
      const trackDist = Math.abs(distToCenter - roadR);
      
      if (trackDist < 12) {
        // Flat asphalt road with a slight banking curve
        return Math.sin(Math.atan2(z, x) * 3) * 0.5;
      } else {
        // Bumpy hills outside
        return 1.5 + Math.sin(x * 0.03) * Math.cos(z * 0.03) * 2.5;
      }
    }
    case 'metropolis_city': {
      // Flat metropolis urban streets
      return 0;
    }
    case 'countryside_village': {
      // Gentle soft hills of countryside village, with dynamic paddy fields and level changes
      const majorField = Math.sin(x * 0.008) * Math.cos(z * 0.008) * 1.5;
      const rippleLawn = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 0.2;
      return majorField + rippleLawn;
    }
    case 'snow_arctic': {
      // Snowy glaciers and dunes and mounds
      const glacierH = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 2.2;
      const iceDrifts = Math.sin(x * 0.08) * 0.3 + Math.cos(z * 0.08) * 0.25;
      return glacierH + iceDrifts;
    }
    case 'volcano_lava': {
      // Magma cracks, hot level platforms
      const crackBase = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 2.8;
      const spikes = Math.sin(x * 0.07) * 0.5 + Math.cos(z * 0.07) * 0.5;
      return crackBase + spikes;
    }
    case 'ocean_atlantis': {
      // undulating seabed with sunken trenches
      const sandDunes = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 1.8;
      const trenches = Math.sin(x * 0.007) * 4.0;
      return sandDunes + trenches;
    }
    case 'synth_wave_grid': {
      // flat neon high-tech network grid
      return 0;
    }
    default:
      return 0;
  }
}

export function getSurfaceHeight(x: number, y: number, track: TrackType, customMap?: CustomMapConfig): number {
  const terrainH = getTerrainHeight(x, y, track, customMap);
  const finalMap = customMap || activeCanvasCustomMapConfig;
  if (track !== 'custom_map' || !finalMap || !finalMap.placedBlocks || finalMap.placedBlocks.length === 0) {
    return terrainH;
  }

  let highestH = terrainH;
  finalMap.placedBlocks.forEach((block) => {
    const dx = x - block.x;
    const dz = y - block.z; // note: three.js plane Y is matching grid Z space

    if (block.type === 'cube') {
      const halfW = (block.scaleX || 4) / 2;
      const halfD = (block.scaleZ || 4) / 2;
      if (Math.abs(dx) <= halfW && Math.abs(dz) <= halfD) {
        const topH = block.y + (block.scaleY || 3);
        if (topH > highestH) {
          highestH = topH;
        }
      }
    } else if (block.type === 'ramp') {
      const halfW = (block.scaleX || 5) / 2;
      const halfD = (block.scaleZ || 8) / 2;
      if (Math.abs(dx) <= halfW && Math.abs(dz) <= halfD) {
        // Linear interpolation from bottom (-halfD) to top (+halfD)
        const t = (dz + halfD) / (block.scaleZ || 8);
        const topH = block.y + t * (block.scaleY || 2);
        if (topH > highestH) {
          highestH = topH;
        }
      }
    } else if (block.type === 'cyl_barrier') {
      const radius = block.scaleX || 0.6;
      const distSq = dx * dx + dz * dz;
      if (distSq <= radius * radius) {
        const topH = block.y + (block.scaleY || 3);
        if (topH > highestH) {
          highestH = topH;
        }
      }
    } else if (block.type === 'rock') {
      const size = block.scaleX || 2.0;
      const distSq = dx * dx + dz * dz;
      if (distSq <= size * size) {
        const topH = block.y + size * 0.8;
        if (topH > highestH) {
          highestH = topH;
        }
      }
    }
  });

  return highestH;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  selectedCar,
  carColor,
  selectedTrack,
  weather,
  physicsConfig,
  cameraMode,
  resetCounter,
  isMuted,
  onStatsChange,
  onCollision,
  onCheckpoint,
  isAccelerating,
  isBraking,
  steerLeft,
  steerRight,
  customCarSpecs,
  damage,
  onRepairTick,
  playerMode,
  setPlayerMode,
  characterConfig,
  customMapConfig,
  customLogoText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // References to communicate with requestAnimationFrame context
  const stateRef = useRef({
    selectedCar,
    carColor,
    selectedTrack,
    weather,
    physicsConfig,
    cameraMode,
    isMuted,
    isAccelerating,
    isBraking,
    steerLeft,
    steerRight,
    customCarSpecs,
    damage,
    onRepairTick,
    playerMode,
    setPlayerMode,
    characterConfig,
    customMapConfig,
  });

  // Keep state sync
  useEffect(() => {
    activeCanvasCustomMapConfig = customMapConfig;
    stateRef.current = {
      selectedCar,
      carColor,
      selectedTrack,
      weather,
      physicsConfig,
      cameraMode,
      isMuted,
      isAccelerating,
      isBraking,
      steerLeft,
      steerRight,
      customCarSpecs,
      damage,
      onRepairTick,
      playerMode,
      setPlayerMode,
      characterConfig,
      customMapConfig,
      customLogoText,
    };
  }, [
    selectedCar,
    carColor,
    selectedTrack,
    weather,
    physicsConfig,
    cameraMode,
    isMuted,
    isAccelerating,
    isBraking,
    steerLeft,
    steerRight,
    customCarSpecs,
    damage,
    onRepairTick,
    playerMode,
    setPlayerMode,
    characterConfig,
    customMapConfig,
    customLogoText,
  ]);

  // Car physically persistent states
  const carState = useRef({
    posX: 0,
    posY: 2,
    posZ: 0,
    rotY: 0, // car forward angle
    speed: 0,
    pitch: 0, // forward/reverse lean
    roll: 0,  // sideways tilt
    steerAngle: 0, // visual steering angle [-maxAngle, maxAngle]
    distance: 0,
    score: 0,
    currentCheckpoint: 0,
    playTime: 0,
    lastCollisionTime: 0,
    // Add player walking specs
    walkerX: 0,
    walkerY: 2,
    walkerZ: 0,
    walkerAngle: 0,
    walkerVelY: 0,
    isGrounded: true,
    fuel: 100.0,
    explodeCountdown: 60.0,
    isExploded: false,
    isEngineOn: true,
    hasGasCanister: false,
    headlightsEnabled: true,
    indicatorMode: 'none' as 'none' | 'left' | 'right' | 'hazard',
    indicatorTimer: 0,
    hornTimer: 0,
    isGearManual: false,
    manualGear: 1, // 1 for Drive, -1 for Reverse, 0 for Neutral, 2 for Park
    aiDriveTarget: null as { x: number; z: number; threshold?: number } | null,
    isFollowingOwner: false,
    hasToastedFollowReach: false,
    remoteCommand: null as 'forward' | 'reverse' | 'left' | 'right' | 'stop' | null,
    aiStuckTimer: 0,
    aiReverseTimer: 0,
  });

  // Track the checkpoints
  const checkpoints = useRef<THREE.Vector3[]>([]);
  const pedestriansRef = useRef<any[]>([]);
  const trafficCarsRef = useRef<any[]>([]);

  // Spherical camera orientation states (for free look orbit view around the vehicle)
  const orbitRef = useRef({
    yaw: Math.PI, // angle around Y (horizontal rotation)
    pitch: 0.35,  // angle above horizon (vertical rotation)
    radius: 12.0, // zoom distance
  });

  // Trigger physics reset on demand
  useEffect(() => {
    if (resetCounter > 0) {
      // Set to track start
      carState.current.posX = 0;
      carState.current.posZ = selectedTrack === 'racetrack' ? 50 : 0;
      carState.current.posY = getTerrainHeight(carState.current.posX, carState.current.posZ, selectedTrack) + 1.5;
      carState.current.rotY = selectedTrack === 'racetrack' ? Math.PI : 0;
      carState.current.speed = 0;
      carState.current.pitch = 0;
      carState.current.roll = 0;
      carState.current.steerAngle = 0;
      carState.current.distance = 0;
      carState.current.score = 0;
      carState.current.currentCheckpoint = 0;
      // sync the walker
      carState.current.walkerX = carState.current.posX - 2.0;
      carState.current.walkerZ = carState.current.posZ;
      carState.current.walkerY = carState.current.posY;
      carState.current.walkerAngle = carState.current.rotY;
      carState.current.walkerVelY = 0;
      carState.current.isGrounded = true;
      carState.current.fuel = 100.0;
      carState.current.explodeCountdown = 60.0;
      carState.current.isExploded = false;
      carState.current.hasGasCanister = false;

      onStatsChange({
        speed: 0,
        rpm: 0,
        steerAngle: 0,
        isDrifting: false,
        distance: 0,
        score: 0,
        currentCheckpoint: 0,
        fuel: 100,
        explodeCountdown: 60,
        isExploded: false,
        hasGasCanister: false,
      });
    }
  }, [resetCounter]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any stale child elements to prevent duplicate canvases in React StrictMode
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // --- SOUND INITIALIZATION TRIGGERED BY GAME START ---
    soundEngine.init();

    // Setup dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Create WebGL Renderer with Full HD / High Precision output
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 2. Create Scene
    const scene = new THREE.Scene();

    // 3. Create Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 10, -15);

    // 4. Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 300;
    const d = 80;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Headlights system
    const headlightL = new THREE.SpotLight(0xffffdd, 0, 45, Math.PI / 4, 0.5, 0.5);
    headlightL.castShadow = true;
    scene.add(headlightL);

    const headlightR = new THREE.SpotLight(0xffffdd, 0, 45, Math.PI / 4, 0.5, 0.5);
    headlightR.castShadow = true;
    scene.add(headlightR);

    // Headlight targets
    const headlightTargetL = new THREE.Object3D();
    const headlightTargetR = new THREE.Object3D();
    scene.add(headlightTargetL);
    scene.add(headlightTargetR);
    headlightL.target = headlightTargetL;
    headlightR.target = headlightTargetR;

    // 5. Build Terrain Mesh
    const terrainGeo = new THREE.PlaneGeometry(600, 600, 120, 120);
    terrainGeo.rotateX(-Math.PI / 2); // laying down flat Y=0

    // Adjust heights in vertex array based on terrain selection
    const terrainVertices = terrainGeo.attributes.position;
    const applyTerrainVerts = (track: TrackType) => {
      for (let i = 0; i < terrainVertices.count; i++) {
        const x = terrainVertices.getX(i);
        const z = terrainVertices.getZ(i);
        const h = getTerrainHeight(x, z, track);
        terrainVertices.setY(i, h);
      }
      terrainGeo.computeVertexNormals();
      terrainVertices.needsUpdate = true;

      // Dynamically color ground according to theme
      let groundColor = 0x557a46; // grassland
      if (track === 'desert_bumpy') groundColor = 0xe3a857;
      else if (track === 'mountain') groundColor = 0x686d76;
      else if (track === 'racetrack') groundColor = 0x4e6e5d;
      else if (track === 'metropolis_city') groundColor = 0x1e293b;
      else if (track === 'countryside_village') groundColor = 0x5d8042;
      else if (track === 'snow_arctic') groundColor = 0xf1f5f9; // snowy glacier white
      else if (track === 'volcano_lava') groundColor = 0x1c1917; // hot obsidian crust
      else if (track === 'ocean_atlantis') groundColor = 0x0f766e; // teal deep ocean bed
      else if (track === 'synth_wave_grid') groundColor = 0x090514; // retro outrun dark canvas
      else if (track === 'custom_map') groundColor = 0x4c1d95; // digital deep purple
      terrainMat.color.setHex(groundColor);
    };

    // Store custom terrain color state
    const terrainMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Helper functions to configure tracks
    const terrainGrassColor = 0x557a46;
    const terrainDesertColor = 0xd4adfc; // beautiful violet-influenced desert
    const terrainDesertMainColor = 0xe3a857;
    const terrainMountainColor = 0x686d76;
    const terrainRacetrackGrass = 0x4e6e5d;

    // Helper Grid lines (only on specific segments or all)
    const gridHelper = new THREE.GridHelper(600, 60, 0x000000, 0x444444);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Obstacles decoration arrays
    const obstacleMeshes: THREE.Object3D[] = [];

    const clearObstacles = () => {
      obstacleMeshes.forEach(m => scene.remove(m));
      obstacleMeshes.length = 0;
      if (pedestriansRef.current) {
        pedestriansRef.current.forEach(p => scene.remove(p.group));
        pedestriansRef.current = [];
      }
      if (trafficCarsRef.current) {
        trafficCarsRef.current.forEach(tc => scene.remove(tc.group));
        trafficCarsRef.current = [];
      }
    };

    const buildProps = (track: TrackType) => {
      clearObstacles();

      if (track === 'grassland') {
        // Create green standard pine trees
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        const leavesGeo = new THREE.ConeGeometry(1.5, 3.5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 });

        for (let i = 0; i < 90; i++) {
          const r = 25 + Math.random() * 150;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          // Tree group
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 1;
          trunk.castShadow = true;
          tree.add(trunk);

          const leaves = new THREE.Mesh(leavesGeo, leavesMat);
          leaves.position.y = 2.8;
          leaves.castShadow = true;
          tree.add(leaves);

          tree.position.set(px, py, pz);
          // random scale
          const s = 0.7 + Math.random() * 0.6;
          tree.scale.set(s, s, s);

          scene.add(tree);
          obstacleMeshes.push(tree);
        }
      } else if (track === 'desert_bumpy') {
        // Create procedural tall saguaro cactus
        const cactusBodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 4.2, 8);
        const cactusArmGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 8);
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });

        for (let i = 0; i < 75; i++) {
          const r = 20 + Math.random() * 160;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const cactus = new THREE.Group();
          const body = new THREE.Mesh(cactusBodyGeo, cactusMat);
          body.position.y = 2.1;
          body.castShadow = true;
          cactus.add(body);

          // Arm left
          const armL = new THREE.Mesh(cactusArmGeo, cactusMat);
          armL.rotation.z = Math.PI / 2;
          armL.position.set(-0.8, 2.6, 0);
          cactus.add(armL);
          const subArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8), cactusMat);
          subArmL.position.set(-1.6, 3.1, 0);
          cactus.add(subArmL);

          // Arm right
          const armR = new THREE.Mesh(cactusArmGeo, cactusMat);
          armR.rotation.z = -Math.PI / 2;
          armR.position.set(0.8, 1.8, 0);
          cactus.add(armR);
          const subArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8), cactusMat);
          subArmR.position.set(1.6, 2.3, 0);
          cactus.add(subArmR);

          cactus.position.set(px, py, pz);
          const s = 0.6 + Math.random() * 0.7;
          cactus.scale.set(s, s, s);

          scene.add(cactus);
          obstacleMeshes.push(cactus);
        }
      } else if (track === 'mountain') {
        // Red canyon style rocks (layered shapes)
        const rockGeo = new THREE.DodecahedronGeometry(2, 1);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b5a45, roughness: 0.95 });

        for (let i = 0; i < 110; i++) {
          const theta = Math.random() * Math.PI * 2;
          const r = 16 + Math.random() * 140;
          const px = Math.cos(theta) * r;
          let pz = Math.sin(theta) * r;

          // Push them away from the mountain valley roadway slightly
          const roadZ = Math.sin(px * 0.02) * 45;
          if (Math.abs(pz - roadZ) < 10) {
            pz += (pz > roadZ ? 8 : -8);
          }

          const py = getTerrainHeight(px, pz, track);

          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.set(px, py - 0.5, pz);
          rock.castShadow = true;
          rock.receiveShadow = true;
          
          const s = 0.5 + Math.random() * 2.5;
          rock.scale.set(s, s + Math.random() * 2, s);
          rock.rotation.set(Math.random(), Math.random(), Math.random());

          scene.add(rock);
          obstacleMeshes.push(rock);
        }
      } else if (track === 'racetrack') {
        // Add checkered visual banners, stadium lights, tire stacks!
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const tireGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.5, 12);
        tireGeo.rotateX(Math.PI / 2);

        // Place columns along the racetrack boundary
        // Racetrack center radius = 50. Loop: dist = 50.
        for (let i = 0; i < 48; i++) {
          const angle = (i / 48) * Math.PI * 2;
          // Outer tires stack (r = 63)
          const pxOut = Math.cos(angle) * 63;
          const pzOut = Math.sin(angle) * 63;
          const pyOut = getTerrainHeight(pxOut, pzOut, track);

          const stackOut = new THREE.Group();
          for (let j = 0; j < 3; j++) {
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.position.y = 0.25 + j * 0.45;
            tire.castShadow = true;
            stackOut.add(tire);
          }
          stackOut.position.set(pxOut, pyOut, pzOut);
          scene.add(stackOut);
          obstacleMeshes.push(stackOut);

          // Inner tires stack (r = 37)
          const pxIn = Math.cos(angle) * 37;
          const pzIn = Math.sin(angle) * 37;
          const pyIn = getTerrainHeight(pxIn, pzIn, track);

          const stackIn = new THREE.Group();
          for (let j = 0; j < 3; j++) {
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.position.y = 0.25 + j * 0.45;
            tire.castShadow = true;
            stackIn.add(tire);
          }
          stackIn.position.set(pxIn, pyIn, pzIn);
          scene.add(stackIn);
          obstacleMeshes.push(stackIn);
        }

        // Add visual light poles (Stadium feel!)
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 });
        const whiteEmissive = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff });
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const px = Math.cos(angle) * 68;
          const pz = Math.sin(angle) * 68;
          const py = getTerrainHeight(px, pz, track);

          const pole = new THREE.Group();
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 8), metalMat);
          bar.position.y = 4;
          bar.castShadow = true;
          pole.add(bar);

          const lightHead = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), metalMat);
          lightHead.position.set(0, 8, 0);
          pole.add(lightHead);

          const lightBulb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.8), whiteEmissive);
          lightBulb.position.set(0, 7.75, 0);
          pole.add(lightBulb);

          pole.position.set(px, py, pz);
          scene.add(pole);
          obstacleMeshes.push(pole);
        }
      } else if (track === 'custom_map') {
        const finalMap = stateRef.current.customMapConfig || customMapConfig;
        if (finalMap && finalMap.placedBlocks) {
          finalMap.placedBlocks.forEach((block) => {
            let blockMesh: THREE.Object3D | null = null;
            
            // Materials
            // Standard stylish neon-glowing or cyber grids look incredible for built tracks
            const cubeMat = new THREE.MeshStandardMaterial({ 
              color: 0x3b82f6, 
              roughness: 0.2, 
              metalness: 0.8,
              emissive: 0x1d4ed8,
              emissiveIntensity: 0.1
            });
            const rampMat = new THREE.MeshStandardMaterial({ 
              color: 0x10b981, 
              roughness: 0.3, 
              metalness: 0.5,
              emissive: 0x047857,
              emissiveIntensity: 0.15
            });
            const cylMat = new THREE.MeshStandardMaterial({ 
              color: 0xf59e0b, 
              roughness: 0.4, 
              metalness: 0.7,
              emissive: 0xb45309,
              emissiveIntensity: 0.1
            });
            const rockMat = new THREE.MeshStandardMaterial({ 
              color: 0x7c2d12, 
              roughness: 0.9, 
              metalness: 0.1 
            });
            const starMat = new THREE.MeshStandardMaterial({ 
              color: 0xfacc15, 
              roughness: 0.1, 
              metalness: 0.9,
              emissive: 0xca8a04,
              emissiveIntensity: 0.4
            });

            const sX = block.scaleX || 4;
            const sY = block.scaleY || 3;
            const sZ = block.scaleZ || 4;

            if (block.type === 'cube') {
              const geo = new THREE.BoxGeometry(sX, sY, sZ);
              blockMesh = new THREE.Mesh(geo, cubeMat);
              blockMesh.position.set(block.x, block.y + sY / 2, block.z);
            } else if (block.type === 'ramp') {
              // Create wedge (ramp) geometry using standard BufferGeometry
              const geo = new THREE.BufferGeometry();
              const hw = sX / 2;
              const hd = sZ / 2;
              
              // Vertices for a standard wedge rising from z = -hd (height 0) to z = +hd (height sY)
              const vertices = new Float32Array([
                // Bottom face
                -hw, 0, -hd,   hw, 0, -hd,   hw, 0,  hd,
                -hw, 0, -hd,   hw, 0,  hd,  -hw, 0,  hd,
                
                // Sloped face
                -hw, 0, -hd,   hw, 0, -hd,   hw, sY, hd,
                -hw, 0, -hd,   hw, sY, hd,  -hw, sY, hd,
                
                // Back vertical face
                -hw, 0, hd,   hw, 0, hd,   hw, sY, hd,
                -hw, 0, hd,   hw, sY, hd,  -hw, sY, hd,
                
                // Left triangle
                -hw, 0, -hd,  -hw, 0, hd,  -hw, sY, hd,
                
                // Right triangle
                hw, 0, -hd,   hw, sY, hd,   hw, 0, hd
              ]);
              
              geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
              geo.computeVertexNormals();
              
              blockMesh = new THREE.Mesh(geo, rampMat);
              blockMesh.position.set(block.x, block.y, block.z);
            } else if (block.type === 'cyl_barrier') {
              const radius = sX || 0.6;
              const geo = new THREE.CylinderGeometry(radius, radius, sY, 16);
              blockMesh = new THREE.Mesh(geo, cylMat);
              blockMesh.position.set(block.x, block.y + sY / 2, block.z);
            } else if (block.type === 'rock') {
              const radius = sX || 2.0;
              const geo = new THREE.DodecahedronGeometry(radius, 1);
              blockMesh = new THREE.Mesh(geo, rockMat);
              blockMesh.position.set(block.x, block.y + sY * 0.4, block.z);
              blockMesh.rotation.set(0.1, (block.rotationY || 0) + 0.5, 0.2);
            } else if (block.type === 'star_checkpoint' || block.type === 'star' as any) {
              const geo = new THREE.TorusGeometry(1.2, 0.2, 8, 24);
              blockMesh = new THREE.Mesh(geo, starMat);
              blockMesh.position.set(block.x, block.y + 1.8, block.z);
              blockMesh.rotation.x = Math.PI / 2;
            }

            if (blockMesh) {
              blockMesh.castShadow = true;
              blockMesh.receiveShadow = true;
              if (block.rotationY && block.type !== 'rock') {
                blockMesh.rotation.y = block.rotationY;
              }
              scene.add(blockMesh);
              obstacleMeshes.push(blockMesh);
            }
          });
        }
      } else if (track === 'metropolis_city') {
        const buildings = [
          { cx: -50, cz: -50, lx: 30, lz: 30, h: 42, color: 0x1e293b },
          { cx: -50, cz: 50, lx: 30, lz: 30, h: 50, color: 0x0f172a },
          { cx: 50, cz: -50, lx: 30, lz: 30, h: 36, color: 0x111827 },
          { cx: 50, cz: 50, lx: 30, lz: 30, h: 60, color: 0x1e1b4b },
          { cx: -110, cz: -110, lx: 35, lz: 35, h: 45, color: 0x27272a },
          { cx: -110, cz: 110, lx: 35, lz: 35, h: 55, color: 0x09090b },
          { cx: 110, cz: -110, lx: 35, lz: 35, h: 38, color: 0x171717 },
          { cx: 110, cz: 110, lx: 35, lz: 35, h: 70, color: 0x111827 },
          { cx: -110, cz: -50, lx: 30, lz: 30, h: 40, color: 0x1e293b },
          { cx: -110, cz: 50, lx: 30, lz: 30, h: 48, color: 0x0f172a },
          { cx: 110, cz: -50, lx: 30, lz: 30, h: 52, color: 0x111827 },
          { cx: 110, cz: 50, lx: 30, lz: 30, h: 62, color: 0x1e1b4b },
          { cx: -50, cz: -110, lx: 30, lz: 30, h: 38, color: 0x27272a },
          { cx: -50, cz: 110, lx: 30, lz: 30, h: 46, color: 0x09090b },
          { cx: 50, cz: -110, lx: 30, lz: 30, h: 44, color: 0x171717 },
          { cx: 50, cz: 110, lx: 30, lz: 30, h: 54, color: 0x111827 },
        ];

        buildings.forEach((b) => {
          const bGroup = new THREE.Group();
          bGroup.position.set(b.cx, 0, b.cz);

          const bodyGeo = new THREE.BoxGeometry(b.lx, b.h, b.lz);
          const bodyMat = new THREE.MeshStandardMaterial({ 
            color: b.color, 
            roughness: 0.9, 
            metalness: 0.25 
          });
          const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
          bodyMesh.position.y = b.h / 2;
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          bGroup.add(bodyMesh);

          // Neon glowing windows for outstanding nighttime realism!
          const winMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
          const winMat2 = new THREE.MeshBasicMaterial({ color: 0xfef08a });
          const floors = Math.floor(b.h / 4);

          for (let f = 1; f < floors; f++) {
            const hOffset = f * 4;
            const useYellow = (f % 2 === 0);
            const mMat = useYellow ? winMat2 : winMat;

            // Side window columns
            for (let zVal = -b.lz/2 + 4; zVal <= b.lz/2 - 4; zVal += 6) {
              const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.2), mMat);
              win1.position.set(b.lx/2 + 0.1, hOffset, zVal);
              bGroup.add(win1);

              const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.2), mMat);
              win2.position.set(-b.lx/2 - 0.1, hOffset, zVal);
              bGroup.add(win2);
            }

            for (let xVal = -b.lx/2 + 4; xVal <= b.lx/2 - 4; xVal += 6) {
              const win3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.2), mMat);
              win3.position.set(xVal, hOffset, b.lz/2 + 0.1);
              bGroup.add(win3);

              const win4 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.2), mMat);
              win4.position.set(xVal, hOffset, -b.lz/2 - 0.1);
              bGroup.add(win4);
            }
          }

          if (b.h > 45) {
            const antennaGeo = new THREE.CylinderGeometry(0.12, 0.12, 6.0, 6);
            const antennaMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
            const antenna = new THREE.Mesh(antennaGeo, antennaMat);
            antenna.position.set(0, b.h + 3.0, 0);
            bGroup.add(antenna);

            const bulb = new THREE.Mesh(
              new THREE.SphereGeometry(0.4, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xef4444 })
            );
            bulb.position.set(0, b.h + 6.0, 0);
            bGroup.add(bulb);
          }

          const sideWalkGeo = new THREE.BoxGeometry(b.lx + 4, 0.18, b.lz + 4);
          const sideWalkMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 });
          const sideWalk = new THREE.Mesh(sideWalkGeo, sideWalkMat);
          sideWalk.position.y = 0.09;
          sideWalk.receiveShadow = true;
          bGroup.add(sideWalk);

          scene.add(bGroup);
          obstacleMeshes.push(bGroup);
        });

        // Add crosswalk lanes
        const crosswalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        for (let cz = -120; cz <= 120; cz += 60) {
          if (cz === 0) continue;
          for (let xw = -6; xw <= 6; xw += 1.5) {
            const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3.2), crosswalkMat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(xw, 0.01, cz);
            scene.add(stripe);
            obstacleMeshes.push(stripe);
          }
        }

        // Spawn 10 citizens/pedestrians
        const shirtColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899, 0x8b5cf6];
        const pantsColors = [0x1f2937, 0x4b5563, 0x1e3a8a, 0x064e3b];
        
        for (let i = 0; i < 10; i++) {
          const pedGroup = new THREE.Group();
          const theta = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 95;
          const px = Math.cos(theta) * dist;
          const pz = Math.sin(theta) * dist;
          pedGroup.position.set(px, 0.0, pz);

          const pHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 })
          );
          pHead.position.y = 1.34;
          pedGroup.add(pHead);

          const pBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.55, 0.22),
            new THREE.MeshStandardMaterial({ color: shirtColors[i % shirtColors.length], roughness: 0.9 })
          );
          pBody.position.y = 0.95;
          pedGroup.add(pBody);

          const pLeftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.55, 0.1),
            new THREE.MeshStandardMaterial({ color: pantsColors[i % pantsColors.length], roughness: 0.9 })
          );
          pLeftLeg.position.set(-0.08, 0.35, 0);
          pedGroup.add(pLeftLeg);

          const pRightLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.55, 0.1),
            new THREE.MeshStandardMaterial({ color: pantsColors[i % pantsColors.length], roughness: 0.9 })
          );
          pRightLeg.position.set(0.08, 0.35, 0);
          pedGroup.add(pRightLeg);

          scene.add(pedGroup);

          pedestriansRef.current.push({
            group: pedGroup,
            leftLeg: pLeftLeg,
            rightLeg: pRightLeg,
            velX: Math.sin(theta + Math.PI / 2) * 2.8,
            velZ: Math.cos(theta + Math.PI / 2) * 2.8,
            angle: theta + Math.PI / 2,
            phase: Math.random() * 10,
            hitTimer: 0,
            id: `citizen_${i}`
          });
        }

        // Spawn Traffic Cars in metropolis_city!
        const carColors = [0xe11d48, 0x2563eb, 0xd97706, 0x059669, 0xf43f5e, 0x1e293b];
        const tcConfigs = [
          { x: 0, z: -120, vx: 0, vz: 14, color: carColors[0] },
          { x: 0, z: 120, vx: 0, vz: -14, color: carColors[1] },
          { x: -120, z: 0, vx: 14, vz: 0, color: carColors[2] },
          { x: 120, z: 0, vx: -14, vz: 0, color: carColors[3] },
          { x: -60, z: -80, vx: 0, vz: 10, color: carColors[4] },
          { x: 60, z: 80, vx: 0, vz: -10, color: carColors[5] },
        ];

        tcConfigs.forEach((cfg, idx) => {
          const tcGroup = new THREE.Group();
          tcGroup.position.set(cfg.x, 0.5, cfg.z);

          // Car body
          const bodyGeo = new THREE.BoxGeometry(2.0, 1.1, 4.0);
          const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, metalness: 0.6, roughness: 0.3 });
          const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          tcGroup.add(bodyMesh);

          // Roof/Cabin
          const cabinGeo = new THREE.BoxGeometry(1.7, 0.75, 2.2);
          const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.2 });
          const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
          cabinMesh.position.set(0, 0.85, -0.2);
          cabinMesh.castShadow = true;
          tcGroup.add(cabinMesh);

          // Wheels
          const wGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
          const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
          const wheelsPos = [
            [-1.1, -0.4, 1.3], [1.1, -0.4, 1.3],
            [-1.1, -0.4, -1.3], [1.1, -0.4, -1.3]
          ];
          wheelsPos.forEach(([wx, wy, wz]) => {
            const wMesh = new THREE.Mesh(wGeo, wMat);
            wMesh.rotation.z = Math.PI / 2;
            wMesh.position.set(wx, wy, wz);
            tcGroup.add(wMesh);
          });

          // Headlights (glowing yellow mesh)
          const hlGeo = new THREE.SphereGeometry(0.18, 8, 8);
          const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
          const hlL = new THREE.Mesh(hlGeo, hlMat);
          hlL.position.set(-0.7, 0.1, 2.02);
          const hlR = hlL.clone();
          hlR.position.x = 0.7;
          tcGroup.add(hlL);
          tcGroup.add(hlR);

          // Taillights
          const tlMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const tlL = new THREE.Mesh(hlGeo, tlMat);
          tlL.position.set(-0.7, 0.1, -2.02);
          const tlR = tlL.clone();
          tlR.position.x = 0.7;
          tcGroup.add(tlL);
          tcGroup.add(tlR);

          scene.add(tcGroup);
          trafficCarsRef.current.push({
            group: tcGroup,
            velX: cfg.vx,
            velZ: cfg.vz,
            id: `traffic_car_${idx}`
          });
        });
      } else if (track === 'countryside_village') {
        // Rustic grass floor decoration
        // Spawn 5 traditional Vietnamese wooden houses
        const houses = [
          { cx: -32, cz: -32, w: 9, d: 6, h: 4, color: 0xc8b29c },
          { cx: 32, cz: -38, w: 9, d: 6, h: 4, color: 0xbaa795 },
          { cx: 48, cz: 42, w: 10, d: 7, h: 4.5, color: 0xc2ada0 },
          { cx: -42, cz: 48, w: 9, d: 6, h: 4, color: 0xb5a392 },
          { cx: -15, cz: 55, w: 8, d: 5, h: 3.8, color: 0xc4b4a6 },
        ];

        houses.forEach((h, hIdx) => {
          const houseGroup = new THREE.Group();
          const houseY = getTerrainHeight(h.cx, h.cz, track);
          houseGroup.position.set(h.cx, houseY, h.cz);

          // Main body
          const bodyGeo = new THREE.BoxGeometry(h.w, h.h, h.d);
          const bodyMat = new THREE.MeshStandardMaterial({ color: h.color, roughness: 0.9 });
          const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
          bodyMesh.position.y = h.h / 2;
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          houseGroup.add(bodyMesh);

          // Red-brick traditional Vietnamese pyramidal roof
          const roofGeo = new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.75, 3.2, 4);
          const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9 }));
          roofMesh.rotation.y = Math.PI / 4;
          roofMesh.position.y = h.h + 1.2;
          roofMesh.scale.set(1.1, 1, 1);
          roofMesh.castShadow = true;
          houseGroup.add(roofMesh);

          scene.add(houseGroup);
          obstacleMeshes.push(houseGroup);
        });

        // Spawn 6 Golden haystacks (đống rơm Bắc Bộ)
        const hayMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.9 });
        const haysticks = [
          { x: -22, z: -25 },
          { x: 22, z: -28 },
          { x: 38, z: 32 },
          { x: -30, z: 42 },
          { x: -5, z: 42 },
          { x: 20, z: 15 },
        ];
        haysticks.forEach((hs) => {
          const hayY = getTerrainHeight(hs.x, hs.z, track);
          const hayGroup = new THREE.Group();
          hayGroup.position.set(hs.x, hayY, hs.z);

          const hBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 2.5, 8), hayMat);
          hBase.position.y = 1.25;
          hBase.castShadow = true;
          hayGroup.add(hBase);

          const hTop = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.0, 8), hayMat);
          hTop.position.y = 3.0;
          hTop.castShadow = true;
          hayGroup.add(hTop);

          scene.add(hayGroup);
          obstacleMeshes.push(hayGroup);
        });

        // Spawn 8 Beautiful Bamboo plants (rặng tre Việt Nam)
        const bambooTrunkGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.0, 6);
        const bambooTrunkMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
        const bambooLeavesGeo = new THREE.BoxGeometry(1.6, 2.2, 1.6);
        const bambooLeavesMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });

        const bamboos = [
          { x: -45, z: -20 },
          { x: -42, z: -15 },
          { x: 45, z: -20 },
          { x: 42, z: -15 },
          { x: 55, z: 50 },
          { x: -55, z: 45 },
          { x: -10, z: -40 },
          { x: 10, z: -45 },
        ];
        bamboos.forEach((b) => {
          const bY = getTerrainHeight(b.x, b.z, track);
          const bClump = new THREE.Group();
          bClump.position.set(b.x, bY, b.z);

          for (let k = 0; k < 4; k++) {
            const bx = (Math.random() - 0.5) * 1.5;
            const bz = (Math.random() - 0.5) * 1.5;
            const bStem = new THREE.Mesh(bambooTrunkGeo, bambooTrunkMat);
            bStem.position.set(bx, 2.5, bz);
            bStem.rotation.z = (Math.random() - 0.5) * 0.15;
            bStem.rotation.x = (Math.random() - 0.5) * 0.15;
            bStem.castShadow = true;
            bClump.add(bStem);

            const bLeaves = new THREE.Mesh(bambooLeavesGeo, bambooLeavesMat);
            bLeaves.position.set(bx, 4.5, bz);
            bLeaves.castShadow = true;
            bClump.add(bLeaves);
          }

          scene.add(bClump);
          obstacleMeshes.push(bClump);
        });

        // Spawn 6 Large Paddy Rice fields (ruộng lúa màu vàng xanh tươi tốt)
        const paddyMat = new THREE.MeshStandardMaterial({ color: 0x8df538, roughness: 0.9 });
        const paddies = [
          { x: -20, z: -10, w: 18, d: 15 },
          { x: 20, z: -10, w: 18, d: 15 },
          { x: -25, z: 20, w: 15, d: 18 },
          { x: 25, z: 20, w: 15, d: 18 },
          { x: 0, z: 30, w: 22, d: 12 },
          { x: 0, z: -35, w: 20, d: 14 },
        ];
        paddies.forEach((p) => {
          const pY = getTerrainHeight(p.x, p.z, track);
          const paddy = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.15, p.d), paddyMat);
          paddy.position.set(p.x, pY + 0.08, p.z);
          paddy.receiveShadow = true;
          scene.add(paddy);
          obstacleMeshes.push(paddy);
        });

        // Spawn 6 Hardworking Vietnamese Farmers
        const farmerColors = [0x503020, 0x3f3f46, 0x111827, 0x475569];
        const farmerPoints = [
          { x: -16, z: -8, rot: 1.2 },
          { x: 18, z: -12, rot: -0.8 },
          { x: -22, z: 18, rot: 3.1 },
          { x: 24, z: 15, rot: 0.5 },
          { x: 3, z: 28, rot: 0.0 },
          { x: -3, z: -32, rot: 1.8 },
        ];

        farmerPoints.forEach((fp, fIdx) => {
          const farmerGroup = new THREE.Group();
          const fY = getTerrainHeight(fp.x, fp.z, track);
          farmerGroup.position.set(fp.x, fY, fp.z);
          farmerGroup.rotation.y = fp.rot;

          // Head
          const fHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 })
          );
          fHead.position.y = 1.15;
          farmerGroup.add(fHead);

          // Vietnamese Conical Straw Hat (Nón lá Việt Nam)
          const conicalHat = new THREE.Mesh(
            new THREE.ConeGeometry(0.38, 0.22, 12),
            new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.9 })
          );
          conicalHat.position.y = 1.28;
          farmerGroup.add(conicalHat);

          // Shirt body
          const fBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.50, 0.22),
            new THREE.MeshStandardMaterial({ color: farmerColors[fIdx % farmerColors.length], roughness: 0.95 })
          );
          fBody.position.y = 0.8;
          farmerGroup.add(fBody);

          // Legs
          const fLeftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.45, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
          );
          fLeftLeg.position.set(-0.08, 0.3, 0);
          farmerGroup.add(fLeftLeg);

          const fRightLeg = fLeftLeg.clone();
          fRightLeg.position.x = 0.08;
          farmerGroup.add(fRightLeg);

          // Field Hoe
          const hoeHandle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6),
            new THREE.MeshStandardMaterial({ color: 0x854d0e })
          );
          hoeHandle.rotation.x = Math.PI / 3;
          hoeHandle.position.set(0.2, 0.7, 0.2);
          farmerGroup.add(hoeHandle);

          const hoeMetal = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.08, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3 })
          );
          hoeMetal.position.set(0.2, 1.1, 0.7);
          farmerGroup.add(hoeMetal);

          scene.add(farmerGroup);

          pedestriansRef.current.push({
            group: farmerGroup,
            leftLeg: fLeftLeg,
            rightLeg: fRightLeg,
            velX: 0,
            velZ: 0,
            angle: fp.rot,
            phase: Math.random() * 12,
            hitTimer: 0,
            id: `farmer_${fIdx}`,
            isFarmer: true
          });
        });
      } else if (track === 'snow_arctic') {
        // Snow capped pines
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.8, 8);
        const leavesGeo = new THREE.ConeGeometry(1.2, 2.8, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x483c32 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.95 });

        for (let i = 0; i < 70; i++) {
          const r = 20 + Math.random() * 150;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 0.9;
          trunk.castShadow = true;
          tree.add(trunk);

          const leaves = new THREE.Mesh(leavesGeo, leavesMat);
          leaves.position.y = 2.2;
          leaves.castShadow = true;
          tree.add(leaves);

          tree.position.set(px, py, pz);
          const s = 0.8 + Math.random() * 0.7;
          tree.scale.set(s, s, s);

          scene.add(tree);
          obstacleMeshes.push(tree);
        }

        // Procedural icebergs
        const iceGeo = new THREE.DodecahedronGeometry(3.5, 1);
        const iceMat = new THREE.MeshStandardMaterial({ 
          color: 0x93c5fd, 
          roughness: 0.2, 
          metalness: 0.8, 
          transparent: true, 
          opacity: 0.95 
        });
        for (let i = 0; i < 15; i++) {
          const r = 35 + Math.random() * 120;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const iceberg = new THREE.Mesh(iceGeo, iceMat);
          iceberg.position.set(px, py - 0.8, pz);
          iceberg.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
          iceberg.castShadow = true;
          iceberg.receiveShadow = true;
          scene.add(iceberg);
          obstacleMeshes.push(iceberg);
        }
      } else if (track === 'volcano_lava') {
        // Magma vents and igneous rock spikes
        const obsidianGeo = new THREE.ConeGeometry(1.6, 6.0, 5);
        const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.1, metalness: 0.9 });

        for (let i = 0; i < 40; i++) {
          const r = 18 + Math.random() * 140;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const spike = new THREE.Mesh(obsidianGeo, obsidianMat);
          spike.position.set(px, py + 2.0, pz);
          spike.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
          spike.scale.set(0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.8, 0.8 + Math.random() * 0.5);
          spike.castShadow = true;
          spike.receiveShadow = true;
          scene.add(spike);
          obstacleMeshes.push(spike);
        }

        // Active glowing sulfur vents
        const ventBodyGeo = new THREE.CylinderGeometry(1.5, 2.2, 2.5, 8);
        const ventLavaGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.4, 8);
        const ventMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
        const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff3700, emissive: 0xff1a00, emissiveIntensity: 2.0 });

        for (let i = 0; i < 12; i++) {
          const r = 25 + Math.random() * 110;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const vent = new THREE.Group();
          const base = new THREE.Mesh(ventBodyGeo, ventMat);
          base.position.y = 1.25;
          base.castShadow = true;
          vent.add(base);

          const lava = new THREE.Mesh(ventLavaGeo, lavaMat);
          lava.position.y = 2.4;
          vent.add(lava);

          // Add point light
          const vLight = new THREE.PointLight(0xff4500, 2.5, 12);
          vLight.position.set(0, 3.2, 0);
          vent.add(vLight);

          vent.position.set(px, py, pz);
          scene.add(vent);
          obstacleMeshes.push(vent);
        }
      } else if (track === 'ocean_atlantis') {
        // Sunken Greco-Roman pillars and glowing undersea columns
        const columnGeo = new THREE.CylinderGeometry(0.8, 1.0, 7.0, 8);
        const columnMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.6, metalness: 0.1 });
        const coralGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
        const coralMat = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xdb2777, emissiveIntensity: 1.0, roughness: 0.8 });

        for (let i = 0; i < 25; i++) {
          const r = 20 + Math.random() * 120;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const pillar = new THREE.Mesh(columnGeo, columnMat);
          pillar.position.set(px, py + 3.0, pz);
          pillar.rotation.set(Math.random() * 0.25, Math.random() * Math.PI, Math.random() * 0.25);
          pillar.castShadow = true;
          pillar.receiveShadow = true;
          scene.add(pillar);
          obstacleMeshes.push(pillar);
        }

        for (let i = 0; i < 20; i++) {
          const r = 25 + Math.random() * 100;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const coral = new THREE.Mesh(coralGeo, coralMat);
          coral.position.set(px, py + 0.8, pz);
          coral.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          coral.scale.set(0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8);
          scene.add(coral);
          obstacleMeshes.push(coral);
        }
      } else if (track === 'synth_wave_grid') {
        const spireGeo = new THREE.ConeGeometry(1.2, 8.0, 4);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 1.5, roughness: 0.1 });
        const polyGeo = new THREE.BoxGeometry(3.0, 3.0, 3.0);
        const polyMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, emissive: 0x6d28d9, emissiveIntensity: 1.2 });

        for (let i = 0; i < 35; i++) {
          const r = 25 + Math.random() * 130;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const spire = new THREE.Mesh(spireGeo, spireMat);
          spire.position.set(px, py + 4.0, pz);
          spire.rotation.set(0, Math.random() * Math.PI, 0);
          spire.castShadow = true;
          scene.add(spire);
          obstacleMeshes.push(spire);
        }

        for (let i = 0; i < 15; i++) {
          const r = 30 + Math.random() * 120;
          const theta = Math.random() * Math.PI * 2;
          const px = Math.cos(theta) * r;
          const pz = Math.sin(theta) * r;
          const py = getTerrainHeight(px, pz, track);

          const cube = new THREE.Mesh(polyGeo, polyMat);
          cube.position.set(px, py + 1.5, pz);
          cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          scene.add(cube);
          obstacleMeshes.push(cube);
        }
      }
    };

    // 6. Generate Checkpoint List based on Track
    const buildCheckpoints = (track: TrackType) => {
      checkpoints.current = [];
      if (track === 'racetrack') {
        // Points around the circle
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + Math.PI; // Start across the loop
          const px = Math.cos(angle) * 50;
          const pz = Math.sin(angle) * 50;
          checkpoints.current.push(new THREE.Vector3(px, getTerrainHeight(px, pz, track) + 0.5, pz));
        }
      } else if (track === 'mountain') {
        // Lay road path checkpoints
        for (let i = 0; i < 8; i++) {
          const px = -120 + i * 35;
          const pz = Math.sin(px * 0.02) * 45;
          checkpoints.current.push(new THREE.Vector3(px, getTerrainHeight(px, pz, track) + 0.5, pz));
        }
      } else if (track === 'metropolis_city') {
        const cityWaypoints = [
          [0, 30],
          [0, 80],
          [80, 80],
          [80, 0],
          [80, -80],
          [0, -80],
          [-80, -80],
          [-80, 0],
          [-80, 80]
        ];
        cityWaypoints.forEach(([x, z]) => {
          checkpoints.current.push(new THREE.Vector3(x, 0.4, z));
        });
      } else {
        // Random points floating around track origin
        const dirs = [
          [35, 35], [-45, 15], [-20, -45], [50, -35],
          [100, 30], [-100, -80], [80, 100], [-30, 120]
        ];
        dirs.forEach(([x, z]) => {
          checkpoints.current.push(new THREE.Vector3(x, getTerrainHeight(x, z, track) + 0.5, z));
        });
      }
    };

    // 7. Checkpoint Visual ring
    const checkpointRingGeo = new THREE.RingGeometry(3.0, 3.3, 32);
    checkpointRingGeo.rotateX(-Math.PI / 2);
    const checkpointRingMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14, // glowing green
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const checkpointRing = new THREE.Mesh(checkpointRingGeo, checkpointRingMat);
    scene.add(checkpointRing);

    // Light beam floating above active checkpoint
    const beamGeo = new THREE.CylinderGeometry(2.0, 2.0, 10, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const checkpointBeam = new THREE.Mesh(beamGeo, beamMat);
    checkpointBeam.position.y = 5;
    scene.add(checkpointBeam);

    const updateCheckpointPosition = () => {
      const idx = carState.current.currentCheckpoint % checkpoints.current.length;
      const cp = checkpoints.current[idx];
      if (cp) {
        checkpointRing.position.copy(cp);
        checkpointBeam.position.set(cp.x, cp.y + 4.5, cp.z);
        checkpointRing.visible = true;
        checkpointBeam.visible = true;
      } else {
        checkpointRing.visible = false;
        checkpointBeam.visible = false;
      }
    };

    // Start with default configurations
    applyTerrainVerts(selectedTrack);
    buildProps(selectedTrack);
    buildCheckpoints(selectedTrack);
    updateCheckpointPosition();

    // 8. Visual Skydome Background / Fog customization
    const setupAtmosphere = (w: WeatherType) => {
      let bgColor = 0xcce0ff;
      let fogDensity = 0.003;

      if (w === 'sunny') {
        bgColor = 0x87ceeb; // beautiful blue sky
        fogDensity = 0.0015;
        renderer.setClearColor(bgColor);
        scene.fog = new THREE.FogExp2(bgColor, fogDensity);
        dirLight.color.setHex(0xffffff);
        dirLight.intensity = 1.3;
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.45;
      } else if (w === 'rain') {
        bgColor = 0x708090; // dark emotional slate
        fogDensity = 0.012;
        renderer.setClearColor(bgColor);
        scene.fog = new THREE.FogExp2(bgColor, fogDensity);
        dirLight.color.setHex(0xb0c4de);
        dirLight.intensity = 0.65;
        ambientLight.color.setHex(0x7c8d9c);
        ambientLight.intensity = 0.35;
      } else if (w === 'fog') {
        bgColor = 0xe0e0e0; // misty whiteout
        fogDensity = 0.025;
        renderer.setClearColor(bgColor);
        scene.fog = new THREE.FogExp2(bgColor, fogDensity);
        dirLight.color.setHex(0xaaaaaa);
        dirLight.intensity = 0.4;
        ambientLight.color.setHex(0xaaaaaa);
        ambientLight.intensity = 0.4;
      } else if (w === 'sunset') {
        bgColor = 0xfd5e53; // Cyberpunk orange/pink horizon
        fogDensity = 0.005;
        renderer.setClearColor(bgColor);
        scene.fog = new THREE.FogExp2(0xfdb813, fogDensity);
        dirLight.color.setHex(0xfda085);
        dirLight.position.set(-60, 40, -40);
        dirLight.intensity = 1.1;
        ambientLight.color.setHex(0xb83b5e);
        ambientLight.intensity = 0.38;
      } else if (w === 'night') {
        bgColor = 0x070b19; // Deep cosmic starlight dark
        fogDensity = 0.008;
        renderer.setClearColor(bgColor);
        scene.fog = new THREE.FogExp2(bgColor, fogDensity);
        dirLight.color.setHex(0x4a5568);
        dirLight.position.set(40, 60, 40);
        dirLight.intensity = 0.15; // very dark
        ambientLight.color.setHex(0x1a202c);
        ambientLight.intensity = 0.15;
      }
    };
    setupAtmosphere(weather);

    // 9. Build Car visual group
    // The car is composed of modular parts centered around the chassis mesh, so we can animate steering front wheels and wheel spins cleanly!
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Materials representing parts
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(carColor),
      roughness: 0.15,
      metalness: 0.85,
    });
    const subMetalMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.85, roughness: 0.2 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const spokesMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.7 });
    const brakeLightMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0x000000 });
    const headLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0dd });
    const undercarriageMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });

    // Store references to moving parts
    const wheelMeshes: THREE.Mesh[] = [];
    const frontSteerLeftGroup = new THREE.Group();
    const frontSteerRightGroup = new THREE.Group();
    let leftFrontWheelMesh: THREE.Mesh | null = null;
    let rightFrontWheelMesh: THREE.Mesh | null = null;
    let steeringWheelGroup: THREE.Group | null = null;
    let leftWiper: THREE.Mesh | null = null;
    let rightWiper: THREE.Mesh | null = null;
    let indicatorFL: THREE.Mesh | null = null;
    let indicatorFR: THREE.Mesh | null = null;
    let indicatorRL: THREE.Mesh | null = null;
    let indicatorRR: THREE.Mesh | null = null;
    let gasIconGroup: THREE.Group | null = null;
    let visualCan: THREE.Mesh | null = null;

    // Help rebuild the car visually based on model configuration
    const buildCarModel = (type: CarType, color: string) => {
      // Clear out the previous groups
      while (carGroup.children.length > 0) {
        carGroup.remove(carGroup.children[0]);
      }
      wheelMeshes.length = 0;
      frontSteerLeftGroup.clear();
      frontSteerRightGroup.clear();

      bodyMat.color.set(color);

      // Extract specs and flag if custom
      const specs = stateRef.current.customCarSpecs;
      const isCustomVal = type === 'custom';
      const tireRadius = isCustomVal ? specs.wheelSize : 0.48;
      const rimRadius = tireRadius * 0.62;
      const tireWidth = isCustomVal ? 0.35 * (specs.wheelSize / 0.48) : 0.35;
      const bodyLen = isCustomVal ? specs.bodyLength : 3.8;
      const bodyWid = isCustomVal ? specs.bodyWidth : 1.9;

      // Suspension/axis heights based on tireRadius
      const axisHeight = tireRadius * 1.05; // Ground clearance relative to tyre

      // Main Undercarriage/Deck plate
      const floor = new THREE.Mesh(new THREE.BoxGeometry(bodyWid, 0.2, bodyLen), undercarriageMat);
      floor.position.set(0, axisHeight, 0);
      floor.castShadow = true;
      floor.receiveShadow = true;
      carGroup.add(floor);

      // Create Wheels
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
      tireGeo.rotateZ(Math.PI / 2); // Rolling in orientation
      const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth * 1.05, 16);
      rimGeo.rotateZ(Math.PI / 2);

      // Build 4 wheels
      // Format: [isFront, isLeft, posX, posZ]
      const frontWheelZ = bodyLen * 0.33;
      const backWheelZ = -bodyLen * 0.29;
      const halfWheelX = bodyWid * 0.52;

      const wheelPos = [
        { isFront: true, isLeft: true, x: -halfWheelX, z: frontWheelZ },
        { isFront: true, isLeft: false, x: halfWheelX, z: frontWheelZ },
        { isFront: false, isLeft: true, x: -halfWheelX, z: backWheelZ },
        { isFront: false, isLeft: false, x: halfWheelX, z: backWheelZ },
      ];

      wheelPos.forEach((wp) => {
        // Individual wheel group (to allow rotation independent of wheel steering)
        const wheelObj = new THREE.Group();

        // Tire
        const tire = new THREE.Mesh(tireGeo, wheelMat);
        tire.castShadow = true;
        wheelObj.add(tire);

        // Rim spokes
        const rim = new THREE.Mesh(rimGeo, spokesMat);
        wheelObj.add(rim);

        // Add a highlight stripes for rotation visibility
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, tireRadius * 1.96, tireWidth * 1.1), subMetalMat);
        wheelObj.add(stripe);

        if (wp.isFront) {
          // Front wheels mount to a steering pivoting Group!
          if (wp.isLeft) {
            frontSteerLeftGroup.position.set(wp.x, axisHeight, wp.z);
            wheelObj.position.set(0, 0, 0);
            frontSteerLeftGroup.add(wheelObj);
            leftFrontWheelMesh = wheelObj as any; // Cast for references
            carGroup.add(frontSteerLeftGroup);
          } else {
            frontSteerRightGroup.position.set(wp.x, axisHeight, wp.z);
            wheelObj.position.set(0, 0, 0);
            frontSteerRightGroup.add(wheelObj);
            rightFrontWheelMesh = wheelObj as any;
            carGroup.add(frontSteerRightGroup);
          }
        } else {
          // Back wheels mount directly to car group
          wheelObj.position.set(wp.x, axisHeight, wp.z);
          carGroup.add(wheelObj);
          wheelMeshes.push(wheelObj as any);
        }
      });

      // Tail lights
      const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), brakeLightMat);
      tailL.position.set(-bodyWid * 0.37, axisHeight + 0.45, -bodyLen * 0.5);
      carGroup.add(tailL);

      const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), brakeLightMat);
      tailR.position.set(bodyWid * 0.37, axisHeight + 0.45, -bodyLen * 0.5);
      carGroup.add(tailR);

      // Head lights visual (not source spotlights)
      const headL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), headLightMat);
      headL.rotateX(Math.PI / 2);
      headL.position.set(-bodyWid * 0.4, axisHeight + 0.3, bodyLen * 0.5);
      carGroup.add(headL);

      const headR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), headLightMat);
      headR.rotateX(Math.PI / 2);
      headR.position.set(bodyWid * 0.4, axisHeight + 0.3, bodyLen * 0.5);
      carGroup.add(headR);

      // ==========================================
      // LICENSE PLATES & PREMIUM MULTI-BRAND EMBLEMS
      // ==========================================
      const createPlateTexture = (brand: string, style: string, text: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 1. Determine background colors based on style and brand combo
          let bg = '#1e293b'; // slate dark standard
          let border = '#ffffff';
          let borderThick = 2;
          let textCol = '#ffffff';

          if (style === 'classic') {
            if (brand === 'ford') {
              bg = '#1d4ed8'; // Ford Royal Blue
              border = '#ffffff';
              textCol = '#ffffff';
            } else if (brand === 'toyota') {
              bg = '#b91c1c'; // Toyota Red
              border = '#fca5a5';
              textCol = '#ffffff';
            } else if (brand === 'vinfast') {
              bg = '#ffffff'; // VinFast Elegant White
              border = '#0f172a';
              textCol = '#0f172a';
            } else if (brand === 'porsche') {
              bg = '#1c1917'; // Porsche Premium Black
              border = '#eab308'; // Gold trim
              textCol = '#eab308';
            } else {
              // honda
              bg = '#1e293b'; // Slate dark
              border = '#e2e8f0';
              textCol = '#ffffff';
            }
          } else if (style === 'neon') {
            bg = '#060b1e';
            border = '#06b6d4'; // Cyber Cyan Neon
            borderThick = 3;
            textCol = '#22d3ee';
          } else if (style === 'sport') {
            bg = '#e11d48'; // Sports red
            border = '#fecdd3';
            textCol = '#ffffff';
          } else if (style === 'military') {
            bg = '#3f4e3c'; // Camo Olive Drab
            border = '#854d0e'; // Bronze
            textCol = '#eab308'; // Bold Yellow
          }

          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, 128, 32);
          ctx.strokeStyle = border;
          ctx.lineWidth = borderThick;
          ctx.strokeRect(borderThick, borderThick, 128 - borderThick * 2, 32 - borderThick * 2);

          // 2. Draw brand tag centered at the top
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold italic 7px sans-serif';
          ctx.fillStyle = textCol;
          
          let brandName = brand.toUpperCase();
          if (brand === 'vinfast') brandName = 'VINFAST';
          ctx.fillText(brandName, 64, 8);

          // 3. Draw plate number text centered at the bottom
          ctx.font = 'bold 11px monospace';
          ctx.fillText(text || `${brand.toUpperCase()}-3000`, 64, 21);
        }
        return new THREE.CanvasTexture(canvas);
      };

      try {
        const brand = specs.brand || 'ford';
        const brandStyle = specs.brandStyle || 'classic';
        const pTex = createPlateTexture(brand, brandStyle, stateRef.current.customLogoText || specs.plateNumber || 'SERVER-EXE');
        const pMat = new THREE.MeshBasicMaterial({ map: pTex });
        const pGeo = new THREE.BoxGeometry(0.72, 0.22, 0.02);

        // Front bumper plate
        const fp = new THREE.Mesh(pGeo, pMat);
        fp.position.set(0, axisHeight + 0.12, bodyLen * 0.50 + 0.015);
        carGroup.add(fp);

        // Rear plate
        const bp = new THREE.Mesh(pGeo, pMat);
        bp.position.set(0, axisHeight + 0.22, -bodyLen * 0.50 - 0.015);
        bp.rotateY(Math.PI);
        carGroup.add(bp);

        // ==========================================
        // WINDSHIELD WIPERS & BLINKER INDICATOR LIGHT BULBS
        // ==========================================
        const indicatorGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffa500 });

        const flLight = new THREE.Mesh(indicatorGeo, indicatorMat);
        flLight.position.set(-bodyWid * 0.44, axisHeight + 0.32, bodyLen * 0.49);
        carGroup.add(flLight);

        const frLight = new THREE.Mesh(indicatorGeo, indicatorMat);
        frLight.position.set(bodyWid * 0.44, axisHeight + 0.32, bodyLen * 0.49);
        carGroup.add(frLight);

        const rlLight = new THREE.Mesh(indicatorGeo, indicatorMat);
        rlLight.position.set(-bodyWid * 0.44, axisHeight + 0.32, -bodyLen * 0.49);
        carGroup.add(rlLight);

        const rrLight = new THREE.Mesh(indicatorGeo, indicatorMat);
        rrLight.position.set(bodyWid * 0.44, axisHeight + 0.32, -bodyLen * 0.49);
        carGroup.add(rrLight);

        indicatorFL = flLight;
        indicatorFR = frLight;
        indicatorRL = rlLight;
        indicatorRR = rrLight;

        const wipersGroup = new THREE.Group();
        wipersGroup.position.set(0, axisHeight + 0.65, bodyLen * 0.18); 

        const wiperArmGeo = new THREE.BoxGeometry(0.02, 0.45, 0.02);
        const wiperArmMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

        const lArm = new THREE.Mesh(wiperArmGeo, wiperArmMat);
        lArm.position.set(-0.25, 0.16, 0);
        lArm.rotation.z = -Math.PI / 4;
        wipersGroup.add(lArm);

        const rArm = new THREE.Mesh(wiperArmGeo, wiperArmMat);
        rArm.position.set(0.25, 0.16, 0);
        rArm.rotation.z = -Math.PI / 4;
        wipersGroup.add(rArm);

        carGroup.add(wipersGroup);

        leftWiper = lArm;
        rightWiper = rArm;

        // ==========================================
        // DYNAMIC BRAND BADGE/EMBLEM LOGO ON FRONT HOOD
        // ==========================================
        const emblemGroup = new THREE.Group();
        emblemGroup.position.set(0, axisHeight + 0.38, bodyLen * 0.50 + 0.012);
        carGroup.add(emblemGroup);

        if (brand === 'ford') {
          // Classic Ford Blue Oval badge
          const emb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8, roughness: 0.1 }));
          emb.rotateX(Math.PI / 2);
          emblemGroup.add(emb);

          const badgeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
          badgeTrim.position.set(0, 0, 0.008);
          emblemGroup.add(badgeTrim);

        } else if (brand === 'toyota') {
          // Double concentric rings for toyota
          const embOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 }));
          embOuter.rotateX(Math.PI / 2);
          emblemGroup.add(embOuter);

          const innerCircle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 12), new THREE.MeshStandardMaterial({ color: 0xcd1818, metalness: 0.2 }));
          innerCircle.rotateX(Math.PI / 2);
          innerCircle.position.set(0, 0, 0.002);
          emblemGroup.add(innerCircle);

        } else if (brand === 'vinfast') {
          // Stylized iconic VinFast 'V' logo representation
          const vLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 }));
          vLeft.rotation.z = -Math.PI / 6;
          vLeft.position.set(-0.04, 0.02, 0);
          emblemGroup.add(vLeft);

          const vRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 }));
          vRight.rotation.z = Math.PI / 6;
          vRight.position.set(0.04, 0.02, 0);
          emblemGroup.add(vRight);

          // Add elegant red background glow pad
          const vPad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.01), new THREE.MeshStandardMaterial({ color: 0xdd1010, roughness: 0.5 }));
          emblemGroup.add(vPad);

        } else if (brand === 'porsche') {
          // Shield polygon for Porsche GT
          const shield = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.9, roughness: 0.1 }));
          shield.rotation.z = Math.PI / 4; // tilt like diamond/shield nose
          emblemGroup.add(shield);

          // Red-black core accent
          const core = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.025), new THREE.MeshBasicMaterial({ color: 0xbb1111 }));
          core.position.set(0, 0, 0.005);
          emblemGroup.add(core);

        } else if (brand === 'honda') {
          // Classic bold H emblem
          const hLeft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.03), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
          hLeft.position.set(-0.05, 0, 0);
          emblemGroup.add(hLeft);

          const hRight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.03), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
          hRight.position.set(0.05, 0, 0);
          emblemGroup.add(hRight);

          const hMid = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
          emblemGroup.add(hMid);

          // Outer chrome ring
          const hRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }));
          hRing.position.set(0, 0, -0.005);
          emblemGroup.add(hRing);
        }
      } catch (err) {
        console.warn("Could not generate plates or logos", err);
      }

      if (type === 'custom') {
        const bodyH = specs.bodyHeight;
        const roofH = specs.roofHeight;
        const frontCabL = specs.frontCabinLength;

        // 1. Core Chassis group / Body Hull
        const mainCabin = new THREE.Mesh(new THREE.BoxGeometry(bodyWid - 0.1, bodyH, bodyLen - 0.2), bodyMat);
        mainCabin.position.set(0, axisHeight + bodyH * 0.5, 0);
        mainCabin.castShadow = true;
        mainCabin.receiveShadow = true;
        carGroup.add(mainCabin);

        // 2. Cockpit / Window glass cabin
        const cabinLen = bodyLen * 0.45;
        const cabinWid = bodyWid * 0.72;
        const cockpit = new THREE.Mesh(new THREE.BoxGeometry(cabinWid, roofH, cabinLen), glassMat);
        // Position it at the back part of body, mui/front cabin length pushes cabin back
        const cockpitZ = (bodyLen * 0.5) - frontCabL - (cabinLen * 0.5);
        cockpit.position.set(0, axisHeight + bodyH + roofH * 0.5, cockpitZ);
        cockpit.castShadow = true;
        carGroup.add(cockpit);

        // Solid top roof (painted in body material)
        const roofCover = new THREE.Mesh(new THREE.BoxGeometry(cabinWid + 0.04, 0.04, cabinLen + 0.04), bodyMat);
        roofCover.position.set(0, axisHeight + bodyH + roofH, cockpitZ);
        roofCover.castShadow = true;
        carGroup.add(roofCover);

        // 3. Decal Styles
        if (specs.decalStyle === 'stripes') {
          // Double racing stripes along the hood
          const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, bodyLen), subMetalMat);
          stripeL.position.set(-0.25, axisHeight + bodyH + 0.01, 0);
          carGroup.add(stripeL);

          const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, bodyLen), subMetalMat);
          stripeR.position.set(0.25, axisHeight + bodyH + 0.01, 0);
          carGroup.add(stripeR);

        } else if (specs.decalStyle === 'neon_grid') {
          // Glowing neon lines geometry decorations
          const emissiveGoldMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x00a3ff });
          const gridL = new THREE.Mesh(new THREE.BoxGeometry(bodyWid - 0.06, 0.04, 0.06), emissiveGoldMat);
          gridL.position.set(0, axisHeight + bodyH * 0.6, bodyLen * 0.2);
          carGroup.add(gridL);

          const gridR = new THREE.Mesh(new THREE.BoxGeometry(bodyWid - 0.06, 0.04, 0.06), emissiveGoldMat);
          gridR.position.set(0, axisHeight + bodyH * 0.6, -bodyLen * 0.2);
          carGroup.add(gridR);

        } else if (specs.decalStyle === 'beast') {
          // Dark wolf claw / scratch lines
          const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
          for (let i = -1; i <= 1; i++) {
            const claw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.6), darkMat);
            claw.rotation.y = 0.2;
            claw.position.set(i * 0.4 + 0.2, axisHeight + bodyH + 0.01, bodyLen * 0.3);
            carGroup.add(claw);
          }
        }

        // 4. Spoiler Styles
        if (specs.spoilerStyle === 'winged') {
          const spoilerBarL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), subMetalMat);
          spoilerBarL.position.set(-bodyWid * 0.37, axisHeight + bodyH + 0.22, -bodyLen * 0.4);
          carGroup.add(spoilerBarL);

          const spoilerBarR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), subMetalMat);
          spoilerBarR.position.set(bodyWid * 0.37, axisHeight + bodyH + 0.22, -bodyLen * 0.4);
          carGroup.add(spoilerBarR);

          const wing = new THREE.Mesh(new THREE.BoxGeometry(bodyWid * 1.05, 0.05, 0.35), bodyMat);
          wing.position.set(0, axisHeight + bodyH + 0.45, -bodyLen * 0.4);
          wing.castShadow = true;
          carGroup.add(wing);

        } else if (specs.spoilerStyle === 'twin_fins') {
          // Dual sharp shark fins on the rear mui edges
          const finL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.4), bodyMat);
          finL.position.set(-bodyWid * 0.4, axisHeight + bodyH + 0.175, -bodyLen * 0.4);
          finL.castShadow = true;
          carGroup.add(finL);

          const finR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.4), bodyMat);
          finR.position.set(bodyWid * 0.4, axisHeight + bodyH + 0.175, -bodyLen * 0.4);
          finR.castShadow = true;
          carGroup.add(finR);

        } else if (specs.spoilerStyle === 'brutalist') {
          // Thick dual blocks representing a giant thruster engine block
          const block = new THREE.Mesh(new THREE.BoxGeometry(bodyWid * 0.5, bodyH * 0.6, 0.5), subMetalMat);
          block.position.set(0, axisHeight + bodyH * 1.1, -bodyLen * 0.4);
          block.castShadow = true;
          carGroup.add(block);

          // Rear glowing thrust particle cone
          const glowJet = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.05, 0.3, 8),
            new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.85 })
          );
          glowJet.rotateX(Math.PI / 2);
          glowJet.position.set(0, axisHeight + bodyH * 1.1, -bodyLen * 0.4 - 0.35);
          carGroup.add(glowJet);
        }

      } else if (type === 'sport') {
        // Sleek aerodynamic layout
        const mainCabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 3.4), bodyMat);
        mainCabin.position.set(0, 0.4, 0);
        mainCabin.castShadow = true;
        carGroup.add(mainCabin);

        const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 1.4), glassMat);
        cockpit.position.set(0, 0.76, -0.1);
        cockpit.castShadow = true;
        carGroup.add(cockpit);

        // Spoiler wing
        const spoilerBarL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), subMetalMat);
        spoilerBarL.position.set(-0.7, 0.75, -1.7);
        carGroup.add(spoilerBarL);

        const spoilerBarR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), subMetalMat);
        spoilerBarR.position.set(0.7, 0.75, -1.7);
        carGroup.add(spoilerBarR);

        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.4), bodyMat);
        wing.position.set(0, 0.95, -1.7);
        wing.castShadow = true;
        carGroup.add(wing);

        // Hood scoop
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.8), subMetalMat);
        scoop.position.set(0, 0.65, 0.8);
        carGroup.add(scoop);

      } else if (type === 'cyber') {
        // Brutalist angular design (Low-poly Cyber Truck style!)
        const bodyGeo = new THREE.BufferGeometry();
        // vertices for a wedges/origami cyber prism
        const vertices = new Float32Array([
          // Base plate
          -0.9, 0.2, -1.9,   0.9, 0.2, -1.9,   0.9, 0.2, 1.9,
          -0.9, 0.2, -1.9,   0.9, 0.2, 1.9,   -0.9, 0.2, 1.9,
          // Roof top ridge lines
          -0.8, 1.15, -0.4,   0.8, 1.15, -0.4,   0.8, 1.15, -0.1,
          -0.8, 1.15, -0.4,   0.8, 1.15, -0.1,  -0.8, 1.15, -0.1,
          // Front Hood slope
          -0.9, 0.5, 1.9,    0.9, 0.5, 1.9,     0.8, 1.15, -0.1,
          -0.9, 0.5, 1.9,    0.8, 1.15, -0.1,  -0.8, 1.15, -0.1,
          // Back bed slope
          -0.9, 0.45, -1.9,  -0.8, 1.15, -0.4,   0.8, 1.15, -0.4,
          -0.9, 0.45, -1.9,   0.8, 1.15, -0.4,   0.9, 0.45, -1.9
        ]);
        bodyGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        bodyGeo.computeVertexNormals();

        const cyberBody = new THREE.Mesh(bodyGeo, bodyMat);
        cyberBody.castShadow = true;
        cyberBody.receiveShadow = true;
        carGroup.add(cyberBody);

        // Cyber light bar strip
        const cyberLight = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 0.05), headLightMat);
        cyberLight.position.set(0, 0.5, 1.9);
        carGroup.add(cyberLight);

      } else if (type === 'suv') {
        // Rigid boxed offroad SUV layout
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 3.6), bodyMat);
        chassis.position.set(0, 0.48, 0);
        chassis.castShadow = true;
        carGroup.add(chassis);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), bodyMat);
        cabin.position.set(0, 0.95, -0.35);
        cabin.castShadow = true;
        carGroup.add(cabin);

        const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.05), glassMat);
        frontWindshield.rotation.x = Math.PI / 10;
        frontWindshield.position.set(0, 0.95, 0.71);
        carGroup.add(frontWindshield);

        const windows = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 1.8), glassMat);
        windows.position.set(0, 0.95, -0.4);
        carGroup.add(windows);

        // Bullbars grill
        const bullbar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.1), subMetalMat);
        bullbar.position.set(0, 0.35, 1.85);
        carGroup.add(bullbar);

        // Spare wheel in rear
        const spareObj = new THREE.Group();
        const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12), wheelMat);
        spareTire.rotation.x = Math.PI / 2;
        spareTire.castShadow = true;
        spareObj.add(spareTire);
        spareObj.position.set(0, 0.9, -1.92);
        carGroup.add(spareObj);

      } else if (type === 'classic') {
        // Curve mudguards vintage muscle car
        const vintageBody = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.4, 3.7), bodyMat);
        vintageBody.position.set(0, 0.38, 0);
        vintageBody.castShadow = true;
        carGroup.add(vintageBody);

        // Cab roof
        const vintageCab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.6), bodyMat);
        vintageCab.position.set(0, 0.78, -0.4);
        vintageCab.castShadow = true;
        carGroup.add(vintageCab);

        // Slanted back bed
        const slantBed = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.4, 1.5), glassMat);
        slantBed.position.set(0, 0.7, -0.4);
        carGroup.add(slantBed);

        // Chromed bumper
        const grill = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 0.12), spokesMat);
        grill.position.set(0, 0.32, 1.87);
        carGroup.add(grill);

        const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.15, 0.12), spokesMat);
        rearBumper.position.set(0, 0.2, -1.87);
        carGroup.add(rearBumper);
      }

      // ==========================================
      // INTEGRATED 3D AUTHENTIC CABIN & STEERING COCKPIT
      // ==========================================
      const cockpitGroup = new THREE.Group();

      // Dashboard main desk positioned in front of driver seat
      const consoleGeo = new THREE.BoxGeometry(1.24, 0.35, 0.45);
      const consoleMesh = new THREE.Mesh(consoleGeo, new THREE.MeshStandardMaterial({ color: 0x111522, roughness: 0.92 }));
      consoleMesh.position.set(0, axisHeight + 0.44, 0.82);
      cockpitGroup.add(consoleMesh);

      // High-resolution visual instrument display (Cyan glow)
      const dialDisplay = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.17, 0.02),
        new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
      );
      dialDisplay.position.set(-0.35, axisHeight + 0.58, 0.96);
      cockpitGroup.add(dialDisplay);

      // Auxiliary screen monitor / GPS navigation array (Glow neon pink)
      const screenDisplay = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.19, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xd946ef })
      );
      screenDisplay.position.set(0.12, axisHeight + 0.52, 0.96);
      cockpitGroup.add(screenDisplay);

      // Interactive 3D steer wheel assembly
      const stGroup = new THREE.Group();
      stGroup.position.set(-0.35, axisHeight + 0.55, 0.88); // left driver layout
      stGroup.rotation.x = -Math.PI / 6;

      const columnShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.1 })
      );
      columnShaft.rotation.x = Math.PI / 2;
      columnShaft.position.set(0, 0, -0.13);
      stGroup.add(columnShaft);

      const rimCircle = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.017, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85 })
      );
      stGroup.add(rimCircle);

      const horizontalSpoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.025, 0.014),
        new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.15 })
      );
      stGroup.add(horizontalSpoke);

      const verticalSpoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.12, 0.014),
        new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.15 })
      );
      verticalSpoke.position.set(0, -0.04, 0);
      stGroup.add(verticalSpoke);

      // Central brand insignia emblem
      const brandLogo = specs?.brand || 'ford';
      let logoHex = 0x1e3a8a; // Ford
      if (brandLogo === 'toyota') logoHex = 0xb91c1c; // Toyota
      else if (brandLogo === 'vinfast') logoHex = 0x111111; // Vinfast dark
      else if (brandLogo === 'porsche') logoHex = 0xd97706; // Porsche amber/gold
      else if (brandLogo === 'honda') logoHex = 0x4b5563; // Honda silver

      const emblemMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.033, 0.033, 0.02, 12),
        new THREE.MeshStandardMaterial({ color: logoHex, metalness: 0.5, roughness: 0.2 })
      );
      emblemMesh.rotation.x = Math.PI / 2;
      stGroup.add(emblemMesh);

      cockpitGroup.add(stGroup);
      carGroup.add(cockpitGroup);

      steeringWheelGroup = stGroup;
    };
    buildCarModel(selectedCar, carColor);

    // 10. Dust Particles effect behind tires
    const dustCount = 45;
    const dustParticles: { mesh: THREE.Mesh; life: number; velocity: THREE.Vector3; initialScale: number }[] = [];
    const dustGeo = new THREE.DodecahedronGeometry(0.2, 0);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.5,
    });

    const triggerDust = (px: number, py: number, pz: number, intensity: number) => {
      // Find inactive dust particle
      const p = dustParticles.find(d => d.life <= 0);
      if (p) {
        p.mesh.position.set(px, py, pz);
        p.life = 1.0;
        p.initialScale = 0.45 + Math.random() * 0.45;
        p.mesh.scale.set(p.initialScale, p.initialScale, p.initialScale);
        p.velocity.set(
          (Math.random() - 0.5) * 1.5 - Math.sin(carState.current.rotY) * carState.current.speed * 0.1,
          Math.random() * 0.8 + 0.5,
          (Math.random() - 0.5) * 1.5 - Math.cos(carState.current.rotY) * carState.current.speed * 0.1
        );
        p.mesh.visible = true;
      }
    };

    for (let i = 0; i < dustCount; i++) {
      const dMesh = new THREE.Mesh(dustGeo, dustMat.clone());
      dMesh.visible = false;
      scene.add(dMesh);
      dustParticles.push({
        mesh: dMesh,
        life: 0,
        velocity: new THREE.Vector3(),
        initialScale: 1
      });
    }

    // Adjust dust color dynamically based on terrain
    const setDustColorByTrack = (track: TrackType) => {
      const color = track === 'desert_bumpy' ? 0xe9d6a3 : (track === 'grassland' ? 0xaec3b0 : 0x888888);
      dustParticles.forEach((p) => {
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      });
    };
    setDustColorByTrack(selectedTrack);

    // ==========================================
    // 10B. Smoke Particles for Car Damage Engine
    // ==========================================
    const smokeCount = 35;
    const smokeParticles: { mesh: THREE.Mesh; life: number; velocity: THREE.Vector3; initialScale: number }[] = [];
    const smokeGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.6,
    });
    
    // Array to track custom 3D explosion fireball particles
    const activeExplosionFires: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
    
    for (let i = 0; i < smokeCount; i++) {
      const sMesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      sMesh.visible = false;
      scene.add(sMesh);
      smokeParticles.push({
        mesh: sMesh,
        life: 0,
        velocity: new THREE.Vector3(),
        initialScale: 1
      });
    }

    const triggerSmoke = (px: number, py: number, pz: number, isDark: boolean) => {
      const p = smokeParticles.find(s => s.life <= 0);
      if (p) {
        p.mesh.position.set(px, py, pz);
        p.life = 1.0;
        p.initialScale = 0.5 + Math.random() * 0.9;
        p.mesh.scale.set(p.initialScale, p.initialScale, p.initialScale);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(isDark ? 0x181818 : 0x7c7c7c);
        p.velocity.set(
          (Math.random() - 0.5) * 0.7,
          Math.random() * 2.2 + 1.2,
          (Math.random() - 0.5) * 0.7
        );
        p.mesh.visible = true;
      }
    };

    // ==========================================
    // 10C. Walk-Around Humanoid Playable Character (50% Real Visuals)
    // ==========================================
    const personGroup = new THREE.Group();
    scene.add(personGroup);
    personGroup.visible = false; // invisible while driving

    const pShirtMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }); // Blue jacket
    const pPantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }); // Slate jeans
    const pSkinMat = new THREE.MeshStandardMaterial({ color: 0xffdbb5, roughness: 0.6 }); // Head/hands skin
    const pHairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 }); // Black hair
    const pShoeMat = new THREE.MeshStandardMaterial({ color: 0x090d16 }); // Dark sneakers

    // Head
    const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), pSkinMat);
    pHead.position.set(0, 1.45, 0);
    pHead.castShadow = true;
    personGroup.add(pHead);

    // Hair cap
    const pHair = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), pHairMat);
    pHair.position.set(0, 1.58, -0.03);
    personGroup.add(pHair);

    // Jacket (Torso)
    const pTorso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 0.2), pShirtMat);
    pTorso.position.set(0, 1.0, 0);
    pTorso.castShadow = true;
    pTorso.receiveShadow = true;
    personGroup.add(pTorso);

    // Limbs Setup (Arms, Legs)
    const pLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.52), pPantsMat);
    pLegL.position.set(-0.1, 0.5, 0);
    pLegL.castShadow = true;
    personGroup.add(pLegL);

    const pLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.52), pPantsMat);
    pLegR.position.set(0.1, 0.5, 0);
    pLegR.castShadow = true;
    personGroup.add(pLegR);

    const pArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.45), pShirtMat);
    pArmL.position.set(-0.23, 1.05, 0);
    pArmL.castShadow = true;
    personGroup.add(pArmL);

    const pArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.45), pShirtMat);
    pArmR.position.set(0.23, 1.05, 0);
    pArmR.castShadow = true;
    personGroup.add(pArmR);

    // Sneakers
    const pShoeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.13), pShoeMat);
    pShoeL.position.set(-0.1, 0.22, 0.02);
    personGroup.add(pShoeL);

    const pShoeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.13), pShoeMat);
    pShoeR.position.set(0.1, 0.22, 0.02);
    personGroup.add(pShoeR);

    // Dynamic Customizable Accessory Meshes
    const pGlasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 })
    );
    pGlasses.position.set(0, 1.48, 0.11);
    personGroup.add(pGlasses);

    const pJetpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.38, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 })
    );
    pJetpack.position.set(0, 1.0, -0.16);
    personGroup.add(pJetpack);

    const pWingsGroup = new THREE.Group();
    const wingL = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.7, 4),
      new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, transparent: true, opacity: 0.8 })
    );
    wingL.position.set(-0.25, 1.1, -0.13);
    wingL.rotation.z = Math.PI / 3;
    pWingsGroup.add(wingL);

    const wingR = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.7, 4),
      new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, transparent: true, opacity: 0.8 })
    );
    wingR.position.set(0.25, 1.1, -0.13);
    wingR.rotation.z = -Math.PI / 3;
    pWingsGroup.add(wingR);
    personGroup.add(pWingsGroup);

    // Gasoline jerrycan floating indicator above player head when carrying fuel
    visualCan = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.32, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5, metalness: 0.1 })
    );
    visualCan.position.set(0, 1.48, 0.0);
    visualCan.visible = false;
    personGroup.add(visualCan);

    // ==========================================
    // 10D. Map Repair Shop Garage Pad station
    // ==========================================
    const garageX = 15;
    const garageZ = 15;
    const garageHeight = getTerrainHeight(garageX, garageZ, selectedTrack);
    const garageGroup = new THREE.Group();
    scene.add(garageGroup);

    // Glowing main visual platform
    const padGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.35, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Tailwind sky blue
      emissive: 0x0284c7,
      transparent: true,
      opacity: 0.4,
      roughness: 0.2
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(garageX, garageHeight + 0.175, garageZ);
    padMesh.receiveShadow = true;
    garageGroup.add(padMesh);

    // Rotating wrench symbol floats over the pad
    const wrenchGroup = new THREE.Group();
    wrenchGroup.position.set(garageX, garageHeight + 2.2, garageZ);
    garageGroup.add(wrenchGroup);

    // Low-poly wrench model
    const wrenchHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 1.1, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 })
    );
    wrenchGroup.add(wrenchHandle);

    const wrenchCrotch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 })
    );
    wrenchCrotch.position.set(0, 0.55, 0);
    wrenchGroup.add(wrenchCrotch);

    // ==========================================
    // 10E. Map Refueling Gas/Power Pad station at (-15, -15)
    // ==========================================
    const gasX = -15;
    const gasZ = -15;
    const gasHeight = getTerrainHeight(gasX, gasZ, selectedTrack);
    const gasGroup = new THREE.Group();
    scene.add(gasGroup);

    // Glowing orange refueling platform
    const gasPadGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.35, 32);
    const gasPadMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Tailwind amber-500
      emissive: 0xb45309, // amber-700
      transparent: true,
      opacity: 0.4,
      roughness: 0.2
    });
    const gasPadMesh = new THREE.Mesh(gasPadGeo, gasPadMat);
    gasPadMesh.position.set(gasX, gasHeight + 0.175, gasZ);
    gasPadMesh.receiveShadow = true;
    gasGroup.add(gasPadMesh);

    // Rotating fuel canister icon
    gasIconGroup = new THREE.Group();
    gasIconGroup.position.set(gasX, gasHeight + 2.1, gasZ);
    gasGroup.add(gasIconGroup);

    // Jerrycan body
    const canBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.65, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45, metalness: 0.1 }) // orange
    );
    gasIconGroup.add(canBody);

    // Canister handle
    const canHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.35, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x4b5563 })
    );
    canHandle.position.set(0, 0.34, 0);
    gasIconGroup.add(canHandle);

    // Spout nozzle
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db })
    );
    spout.position.set(0.16, 0.3, 0);
    spout.rotation.z = -Math.PI / 4;
    gasIconGroup.add(spout);

    // Keyboard tracking
    const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, space: false, g: false };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      soundEngine.resume(); // Ensure resume on action
      
      const charKey = e.key.toLowerCase();
      const code = e.code;

      if (charKey === 'w' || code === 'KeyW' || code === 'ArrowUp') {
        keys.w = true;
        keys.ArrowUp = true;
      }
      if (charKey === 's' || code === 'KeyS' || code === 'ArrowDown') {
        keys.s = true;
        keys.ArrowDown = true;
      }
      if (charKey === 'a' || code === 'KeyA' || code === 'ArrowLeft') {
        keys.a = true;
        keys.ArrowLeft = true;
      }
      if (charKey === 'd' || code === 'KeyD' || code === 'ArrowRight') {
        keys.d = true;
        keys.ArrowRight = true;
      }
      if (charKey === ' ' || code === 'Space') {
        keys.space = true;
      }
      if (charKey === 'g' || code === 'KeyG') {
        keys.g = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // KeyUp should release regardless of active focus to prevent stuck keys, 
      // but if typing in input we can safely allow releasing keys as fallback.
      const charKey = e.key.toLowerCase();
      const code = e.code;

      if (charKey === 'w' || code === 'KeyW' || code === 'ArrowUp') {
        keys.w = false;
        keys.ArrowUp = false;
      }
      if (charKey === 's' || code === 'KeyS' || code === 'ArrowDown') {
        keys.s = false;
        keys.ArrowDown = false;
      }
      if (charKey === 'a' || code === 'KeyA' || code === 'ArrowLeft') {
        keys.a = false;
        keys.ArrowLeft = false;
      }
      if (charKey === 'd' || code === 'KeyD' || code === 'ArrowRight') {
        keys.d = false;
        keys.ArrowRight = false;
      }
      if (charKey === ' ' || code === 'Space') {
        keys.space = false;
      }
      if (charKey === 'g' || code === 'KeyG') {
        keys.g = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // --- INTEGRATE ORBIT FREE LOOK CAMERA ROTATIONS ---
    let isDragging = false;
    let prevMoveX = 0;
    let prevMoveY = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      // Focus container to capture key events immediately inside the preview iframe
      try {
        if (container) {
          container.focus();
        }
        window.focus();
      } catch (err) {
        console.warn("Could not focus container:", err);
      }
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMoveX = clientX;
      prevMoveY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - prevMoveX;
      const dy = clientY - prevMoveY;

      prevMoveX = clientX;
      prevMoveY = clientY;

      const sensitivity = 0.007;
      orbitRef.current.yaw -= dx * sensitivity; // rotate view
      orbitRef.current.pitch = Math.max(0.02, Math.min(Math.PI / 2 - 0.05, orbitRef.current.pitch + dy * sensitivity));
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onCanvasWheel = (e: WheelEvent) => {
      const zoomSensitivity = 0.01;
      orbitRef.current.radius = Math.max(4.0, Math.min(45.0, orbitRef.current.radius + e.deltaY * zoomSensitivity));
    };

    const handlePointerEnter = () => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
        try {
          container?.focus();
        } catch (_) {}
      }
    };

    if (container) {
      container.addEventListener('mousedown', onPointerDown);
      container.addEventListener('touchstart', onPointerDown, { passive: true });
      container.addEventListener('mousemove', onPointerMove);
      container.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
      container.addEventListener('wheel', onCanvasWheel, { passive: true });
      
      container.addEventListener('mouseenter', handlePointerEnter);
    }

    // Clock
    const clock = new THREE.Clock();

    // Reset coordinates helper
    carState.current.posX = 0;
    carState.current.posZ = selectedTrack === 'racetrack' ? 50 : 0;
    carState.current.posY = getTerrainHeight(carState.current.posX, carState.current.posZ, selectedTrack) + 1.2;
    carState.current.rotY = selectedTrack === 'racetrack' ? Math.PI : 0;

    let frameId: number;

    // 11. Physics/Interactive Loop
    const tick = () => {
      frameId = requestAnimationFrame(tick);

      const delta = Math.min(clock.getDelta(), 0.1); // Clamp visual time step for physics
      const config = stateRef.current.physicsConfig;
      const curSelectedTrack = stateRef.current.selectedTrack;
      const curSelectedCar = stateRef.current.selectedCar;
      const activeCamMode = stateRef.current.cameraMode;

      // Update Playtime
      carState.current.playTime += delta;

      // Handle Follow Owner mode dynamically updating the target
      if (carState.current.isFollowingOwner && stateRef.current.playerMode === 'walking' && !carState.current.isExploded) {
        carState.current.aiDriveTarget = {
          x: carState.current.walkerX ?? 0,
          z: carState.current.walkerZ ?? 0,
          threshold: 1.5,
        };
      } else if (carState.current.isFollowingOwner && stateRef.current.playerMode === 'driving') {
        // Automatically stop following owner if they enter the car
        carState.current.isFollowingOwner = false;
        carState.current.aiDriveTarget = null;
      }

      // Handle separate inputs for walking vs remote car controls
      let walkerForwardPressed = false;
      let walkerReversePressed = false;
      let walkerLeftPressed = false;
      let walkerRightPressed = false;

      let carForwardPressed = false;
      let carReversePressed = false;
      let carLeftPressed = false;
      let carRightPressed = false;

      if (stateRef.current.playerMode === 'walking') {
        walkerForwardPressed = keys.w || keys.ArrowUp || stateRef.current.isAccelerating;
        walkerReversePressed = keys.s || keys.ArrowDown || stateRef.current.isBraking;
        walkerLeftPressed = keys.a || keys.ArrowLeft || stateRef.current.steerLeft;
        walkerRightPressed = keys.d || keys.ArrowRight || stateRef.current.steerRight;

        carForwardPressed = carState.current.remoteCommand === 'forward';
        carReversePressed = carState.current.remoteCommand === 'reverse';
        carLeftPressed = carState.current.remoteCommand === 'left';
        carRightPressed = carState.current.remoteCommand === 'right';
      } else {
        carForwardPressed = keys.w || keys.ArrowUp || stateRef.current.isAccelerating || carState.current.remoteCommand === 'forward';
        carReversePressed = keys.s || keys.ArrowDown || stateRef.current.isBraking || carState.current.remoteCommand === 'reverse';
        carLeftPressed = keys.a || keys.ArrowLeft || stateRef.current.steerLeft || carState.current.remoteCommand === 'left';
        carRightPressed = keys.d || keys.ArrowRight || stateRef.current.steerRight || carState.current.remoteCommand === 'right';
      }

      const eBrake = keys.space;

      // AI Autopilot Physical Autonomous Driving Overrides (mochiAIC#3)
      let targetSteer = 0;
      if (carState.current.aiDriveTarget && !carState.current.isExploded) {
        const destX = carState.current.aiDriveTarget.x;
        const destZ = carState.current.aiDriveTarget.z;
        const stopDist = carState.current.aiDriveTarget.threshold ?? 4.5;
        const curX = carState.current.posX;
        const curZ = carState.current.posZ;
        
        const dx = destX - curX;
        const dz = destZ - curZ;
        const targetDist = Math.sqrt(dx * dx + dz * dz);
        
        if (targetDist > stopDist) {
          if (carState.current.isFollowingOwner) {
            carState.current.hasToastedFollowReach = false;
          }
          // Force engine on
          carState.current.isEngineOn = true;
          
          if (carState.current.aiReverseTimer > 0) {
            // BACKING UP & ROTATING (LÙI & TRÁNH VẬT CẢN TRUYỀN THÔNG SMART)
            carState.current.aiReverseTimer -= delta;
            carForwardPressed = false;
            carReversePressed = true;
            
            // Steer in reverse to pivot away from obstacle
            const pivotAngle = Math.atan2(dx, dz);
            let pivotDiff = pivotAngle - carState.current.rotY;
            pivotDiff = Math.atan2(Math.sin(pivotDiff), Math.cos(pivotDiff));
            
            targetSteer = pivotDiff > 0 ? config.maxSteerAngle : -config.maxSteerAngle;
            
            if (targetSteer < -0.05) { carLeftPressed = true; carRightPressed = false; }
            else if (targetSteer > 0.05) { carRightPressed = true; carLeftPressed = false; }
            else { carLeftPressed = false; carRightPressed = false; }
          } else {
            // NORMAL FORWARD HIGH-PRECISION AUTOPILOT
            const targetAngle = Math.atan2(dx, dz);
            let angleDiff = targetAngle - carState.current.rotY;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            
            // Intelligent stuck sensor
            const curSpeedAbs = Math.abs(carState.current.speed);
            if (curSpeedAbs < 0.8) {
              carState.current.aiStuckTimer += delta;
              if (carState.current.aiStuckTimer > 1.2) {
                carState.current.aiReverseTimer = 1.8;
                carState.current.aiStuckTimer = 0;
              }
            } else {
              carState.current.aiStuckTimer = Math.max(0, carState.current.aiStuckTimer - delta * 0.5);
            }
            
            // --- ADVANCED PROACTIVE COLLISION DETECTOR & ESCAPE (mochiAIC#3) ---
            let obstacleAvoidanceOffset = 0;
            let hasObstacleAhead = false;
            let minObstacleDist = 999;
            const lookAheadDist = Math.max(6.0, curSpeedAbs * 1.5);
            const carDirX = Math.sin(carState.current.rotY);
            const carDirZ = Math.cos(carState.current.rotY);

            obstacleMeshes.forEach((obs) => {
              const ox = obs.position.x;
              const oz = obs.position.z;
              const ox_dx = ox - curX;
              const oz_dz = oz - curZ;
              const obsDist = Math.sqrt(ox_dx * ox_dx + oz_dz * oz_dz);
              
              if (obsDist < lookAheadDist) {
                const dot = ox_dx * carDirX + oz_dz * carDirZ;
                if (dot > 0.1) {
                  const carSideX = -carDirZ;
                  const carSideZ = carDirX;
                  const sideOffset = ox_dx * carSideX + oz_dz * carSideZ;
                  
                  if (Math.abs(sideOffset) < 3.8) {
                    hasObstacleAhead = true;
                    if (obsDist < minObstacleDist) {
                      minObstacleDist = obsDist;
                      obstacleAvoidanceOffset = sideOffset > 0 ? -0.9 : 0.9;
                    }
                  }
                }
              }
            });

            if (hasObstacleAhead && minObstacleDist < 4.2) {
              carState.current.aiReverseTimer = 2.0; 
              carState.current.aiStuckTimer = 0;
            } else if (hasObstacleAhead) {
              angleDiff += obstacleAvoidanceOffset * (1.2 - (minObstacleDist / lookAheadDist));
            }

            // PROPORTIONAL CONTROLLER WITH INTEGRAL SPEED-SENSITIVE DAMPING
            // Reduces steering gains as speed increases to prevent high-speed shaking ("giặt lắc")!
            const speedFact = Math.max(1.0, curSpeedAbs / 6.0);
            const kp = 2.4 / speedFact;
            targetSteer = Math.max(-config.maxSteerAngle, Math.min(config.maxSteerAngle, -angleDiff * kp));
            
            // Intelligent reverse-gear choosing for tight corners or when heading backwards on short distances
            const isHeadingBackwards = Math.abs(angleDiff) > 2.0;
            const useShortReversePath = isHeadingBackwards && targetDist < 12.0;

            if (useShortReversePath) {
              targetSteer = -targetSteer; // Invert steering wheel when going backward!
            }

            if (targetSteer < -0.05) {
              carLeftPressed = true;
              carRightPressed = false;
            } else if (targetSteer > 0.05) {
              carRightPressed = true;
              carLeftPressed = false;
            } else {
              carLeftPressed = false;
              carRightPressed = false;
            }
            
            if (useShortReversePath) {
              carForwardPressed = false;
              carReversePressed = true;
            } else {
              carForwardPressed = true;
              carReversePressed = false;
            }
            
            const absAngleDiff = Math.abs(angleDiff);
            let maxAutopilotSpeed = 28.0;

            // Decelerate proactively on obstacles
            if (hasObstacleAhead) {
              maxAutopilotSpeed = Math.min(8.0, minObstacleDist * 1.5);
            }

            // Smoothly slow down when nearing target (short distance pathfinding deceleration)
            if (targetDist < 16.0) {
              maxAutopilotSpeed = Math.min(maxAutopilotSpeed, 3.5 + (targetDist - stopDist) * 1.8);
            }

            if (!useShortReversePath) {
              if (absAngleDiff > 0.55) {
                if (carState.current.speed > 8.0) {
                  carReversePressed = true;
                  carForwardPressed = false;
                } else {
                  carForwardPressed = carState.current.speed < 6.0;
                }
              } else if (absAngleDiff > 0.25) {
                carForwardPressed = carState.current.speed < Math.min(14.0, maxAutopilotSpeed);
              } else {
                carForwardPressed = carState.current.speed < Math.min(28.0, maxAutopilotSpeed);
              }
            } else {
              // Backward reverse speed limits
              carReversePressed = Math.abs(carState.current.speed) < 5.0;
            }
          }
        } else {
          if (!carState.current.isFollowingOwner) {
            carState.current.aiDriveTarget = null;
          } else {
            if (!carState.current.hasToastedFollowReach) {
              window.dispatchEvent(new CustomEvent('alert-toast', {
                detail: { text: "🎯 ĐÃ TIẾP CẬN: Xe VinFast đã tự lái tìm góc đỗ chuẩn xác, dừng 1.5m bên cạnh chủ xe!" }
              }));
              carState.current.hasToastedFollowReach = true;
            }
          }
          carState.current.aiStuckTimer = 0;
          carState.current.aiReverseTimer = 0;
          carForwardPressed = false;
          carReversePressed = false;
          carLeftPressed = false;
          carRightPressed = false;
          carState.current.speed = 0;
          targetSteer = 0;
          
          window.dispatchEvent(new CustomEvent('game-ai-reached-target'));
        }
      } else {
        if (carLeftPressed) {
          targetSteer = -config.maxSteerAngle;
        } else if (carRightPressed) {
          targetSteer = config.maxSteerAngle;
        } else {
          targetSteer = 0;
        }
      }

      // Reassign local aliases so downstream physical engine code operates normally
      let forwardPressed = carForwardPressed;
      let reversePressed = carReversePressed;
      let leftPressed = carLeftPressed;
      let rightPressed = carRightPressed;

      // Smoothly interpolate the visual steer angle
      const lerpSpeed = config.steeringSpeed * 1.5;
      carState.current.steerAngle += (targetSteer - carState.current.steerAngle) * lerpSpeed * delta;

      // Server configuration live overrides
      const mapConf = stateRef.current.customMapConfig;
      if (mapConf) {
        if (mapConf.invincibleCar && stateRef.current.damage > 0) {
          stateRef.current.onRepairTick?.(100); // instantly fix any incoming dent/damage!
        } else if (mapConf.autoRepair && stateRef.current.damage > 0) {
          stateRef.current.onRepairTick?.(delta * 4.5); // passive repair of 4.5% health per second
        }
      }

      // --- ARCADE CAR PHYSICS ENGINE ---
      // 1. Fuel consumption over time in driving mode (only when moving or pressing pedals)
      const isCarMoving = Math.abs(carState.current.speed) > 0.05;
      const isThrottling = forwardPressed || reversePressed;
      if (stateRef.current.playerMode === 'driving' && (isCarMoving || isThrottling) && !carState.current.isExploded) {
        carState.current.fuel = Math.max(0, carState.current.fuel - delta * 0.9); // fuel decays in ~110 seconds of active driving
      }

      // Bonus score while actively drifting
      const isDriftingNow = (leftPressed || rightPressed) && Math.abs(carState.current.speed) > 10.0;
      if (isDriftingNow && stateRef.current.playerMode === 'driving') {
        const driftPoints = mapConf?.doubleDrift ? 6 : 3;
        carState.current.score += driftPoints;
      }

      // 2. Damage self-destruct critical timer
      if (stateRef.current.damage >= 100) {
        carState.current.explodeCountdown = Math.max(0, carState.current.explodeCountdown - delta);
        if (carState.current.explodeCountdown <= 0 && !carState.current.isExploded) {
          carState.current.isExploded = true;
          carState.current.speed = 0;
          
          // Shockwave explosion physics calculations
          let playerDistance = 999.0;
          if (stateRef.current.playerMode === 'driving') {
            playerDistance = 0.0;
          } else {
            const dx = carState.current.walkerX - carState.current.posX;
            const dz = carState.current.walkerZ - carState.current.posZ;
            playerDistance = Math.sqrt(dx * dx + dz * dz);
            
            // Send the player flying away mechanically inside the 3D physics loops if in blast zone!
            if (playerDistance <= 10.0) {
              carState.current.walkerVelY = 19.5; // fly sky-high
              const pushAngle = Math.atan2(dx, dz);
              carState.current.walkerX += Math.sin(pushAngle) * 9.5;
              carState.current.walkerZ += Math.cos(pushAngle) * 9.5;
            }
          }

          // Play massive explosion audio trigger
          soundEngine.playCollision?.(1.0);

          // Spawn high-end 3D fiery explosion particles on the car!
          for (let i = 0; i < 20; i++) {
            const fireGeo = new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.9, 0);
            const fireMat = new THREE.MeshBasicMaterial({
              color: Math.random() > 0.45 ? 0xff4f00 : 0xffdd00, // bright fire orange and yellow colors
              transparent: true,
              opacity: 0.95
            });
            const fireMesh = new THREE.Mesh(fireGeo, fireMat);
            fireMesh.position.set(
              carState.current.posX + (Math.random() - 0.5) * 1.6,
              carState.current.posY + 0.6 + (Math.random() - 0.5) * 1.6,
              carState.current.posZ + (Math.random() - 0.5) * 1.6
            );
            scene.add(fireMesh);
            
            activeExplosionFires.push({
              mesh: fireMesh,
              velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 11.0,
                Math.random() * 11.0 + 4.0,
                (Math.random() - 0.5) * 11.0
              ),
              life: 1.2 + Math.random() * 0.8
            });
          }

          // Notify player that the car was damaged and is now instantly self-repairing without any injury/death
          window.dispatchEvent(new CustomEvent('alert-toast', {
            detail: {
              text: `💥 XE ĐÃ BỊ QUÁ TẢI NÚT NĂNG LƯỢNG! Sóng Nano bảo vệ đang tự động phục hồi xe nguyên vẹn...`
            }
          }));

          // Clean automatic safe vehicle recovery
          setTimeout(() => {
            carState.current.isExploded = false;
            carState.current.explodeCountdown = 60.0;
            carState.current.fuel = 100.0;
            stateRef.current.onRepairTick?.(100); // instantly fix any incoming damage to 0% (full health)
          }, 3500);
        }
      } else {
        carState.current.explodeCountdown = 60.0;
        if (stateRef.current.damage < 100) {
          carState.current.isExploded = false;
        }
      }

      // Force and Acceleration
      let currentForce = 0;
      if (carState.current.isExploded) {
        currentForce = 0;
        carState.current.speed = 0;
      } else if (!carState.current.isEngineOn) {
        currentForce = 0; // Turn off car power
      } else if (carState.current.fuel <= 0) {
        currentForce = 0; // dead engine (out of gas)
      } else if (stateRef.current.playerMode === 'walking') {
        currentForce = 0;
      } else {
        // Apply engine power override based on host server config settings
        const powerConf = mapConf?.enginePower || 'sport';
        const powerMult = powerConf === 'eco' ? 0.7 : (powerConf === 'sport' ? 1.0 : (powerConf === 'hyper' ? 1.55 : 2.5));

        if (forwardPressed) {
          currentForce = config.engineForce * powerMult;
        } else if (reversePressed) {
          currentForce = -config.engineForce * 0.65 * powerMult; // slower reverse speed
        }
      }

      // Braking force / drag
      let deceleration = config.friction;
      if (eBrake) {
        deceleration = config.brakingForce * 1.8;
      } else if ((forwardPressed && carState.current.speed < 0) || (reversePressed && carState.current.speed > 0)) {
        deceleration = config.brakingForce;
      }

      // Apply acceleration force scaled dynamically by mass
      carState.current.speed += (currentForce * 1000 / config.mass) * delta * 60;

      // Apply drag friction
      if (Math.abs(carState.current.speed) > 0.01) {
        const sign = Math.sign(carState.current.speed);
        carState.current.speed -= sign * deceleration * delta * 60;
        // Do not overshoot zero
        if (Math.sign(carState.current.speed) !== sign && !forwardPressed && !reversePressed) {
          carState.current.speed = 0;
        }
      } else {
        carState.current.speed = 0;
      }

      // Cap Speed limits
      const maxSpeed = curSelectedCar === 'sport' ? 42 : (curSelectedCar === 'suv' ? 28 : (curSelectedCar === 'cyber' ? 36 : 30));
      carState.current.speed = Math.max(-maxSpeed * 0.45, Math.min(maxSpeed, carState.current.speed));

      // Drift physics factor (slide side)
      let slideMult = config.driftMode ? 1.4 : 0.6;
      if (curSelectedTrack === 'desert_bumpy') slideMult *= 1.35; // slippy on desert sand
      if (curSelectedTrack === 'grassland') slideMult *= 1.1;

      const steerInfluence = (carState.current.speed !== 0) ? (Math.sign(carState.current.speed) * Math.min(1.0, Math.abs(carState.current.speed) / 5.0)) : 0;
      const turnRot = -carState.current.steerAngle * steerInfluence * 1.5 * delta;
      
      // Update heading angle
      carState.current.rotY += turnRot;

      // Calculate sliding heading vector vs looking heading vector
      const driftAngle = carState.current.steerAngle * 0.45 * Math.min(1.0, Math.abs(carState.current.speed) / 15.0);
      const moveAngle = carState.current.rotY + (leftPressed || rightPressed ? driftAngle * slideMult : 0);

      // Compute displacement
      const dx = Math.sin(moveAngle) * carState.current.speed * delta;
      const dz = Math.cos(moveAngle) * carState.current.speed * delta;

      const nextCarX = carState.current.posX + dx;
      const nextCarZ = carState.current.posZ + dz;

      if (curSelectedTrack === 'metropolis_city') {
        const checkCityWallCollision = (x: number, z: number, r: number) => {
          const buildings = [
            { cx: -50, cz: -50, lx: 30, lz: 30 },
            { cx: -50, cz: 50, lx: 30, lz: 30 },
            { cx: 50, cz: -50, lx: 30, lz: 30 },
            { cx: 50, cz: 50, lx: 30, lz: 30 },
            { cx: -110, cz: -110, lx: 35, lz: 35 },
            { cx: -110, cz: 110, lx: 35, lz: 35 },
            { cx: 110, cz: -110, lx: 35, lz: 35 },
            { cx: 110, cz: 110, lx: 35, lz: 35 },
            { cx: -110, cz: -50, lx: 30, lz: 30 },
            { cx: -110, cz: 50, lx: 30, lz: 30 },
            { cx: 110, cz: -50, lx: 30, lz: 30 },
            { cx: 110, cz: 50, lx: 30, lz: 30 },
            { cx: -50, cz: -110, lx: 30, lz: 30 },
            { cx: -50, cz: 110, lx: 30, lz: 30 },
            { cx: 50, cz: -110, lx: 30, lz: 30 },
            { cx: 50, cz: 110, lx: 30, lz: 30 },
          ];
          for (const b of buildings) {
            const hx = b.lx / 2 + r;
            const hz = b.lz / 2 + r;
            if (x >= b.cx - hx && x <= b.cx + hx && z >= b.cz - hz && z <= b.cz + hz) {
              return true;
            }
          }
          return false;
        };

        const rCar = 2.4;
        if (!checkCityWallCollision(nextCarX, nextCarZ, rCar)) {
          carState.current.posX = nextCarX;
          carState.current.posZ = nextCarZ;
        } else {
          const speedAbs = Math.abs(carState.current.speed);
          if (speedAbs > 8.0 && carState.current.playTime - carState.current.lastCollisionTime > 0.8) {
            soundEngine.playCollision?.(speedAbs / 30);
            carState.current.speed *= -0.22;
            carState.current.lastCollisionTime = carState.current.playTime;
            onCollision?.();
          }

          if (!checkCityWallCollision(nextCarX, carState.current.posZ, rCar)) {
            carState.current.posX = nextCarX;
          } else if (!checkCityWallCollision(carState.current.posX, nextCarZ, rCar)) {
            carState.current.posZ = nextCarZ;
          } else {
            carState.current.speed = 0;
          }
        }
      } else {
        carState.current.posX = nextCarX;
        carState.current.posZ = nextCarZ;
      }
      carState.current.distance += Math.sqrt(dx * dx + dz * dz);

      // --- TERRAIN COUPLING ENGINE (Y position & Tilting roll/pitch) ---
      // Sample height under car position center
      const currentHeight = getSurfaceHeight(carState.current.posX, carState.current.posZ, curSelectedTrack, stateRef.current.customMapConfig);
      carState.current.posY = currentHeight + 0.16; // slight suspension offset

      // Compute front, back, left, right vector height samples to orient standard body tilt!
      const len = 1.6; // test offset front / back
      const wid = 0.8; // test offset left / right

      const frontX = carState.current.posX + Math.sin(carState.current.rotY) * len;
      const frontZ = carState.current.posZ + Math.cos(carState.current.rotY) * len;
      const backX = carState.current.posX - Math.sin(carState.current.rotY) * len;
      const backZ = carState.current.posZ - Math.cos(carState.current.rotY) * len;

      const leftX = carState.current.posX - Math.cos(carState.current.rotY) * wid;
      const leftZ = carState.current.posZ + Math.sin(carState.current.rotY) * wid;
      const rightX = carState.current.posX + Math.cos(carState.current.rotY) * wid;
      const rightZ = carState.current.posZ - Math.sin(carState.current.rotY) * wid;

      const heightF = getSurfaceHeight(frontX, frontZ, curSelectedTrack, stateRef.current.customMapConfig);
      const heightB = getSurfaceHeight(backX, backZ, curSelectedTrack, stateRef.current.customMapConfig);
      const heightL = getSurfaceHeight(leftX, leftZ, curSelectedTrack, stateRef.current.customMapConfig);
      const heightR = getSurfaceHeight(rightX, rightZ, curSelectedTrack, stateRef.current.customMapConfig);

      // Tar pitch (nose dip accelerating/braking or climbing)
      const targetPitch = Math.atan2(heightF - heightB, len * 2);
      // Roll (sideways roll tilting on curve or hill)
      const targetRoll = Math.atan2(heightL - heightR, wid * 2);

      // Smooth damp the tilting roll
      carState.current.pitch += (targetPitch - carState.current.pitch) * 12 * delta;
      carState.current.roll += (targetRoll - carState.current.roll) * 12 * delta;

      // Update visual model rotation & positions
      carGroup.position.set(carState.current.posX, carState.current.posY, carState.current.posZ);
      carGroup.rotation.set(0, 0, 0); // clear
      carGroup.rotateY(carState.current.rotY); // aligned to heading
      carGroup.rotateX(carState.current.pitch);
      carGroup.rotateZ(carState.current.roll);

      // Apply body sway based on steering inertia (chassis centrifugal rolling)
      const swayForce = (carState.current.speed / maxSpeed) * carState.current.steerAngle * 0.35;
      carGroup.rotateZ(swayForce);

      // Set visibility of vehicle body model (hides it when exploded to represent lost vehicle)
      carGroup.visible = !carState.current.isExploded;

      // Brake lights activation (braking or reverse)
      const isBrakingActive = eBrake || (carState.current.speed > 1 && reversePressed) || (carState.current.speed < -1 && forwardPressed);
      if (isBrakingActive) {
        brakeLightMat.emissive.setHex(0xff0000);
      } else {
        brakeLightMat.emissive.setHex(0x000000);
      }

      // Night Headlights illumination activation / Custom headlights flashing strobe
      const isNight = stateRef.current.weather === 'night' || stateRef.current.weather === 'sunset';
      
      let flashActive = false;
      if ((window as any).__flashHeadlightTimer && (window as any).__flashHeadlightTimer > 0) {
        (window as any).__flashHeadlightTimer -= delta;
        // rapid strobe blinking effect
        flashActive = Math.floor((window as any).__flashHeadlightTimer * 12) % 2 === 0;
      }

      if (isNight || flashActive) {
        headlightL.intensity = flashActive ? 4.5 : 1.3;
        headlightR.intensity = flashActive ? 4.5 : 1.3;
        // Project ahead of the car orientation
        const headDist = 4.0;
        const targetDist = 20.0;
        
        // Left light position
        const lLightX = carState.current.posX + Math.sin(carState.current.rotY) * headDist - Math.cos(carState.current.rotY) * 0.75;
        const lLightZ = carState.current.posZ + Math.cos(carState.current.rotY) * headDist + Math.sin(carState.current.rotY) * 0.75;
        headlightL.position.set(lLightX, carState.current.posY + 0.4, lLightZ);

        // Right light position
        const rLightX = carState.current.posX + Math.sin(carState.current.rotY) * headDist + Math.cos(carState.current.rotY) * 0.75;
        const rLightZ = carState.current.posZ + Math.cos(carState.current.rotY) * headDist - Math.sin(carState.current.rotY) * 0.75;
        headlightR.position.set(rLightX, carState.current.posY + 0.4, rLightZ);

        // Targets further down coordinate path
        const lTarX = lLightX + Math.sin(carState.current.rotY) * targetDist;
        const lTarZ = lLightZ + Math.cos(carState.current.rotY) * targetDist;
        headlightTargetL.position.set(lTarX, getTerrainHeight(lTarX, lTarZ, curSelectedTrack), lTarZ);

        const rTarX = rLightX + Math.sin(carState.current.rotY) * targetDist;
        const rTarZ = rLightZ + Math.cos(carState.current.rotY) * targetDist;
        headlightTargetR.position.set(rTarX, getTerrainHeight(rTarX, rTarZ, curSelectedTrack), rTarZ);
      } else {
        headlightL.intensity = 0;
        headlightR.intensity = 0;
      }

      // --- FRONT WHEELS DYNAMIC HORIZONTAL STEERING ---
      // We steer left front steering group Y angle.
      // Front wheels steer ONLY left/right.
      frontSteerLeftGroup.rotation.y = carState.current.steerAngle;
      frontSteerRightGroup.rotation.y = carState.current.steerAngle;

      // Rotate actual cockpit steering wheel
      if (steeringWheelGroup) {
        steeringWheelGroup.rotation.z = -carState.current.steerAngle * 4.5;
      }

      // --- WHEEL ROTATIONAL ROLL SPIN ---
      // Spin proportional to speed. Spin velocity = speed / tireRadius
      const spinDelta = (carState.current.speed / 0.48) * delta;
      
      // Left and right front wheel components inside their steer groups
      if (leftFrontWheelMesh) leftFrontWheelMesh.rotation.x += spinDelta;
      if (rightFrontWheelMesh) rightFrontWheelMesh.rotation.x += spinDelta;

      // Back wheels spinners
      wheelMeshes.forEach((wm) => {
        wm.rotation.x += spinDelta;
      });

      // --- CHECKPOINT AND RACETRACK LOOP TRIGGERING ---
      const idx = carState.current.currentCheckpoint % checkpoints.current.length;
      const cp = checkpoints.current[idx];
      if (cp) {
        const carVec = new THREE.Vector3(carState.current.posX, carState.current.posY, carState.current.posZ);
        const distToCheckpoint = carVec.distanceTo(cp);
        if (distToCheckpoint < 4.8) {
          // Trigger checkpoint!
          carState.current.currentCheckpoint++;
          carState.current.score += 1500;
          soundEngine.playCheckpoint();
          onStatsChange({
            score: carState.current.score,
            currentCheckpoint: carState.current.currentCheckpoint,
          });
          updateCheckpointPosition();
          onCheckpoint();
        }
      }

      // --- DUST TRAIL RELEASES ---
      // Spark dust particles on back tires if driving fast
      const specs = stateRef.current.customCarSpecs;
      const bLen = specs ? (specs.bodyLength || 3.8) : 3.8;
      if (Math.abs(carState.current.speed) > 4.5 && stateRef.current.playerMode === 'driving') {
        // Back left tire wheel coordinator coordinates
        const blX = carState.current.posX - Math.sin(carState.current.rotY) * 1.1 - Math.cos(carState.current.rotY) * 1.0;
        const blZ = carState.current.posZ - Math.cos(carState.current.rotY) * 1.1 + Math.sin(carState.current.rotY) * 1.0;
        triggerDust(blX, getTerrainHeight(blX, blZ, curSelectedTrack) + 0.1, blZ, 1);

        // Back right tire
        const brX = carState.current.posX - Math.sin(carState.current.rotY) * 1.1 + Math.cos(carState.current.rotY) * 1.0;
        const brZ = carState.current.posZ - Math.cos(carState.current.rotY) * 1.1 - Math.sin(carState.current.rotY) * 1.0;
        triggerDust(brX, getTerrainHeight(brX, brZ, curSelectedTrack) + 0.1, brZ, 1);
      }

      // --- DAMAGE ENGINE SMOKE RELEASES ---
      if (stateRef.current.damage > 0 && stateRef.current.playerMode === 'driving') {
        const rollSmk = Math.random();
        const doubleDmg = stateRef.current.damage;
        if (doubleDmg > 65 && rollSmk < 0.28) {
          // Thick black engine smoke
          const sX = carState.current.posX + Math.sin(carState.current.rotY) * (bLen * 0.42);
          const sZ = carState.current.posZ + Math.cos(carState.current.rotY) * (bLen * 0.42);
          const sY = carState.current.posY + 0.55;
          triggerSmoke(sX, sY, sZ, true);
        } else if (doubleDmg > 22 && rollSmk < 0.1) {
          // Light grey engine smoke
          const sX = carState.current.posX + Math.sin(carState.current.rotY) * (bLen * 0.42);
          const sZ = carState.current.posZ + Math.cos(carState.current.rotY) * (bLen * 0.42);
          const sY = carState.current.posY + 0.55;
          triggerSmoke(sX, sY, sZ, false);
        }
      }

      // --- MAP REPAIR GARAGE PAD DETECTOR ---
      const dxToGarage = carState.current.posX - garageX;
      const dzToGarage = carState.current.posZ - garageZ;
      const dToGarage = Math.sqrt(dxToGarage * dxToGarage + dzToGarage * dzToGarage);

      const dxWalkerToGarage = carState.current.walkerX - garageX;
      const dzWalkerToGarage = carState.current.walkerZ - garageZ;
      const dWalkerToGarage = Math.sqrt(dxWalkerToGarage * dxWalkerToGarage + dzWalkerToGarage * dzWalkerToGarage);

      const finalDToGarage = stateRef.current.playerMode === 'walking' ? dWalkerToGarage : dToGarage;
      if (finalDToGarage < 4.2) {
        if (stateRef.current.damage > 0) {
          stateRef.current.onRepairTick?.(delta * 25); // repairs 25% per second on pad
        }
      }

      // Animating glowing repair floating wrench symbol
      if (wrenchGroup) {
        wrenchGroup.rotation.y += delta * 1.6;
      }

      // --- MAP REFUELING GAS PAD DETECTOR ---
      const dxToGas = carState.current.posX - gasX;
      const dzToGas = carState.current.posZ - gasZ;
      const dToGas = Math.sqrt(dxToGas * dxToGas + dzToGas * dzToGas);

      const dxWalkerToGas = carState.current.walkerX - gasX;
      const dzWalkerToGas = carState.current.walkerZ - gasZ;
      const dWalkerToGas = Math.sqrt(dxWalkerToGas * dxWalkerToGas + dzWalkerToGas * dzWalkerToGas);

      // Spin the floating gas icon on the pad
      if (gasIconGroup) {
        gasIconGroup.rotation.y += delta * 1.5;
        gasIconGroup.position.y = gasHeight + 2.1 + Math.sin(carState.current.playTime * 2.2) * 0.15;
      }

      // Sync visual indicator carried above walker's head
      if (visualCan) {
        visualCan.visible = stateRef.current.playerMode === 'walking' && !!carState.current.hasGasCanister;
        // Make it spin slightly
        visualCan.rotation.y += delta * 2.0;
      }

      if (stateRef.current.playerMode === 'walking') {
        // Collect gas canister walking near the pad (-15, -15)
        if (dWalkerToGas < 4.0 && !carState.current.hasGasCanister) {
          carState.current.hasGasCanister = true;
        }

        // Return gas canister to the car!
        const dxWToCar = carState.current.walkerX - carState.current.posX;
        const dzWToCar = carState.current.walkerZ - carState.current.posZ;
        const dWToCar = Math.sqrt(dxWToCar * dxWToCar + dzWToCar * dzWToCar);
        if (carState.current.hasGasCanister && dWToCar < 3.2) {
          carState.current.fuel = 100.0;
          carState.current.hasGasCanister = false;
        }
      } else {
        // Driving refueling directly
        if (dToGas < 4.2) {
          carState.current.fuel = Math.min(100.0, carState.current.fuel + delta * 35.0);
        }
      }

      // --- 50% REAL PLAYABLE WALK-AROUND MODE CHARACTER ---
      let isWalkingNow = false;
      if (stateRef.current.playerMode === 'walking') {
        // Safe braking decay
        carState.current.speed += (0 - carState.current.speed) * 8 * delta;
        const walkingSpeed = 5.2;

        if (walkerLeftPressed) {
          carState.current.walkerAngle += 3.8 * delta;
        }
        if (walkerRightPressed) {
          carState.current.walkerAngle -= 3.8 * delta;
        }

        let moveDir = 0;
        if (walkerForwardPressed) {
          moveDir = 1;
          isWalkingNow = true;
        } else if (walkerReversePressed) {
          moveDir = -1;
          isWalkingNow = true;
        }

        const wdx = Math.sin(carState.current.walkerAngle) * walkingSpeed * moveDir * delta;
        const wdz = Math.cos(carState.current.walkerAngle) * walkingSpeed * moveDir * delta;

        const nextWX = carState.current.walkerX + wdx;
        const nextWZ = carState.current.walkerZ + wdz;

        if (curSelectedTrack === 'metropolis_city') {
          const checkWalkCollision = (x: number, z: number, r: number) => {
            const buildings = [
              { cx: -50, cz: -50, lx: 30, lz: 30 },
              { cx: -50, cz: 50, lx: 30, lz: 30 },
              { cx: 50, cz: -50, lx: 30, lz: 30 },
              { cx: 50, cz: 50, lx: 30, lz: 30 },
              { cx: -110, cz: -110, lx: 35, lz: 35 },
              { cx: -110, cz: 110, lx: 35, lz: 35 },
              { cx: 110, cz: -110, lx: 35, lz: 35 },
              { cx: 110, cz: 110, lx: 35, lz: 35 },
              { cx: -110, cz: -50, lx: 30, lz: 30 },
              { cx: -110, cz: 50, lx: 30, lz: 30 },
              { cx: 110, cz: -50, lx: 30, lz: 30 },
              { cx: 110, cz: 50, lx: 30, lz: 30 },
              { cx: -50, cz: -110, lx: 30, lz: 30 },
              { cx: -50, cz: 110, lx: 30, lz: 30 },
              { cx: 50, cz: -110, lx: 30, lz: 30 },
              { cx: 50, cz: 110, lx: 30, lz: 30 },
            ];
            for (const b of buildings) {
              const hx = b.lx / 2 + r;
              const hz = b.lz / 2 + r;
              if (x >= b.cx - hx && x <= b.cx + hx && z >= b.cz - hz && z <= b.cz + hz) {
                return true;
              }
            }
            return false;
          };

          const walkR = 1.2;
          if (!checkWalkCollision(nextWX, nextWZ, walkR)) {
            carState.current.walkerX = nextWX;
            carState.current.walkerZ = nextWZ;
          } else if (!checkWalkCollision(nextWX, carState.current.walkerZ, walkR)) {
            carState.current.walkerX = nextWX;
          } else if (!checkWalkCollision(carState.current.walkerX, nextWZ, walkR)) {
            carState.current.walkerZ = nextWZ;
          }
        } else {
          carState.current.walkerX = nextWX;
          carState.current.walkerZ = nextWZ;
        }

        const wH = getTerrainHeight(carState.current.walkerX, carState.current.walkerZ, curSelectedTrack);
        
        // Retrieve and map host custom gravity configuration
        const gravityConf = stateRef.current.customMapConfig?.worldGravity || 'normal';
        const gravityY = gravityConf === 'zero' ? 3.5 : (gravityConf === 'low' ? 12.0 : (gravityConf === 'normal' ? 24.5 : 46.0));

        // Detect jump command (spacebar) when standing on solid ground
        if (keys.space && carState.current.walkerY <= wH + 0.15) {
          // Jump! Set upward vertical speed
          carState.current.walkerVelY = gravityConf === 'zero' ? 3.8 : (gravityConf === 'low' ? 6.5 : (gravityConf === 'normal' ? 9.8 : 13.0));
          soundEngine.playUnlockSound?.(); // Play crisp jumping audio trigger
        }

        // Apply progressive gravity deceleration
        carState.current.walkerVelY -= gravityY * delta;
        carState.current.walkerY += carState.current.walkerVelY * delta;

        // Secure ground clearance collision
        if (carState.current.walkerY < wH) {
          carState.current.walkerY = wH;
          carState.current.walkerVelY = 0;
        }

        personGroup.position.set(carState.current.walkerX, carState.current.walkerY, carState.current.walkerZ);
        personGroup.rotation.y = carState.current.walkerAngle;
        personGroup.visible = true;

        // Custom wardrobe live-updater
        const dressConf = stateRef.current.characterConfig;
        if (dressConf) {
          pShirtMat.color.set(dressConf.shirtColor);
          pPantsMat.color.set(dressConf.pantsColor);
          pHairMat.color.set(dressConf.hairColor);

          // Headwear scale / nón lưỡi trai / helmet
          if (dressConf.headwear === 'helmet') {
            pHair.scale.set(1.4, 1.4, 1.4);
            pHairMat.color.set(dressConf.helmetColor || dressConf.shirtColor);
          } else if (dressConf.headwear === 'cap') {
            pHair.scale.set(1.28, 0.45, 1.28);
            pHairMat.color.set(dressConf.hairColor);
          } else {
            pHair.scale.set(1.0, 1.0, 1.0);
            pHairMat.color.set(dressConf.hairColor);
          }

          // Toggle visibility of additional 3D custom attachments
          pGlasses.visible = dressConf.accessory === 'sunglasses';
          pJetpack.visible = dressConf.accessory === 'neon_backpack';
          pWingsGroup.visible = dressConf.accessory === 'wings';
        }

        if (isWalkingNow) {
          const swingAngle = Math.sin(carState.current.playTime * 14) * 0.65;
          pLegL.rotation.x = swingAngle;
          pLegR.rotation.x = -swingAngle;
          pArmL.rotation.x = -swingAngle * 0.75;
          pArmR.rotation.x = swingAngle * 0.75;
        } else {
          pLegL.rotation.x = 0;
          pLegR.rotation.x = 0;
          pArmL.rotation.x = 0;
          pArmR.rotation.x = 0;
        }
      } else {
        personGroup.visible = false;
        // place person walking position slightly to the left behind of vehicle ready to walk out
        carState.current.walkerX = carState.current.posX - Math.sin(carState.current.rotY) * 2.0;
        carState.current.walkerZ = carState.current.posZ - Math.cos(carState.current.rotY) * 2.0;
        carState.current.walkerY = carState.current.posY;
        carState.current.walkerAngle = carState.current.rotY;
      }

      // Update live dust particles
      dustParticles.forEach((p) => {
        if (p.life > 0) {
          p.life -= delta * 1.8;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.scale.setScalar(p.initialScale * p.life);
          
          // Fade opacity
          const mat = p.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = p.life * 0.45;

          if (p.life <= 0) {
            p.mesh.visible = false;
          }
        }
      });

      // Update smoke particles
      smokeParticles.forEach((p) => {
        if (p.life > 0) {
          p.life -= delta * 1.5;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.scale.setScalar(p.initialScale * p.life);
          const smat = p.mesh.material as THREE.MeshBasicMaterial;
          smat.opacity = p.life * 0.55;

          if (p.life <= 0) {
            p.mesh.visible = false;
          }
        }
      });

      // Update active explosion fires
      for (let i = activeExplosionFires.length - 1; i >= 0; i--) {
        const fire = activeExplosionFires[i];
        fire.life -= delta;
        fire.mesh.position.addScaledVector(fire.velocity, delta);
        
        // Expand and fade out
        const scale = 1.0 + (1.0 - fire.life) * 4.5;
        fire.mesh.scale.set(scale, scale, scale);
        const fmat = fire.mesh.material as THREE.MeshBasicMaterial;
        if (fmat) {
          fmat.opacity = Math.max(0, fire.life);
        }
        
        if (fire.life <= 0) {
          scene.remove(fire.mesh);
          activeExplosionFires.splice(i, 1);
        }
      }

      // --- PROCEDURAL AUDIO SQUEALING & REV EFFECTS ---
      const maxRpm = 8000;
      const speedRatio = Math.abs(carState.current.speed) / maxSpeed;
      const rpm = 800 + speedRatio * 4500 + (forwardPressed ? Math.random() * 400 + 400 : 0);
      
      const pEngine = Math.abs(currentForce) > 0 ? 1 : 0;
      soundEngine.updateEngine(rpm / maxRpm, pEngine);

      // Screech if drifting or braking sharply
      const driftValue = (leftPressed || rightPressed) && Math.abs(carState.current.speed) > 10.0 ? 0.8 : 0.0;
      const brakeScreechValue = eBrake && Math.abs(carState.current.speed) > 5.0 ? 1.0 : 0.0;
      soundEngine.updateScreech(Math.max(driftValue, brakeScreechValue));

      // --- DYNAMIC COLLISION DETECTOR ---
      // Check collision against physical prop obstacles placed
      const carPos2D = new THREE.Vector2(carState.current.posX, carState.current.posZ);
      const now = carState.current.playTime;

      if (now - carState.current.lastCollisionTime > 0.6) {
        obstacleMeshes.some((m) => {
          const mPos2D = new THREE.Vector2(m.position.x, m.position.z);
          const colDist = carPos2D.distanceTo(mPos2D);
          // Collision threshold
          if (colDist < 2.5) {
            // Collision occurs! Bounce back physics
            soundEngine.playCollision(Math.abs(carState.current.speed) / maxSpeed);
            carState.current.speed = -carState.current.speed * 0.45; // reverse direction bump
            carState.current.lastCollisionTime = now;
            onCollision();
            return true;
          }
          return false;
        });
      }

      // Border bounds containment logic
      const worldLimit = 280;
      if (Math.abs(carState.current.posX) > worldLimit || Math.abs(carState.current.posZ) > worldLimit) {
        carState.current.posX = Math.max(-worldLimit, Math.min(worldLimit, carState.current.posX));
        carState.current.posZ = Math.max(-worldLimit, Math.min(worldLimit, carState.current.posZ));
        carState.current.speed = -carState.current.speed * 0.5; // bounce back from invisible edge bounds
        soundEngine.playCollision(0.35);
      }

      // --- DYNAMIC MULTI-VIEW CAMERA ENGINE CONTROLLER ---
      // Spin the camera horizontal yaw rotation if G key is pressed/held or active
      if (keys.g) {
        orbitRef.current.yaw += delta * 2.2;
      }

      // If player is in walking mode, overwrite normal camera coordinates to follow character directly
      if (stateRef.current.playerMode === 'walking') {
        const camDistance = 6.5;
        const camHeight = 2.4;
        // Incorporate G-key horizontal rotation offset
        const angle = carState.current.walkerAngle + (orbitRef.current.yaw - Math.PI);
        
        const targetCamX = carState.current.walkerX - Math.sin(angle) * camDistance;
        const targetCamZ = carState.current.walkerZ - Math.cos(angle) * camDistance;
        const targetCamY = carState.current.walkerY + camHeight;

        camera.position.x += (targetCamX - camera.position.x) * 6.5 * delta;
        camera.position.z += (targetCamZ - camera.position.z) * 6.5 * delta;
        camera.position.y += (targetCamY - camera.position.y) * 6.5 * delta;

        camera.lookAt(new THREE.Vector3(carState.current.walkerX, carState.current.walkerY + 1.0, carState.current.walkerZ));
      } else {
        // Orient camera according to selection type
        if (activeCamMode === 'third_person') {
          const camDistance = 12.0;
          const camHeight = 4.0;
          
          // Calculate behind position incorporating G-key horizontal rotation offset
          const angle = carState.current.rotY + (orbitRef.current.yaw - Math.PI);
          const targetCamX = carState.current.posX - Math.sin(angle) * camDistance;
          const targetCamZ = carState.current.posZ - Math.cos(angle) * camDistance;
          const targetCamY = carState.current.posY + camHeight;

          // Smoothly lerp camera to position
          camera.position.x += (targetCamX - camera.position.x) * 6.5 * delta;
          camera.position.z += (targetCamZ - camera.position.z) * 6.5 * delta;
          camera.position.y += (targetCamY - camera.position.y) * 6.5 * delta;

          // Visual look direction
          const lookTarget = new THREE.Vector3(
            carState.current.posX + Math.sin(carState.current.rotY) * 2,
            carState.current.posY + 0.5,
            carState.current.posZ + Math.cos(carState.current.rotY) * 2
          );
          camera.lookAt(lookTarget);

        } else if (activeCamMode === 'first_person') {
          // Driver perspective. Position slightly inside and above windshield hood
          const driverHeight = 0.95;
          const driverForward = 0.4;
          const angle = carState.current.rotY;

          const targetCamX = carState.current.posX + Math.sin(angle) * driverForward;
          const targetCamZ = carState.current.posZ + Math.cos(angle) * driverForward;
          const targetCamY = carState.current.posY + driverHeight;

          camera.position.set(targetCamX, targetCamY, targetCamZ);
          
          const focusX = carState.current.posX + Math.sin(angle) * 30;
          const focusZ = carState.current.posZ + Math.cos(angle) * 30;
          const focusY = getTerrainHeight(focusX, focusZ, curSelectedTrack) + 0.5;
          camera.lookAt(new THREE.Vector3(focusX, focusY, focusZ));

        } else if (activeCamMode === 'top_down') {
          // Overhead high angle look down
          camera.position.set(carState.current.posX, carState.current.posY + 32, carState.current.posZ - 0.1);
          camera.lookAt(new THREE.Vector3(carState.current.posX, carState.current.posY, carState.current.posZ));

        } else if (activeCamMode === 'front_view') {
          // Front cinematic view focused on the beautiful front lights and wheels turning
          const rDist = 11.0;
          const rHeight = 3.0;
          const angle = carState.current.rotY;

          const targetCamX = carState.current.posX + Math.sin(angle) * rDist;
          const targetCamZ = carState.current.posZ + Math.cos(angle) * rDist;
          const targetCamY = carState.current.posY + rHeight;

          camera.position.x += (targetCamX - camera.position.x) * 4.5 * delta;
          camera.position.z += (targetCamZ - camera.position.z) * 4.5 * delta;
          camera.position.y += (targetCamY - camera.position.y) * 4.5 * delta;
          
          camera.lookAt(new THREE.Vector3(carState.current.posX, carState.current.posY + 0.5, carState.current.posZ));

        } else if (activeCamMode === 'orbit') {
          // Free-orbit orbital viewport centered on the vehicle
          const radius = orbitRef.current.radius;
          const yawVal = orbitRef.current.yaw;
          const pitchVal = orbitRef.current.pitch;

          // Map angles to a spherical vector around the target car
          const offsetX = radius * Math.cos(pitchVal) * Math.sin(yawVal);
          const offsetZ = radius * Math.cos(pitchVal) * Math.cos(yawVal);
          const offsetY = radius * Math.sin(pitchVal);

          const targetCamX = carState.current.posX + offsetX;
          const targetCamZ = carState.current.posZ + offsetZ;
          const targetCamY = carState.current.posY + offsetY;

          // Smoothly lerp camera to position
          camera.position.x += (targetCamX - camera.position.x) * 10 * delta;
          camera.position.z += (targetCamZ - camera.position.z) * 10 * delta;
          camera.position.y += (targetCamY - camera.position.y) * 10 * delta;

          // Visual target anchor points exactly on vehicle center
          camera.lookAt(new THREE.Vector3(carState.current.posX, carState.current.posY + 0.4, carState.current.posZ));
        }
      }

      // ==========================================
      // DISASTER EFFECTS SIMULATOR: METEOR STRIKES & LIGHTNING FLASHES
      // ==========================================
      if (!(window as any).__activeMeteors) {
        (window as any).__activeMeteors = [];
        (window as any).__lightningTimer = 0;
        (window as any).__meteorStrikeTimer = 0;
      }

      // Lightning flash random ambient trigger
      if (stateRef.current.weather === 'rain' || stateRef.current.weather === 'night') {
        (window as any).__lightningTimer += delta;
        if ((window as any).__lightningTimer > 11.0) {
          (window as any).__lightningTimer = 0;
          ambientLight.intensity = 1.95;
          setTimeout(() => {
            ambientLight.intensity = 0.15;
          }, 140);
          soundEngine.playCheckpoint?.();
        }
      }

      // Falling meteors loop (Natural Disasters with 10% probability check)
      (window as any).__meteorStrikeTimer += delta;
      if ((window as any).__meteorStrikeTimer > 30.0) {
        (window as any).__meteorStrikeTimer = 0;
        
        // Only 10% chance of a natural disaster actually happening
        if (Math.random() < 0.10) {
          const mX = carState.current.posX + (Math.random() - 0.5) * 65;
          const mZ = carState.current.posZ + (Math.random() - 0.5) * 65;
          
          const fireBallGeo = new THREE.DodecahedronGeometry(1.6, 0);
          const fireBallMat = new THREE.MeshBasicMaterial({ color: 0xff3b00, transparent: true, opacity: 0.9 });
          const fireBall = new THREE.Mesh(fireBallGeo, fireBallMat);
          fireBall.position.set(mX, 35, mZ);
          scene.add(fireBall);

          (window as any).__activeMeteors.push({
            mesh: fireBall,
            targetX: mX,
            targetZ: mZ,
            posY: 35,
            speed: 14 + Math.random() * 11,
          });

          window.dispatchEvent(new CustomEvent('alert-toast', { 
            detail: { text: "🚨 CẢNH BÁO THIÊN TAI: Thiên thạch rực lửa đang rớt tầm gần! (Xác suất 10%)" }
          }));
        }
      }

      // Animate active meteors
      for (let mIdx = (window as any).__activeMeteors.length - 1; mIdx >= 0; mIdx--) {
        const mObj = (window as any).__activeMeteors[mIdx];
        mObj.posY -= mObj.speed * delta;
        mObj.mesh.position.y = mObj.posY;
        mObj.mesh.rotation.x += delta * 2.2;
        mObj.mesh.rotation.y += delta * 1.6;

        if (mObj.posY <= 0.2) {
          scene.remove(mObj.mesh);
          (window as any).__activeMeteors.splice(mIdx, 1);
          
          ambientLight.intensity = 2.0;
          setTimeout(() => { ambientLight.intensity = 0.15; }, 90);
          soundEngine.playCollision?.(0.55);

          const pdX = carState.current.posX - mObj.targetX;
          const pdZ = carState.current.posZ - mObj.targetZ;
          const pDist = Math.sqrt(pdX * pdX + pdZ * pdZ);
          if (pDist < 12.0) {
            carState.current.speed += pdX > 0 ? 5.5 : -5.5;
            onCollision?.();
            window.dispatchEvent(new CustomEvent('alert-toast', { 
              detail: { text: "💥 SỨC ÉP NỔ THIÊN THẠCH: Xe rung chuyển mạnh!" }
            }));
          }
        }
      }

      // ==========================================
      // METROPOLIS CITIZENS WALKING TRAFFIC COLLISION MECHANICS
      // ==========================================
      if (curSelectedTrack === 'metropolis_city' && pedestriansRef.current) {
        const checkPedestrianWallColl = (x: number, z: number, r: number) => {
          const buildings = [
            { cx: -50, cz: -50, lx: 30, lz: 30 },
            { cx: -50, cz: 50, lx: 30, lz: 30 },
            { cx: 50, cz: -50, lx: 30, lz: 30 },
            { cx: 50, cz: 50, lx: 30, lz: 30 },
            { cx: -110, cz: -110, lx: 35, lz: 35 },
            { cx: -110, cz: 110, lx: 35, lz: 35 },
            { cx: 110, cz: -110, lx: 35, lz: 35 },
            { cx: 110, cz: 110, lx: 35, lz: 35 },
            { cx: -110, cz: -50, lx: 30, lz: 30 },
            { cx: -110, cz: 50, lx: 30, lz: 30 },
            { cx: 110, cz: -50, lx: 30, lz: 30 },
            { cx: 110, cz: 50, lx: 30, lz: 30 },
            { cx: -50, cz: -110, lx: 30, lz: 30 },
            { cx: -50, cz: 110, lx: 30, lz: 30 },
            { cx: 50, cz: -110, lx: 30, lz: 30 },
            { cx: 50, cz: 110, lx: 30, lz: 30 },
          ];
          for (const b of buildings) {
            const hx = b.lx / 2 + r;
            const hz = b.lz / 2 + r;
            if (x >= b.cx - hx && x <= b.cx + hx && z >= b.cz - hz && z <= b.cz + hz) {
              return true;
            }
          }
          return false;
        };

        pedestriansRef.current.forEach((ped) => {
          if (ped.group) {
            // Unpack custom delta position
            const nextPX = ped.group.position.x + ped.velX * delta;
            const nextPZ = ped.group.position.z + ped.velZ * delta;

            const bRadius = 0.6;
            if (checkPedestrianWallColl(nextPX, nextPZ, bRadius) || Math.abs(nextPX) > 132 || Math.abs(nextPZ) > 132) {
              ped.velX = -ped.velX;
              ped.velZ = -ped.velZ;
              ped.angle += Math.PI;
              ped.group.rotation.y = ped.angle;
            } else {
              ped.group.position.x = nextPX;
              ped.group.position.z = nextPZ;
            }

            // Animate leg swings or farmer's bending animation
            if (ped.isFarmer) {
              ped.group.rotation.x = Math.sin(carState.current.playTime * 2.5 + ped.phase) * 0.18 + 0.15;
            } else {
              const swing = Math.sin(carState.current.playTime * 11 + ped.phase) * 0.45;
              if (ped.leftLeg) ped.leftLeg.rotation.x = swing;
              if (ped.rightLeg) ped.rightLeg.rotation.x = -swing;
            }

            // Proximity crash tests to Player
            if (stateRef.current.playerMode === 'driving') {
              const pdX = carState.current.posX - ped.group.position.x;
              const pdZ = carState.current.posZ - ped.group.position.z;
              const dToCar = Math.sqrt(pdX * pdX + pdZ * pdZ);
              if (dToCar < 2.3) {
                carState.current.speed *= -0.25;
                onCollision?.();
                ped.velX = pdX > 0 ? -4.5 : 4.5;
                ped.velZ = pdZ > 0 ? -4.5 : 4.5;
                window.dispatchEvent(new CustomEvent('alert-toast', { 
                  detail: { text: "⚠️ CHÚ Ý: Đã giảm tốc! Chế độ an toàn va chạm người đi bộ!" }
                }));
              }
            }
          }
        });
      }

      // Update driving traffic cars in metropolis_city
      if (curSelectedTrack === 'metropolis_city' && trafficCarsRef.current) {
        trafficCarsRef.current.forEach((tc) => {
          if (tc.group) {
            const currX = tc.group.position.x;
            const currZ = tc.group.position.z;

            let nextX = currX + tc.velX * delta;
            let nextZ = currZ + tc.velZ * delta;

            // Loop check at boundaries
            if (Math.abs(nextX) > 160) {
              nextX = -Math.sign(nextX) * 150;
            }
            if (Math.abs(nextZ) > 160) {
              nextZ = -Math.sign(nextZ) * 150;
            }

            tc.group.position.set(nextX, tc.group.position.y, nextZ);

            // Rotate corresponding to driving velocity
            tc.group.rotation.y = Math.atan2(tc.velX, tc.velZ);

            // Wheel rotation animation
            tc.group.children.forEach((child: any) => {
              if (child.geometry && child.geometry.type === 'CylinderGeometry' && child.position.y < 0) {
                child.rotation.x += 6.0 * delta;
              }
            });

            // Collision with player car
            const playerDx = nextX - carState.current.posX;
            const playerDz = nextZ - carState.current.posZ;
            const playerDist = Math.sqrt(playerDx * playerDx + playerDz * playerDz);
            if (playerDist < 3.2 && stateRef.current.playerMode === 'driving') {
              carState.current.speed *= -0.5; // bounce back
              onCollision?.(); // triggers collision UI and damage!
              
              // alert toast
              window.dispatchEvent(new CustomEvent('alert-toast', { 
                detail: { text: "💥 ĐÃ VA CHẠM XE KHÁC! Có sát thương phương tiện!" }
              }));

              // apply small reverse force
              tc.velX = -tc.velX;
              tc.velZ = -tc.velZ;
            }
          }
        });
      }

      // ==========================================
      // ACTIVE VEHICLE INTERIOR WIPERS SWEEPS
      // ==========================================
      const isRaining = stateRef.current.weather === 'rain';
      if (leftWiper && rightWiper) {
        if (isRaining) {
          const wiperAngle = Math.sin(carState.current.playTime * 6.5) * 0.85 - 0.45;
          leftWiper.rotation.z = wiperAngle;
          rightWiper.rotation.z = wiperAngle;
        } else {
          leftWiper.rotation.z += (-Math.PI / 4 - leftWiper.rotation.z) * 5 * delta;
          rightWiper.rotation.z += (-Math.PI / 4 - rightWiper.rotation.z) * 5 * delta;
        }
      }

      // ==========================================
      // ACTIVE SIGNAL INDICATORS BLINKING CONSOLE
      // ==========================================
      const blinkOn = Math.floor(carState.current.playTime * 4.5) % 2 === 0;
      if (indicatorFL && indicatorFR && indicatorRL && indicatorRR) {
        const hazardBlink = stateRef.current.damage > 80 || Math.abs(carState.current.speed) < 0.1;
        indicatorFL.visible = hazardBlink && blinkOn;
        indicatorFR.visible = hazardBlink && blinkOn;
        indicatorRL.visible = hazardBlink && blinkOn;
        indicatorRR.visible = hazardBlink && blinkOn;
      }

      // Render execution
      renderer.render(scene, camera);

      // Report updated statistics back to dashboard component twice per frame (throttle slightly for state rendering speed)
      if (Math.floor(carState.current.playTime * 100) % 3 === 0) {
        onStatsChange({
          speed: carState.current.speed,
          rpm,
          steerAngle: carState.current.steerAngle,
          isDrifting: Math.abs(driftValue) > 0.1,
          distance: carState.current.distance,
          score: carState.current.score,
          currentCheckpoint: carState.current.currentCheckpoint,
          playTime: carState.current.playTime,
          posX: carState.current.posX,
          posZ: carState.current.posZ,
          walkerX: carState.current.walkerX,
          walkerY: carState.current.walkerY,
          walkerZ: carState.current.walkerZ,
          fuel: carState.current.fuel,
          explodeCountdown: carState.current.explodeCountdown,
          isExploded: carState.current.isExploded,
          hasGasCanister: carState.current.hasGasCanister,
          rotY: carState.current.rotY,
          walkerAngle: carState.current.walkerAngle,
        });
      }
    };

    tick();

    // 12. Handle window size updates
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    const handleRefuel = (e: Event) => {
      const customEvent = e as CustomEvent;
      const val = customEvent.detail?.amount ?? 35;
      carState.current.fuel = Math.min(100, (carState.current.fuel ?? 100) + val);
    };
    window.addEventListener('game-refuel', handleRefuel);

    const handleTp = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tx = customEvent.detail?.x ?? 0;
      const tz = customEvent.detail?.z ?? 0;
      carState.current.posX = tx;
      carState.current.posZ = tz;
      carState.current.posY = getTerrainHeight(tx, tz, stateRef.current.selectedTrack) + 1.2;
      carState.current.speed = 0;
      // also teleport walker
      carState.current.walkerX = tx - 1.5;
      carState.current.walkerZ = tz - 1.5;
      carState.current.walkerY = carState.current.posY;
    };
    window.addEventListener('game-tp', handleTp);

    const handleToggleEngine = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tState = customEvent.detail?.state;
      const tToggle = customEvent.detail?.toggle;
      if (tToggle) {
        carState.current.isEngineOn = !carState.current.isEngineOn;
      } else if (tState !== undefined) {
        carState.current.isEngineOn = tState;
      }
      window.dispatchEvent(new CustomEvent('alert-toast', { 
        detail: { text: carState.current.isEngineOn ? "🟢 KHỞI ĐỘNG CƠ THÀNH CÔNG!" : "🔴 ĐÃ TẮT ĐỘNG CƠ PHƯƠNG TIỆN!" }
      }));
    };
    window.addEventListener('game-toggle-engine', handleToggleEngine);

    const handleAIDriveTo = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetX = customEvent.detail?.x;
      const targetZ = customEvent.detail?.z;
      if (targetX !== undefined && targetZ !== undefined) {
        carState.current.aiDriveTarget = { x: targetX, z: targetZ };
      }
    };
    window.addEventListener('game-ai-drive-to', handleAIDriveTo);

    const handleAICancelDrive = () => {
      carState.current.aiDriveTarget = null;
    };
    window.addEventListener('game-ai-cancel-drive', handleAICancelDrive);

    const handleSetSpeed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const spVal = customEvent.detail?.speed;
      if (spVal !== undefined) {
        carState.current.speed = spVal;
      }
    };
    window.addEventListener('game-set-speed', handleSetSpeed);

    const handleFlashHeadlights = (e: Event) => {
      const customEvent = e as CustomEvent;
      const duration = customEvent.detail?.duration ?? 2.5;
      (window as any).__flashHeadlightTimer = duration;
    };
    window.addEventListener('game-flash-headlights', handleFlashHeadlights);

    const handleSummonCar = () => {
      const wx = carState.current.walkerX ?? 0;
      const wz = carState.current.walkerZ ?? 0;
      carState.current.posX = wx + 2.0;
      carState.current.posZ = wz + 2.0;
      carState.current.posY = getTerrainHeight(carState.current.posX, carState.current.posZ, stateRef.current.selectedTrack) + 1.2;
      carState.current.speed = 0;
      carState.current.isExploded = false;
      carState.current.explodeCountdown = 60.0;
      carState.current.fuel = 100.0;
      stateRef.current.onRepairTick?.(100);
      (window as any).__flashHeadlightTimer = 4.0;
      
      window.dispatchEvent(new CustomEvent('alert-toast', {
        detail: { text: "🛸 TRIỆU HỒI THÀNH CÔNG: Xe VinFast đã dịch chuyển không gian về chân bạn!" }
      }));
    };
    window.addEventListener('game-summon-car', handleSummonCar);

    const handleStartFollowOwner = () => {
      carState.current.isFollowingOwner = true;
      window.dispatchEvent(new CustomEvent('alert-toast', {
        detail: { text: "🎯 KÍCH HOẠT CHẾ ĐỘ: Tự động bám theo chủ nhân (Cách 1.5m)!" }
      }));
    };
    window.addEventListener('game-start-follow-owner', handleStartFollowOwner);

    const handleStopFollowOwner = () => {
      carState.current.isFollowingOwner = false;
      carState.current.aiDriveTarget = null;
      window.dispatchEvent(new CustomEvent('alert-toast', {
        detail: { text: "🛑 ĐÃ HUỶ CHẾ ĐỘ: Xe ngừng bám theo chủ nhân." }
      }));
    };
    window.addEventListener('game-stop-follow-owner', handleStopFollowOwner);

    const handleRemoteCommand = (e: Event) => {
      const customEvent = e as CustomEvent;
      const cmd = customEvent.detail?.command;
      if (cmd !== undefined) {
        carState.current.remoteCommand = cmd;
      }
    };
    window.addEventListener('game-remote-command', handleRemoteCommand);

    // Watchers for component updates
    const rebuildTrigger = () => {
      // Rebuild elements if tracks or car features update
      applyTerrainVerts(stateRef.current.selectedTrack);
      buildProps(stateRef.current.selectedTrack);
      buildCheckpoints(stateRef.current.selectedTrack);
      updateCheckpointPosition();
      setDustColorByTrack(stateRef.current.selectedTrack);
      setupAtmosphere(stateRef.current.weather);
      buildCarModel(stateRef.current.selectedCar, stateRef.current.carColor);

      // Adjust position instantly on track swap to avoid falling under terrain
      carState.current.posX = 0;
      carState.current.posZ = stateRef.current.selectedTrack === 'racetrack' ? 50 : 0;
      carState.current.posY = getTerrainHeight(carState.current.posX, carState.current.posZ, stateRef.current.selectedTrack) + 1.5;
      carState.current.rotY = stateRef.current.selectedTrack === 'racetrack' ? Math.PI : 0;
      carState.current.speed = 0;
    };

    // Rebuild elements if selected properties update
    const prevTrack = { cur: selectedTrack };
    const prevCar = { cur: selectedCar };
    const prevColor = { cur: carColor };
    const prevWeather = { cur: weather };
    const prevLogo = { cur: customLogoText || '' };
    const prevSpecs = { cur: JSON.stringify(customCarSpecs) };
    const prevMapConfigStr = { cur: JSON.stringify(customMapConfig) };

    const checkInterval = setInterval(() => {
      const specsStr = JSON.stringify(stateRef.current.customCarSpecs);
      const mapConfigStr = JSON.stringify(stateRef.current.customMapConfig);
      if (
        prevTrack.cur !== stateRef.current.selectedTrack ||
        prevCar.cur !== stateRef.current.selectedCar ||
        prevColor.cur !== stateRef.current.carColor ||
        prevWeather.cur !== stateRef.current.weather ||
        prevLogo.cur !== (stateRef.current.customLogoText || '') ||
        prevSpecs.cur !== specsStr ||
        prevMapConfigStr.cur !== mapConfigStr
      ) {
        rebuildTrigger();
        prevTrack.cur = stateRef.current.selectedTrack;
        prevCar.cur = stateRef.current.selectedCar;
        prevColor.cur = stateRef.current.carColor;
        prevWeather.cur = stateRef.current.weather;
        prevLogo.cur = stateRef.current.customLogoText || '';
        prevSpecs.cur = specsStr;
        prevMapConfigStr.cur = mapConfigStr;
      }
    }, 100);

    // CLEANUP
    return () => {
      clearInterval(checkInterval);
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('game-refuel', handleRefuel);
      window.removeEventListener('game-tp', handleTp);
      window.removeEventListener('game-toggle-engine', handleToggleEngine);
      window.removeEventListener('game-ai-drive-to', handleAIDriveTo);
      window.removeEventListener('game-ai-cancel-drive', handleAICancelDrive);
      window.removeEventListener('game-set-speed', handleSetSpeed);
      window.removeEventListener('game-flash-headlights', handleFlashHeadlights);
      window.removeEventListener('game-summon-car', handleSummonCar);
      window.removeEventListener('game-start-follow-owner', handleStartFollowOwner);
      window.removeEventListener('game-stop-follow-owner', handleStopFollowOwner);
      window.removeEventListener('game-remote-command', handleRemoteCommand);
      
      if (container) {
        container.removeEventListener('mousedown', onPointerDown);
        container.removeEventListener('touchstart', onPointerDown);
        container.removeEventListener('mousemove', onPointerMove);
        container.removeEventListener('touchmove', onPointerMove);
        container.removeEventListener('wheel', onCanvasWheel);
        container.removeEventListener('mouseenter', handlePointerEnter);
      }
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);

      if (renderer) {
        renderer.dispose();
      }
      if (container && renderer) {
        try {
          container.removeChild(renderer.domElement);
        } catch (_) {}
      }
    };
  }, []);

  return (
    <div
      id="three-canvas-container"
      ref={containerRef}
      tabIndex={0}
      className="absolute inset-0 cursor-crosshair bg-slate-900 select-none overflow-hidden z-0 outline-none"
    />
  );
};
