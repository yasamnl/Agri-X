/**
 * PostgreSQL → MySQL Migration Script (FIXED v2.1)
 * 
 * Fixes applied:
 * ✅ Handle 'timestamp without time zone' → TIMESTAMP
 * ✅ Fix AUTO_INCREMENT logic for id columns
 * ✅ Remove PostgreSQL-specific functions (pg_get_serial_sequence)
 * ✅ Better default value handling for id columns
 * ✅ Fix CREATE TABLE syntax escaping issues
 * ✅ Skip sequence reset (MySQL handles AUTO_INCREMENT automatically)
 */

const { Pool } = require('pg');
const mysql = require('mysql2/promise');

// ⚙️ KONFIGURASI DATABASE
const PG_CONFIG = {
  connectionString: 'postgresql://postgres:yasamnl@127.0.0.1:5432/ecommerce_db'
};

const MYSQL_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'ecommerce_db',
  multipleStatements: true,
  charset: 'utf8mb4'
};

const LOCATION_TABLES = ['provinces', 'regencies', 'districts', 'villages'];
const PG_SYSTEM_COLUMNS = ['tableoid', 'cmax', 'xmax', 'cmin', 'xmin', 'ctid'];

// ✅ HELPER: Map PostgreSQL types → MySQL types (LENGKAP)
function mapPgTypeToMysql(pgType, udtName, charMaxLen, numericPrecision, numericScale) {
  const type = pgType.toLowerCase();
  const udt = (udtName || '').toLowerCase();
  
  // ✅ Numeric types
  if (type === 'bigint' || udt === 'int8') return 'BIGINT UNSIGNED';
  if (type === 'integer' || type === 'int' || udt === 'int4') return 'INT';
  if (type === 'smallint' || udt === 'int2') return 'SMALLINT';
  if (type === 'tinyint') return 'TINYINT';
  if (type === 'boolean') return 'TINYINT(1)';
  
  if (type === 'decimal' || type === 'numeric') {
    const p = numericPrecision || 10;
    const s = numericScale || 2;
    return `DECIMAL(${p},${s})`;
  }
  if (type === 'real' || udt === 'float4') return 'FLOAT';
  if (type === 'double precision' || udt === 'float8') return 'DOUBLE';
  
  // ✅ String types
  if (type === 'character varying' || type === 'varchar') {
    const len = charMaxLen || 255;
    return `VARCHAR(${len})`;
  }
  if (type === 'character' || type === 'char') {
    const len = charMaxLen || 255;
    return `CHAR(${len})`;
  }
  if (type === 'text' || type === 'longtext' || type === 'mediumtext') return 'TEXT';
  
  // ✅ Date/Time types - ✅ FIX: Handle 'timestamp without time zone'
  if (type === 'timestamp without time zone' || type === 'timestamp' || udt === 'timestamp') {
    return 'TIMESTAMP';
  }
  if (type === 'timestamp with time zone' || type === 'timestamptz') {
    return 'TIMESTAMP'; // MySQL TIMESTAMP handles via connection timezone
  }
  if (type === 'date') return 'DATE';
  if (type === 'time') return 'TIME';
  
  // ✅ JSON/JSONB
  if (type === 'jsonb' || type === 'json') return 'JSON';
  
  // ✅ Binary
  if (type === 'bytea') return 'BLOB';
  
  // ✅ Enum (basic support)
  if (type === 'user-defined' && udt.includes('enum')) {
    return 'VARCHAR(50)'; // Fallback, enum values need manual mapping
  }
  
  // ✅ Default fallback
  console.warn(`   ⚠️ Unknown type '${type}' (udt: '${udt}'), using TEXT`);
  return 'TEXT';
}

