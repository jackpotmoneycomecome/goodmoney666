import React, { useState, useMemo } from 'react';
import type { Shipment, User, PrizeInstance } from '../types';
import { XCircleIcon } from './icons';

interface AdminShipmentManagementProps {
    shipments: Shipment[];
    users: User[];
    inventory: { [key: string]: PrizeInstance };
    onUpdateShipmentStatus: (shipmentId: string, status: 'PROCESSING' | 'SHIPPED', trackingNumber?: string, carrier?: string) => void;
}

const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-green-100 text-green-800',
};

const ShipmentDetailModal: React.FC<{
    shipment: Shipment;
    inventory: { [key: string]: PrizeInstance };
    onClose: () => void;
    onUpdateStatus: (shipmentId: string, status: 'PROCESSING' | 'SHIPPED', trackingNumber?: string, carrier?: string) => void;
}> = ({ shipment, inventory, onClose, onUpdateStatus }) => {
    
    const [trackingNumber, setTrackingNumber] = useState(shipment.trackingNumber || '');
    const [carrier, setCarrier] = useState(shipment.carrier || '');

    const handleUpdate = (status: 'PROCESSING' | 'SHIPPED') => {
        onUpdateStatus(shipment.id, status, trackingNumber, carrier);
        if (status === 'SHIPPED') {
            onClose();
        }
    };
    
    const prizes = shipment.prizeInstanceIds.map(id => inventory[id]).filter(Boolean);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 m-4 max-w-3xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-95 animate-modal-pop" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-8 h-8"/></button>
                <h3 className="text-2xl font-bold mb-6">出貨單詳情</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-lg mb-2">基本資訊</h4>
                        <div className="text-sm space-y-2 bg-gray-50 p-4 rounded-lg">
                            <p><strong>單號:</strong> {shipment.id}</p>
                            <p><strong>申請人:</strong> {shipment.username} ({shipment.userId})</p>
                            <p><strong>申請時間:</strong> {new Date(shipment.requestedAt).toLocaleString()}</p>
                            <p><strong>運費:</strong> {shipment.shippingCostInPoints} P</p>
                            <p><strong>總重量:</strong> {(shipment.totalWeightInGrams / 1000).toFixed(2)} kg</p>
                        </div>
                        <h4 className="font-semibold text-lg mb-2 mt-4">收件地址</h4>
                        <div className="text-sm bg-gray-50 p-4 rounded-lg">
                            <p><strong>收件人:</strong> {shipment.shippingAddress.name}</p>
                            <p><strong>電話:</strong> {shipment.shippingAddress.phone}</p>
                            <p><strong>地址:</strong> {shipment.shippingAddress.address}</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-lg mb-2">撿貨清單 ({prizes.length}件)</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2">
                            {prizes.map(p => (
                                <div key={p.instanceId} className="flex items-center gap-3 bg-gray-50 p-2 rounded">
                                    <img src={p.imageUrl} alt={p.name} className="w-12 h-12 object-cover rounded" loading="lazy"/>
                                    <div>
                                        <p className="font-semibold text-sm">{p.grade} - {p.name}</p>
                                        <p className="text-xs text-gray-500">{p.weight}g</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-lg mb-3">更新狀態</h4>
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {shipment.status === 'PENDING' && (
                            <button onClick={() => handleUpdate('PROCESSING')} className="w-full md:w-auto bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600">標示為處理中</button>
                        )}
                        {shipment.status !== 'SHIPPED' && (
                             <div className="flex-grow w-full space-y-2 p-4 bg-gray-100 rounded-lg">
                                <input type="text" placeholder="物流公司 (例如: 黑貓宅急便)" value={carrier} onChange={e => setCarrier(e.target.value)} className="w-full border p-2 rounded-md border-gray-300"/>
                                <input type="text" placeholder="物流追蹤碼" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="w-full border p-2 rounded-md border-gray-300"/>
                                <button onClick={() => handleUpdate('SHIPPED')} disabled={!carrier || !trackingNumber} className="w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-green-600 disabled:bg-gray-400">標示為已出貨</button>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export const AdminShipmentManagement: React.FC<AdminShipmentManagementProps> = ({ shipments, inventory, onUpdateShipmentStatus }) => {
    const [filterStatus, setFilterStatus] = useState<'ALL' | Shipment['status']>('ALL');
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

    const sortedAndFilteredShipments = useMemo(() => {
        return [...shipments]
            .filter(s => filterStatus === 'ALL' || s.status === filterStatus)
            .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    }, [shipments, filterStatus]);
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">出貨管理</h2>
            <div className="mb-4">
                <div className="flex space-x-2">
                    {(['ALL', 'PENDING', 'PROCESSING', 'SHIPPED'] as const).map(status => (
                        <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-1.5 text-sm font-semibold rounded-full ${filterStatus === status ? 'bg-black text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                            {status === 'ALL' ? '全部' : status === 'PENDING' ? '待處理' : status === 'PROCESSING' ? '處理中' : '已出貨'}
                        </button>
                    ))}
                </div>
            </div>
            
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申請時間</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申請人</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">件數</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredShipments.map(s => (
                             <tr key={s.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(s.requestedAt).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.prizeInstanceIds.length}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[s.status]}`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => setSelectedShipment(s)} className="text-indigo-600 hover:text-indigo-900">檢視詳情</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {sortedAndFilteredShipments.length === 0 && <p className="text-center py-4 text-gray-500">沒有符合條件的出貨單。</p>}
            
            {selectedShipment && (
                <ShipmentDetailModal 
                    shipment={selectedShipment}
                    inventory={inventory}
                    onClose={() => setSelectedShipment(null)}
                    onUpdateStatus={(...args) => {
                        onUpdateShipmentStatus(...args);
                        const updatedShipment = { ...selectedShipment, status: args[1] };
                        if(args[1] === 'SHIPPED') {
                             updatedShipment.trackingNumber = args[2];
                             updatedShipment.carrier = args[3];
                        }
                        setSelectedShipment(updatedShipment);
                    }}
                />
            )}
        </div>
    );
};