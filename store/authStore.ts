import create from 'zustand';
import { apiCall } from '../api';
import type { User, PrizeInstance, Order, Shipment, PickupRequest, Transaction, ShippingAddress } from '../types';
import { useSiteStore } from './siteDataStore';

interface AuthState {
    currentUser: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    inventory: { [key: string]: PrizeInstance };
    orders: Order[];
    shipments: Shipment[];
    pickupRequests: PickupRequest[];
    transactions: Transaction[];
    
    checkSession: () => Promise<void>;
    login: (email: string, pass: string) => Promise<boolean>;
    register: (username: string, email: string, pass: string) => Promise<boolean>;
    logout: () => Promise<void>;
    verifyAdminPassword: (password: string) => Promise<boolean>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;

    // User Actions
    draw: (lotterySetId: string, tickets: number[], drawHash: string, secretKey: string) => Promise<{ success: boolean; message?: string; drawnPrizes?: PrizeInstance[] }>;
    rechargePoints: (amount: number) => Promise<void>;
    recyclePrize: (prizeInstanceId: string) => Promise<void>;
    batchRecyclePrizes: (prizeInstanceIds: string[]) => Promise<void>;
    saveShippingAddress: (address: Omit<ShippingAddress, 'id' | 'isDefault'>) => Promise<void>;
    updateShippingAddress: (addressId: string, addressData: Omit<ShippingAddress, 'id' | 'isDefault'>) => Promise<void>;
    deleteShippingAddress: (addressId: string) => Promise<void>;
    setDefaultShippingAddress: (addressId: string) => Promise<void>;
    requestShipment: (prizeInstanceIds: string[], shippingAddress: ShippingAddress) => Promise<{ success: boolean; message?: string; }>;
    requestPickup: (prizeInstanceIds: string[]) => Promise<{ success: boolean; message?: string; }>;

    // Admin Actions
    adminAdjustUserPoints: (userId: string, newPoints: number, notes: string) => Promise<void>;
    updateUserRole: (userId: string, newRole: 'USER' | 'ADMIN') => Promise<void>;
    updateShipmentStatus: (shipmentId: string, status: 'PROCESSING' | 'SHIPPED', trackingNumber?: string, carrier?: string) => Promise<void>;
    updatePickupRequestStatus: (requestId: string, status: 'READY_FOR_PICKUP' | 'COMPLETED') => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    inventory: {},
    orders: [],
    shipments: [],
    pickupRequests: [],
    transactions: [],

    checkSession: async () => {
        set({ isLoading: true });
        try {
            const sessionData = await apiCall('/auth/session');
            if (sessionData && sessionData.user) {
                const { user, inventory, orders, shipments, pickupRequests, transactions } = sessionData;
                set({
                    currentUser: user,
                    isAuthenticated: true,
                    inventory: inventory || {},
                    orders: orders || [],
                    shipments: shipments || [],
                    pickupRequests: pickupRequests || [],
                    transactions: transactions || [],
                    isLoading: false,
                });
            } else {
                 set({ currentUser: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.log("No active session or session check failed.");
            set({ currentUser: null, isAuthenticated: false, isLoading: false });
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const { user, inventory, orders, shipments, pickupRequests, transactions } = await apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            set({
                currentUser: user,
                isAuthenticated: true,
                inventory: inventory || {},
                orders: orders || [],
                shipments: shipments || [],
                pickupRequests: pickupRequests || [],
                transactions: transactions || [],
                isLoading: false,
            });
            return true;
        } catch (error: any) {
            set({ error: error.message || "登入失敗。", isLoading: false });
            return false;
        }
    },

    register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
            const { user } = await apiCall('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password }),
            });
            set({ currentUser: user, isAuthenticated: true, isLoading: false, error: null });
            return true;
        } catch (error: any) {
            set({ error: error.message || "註冊失敗。", isLoading: false });
            return false;
        }
    },

    logout: async () => {
        try {
            await apiCall('/auth/logout', { method: 'POST' });
            set({
                currentUser: null,
                isAuthenticated: false,
                inventory: {},
                orders: [],
                shipments: [],
                pickupRequests: [],
                transactions: [],
            });
        } catch (error: any) {
            set({ error: error.message });
        }
    },
    
