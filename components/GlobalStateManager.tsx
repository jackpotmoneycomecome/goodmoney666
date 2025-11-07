import React, { useState, useEffect, useCallback, useReducer, useMemo, useRef } from 'react';

// Firebase Imports
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, runTransaction, doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, writeBatch, query, where, getDocs } from '../utils/firebase';

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
import type { SiteConfig, LotterySet, Category, User, Order, Transaction, Prize, TicketLock, QueueEntry, Banner, PrizeInstance, Shipment, ShippingAddress, PickupRequest, AppState, AdminModalMode } from '../types';
import { RECYCLABLE_GRADES, RECYCLE_VALUE, SHIPPING_BASE_FEE_POINTS, SHIPPING_BASE_WEIGHT_G, SHIPPING_EXTRA_FEE_PER_KG } from '../data/mockData';
import { appReducer, initialState } from '../store/appReducer';


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
                    const lastPrize = lotteryData.prizes.find(p => p.type === 'LAST_ONE');
                    if (lastPrize) {
                        const instanceId = `${orderId}-${lastPrize.id}-last`;
                        const lastPrizeInstance: PrizeInstance = { ...lastPrize, instanceId, lotterySetId, isRecycled: false, userId: userData.id, status: 'IN_INVENTORY' };
                        newPrizeInstances.push(lastPrizeInstance);
                        transaction.set(doc(db, 'prizeInstances', instanceId), lastPrizeInstance);
                    }
                }
                
                const stats = userData.lotteryStats || {};
                const lotteryStats = stats[lotterySetId] || { cumulativeDraws: 0, availableExtensions: 1 };
                const newCumulativeDraws = lotteryStats.cumulativeDraws + selectedTickets.length;
                const extensionsEarned = Math.floor(newCumulativeDraws / 10) - Math.floor(lotteryStats.cumulativeDraws / 10);

                transaction.update(userRef, {
                    points: userData.points - cost,
                    lotteryStats: { ...stats, [lotterySetId]: { cumulativeDraws: newCumulativeDraws, availableExtensions: lotteryStats.availableExtensions + extensionsEarned } }
                });

                transaction.update(lotteryRef, {
                    drawnTicketIndices: [...lotteryData.drawnTicketIndices, ...selectedTickets]
                });
                
                const orderDoc = { id: orderId, userId: userData.id, date: serverTimestamp(), lotterySetTitle: lotteryData.title, prizeInstanceIds: newPrizeInstances.map(p => p.instanceId), costInPoints: cost, drawHash, secretKey, drawnTicketIndices: selectedTickets };
                transaction.set(doc(db, 'orders', orderId), orderDoc);

                const transactionDoc = { userId: userData.id, username: userData.username, type: 'DRAW' as const, amount: -cost, date: serverTimestamp(), description: `抽獎: ${lotteryData.title} (${selectedTickets.length} 抽)`, prizeInstanceIds: newPrizeInstances.map(p => p.instanceId) };
                const newTransactionRef = doc(collection(db, 'transactions'));
                transaction.set(newTransactionRef, transactionDoc);

                return newPrizeInstances;
            });

            return { success: true, drawnPrizes };
        } catch (e) {
            console.error("Draw transaction failed: ", e);
            return { success: false, message: e instanceof Error ? e.message : "抽獎失敗。" };
        }
    },
    // The rest of the actions now directly call the Firebase backend.
    // The UI will update reactively via the onSnapshot listeners.
    rechargePoints: async (amount: number) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        await updateDoc(doc(db, 'users', currentUser.id), { points: currentUser.points + amount });
        await addDoc(collection(db, 'transactions'), { userId: currentUser.id, username: currentUser.username, type: 'RECHARGE', amount, date: serverTimestamp(), description: `儲值 ${amount.toLocaleString()} P` });
    },
    saveShippingAddress: async (addressData) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.id);
        const userDoc = await getDoc(userRef);
        const currentAddresses = userDoc.data()?.shippingAddresses || [];
        const newAddress: ShippingAddress = { ...addressData, id: `addr-${Date.now()}`, isDefault: currentAddresses.length === 0 };
        await updateDoc(userRef, { shippingAddresses: [...currentAddresses, newAddress] });
    },
    updateShippingAddress: async (addressId, addressData) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.id);
        const userDoc = await getDoc(userRef);
        const currentAddresses = userDoc.data()?.shippingAddresses || [];
        const newAddresses = currentAddresses.map(addr => addr.id === addressId ? { ...addr, ...addressData } : addr);
        await updateDoc(userRef, { shippingAddresses: newAddresses });
    },
    deleteShippingAddress: async (addressId) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.id);
        const userDoc = await getDoc(userRef);
        const currentAddresses = userDoc.data()?.shippingAddresses || [];
        let newAddresses = currentAddresses.filter(addr => addr.id !== addressId);
        if (newAddresses.length > 0 && currentAddresses.find(a => a.id === addressId)?.isDefault) {
            newAddresses[0].isDefault = true;
        }
        await updateDoc(userRef, { shippingAddresses: newAddresses });
    },
    setDefaultShippingAddress: async (addressId) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.id);
        const userDoc = await getDoc(userRef);
        const currentAddresses = userDoc.data()?.shippingAddresses || [];
        const newAddresses = currentAddresses.map(addr => ({ ...addr, isDefault: addr.id === addressId }));
        await updateDoc(userRef, { shippingAddresses: newAddresses });
    },
    batchRecyclePrizes: async (prizeInstanceIds) => {
        const { currentUser } = getState();
        if (!currentUser) return;
        
        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', currentUser.id);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User not found.");

                let totalPointsToAward = 0;
                const prizeRefs = prizeInstanceIds.map(id => doc(db, 'prizeInstances', id));
                const prizeDocs = await Promise.all(prizeRefs.map(ref => transaction.get(ref)));

                prizeDocs.forEach((prizeDoc, index) => {
                    if (prizeDoc.exists()) {
                        const prize = prizeDoc.data() as PrizeInstance;
                        if (prize.userId === currentUser.id && !prize.isRecycled && RECYCLABLE_GRADES.includes(prize.grade)) {
                            totalPointsToAward += prize.recycleValue || RECYCLE_VALUE;
                            transaction.update(prizeRefs[index], { isRecycled: true });
                        }
                    }
                });

                if (totalPointsToAward > 0) {
                    transaction.update(userRef, { points: userDoc.data().points + totalPointsToAward });
                    
                    const transDoc = { userId: currentUser.id, username: currentUser.username, type: 'RECYCLE' as const, amount: totalPointsToAward, date: serverTimestamp(), description: `批量回收 ${prizeInstanceIds.length} 件獎品` };
                    transaction.set(doc(collection(db, 'transactions')), transDoc);
                }
            });
        } catch (e) {
            console.error("Batch recycle failed: ", e);
        }
    },
    requestShipment: async (prizeInstanceIds, shippingAddress) => {
        const { currentUser } = getState();
        if (!currentUser) return { success: false, message: 'Not logged in.' };
        
        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', currentUser.id);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User not found.");

                const prizeRefs = prizeInstanceIds.map(id => doc(db, 'prizeInstances', id));
                const prizeDocs = await Promise.all(prizeRefs.map(ref => transaction.get(ref)));
                const prizesToShip: PrizeInstance[] = [];
                prizeDocs.forEach(doc => {
                    if(doc.exists()) prizesToShip.push(doc.data() as PrizeInstance);
                });

                if (prizesToShip.length !== prizeInstanceIds.length) throw new Error("部分獎品無效。");
                if (prizesToShip.some(p => p.status !== 'IN_INVENTORY' || p.userId !== currentUser.id)) throw new Error("部分獎品狀態錯誤。");

                const totalWeight = prizesToShip.reduce((sum, p) => sum + p.weight, 0);
                let cost = SHIPPING_BASE_FEE_POINTS;
                if (totalWeight > SHIPPING_BASE_WEIGHT_G) cost += Math.ceil((totalWeight - SHIPPING_BASE_WEIGHT_G) / 1000) * SHIPPING_EXTRA_FEE_PER_KG;
                if (userDoc.data().points < cost) throw new Error("點數不足以支付運費。");

                transaction.update(userRef, { points: userDoc.data().points - cost });
                prizeRefs.forEach(ref => transaction.update(ref, { status: 'IN_SHIPMENT' }));
                
                const shipmentId = `ship-${Date.now()}`;
                const newShipment: Omit<Shipment, 'requestedAt'> = { id: shipmentId, userId: currentUser.id, username: currentUser.username, status: 'PENDING', prizeInstanceIds, shippingAddress, shippingCostInPoints: cost, totalWeightInGrams: totalWeight };
                transaction.set(doc(db, 'shipments', shipmentId), {...newShipment, requestedAt: serverTimestamp()});

                const newTransaction = { userId: currentUser.id, username: currentUser.username, type: 'SHIPPING' as const, amount: -cost, date: serverTimestamp(), description: `申請包裹運送 (${prizeInstanceIds.length} 件)` };
                transaction.set(doc(collection(db, 'transactions')), newTransaction);
            });
            return { success: true };
        } catch (e) {
            console.error("Request shipment failed: ", e);
            return { success: false, message: e instanceof Error ? e.message : '申請失敗' };
        }
    },
    requestPickup: async (prizeInstanceIds) => {
         const { currentUser, lotterySets } = getState();
         if (!currentUser) return { success: false, message: 'Not logged in.' };
         
         try {
             await runTransaction(db, async (transaction) => {
                 const lotterySetMap = new Map(lotterySets.map(set => [set.id, set]));
                 const prizeRefs = prizeInstanceIds.map(id => doc(db, 'prizeInstances', id));
                 const prizeDocs = await Promise.all(prizeRefs.map(ref => transaction.get(ref)));
                 const prizesToPickup: PrizeInstance[] = [];
                 prizeDocs.forEach(doc => { if(doc.exists()) prizesToPickup.push(doc.data() as PrizeInstance) });

                 if (prizesToPickup.some(p => p.status !== 'IN_INVENTORY' || p.userId !== currentUser.id || !lotterySetMap.get(p.lotterySetId)?.allowSelfPickup)) {
                     throw new Error("部分獎品狀態錯誤或不支援自取。");
                 }

                 prizeRefs.forEach(ref => transaction.update(ref, { status: 'PENDING_PICKUP' }));
                 
                 const requestId = `pickup-${Date.now()}`;
                 const newRequest = { id: requestId, userId: currentUser.id, username: currentUser.username, status: 'PENDING' as const, prizeInstanceIds, requestedAt: serverTimestamp() };
                 transaction.set(doc(db, 'pickupRequests', requestId), newRequest);

                 const newTransaction = { userId: currentUser.id, username: currentUser.username, type: 'PICKUP_REQUEST' as const, amount: 0, date: serverTimestamp(), description: `申請店面自取 (${prizeInstanceIds.length} 件)` };
                 transaction.set(doc(collection(db, 'transactions')), newTransaction);
             });
             return { success: true };
         } catch (e) {
             console.error("Request pickup failed: ", e);
             return { success: false, message: e instanceof Error ? e.message : '申請失敗' };
         }
    },
    // Admin actions
    adminAdjustUserPoints: async (userId, newPoints, notes) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if(!userDoc.exists()) return;
        const oldPoints = userDoc.data().points;
        const amount = newPoints - oldPoints;
        let description = `管理員調整點數: ${oldPoints.toLocaleString()} -> ${newPoints.toLocaleString()}`;
        if (notes) description += ` (備註: ${notes})`;
        await updateDoc(userRef, { points: newPoints });
        await addDoc(collection(db, 'transactions'), { userId, username: userDoc.data().username, type: 'ADMIN_ADJUSTMENT', amount, date: serverTimestamp(), description });
    },
    updateUserRole: async (userId, newRole) => {
        await updateDoc(doc(db, 'users', userId), { role: newRole });
    },
    updateShipmentStatus: async (shipmentId, status, trackingNumber, carrier) => {
        const batch = writeBatch(db);
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        if(!shipmentDoc.exists()) return;
        
        const updateData: any = { status };
        if (status === 'SHIPPED') {
            updateData.shippedAt = serverTimestamp();
            updateData.trackingNumber = trackingNumber;
            updateData.carrier = carrier;
            shipmentDoc.data().prizeInstanceIds.forEach((id: string) => {
                batch.update(doc(db, 'prizeInstances', id), { status: 'SHIPPED' });
            });
        }
        batch.update(shipmentRef, updateData);
        await batch.commit();
    },
    updatePickupRequestStatus: async (requestId, status) => {
        const batch = writeBatch(db);
        const requestRef = doc(db, 'pickupRequests', requestId);
        const requestDoc = await getDoc(requestRef);
        if(!requestDoc.exists()) return;

        const updateData: any = { status };
        if(status === 'COMPLETED') {
            updateData.completedAt = serverTimestamp();
            requestDoc.data().prizeInstanceIds.forEach((id: string) => {
                batch.update(doc(db, 'prizeInstances', id), { status: 'PICKED_UP' });
            });
        }
        batch.update(requestRef, updateData);
        await batch.commit();
    }
  }), [getState, leaveAllQueues]);
  
  useEffect(() => {
    // General Listeners (not user-specific)
    const unsubLotterySets = onSnapshot(query(collection(db, 'lotterySets'), where('status', '!=', 'ARCHIVED')), (snapshot) => {
        const sets: LotterySet[] = [];
        snapshot.forEach(doc => {
            const data = doc.data() as LotterySet;
            const remaining = data.prizes.filter(p => p.type === 'NORMAL').reduce((sum, p) => p.total, 0) - data.drawnTicketIndices.length;
            const status = remaining <= 0 ? 'SOLD_OUT' : data.status;
            const prizesWithRemaining = data.prizes.map(p => {
                const drawnCount = data.drawnTicketIndices.filter(idx => data.prizeOrder && data.prizeOrder[idx] === p.id).length;
                return {...p, remaining: p.total - drawnCount};
            });
// FIX: The error "Property 'allowSelfPickup' does not exist on type 'unknown'" likely stems from an unsafe cast
// from Firestore's `doc.data()`. If `allowSelfPickup` is missing from a document, it becomes `undefined`,
// violating the `LotterySet` type. We provide a default value of `false` to ensure type safety.
            sets.push({ ...data, id: doc.id, status, prizes: prizesWithRemaining, allowSelfPickup: data.allowSelfPickup ?? false });
        });
        dispatch({ type: 'SET_LOTTERY_SETS', payload: sets });
    });
    
    // Auth State Change Handler
    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
        if (authUser) {
            const userRef = doc(db, "users", authUser.uid);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
                const newUser: User = { id: authUser.uid, email: authUser.email!, username: authUser.displayName || `用戶${authUser.uid.slice(0, 5)}`, points: 10000, role: 'USER', shippingAddresses: [] };
                await setDoc(userRef, newUser);
            }
        } else {
            dispatch({ type: 'SET_CURRENT_USER', payload: null });
        }
    });

    return () => {
        unsubLotterySets();
        unsubAuth();
    };
  }, []);

  // User-specific Listeners
  useEffect(() => {
    if (state.currentUser) {
        const userId = state.currentUser.id;
        const isAdmin = state.currentUser.role === 'ADMIN';
        
        // User document listener
        const unsubUser = onSnapshot(doc(db, 'users', userId), (doc) => {
            dispatch({ type: 'SET_CURRENT_USER', payload: doc.data() as User });
        });

        // Data listeners
        const collectionsToListen = ['prizeInstances', 'orders', 'transactions', 'shipments', 'pickupRequests'];
        const unsubs = collectionsToListen.map(col => {
            const q = isAdmin ? collection(db, col) : query(collection(db, col), where('userId', '==', userId));
            return onSnapshot(q, snapshot => {
                const items: any[] = [];
                snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
                if (col === 'prizeInstances') dispatch({ type: 'SET_INVENTORY', payload: Object.fromEntries(items.map(i => [i.instanceId, i])) });
                else dispatch({ type: `SET_${col.toUpperCase()}` as any, payload: items });
            });
        });
        
        // Admin: also fetch all users
        let unsubUsers: () => void = () => {};
        if (isAdmin) {
            unsubUsers = onSnapshot(collection(db, 'users'), snapshot => {
                const users: User[] = [];
                snapshot.forEach(doc => users.push({ ...doc.data(), id: doc.id } as User));
                dispatch({ type: 'SET_USERS', payload: users });
            });
        }

        return () => {
            unsubUser();
            unsubs.forEach(u => u());
            unsubUsers();
        };
    } else {
        // Clear user-specific data on logout
        dispatch({ type: 'SET_INVENTORY', payload: {} });
        dispatch({ type: 'SET_ORDERS', payload: [] });
        dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
        dispatch({ type: 'SET_SHIPMENTS', payload: [] });
        dispatch({ type: 'SET_PICKUPREQUESTS', payload: [] });
    }
  }, [state.currentUser]);

  const navigateTo = useCallback((targetView: View) => {
    if (view === 'lottery' && state.currentUser) {
        leaveAllQueues(state.currentUser.id);
    }
    setView(targetView);
    window.scrollTo(0, 0);
  }, [view, state.currentUser, leaveAllQueues]);

  const handleSelectLottery = useCallback((lottery: LotterySet) => {
    setSelectedLottery(lottery);
    navigateTo('lottery');
  }, [navigateTo]);
  
  const handleAdminClick = () => {
      if (isAdminAuthenticated) navigateTo('admin');
      else if (state.currentUser?.role === 'ADMIN') {
          dispatch({ type: 'SET_ADMIN_MODAL_MODE', payload: 're-auth' });
      }
  };
  
   const handleAdminPasswordVerify = async (password: string) => {
        // In a real app, this would re-authenticate. For now, we'll just check if logged in.
        if (state.currentUser?.role === 'ADMIN') {
            setIsAdminAuthenticated(true);
            dispatch({ type: 'SET_ADMIN_MODAL_MODE', payload: 'hidden' });
            navigateTo('admin');
        } else {
            setAdminAuthError("Verification failed.");
        }
    };
    
    const handleChangePassword = async (currentPassword, newPassword) => {
        // This needs to be updated to use Firebase's updatePassword function.
        return { success: true, message: '密碼已成功更新！ (模擬)' };
    };

  const renderContent = () => {
    if (state.isLoadingSets) return <div className="text-center p-16">載入中...</div>;
    switch(view) {
        case 'lottery':
            if (!selectedLottery) { navigateTo('home'); return null; }
            return <LotteryPage lotterySet={selectedLottery} onSelectLottery={handleSelectLottery} onBack={() => navigateTo('home')} state={state} actions={actions} />;
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