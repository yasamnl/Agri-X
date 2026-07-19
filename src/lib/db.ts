import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USERNAME || process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_DATABASE || process.env.DB_NAME || process.env.MYSQL_DB || '',
  port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