    verifyAdminPassword: async (password) => {
        try {
            await apiCall('/auth/verify-admin', { method: 'POST', body: JSON.stringify({ password }) });
            return true;
        } catch (error) {
            console.error("Admin verification failed:", error);
            return false;
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        try {
            await apiCall('/user/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
            return { success: true, message: '密碼已成功更新！' };
        } catch(error: any) {
            return { success: false, message: error.message || '密碼更新失敗。' };
        }
    },

    draw: async (lotterySetId, tickets, drawHash, secretKey) => {
        try {
            const { drawnPrizes, updatedUser, newOrder, newTransaction, updatedLotterySet } = await apiCall(`/lottery-sets/${lotterySetId}/draw`, {
                method: 'POST',
                body: JSON.stringify({ tickets, drawHash, secretKey }),
            });
            
            set(state => ({
                currentUser: updatedUser,
                orders: [...state.orders, newOrder],
                transactions: [...state.transactions, newTransaction],
                inventory: { ...state.inventory, ...Object.fromEntries(drawnPrizes.map((p: PrizeInstance) => [p.instanceId, p])) }
            }));
            
            useSiteStore.setState(siteState => ({
                lotterySets: siteState.lotterySets.map(s => s.id === updatedLotterySet.id ? updatedLotterySet : s)
            }));

            return { success: true, drawnPrizes };
        } catch (error: any) {
            useSiteStore.getState().fetchLotterySets();
            return { success: false, message: error.message || '抽獎失敗，請稍後再試。' };
        }
    },
    
    rechargePoints: async (amount: number) => {
        const { updatedUser, newTransaction } = await apiCall('/user/recharge', { method: 'POST', body: JSON.stringify({ amount }) });
        set(state => ({
            currentUser: updatedUser,
            transactions: [...state.transactions, newTransaction]
        }));
    },
    
    _handleInventoryUpdate: async (promise: Promise<any>) => {
        const { updatedUser, newTransaction } = await promise;
        const inventory = await apiCall('/user/inventory');
        set(state => ({
            currentUser: updatedUser,
            transactions: [...state.transactions, newTransaction],
            inventory: inventory
        }));
    },

    recyclePrize: async (prizeInstanceId) => {
        await get()._handleInventoryUpdate(apiCall('/inventory/recycle', { method: 'POST', body: JSON.stringify({ prizeInstanceIds: [prizeInstanceId] }) }));
    },

    batchRecyclePrizes: async (prizeInstanceIds) => {
        await get()._handleInventoryUpdate(apiCall('/inventory/recycle', { method: 'POST', body: JSON.stringify({ prizeInstanceIds }) }));
    },
    
    saveShippingAddress: async (address) => {
        const updatedUser = await apiCall('/user/addresses', { method: 'POST', body: JSON.stringify(address) });
        set({ currentUser: updatedUser });
    },
    
    updateShippingAddress: async (addressId, addressData) => {
        const updatedUser = await apiCall(`/user/addresses/${addressId}`, { method: 'PUT', body: JSON.stringify(addressData) });
        set({ currentUser: updatedUser });
    },
    
    deleteShippingAddress: async (addressId) => {
        const updatedUser = await apiCall(`/user/addresses/${addressId}`, { method: 'DELETE' });
        set({ currentUser: updatedUser });
    },

    setDefaultShippingAddress: async (addressId) => {
        const updatedUser = await apiCall(`/user/addresses/${addressId}/default`, { method: 'POST' });
        set({ currentUser: updatedUser });
    },
    
    requestShipment: async (prizeInstanceIds, shippingAddress) => {
        try {
            const { newShipment, updatedUser, newTransaction } = await apiCall('/shipments', { method: 'POST', body: JSON.stringify({ prizeInstanceIds, shippingAddressId: shippingAddress.id }) });
            const inventory = await apiCall('/user/inventory');
            set(state => ({
                shipments: [...state.shipments, newShipment],
                currentUser: updatedUser,
                transactions: [...state.transactions, newTransaction],
                inventory: inventory
            }));
            return { success: true };
        } catch(error: any) {
            return { success: false, message: error.message };
        }
    },

    requestPickup: async (prizeInstanceIds) => {
        try {
            const { newPickupRequest, newTransaction } = await apiCall('/pickups', { method: 'POST', body: JSON.stringify({ prizeInstanceIds }) });
            const inventory = await apiCall('/user/inventory');
            set(state => ({
                pickupRequests: [...state.pickupRequests, newPickupRequest],
                transactions: [...state.transactions, newTransaction],
                inventory: inventory
            }));
            return { success: true };
        } catch(error: any) {
            return { success: false, message: error.message };
        }
    },
    
    // Admin Actions
    adminAdjustUserPoints: async (userId, newPoints, notes) => {
        // This is a complex action that affects other users, so we refetch all users.
        const { updatedUser, newTransaction } = await apiCall(`/admin/users/${userId}/points`, { method: 'POST', body: JSON.stringify({ points: newPoints, notes }) });
        // In a real app, we'd have a useUsersStore. For now, we update our own if it's us.
        if(get().currentUser?.id === updatedUser.id) set({ currentUser: updatedUser });
        set(state => ({ transactions: [...state.transactions, newTransaction] }));
    },
    
    updateUserRole: async (userId, newRole) => {
        await apiCall(`/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
        // Refetch users
    },
    
    updateShipmentStatus: async (shipmentId, status, trackingNumber, carrier) => {
        const updatedShipment = await apiCall(`/admin/shipments/${shipmentId}/status`, { method: 'PUT', body: JSON.stringify({ status, trackingNumber, carrier }) });
        set(state => ({
            shipments: state.shipments.map(s => s.id === updatedShipment.id ? updatedShipment : s)
        }));
    },
    
    updatePickupRequestStatus: async (requestId, status) => {
        const updatedRequest = await apiCall(`/admin/pickups/${requestId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        set(state => ({
            pickupRequests: state.pickupRequests.map(p => p.id === updatedRequest.id ? updatedRequest : p)
        }));
    },
}));
