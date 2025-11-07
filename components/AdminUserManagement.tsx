
import React, { useState, useMemo } from 'react';
import type { User } from '../types.ts';

interface UserRowProps {
    user: User;
    currentUser: User; // The currently logged-in admin
    isLastAdmin: boolean;
    onUpdateUserPoints: (userId: string, newPoints: number, notes: string) => void;
    onUpdateUserRole: (userId: string, newRole: 'USER' | 'ADMIN') => void;
    onViewTransactions: (username: string) => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, currentUser, isLastAdmin, onUpdateUserPoints, onUpdateUserRole, onViewTransactions }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [points, setPoints] = useState(user.points);
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        onUpdateUserPoints(user.id, Number(points), notes);
        setIsEditing(false);
        setNotes('');
    };

    const handleCancel = () => {
        setPoints(user.points);
        setIsEditing(false);
        setNotes('');
    }

    const canChangeRole = user.id !== currentUser.id && !(isLastAdmin && user.role === 'ADMIN');

    return (
        <tr className={user.id === currentUser.id ? 'bg-yellow-50' : ''}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {isEditing ? (
                    <input
                        type="number"
                        value={points}
                        onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)}
                        className="w-24 border border-gray-300 rounded-md py-1 px-2"
                    />
                ) : (
                    user.points.toLocaleString()
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                <select 
                  value={user.role}
                  onChange={(e) => onUpdateUserRole(user.id, e.target.value as 'USER' | 'ADMIN')}
                  disabled={!canChangeRole}
                  className={`border rounded-md py-1 px-2 ${canChangeRole ? 'border-gray-300' : 'border-gray-200 bg-gray-100 cursor-not-allowed'}`}
                  title={!canChangeRole ? "無法更改自己的角色或唯一的管理員" : ""}
                >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                </select>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {isEditing && (
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="選填，說明調整原因"
                        className="w-full border border-gray-300 rounded-md py-1 px-2"
                    />
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                {isEditing ? (
                    <>
                        <button onClick={handleSave} className="text-green-600 hover:text-green-900">儲存</button>
                        <button onClick={handleCancel} className="text-gray-600 hover:text-gray-900">取消</button>
                    </>
                ) : (
                    <>
                        <button onClick={() => onViewTransactions(user.username)} className="text-blue-600 hover:text-blue-900">查看訂單</button>
                        <button onClick={() => setIsEditing(true)} className="text-indigo-600 hover:text-indigo-900">編輯點數</button>
                    </>
                )}
            </td>
        </tr>
    );
};

export const AdminUserManagement: React.FC<{ 
    users: User[], 
    currentUser: User | null,
    onUpdateUserPoints: (userId: string, newPoints: number, notes: string) => void,
    onUpdateUserRole: (userId: string, newRole: 'USER' | 'ADMIN') => void,
    onViewUserTransactions: (username: string) => void 
}> = ({ users, currentUser, onUpdateUserPoints, onUpdateUserRole, onViewUserTransactions }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const adminCount = useMemo(() => users.filter(u => u.role === 'ADMIN').length, [users]);
    const isLastAdmin = adminCount === 1;

    if (!currentUser) return null;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-bold">使用者管理</h2>
                 <input
                    type="text"
                    placeholder="搜尋使用者名稱或 Email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-sm p-2 border border-gray-300 rounded-md"
                />
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用者名稱</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">點數</th>
                             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備註 (編輯時)</th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map(user => (
                            <UserRow 
                                key={user.id} 
                                user={user} 
                                currentUser={currentUser}
                                isLastAdmin={isLastAdmin}
                                onUpdateUserPoints={onUpdateUserPoints} 
                                onUpdateUserRole={onUpdateUserRole}
                                onViewTransactions={onViewUserTransactions} 
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};