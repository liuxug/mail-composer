import express from 'express';
import bcrypt from 'bcryptjs';
import { getDB, saveDB } from '../db.js';
import { generateToken } from '../utils/jwt.js';
import { sendVerificationCode } from '../utils/email.js';

const router = express.Router();

const verificationCodes = new Map();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidCode(email, code) {
  const stored = verificationCodes.get(email);
  if (!stored) {
    return false;
  }
  if (stored.code !== code) {
    return false;
  }
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(email);
    return false;
  }
  return true;
}

router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: '请输入邮箱地址' });
  }
  
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' });
  }
  
  const data = getDB();
  const existingUser = data.users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: '该邮箱已被注册' });
  }
  
  const lastCode = verificationCodes.get(email);
  if (lastCode && Date.now() - lastCode.sentAt < 60000) {
    return res.status(400).json({ error: '发送过于频繁，请1分钟后重试' });
  }
  
  const code = generateCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  
  try {
    await sendVerificationCode(email, code);
    
    verificationCodes.set(email, {
      code,
      expiresAt,
      sentAt: Date.now()
    });
    
    res.json({ success: true, message: '验证码已发送，请查收邮件' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  const { username, email, password, code } = req.body;
  
  if (!username || !email || !password || !code) {
    return res.status(400).json({ error: '所有字段都是必填项' });
  }
  
  if (!isValidCode(email, code)) {
    return res.status(400).json({ error: '验证码无效或已过期' });
  }
  
  const data = getDB();
  
  const existingUser = data.users.find(u => u.username === username || u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: '用户名或邮箱已存在' });
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);
  
  const user = {
    id: data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1,
    username,
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };
  
  data.users.push(user);
  await saveDB();
  
  verificationCodes.delete(email);
  
  const token = generateToken(user.id);
  
  res.status(201).json({ 
    user: { id: user.id, username: user.username, email: user.email }, 
    token 
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  
  const data = getDB();
  const user = data.users.find(u => u.email === email);
  
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: '邮箱或密码错误' });
  }
  
  const token = generateToken(user.id);
  
  res.json({
    user: { id: user.id, username: user.username, email: user.email },
    token
  });
});

export default router;