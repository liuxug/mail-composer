import { ImapIdleKeepConnection } from '../service/ImapIdleKeepConnection.js';
import { getDB, saveDB } from '../db.js';

export class ConnectionPoolManager {
  constructor() {
    this.pool = new Map();
    this.wss = null;
    this.emailHandler = null;
  }

  setWss(wss) {
    this.wss = wss;
  }

  setEmailHandler(handler) {
    this.emailHandler = handler;
  }

  async addConnection(userId, account) {
    if (!this.pool.has(userId)) {
      this.pool.set(userId, new Map());
    }

    const userConnections = this.pool.get(userId);

    if (userConnections.has(account.email)) {
      console.log(`[PoolManager] Connection already exists for ${account.email}, removing old`);
      await this.removeConnection(userId, account.email);
    }

    const connection = new ImapIdleKeepConnection({
      accountId: account.id,
      email: account.email,
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      authCode: account.auth_code,
      lastUid: account.last_uid || 0,
      uidValidity: account.uid_validity || 0
    });

    connection.setOnMail(async (emails) => {
      await this.handleNewEmails(userId, account.id, emails);
    });

    connection.setOnError(async (err) => {
      console.error(`[PoolManager] Error for ${account.email}:`, err.message);
    });

    connection.setOnConnect(() => {
      console.log(`[PoolManager] Connected: ${account.email}`);
    });

    connection.setOnDisconnect(() => {
      console.log(`[PoolManager] Disconnected: ${account.email}`);
    });

    userConnections.set(account.email, connection);

    await connection.connect();

    console.log(`[PoolManager] Added connection: userId=${userId}, email=${account.email}`);
  }

  async removeConnection(userId, email) {
    if (!this.pool.has(userId)) {
      return;
    }

    const userConnections = this.pool.get(userId);

    if (!userConnections.has(email)) {
      return;
    }

    const connection = userConnections.get(email);

    await connection.logout();

    userConnections.delete(email);

    if (userConnections.size === 0) {
      this.pool.delete(userId);
    }

    console.log(`[PoolManager] Removed connection: userId=${userId}, email=${email}`);
  }

  async removeAllUserConnections(userId) {
    if (!this.pool.has(userId)) {
      return;
    }

    const userConnections = this.pool.get(userId);

    for (const [email, connection] of userConnections) {
      await connection.logout();
    }

    userConnections.clear();
    this.pool.delete(userId);

    console.log(`[PoolManager] Removed all connections for userId=${userId}`);
  }

  async handleNewEmails(userId, accountId, emails) {
    console.log(`[PoolManager] Handling ${emails.length} new emails for userId=${userId}, accountId=${accountId}`);

    if (this.emailHandler) {
      await this.emailHandler(userId, accountId, emails);
    }

    const data = getDB();
    const account = data.email_accounts.find(a => a.id === accountId);
    if (account) {
      const connection = this.getConnection(userId, account.email);
      if (connection && account.last_uid > connection.lastUid) {
        console.log(`[PoolManager] Updating connection lastUid from ${connection.lastUid} to ${account.last_uid}`);
        connection.lastUid = account.last_uid;
      }
    }

    this.broadcastToUser(userId, {
      type: 'new_email',
      accountId,
      emails
    });
  }

  broadcastToUser(userId, message) {
    if (!this.wss) {
      return;
    }

    const messageStr = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN && client.userId === userId) {
        client.send(messageStr);
      }
    });

    console.log(`[PoolManager] Broadcast to user ${userId}: ${message.type}`);
  }

  async restartAllConnections() {
    console.log('[PoolManager] Restarting all connections...');

    for (const [userId, userConnections] of this.pool) {
      for (const [email, connection] of userConnections) {
        await connection.logout();

        setTimeout(() => {
          this.addConnection(userId, {
            id: connection.config.accountId,
            email: connection.config.email,
            imap_host: connection.config.imapHost,
            imap_port: connection.config.imapPort,
            auth_code: connection.config.authCode,
            last_uid: connection.lastUid,
            uid_validity: connection.uidValidity
          });
        }, 1000);
      }
    }

    console.log('[PoolManager] All connections restarted');
  }

  async restartUserConnections(userId) {
    if (!this.pool.has(userId)) {
      return;
    }

    console.log(`[PoolManager] Restarting connections for userId=${userId}...`);

    const userConnections = this.pool.get(userId);
    const accountsToRestart = [];

    for (const [email, connection] of userConnections) {
      await connection.logout();
      accountsToRestart.push({
        id: connection.config.accountId,
        email: connection.config.email,
        imap_host: connection.config.imapHost,
        imap_port: connection.config.imapPort,
        auth_code: connection.config.authCode,
        last_uid: connection.lastUid,
        uid_validity: connection.uidValidity
      });
    }

    userConnections.clear();

    for (const account of accountsToRestart) {
      await this.addConnection(userId, account);
    }

    console.log(`[PoolManager] Connections restarted for userId=${userId}`);
  }

  getStatus(userId = null) {
    const status = {};

    if (userId) {
      if (!this.pool.has(userId)) {
        return { userId, connections: [] };
      }

      const userConnections = this.pool.get(userId);
      status[userId] = Array.from(userConnections.entries()).map(([email, connection]) => ({
        email,
        ...connection.getStatus()
      }));
    } else {
      for (const [uid, userConnections] of this.pool) {
        status[uid] = Array.from(userConnections.entries()).map(([email, connection]) => ({
          email,
          ...connection.getStatus()
        }));
      }
    }

    return status;
  }

  async persistLastUid(userId, email, lastUid, uidValidity) {
    const data = getDB();
    const account = data.email_accounts.find(
      a => a.user_id === userId && a.email === email
    );

    if (account) {
      account.last_uid = lastUid;
      account.uid_validity = uidValidity;
      await saveDB();
    }
  }

  async loadConnectionsForUser(userId) {
    const data = getDB();
    const accounts = data.email_accounts.filter(a => a.user_id === userId);

    for (const account of accounts) {
      try {
        await this.addConnection(userId, account);
      } catch (err) {
        console.error(`[PoolManager] Failed to load connection for ${account.email}:`, err.message);
      }
    }

    console.log(`[PoolManager] Loaded ${accounts.length} connections for userId=${userId}`);
  }

  async loadAllConnections() {
    const data = getDB();
    const userIds = new Set(data.email_accounts.map(a => a.user_id));

    for (const userId of userIds) {
      await this.loadConnectionsForUser(userId);
    }

    console.log(`[PoolManager] Loaded connections for ${userIds.size} users`);
  }

  getConnection(userId, email) {
    if (!this.pool.has(userId)) {
      return null;
    }

    const userConnections = this.pool.get(userId);
    return userConnections.get(email) || null;
  }

  getUserConnectionCount(userId) {
    if (!this.pool.has(userId)) {
      return 0;
    }

    return this.pool.get(userId).size;
  }

  getTotalConnectionCount() {
    let count = 0;
    for (const userConnections of this.pool.values()) {
      count += userConnections.size;
    }
    return count;
  }
}

export const connectionPoolManager = new ConnectionPoolManager();