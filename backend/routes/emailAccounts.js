import express from 'express';
import { getDB, saveDB } from '../db.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { authenticate } from '../utils/jwt.js';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { connectionPoolManager } from '../manager/ConnectionPoolManager.js';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const data = getDB();
  const accounts = data.email_accounts
    .filter(a => a.user_id === req.userId)
    .map(({ id, email, smtp_host, smtp_port, imap_host, imap_port, created_at, last_uid, sync_status }) => ({
      id, email, smtp_host, smtp_port, imap_host, imap_port, created_at, last_uid, sync_status
    }));
  res.json(accounts);
});

router.post('/', authenticate, async (req, res) => {
  const { email, smtp_host, smtp_port, imap_host, imap_port, auth_code } = req.body;
  if (!email || !smtp_host || !smtp_port || !imap_host || !imap_port || !auth_code) {
    return res.status(400).json({ error: '所有字段都不能为空' });
  }
  
  const smtpPortNum = parseInt(smtp_port);
  const imapPortNum = parseInt(imap_port);
  
  const { iv, encryptedData } = encrypt(auth_code);
  
  const data = getDB();
  
  const existing = data.email_accounts.find(a => a.user_id === req.userId && a.email === email);
  if (existing) {
    return res.status(400).json({ error: '邮箱账号已存在' });
  }
  
  try {
    const imap = new ImapFlow({
      host: imap_host,
      port: imapPortNum,
      secure: imapPortNum === 993,
      auth: { user: email, pass: auth_code }
    });
    
    await imap.connect();
    await imap.logout();
    
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: smtpPortNum,
      secure: smtpPortNum === 465,
      auth: { user: email, pass: auth_code }
    });
    
    await transporter.verify();
    
    const account = {
      id: data.email_accounts.length > 0 ? Math.max(...data.email_accounts.map(a => a.id)) + 1 : 1,
      user_id: req.userId,
      email,
      smtp_host,
      smtp_port: parseInt(smtp_port),
      imap_host,
      imap_port: parseInt(imap_port),
      auth_code_encrypted: encryptedData,
      iv,
      created_at: new Date().toISOString(),
      last_uid: 0,
      uid_validity: 0,
      sync_status: 'running'
    };
    
    data.email_accounts.push(account);
    await saveDB();
    
    try {
      await connectionPoolManager.addConnection(req.userId, {
        ...account,
        auth_code: auth_code
      });
    } catch (err) {
      console.error(`[EmailAccounts] Failed to start IDLE for ${email}:`, err.message);
      account.sync_status = 'error';
      await saveDB();
    }
    
    res.status(201).json({ 
      id: account.id, 
      email: account.email, 
      smtp_host: account.smtp_host, 
      smtp_port: account.smtp_port, 
      imap_host: account.imap_host, 
      imap_port: account.imap_port, 
      created_at: account.created_at,
      sync_status: account.sync_status
    });
    
  } catch (error) {
    return res.status(400).json({ error: '连接邮箱服务器失败: ' + error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const data = getDB();
  const accountId = parseInt(req.params.id);
  
  const account = data.email_accounts.find(a => a.id === accountId && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  try {
    await connectionPoolManager.removeConnection(req.userId, account.email);
  } catch (err) {
    console.error(`[EmailAccounts] Failed to stop IDLE for ${account.email}:`, err.message);
  }
  
  data.emails = data.emails.filter(e => e.account_id !== accountId);
  data.email_accounts = data.email_accounts.filter(a => a.id !== accountId);
  await saveDB();
  
  res.json({ success: true });
});

router.post('/:id/restart', authenticate, async (req, res) => {
  const data = getDB();
  const accountId = parseInt(req.params.id);
  
  const account = data.email_accounts.find(a => a.id === accountId && a.user_id === req.userId);
  if (!account) {
    return res.status(404).json({ error: '邮箱账号不存在' });
  }
  
  try {
    const accountWithAuth = await getAccountWithAuth(accountId);
    
    await connectionPoolManager.removeConnection(req.userId, account.email);
    
    await connectionPoolManager.addConnection(req.userId, accountWithAuth);
    
    account.sync_status = 'running';
    await saveDB();
    
    res.json({ success: true });
  } catch (err) {
    account.sync_status = 'error';
    await saveDB();
    return res.status(500).json({ error: '重启同步失败: ' + err.message });
  }
});

export async function getAccountWithAuth(accountId) {
  const data = getDB();
  const account = data.email_accounts.find(a => a.id === parseInt(accountId));
  if (!account) return null;
  
  account.auth_code = decrypt(account.auth_code_encrypted, account.iv);
  return account;
}

export default router;