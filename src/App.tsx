import { useState, useEffect, useRef } from 'react';
import { 
  TrackType, CarType, WeatherType, PhysicsConfig, GameStats, CameraMode, CustomCarSpecs, CharacterConfig, CustomMapConfig
} from './types';
import { ThreeCanvas } from './components/ThreeCanvas';
import { Dashboard } from './components/Dashboard';
import { ControlPanel } from './components/ControlPanel';
import { IPhoneVirtual } from './components/IPhoneVirtual';
import { VinCockpit } from './components/VinCockpit';
import { MiniMap } from './components/MiniMap';
import { soundEngine } from './utils/AudioEngine';
import { 
  Play, Compass, Sliders, AlertTriangle, RefreshCw, Volume2, Sparkles, Navigation,
  User, Phone, Trophy, MapPin, Keyboard, VolumeX, Car, X, CircleDot, SlidersHorizontal,
  Clock, ArrowUp, ArrowLeft, ArrowDown, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';

export default function App() {
  // Splash Screen intro toggle
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Settings customizable states
  const [selectedCar, setSelectedCar] = useState<CarType>('sport');
  const [carColor, setCarColor] = useState<string>('#ff5722');
  const [selectedTrack, setSelectedTrack] = useState<TrackType>('grassland');
  const [weather, setWeather] = useState<WeatherType>('sunny');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [resetCounter, setResetCounter] = useState<number>(0);

  // Vehicle states & text customization
  const [isCarLocked, setIsCarLocked] = useState<boolean>(false);
  const [customLogoText, setCustomLogoText] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const alertToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Custom Character dress-up config state
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig>({
    clothingStyle: 'racer',
    shirtColor: '#ef4444',
    pantsColor: '#1e293b',
    hairColor: '#eab350',
    accessory: 'sunglasses',
    headwear: 'helmet',
    helmetColor: '#ff5722',
  });

  // Custom live map terrain config state
  const [customMapConfig, setCustomMapConfig] = useState<CustomMapConfig>({
    customHillHeight: 4.0,
    customDuneScale: 3.0,
    customRippleFreq: 0.15,
    customFloorLevel: 0,
    customObstacleDensity: 2,
    trackTheme: 'classic',
    mapName: 'Đồi Cát Hoang Sơ',
    placedBlocks: [],
    
    // Server Owner Config initialization defaults
    meteorFrequency: 'low',
    worldGravity: 9.8,
    npcDensity: 'normal',
    npcSpeed: 1.0,
    enginePower: 1.0,
    lockedWeather: 'dynamic',
    autoRepair: false,
    timeAttack: false,
    doubleDrift: false,
    invincibleCar: false,
  });

  // Custom Car Builder Specs state
  const [customCarSpecs, setCustomCarSpecs] = useState<CustomCarSpecs>({
    bodyLength: 3.8,
    bodyWidth: 1.9,
    bodyHeight: 0.5,
    wheelSize: 0.48,
    spoilerStyle: 'winged',
    decalStyle: 'stripes',
    roofHeight: 0.45,
    frontCabinLength: 1.4,
    brand: 'ford',
    brandStyle: 'classic',
    plateNumber: 'FORD-3000',
  });

  // Mode and Damage tracking states
  const [playerMode, setPlayerMode] = useState<'driving' | 'walking'>('driving');
  const [damage, setDamage] = useState<number>(0);

  // Player Injury / Death States from Explosions
  const [isInjuredByExplosion, setIsInjuredByExplosion] = useState<boolean>(false);
  const [injuredDistance, setInjuredDistance] = useState<number>(0);
  const [secondsToDie, setSecondsToDie] = useState<number>(60);
  const [hasDiedCompletely, setHasDiedCompletely] = useState<boolean>(false);
  const [loaderWidth, setLoaderWidth] = useState<number>(100);

  // Visual Alert Overlays (triggers flashing vignettes)
  const [checkpointFlash, setCheckpointFlash] = useState<boolean>(false);
  const [collisionFlash, setCollisionFlash] = useState<boolean>(false);

  // Consolidated Super Master multifunction HUB HUD controller
  const [isMasterFobOpen, setIsMasterFobOpen] = useState<boolean>(false);
  const [hasOpenedMasterFobOnce, setHasOpenedMasterFobOnce] = useState<boolean>(false);
  const [masterActiveTab, setMasterActiveTab] = useState<'settings' | 'keys'>('settings');
  const [isMasterBodyOpen, setIsMasterBodyOpen] = useState<boolean>(false);

  // Onscreen Mobile Touch controls states
  const [isAccelerating, setIsAccelerating] = useState<boolean>(false);
  const [isBraking, setIsBraking] = useState<boolean>(false);
  const [steerLeft, setSteerLeft] = useState<boolean>(false);
  const [steerRight, setSteerRight] = useState<boolean>(false);

  // Keyboard live highlight tracking for Dashboard HUD
  const [keyboardState, setKeyboardState] = useState({
    w: false,
    s: false,
    a: false,
    d: false,
    space: false,
  });

  // Minecraft-style chat & code input system
  const [chatLogs, setChatLogs] = useState<string[]>([
    "⌨️ Chat/Code Console loaded! Gõ /help để xem danh sách phím cheat.",
    "⌨️ Nhấn phím [/] để mở ô nhập lệnh bất cứ lúc nào."
  ]);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>("");
  const chatInactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide code input bar if no typing/interaction for 3 seconds as requested
  useEffect(() => {
    if (!isChatOpen) {
      if (chatInactivityTimerRef.current) {
        clearTimeout(chatInactivityTimerRef.current);
      }
      return;
    }

    // Refresh/restart the 3-second automatic closure timer
    if (chatInactivityTimerRef.current) {
      clearTimeout(chatInactivityTimerRef.current);
    }

    chatInactivityTimerRef.current = setTimeout(() => {
      setIsChatOpen(false);
    }, 3000);

    return () => {
      if (chatInactivityTimerRef.current) {
        clearTimeout(chatInactivityTimerRef.current);
      }
    };
  }, [isChatOpen, chatInput]);

  // Physical specs configuration defaults
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig>({
    mass: 1000,
    engineForce: 13,
    brakingForce: 10,
    maxSteerAngle: 0.52, // 30 degrees steer
    steeringSpeed: 0.12,
    friction: 0.14,
    driftMode: true,
  });

  const [outOfRangeTime, setOutOfRangeTime] = useState<number>(60);

  // Live output game telemetry
  const [stats, setStats] = useState<GameStats>({
    speed: 0,
    rpm: 800,
    steerAngle: 0,
    gear: 'P',
    distance: 0,
    isDrifting: false,
    score: 0,
    currentCheckpoint: 0,
    activeCamera: 'third_person',
    playTime: 0,
  });

  // Synchronize dynamic keyboard trackers with window items (only during driving)
  useEffect(() => {
    if (!isPlaying) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // General support for opening chat/commands using Slash /
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsChatOpen(true);
        setChatInput("/");
        return;
      }

      if (e.key === 'Escape') {
        setIsChatOpen(false);
        return;
      }

      // Ignore game inputs when typing inside input controls
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const k = e.key.toLowerCase();
      const code = e.code;

      // Toggle Cockpit Multi-Hub 'h' or 'm'
      if (k === 'h' || code === 'KeyH' || k === 'm' || code === 'KeyM') {
        setIsMasterFobOpen(prev => {
          const next = !prev;
          if (next) {
            setHasOpenedMasterFobOnce(true);
            soundEngine.playUnlockSound?.();
            alertToast("🛠️ ĐÃ HIỆN COCKPIT MULTI-HUB!");
          } else {
            soundEngine.playLockSound?.();
            alertToast("🔒 ĐÃ ẨN COCKPIT MULTI-HUB LÀM SẠCH MÀN HÌNH!");
          }
          return next;
        });
        return;
      }

      // Lock / Unlock car key 'j'
      if (k === 'j' || code === 'KeyJ') {
        setIsCarLocked(prev => {
          const next = !prev;
          if (next) {
            soundEngine.playLockSound?.();
            alertToast("🔒 ĐÃ KHOÁ XE!");
          } else {
            soundEngine.playUnlockSound?.();
            alertToast("🔓 ĐÃ MỞ KHOÁ XE!");
          }
          return next;
        });
        return;
      }

      if (k === 'f' || code === 'KeyF') {
        // Safe check for distance when attempting to BOARD the car
        if (playerMode === 'walking') {
          const wx = stats.walkerX ?? 0;
          const wz = stats.walkerZ ?? 0;
          const cx = stats.posX ?? 0;
          const cz = stats.posZ ?? 0;
          const dist = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
          
          if (dist > 6.0) {
            alertToast("⚠️ Bạn ở quá xa xe! Hãy đi bộ đến sát xe (dưới 6m) để mở cửa lên xe.");
            return;
          }

          if (isCarLocked) {
            alertToast("⚠️ Cửa xe đang khoá! Nhấn J hoặc mở iPhone ảo để mở khoá xe trước.");
            return;
          }
        }
        setPlayerMode(prev => prev === 'driving' ? 'walking' : 'driving');
        return;
      }

      // Lock motor 'n'
      if (k === 'n' || code === 'KeyN') {
        // Toggle engine motor state!
        window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { toggle: true } }));
        return;
      }

      // If car is locked and in driving mode, lock input
      if (isCarLocked && playerMode === 'driving') {
        return;
      }

      if (k === 'w' || code === 'KeyW' || e.key === 'ArrowUp') setKeyboardState(p => ({ ...p, w: true }));
      if (k === 's' || code === 'KeyS' || e.key === 'ArrowDown') setKeyboardState(p => ({ ...p, s: true }));
      if (k === 'a' || code === 'KeyA' || e.key === 'ArrowLeft') setKeyboardState(p => ({ ...p, a: true }));
      if (k === 'd' || code === 'KeyD' || e.key === 'ArrowRight') setKeyboardState(p => ({ ...p, d: true }));
      if (e.key === ' ' || code === 'Space') setKeyboardState(p => ({ ...p, space: true }));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const k = e.key.toLowerCase();
      const code = e.code;
      if (k === 'w' || code === 'KeyW' || e.key === 'ArrowUp') setKeyboardState(p => ({ ...p, w: false }));
      if (k === 's' || code === 'KeyS' || e.key === 'ArrowDown') setKeyboardState(p => ({ ...p, s: false }));
      if (k === 'a' || code === 'KeyA' || e.key === 'ArrowLeft') setKeyboardState(p => ({ ...p, a: false }));
      if (k === 'd' || code === 'KeyD' || e.key === 'ArrowRight') setKeyboardState(p => ({ ...p, d: false }));
      if (e.key === ' ' || code === 'Space') setKeyboardState(p => ({ ...p, space: false }));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isPlaying, playerMode, isCarLocked, stats.walkerX, stats.walkerZ, stats.posX, stats.posZ]);

  // Handle start click (initiates sound engine context safely)
  const handleStartGame = () => {
    soundEngine.init();
    soundEngine.resume();
    setIsPlaying(true);
    setTimeout(() => {
      alertToast("💡 Lái xe bằng phím WASD / Mũi tên. Nhấn H hoặc M để bẻ lái thông số HUD & mở Bản đồ!");
    }, 1500);
  };

  // Toggle Mute Audio
  const handleToggleMute = () => {
    const nextVal = soundEngine.toggleMute();
    setIsMuted(nextVal);
  };

  // Walker distance check interval removed to allow unrestricted walking distances.
  useEffect(() => {
    setOutOfRangeTime(60);
  }, [playerMode]);

  // Player injury and cellular disintegration timer effects
  useEffect(() => {
    const handlePlayerInjured = (e: Event) => {
      const customEvent = e as CustomEvent;
      const isInstant = customEvent.detail?.instantKill ?? false;
      const dist = customEvent.detail?.distance ?? 10.0;

      soundEngine.playCollision?.(0.9);
      
      if (isInstant) {
        setSecondsToDie(0);
        setIsInjuredByExplosion(true);
        setHasDiedCompletely(true);
      } else {
        setIsInjuredByExplosion(true);
        setInjuredDistance(dist);
        setSecondsToDie(60);
        setHasDiedCompletely(false);
      }
    };

    window.addEventListener('game-player-injured', handlePlayerInjured);

    const handleAlertToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      const text = customEvent.detail?.text;
      if (text) {
        alertToast(text);
      }
    };
    window.addEventListener('alert-toast', handleAlertToast);

    const handleSetWeather = (e: Event) => {
      const customEvent = e as CustomEvent;
      const w = customEvent.detail?.weather;
      if (w) {
        setWeather(w);
      }
    };
    window.addEventListener('game-set-weather', handleSetWeather);

    return () => {
      window.removeEventListener('game-player-injured', handlePlayerInjured);
      window.removeEventListener('alert-toast', handleAlertToast);
      window.removeEventListener('game-set-weather', handleSetWeather);
    };
  }, []);

  useEffect(() => {
    if (!isInjuredByExplosion || hasDiedCompletely) return;

    const interval = setInterval(() => {
      setSecondsToDie(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setHasDiedCompletely(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isInjuredByExplosion, hasDiedCompletely]);

  useEffect(() => {
    if (hasDiedCompletely) {
      setLoaderWidth(100);
      const interval = setInterval(() => {
        setLoaderWidth(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1.15;
        });
      }, 40);

      const timeout = setTimeout(() => {
        window.location.reload();
      }, 3500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [hasDiedCompletely]);

  // Switch camera angle
  const handleCameraChange = (newCam: CameraMode) => {
    setStats((prev) => ({ ...prev, activeCamera: newCam }));
  };

  // Update Stats details
  const handleStatsChange = (newStats: Partial<GameStats>) => {
    setStats((prev) => ({
      ...prev,
      ...newStats,
    }));
  };

  // On checkpoint crossed, flash screen green
  const handleCheckpointEarned = () => {
    setCheckpointFlash(true);
    setTimeout(() => setCheckpointFlash(false), 400);
  };

  // On obstacle collision, flash screen red and increase car damage
  const handleCollisionOccurred = () => {
    setCollisionFlash(true);
    setTimeout(() => setCollisionFlash(false), 400);
    setDamage((prev) => Math.min(100, prev + Math.floor(Math.random() * 8) + 12));
  };

  const handleRepairTick = (amount: number) => {
    setDamage((prev) => Math.max(0, prev - amount));
  };

  // Reset physical vehicle state (clears excessive damage as a convenience or spawns back)
  const handleResetVehicle = () => {
    setResetCounter((prev) => prev + 1);
  };

  const processCommand = (cmdStr: string) => {
    const parts = cmdStr.trim().split(" ");
    const base = parts[0].toLowerCase();
    
    if (base === "/help") {
      setChatLogs(prev => [
        ...prev,
        `⌨️ [Minecraft Commands Cheat List]:`,
        `  - /tp [x] [z] : Dịch chuyển tới tọa độ (Ví dụ: /tp 50 -50)`,
        `  - /engine [on | off] : Bật / Tắt động cơ xe`,
        `  - /refuel : Đổ đầy xăng (100%)`,
        `  - /repair : Sửa chữa hư hỏng xe về 0%`,
        `  - /color [màu] : Đổi màu xe (Ví dụ: /color red, /color #ffff00)`,
        `  - /time [day | night] : Đổi thời tiết ban ngày / sấm sét`,
        `  - /speed [số] : Thiết lập tốc độ tức thời của xe (Ví dụ: /speed 120)`
      ]);
    } else if (base === "/tp") {
      const x = parseFloat(parts[1]);
      const z = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(z)) {
        window.dispatchEvent(new CustomEvent('game-tp', { detail: { x, z } }));
        setChatLogs(prev => [...prev, `🛸 Lệnh TP: Đã dịch chuyển xe tới tọa độ X: ${x}, Z: ${z}`]);
        alertToast(`🛸 Đã dịch chuyển xe tới tọa độ (X: ${x}, Z: ${z})`);
      } else {
        setChatLogs(prev => [...prev, `⚠️ Cách dùng: /tp [x] [z]`]);
      }
    } else if (base === "/engine") {
      const state = parts[1]?.toLowerCase();
      if (state === "on" || state === "start") {
        window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: true } }));
        setChatLogs(prev => [...prev, `🔋 Lệnh Động cơ: Đã kích hoạt ĐỘNG CƠ BẬT`]);
      } else if (state === "off" || state === "stop") {
        window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: false } }));
        setChatLogs(prev => [...prev, `🔋 Lệnh Động cơ: Đã TẮT ĐỘNG CƠ`]);
      } else {
        setChatLogs(prev => [...prev, `⚠️ Cách dùng: /engine [on | off]`]);
      }
    } else if (base === "/refuel" || base === "/gas") {
      window.dispatchEvent(new CustomEvent('game-refuel', { detail: { amount: 100 } }));
      setChatLogs(prev => [...prev, `⚡ Nhiên liệu: Đã nạp đầy xe!`]);
    } else if (base === "/repair") {
      setDamage(0);
      setChatLogs(prev => [...prev, `🛠️ Sửa chữa: Thân xe phục hồi 100% độ bền!`]);
    } else if (base === "/color") {
      const col = parts[1] || "#ef4444";
      setCarColor(col);
      setChatLogs(prev => [...prev, `🎨 Lệnh đổi màu: Đã đổi màu xe thành ${col}`]);
    } else if (base === "/time") {
      const t = parts[1]?.toLowerCase();
      if (t === "day" || t === "sunny") {
        setWeather("sunny");
        setChatLogs(prev => [...prev, `☀️ Thời tiết: Chuyển sang BAN NGÀY nắng vàng`]);
      } else if (t === "night" || t === "rain") {
        setWeather("rain");
        setChatLogs(prev => [...prev, `🌙 Thời tiết: Chuyển sang BAN ĐÊM sấm chớp`]);
      } else {
        setChatLogs(prev => [...prev, `⚠️ Cách dùng: /time [day | night]`]);
      }
    } else if (base === "/speed") {
      const s = parseFloat(parts[1]);
      if (!isNaN(s)) {
        window.dispatchEvent(new CustomEvent('game-set-speed', { detail: { speed: s / 3.6 } }));
        setChatLogs(prev => [...prev, `🚀 Đã thiết lập tốc độ xe lên mục tiêu: ${s} km/h!`]);
      } else {
        setChatLogs(prev => [...prev, `⚠️ Cách dùng: /speed [số]`]);
      }
    } else {
      setChatLogs(prev => [...prev, `❌ Lệnh không xác định: "${base}". Gõ /help để xem giúp đỡ.`]);
    }
  };

  return (
    <div id="game-app-root" className="w-screen h-screen relative bg-slate-950 text-white overflow-hidden select-none font-sans">
      
      {/* 1. START GAME LOADING INTRO SPLASH */}
      {!isPlaying && (
        <div 
          id="splash-loading-screen" 
          className="absolute inset-0 z-50 flex flex-col justify-center items-center p-6 text-center select-none"
          style={{
            background: 'radial-gradient(ellipse at center, #1e1b4b 0%, #030712 100%)'
          }}
        >
          {/* Decorative floating grids */}
          <div className="absolute inset-x-0 bottom-0 top-1/2 bg-[linear-gradient(to_bottom,rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(to_right,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

          <div className="relative max-w-xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
            {/* Supercharged custom animated icon */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-2 relative group">
              <Compass className="w-10 h-10 text-white animate-spin-slow group-hover:scale-110 transition-transform" />
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-2xl blur-md opacity-30 -z-10" />
            </div>

            {/* Title / Slogan */}
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                Lái Xe 3D Simulator
              </h1>
              <p className="text-sm font-semibold text-rose-400 font-mono tracking-wide uppercase">
                Bánh Xoay Trái Phải • Tiến Lùi Chạy Thẳng
              </p>
            </div>

            {/* Core instructions */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left text-xs text-slate-300 max-w-md w-full leading-relaxed space-y-3 shadow-xl">
              <p className="font-semibold text-indigo-300 text-center font-mono uppercase pb-2 border-b border-slate-800">CƠ CHẾ ĐIỀU KHIỂN BÁNH XE:</p>
              
              <div className="flex gap-4 items-center justify-between">
                <span className="font-mono text-slate-400 font-bold flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-slate-800 text-white rounded border border-slate-700">◀</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-white rounded border border-slate-700">A</span>
                </span>
                <span className="text-white text-right font-medium">Đánh lái xoay bánh sang TRÁI (Left)</span>
              </div>
              
              <div className="flex gap-4 items-center justify-between">
                <span className="font-mono text-slate-400 font-bold flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-slate-800 text-white rounded border border-slate-700">▶</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-white rounded border border-slate-700">D</span>
                </span>
                <span className="text-white text-right font-medium">Đánh lái xoay bánh sang PHẢI (Right)</span>
              </div>

              <div className="flex gap-4 items-center justify-between border-t border-slate-850 pt-2 text-indigo-300 font-bold">
                <span>TIẾN KHÔNG XOAY, LÙI KHÔNG XOAY</span>
                <span className="text-amber-400 text-right text-[10px] font-mono">BÁNH TỰ ĐỘNG THẲNG ĐỨNG</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal italic pt-1 text-center">
                Mẫu xe sẽ tự động căn chỉnh bánh về vị trí cân bằng khi bạn chạy thẳng (Up) hoặc lùi thẳng (Down) mà không can thiệp phím điều hướng!
              </p>
            </div>

            {/* CTA action button */}
            <button
              id="btn-play-now"
              onClick={handleStartGame}
              className="group py-4 px-10 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-black tracking-widest text-sm rounded-xl cursor-pointer shadow-xl shadow-indigo-600/30 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>BẮT ĐẦU ĐUA NGAY!</span>
            </button>

            {/* Note on audio context */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Trò chơi sẽ phát tiếng động cơ rầm rú rực lửa ngay sau khi nhấn</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE THREE.JS WEBGL RENDER CANVAS */}
      <ThreeCanvas
        selectedCar={selectedCar}
        carColor={carColor}
        selectedTrack={selectedTrack}
        weather={customMapConfig.lockedWeather && customMapConfig.lockedWeather !== 'dynamic' ? customMapConfig.lockedWeather : weather}
        physicsConfig={physicsConfig}
        cameraMode={stats.activeCamera}
        resetCounter={resetCounter}
        isMuted={isMuted}
        onStatsChange={handleStatsChange}
        onCheckpoint={handleCheckpointEarned}
        onCollision={handleCollisionOccurred}
        isAccelerating={isAccelerating}
        isBraking={isBraking}
        steerLeft={steerLeft}
        steerRight={steerRight}
        customCarSpecs={customCarSpecs}
        damage={damage}
        onRepairTick={handleRepairTick}
        playerMode={playerMode}
        setPlayerMode={setPlayerMode}
        characterConfig={characterConfig}
        customMapConfig={customMapConfig}
        customLogoText={customLogoText}
      />

      {/* 3. DYNAMIC HUD DASHBOARD */}
      <Dashboard
        stats={stats}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onCameraChange={handleCameraChange}
        onReset={handleResetVehicle}
        keyboardState={keyboardState}
        damage={damage}
        onRepairManual={() => setDamage(0)}
        playerMode={playerMode}
        selectedTrack={selectedTrack}
        outOfRangeTime={outOfRangeTime}
        hideFloatingControls={isMasterFobOpen}
        onToggleMode={() => {
          if (playerMode === 'walking') {
            const wx = stats.walkerX ?? 0;
            const wz = stats.walkerZ ?? 0;
            const cx = stats.posX ?? 0;
            const cz = stats.posZ ?? 0;
            const dist = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
            if (dist > 6.0) {
              alertToast("⚠️ Bạn ở quá xa xe! Hãy đi bộ đến sát xe (dưới 6m) để mở cửa lên xe.");
              return;
            }
            if (isCarLocked) {
              alertToast("⚠️ Cửa xe dang khoá! Nhấn J hoặc dùng iPhone ảo để mở khoá xe trước.");
              return;
            }
          }
          setPlayerMode(p => p === 'driving' ? 'walking' : 'driving');
        }}
      />

      {/* 3.1 SUPER MASTER COLLAPSIBLE FLOATING HUD FOB PANEL BUTTON */}
      {isPlaying && !isMasterFobOpen && hasOpenedMasterFobOnce && (
        <button
          id="btn-master-fob-trigger"
          onClick={() => {
            setIsMasterFobOpen(true);
            setHasOpenedMasterFobOnce(true);
            soundEngine.playUnlockSound?.();
          }}
          className="fixed top-4 left-4 z-40 bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 border-2 border-cyan-500 shadow-2xl hover:shadow-cyan-500/25 p-3 rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-all text-white group"
          title="Mở Bảng Điều Khiển (HUD)"
        >
          <div className="relative">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 pr-1 select-none">
            HIỆN COCKPIT MULTI-HUB (🛠️)
          </span>
        </button>
      )}

      {/* 3.2 UNIFIED MASTER MULTI-FUNCTION HUD CONTAINER CARD (WHEN EXPANDED) */}
      {isPlaying && isMasterFobOpen && (
        <div 
          id="panel-master-multihud"
          className="fixed top-4 left-4 z-40 w-[350px] md:w-[380px] h-[92vh] max-h-[850px] flex flex-col gap-3 pointer-events-auto bg-slate-950/93 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-4 overflow-hidden text-white animate-in slide-in-from-left duration-300"
        >
          {/* HEADER SECTION */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
            <div className="flex items-center gap-2 text-cyan-400">
              <CircleDot className="w-5 h-5 animate-pulse text-cyan-400" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-black font-mono tracking-widest leading-none bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-300">
                  COCKPIT MULTI-HUB
                </span>
                <span className="text-[9px] font-mono text-slate-400 leading-none mt-1">HỆ THỐNG ĐIỀU KHIỂN CHUNG v2.1</span>
              </div>
            </div>

            {/* BUTTON TO HIDE INDIVIDUAL HUD DIV */}
            <button
              id="btn-master-fob-collapse"
              onClick={() => {
                setIsMasterFobOpen(false);
                soundEngine.playLockSound?.();
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-rose-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/50 rounded-lg text-[9px] font-mono font-bold tracking-wider transition-all duration-200 flex items-center gap-1 cursor-pointer select-none"
              title="Ẩn bảng điều khiển"
            >
              <X className="w-3.5 h-3.5 text-rose-500" />
              <span>ẨN BẢNG</span>
            </button>
          </div>

          {/* DYNAMIC REWARD METRICS ROW (CÔNG CỤ THÔNG SỐ) */}
          <div 
            id="stats-center-card" 
            className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3.5 py-2 text-white flex items-center justify-between shadow-md shrink-0"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col text-left">
                <span className="text-slate-400 text-[9px] font-mono uppercase tracking-wider leading-none">Sao ⭐</span>
                <span className="text-sm font-black font-mono text-amber-300 leading-none mt-1">{stats.score}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-400" />
              <div className="flex flex-col text-left">
                <span className="text-slate-400 text-[9px] font-mono uppercase tracking-wider leading-none">Cột mốc 💎</span>
                <span className="text-sm font-black font-mono text-teal-300 leading-none mt-1">{stats.currentCheckpoint}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div className="flex flex-col text-left">
                <span className="text-slate-400 text-[9px] font-mono uppercase tracking-wider leading-none font-mono">Thời gian</span>
                <span className="text-sm font-black font-mono text-cyan-300 leading-none mt-1">{stats.playTime}s</span>
              </div>
            </div>
          </div>

          {/* PRIMARY QUICK HUD ACTION BUTTONS (WALK, MUTE, RESET, SMART KEY) */}
          <div className="grid grid-cols-4 gap-2 border-b border-slate-900 pb-3 shrink-0">
            {/* Walk mode switch */}
            <button
              id="toggle-walk-mode"
              onClick={() => {
                if (playerMode === 'walking') {
                  const wx = stats.walkerX ?? 0;
                  const wz = stats.walkerZ ?? 0;
                  const cx = stats.posX ?? 0;
                  const cz = stats.posZ ?? 0;
                  const dist = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
                  if (dist > 6.0) {
                    alertToast("⚠️ Bạn ở quá xa xe! Hãy đi bộ đến sát xe (dưới 6m) để mở cửa lên xe.");
                    return;
                  }
                  if (isCarLocked) {
                    alertToast("⚠️ Cửa xe dang khoá! Nhấn J hoặc dùng iPhone ảo để mở khoá xe trước.");
                    return;
                  }
                }
                setPlayerMode(p => p === 'driving' ? 'walking' : 'driving');
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border font-mono text-[9px] font-bold transition-all duration-200 cursor-pointer ${
                playerMode === 'walking'
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-inner animate-pulse'
                  : 'bg-indigo-950/80 border-indigo-750 text-white hover:bg-indigo-900/60'
              }`}
              title="Đổi giữa Chế độ Lái xe & Đi bộ"
            >
              {playerMode === 'walking' ? (
                <>
                  <Car className="w-4 h-4 mb-0.5 text-slate-950" />
                  <span>LÊN XE (F)</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mb-0.5 text-indigo-400" />
                  <span>XUỐNG XE (F)</span>
                </>
              )}
            </button>

            {/* Toggle Mute Sound */}
            <button
              id="btn-toggle-mute"
              onClick={handleToggleMute}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border font-mono text-[9px] font-bold transition-all duration-200 cursor-pointer ${
                isMuted
                  ? 'bg-rose-950/85 border-rose-500 text-rose-400 shadow-inner'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 mb-0.5 text-rose-400" />
                  <span>MUTE SOUND</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mb-0.5 text-emerald-400" />
                  <span>BẬT TIẾNG</span>
                </>
              )}
            </button>

            {/* Reset Car Physics */}
            <button
              id="btn-reset-car"
              onClick={handleResetVehicle}
              className="flex flex-col items-center justify-center p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 rounded-xl font-mono text-[9px] font-bold transition-all duration-300 cursor-pointer"
              title="Khôi phục xe bị lật"
            >
              <RefreshCw className="w-4 h-4 mb-0.5 text-indigo-400" />
              <span>RESET XE</span>
            </button>

            {/* iOS virtual iPhone remote key trigger button */}
            <button
              id="btn-master-iphone-trigger"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('game-toggle-iphone'));
                setIsMasterFobOpen(false);
                soundEngine.playUnlockSound?.();
              }}
              className="flex flex-col items-center justify-center p-2 bg-gradient-to-tr from-slate-900 to-indigo-950 border border-cyan-800 text-cyan-300 hover:text-white hover:border-cyan-500 rounded-xl font-mono text-[9px] font-bold transition-all duration-300 cursor-pointer"
              title="Kích hoạt Smart Key iPhone 16 Pro"
            >
              <Phone className="w-4 h-4 mb-0.5 text-purple-400" />
              <span>IPHONE 16</span>
            </button>
          </div>

          {/* TAB CHUYỂN HOẠT ĐỘNG (NAV SELECTORS) */}
              <div className="flex gap-1 bg-slate-950/70 border border-slate-900 p-1 rounded-xl shrink-0">
                <button
                  id="btn-settings-toggle"
                  onClick={() => setMasterActiveTab('settings')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    masterActiveTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  TÙY BIẾN ĐUA
                </button>

                <button
                  onClick={() => setMasterActiveTab('keys')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    masterActiveTab === 'keys'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  PHÍM LÁI & TELE
                </button>
              </div>

              {/* DYNAMIC SCROLLABLE TAB CONTENT BODY */}
              <div className="flex-1 overflow-y-auto pr-0.5">
                {masterActiveTab === 'settings' && (
                  <div className="relative">
                    <ControlPanel
                      selectedCar={selectedCar}
                      onCarSelect={setSelectedCar}
                      carColor={carColor}
                      onColorSelect={setCarColor}
                      selectedTrack={selectedTrack}
                      onTrackSelect={setSelectedTrack}
                      weather={customMapConfig.lockedWeather && customMapConfig.lockedWeather !== 'dynamic' ? customMapConfig.lockedWeather : weather}
                      onWeatherSelect={setWeather}
                      physicsConfig={physicsConfig}
                      onPhysicsChange={setPhysicsConfig}
                      customCarSpecs={customCarSpecs}
                      onCustomCarSpecsChange={setCustomCarSpecs}
                      characterConfig={characterConfig}
                      onCharacterConfigChange={setCharacterConfig}
                      customMapConfig={customMapConfig}
                      onCustomMapConfigChange={setCustomMapConfig}
                      stats={stats}
                      damage={damage}
                      hideToggle={true}
                    />
                  </div>
                )}

                {masterActiveTab === 'keys' && (
                  <div className="flex flex-col gap-3.5 items-center justify-center py-2">
                    {/* Center: Live Keyboard Status Indicator showing key presses */}
                    <div id="hud-center-keys" className="w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 text-white flex flex-col gap-2 shadow-2xl select-none">
                      <span className="text-center font-mono text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Trạng thái Bánh xe & Phím</span>
                      
                      <div className="grid grid-cols-3 gap-1.5 w-44 mx-auto py-1">
                        <div />
                        
                        {/* UP Arrow (W) */}
                        <div className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                          keyboardState.w 
                            ? 'bg-indigo-600 border-indigo-400 text-white font-bold scale-95 shadow-md shadow-indigo-600/30' 
                            : 'bg-slate-850 border-slate-800 text-slate-500'
                        }`}>
                          <ArrowUp className="w-4 h-4 animate-pulse" />
                          <span className="text-[8px] font-mono mt-0.5 col-span-full">W</span>
                        </div>
                        
                        <div />

                        {/* LEFT Arrow (A) */}
                        <div className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                          keyboardState.a 
                            ? 'bg-emerald-600 border-emerald-400 text-white font-bold scale-95 shadow-md shadow-emerald-600/30' 
                            : 'bg-slate-850 border-slate-800 text-slate-500'
                        }`}>
                          <ArrowLeft className="w-4 h-4" />
                          <span className="text-[8px] font-mono mt-0.5">A</span>
                        </div>

                        {/* DOWN Arrow (S) */}
                        <div className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                          keyboardState.s 
                            ? 'bg-indigo-600 border-indigo-400 text-white font-bold scale-95 shadow-md shadow-indigo-600/30' 
                            : 'bg-slate-850 border-slate-800 text-slate-500'
                        }`}>
                          <ArrowDown className="w-4 h-4" />
                          <span className="text-[8px] font-mono mt-0.5">S</span>
                        </div>

                        {/* RIGHT Arrow (D) */}
                        <div className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                          keyboardState.d 
                            ? 'bg-emerald-600 border-emerald-450 text-white font-bold scale-95 shadow-md shadow-emerald-600/30' 
                            : 'bg-slate-850 border-slate-800 text-slate-500'
                        }`}>
                          <ArrowRight className="w-4 h-4" />
                          <span className="text-[8px] font-mono mt-0.5">D</span>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full mt-1.5 text-[9px] font-mono text-center">
                        <div className={`flex-1 py-1 rounded border border-dashed transition-all ${
                          keyboardState.space ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-bold scale-95' : 'border-slate-800 text-slate-500'
                        }`}>Phanh [Space]</div>
                        <div className={`flex-1 flex items-center justify-center py-1 rounded border border-dashed text-slate-400 border-slate-800`}>
                          {stats.speed !== 0 ? '🏎️ LĂN BÁNH' : '💤 DỪNG HẲN'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
        </div>
      )}

      {/* 4.5 VIRTUAL IPHONE 16 SMART KEY AND MAP CONTROLLER */}
      <IPhoneVirtual
        stats={stats}
        customMapConfig={customMapConfig}
        onCustomMapConfigChange={setCustomMapConfig}
        carColor={carColor}
        onColorSelect={setCarColor}
        isCarLocked={isCarLocked}
        setIsCarLocked={setIsCarLocked}
        playerMode={playerMode}
        setPlayerMode={setPlayerMode}
        customLogoText={customLogoText}
        setCustomLogoText={setCustomLogoText}
        damage={damage}
        setDamage={setDamage}
        selectedTrack={selectedTrack}
        onTrackSelect={setSelectedTrack}
        embedMode={true}
      />

      {/* Real-car advanced Central Cockpit and AI system mission auto-solver */}
      <VinCockpit
        stats={stats}
        damage={damage}
        setDamage={setDamage}
        playerMode={playerMode}
        setPlayerMode={setPlayerMode}
        isCarLocked={isCarLocked}
        setIsCarLocked={setIsCarLocked}
        carColor={carColor}
        onColorSelect={setCarColor}
      />

      {/* 4.6 CUSTOM NEON LOGO HEADER BAR OVERLAY */}
      {customLogoText && (
        <div 
          id="custom-hud-logo-override" 
          className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-30 bg-slate-950/85 border border-emerald-500/30 px-6 py-2 rounded-2xl shadow-xl shadow-emerald-500/10 flex items-center justify-center animate-pulse"
        >
          <span className="text-xs md:text-sm font-mono font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-200 to-indigo-300">
            🏎️ {customLogoText} ⚡
          </span>
        </div>
      )}

      {/* 4.8 METEOROLOGICAL RADAR SUB-MAP HUD OVERLAY - MOVED INSIDE VIRTUAL IPHONE 16 AS REQUESTED */}

      {/* 4.7 FLOATING IN-GAME NOTIFICATION TOAST OVERLAYS */}
      {toastMessage && (
        <div 
          id="custom-toast-notification"
          className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-55 animate-bounce"
        >
          <div className="bg-slate-900 border border-amber-500/50 text-slate-100 text-xs font-bold font-mono px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2">
            <span className="text-amber-400 shrink-0">🔔</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MINECRAFT-STYLE CHAT / COMMAND INPUT BOX AT BOTTOM-LEFT */}
      {isPlaying && isChatOpen && (
        <div 
          id="minecraft-console"
          className="absolute bottom-6 left-6 z-55 w-full max-w-[340px] flex flex-col gap-1.5 pointer-events-auto"
        >
          {/* Chat History Area (shown if chat is open) */}
          <div 
            className="bg-black/60 backdrop-blur-md rounded-lg p-3 max-h-[150px] overflow-y-auto flex flex-col gap-1 text-[10.5px] font-mono text-zinc-300 w-full select-text border border-zinc-700/25"
            style={{ scrollbarWidth: 'none' }}
          >
            {chatLogs.slice(-12).map((log, index) => (
              <div key={index} className="leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                {log}
              </div>
            ))}
          </div>

          {/* Input Bar (Minecraft GUI style) */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim()) {
                setChatLogs(prev => [...prev, `> ${chatInput}`]);
                processCommand(chatInput);
                setChatInput("");
              }
              setIsChatOpen(false);
            }}
            className="flex items-center gap-1 w-full bg-black/90 border border-zinc-600 p-1 rounded font-mono text-[11px] shadow-2xl"
          >
            <span className="text-zinc-400 pl-1.5 shrink-0 select-none">&gt;</span>
            <input 
              autoFocus
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsChatOpen(false);
                }
              }}
              placeholder="Nhập lệnh /help vào đây..." 
              className="bg-transparent text-white border-none outline-none flex-grow font-mono text-[11px] h-6 py-0.5 w-full focus:ring-0"
            />
          </form>
        </div>
      )}

      {/* 4.8 EXPLOSION RADIATION DANGER WARNER & FATAL DEATH SCREEN */}
      {isInjuredByExplosion && !hasDiedCompletely && (
        <div 
          id="explosion-radiation-warning-indicator"
          className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-rose-950/95 border border-red-500 text-rose-100 font-extrabold font-sans text-[11px] md:text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-pulse"
        >
          <span className="text-lg shrink-0">☢️</span>
          <span>
            CHẤN THƯƠNG XE NỔ (Khoảng cách: <b className="text-red-400 font-mono text-xs">{injuredDistance.toFixed(1)}m</b>): SẼ TỬ VONG SAU <b className="text-amber-400 underline font-mono text-xs">{secondsToDie} GIÂY VỆ TINH</b>!
          </span>
        </div>
      )}

      {hasDiedCompletely && (
        <div 
          id="fatal-death-blackout-screener"
          className="absolute inset-0 z-55 flex flex-col justify-center items-center bg-zinc-950/95 text-center p-6"
        >
          <div className="bg-red-950/30 border border-red-500/30 p-8 rounded-3xl flex flex-col items-center max-w-sm shadow-2xl shadow-red-500/10">
            <span className="text-5xl mb-4">💀</span>
            <h2 className="text-red-500 text-xl font-mono font-black uppercase tracking-widest leading-none">
              BẠN ĐÃ TỬ VONG
            </h2>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-3">
              Chịu tác động xung kích khổng lồ và sóng nhiệt của xe nổ ở cự ly dưới 10m! Các tế bào cơ thể đã phân rã hoàn toàn.
            </p>
            <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 mt-6 overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-amber-500"
                style={{
                  width: `${loaderWidth}%`,
                  transition: 'width 40ms linear'
                }}
              />
            </div>
            <span className="text-[9px] font-mono font-black text-rose-400 uppercase tracking-widest mt-3.5 animate-pulse">
              ĐANG KHỞI CHẠY LẠI THẾ GIỚI...
            </span>
          </div>
        </div>
      )}

      {/* 5. VISUAL FLASH SENSORS: CHECKPOINT GREEN & COLLISION RED GLOWS */}
      {checkpointFlash && (
        <div 
          id="flash-checkpoint" 
          className="absolute inset-0 z-30 pointer-events-none animate-fade-out flex items-center justify-center p-4 bg-emerald-500/15"
        >
          {/* Glowing reward pop */}
          <div className="bg-emerald-500 text-slate-950 font-black font-mono text-2xl md:text-3xl px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
            <Sparkles className="w-7 h-7" />
            +1500 PTS!!
          </div>
        </div>
      )}

      {collisionFlash && (
        <div 
          id="flash-collision" 
          className="absolute inset-0 z-30 pointer-events-none animate-fade-out border-[15px] border-rose-600/50 bg-rose-600/10 flex items-center justify-center"
        >
          {/* Collision warning flash details */}
          <div className="bg-rose-950/90 text-rose-300 border border-rose-500/50 font-black font-mono text-sm px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            COLLISION VA CHẠM! XE NẨY LÊN
          </div>
        </div>
      )}

      {/* 6. TOUCH ON-SCREEN CONTROLS DECK (For Tablet, Mobile and Iframe preview convenience) */}
      <div 
        id="onscreen-touch-controls" 
        className="absolute bottom-4 right-4 md:right-auto md:left-[350px] lg:left-[380px] pointer-events-auto z-20 flex gap-4 select-none"
      >
        {/* Steering Left/Right Deck */}
        <div className="flex gap-2">
          {/* STEER LEFT touchscreen */}
          <button
            id="touch-steer-left"
            onTouchStart={() => { setSteerLeft(true); setKeyboardState(p => ({ ...p, a: true })); }}
            onTouchEnd={() => { setSteerLeft(false); setKeyboardState(p => ({ ...p, a: false })); }}
            onMouseDown={() => { setSteerLeft(true); setKeyboardState(p => ({ ...p, a: true })); }}
            onMouseUp={() => { setSteerLeft(false); setKeyboardState(p => ({ ...p, a: false })); }}
            onMouseLeave={() => { setSteerLeft(false); setKeyboardState(p => ({ ...p, a: false })); }}
            className={`w-14 h-14 rounded-full border flex items-center justify-center active:scale-95 transition-all text-white ${
              steerLeft 
                ? 'bg-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/30' 
                : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
            }`}
            title="Xoay Trái Bánh xe"
          >
            <span className="text-xl font-black">◀</span>
          </button>

          {/* STEER RIGHT touchscreen */}
          <button
            id="touch-steer-right"
            onTouchStart={() => { setSteerRight(true); setKeyboardState(p => ({ ...p, d: true })); }}
            onTouchEnd={() => { setSteerRight(false); setKeyboardState(p => ({ ...p, d: false })); }}
            onMouseDown={() => { setSteerRight(true); setKeyboardState(p => ({ ...p, d: true })); }}
            onMouseUp={() => { setSteerRight(false); setKeyboardState(p => ({ ...p, d: false })); }}
            onMouseLeave={() => { setSteerRight(false); setKeyboardState(p => ({ ...p, d: false })); }}
            className={`w-14 h-14 rounded-full border flex items-center justify-center active:scale-95 transition-all text-white ${
              steerRight 
                ? 'bg-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/30' 
                : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
            }`}
            title="Xoay Phải Bánh xe"
          >
            <span className="text-xl font-black">▶</span>
          </button>
        </div>

        {/* Accelerate / Brake Touch controls */}
        <div className="flex gap-2 border-l border-slate-800 pl-4">
          {/* TOUCH ACCELERATE */}
          <button
            id="touch-accelerate"
            onTouchStart={() => { setIsAccelerating(true); setKeyboardState(p => ({ ...p, w: true })); }}
            onTouchEnd={() => { setIsAccelerating(false); setKeyboardState(p => ({ ...p, w: false })); }}
            onMouseDown={() => { setIsAccelerating(true); setKeyboardState(p => ({ ...p, w: true })); }}
            onMouseUp={() => { setIsAccelerating(false); setKeyboardState(p => ({ ...p, w: false })); }}
            onMouseLeave={() => { setIsAccelerating(false); setKeyboardState(p => ({ ...p, w: false })); }}
            className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center active:scale-95 transition-all text-white ${
              isAccelerating 
                ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/35' 
                : 'bg-slate-900/80 border-slate-700'
            }`}
            title="Nhấn ga tiến"
          >
            <span className="text-lg font-bold">▲</span>
            <span className="text-[8px] font-mono">GA</span>
          </button>

          {/* TOUCH BRAKE REVERSE */}
          <button
            id="touch-brake-reverse"
            onTouchStart={() => { setIsBraking(true); setKeyboardState(p => ({ ...p, s: true })); }}
            onTouchEnd={() => { setIsBraking(false); setKeyboardState(p => ({ ...p, s: false })); }}
            onMouseDown={() => { setIsBraking(true); setKeyboardState(p => ({ ...p, s: true })); }}
            onMouseUp={() => { setIsBraking(false); setKeyboardState(p => ({ ...p, s: false })); }}
            onMouseLeave={() => { setIsBraking(false); setKeyboardState(p => ({ ...p, s: false })); }}
            className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center active:scale-95 transition-all text-white ${
              isBraking 
                ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/35' 
                : 'bg-slate-900/80 border-slate-700'
            }`}
            title="Nhấn phanh lùi"
          >
            <span className="text-lg font-bold">▼</span>
            <span className="text-[8px] font-mono">PHANH</span>
          </button>
        </div>
      </div>

    </div>
  );
}
