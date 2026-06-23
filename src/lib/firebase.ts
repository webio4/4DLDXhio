import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  getDoc,
  getDocFromServer,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error definitions as required by the Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: When the application initially boots, call getFromServer to test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out Error:", error);
  }
}

// Leaderboard Database Operations
export interface LeaderboardUser {
  userId: string;
  nickname: string;
  avatar: string; // emoji or image url
  stars: number; // score
  diamonds: number; // checkpoints
  outfit: string; // racer, casual, astronaut, cyborg
  createdAt: number;
}

// Save highscore / stats to Firebase Leaderboard
export async function savePlayerStats(user: LeaderboardUser) {
  const path = `leaderboard/${user.userId}`;
  try {
    const userDocRef = doc(db, 'leaderboard', user.userId);
    // Check if previous high score is greater, only update if better score or more diamonds
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const existingData = docSnap.data() as LeaderboardUser;
      const updatedStars = Math.max(existingData.stars || 0, user.stars);
      const updatedDiamonds = Math.max(existingData.diamonds || 0, user.diamonds);
      await updateDoc(userDocRef, {
        nickname: user.nickname,
        avatar: user.avatar,
        stars: updatedStars,
        diamonds: updatedDiamonds,
        outfit: user.outfit,
        updatedAt: Date.now()
      });
    } else {
      await setDoc(userDocRef, {
        ...user,
        createdAt: Date.now()
      });
    }
  } catch (error) {
    console.warn("Failed to save score to Firebase:", error);
    // Fallback to LocalStorage
    saveScoreToLocalStorage(user);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function saveScoreToLocalStorage(user: LeaderboardUser) {
  try {
    const localStr = localStorage.getItem('local_leaderboard') || '[]';
    const list = JSON.parse(localStr) as LeaderboardUser[];
    const idx = list.findIndex(item => item.userId === user.userId);
    if (idx >= 0) {
      list[idx].stars = Math.max(list[idx].stars, user.stars);
      list[idx].diamonds = Math.max(list[idx].diamonds, user.diamonds);
      list[idx].nickname = user.nickname;
      list[idx].avatar = user.avatar;
      list[idx].outfit = user.outfit;
    } else {
      list.push(user);
    }
    localStorage.setItem('local_leaderboard', JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

// Load top leaderboard scores
export async function getLeaderboard(): Promise<LeaderboardUser[]> {
  const path = 'leaderboard';
  try {
    const leaderboardCol = collection(db, 'leaderboard');
    const q = query(leaderboardCol, orderBy('stars', 'desc'), limit(15));
    const querySnapshot = await getDocs(q);
    const results: LeaderboardUser[] = [];
    querySnapshot.forEach((doc) => {
      results.push({ ...(doc.data() as LeaderboardUser), userId: doc.id });
    });
    
    if (results.length === 0) {
      return getLocalLeaderboardFallback();
    }
    return results;
  } catch (error) {
    console.warn("Firebase query failed, sorting from local fallback:", error);
    const fallback = getLocalLeaderboardFallback();
    // Return fallback but also invoke handleFirestoreError
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch {
      // Catch expected error thrown for log purposes and return fallback
    }
    return fallback;
  }
}

function getLocalLeaderboardFallback(): LeaderboardUser[] {
  try {
    const localStr = localStorage.getItem('local_leaderboard') || '[]';
    const list = JSON.parse(localStr) as LeaderboardUser[];
    return list.sort((a, b) => b.stars - a.stars).slice(0, 15);
  } catch {
    return [];
  }
}

// Custom Map Shared Rooms structure
export interface CustomMapRoom {
  roomCode: string; // 6-digit server code
  hostName: string;
  hostId: string;
  mapName: string;
  customHillHeight: number;
  customDuneScale: number;
  customRippleFreq: number;
  customFloorLevel: number;
  customObstacleDensity: number;
  trackTheme: 'digital' | 'magma' | 'neon' | 'matrix' | 'classic';
  playersActive: {
    userId: string;
    nickname: string;
    avatar: string;
    lastSeen: number;
  }[];
  createdAt: number;
}

// Create or save custom room
export async function publishCustomRoom(room: Omit<CustomMapRoom, 'playersActive' | 'createdAt'>) {
  const path = `rooms/${room.roomCode}`;
  try {
    const docRef = doc(db, 'rooms', room.roomCode);
    const fullRoom: CustomMapRoom = {
      ...room,
      playersActive: [{
        userId: room.hostId,
        nickname: room.hostName,
        avatar: '🏎️',
        lastSeen: Date.now()
      }],
      createdAt: Date.now()
    };
    await setDoc(docRef, fullRoom);
    return true;
  } catch (error) {
    console.error("Failed to post custom room to Firebase:", error);
    // Save to local storage as Mock
    localStorage.setItem(`mock_room_${room.roomCode}`, JSON.stringify(room));
    handleFirestoreError(error, OperationType.CREATE, path);
    return false;
  }
}

// Join custom room list and listen for real-time changes
export function subscribeToRoom(roomCode: string, onUpdate: (room: CustomMapRoom | null) => void) {
  const path = `rooms/${roomCode}`;
  try {
    const docRef = doc(db, 'rooms', roomCode);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as CustomMapRoom);
      } else {
        // Fallback check Mock
        const mockSnap = localStorage.getItem(`mock_room_${roomCode}`);
        if (mockSnap) {
          const parsed = JSON.parse(mockSnap);
          onUpdate({
            ...parsed,
            playersActive: [{ userId: parsed.hostId, nickname: parsed.hostName, avatar: '🏎️', lastSeen: Date.now() }],
            createdAt: Date.now()
          });
        } else {
          onUpdate(null);
        }
      }
    }, (error) => {
      console.warn("Firestore listener failed, trying local mockup:", error);
      const mockSnap = localStorage.getItem(`mock_room_${roomCode}`);
      if (mockSnap) {
        onUpdate(JSON.parse(mockSnap));
      } else {
        onUpdate(null);
      }
      handleFirestoreError(error, OperationType.GET, path);
    });
  } catch (error) {
    console.error(error);
    return () => {};
  }
}

// Send user heartbeat to shared server code
export async function sendHeartbeatToRoom(roomCode: string, userId: string, nickname: string, avatar: string) {
  const path = `rooms/${roomCode}`;
  try {
    const docRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const roomData = snap.data() as CustomMapRoom;
      let active = [...(roomData.playersActive || [])];
      // Filter out stale users (inactive for more than 40 seconds)
      const now = Date.now();
      active = active.filter(p => now - p.lastSeen < 40000);
      
      const idx = active.findIndex(p => p.userId === userId);
      if (idx >= 0) {
        active[idx].lastSeen = now;
        active[idx].nickname = nickname;
        active[idx].avatar = avatar;
      } else {
        active.push({ userId, nickname, avatar, lastSeen: now });
      }
      await updateDoc(docRef, { playersActive: active });
    }
  } catch (error) {
    console.warn("Heartbeat update failed to Firestore", error);
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
