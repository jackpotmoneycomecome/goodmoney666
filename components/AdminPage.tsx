import React, { useState } from 'react';
import { AdminSiteSettings } from './AdminSiteSettings';
import { AdminProductManagement } from './AdminProductManagement';
import { AdminCategoryManagement } from './AdminCategoryManagement';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminTransactionHistory } from './AdminTransactionHistory';
import { AdminFinancialReport } from './AdminFinancialReport';
import { AdminShipmentManagement } from './AdminShipmentManagement';
import { AdminPickupManagement } from './AdminPickupManagement';
import { ListBulletIcon, CogIcon, UsersIcon, TicketIcon, ChartBarIcon, TruckIcon, BuildingStorefrontIcon } from './icons';
import type { LotterySet } from '../types';
import { useSiteStore } from '../store/siteDataStore';
import { useAuthStore } from '../store/authStore';

type AdminTab = 'site' | 'products' | 'categories' | 'users' | 'transactions' | 'financials' | 'shipments' | 'pickups';

export const AdminPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('products');
    const [transactionFilter, setTransactionFilter] = useState('');
    
    // Get state from stores
    const { siteConfig, lotterySets, categories, ...siteActions } = useSiteStore();
    const { currentUser, inventory, orders, shipments, pickupRequests, transactions, ...authActions } = useAuthStore();
    const users = []; // TODO: Add admin action to fetch all users

    const handleViewUserTransactions = (username: string) => {
        setTransactionFilter(username);
        setActiveTab('transactions');
    };
    
    const handleTabClick = (tab: AdminTab) => {
        if (tab !== 'transactions') {
            setTransactionFilter('');
        }
        setActiveTab(tab);
    }

    const handleSaveLotterySet = async (set: LotterySet): Promise<void> => {
      const exists = lotterySets.some(s => s.id === set.id);
      if (exists) {
          await siteActions.updateLotterySet(set);
      } else {
          // The backend should assign an ID
          await siteActions.addLotterySet(set);
      }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'site':
                return <AdminSiteSettings 
                            siteConfig={siteConfig} 
                            onSaveSiteConfig={siteActions.updateSiteConfig}
                            onChangePassword={authActions.changePassword}
                            lotterySets={lotterySets}
                            categories={categories}
                        />;
            case 'products':
                return <AdminProductManagement 
                            lotterySets={lotterySets}
                            categories={categories}
                            onSaveLotterySet={handleSaveLotterySet}
                            onDeleteLotterySet={siteActions.deleteLotterySet}
                        />;
            case 'categories':
                return <AdminCategoryManagement 
                            categories={categories}
                            onSaveCategory={siteActions.saveCategories}
                        />;
            case 'users':
                return <AdminUserManagement 
                            users={users}
                            currentUser={currentUser}
                            onUpdateUserPoints={authActions.adminAdjustUserPoints}
                            onUpdateUserRole={authActions.updateUserRole}
                            onViewUserTransactions={handleViewUserTransactions}
                        />;
            case 'transactions':
                return <AdminTransactionHistory transactions={transactions} inventory={inventory} initialFilter={transactionFilter} />;
             case 'financials':
                return <AdminFinancialReport 
                            transactions={transactions} 
                            users={users}
                            orders={orders}
                            lotterySets={lotterySets}
                        />;
            case 'shipments':
                return <AdminShipmentManagement 
                            shipments={shipments}
                            users={users}
                            inventory={inventory}
                            onUpdateShipmentStatus={authActions.updateShipmentStatus}
                        />;
            case 'pickups':
                return <AdminPickupManagement
                            pickupRequests={pickupRequests}
                            inventory={inventory}
                            onUpdatePickupRequestStatus={authActions.updatePickupRequestStatus}
                        />;
            default:
                return null;
        }
    };
    
    const TabButton: React.FC<{tab: AdminTab, label: string, icon: React.ReactNode, disabled?: boolean}> = ({ tab, label, icon, disabled }) => (
        <button
            onClick={() => handleTabClick(tab)}
            disabled={disabled}
            className={`flex items-center space-x-3 w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === tab 
                ? 'bg-black text-white shadow-lg' 
                : 'text-gray-600 hover:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">後台管理</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8 items-start">
                <aside className="md:col-span-1 lg:col-span-1">
                    <nav className="space-y-2 sticky top-24 bg-white p-4 rounded-lg shadow-md">
                        <TabButton tab="financials" label="財務報表" icon={<ChartBarIcon className="w-5 h-5"/>} />
                        <TabButton tab="shipments" label="出貨管理" icon={<TruckIcon className="w-5 h-5" />} />
                        <TabButton tab="pickups" label="自取管理" icon={<BuildingStorefrontIcon className="w-5 h-5" />} />
                        <TabButton tab="products" label="商品管理" icon={<TicketIcon className="w-5 h-5"/>} />
                        <TabButton tab="categories" label="分類管理" icon={<ListBulletIcon className="w-5 h-5" />} />
                        <TabButton tab="users" label="使用者管理" icon={<UsersIcon className="w-5 h-5" />} disabled={true} />
                        <TabButton tab="transactions" label="交易紀錄" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
                        <TabButton tab="site" label="網站設定" icon={<CogIcon className="w-5 h-5" />} />
                    </nav>
                </aside>
                <main className="md:col-span-3 lg:col-span-4">
                    {renderTabContent()}
                </main>
            </div>
        </div>
    );
};