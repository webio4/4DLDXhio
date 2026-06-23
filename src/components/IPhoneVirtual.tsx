import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Key, MapPin, Sliders, Trash2, Plus, Wifi, Battery, RotateCcw, 
  Lock, Unlock, ChevronRight, X, User, LogIn, LogOut, Disc, Inbox, Sparkles, 
  Server, Type, Trophy, Landmark, CreditCard, Gift, Hammer, Settings, PlusCircle, MinusCircle, ShieldCheck, Map,
  Cpu, Zap, Compass, Flame, AlertTriangle, ShoppingBag, Search, Download, ChevronLeft, Play, Square, CloudSun, Music, Activity,
  Globe, Image, Video, Calculator, Clock, Gamepad2, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomMapConfig, CustomBlock, GameStats, TrackType } from '../types';
import { auth, loginWithGoogle, logoutUser, getLeaderboard, savePlayerStats, LeaderboardUser } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { soundEngine } from '../utils/AudioEngine';
import { MiniMap } from './MiniMap';
import { VinCockpit } from './VinCockpit';

interface IPhoneVirtualProps {
  stats: GameStats;
  customMapConfig: CustomMapConfig;
  onCustomMapConfigChange: (cfg: CustomMapConfig) => void;
  carColor: string;
  onColorSelect: (color: string) => void;
  isCarLocked: boolean;
  setIsCarLocked: (locked: boolean) => void;
  playerMode: 'driving' | 'walking';
  setPlayerMode: (mode: 'driving' | 'walking') => void;
  customLogoText: string;
  setCustomLogoText: (text: string) => void;
  damage: number;
  setDamage: React.Dispatch<React.SetStateAction<number>>;
  selectedTrack?: TrackType;
  onTrackSelect?: (track: TrackType) => void;
  embedMode?: boolean;
}

interface BackpackItem {
  id: string;
  name: string;
  type: 'gas' | 'repair' | 'block_material' | 'lucky';
  subType?: CustomBlock['type'];
  icon: string;
  desc: string;
  qty: number;
  price: number; // Cost in bank balance
}

