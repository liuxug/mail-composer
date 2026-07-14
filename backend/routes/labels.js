import express from 'express';
import { getDB, saveDB } from '../db.js';
import { authenticate } from '../utils/jwt.js';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const { account_id } = req.query;
  const data = getDB();
  const labels = data.labels || [];
  let userLabels = labels.filter(l => l.user_id === req.userId);
  if (account_id) {
    userLabels = userLabels.filter(l => l.account_id === parseInt(account_id));
  }
  res.json(userLabels);
});

router.post('/', authenticate, async (req, res) => {
  const { name, color, account_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: '标签名称不能为空' });
  }
  if (!account_id) {
    return res.status(400).json({ error: '请选择邮箱账户' });
  }

  const data = getDB();
  if (!data.labels) {
    data.labels = [];
  }

  const account = data.email_accounts.find(a => a.id === parseInt(account_id) && a.user_id === req.userId);
  if (!account) {
    return res.status(400).json({ error: '邮箱账户不存在' });
  }

  const existing = data.labels.find(l => l.user_id === req.userId && l.account_id === parseInt(account_id) && l.name === name);
  if (existing) {
    return res.status(400).json({ error: '标签名称已存在' });
  }

  const colorOptions = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const selectedColor = color && colorOptions.includes(color) ? color : colorOptions[Math.floor(Math.random() * colorOptions.length)];

  const newLabel = {
    id: data.labels.length > 0 ? Math.max(...data.labels.map(l => l.id)) + 1 : 1,
    user_id: req.userId,
    account_id: parseInt(account_id),
    name,
    color: selectedColor,
    created_at: new Date().toISOString()
  };

  data.labels.push(newLabel);
  await saveDB();

  res.status(201).json(newLabel);
});

router.put('/:id', authenticate, async (req, res) => {
  const { name, color } = req.body;
  const labelId = parseInt(req.params.id);

  const data = getDB();
  const label = (data.labels || []).find(l => l.id === labelId && l.user_id === req.userId);

  if (!label) {
    return res.status(404).json({ error: '标签不存在' });
  }

  if (name) {
    const existing = (data.labels || []).find(l => l.id !== labelId && l.user_id === req.userId && l.account_id === label.account_id && l.name === name);
    if (existing) {
      return res.status(400).json({ error: '标签名称已存在' });
    }
    label.name = name;
  }

  if (color) {
    const colorOptions = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    if (colorOptions.includes(color)) {
      label.color = color;
    }
  }

  await saveDB();
  res.json(label);
});

router.delete('/:id', authenticate, async (req, res) => {
  const labelId = parseInt(req.params.id);

  const data = getDB();
  const labelIndex = (data.labels || []).findIndex(l => l.id === labelId && l.user_id === req.userId);

  if (labelIndex === -1) {
    return res.status(404).json({ error: '标签不存在' });
  }

  data.labels.splice(labelIndex, 1);

  if (data.emails) {
    data.emails.forEach(email => {
      if (email.label_ids && Array.isArray(email.label_ids)) {
        email.label_ids = email.label_ids.filter(id => id !== labelId);
      }
    });
  }

  await saveDB();
  res.json({ success: true });
});

export default router;