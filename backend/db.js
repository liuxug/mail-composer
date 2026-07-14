import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.json');

const adapter = new JSONFile(dbPath);
const defaultData = {
  users: [],
  email_accounts: [],
  emails: [],
  sync_state: {}
};

export const db = new Low(adapter, defaultData);

export async function initDB() {
  await db.read();
  
  if (!db.data) {
    db.data = defaultData;
  }
  
  if (!db.data.users) db.data.users = [];
  if (!db.data.email_accounts) db.data.email_accounts = [];
  if (!db.data.emails) db.data.emails = [];
  if (!db.data.sync_state) db.data.sync_state = {};
  
  await db.write();
}

export async function saveDB() {
  await db.write();
}

export function getDB() {
  return db.data;
}
