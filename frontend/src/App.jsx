import { useState, useEffect, useRef } from 'react';
import { Mail, LogOut, Send, Search, Settings, User, ChevronRight, Plus, LayoutList, LayoutGrid } from 'lucide-react';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeEmail from './components/ComposeEmail';
import { get } from './utils/request';
import { useToast } from './context/ToastContext';

export default function App() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeFullscreen, setComposeFullscreen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [replyMode, setReplyMode] = useState(null);
  const [replyEmail, setReplyEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTrigger, setSearchTrigger] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newEmailCount, setNewEmailCount] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { showToast, showEmailToast } = useToast();
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_email') {
            setNewEmailCount(prev => prev + data.emails.length);
            showEmailToast(data.emails || []);
            if (selectedAccount && selectedAccount.id === data.accountId) {
              setSelectedEmail(null);
            }
          }

          if (data.type === 'pong') {
            console.log('WebSocket pong received');
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        reconnectTimerRef.current = setTimeout(connectWs, 5000);
      };
    };

    connectWs();

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      clearInterval(pingInterval);
    };
  }, [user, selectedAccount?.id, showToast, showEmailToast]);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const userMenu = document.querySelector('.user-menu-container');
      if (userMenu && !userMenu.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchAccounts = async () => {
    try {
      const result = await get('/email-accounts');
      setAccounts(result);
      if (result.length > 0 && !selectedAccount) {
        setSelectedAccount(result[0]);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const handleAuth = (newUser) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setAccounts([]);
    setSelectedAccount(null);
    setSelectedEmail(null);
  };

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
    setSelectedEmail(null);
    setSelectedFolder('INBOX');
    setSelectedLabel(null);
  };

  const handleSelectFolder = (folder) => {
    setSelectedFolder(folder);
    setSelectedLabel(null);
    setSelectedEmail(null);
  };

  const handleSelectLabel = (label) => {
    setSelectedLabel(label);
    setSelectedEmail(null);
  };

  const handleSelectEmail = (email) => {
    if (email.folder === 'DRAFTS') {
      setEditingDraft(email);
      setShowCompose(true);
    } else {
      setSelectedEmail(email);
    }
  };

  const handleBackFromDetail = () => {
    setSelectedEmail(null);
  };

  const handleDeleteEmail = (emailId) => {
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
  };

  const handleStarEmail = (emailId, isStarred) => {
    setSelectedEmail(prev => prev?.id === emailId ? { ...prev, is_starred: isStarred } : prev);
  };

  const handleReply = (email) => {
    setReplyMode('reply');
    setReplyEmail(email);
    setEditingDraft(null);
    setShowCompose(true);
  };

  const handleReplyAll = (email) => {
    setReplyMode('replyAll');
    setReplyEmail(email);
    setEditingDraft(null);
    setShowCompose(true);
  };

  const handleForward = (email) => {
    setReplyMode('forward');
    setReplyEmail(email);
    setEditingDraft(null);
    setShowCompose(true);
  };

  const handleAccountAdded = () => {
    fetchAccounts();
    setShowAccountModal(false);
  };

  const handleAccountDeleted = (deletedAccountId) => {
    fetchAccounts();
    if (selectedAccount?.id === deletedAccountId) {
      setSelectedAccount(null);
      setSelectedEmail(null);
      setSelectedFolder('INBOX');
      setSelectedLabel(null);
    }
  };
  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 h-12 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <img src="./src/images/logo.png" alt="logo" className="w-12 h-12" />
            <span className="font-bold text-xl text-gray-800" style={{ fontFamily: 'Ma Shan Zheng, cursive' }}>邮管家</span>   
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchTrigger(Date.now());
                }
              }}
              placeholder="搜索邮件..."
              className="w-64 pl-10 pr-4 py-1.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <Send className="w-4 h-4" />
            写信
          </button>
          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-1 p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition"
            title="添加邮箱"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">添加邮箱</span>
          </button>
          {/* <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition" title="设置">
            <Settings className="w-4 h-4" />
          </button> */}
          <button
            onClick={() => {
              if (viewMode === 'split') {
                setViewMode('list');
                setSelectedEmail(null);
              } else {
                setViewMode('split');
              }
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition"
            title={viewMode === 'split' ? '切换到列表模式' : '切换到预览模式'}
          >
            {viewMode === 'split' ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
          <div className="relative pl-3 border-l border-gray-200 user-menu-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-2 hover:bg-gray-100 rounded-md transition p-1"
            >
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm text-gray-700">{user.username}</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
          <Sidebar
            accounts={accounts}
            selectedAccount={selectedAccount}
            selectedFolder={selectedFolder}
            selectedLabel={selectedLabel}
            onSelectAccount={handleSelectAccount}
            onSelectFolder={handleSelectFolder}
            onSelectLabel={handleSelectLabel}
            onAddAccount={() => setShowAccountModal(true)}
            onAccountDeleted={handleAccountDeleted}
          />

        <div className="flex-1 flex flex-row overflow-hidden">
          {composeFullscreen ? (
            showCompose ? (
              <ComposeEmail
                account={selectedAccount}
                accounts={accounts}
                onClose={() => { setShowCompose(false); setEditingDraft(null); setReplyMode(null); setReplyEmail(null); setComposeFullscreen(false); }}
                onAccountChange={handleSelectAccount}
                draft={editingDraft}
                replyMode={replyMode}
                replyEmail={replyEmail}
                isFullscreen={composeFullscreen}
                onToggleFullscreen={() => setComposeFullscreen(!composeFullscreen)}
              />
            ) : null
          ) : (
            <div className="flex-1 flex flex-row overflow-hidden">
              <div className="flex-1 overflow-hidden border-r border-gray-200">
                {(viewMode === 'split' || !selectedEmail ) ? (
                  <EmailList
                    account={selectedAccount}
                    folder={selectedFolder}
                    selectedLabel={selectedLabel}
                    selectedEmailId={selectedEmail?.id}
                    onSelectEmail={handleSelectEmail}
                    refreshTrigger={newEmailCount}
                    searchQuery={searchQuery}
                    searchTrigger={searchTrigger}
                    viewMode={viewMode}
                    showCompose={showCompose}
                  />
                ) : (
                  <EmailDetail
                    email={selectedEmail}
                    account={selectedAccount}
                    onBack={handleBackFromDetail}
                    onDelete={handleDeleteEmail}
                    onStar={handleStarEmail}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    viewMode={viewMode}
                  />
                )}
              </div>

              {(viewMode === 'split') && (
                <div className="flex-1 overflow-hidden border-r border-gray-200">
                  <EmailDetail
                    email={selectedEmail}
                    account={selectedAccount}
                    onBack={handleBackFromDetail}
                    onDelete={handleDeleteEmail}
                    onStar={handleStarEmail}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    viewMode={viewMode}
                  />
                </div>
              )}

              {showCompose && (
                <div className="flex-1 overflow-hidden">
                  <ComposeEmail
                    account={selectedAccount}
                    accounts={accounts}
                    onClose={() => { setShowCompose(false); setEditingDraft(null); setReplyMode(null); setReplyEmail(null); }}
                    onAccountChange={handleSelectAccount}
                    draft={editingDraft}
                    replyMode={replyMode}
                    replyEmail={replyEmail}
                    isFullscreen={composeFullscreen}
                    onToggleFullscreen={() => setComposeFullscreen(!composeFullscreen)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showAccountModal && (
        <AddAccountModal
          onClose={() => setShowAccountModal(false)}
          onSuccess={handleAccountAdded}
        />
      )}
    </div>
  );
}

import { X } from 'lucide-react';
import { post } from './utils/request';

function AddAccountModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    smtp_host: '',
    smtp_port: '',
    imap_host: '',
    imap_port: '',
    auth_code: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await post('/email-accounts', formData);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">添加邮箱账户</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP 主机</label>
              <input
                type="text"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="smtp.example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP 端口</label>
              <input
                type="number"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="465"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IMAP 主机</label>
              <input
                type="text"
                value={formData.imap_host}
                onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="imap.example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IMAP 端口</label>
              <input
                type="number"
                value={formData.imap_port}
                onChange={(e) => setFormData({ ...formData, imap_port: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="993"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">授权码</label>
            <input
              type="password"
              value={formData.auth_code}
              onChange={(e) => setFormData({ ...formData, auth_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="输入授权码"
              required
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? '添加中...' : '添加'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
