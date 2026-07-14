import { useState, useRef, useEffect } from 'react';
import { X, Send, Paperclip, AtSign,MoreVertical , Maximize2, Minimize2, Bold, Italic, Underline, List, ListOrdered, Link, AlignLeft, AlignCenter, AlignRight, Image, Quote, Undo, Redo, Strikethrough, Minus, Table, Table2, Trash2, FileText, FileImage, File } from 'lucide-react';
import { post } from '../utils/request';
import { useToast } from '../context/ToastContext';

export default function ComposeEmail({ account, accounts, onClose, onAccountChange, draft, replyMode, replyEmail, isFullscreen, onToggleFullscreen }) {
  const { showToast } = useToast();
  const editorRef = useRef(null);
  const [formData, setFormData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    text: '',
    html: ''
  });
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const handleAccountSelect = (acc) => {
    if (acc.id !== account?.id) {
      onAccountChange(acc);
      setShowAccountDropdown(false);
    }
  };

  useEffect(() => {
    if (draft) {
      setFormData({
        to: draft.to_addr || '',
        cc: draft.cc_addr || '',
        bcc: draft.bcc_addr || '',
        subject: draft.subject || '',
        text: draft.body_text || '',
        html: draft.body_html || ''
      });
      setCurrentDraftId(draft.id);
      if (editorRef.current) {
        editorRef.current.innerHTML = draft.body_html || '';
      }
    } else if (replyMode && replyEmail) {
      let to = '';
      let cc = '';
      let subject = '';
      let bodyText = '';
      let bodyHtml = '';

      const originalDate = replyEmail.date ? new Date(replyEmail.date) : new Date();
      const dateStr = originalDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const quotedText = `\n\n--- 原始邮件 ---\n发件人: ${replyEmail.from_name || replyEmail.from_addr}\n收件人: ${replyEmail.to_addr}\n日期: ${dateStr}\n主题: ${replyEmail.subject || '(无主题)'}\n\n${replyEmail.body_text || replyEmail.body_html?.replace(/<[^>]*>/g, '') || ''}`;

      const quotedHtml = `<br><br><hr><div style="color:#666;font-size:12px;"><strong>原始邮件</strong></div><div style="color:#888;font-size:12px;margin-top:4px;">发件人: ${replyEmail.from_name || replyEmail.from_addr}<br>收件人: ${replyEmail.to_addr}<br>日期: ${dateStr}<br>主题: ${replyEmail.subject || '(无主题)'}</div><blockquote style="border-left:2px solid #ccc;margin:8px 0;padding-left:12px;color:#666;">${replyEmail.body_html || replyEmail.body_text || ''}</blockquote>`;

      if (replyMode === 'reply') {
        to = replyEmail.from_addr || '';
        subject = replyEmail.subject?.startsWith('Re:') ? replyEmail.subject : `Re: ${replyEmail.subject || '(无主题)'}`;
        bodyText = quotedText;
        bodyHtml = quotedHtml;
      } else if (replyMode === 'replyAll') {
        const allRecipients = [replyEmail.from_addr, replyEmail.to_addr, replyEmail.cc_addr]
          .filter(Boolean)
          .join(', ')
          .split(',')
          .map(s => s.trim())
          .filter(s => s);
        to = allRecipients.join(', ');
        subject = replyEmail.subject?.startsWith('Re:') ? replyEmail.subject : `Re: ${replyEmail.subject || '(无主题)'}`;
        bodyText = quotedText;
        bodyHtml = quotedHtml;
      } else if (replyMode === 'forward') {
        subject = replyEmail.subject?.startsWith('Fwd:') ? replyEmail.subject : `Fwd: ${replyEmail.subject || '(无主题)'}`;
        bodyText = quotedText;
        bodyHtml = quotedHtml;
      }

      setFormData({
        to,
        cc,
        bcc: '',
        subject,
        text: bodyText,
        html: bodyHtml
      });
      if (editorRef.current) {
        editorRef.current.innerHTML = bodyHtml;
      }
    }
  }, [draft, replyMode, replyEmail]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tablePickerPos, setTablePickerPos] = useState({ x: 0, y: 0 });
  const [tableSelection, setTableSelection] = useState({ rows: 0, cols: 0 });
  const [attachments, setAttachments] = useState([]);
  const savedSelection = useRef(null);
  const [formatStates, setFormatStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    blockquote: false
  });

  useEffect(() => {
    if (editorRef.current && formData.html) {
      editorRef.current.innerHTML = formData.html;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const dropdown = document.querySelector('.account-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const updateFormatStates = () => {
      if (editorRef.current && document.activeElement === editorRef.current) {
        setFormatStates({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikeThrough: document.queryCommandState('strikeThrough'),
          insertUnorderedList: document.queryCommandState('insertUnorderedList'),
          insertOrderedList: document.queryCommandState('insertOrderedList'),
          justifyLeft: document.queryCommandState('justifyLeft'),
          justifyCenter: document.queryCommandState('justifyCenter'),
          justifyRight: document.queryCommandState('justifyRight'),
          blockquote: document.queryCommandState('formatBlock') === 'blockquote'
        });
      }
    };

    editorRef.current?.addEventListener('selectionchange', updateFormatStates);
    editorRef.current?.addEventListener('mouseup', updateFormatStates);
    editorRef.current?.addEventListener('keyup', updateFormatStates);

    return () => {
      editorRef.current?.removeEventListener('selectionchange', updateFormatStates);
      editorRef.current?.removeEventListener('mouseup', updateFormatStates);
      editorRef.current?.removeEventListener('keyup', updateFormatStates);
    };
  }, []);

  const handleFormat = (command, value = null) => {
    if (!editorRef.current) return;
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
    if (command === 'insertUnorderedList') {
      insertList('ul');
      return;
    }
    if (command === 'insertOrderedList') {
      insertList('ol');
      return;
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    setFormatStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      blockquote: document.queryCommandState('formatBlock') === 'blockquote'
    });
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setFormData(prev => ({
        ...prev,
        text: editorRef.current.innerText,
        html: editorRef.current.innerHTML
      }));
    }
  };

  const insertImage = () => {
    if (!editorRef.current) return;
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
    const url = prompt('请输入图片URL');
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.alt = '';
      insertNode(img);
    }
  };

  const insertTable = () => {
    if (!editorRef.current) return;
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }
    const tableBtn = document.querySelector('[title="插入表格"]');
    if (tableBtn) {
      const rect = tableBtn.getBoundingClientRect();
      setTablePickerPos({ x: rect.left, y: rect.bottom + 8 });
    }
    setShowTablePicker(true);
  };

  const handleTableSelect = (rows, cols) => {
    setShowTablePicker(false);
    if (rows > 0 && cols > 0) {
      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      for (let i = 0; i < rows; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < cols; j++) {
          const td = document.createElement('td');
          td.style.border = '1px solid #ddd';
          td.style.padding = '4px';
          td.style.minWidth = '50px';
          td.innerHTML = '&nbsp;';
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }
      insertNode(table);
    }
  };

  const insertNode = (node) => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    let range;
    
    if (savedSelection.current) {
      range = savedSelection.current;
      savedSelection.current = null;
    } else if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    }

    if (range) {
      try {
        range.deleteContents();
        range.insertNode(node);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        editorRef.current.appendChild(node);
      }
    } else {
      editorRef.current.appendChild(node);
    }
    editorRef.current.focus();
    handleEditorInput();
  };

  const insertList = (type) => {
    if (!editorRef.current) return;
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const li = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement.closest('li') 
        : container.closest('li');

      if (li && li.parentElement && li.parentElement.tagName === type.toUpperCase()) {
        const text = li.textContent;
        const parent = li.parentElement;
        const prev = li.previousSibling;
        const next = li.nextSibling;

        if (prev && prev.nodeName === '#text') {
          prev.textContent += ' ' + text;
          li.remove();
          range.selectNodeContents(prev);
        } else if (next && next.nodeName === '#text') {
          next.textContent = text + ' ' + next.textContent;
          li.remove();
          range.selectNodeContents(next);
        } else {
          const textNode = document.createTextNode(text);
          li.replaceWith(textNode);
          range.selectNodeContents(textNode);
        }

        if (parent.children.length === 0) {
          parent.remove();
        }

        selection.removeAllRanges();
        selection.addRange(range);
        editorRef.current.focus();
        handleEditorInput();
        return;
      }
    }

    const list = document.createElement(type);
    list.style.margin = '4px 0';
    list.style.paddingLeft = '24px';

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText) {
        const lines = selectedText.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const item = document.createElement('li');
          item.textContent = line.trim();
          list.appendChild(item);
        });
      } else {
        const li = document.createElement('li');
        li.innerHTML = '&nbsp;';
        list.appendChild(li);
      }
      range.deleteContents();
      range.insertNode(list);
      range.collapse(list, true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const li = document.createElement('li');
      li.innerHTML = '&nbsp;';
      list.appendChild(li);
      editorRef.current.appendChild(list);
    }
    editorRef.current.focus();
    handleEditorInput();
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newAttachments = files.map(file => ({
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
      showToast(`已添加 ${files.length} 个附件`, 'success');
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type) => {
    if (type.includes('image')) return FileImage;
    if (type.includes('text') || type.includes('pdf') || type.includes('word') || type.includes('excel') || type.includes('powerpoint')) return FileText;
    return File;
  };

  const handleSaveDraft = async () => {
    if (!account) {
      showToast('请先选择邮箱账户', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const response = await post(`/emails/${account.id}/draft`, {
        ...formData,
        draftId: currentDraftId
      });
      setCurrentDraftId(response.draftId);
      showToast('草稿保存成功', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!account) {
        throw new Error('请先选择邮箱账户');
      }
      if (!formData.to) {
        throw new Error('请输入收件人邮箱');
      }

      const token = localStorage.getItem('token');
      const formDataObj = new FormData();
      formDataObj.append('to', formData.to);
      formDataObj.append('cc', formData.cc || '');
      formDataObj.append('bcc', formData.bcc || '');
      formDataObj.append('subject', formData.subject || '');
      formDataObj.append('text', formData.text || '');
      formDataObj.append('html', formData.html || '');

      attachments.forEach(attachment => {
        formDataObj.append('attachments', attachment.file);
      });

      const response = await fetch(`/api/emails/${account.id}/send`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formDataObj
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '发送邮件失败');
      }

      showToast('邮件发送成功', 'success');
      setFormData({ to: '', cc: '', bcc: '', subject: '', text: '', html: '' });
      setAttachments([]);
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      onClose();
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex-1 h-full bg-white flex flex-col ${isFullscreen ? '' : 'shadow-xl'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 h-[50px]">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !account}
            className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
            {loading ? '发送中...' : '发送'}
          </button>
          <button 
            type="button" 
            onClick={handleSaveDraft}
            disabled={loading || !account}
            className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-200 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            存草稿
          </button>
          {/* <button type="button" className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-200 rounded transition">
            定时发送
          </button>
          <button type="button" className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-200 rounded transition">
            更多选项
          </button> */}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFullscreen}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition"
            title={isFullscreen ? '缩小' : '放大'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">收件人</span>
            <input
              type="email"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              className="flex-1 px-2 py-1.5 border-none outline-none text-sm text-gray-900"
              placeholder="输入收件人邮箱，多个请用逗号分隔"
              required
            />
            <button type="button" className="p-1 text-gray-400 hover:text-blue-500 transition" title="添加抄送">
              <AtSign className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">抄 送</span>
            <input
              type="email"
              value={formData.cc}
              onChange={(e) => setFormData({ ...formData, cc: e.target.value })}
              className="flex-1 px-2 py-1.5 border-none outline-none text-sm text-gray-900"
              placeholder="输入抄送邮箱"
            />
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">密 送</span>
            <input
              type="email"
              value={formData.bcc}
              onChange={(e) => setFormData({ ...formData, bcc: e.target.value })}
              className="flex-1 px-2 py-1.5 border-none outline-none text-sm text-gray-900"
              placeholder="输入密送邮箱"
            />
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">主 题</span>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="flex-1 px-2 py-1.5 border-none outline-none text-sm text-gray-900"
              placeholder="请输入邮件主题"
              required
            />
          </div>
        </div>

        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1 bg-gray-50 flex-wrap">
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="撤销" onClick={() => handleFormat('undo')}>
            <Undo className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="重做" onClick={() => handleFormat('redo')}>
            <Redo className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.bold ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="加粗" onClick={() => handleFormat('bold')}>
            <Bold className="w-4 h-4" />
          </button>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.italic ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="斜体" onClick={() => handleFormat('italic')}>
            <Italic className="w-4 h-4" />
          </button>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.underline ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="下划线" onClick={() => handleFormat('underline')}>
            <Underline className="w-4 h-4" />
          </button>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.strikeThrough ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="删除线" onClick={() => handleFormat('strikeThrough')}>
            <Strikethrough className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.insertUnorderedList ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="无序列表" onClick={() => handleFormat('insertUnorderedList')}>
            <List className="w-4 h-4" />
          </button>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.insertOrderedList ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="有序列表" onClick={() => handleFormat('insertOrderedList')}>
            <ListOrdered className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.justifyLeft ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="左对齐" onClick={() => handleFormat('justifyLeft')}>
            <AlignLeft className="w-4 h-4" />
          </button>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.justifyCenter ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="居中对齐" onClick={() => handleFormat('justifyCenter')}>
            <AlignCenter className="w-4 h-4" />
          </button>
          <button type="button" className={`p-1.5 rounded transition ${formatStates.justifyRight ? 'text-blue-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`} title="右对齐" onClick={() => handleFormat('justifyRight')}>
            <AlignRight className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="插入链接" onClick={() => handleFormat('createLink', prompt('请输入链接地址'))}>
            <Link className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="插入图片" onClick={insertImage}>
            <Image className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="插入表格" onClick={insertTable}>
            <Table className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="插入分割线" onClick={() => handleFormat('insertHorizontalRule')}>
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="引用" onClick={() => handleFormat('formatBlock', 'blockquote')}>
            <Quote className="w-4 h-4" />
          </button>
          <div className="flex-1"></div>
          <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition" title="更多选项">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 px-4 py-3 overflow-y-auto">
          <div
            ref={editorRef}
            contentEditable={true}
            onInput={handleEditorInput}
            className="w-full px-2 py-2 border-none outline-none text-sm text-gray-800 h-[550px] focus:outline-none ovflow-auto"
            placeholder="输入正文"
          />
        </div>

        <div className="border-t border-gray-100 bg-gray-50">
          {attachments.length > 0 && (
            <div className="px-4 py-2 space-y-1">
              {attachments.map(attachment => {
                const FileIcon = getFileIcon(attachment.type);
                return (
                  <div key={attachment.id} className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition">
                    <div className="flex items-center gap-2">
                      <FileIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-gray-700 truncate max-w-[200px]">{attachment.name}</span>
                      <span className="text-xs text-gray-400">{formatFileSize(attachment.size)}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 py-2 flex items-center gap-2">
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id="attachment-upload"
              multiple
            />
            <button type="button" onClick={() => document.getElementById('attachment-upload').click()} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition">
              <Paperclip className="w-4 h-4" />
              添加附件
            </button>
            <span className="text-xs text-gray-400">支持拖拽上传</span>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}
      </form>

      {showTablePicker && (
        <div className="fixed inset-0 z-50" onClick={() => setShowTablePicker(false)}>
          <div 
            className="absolute bg-white border border-gray-200 shadow-lg rounded-lg p-2"
            style={{ left: tablePickerPos.x, top: tablePickerPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="grid grid-cols-8 gap-px bg-gray-200 p-1 rounded"
              onMouseLeave={() => setTableSelection({ rows: 0, cols: 0 })}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                [1, 2, 3, 4, 5, 6, 7, 8].map((col) => (
                  <div
                    key={`${row}-${col}`}
                    className={`w-5 h-5 flex items-center justify-center cursor-pointer transition ${
                      row <= tableSelection.rows && col <= tableSelection.cols
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    onMouseEnter={() => setTableSelection({ rows: row, cols: col })}
                    onClick={() => handleTableSelect(row, col)}
                  />
                ))
              ))}
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              {tableSelection.rows > 0 && tableSelection.cols > 0
                ? `${tableSelection.rows} × ${tableSelection.cols}`
                : '选择表格大小'}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-500">发件人: {account?.email || '未选择账户'}</span>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              setShowAccountDropdown(!showAccountDropdown);
            }}
            className="text-xs text-blue-600 hover:text-blue-700 transition flex items-center gap-1"
          >
            更换发件人
          </button>
          {showAccountDropdown && (
            <div className="account-dropdown absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[100] min-w-[180px]">
              {accounts && accounts.length > 0 ? (
                accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAccountSelect(acc);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm ${
                      acc.id === account?.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                      {acc.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left text-overflow-ellipsis whitespace-nowrap overflow-hidden truncate">
                      <span className="truncate">{acc.email}</span>
                    </div>
                    {acc.id === account?.id && (
                      <span className="text-xs text-blue-600">当前</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-400">暂无其他账户</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
