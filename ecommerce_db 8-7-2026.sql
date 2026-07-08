-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 08 Jul 2026 pada 04.59
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ecommerce_db`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL DEFAULT '''''',
  `email` varchar(255) NOT NULL DEFAULT '''''',
  `no_telp` varchar(20) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL DEFAULT '''''',
  `role` varchar(50) NOT NULL DEFAULT '''''''buyer''''''',
  `roles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`roles`)),
  `status` varchar(50) DEFAULT 'aktif',
  `affiliate_status` varchar(50) DEFAULT 'pending',
  `reset_token` text DEFAULT NULL,
  `reset_expires` timestamp NULL DEFAULT NULL,
  `refresh_token` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `no_telp`, `avatar`, `password`, `role`, `roles`, `status`, `affiliate_status`, `reset_token`, `reset_expires`, `refresh_token`, `created_at`, `updated_at`, `email_verified_at`, `remember_token`) VALUES
(1, 'Ilyas', 'mi658672@gmail.com', NULL, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgIYGx33_KHd5c6fBqkWxD6n04J68gzkHVvQ&s', '$2b$10$NgifkJnMW/FrJFgQq4SpSuVOWlWsGIdn0RWRC0VDkDxnRyGWJAfZO', 'admin', NULL, 'active', 'pending', NULL, NULL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IklseWFzIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY0NjMxNzU0LCJleHAiOjE3NjUyMzY1NTR9.jABiB3QGjuo6tDYkcVIMSJ2lsqbh-zJnKm5jx1TxIYs', '2025-10-22 08:30:16', '2026-07-08 01:52:50', NULL, NULL),
(2, 'david', 'david@example.com', NULL, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzI517K3Q_bKvArjG8zwo7D3i2kliiK4y6oQ&s', '$2b$10$tTcPeUqbp4r2M28V3drIXO3N46DXh1VLSQTfnc4b7o1uoM9dtwyvS', 'seller', NULL, 'active', 'pending', NULL, NULL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwibmFtZSI6ImRhdmlkIiwicm9sZSI6InNlbGxlciIsImlhdCI6MTc2NDYzMTQ2OSwiZXhwIjoxNzY1MjM2MjY5fQ.92npS3SccjlwWsiXW4-GGXJrcv6b-XeNTgMCgdp3Wh8', '2025-10-22 13:31:10', '2026-06-16 01:19:39', NULL, NULL),
(3, 'ulil', 'ni443727@gmail.com', NULL, 'https://img.pikbest.com/png-images/20250127/adorable-3d-rendered-cartoon-boy-character-smiling-cute-and-playful-in-yellow-hoodie_11290686.png!sw800', '$2b$10$DLEaWOttt4nbCoAvicTMFefXq0djFNrfKtPVoXuQg8.HL7LbXXAB2', 'buyer', NULL, 'suspended', 'pending', NULL, NULL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywibmFtZSI6InVsaWwiLCJyb2xlIjoiYnV5ZXIiLCJpYXQiOjE3NjM1OTYxOTcsImV4cCI6MTc2MzY4MjU5N30.U-eC4_8fLhnrqAHKWwHNte5hh1UdXZDBgLKA_C0iK50', '2025-10-22 13:38:21', '2026-06-16 02:17:07', NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
