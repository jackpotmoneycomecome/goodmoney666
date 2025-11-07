import React, { useMemo } from 'react';
import type { Transaction, User, Order, LotterySet } from '../types';
import { rechargeOptions } from '../data/mockData';
import { UsersIcon, TicketIcon, StackedCoinIcon } from './icons';

interface AdminFinancialReportProps {
    transactions: Transaction[];
    users: User[];
    orders: Order[];
    lotterySets: LotterySet[];
}

const KpiCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
        <div className={`rounded-full p-3 ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

export const AdminFinancialReport: React.FC<AdminFinancialReportProps> = ({ transactions, users, orders, lotterySets }) => {
    
    const reportData = useMemo(() => {
        const rechargeTxs: Transaction[] = transactions.filter((tx: Transaction) => tx.type === 'RECHARGE');
        const drawTxs: Transaction[] = transactions.filter((tx: Transaction) => tx.type === 'DRAW');
        const recycleTxs: Transaction[] = transactions.filter((tx: Transaction) => tx.type === 'RECYCLE');
        const adminAdjustmentTxs: Transaction[] = transactions.filter((tx: Transaction) => tx.type === 'ADMIN_ADJUSTMENT');

        const pointsToPriceMap = new Map<number, number>();
        rechargeOptions.forEach(opt => {
            const totalPoints = opt.points + (opt.bonus || 0);
            pointsToPriceMap.set(totalPoints, opt.price);
        });

        const totalRevenue: number = rechargeTxs.reduce((sum: number, tx: Transaction) => {
            const price = pointsToPriceMap.get(tx.amount);
            return sum + (price || 0);
        }, 0);
        
        const totalPointsIssuedByRecharge: number = rechargeTxs.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
        const totalPointsSpent: number = Math.abs(drawTxs.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0));
        const totalPointsRecycled: number = recycleTxs.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
        const totalAdminAdjustment: number = adminAdjustmentTxs.reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);

        const totalPointsInCirculation: number = users.reduce((sum: number, user: User) => sum + user.points, 0);
        const totalDraws: number = drawTxs.reduce((sum: number, tx: Transaction) => sum + (tx.prizeInstanceIds?.length || 0), 0);
        const totalUsers: number = users.length;
        
        const productPerformance: Record<string, { draws: number; points: number }> = orders.reduce((acc: Record<string, { draws: number; points: number }>, order: Order) => {
            if (!acc[order.lotterySetTitle]) {
                acc[order.lotterySetTitle] = { draws: 0, points: 0 };
            }
            acc[order.lotterySetTitle].draws += order.prizeInstanceIds.length;
            acc[order.lotterySetTitle].points += order.costInPoints;
            return acc;
        }, {} as Record<string, { draws: number; points: number }>);

        const sortedProducts = Object.entries(productPerformance)
            .map(([title, data]) => ({ title, ...data }))
            .sort((a, b) => b.points - a.points);
            
        const rechargeAnalysis: Record<number, { count: number; revenue: number }> = rechargeTxs.reduce((acc: Record<number, { count: number; revenue: number }>, tx: Transaction) => {
            const price = pointsToPriceMap.get(tx.amount);
            if (price) {
                if (!acc[price]) {
                    acc[price] = { count: 0, revenue: 0 };
                }
                acc[price].count += 1;
                acc[price].revenue += price;
            }
            return acc;
        }, {} as Record<number, { count: number; revenue: number }>);
        
        const sortedRechargeOptions = Object.entries(rechargeAnalysis)
            .map(([price, data]) => ({ price: Number(price), ...data }))
            .sort((a,b) => b.revenue - a.revenue);

        return {
            totalRevenue,
            totalPointsIssuedByRecharge,
            totalPointsSpent,
            totalPointsRecycled,
            totalAdminAdjustment,
            totalPointsInCirculation,
            totalDraws,
            totalUsers,
            sortedProducts,
            sortedRechargeOptions
        };

    }, [transactions, users, orders, lotterySets]);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-800">總帳報表</h2>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="總收入 (TWD)" value={`$ ${reportData.totalRevenue.toLocaleString()}`} icon={<StackedCoinIcon className="w-6 h-6 text-green-800"/>} color="bg-green-200" />
                <KpiCard title="總流通點數 (P)" value={reportData.totalPointsInCirculation.toLocaleString()} icon={<StackedCoinIcon className="w-6 h-6 text-yellow-800"/>} color="bg-yellow-200" />
                <KpiCard title="總抽獎次數" value={reportData.totalDraws.toLocaleString()} icon={<TicketIcon className="w-6 h-6 text-gray-800"/>} color="bg-gray-200" />
                <KpiCard title="總使用者數" value={reportData.totalUsers.toLocaleString()} icon={<UsersIcon className="w-6 h-6 text-sky-800"/>} color="bg-sky-200" />
            </div>

            {/* Points Economy */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">點數經濟分析</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-green-700">點數發行 (儲值)</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">+{reportData.totalPointsIssuedByRecharge.toLocaleString()} P</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-red-700">點數消耗 (抽獎)</p>
                        <p className="text-3xl font-bold text-red-600 mt-1">-{reportData.totalPointsSpent.toLocaleString()} P</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-700">點數回收 (回收)</p>
                        <p className="text-3xl font-bold text-yellow-600 mt-1">+{reportData.totalPointsRecycled.toLocaleString()} P</p>
                    </div>
                     <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm font-semibold text-blue-700">管理員調整</p>
                        <p className={`text-3xl font-bold mt-1 ${reportData.totalAdminAdjustment >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {reportData.totalAdminAdjustment >= 0 ? '+' : ''}{reportData.totalAdminAdjustment.toLocaleString()} P
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Product Performance */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-bold mb-4">熱門商品排行</h3>
                    <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">商品名稱</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">總花費點數</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">總抽獎次數</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.sortedProducts.map(product => (
                                    <tr key={product.title}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{product.title}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right font-semibold">{product.points.toLocaleString()} P</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{product.draws.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                 {/* Recharge Analysis */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-bold mb-4">儲值方案分析</h3>
                    <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">方案價格 (TWD)</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">銷售次數</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">貢獻收入</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.sortedRechargeOptions.map(option => (
                                    <tr key={option.price}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">$ {option.price.toLocaleString()}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{option.count.toLocaleString()}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right font-semibold">$ {option.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    );
};