export function IPhoneVirtual({
  stats,
  customMapConfig,
  onCustomMapConfigChange,
  carColor,
  onColorSelect,
  isCarLocked,
  setIsCarLocked,
  playerMode,
  setPlayerMode,
  customLogoText,
  setCustomLogoText,
  damage,
  setDamage,
  selectedTrack = 'grassland',
  onTrackSelect,
  embedMode = false,
}: IPhoneVirtualProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen(p => !p);
    window.addEventListener('game-toggle-iphone', handleToggle);
    return () => window.removeEventListener('game-toggle-iphone', handleToggle);
  }, []);
  const [activeApp, setActiveApp] = useState<string>('home');
  const [gUser, setGUser] = useState<FirebaseUser | null>(null);

  // CH Play App State & Installed Apps Management
  const [installedApps, setInstalledApps] = useState<string[]>(() => {
    const saved = localStorage.getItem('iphone_installed_apps_db');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    // Default pre-installed core apps:
    return [
      'backpack', 'bank', 'codes_app', 'host_settings', 'leaderboard_app', 'server', 'google', 'maps_app', 'vin_remote', 'mochi_ai'
    ];
  });

  const [downloadingProgress, setDownloadingProgress] = useState<{ [appId: string]: number }>({});
  const [playStoreSearchText, setPlayStoreSearchText] = useState<string>('');
  const [acRunning, setAcRunning] = useState<boolean>(false);
  
  // Safari Browser state
  const [safariUrl, setSafariUrl] = useState<string>('home');
  const [safariSearchInput, setSafariSearchInput] = useState<string>('');

  // Photo gallery state
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // TikTok state
  const [tiktokActiveIndex, setTiktokActiveIndex] = useState<number>(0);

  // Calculator state
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [calcPrevVal, setCalcPrevVal] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [calcResetOnNext, setCalcResetOnNext] = useState<boolean>(true);

  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState<number>(0);
  const [stopwatchRunning, setStopwatchRunning] = useState<boolean>(false);
  const [stopwatchLaps, setStopwatchLaps] = useState<string[]>([]);
  const stopwatchIntervalRef = useRef<any>(null);

  // Pacman Game state
  const [pacmanX, setPacmanX] = useState<number>(2);
  const [pacmanY, setPacmanY] = useState<number>(2);
  const [pacmanScore, setPacmanScore] = useState<number>(0);
  const [pacmanFacing, setPacmanFacing] = useState<'R' | 'L' | 'U' | 'D'>('R');
  const [ghostX, setGhostX] = useState<number>(4);
  const [ghostY, setGhostY] = useState<number>(4);

  // GPT Mochi chat
  const [gptMochiInput, setGptMochiInput] = useState<string>('');
  const [gptMochiLogs, setGptMochiLogs] = useState<{ sender: 'user' | 'mochi'; text: string }[]>([
    { sender: 'mochi', text: 'Xin chào! Mình là GPT Mochi 💬. Bạn muốn hỏi gì về xe, cách lướt mây hay kỹ năng bẻ lái đỉnh cao bám đường?' }
  ]);

  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchTime(prev => prev + 10);
      }, 10);
    } else {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [stopwatchRunning]);

  useEffect(() => {
    localStorage.setItem('iphone_installed_apps_db', JSON.stringify(installedApps));
  }, [installedApps]);
  
  // mochiAIC#3 assistant states
  const [aiChatLogs, setAiChatLogs] = useState<string[]>([
    "🤖 [mochiAIC#3]: Chào chủ sở hữu! Tôi là mochiAIC#3, trợ lý tự lái thông minh trên iPhone 16.",
    "🤖 [mochiAIC#3]: Hãy CHỈ TAY nhấp chuột vào bất cứ tọa độ nào trên bản đồ ra-đa định vị GPS bên dưới, tôi sẽ tự động bẻ lái Autopilot đưa xe VinFast chạy lướt mây tới đó ngay!",
  ]);
  const [targetGPS, setTargetGPS] = useState<{ x: number; z: number } | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [isAiDriving, setIsAiDriving] = useState<boolean>(false);
  
  // Custom headlights sensor requirement for unlocking
  const [headlightsFlashed, setHeadlightsFlashed] = useState<boolean>(false);
  
  // Custom Dynamic Island alerts
  const [islandMsg, setIslandMsg] = useState<string | null>("Chào mừng tới Lái Xe 3D!");
  
  // Block form configurations
  const [formType, setFormType] = useState<CustomBlock['type']>('cube');
  const [formSX, setFormSX] = useState<number>(4);
  const [formSY, setFormSY] = useState<number>(3);
  const [formSZ, setFormSZ] = useState<number>(4);
  const [formRot, setFormRot] = useState<number>(0);
  const [formYOffset, setFormYOffset] = useState<number>(0);

  // Bank App Balance (stored in local storage, start at 35,000đ if empty)
  const [bankBalance, setBankBalance] = useState<number>(() => {
    return Number(localStorage.getItem('vb_bank_balance') || '35000');
  });

  // Gift codes redeemed list to prevent double use
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('vb_redeemed_codes') || '[]');
  });

  // Code input value
  const [codeInputText, setCodeInputText] = useState<string>('');

  // Active Leaderboard State
  const [leaderboardList, setLeaderboardList] = useState<LeaderboardUser[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<'stars' | 'diamonds'>('stars');
  const [isLoadingRank, setIsLoadingRank] = useState<boolean>(false);

  // Profile management (inside Leaderboard App)
  const [nicknameText, setNicknameText] = useState<string>(() => {
    const saved = localStorage.getItem('saved_racer_session');
    if (saved) {
      try { return JSON.parse(saved).nickname || 'Khách Đua Lục Địa'; } catch { return 'Khách Đua Lục Địa'; }
    }
    return 'Khách Đua Lục Địa';
  });
  const [avatarIcon, setAvatarIcon] = useState<string>('🏎️');

  // Backpack items inventory
  const [backpack, setBackpack] = useState<BackpackItem[]>(() => {
    const saved = localStorage.getItem('vb_backpack_inventory');
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return [
      { id: 'bp-1', name: 'Bình Xăng Dự Phòng 35L', type: 'gas', icon: '⛽', desc: 'Nạp nhanh thêm 35% Nhiên Liệu xe', qty: 2, price: 1500 },
      { id: 'bp-2', name: 'Hộp Sửa Xe Nano Khẩn Cấp', type: 'repair', icon: '🔧', desc: 'Giảm ngay 30% Hại/Va chạm', qty: 1, price: 2000 },
      { id: 'bp-block-cube', name: 'Bê Tông Khối (Cube)', type: 'block_material', subType: 'cube', icon: '🧱', desc: 'Xây móng nhà móng dốc thạch', qty: 5, price: 500 },
      { id: 'bp-block-ramp', name: 'Tấm Dốc Trượt (Ramp)', type: 'block_material', subType: 'ramp', icon: '📐', desc: 'Tạo dốc giúp xe phi cao cực bay', qty: 2, price: 1000 },
      { id: 'bp-block-cyl', name: 'Cột Trụ Phân Làn (Cyl)', type: 'block_material', subType: 'cyl_barrier', icon: '💈', desc: 'Cột barie xi lanh chắn xe', qty: 2, price: 800 },
      { id: 'bp-block-star', name: 'Sao Checkpoint (Star)', type: 'block_material', subType: 'star_checkpoint', icon: '⭐', desc: 'Tinh hoa sao vàng nhặt ăn điểm', qty: 1, price: 2500 },
      { id: 'bp-block-rock', name: 'Đá Tảng Thiên Nhiên (Rock)', type: 'block_material', subType: 'rock', icon: '🪨', desc: 'Đá tự nhiên đục thô chặn đường', qty: 2, price: 600 },
    ];
  });

  // Save bank balance, redeemed codes and backpack
  useEffect(() => {
    localStorage.setItem('vb_bank_balance', String(bankBalance));
  }, [bankBalance]);

  useEffect(() => {
    localStorage.setItem('vb_redeemed_codes', JSON.stringify(redeemedCodes));
  }, [redeemedCodes]);

  useEffect(() => {
    localStorage.setItem('vb_backpack_inventory', JSON.stringify(backpack));
  }, [backpack]);

  // Sync Google Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (usr) => {
      setGUser(usr);
      if (usr) {
        showIslandNotification(`Đã liên kết Google: ${usr.displayName || usr.email}`);
      }
    });
    return unsub;
  }, []);

  // Synchronise AI driving coordinates to threeJS physics engine
  useEffect(() => {
    if (isAiDriving && targetGPS) {
      window.dispatchEvent(new CustomEvent('game-ai-drive-to', {
        detail: { x: targetGPS.x, z: targetGPS.z }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('game-ai-cancel-drive'));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('game-ai-cancel-drive'));
    };
  }, [isAiDriving, targetGPS]);

  const lastLoggedDistanceRef = useRef<number>(0);

  // Monitor physical vehicle position and drive state
  useEffect(() => {
    if (isAiDriving && targetGPS) {
      const curX = stats.posX ?? 0;
      const curZ = stats.posZ ?? 0;
      const dx = targetGPS.x - curX;
      const dz = targetGPS.z - curZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist <= 4.5) {
        setIsAiDriving(false);
        setTargetGPS(null);
        soundEngine.playUnlockSound?.();
        
        // Reward money
        setBankBalance(p => p + 3000);
        
        setAiChatLogs(prev => [
          `🎉 [mochiAIC#3]: AUTOPILOT TỰ LÁI THÀNH CÔNG! Đã đưa xe VinFast chạy lướt mây tới đích an toàn! Nhận thưởng nóng V-Bank +3.000đ!`,
          ...prev.slice(0, 15)
        ]);
        
        window.dispatchEvent(new CustomEvent('alert-toast', {
          detail: { text: "🎉 mochiAIC#3: Đã tự lái xe tới đích an toàn! Nhận +3.000đ!" }
        }));
      } else {
        // Log progress occasionally (every 10 meters change)
        const roundedDist = Math.round(dist);
        if (Math.abs(roundedDist - lastLoggedDistanceRef.current) >= 10 || lastLoggedDistanceRef.current === 0) {
          lastLoggedDistanceRef.current = roundedDist;
          
          // flashing headlights occasionally
          window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 0.5 } }));
          
          setAiChatLogs(prev => [
            `⚡ [mochiAIC#3]: Lực kéo động cơ tương thích tốt... Đích còn lại: ${roundedDist}m. Toạ độ: (X: ${Math.round(curX)}, Z: ${Math.round(curZ)}).`,
            ...prev.slice(0, 15)
          ]);
        }
      }
    }
  }, [isAiDriving, targetGPS, stats.posX, stats.posZ]);

  // Session-persistent checkpoint tracking for repeatable rewards
  const lastCheckpointRef = useRef<number>(stats.currentCheckpoint || 0);
  const [sessionCheckpoints, setSessionCheckpoints] = useState<number>(() => {
    return Number(localStorage.getItem('vb_session_checkpoints') || '0');
  });

  useEffect(() => {
    localStorage.setItem('vb_session_checkpoints', String(sessionCheckpoints));
  }, [sessionCheckpoints]);

  useEffect(() => {
    const current = stats.currentCheckpoint || 0;
    if (current > lastCheckpointRef.current) {
      const added = current - lastCheckpointRef.current;
      lastCheckpointRef.current = current;

      setSessionCheckpoints((prev) => {
        const nextVal = prev + added;
        if (nextVal >= 10) {
          const multiples = Math.floor(nextVal / 10);
          const moneyAward = multiples * 50000;
          setBankBalance((bal) => bal + moneyAward);
          
          setTimeout(() => {
            showIslandNotification(`💰 +${moneyAward.toLocaleString()}đ (Chạm đủ 10 Checkpoints!)`);
          }, 450);

          return nextVal % 10;
        }
        return nextVal;
      });
    } else if (current < lastCheckpointRef.current) {
      lastCheckpointRef.current = current;
    }
  }, [stats.currentCheckpoint]);

  // Fetch Rankings on demand
  const fetchRankings = async () => {
    setIsLoadingRank(true);
    try {
      const list = await getLeaderboard();
      setLeaderboardList(list);
    } catch (e) {
      // fallback
      setLeaderboardList([
        { userId: '1', nickname: 'Chủ Server VIP', avatar: '👑', stars: 999, diamonds: 888 },
        { userId: '2', nickname: 'Racer Cyber 99', avatar: '🚀', stars: 220, diamonds: 140 },
        { userId: '3', nickname: 'Bá Chủ Drift 12', avatar: '🏎️', stars: 150, diamonds: 90 },
      ]);
    }
    setIsLoadingRank(false);
  };

  useEffect(() => {
    if (activeApp === 'leaderboard_app') {
      fetchRankings();
    }
  }, [activeApp]);

  const showIslandNotification = (msg: string) => {
    setIslandMsg(msg);
    setTimeout(() => {
      setIslandMsg(null);
    }, 4500);
  };

  // Google Sign In / Sign out
  const handleGoogleSignIn = async () => {
    try {
      showIslandNotification("Đang mở cổng Google...");
      const user = await loginWithGoogle();
      if (user) {
        showIslandNotification(`Chào mừng ${user.displayName || 'bạn'}!`);
      }
    } catch (err: any) {
      console.error(err);
      const mockUser = {
        displayName: nicknameText || 'Racer Google Guest',
        email: 'racer.google@gmail.com',
        photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120'
      };
      setGUser(mockUser as any);
      showIslandNotification("Đăng nhập Mock Google thành công!");
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutUser();
    setGUser(null);
    showIslandNotification("Đã đăng xuất Google");
  };

  // Car Lock / Unlock Toggle
  const toggleCarLock = () => {
    const nextLocked = !isCarLocked;
    
    // Safety guard requirement: Must verify with headlights or flash sensor to open lock!
    if (!nextLocked) { // trying to unlock / open
      if (!headlightsFlashed) {
        soundEngine.playLockSound?.(); // plays warning buzzer
        showIslandNotification("🔒 BẢO MẬT: Hãy nhấn '💡 Nháy Pha' trước để nhận dạng SmartKey!");
        return;
      }
    }

    setIsCarLocked(nextLocked);
    if (nextLocked) {
      soundEngine.playLockSound?.();
      setHeadlightsFlashed(false); // require flashing headlight again next time!
      showIslandNotification("🔒 XE ĐÃ HOÀN TOÀN KHOÁ!");
    } else {
      soundEngine.playUnlockSound?.();
      showIslandNotification("🔓 ĐÃ MỞ KHOÁ XE THÀNH CÔNG!");
    }
  };

  // Check backpack logic before placing blocks!
  const deductBlockMaterial = (blockType: CustomBlock['type']): boolean => {
    const itemIndex = backpack.findIndex(item => item.type === 'block_material' && item.subType === blockType);
    if (itemIndex === -1) return false;
    
    const targetItem = backpack[itemIndex];
    if (targetItem.qty <= 0) {
      return false;
    }

    // Decrement
    const updatedBackpack = [...backpack];
    updatedBackpack[itemIndex] = { ...targetItem, qty: targetItem.qty - 1 };
    setBackpack(updatedBackpack);
    return true;
  };

  // Place block under player's feet with inventory restriction!
  const handlePlaceAtFeet = () => {
    if (playerMode !== 'walking') {
      showIslandNotification("⚠️ Hãy xuống xe đi bộ để đặt khối!");
      return;
    }

    // Check material in backpack!
    const hasMaterial = deductBlockMaterial(formType);
    if (!hasMaterial) {
      soundEngine.playLockSound?.();
      showIslandNotification(`❌ Hết khối ${formType}! Truy cập App Ngân Hàng để mua thêm!`);
      return;
    }

    const px = stats.walkerX ?? 0;
    const pz = stats.walkerZ ?? 0;
    const py = stats.walkerY ?? 0;

    const newBlock: CustomBlock = {
      id: `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: formType,
      x: Math.round(px * 10) / 10,
      y: Math.round((py + formYOffset) * 10) / 10,
      z: Math.round(pz * 10) / 10,
      scaleX: formSX,
      scaleY: formSY,
      scaleZ: formSZ,
      rotationY: formRot,
    };

    const nextBlocks = [...(customMapConfig.placedBlocks || []), newBlock];
    onCustomMapConfigChange({
      ...customMapConfig,
      placedBlocks: nextBlocks,
    });

    soundEngine.playCheckpoint?.();
    showIslandNotification(`🧱 Đã xây đặt ${formType} tại chân (-1 nguyên liệu)`);
  };

  // Add block manually
  const handleAddBlockManually = () => {
    const px = stats.posX ?? 0;
    const pz = stats.posZ ?? 0;

    const hasMaterial = deductBlockMaterial(formType);
    if (!hasMaterial) {
      soundEngine.playLockSound?.();
      showIslandNotification(`❌ Hết khối ${formType}! Truy cập App Ngân Hàng để mua thêm!`);
      return;
    }

    const newBlock: CustomBlock = {
      id: `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: formType,
      x: Math.round((px + 5) * 10) / 10,
      y: formYOffset,
      z: Math.round((pz + 5) * 10) / 10,
      scaleX: formSX,
      scaleY: formSY,
      scaleZ: formSZ,
      rotationY: formRot,
    };

    const nextBlocks = [...(customMapConfig.placedBlocks || []), newBlock];
    onCustomMapConfigChange({
      ...customMapConfig,
      placedBlocks: nextBlocks,
    });

    soundEngine.playCheckpoint?.();
    showIslandNotification(`🧱 Thêm ${formType} cách xe 5m (-1 nguyên liệu)`);
  };

  // Delete/Break block - Replenishes inventory block material! "Phá được khối đã đặt để sửa"
  const deleteBlock = (id: string) => {
    const targetBlock = (customMapConfig.placedBlocks || []).find(b => b.id === id);
    if (!targetBlock) return;

    // Refund block to backpack!
    const itemIndex = backpack.findIndex(item => item.type === 'block_material' && item.subType === targetBlock.type);
    if (itemIndex !== -1) {
      const updatedBackpack = [...backpack];
      updatedBackpack[itemIndex] = { ...backpack[itemIndex], qty: backpack[itemIndex].qty + 1 };
      setBackpack(updatedBackpack);
    }

    const filtered = (customMapConfig.placedBlocks || []).filter(b => b.id !== id);
    onCustomMapConfigChange({
      ...customMapConfig,
      placedBlocks: filtered
    });
    
    soundEngine.playUnlockSound?.();
    showIslandNotification(`🗑️ Đã phá khối & thu hồi vật tư vê Balo!`);
  };

  const clearAllBlocks = () => {
    // Refund all blocks to backpack up to limit!
    const updatedBackpack = [...backpack];
    (customMapConfig.placedBlocks || []).forEach(b => {
      const idx = updatedBackpack.findIndex(x => x.type === 'block_material' && x.subType === b.type);
      if (idx !== -1) {
        updatedBackpack[idx].qty += 1;
      }
    });

    setBackpack(updatedBackpack);

    onCustomMapConfigChange({
      ...customMapConfig,
      placedBlocks: []
    });
    showIslandNotification("🧹 Đã dọn sạch bản đồ & thu hồi tất cả khối về Balo");
  };

  // Redeem driving performance stars / drift points to bank balance cash!
  const handleRedeemStatsToBank = () => {
    const earnedStars = stats.score ? Math.floor(stats.score / 20) : 0;
    const earnedCash = 5000 + (earnedStars * 1000); 
    setBankBalance(p => p + earnedCash);
    soundEngine.playCheckpoint?.();
    showIslandNotification(`💰 Đã quy đổi thành công +${earnedCash.toLocaleString()} VND vào MB-Bank!`);
  };

  // Emergency funds
  const handleEmergencyFund = () => {
    setBankBalance(p => p + 5000);
    soundEngine.playUnlockSound?.();
    showIslandNotification(`🏦 V-Bank cấp khoản vay khẩn cấp +5,000 VND!`);
  };

  // Buy block material inside Bank
  const purchaseMaterial = (item: BackpackItem) => {
    if (bankBalance < item.price) {
      soundEngine.playLockSound?.();
      showIslandNotification(`❌ Số dư không đủ! Đặt mua thất bại.`);
      return;
    }

    // Deduct and increment backpack
    setBankBalance(p => p - item.price);
    setBackpack(prev => prev.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x ));
    
    soundEngine.playCheckpoint?.();
    showIslandNotification(`💳 Mua thành công ${item.name} (-${item.price} VND)`);
  };

  // Gift codes & cheat codes validation code
  const handleRedeemGiftCode = () => {
    const code = codeInputText.trim().toUpperCase();
    if (!code) return;

    if (redeemedCodes.includes(code)) {
      showIslandNotification("❌ Code này đã được sử dụng rồi!");
      return;
    }

    if (code === 'VIP666') {
      setBankBalance(p => p + 100000);
      setRedeemedCodes(p => [...p, code]);
      soundEngine.playUnlockSound?.();
      showIslandNotification("🎁 CODE VIP666: Nhận ngay +100,000đ tài khoản!");
    } else if (code === 'ADMIN123') {
      setBankBalance(p => p + 500000);
      setRedeemedCodes(p => [...p, code]);
      soundEngine.playUnlockSound?.();
      showIslandNotification("🛠️ CODE ADMIN123: Kích hoạt +500.000 VND cực đã!");
    } else if (code === 'VIP999') {
      setBackpack(p => p.map(x => x.type === 'block_material' ? { ...x, qty: 99 } : x));
      setRedeemedCodes(p => [...p, code]);
      soundEngine.playCheckpoint?.();
      showIslandNotification("🧱 CODE VIP999: Hack đầy Balo vật liệu xây dựng x99!");
    } else if (code === 'FULLXANG' || code === 'GASGAS') {
      window.dispatchEvent(new CustomEvent('game-refuel', { detail: { amount: 100 } }));
      soundEngine.playUnlockSound?.();
      showIslandNotification("⛽ CODE XĂNG: Xe đã nạp đầy bình nhiên liệu!");
    } else if (code === 'SUAXETIET') {
      setDamage(0);
      soundEngine.playLockSound?.();
      showIslandNotification("🔧 CODE SỬA XE: Xe đã phục hồi 100% không tì vết!");
    } else if (code === 'SUPERDRIVE') {
      // Modify Engine Power limit in server config
      onCustomMapConfigChange({
        ...customMapConfig,
        enginePower: 4.0
      });
      soundEngine.playCheckpoint?.();
      showIslandNotification("🚀 CODE SIÊU CẤP: Động cơ tăng tốc đột phá x4!");
    } else if (code === 'MOONJUMP') {
      onCustomMapConfigChange({
        ...customMapConfig,
        worldGravity: 1.8
      });
      soundEngine.playUnlockSound?.();
      showIslandNotification("🌙 CODE MẶT TRĂNG: Trọng lực giảm siêu yếu, nhảy lơ lửng!");
    } else if (code.startsWith('SV-')) {
      // SV Join session
      showIslandNotification(`🌐 Đang kết nối server phòng: ${code}...`);
      onCustomMapConfigChange({ ...customMapConfig, roomCode: code });
    } else {
      soundEngine.playLockSound?.();
      showIslandNotification("❌ Code không tồn tại hoặc sai ký tự!");
    }

    setCodeInputText('');
  };

  // Sync profile update
  const handleSaveProfile = async () => {
    localStorage.setItem('saved_racer_session', JSON.stringify({
      nickname: nicknameText,
      avatar: avatarIcon,
    }));
    
    // Save to server rank if logged in
    const racer_uid = gUser ? gUser.uid : 'racer_guest_id';
    try {
      await savePlayerStats({
        userId: racer_uid,
        nickname: nicknameText,
        avatar: avatarIcon,
        stars: stats.score ? Math.floor(stats.score / 20) : stats.currentCheckpoint || 0,
        diamonds: stats.score ? Math.floor(stats.score / 15) : stats.currentCheckpoint || 0,
        outfit: playerMode === 'driving' ? 'racer' : 'walker',
        createdAt: Date.now(),
      });
      showIslandNotification("🏆 Đã đồng bộ biệt danh lên BXH!");
      fetchRankings();
    } catch {
      showIslandNotification("☁️ Điểm được lưu tại máy chủ tạm!");
    }
  };

  // Use Backpack items
  const useInventoryItem = (item: BackpackItem) => {
    if (item.qty <= 0) return;

    if (item.type === 'gas') {
      window.dispatchEvent(new CustomEvent('game-refuel', { detail: { amount: 35 } }));
      soundEngine.playUnlockSound?.();
      showIslandNotification("⛽ Nạp thêm 35L xăng thành công!");
    } else if (item.type === 'repair') {
      setDamage(p => Math.max(0, p - 30));
      soundEngine.playLockSound?.();
      showIslandNotification("🛠️ Đã sửa chữa giảm 30% hư hại!");
    } else if (item.type === 'block_material') {
      showIslandNotification(`🧱 Vật liệu ${item.name} dùng đặt ở màn hình Xây Map!`);
      return;
    } else if (item.type === 'lucky') {
      soundEngine.playCheckpoint?.();
      showIslandNotification("🍀 Thần tài gõ cửa x2 điểm drift!");
    }

    // Decrement
    setBackpack(p => p.map(x => x.id === item.id ? { ...x, qty: x.qty - 1 } : x));
  };

  const handleRefillStore = () => {
    setBackpack(p => p.map(item => ({ ...item, qty: item.qty + 2 })));
    showIslandNotification("📦 Kho Balo bổ sung thêm vật tư đầy đủ!");
  };

  return (
    <>
      {/* 1. DYNAMIC PHONE FAB TOGGLE BUTTON (IPhone 16) */}
      {!embedMode && (
        <button
          id="btn-iphone-fob"
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 z-55 w-14 h-14 rounded-xl bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 border-2 border-cyan-500 shadow-2xl flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:scale-105 active:scale-95 transition-all text-white group"
          title="Mở IPhone 16 App Điều Khiển"
        >
          <Phone className="w-5 h-5 text-cyan-400 group-hover:text-pink-400 group-hover:rotate-12 transition-transform animate-pulse" />
          <span className="text-[7.5px] tracking-wide font-mono font-bold text-cyan-300">IPhone 16</span>
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-full" />
        </button>
      )}

      {/* 2. REALISTIC VIRTUAL ONSCREEN IPHONE MODAL DEVICE CONTAINER */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/45 md:bg-transparent z-50 pointer-events-none flex items-center justify-center md:justify-end md:items-end md:p-6">
          <div 
            id="iphone-wrapper-shell" 
            className="pointer-events-auto h-[530px] w-[270px] rounded-[36px] bg-neutral-950 border-[6px] border-neutral-800 shadow-2xl overflow-hidden relative flex flex-col select-none border-b-[10px] shadow-black/80 animate-in slide-in-from-bottom duration-300 max-h-[85vh]"
            style={{
              boxShadow: '0 25px 50px -12px rgba(6, 182, 212, 0.4)'
            }}
          >
            {/* SCREEN CAMERA BEZEL DYNAMIC ISLAND */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 flex items-center justify-center">
              {islandMsg ? (
                <div className="bg-black text-rose-400 text-[9px] px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-rose-500/25 max-w-[210px] truncate animate-pulse font-mono tracking-tighter">
                  <Sparkles className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
                  <span>{islandMsg}</span>
                </div>
              ) : (
                <div className="w-[100px] h-[22px] bg-black rounded-full flex items-center justify-center" />
              )}
            </div>

            {/* STATUS BAR */}
            <div className="w-full h-8 px-5 pt-2 flex justify-between items-center bg-black/40 text-[9px] font-mono font-bold text-slate-300 shrink-0">
              <span>9:41 AM</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="text-[7px] text-emerald-400">5G</span>
                <Battery className="w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>

            {/* SCREEN BODY SCROLLER */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950 px-4 py-3 relative flex flex-col">
              
              {/* BACK HEADER IF NOT HOME */}
              {activeApp !== 'home' && (
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <button 
                    onClick={() => setActiveApp('home')}
                    className="text-[10px] bg-slate-800/80 hover:bg-slate-700 hover:text-white px-2 py-1 rounded-lg text-slate-300 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>◀ Home</span>
                  </button>
                  <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase font-mono">
                    {activeApp === 'map' && 'Xây Bản đồ'}
                    {activeApp === 'key' && 'Smart Control'}
                    {activeApp === 'backpack' && 'Balo Túi Đồ'}
                    {activeApp === 'bank' && 'Ngân Hàng MB'}
                    {activeApp === 'codes_app' && 'Nhập Code'}
                    {activeApp === 'host_settings' && 'Chủ Server ⚙️'}
                    {activeApp === 'leaderboard_app' && '🏆 Cao Thủ'}
                    {activeApp === 'server' && 'Bảng Logo'}
                    {activeApp === 'google' && 'Google Auth'}
                    {activeApp === 'maps_app' && 'Bản Đồ CO'}
                    {activeApp === 'vin_remote' && 'RemodeXC App 🚘'}
                    {activeApp === 'mochi_ai' && 'mochiAIC#3 🤖'}
                    {activeApp === 'ch_play' && 'CH Play 🎭'}
                    {activeApp === 'remode_xc' && 'RemodeXC 🚘'}
                    {activeApp === 'youtube_car' && 'YouTube VR 📺'}
                    {activeApp === 'spotify_music' && 'Spotify FM 🎵'}
                    {activeApp === 'racing_stats' && 'Telemetry 📊'}
                    {activeApp === 'weather_sky' && 'Thời Tiết 4D ⛈️'}
                    {activeApp === 'safari_web' && 'Safari Web 🌐'}
                    {activeApp === 'photo_gallery' && 'Thư Viện Ảnh 🖼️'}
                    {activeApp === 'tiktok_short' && 'TikTok Lướt 🎥'}
                    {activeApp === 'calculator_pro' && 'Máy Tính Pro 🧮'}
                    {activeApp === 'clock_stopwatch' && 'Bấm Giờ Đua ⏱️'}
                    {activeApp === 'game_pacman' && 'Pacman Mini 👾'}
                    {activeApp === 'chat_gp_mochi' && 'GPT Mochi 💬'}
                  </span>
                </div>
              )}

              {/* VIEW: HOME VIEW LIST */}
              {activeApp === 'home' && (
                <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-0.5 select-none scrollbar-thin scrollbar-thumb-cyan-500/20">
                  {/* Lockscreen clock and state info widget */}
                  <div className="text-center py-3 flex flex-col gap-1 items-center bg-slate-800/20 rounded-2xl border border-slate-700/20 p-2 shrink-0 my-1">
                    <span className="text-xl font-bold font-sans text-cyan-400 tracking-wide font-mono">RemodeXC OS</span>
                    <span className="text-[10px] font-bold text-indigo-300 tracking-wider font-mono uppercase bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                      📍 {customMapConfig.mapName || 'Vùng Đất Kỳ Bí'}
                    </span>
                    <div className="flex justify-between items-center gap-2 mt-1.5 text-[8px] font-mono text-cyan-400">
                      <span>🏦 Bank: <b className="text-amber-400 font-extrabold">{bankBalance.toLocaleString()}đ</b></span>
                      <span>⭐ Drift: <b className="text-white">{stats.score || '0'}</b></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-y-4 gap-x-2 my-2.5 shrink-0 select-none text-center">
                    {/* ALWAYS PRE-INSTALLED: CH PLAY */}
                    <button 
                      onClick={() => {
                        setActiveApp('ch_play');
                        soundEngine.playUnlockSound?.();
                      }}
                      className="flex flex-col items-center gap-1 group active:scale-95 transition-all cursor-pointer"
                    >
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 via-sky-500 to-rose-500 p-[1.5px] shadow-lg">
                        <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center hover:bg-slate-900 transition-colors">
                          <ShoppingBag className="w-5.5 h-5.5 text-sky-400" />
                        </div>
                      </div>
                      <span className="text-[8px] font-extrabold text-sky-300 font-sans">CH Play 🎭</span>
                    </button>

                    {/* 1. APP: BACKPACK */}
                    {installedApps.includes('backpack') && (
                      <button 
                        onClick={() => setActiveApp('backpack')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-amber-600/90 border border-amber-400/40 flex items-center justify-center shadow-lg group-hover:bg-amber-500 relative">
                          <Inbox className="w-5.5 h-5.5 text-white" />
                          {backpack.reduce((acc, c) => acc + c.qty, 0) > 0 && (
                            <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[7px] font-black font-sans px-1 rounded-full border border-slate-900">
                              {backpack.reduce((acc, c) => acc + c.qty, 0)}
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-bold text-slate-200 font-sans">Balo Đồ</span>
                      </button>
                    )}

                    {/* 2. APP: BANK */}
                    {installedApps.includes('bank') && (
                      <button 
                        onClick={() => {
                          if (!gUser) {
                            showIslandNotification("🔒 BANK: Hãy đăng nhập Google trước!");
                            return;
                          }
                          setActiveApp('bank');
                        }}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-amber-500 border border-amber-300 flex items-center justify-center shadow-xl hover:bg-amber-400 text-slate-950 relative">
                          <Landmark className="w-5.5 h-5.5 text-slate-950" />
                          {!gUser && (
                            <div className="absolute -top-1 -right-1 bg-rose-600 border border-slate-950 text-white rounded-full p-0.5 shadow flex items-center justify-center">
                              <Lock className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-extrabold text-amber-300 font-sans">V-Bank MB</span>
                      </button>
                    )}

                    {/* 3. APP: NHẬP CODE */}
                    {installedApps.includes('codes_app') && (
                      <button 
                        onClick={() => {
                          if (!gUser) {
                            showIslandNotification("🔑 CODE: Hãy đăng nhập Google trước!");
                            return;
                          }
                          setActiveApp('codes_app');
                        }}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-teal-600 border border-teal-400 flex items-center justify-center shadow-lg hover:bg-teal-500 text-white relative">
                          <Gift className="w-5.5 h-5.5 text-white" />
                          {!gUser && (
                            <div className="absolute -top-1 -right-1 bg-rose-600 border border-slate-950 text-white rounded-full p-0.5 shadow flex items-center justify-center">
                              <Lock className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-bold text-slate-200 font-sans">Nhập Code</span>
                      </button>
                    )}

                    {/* 4. APP: HOST SETTINGS */}
                    {installedApps.includes('host_settings') && (
                      <button 
                        onClick={() => setActiveApp('host_settings')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-purple-750 border border-purple-400 flex items-center justify-center shadow-lg hover:bg-purple-650 text-white">
                          <Settings className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-bold text-purple-300 font-sans font-sans">Cài Server</span>
                      </button>
                    )}

                    {/* 5. APP: LEADERBOARD CO */}
                    {installedApps.includes('leaderboard_app') && (
                      <button 
                        onClick={() => setActiveApp('leaderboard_app')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-indigo-650 border border-indigo-400 flex items-center justify-center shadow-lg hover:bg-indigo-550 text-white">
                          <Trophy className="w-5.5 h-5.5 text-yellow-400" />
                        </div>
                        <span className="text-[8px] font-extrabold text-indigo-300 font-sans">Bảng Vàng</span>
                      </button>
                    )}

                    {/* 6. APP: BANNER LOGO */}
                    {installedApps.includes('server') && (
                      <button 
                        onClick={() => setActiveApp('server')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-pink-600/90 border border-pink-400/40 flex items-center justify-center shadow-lg group-hover:bg-pink-500">
                          <Type className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-bold text-slate-200 font-sans">Chữ Logo</span>
                      </button>
                    )}

                    {/* 7. APP: GOOGLE AUTH */}
                    {installedApps.includes('google') && (
                      <button 
                        onClick={() => setActiveApp('google')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-lg transition-colors ${gUser ? 'bg-indigo-600 border-indigo-400' : 'bg-rose-600/90 border-rose-400/45'} group-hover:bg-indigo-500 relative`}>
                          {gUser ? (
                            <img src={gUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'} className="w-full h-full rounded-xl object-cover referrerPolicy='no-referrer'" alt="google avatar" />
                          ) : (
                            <User className="w-5 h-5 text-white" />
                          )}
                          {gUser && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                              <ShieldCheck className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-extrabold text-blue-300 font-sans font-sans">Google Auth</span>
                      </button>
                    )}

                    {/* 8. APP: CUSTOM MAP CHANGER */}
                    {installedApps.includes('maps_app') && (
                      <button 
                        onClick={() => setActiveApp('maps_app')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-sky-700 border border-sky-400 flex items-center justify-center shadow-lg hover:bg-sky-600 text-white">
                          <Map className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-sky-300 font-sans">Bản Đồ CO</span>
                      </button>
                    )}

                    {/* 9. APP: App AImd */}
                    {installedApps.includes('vin_remote') && (
                      <button 
                        onClick={() => setActiveApp('vin_remote')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                        id="app-aimd"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 border border-cyan-400 flex items-center justify-center shadow-lg hover:from-cyan-500 hover:to-indigo-500 text-white">
                          <Cpu className="w-5.5 h-5.5 text-cyan-200" />
                        </div>
                        <span className="text-[8px] font-extrabold text-cyan-300 font-sans">App AImd</span>
                      </button>
                    )}

                    {/* 10. APP: mochiAIC#3 AI ASSISTANT */}
                    {installedApps.includes('mochi_ai') && (
                      <button 
                        onClick={() => setActiveApp('mochi_ai')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                        id="app-mochiai"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-fuchsia-600 border border-fuchsia-400 flex items-center justify-center shadow-lg hover:from-cyan-500 hover:to-fuchsia-500 text-white">
                          <Sparkles className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-fuchsia-300 font-sans">mochiAIC#3</span>
                      </button>
                    )}

                    {/* 11. DYNAMIC LOADED APP: REMODEXC PRO */}
                    {installedApps.includes('remode_xc') && (
                      <button 
                        onClick={() => {
                          setActiveApp('remode_xc');
                          soundEngine.playUnlockSound?.();
                        }}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                        id="app-car-remote"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 border border-amber-450 flex items-center justify-center shadow-lg hover:from-amber-400 hover:to-rose-500 text-white">
                          <Zap className="w-5.5 h-5.5 text-amber-200" />
                        </div>
                        <span className="text-[8px] font-extrabold text-amber-300 font-sans">Xe Từ Xa 🚘</span>
                      </button>
                    )}

                    {/* 12. DYNAMIC LOADED APP: YOUTUBE CAR PLAYER */}
                    {installedApps.includes('youtube_car') && (
                      <button 
                        onClick={() => setActiveApp('youtube_car')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-red-650 border border-red-400 flex items-center justify-center shadow-lg hover:bg-red-500 text-white">
                          <Play className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-red-300 font-sans">YouTube VR</span>
                      </button>
                    )}

                    {/* 13. DYNAMIC LOADED APP: SPOTIFY MUSIC */}
                    {installedApps.includes('spotify_music') && (
                      <button 
                        onClick={() => setActiveApp('spotify_music')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-emerald-600 border border-emerald-400 flex items-center justify-center shadow-lg hover:bg-emerald-500 text-white">
                          <Music className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-green-300 font-sans">Spotify Play</span>
                      </button>
                    )}

                    {/* 14. DYNAMIC LOADED APP: TELEMETRY CHART PERFORMANCE */}
                    {installedApps.includes('racing_stats') && (
                      <button 
                        onClick={() => setActiveApp('racing_stats')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-teal-800 border border-cyan-400 flex items-center justify-center shadow-lg hover:from-cyan-500 hover:to-teal-700 text-white">
                          <Activity className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-cyan-300 font-sans font-sans">Telemetry</span>
                      </button>
                    )}

                    {/* 15. DYNAMIC LOADED APP: WEATHER SKY WEATHER FORECASTS */}
                    {installedApps.includes('weather_sky') && (
                      <button 
                        onClick={() => setActiveApp('weather_sky')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-indigo-805 border border-indigo-400 flex items-center justify-center shadow-lg hover:bg-sky-500 text-white">
                          <CloudSun className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-indigo-300 font-sans">Thời Tiết</span>
                      </button>
                    )}

                    {/* 16. SAFARI WEB BROWSER */}
                    {installedApps.includes('safari_web') && (
                      <button 
                        onClick={() => setActiveApp('safari_web')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-500 to-sky-600 border border-sky-455 flex items-center justify-center shadow-lg hover:from-blue-400 hover:to-sky-500 text-white">
                          <Globe className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-blue-300 font-sans">Safari 🌐</span>
                      </button>
                    )}

                    {/* 17. PHOTO GALLERY */}
                    {installedApps.includes('photo_gallery') && (
                      <button 
                        onClick={() => setActiveApp('photo_gallery')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 border border-indigo-400 flex items-center justify-center shadow-lg hover:from-purple-400 hover:to-indigo-500 text-white">
                          <Image className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-purple-300 font-sans font-sans">Gallery 🖼️</span>
                      </button>
                    )}

                    {/* 18. TIKTOK SHORT VIDEO */}
                    {installedApps.includes('tiktok_short') && (
                      <button 
                        onClick={() => setActiveApp('tiktok_short')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-slate-955 border border-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-900 text-white">
                          <Video className="w-5.5 h-5.5 text-teal-400" />
                        </div>
                        <span className="text-[8px] font-extrabold text-teal-300 font-sans font-sans">TikTok 🎥</span>
                      </button>
                    )}

                    {/* 19. CALCULATOR PRO */}
                    {installedApps.includes('calculator_pro') && (
                      <button 
                        onClick={() => setActiveApp('calculator_pro')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-amber-600 border border-amber-400 flex items-center justify-center shadow-lg hover:bg-amber-500 text-white">
                          <Calculator className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-orange-300 font-sans">Máy Tính</span>
                      </button>
                    )}

                    {/* 20. CLOCK STOPWATCH */}
                    {installedApps.includes('clock_stopwatch') && (
                      <button 
                        onClick={() => setActiveApp('clock_stopwatch')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center shadow-lg hover:bg-slate-750 text-white">
                          <Clock className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-slate-300 font-sans">Stopwatch</span>
                      </button>
                    )}

                    {/* 21. PACMAN GAME ARCADES */}
                    {installedApps.includes('game_pacman') && (
                      <button 
                        onClick={() => setActiveApp('game_pacman')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-yellow-500 border border-yellow-400 flex items-center justify-center shadow-lg hover:bg-yellow-400 text-white">
                          <Gamepad2 className="w-5.5 h-5.5 text-slate-950" />
                        </div>
                        <span className="text-[8px] font-extrabold text-amber-300 font-sans font-sans">Pacman</span>
                      </button>
                    )}

                    {/* 22. MOCHI GPT CHAT */}
                    {installedApps.includes('chat_gp_mochi') && (
                      <button 
                        onClick={() => setActiveApp('chat_gp_mochi')}
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform cursor-pointer font-sans"
                      >
                        <div className="w-11 h-11 rounded-xl bg-pink-600 border border-pink-400 flex items-center justify-center shadow-lg hover:bg-pink-500 text-white">
                          <MessageSquare className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span className="text-[8px] font-extrabold text-pink-300 font-sans">GPT Mochi</span>
                      </button>
                    )}
                  </div>

                  {/* LIVE SMART GPS MINIMAP WIDGET inside iPhone 16 screen! */}
                  <div className="bg-slate-900/50 p-2.5 border border-cyan-500/25 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8.5px] font-mono tracking-tight shrink-0 mt-2 mb-3 hover:border-cyan-400 transition-colors">
                    <div className="w-full font-black text-cyan-400 font-mono tracking-wider uppercase flex items-center justify-between text-[8px] px-0.5">
                      <div className="flex items-center gap-1">
                        <Map className="w-3 h-3 text-cyan-400 animate-pulse" />
                        <span>BẢN ĐỒ VỆ TINH GPS</span>
                      </div>
                      <span className="text-[7.5px] text-zinc-500 animate-pulse">● LIVE</span>
                    </div>
                    <div className="w-full flex items-center justify-center p-1 bg-slate-950/40 rounded-xl border border-slate-800/40 mt-1">
                      <MiniMap 
                        stats={stats}
                        selectedTrack={selectedTrack}
                        playerMode={playerMode}
                        isEmbedded={true}
                      />
                    </div>
                  </div>

                  {/* BOTTOM RECENT NOTIFICATIONS */}
                  <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-2xl flex flex-col gap-1 text-[8px] leading-relaxed">
                    <span className="font-bold text-rose-400 font-mono tracking-wide uppercase">💡 HƯỚNG DẪN BẮT ĐẦU:</span>
                    <p className="text-slate-300">Hãy kiếm xu VND thông qua việc lái xe drift, sau đó nạp xu ở App <b>🏦 V-Bank</b> để mua sắm vật liệu xây dựng và thỏa sức tạo hình thế giới!</p>
                  </div>
                </div>
              )}

              {/* VIEW: MAP BUILDER (EDIT BLOCKS) */}
              {activeApp === 'map' && (
                <div className="flex-1 flex flex-col gap-3 min-h-0 text-left text-white">
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl text-[9px] text-slate-300 flex flex-col gap-0.5">
                    <span className="text-[8px] text-zinc-500 font-mono uppercase font-bold text-cyan-400">Tọa độ nhân vật</span>
                    <span className="font-mono text-white">X: {stats.walkerX?.toFixed(1) ?? '0.0'}, Z: {stats.walkerZ?.toFixed(1) ?? '0.0'}, H: {stats.walkerY?.toFixed(1) ?? '0.0'}</span>
                    <p className="text-slate-400 text-[8px] mt-0.5 leading-normal">Mẹo: Di chuyển nhân vật đến vị trí cần đặt rồi nhấn "Đặt Tại Chân"! Khối xây dựng tiêu hao vật liệu tương ứng từ Balo.</p>
                  </div>

                  {/* CHOOSE BLOCK TYPE WITH INVENTORY VIEW PREVIEW */}
                  <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-xl flex flex-col gap-2">
                    <span className="text-[9px] font-bold uppercase text-indigo-300 tracking-wider">Lựa Chọn Địa Hình</span>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] text-slate-400">Chọn loại hình khối xây:</label>
                      <select 
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as any)}
                        className="bg-slate-850 border border-slate-700 text-white rounded p-1 text-[9px] outline-none"
                      >
                        <option value="cube">🧱 Khối Hộp (Cube)</option>
                        <option value="ramp">📐 Bản Thiết Kế Dốc (Ramp)</option>
                        <option value="cyl_barrier">💈 Cột Barie Phân Làn (Cylinder)</option>
                        <option value="star_checkpoint">⭐ Sao Checkpoint Vui Vẻ</option>
                        <option value="rock">🪨 Tảng Đá Ngoại Cảnh (Rock)</option>
                      </select>
                      {/* Check details qty */}
                      {(() => {
                        const matched = backpack.find(x => x.type === 'block_material' && x.subType === formType);
                        return (
                          <div className="flex justify-between items-center text-[8px] font-mono mt-1 px-1 text-slate-300">
                            <span>Kho Balo có sẵn:</span>
                            <span className={`font-black ${matched && matched.qty > 0 ? 'text-amber-400' : 'text-rose-500 animate-pulse'}`}>
                              {matched ? matched.qty : 0} khối
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Dimensions sliders */}
                    <div className="grid grid-cols-2 gap-2 text-[8px]">
                      <div>
                        <span>Dx Rộng X: {formSX}m</span>
                        <input type="range" min="1" max="15" value={formSX} onChange={e => setFormSX(Number(e.target.value))} className="w-full accent-cyan-500 h-1 mt-1 bg-slate-800 rounded-lg appearance-none" />
                      </div>
                      <div>
                        <span>Dy Cao Y: {formSY}m</span>
                        <input type="range" min="1" max="10" value={formSY} onChange={e => setFormSY(Number(e.target.value))} className="w-full accent-cyan-500 h-1 mt-1 bg-slate-800 rounded-lg appearance-none" />
                      </div>
                      <div>
                        <span>Dz Sâu Z: {formSZ}m</span>
                        <input type="range" min="1" max="15" value={formSZ} onChange={e => setFormSZ(Number(e.target.value))} className="w-full accent-cyan-500 h-1 mt-1 bg-slate-800 rounded-lg appearance-none" />
                      </div>
                      <div>
                        <span>Xoay R: {(formRot * 180 / Math.PI).toFixed(0)}°</span>
                        <input type="range" min="0" max="6.28" step="0.1" value={formRot} onChange={e => setFormRot(Number(e.target.value))} className="w-full accent-cyan-500 h-1 mt-1 bg-slate-800 rounded-lg appearance-none" />
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px]">Bù Cao Độ (Nổi lên m): {formYOffset}m</span>
                      <input type="range" min="-3" max="8" step="0.5" value={formYOffset} onChange={e => setFormYOffset(Number(e.target.value))} className="w-full accent-cyan-500 h-1 mt-1 bg-slate-800 rounded-lg appearance-none" />
                    </div>

                    {/* Action button */}
                    <div className="grid grid-cols-2 gap-2 mt-1 shrink-0">
                      <button
                        onClick={handlePlaceAtFeet}
                        className="py-1.5 px-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 rounded text-[9px] font-bold cursor-pointer text-white flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Xây Tại Chân</span>
                      </button>

                      <button
                        onClick={handleAddBlockManually}
                        className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded text-[9px] cursor-pointer text-slate-100 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Đặt Cách Xe 5m</span>
                      </button>
                    </div>
                  </div>

                  {/* LIST Placed blocks with Delete Action */}
                  <div className="flex-1 overflow-y-auto max-h-[130px] border border-slate-800 rounded-xl p-2 bg-slate-900/40 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center bg-black/30 p-1.5 rounded text-[8px]">
                      <span className="font-bold text-zinc-400">DANH SÁCH ĐÃ ĐẶT ({customMapConfig.placedBlocks?.length || 0} KHỐI)</span>
                      {(customMapConfig.placedBlocks?.length || 0) > 0 && (
                        <button onClick={clearAllBlocks} className="text-[8px] text-zinc-400 hover:text-rose-400 font-bold">Thu hồi hết</button>
                      )}
                    </div>

                    {(!customMapConfig.placedBlocks || customMapConfig.placedBlocks.length === 0) ? (
                      <span className="text-[8px] text-zinc-500 py-3 text-center">Chưa có khối địa hình nào được đặt!</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {customMapConfig.placedBlocks.map((b, idx) => (
                          <div key={b.id || idx} className="text-[8px] flex justify-between items-center p-1.5 bg-slate-950/80 rounded border border-slate-800/60">
                            <span className="font-mono text-zinc-300">
                              #{idx+1}: <span className="text-cyan-400 font-semibold">{b.type}</span> (X:{b.x?.toFixed(0)}, Z:{b.z?.toFixed(0)}) ({b.scaleX}mx{b.scaleY}mx{b.scaleZ}m)
                            </span>
                            <button 
                              onClick={() => deleteBlock(b.id)}
                              className="text-zinc-500 hover:text-rose-500 p-0.5 cursor-pointer active:scale-90"
                              title="Phá huỷ khối đã đặt để sửa"
                            >
                              <Trash2 className="w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW: SMART CAR KEY */}
              {activeApp === 'key' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white">
                  <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl flex flex-col items-center gap-2.5 relative">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Smart Connect</span>
                    <button 
                      onClick={toggleCarLock}
                      className={`w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 ${
                        isCarLocked 
                          ? 'bg-rose-950/60 border-rose-500/50 text-rose-400 shadow-xl shadow-rose-500/20 scale-95' 
                          : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-xl shadow-emerald-500/20 scale-100'
                      }`}
                    >
                      {isCarLocked ? (
                        <>
                          <Lock className="w-8 h-8 mb-1 animate-pulse" />
                          <span className="text-[8px] font-black">LOCK: KHOÁ</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-8 h-8 mb-1" />
                          <span className="text-[8px] font-black">ACTIVE: MỞ</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 mt-1 w-full text-[9px]">
                      <button 
                        onClick={() => { soundEngine.playCheckpoint?.(); showIslandNotification("🔊 CÒI REO: BÍP! BÍP!"); }}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-lg cursor-pointer"
                      >
                        📢 Còi Bíp
                      </button>
                      <button 
                        onClick={() => { 
                          soundEngine.playLockSound?.(); 
                          setHeadlightsFlashed(true);
                          window.dispatchEvent(new CustomEvent('game-flash-headlights', { detail: { duration: 3.5 } }));
                          showIslandNotification("✨ ĐÃ CHỚP ĐÈN PHA! Đã khớp mã khóa."); 
                        }}
                        className="flex-1 py-1.5 bg-slate-850 hover:bg-slate-700 text-slate-100 font-bold rounded-lg cursor-pointer"
                      >
                        💡 Nháy Pha
                      </button>
                    </div>
                  </div>

                  {/* Spectral Color Picker */}
                  <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-2">
                    <span className="text-[9px] font-extrabold uppercase text-slate-300">Tùy Chỉnh Màu Sơn Xe</span>
                    <div className="flex items-center gap-3 bg-black/30 p-2 rounded-xl border border-slate-800">
                      <div className="w-9 h-9 rounded-lg border border-slate-700" style={{ backgroundColor: carColor }} />
                      <div className="flex-1 flex flex-col">
                        <span className="text-[9px] font-extrabold text-white">MÀU HIỆN TẠI</span>
                        <span className="text-[8px] font-mono text-indigo-300">{carColor.toUpperCase()}</span>
                      </div>
                      <input 
                        type="color" 
                        value={carColor}
                        onChange={(e) => onColorSelect(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 outline-none p-0 shrink-0" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: BACKPACK APPS */}
              {activeApp === 'backpack' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white">
                  <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                      <span className="text-[10px] font-black uppercase text-indigo-300">BA LÔ TIỂU TIẾT ({backpack.reduce((acc, c) => acc + c.qty, 0)} ĐỒ)</span>
                      <button 
                        onClick={handleRefillStore}
                        className="text-[8px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 active:scale-95 cursor-pointer"
                      >
                        Bổ sung +2
                      </button>
                    </div>

                    {/* Items Grid Slots */}
                    <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                      {backpack.map((item) => (
                        <div key={item.id} className="p-1.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between gap-2.5 transition-all">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-base">{item.icon}</div>
                          <div className="flex-1 flex flex-col text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-extrabold text-white leading-none">{item.name}</span>
                              <span className="text-[8.5px] font-mono text-amber-300 font-bold bg-amber-950/40 px-1 rounded">x{item.qty}</span>
                            </div>
                            <span className="text-[7.5px] text-slate-400 mt-0.5 leading-snug">{item.desc}</span>
                          </div>

                          <button
                            onClick={() => useInventoryItem(item)}
                            disabled={item.qty <= 0}
                            className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all shrink-0 ${
                              item.qty > 0 
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 shadow-md shadow-indigo-600/20' 
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            Xử Lý
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: NEW APP V-BANK MB (Ngân Hàng) */}
              {activeApp === 'bank' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white">
                  <div className="bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-400 p-4 rounded-2xl flex flex-col gap-2 shadow-lg">
                    <span className="text-[8px] font-bold tracking-widest text-amber-200">VP-MICRO BANKING</span>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xl font-bold font-mono text-white">{bankBalance.toLocaleString()} VND</span>
                      <span className="text-[8px] text-emerald-300 font-semibold animate-pulse">ĐANG BẢO MẬT</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5 text-[8.5px]">
                      <button 
                        onClick={handleRedeemStatsToBank}
                        className="py-1.5 bg-slate-950 text-amber-300 border border-amber-500/30 rounded font-bold hover:bg-slate-900 active:scale-95 transition-transform text-center cursor-pointer"
                      >
                        Quy Đổi Điểm Thưởng
                      </button>
                      <button 
                        onClick={handleEmergencyFund}
                        className="py-1.5 bg-white text-slate-950 rounded font-extrabold hover:bg-slate-100 active:scale-95 transition-transform text-center cursor-pointer"
                      >
                        Cấp Khẩn Cấp 5Kđ
                      </button>
                    </div>
                  </div>

                  {/* CONSTRUCTION MATERIALS SHOP */}
                  <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center gap-1 text-[9.5px] font-bold text-amber-400">
                      <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                      <span>CỬA HÀNG VẬT LIỆU XÂY DỰNG</span>
                    </div>
                    <p className="text-[7.5px] text-zinc-400 leading-normal">Số vật liệu đặt mua sẽ trực tiếp bay vào Balo túi đồ của nhân vật để sử dụng tại App Xây Bản Đồ.</p>

                    <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto max-h-[220px]">
                      {backpack.map((item) => (
                        <div key={item.id} className="p-1 px-1.5 bg-slate-950/80 border border-slate-800 rounded-lg flex justify-between items-center gap-1.5 text-[8.5px]">
                          <span className="text-sm">{item.icon}</span>
                          <div className="flex-1 flex flex-col">
                            <span className="font-bold text-slate-100">{item.name}</span>
                            <span className="text-amber-400 text-[8px] font-mono font-black">Giá: {item.price.toLocaleString()} VND</span>
                          </div>
                          <button
                            onClick={() => purchaseMaterial(item)}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1 px-2.5 rounded text-[8px] cursor-pointer hover:shadow-lg active:scale-95 transition-transform shrink-0"
                          >
                            MUA
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: NEW APP CODES REDEEM (Nhập Giftcode & Server) */}
              {activeApp === 'codes_app' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white">
                  <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-2.5">
                    <span className="text-[10px] font-black uppercase text-teal-400 flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" />
                      Nhập Code & Mã Server
                    </span>
                    <p className="text-[7px] text-zinc-400 leading-normal">Nhập Giftcode khuyến mãi, gian lận (cheat codes) vật nuôi hoặc mã máy chủ SV-XXXXXX phía dưới để nhận ưu đãi tức thì!</p>
                    
                    <div className="flex gap-1.5 mt-1">
                      <input 
                        type="text"
                        value={codeInputText}
                        onChange={(e) => setCodeInputText(e.target.value)}
                        placeholder="Có thể nhập: VIP666 hoặc SV-xxxxxx..."
                        className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-400 text-teal-300 font-bold font-mono text-[10px] rounded p-1.5 outline-none select-all"
                      />
                      <button 
                        onClick={handleRedeemGiftCode}
                        className="bg-teal-600 hover:bg-teal-500 text-white font-extrabold px-3 py-1 text-[9px] rounded cursor-pointer active:scale-95 transition-transform shrink-0"
                      >
                        Kích Hoạt
                      </button>
                    </div>

                    {/* MOCK CODE CODES LIST SUGGESTIONS */}
                    <div className="flex flex-col gap-1.5 bg-black/40 border border-slate-800/60 rounded p-2.5 text-[8px]">
                      <span className="font-bold text-yellow-400 block mb-0.5">💡DANH SÁCH CODE KHAI PHÁ THẾ GIỚI:</span>
                      <div className="flex justify-between border-b border-slate-850 py-0.5">
                        <span className="font-mono text-zinc-300">ADMIN123</span>
                        <span className="text-teal-400">+500,000 VND MB-Bank</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-850 py-0.5">
                        <span className="font-mono text-zinc-300">VIP999</span>
                        <span className="text-teal-400">Đong đầy toàn bộ vật liệu x99</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-850 py-0.5">
                        <span className="font-mono text-zinc-300">MOONJUMP</span>
                        <span className="text-teal-400">Trọng lực mặt trăng bay bổng</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-300">SUAXETIET</span>
                        <span className="text-teal-400">Mới xe hoàn toàn 100%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: NEW APP HOST OWNER SETTINGS (10 Chức Năng Bản Đồ của Chủ Server) */}
              {activeApp === 'host_settings' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white text-[8.5px]">
                  <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2 max-h-[460px] overflow-y-auto shrink-0">
                    <span className="text-[9.5px] font-black uppercase text-purple-400 flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      10 Quyền Cài Map Chủ Server
                    </span>

                    {/* 1. Meteor Frequency */}
                    <div className="flex flex-col gap-0.5 border-b border-slate-850 pb-2">
                      <span className="font-bold text-slate-200">1. Đợt Sao Băng Thiên Thạch:</span>
                      <select 
                        value={customMapConfig.meteorFrequency || 'low'}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, meteorFrequency: e.target.value as any })}
                        className="bg-slate-950 border border-slate-800 text-purple-300 p-1 rounded font-bold"
                      >
                        <option value="none">Tắt hoàn toàn</option>
                        <option value="low">Thỉnh thoảng nhẹ (Low)</option>
                        <option value="med">Vừa phải kích tính (Med)</option>
                        <option value="high">Mưa thiên thạch diệt vong (High)</option>
                      </select>
                    </div>

                    {/* 2. World gravity physics */}
                    <div className="flex flex-col gap-0.5 border-b border-slate-850 pb-2">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-200">2. Hấp lực Trọng trường:</span>
                        <span className="text-cyan-400 font-bold">{customMapConfig.worldGravity?.toFixed(1) ?? '9.8'}G</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="30" 
                        step="0.5" 
                        value={customMapConfig.worldGravity ?? 9.8} 
                        onChange={e => onCustomMapConfigChange({ ...customMapConfig, worldGravity: Number(e.target.value) })}
                        className="w-full h-1 mt-1 bg-slate-800 rounded accent-purple-500 appearance-none" 
                      />
                    </div>

                    {/* 3. NPC density */}
                    <div className="flex flex-col gap-0.5 border-b border-slate-850 pb-2">
                      <span className="font-bold text-slate-200">3. Mật độ Người đi bộ (NPC):</span>
                      <select 
                        value={customMapConfig.npcDensity || 'normal'}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, npcDensity: e.target.value as any })}
                        className="bg-slate-950 border border-slate-800 text-purple-300 p-1 rounded font-bold"
                      >
                        <option value="sparse">Thấp thưa thớt</option>
                        <option value="normal">Thông thường</option>
                        <option value="crowded">Kín hết đường lộ</option>
                      </select>
                    </div>

                    {/* 4. NPC Walking speed multiplier */}
                    <div className="flex flex-col gap-0.5 border-b border-slate-850 pb-2">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-200">4. Gia tốc Người đi bộ:</span>
                        <span className="text-cyan-400 font-mono font-bold">{customMapConfig.npcSpeed ?? 1.0}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="5.0" 
                        step="0.5" 
                        value={customMapConfig.npcSpeed ?? 1.0} 
                        onChange={e => onCustomMapConfigChange({ ...customMapConfig, npcSpeed: Number(e.target.value) })}
                        className="w-full h-1 mt-1 bg-slate-800 rounded accent-purple-500 appearance-none" 
                      />
                    </div>

                    {/* 5. Car engine power booster */}
                    <div className="flex flex-col gap-0.5 border-b border-slate-850 pb-2">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-200">5. Sức kéo Động cơ Xe:</span>
                        <span className="text-cyan-400 font-mono font-bold">{customMapConfig.enginePower ?? 1.0}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="1.0" 
                        max="5.0" 
                        step="0.2" 
                        value={customMapConfig.enginePower ?? 1.0} 
                        onChange={e => onCustomMapConfigChange({ ...customMapConfig, enginePower: Number(e.target.value) })}
                        className="w-full h-1 mt-1 bg-slate-800 rounded accent-purple-500 appearance-none" 
                      />
                    </div>

                    {/* 6. Perpetual Locked Weather */}
                    <div className="flex flex-col gap-0.5 border-b border-slate-850 pb-2">
                      <span className="font-bold text-slate-200">6. Cố định Khí hậu/Thời tiết:</span>
                      <select 
                        value={customMapConfig.lockedWeather || 'dynamic'}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, lockedWeather: e.target.value as any })}
                        className="bg-slate-950 border border-slate-800 text-purple-300 p-1 rounded font-bold"
                      >
                        <option value="dynamic">Thay đổi tự nhiên</option>
                        <option value="sunny">Nắng rực rỡ perpetual</option>
                        <option value="sunset">Hoàng hôn mờ ảo</option>
                        <option value="rain">Mưa giông bão bùng</option>
                        <option value="night">Đêm cô tịch ánh đèn</option>
                      </select>
                    </div>

                    {/* 7. Auto repair checkbox */}
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">7. Khôi phục Khung Gầm:</span>
                        <span className="text-zinc-500 text-[7px]">Tự sửa chữa lân cận 1.5% hại / giây</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!customMapConfig.autoRepair}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, autoRepair: e.target.checked })}
                        className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* 8. Time Attack difficulty */}
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">8. Áp lực Đồng Hồ:</span>
                        <span className="text-zinc-500 text-[7px]">Đếm ngược thời gian thi đấu</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!customMapConfig.timeAttack}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, timeAttack: e.target.checked })}
                        className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* 9. Double Drift Points */}
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">9. Nhân Đôi Cày Drift Sao:</span>
                        <span className="text-zinc-500 text-[7px]">Bonus gấp đôi star drift point</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!customMapConfig.doubleDrift}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, doubleDrift: e.target.checked })}
                        className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* 10. Damage Invincible */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">10. Khung Gầm Bất Hoại:</span>
                        <span className="text-zinc-500 text-[7px]">Miễn nhiễm toàn bộ va chạm & nhiệt độ bốc nổ</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!customMapConfig.invincibleCar}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, invincibleCar: e.target.checked })}
                        className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                      />
                    </div>

                  </div>
                </div>
              )}

              {/* VIEW: LEADERBOARD BẢNG VÀNG APP */}
              {activeApp === 'leaderboard_app' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white text-[8.5px]">
                  
                  {/* EDIT Racer Profile inside the same app */}
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col gap-2">
                    <span className="font-bold text-indigo-300 text-[9px] uppercase tracking-wide">💼 HÀNH TRÌNH TÀI KHOẢN ĐUA</span>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-400 text-[7.5px]">Biệt danh đua xe</span>
                        <input
                          type="text"
                          value={nicknameText}
                          onChange={(e) => setNicknameText(e.target.value)}
                          className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded p-1 text-[9px] text-indigo-300 font-bold outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-400 text-[7.5px]">Chọn ảnh đại diện:</span>
                        <select
                          value={avatarIcon}
                          onChange={(e) => setAvatarIcon(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-white rounded p-1 text-[9px] outline-none"
                        >
                          <option value="🦸">🦸 Siêu Anh Hùng</option>
                          <option value="🏎️">🏎️ Racer</option>
                          <option value="🚀">🚀 Phi Hành Gia</option>
                          <option value="🤖">🤖 Cyborg</option>
                          <option value="👑">👑 Vương Giả</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1 shrink-0">
                      <div className="bg-slate-950/40 p-1.5 rounded flex flex-col items-center border border-slate-850">
                        <span className="text-[7.5px] text-zinc-500 uppercase font-mono">Stars</span>
                        <span className="text-[11px] font-black font-mono text-amber-400">⭐ {stats.score ? Math.floor(stats.score / 20) : stats.currentCheckpoint || 0}</span>
                      </div>
                      <div className="bg-slate-950/40 p-1.5 rounded flex flex-col items-center border border-slate-850">
                        <span className="text-[7.5px] text-zinc-500 uppercase font-mono">Diamonds</span>
                        <span className="text-[11px] font-black font-mono text-teal-400">💎 {stats.score ? Math.floor(stats.score / 15) : stats.currentCheckpoint || 0}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      className="py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[9px] rounded-lg transition-transform active:scale-95 cursor-pointer text-center uppercase"
                    >
                      Lưu & Đồng bộ BXH Đám Mây
                    </button>
                  </div>

                  {/* REALTIME RANKING LIST FOR PLAYERS */}
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col gap-2 flex-1 min-h-[180px] overflow-hidden">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-yellow-500 uppercase flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        Bảng Vàng Cao Thủ
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setLeaderboardTab('stars')}
                          className={`py-0.5 px-1 rounded ${leaderboardTab === 'stars' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-400'}`}
                        >
                          ⭐ Sao
                        </button>
                        <button
                          onClick={() => setLeaderboardTab('diamonds')}
                          className={`py-0.5 px-1 rounded ${leaderboardTab === 'diamonds' ? 'bg-teal-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-400'}`}
                        >
                          💎 Trạm
                        </button>
                      </div>
                    </div>

                    {isLoadingRank ? (
                      <div className="text-center py-5 text-indigo-300 animate-pulse font-mono">Đang tải dữ liệu thực tế...</div>
                    ) : (
                      <div className="flex flex-col gap-1 overflow-y-auto max-h-[160px]">
                        {leaderboardList.length === 0 ? (
                          <div className="text-center py-4 text-zinc-500 italic">Chưa có cao thủ nào ghi danh! Hãy đổi biệt danh để kích hoạt.</div>
                        ) : (
                          [...leaderboardList]
                            .sort((a,b) => leaderboardTab === 'stars' ? (b.stars || 0) - (a.stars || 0) : (b.diamonds || 0) - (a.diamonds || 0))
                            .map((p, index) => {
                              const isSelf = p.nickname === nicknameText;
                              return (
                                <div 
                                  key={p.userId || index}
                                  className={`flex justify-between items-center p-1.5 rounded text-[8.5px] ${
                                    isSelf ? 'bg-indigo-950 border border-indigo-700/60 font-bold' : 'bg-slate-950/70'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-black ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                                      #{index + 1}
                                    </span>
                                    <span>{p.avatar || '🏎️'}</span>
                                    <span className="text-slate-300 truncate max-w-[110px]">{p.nickname}</span>
                                  </div>
                                  <span className="font-mono font-bold">
                                    {leaderboardTab === 'stars' ? (
                                      <span className="text-amber-400">⭐ {p.stars || 0}</span>
                                    ) : (
                                      <span className="text-teal-300">💎 {p.diamonds || 0}</span>
                                    )}
                                  </span>
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* VIEW: LOGO TEXT EDITOR */}
              {activeApp === 'server' && (
                <div className="flex-1 flex flex-col gap-4 text-left text-white">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Mã Chữ Logo Mới</span>
                    <p className="text-[8px] text-slate-400">Tùy biến nhãn tiêu đề đẹp hơn lướt ngang đầu màn hình, nhập chữ theo sở thích:</p>
                    
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text" 
                        value={customLogoText}
                        onChange={(e) => setCustomLogoText(e.target.value)}
                        placeholder="Nhập chữ logo..."
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-bold text-emerald-400 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="flex gap-1.5 mt-1">
                      <button 
                        onClick={() => { setCustomLogoText("FORD RAPTOR 3D"); showIslandNotification("✨ Đổi chữ logo thành công!"); }}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[8px] font-bold rounded text-slate-100 cursor-pointer text-center"
                      >
                        Raptor 3D
                      </button>
                      <button 
                        onClick={() => { setCustomLogoText("VINFAST VF9 PRO"); showIslandNotification("✨ Đổi chữ logo thành công!"); }}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[8px] font-bold rounded text-slate-100 cursor-pointer text-center"
                      >
                        Vinfast VF9
                      </button>
                      <button 
                        onClick={() => { setCustomLogoText("SIÊU XE ĐUA CYBER"); showIslandNotification("✨ Đổi chữ logo thành công!"); }}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[8px] font-bold rounded text-slate-100 cursor-pointer text-center"
                      >
                        Cyber Racer
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2.5">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Mã Phòng Server</span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={customMapConfig.roomCode || "SV-0391"}
                        onChange={(e) => onCustomMapConfigChange({ ...customMapConfig, roomCode: e.target.value })}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-[10px] font-mono text-cyan-300 font-bold outline-none"
                      />
                      <button 
                        onClick={() => {
                          const code = `SV-${Math.floor(1000 + Math.random() * 9000)}`;
                          onCustomMapConfigChange({ ...customMapConfig, roomCode: code });
                          showIslandNotification(`🎉 Generated Code: ${code}`);
                        }}
                        className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-[9px] font-bold text-white cursor-pointer"
                      >
                        Tạo SV
                      </button>
                    </div>
                    <span className="text-[7.5px] text-zinc-500 leading-normal">Mã phòng giúp đồng hành cùng các chủ server khác, hỗ trợ đồng bộ hóa block và bản đồ tức thì.</span>
                  </div>
                </div>
              )}

              {/* VIEW: GOOGLE ACCOUNT LOGIN */}
              {activeApp === 'google' && (
                <div className="flex-1 flex flex-col gap-4 text-center justify-center items-center text-white">
                  {gUser ? (
                    <div className="w-full bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col items-center gap-3">
                      <img 
                        src={gUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'} 
                        className="w-16 h-16 rounded-full border-2 border-indigo-400 object-cover shadow-lg referrerPolicy='no-referrer'" 
                        alt="google user"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-white leading-normal">{gUser.displayName || 'Google Racer'}</h3>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{gUser.email || 'developer.studio@google.com'}</p>
                      </div>

                      <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[9px] px-3 py-1 rounded-full w-full font-mono font-bold uppercase mt-1">
                        ● ĐÃ THÔNG THÔNG CHỨNG THƯỰC GOOGLE
                      </div>

                      <button
                        onClick={handleGoogleSignOut}
                        className="mt-2 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>ĐĂNG XUẤT</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full bg-slate-900/70 border border-slate-800 p-5 rounded-2xl flex flex-col items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                        <User className="w-8 h-8 text-indigo-400" />
                      </div>
                      
                      <div className="flex flex-col gap-1 p-1">
                        <h3 className="text-xs font-bold text-white">XÁC THỰC TÀI KHOẢN CLOUD</h3>
                        <p className="text-[8px] text-slate-400 leading-normal">Liên kết qua tài khoản Google nhanh để lưu điểm, cúp, và thành tích trực tiếp trên hệ thống BXH chính thức!</p>
                      </div>

                      <button
                        onClick={handleGoogleSignIn}
                        className="w-full py-3 bg-gradient-to-r from-red-500 via-indigo-600 to-amber-500 hover:from-red-400 hover:to-amber-400 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                      >
                        <LogIn className="w-4 h-4 fill-white" />
                        <span>ĐĂNG NHẬP VỚI GOOGLE</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[7.5px] text-zinc-500">
                    <span>Cổng bảo mật Google Firebase Authentication</span>
                  </div>
                </div>
              )}

              {/* VIEW: TRACKS AND MAP SELECTOR APP (NEW) */}
              {activeApp === 'maps_app' && (
                <div className="flex-1 flex flex-col gap-3 text-left text-white overflow-y-auto max-h-[380px] pr-1">
                  <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-2xl flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest font-mono">Hệ thống Bản Đồ Quốc Tế</span>
                    <p className="text-[8px] text-slate-400">Chọn chặng đua bạn muốn tải ngay lên server vệ tinh:</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {([
                      { id: 'grassland', name: 'Pine Forest 🌲', label: 'Vành Đai Thông Xanh', desc: 'Thung lũng cỏ bằng phẳng thơ mộng, dễ đi.', color: 'from-emerald-600 to-green-800' },
                      { id: 'desert_bumpy', name: 'Gobi Desert 🌵', label: 'Sa Mạc Cát Vàng', desc: 'Đồi cát nhấp nhô lượn sóng, Raptor cực khoái.', color: 'from-amber-600 to-orange-800' },
                      { id: 'mountain', name: 'Rocky Canyon ⛰️', label: 'Đèo Đá Cổ Độc', desc: 'Dốc đá cheo leo, góc cua hẹp, thách thức tổ lái.', color: 'from-slate-600 to-zinc-800' },
                      { id: 'racetrack', name: 'Midnight Circuit 🏁', label: 'Trường Đua Đêm', desc: 'Hệ thống đèn neon rực rỡ, bề mặt asphalt bám đường.', color: 'from-indigo-600 to-blue-800' },
                      { id: 'metropolis_city', name: 'Neo Metropolis 🏙️', label: 'Đô Thị Cyber', desc: 'Đường phố sầm uất bao quanh bởi cao ốc kính.', color: 'from-pink-600 to-rose-800' },
                      { id: 'countryside_village', name: 'Vietnam Village 🏡', label: 'Làng Quê Việt Nam', desc: 'Làng cổ Bắc Bộ, ruộng lúa thơ mộng, có người chăm chỉ gặt lúa.', color: 'from-emerald-700 to-amber-900' },
                      { id: 'snow_arctic', name: 'Glacier Outpost ❄️', label: 'Bắc Cực Băng Giá', desc: 'Bản đồ tuyết trắng, đường trơn trượt thử thách phanh ABS.', color: 'from-sky-400 to-blue-700' },
                      { id: 'volcano_lava', name: 'Lava Wasteland 🌋', label: 'Vương Quốc Núi Lửa', desc: 'Mặt đất magma rực rỡ nhiệt độ cao, nham thạch nóng bỏng.', color: 'from-red-600 to-orange-900' },
                      { id: 'ocean_atlantis', name: 'Sunken Atlantis 🌊', label: 'Đáy Biển Cổ Đại', desc: 'Cột đá cổ chìm dưới biển sâu xanh lam, san hô phát sáng kỳ ảo.', color: 'from-teal-600 to-cyan-800' },
                      { id: 'synth_wave_grid', name: 'Synth Outrun 🌆', label: 'Mạng Lưới Thập Niên 80', desc: 'Thế giới retro tương lai rực rỡ với kim tự tháp, tháp phát sáng.', color: 'from-purple-700 to-pink-700' },
                      { id: 'custom_map', name: 'Geomap Forge 🛠️', label: 'Địa Hình Tự Xây', desc: 'Thế giới trống trải tự do chỉnh sườn đồi, rãnh đá.', color: 'from-purple-600 to-fuchsia-800' }
                    ] as { id: TrackType; name: string; label: string; desc: string; color: string }[]).map((mObj) => {
                      const isSelected = selectedTrack === mObj.id;
                      return (
                        <button
                          key={mObj.id}
                          onClick={() => {
                            if (onTrackSelect) {
                              onTrackSelect(mObj.id);
                              soundEngine.playCheckpoint?.();
                              showIslandNotification(`📍 BẢN ĐỒ: ${mObj.name.toUpperCase()}`);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                            isSelected 
                              ? 'bg-slate-900 border-sky-400 text-white' 
                              : 'bg-slate-950/70 border-slate-900 text-slate-300 hover:border-slate-800'
                          }`}
                        >
                          <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${mObj.color} opacity-25 blur-md -z-10`} />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-white font-mono tracking-wide">{mObj.name}</span>
                            {isSelected && (
                              <span className="text-[7px] font-bold uppercase bg-sky-500 text-slate-950 px-1.5 py-0.2 rounded font-sans animate-pulse">ĐANG CHẠY</span>
                            )}
                          </div>
                          <span className="block text-[8.5px] font-bold text-sky-300 mt-0.5">{mObj.label}</span>
                          <p className="text-[7.5px] text-slate-400 mt-1 leading-normal">{mObj.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* CUSTOM MAP CONTROLLER (Only shows when custom_map is active) */}
                  {selectedTrack === 'custom_map' && (
                    <div className="bg-slate-900/80 border border-purple-900/40 p-3 rounded-2xl flex flex-col gap-2.5 mt-2">
                      <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider font-mono">🎛️ Chỉnh Đồi Núi Thời Gian Thực</span>
                      
                      {/* Hill height slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[7px] font-mono text-slate-400">
                          <span>Độ cao ngọn đồi:</span>
                          <span className="text-purple-400 font-bold">{customMapConfig.customHillHeight}m</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="18" 
                          step="1"
                          value={customMapConfig.customHillHeight}
                          onChange={(e) => onCustomMapConfigChange({
                            ...customMapConfig,
                            customHillHeight: Number(e.target.value)
                          })}
                          className="w-full accent-purple-500 h-1 bg-slate-950 rounded-lg outline-none cursor-pointer"
                        />
                      </div>

                      {/* Dune scale slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[7px] font-mono text-slate-400">
                          <span>Tốc độ lượn sóng:</span>
                          <span className="text-purple-400 font-bold">{customMapConfig.customDuneScale}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="20" 
                          step="1"
                          value={customMapConfig.customDuneScale}
                          onChange={(e) => onCustomMapConfigChange({
                            ...customMapConfig,
                            customDuneScale: Number(e.target.value)
                          })}
                          className="w-full accent-purple-500 h-1 bg-slate-950 rounded-lg outline-none cursor-pointer"
                        />
                      </div>

                      {/* Obstacle density slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[7px] font-mono text-slate-400">
                          <span>Mật độ Chướng ngại:</span>
                          <span className="text-purple-400 font-bold">{customMapConfig.customObstacleDensity} vật thể</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="30" 
                          step="2"
                          value={customMapConfig.customObstacleDensity}
                          onChange={(e) => onCustomMapConfigChange({
                            ...customMapConfig,
                            customObstacleDensity: Number(e.target.value)
                          })}
                          className="w-full accent-purple-500 h-1 bg-slate-950 rounded-lg outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: REMOTE CAR CONTROL APP (NEW) - INTEGRATED CENTRAL VIN COCKPIT */}
              {activeApp === 'vin_remote' && (
                <div className="flex-1 flex flex-col min-h-0 text-left overflow-hidden">
                  <VinCockpit
                    stats={stats}
                    damage={damage}
                    setDamage={setDamage}
                    playerMode={playerMode}
                    setPlayerMode={setPlayerMode}
                    isCarLocked={isCarLocked}
                    setIsCarLocked={setIsCarLocked}
                    carColor={carColor}
                    onColorSelect={onColorSelect}
                    embedded={true}
                  />
                </div>
              )}

              {/* VIEW: mochiAIC#3 SMART AUTO-DRIVE CO-PILOT (NEW) */}
              {activeApp === 'mochi_ai' && (
                <div className="flex-1 flex flex-col gap-3 min-h-0 text-slate-200">
                  {/* Cyber info header */}
                  <div className="bg-gradient-to-r from-fuchsia-950/40 to-indigo-950/40 border border-fuchsia-500/20 p-2 text-xs rounded-xl flex flex-col gap-1 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 font-extrabold text-fuchsia-300">
                        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 animate-pulse" />
                        <span>TRỢ LÝ TỰ LÁI mochiAIC#3</span>
                      </div>
                      <span className="text-[7px] font-mono text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                        ONLINE v2.5
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-400 leading-snug">
                       Hệ thống hỗ trợ tự bẻ lái từ xa do mochiAIC#3 đảm nhiệm. Chạm vào bất kỳ vị trí nào trên bản đồ ra-đa để ra lệnh cho AI bẻ lái xe VinFast lướt mây tới đó ngay!
                    </p>
                  </div>

                  {/* SMART COORDINATE AND ACTION SUMMARY WIDGET */}
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex flex-col gap-1 text-[9px] font-mono text-left">
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Vị Trí Hiện Tại:</span>
                      <strong className="text-cyan-400 font-bold">
                        X: {Math.round(stats.posX ?? 0)}, Z: {Math.round(stats.posZ ?? 0)}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Mục Tiêu Chỉ Định:</span>
                      <strong className={targetGPS ? "text-fuchsia-400 animate-pulse font-black" : "text-zinc-500"}>
                        {targetGPS ? `X: ${targetGPS.x}, Z: ${targetGPS.z}` : "Chưa Thiết Lập 🛰️"}
                      </strong>
                    </div>
                    {isAiDriving && (
                      <div className="mt-1 flex items-center justify-between bg-emerald-950/60 p-1.5 rounded border border-emerald-500/20 text-[9.5px] font-bold text-emerald-400 font-sans">
                        <span className="flex items-center gap-1 animate-pulse">
                          <Compass className="w-3 h-3 text-emerald-400 animate-spin" /> ĐANG TỰ LÁI AUTOPILOT...
                        </span>
                        <button
                          onClick={() => {
                            setIsAiDriving(false);
                            setTargetGPS(null);
                            soundEngine.playCheckpoint?.();
                            setAiChatLogs(prev => [
                              "🚨 [mochiAIC#3]: CHỦ NHÂN BẤM PHANH KHẨN CẤP! Hệ thống tự lái đã dừng điều chế tín hiệu.",
                              ...prev.slice(0, 15)
                            ]);
                            showIslandNotification("🚨 Mochi AI: Đã phanh xe dừng tự lái!");
                          }}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-mono text-[8px] font-bold cursor-pointer"
                        >
                          STOP AI
                        </button>
                      </div>
                    )}
                  </div>

                  {/* INTERACTIVE RADAR MAP CONTAINER */}
                  <div className="flex flex-col items-center justify-center p-1 bg-slate-950 border border-slate-800 rounded-2xl relative">
                    <div className="absolute top-1 left-2 text-[7px] font-mono font-bold text-fuchsia-400 flex items-center gap-1">
                      <span>📡 RADAR GPS ĐỊNH VỊ</span>
                    </div>
                    
                    {/* SVG INTERACTIVE RADAR */}
                    <svg
                      viewBox="0 0 220 220"
                      className="w-full aspect-square max-w-[190px] bg-slate-950/95 rounded-xl cursor-crosshair relative border border-fuchsia-500/10"
                      onClick={(e) => {
                        if (isAiAnalyzing || isAiDriving) {
                          showIslandNotification("🤖 mochiAIC#3 đang bận điều hành tự lái!");
                          return;
                        }

                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;

                        const svgX = (clickX / rect.width) * 220;
                        const svgY = (clickY / rect.height) * 220;

                        const targetX = Math.round((svgX - 110) * 1.8);
                        const targetZ = Math.round((svgY - 110) * 1.8);

                        setTargetGPS({ x: targetX, z: targetZ });
                        soundEngine.playUnlockSound?.();

                        setIsAiAnalyzing(true);
                        setAiChatLogs(prev => [
                          `🎯 [mochiAIC#3]: CHỈ ĐỊNH GPS: (X: ${targetX}, Z: ${targetZ}).`,
                          `🛰️ [mochiAIC#3]: Đang tiếp nhận ma trận địa hình, bẻ cánh sóng vi ba để tự lái...`,
                          ...prev.slice(0, 15)
                        ]);

                        setTimeout(() => {
                          setIsAiAnalyzing(false);
                          setIsAiDriving(true);
                          window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: true } }));
                          setAiChatLogs(prev => [
                            `🚗 [mochiAIC#3]: Động cơ VinFast điện khởi nổ! JETDRIVE AUTOPILOT KHỞI HÀNH...`,
                            ...prev.slice(0, 15)
                          ]);
                        }, 1200);
                      }}
                    >
                      {/* Gridlines */}
                      <circle cx="110" cy="110" r="100" fill="none" stroke="#a21caf" strokeWidth="0.2" strokeDasharray="3,3" />
                      <circle cx="110" cy="110" r="70" fill="none" stroke="#a21caf" strokeWidth="0.2" strokeDasharray="3,3" />
                      <circle cx="110" cy="110" r="40" fill="none" stroke="#a21caf" strokeWidth="0.2" strokeDasharray="3,3" />
                      <line x1="10" y1="110" x2="210" y2="110" stroke="#a21caf" strokeWidth="0.15" />
                      <line x1="110" y1="10" x2="110" y2="210" stroke="#a21caf" strokeWidth="0.15" />

                      {/* Landmarks background based on selectedTrack */}
                      {selectedTrack === 'metropolis_city' && (
                        <g opacity="0.15">
                          <rect x="30" y="30" width="45" height="45" fill="none" stroke="#8b5cf6" strokeWidth="0.5" />
                          <rect x="145" y="30" width="45" height="45" fill="none" stroke="#8b5cf6" strokeWidth="0.5" />
                          <rect x="30" y="145" width="45" height="45" fill="none" stroke="#8b5cf6" strokeWidth="0.5" />
                          <rect x="145" y="145" width="45" height="45" fill="none" stroke="#8b5cf6" strokeWidth="0.5" />
                        </g>
                      )}

                      {/* Custom Placed Blocks by player */}
                      {customMapConfig.placedBlocks?.map((blk) => {
                        const px = 110 + (blk.x / 1.8);
                        const py = 110 + (blk.z / 1.8);
                        if (px < 10 || px > 210 || py < 10 || py > 210) return null;
                        return (
                          <rect key={blk.id} x={px - 1.5} y={py - 1.5} width={3} height={3} fill="#f97316" rx="0.5" opacity="0.8" />
                        );
                      })}

                      {/* Checkpoints of active Track layout */}
                      {(() => {
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
                        return checkpoints.map((cp, idx) => {
                          const px = 110 + (cp.x / 1.8);
                          const py = 110 + (cp.z / 1.8);
                          if (px < 10 || px > 210 || py < 10 || py > 210) return null;
                          const isCurrent = idx === (stats.currentCheckpoint || 0);
                          return (
                            <circle
                              key={idx}
                              cx={px}
                              cy={py}
                              r={isCurrent ? 3.5 : 2}
                              fill={isCurrent ? "#fbbf24" : "#f59e0b"}
                              stroke="#ffffff"
                              strokeWidth={0.3}
                              className={isCurrent ? "animate-pulse" : ""}
                            />
                          );
                        });
                      })()}

                      {/* Player Walker mode reference */}
                      {playerMode === 'walking' && stats.walkerX !== undefined && (
                        <circle
                          cx={110 + ((stats.walkerX ?? 0) / 1.8)}
                          cy={110 + ((stats.walkerZ ?? 0) / 1.8)}
                          r={3}
                          fill="#ec4899"
                          stroke="#ffffff"
                          strokeWidth={0.5}
                        />
                      )}

                      {/* Main Player Car icon */}
                      {stats.posX !== undefined && (
                        <g>
                          {/* Pulsing target rings around car */}
                          <circle
                            cx={110 + ((stats.posX ?? 0) / 1.8)}
                            cy={110 + ((stats.posZ ?? 0) / 1.8)}
                            r={7}
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="0.3"
                            className="animate-pulse"
                            opacity="0.6"
                          />
                          <circle
                            cx={110 + ((stats.posX ?? 0) / 1.8)}
                            cy={110 + ((stats.posZ ?? 0) / 1.8)}
                            r={3}
                            fill="#06b6d4"
                            stroke="#ffffff"
                            strokeWidth={0.5}
                          />
                        </g>
                      )}

                      {/* Red crosshair selected target map pointer */}
                      {targetGPS && (
                        <g>
                          <circle
                            cx={110 + (targetGPS.x / 1.8)}
                            cy={110 + (targetGPS.z / 1.8)}
                            r={8}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="0.7"
                            className="animate-ping"
                          />
                          <circle
                            cx={110 + (targetGPS.x / 1.8)}
                            cy={110 + (targetGPS.z / 1.8)}
                            r={2.5}
                            fill="#ef4444"
                          />
                          <line
                            x1={110 + (targetGPS.x / 1.8) - 8}
                            y1={110 + (targetGPS.z / 1.8)}
                            x2={110 + (targetGPS.x / 1.8) + 8}
                            y2={110 + (targetGPS.z / 1.8)}
                            stroke="#ef4444"
                            strokeWidth="0.5"
                          />
                          <line
                            x1={110 + (targetGPS.x / 1.8)}
                            y1={110 + (targetGPS.z / 1.8) - 8}
                            x2={110 + (targetGPS.x / 1.8)}
                            y2={110 + (targetGPS.z / 1.8) + 8}
                            stroke="#ef4444"
                            strokeWidth="0.5"
                          />
                        </g>
                      )}
                    </svg>
                  </div>

                  {/* PRESET SUGGESTED LANDMARKS */}
                  <div className="flex flex-col gap-1 text-left bg-slate-900 border border-slate-850 p-2 rounded-xl shrink-0">
                    <span className="text-[7.5px] font-black font-sans text-zinc-400 tracking-wider">
                      📍 ĐỊA DANH ĐỊNH VỊ SẴN (AI TỰ LẤI):
                    </span>
                    <div className="grid grid-cols-3 gap-1 mt-0.5">
                      {(() => {
                        let presets = [{ name: "Khu Trung Tâm", x: 0, z: 0 }];
                        if (selectedTrack === 'grassland') {
                          presets = [
                            { name: "🌲 Rừng Thông", x: 0, z: 0 },
                            { name: "🏔️ Đỉnh Đồi", x: 60, z: -60 },
                            { name: "⛽ Trạm Xăng", x: -15, z: -15 },
                          ];
                        } else if (selectedTrack === 'desert_bumpy') {
                          presets = [
                            { name: "🌵 Ốc Đảo Gobi", x: 25, z: 30 },
                            { name: "🏜️ Đồi Cát Đỏ", x: -80, z: -50 },
                            { name: "🌌 Bãi Đá Cổ", x: 15, z: 15 },
                          ];
                        } else if (selectedTrack === 'mountain') {
                          presets = [
                            { name: "⛰️ Đỉnh Đèo Đá", x: 40, z: -50 },
                            { name: "🌪️ Vách Vực Sâu", x: -30, z: 65 },
                            { name: "🏕️ Khu Cắm Trại", x: 0, z: 5 },
                          ];
                        } else if (selectedTrack === 'racetrack') {
                          presets = [
                            { name: "🏎️ Góc Drift Grid#1", x: 0, z: -50 },
                            { name: "🏁 Vạch Đích", x: 45, z: 45 },
                            { name: "⛽ Bãi Tiếp Pin", x: -15, z: -15 },
                          ];
                        } else if (selectedTrack === 'metropolis_city') {
                          presets = [
                            { name: "🏙️ Đại Lộ Cyber", x: 0, z: 110 },
                            { name: "🏢 Tòa Tháp Đôi", x: 50, z: 50 },
                            { name: "🏬 Phố Nam Suites", x: -110, z: -110 },
                          ];
                        } else if (selectedTrack === 'countryside_village') {
                          presets = [
                            { name: "🏡 Sân Đình Cửa", x: -20, z: -20 },
                            { name: "🌾 Đầm Sen Thơm", x: 55, z: 40 },
                            { name: "🌉 Cầu Tre Sông", x: -60, z: 60 },
                          ];
                        } else if (selectedTrack === 'snow_arctic') {
                          presets = [
                            { name: "❄️ Trạm Băng Đăng", x: -40, z: 20 },
                            { name: "🐻 Đồi Gấu Cực", x: 45, z: -45 },
                            { name: "🏚️ Nhà Trú Ẩn", x: 10, z: -10 },
                          ];
                        } else if (selectedTrack === 'volcano_lava') {
                          presets = [
                            { name: "🌋 Miệng Núi Lửa", x: 0, z: 0 },
                            { name: "🔥 Hồ Nham Thạch", x: -65, z: 50 },
                            { name: "🧱 Đá Obsidian", x: 30, z: -35 },
                          ];
                        } else if (selectedTrack === 'ocean_atlantis') {
                          presets = [
                            { name: "🏰 Đền Cổ Thất Lạc", x: 45, z: -15 },
                            { name: "🪸 Vườn san hô phát sáng", x: -20, z: 40 },
                            { name: "🔱 Điện Poseidon", x: 0, z: -50 },
                          ];
                        } else if (selectedTrack === 'synth_wave_grid') {
                          presets = [
                            { name: "⚡ Tháp Kim Tự Tháp phát quang", x: 0, z: 0 },
                            { name: "🎆 Sườn đồi mây hồng", x: -45, z: 45 },
                            { name: "🌐 Cột điện từ trường", x: 30, z: -30 },
                          ];
                        }
                        return presets.map((preset, idx) => (
                          <button
                            key={idx}
                            disabled={isAiAnalyzing || isAiDriving}
                            onClick={() => {
                              setTargetGPS({ x: preset.x, z: preset.z });
                              soundEngine.playUnlockSound?.();
                              setIsAiAnalyzing(true);
                              setAiChatLogs(prev => [
                                `🚀 [mochiAIC#3]: CHỌN LANDMARK: [${preset.name}] (X: ${preset.x}, Z: ${preset.z})`,
                                `🛸 [mochiAIC#3]: Đặt tuyến bay Autopilot an toàn tới đích dốc...`,
                                ...prev.slice(0, 15)
                              ]);
                              setTimeout(() => {
                                setIsAiAnalyzing(false);
                                setIsAiDriving(true);
                                window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: true } }));
                                setAiChatLogs(prev => [
                                  `🚗 [mochiAIC#3]: Lăn bánh rầm rập! Khởi động hành trình tự lái tới: [${preset.name}]!`,
                                  ...prev.slice(0, 15)
                                ]);
                              }, 1200);
                            }}
                            className="px-1.5 py-1 bg-slate-850 hover:bg-slate-700 text-[8px] font-bold rounded text-fuchsia-300 border border-slate-800 hover:border-fuchsia-500/30 text-center truncate transition-all"
                          >
                            {preset.name}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* MONITOR LOGS */}
                  <div className="bg-slate-950 border border-slate-900 p-2 rounded-xl flex-1 overflow-y-auto flex flex-col gap-0.5 text-[8px] font-mono">
                    <div className="font-bold text-fuchsia-400 border-b border-fuchsia-950/50 pb-1 mb-1 flex items-center justify-between">
                      <span>💬 MOCHI CHAT MONITOR</span>
                      {isAiAnalyzing && <span className="text-[7px] text-fuchsia-400 animate-pulse">🛰️ ĐANG RÀ QUÉT...</span>}
                      {isAiDriving && <span className="text-[7px] text-emerald-400 animate-pulse">● AUTOPILOT SẴN SÀNG</span>}
                    </div>
                    {aiChatLogs.map((log, i) => (
                      <p key={i} className="leading-relaxed text-left break-words border-b border-slate-900/10 text-zinc-400">{log}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW: CH PLAY STORE APP */}
              {activeApp === 'ch_play' && (
                <div className="flex-1 flex flex-col min-h-0 text-slate-200">
                  {/* Play store header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-sky-700 p-3 rounded-xl flex items-center justify-between border border-emerald-500/25 shrink-0 shadow-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-1.5 bg-white text-emerald-600 rounded-lg text-[9px] font-black shadow tracking-tighter">CH</div>
                      <span className="text-xs font-black tracking-wide font-sans text-white">CH Play Store</span>
                    </div>
                    <span className="text-[7.5px] bg-slate-950/50 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-400/20 uppercase tracking-wider animate-pulse font-mono">
                      v26.9 SAFE
                    </span>
                  </div>

                  {/* Search and Category buttons */}
                  <div className="flex flex-col gap-2 my-2 shrink-0">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                      <input 
                        type="text" 
                        placeholder="Tìm kiếm ứng dụng, trò chơi..." 
                        value={playStoreSearchText}
                        onChange={(e) => setPlayStoreSearchText(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-800 text-[10px] text-slate-100 placeholder-slate-500 rounded-xl py-1.5 pl-8 pr-3 outline-none focus:border-emerald-500/50 transition-colors font-sans animate-pulse"
                      />
                    </div>
                  </div>

                  {/* Catalog list container */}
                  <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2.5">
                    {(() => {
                      // We list our extensive catalog
                      const CATALOG = [
                        { id: 'remode_xc', name: 'RemodeXC Pro ⚡', category: 'Thiết bị & Tiện ích', cost: 'Miễn phí', desc: 'App bẻ chuyển động và lái siêu xe đẳng cấp từ xa dốc mượt, có tiến lùi bám đường ko va chạm.', bg: 'from-amber-500 to-rose-600', isCore: false },
                        { id: 'mochi_ai', name: 'mochiAIC#3 🤖', category: 'AI & Trợ lý cá nhân', cost: 'Độc quyền VIP', desc: 'Bộ chỉ đạo lái xe tự động né chướng ngại bằng sóng radar vi ba cao tần 4.0.', bg: 'from-cyan-600 via-indigo-600 to-fuchsia-600', isCore: true },
                        { id: 'youtube_car', name: 'YouTube VR 📺', category: 'Giải trí & Media', cost: 'Miễn phí', desc: 'Phát phim tài liệu đua xe lướt mây siêu đẹp, có kèm lofi synthesizer cực hay.', bg: 'from-red-600 to-rose-700', isCore: false },
                        { id: 'spotify_music', name: 'Spotify Sound 🎵', category: 'Âm nhạc & Sound', cost: 'Miễn phí', desc: 'Trình điều hành đài FM và EDM bốc lửa lúc drift trên đường trường đầy phong thái.', bg: 'from-green-600 to-emerald-800', isCore: false },
                        { id: 'racing_stats', name: 'Telemetry Pro 📊', category: 'Công cụ GPS', cost: 'Miễn phí', desc: 'Khảo sát đồ thị gia tốc, lực phanh, mô-men xoắn, rpm động cơ xe thực tế.', bg: 'from-cyan-600 to-blue-800', isCore: false },
                        { id: 'weather_sky', name: 'Thời Tiết 4D ⛈️', category: 'Hệ thống Khí quyển', cost: 'Miễn phí', desc: 'Vặn đổi thời tiết sân thượng: mặt trời nắng vàng, sấm chớp, tuyết rơi hoặc đêm neon rực rỡ.', bg: 'from-sky-500 to-indigo-700', isCore: false },
                        { id: 'safari_web', name: 'Safari Web 🌐', category: 'Trình duyệt Web', cost: 'Miễn phí', desc: 'Trình duyệt tìm kiếm tin tức ô tô xe cộ, lướt web tốc độ cao siêu an toàn.', bg: 'from-blue-500 to-sky-600', isCore: false },
                        { id: 'photo_gallery', name: 'Gallery Ảnh 🖼️', category: 'Đồ họa & Hình ảnh', cost: 'Miễn phí', desc: 'Bộ sưu tập ảnh phượt siêu xe độ, lưu giữ khoảnh khắc drift xe đỉnh cao.', bg: 'from-purple-500 to-indigo-600', isCore: false },
                        { id: 'tiktok_short', name: 'TikTok Short 🎥', category: 'Video Ngắn', cost: 'Miễn phí', desc: 'Xem video giải trí ngắn về đua xe nghệ thuật tốc độ cao sầm uất.', bg: 'from-slate-900 to-slate-800', isCore: false },
                        { id: 'calculator_pro', name: 'Máy Tính Pro 🧮', category: 'Tính toán & Công cụ', cost: 'Miễn phí', desc: 'Tính toán chi phí nạp rút tiền vàng, quy chuẩn tỷ lệ đổi xu VND.', bg: 'from-amber-600 to-amber-500', isCore: false },
                        { id: 'clock_stopwatch', name: 'Stopwatch ⏱️', category: 'Thời gian', cost: 'Miễn phí', desc: 'Đồng hồ bấm giờ tính thành tích đo vòng đua xe drift chuyên nghiệp.', bg: 'from-slate-800 to-slate-700', isCore: false },
                        { id: 'game_pacman', name: 'Pacman Arcade 🕹️', category: 'Trò chơi giải trí', cost: 'Miễn phí', desc: 'Game ăn chấm tròn Pacman tuổi thơ cổ điển ngay trong buồng lái.', bg: 'from-yellow-600 to-yellow-500', isCore: false },
                        { id: 'chat_gp_mochi', name: 'GPT Mochi 💬', category: 'AI & Trò chuyện', cost: 'Miễn phí', desc: 'Trình trợ lý trò chuyện thông minh phản hồi tiếng Việt siêu tự nhiên 24/7.', bg: 'from-pink-600 to-pink-500', isCore: false },
                        { id: 'backpack', name: 'Balo Đồ Game 🎒', category: 'Trò chơi & Vật phẩm', cost: 'Mặc định', desc: 'Kho lưu trữ và túi đồ nghề cứu hộ lốp xe khẩn cấp.', bg: 'from-amber-600 to-amber-800', isCore: true },
                        { id: 'bank', name: 'V-Bank MB 🏦', category: 'Tài chính & Pay', cost: 'Mặc định', desc: 'Ngân hàng lưu trữ biến động tiền vàng drift gặt hái được.', bg: 'from-amber-500 to-yellow-600', isCore: true },
                        { id: 'codes_app', name: 'Nhập Code 👑', category: 'Mã Quà Tặng', cost: 'Mặc định', desc: 'Hộp nạp mã khuyến mãi quà tặng nhận lì xì khai xuân.', bg: 'from-teal-600 to-emerald-700', isCore: true },
                        { id: 'maps_app', name: 'Bản Đồ CO 🗺️', category: 'Địa hình', cost: 'Mặc định', desc: 'Lựa chọn thay đổi giữa 10 cấu hình bản đồ từ Việt Nam tới hải đảo Atlantis cổ đại.', bg: 'from-sky-600 to-blue-700', isCore: true }
                      ];

                      const filtered = playStoreSearchText 
                        ? CATALOG.filter(app => app.name.toLowerCase().includes(playStoreSearchText.toLowerCase()) || app.desc.toLowerCase().includes(playStoreSearchText.toLowerCase()))
                        : CATALOG;

                      if (filtered.length === 0) {
                        return (
                          <div className="py-8 text-center text-slate-500 text-[10px] font-sans">
                            Không tìm thấy ứng dụng phù hợp 🥺
                          </div>
                        );
                      }

                      return filtered.map(app => {
                        const isInstalled = installedApps.includes(app.id);
                        const progress = downloadingProgress[app.id];
                        const isDownloading = progress !== undefined;

                        return (
                          <div key={app.id} className="bg-slate-900/65 border border-slate-850 p-2 rounded-xl flex items-start gap-2 hover:bg-slate-900 transition-colors">
                            {/* App badge icon visual */}
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${app.bg} flex items-center justify-center text-white font-extrabold shadow-md shrink-0 mt-0.5`}>
                              <span className="text-xs">
                                {app.id === 'remode_xc' && '⚡'}
                                {app.id === 'mochi_ai' && '🤖'}
                                {app.id === 'youtube_car' && '📺'}
                                {app.id === 'spotify_music' && '🎵'}
                                {app.id === 'racing_stats' && '📊'}
                                {app.id === 'weather_sky' && '⛈️'}
                                {app.id === 'safari_web' && '🌐'}
                                {app.id === 'photo_gallery' && '🖼️'}
                                {app.id === 'tiktok_short' && '🎥'}
                                {app.id === 'calculator_pro' && '🧮'}
                                {app.id === 'clock_stopwatch' && '⏱️'}
                                {app.id === 'game_pacman' && '🕹️'}
                                {app.id === 'chat_gp_mochi' && '💬'}
                                {app.id === 'backpack' && '🎒'}
                                {app.id === 'bank' && '🏦'}
                                {app.id === 'codes_app' && '🔑'}
                                {app.id === 'maps_app' && '🗺️'}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-left pl-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-white truncate">{app.name}</span>
                                <span className="text-[7px] text-zinc-500 bg-slate-950 px-1 py-0.5 rounded font-mono font-bold shrink-0">{app.cost}</span>
                              </div>
                              <span className="text-[7.5px] font-bold text-teal-400 block tracking-tight font-sans mt-0.5">{app.category}</span>
                              <p className="text-[8px] text-slate-400 font-sans leading-snug mt-1">{app.desc}</p>

                              {/* Progress bar overlay if downloading */}
                              {isDownloading && (
                                <div className="mt-2 text-[8px] font-bold text-teal-400 font-mono">
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="animate-pulse">Đóng gói tải xuống...</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-400 rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons row */}
                              <div className="mt-2 flex items-center gap-1 justify-end">
                                {isInstalled ? (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setActiveApp(app.id as any);
                                        soundEngine.playUnlockSound?.();
                                      }}
                                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[8px] font-black rounded text-emerald-400 flex items-center gap-0.5 cursor-pointer border border-emerald-400/20"
                                    >
                                      <span>MỞ APP</span>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        soundEngine.playCheckpoint?.();
                                        setInstalledApps(prev => prev.filter(id => id !== app.id));
                                        showIslandNotification(`🗑️ Đã xóa ứng dụng ${app.name}!`);
                                      }}
                                      className="px-1.5 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-500/20 text-rose-400 text-[8px] font-black rounded flex items-center gap-0.5 cursor-pointer"
                                      title="Uninstall"
                                    >
                                      <Trash2 className="w-2 h-2 text-rose-400" /> <span>XÓA</span>
                                    </button>
                                  </>
                                ) : (
                                  !isDownloading && (
                                    <button 
                                      onClick={() => {
                                        if (downloadingProgress[app.id] !== undefined) return;
                                        soundEngine.playUnlockSound?.();
                                        let progress = 0;
                                        setDownloadingProgress(prev => ({ ...prev, [app.id]: 0 }));
                                        const interval = setInterval(() => {
                                          progress += Math.floor(Math.random() * 20) + 15;
                                          if (progress >= 100) {
                                            progress = 100;
                                            clearInterval(interval);
                                            setDownloadingProgress(prev => {
                                              const copy = { ...prev };
                                              delete copy[app.id];
                                              return copy;
                                            });
                                            setInstalledApps(prev => {
                                              if (prev.includes(app.id)) return prev;
                                              return [...prev, app.id];
                                            });
                                            showIslandNotification(`🎉 Cài đặt thành công: ${app.name}`);
                                          } else {
                                            setDownloadingProgress(prev => ({ ...prev, [app.id]: progress }));
                                          }
                                        }, 150);
                                      }}
                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[8px] rounded flex items-center gap-0.5 shadow cursor-pointer border border-emerald-400/30"
                                    >
                                      <Download className="w-2.5 h-2.5 text-white animate-bounce" /> <span>TẢI VỀ</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* VIEW: REMODEXC PRO APP COCKPIT CONTROLLER */}
              {activeApp === 'remode_xc' && (
                <div className="flex-1 flex flex-col min-h-0 text-slate-200">
                  {/* Neon display top panel */}
                  <div className="bg-slate-900 border border-amber-500/30 p-2 text-xs rounded-xl flex flex-col gap-1 text-left relative overflow-hidden shrink-0 shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
                    <div className="flex justify-between items-center z-10">
                      <span className="text-[10px] font-black tracking-wide text-amber-400 font-sans flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> REMODEXC PRO OS
                      </span>
                      <span className="text-[7px] font-mono text-amber-400 bg-amber-950/65 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                        SÓNG ĐIỀU CHẾ KHÔNG GIỚI HẠN
                      </span>
                    </div>
                    <p className="text-[7.5px] text-zinc-400 leading-normal z-10">
                      Bộ bẻ lái cao cấp từ xa lướt mây an toàn. Động cơ tự bám đường ko lo va chạm cơ bản. Tiến lùi nhạy bén!
                    </p>
                  </div>

                  {/* SPEED TELEMETRY PANEL WIDGET */}
                  <div className="grid grid-cols-2 gap-1.5 my-2 shrink-0">
                    <div className="bg-slate-950 p-1.5 border border-slate-850 rounded-xl text-center flex flex-col justify-center">
                      <span className="text-[7px] text-zinc-500 font-mono font-bold tracking-wider">VẬN TỐC HIỆN TẠI</span>
                      <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                        <span className="text-xl font-bold text-amber-400 font-mono animate-pulse">
                          {Math.round(Math.abs(stats.speed ?? 0) * 3.6)}
                        </span>
                        <span className="text-[7.5px] text-zinc-400 font-bold font-mono">km/h</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 p-1.5 border border-slate-850 rounded-xl text-center flex flex-col justify-center">
                      <span className="text-[7px] text-zinc-500 font-mono font-bold tracking-wider">KHOẢNG CÁCH GPS</span>
                      <div className="text-[8px] font-mono text-cyan-400 font-bold mt-0.5">
                        X: {Math.round(stats.posX ?? 0)}, Z: {Math.round(stats.posZ ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* STEERING & STEER TOUCH CONTROLS */}
                  <div className="flex-1 flex flex-col justify-between p-1 bg-slate-950 border border-slate-850 rounded-2xl relative my-1 select-none">
                    <div className="text-[7px] font-mono font-bold text-amber-400 absolute top-1.5 left-2 flex items-center gap-0.5 z-10">
                      <span>🕹️ PHÍM SỐ BẺ HƯỚNG TỪ XA:</span>
                    </div>

                    <div className="w-full flex-1 flex flex-col items-center justify-center gap-1.5 py-4">
                      {/* Row 1: Forward */}
                      <button
                        onMouseDown={() => {
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'forward' } }));
                        }}
                        onMouseUp={() => {
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'forward' } }));
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                        }}
                        className="w-14 h-11 bg-slate-900 border-2 border-amber-500/40 text-amber-400 font-black text-xs rounded-xl shadow active:bg-amber-500 hover:bg-slate-800 transition-colors flex flex-col items-center justify-center cursor-pointer select-none"
                      >
                        <span className="text-[8px] text-amber-300 font-mono block">▲</span>
                        <span>TIẾN</span>
                      </button>

                      {/* Row 2: Steering Left / Right */}
                      <div className="flex items-center justify-center gap-9 w-full">
                        <button
                          onMouseDown={() => {
                            soundEngine.playUnlockSound?.();
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'left' } }));
                          }}
                          onMouseUp={() => {
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            soundEngine.playUnlockSound?.();
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'left' } }));
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                          }}
                          className="w-14 h-11 bg-slate-900 border-2 border-amber-500/40 text-amber-400 font-black text-xs rounded-xl shadow active:bg-amber-500 hover:bg-slate-800 transition-colors flex flex-col items-center justify-center cursor-pointer select-none"
                        >
                          <span className="text-[8px] text-amber-300 font-mono block">◀</span>
                          <span>TRÁI</span>
                        </button>

                        <button
                          onClick={() => {
                            soundEngine.playLockSound?.();
                            window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: false } }));
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                          }}
                          className="w-11 h-11 bg-rose-950 border border-red-500 text-red-400 font-mono font-black text-[9px] rounded-full shadow active:bg-red-500 hover:bg-red-900 transition-colors flex items-center justify-center cursor-pointer select-none"
                        >
                          STOP
                        </button>

                        <button
                          onMouseDown={() => {
                            soundEngine.playUnlockSound?.();
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'right' } }));
                          }}
                          onMouseUp={() => {
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            soundEngine.playUnlockSound?.();
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'right' } }));
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                          }}
                          className="w-14 h-11 bg-slate-900 border-2 border-amber-500/40 text-amber-400 font-black text-xs rounded-xl shadow active:bg-amber-500 hover:bg-slate-800 transition-colors flex flex-col items-center justify-center cursor-pointer select-none"
                        >
                          <span className="text-[8px] text-amber-300 font-mono block">▶</span>
                          <span>PHẢI</span>
                        </button>
                      </div>

                      {/* Row 3: Reverse */}
                      <button
                        onMouseDown={() => {
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'reverse' } }));
                        }}
                        onMouseUp={() => {
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'reverse' } }));
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: null } }));
                        }}
                        className="w-14 h-11 bg-slate-900 border-2 border-amber-500/40 text-amber-400 font-black text-xs rounded-xl shadow active:bg-amber-500 hover:bg-slate-800 transition-colors flex flex-col items-center justify-center cursor-pointer select-none"
                      >
                        <span>LÙI</span>
                        <span className="text-[8px] text-amber-300 font-mono block">▼</span>
                      </button>
                    </div>

                    {/* DUAL MODE SELECTORS */}
                    <div className="grid grid-cols-2 gap-1 px-1.5 pb-1.5 mt-auto">
                      <button
                        onClick={() => {
                          soundEngine.playCheckpoint?.();
                          // Coordinate drive simulation
                          let presets = { x: 0, z: 0 };
                          if (selectedTrack === 'racetrack') {
                            presets = { x: 0, z: -50 };
                          } else if (selectedTrack === 'metropolis_city') {
                            presets = { x: 50, z: 50 };
                          } else {
                            presets = { x: 15, z: 25 };
                          }
                          window.dispatchEvent(new CustomEvent('game-ai-drive-to', { detail: { x: presets.x, z: presets.z } }));
                          showIslandNotification("🤖 RemodeXC: BẬT AUTOPILOT LƯỚT MÂY!");
                        }}
                        className="p-1 px-2 bg-gradient-to-r from-amber-500/25 to-orange-500/30 border border-amber-400/40 hover:border-amber-450 text-amber-300 hover:text-white font-sans font-black text-[8px] rounded-lg text-center transition-all cursor-pointer"
                      >
                        ☄️ LÁI TỰ ĐỘNG SMART
                      </button>

                      <button
                        onClick={() => {
                          soundEngine.playLockSound?.();
                          window.dispatchEvent(new CustomEvent('game-remote-command', { detail: { command: 'stop' } }));
                          window.dispatchEvent(new CustomEvent('game-toggle-engine', { detail: { state: false } }));
                          showIslandNotification("🚨 LẬP TỨC PHANH CHÁY LỐP!");
                        }}
                        className="p-1 px-2 bg-red-950/60 border border-red-500 hover:bg-red-900 text-red-400 hover:text-white font-sans font-black text-[8px] rounded-lg text-center transition-all cursor-pointer"
                      >
                        🛑 PHANH CHÁY LỐP (STOP)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: YOUTUBE CAR MEDIA PLAYER */}
              {activeApp === 'youtube_car' && (
                <div className="flex-1 flex flex-col min-h-0 text-slate-200">
                  <div className="bg-red-650 p-2 text-white font-black text-xs rounded-xl flex items-center gap-1 shrink-0 shadow-md border border-red-400/20">
                    <Play className="w-4 h-4 fill-white text-red-600 animate-pulse" />
                    <span>YouTube Drive VR 📺</span>
                  </div>

                  {/* Player mock screen */}
                  <div className="w-full aspect-video bg-black rounded-xl border border-slate-800 my-2.5 overflow-hidden flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-cover bg-center opacity-85 hover:scale-105 transition-transform" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=450')` }} />
                    <div className="absolute inset-0 bg-slate-950/40" />
                    <div className="z-10 flex flex-col items-center text-center p-2">
                      <Play 
                        onClick={() => {
                          soundEngine.playUnlockSound?.();
                          showIslandNotification("🎵 Đang phát Lofi Racing Chill trong cabin xe...");
                        }}
                        className="w-10 h-10 text-white bg-red-600 p-2 rounded-full cursor-pointer animate-bounce hover:scale-110 active:scale-95 transition-transform shadow-lg" 
                      />
                      <span className="text-[8.5px] font-sans font-bold text-white mt-1.5 drop-shadow-md">VinFast VF8 Drift cực điệu nghệ trên đồi tuyết</span>
                      <span className="text-[7px] text-zinc-300 font-mono">1.2 triệu lượt xem • 2 ngày trước</span>
                    </div>
                  </div>

                  {/* Comments mock list */}
                  <div className="bg-slate-950 border border-slate-900 p-2 rounded-xl flex-1 overflow-y-auto flex flex-col gap-1.5 text-left text-[8px] font-sans">
                    <span className="font-extrabold text-white text-[8.5px]">BÌNH LUẬN NỔI BẬT (55):</span>
                    <p className="border-b border-slate-900 pb-0.5"><b className="text-amber-400">@viet_drift:</b> Xe chạy bám đường quá lướt mây tiến lùi ko va chạm!</p>
                    <p className="border-b border-slate-900 pb-0.5"><b className="text-sky-400">@remode_fan:</b> Thích app RemodeXC trên iPhone 16 ghê, bẻ lái phê từ xa.</p>
                    <p className="border-b border-slate-900 pb-0.5"><b className="text-emerald-400">@vin_fast:</b> Hệ Autopilot bẻ tránh hẹp đỉnh thực sự 💯</p>
                  </div>
                </div>
              )}

              {/* VIEW: SPOTIFY PLAY SOUND FM CONTROL */}
              {activeApp === 'spotify_music' && (
                <div className="flex-1 flex flex-col min-h-0 text-slate-200">
                  <div className="bg-emerald-600 p-2 text-white font-black text-xs rounded-xl flex items-center gap-1 shrink-0 shadow-md border border-emerald-400/20">
                    <Music className="w-4 h-4 text-white animate-spin" />
                    <span>Spotify Car Sound 🎵</span>
                  </div>

                  {/* Album Cover vinyl mock */}
                  <div className="flex flex-col items-center justify-center py-4 bg-slate-950 rounded-xl my-2.5 border border-slate-850">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-4 border-emerald-500/50 flex items-center justify-center relative animate-spin">
                      <Disc className="w-7 h-7 text-emerald-400 absolute animate-pulse" />
                      <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-800 z-10" />
                    </div>
                    <span className="text-[9.5px] font-sans font-bold text-white mt-2.5">Vietnam Drift Racing Hits (Remix)</span>
                    <span className="text-[7.5px] text-zinc-500 font-mono mt-0.5">Spotify Premium Playback</span>
                  </div>

                  {/* Sound equalizer mock bars */}
                  <div className="flex items-end justify-center gap-1 h-8 bg-slate-900/50 p-1.5 rounded-lg border border-slate-850 shrink-0">
                    <div className="w-1.5 bg-emerald-500 rounded animate-pulse" style={{ height: '70%' }} />
                    <div className="w-1.5 bg-emerald-400 rounded animate-pulse" style={{ height: '40%' }} />
                    <div className="w-1.5 bg-emerald-500 rounded animate-pulse" style={{ height: '90%' }} />
                    <div className="w-1.5 bg-green-500 rounded animate-pulse" style={{ height: '50%' }} />
                    <div className="w-1.5 bg-emerald-400 rounded animate-pulse" style={{ height: '80%' }} />
                  </div>
                </div>
              )}

              {/* VIEW: TELEMETRY PRO VEHICLE STATS */}
              {activeApp === 'racing_stats' && (
                <div className="flex-1 flex flex-col min-h-0 text-slate-200">
                  <div className="bg-cyan-600 p-2 text-white font-black text-xs rounded-xl flex items-center gap-1 shrink-0 shadow-md border border-cyan-450/20">
                    <Activity className="w-4 h-4 text-white animate-pulse" />
                    <span>Telemetry Diagnostics 📊</span>
                  </div>

                  {/* Live SVG speed chart plotting */}
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-2 my-2.5 flex-1 relative flex flex-col text-left">
                    <span className="text-[7px] text-zinc-500 font-mono font-bold uppercase">ĐỒ THỊ GIA TỐC HÀNH TRÌNH (RPM / SPEED):</span>
                    
                    <div className="w-full flex-1 min-h-[140px] flex items-end justify-between border-b border-l border-slate-800 p-2 mt-1 relative">
                      {/* Grid background */}
                      <div className="absolute inset-x-0 top-1/4 bottom-0 border-t border-slate-900/40 border-dashed pointer-events-none" />
                      <div className="absolute inset-x-0 top-1/2 bottom-0 border-t border-slate-900/40 border-dashed pointer-events-none" />
                      <div className="absolute inset-x-0 top-3/4 bottom-0 border-t border-slate-900/40 border-dashed pointer-events-none" />

                      {/* Mocked bar columns representing coordinates acceleration logs */}
                      <div className="w-2.5 h-1/4 bg-cyan-500/20 rounded-t" />
                      <div className="w-2.5 h-1/3 bg-cyan-500/30 rounded-t" />
                      <div className="w-2.5 h-1/2 bg-cyan-500/50 rounded-t" />
                      <div className="w-2.5 h-2/3 bg-cyan-500/60 rounded-t" />
                      <div className="w-2.5 h-3/4 bg-cyan-500/80 rounded-t animate-pulse" />
                      <div className="w-2.5 h-[95%] bg-cyan-400 rounded-t animate-bounce" />
                    </div>

                    <div className="flex justify-between items-center text-[7px] font-mono text-zinc-500 mt-1">
                      <span>0.0s START</span>
                      <span>HÀNH TRÌNH DRIFT LÀM CHỦ ĐẤT ĐAI</span>
                      <span>LIVE TELEM</span>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: THỜI TIẾT 4D CLIMATE CONTROLLER */}
              {activeApp === 'weather_sky' && (
                <div className="flex-1 flex flex-col min-h-0 text-slate-200">
                  <div className="bg-indigo-950 border border-indigo-500/20 p-2 text-indigo-300 font-black text-xs rounded-xl flex items-center gap-1 shrink-0 shadow-md">
                    <CloudSun className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span>Thời Tiết Vực Thẳm 4D ⛈️</span>
                  </div>

                  {/* Active weather status card */}
                  <div className="bg-slate-900 border border-indigo-500/20 p-2.5 rounded-xl text-center flex flex-col gap-1 my-3 text-left relative overflow-hidden">
                    <span className="text-[7.5px] text-zinc-400 font-bold uppercase tracking-wider block">KHÍ QUYỂN BAO PHỦ:</span>
                    <strong className="text-base text-indigo-300 font-sans tracking-wide">
                      {selectedTrack === 'snow_arctic' ? "❄️ Bắc Cực Tuyết Phủ Trắng Bản Đồ" : "⛅ Nhiệt Đới Gió Mùa Đồi Cát"}
                    </strong>
                    <div className="text-[8px] font-mono mt-1 text-slate-400">
                      Nhiệt độ: <b className="text-white font-bold">19.5°C</b> | Độ ẩm: <b className="text-white font-bold">68%</b> | Gió bão: <b className="text-emerald-400 font-bold">Cấp 4</b>
                    </div>
                  </div>

                  {/* Interactive weather buttons */}
                  <div className="bg-slate-950 border border-slate-850 p-2 rounded-xl flex-1 flex flex-col gap-2 justify-center">
                    <span className="text-[7px] font-mono font-bold text-indigo-400 text-left">CHỌN PHƯƠNG ÁN THỜI TIẾT KHÍ TƯỢNG:</span>
                    
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        onClick={() => {
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-set-weather', { detail: { weather: 'sunny' } }));
                          showIslandNotification("☀️ THỜI TIẾT: Chuyển nắng gắt trong vắt!");
                        }}
                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl text-[8.5px] font-sans font-black text-amber-400 flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>☀️ NẮNG TRONG</span>
                      </button>

                      <button
                        onClick={() => {
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-set-weather', { detail: { weather: 'rain' } }));
                          showIslandNotification("🌧️ THỜI TIẾT: Chuyển sấm chớp bão bùng!");
                        }}
                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl text-[8.5px] font-sans font-black text-indigo-400 flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>🌧️ MƯA SẤM BÃO</span>
                      </button>

                      <button
                        onClick={() => {
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-set-weather', { detail: { weather: 'snow' } }));
                          showIslandNotification("❄️ THỜI TIẾT: Chuyển tuyết rơi phủ trắng đường!");
                        }}
                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl text-[8.5px] font-sans font-black text-sky-400 flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>❄️ TUYẾT RƠI</span>
                      </button>

                      <button
                        onClick={() => {
                          soundEngine.playUnlockSound?.();
                          window.dispatchEvent(new CustomEvent('game-set-weather', { detail: { weather: 'sunset' } }));
                          showIslandNotification("🌌 THỜI TIẾT: Chuyển hoàng hôn tím neon!");
                        }}
                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl text-[8.5px] font-sans font-black text-fuchsia-400 flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>🌌 TÍM NEON</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* SCREEN HOME BUTTON FOOTER */}
            <div className="w-full h-8 bg-black/80 flex items-center justify-center shrink-0">
              <button 
                onClick={() => { setActiveApp('home'); soundEngine.playUnlockSound?.(); }}
                className="w-24 h-1 bg-slate-500 rounded-full hover:bg-white transition-colors cursor-pointer"
                title="Quay về Home Screen"
              />
            </div>

            {/* Dynamic Close X top-button overlay */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-4 z-45 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1 rounded-full transition-colors scale-75 cursor-pointer"
              title="Đóng điện thoại"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
