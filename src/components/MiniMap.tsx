import React, { useState } from 'react';
import { GameStats, TrackType } from '../types';
import { Map, Maximize2, Minimize2 } from 'lucide-react';

interface MiniMapProps {
  stats: GameStats;
  selectedTrack: TrackType;
  playerMode: 'driving' | 'walking';
  isEmbedded?: boolean;
}

export const MiniMap: React.FC<MiniMapProps> = ({ stats, selectedTrack, playerMode, isEmbedded }) => {
  const [zoom, setZoom] = useState<number>(1.2); // zoom divisor factor

  // Current active entity coordinates
  const currentX = playerMode === 'driving' ? (stats.posX ?? 0) : (stats.walkerX ?? 0);
  const currentZ = playerMode === 'driving' ? (stats.posZ ?? 0) : (stats.walkerZ ?? 0);
  const currentAngle = playerMode === 'driving' ? (stats.rotY ?? 0) : (stats.walkerAngle ?? 0);

  // Buildings layout definitions for metropolis
  const buildings = [
    { cx: -50, cz: -50, lx: 30, lz: 30, label: 'Khu A' },
    { cx: -50, cz: 50, lx: 30, lz: 30, label: 'Khu B' },
    { cx: 50, cz: -50, lx: 30, lz: 30, label: 'Khu C' },
    { cx: 50, cz: 50, lx: 30, lz: 30, label: 'Khu D' },
    { cx: -110, cz: -110, lx: 35, lz: 35, label: 'Tòa Nam' },
    { cx: -110, cz: 110, lx: 35, lz: 35, label: 'Tòa Bắc' },
    { cx: 110, cz: -110, lx: 35, lz: 35, label: 'Tòa Đông' },
    { cx: 110, cz: 110, lx: 35, lz: 35, label: 'Tòa Tây' },
  ];

  // Specific checkpoints of various maps
  const checkpoints: { x: number; z: number }[] = [];
  if (selectedTrack === 'racetrack') {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI;
      checkpoints.push({ x: Math.cos(angle) * 50, z: Math.sin(angle) * 50 });
    }
  } else if (selectedTrack === 'metropolis_city') {
    checkpoints.push({ x: 0, z: 30 });
    checkpoints.push({ x: 50, z: 110 });
    checkpoints.push({ x: -110, z: 0 });
    checkpoints.push({ x: -50, z: -110 });
  } else {
    checkpoints.push({ x: 15, z: 25 });
    checkpoints.push({ x: -35, z: 65 });
    checkpoints.push({ x: 45, z: -45 });
  }

  // Map 130px box center is (65, 65)
  const mapCenter = 65;
  const mapScale = 0.5 * zoom; // scale factor to fit coordinates

  // Project point on SVG box
  const getProjectedCoords = (worldX: number, worldZ: number) => {
    const dx = worldX - currentX;
    const dz = worldZ - currentZ;

    const px = mapCenter + dx * mapScale;
    const py = mapCenter + dz * mapScale; 
    return { x: px, y: py };
  };

  return (
    <div 
      id={isEmbedded ? "minimap-embedded" : "minimap-overlay"} 
      className={isEmbedded 
        ? "relative bg-transparent flex flex-col gap-1.5 overflow-hidden w-[146px] select-none text-left z-10 transition-all"
        : "absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-indigo-500/30 p-2.5 shadow-xl flex flex-col gap-1.5 overflow-hidden w-[146px] select-none text-left z-50 transition-all hover:border-cyan-400"
      }
    >
      <div className="flex items-center justify-between text-white text-[9px] font-bold uppercase tracking-widest font-mono">
        <div className="flex items-center gap-1 text-cyan-400 font-sans">
          <Map className="w-3 h-3" />
          <span>BẢN ĐỒ HUD</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setZoom(z => Math.max(0.6, z - 0.2))} 
            className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
            title="Thu nhỏ"
          >
            <Minimize2 className="w-2.5 h-2.5" />
          </button>
          <button 
            onClick={() => setZoom(z => Math.min(2.0, z + 0.2))} 
            className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
            title="Phóng to"
          >
            <Maximize2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* RENDER RADAR CIRCLE CANVAS/SVG VIEW */}
      <div className="w-[126px] h-[126px] bg-slate-900/60 rounded-full border border-indigo-500/40 relative overflow-hidden flex items-center justify-center">
        {/* Radar crosshairs lines */}
        <div className="absolute w-full h-[1px] bg-indigo-500/10" />
        <div className="absolute h-full w-[1px] bg-indigo-500/10" />
        <div className="absolute w-20 h-20 rounded-full border border-indigo-500/5 animate-pulse" />
        
        {/* SVG Drawing Layer */}
        <svg className="absolute w-full h-full text-[7px]" viewBox="0 0 130 130">
          {/* 1. Draw static Metropolis building blocks */}
          {selectedTrack === 'metropolis_city' && buildings.map((b, idx) => {
            const centerProj = getProjectedCoords(b.cx, b.cz);
            const w = b.lx * mapScale;
            const h = b.lz * mapScale;
            const rx = centerProj.x - w / 2;
            const ry = centerProj.y - h / 2;

            const dx = centerProj.x - mapCenter;
            const dy = centerProj.y - mapCenter;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 85) return null;

            return (
              <g key={idx}>
                <rect 
                  x={rx} 
                  y={ry} 
                  width={w} 
                  height={h} 
                  fill="#1e293b" 
                  stroke="#475569" 
                  strokeWidth="0.5"
                  opacity="0.65" 
                  rx="1"
                />
              </g>
            );
          })}

          {/* 2. Draw active Checkpoints markers */}
          {checkpoints.map((cp, idx) => {
            const proj = getProjectedCoords(cp.x, cp.z);
            const dx = proj.x - mapCenter;
            const dy = proj.y - mapCenter;
            if (Math.sqrt(dx*dx + dy*dy) > 60) return null; 

            const isActive = (stats.currentCheckpoint ?? 0) % checkpoints.length === idx;

            return (
              <circle 
                key={idx}
                cx={proj.x}
                cy={proj.y}
                r={isActive ? 3.5 : 2}
                fill={isActive ? '#10b981' : '#4b5563'}
                stroke={isActive ? '#ffffff' : 'none'}
                strokeWidth="0.6"
                opacity="0.9"
              />
            );
          })}

          {/* 3. Draw key locations: Fuel garage area / Repair pad */}
          {(() => {
            const gasProj = getProjectedCoords(-15, -15);
            const repProj = getProjectedCoords(15, 15);

            return (
              <>
                {/* Repair garage */}
                {Math.sqrt((repProj.x - mapCenter)**2 + (repProj.y - mapCenter)**2) < 60 && (
                  <circle cx={repProj.x} cy={repProj.y} r="3" fill="#3b82f6" opacity="0.85" stroke="#ffffff" strokeWidth="0.5" />
                )}
                {/* Gas pad */}
                {Math.sqrt((gasProj.x - mapCenter)**2 + (gasProj.y - mapCenter)**2) < 60 && (
                  <circle cx={gasProj.x} cy={gasProj.y} r="3" fill="#f59e0b" opacity="0.85" stroke="#ffffff" strokeWidth="0.5" />
                )}
              </>
            );
          })()}

          {/* 4. Draw Center Player position Triangle arrow indicating real-time direction */}
          <g transform={`translate(${mapCenter}, ${mapCenter}) rotate(${(-currentAngle * 180) / Math.PI})`}>
            <polygon 
              points="0,-6 -4,5 4,5" 
              fill={playerMode === 'driving' ? '#06b6d4' : '#ec4899'} 
              stroke="#ffffff"
              strokeWidth="1"
            />
          </g>
        </svg>
      </div>

      {/* TELEMETRY READOUTS */}
      <div className="flex flex-col gap-0.5 text-[8px] font-mono text-zinc-400 mt-1">
        <div className="flex justify-between items-center text-[7.5px]">
          <span>GPS:</span>
          <span className="text-white font-extrabold text-right">
            X:{currentX.toFixed(0)} Z:{currentZ.toFixed(0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>BẢN ĐỒ:</span>
          <span className="text-cyan-400 font-bold uppercase overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">
            {selectedTrack.replace('_', ' ')}
          </span>
        </div>
        <div className="flex justify-between items-center text-[7.5px]">
          <span>CHẾ ĐỘ:</span>
          <span className={`font-black ${playerMode === 'driving' ? 'text-cyan-400' : 'text-fuchsia-400'}`}>
            {playerMode === 'driving' ? '🚗 LÁI XE' : '🚶 ĐI BỘ'}
          </span>
        </div>
      </div>
    </div>
  );
};
