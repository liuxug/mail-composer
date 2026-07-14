import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const attachmentsDir = path.join(__dirname, '../uploads/attachments');

export class ImapIdleKeepConnection {
  constructor(config) {
    this.config = config;
    this.imap = null;
    this.isConnected = false;
    this.isIdle = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.idleTimeout = 29 * 60 * 1000;
    this.idleTimer = null;
    this.lastUid = config.lastUid || 0;
    this.uidValidity = config.uidValidity || 0;
    this.onMail = null;
    this.onError = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.pollingInterval = null;
    this.usePolling = true;
    this.lastPollTime = 0;
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      this.imap = new ImapFlow({
        host: this.config.imapHost,
        port: parseInt(this.config.imapPort),
        secure: parseInt(this.config.imapPort) === 993,
        auth: {
          user: this.config.email,
          pass: this.config.authCode
        },
        logger: false,
        greetingTimeout: 30000,
        connectionTimeout: 30000,
        socketTimeout: 60000,
        tls: {
          rejectUnauthorized: false
        }
      });

      this.imap.on('error', (err) => {
        console.error(`[IMAP ${this.config.email}] Connection error:`, err.message);
        this.isConnected = false;
        this.isIdle = false;
        if (this.onError) {
          this.onError(err);
        }
        this.scheduleReconnect();
      });

      this.imap.on('disconnected', () => {
        console.log(`[IMAP ${this.config.email}] Disconnected`);
        this.isConnected = false;
        this.isIdle = false;
        if (this.onDisconnect) {
          this.onDisconnect();
        }
        this.scheduleReconnect();
      });

      this.imap.on('mailbox', (mailbox) => {
        console.log(`[IMAP ${this.config.email}] [EVENT] mailbox: ${mailbox.name}, exists: ${mailbox.exists}, recent: ${mailbox.recent}`);
        if (mailbox.name === 'INBOX' && this.isConnected) {
          this.handleNewMailboxEvent(mailbox);
        }
      });

      this.imap.on('exists', (info) => {
        const exists = typeof info === 'object' ? info.exists : info;
        console.log(`[IMAP ${this.config.email}] [EVENT] exists:`, info);
        if (this.isConnected) {
          this.handleExistsEvent(exists);
        }
      });

      await this.imap.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log(`[IMAP ${this.config.email}] Connected successfully`);

      if (this.onConnect) {
        this.onConnect();
      }

      await this.imap.mailboxOpen('INBOX');
      console.log(`[IMAP ${this.config.email}] INBOX opened`);

      const lock = await this.imap.getMailboxLock('INBOX');
      try {
        const status = await this.imap.status('INBOX', {
          exists: true,
          uidValidity: true,
          uidNext: true
        });
        const statusUidValidity = Number(status.uidValidity);
        console.log(`[IMAP ${this.config.email}] INBOX status: exists=${status.exists}, uidValidity=${statusUidValidity}, uidNext=${status.uidNext}`);

        if (statusUidValidity !== this.uidValidity && this.uidValidity !== 0) {
          console.log(`[IMAP ${this.config.email}] UID validity changed, resetting lastUid`);
          this.lastUid = 0;
        }
        this.uidValidity = statusUidValidity;

        if (this.lastUid === 0) {
          console.log(`[IMAP ${this.config.email}] lastUid is 0 (new account), waiting for manual sync`);
        } else {
          console.log(`[IMAP ${this.config.email}] Using stored lastUid: ${this.lastUid}`);
        }
      } finally {
        lock.release();
      }

      if (this.lastUid === 0) {
        console.log(`[IMAP ${this.config.email}] New account, not starting polling until manual sync`);
      } else {
        this.startPolling();
        this.startIdleLoop();
      }

    } catch (err) {
      console.error(`[IMAP ${this.config.email}] Connect failed:`, err.message);
      this.scheduleReconnect();
    }
  }

  async handleNewMailboxEvent(mailbox) {
    try {
      if (mailbox.exists > this.lastUid) {
        console.log(`[IMAP ${this.config.email}] New mail detected via mailbox event: ${mailbox.exists} > ${this.lastUid}`);
        await this.fetchNewEmails();
      }
    } catch (err) {
      console.error(`[IMAP ${this.config.email}] Error handling mailbox event:`, err.message);
    }
  }

  async handleExistsEvent(exists) {
    try {
      if (exists > this.lastUid) {
        console.log(`[IMAP ${this.config.email}] New mail detected via exists event: ${exists} > ${this.lastUid}`);
        await this.fetchNewEmails();
      }
    } catch (err) {
      console.error(`[IMAP ${this.config.email}] Error handling exists event:`, err.message);
    }
  }

  async startIdleLoop() {
    if (!this.isConnected) {
      return;
    }

    const runIdle = async () => {
      if (!this.isConnected) {
        return;
      }

      try {
        if (!this.isConnected) {
          return;
        }
        
        this.isIdle = true;
        console.log(`[IMAP ${this.config.email}] Entering IDLE mode`);

        this.idleTimer = setTimeout(() => {
          console.log(`[IMAP ${this.config.email}] IDLE timeout, restarting...`);
          try {
            this.imap.idleStop();
          } catch (e) {
            console.error(`[IMAP ${this.config.email}] Error stopping IDLE:`, e.message);
          }
        }, this.idleTimeout);

        await this.imap.idle();

      } catch (err) {
        console.error(`[IMAP ${this.config.email}] IDLE error:`, err.message);
        if (err.message.includes('Connection not available')) {
          console.log(`[IMAP ${this.config.email}] Connection lost during IDLE, triggering reconnect`);
          this.isConnected = false;
          this.isIdle = false;
          this.scheduleReconnect();
          return;
        }
      } finally {
        this.isIdle = false;
        if (this.idleTimer) {
          clearTimeout(this.idleTimer);
          this.idleTimer = null;
        }
      }

      if (this.isConnected) {
        setTimeout(runIdle, 2000);
      }
    };

    runIdle();
  }

  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.usePolling = true;
    console.log(`[IMAP ${this.config.email}] Starting polling mode (30s interval)`);

    this.pollingInterval = setInterval(async () => {
      if (!this.isConnected) {
        return;
      }

      try {
        await this.fetchNewEmails();
      } catch (err) {
        console.error(`[IMAP ${this.config.email}] Polling error:`, err.message);
      }
    }, 30000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.usePolling = false;
  }

  async fetchNewEmails() {
    if (!this.isConnected) {
      return;
    }

    if (this.lastUid === 0) {
      console.log(`[IMAP ${this.config.email}] lastUid is 0, waiting for manual sync before fetching`);
      return;
    }

    const now = Date.now();
    if (this.lastPollTime > 0 && (now - this.lastPollTime) < 5000) {
      return;
    }
    this.lastPollTime = now;

    try {
      const lock = await this.imap.getMailboxLock('INBOX');

      try {
        const mailbox = await this.imap.status('INBOX', {
          exists: true,
          uidValidity: true,
          uidNext: true
        });
        const currentUidValidity = Number(mailbox.uidValidity);

        if (currentUidValidity !== this.uidValidity && this.uidValidity !== 0) {
          console.log(`[IMAP ${this.config.email}] UID validity changed: ${this.uidValidity} -> ${currentUidValidity}`);
          this.lastUid = 0;
        }
        this.uidValidity = currentUidValidity;

        const newUidStart = this.lastUid + 1;

        if (mailbox.uidNext) {
          const maxUid = mailbox.uidNext - 1;
          if (newUidStart > maxUid) {
            if (this.usePolling) {
              console.log(`[IMAP ${this.config.email}] Polling: No new emails (lastUid: ${this.lastUid}, uidNext: ${mailbox.uidNext})`);
            }
            return;
          }
          
          console.log(`[IMAP ${this.config.email}] Fetching emails UID ${newUidStart}:${maxUid}`);
          
          const newEmails = [];
          for await (const message of this.imap.fetch(`${newUidStart}:${maxUid}`, {
            source: true,
            uid: true,
            internalDate: true,
            envelope: true,
            flags: true
          }, { uid: true })) {
            const msgId = Number(message.uid);
            if (!msgId) continue;

            const emailData = await this.parseEmail(message);
            if (emailData) {
              newEmails.push(emailData);
              this.lastUid = Math.max(this.lastUid, msgId);
            }
          }

          if (newEmails.length > 0 && this.onMail) {
            this.onMail(newEmails);
          }

          console.log(`[IMAP ${this.config.email}] Fetched ${newEmails.length} new emails, lastUid: ${this.lastUid}`);
          return;
        }

        if (this.imap.mailbox?.exists === 0) {
          if (this.usePolling) {
            console.log(`[IMAP ${this.config.email}] Polling: No new emails (lastUid: ${this.lastUid}, exists: 0)`);
          }
          return;
        }

        console.log(`[IMAP ${this.config.email}] Searching for UIDs > ${this.lastUid}`);
        
        const allUidsSet = await this.imap.search(
          { uid: '*' },
          { uid: true }
        );
        const allUids = Array.from(allUidsSet);
        
        const newUids = allUids.filter(uid => uid > this.lastUid);
        
        console.log(`[IMAP ${this.config.email}] All UIDs: ${allUids.length} found, new UIDs (>${this.lastUid}): ${newUids.length} [${newUids.join(',') || 'none'}]`);

        if (newUids.length === 0) {
          if (this.usePolling) {
            console.log(`[IMAP ${this.config.email}] Polling: No new emails (lastUid: ${this.lastUid})`);
          }
          return;
        }

        console.log(`[IMAP ${this.config.email}] Fetching emails UID ${newUids.join(',')}`);

        const newEmails = [];
        const messages = await this.imap.fetchAll(newUids, {
          source: true,
          uid: true,
          internalDate: true,
          envelope: true,
          flags: true
        }, { uid: true });

        for (const message of messages) {
          const rawUid = message.uid;
          const msgId = Number(rawUid);
          
          if (!msgId) continue;

          const emailData = await this.parseEmail(message);
          if (emailData) {
            newEmails.push(emailData);
            this.lastUid = Math.max(this.lastUid, msgId);
          }
        }

        if (newEmails.length > 0 && this.onMail) {
          this.onMail(newEmails);
        }

        console.log(`[IMAP ${this.config.email}] Fetched ${newEmails.length} new emails, lastUid: ${this.lastUid}`);

      } finally {
        lock.release();
      }

    } catch (err) {
      console.error(`[IMAP ${this.config.email}] Fetch new emails failed:`, err.message);
      if (err.message.includes('Connection not available')) {
        console.log(`[IMAP ${this.config.email}] Connection lost during fetch, triggering reconnect`);
        this.isConnected = false;
        this.scheduleReconnect();
      }
    }
  }

  async parseEmail(message) {
    try {
      const sourceBuffer = typeof message.source === 'string'
        ? Buffer.from(message.source)
        : message.source;

      const parsed = await simpleParser(sourceBuffer);

      const fromAddr = parsed.from?.value[0]?.address || '';
      const fromName = parsed.from?.value[0]?.name || '';
      const toAddr = parsed.to?.value.map(t => t.address).join(', ') || '';
      const subject = parsed.subject || '';
      const date = message.internalDate
        ? message.internalDate.toISOString()
        : parsed.date
          ? parsed.date.toISOString()
          : new Date().toISOString();
      const bodyText = parsed.text || '';
      const bodyHtml = parsed.html || '';

      const attachments = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const attachment of parsed.attachments) {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 9);
          let filename = attachment.filename || `attachment_${timestamp}`;
          try {
            filename = iconv.decode(Buffer.from(filename, 'binary'), 'utf-8');
          } catch (e) {
            console.log(`[IMAP ${this.config.email}] Failed to decode filename, using original`);
          }
          const fileName = `${message.uid}_${timestamp}_${randomStr}_${filename}`;
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
            console.error(`[IMAP ${this.config.email}] Error saving attachment:`, e.message);
          }
        }
      }

      console.log(`[IMAP ${this.config.email}] Message ${message.uid} flags:`, message.flags, typeof message.flags);
      const isSeen = message.flags?.has('\\Seen') ?? false;
      const isStarred = message.flags?.has('\\Flagged') ?? false;
      console.log(`[IMAP ${this.config.email}] Message ${message.uid} isSeen: ${isSeen}, isStarred: ${isStarred}`);

      return {
        uid: Number(message.uid),
        account_id: this.config.accountId,
        folder: 'INBOX',
        message_id: String(message.uid) || '',
        from_addr: fromAddr,
        from_name: fromName,
        to_addr: toAddr,
        subject: subject || '(无主题)',
        body_text: bodyText,
        body_html: bodyHtml,
        date,
        is_read: isSeen ? 1 : 0,
        is_starred: isStarred ? 1 : 0,
        has_attachment: attachments.length > 0 ? 1 : 0,
        size: sourceBuffer.length,
        attachments
      };

    } catch (err) {
      console.error(`[IMAP ${this.config.email}] Parse email failed:`, err.message);
      return null;
    }
  }

  async logout() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.stopPolling();

    this.isIdle = false;

    if (this.imap) {
      try {
        await this.imap.logout();
      } catch (err) {
        console.error(`[IMAP ${this.config.email}] Logout error:`, err.message);
      }
      this.imap = null;
    }

    this.isConnected = false;
    console.log(`[IMAP ${this.config.email}] Connection closed`);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[IMAP ${this.config.email}] Max reconnect attempts reached, stopping`);
      if (this.onError) {
        this.onError(new Error('Max reconnect attempts reached'));
      }
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[IMAP ${this.config.email}] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  setOnMail(callback) {
    this.onMail = callback;
  }

  setOnError(callback) {
    this.onError = callback;
  }

  setOnConnect(callback) {
    this.onConnect = callback;
  }

  setOnDisconnect(callback) {
    this.onDisconnect = callback;
  }

  getStatus() {
    return {
      email: this.config.email,
      accountId: this.config.accountId,
      isConnected: this.isConnected,
      isIdle: this.isIdle,
      usePolling: this.usePolling,
      lastUid: this.lastUid,
      uidValidity: this.uidValidity,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  startSync() {
    if (this.lastUid === 0) {
      console.log(`[IMAP ${this.config.email}] Cannot start sync, lastUid is still 0`);
      return;
    }
    this.startPolling();
    this.startIdleLoop();
    console.log(`[IMAP ${this.config.email}] Sync started after manual sync`);
  }
}