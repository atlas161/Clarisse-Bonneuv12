import { getDatabase } from '@netlify/database';

let db = null;
let dbResolved = false;

export const getDb = () => {
  if (dbResolved) {
    return db;
  }

  dbResolved = true;

  try {
    db = getDatabase();
  } catch {
    db = null;
  }

  return db;
};

export const getPool = () => getDb()?.pool || null;

export const query = async (text, params = []) => {
  const pool = getPool();

  if (!pool) {
    throw new Error('Database is not configured.');
  }

  return pool.query(text, params);
};
