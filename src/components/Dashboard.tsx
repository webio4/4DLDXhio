import React from 'react';
import { GameStats, CameraMode } from '../types';
import { 
  Gauge, Trophy, MapPin, Sparkles, Volume2, VolumeX, Camera, 
  RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ShieldAlert,
  User, Car, Wrench, Fuel, AlertOctagon
} from 'lucide-react';

interface DashboardProps {
  stats: GameStats;
  isMuted: boolean;
  onToggleMute: () => void;
  onCameraChange: (camera: CameraMode) => void;
  onReset: () => void;
  damage: number;
  playerMode: 'driving' | 'walking';
  onToggleMode: () => void;
  onRepairManual: () => void;
  // Keyboard keys pressed tracking for HUD
  keyboardState: {
    w: boolean;
    s: boolean;
    a: boolean;
    d: boolean;
    space: boolean;
  };
  selectedTrack: string;
  outOfRangeTime: number;
  hideFloatingControls?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  isMuted,
  onToggleMute,
  onCameraChange,
  onReset,
  damage,
  playerMode,
  onToggleMode,
  onRepairManual,
  keyboardState,
  selectedTrack,
  outOfRangeTime,
  hideFloatingControls = false,
}) => {
  // Speed calculation: convert units/frame speed to virtual km/h
  const speedKmh = Math.abs(Math.round(stats.speed * 3.6));
  
  // Angle display
  const steerAngleDeg = Math.round((stats.steerAngle * 180) / Math.PI);
  
  // Format playing time helper (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine current virtual gear
  let gearLabel = 'N';
  if (stats.speed > 0.05) {
    gearLabel = 'D';
  } else if (stats.speed < -0.05) {
    gearLabel = 'R';
  } else {
    gearLabel = 'P';
  }

  const fuelPercent = Math.round(stats.fuel ?? 100);
  const countdownText = stats.explodeCountdown !== undefined ? Math.ceil(stats.explodeCountdown) : 60;

  const getAddress = (track: string) => {
    switch (track) {
      case 'grassland':
        return '🌲 Khu du lịch sinh thái Đồng Mô, Sơn Tây, Hà Nội';
      case 'desert_bumpy':
        return '🌵 Đồi Cát Bay Mũi Né, Phan Thiết, Bình Thuận';
      case 'mountain':
        return '⛰️ Đèo Pha Đinh dốc đứng hiểm trở, Tuần Giáo';
      case 'racetrack':
        return '🏁 Đường đua quốc tế F1 Công viên Mỹ Đình, Hà Nội';
      case 'metropolis_city':
        return '🏙️ Đại lộ Nguyễn Huệ, Bến Nghé, Quận 1, TP. HCM';
      case 'countryside_village':
        return '🏡 Làng cổ Đường Lâm, Đường Lâm, Ba Vì, Sơn Tây, Hà Nội';
      case 'custom_map':
        return '🛠️ Đô thị thông minh Công trường xây dựng số 5';
      default:
        return '📍 Vị trí chưa xác định';
    }
  };

  return (
    <div id="dashboard-hud" className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10 font-sans select-none">
      
      {/* --- EXPLOSION SCREEN-WIDE OVERLAY --- */}
      {stats.isExploded && (
        <div id="explosion-screen-overlay" className="absolute inset-0 bg-black/90 pointer-events-auto flex flex-col items-center justify-center z-50 text-white animate-fade-in p-6">
          <div className="bg-red-950/85 border-2 border-red-500 rounded-3xl p-10 flex flex-col items-center text-center max-w-lg shadow-2xl shadow-red-500/20 gap-4">
            <span className="text-7xl animate-bounce">💥</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-red-500 uppercase">Xe đã bị nổ tung!</h2>
            <p className="text-slate-300 font-mono text-sm leading-relaxed">
              Bạn không thể sửa chữa trước khi đồng hồ đếm ngược hết hạn. Phương tiện đang được trục vớt, cứu hộ và khôi phục mới...
            </p>
            <div className="w-16 h-1 bg-red-500 rounded-full animate-pulse mt-2" />
            <span className="text-xs text-slate-400 font-mono uppercase mt-1">Đang hồi hồi phục trong giây lát...</span>
          </div>
        </div>
      )}

      {/* --- TOP ROW: GAME SCORE & METRICS HUD --- */}
      <div className="w-full flex justify-between items-start">
        
        {/* Left Stats card deleted */}

        {/* Center: Warnings & Checkpoint Score */}
        <div className="flex flex-col items-center gap-2 max-w-sm md:max-w-md">
          {/* Top Center Stats deleted */}

          {/* ACTIVE WARNING OVERLAYS */}
          <div className="flex flex-col gap-2 w-full max-w-xs pointer-events-auto">
            {/* 1-Minute Explosion Critical Self-Destruct Warning */}
            {damage >= 100 && (
              <div className="bg-red-950/90 border border-red-500 rounded-xl px-3.5 py-2.5 text-white shadow-xl animate-pulse flex items-center gap-3">
                <AlertOctagon className="w-5 h-5 text-red-500 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-red-500 font-extrabold font-mono text-xs uppercase tracking-wide">XE HỎNG - NGUY HIỂM!</span>
                  <span className="text-[11px] font-mono text-slate-200">
                    Sẽ nổ tung sau <span className="text-red-400 font-black text-xs">{countdownText}s</span> nếu chưa sửa!
                  </span>
                </div>
              </div>
            )}

            {/* Carrying Gas Canister Walker Badge */}
            {stats.hasGasCanister && (
              <div className="bg-amber-500 border border-amber-400 text-slate-950 rounded-xl px-3.5 py-2 text-center shadow-lg font-bold font-mono text-xs animate-bounce flex items-center justify-center gap-2">
                <Fuel className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>MANG CAN XĂNG - Về xe đổ xăng!</span>
              </div>
            )}

            {/* Low Fuel warning */}
            {fuelPercent <= 25 && !stats.isExploded && (
              <div className="bg-amber-950/90 border border-amber-500 rounded-xl px-3.5 py-2 text-amber-200 shadow-md flex items-center gap-2.5 text-left">
                <Fuel className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-amber-400 text-[10px] font-mono font-bold uppercase">Cảnh báo Hết Xăng</span>
                  <span className="text-[9px] font-mono text-slate-300">
                    Lái tới Ô cam (-15, -15) hoặc đi bộ mang can về!
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right utility buttons deleted */}
      </div>

      {/* --- DRIFT POPUP INDICATOR --- */}
      <div id="drift-alert" className="flex justify-center h-10">
        {stats.isDrifting && (
          <div className="bg-amber-500 text-slate-950 font-mono text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 animate-bounce shadow-lg shadow-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            DRIFTING SLIDE!! SPEED SPIN x1.5
          </div>
        )}
      </div>

      {/* --- BOTTOM ROW: MAIN SPEED GAUGE & KEYBOARD HUD --- */}
      <div className="w-full flex flex-col md:flex-row justify-between items-end gap-4">
        
        {/* Left: Standard Speedometer Dial HUD */}
        <div className="flex flex-col gap-2 items-start pointer-events-auto">
          <div id="hud-left-gauge" className="bg-slate-900/85 backdrop-blur-md border border-slate-700/55 rounded-2xl p-4 md:p-5 text-white flex items-center gap-5 shadow-2xl min-w-[260px] mb-16 md:mb-20">
            {/* RPM & Speed metrics layout */}
            <div className="relative w-20 h-20 flex flex-col justify-center items-center rounded-full border-4 border-slate-800">
              <div 
                style={{ clipPath: `inset(${(1 - Math.min(stats.rpm / 8000, 1)) * 100}% 0px 0px 0px)` }}
                className="absolute inset-0 rounded-full border-4 border-indigo-500/80 transition-all duration-100" 
              />
              <span className="text-slate-400 font-mono text-[10px] uppercase">Hộp số</span>
              <span className="text-3xl font-extrabold font-mono text-indigo-400">{gearLabel}</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 text-left">
              <div className="flex items-baseline gap-1.5 justify-start">
                <span className="text-5xl font-black font-mono tracking-tight text-white">{speedKmh}</span>
                <span className="text-slate-400 font-mono font-bold text-xs">KM/H</span>
              </div>

              {/* RPM Progress bar */}
              <div className="w-full flex flex-col gap-0.5 mt-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Vòng tua RPM</span>
                  <span className={stats.rpm > 6500 ? 'text-rose-400 animate-pulse' : ''}>{Math.round(stats.rpm)}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                  <div 
                    style={{ width: `${Math.min((stats.rpm / 8000) * 100, 100)}%` }} 
                    className={`h-full transition-all duration-100 ${
                      stats.rpm > 6500 ? 'bg-rose-500' : stats.rpm > 4500 ? 'bg-amber-500' : 'bg-indigo-500'
                    }`} 
                  />
                </div>
              </div>

              {/* Steer angle info */}
              <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs font-mono justify-start">
                <Gauge className="w-3.5 h-3.5" />
                <span>Bẻ lái:</span>
                <span className={`font-bold ${steerAngleDeg !== 0 ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {steerAngleDeg}° {steerAngleDeg > 0 ? '->' : steerAngleDeg < 0 ? '<-' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center keys indicator deleted */}



      </div>

    </div>
  );
};