// ✅ HELPER: Format default value for MySQL
function formatDefaultValue(pgDefault, mysqlType, isNullable, pgType) {
  if (pgDefault === null || pgDefault === undefined) {
    if (!isNullable) {
      // Auto-default for NOT NULL columns
      if (mysqlType.includes('INT') || mysqlType.includes('DECIMAL') || mysqlType.includes('FLOAT') || mysqlType.includes('DOUBLE')) {
        return 'DEFAULT 0';
      }
      if (mysqlType === 'TINYINT(1)') return 'DEFAULT 0';
      if (mysqlType === 'TIMESTAMP' || mysqlType === 'DATE') return ''; // Let MySQL handle
      return "DEFAULT ''";
    }
    return '';
  }
  
  const defaultStr = pgDefault.toString().trim();
  
  // Handle PostgreSQL function defaults
  if (defaultStr.toLowerCase().includes('current_timestamp') || 
      defaultStr.toLowerCase().includes('now()') ||
      defaultStr.toLowerCase().includes('current_date')) {
    return 'DEFAULT CURRENT_TIMESTAMP';
  }
  
  // Handle boolean
  if (pgType === 'boolean' || mysqlType === 'TINYINT(1)') {
    if (defaultStr.toLowerCase() === 'true' || defaultStr === '1' || defaultStr === "'t'") return 'DEFAULT 1';
    if (defaultStr.toLowerCase() === 'false' || defaultStr === '0' || defaultStr === "'f'") return 'DEFAULT 0';
  }
  
  // Handle numeric
  if (mysqlType.includes('INT') || mysqlType.includes('DECIMAL') || mysqlType.includes('FLOAT') || mysqlType.includes('DOUBLE')) {
    const num = parseFloat(defaultStr.replace(/'/g, '').split('::')[0]);
    if (!isNaN(num)) return `DEFAULT ${num}`;
    return 'DEFAULT 0';
  }
  
  // Handle string - escape single quotes for MySQL
  let value = defaultStr;
  if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }
  // Remove PostgreSQL casts like ::text, ::integer
  value = value.split('::')[0].trim();
  // Escape single quotes
  value = value.replace(/'/g, "''");
  
  return `DEFAULT '${value}'`;
}

async function runMigration() {
  console.log('🚀 Memulai migrasi PostgreSQL → MySQL (FIXED)...\n');
  
  const pgPool = new Pool(PG_CONFIG);
  const mysqlPool = await mysql.createPool(MYSQL_CONFIG);

  try {
    // ✅ 1. Get all tables from PostgreSQL
    const { rows: tables } = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📋 Ditemukan ${tables.length} tabel.\n`);

    // ✅ 2. Prioritize location tables
    const locationTables = tables.filter(t => LOCATION_TABLES.includes(t.table_name));
    const otherTables = tables.filter(t => !LOCATION_TABLES.includes(t.table_name));
    const orderedTables = [...locationTables, ...otherTables];

    for (const table of orderedTables) {
      const tableName = table.table_name;
      const isLocationTable = LOCATION_TABLES.includes(tableName);
      
      console.log(`📦 Memproses: ${tableName} ${isLocationTable ? '(LOCATION TABLE)' : ''}`);

      try {
        // ✅ 3. Get column structure from PostgreSQL
        const { rows: cols } = await pgPool.query(`
          SELECT 
            column_name,
            data_type,
            udt_name,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

        const safeCols = [];
        const colDefs = [];
        let hasIdColumn = false;
        const idColumnIndex = -1;

        // ✅ 4. Map PostgreSQL types → MySQL types
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i];
          
          // Skip PostgreSQL system columns
          if (PG_SYSTEM_COLUMNS.includes(c.column_name)) continue;
          
          // ✅ LOCATION TABLES: Skip 'code' column (PostgreSQL-specific)
          if (isLocationTable && c.column_name === 'code') {
            console.log(`   ⏭️ Skip kolom 'code' untuk ${tableName}`);
            continue;
          }
          
          safeCols.push(c);
          
          const colName = c.column_name;
          const isIdColumn = colName.toLowerCase() === 'id';
          
          if (isIdColumn) hasIdColumn = true;
          
          // ✅ Map type
          let mysqlType = mapPgTypeToMysql(
            c.data_type, 
            c.udt_name, 
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale
          );
          
          // ✅ FIX: Handle id column with AUTO_INCREMENT
          if (isIdColumn) {
            mysqlType = 'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT';
          }
          
          const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          
          // ✅ FIX: Skip default for id column (AUTO_INCREMENT handles it)
          let defaultVal = '';
          if (!isIdColumn) {
            defaultVal = formatDefaultValue(c.column_default, mysqlType, c.is_nullable === 'YES', c.data_type);
          }
          
          // Build column definition
          let colDef = `\`${colName}\` ${mysqlType}`;
          if (!isIdColumn) colDef += ` ${nullable}`;
          if (defaultVal) colDef += ` ${defaultVal}`;
          
          colDefs.push(colDef.trim());
        }

        // ✅ 5. DROP table if exists in MySQL
        await mysqlPool.query(`DROP TABLE IF EXISTS \`${tableName}\``);

        // ✅ 6. Create table in MySQL
        if (hasIdColumn) {
          colDefs.push(`PRIMARY KEY (\`id\`)`);
        }
        
        // ✅ FIX: Proper escaping for CREATE TABLE
        const createQuery = `CREATE TABLE \`${tableName}\` (
          ${colDefs.join(',\n  ')}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
        
        await mysqlPool.query(createQuery);
        console.log(`   ✅ Tabel dibuat: ${tableName}`);

        // ✅ 7. Fetch data from PostgreSQL
        const pgColNames = safeCols.map(c => `"${c.column_name}"`).join(', ');
        const mysqlColNames = safeCols.map(c => `\`${c.column_name}\``).join(', ');
        const colNamesPlain = safeCols.map(c => c.column_name);

        const { rows: pgData } = await pgPool.query(`SELECT ${pgColNames} FROM "${tableName}"`);
        
        if (pgData.length === 0) { 
          console.log(`   ⏭️ Kosong, dilewati.`); 
          continue; 
        }

        // ✅ 8. Prepare data for MySQL (type casting)
        const numCols = new Set(safeCols.filter(c => 
          c.data_type.includes('int') || c.data_type.includes('decimal') || 
          c.data_type.includes('numeric') || c.data_type.includes('float') ||
          c.data_type === 'bigint'
        ).map(c => c.column_name));

        const boolCols = new Set(safeCols.filter(c => c.data_type === 'boolean').map(c => c.column_name));
        const dateCols = new Set(safeCols.filter(c => 
          c.data_type.includes('date') || c.data_type.includes('timestamp')
        ).map(c => c.column_name));

        // ✅ 9. Batch INSERT with ON DUPLICATE KEY UPDATE
        const batchSize = 100;
        let processedCount = 0;

        for (let i = 0; i < pgData.length; i += batchSize) {
          const batch = pgData.slice(i, i + batchSize);
          const placeholders = batch.map(() => 
            `(${colNamesPlain.map(() => '?').join(', ')})`
          ).join(', ');
          
          const values = [];
          for (const row of batch) {
            for (const col of colNamesPlain) {
              let val = row[col];

              // 🔒 Safe Cast: Numeric (skip id, let MySQL AUTO_INCREMENT handle)
              if (numCols.has(col) && col.toLowerCase() !== 'id') {
                if (val === null || val === undefined || val === '') val = null;
                else {
                  const num = Number(val);
                  val = isNaN(num) ? null : num;
                }
              }
              // 🔒 Safe Cast: Boolean → 0/1
              if (boolCols.has(col)) {
                val = (val === true || val === 1 || val === 't' || val === 'true') ? 1 : 0;
              }
              // 🔒 Safe Cast: Date/Timestamp → MySQL format
              if (dateCols.has(col)) {
                if (val === null || val === undefined) val = null;
                else {
                  const d = new Date(val);
                  val = isNaN(d.getTime()) ? null : d.toISOString().replace('T', ' ').split('.')[0];
                }
              }
              // 🔒 Safe Cast: JSONB → JSON string
              if (typeof val === 'object' && val !== null && !Array.isArray(val) && !dateCols.has(col)) {
                try {
                  val = JSON.stringify(val);
                } catch (e) {
                  val = null;
                }
              }
              
              values.push(val);
            }
          }

          // ✅ MySQL UPSERT: ON DUPLICATE KEY UPDATE
          const updateCols = colNamesPlain.filter(col => col.toLowerCase() !== 'id');
          const updateClause = updateCols
            .map(col => `\`${col}\` = VALUES(\`${col}\`)`)
            .join(', ');

          const query = `
            INSERT INTO \`${tableName}\` (${mysqlColNames}) 
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE ${updateClause}
          `.trim().replace(/\s+/g, ' ');

          try {
            await mysqlPool.query(query, values);
            processedCount += batch.length;
          } catch (mysqlErr) {
            if (mysqlErr.code === 'ER_DUP_ENTRY') {
              console.log(`   ⚠️ ${tableName}: Skip duplicate`);
            } else {
              console.error(`   ❌ Insert error ${tableName}:`, mysqlErr.message.slice(0, 200));
            }
          }
        }
        
        console.log(`   ✅ Sync selesai: ${processedCount}/${pgData.length} baris.`);

      } catch (err) {
        console.error(`   ❌ Gagal ${tableName}: ${err.message}`);
        // Continue with next table instead of stopping entire migration
      }
    }

    // ✅ 10. SKIP sequence reset - MySQL handles AUTO_INCREMENT automatically
    console.log('\n⏭️ Skip sequence reset (MySQL AUTO_INCREMENT handles automatically)');

    // ✅ 11. Verifikasi migrasi
    console.log('\n🔍 Verifikasi Data...');
    for (const locTable of LOCATION_TABLES) {
      try {
        const [count] = await mysqlPool.query(`SELECT COUNT(*) as cnt FROM \`${locTable}\``);
        const [sample] = await mysqlPool.query(`SELECT id, name FROM \`${locTable}\` LIMIT 3`);
        console.log(`   ✅ ${locTable}: ${count[0].cnt} rows, sample:`, sample[0]);
      } catch (e) {
        console.log(`   ⚠️ ${locTable}: ${e.message}`);
      }
    }

    console.log('\n🎉 MIGRASI PostgreSQL → MySQL SELESAI!');
    console.log('💡 Tips:');
    console.log('   - Cek foreign keys: MySQL perlu deklarasi eksplisit');
    console.log('   - Location tables: kolom "code" tidak di-migrasi (PostgreSQL-specific)');
    console.log('   - Boolean: TRUE/FALSE → 1/0');
    console.log('   - JSONB: sudah di-convert ke JSON string');
    console.log('   - Timestamp: sudah di-convert ke MySQL TIMESTAMP format');

  } catch (err) {
    console.error('❌ Fatal Error:', err.message);
    console.error(err.stack);
  } finally {
    await pgPool.end();
    await mysqlPool.end();
    console.log('\n🔌 Database connections closed.');
  }
}

// ✅ Run migration
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };