// src/db.ts
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    
    connectionString: process.env.DATABASE_URL, // Railway
    ssl: {
        rejectUnauthorized: false,
    },
});