import express from 'express';
import { getDB, saveDB } from '../db.js';
import { authenticate } from '../utils/jwt.js';
import { getAccountWithAuth } from './emailAccounts.js';
import { connectionPoolManager } from '../manager/ConnectionPoolManager.js';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const attachmentsDir = path.join(__dirname, '../uploads/attachments');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const originalname = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf-8');
    cb(null, `${timestamp}_${randomStr}_${originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const router = express.Router();

const applyFilters = (emails, filters) => {
  let filtered = [...emails];
  
  if (filters.is_read !== undefined && filters.is_read !== 'all') {
    const isRead = filters.is_read === 'read';
    filtered = filtered.filter(e => e.is_read === (isRead ? 1 : 0));
  }
  
  if (filters.has_attachment === '1') {
    filtered = filtered.filter(e => e.has_attachment === 1);
  }
  
  if (filters.sender) {
    const senderLower = filters.sender.toLowerCase();
    filtered = filtered.filter(e => 
      (e.from_addr && e.from_addr.toLowerCase().includes(senderLower)) ||
      (e.from_name && e.from_name.toLowerCase().includes(senderLower))
    );
  }
  
  if (filters.recipient) {
    const recipientLower = filters.recipient.toLowerCase();
    filtered = filtered.filter(e => 
      (e.to_addr && e.to_addr.toLowerCase().includes(recipientLower)) ||
      (e.cc_addr && e.cc_addr.toLowerCase().includes(recipientLower)) ||
      (e.bcc_addr && e.bcc_addr.toLowerCase().includes(recipientLower))
    );
  }
  
  if (filters.date_range && filters.date_range !== 'all') {
    const now = new Date();
    let startDate;
    switch (filters.date_range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
    if (startDate) {
      filtered = filtered.filter(e => new Date(e.date) >= startDate);
    }
  }
  
  if (filters.size_range && filters.size_range !== 'all') {
    filtered = filtered.filter(e => {
      const size = e.size || 0;
      switch (filters.size_range) {
        case 'small':
          return size < 1024 * 1024;
        case 'medium':
          return size >= 1024 * 1024 && size < 10 * 1024 * 1024;
        case 'large':
          return size >= 10 * 1024 * 1024;
        default:
          return true;
      }
    });
  }
  
  return filtered;
};

router.get('/:accountId', authenticate, async (req, res) => {
  const { accountId } = req.params;
  const { folder = 'INBOX', page = 1, limit = 50, offset = 0, label_id, keyword, is_read, has_attachment, sender, recipient, date_range, size_range } = req.query;
  
  const data = getDB();
  
  const account = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  let accountEmails = data.emails.filter(e => e.account_id === parseInt(accountId));
  
  if (keyword) {
    const searchLower = keyword.toLowerCase();
    accountEmails = accountEmails.filter(e => 
      (e.subject && e.subject.toLowerCase().includes(searchLower)) ||
      (e.from_addr && e.from_addr.toLowerCase().includes(searchLower)) ||
      (e.from_name && e.from_name.toLowerCase().includes(searchLower)) ||
      (e.to_addr && e.to_addr.toLowerCase().includes(searchLower)) ||
      (e.body_text && e.body_text.toLowerCase().includes(searchLower)) ||
      (e.body_html && e.body_html.toLowerCase().includes(searchLower)) ||
      (e.cc_addr && e.cc_addr.toLowerCase().includes(searchLower)) ||
      (e.bcc_addr && e.bcc_addr.toLowerCase().includes(searchLower))
    );
  } else if (label_id) {
    accountEmails = accountEmails.filter(e => e.label_ids && e.label_ids.includes(parseInt(label_id)));
  } else if (folder === 'STARRED') {
    accountEmails = accountEmails.filter(e => e.is_starred === 1);
  } else {
    accountEmails = accountEmails.filter(e => e.folder === folder);
  }
  
  accountEmails = applyFilters(accountEmails, { is_read, has_attachment, sender, recipient, date_range, size_range });
  
  accountEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const actualOffset = parseInt(offset) || ((page - 1) * parseInt(limit));
  const actualLimit = parseInt(limit);
  const emails = accountEmails.slice(actualOffset, actualOffset + actualLimit);
  
  res.json({ emails, total: accountEmails.length });
});

router.get('/:accountId/search', authenticate, async (req, res) => {
  const { accountId } = req.params;
  const { keyword, page = 1, limit = 50, folder, label_id, is_read, has_attachment, sender, recipient, date_range, size_range } = req.query;
  
  const data = getDB();
  
  const account = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  if (!keyword) {
    return res.status(400).json({ error: '搜索关键词不能为空' });
  }
  
  const searchLower = keyword.toLowerCase();
  
  let accountEmails = data.emails.filter(e => e.account_id === parseInt(accountId));
  
  if (label_id) {
    accountEmails = accountEmails.filter(e => e.label_ids && e.label_ids.includes(parseInt(label_id)));
  } else if (folder === 'STARRED') {
    accountEmails = accountEmails.filter(e => e.is_starred === 1);
  } else if (folder) {
    accountEmails = accountEmails.filter(e => e.folder === folder);
  }
  
  accountEmails = accountEmails.filter(e => 
    (e.subject && e.subject.toLowerCase().includes(searchLower)) ||
    (e.from_addr && e.from_addr.toLowerCase().includes(searchLower)) ||
    (e.from_name && e.from_name.toLowerCase().includes(searchLower)) ||
    (e.to_addr && e.to_addr.toLowerCase().includes(searchLower)) ||
    (e.body_text && e.body_text.toLowerCase().includes(searchLower)) ||
    (e.body_html && e.body_html.toLowerCase().includes(searchLower)) ||
    (e.cc_addr && e.cc_addr.toLowerCase().includes(searchLower)) ||
    (e.bcc_addr && e.bcc_addr.toLowerCase().includes(searchLower))
  );
  
  accountEmails = applyFilters(accountEmails, { is_read, has_attachment, sender, recipient, date_range, size_range });
  
  accountEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const actualPage = parseInt(page);
  const actualLimit = parseInt(limit);
  const actualOffset = (actualPage - 1) * actualLimit;
  const emails = accountEmails.slice(actualOffset, actualOffset + actualLimit);
  
  res.json({ emails, total: accountEmails.length });
});

router.get('/:accountId/:id', authenticate, async (req, res) => {
  const { accountId, id } = req.params;
  
  const data = getDB();
  
  const account = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  const email = data.emails.find(e => e.id === parseInt(id) && e.account_id === parseInt(accountId));
  if (!email) {
    return res.status(404).json({ error: '邮件不存在或已被删除' });
  }
  
  email.is_read = 1;
  await saveDB();
  
  res.json(email);
});

router.post('/:accountId/sync', authenticate, async (req, res) => {
  const { accountId } = req.params;
  const { folder = 'INBOX', mode = 'incremental' } = req.body;
  
  const account = await getAccountWithAuth(accountId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  const data = getDB();
  
  const userAccount = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!userAccount) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  let imap = null;
  
  try {
    imap = new ImapFlow({
      host: account.imap_host,
      port: parseInt(account.imap_port),
      secure: parseInt(account.imap_port) === 993,
      auth: { user: account.email, pass: account.auth_code },
      logger: false,
      greetingTimeout: 30000,
      connectionTimeout: 30000,
      socketTimeout: 60000
    });
    
    await imap.connect();
    const lock = await imap.getMailboxLock(folder);
    
    try {
      console.log('[DEBUG] Total messages:', imap.mailbox.exists);
      
      const mailboxStatus = await imap.status(folder, {
        exists: true,
        uidValidity: true,
        uidNext: true
      });
      const currentUidValidity = Number(mailboxStatus.uidValidity);
      
      let lastUid = userAccount.last_uid || 0;
      let uidValidity = userAccount.uid_validity || 0;
      
      if (currentUidValidity !== uidValidity && uidValidity !== 0) {
        console.log(`[DEBUG] UID validity changed: ${uidValidity} -> ${currentUidValidity}, resetting lastUid`);
        lastUid = 0;
      }
      
      let fetchRange;
      let useUid = false;
      const MAX_SYNC_LIMIT = 200;
      if (mode === 'full' || lastUid === 0) {
        const numMessages = imap.mailbox.exists || 0;
        const startSeq = Math.max(1, numMessages - MAX_SYNC_LIMIT + 1);
        fetchRange = `${startSeq}:${numMessages}`;
        console.log('[DEBUG] Full sync mode, fetching last', MAX_SYNC_LIMIT, 'messages:', fetchRange);
      } else {
        fetchRange = `${lastUid + 1}:*`;
        useUid = true;
        console.log('[DEBUG] Incremental sync mode, fetching:', fetchRange);
      }
      
      let count = 0;
      let maxUid = lastUid;
      
      for await (const message of imap.fetch(fetchRange, { 
        source: true,
        uid: true,
        internalDate: true,
        envelope: true,
        flags: true
      }, useUid ? { uid: true } : undefined)) {
        const msgId = message.uid?.toString();
        const seq = message.seq;
        console.log(`[DEBUG] Processing message - seq: ${seq}, uid: ${msgId}`);
        
        const existingEmail = data.emails.find(
          e => e.account_id === parseInt(accountId) && e.message_id === msgId
        );
        
        if (existingEmail) {
          console.log('[DEBUG] Skip existing message:', msgId);
          maxUid = Math.max(maxUid, parseInt(msgId));
          continue;
        }
        
        let fromAddr = '';
        let fromName = '';
        let toAddr = '';
        let subject = '';
        let date = new Date().toISOString();
        let bodyText = '';
        let bodyHtml = '';
        let attachments = [];
        
        try {
          const sourceBuffer = typeof message.source === 'string' ? Buffer.from(message.source) : message.source;
          
          const parsed = await simpleParser(sourceBuffer);    
          fromAddr = parsed.from?.value[0]?.address || '';
          fromName = parsed.from?.value[0]?.name || '';
          toAddr = parsed.to?.value.map(t => t.address).join(', ') || '';
          subject = parsed.subject || '';
          date = message.internalDate ? message.internalDate.toISOString() : parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          bodyText = parsed.text || '';
          bodyHtml = parsed.html || '';
          
          if (parsed.attachments && parsed.attachments.length > 0) {
            for (const attachment of parsed.attachments) {
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 9);
              let filename = attachment.filename || `attachment_${timestamp}`;
              try {
                filename = iconv.decode(Buffer.from(filename, 'binary'), 'utf-8');
              } catch (e) {
                console.log('[DEBUG] Failed to decode filename, using original');
              }
              const fileName = `${msgId}_${timestamp}_${randomStr}_${filename}`;
              const filePath = path.join(attachmentsDir, fileName);
              
              try {
                fs.writeFileSync(filePath, attachment.content);
                attachments.push({
                  id: Date.now() + Math.random(),
                  filename: filename,
                  filepath: fileName,
                  size: attachment.size,
                  contentType: attachment.contentType
                });
              } catch (e) {
                console.error('[DEBUG] Error saving attachment:', e.message);
              }
            }
          }
        } catch (e) {
          console.error('[DEBUG] Error parsing email:', e.message);
        }
        
        const isSeen = message.flags?.has('\\Seen') ?? false;
        const isFlagged = message.flags?.has('\\Flagged') ?? false;
        
        console.log('[DEBUG] Seen:', isSeen, 'Flagged:', isFlagged);
        const email = {
          id: data.emails.length > 0 ? Math.max(...data.emails.map(e => e.id)) + 1 : 1,
          account_id: parseInt(accountId),
          folder,
          message_id: msgId || '',
          from_addr: fromAddr,
          from_name: fromName,
          to_addr: toAddr,
          subject: subject || '(无主题)',
          body_text: bodyText,
          body_html: bodyHtml,
          date,
          is_read: isSeen ? 1 : 0,
          is_starred: isFlagged ? 1 : 0,
          has_attachment: attachments.length > 0 ? 1 : 0,
          size: sourceBuffer.length,
          attachments
        };
        
        data.emails.push(email);
        count++;
        maxUid = Math.max(maxUid, parseInt(msgId));
        console.log('[DEBUG] Added email:', email.subject);
      }
      
      if (maxUid > userAccount.last_uid) {
        userAccount.last_uid = maxUid;
      }
      userAccount.uid_validity = currentUidValidity;
      
      await saveDB();
      
      const connection = connectionPoolManager.getConnection(req.userId, userAccount.email);
      if (connection) {
        connection.lastUid = maxUid;
        connection.uidValidity = currentUidValidity;
        console.log(`[DEBUG] Updated connection lastUid to: ${maxUid}`);
        connection.startSync();
      }
      
      console.log('[DEBUG] Sync completed, saved:', count, 'lastUid:', maxUid);
      res.json({ success: true, synced: count });
    } finally {
      lock.release();
    }
    
    await imap.logout();
  } catch (error) {
    if (imap) {
      try {
        await imap.logout();
      } catch (e) {
        console.warn('Error during logout:', e.message);
      }
    }
    console.error('[DEBUG] Sync error:', error);
    return res.status(500).json({ error: 'Sync failed: ' + error.message });
  }
});

router.post('/:accountId/send', authenticate, upload.array('attachments', 20), async (req, res) => {
  const { accountId } = req.params;
  const { to, cc, bcc, subject, text, html } = req.body;
  const files = req.files || [];
  
  if (!to) {
    return res.status(400).json({ error: '收件人不能为空' });
  }
  
  const account = await getAccountWithAuth(accountId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  const data = getDB();
  
  const userAccount = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!userAccount) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: parseInt(account.smtp_port),
      secure: parseInt(account.smtp_port) === 465,
      auth: { user: account.email, pass: account.auth_code }
    });

    const mailOptions = {
      from: account.email,
      to,
      cc: cc || '',
      bcc: bcc || '',
      subject: subject || '',
      text: text || '',
      html: html || ''
    };

    const savedAttachments = [];
    const attachments = [];
    if (files.length > 0) {
      for (const file of files) {
        const originalname = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf-8');
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const fileName = `${timestamp}_${randomStr}_${originalname}`;
        const newPath = path.join(attachmentsDir, fileName);
        
        fs.renameSync(file.path, newPath);
        
        attachments.push({
          filename: originalname,
          path: newPath,
          contentType: file.mimetype,
          encoding: 'base64'
        });
        
        savedAttachments.push({
          id: Date.now() + Math.random(),
          filename: originalname,
          filepath: fileName,
          size: file.size,
          contentType: file.mimetype
        });
      }
    }
    
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }
    
    await transporter.sendMail(mailOptions);
    
    const attachmentsSize = savedAttachments.reduce((sum, att) => sum + (att.size || 0), 0);
    const contentSize = (text || '').length + (html || '').length;
    const sentEmail = {
      id: data.emails.length > 0 ? Math.max(...data.emails.map(e => e.id)) + 1 : 1,
      account_id: parseInt(accountId),
      folder: 'SENT',
      message_id: Date.now().toString(),
      from_addr: account.email,
      from_name: '',
      to_addr: to,
      cc_addr: cc || '',
      bcc_addr: bcc || '',
      subject: subject || '(无主题)',
      body_text: text || '',
      body_html: html || '',
      date: new Date().toISOString(),
      is_read: 1,
      is_starred: 0,
      has_attachment: savedAttachments.length > 0 ? 1 : 0,
      size: contentSize + attachmentsSize,
      attachments: savedAttachments
    };
    
    data.emails.push(sentEmail);
    await saveDB();
    
    res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: '发送邮件失败: ' + error.message });
  }
});

router.post('/:accountId/draft', authenticate, async (req, res) => {
  const { accountId } = req.params;
  const { to, cc, bcc, subject, text, html, draftId } = req.body;
  
  const data = getDB();
  
  const userAccount = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!userAccount) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  try {
    if (draftId) {
      const existingDraft = data.emails.find(e => e.id === parseInt(draftId) && e.account_id === parseInt(accountId) && e.folder === 'DRAFTS');
      if (existingDraft) {
        existingDraft.to_addr = to || '';
        existingDraft.cc_addr = cc || '';
        existingDraft.bcc_addr = bcc || '';
        existingDraft.subject = subject || '(无主题)';
        existingDraft.body_text = text || '';
        existingDraft.body_html = html || '';
        existingDraft.date = new Date().toISOString();
        await saveDB();
        return res.json({ success: true, draftId: existingDraft.id });
      }
    }
    
    const contentSize = (text || '').length + (html || '').length;
    const draft = {
      id: data.emails.length > 0 ? Math.max(...data.emails.map(e => e.id)) + 1 : 1,
      account_id: parseInt(accountId),
      folder: 'DRAFTS',
      message_id: Date.now().toString(),
      from_addr: userAccount.email,
      from_name: '',
      to_addr: to || '',
      cc_addr: cc || '',
      bcc_addr: bcc || '',
      subject: subject || '(无主题)',
      body_text: text || '',
      body_html: html || '',
      date: new Date().toISOString(),
      is_read: 1,
      is_starred: 0,
      has_attachment: 0,
      size: contentSize,
      attachments: []
    };
    
    data.emails.push(draft);
    await saveDB();
    
    res.json({ success: true, draftId: draft.id });
  } catch (error) {
    return res.status(500).json({ error: '保存草稿失败: ' + error.message });
  }
});

router.patch('/:accountId/:id', authenticate, async (req, res) => {
  const { accountId, id } = req.params;
  const { is_read, is_starred, folder, to, cc, bcc, subject, text, html, add_label_id, remove_label_id } = req.body;
  
  const data = getDB();
  
  const account = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  const email = data.emails.find(e => e.id === parseInt(id) && e.account_id === parseInt(accountId));
  if (!email) {
    return res.status(404).json({ error: '邮件不存在或已被删除' });
  }
  
  if (is_read !== undefined) {
    email.is_read = is_read ? 1 : 0;
  }
  if (is_starred !== undefined) {
    email.is_starred = is_starred ? 1 : 0;
  }
  if (folder !== undefined) {
    email.folder = folder;
  }
  if (to !== undefined) {
    email.to_addr = to;
  }
  if (cc !== undefined) {
    email.cc_addr = cc;
  }
  if (bcc !== undefined) {
    email.bcc_addr = bcc;
  }
  if (subject !== undefined) {
    email.subject = subject;
  }
  if (text !== undefined) {
    email.body_text = text;
  }
  if (html !== undefined) {
    email.body_html = html;
  }
  
  if (add_label_id !== undefined) {
    if (!email.label_ids) {
      email.label_ids = [];
    }
    if (!email.label_ids.includes(add_label_id)) {
      email.label_ids.push(add_label_id);
    }
  }
  
  if (remove_label_id !== undefined) {
    if (email.label_ids && Array.isArray(email.label_ids)) {
      email.label_ids = email.label_ids.filter(lid => lid !== remove_label_id);
    }
  }
  
  await saveDB();
  
  res.json({ success: true });
});

router.delete('/:accountId/:id', authenticate, async (req, res) => {
  const { accountId, id } = req.params;
  
  const data = getDB();
  
  const account = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  const email = data.emails.find(e => e.id === parseInt(id) && e.account_id === parseInt(accountId));
  if (!email) {
    return res.status(404).json({ error: '邮件不存在或已被删除' });
  }
  
  if (email.attachments && email.attachments.length > 0) {
    for (const attachment of email.attachments) {
      const filePath = path.join(attachmentsDir, attachment.filepath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
  
  data.emails = data.emails.filter(e => e.id !== parseInt(id));
  await saveDB();
  
  res.json({ success: true });
});

router.get('/:accountId/:id/attachments/:attachmentId/download', authenticate, async (req, res) => {
  const { accountId, id, attachmentId } = req.params;
  
  const data = getDB();
  
  const account = data.email_accounts.find(a => a.id === parseInt(accountId) && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  const email = data.emails.find(e => e.id === parseInt(id) && e.account_id === parseInt(accountId));
  if (!email) {
    return res.status(404).json({ error: '邮件不存在或已被删除' });
  }
  
  const attachment = email.attachments?.find(a => a.id == attachmentId);
  if (!attachment) {
    return res.status(404).json({ error: '附件不存在或已被删除' });
  }
  
  const filePath = path.join(attachmentsDir, attachment.filepath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '附件文件不存在' });
  }
  
  const fileStream = fs.createReadStream(filePath);
  res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
  res.setHeader('Content-Length', attachment.size || fs.statSync(filePath).size);
  
  fileStream.pipe(res);
});

export default router;