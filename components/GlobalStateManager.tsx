
import React, { useState, useEffect, useCallback, useReducer, useMemo, useRef } from 'react';

// Firebase Imports
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, runTransaction, doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, writeBatch, query, where, getDocs } from '../utils/firebase.ts';

// Child Components
import { HomePage } from './HomePage.tsx';
import { LotteryPage } from './LotteryPage.tsx';
import { AuthPage } from './AuthPage.tsx';
import { ProfilePage } from './ProfilePage.tsx';
import { AdminPage } from './AdminPage.tsx';
import { VerificationPage } from './VerificationPage.tsx';
import { AdminAuthModal } from './AdminAuthModal.tsx';
import { FAQPage } from './FAQPage.tsx';
import { UserIcon, CogIcon, LogoutIcon } from './icons.tsx';

// Types and Data
import type { SiteConfig, LotterySet, Category, User, Order, Transaction, Prize, TicketLock, QueueEntry, Banner, PrizeInstance, Shipment, ShippingAddress, PickupRequest, AppState, AdminModalMode } from '../types.ts';
import { RECYCLABLE_GRADES, RECYCLE_VALUE, SHIPPING_BASE_FEE_POINTS, SHIPPING_BASE_WEIGHT_G, SHIPPING_EXTRA_FEE_PER_KG } from '../data/mockData.ts';
import { appReducer, initialState } from '../store/appReducer.ts';


// --- UTILITY & API Functions ---

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const apiInitializeLotterySet = async (set: LotterySet): Promise<LotterySet> => {
    let workingSet = { ...set, drawnTicketIndices: set.drawnTicketIndices || [] };
    if (!workingSet.prizeOrder) {
        const fullPrizePool: string[] = workingSet.prizes.filter(p => p.type === 'NORMAL').flatMap(p => Array(p.total).fill(p.id));
        const prizeOrder = shuffleArray(fullPrizePool);
        // These fields would ideally be generated and stored on the server securely
        const poolSeed = `pool-seed-${workingSet.id}-${Date.now()}-${Math.random()}`;
        const dataToHash = `${poolSeed}|${prizeOrder.join(',')}`;
        // In a real app, you'd use a crypto library for SHA256. Here we simulate the hash.
        const poolCommitmentHash = `sha256_placeholder_for_${workingSet.id}`;
        workingSet = { ...workingSet, prizeOrder, poolSeed, poolCommitmentHash };
    }
    return workingSet;
};

// --- HEADER & FOOTER & GLOBAL STATE MANAGER ---

type View = 'home' | 'lottery' | 'auth' | 'profile' | 'admin' | 'verification' | 'faq';
const LOCK_DURATION_MS = 60 * 1000;
const TURN_DURATION_MS = 3 * 60 * 1000;

const Header: React.FC<{ storeName: string; currentUser: User | null; onNavigate: (view: View) => void; onLogout: () => void; onAdminClick: () => void; }> = ({ storeName, currentUser, onNavigate, onLogout, onAdminClick }) => (
    <header className="sticky top-0 z-40 bg-white shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
                <button onClick={() => onNavigate('home')} className="text-2xl font-bold text-black hover:text-gray-700 transition-colors">{storeName}</button>
                <nav className="hidden md:flex items-center space-x-6">
                    <button onClick={() => onNavigate('home')} className="font-medium text-gray-600 hover:text-yellow-500 transition-colors">首頁</button>
                    <button onClick={() => onNavigate('faq')} className="font-medium text-gray-600 hover:text-yellow-500 transition-colors">常見問題</button>
                    <button onClick={() => onNavigate('verification')} className="font-medium text-gray-600 hover:text-yellow-500 transition-colors">公平性驗證</button>
                </nav>
            </div>
            <div className="flex items-center space-x-4">
                {currentUser ? (<>
                    <div className="hidden sm:block text-sm">
                        <span className="text-gray-600">你好, </span><button onClick={() => onNavigate('profile')} className="font-semibold text-black hover:underline">{currentUser.username}</button>
                        <span className="text-gray-600 mx-2">|</span><span className="font-semibold text-yellow-500">{currentUser.points.toLocaleString()} P</span>
                    </div>
                    <button onClick={() => onNavigate('profile')} className="text-gray-500 hover:text-yellow-500" title="個人資料"><UserIcon className="w-6 h-6" /></button>
                    <button onClick={onLogout} className="text-gray-500 hover:text-yellow-500" title="登出"><LogoutIcon className="w-6 h-6" /></button>
                </>) : (
                    <button onClick={() => onNavigate('auth')} className="bg-[#ffc400] text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-yellow-400 transition-colors shadow-md border-2 border-black">登入/註冊</button>
                )}
                {currentUser?.role === 'ADMIN' && (
                    <button onClick={onAdminClick} className="text-gray-500 hover:text-yellow-500" title="後台管理"><CogIcon className="w-6 h-6" /></button>
                )}
            </div>
        </div></div>
    </header>
);

const Footer: React.FC = () => (
    <footer className="bg-gray-800 text-white mt-16"><div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8"><div className="text-center"><p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} KujiSim. All rights reserved.</p></div></div></footer>
);

