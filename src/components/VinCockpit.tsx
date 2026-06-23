import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Music, Compass, Wind, Lightbulb, Bell, Key, Zap, Flame, BarChart2,
  Lock, Unlock, ShieldAlert, Volume2, VolumeX, AlertTriangle, Play, Pause,
  ChevronRight, ArrowRight, CheckCircle2, RotateCcw, Award, Radio, RefreshCw
} from 'lucide-react';
import { soundEngine } from '../utils/AudioEngine';

interface VinCockpitProps {
  stats: any;
  damage: number;
  setDamage: (dmg: number) => void;
  playerMode: 'driving' | 'walking';
  setPlayerMode: (mode: 'driving' | 'walking') => void;
  isCarLocked: boolean;
  setIsCarLocked: (locked: boolean) => void;
  carColor: string;
  onColorSelect: (color: string) => void;
  embedded?: boolean;
}

interface Mission {
  id: string;
  title: string;
  desc: string;
  condition: string;
  rewardMoney: number;
  rewardItem: string;
  completed: boolean;
  type: 'speed' | 'collect' | 'drift' | 'refuel';
}

export function VinCockpit({
  stats,
  damage,
  setDamage,
  playerMode,
  setPlayerMode,
  isCarLocked,
  setIsCarLocked,
  carColor,
  onColorSelect,
  embedded = false,
}: VinCockpitProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai_guide' | 'car_control' | 'climate' | 'fm_radio' | 'keyfob'>('ai_guide');
  
  // Real-car local states
  const [acTemp, setAcTemp] = useState(21.5);
  const [acFan, setAcFan] = useState(2);
  const [acMode, setAcMode] = useState<'auto' | 'eco' | 'max_frost' | 'defog'>('auto');
  const [selectedRadio, setSelectedRadio] = useState<number>(0);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [hornType, setHornType] = useState<'standard' | 'twin_trumpet' | 'super_siren'>('standard');
  const [epbEngaged, setEpbEngaged] = useState(false); // Electronic Parking Brake
  const [isFollowingOwnerLocal, setIsFollowingOwnerLocal] = useState(false);
  
  // Audio synthesizer ref to generate cockpit sounds (horn, indicator, radio click, alarm, engine startup)
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sync bank balance with localStorage
  const [bankBalance, setBankBalance] = useState<number>(() => {
    return Number(localStorage.getItem('vb_bank_balance') || '35000');
  });

  // Local mission database (proc-generated to 1000+ missions!)
  const [missions, setMissions] = useState<Mission[]>(() => {
    const saved = localStorage.getItem('vin_ai_missions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length >= 1000) {
          return parsed;
        }
      } catch (e) {}
    }
    const baseList: Mission[] = [
      {
        id: 'ms-1',
        title: 'Thử thách Siêu Tốc Độ 120km/h 🎯',
        desc: 'Đăng ký hệ thống AI khởi chạy tăng ga cực đại vượt ngưỡng rào cản âm thanh 120km/h.',
        condition: 'Yêu cầu tốc độ đạt > 120 km/h',
        rewardMoney: 15000,
        rewardItem: 'Hộp Sửa Xe Nano Khẩn Cấp',
        completed: false,
        type: 'speed'
      },
      {
        id: 'ms-2',
        title: 'Hút Kim Cương Không Gian 💎',
        desc: 'AI mở lá chắn từ trường dịch chuyển tức thời thu thập tinh hoa kim cương về ví.',
        condition: 'Ăn thêm +1 Diamond quý giá',
        rewardMoney: 20000,
        rewardItem: 'Bình Xăng Dự Phòng 35L',
        completed: false,
        type: 'collect'
      },
      {
        id: 'ms-3',
        title: 'Nghệ Thuật Drift Siêu Đẳng 🌟',
        desc: 'Hệ thống tự động lái AI bẻ góc cua lật nghiêng lướt lốp xe tạo 3.0 giây drift cháy đường.',
        condition: 'Thực hiện động tác Drift lốp khói bụi',
        rewardMoney: 35000,
        rewardItem: 'Sao Checkpoint (Star)',
        completed: false,
        type: 'drift'
      },
      {
        id: 'ms-4',
        title: 'Hồi Sức Sửa Xe Đa Tầng ⚡',
        desc: 'Hệ thống AI chuẩn đoán hỏng hóc, xịt nano khôi phục kết tủa sắt về 100% nguyên trạng.',
        condition: 'Đưa độ hao hại xe về mức lành lặn 0%',
        rewardMoney: 12000,
        rewardItem: 'Can Xăng Hoàn Hảo',
        completed: false,
        type: 'refuel'
      }
    ];

    const types: ('speed' | 'collect' | 'drift' | 'refuel')[] = ['speed', 'collect', 'drift', 'refuel'];
    const rewardItems = ['Hộp Sửa Xe Nano Khẩn Cấp', 'Bình Xăng Dự Phòng 35L', 'Sao Checkpoint (Star)', 'Can Xăng Hoàn Hảo', 'Bộ Phanh Thể Thao ABS', 'Pin Lithium Polymer Mới', 'Xịt Sơn Phản Quang 4D', 'Đuôi Gió Carbon Cánh Hông'];
    
    for (let i = 5; i <= 1001; i++) {
      const type = types[i % types.length];
      let title = '';
      let desc = '';
      let condition = '';
      let rewardMoney = 10000 + (i * 25);
      let rewardItem = rewardItems[i % rewardItems.length];
      
      if (type === 'speed') {
        const targetSpeed = 80 + (i % 80);
        title = `Nhiệm vụ #${i}: Đột Phá Giới Hạn ${targetSpeed}km/h 🏎️`;
        desc = `Lái siêu xe vượt qua bài tập thử thách lực cản không khí ở dải vận tốc ${targetSpeed} km/h cực đại.`;
        condition = `Đạt vận tốc xe lớn hơn ${targetSpeed} km/h`;
      } else if (type === 'collect') {
        title = `Nhiệm vụ #${i}: Săn Kim Cương Thần Bí #${i} 💎`;
        desc = `Dò quét và thu thập các tinh thể kim cương quý giá hoặc tinh thạch rơi rải rác ngoài không gian địa hình.`;
        condition = `Tìm kiếm tối thiểu 1 cổ vật thần bí`;
      } else if (type === 'drift') {
        title = `Nhiệm vụ #${i}: Quái Kiệt Drift Bo Cua Phân Khu #${i} 🌀`;
        desc = `Gạt phanh khẩn cấp rít lốp bốc khói tạo tư thế lái trượt bánh hoàn hảo đầy chuyên nghiệp.`;
        condition = `Đạt trạng thái drift bánh khói xe`;
      } else {
        title = `Nhiệm vụ #${i}: Trạm Bảo Hành Di Động RemodeXC #${i} 🛡️`;
        desc = `Hệ sinh thái tự lái AI chuẩn đoán đo lường lượng hao pin, xịt keo tự phục hồi vỏ bọc.`;
        condition = `Hồi máu xe hoặc đổ đầy nhiên liệu`;
      }
      
      baseList.push({
        id: `ms-${i}`,
        title,
        desc,
        condition,
        rewardMoney,
        rewardItem,
        completed: false,
        type
      });
    }
    return baseList;
  });

  // Radio channels definition
  const channels = [
    { name: '👉 VOV Giao Thông FM', freq: '91.0 MHz', genre: 'Tin tức & Kẹt xe Hà Nội', soundHz: 120 },
    { name: '👉 XoneFM Đỉnh Cao', freq: '102.7 MHz', genre: 'Nhạc trẻ REMIX Vinahouse bốc lửa', soundHz: 280 },
    { name: '👉 VinFast Premium Beats', freq: '88.5 MHz', genre: 'Chillout Lo-Fi phiêu bồng vũ trụ', soundHz: 180 },
    { name: '👉 Retro FM 80s', freq: '95.5 MHz', genre: 'Synthwave hoài niệm Neon điện tử', soundHz: 220 },
  ];

  // AI automation running states
  const [aiRunningId, setAiRunningId] = useState<string | null>(null);
  const [aiLog, setAiLog] = useState<string[]>(['Hệ thống AI Co-pilot sẵn sàng nhận chỉ đạo!']);
  const [panicAlarmActive, setPanicAlarmActive] = useState(false);

  // Blinkers interval simulated visual status
  const [blinkerState, setBlinkerState] = useState<'none' | 'left' | 'right' | 'hazard'>('none');
  const blinkerTimerRef = useRef<any>(null);

  // Visible count for 1000 missions to keep rendering high-performance!
  const [visibleCount, setVisibleCount] = useState<number>(10);

  useEffect(() => {
    localStorage.setItem('vin_ai_missions', JSON.stringify(missions));
  }, [missions]);

  // Handle toggle cockpit event from IPhone 16
  useEffect(() => {
    const handleToggleCockpit = () => {
      setIsOpen(p => !p);
      playBeep(1000, 100);
    };
    window.addEventListener('game-toggle-vincockpit', handleToggleCockpit);
    return () => {
      window.removeEventListener('game-toggle-vincockpit', handleToggleCockpit);
    };
  }, []);

  // Synchronize bank balance from localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setBankBalance(Number(localStorage.getItem('vb_bank_balance') || '35000'));
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const addLog = (text: string) => {
    setAiLog(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev.slice(0, 15)]);
  };

  // Web Audio helpers
  const playBeep = (freqHz: number, durationMs: number = 200, type: OscillatorType = 'sine', volume: number = 0.15) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freqHz, ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn("Audio beeper error", e);
    }
  };

  // Perform horn
  const triggerHorn = () => {
    if (hornType === 'standard') {
      playBeep(440, 350, 'triangle', 0.25);
      setTimeout(() => playBeep(440, 350, 'triangle', 0.25), 80);
    } else if (hornType === 'twin_trumpet') {
      playBeep(330, 400, 'square', 0.12);
      playBeep(440, 400, 'square', 0.12);
    } else {
      // Siren cycle
      playBeep(580, 200, 'sawtooth', 0.1);
      setTimeout(() => playBeep(880, 200, 'sawtooth', 0.1), 200);
      setTimeout(() => playBeep(1100, 250, 'sawtooth', 0.08), 400);
    }
    addLog(`📢 Đã bấm còi cảnh báo (${hornType})`);
    
    // Alert event trigger
    window.dispatchEvent(new CustomEvent('alert-toast', {
      detail: { text: "🔊 BÍP BÍP! Đã bóp còi xe VinFast!" }
    }));
  };

  // Emergency Alarm sound sequence
  useEffect(() => {
    let alarmInterval: any;
    if (panicAlarmActive) {
      addLog("🚨 KÍCH HOẠT HỆ THỐNG PHÒNG THỦ & CẢNH BÁO KHẨN CẤP!");
      window.dispatchEvent(new CustomEvent('alert-toast', {
        detail: { text: "🚨 KHẨN CẤP: XE ĐANG BÁO ĐỘNG HÚ CÒI IN ỎI!" }
      }));
      
      let count = 0;
      alarmInterval = setInterval(() => {
        playBeep(count % 2 === 0 ? 880 : 1200, 250, 'sawtooth', 0.15);
        count++;
        // Toggle turn lights visually
        window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 0.5 } }));
        if (count > 20) {
          setPanicAlarmActive(false);
        }
      }, 350);
    }
    return () => clearInterval(alarmInterval);
  }, [panicAlarmActive]);

  // Handle Turn Indicators clicking loop
  const handleToggleIndicator = (mode: 'left' | 'right' | 'hazard' | 'none') => {
    if (blinkerTimerRef.current) {
      clearInterval(blinkerTimerRef.current);
    }
    
    setBlinkerState(mode);
    if (mode === 'none') {
      addLog("💡 Đã tắt toàn bộ đèn tín hiệu rẽ.");
      return;
    }

    addLog(`💡 Thiết lập đèn xi-nhan: ${mode.toUpperCase()}`);
    // Click sound and webapp alert
    blinkerTimerRef.current = setInterval(() => {
      // play click tone
      playBeep(1500, 40, 'sine', 0.08);
    }, 450);

    // Toast alert
    window.dispatchEvent(new CustomEvent('alert-toast', {
      detail: { text: `⚡ Đèn xi nhan [${mode.toUpperCase()}] đang hoạt động!` }
    }));
  };

  // Play FM background synthesizer sound
  useEffect(() => {
    let loopCh: any;
    if (isRadioPlaying) {
      const freqHz = channels[selectedRadio].soundHz;
      addLog(`📻 Đang phát kênh FM: ${channels[selectedRadio].name} (${channels[selectedRadio].freq})`);
      loopCh = setInterval(() => {
        // play small music scale
        const notes = [freqHz, freqHz * 1.25, freqHz * 1.5, freqHz * 1.8];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        playBeep(randomNote, 150, 'sine', 0.05);
      }, 500);
    }
    return () => clearInterval(loopCh);
  }, [isRadioPlaying, selectedRadio]);

  // AI Task automations implementation
  const triggerAiCompleteMission = (missionId: string) => {
    if (aiRunningId) {
      window.dispatchEvent(new CustomEvent('alert-toast', {
        detail: { text: "⚠️ Hệ thống AI đang xử lý nhiệm vụ khác! Vui lòng chờ." }
      }));
      return;
    }

    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    if (mission.completed) {
      window.dispatchEvent(new CustomEvent('alert-toast', {
        detail: { text: "✅ Nhiệm vụ này đã được AI giải quyết xong rồi!" }
      }));
      return;
    }

    // Set engine on before action
    window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: true } }));

    setAiRunningId(missionId);
    addLog(`🤖 KHỞI CHẠY AI HỆ THỐNG: [${mission.title}]`);
    addLog(`⚙️ Tiến trình: Đang thiết lập kênh rà quét và tự động định vị phương tiện...`);

    let steps = 0;
    const maxSteps = 4;
    
    const interval = setInterval(() => {
      steps++;
      if (steps === 1) {
        addLog(`⚡ [AI ANTIMATTER-DRIVE] Nạp phân rã hạt phản lực Nitro để thúc đẩy tốc độ...`);
        playBeep(400, 300, 'sawtooth', 0.1);
        playBeep(600, 300, 'sawtooth', 0.1);
        
        if (mission.type === 'speed') {
          // Push car forward using game-set-speed event
          window.dispatchEvent(new CustomEvent('game-set-speed', { detail: { speed: 45.0 } })); // 45m/s = ~162km/h!
          addLog(`🚀 [AI SPEED-RUN] Đã ép tốc độ xe bùng nổ lên 162 km/h vượt mốc thử thách!`);
        } else if (mission.type === 'collect') {
          // Teleport near active starry check coordinates or give gold
          window.dispatchEvent(new CustomEvent('game-tp', { detail: { x: stats.posX || 0, z: (stats.posZ || 0) + 10 } }));
          addLog(`✨ [AI QUANTUM-GPS] Dịch chuyển hạt lượng tử hút Diamond Checkpoint thành công!`);
        } else if (mission.type === 'drift') {
          // Trigger speed spin drift
          window.dispatchEvent(new CustomEvent('game-set-speed', { detail: { speed: 28.0 } }));
          addLog(`🛞 [AI DRIFT-STABILIZER] Drift trượt lốp vòng tròn vẽ ngọn lửa xanh mặt đường!`);
        } else if (mission.type === 'refuel') {
          // Reset vehicle damage to 0
          setDamage(0);
          window.dispatchEvent(new CustomEvent('game-refuel', { detail: { amount: 100 } }));
          addLog(`🔧 [AI NANO-BOTS] Đã kích hoạt robot sửa chữa thu phục xe lành lặn 100%!`);
        }
      } else if (steps === 2) {
        addLog(`📡 [AI CONSOLE] Phân tích trạng thái vật lý đường đua... Hoàn tất 78%...`);
        playBeep(880, 100, 'sine', 0.08);
      } else if (steps === 3) {
        addLog(`💎 AI đã định dạng thành phẩm! Phê duyệt giao diện ngân hàng MB nhận chuyển khoản...`);
        playBeep(1200, 150, 'sine', 0.12);
      } else if (steps === maxSteps) {
        clearInterval(interval);
        
        // Grant rewards
        const currentBalance = Number(localStorage.getItem('vb_bank_balance') || '35000');
        const nextBalance = currentBalance + mission.rewardMoney;
        localStorage.setItem('vb_bank_balance', String(nextBalance));
        setBankBalance(nextBalance);

        // Add reward item to backpack inventory if exists
        try {
          const backpackStr = localStorage.getItem('vb_backpack_inventory');
          if (backpackStr) {
            const bp = JSON.parse(backpackStr);
            // Increment fitting item
            if (mission.type === 'refuel') {
              const item = bp.find((x: any) => x.type === 'repair');
              if (item) item.qty += 2;
            } else {
              const item = bp.find((x: any) => x.type === 'gas');
              if (item) item.qty += 2;
            }
            localStorage.setItem('vb_backpack_inventory', JSON.stringify(bp));
          }
        } catch (e) {}

        // Mark completed
        setMissions(prev => prev.map(m => m.id === missionId ? { ...m, completed: true } : m));
        setAiRunningId(null);
        
        addLog(`🎉 HOÀN THÀNH XUẤT SẮC: +${mission.rewardMoney.toLocaleString()}đ và quà độc quyền trong Balo!`);
        playBeep(1500, 450, 'sine', 0.18);
        
        window.dispatchEvent(new CustomEvent('alert-toast', {
          detail: { text: `🏆 AI HOÀN THÀNH: +${mission.rewardMoney.toLocaleString()}đ MB Bank từ [${mission.title}]!` }
        }));
      }
    }, 1500);
  };

  if (embedded) {
    return (
      <div className="flex-1 flex flex-col min-h-0 text-slate-100 select-none font-sans overflow-hidden bg-slate-950">
        {/* REMODEXC LIVE TELEMETRY BAR (RemodeXC Exclusive) */}
        <div className="bg-slate-950 px-2 py-1.5 border-b border-cyan-500/20 flex items-center justify-between shrink-0 font-mono text-[9px] gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-cyan-400 font-extrabold tracking-wider text-[9.5px] truncate">RemodeXC 5G LINK</span>
              <span className="text-slate-500 text-[6.5px] tracking-tight uppercase">Connected: 94ms OK</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 select-text">
            <div className="text-right flex flex-col">
              <span className="text-cyan-200 font-bold tracking-tight">{Math.abs(Math.round((stats.speed ?? 0) * 3.6))} km/h</span>
              <span className="text-slate-500 text-[6.5px]">GEAR: {stats.gear || 'P'}</span>
            </div>
            <div className="w-px h-5.5 bg-slate-800" />
            <div className="text-right flex flex-col">
              <span className="text-indigo-400 font-bold">BAT: 94%</span>
              <span className="text-slate-500 text-[6.5px]">TEMP: 21°C</span>
            </div>
          </div>
        </div>

        {/* APPLICATION CATEGORY TABS */}
        <div className="grid grid-cols-5 gap-0.5 bg-slate-900/60 p-1 border-b border-slate-800 text-[9px] uppercase font-bold shrink-0">
          <button
            onClick={() => { setActiveTab('ai_guide'); playBeep(900, 30); }}
            className={`py-1 text-center rounded transition-colors ${activeTab === 'ai_guide' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
          >
            🤖 AI
          </button>
          <button
            onClick={() => { setActiveTab('car_control'); playBeep(900, 30); }}
            className={`py-1 text-center rounded transition-colors ${activeTab === 'car_control' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
          >
            🎛️ Cơ
          </button>
          <button
            onClick={() => { setActiveTab('climate'); playBeep(900, 30); }}
            className={`py-1 text-center rounded transition-colors ${activeTab === 'climate' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
          >
            ❄️ AC
          </button>
          <button
            onClick={() => { setActiveTab('fm_radio'); playBeep(900, 30); }}
            className={`py-1 text-center rounded transition-colors ${activeTab === 'fm_radio' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
          >
            📻 Audio
          </button>
          <button
            onClick={() => { setActiveTab('keyfob'); playBeep(900, 30); }}
            className={`py-1 text-center rounded transition-colors ${activeTab === 'keyfob' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
          >
            🔑 Fob
          </button>
        </div>

        {/* BODY SCREEN CONTENT */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 bg-slate-950 pr-1 select-text">
          {/* VIEW 1: AI MISSION SYSTEM AUTOMATION SOLVER */}
          {activeTab === 'ai_guide' && (
            <div className="flex-grow flex flex-col gap-2.5">
              <div className="bg-indigo-950/45 border border-indigo-500/20 p-2.5 rounded-xl flex flex-col gap-1 text-[10px] text-indigo-200">
                <div className="flex items-center gap-1 text-indigo-400 font-extrabold tracking-wide uppercase">
                  <Compass className="w-3.5 h-3.5 text-indigo-300 animate-spin" />
                  <span>TRỢ LÝ AUTOMATIC ĐA NHIỆM:</span>
                </div>
                <p className="text-[9.5px] leading-relaxed text-slate-300 font-sans">
                  Trợ lý AI hệ thống quét định vị bản đồ và tự động kích hoạt ga, nitro tăng cường để hoàn thành thử thách rinh thưởng lớn!
                </p>
              </div>

              {/* CURRENT LIST OF TASKS WITH ACTIONS BUTTON */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">MỤC TIÊU PHƯƠNG TIỆN ĐANG CHẠY:</span>
                
                {missions.slice(0, visibleCount).map((m) => (
                  <div key={m.id} className="p-2.5 bg-slate-900 border border-slate-850 rounded-xl flex flex-col gap-1.5 hover:border-slate-800 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-[11px] text-white tracking-tight leading-snug flex items-center gap-1">
                          {m.completed ? '🎉' : '🎯'} {m.title}
                        </span>
                        <span className="text-[9.5px] text-slate-400 mt-0.5 leading-tight">{m.desc}</span>
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-slate-800" />
                    
                    <div className="flex justify-between items-center text-[9.5px] font-mono mt-0.5">
                      <div className="flex flex-col text-slate-400 leading-tight">
                        <span>Quà: <b className="text-amber-400">{m.rewardMoney.toLocaleString()}đ</b></span>
                        <span className="truncate max-w-[120px]" title={m.condition}>ĐK: <b className="text-purple-400">{m.condition}</b></span>
                      </div>

                      {m.completed ? (
                        <span className="flex items-center gap-1 font-bold text-emerald-450 bg-emerald-950 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[8.5px]">
                          XONG
                        </span>
                      ) : (
                        <button
                          disabled={!!aiRunningId}
                          onClick={() => triggerAiCompleteMission(m.id)}
                          className={`px-2 py-1 rounded border font-bold font-sans text-[8.5px] flex items-center justify-center gap-0.5 transition-all flex-grow-0 cursor-pointer ${
                            aiRunningId === m.id
                              ? 'bg-amber-600 border-amber-400 text-white animate-pulse'
                              : 'bg-gradient-to-r from-emerald-600 to-indigo-600 border-indigo-400 text-white'
                          }`}
                        >
                          <Cpu className="w-2.5 h-2.5 text-white" />
                          <span>{aiRunningId === m.id ? 'AI...' : 'CHẠY AI'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {visibleCount < missions.length && (
                  <button
                    onClick={() => setVisibleCount(prev => Math.min(missions.length, prev + 15))}
                    className="w-full mt-1.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[9.5px] font-mono tracking-tight transition-all cursor-pointer text-center"
                  >
                    🔍 XEM THÊM NHIỆM VỤ (+15/{missions.length - visibleCount} CÒN LẠI)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: REAL VEHICLE MECHANICAL BUTTONS (Nỏ máy, đèn pha, xi nhan) */}
          {activeTab === 'car_control' && (
            <div className="flex flex-col gap-3 text-left">
              {/* REMOTE AUTO FOLLOW TO OWNER */}
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-1.5 text-[11px]">
                <div className="flex justify-between items-center bg-slate-950/20 p-1.5 rounded-lg border border-indigo-500/10">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-[10.5px] text-white uppercase tracking-tight flex items-center gap-1">
                      🎯 Tự Lái Tìm Chủ Nhân
                    </span>
                    <span className="text-[8.5px] text-slate-300">
                      Bám sát chủ xe trong tầm bán kính 1.5m
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      playBeep(800, 150);
                      if (playerMode === 'driving') {
                        window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "⚠️ Bạn đang ở trong xe! Hãy xuống xe đi bộ để kích hoạt chế độ tự lái tìm chủ." } }));
                        return;
                      }
                      const nextState = !isFollowingOwnerLocal;
                      setIsFollowingOwnerLocal(nextState);
                      if (nextState) {
                        window.dispatchEvent(new CustomEvent('game-start-follow-owner'));
                      } else {
                        window.dispatchEvent(new CustomEvent('game-stop-follow-owner'));
                      }
                    }}
                    className={`px-3 py-1 text-[9.5px] font-bold rounded border cursor-pointer transition-colors ${
                      isFollowingOwnerLocal
                        ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isFollowingOwnerLocal ? 'ĐANG BẬT' : 'BẬT THEO'}
                  </button>
                </div>
              </div>

              {/* VIRTUAL DRIVE REMOTE CONTROLLER */}
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-2">
                <span className="text-[9px] font-extrabold text-indigo-300 uppercase tracking-widest font-mono">
                  🎮 BỘ VIỄN THÔNG DI CHUYỂN TỪ XA:
                </span>
                
                <div className="flex flex-col items-center gap-1.5 py-1">
                  {/* Forward button */}
                  <button
                    onMouseDown={() => {
                      playBeep(650, 40);
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'forward' } }));
                    }}
                    onMouseUp={() => {
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      playBeep(650, 40);
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'forward' } }));
                    }}
                    onTouchEnd={() => {
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                    }}
                    className="w-10 h-10 bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer font-bold"
                  >
                    ⬆️
                  </button>

                  <div className="flex gap-4">
                    {/* Steer left button */}
                    <button
                      onMouseDown={() => {
                        playBeep(600, 40);
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'left' } }));
                      }}
                      onMouseUp={() => {
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        playBeep(600, 40);
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'left' } }));
                      }}
                      onTouchEnd={() => {
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                      }}
                      className="w-10 h-10 bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer font-bold"
                    >
                      ⬅️
                    </button>

                    {/* Brake / Cancel follow button */}
                    <button
                      onClick={() => {
                        playBeep(120, 100);
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                        window.dispatchEvent(new CustomEvent('game-ai-cancel-drive'));
                        setIsFollowingOwnerLocal(false);
                        window.dispatchEvent(new CustomEvent('game-stop-follow-owner'));
                      }}
                      className="w-10 h-10 bg-rose-950/60 border border-rose-900/40 hover:border-rose-500 rounded-xl flex items-center justify-center text-rose-300 active:scale-90 transition-transform cursor-pointer font-bold text-[9px] uppercase tracking-tighter"
                      title="Phanh dừng xe khẩn cấp"
                    >
                      STOP
                    </button>

                    {/* Steer right button */}
                    <button
                      onMouseDown={() => {
                        playBeep(600, 40);
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'right' } }));
                      }}
                      onMouseUp={() => {
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        playBeep(600, 40);
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'right' } }));
                      }}
                      onTouchEnd={() => {
                        window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                      }}
                      className="w-10 h-10 bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer font-bold"
                    >
                      ➡️
                    </button>
                  </div>

                  {/* Reverse button */}
                  <button
                    onMouseDown={() => {
                      playBeep(550, 40);
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'reverse' } }));
                    }}
                    onMouseUp={() => {
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      playBeep(550, 40);
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'reverse' } }));
                    }}
                    onTouchEnd={() => {
                      window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                    }}
                    className="w-10 h-10 bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer font-bold"
                  >
                    ⬇️
                  </button>
                </div>
                <p className="text-[8px] text-zinc-400 text-center leading-relaxed font-sans px-1 bg-slate-950/40 py-1 rounded">
                  💡 Nhấn giữ đè nút mũi tên để tự do di chuyển lái xe từ xa tinh tế! Hoặc nhấn STOP để khựng xe lại.
                </p>
              </div>

              {/* CIRCULAR ENGINE IGNITION BUTTON */}
              <div className="flex flex-col items-center py-2 bg-slate-900 border border-slate-850 rounded-xl gap-1">
                <button
                  onClick={() => {
                    playBeep(220, 150, 'sawtooth', 0.2);
                    window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { toggle: true } }));
                  }}
                  className="w-12 h-12 rounded-full bg-slate-950 border-4 border-red-500 hover:border-red-400 shadow-xl flex flex-col justify-center items-center gap-0.5 group active:scale-95 transition-transform cursor-pointer"
                  style={{ boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)' }}
                >
                  <span className="text-[7px] font-black uppercase text-red-500 tracking-wider">ENGINE</span>
                  <Zap className="w-3.5 h-3.5 text-red-500" />
                </button>
                <span className="text-[8.5px] font-semibold text-slate-400 text-center px-1">Đề nổ từ xa kích hoạt động cơ!</span>
              </div>

              {/* ELECTRONIC PARKING BRAKE BUTTON */}
              <div className="bg-slate-900 border border-slate-850 p-2 rounded-xl flex items-center justify-between text-[11px]">
                <div className="flex flex-col">
                  <span className="font-bold text-white">🔏 PHANH TAY ĐIỆN TỬ (EPB)</span>
                  <span className="text-[9px] text-slate-400">Khóa cứng bánh xe</span>
                </div>
                <button
                  onClick={() => {
                    setEpbEngaged(!epbEngaged);
                    playBeep(600, 300, 'sine', 0.1);
                    if (!epbEngaged) {
                      window.dispatchEvent(new CustomEvent('game-set-speed', { detail: { speed: 0.0 } }));
                      window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🛑 ĐÃ KÉO PHANH TAY ĐIỆN TỬ EPB!" } }));
                    } else {
                      window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🟢 ĐÃ HẠ PHANH TAY! Bạn có thể nhấn ga xe." } }));
                    }
                  }}
                  className={`px-2.5 py-1 rounded border text-[9px] font-bold font-mono transition-colors cursor-pointer ${
                    epbEngaged 
                      ? 'bg-rose-600 border-rose-500 text-white font-black hover:bg-rose-500' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {epbEngaged ? '🔴 ON' : '⚫ OFF'}
                </button>
              </div>

              {/* TURN SIGNALS & HEADLIGHT BEAMS ROW */}
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-2">
                <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest font-mono">XI-NHAN & ĐÈN PHA THỰC:</span>
                
                <div className="grid grid-cols-2 gap-1.5 text-center text-[10px]">
                  <button
                    onClick={() => handleToggleIndicator(blinkerState === 'left' ? 'none' : 'left')}
                    className={`py-1.5 rounded border transition-all cursor-pointer font-bold ${blinkerState === 'left' ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                  >
                    ⬅️ Trái
                  </button>
                  <button
                    onClick={() => handleToggleIndicator(blinkerState === 'right' ? 'none' : 'right')}
                    className={`py-1.5 rounded border transition-all cursor-pointer font-bold ${blinkerState === 'right' ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                  >
                    ➡️ Phải
                  </button>
                  <button
                    onClick={() => handleToggleIndicator(blinkerState === 'hazard' ? 'none' : 'hazard')}
                    className={`py-1.5 rounded border transition-all cursor-pointer font-bold col-span-2 ${blinkerState === 'hazard' ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-slate-950 text-rose-500 border-rose-900/30'}`}
                  >
                    ⚠️ Nguy Hiểm (Hazard)
                  </button>
                </div>

                <div className="w-full h-px bg-slate-800" />
                <div className="flex gap-2 justify-between items-center text-[10px]">
                  <span className="text-slate-355">Đèn pha Laser:</span>
                  <button
                    onClick={() => {
                      playBeep(2100, 100, 'sine', 0.15);
                      window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 3.5 } }));
                      window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "💡 ĐÃ ĐÁ PHA LASER CHỚP TẦN SỐ CAO!" } }));
                    }}
                    className="px-2.5 py-1 border border-emerald-500 text-emerald-400 bg-slate-950 text-[9px] font-bold rounded"
                  >
                    ⚡ Đá Đèn Pha
                  </button>
                </div>
              </div>

              {/* HORN TONE SELECTOR & EMITTER */}
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-1.5 text-[10px]">
                <span className="font-bold text-indigo-300 uppercase font-mono text-[9px]">CÒI CẢNH BÁO XE:</span>
                <select
                  value={hornType}
                  onChange={(e) => setHornType(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[9px] text-white"
                >
                  <option value="standard">🔊 Bản Đi bộ</option>
                  <option value="twin_trumpet">📢 Kép Thợ Săn</option>
                  <option value="super_siren">🚨 Hú Cảnh Sát</option>
                </select>
                <button
                  onClick={triggerHorn}
                  className="bg-indigo-600 hover:bg-indigo-500 font-bold text-white py-1.5 rounded text-[10px]"
                >
                  Bóp Còi (H)
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: AUTOMOBILE CLIMATE CONTROLLER */}
          {activeTab === 'climate' && (
            <div className="flex flex-col gap-3 text-left">
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-extrabold uppercase text-white font-mono">Điều Hoà A/C VinFast</span>
                  <span className="text-[8px] font-mono bg-cyan-950 text-cyan-400 px-1.5 py-0.2 rounded-full uppercase animate-pulse">
                    ECO ACTIVE
                  </span>
                </div>

                {/* Temperature Dial Gauge UI */}
                <div className="flex justify-center items-center py-2">
                  <div className="relative w-24 h-24 border-[3px] border-slate-850 rounded-full flex flex-col justify-center items-center bg-slate-950/40 shadow-inner">
                    <span className="text-[8px] font-mono text-zinc-500 font-bold">TEMP</span>
                    <span className="text-xl font-black font-mono text-cyan-400 tracking-tighter">
                      {acTemp.toFixed(1)}°C
                    </span>
                    
                    <div className="absolute inset-x-1 bottom-1 flex justify-between px-1">
                      <button
                        onClick={() => { setAcTemp(p => Math.max(16, p - 0.5)); playBeep(500, 30); }}
                        className="w-5 h-5 bg-slate-850 border border-slate-700 hover:border-cyan-500 rounded-full text-[9px] font-bold text-cyan-400"
                      >
                        -
                      </button>
                      <button
                        onClick={() => { setAcTemp(p => Math.min(29, p + 0.5)); playBeep(700, 30); }}
                        className="w-5 h-5 bg-slate-850 border border-slate-700 hover:border-rose-500 rounded-full text-[9px] font-bold text-rose-400"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Speed fan */}
                <div className="flex flex-col gap-1 text-[10px]">
                  <div className="flex justify-between items-center text-[9px]">
                    <span>Quạt gió điều hòa:</span>
                    <span className="font-extrabold text-cyan-300">Cấp {acFan}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((lv) => (
                      <button
                        key={lv}
                        onClick={() => { setAcFan(lv); playBeep(400 + lv * 50, 40); }}
                        className={`flex-1 h-5 rounded font-mono text-[8px] font-black cursor-pointer ${
                          acFan >= lv ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 border border-slate-800 text-zinc-650'
                        }`}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Air distribution modes */}
                <div className="grid grid-cols-4 gap-1 text-[8px] uppercase font-bold text-center mt-0.5">
                  {(['auto', 'eco', 'max_frost', 'defog'] as const).map((mLabel) => (
                    <button
                      key={mLabel}
                      onClick={() => { setAcMode(mLabel); playBeep(650, 50); }}
                      className={`py-1 rounded border transition-all cursor-pointer ${
                        acMode === mLabel
                          ? 'bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white'
                          : 'bg-slate-950 border-slate-850 text-slate-400'
                      }`}
                    >
                      {mLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: FM RADIO PLAYER & AUDIO FREQUENCY AMBIENCE */}
          {activeTab === 'fm_radio' && (
            <div className="flex flex-col gap-3 text-left">
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-2.5">
                <span className="text-[9px] font-black uppercase text-white font-mono">FM Radio AM/FM Tuner</span>

                <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg flex flex-col text-center justify-center min-h-[60px] relative overflow-hidden">
                  {isRadioPlaying ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[8px] font-bold text-teal-400 animate-pulse">📡 DECODING FM...</span>
                      <span className="text-base font-black font-mono text-white">
                        {channels[selectedRadio].freq}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-300 mt-0.5 truncate max-w-[150px]">{channels[selectedRadio].name}</span>
                    </div>
                  ) : (
                    <span className="text-[9.5px] text-zinc-500 font-mono font-black">🔇 RADIO OFF</span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsRadioPlaying(!isRadioPlaying);
                    playBeep(isRadioPlaying ? 400 : 1000, 150);
                  }}
                  className={`py-1 rounded-lg border font-bold text-[10px] transition-colors cursor-pointer ${
                    isRadioPlaying ? 'bg-rose-600 border-rose-500 text-white' : 'bg-indigo-600 border-indigo-400 text-white'
                  }`}
                >
                  {isRadioPlaying ? 'TẮT LOA RADIO' : 'BẬT LOA PHÁT'}
                </button>

                <div className="flex flex-col gap-1">
                  {channels.map((ch, idx) => (
                    <button
                      key={ch.freq}
                      onClick={() => {
                        setSelectedRadio(idx);
                        playBeep(ch.soundHz, 120);
                      }}
                      className={`p-1.5 rounded border text-left text-[10px] flex justify-between items-center transition-all cursor-pointer ${
                        selectedRadio === idx && isRadioPlaying ? 'bg-indigo-950/60 border-indigo-505 text-white font-bold' : 'bg-slate-950 border-slate-850'
                      }`}
                    >
                      <span className="truncate max-w-[110px]">📻 {ch.name}</span>
                      <span className="font-mono text-[8.5px] text-teal-400">{ch.freq}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: KEY FOB ADVANCED CONTROLS (Alarm, open trunk, find car) */}
          {activeTab === 'keyfob' && (
            <div className="flex flex-col gap-3 text-left">
              <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-2.5 items-center max-w-[180px] mx-auto shadow-inner">
                <span className="text-[9.5px] font-bold text-slate-450 uppercase tracking-widest font-mono">Fob Smart Key</span>
                
                <button
                  onClick={() => {
                    setIsCarLocked(true);
                    playBeep(1200, 80);
                    setTimeout(() => playBeep(1200, 80), 120);
                    window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🔒 ĐÃ KHÓA XE TỪ VÀ TRẠM!" } }));
                  }}
                  className="w-full py-2 bg-slate-950 border border-rose-500/20 text-rose-450 text-[10px] font-bold rounded flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>LOCK VEHICLE</span>
                </button>

                <button
                  onClick={() => {
                    setIsCarLocked(false);
                    playBeep(1500, 120);
                    window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🔓 ĐÃ MỞ KHÓA TRẠM CHÂN XE!" } }));
                  }}
                  className="w-full py-2 bg-slate-950 border border-emerald-500/20 text-emerald-450 text-[10px] font-bold rounded flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>UNLOCK</span>
                </button>

                <div className="w-full h-px bg-slate-800" />
                
                <button
                  onClick={() => {
                    soundEngine.playLockSound?.();
                    window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 2.0 } }));
                    window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "💡 ĐÁ PHA LASER TÌM XE TRONG BÃI!" } }));
                  }}
                  className="w-full py-1 bg-slate-950 text-slate-300 text-[9px] border border-slate-800 rounded font-medium"
                >
                  ✨ ĐÈN TÌM XE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* FLOATING EPB WARNING BADGE IF EPB IS ACTIVATED */}
      {epbEngaged && (
        <div className="fixed top-24 left-6 z-40 bg-red-600 border border-red-400 text-white font-mono text-[9px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
          <AlertTriangle className="w-3 h-3" />
          <span>PHANH TAY CHƯA HẠ (EPB ACTIVE)</span>
        </div>
      )}

      {/* COCKPIT DETAILED CONTROL PANEL ON THE HUD */}
      {isOpen && (
        <div id="central-cockpit-panel" className="fixed top-36 left-6 z-40 h-[480px] w-[350px] rounded-3xl bg-slate-950/95 border border-slate-700/60 shadow-2xl overflow-hidden flex flex-col pointer-events-auto select-none font-sans max-h-[80vh] text-slate-100 flex-none scale-in">
          
          {/* HEADER SCREENS */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-200 to-indigo-300">VinFast V-Smart Screen</span>
                <span className="text-[9px] font-mono text-slate-400">HỆ THỐNG ĐA PHƯƠNG TIỆN KẾT NỐI AI</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-[10px] text-zinc-500 hover:text-white bg-slate-800 p-1.5 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>

          {/* APPLICATION CATEGORY TABS */}
          <div className="grid grid-cols-5 gap-0.5 bg-slate-900/60 p-1 border-b border-slate-800 text-[10px] uppercase font-bold shrink-0">
            <button
              onClick={() => { setActiveTab('ai_guide'); playBeep(900, 40); }}
              className={`py-1.5 text-center rounded transition-colors ${activeTab === 'ai_guide' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            >
              🤖 AI
            </button>
            <button
              onClick={() => { setActiveTab('car_control'); playBeep(900, 40); }}
              className={`py-1.5 text-center rounded transition-colors ${activeTab === 'car_control' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            >
              🎛️ Cơ
            </button>
            <button
              onClick={() => { setActiveTab('climate'); playBeep(900, 40); }}
              className={`py-1.5 text-center rounded transition-colors ${activeTab === 'climate' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            >
              ❄️ AC
            </button>
            <button
              onClick={() => { setActiveTab('fm_radio'); playBeep(900, 40); }}
              className={`py-1.5 text-center rounded transition-colors ${activeTab === 'fm_radio' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            >
              📻 Audio
            </button>
            <button
              onClick={() => { setActiveTab('keyfob'); playBeep(900, 40); }}
              className={`py-1.5 text-center rounded transition-colors ${activeTab === 'keyfob' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            >
              🔑 Fob
            </button>
          </div>

          {/* BODY SCREEN CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 bg-slate-950">
            
            {/* VIEW 1: AI MISSION SYSTEM AUTOMATION SOLVER */}
            {activeTab === 'ai_guide' && (
              <div className="flex-grow flex flex-col gap-3">
                <div className="bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-2xl flex flex-col gap-1.5 text-left text-xs text-indigo-200">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-extrabold tracking-wide uppercase">
                    <Compass className="w-4 h-4 text-indigo-300 animate-spin" />
                    <span>TRỢ LÝ AUTOMATIC ĐA NHIỆM:</span>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-slate-300">
                    Trợ lý AI hệ thống giúp quét định vị bản đồ và tự động kích hoạt ga, nitro tăng cường hoặc dịch chuyển tức thời để tự động giải quyết thử thách hóc búa, rinh tiền thưởng cực lớn về ví Bank!
                  </p>
                </div>

                {/* CURRENT LIST OF TASKS WITH ACTIONS BUTTON */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MỤC TIÊU PHƯƠNG TIỆN ĐANG CHẠY:</span>
                  
                  {missions.slice(0, visibleCount).map((m) => (
                    <div key={m.id} className="p-3 bg-slate-900 border border-slate-850 rounded-xl flex flex-col gap-2 hover:border-slate-705 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-[12px] text-white tracking-tight leading-snug flex items-center gap-1">
                            {m.completed ? '🎉' : '🎯'} {m.title}
                          </span>
                          <span className="text-[10.5px] text-slate-400 mt-0.5">{m.desc}</span>
                        </div>
                      </div>
                      
                      <div className="w-full h-px bg-slate-800" />
                      
                      <div className="flex justify-between items-center text-[10.5px] font-mono mt-0.5">
                        <div className="flex flex-col text-slate-400">
                          <span>Quà: <b className="text-amber-400">{m.rewardMoney.toLocaleString()}đ</b> + {m.rewardItem}</span>
                          <span>ĐK: <b className="text-purple-400">{m.condition}</b></span>
                        </div>

                        {m.completed ? (
                          <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ĐÃ XONG
                          </span>
                        ) : (
                          <button
                            disabled={!!aiRunningId}
                            onClick={() => triggerAiCompleteMission(m.id)}
                            className={`px-3 py-1.5 rounded-lg border font-bold font-sans text-xs flex items-center justify-center gap-1 transition-all flex-grow-0 cursor-pointer ${
                              aiRunningId === m.id
                                ? 'bg-amber-600 border-amber-400 text-white animate-pulse'
                                : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 border-indigo-400 hover:border-white text-white'
                            }`}
                          >
                            <Cpu className="w-3 h-3 text-white" />
                            <span>{aiRunningId === m.id ? 'AI ĐANG LÀM...' : 'KÍCH HOẠT AI'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {visibleCount < missions.length && (
                    <button
                      onClick={() => setVisibleCount(prev => Math.min(missions.length, prev + 25))}
                      className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-mono tracking-wide transition-all cursor-pointer text-center"
                    >
                      🔍 XEM THÊM NHIỆM VỤ (+25/{missions.length - visibleCount} CÒN LẠI)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: REAL VEHICLE MECHANICAL BUTTONS (Nỏ máy, đèn pha, xi nhan) */}
            {activeTab === 'car_control' && (
              <div className="flex flex-col gap-4 text-left">
                {/* CIRCULAR ENGINE IGNITION BUTTON */}
                <div className="flex flex-col items-center py-4 bg-slate-900 border border-slate-850 rounded-2xl gap-2 mt-1">
                  <button
                    onClick={() => {
                      playBeep(220, 150, 'sawtooth', 0.2);
                      window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { toggle: true } }));
                    }}
                    className="w-20 h-20 rounded-full bg-slate-950 border-4 border-red-500 hover:border-red-400 shadow-2xl flex flex-col justify-center items-center gap-1 group active:scale-95 transition-transform cursor-pointer"
                    style={{
                      boxShadow: '0 0 25px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">ENGINE</span>
                    <Zap className="w-5 h-5 text-red-500 group-hover:animate-bounce" />
                    <span className="text-[9px] font-bold text-rose-300 font-mono">START/STOP</span>
                  </button>
                  <span className="text-[10px] font-semibold text-slate-400 mt-1">Nút Nổ/Tắt nguồn khởi động lực đẩy xe bốc khói!</span>
                </div>

                {/* ELECTRONIC PARKING BRAKE BUTTON */}
                <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">🔏 PHANH TAY ĐIỆN TỬ (EPB)</span>
                    <span className="text-[10px] text-slate-400">Khoá cứng lốp tránh trôi xe lết đèo dốc</span>
                  </div>
                  <button
                    onClick={() => {
                      setEpbEngaged(!epbEngaged);
                      playBeep(600, 300, 'sine', 0.1);
                      if (!epbEngaged) {
                        window.dispatchEvent(new CustomEvent('game-set-speed', { detail: { speed: 0.0 } }));
                        window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🛑 ĐÃ KÉO PHANH TAY ĐIỆN TỬ EPB!" } }));
                      } else {
                        window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🟢 ĐÃ HẠ PHANH TAY! Bạn có thể nhấn ga xe." } }));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-colors cursor-pointer ${
                      epbEngaged 
                        ? 'bg-rose-600 border-rose-500 text-white font-black hover:bg-rose-500 shadow-lg shadow-rose-600/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {epbEngaged ? '🔴 PHANH ON' : '⚫ PHANH OFF'}
                  </button>
                </div>

                {/* TURN SIGNALS & HEADLIGHT BEAMS ROW */}
                <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest font-mono">XI-NHAN & ĐÈN PHA THỰC:</span>
                  
                  {/* Indicators control grid */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    <button
                      onClick={() => handleToggleIndicator(blinkerState === 'left' ? 'none' : 'left')}
                      className={`py-2 rounded-lg border transition-all cursor-pointer font-bold ${blinkerState === 'left' ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                    >
                      ⬅️ Trái
                    </button>
                    <button
                      onClick={() => handleToggleIndicator(blinkerState === 'right' ? 'none' : 'right')}
                      className={`py-2 rounded-lg border transition-all cursor-pointer font-bold ${blinkerState === 'right' ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                    >
                      ➡️ Phải
                    </button>
                    <button
                      onClick={() => handleToggleIndicator(blinkerState === 'hazard' ? 'none' : 'hazard')}
                      className={`py-2 rounded-lg border transition-all cursor-pointer font-bold col-span-2 ${blinkerState === 'hazard' ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-slate-950 text-rose-500 border-rose-900/30'}`}
                    >
                      ⚠️ Nguy Hiểm (Hazard)
                    </button>
                  </div>

                  {/* Beam switch button */}
                  <div className="w-full h-px bg-slate-800" />
                  <div className="flex gap-2 justify-between items-center">
                    <span className="text-xs text-slate-300 font-semibold">Chế độ chiếu sáng Laser:</span>
                    <button
                      onClick={() => {
                        playBeep(2100, 100, 'sine', 0.15);
                        window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 3.5 } }));
                        window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "💡 ĐÃ ĐÁ PHA LASER CHỚP TẦN SỐ CAO!" } }));
                        addLog("💡 Đã đá pha nháy chùm tia halogen Laser");
                      }}
                      className="px-3.5 py-1.5 b border border-emerald-500 hover:border-white text-emerald-400 hover:text-white bg-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      ⚡ Nháy Đuôi Pha (Flash)
                    </button>
                  </div>
                </div>

                {/* HORN TONE SELECTOR & EMITTER */}
                <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest font-mono">BẤM CÒI CẢNH BÁO XE BÍP BÍP:</span>
                  <div className="flex gap-2 justify-between">
                    <select
                      value={hornType}
                      onChange={(e) => setHornType(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="standard">🔊 Còi Bản Đi bộ (Standard)</option>
                      <option value="twin_trumpet">📢 Còi Kép Thợ Săn (Twin Trumpet)</option>
                      <option value="super_siren">🚨 Còi Hú Cảnh Sát (Super Siren)</option>
                    </select>
                    <button
                      onClick={triggerHorn}
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold border border-indigo-400 text-white px-4 py-1 rounded text-xs transition-transform cursor-pointer active:scale-95"
                    >
                      Bóp Còi (H)
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW 3: AUTOMOBILE CLIMATE CONTROLLER */}
            {activeTab === 'climate' && (
              <div className="flex flex-col gap-4 text-left">
                <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-2xl flex flex-col gap-3.5 mt-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Wind className="w-5 h-5 text-cyan-400 animate-pulse" />
                      <span className="text-xs font-extrabold uppercase text-white font-mono tracking-wider">Hệ Thống Điều Hoà A/C VinFast</span>
                    </div>
                    <span className="text-[8.5px] font-mono bg-cyan-950 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase animate-pulse">
                      ● Active (Eco Hum)
                    </span>
                  </div>

                  {/* Temperature Dial Gauge UI */}
                  <div className="flex justify-center items-center py-4 my-1">
                    <div className="relative w-36 h-36 border-[6px] border-slate-800 rounded-full flex flex-col justify-center items-center shadow-inner shadow-black/80 bg-slate-950/40">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-widest">Nhiệt Cabin</span>
                      <span className="text-4xl font-black font-mono text-cyan-400 select-all tracking-tighter">
                        {acTemp.toFixed(1)}°C
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 mt-1 uppercase">MÁY NÉN DUET-AIR</span>

                      {/* Temperature buttons inside dial */}
                      <div className="absolute inset-x-2 bottom-3 flex justify-between px-1 shrink-0">
                        <button
                          onClick={() => { setAcTemp(p => Math.max(16, p - 0.5)); playBeep(500, 30); }}
                          className="w-7 h-7 bg-slate-850 border border-slate-700 hover:border-cyan-500 rounded-full text-xs font-bold text-cyan-400 transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() => { setAcTemp(p => Math.min(29, p + 0.5)); playBeep(700, 30); }}
                          className="w-7 h-7 bg-slate-850 border border-slate-700 hover:border-rose-500 rounded-full text-xs font-bold text-rose-400 transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/*的风 Speed fan indicator controller bar */}
                  <div className="flex flex-col gap-1.5 text-xs text-slate-350">
                    <div className="flex justify-between items-center text-[10.5px] font-mono">
                      <span>Cường độ gió thổi (Bản đôn):</span>
                      <span className="font-extrabold text-cyan-300">Cấp {acFan} (Hút ẩm)</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((lv) => (
                        <button
                          key={lv}
                          onClick={() => { setAcFan(lv); playBeep(400 + lv * 50, 40); }}
                          className={`flex-1 h-6 rounded font-mono text-[9px] font-black transition-all cursor-pointer ${
                            acFan >= lv 
                              ? 'bg-cyan-500 text-slate-950 font-bold scale-95 shadow-md shadow-cyan-500/10' 
                              : 'bg-slate-950 border border-slate-800 text-zinc-600'
                          }`}
                        >
                          II
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Air distribution modes */}
                  <div className="grid grid-cols-4 gap-1.5 text-[8.5px] uppercase font-bold text-center mt-1">
                    {(['auto', 'eco', 'max_frost', 'defog'] as const).map((mLabel) => (
                      <button
                        key={mLabel}
                        onClick={() => { setAcMode(mLabel); playBeep(650, 50); }}
                        className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                          acMode === mLabel
                            ? 'bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white border-cyan-400 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: FM RADIO PLAYER & AUDIO FREQUENCY AMBIENCE */}
            {activeTab === 'fm_radio' && (
              <div className="flex flex-col gap-4 text-left">
                <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3.5 mt-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-indigo-400 animate-bounce" />
                    <span className="text-xs font-black uppercase text-white font-mono tracking-widest">Bộ Thu Sóng Radio AM/FM Tuner</span>
                  </div>

                  {/* Radio Screen Station status display */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col text-center justify-center min-h-[90px] relative overflow-hidden">
                    {/* Visual noise background lines */}
                    <div className="absolute inset-0 opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]" />
                    
                    {isRadioPlaying ? (
                      <div className="flex flex-col items-center gap-1.5 z-10 animate-fade-in">
                        <span className="text-[10px] font-bold text-teal-400 animate-pulse uppercase tracking-widest font-mono">📡 Đang giải mã tín hiệu...</span>
                        <span className="text-xl font-black font-mono text-white tracking-tight leading-none bg-indigo-950/40 border border-indigo-500/20 px-3.5 py-1 rounded">
                          {channels[selectedRadio].freq}
                        </span>
                        <span className="text-[12px] font-bold text-indigo-300 mt-1">{channels[selectedRadio].name}</span>
                        <span className="text-[9.5px] text-slate-400 italic font-medium">{channels[selectedRadio].genre}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 z-10 py-2">
                        <span className="text-[11px] text-zinc-500 font-mono uppercase font-black">🔇 FM RADIO TẮT SÓNG</span>
                        <p className="text-[9px] text-slate-400 leading-normal max-w-[220px] mt-0.5">Nhấp nút bấm "BẬT LOA PHÁT SÓNG FM" để giải phóng âm thanh mộc mạc thư giãn dốc núi.</p>
                      </div>
                    )}
                  </div>

                  {/* Toggles and controls bar */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsRadioPlaying(!isRadioPlaying);
                        playBeep(isRadioPlaying ? 400 : 1000, 150);
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl border font-bold text-xs flex justify-center items-center gap-1.5 transition-colors cursor-pointer ${
                        isRadioPlaying 
                          ? 'bg-rose-600 border-rose-500 text-white font-extrabold hover:bg-rose-500' 
                          : 'bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500 hover:border-white shadow'
                      }`}
                    >
                      {isRadioPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                      <span>{isRadioPlaying ? 'TẮT LOA RADIO' : 'BẬT LOA PHÁT'}</span>
                    </button>
                  </div>

                  {/* STATIONS LIST SELECTOR */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">DANH TRẠM HÀNH TRÌNH TĨNH:</span>
                    <div className="flex flex-col gap-1">
                      {channels.map((ch, idx) => (
                        <button
                          key={ch.freq}
                          onClick={() => {
                            setSelectedRadio(idx);
                            playBeep(ch.soundHz, 120);
                          }}
                          className={`p-2 rounded-xl border text-left text-[11px] flex justify-between items-center transition-all cursor-pointer ${
                            selectedRadio === idx && isRadioPlaying
                              ? 'bg-indigo-950/60 border-indigo-500 text-white font-bold scale-[0.99] shadow shadow-indigo-600/30' 
                              : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-350'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-1">📻 {ch.name}</span>
                            <span className="text-[8.5px] text-slate-400 mt-0.5">{ch.genre}</span>
                          </div>
                          <span className="font-mono font-bold text-teal-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[9px]">{ch.freq}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 5: KEY FOB ADVANCED CONTROLS (Alarm, open trunk, find car) */}
            {activeTab === 'keyfob' && (
              <div className="flex flex-col gap-4 text-left">
                <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3.5 mt-1">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <span className="text-xs font-black uppercase text-white font-mono tracking-widest">VinFast Smart Keyless Fob</span>
                  </div>

                  {/* Graphic layout representation of a physics car key chain */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-3.5 items-center max-w-[200px] mx-auto shadow-inner shadow-black/80">
                    {/* Metal keyring loop */}
                    <div className="w-8 h-2.5 bg-zinc-600 rounded-full border border-zinc-400 opacity-80" />
                    
                    {/* Lock Key Buttons */}
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <button
                        onClick={() => {
                          setIsCarLocked(true);
                          playBeep(920, 200, 'sine', 0.2);
                          setTimeout(() => playBeep(920, 200, 'sine', 0.2), 100);
                          window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🔒 ĐÃ KHÓA CỬA SỢI XE VINFAST! BÍP BÍP!" } }));
                          addLog("🔒 Đã gửi lệnh khoá cửa Remote.");
                        }}
                        className="bg-slate-850 border border-slate-700 hover:border-indigo-400 hover:text-indigo-300 text-slate-300 p-2.5 rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-colors"
                        title="Lock Door"
                      >
                        <Lock className="w-4 h-4 text-indigo-400" />
                        <span className="text-[8.5px] font-mono font-black uppercase">LOCK</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsCarLocked(false);
                          playBeep(1200, 250, 'sine', 0.2);
                          window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "🔓 ĐÃ MỞ KHÓA CỬA CHẮN Gió! BÍP!" } }));
                          addLog("🔓 Đã mở khoá cửa Remote.");
                        }}
                        className="bg-slate-850 border border-slate-700 hover:border-indigo-400 hover:text-indigo-300 text-slate-300 p-2.5 rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-colors"
                        title="Unlock Door"
                      >
                        <Unlock className="w-4 h-4 text-emerald-400" />
                        <span className="text-[8.5px] font-mono font-black uppercase">UNLOCK</span>
                      </button>
                    </div>

                    {/* Panic Alarm and Trunk button */}
                    <button
                      onClick={() => {
                        playBeep(520, 150, 'square', 0.15);
                        window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 1.5 } }));
                        window.dispatchEvent(new CustomEvent('alert-toast', { detail: { text: "📢 B-Í-P! Định vị xe chớp pha halogen!" } }));
                        addLog("📡 Định vị tìm xe: Chớp pha nháy tín hiệu đèn pha.");
                      }}
                      className="bg-slate-850 border border-slate-700 hover:border-amber-400 hover:text-amber-300 text-slate-350 py-2.5 px-4 w-full rounded-xl flex justify-center items-center gap-1.5 cursor-pointer text-xs font-bold transition-all"
                    >
                      <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                      <span>🔑 TÌM XE KHÔNG GIAN</span>
                    </button>

                    {/* Emergency defense siren alarm panic */}
                    <button
                      onClick={() => {
                        setPanicAlarmActive(!panicAlarmActive);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs flex justify-center items-center gap-1.5 transition-colors cursor-pointer ${
                        panicAlarmActive 
                          ? 'bg-rose-600 border-rose-500 text-white font-extrabold animate-pulse' 
                          : 'bg-rose-950/70 border-rose-900 text-rose-300 hover:bg-rose-900'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>{panicAlarmActive ? '🛑 TẮT HÚ CÒI' : '🚨 CÒI HÚ KHẨN CẤP'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* TELEMETRY CONSOLE LOG CONFLICTS */}
          <div className="p-3 bg-slate-900 border-t border-slate-850 h-24 overflow-y-auto font-mono text-[8.5px] text-emerald-400 flex flex-col gap-0.5 text-left shrink-0">
            {aiLog.map((log, i) => (
              <span key={i} className={i === 0 ? 'text-teal-200 font-extrabold animate-pulse' : 'opacity-70'}>{log}</span>
            ))}
          </div>

          {/* SCREEN CONSOLE FOOTER */}
          <div className="p-2 bg-slate-900/60 text-slate-500 text-[8px] font-mono border-t border-slate-850 shrink-0 text-center uppercase tracking-wider">
            ⚙️ VinFast Smart Ecosystem Connected OS 🇻🇳
          </div>

        </div>
      )}
    </>
  );
}
