import { pool } from "../db.js";

export const saveMemory = async (
  userId: number,
  key: string,
  value: string
) => {
  await pool.query(
    `INSERT INTO ai_memory (user_id, key, value)
     VALUES ($1,$2,$3)`,
    [userId, key, value]
  );
};

export const getMemory = async (userId: number, key: string) => {
  const res = await pool.query(
    `SELECT value FROM ai_memory
     WHERE user_id=$1 AND key=$2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, key]
  );

  return res.rows[0]?.value || null;
};

export const getAllMemory = async (userId: number) => {
  const res = await pool.query(
    `SELECT key, value FROM ai_memory WHERE user_id=$1`,
    [userId]
  );

  return res.rows;
};