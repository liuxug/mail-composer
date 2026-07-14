import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import emailAccountsRoutes from './routes/emailAccounts.js';
import emailsRoutes from './routes/emails.js';
import labelsRoutes from './routes/labels.js';
import { WebSocketServer } from 'ws';
import { verifyToken } from './utils/jwt.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectionPoolManager } from './manager/ConnectionPoolManager.js';
import { getDB, saveDB } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/email-accounts', emailAccountsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/labels', labelsRoutes);

app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connectionCount: connectionPoolManager.getTotalConnectionCount() 
  });
});

app.get('/api/sync/status', (req, res) => {
  res.json(connectionPoolManager.getStatus());
});

app.post('/api/sync/restart', async (req, res) => {
  try {
    await connectionPoolManager.restartAllConnections();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function saveNewEmails(userId, accountId, emails) {
  const data = getDB();
  let maxUid = 0;
  
  for (const emailData of emails) {
    const existingEmail = data.emails.find(
      e => e.account_id === accountId && e.message_id === emailData.message_id
    );
    
    maxUid = Math.max(maxUid, emailData.uid);
    
    if (existingEmail) {
      continue;
    }
    
    const email = {
      id: data.emails.length > 0 ? Math.max(...data.emails.map(e => e.id)) + 1 : 1,
      account_id: accountId,
      folder: emailData.folder || 'INBOX',
      message_id: emailData.message_id || '',
      from_addr: emailData.from_addr || '',
      from_name: emailData.from_name || '',
      to_addr: emailData.to_addr || '',
      subject: emailData.subject || '(无主题)',
      body_text: emailData.body_text || '',
      body_html: emailData.body_html || '',
      date: emailData.date || new Date().toISOString(),
      is_read: emailData.is_read || 0,
      is_starred: emailData.is_starred || 0,
      has_attachment: emailData.has_attachment || 0,
      attachments: emailData.attachments || []
    };
    
    data.emails.push(email);
  }
  
  await saveDB();
  
  const account = data.email_accounts.find(a => a.id === accountId);
  if (account && maxUid > 0) {
    if (maxUid > account.last_uid) {
      account.last_uid = maxUid;
      await saveDB();
    }
  }
  
  console.log(`[Server] Saved ${emails.length} new emails for account ${accountId}`);
}

async function start() {
  await initDB();
  
  connectionPoolManager.setEmailHandler(saveNewEmails);
  
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  connectionPoolManager.setWss(wss);
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(1008, 'Invalid token');
      return;
    }
    
    const userId = decoded.userId;
    ws.userId = userId;
    
    console.log(`User ${userId} connected via WebSocket`);
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        
        if (data.type === 'request_sync') {
          connectionPoolManager.broadcastToUser(userId, {
            type: 'sync_requested',
            accountId: data.accountId
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`User ${userId} disconnected`);
    });
  });
  
  await connectionPoolManager.loadAllConnections();
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    
    await connectionPoolManager.restartAllConnections();
    
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

start();