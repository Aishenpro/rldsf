import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

const file = path.resolve(env.DATABASE_PATH);
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');
db.pragma = (statement, options = {}) => {
  const match = /^([a-z_]+)(?:\s*=\s*(\w+))?$/i.exec(statement.trim());
  if (!match) throw new Error('Unsupported PRAGMA statement');
  const [, name, value] = match;
  if (value !== undefined) db.exec(`PRAGMA ${name} = ${value}`);
  const row = db.prepare(`PRAGMA ${name}`).get();
  return options.simple ? Object.values(row || {})[0] : row;
};
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(...args); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
};
db.backup = async (destination) => {
  const absolute = path.resolve(destination);
  db.prepare('VACUUM INTO ?').run(absolute);
  return absolute;
};
if (db.pragma('foreign_keys', { simple: true }) !== 1) throw new Error('SQLite foreign-key enforcement is unavailable');

export function migrate() {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const dir = path.resolve('src/database/migrations');
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name)) continue;
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    db.transaction(() => { db.exec(sql); db.prepare('INSERT INTO schema_migrations(name) VALUES (?)').run(name); })();
  }
}