export const GlobalStateManager: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [view, setView] = useState<View>('home');
  const [selectedLottery, setSelectedLottery] = useState<LotterySet | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const getState = useCallback(() => stateRef.current, []);

  const advanceQueue = useCallback((lotteryId: string) => {
    // This function can be simplified or removed if queue logic is handled by server-side functions.
    // For client-side simulation:
    const { lotteryQueues } = getState();
    const currentQueue = lotteryQueues[lotteryId] || [];
    if (currentQueue.length === 0) return;
    const newQueue = [...currentQueue];
    newQueue.shift();
    if (newQueue.length > 0) newQueue[0] = { ...newQueue[0], expiresAt: Date.now() + TURN_DURATION_MS };
    dispatch({ type: 'UPDATE_LOTTERY_QUEUES', payload: { ...lotteryQueues, [lotteryId]: newQueue } });
  }, [getState]);
    
  const leaveAllQueues = useCallback((userId: string) => {
      // Client-side simulation of leaving queue
      const { lotteryQueues } = getState();
      const newQueues = { ...lotteryQueues };
      let changed = false;
      for (const lotteryId in newQueues) {
          const queue = newQueues[lotteryId];
          const userIndex = queue.findIndex(e => e.userId === userId);
          if (userIndex !== -1) {
              changed = true;
              const newQueue = queue.filter(e => e.userId !== userId);
              if (userIndex === 0 && newQueue.length > 0) newQueue[0] = { ...newQueue[0], expiresAt: Date.now() + TURN_DURATION_MS };
              newQueues[lotteryId] = newQueue;
          }
      }
      if (changed) dispatch({ type: 'UPDATE_LOTTERY_QUEUES', payload: newQueues });
  }, [getState]);

  const actions = useMemo(() => ({
    login: async (email, pass) => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            return true;
        } catch (error: any) {
            const message = error.code === 'auth/invalid-credential' ? '電子郵件或密碼錯誤。' : '登入失敗，請稍後再試。';
            dispatch({ type: 'SET_AUTH_ERROR', payload: message });
            return false;
        }
    },
    register: async (username, email, pass) => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const authUser = userCredential.user;
            const newUser: User = { id: authUser.uid, email: authUser.email!, username: username, points: 10000, role: 'USER', shippingAddresses: [] };
            await setDoc(doc(db, "users", authUser.uid), newUser);
            return true;
        } catch (error: any) {
            const message = error.code === 'auth/email-already-in-use' ? '此電子郵件已被註冊。' : '註冊失敗，請稍後再試。';
            dispatch({ type: 'SET_AUTH_ERROR', payload: message });
            return false;
        }
    },
    googleLogin: async () => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        try {
            await signInWithPopup(auth, googleProvider);
            return true;
        } catch (error: any) {
            console.error("Google login error:", error);
            const message = error.code === 'auth/unauthorized-domain' ? '此網域未被授權，請聯絡管理員。' : 'Google 登入失敗，請稍後再試。';
            dispatch({ type: 'SET_AUTH_ERROR', payload: message });
            return false;
        }
    },
    logout: async () => {
        const { currentUser } = getState();
        if (currentUser) leaveAllQueues(currentUser.id);
        setIsAdminAuthenticated(false);
        await signOut(auth);
    },
    addLotterySet: async (set: LotterySet) => {
        const initializedSet = await apiInitializeLotterySet(set);
        await setDoc(doc(db, 'lotterySets', initializedSet.id), initializedSet);
    },
    updateLotterySet: async (set: LotterySet) => {
        await updateDoc(doc(db, 'lotterySets', set.id), set);
    },
    deleteLotterySet: async (setId: string) => {
        await updateDoc(doc(db, 'lotterySets', setId), { status: 'ARCHIVED' }); // Soft delete
    },
    draw: async (lotterySetId, selectedTickets, cost, drawHash, secretKey) => {
        const { currentUser } = getState();
        if (!currentUser) return { success: false, message: '請先登入。' };

        const userRef = doc(db, 'users', currentUser.id);
        const lotteryRef = doc(db, 'lotterySets', lotterySetId);

        try {
            const drawnPrizes = await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const lotteryDoc = await transaction.get(lotteryRef);

                if (!userDoc.exists() || !lotteryDoc.exists()) throw new Error("找不到使用者或商品資料。");

                const userData = userDoc.data() as User;
                const lotteryData = lotteryDoc.data() as LotterySet;

                if (userData.points < cost) throw new Error("點數不足。");
                if (selectedTickets.some(t => lotteryData.drawnTicketIndices.includes(t))) throw new Error("選擇的籤已被抽出。");

                const prizeMap = new Map(lotteryData.prizes.map(p => [p.id, p]));
                const drawnPrizeIds = selectedTickets.map(index => lotteryData.prizeOrder![index]);
                const remainingTicketsBefore = lotteryData.prizes.filter(p=>p.type === 'NORMAL').reduce((s,p)=>s+p.remaining,0);

                const orderId = `order-${Date.now()}`;
                const newPrizeInstances: PrizeInstance[] = [];

                drawnPrizeIds.forEach((prizeId, index) => {
                    const prizeTemplate = prizeMap.get(prizeId);
                    if (prizeTemplate) {
                        const instanceId = `${orderId}-${prizeTemplate.id}-${index}`;
                        const newInstance: PrizeInstance = { ...prizeTemplate, instanceId, lotterySetId, isRecycled: false, userId: userData.id, status: 'IN_INVENTORY' };
                        newPrizeInstances.push(newInstance);
                        transaction.set(doc(db, 'prizeInstances', instanceId), newInstance);
                    }
                });

                if (remainingTicketsBefore === selectedTickets.length) {
                    const lastPrize = lotteryData.prizes.find(p => p.