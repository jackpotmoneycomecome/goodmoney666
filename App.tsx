import React, { useEffect, useState } from 'react';
import { Routes, Route, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';

// Child Components
import { HomePage } from './components/HomePage';
import { LotteryPage } from './components/LotteryPage';
import { AuthPage } from './components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import { AdminPage } from './components/AdminPage';
import { VerificationPage } from './components/VerificationPage';
import { AdminAuthModal } from './components/AdminAuthModal';
import { FAQPage } from './components/FAQPage';
import { UserIcon, CogIcon, LogoutIcon } from './components/icons';
import { useAuthStore } from './store/authStore';
import { useSiteStore } from './store/siteDataStore';
import type { User } from './types';

// --- HEADER & FOOTER ---
const Header: React.FC<{ storeName: string; currentUser: User | null; onNavigate: (path: string) => void; onLogout: () => void; onAdminClick: () => void; }> = ({ storeName, currentUser, onNavigate, onLogout, onAdminClick }) => (
    <header className="sticky top-0 z-40 bg-white shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
                <button onClick={() => onNavigate('/')} className="text-2xl font-bold text-black hover:text-gray-700 transition-colors">{storeName}</button>
                <nav className="hidden md:flex items-center space-x-6">
                    <button onClick={() => onNavigate('/')} className="font-medium text-gray-600 hover:text-yellow-500 transition-colors">首頁</button>
                    <button onClick={() => onNavigate('/faq')} className="font-medium text-gray-600 hover:text-yellow-500 transition-colors">常見問題</button>
                    <button onClick={() => onNavigate('/verification')} className="font-medium text-gray-600 hover:text-yellow-500 transition-colors">公平性驗證</button>
                </nav>
            </div>
            <div className="flex items-center space-x-4">
                {currentUser ? (<>
                    <div className="hidden sm:block text-sm">
                        <span className="text-gray-600">你好, </span><button onClick={() => onNavigate('/profile')} className="font-semibold text-black hover:underline">{currentUser.username}</button>
                        <span className="text-gray-600 mx-2">|</span><span className="font-semibold text-yellow-500">{currentUser.points.toLocaleString()} P</span>
                    </div>
                    <button onClick={() => onNavigate('/profile')} className="text-gray-500 hover:text-yellow-500" title="個人資料"><UserIcon className="w-6 h-6" /></button>
                    <button onClick={onLogout} className="text-gray-500 hover:text-yellow-500" title="登出"><LogoutIcon className="w-6 h-6" /></button>
                </>) : (
                    <button onClick={() => onNavigate('/auth')} className="bg-[#ffc400] text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-yellow-400 transition-colors shadow-md border-2 border-black">登入/註冊</button>
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

const Layout: React.FC = () => {
    const navigate = useNavigate();
    const { siteConfig } = useSiteStore();
    const { currentUser, logout, verifyAdminPassword } = useAuthStore();
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
    const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

    const handleAdminClick = () => {
        if (isAdminAuthenticated) {
            navigate('/admin');
        } else if (currentUser?.role === 'ADMIN') {
            setAdminAuthError(null);
            setIsReAuthModalOpen(true);
        }
    };
    
    const handleAdminPasswordVerify = async (password: string) => {
        const success = await verifyAdminPassword(password);
        if (success) {
            setIsAdminAuthenticated(true);
            setIsReAuthModalOpen(false);
            navigate('/admin');
        } else {
            setAdminAuthError('密碼錯誤或驗證失敗');
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Header
                storeName={siteConfig.storeName}
                currentUser={currentUser}
                onNavigate={(path) => {
                    navigate(path);
                    window.scrollTo(0, 0);
                }}
                onLogout={() => {
                  logout();
                  setIsAdminAuthenticated(false);
                  navigate('/');
                }}
                onAdminClick={handleAdminClick}
            />
            <main className="flex-grow">
                <Outlet />
            </main>
            {isReAuthModalOpen && (
                <AdminAuthModal
                    authError={adminAuthError}
                    onClose={() => setIsReAuthModalOpen(false)}
                    onVerifyPassword={handleAdminPasswordVerify}
                />
            )}
            <Footer />
        </div>
    );
};

interface ProtectedRouteProps {
    adminOnly?: boolean;
    children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ adminOnly = false, children }) => {
    const { isAuthenticated, currentUser, isLoading } = useAuthStore();
    const location = useLocation();

    if (isLoading) {
        return <div className="text-center p-16">驗證使用者身份中...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (adminOnly && currentUser?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    return children;
};

function App() {
  const { checkSession } = useAuthStore();
  const { fetchSiteData, startPollingLotterySets } = useSiteStore();

  useEffect(() => {
    // Initial data load
    checkSession();
    fetchSiteData();

    // Start polling for lottery set updates
    const stopPolling = startPollingLotterySets();
    
    // Cleanup on component unmount
    return () => {
      stopPolling();
    };
  }, [checkSession, fetchSiteData, startPollingLotterySets]);

  return (
      <Routes>
          <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/lottery/:lotteryId" element={<LotteryPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminPage /></ProtectedRoute>} />
              <Route path="/verification" element={<VerificationPage />} />
              <Route path="/faq" element={<FAQPage />} />
          </Route>
      </Routes>
  );
}

export default App;