import React, { useState, useEffect, useCallback, useReducer, useMemo, useRef } from 'react';

// Child Components
import { HomePage } from './HomePage';
import { LotteryPage } from './LotteryPage';
import { AuthPage } from './AuthPage';
import { ProfilePage } from './ProfilePage';
import { AdminPage } from './AdminPage';
import { VerificationPage } from './VerificationPage';
import { AdminAuthModal } from './AdminAuthModal';
import { FAQPage } from './FAQPage';
import { UserIcon, CogIcon, LogoutIcon } from './icons';

// Types and Data
// MODIFICATION: Import AppState and AdminModalMode from types.ts
import type { SiteConfig, LotterySet, Category, User, Order, Transaction, Prize, TicketLock, QueueEntry, Banner, PrizeInstance, Shipment, ShippingAddress, PickupRequest, AppState, AdminModalMode } from '../types';
import { initialMockLotterySets, mockUsers, RECYCLE_VALUE, SHIPPING_BASE_FEE_POINTS, SHIPPING_BASE_WEIGHT_G, SHIPPING_EXTRA_FEE_PER_KG } from '../data/mockData';
// Import reducer logic from its new file
import { appReducer, initialState, type AppAction } from '../store/appReducer';


// --- API Functions (formerly mockApi.ts) ---

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const initializeLotterySet = async (set: LotterySet): Promise<LotterySet> => {
    let workingSet = { ...set, drawnTicketIndices: set.drawnTicketIndices || [] };
    if (!workingSet.prizeOrder) {
        const fullPrizePool: string[] = workingSet.prizes.filter(p => p.type === 'NORMAL').flatMap(p => Array(p.total).fill(p.id));
        const prizeOrder = shuffleArray(fullPrizePool);
        const poolSeed = `pool-seed-${workingSet.id}-${Date.now()}-${Math.random()}`;
        const dataToHash = `${poolSeed}|${prizeOrder.join(',')}`;
        // Assuming sha256 is available globally or imported
        // const poolCommitmentHash = await sha256(dataToHash);
        const poolCommitmentHash = `hash_placeholder_for_${workingSet.id}`;
        workingSet = { ...workingSet, prizeOrder, poolCommitmentHash };
    }

    if (workingSet.prizeOrder) {
        const prizesDrawnCount: Record<string, number> = {};
        workingSet.drawnTicketIndices.forEach(index => {
            if (index < workingSet.prizeOrder!.length) {
                const prizeId = workingSet.prizeOrder![index];
                if (prizeId) prizesDrawnCount[prizeId] = (prizesDrawnCount[prizeId] || 0) + 1;
            }
        });
        const updatedPrizes: Prize[] = workingSet.prizes.map((prize: Prize) => ({ ...prize, remaining: prize.total - (prizesDrawnCount[prize.id] || 0) }));
        const remainingNormalTickets = updatedPrizes.filter(p => p.type === 'NORMAL').reduce((sum, p) => sum + p.remaining, 0);
        workingSet = { ...workingSet, prizes: updatedPrizes, status: (workingSet.status !== 'UPCOMING' && remainingNormalTickets === 0) ? 'SOLD_OUT' : workingSet.status };
    }
    return workingSet;
};

const apiFetchLotterySets = async (): Promise<LotterySet[]> => {
    await new Promise(res => setTimeout(res, 500));
    return await Promise.all(initialMockLotterySets.map(initializeLotterySet));
};

const apiLogin = async (email: string, pass: string): Promise<{ success: boolean; user?: User; message?: string; }> => {
    await new Promise(res => setTimeout(res, 300));
    const user = mockUsers.find(u => u.email === email && u.password === pass);
    return user ? { success: true, user: { ...user } } : { success: false, message: "電子郵件或密碼錯誤。" };
};


// --- STATE, REDUCER (formerly AppContext) ---
type View = 'home' | 'lottery' | 'auth' | 'profile' | 'admin' | 'verification' | 'faq';
// MODIFICATION: Removed local AppState and AdminModalMode definitions, which are now imported from types.ts.

const LOCK_DURATION_MS = 60 * 1000;
const TURN_DURATION_MS = 3 * 60 * 1000;

// --- HEADER & FOOTER ---
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

