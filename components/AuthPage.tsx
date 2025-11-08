import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleIcon } from './icons';
import { useAuthStore } from '../store/authStore';


export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, error: authError, isLoading } = useAuthStore();
  
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let success = false;
    if (isLoginView) {
      success = await login(email, password);
    } else {
      success = await register(username, email, password);
    }
    if (success) {
      navigate(from, { replace: true });
    }
  };

  const handleGoogleClick = async () => {
    // This will redirect to Google's sign-in page via Firebase
    // In a real app, you would configure the redirect URI in Firebase console
    // await googleLogin();
    alert("Google/LINE login would be implemented via Firebase redirects.");
  }
  
  const handleLineClick = async () => {
    // await lineLogin();
    alert("Google/LINE login would be implemented via Firebase redirects.");
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLoginView ? '登入您的帳戶' : '建立新帳戶'}
          </h2>
        </div>
        <div className="flex justify-center border-b border-gray-200">
            <button 
                onClick={() => setIsLoginView(true)} 
                className={`px-6 py-2 font-semibold ${isLoginView ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}
            >
                登入
            </button>
            <button 
                onClick={() => setIsLoginView(false)} 
                className={`px-6 py-2 font-semibold ${!isLoginView ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}
            >
                註冊
            </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              使用 Google 帳號
            </button>
            <button
              type="button"
              onClick={handleLineClick}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#00B900] hover:bg-[#00A300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00B900] disabled:opacity-50"
            >
              使用 LINE 帳號
            </button>
        </div>
        
        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                    或
                </span>
            </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {!isLoginView && (
              <div>
                <label htmlFor="username" className="sr-only">使用者名稱</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-yellow-400 focus:border-yellow-400 focus:z-10 sm:text-sm"
                  placeholder="使用者名稱"
                />
              </div>
            )}
            <div>
              <label htmlFor="email-address" className="sr-only">電子郵件</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${isLoginView ? 'rounded-t-md' : ''} focus:outline-none focus:ring-yellow-400 focus:border-yellow-400 focus:z-10 sm:text-sm`}
                placeholder="電子郵件"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">密碼</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-yellow-400 focus:border-yellow-400 focus:z-10 sm:text-sm"
                placeholder="密碼"
              />
            </div>
          </div>

          {authError && (
              <div className="text-red-500 text-sm text-center">{authError}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border-2 border-black text-sm font-medium rounded-md text-black bg-[#ffc400] hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:bg-yellow-200"
            >
              {isLoading ? '處理中...' : (isLoginView ? '登入' : '註冊')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};