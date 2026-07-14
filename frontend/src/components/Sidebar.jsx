import { useState, useEffect } from 'react';
import { Mail, Star, Send, Inbox, Folder, Trash2, Clipboard, Archive, Tag, Plus, ChevronRight, ChevronDown, HelpCircle, Trash2 as DeleteIcon, X, ChevronLeft } from 'lucide-react';
import { del, get, post } from '../utils/request';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

const folders = [
  { id: 'INBOX', name: '收件箱', icon: Inbox },
  { id: 'STARRED', name: '星标邮件', icon: Star },
  { id: 'SENT', name: '已发送', icon: Send },
  { id: 'DRAFTS', name: '草稿箱', icon: Clipboard },
  { id: 'ARCHIVE', name: '已归档', icon: Archive },
  { id: 'TRASH', name: '垃圾箱', icon: Trash2 },
];

export default function Sidebar({ accounts, selectedAccount, selectedFolder, selectedLabel, onSelectAccount, onSelectFolder, onSelectLabel, onAddAccount, onAccountDeleted }) {
  const { showToast } = useToast();
  const [expandedAccounts, setExpandedAccounts] = useState(new Set([selectedAccount?.id]));
  // const [showSettings, setShowSettings] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [labels, setLabels] = useState([]);
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  const toggleAccountExpand = (accountId) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const handleDeleteAccount = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    setModalConfig({
      title: '删除邮箱账户',
      content: `确定要删除邮箱账户 "${account?.email || ''}" 吗？此操作将删除该账户下的所有邮件数据，且无法恢复！`,
      onConfirm: async () => {
        try {
          await del(`/email-accounts/${accountId}`);
          onAccountDeleted && onAccountDeleted(accountId);
          showToast('邮箱账户删除成功', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'danger'
    });
    setShowModal(true);
  };

  const fetchLabels = async () => {
    try {
      const result = await get(`/labels?account_id=${selectedAccount?.id}`);
      setLabels(result);
    } catch (err) {
      console.error('Failed to fetch labels:', err);
    }
  };

  const handleAddLabel = async () => {
    if (!newLabelName.trim()) {
      showToast('标签名称不能为空', 'warning');
      return;
    }
    try {
      await post('/labels', { name: newLabelName.trim(), account_id: selectedAccount?.id });
      fetchLabels();
      setNewLabelName('');
      setShowAddLabelModal(false);
      showToast('标签创建成功', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLabel = async (labelId) => {
    setModalConfig({
      title: '删除标签',
      content: '确定要删除这个标签吗？',
      onConfirm: async () => {
        try {
          await del(`/labels/${labelId}`);
          fetchLabels();
          if (selectedLabel === labelId) {
            onSelectLabel(null);
          }
          showToast('标签删除成功', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'danger'
    });
    setShowModal(true);
  };

  const [modalConfig, setModalConfig] = useState({ title: '', content: '', onConfirm: () => {}, type: 'confirm' });
  const [helpExpanded, setHelpExpanded] = useState(false);

  const helpItems = [
    { title: '如何添加邮箱', description: '点击"添加邮箱"按钮，输入邮箱地址和授权码即可添加' },
    { title: '支持哪些邮箱', description: '支持QQ邮箱、163邮箱、126邮箱、Gmail等主流邮箱' },
    { title: '授权码获取', description: '在官方邮箱设置中开启IMAP/SMTP服务，获取授权码' },
    { title: '邮件同步', description: '添加邮箱后需手动同步最近邮件，后续实时推送新邮件' },
    { title: '常见问题', description: '邮箱添加失败、邮件同步慢等常见问题解决方案' },
  ];
  useEffect(() => {
    if (selectedAccount) {
      fetchLabels();
    }
  }, [selectedAccount]);

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-2 border-b border-gray-200 h-[50px]">
        <button
          onClick={onAddAccount}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">添加邮箱</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {accounts.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无邮箱账户</p>
            <button
              onClick={onAddAccount}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              点击添加
            </button>
          </div>
        ) : (
          <div className="py-2">
            {accounts.map((account) => {
              const isExpanded = expandedAccounts.has(account.id);
              const isSelected = selectedAccount?.id === account.id;

              return (
                <div key={account.id} className="mb-1">
                  <div
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      onSelectAccount(account);
                      toggleAccountExpand(account.id);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isSelected ? 'text-blue-600' : 'text-gray-800'
                        }`}>
                          {account.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(account.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(account.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                        title="删除账户"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && isSelected && (
                    <div className="bg-gray-50 border-l-2 border-blue-500">
                      {folders.map((folder) => {
                        const FolderIcon = folder.icon;
                        const isFolderSelected = selectedFolder === folder.id && !selectedLabel;

                        return (
                          <div
                            key={folder.id}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition ${
                              isFolderSelected
                                ? 'bg-white text-blue-600 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            onClick={() => { onSelectFolder(folder.id); onSelectLabel(null); }}
                          >
                            <FolderIcon className="w-4 h-4" />
                            <span className="text-sm">{folder.name}</span>
                          </div>
                        );
                      })}

                      <div className="px-3 py-2">
                        <div 
                          className="flex items-center gap-2 text-gray-500 cursor-pointer hover:text-gray-700"
                          onClick={() => setLabelsExpanded(!labelsExpanded)}
                        >
                          <Tag className="w-4 h-4" />
                          <span className="text-sm">我的标签</span>
                          {labelsExpanded ? (
                            <ChevronDown className="w-4 h-4 ml-auto" />
                          ) : (
                            <ChevronRight className="w-4 h-4 ml-auto" />
                          )}
                        </div>
                      </div>

                      {labelsExpanded && (
                        <div className="pl-6">
                          {labels.map((label) => {
                            const isLabelSelected = selectedLabel === label.id;
                            return (
                              <div
                                key={label.id}
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition ${
                                  isLabelSelected
                                    ? 'bg-white text-blue-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                                onClick={() => { onSelectLabel(label.id); }}
                              >
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: label.color }}
                                />
                                <span className="text-sm flex-1 truncate">{label.name}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLabel(label.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition opacity-0 hover:opacity-100"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => { fetchLabels(); setShowAddLabelModal(true); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">添加标签</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200">
        <div 
          className="flex items-center justify-between px-3 py-2 text-gray-500 cursor-pointer hover:text-gray-700 hover:bg-gray-50 transition"
          onClick={() => setHelpExpanded(!helpExpanded)}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm">使用帮助</span>
          </div>
          {helpExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
        {helpExpanded && (
          <div className="bg-gray-50 px-3 pb-3">
            {helpItems.map((item, index) => (
              <div 
                key={index}
                className="py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-2 text-gray-700 text-sm font-medium">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    {index + 1}
                  </div>
                  {item.title}
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-7 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <Modal
        title={modalConfig.title}
        content={modalConfig.content}
        show={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={modalConfig.onConfirm}
        type={modalConfig.type}
      />

      {showAddLabelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">添加标签</h2>
              <button
                onClick={() => setShowAddLabelModal(false)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">标签名称</label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="输入标签名称"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddLabel}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                >
                  添加
                </button>
                <button
                  onClick={() => setShowAddLabelModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