// --- GLOBAL STATE MANAGER COMPONENT ---
export const GlobalStateManager: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [view, setView] = useState<View>('home');
  const [selectedLottery, setSelectedLottery] = useState<LotterySet | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const getState = useCallback(() => stateRef.current, []);

  // --- ACTIONS ---
  const advanceQueue = useCallback((lotteryId: string) => {
    const { lotteryQueues } = getState();
    const currentQueue = lotteryQueues[lotteryId] || [];
    if (currentQueue.length === 0) return;
    const newQueue = [...currentQueue];
    newQueue.shift();
    if (newQueue.length > 0) newQueue[0] = { ...newQueue[0], expiresAt: Date.now() + TURN_DURATION_MS };
    dispatch({ type: 'UPDATE_LOTTERY_QUEUES', payload: { ...lotteryQueues, [lotteryId]: newQueue } });
  }, [getState]);

  const fetchLotterySets = useCallback(async () => {
    if (!getState().isLoadingSets) dispatch({ type: 'SET_LOADING_SETS', payload: true });
    const sets = await apiFetchLotterySets();
    dispatch({ type: 'SET_LOTTERY_SETS', payload: sets });
  }, [getState]);
    
  const leaveAllQueues = useCallback((userId: string) => {
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

  const draw = useCallback(async (lotterySetId: string, selectedTickets: number[], costInPoints: number, drawHash: string, secretKey: string) => {
    await new Promise(res => setTimeout(res, 500));
    const { lotterySets, ticketLocks, inventory } = getState();
    let { currentUser } = getState();

    if (!currentUser || !lotterySets.find(s => s.id === lotterySetId)) {
        return { success: false, message: '無效的請求' };
    }
    const targetLottery: LotterySet = lotterySets.find(s => s.id === lotterySetId)!;

    if (!targetLottery.prizeOrder) {
        console.error("CRITICAL ERROR: prizeOrder is missing during a draw attempt.", targetLottery);
        return { success: false, message: '發生嚴重錯誤：籤序遺失，無法抽獎。' };
    }
    
    if (selectedTickets.some(t => targetLottery.drawnTicketIndices.includes(t))) {
        fetchLotterySets(); // Refresh state from "server"
        return { success: false, message: '您選擇的籤中有部分已被抽出，請重新選擇。' };
    }

    const orderId = `order-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const prizeMap: Map<string, Prize> = new Map(targetLottery.prizes.map((p: Prize) => [p.id, p]));
    const newPrizeInstances: PrizeInstance[] = [];

    // --- Start of Refactored Logic ---

    // 1. Determine all outcomes of this draw beforehand.
    const drawnPrizeIds = selectedTickets.map(index => targetLottery.prizeOrder![index]);
    const prizesWonThisDrawCount: Record<string, number> = {};
    drawnPrizeIds.forEach(prizeId => {
        prizesWonThisDrawCount[prizeId] = (prizesWonThisDrawCount[prizeId] || 0) + 1;
    });

    const remainingNormalTicketsBeforeDraw = targetLottery.prizes
        .filter((p: Prize) => p.type === 'NORMAL')
        .reduce((sum: number, p: Prize) => sum + p.remaining, 0);
    
    const isLastPrizeWon = remainingNormalTicketsBeforeDraw === selectedTickets.length;

    // 2. Create all prize instances for the user's inventory.
    drawnPrizeIds.forEach((prizeId, index) => {
        const prizeTemplate = prizeMap.get(prizeId);
        if (prizeTemplate) {
            newPrizeInstances.push({
                ...prizeTemplate,
                instanceId: `${orderId}-${prizeTemplate.id}-${index}`,
                lotterySetId: lotterySetId,
                isRecycled: false,
                userId: currentUser!.id,
                status: 'IN_INVENTORY',
            });
        }
    });

    if (isLastPrizeWon) {
        const lastPrizeTemplate = targetLottery.prizes.find((p: Prize) => p.type === 'LAST_ONE');
        if (lastPrizeTemplate) {
            newPrizeInstances.push({
                ...lastPrizeTemplate,
                instanceId: `${orderId}-${lastPrizeTemplate.id}-last`,
                lotterySetId: lotterySetId,
                isRecycled: false,
                userId: currentUser!.id,
                status: 'IN_INVENTORY',
            });
        }
    }

    // 3. Create the single, final, updated prizes array for the LotterySet state.
    const updatedPrizes: Prize[] = targetLottery.prizes.map((p: Prize): Prize => {
        const countDrawn = prizesWonThisDrawCount[p.id] || 0;
        let newRemaining = p.remaining - countDrawn;

        if (p.type === 'LAST_ONE' && isLastPrizeWon) {
            newRemaining = 0;
        }

        return { ...p, remaining: newRemaining };
    });

    // --- End of Refactored Logic ---
    
    // 4. Update all relevant states based on the calculated outcomes.
    const newInventoryEntries = Object.fromEntries(newPrizeInstances.map(p => [p.instanceId, p]));
    const updatedInventory = { ...inventory, ...newInventoryEntries };
    dispatch({ type: 'SET_INVENTORY', payload: updatedInventory });
    
    const stats = currentUser.lotteryStats || {};
    const lotteryStats = stats[lotterySetId] || { cumulativeDraws: 0, availableExtensions: 1 };
    const oldCumulativeDraws = lotteryStats.cumulativeDraws;
    const newCumulativeDraws = oldCumulativeDraws + selectedTickets.length;
    const extensionsEarned = Math.floor(newCumulativeDraws / 10) - Math.floor(oldCumulativeDraws / 10);
    
    const updatedLotteryStats = {
        cumulativeDraws: newCumulativeDraws,
        availableExtensions: lotteryStats.availableExtensions + extensionsEarned
    };
    
    const updatedUser: User = {
        ...currentUser,
        points: currentUser.points - costInPoints,
        lotteryStats: { ...stats, [lotterySetId]: updatedLotteryStats }
    };
    dispatch({ type: 'UPDATE_USER', payload: updatedUser });

    const newPrizeInstanceIds = newPrizeInstances.map(p => p.instanceId);
    dispatch({ type: 'ADD_ORDER', payload: { id: orderId, userId: currentUser.id, date: new Date().toISOString(), lotterySetTitle: targetLottery.title, prizeInstanceIds: newPrizeInstanceIds, costInPoints, drawHash, secretKey, drawnTicketIndices: selectedTickets } });
    dispatch({ type: 'ADD_TRANSACTION', payload: { id: `trans-draw-${Date.now()}`, userId: currentUser.id, username: currentUser.username, type: 'DRAW', amount: -costInPoints, date: new Date().toISOString(), description: `抽獎: ${targetLottery.title} (${selectedTickets.length} 抽)`, prizeInstanceIds: newPrizeInstanceIds } });
    
    const remainingNormalTicketsAfterDraw = updatedPrizes.filter(p => p.type === 'NORMAL').reduce((sum, p) => sum + p.remaining, 0);
    
    dispatch({
        type: 'UPDATE_LOTTERY_SET',
        payload: {
            id: lotterySetId,
            prizes: updatedPrizes,
            drawnTicketIndices: [...targetLottery.drawnTicketIndices, ...selectedTickets],
            status: remainingNormalTicketsAfterDraw === 0 ? 'SOLD_OUT' : targetLottery.status
        }
    });

    dispatch({ type: 'UPDATE_TICKET_LOCKS', payload: ticketLocks.filter(l => !(l.lotteryId === lotterySetId && selectedTickets.includes(l.ticketIndex))) });
    
    const drawnPrizesForModal = newPrizeInstanceIds.map(id => updatedInventory[id]).filter((p): p is PrizeInstance => !!p);
    return { success: true, drawnPrizes: drawnPrizesForModal };
  }, [getState, fetchLotterySets]);

  const actions = useMemo(() => ({
    login: async (email, pass) => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        const res = await apiLogin(email, pass);
        if (res.success) dispatch({ type: 'SET_CURRENT_USER', payload: res.user! });
        else dispatch({ type: 'SET_AUTH_ERROR', payload: res.message! });
        return res.success;
    },
    register: async (username, email, pass) => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        if (getState().users.some(u => u.email === email)) {
            dispatch({ type: 'SET_AUTH_ERROR', payload: '此電子郵件已被註冊。' });
            return false;
        }
        const newUser: User = { id: `user-${Date.now()}`, username, email, password: pass, points: 10000, role: 'USER' };
        dispatch({ type: 'ADD_USER', payload: newUser });
        dispatch({ type: 'SET_CURRENT_USER', payload: newUser });
        return true;
    },
    googleLogin: async () => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        const mockEmail = 'google.user@example.com';
        let user = getState().users.find(u => u.email === mockEmail);
        if (!user) {
            user = { id: `user-google-${Date.now()}`, username: 'Google 使用者', email: mockEmail, points: 10000, role: 'USER' };
            dispatch({ type: 'ADD_USER', payload: user });
        }
        dispatch({ type: 'SET_CURRENT_USER', payload: user });
    },
    lineLogin: async () => {
        dispatch({ type: 'SET_AUTH_ERROR', payload: null });
        const mockEmail = 'line.user@example.com';
        let user = getState().users.find(u => u.email === mockEmail);
        if (!user) {
            user = { id: `user-line-${Date.now()}`, username: 'LINE 使用者', email: mockEmail, points: 10000, role: 'USER' };
            dispatch({ type: 'ADD_USER', payload: user });
        }
        dispatch({ type: 'SET_CURRENT_USER', payload: user });
    },
    logout: () => {
        const { currentUser } = getState();
        if (currentUser) leaveAllQueues(currentUser.id);
        setIsAdminAuthenticated(false); // Logout from admin as well
        dispatch({ type: 'SET_CURRENT_USER', payload: null });
    },
    fetchLotterySets,
    // FIX: Ensure new/updated lottery sets are initialized to have calculated fields like prizeOrder.
    addLotterySet: async (set: LotterySet) => {
        const initializedSet = await initializeLotterySet(set);
        dispatch({ type: 'ADD_LOTTERY_SET', payload: initializedSet });
    },
    updateLotterySet: async (set: LotterySet) => {
        const initializedSet = await initializeLotterySet(set);
        dispatch({ type: 'UPDATE_LOTTERY_SET', payload: initializedSet });
    },
    deleteLotterySet: (setId: string) => dispatch({ type: 'DELETE_LOTTERY_SET', payload: setId }),
    lockOrUnlockTickets: (lotteryId, ticketIndices, action) => {
        const { currentUser, lotterySets, ticketLocks } = getState();
        if (!currentUser) return { success: false, message: 'User not logged in.' };
        const now = Date.now();
        const targetLottery = lotterySets.find(l => l.id === lotteryId);
        if (!targetLottery) return { success: false, message: 'Lottery not found.' };

        if (action === 'lock') {
            for (const index of ticketIndices) if (targetLottery.drawnTicketIndices.includes(index) || ticketLocks.some(l => l.lotteryId === lotteryId && l.ticketIndex === index && l.userId !== currentUser.id && l.expiresAt > now)) return { success: false, message: `Ticket #${index + 1} is no longer available.` };
            const newLocks: TicketLock[] = ticketIndices.map(index => ({ lotteryId, ticketIndex: index, userId: currentUser.id, expiresAt: now + LOCK_DURATION_MS }));
            dispatch({ type: 'UPDATE_TICKET_LOCKS', payload: [...ticketLocks, ...newLocks] });
        } else {
            dispatch({ type: 'UPDATE_TICKET_LOCKS', payload: ticketLocks.filter(l => !(l.lotteryId === lotteryId && l.userId === currentUser.id && ticketIndices.includes(l.ticketIndex))) });
        }
        return { success: true };
    },
    joinQueue: (lotteryId) => {
        const { currentUser, lotteryQueues } = getState();
        if (!currentUser || (lotteryQueues[lotteryId] || []).some(e => e.userId === currentUser.id)) return;
        const newEntry: QueueEntry = { userId: currentUser.id, expiresAt: 0 };
        const newQueue = [...(lotteryQueues[lotteryId] || []), newEntry];
        if (newQueue.length === 1) newQueue[0].expiresAt = Date.now() + TURN_DURATION_MS;
        dispatch({ type: 'UPDATE_LOTTERY_QUEUES', payload: { ...lotteryQueues, [lotteryId]: newQueue } });
    },
    leaveQueue: (lotteryId) => advanceQueue(lotteryId),
    extendTurn: (lotteryId) => {
        const { currentUser, lotteryQueues } = getState();
        if (!currentUser) return;

        const stats = currentUser.lotteryStats || {};
        const lotteryStats = stats[lotteryId] || { cumulativeDraws: 0, availableExtensions: 1 };
        
        if (lotteryStats.availableExtensions > 0) {
            const updatedLotteryStats = { ...lotteryStats, availableExtensions: lotteryStats.availableExtensions - 1 };
            const updatedUser = {
                ...currentUser,
                lotteryStats: {
                    ...stats,
                    [lotteryId]: updatedLotteryStats
                }
            };
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });

            const queue = lotteryQueues[lotteryId] || [];
            if (queue.length > 0 && queue[0].userId === currentUser.id) {
                const newQueue = [...queue];
                newQueue[0] = { ...newQueue[0], expiresAt: newQueue[0].expiresAt + TURN_DURATION_MS };
                dispatch({ type: 'UPDATE_LOTTERY_QUEUES', payload: { ...lotteryQueues, [lotteryId]: newQueue } });
            }
        }
    },
    leaveAllQueues,
    draw,
    rechargePoints: (amount) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        dispatch({ type: 'UPDATE_USER', payload: { ...currentUser, points: currentUser.points + amount } });
        dispatch({ type: 'ADD_TRANSACTION', payload: { id: `trans-recharge-${Date.now()}`, userId: currentUser.id, username: currentUser.username, type: 'RECHARGE', amount, date: new Date().toISOString(), description: `儲值 ${amount.toLocaleString()} P` } });
    },
    recyclePrize: (prizeInstanceId: string) => {
        const { currentUser, inventory } = getState();
        if (!currentUser) return;

        const prizeToRecycle = inventory[prizeInstanceId];
        if (!prizeToRecycle || prizeToRecycle.userId !== currentUser.id) {
             console.error(`Recycle failed: prize instance not found or does not belong to user. ID: ${prizeInstanceId}`);
            return;
        }

        if (prizeToRecycle.isRecycled) {
            console.warn(`Attempted to recycle an already recycled prize. ID: ${prizeInstanceId}`);
            return;
        }

        const pointsToAward = prizeToRecycle.recycleValue || RECYCLE_VALUE;
        
        dispatch({ type: 'UPDATE_USER', payload: { ...currentUser, points: currentUser.points + pointsToAward } });
        
        const updatedPrize: PrizeInstance = { ...prizeToRecycle, isRecycled: true };
        const newInventory: { [key: string]: PrizeInstance } = { ...inventory, [prizeInstanceId]: updatedPrize };
        dispatch({ type: 'SET_INVENTORY', payload: newInventory });
        
        dispatch({ type: 'ADD_TRANSACTION', payload: { id: `trans-recycle-${Date.now()}`, userId: currentUser.id, username: currentUser.username, type: 'RECYCLE', amount: pointsToAward, date: new Date().toISOString(), description: `回收獎品: ${prizeToRecycle.grade} - ${prizeToRecycle.name} (+${pointsToAward} P)` } });
    },
    batchRecyclePrizes: (prizeInstanceIds: string[]) => {
        const { currentUser, inventory } = getState();
        if (!currentUser) return;

        let totalPointsToAward = 0;
        const newInventory: { [key: string]: PrizeInstance } = { ...inventory };
        const validPrizeIdsToRecycle: string[] = [];

        prizeInstanceIds.forEach(id => {
            const prize = inventory[id];
            if (prize && prize.userId === currentUser.id && !prize.isRecycled) {
                const points = prize.recycleValue || RECYCLE_VALUE;
                totalPointsToAward += points;
                newInventory[id] = { ...prize, isRecycled: true };
                validPrizeIdsToRecycle.push(id);
            }
        });

        if (validPrizeIdsToRecycle.length === 0) {
            console.warn("Batch recycle called with no valid prizes.");
            return;
        }
        
        dispatch({ type: 'UPDATE_USER', payload: { ...currentUser, points: currentUser.points + totalPointsToAward } });
        dispatch({ type: 'SET_INVENTORY', payload: newInventory });

        dispatch({ type: 'ADD_TRANSACTION', payload: { 
            id: `trans-batch-recycle-${Date.now()}`, 
            userId: currentUser.id, 
            username: currentUser.username, 
            type: 'RECYCLE', 
            amount: totalPointsToAward, 
            date: new Date().toISOString(), 
            description: `批量回收 ${validPrizeIdsToRecycle.length} 件獎品，共獲得 ${totalPointsToAward} P`
        }});
    },
    adminAdjustUserPoints: (userId: string, newPoints: number, notes: string) => {
        const { users } = getState();
        const user = users.find(u => u.id === userId);
        if (!user) {
            console.error("User not found for point adjustment");
            return;
        }

        const oldPoints = user.points;
        const amount = newPoints - oldPoints;

        if (amount === 0) return;

        const updatedUser: User = { ...user, points: newPoints };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });

        let description = `管理員調整點數，由 ${oldPoints.toLocaleString()} P 變為 ${newPoints.toLocaleString()} P`;
        if (notes && notes.trim() !== '') {
            description += ` (備註: ${notes.trim()})`;
        }

        dispatch({ type: 'ADD_TRANSACTION', payload: {
            id: `trans-admin-${Date.now()}`,
            userId: user.id,
            username: user.username,
            type: 'ADMIN_ADJUSTMENT',
            amount: amount,
            date: new Date().toISOString(),
            description: description,
        }});
    },
    updateUserRole: (userId: string, newRole: 'USER' | 'ADMIN') => {
        const { users } = getState();
        const user = users.find(u => u.id === userId);
        if (!user) {
            console.error("User not found for role adjustment");
            return;
        }
        const updatedUser: User = { ...user, role: newRole };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    },
    resetLotteryStats: (lotteryId: string) => {
        const { currentUser } = getState();
        if (!currentUser) return;

        const newLotteryStats = { ...(currentUser.lotteryStats || {}) };
        newLotteryStats[lotteryId] = { cumulativeDraws: 0, availableExtensions: 1 };

        const updatedUser: User = {
            ...currentUser,
            lotteryStats: newLotteryStats,
        };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    },
    saveShippingAddress: (address: Omit<ShippingAddress, 'id' | 'isDefault'>) => {
        const { currentUser } = getState();
        if (!currentUser) return;

        let addresses = currentUser.shippingAddresses || [];
        const newAddress: ShippingAddress = {
            ...address,
            id: `addr-${Date.now()}`,
            isDefault: addresses.length === 0,
        };
        
        const updatedUser: User = { ...currentUser, shippingAddresses: [...addresses, newAddress] };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    },
    updateShippingAddress: (addressId: string, addressData: Omit<ShippingAddress, 'id' | 'isDefault'>) => {
        const { currentUser } = getState();
        if (!currentUser) return;

        const addresses = (currentUser.shippingAddresses || []).map(addr => 
            addr.id === addressId ? { ...addr, ...addressData } : addr
        );
        
        const updatedUser: User = { ...currentUser, shippingAddresses: addresses };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    },
    deleteShippingAddress: (addressId: string) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        
        let addresses = (currentUser.shippingAddresses || []).filter(addr => addr.id !== addressId);
        const deletedAddressWasDefault = !(currentUser.shippingAddresses || []).find(a => a.id === addressId)?.isDefault;

        if (deletedAddressWasDefault && addresses.length > 0) {
            addresses[0].isDefault = true;
        }

        const updatedUser: User = { ...currentUser, shippingAddresses: addresses };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    },
     setDefaultShippingAddress: (addressId: string) => {
        const { currentUser } = getState();
        if (!currentUser) return;

        const addresses = (currentUser.shippingAddresses || []).map(addr => ({
            ...addr,
            isDefault: addr.id === addressId
        }));
        
        const updatedUser: User = { ...currentUser, shippingAddresses: addresses };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    },
    requestShipment: (prizeInstanceIds: string[], shippingAddress: ShippingAddress) => {
        const { currentUser, inventory } = getState();
        if (!currentUser) return { success: false, message: '請先登入' };

        const prizesToShip = prizeInstanceIds.map(id => inventory[id]).filter((p): p is PrizeInstance => !!p && p.userId === currentUser.id && p.status === 'IN_INVENTORY');
        if (prizesToShip.length !== prizeInstanceIds.length) {
            return { success: false, message: '部分獎品無效或無法運送。' };
        }

        const totalWeightInGrams = prizesToShip.reduce((sum, p) => sum + p.weight, 0);
        let shippingCostInPoints = SHIPPING_BASE_FEE_POINTS;
        if (totalWeightInGrams > SHIPPING_BASE_WEIGHT_G) {
            const extraWeightInKg = Math.ceil((totalWeightInGrams - SHIPPING_BASE_WEIGHT_G) / 1000);
            shippingCostInPoints += extraWeightInKg * SHIPPING_EXTRA_FEE_PER_KG;
        }

        if (currentUser.points < shippingCostInPoints) {
            return { success: false, message: '您的點數不足以支付運費。' };
        }

        const updatedUser: User = { ...currentUser, points: currentUser.points - shippingCostInPoints };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
        
        const newInventory: { [key: string]: PrizeInstance } = { ...inventory };
        prizeInstanceIds.forEach(id => {
            newInventory[id] = { ...newInventory[id], status: 'IN_SHIPMENT' };
        });
        dispatch({ type: 'SET_INVENTORY', payload: newInventory });

        const newShipment: Shipment = {
            id: `ship-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            status: 'PENDING',
            prizeInstanceIds,
            shippingAddress,
            shippingCostInPoints,
            totalWeightInGrams,
            requestedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_SHIPMENT', payload: newShipment });

        dispatch({ type: 'ADD_TRANSACTION', payload: {
            id: `trans-ship-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            type: 'SHIPPING',
            amount: -shippingCostInPoints,
            date: new Date().toISOString(),
            description: `申請包裹運送 (${prizeInstanceIds.length} 件商品)`,
        }});
        
        return { success: true };
    },
    updateShipmentStatus: (shipmentId: string, status: 'PROCESSING' | 'SHIPPED', trackingNumber?: string, carrier?: string) => {
        const { shipments } = getState();
        const shipment = shipments.find(s => s.id === shipmentId);
        if (!shipment) return;

        const updatedShipment: Shipment = { ...shipment, status };
        if (status === 'SHIPPED') {
            updatedShipment.shippedAt = new Date().toISOString();
            updatedShipment.trackingNumber = trackingNumber;
            updatedShipment.carrier = carrier;

            const { inventory } = getState();
            const newInventory = { ...inventory };
            shipment.prizeInstanceIds.forEach(id => {
                if (newInventory[id]) {
                    newInventory[id] = { ...newInventory[id], status: 'SHIPPED' };
                }
            });
            dispatch({ type: 'SET_INVENTORY', payload: newInventory });
        }
        
        dispatch({ type: 'UPDATE_SHIPMENT', payload: updatedShipment });
    },
    requestPickup: (prizeInstanceIds: string[]) => {
        const { currentUser, inventory, lotterySets } = getState();
        if (!currentUser) return { success: false, message: '請先登入' };

        const lotterySetMap: Map<string, LotterySet> = new Map(lotterySets.map((set: LotterySet) => [set.id, set]));
        const prizesToPickup = prizeInstanceIds.map(id => inventory[id]).filter((p: PrizeInstance | undefined): p is PrizeInstance => {
            if (!p || p.userId !== currentUser.id || p.status !== 'IN_INVENTORY') return false;
            const parentSet: LotterySet | undefined = lotterySetMap.get(p.lotterySetId);
            return !!parentSet?.allowSelfPickup;
        });

        if (prizesToPickup.length !== prizeInstanceIds.length) {
            return { success: false, message: '部分獎品無效或不支援自取。' };
        }

        const newInventory: { [key: string]: PrizeInstance } = { ...inventory };
        prizeInstanceIds.forEach(id => {
            newInventory[id] = { ...newInventory[id], status: 'PENDING_PICKUP' };
        });
        dispatch({ type: 'SET_INVENTORY', payload: newInventory });

        const newPickupRequest: PickupRequest = {
            id: `pickup-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            status: 'PENDING',
            prizeInstanceIds,
            requestedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_PICKUP_REQUEST', payload: newPickupRequest });

        dispatch({ type: 'ADD_TRANSACTION', payload: {
            id: `trans-pickup-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            type: 'PICKUP_REQUEST',
            amount: 0,
            date: new Date().toISOString(),
            description: `申請店面自取 (${prizeInstanceIds.length} 件商品)`,
        }});

        return { success: true };
    },
    updatePickupRequestStatus: (requestId: string, status: 'READY_FOR_PICKUP' | 'COMPLETED') => {
        const { pickupRequests, inventory } = getState();
        const request = pickupRequests.find(p => p.id === requestId);
        if (!request) return;

        const updatedRequest: PickupRequest = { ...request, status };

        if (status === 'COMPLETED') {
            updatedRequest.completedAt = new Date().toISOString();
            const newInventory = { ...inventory };
            let inventoryChanged = false;

            request.prizeInstanceIds.forEach(id => {
                if (newInventory[id] && newInventory[id].status === 'PENDING_PICKUP') {
                    newInventory[id] = { ...newInventory[id], status: 'PICKED_UP' };
                    inventoryChanged = true;
                }
            });

            if (inventoryChanged) {
                dispatch({ type: 'SET_INVENTORY', payload: newInventory });
            }
        }

        dispatch({ type: 'UPDATE_PICKUP_REQUEST', payload: updatedRequest });
    },
  }), [getState, fetchLotterySets, advanceQueue, draw, leaveAllQueues]);
  
  useEffect(() => {
    fetchLotterySets();
    const intervalId = setInterval(() => {
        const now = Date.now();
        const { lotteryQueues, ticketLocks } = getState();
        Object.keys(lotteryQueues).forEach(lotteryId => { if ((lotteryQueues[lotteryId] || []).length > 0 && lotteryQueues[lotteryId][0].expiresAt < now) advanceQueue(lotteryId); });
        if (ticketLocks.some(lock => lock.expiresAt <= now)) dispatch({ type: 'UPDATE_TICKET_LOCKS', payload: ticketLocks.filter(lock => lock.expiresAt > now) });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [fetchLotterySets, getState, advanceQueue]);

  // --- Navigation & Admin ---
  const navigateTo = useCallback((targetView: View) => {
    if (view === 'lottery' && state.currentUser) {
        actions.leaveAllQueues(state.currentUser.id);
        if (selectedLottery) {
            actions.resetLotteryStats(selectedLottery.id);
        }
    }
    setView(targetView);
    window.scrollTo(0, 0);
  }, [view, state.currentUser, actions, selectedLottery]);

  const handleSelectLottery = useCallback((lottery: LotterySet) => {
    const freshLotterySet = state.lotterySets.find(l => l.id === lottery.id) || lottery;
    setSelectedLottery(JSON.parse(JSON.stringify(freshLotterySet)));
    navigateTo('lottery');
  }, [state.lotterySets, navigateTo]);
  
  const handleAdminClick = () => {
      if (isAdminAuthenticated) {
          navigateTo('admin');
      } else if (state.currentUser?.role === 'ADMIN') {
          setAdminAuthError(null);
          dispatch({ type: 'SET_ADMIN_MODAL_MODE', payload: 're-auth' });
      }
  };
  
   const handleAdminPasswordVerify = async (password: string) => {
        const { currentUser } = getState();
        if (!currentUser || currentUser.role !== 'ADMIN') {
            setAdminAuthError('權限不足。');
            return;
        }
        if (currentUser.password !== password) {
            setAdminAuthError('密碼錯誤。');
            return;
        }
        
        setIsAdminAuthenticated(true);
        dispatch({ type: 'SET_ADMIN_MODAL_MODE', payload: 'hidden' });
        navigateTo('admin');
    };
    
    const handleChangePassword = async (currentPassword, newPassword) => {
        const { currentUser } = getState();
        if (!currentUser) return { success: false, message: '未登入。' };
        
        if (currentUser.password !== currentPassword) {
            return { success: false, message: '目前密碼不正確。' };
        }
        
        const updatedUser = { ...currentUser, password: newPassword };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });

        return { success: true, message: '密碼已成功更新！' };
    };


  const renderContent = () => {
    if (state.isLoadingSets) return <div className="text-center p-16">載入中...</div>;
    switch(view) {
        case 'lottery':
            if (!selectedLottery) { navigateTo('home'); return null; }
            const currentLotteryData = state.lotterySets.find(l => l.id === selectedLottery.id) || selectedLottery;
            return <LotteryPage lotterySet={currentLotteryData} onSelectLottery={handleSelectLottery} onBack={() => navigateTo('home')} state={state} actions={actions} />;
        case 'auth': return <AuthPage onAuthSuccess={() => navigateTo('home')} state={state} actions={actions} />;
        case 'profile':
            if (!state.currentUser) { navigateTo('auth'); return null; }
            return <ProfilePage user={state.currentUser} onBack={() => navigateTo('home')} state={state} actions={actions} />;
        case 'admin':
            if (!isAdminAuthenticated) { navigateTo('home'); return null; }
            return <AdminPage state={state} dispatch={dispatch} actions={actions} onChangePassword={handleChangePassword} />;
        case 'verification': return <VerificationPage onBack={() => navigateTo('home')} state={state} />;
        case 'faq': return <FAQPage onBack={() => navigateTo('home')} />;
        case 'home': default:
            return <HomePage onSelectLottery={handleSelectLottery} onSelectLotteryById={(id) => {
                const lottery = state.lotterySets.find(set => set.id === id);
                if (lottery) handleSelectLottery(lottery);
            }} state={state} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header storeName={state.siteConfig.storeName} currentUser={state.currentUser} onNavigate={navigateTo} onLogout={actions.logout} onAdminClick={handleAdminClick} />
      <main className="flex-grow">{renderContent()}</main>
      {state.adminModalMode === 're-auth' && (
          <AdminAuthModal 
            authError={adminAuthError} 
            onClose={() => dispatch({ type: 'SET_ADMIN_MODAL_MODE', payload: 'hidden' })} 
            onVerifyPassword={handleAdminPasswordVerify}
          />
      )}
      <Footer />
    </div>
  );
};