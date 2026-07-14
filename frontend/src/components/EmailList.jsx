import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, Download, RefreshCw, Trash2, CheckSquare, Square, Flag, Archive, MailCheck, MoreVertical, ChevronDown, Tag, Filter, X } from 'lucide-react';
import { get, post, patch, del, download } from '../utils/request';
import { formatEmailTime } from '../utils/formatTime';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

export default function EmailList({ account, folder, selectedLabel, selectedEmailId, onSelectEmail, refreshTrigger, searchQuery, searchTrigger, viewMode, showCompose }) {
  const { showToast } = useToast();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [showAllChecked, setShowAllChecked] = useState(false);
  const [total, setTotal] = useState(0);
  const [starLoading, setStarLoading] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', content: '', onConfirm: () => {}, type: 'confirm' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [labels, setLabels] = useState([]);
  const [showLabelsDropdown, setShowLabelsDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterConditions, setFilterConditions] = useState({
    readStatus: 'all',
    hasAttachment: false,
    sender: '',
    recipient: '',
    dateRange: 'all',
    sizeRange: 'all'
  });
  const listRef = useRef(null);
  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);

  const fetchLabels = async () => {
    if (!account) return;
    try {
      const result = await get(`/labels?account_id=${account.id}`);
      setLabels(result);
    } catch (err) {
      console.error('Failed to fetch labels:', err);
    }
  };

  useEffect(() => {
    fetchLabels();
  }, [account]);

  const fetchEmails = useCallback(async (offset = 0, shouldAppend = false) => {
    if (!account) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (shouldAppend) setLoadingMore(true);
    else setLoading(true);
    
    const limit = 50;
    
    let url;
    if (searchQuery) {
      const page = Math.floor(offset / limit) + 1;
      url = `/emails/${account.id}/search?keyword=${encodeURIComponent(searchQuery)}&page=${page}&limit=${limit}`;
      if (selectedLabel) {
        url += `&label_id=${selectedLabel}`;
      } else {
        url += `&folder=${folder}`;
      }
    } else {
      url = `/emails/${account.id}?offset=${offset}&limit=${limit}`;
      if (selectedLabel) {
        url += `&label_id=${selectedLabel}`;
      } else {
        url += `&folder=${folder}`;
      }
    }
    
    if (filterConditions.readStatus !== 'all') {
      url += `&is_read=${filterConditions.readStatus}`;
    }
    if (filterConditions.hasAttachment) {
      url += `&has_attachment=1`;
    }
    if (filterConditions.sender) {
      url += `&sender=${encodeURIComponent(filterConditions.sender)}`;
    }
    if (filterConditions.recipient) {
      url += `&recipient=${encodeURIComponent(filterConditions.recipient)}`;
    }
    if (filterConditions.dateRange !== 'all') {
      url += `&date_range=${filterConditions.dateRange}`;
    }
    if (filterConditions.sizeRange !== 'all') {
      url += `&size_range=${filterConditions.sizeRange}`;
    }
    
    try {
      const result = await get(url);
      
      if (shouldAppend) {
        setEmails(prev => [...prev, ...result.emails]);
        setTotal(result.total);
      } else {
        setEmails(result.emails);
        setTotal(result.total);
        offsetRef.current = 0;
      }
      
      setHasMore(result.emails.length === limit);
      offsetRef.current += result.emails.length;
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [account, folder, selectedLabel, searchQuery, filterConditions]);

  useEffect(() => {
    setSelectedEmails(new Set());
    offsetRef.current = 0;
    fetchEmails(0, false);
  }, [account, folder, selectedLabel, fetchEmails, filterConditions]);

  useEffect(() => {
    if (searchTrigger) {
      offsetRef.current = 0;
      fetchEmails(0, false);
    }
  }, [searchTrigger, fetchEmails]);

  useEffect(() => {
    if (!searchQuery) {
      offsetRef.current = 0;
      fetchEmails(0, false);
    }
  }, [searchQuery, fetchEmails]);

  useEffect(() => {
    if (refreshTrigger) {
      offsetRef.current = 0;
      fetchEmails(0, false);
    }
  }, [refreshTrigger, fetchEmails]);

  useEffect(() => {
    setShowAllChecked(selectedEmails.size === emails.length && emails.length > 0);
  }, [selectedEmails, emails]);

  const handleScroll = useCallback(() => {
    if (!listRef.current || fetchingRef.current || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchEmails(offsetRef.current, true);
    }
  }, [fetchEmails, hasMore]);

  const handleSync = async () => {
    if (!account || loading) return;
    setLoading(true);
    try {
      const result = await post(`/emails/${account.id}/sync`, { folder });
      offsetRef.current = 0;
      fetchingRef.current = false;
      await fetchEmails(0, false);
      showToast(`已同步最近${result.synced || 0}条邮件`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStar = async (emailId, isStarred) => {
    if (!account || starLoading.has(emailId)) return;
    setStarLoading(prev => new Set([...prev, emailId]));
    try {
      await patch(`/emails/${account.id}/${emailId}`, { is_starred: !isStarred });
      setEmails(emails.map(e => 
        e.id === emailId ? { ...e, is_starred: !isStarred } : e
      ));
    } catch (err) {
      showToast('星标操作失败', 'error');
    } finally {
      setStarLoading(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  };

  const handleDelete = async (emailId) => {
    if (!account) return;
    setModalConfig({
      title: '移到垃圾箱',
      content: '确定要将这封邮件移到垃圾箱吗？',
      onConfirm: async () => {
        try {
          await patch(`/emails/${account.id}/${emailId}`, { folder: 'TRASH' });
          setEmails(emails.filter(e => e.id !== emailId));
          showToast('已移到垃圾箱', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'confirm'
    });
    setShowModal(true);
  };

  const handleSelectAll = () => {
    if (showAllChecked) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  const handleToggleSelect = (emailId) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleBatchDelete = async () => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要移到垃圾箱的邮件', 'warning');
      return;
    }
    setModalConfig({
      title: '批量移到垃圾箱',
      content: `确定要将选中的 ${selectedEmails.size} 封邮件移到垃圾箱吗？`,
      onConfirm: async () => {
        try {
          for (const emailId of selectedEmails) {
            await patch(`/emails/${account.id}/${emailId}`, { folder: 'TRASH' });
          }
          setEmails(emails.filter(e => !selectedEmails.has(e.id)));
          setSelectedEmails(new Set());
          showToast('已移到垃圾箱', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'confirm'
    });
    setShowModal(true);
  };

  const handleBatchRestore = async () => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要恢复的邮件', 'warning');
      return;
    }
    setModalConfig({
      title: '移回收件箱',
      content: `确定要将选中的 ${selectedEmails.size} 封邮件移回收件箱吗？`,
      onConfirm: async () => {
        try {
          for (const emailId of selectedEmails) {
            await patch(`/emails/${account.id}/${emailId}`, { folder: 'INBOX' });
          }
          setEmails(emails.filter(e => !selectedEmails.has(e.id)));
          setSelectedEmails(new Set());
          showToast('已移回收件箱', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'confirm'
    });
    setShowModal(true);
  };

  const handleBatchPermanentDelete = async () => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要删除的邮件', 'warning');
      return;
    }
    setModalConfig({
      title: '彻底删除',
      content: `确定要彻底删除选中的 ${selectedEmails.size} 封邮件吗？此操作不可恢复！`,
      onConfirm: async () => {
        try {
          for (const emailId of selectedEmails) {
            await del(`/emails/${account.id}/${emailId}`);
          }
          setEmails(emails.filter(e => !selectedEmails.has(e.id)));
          setSelectedEmails(new Set());
          showToast('已彻底删除', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'danger'
    });
    setShowModal(true);
  };

  const handleBatchMarkRead = async () => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要标记的邮件', 'warning');
      return;
    }
    try {
      for (const emailId of selectedEmails) {
        await patch(`/emails/${account.id}/${emailId}`, { is_read: true });
      }
      setEmails(emails.map(e => 
        selectedEmails.has(e.id) ? { ...e, is_read: 1 } : e
      ));
      setSelectedEmails(new Set());
      showToast('已标记为已读', 'success');
    } catch (err) {
      showToast('标记失败', 'error');
    }
  };

  const handleBatchArchive = async () => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要归档的邮件', 'warning');
      return;
    }
    setModalConfig({
      title: '批量归档',
      content: `确定要归档选中的 ${selectedEmails.size} 封邮件吗？`,
      onConfirm: async () => {
        try {
          for (const emailId of selectedEmails) {
            await patch(`/emails/${account.id}/${emailId}`, { folder: 'ARCHIVE' });
          }
          setEmails(emails.filter(e => !selectedEmails.has(e.id)));
          setSelectedEmails(new Set());
          showToast('归档成功', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'confirm'
    });
    setShowModal(true);
  };

  const handleBatchUnarchive = async () => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要移出归档的邮件', 'warning');
      return;
    }
    setModalConfig({
      title: '移出归档',
      content: `确定要将选中的 ${selectedEmails.size} 封邮件移出归档吗？`,
      onConfirm: async () => {
        try {
          for (const emailId of selectedEmails) {
            await patch(`/emails/${account.id}/${emailId}`, { folder: 'INBOX' });
          }
          setEmails(emails.filter(e => !selectedEmails.has(e.id)));
          setSelectedEmails(new Set());
          showToast('已移出归档', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      type: 'confirm'
    });
    setShowModal(true);
  };

  const handleBatchAddLabel = async (labelId) => {
    if (!account || selectedEmails.size === 0) {
      showToast('请先选中要添加标签的邮件', 'warning');
      return;
    }
    try {
      for (const emailId of selectedEmails) {
        await patch(`/emails/${account.id}/${emailId}`, { add_label_id: labelId });
      }
      setEmails(emails.map(e => {
        if (selectedEmails.has(e.id)) {
          const newLabelIds = e.label_ids ? [...e.label_ids] : [];
          if (!newLabelIds.includes(labelId)) {
            newLabelIds.push(labelId);
          }
          return { ...e, label_ids: newLabelIds };
        }
        return e;
      }));
      setSelectedEmails(new Set());
      showToast('标签添加成功', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getFolderName = () => {
    if (selectedLabel) {
      const label = labels.find(l => l.id === selectedLabel);
      return label ? label.name : '标签';
    }
    const folderNames = {
      'INBOX': '收件箱',
      'STARRED': '星标邮件',
      'SENT': '已发送',
      'DRAFTS': '草稿箱',
      'ARCHIVE': '已归档',
      'TRASH': '垃圾箱'
    };
    return folderNames[folder] || '收件箱';
  };

  const hideButtonText = viewMode === 'split' && showCompose;

  return (
    <div className="flex-1 bg-white h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between h-[50px]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition"
          >
            {showAllChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
          {folder === 'TRASH' ? (
            <>
              <button
                onClick={handleBatchRestore}
                disabled={selectedEmails.size === 0}
                className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <MailCheck className="w-4 h-4" />
                {hideButtonText ? null : <span className="text-sm">移回收件箱</span>}
              </button>
              <button
                onClick={handleBatchPermanentDelete}
                disabled={selectedEmails.size === 0}
                className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Trash2 className="w-4 h-4" />
                {hideButtonText ? null : <span className="text-sm">彻底删除</span>}
              </button>
            </>
          ) : folder === 'DRAFTS' ? (
            <button
              onClick={handleBatchPermanentDelete}
              disabled={selectedEmails.size === 0}
              className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 className="w-4 h-4" />
              {hideButtonText ? null : <span className="text-sm">删除</span>}
            </button>
          ) : (
            <button
              onClick={handleBatchDelete}
              disabled={selectedEmails.size === 0}
              className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 className="w-4 h-4" />
              {hideButtonText ? null : <span className="text-sm">删除</span>}
            </button>
          )}
          {folder !== 'DRAFTS' && (
            <>
              <button
                onClick={handleBatchMarkRead}
                disabled={selectedEmails.size === 0}
                className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <MailCheck className="w-4 h-4" />
                {hideButtonText ? null : <span className="text-sm">已读</span>}
              </button>
              {folder === 'ARCHIVE' ? (
                <button
                  onClick={handleBatchUnarchive}
                  disabled={selectedEmails.size === 0}
                  className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Archive className="w-4 h-4" />
                  {hideButtonText ? null : <span className="text-sm">移出归档</span>}
                </button>
              ) : (
                <button
                  onClick={handleBatchArchive}
                  disabled={selectedEmails.size === 0}
                  className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Archive className="w-4 h-4" />
                  {hideButtonText ? null : <span className="text-sm">归档</span>}
                </button>
              )}
            </>
          )}
          <div className="relative">
            <button
              onClick={() => setShowLabelsDropdown(!showLabelsDropdown)}
              className={`flex items-center gap-1 px-${hideButtonText ? 1 : 2} py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition`}
            >
              <Tag className="w-4 h-4" />
              {hideButtonText ? null : <span className="text-sm">标签</span>}
              {hideButtonText ? null : <ChevronDown className="w-3 h-3" />}
            </button>
            {showLabelsDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    onClick={() => {
                      handleBatchAddLabel(label.id);
                      setShowLabelsDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm text-gray-700">{label.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={loading || !account}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition disabled:opacity-50"
            title="同步邮件"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="筛选"
            >
              <Filter className="w-4 h-4" />
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-3 z-20 w-[280px]">
                <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">筛选</span>
                  <button
                    onClick={() => {
                      setFilterConditions({
                        readStatus: 'all',
                        hasAttachment: false,
                        sender: '',
                        recipient: '',
                        dateRange: 'all',
                        sizeRange: 'all'
                      });
                      setShowFilterDropdown(false);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 mb-2">状态</div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="readStatus"
                        checked={filterConditions.readStatus === 'all'}
                        onChange={() => setFilterConditions(prev => ({ ...prev, readStatus: 'all' }))}
                        className="w-3 h-3 text-blue-500"
                      />
                      <span className="text-sm text-gray-700">全部</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="readStatus"
                        checked={filterConditions.readStatus === 'unread'}
                        onChange={() => setFilterConditions(prev => ({ ...prev, readStatus: 'unread' }))}
                        className="w-3 h-3 text-blue-500"
                      />
                      <span className="text-sm text-gray-700">未读</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="readStatus"
                        checked={filterConditions.readStatus === 'read'}
                        onChange={() => setFilterConditions(prev => ({ ...prev, readStatus: 'read' }))}
                        className="w-3 h-3 text-blue-500"
                      />
                      <span className="text-sm text-gray-700">已读</span>
                    </label>
                  </div>
                </div>
                
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 mb-2">是否有附件</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterConditions.hasAttachment}
                      onChange={(e) => setFilterConditions(prev => ({ ...prev, hasAttachment: e.target.checked }))}
                      className="w-3 h-3 text-blue-500 rounded"
                    />
                    <span className="text-sm text-gray-700">包含附件</span>
                  </label>
                </div>
                
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 mb-2">发件人</div>
                  <input
                    type="text"
                    value={filterConditions.sender}
                    onChange={(e) => setFilterConditions(prev => ({ ...prev, sender: e.target.value }))}
                    placeholder="输入发件人"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
                
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 mb-2">收件人</div>
                  <input
                    type="text"
                    value={filterConditions.recipient}
                    onChange={(e) => setFilterConditions(prev => ({ ...prev, recipient: e.target.value }))}
                    placeholder="输入收件人"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
                
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 mb-2">时间</div>
                  <div className="space-y-1">
                    {['all', 'today', 'week', 'month', 'year'].map((range, index) => (
                      <label key={range} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="dateRange"
                          checked={filterConditions.dateRange === range}
                          onChange={() => setFilterConditions(prev => ({ ...prev, dateRange: range }))}
                          className="w-3 h-3 text-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {index === 0 ? '全部' : index === 1 ? '今天' : index === 2 ? '最近一周' : index === 3 ? '最近一月' : '最近一年'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 mb-2">大小</div>
                  <div className="space-y-1">
                    {['all', 'small', 'medium', 'large'].map((range, index) => (
                      <label key={range} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sizeRange"
                          checked={filterConditions.sizeRange === range}
                          onChange={() => setFilterConditions(prev => ({ ...prev, sizeRange: range }))}
                          className="w-3 h-3 text-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {index === 0 ? '全部' : index === 1 ? '小' : index === 2 ? '中' : '大'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="px-4 py-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowFilterDropdown(false)}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                  >
                    确定
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition">
            <MoreVertical className="w-4 h-4" />
          </button> */}
        </div>
      </div>
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50 h-[50px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{getFolderName()}</span>
          <span className="text-sm text-gray-500">共 {total} 封</span>
        </div>
        {selectedEmails.size > 0 && (
          <span className="text-sm text-blue-600">已选择 {selectedEmails.size} 封</span>
        )}
      </div>
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : !account ? (
          <div className="text-center py-12 text-gray-400">
            <p>请先选择一个邮箱账户</p>
          </div>
        ) : emails.length === 0 ? (   
          <div className="text-center py-12 text-gray-400">
            <p>暂无邮件</p>
           {
             folder === 'INBOX' && (
              <button
                onClick={handleSync}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
              >
                点击同步邮件
              </button>
             )
           }
          </div>
        ) : (
          <div className="overflow-y-auto h-[calc(100vh-150px)]" ref={listRef} onScroll={handleScroll}>
            {
              emails.map((email) => (
              <div
                key={`${account.id}-${email.id}`}
                className={`flex items-center cursor-pointer transition h-14 border-b border-gray-50 ${
                  selectedEmailId === email.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                } ${account.id}-${email.id}`}
                onClick={() => onSelectEmail(email)}
              >
                <div className="flex items-center justify-center w-6 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(email.id);
                    }}
                    className="text-gray-400 hover:text-blue-600 transition"
                  >
                    {selectedEmails.has(email.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center w-36 px-2">
                  {!email.is_read && email.folder !== 'SENT' && email.folder !== 'DRAFTS' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-2"></div>
                  )}
                  <span className={`text-sm font-medium truncate ${!email.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                    {(email.folder === 'SENT' || email.folder === 'DRAFTS') ? email.to_addr : (email.from_name || email.from_addr)}
                  </span>
                </div>

                <div className="flex-1 min-w-0 px-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm overflow-hidden whitespace-nowrap text-ellipsis truncate ${!email.is_read ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                      {email.subject || '(无主题)'}
                    </span>
                    {email.has_attachment && email.attachments && email.attachments.length > 0 ? (
                      <Download className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {email.label_ids && email.label_ids.length > 0 && email.label_ids.map(labelId => {
                      const label = labels.find(l => l.id === labelId);
                      return label ? (
                        <span 
                          key=  {label.id}
                          className="px-1.5 py-0.5 text-xs rounded-full text-white"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {email.body_text?.substring(0, 120) || email.body_html?.replace(/<[^>]*>/g, '').substring(0, 120)}...
                  </p>
                </div>

                <div className="flex items-center w-24 px-2 justify-end">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatEmailTime(email.date)}
                  </span>
                </div>

                <div className="w-8 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStar(email.id, email.is_starred);
                    }}
                    className="text-gray-300 hover:text-yellow-500 transition"
                  >
                    {email.is_starred ? <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" /> : <Star className="w-4 h-4" />}
                  </button>
                </div>
              </div>
             ))}
            {!loadingMore && !hasMore && emails.length > 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">
                已加载全部邮件
              </div>
            )}
          </div>
        )}
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
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
    </div>
  );
}