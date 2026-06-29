// src/lib/populate-wilayah.ts
import mysql from 'mysql2/promise';
import 'dotenv/config';

// Konfigurasi koneksi database
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommerce_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Ambil API Key dari environment
const API_CO_ID_KEY = process.env.API_CO_ID_KEY;

if (!API_CO_ID_KEY) {
  console.error('API_CO_ID_KEY tidak ditemukan di environment variables.');
  process.exit(1);
}

// Fungsi untuk mengambil data dari API
const fetchData = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'x-api-co-id': API_CO_ID_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} - ${await response.text()}`);
  }

  return response.json();
};

// Fungsi untuk menyimpan data ke database
const saveData = async (tableName: string, columns: string[], data: any[]) => {
  if (data.length === 0) return;

  const placeholders = data.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
  const sql = `INSERT IGNORE INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders}`;

  const values = data.flatMap(item => columns.map(col => item[col]));

  const connection = await pool.getConnection();
  try {
    await connection.execute(sql, values);
  } finally {
    connection.release();
  }
};

// Fungsi utama untuk populate data
const populateWilayah = async () => {
  console.log('Memulai pengambilan data wilayah...');

  try {
    // 1. Ambil Provinces
    console.log('Mengambil data provinces...');
    const provincesUrl = 'https://use.api.co.id/expedition/provinces';
    const provincesData = await fetchData(provincesUrl);

    if (!provincesData.is_success || !Array.isArray(provincesData.data)) {
      throw new Error('Gagal mengambil data provinces');
    }

    const provinces = provincesData.data.map((p: any) => ({
      id: p.province_code,
      name: p.province_name,
    }));

    await saveData('provinces', ['id', 'name'], provinces);
    console.log(`Berhasil menyimpan ${provinces.length} provinces.`);

    // 2. Ambil Regencies untuk setiap Province
    for (const prov of provinces) {
      console.log(`Mengambil data regencies untuk province ${prov.name}...`);
      const regenciesUrl = `https://use.api.co.id/expedition/provinces/${prov.id}/regencies`;
      const regenciesData = await fetchData(regenciesUrl);

      if (!regenciesData.is_success || !Array.isArray(regenciesData.data)) {
        console.warn(`Tidak ada regencies untuk province ${prov.id}, melanjutkan...`);
        continue;
      }

      const regencies = regenciesData.data.map((r: any) => ({
        id: r.regency_code,
        name: r.regency_name,
        province_id: prov.id,
      }));

      await saveData('regencies', ['id', 'name', 'province_id'], regencies);
      console.log(`  - Berhasil menyimpan ${regencies.length} regencies.`);

      // 3. Ambil Districts untuk setiap Regency
      for (const reg of regencies) {
        console.log(`    Mengambil data districts untuk regency ${reg.name}...`);
        const districtsUrl = `https://use.api.co.id/expedition/regencies/${reg.id}/districts`;
        const districtsData = await fetchData(districtsUrl);

        if (!districtsData.is_success || !Array.isArray(districtsData.data)) {
          console.warn(`    Tidak ada districts untuk regency ${reg.id}, melanjutkan...`);
          continue;
        }

        const districts = districtsData.data.map((d: any) => ({
          id: d.district_code,
          name: d.district_name,
          regency_id: reg.id,
        }));

        await saveData('districts', ['id', 'name', 'regency_id'], districts);
        console.log(`      - Berhasil menyimpan ${districts.length} districts.`);

        // 4. Ambil Villages untuk setiap District
        for (const dist of districts) {
          console.log(`      Mengambil data villages untuk district ${dist.name}...`);
          const villagesUrl = `https://use.api.co.id/expedition/districts/${dist.id}/villages`;
          const villagesData = await fetchData(villagesUrl);

          if (!villagesData.is_success || !Array.isArray(villagesData.data)) {
            console.warn(`      Tidak ada villages untuk district ${dist.id}, melanjutkan...`);
            continue;
          }

          const villages = villagesData.data.map((v: any) => ({
            id: v.village_code,
            name: v.village_name,
            district_id: dist.id,
          }));

          await saveData('villages', ['id', 'name', 'district_id'], villages);
          console.log(`        - Berhasil menyimpan ${villages.length} villages.`);
        }
      }
    }

    console.log('Selesai mengisi data wilayah.');
  } catch (err: any) {
    console.error('Error saat mengisi data wilayah:', err);
  } finally {
    await pool.end();
  }
};

// Jalankan script
populateWilayah();