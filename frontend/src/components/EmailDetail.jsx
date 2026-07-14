import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Calendar, Send, Trash2, Star, Reply, ReplyAll, Forward, MoreVertical, Download, Paperclip, Tag, ChevronDown, X } from 'lucide-react';
import { patch, download, get } from '../utils/request';
import { formatEmailTimeFull } from '../utils/formatTime';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

export default function EmailDetail({ email, account, onBack, onDelete, onStar, onReply, onReplyAll, onForward, viewMode }) {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [labels, setLabels] = useState([]);
  const [showLabelsDropdown, setShowLabelsDropdown] = useState(false);
  const [detailEmail, setDetailEmail] = useState(null);
  const [starLoading, setStarLoading] = useState(false);

  useEffect(() => {
    fetchLabels();
  }, [account]);

  useEffect(() => {
    if (email && account) {
      fetchEmailDetail();
    }
  }, [email, account]);

  const fetchEmailDetail = async () => {
    try {
      const result = await get(`/emails/${account.id}/${email.id}`);
      setDetailEmail(result);
    } catch (err) {
      console.error('Failed to fetch email detail:', err);
      setDetailEmail(email);
    }
  };

  const fetchLabels = async () => {
    if (!account) return;
    try {
      const result = await get(`/labels?account_id=${account.id}`);
      setLabels(result);
    } catch (err) {
      console.error('Failed to fetch labels:', err);
    }
  };
  if (!detailEmail) {
    return (
      <div className="flex-1 bg-white h-full flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center">
          {viewMode !== 'split' && (
            <button
              onClick={onBack}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <span className={`ml-2 text-sm text-gray-600 ${viewMode === 'split' ? 'ml-0' : ''}`}>邮件详情</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>请选择一封邮件查看详情</p>
          </div>
        </div>
      </div>
    );
  }

  const handleStar = async () => {
    if (!account || starLoading) return;
    setStarLoading(true);
    try {
      await patch(`/emails/${account.id}/${detailEmail.id}`, { is_starred: !detailEmail.is_starred });
      onStar && onStar(detailEmail.id, !detailEmail.is_starred);
    } catch (err) {
      showToast('星标操作失败', 'error');
    } finally {
      setStarLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return;
    setShowModal(true);
  };

  const confirmDelete = async () => {
    try {
      await patch(`/emails/${account.id}/${detailEmail.id}`, { folder: 'TRASH' });
      onDelete(detailEmail.id);
      showToast('已移到垃圾箱', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setShowModal(false);
  };

  const handleAddLabel = async (labelId) => {
    try {
      await patch(`/emails/${account.id}/${detailEmail.id}`, { add_label_id: labelId });
      showToast('标签添加成功', 'success');
      setShowLabelsDropdown(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveLabel = async (labelId) => {
    try {
      await patch(`/emails/${account.id}/${detailEmail.id}`, { remove_label_id: labelId });
      showToast('标签已移除', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between h-[50px]">
        <div className="flex items-center gap-2">
          {viewMode !== 'split' && (
            <>
              <button
                onClick={onBack}
                className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">返回</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleStar}
            className={`p-2 rounded transition ${detailEmail.is_starred ? 'text-yellow-500 bg-yellow-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            title={detailEmail.is_starred ? '取消星标' : '星标'}
          >
            <Star className={`w-4 h-4 ${detailEmail.is_starred ? 'fill-yellow-500' : ''}`} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowLabelsDropdown(!showLabelsDropdown)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="标签"
            >
              <Tag className="w-4 h-4" />
            </button>
            {showLabelsDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                {labels.map((label) => {
                  const hasLabel = detailEmail.label_ids && detailEmail.label_ids.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => hasLabel ? handleRemoveLabel(label.id) : handleAddLabel(label.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm text-gray-700 flex-1">{label.name}</span>
                      {hasLabel && <X className="w-3 h-3 text-gray-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition">
            <MoreVertical className="w-4 h-4" />
          </button> */}
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100vh-100px)]">
          <div className="flex-1">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 bg-none ">{detailEmail.subject || '(无主题)'}</h2>
            
            {detailEmail.label_ids && detailEmail.label_ids.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                {detailEmail.label_ids.map(labelId => {
                  const label = labels.find(l => l.id === labelId);
                  return label ? (
                    <span 
                      key={label.id}
                      className="px-2 py-1 text-xs rounded-full text-white"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            
            <div className="flex items-center gap-4 flex-wrap">
              {detailEmail.folder === 'SENT' ? (
                <>
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">发件人:</span>
                    <span className="text-sm text-gray-900 font-medium">{detailEmail.from_name || detailEmail.from_addr}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">收件人:</span>
                    <span className="text-sm text-gray-700">{detailEmail.to_addr}</span>
                  </div>
                  {detailEmail.cc_addr && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">抄送:</span>
                      <span className="text-sm text-gray-700">{detailEmail.cc_addr}</span>
                    </div>
                  )}
                  {detailEmail.bcc_addr && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">密送:</span>
                      <span className="text-sm text-gray-700">{detailEmail.bcc_addr}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">发件人:</span>
                    <span className="text-sm text-gray-900 font-medium">{detailEmail.from_name || detailEmail.from_addr}</span>
                    <span className="text-sm text-gray-500">{detailEmail.from_addr}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">收件人:</span>
                    <span className="text-sm text-gray-700">{detailEmail.to_addr}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{formatEmailTimeFull(detailEmail.date)}</span>
              </div>
            </div>

            {detailEmail.has_attachment && detailEmail.attachments && detailEmail.attachments.length > 0 ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Paperclip className="w-4 h-4" />
                  <span className="text-sm">本邮件包含 {detailEmail.attachments.length} 个附件</span>
                </div>
                <div className="space-y-1">
                  {detailEmail.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => download(`/emails/${account.id}/${detailEmail.id}/attachments/${attachment.id}/download`, attachment.filename)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded transition"
                    >
                      <Paperclip className="w-4 h-4 text-gray-400" />
                      <span className="flex-1 truncate">{attachment.filename}</span>
                      <span className="text-xs text-gray-400">
                        {attachment.size ? (attachment.size < 1024 ? `${attachment.size} B` : attachment.size < 1024 * 1024 ? `${(attachment.size / 1024).toFixed(1)} KB` : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`) : ''}
                      </span>
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-6 py-6">
            {detailEmail.body_html ? (
              <div 
                className="text-sm text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: detailEmail.body_html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">{detailEmail.body_text}</pre>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>邮件ID: {detailEmail.message_id}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button 
            onClick={() => onReply && onReply(detailEmail)}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition"
          >
            <Reply className="w-4 h-4" />
            <span className="text-sm">回复</span>
          </button>
          <button 
            onClick={() => onReplyAll && onReplyAll(detailEmail)}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition"
          >
            <ReplyAll className="w-4 h-4" />
            <span className="text-sm">回复全部</span>
          </button>
          <button 
            onClick={() => onForward && onForward(detailEmail)}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition"
          >
            <Forward className="w-4 h-4" />
            <span className="text-sm">转发</span>
          </button>
        </div>
      </div>
      
      <Modal
        title="移到垃圾箱"
        content="确定要将这封邮件移到垃圾箱吗？"
        show={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={confirmDelete}
        type="confirm"
      />
    </div>
  );
}
