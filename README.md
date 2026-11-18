# 📚 BACA GEH! - Sistem Informasi Perpustakaan Digital

Aplikasi web modern perpustakaan digital berbasis **PHP (Native PDO)**, **MariaDB/MySQL**, dan **Vanilla Modern JS** dengan keamanan kriptografis *Bcrypt*, proteksi data *Soft Delete*, paginasi *server-side*, dialog responsif *SweetAlert2*, dan sistem ikon vektor *SVG*.

---

## 🚀 Panduan Instalasi & Menjalankan di Laptop Lain

Jika Anda menyalin (*copy*) folder proyek ini ke komputer/laptop lain, **database tidak otomatis tersambung** karena data database MariaDB/MySQL tersimpan di sistem servis XAMPP lokal, bukan di dalam folder file web.

Ikuti **5 langkah mudah** di bawah ini untuk menjalankannya di laptop baru:

### Langkah 1: Persiapan Software
Pastikan laptop baru sudah menginstal **XAMPP** (disarankan versi PHP 8.0 ke atas).
1. Buka aplikasi **XAMPP Control Panel**.
2. Klik tombol **Start** pada modul **Apache**.
3. Klik tombol **Start** pada modul **MySQL**.

### Langkah 2: Salin Folder Proyek
Salin seluruh folder ini ke direktori web server XAMPP:
```text
C:\xampp\htdocs\perpustakaan
```
*(Catatan: Anda dapat menamai foldernya `perpustakaan` agar URL aplikasinya menjadi `http://localhost/perpustakaan/`)*.

### Langkah 3: Import Database (database.sql)
1. Buka browser dan akses phpMyAdmin:
   ```text
   http://localhost/phpmyadmin/
   ```
2. Pada panel navigasi sebelah kiri, klik **Baru (New)**.
3. Masukkan nama basis data:
   ```text
   perpustakaan_digital
   ```
   Lalu klik tombol **Buat (Create)**.
4. Klik database `perpustakaan_digital` yang baru dibuat, lalu pilih tab **Impor (Import)** di menu atas.
5. Klik **Choose File** / **Pilih Berkas**, lalu arahkan ke file:
   ```text
   C:\xampp\htdocs\perpustakaan\database.sql
   ```
6. Gulir ke bawah dan klik tombol **Impor (Import)**.
7. Tunggu beberapa detik hingga muncul pesan sukses berwarna hijau.

### Langkah 4: Buka Aplikasi di Browser
Buka peramban (Chrome, Edge, Firefox) dan buka URL:
```text
http://localhost/perpustakaan/
```
*(Jika Anda menggunakan ekstensi Live Server / Five Server di VS Code pada port `5500`, aplikasi juga secara otomatis mendeteksi koneksi ke backend Apache)*.

---

## 🔐 Kredensial Akun Bawaan Sistem

Hanya 2 akun utama resmi yang tersedia:

| Peran (Role) | Username | Password | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **Master Administrator** | `master` | `master123` | Akses penuh: manajemen koleksi buku, riwayat transaksi, verifikasi peminjaman, dan membuat/mengelola seluruh akun (`pimpinan`, `admin`, `tamu`). |
| **Penanggung Jawab (Admin)** | `admin` | `admin123` | Manajemen buku, verifikasi pengajuan pinjaman, pemrosesan pengembalian buku fisik, dan membuat akun staf/masyarakat. |

> **Catatan:** Seluruh pengguna selain `master` dan `admin` telah dibersihkan. Akun masyarakat (`tamu`) dan akun pimpinan baru dapat didaftarkan langsung oleh `master` atau `admin` melalui tab menu **Kelola Pengguna** di dalam dashboard.

---

## 🛠️ Informasi Konfigurasi Database (`api.php`)

Jika konfigurasi MySQL di laptop baru Anda menggunakan password root yang berbeda, sesuaikan baris koneksi di file `api.php`:
```php
$dbHost = 'localhost';
$dbName = 'perpustakaan_digital';
$dbUser = 'root';
$dbPass = ''; // Kosongkan jika default XAMPP, atau isi jika ada password
$dbPort = '3306';
```

---

## 📂 Struktur Berkas Utama

- `index.html` : Struktur antarmuka web, modal dialog, formulir peminjaman, dan container dashboard.
- `style.css` : Desain antarmuka modern, layout responsif, animasi modal, dan kelas status SVG.
- `script.js` : Logika frontend, state management, controller SweetAlert2, registry SVG, dan routing role.
- `api.php` : Backend RESTful API berbasis PHP PDO, otentikasi Bcrypt murni, validasi input, soft delete, dan paginasi database.
- `database.sql` : Skema tabel database, indeks, foreign keys, views ringkasan statistik, dan seed data resmi.
