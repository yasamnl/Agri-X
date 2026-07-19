import mysql from 'mysql2/promise';

type MysqlPool = ReturnType<typeof mysql.createPool> | null;

const DB_CLIENT = (process.env.DB_CLIENT || process.env.DB_TYPE || '').toLowerCase() || 'mysql';

let mysqlPool: MysqlPool = null;
let pgPool: any = null;

function mysqlConfig() {
  return {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
    user: process.env.DB_USERNAME || process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_DATABASE || process.env.DB_NAME || process.env.MYSQL_DB || '',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

if (DB_CLIENT === 'mysql' || DB_CLIENT === 'mariadb') {
  mysqlPool = mysql.createPool(mysqlConfig());
}

if (DB_CLIENT === 'postgres' || DB_CLIENT === 'pg') {
  // lazy require to avoid bundling pg when not needed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg');
  pgPool = new Pool({
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    user: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.DB_DATABASE || process.env.PGDATABASE || process.env.DB_NAME || '',
    port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
    max: 10,
  });
}

function convertQuestionToDollarPlaceholders(sql: string) {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

async function execute(query: string, params: any[] = []) {
  if (DB_CLIENT === 'postgres' || DB_CLIENT === 'pg') {
    if (!pgPool) throw new Error('Postgres pool not initialized');
    const converted = convertQuestionToDollarPlaceholders(query);
    const res = await pgPool.query(converted, params);
    // normalize to mysql2-like result: [rows, fields]
    return [res.rows, res.fields || []];
  }

  if (!mysqlPool) throw new Error('MySQL pool not initialized');
  const res: any = await mysqlPool.execute(query, params);
  return res; // mysql2 returns [rows, fields]
}

export default { execute, client: DB_CLIENT };
