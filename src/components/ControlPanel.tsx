import React, { useState, useEffect } from 'react';
import { TrackType, CarType, WeatherType, PhysicsConfig, CustomCarSpecs, CharacterConfig, CustomMapConfig, GameStats } from '../types';
import { 
  Sliders, Sun, Car, Paintbrush, HelpCircle, Settings, User, Map, Trophy, 
  Sparkles, Share2, Compass, Users, Flame, Lightbulb, Keyboard, LogIn, Check, RefreshCw
} from 'lucide-react';
import { savePlayerStats, getLeaderboard, LeaderboardUser, publishCustomRoom, subscribeToRoom, sendHeartbeatToRoom, CustomMapRoom } from '../lib/firebase';

interface ControlPanelProps {
  selectedCar: CarType;
  onCarSelect: (car: CarType) => void;
  carColor: string;
  onColorSelect: (color: string) => void;
  selectedTrack: TrackType;
  onTrackSelect: (track: TrackType) => void;
  weather: WeatherType;
  onWeatherSelect: (weather: WeatherType) => void;
  physicsConfig: PhysicsConfig;
  onPhysicsChange: (config: PhysicsConfig) => void;
  customCarSpecs: CustomCarSpecs;
  onCustomCarSpecsChange: (specs: CustomCarSpecs) => void;

  // New features: Character Editor & Custom Map Config
  characterConfig: CharacterConfig;
  onCharacterConfigChange: (config: CharacterConfig) => void;
  customMapConfig: CustomMapConfig;
  onCustomMapConfigChange: (config: CustomMapConfig) => void;

  // Game stats for highscore calculations
  stats: GameStats;
  damage: number;
  onTriggerHeadlightsToggle?: (enabled: boolean) => void;
  hideToggle?: boolean;
}

