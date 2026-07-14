import { useState, useCallback, useEffect } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { post } from '../utils/request';
import Toast from './Toast';

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    code: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeTimer, setCodeTimer] = useState(null);

  useEffect(() => {
    return () => {
      if (codeTimer) {
        clearInterval(codeTimer);
      }
    };
  }, [codeTimer]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = '请输入密码';
    } 
    else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }
    
    if (!isLogin && !formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }
    
    if (!isLogin && !formData.code.trim()) {
      newErrors.code = '请输入验证码';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isLogin]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setToast({ type: 'error', message: '请检查表单填写是否正确' });
      return;
    }
    
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    setLoading(true);
    setErrors({});

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const data = isLogin 
        ? { email: formData.email, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password, code: formData.code };

      const result = await post(endpoint, data);
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      setToast({ type: 'success', message: isLogin ? '登录成功！' : '注册成功！' });
      setTimeout(() => {
        onAuth(result.user, result.token);
      }, 1000);
    } catch (err) {
      setErrors({ form: err.message });
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  }, [validateForm, isSubmitting, isLogin, formData, onAuth]);

  const handleSendCode = useCallback(async () => {
    if (isSendingCode || codeCountdown > 0) {
      return;
    }
    
    if (!formData.email.trim()) {
      setErrors({ ...errors, email: '请输入邮箱地址' });
      return;
    }
    
    if (!validateEmail(formData.email)) {
      setErrors({ ...errors, email: '请输入有效的邮箱地址' });
      return;
    }
    
    setIsSendingCode(true);
    
    try {
      await post('/auth/send-code', { email: formData.email });
      setToast({ type: 'success', message: '验证码已发送，请查收邮件' });
      setCodeCountdown(60);
      const timer = setInterval(() => {
        setCodeCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCodeTimer(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setCodeTimer(timer);
    } catch (err) {
      setErrors({ ...errors, email: err.message });
      setToast({ type: 'error', message: err.message });
    } finally {
      setIsSendingCode(false);
    }
  }, [isSendingCode, codeCountdown, formData.email, errors]);

  const handlePasswordChange = (value) => {
    setFormData({ ...formData, password: value });
    setPasswordStrength(validatePassword(value));
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleSwitchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setFormData({ username: '', email: '', password: '', code: '' });
    setPasswordStrength(0);
    setCodeCountdown(0);
    if (codeTimer) {
      clearInterval(codeTimer);
      setCodeTimer(null);
    }
  };

  const getStrengthLabel = () => {
    const labels = ['', '弱', '中等', '强', '非常强'];
    return labels[passwordStrength] || '';
  };

  const getStrengthColor = () => {
    const colors = ['bg-gray-300', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
    return colors[passwordStrength] || 'bg-gray-300';
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-blob"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/2 w-[400px] h-[400px] bg-purple-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-blob animation-delay-4000"></div>
      <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-cyan-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-10 animate-blob animation-delay-1000"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-rose-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-10 animate-blob animation-delay-3000"></div>
      
      <div className="w-full max-w-md mx-4 relative z-10">
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/60 animate-fade-in-up">
          <div className="relative px-8 pt-8 pb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-t-3xl"></div>
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 animate-float">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl animate-pulse-ring opacity-20"></div>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">邮箱集成系统</h1>
              <p className="text-sm text-slate-500">{isLogin ? '欢迎回来，请登录您的账户' : '创建新账户，开始您的旅程'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-5">
            {!isLogin && (
              <div className="relative group">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">用户名</label>
                <div className="relative">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${errors.username ? 'text-red-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className={`w-full pl-12 pr-4 py-3 bg-slate-50 border-2 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none ${errors.username ? 'border-red-200 focus:border-red-400 focus:bg-red-50' : 'border-transparent focus:border-blue-400 focus:bg-white'}`}
                    placeholder="请输入用户名"
                  />
                  {errors.username && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                {errors.username && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.username}
                  </p>
                )}
              </div>
            )}

            <div className="relative group">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">邮箱地址</label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${errors.email ? 'text-red-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 bg-slate-50 border-2 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none ${errors.email ? 'border-red-200 focus:border-red-400 focus:bg-red-50' : 'border-transparent focus:border-blue-400 focus:bg-white'}`}
                  placeholder="请输入邮箱地址"
                />
                {errors.email && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email}
                </p>
              )}
            </div>

            {!isLogin && (
              <div className="relative group">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">验证码</label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${errors.code ? 'text-red-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    className={`w-full pl-12 pr-32 py-3 bg-slate-50 border-2 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none ${errors.code ? 'border-red-200 focus:border-red-400 focus:bg-red-50' : 'border-transparent focus:border-blue-400 focus:bg-white'}`}
                    placeholder="请输入验证码"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isSendingCode || codeCountdown > 0}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${codeCountdown > 0 ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : isSendingCode ? 'bg-blue-500/50 text-white cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'}`}
                  >
                    {isSendingCode ? (
                      <div className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        发送中
                      </div>
                    ) : codeCountdown > 0 ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {codeCountdown}s
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        发送验证码
                      </div>
                    )}
                  </button>
                  {errors.code && (
                    <div className="absolute right-28 top-1/2 -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                {errors.code && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.code}
                  </p>
                )}
              </div>
            )}

            <div className="relative group">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${errors.password ? 'text-red-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className={`w-full pl-12 pr-12 py-3 bg-slate-50 border-2 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none ${errors.password ? 'border-red-200 focus:border-red-400 focus:bg-red-50' : 'border-transparent focus:border-blue-400 focus:bg-white'}`}
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password}
                </p>
              ) : !isLogin && formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">密码强度</span>
                    <span className={`text-xs font-medium ${passwordStrength === 1 ? 'text-red-500' : passwordStrength === 2 ? 'text-yellow-500' : passwordStrength === 3 ? 'text-blue-500' : 'text-green-500'}`}>
                      {getStrengthLabel()}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${level <= passwordStrength ? getStrengthColor() : 'bg-slate-200'}`}
                      ></div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {errors.form && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.form}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isSubmitting}
              className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>处理中...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? '登 录' : '注 册'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                  </svg>
                </span>
              )}
            </button>
          </form>

          <div className="px-8 pb-8">
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-slate-500">
                {isLogin ? '还没有账户？' : '已有账户？'}
              </span>
              <button
                onClick={handleSwitchMode}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 cursor-pointer"
              >
                {isLogin ? '立即注册' : '立即登录'}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          登录即表示您同意我们的服务条款和隐私政策
        </p>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}