const colorsList = [
  { hex: '#ff5722', label: 'Cam Neon' },
  { hex: '#00ff66', label: 'Xanh Cyber' },
  { hex: '#e91e63', label: 'Hồng Fuchsia' },
  { hex: '#2196f3', label: 'Xanh Lam' },
  { hex: '#ffeb3b', label: 'Vàng Canary' },
  { hex: '#ffffff', label: 'Trắng Bạc' },
  { hex: '#111111', label: 'Matte Đen' },
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedCar,
  onCarSelect,
  carColor,
  onColorSelect,
  selectedTrack,
  onTrackSelect,
  weather,
  onWeatherSelect,
  physicsConfig,
  onPhysicsChange,
  customCarSpecs,
  onCustomCarSpecsChange,
  characterConfig,
  onCharacterConfigChange,
  customMapConfig,
  onCustomMapConfigChange,
  stats,
  damage,
  onTriggerHeadlightsToggle,
  hideToggle = false,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'car' | 'character' | 'track' | 'rank' | 'physics' | 'controls'>('car');

  // Authentication states
  const [userSession, setUserSession] = useState<LeaderboardUser | null>(null);
  const [loginEmail, setLoginEmail] = useState('nguyenthitrinh0976840761@gmail.com');
  const [customNickname, setCustomNickname] = useState('TayĐuaCựPhách');
  const [selectedAvatar, setSelectedAvatar] = useState('🦸');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [activeTabLeaderboard, setActiveTabLeaderboard] = useState<'stars' | 'diamonds'>('stars');

  // Custom multiplayer / map sharing rooms variables
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isRoomHost, setIsRoomHost] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState<CustomMapRoom | null>(null);
  const [roomUsersList, setRoomUsersList] = useState<any[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  // Load existing session on wake
  useEffect(() => {
    const saved = localStorage.getItem('saved_racer_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserSession(parsed);
        setCustomNickname(parsed.nickname || 'TayĐuaCyber');
        setSelectedAvatar(parsed.avatar || '🦸');
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
    fetchLatestLeaderboard();
  }, []);

  // Fetch leaderboard
  const fetchLatestLeaderboard = async () => {
    const records = await getLeaderboard();
    setLeaderboard(records);
  };

  // Login handler
  const handleSignOn = async () => {
    setIsAuthenticating(true);
    try {
      // Form unique userId from email prefix
      const emailRoot = loginEmail.split('@')[0] || 'stranger';
      const cleanUid = `uid_${emailRoot}`;
      
      const sessionData: LeaderboardUser = {
        userId: cleanUid,
        nickname: customNickname,
        avatar: selectedAvatar,
        stars: stats.score,
        diamonds: stats.currentCheckpoint,
        outfit: characterConfig.clothingStyle,
        createdAt: Date.now()
      };
      
      // Save stats to Firebase database
      await savePlayerStats(sessionData);
      localStorage.setItem('saved_racer_session', JSON.stringify(sessionData));
      setUserSession(sessionData);
      fetchLatestLeaderboard();
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Submit high score manually button
  const handleUpdateScores = async () => {
    if (!userSession) return;
    const updated: LeaderboardUser = {
      ...userSession,
      nickname: customNickname,
      avatar: selectedAvatar,
      stars: Math.max(userSession.stars, stats.score),
      diamonds: Math.max(userSession.diamonds, stats.currentCheckpoint),
      outfit: characterConfig.clothingStyle
    };
    await savePlayerStats(updated);
    setUserSession(updated);
    localStorage.setItem('saved_racer_session', JSON.stringify(updated));
    fetchLatestLeaderboard();
  };

  // Create room code (Mã server riêng)
  const handleCreateRoom = async () => {
    const hostId = userSession?.userId || 'anonymous_racer_' + Math.floor(Math.random() * 8888);
    const hostName = userSession?.nickname || 'Tay Đua Khách';
    const randCode = 'SV-' + Math.floor(100000 + Math.random() * 900000); // SV-123456
    
    setShareLoading(true);
    const success = await publishCustomRoom({
      roomCode: randCode,
      hostName,
      hostId,
      mapName: customMapConfig.mapName || 'Vùng Đất Kỳ Bí',
      customHillHeight: customMapConfig.customHillHeight,
      customDuneScale: customMapConfig.customDuneScale,
      customRippleFreq: customMapConfig.customRippleFreq,
      customFloorLevel: customMapConfig.customFloorLevel,
      customObstacleDensity: customMapConfig.customObstacleDensity,
      trackTheme: customMapConfig.trackTheme
    });

    if (success) {
      setIsRoomHost(true);
      setRoomCodeInput(randCode);
      // Change track state to custom_map
      onTrackSelect('custom_map');
      
      // Subscribe right away
      subscribeToRoom(randCode, (room) => {
        if (room) {
          setJoinedRoom(room);
          setRoomUsersList(room.playersActive || []);
          // Dynamically override map variables to stay synchronized
          onCustomMapConfigChange({
            customHillHeight: room.customHillHeight,
            customDuneScale: room.customDuneScale,
            customRippleFreq: room.customRippleFreq,
            customFloorLevel: room.customFloorLevel,
            customObstacleDensity: room.customObstacleDensity,
            trackTheme: room.trackTheme,
            mapName: room.mapName,
            roomCode: room.roomCode
          });
        }
      });
    }
    setShareLoading(false);
  };

  // Join Room via Server Code
  const handleConnectRoom = () => {
    const cleanCode = roomCodeInput.toUpperCase().trim();
    if (!cleanCode) return;
    
    setShareLoading(true);
    // Subscribe to snapshot
    subscribeToRoom(cleanCode, (room) => {
      if (room) {
        setJoinedRoom(room);
        setRoomUsersList(room.playersActive || []);
        setIsRoomHost(room.hostId === (userSession?.userId || ''));
        onTrackSelect('custom_map');
        
        // Sync local map sliders to the host's custom configs
        onCustomMapConfigChange({
          customHillHeight: room.customHillHeight,
          customDuneScale: room.customDuneScale,
          customRippleFreq: room.customRippleFreq,
          customFloorLevel: room.customFloorLevel,
          customObstacleDensity: room.customObstacleDensity,
          trackTheme: room.trackTheme,
          mapName: room.mapName,
          roomCode: room.roomCode
        });

        // Trigger user heartbeat every 15s to keep room updated
        const name = userSession?.nickname || 'Bạn bè ' + Math.floor(Math.random() * 999);
        const avatar = userSession?.avatar || '🏎️';
        sendHeartbeatToRoom(cleanCode, userSession?.userId || 'player_guest', name, avatar);
      } else {
        alert("Không tìm thấy Server với mã " + cleanCode + "!");
      }
      setShareLoading(false);
    });
  };

  // Heartbeat loop when joined in a room
  useEffect(() => {
    if (!joinedRoom) return;
    
    const interval = setInterval(() => {
      const name = userSession?.nickname || 'Racer Guest';
      const uid = userSession?.userId || 'player_guest';
      const avatar = userSession?.avatar || '🏎️';
      sendHeartbeatToRoom(joinedRoom.roomCode, uid, name, avatar);
    }, 15000);

    return () => clearInterval(interval);
  }, [joinedRoom, userSession]);

  const updateSpec = <K extends keyof CustomCarSpecs>(key: K, val: CustomCarSpecs[K]) => {
    onCustomCarSpecsChange({
      ...customCarSpecs,
      [key]: val,
    });
  };

  const updatePhysicsValue = (key: keyof PhysicsConfig, val: number | boolean) => {
    onPhysicsChange({
      ...physicsConfig,
      [key]: val,
    });
  };

  const updateCharacter = (key: keyof CharacterConfig, val: string | typeof characterConfig.accessory | typeof characterConfig.headwear) => {
    onCharacterConfigChange({
      ...characterConfig,
      [key]: val
    });
  };

  const updateCustomMap = (key: keyof CustomMapConfig, val: number | string) => {
    onCustomMapConfigChange({
      ...customMapConfig,
      [key]: val
    });
  };

  return (
    <div id="control-panel-hud" className={hideToggle ? "w-full font-sans select-none" : "absolute top-4 left-4 pointer-events-auto z-20 font-sans select-none max-w-[340px] md:max-w-[365px]"}>
      
      {/* Settings Toggle Trigger Button */}
      {!hideToggle && (
        <button
          id="btn-settings-toggle"
          onClick={() => setIsOpen(!isOpen)}
          className="mb-2 bg-slate-900/90 text-white border border-slate-700/60 px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-xl backdrop-blur-md transition-all duration-200 hover:bg-slate-800"
        >
          <Sliders className={`w-4 h-4 text-indigo-400 ${isOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
          <span className="text-xs font-bold font-mono tracking-wider">
            {isOpen ? 'ẨN BẢNG TÙY ĐỐI' : 'TÙY BIẾN ĐỊA HÌNH & NHÂN VẬT & XE'}
          </span>
        </button>
      )}

      {(isOpen || hideToggle) && (
        <div id="panel-content" className={hideToggle ? "bg-transparent text-white flex flex-col gap-3" : "bg-slate-950/90 backdrop-blur-lg border border-slate-800/80 rounded-2xl shadow-2xl p-4 text-white max-h-[72vh] overflow-y-auto flex flex-col gap-3 animate-in fade-in slide-in-from-top-3 duration-300"}>
          
          {/* Active Session Warning */}
          {joinedRoom && (
            <div className="bg-indigo-950/80 border border-indigo-500 rounded-lg p-2 text-center text-[10px] text-indigo-200 flex flex-col gap-0.5 animate-pulse">
              <span className="font-bold flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5" />
                ĐANG KẾT NỐI SERVER: {joinedRoom.roomCode}
              </span>
              <span>Bản đồ của bạn đang đồng bộ hóa với host "{joinedRoom.hostName}"</span>
            </div>
          )}

          {/* Navigation Tab selection list */}
          <div className="flex border-b border-slate-800/80 pb-2.5 gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('car')}
              className={`py-1.5 px-3 text-center text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all duration-300 ${
                activeTab === 'car' 
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 font-extrabold text-white shadow-lg shadow-indigo-600/20 active:scale-95' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-850 bg-slate-900/40 border border-slate-800/60'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Xe</span>
            </button>

            <button
              onClick={() => setActiveTab('character')}
              className={`py-1.5 px-3 text-center text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all duration-300 ${
                activeTab === 'character' 
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 font-extrabold text-white shadow-lg shadow-purple-600/20 active:scale-95' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-850 bg-slate-900/40 border border-slate-800/60'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Người chơi</span>
            </button>




            <button
              onClick={() => setActiveTab('physics')}
              className={`py-1.5 px-3 text-center text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all duration-300 ${
                activeTab === 'physics' 
                  ? 'bg-gradient-to-r from-amber-500 to-red-600 font-extrabold text-white shadow-lg shadow-amber-600/20 active:scale-95' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-850 bg-slate-900/40 border border-slate-800/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Vật lý</span>
            </button>

            <button
              onClick={() => setActiveTab('controls')}
              className={`py-1.5 px-3 text-center text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all duration-300 ${
                activeTab === 'controls' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 font-extrabold text-white shadow-lg shadow-orange-600/20 active:scale-95' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-850 bg-slate-900/40 border border-slate-800/60'
              }`}
              title="Full Tính Năng Xe Thật"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Xe thật</span>
            </button>
          </div>

          {/* TAB 1: CAR CHOOSER */}
          {activeTab === 'car' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">1. Trình thiết kế dáng xe</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['sport', 'cyber', 'suv', 'classic', 'custom'] as CarType[]).map((type) => {
                    const labels: Record<CarType, string> = {
                      sport: '🏎️ Thể Thao',
                      cyber: '📐 CyberTruck',
                      suv: '🚙 SUV Địa Hình',
                      classic: '🚘 Cổ Điển',
                      custom: '🎨 Tự Thiết Kế',
                    };
                    const isCustom = type === 'custom';
                    return (
                      <button
                        key={type}
                        onClick={() => onCarSelect(type)}
                        className={`py-1.5 px-2 text-left text-xs rounded-lg border cursor-pointer transition-all ${
                          isCustom ? 'col-span-2 text-center bg-gradient-to-r from-indigo-950/40 via-indigo-900/50 to-indigo-950/40' : ''
                        } ${
                          selectedCar === type 
                            ? 'bg-indigo-600/30 border-indigo-400 text-white font-semibold' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {labels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color list */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">2. Màu sơn chính</span>
                <div className="flex flex-wrap gap-1.5">
                  {colorsList.map((col) => {
                    const active = carColor === col.hex;
                    return (
                      <button
                        key={col.hex}
                        onClick={() => onColorSelect(col.hex)}
                        className={`w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                          active ? 'border-indigo-400 scale-105 shadow shadow-indigo-500/20' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: col.hex }}
                        title={col.label}
                      >
                        {active && (
                          <div className={`w-2.5 h-2.5 rounded-full ${col.hex === '#ffffff' ? 'bg-slate-900' : 'bg-white'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom specs */}
              {selectedCar === 'custom' && (
                <div className="mt-1 pt-2 border-t border-slate-900 flex flex-col gap-2 bg-slate-900/40 p-2.5 rounded-lg">
                  <span className="text-xs font-bold text-indigo-400 font-mono uppercase">Xưởng đo đạc kĩ thuật</span>
                  
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Chiều dài thân</span>
                      <span>{customCarSpecs.bodyLength.toFixed(1)}m</span>
                    </div>
                    <input
                      type="range"
                      min="3.0"
                      max="5.0"
                      step="0.1"
                      value={customCarSpecs.bodyLength}
                      onChange={(e) => updateSpec('bodyLength', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Chiều rộng thân</span>
                      <span>{customCarSpecs.bodyWidth.toFixed(1)}m</span>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="2.4"
                      step="0.1"
                      value={customCarSpecs.bodyWidth}
                      onChange={(e) => updateSpec('bodyWidth', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Đường kính bánh lốp</span>
                      <span>{customCarSpecs.wheelSize.toFixed(2)}m</span>
                    </div>
                    <input
                      type="range"
                      min="0.35"
                      max="0.70"
                      step="0.02"
                      value={customCarSpecs.wheelSize}
                      onChange={(e) => updateSpec('wheelSize', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-slate-400 text-[9px]">Dáng Đuôi Gió (Spoiler)</span>
                    <div className="grid grid-cols-2 gap-1">
                      {(['none', 'winged', 'twin_fins', 'brutalist'] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => updateSpec('spoilerStyle', style)}
                          className={`py-1 px-1.5 text-center text-[9.5px] rounded-md border transition-all cursor-pointer ${
                            customCarSpecs.spoilerStyle === style
                              ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                              : 'bg-slate-900 border-slate-850 text-slate-400'
                          }`}
                        >
                          {style === 'none' ? '❌ Trơn' : style === 'winged' ? '⚡ Căn Cánh' : style === 'twin_fins' ? '📐 Vây Đôi' : '🧱 Brutalist'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHARACTER DRESS-UP ("Người chơi") */}
          {activeTab === 'character' && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="flex flex-col gap-1 p-2 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-center text-xs">
                <span className="text-[10px] text-indigo-400 font-black font-mono uppercase tracking-wider">🌟 THỜI TRANG ĐUA XE 3D 🌟</span>
                <span className="text-[9.5px] text-slate-300">Tùy chỉnh phong cách quần áo, mũ giáp của người lái khi đi bộ.</span>
              </div>

              {/* Clothes Style */}
              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">Phục Trang Cơ Bản</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['casual', 'racer', 'neon', 'suit'] as const).map((sty) => {
                    const desc = { casual: '👕 Đơn Giản', racer: '🏎️ Đồ Racer', neon: '⚡ Phát Sáng', suit: '🤵 Tuxedo' };
                    return (
                      <button
                        key={sty}
                        onClick={() => updateCharacter('clothingStyle', sty)}
                        className={`py-1.5 px-2 text-xs rounded-lg text-left border cursor-pointer transition-all ${
                          characterConfig.clothingStyle === sty 
                            ? 'bg-indigo-600 border-indigo-400 text-white font-bold' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {desc[sty]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Headwear category */}
              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">Trang Bị Đầu</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['hair', 'helmet', 'cap'] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => updateCharacter('headwear', h)}
                      className={`py-1 px-1 text-center text-[10px] rounded-lg border cursor-pointer transition-all ${
                        characterConfig.headwear === h 
                          ? 'bg-indigo-600 border-indigo-400 text-white font-bold' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {h === 'hair' ? '🧑 Tóc Trần' : h === 'helmet' ? '🪖 Mũ Giáp' : '🧢 Mũ Lưỡi Trai'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors configuration */}
              <div className="grid grid-cols-2 gap-2 mt-1 px-1 bg-slate-900/30 p-2 rounded-lg">
                <div className="flex flex-col gap-1">
                  <span className="text-[8.5px] uppercase font-mono text-slate-400">Màu áo</span>
                  <input
                    type="color"
                    value={characterConfig.shirtColor}
                    onChange={(e) => updateCharacter('shirtColor', e.target.value)}
                    className="w-full h-7 rounded cursor-pointer border border-slate-700 bg-transparent p-0.5"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8.5px] uppercase font-mono text-slate-400">Màu tóc / nón</span>
                  <input
                    type="color"
                    value={characterConfig.hairColor}
                    onChange={(e) => updateCharacter('hairColor', e.target.value)}
                    className="w-full h-7 rounded cursor-pointer border border-slate-700 bg-transparent p-0.5"
                  />
                </div>
              </div>

              {/* Accessories options */}
              <div className="flex flex-col gap-1">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">Trang Bị Phía Sau</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['none', 'sunglasses', 'neon_backpack', 'wings'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => updateCharacter('accessory', a)}
                      className={`py-1 px-1 text-center text-[9px] rounded-lg border cursor-pointer transition-all ${
                        characterConfig.accessory === a 
                          ? 'bg-indigo-600 border-indigo-400 text-white font-bold shadow' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {a === 'none' ? '❌ Trống' : a === 'sunglasses' ? '😎 Kính' : a === 'neon_backpack' ? '🎒 Jetpack' : '🧚 Cánh Neon'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM MAPS & SHARE ROOM CODES ("Bản đồ") */}
          {activeTab === 'track' && (
            <div className="flex flex-col gap-3">
              <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">1. Lựa chọn map có sẵn</span>
              
              <div className="grid grid-cols-2 gap-1.5">
                {(['grassland', 'desert_bumpy', 'mountain', 'racetrack', 'metropolis_city', 'countryside_village', 'snow_arctic', 'volcano_lava', 'ocean_atlantis', 'synth_wave_grid', 'custom_map'] as TrackType[]).map((t) => {
                  const labels: Record<TrackType, string> = {
                    grassland: '🌲 Thông Xanh',
                    desert_bumpy: '🌵 Cát Vàng',
                    mountain: '⛰️ Đèo Cổ Đá',
                    racetrack: '🏁 Đêm Racetrack',
                    metropolis_city: '🏙️ Đô Thị Metropolis',
                    countryside_village: '🏡 Làng Quê Rộng Lớn',
                    snow_arctic: '❄️ Cực Bắc Lạnh',
                    volcano_lava: '🌋 Núi Lửa Magma',
                    ocean_atlantis: '🌊 Atlantis Đáy Biển',
                    synth_wave_grid: '🌆 Retro Sóng Neon',
                    custom_map: '🛠️ Tự Tạo Địa Hình',
                  };
                  return (
                    <button
                      key={t}
                      onClick={() => onTrackSelect(t)}
                      className={`py-2 px-2 text-xs rounded-lg text-left border cursor-pointer transition-all ${
                        selectedTrack === t 
                          ? 'bg-indigo-600 border-indigo-400 text-white font-bold' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>

              {/* Custom Map Config panel */}
              {selectedTrack === 'custom_map' && (
                <div className="mt-1 pt-2 border-t border-slate-900 flex flex-col gap-2.5 bg-slate-900/50 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider">Tạo Địa Hình Riêng</span>
                    <span className="text-[8.5px] bg-emerald-500/10 text-emerald-300 font-bold px-1.5 py-0.5 rounded uppercase">Live Render</span>
                  </div>

                  {/* Hill height */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Độ Cao Đỉnh Đồi</span>
                      <span className="text-emerald-400 font-bold">{customMapConfig.customHillHeight.toFixed(1)}m</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={customMapConfig.customHillHeight}
                      onChange={(e) => updateCustomMap('customHillHeight', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Dune style */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Độ Nhấp Nhô Cát Mại</span>
                      <span className="text-emerald-400 font-bold">{customMapConfig.customDuneScale.toFixed(1)}m</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={customMapConfig.customDuneScale}
                      onChange={(e) => updateCustomMap('customDuneScale', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Ripple freq */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Tần Số Gợn Sóng (Ripple)</span>
                      <span className="text-emerald-400 font-bold">{(customMapConfig.customRippleFreq * 100).toFixed(0)} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="0.45"
                      step="0.02"
                      value={customMapConfig.customRippleFreq}
                      onChange={(e) => updateCustomMap('customRippleFreq', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Map theme */}
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-slate-400 text-[9px]">Màu Sắc Đại Lộ Môi Trường</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['digital', 'magma', 'neon', 'matrix', 'classic'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => updateCustomMap('trackTheme', theme)}
                          className={`py-1 px-0.5 text-center text-[8.5px] rounded border transition-all cursor-pointer ${
                            customMapConfig.trackTheme === theme
                              ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          {theme === 'digital' ? '💻 Digital' : theme === 'magma' ? '🌋 Magma' : theme === 'neon' ? '🌌 Neon' : theme === 'matrix' ? '📟 Matrix' : '🌲 Classic'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SERVER MULTIPLAYER ROOM MAKER */}
                  <div className="mt-2 pt-2 border-t border-slate-800 bg-slate-950/70 p-2.5 rounded-lg flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-amber-400 font-mono flex items-center gap-1">
                      <Share2 className="w-3.5 h-3.5" />
                      MỜI BẠN CHƠI CHUNG TRÊN BẢN ĐỒ (SERVER)
                    </span>
                    <span className="text-[8.5px] text-slate-400 leading-normal">
                      Lập phòng bản đồ và mời bạn hữu cùng gia nhập chạy chung tuyến qua Mã server!
                    </span>

                    {/* Create Room Button */}
                    <button
                      onClick={handleCreateRoom}
                      disabled={shareLoading}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-bold text-white tracking-wider flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${shareLoading ? 'animate-spin' : ''}`} />
                      <span>{joinedRoom ? 'LÀM MỚI PHÒNG RIÊNG' : 'TẠO MÃ PHÒNG SEVER'}</span>
                    </button>

                    {/* Join room input group */}
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="text"
                        placeholder="Nhập mã SV-XXXXXX"
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value)}
                        className="flex-1 py-1 px-2.5 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded text-xs text-white font-mono placeholder-slate-700 outline-none"
                      />
                      <button
                        onClick={handleConnectRoom}
                        disabled={shareLoading}
                        className="py-1 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-[10px] cursor-pointer"
                      >
                        VÀO
                      </button>
                    </div>

                    {/* Room connected users listing */}
                    {joinedRoom && (
                      <div className="mt-1 pt-1.5 border-t border-slate-900 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[8.5px] text-slate-400">
                          <span>MÃ PHÒNG HOẠT ĐỘNG:</span>
                          <span className="font-mono text-amber-300 font-semibold select-all bg-amber-950 border border-amber-800 rounded px-1.5 py-0.5">{joinedRoom.roomCode}</span>
                        </div>
                        <div className="flex flex-col gap-1 mt-1 max-h-[85px] overflow-y-auto">
                          <span className="text-[8.5px] text-slate-500 uppercase font-mono">Xe trong server này ({roomUsersList.length}):</span>
                          {roomUsersList.map((user, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-900 p-1 rounded">
                              <span className="text-[9.5px] text-slate-300 flex items-center gap-1.5">
                                <span className="text-xs">{user.avatar}</span>
                                <b>{user.nickname}</b>
                              </span>
                              <span className="text-[8px] text-indigo-400 uppercase tracking-widest">{user.userId === joinedRoom.hostId ? 'Host' : 'Member'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VEHICLE PHYSICAL CUSTOMIZABILITY */}
          {activeTab === 'physics' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-2.5 rounded-xl">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold">Tự Thể Hiện Drift</span>
                  <span className="text-[9px] text-slate-400 italic">Trượt lết xoay đuôi xe khi rẽ gấp</span>
                </div>
                <button
                  onClick={() => updatePhysicsValue('driftMode', !physicsConfig.driftMode)}
                  className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                    physicsConfig.driftMode ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    physicsConfig.driftMode ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Công suất gầm (Lực đẩy động cơ)</span>
                  <span className="text-indigo-400 font-bold">{physicsConfig.engineForce}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1.5"
                  value={physicsConfig.engineForce}
                  onChange={(e) => updatePhysicsValue('engineForce', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer animate-pulse"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Khối lượng xe đua (Nặng đầm lướt)</span>
                  <span className="text-indigo-400 font-bold">{physicsConfig.mass} kg</span>
                </div>
                <input
                  type="range"
                  min="600"
                  max="1600"
                  step="100"
                  value={physicsConfig.mass}
                  onChange={(e) => updatePhysicsValue('mass', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Tốc độ trả bánh lái</span>
                  <span className="text-indigo-400 font-bold">{(physicsConfig.steeringSpeed * 100).toFixed(0)}</span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.25"
                  step="0.02"
                  value={physicsConfig.steeringSpeed}
                  onChange={(e) => updatePhysicsValue('steeringSpeed', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 6: CONTROLS & MECHANICAL STUFF ("Xe thật") */}
          {activeTab === 'controls' && (
            <div className="flex flex-col gap-2.5 text-xs font-mono animate-fade-in text-left">
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-2.5 flex flex-col gap-1 mb-1 shadow-inner">
                <span className="text-[10px] text-amber-400 font-black flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 animate-pulse text-rose-500" />
                  MÔ PHỎNG PHÍM LÁI NHƯ XE THỰC
                </span>
                <span className="text-[9px] text-slate-300 leading-relaxed">
                  Lái xe sành điệu với sự can thiệp từ các phím chức năng đầy cơ khí!
                </span>
              </div>

              <div className="flex flex-col gap-2.5 py-1 px-1 text-[11px]">
                {/* 1. Đèn pha High Beam trigger */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white flex items-center gap-1">
                      💡 Đèn Pha High Beam
                    </span>
                    <span className="text-[8.5px] text-slate-400">Chiếu sáng ban đêm bằng phím [L]</span>
                  </div>
                  <kbd className="px-2 py-1 bg-slate-800 text-amber-400 font-bold rounded border border-slate-700 animate-pulse uppercase">L</kbd>
                </div>

                {/* 2. Còi xe trigger */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">📯 Còi Báo Động (Beep Horn)</span>
                    <span className="text-[8.5px] text-slate-400">Nhấn giữ để phát sóng âm phím [H]</span>
                  </div>
                  <kbd className="px-2 py-1 bg-slate-800 text-indigo-400 font-bold rounded border border-slate-700 uppercase">H</kbd>
                </div>

                {/* 3. Hazard urgent light trigger */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">⚠️ Đèn Khẩn Cấp (Hazards)</span>
                    <span className="text-[8.5px] text-slate-400">Nhấp nháy nham hiểm bằng phím [R]</span>
                  </div>
                  <kbd className="px-2 py-1 bg-slate-800 text-teal-400 font-bold rounded border border-slate-700 uppercase">R</kbd>
                </div>

                {/* 4. Left and Right turn blinkers */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">⬅️ / ➡️ Đèn xi nhan Trái - Phải</span>
                    <span className="text-[8.5px] text-slate-400">Công tắc phím lái rẽ trái [Q] - phải [E]</span>
                  </div>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-slate-800 text-slate-300 font-bold rounded border border-slate-700 text-center">Q</kbd>
                    <kbd className="px-2 py-1 bg-slate-800 text-slate-300 font-bold rounded border border-slate-700 text-center">E</kbd>
                  </div>
                </div>

                {/* 5. Mechanical Gear manual or auto transmission */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">⚙️ Hộp Số Sàn (Manual Gear)</span>
                    <span className="text-[8.5px] text-slate-400">Sử dụng số phụ phím [M]</span>
                  </div>
                  <kbd className="px-2 py-1 bg-slate-800 text-indigo-400 font-bold rounded border border-slate-700 uppercase text-center">M</kbd>
                </div>

                {/* 6. Rotate camera with G key */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">📹 Xoay Camera 360 liên tục</span>
                    <span className="text-[8.5px] text-slate-400">Nhấn giữ để quay mượt camera 360 độ phím [G]</span>
                  </div>
                  <kbd className="px-2 py-1 bg-slate-800 text-emerald-400 font-bold rounded border border-slate-700 uppercase text-center animate-pulse">G</kbd>
                </div>

                {/* 7. Start/Stop engine with N key */}
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">🔑 Khởi Động / Tắt Động Cơ</span>
                    <span className="text-[8.5px] text-slate-400">Nhấn phím [N] để bật/tắt động cơ xe</span>
                  </div>
                  <kbd className="px-2 py-1 bg-slate-800 text-rose-500 font-bold rounded border border-slate-700 uppercase text-center">N</kbd>
                </div>
              </div>

              {/* Action tutorial guidelines */}
              <div className="text-[10px] text-slate-400 italic bg-slate-900 border border-slate-850 p-2 rounded-lg mt-1 leading-normal">
                - Di chuyển đi bộ bằng phím W / A / S / D khi xuống xe [phím F].
                <br />- Bánh lái được thiết kế tự quay về thẳng khi chạy thẳng đúng nghĩa của "Tiến thẳng lùi thẳng" xe!
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
