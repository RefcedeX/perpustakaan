-- ==============================================================================
-- DATABASE: perpustakaan_digital
-- APLIKASI: BACA GEH! (Sistem Informasi Perpustakaan Digital)
-- RDBMS   : MariaDB / MySQL (XAMPP Localhost Port 3306)
-- FITUR   : Multi-Role RBAC (Master, Pimpinan, Admin, Tamu), Real-time CRUD & Verifikasi
-- ==============================================================================
CREATE DATABASE
IF NOT EXISTS `perpustakaan_digital` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    USE `perpustakaan_digital`;
    -- Reset tabel secara aman
    SET FOREIGN_KEY_CHECKS = 0;
    DROP VIEW IF EXISTS `v_dashboard_stats`;
    DROP VIEW IF EXISTS `v_pengajuan_pending`;
    DROP VIEW IF EXISTS `v_peminjaman_aktif`;
    DROP VIEW IF EXISTS `v_riwayat_pengembalian`;
    DROP VIEW IF EXISTS `v_data_anggota`;
    DROP TABLE IF EXISTS `peminjaman`;
    DROP TABLE IF EXISTS `buku`;
    DROP TABLE IF EXISTS `users`; SET FOREIGN_KEY_CHECKS = 1;
    -- ==============================================================================
    -- 1. TABEL USERS & MULTI-ROLE ACCESS CONTROL
    -- Roles:
    -- - 'master'   : Hak akses tertinggi (akses semua modul & manajemen pengguna)
    -- - 'pimpinan' : Pemantauan eksekutif (dashboard statistik & laporan peminjaman)
    -- - 'admin'    : Penanggung jawab (kelola buku, verifikasi pinjam, pengembalian, anggota)
    -- - 'tamu'     : Masyarakat / Pengguna (katalog, pengajuan pinjaman, status pengajuan)
    -- ==============================================================================
    CREATE TABLE `users`
        (
            `id`           INT AUTO_INCREMENT PRIMARY KEY                             ,
            `username`     VARCHAR(50) NOT NULL UNIQUE                                ,
            `password`     VARCHAR(255) NOT NULL                                      ,
            `nama_lengkap` VARCHAR(100) NOT NULL                                      ,
            `role` ENUM('master', 'pimpinan', 'admin', 'tamu') NOT NULL DEFAULT 'tamu',
            `email`      VARCHAR(100) NULL                                            ,
            `telepon`    VARCHAR(20) NULL                                             ,
            `is_deleted` TINYINT(1) NOT NULL DEFAULT 0                                ,
            `deleted_at` DATETIME NULL                                                ,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP                          ,
            INDEX `idx_users_is_deleted` (`is_deleted`)                               ,
            INDEX `idx_users_role` (`role`)
        )
    ENGINE=InnoDB;
    -- ==============================================================================
    -- 2. TABEL BUKU
    -- ==============================================================================
    CREATE TABLE `buku`
        (
            `id`         INT AUTO_INCREMENT PRIMARY KEY                ,
            `judul`      VARCHAR(255) NOT NULL                         ,
            `penulis`    VARCHAR(150) NOT NULL                         ,
            `isbn`       VARCHAR(35) NOT NULL UNIQUE                   ,
            `stok`       INT NOT NULL DEFAULT 1 CHECK (`stok`     >= 0),
            `dipinjam`   INT NOT NULL DEFAULT 0 CHECK (`dipinjam` >= 0),
            `is_deleted` TINYINT(1) NOT NULL DEFAULT 0                 ,
            `deleted_at` DATETIME NULL                                 ,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP           ,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON
            UPDATE
                CURRENT_TIMESTAMP
                ,
                INDEX `idx_judul` (`judul`)
                ,
                INDEX `idx_penulis` (`penulis`)
                ,
                INDEX `idx_isbn` (`isbn`)
                ,
                INDEX `idx_buku_is_deleted` (`is_deleted`) ) ENGINE=InnoDB;
    -- ==============================================================================
    -- 3. TABEL PEMINJAMAN & VERIFIKASI DUA ARAH
    -- Status alur peminjaman:
    -- - 'pending'   : Pengajuan dikirim masyarakat, menunggu verifikasi penanggung jawab
    -- - 'active'    : Diverifikasi/disetujui admin, buku sedang dipinjam
    -- - 'rejected'  : Pengajuan ditolak admin (stok otomatis dipulihkan)
    -- - 'completed' : Pengembalian buku telah diproses oleh admin
    -- - 'overdue'   : Melewati tanggal jatuh tempo
    -- ==============================================================================
    CREATE TABLE `peminjaman`
        (
            `id`                  INT AUTO_INCREMENT PRIMARY KEY                                             ,
            `buku_id`             INT NOT NULL                                                               ,
            `nama_peminjam`       VARCHAR(100) NOT NULL                                                      ,
            `user_id`             INT NULL COMMENT 'ID akun peminjam (masyarakat)'                           ,
            `tanggal_pinjam`      DATE NOT NULL                                                              ,
            `tanggal_jatuh_tempo` DATE NOT NULL                                                              ,
            `tanggal_kembali`     DATE NULL                                                                  ,
            `status` ENUM('pending', 'active', 'rejected', 'completed', 'overdue') NOT NULL DEFAULT 'pending',
            `catatan_admin` VARCHAR(255) NULL                                                                ,
            `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                              ,
            `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON
            UPDATE
                CURRENT_TIMESTAMP
                ,
                CONSTRAINT `fk_peminjaman_buku` FOREIGN KEY (`buku_id`) REFERENCES `buku`(`id`) ON
            DELETE
                RESTRICT ON
            UPDATE
                CASCADE
                ,
                CONSTRAINT `fk_peminjaman_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON
            DELETE
            SET
                NULL ON
            UPDATE
                CASCADE
                ,
                INDEX `idx_status` (`status`)
                ,
                INDEX `idx_nama_peminjam` (`nama_peminjam`) ) ENGINE=InnoDB;
    -- ==============================================================================
    -- SEED DATA: AKUN DEFAULT RESMI (MASTER & ADMIN)
    -- Password Default (Bcrypt Hash Valid):
    -- - master   : master123
    -- - admin    : admin123
    -- ==============================================================================
    INSERT INTO `users`
        (
            `id`          ,
            `username`    ,
            `password`    ,
            `nama_lengkap`,
            `role`        ,
            `email`       ,
            `telepon`     ,
            `is_deleted`
        )
    VALUES
        (
            1                                                             ,
            'master'                                                      ,
            '$2y$12$e9GkRVJ2KzAUt6Qe17p3JueNHT3scmGG8Yobdrzb2o.Sw7ohucy4m',
            'Master Administrator'                                        ,
            'master'                                                      ,
            'master@bacageh.id'                                           ,
            '081100000001'                                                ,
            0
        )
        ,
        (
            3                                                             ,
            'admin'                                                       ,
            '$2y$12$tFZVBXFXyExeJaloZXTKeu2OYG3BsI/RGv3r.XuEu.DBWokAlgRIW',
            'Siti Aminah, S.Kom (Penanggung Jawab)'                       ,
            'admin'                                                       ,
            'admin@bacageh.id'                                            ,
            '081234567890'                                                ,
            0
        )
    ;
    -- ==============================================================================
    -- SEED DATA: 10 JUDUL BUKU ASLI (BACA GEH!)
    -- ==============================================================================
    INSERT INTO `buku`
        (
            `id`      ,
            `judul`   ,
            `penulis` ,
            `isbn`    ,
            `stok`    ,
            `dipinjam`,
            `is_deleted`
        )
    VALUES
        (
            1                  ,
            'Laskar Pelangi'   ,
            'Andrea Hirata'    ,
            '978-979-3062-92-9',
            2                  ,
            1                  ,
            0
        )
        ,
        (
            2                      ,
            'Bumi Manusia'         ,
            'Pramoedya Ananta Toer',
            '978-979-461-046-8'    ,
            2                      ,
            0                      ,
            0
        )
        ,
        (
            3                  ,
            'Perahu Kertas'    ,
            'Dee Lestari'      ,
            '978-979-1227-67-8',
            3                  ,
            1                  ,
            0
        )
        ,
        (
            4                  ,
            'Sang Pemimpi'     ,
            'Andrea Hirata'    ,
            '978-979-3062-96-7',
            3                  ,
            0                  ,
            0
        )
        ,
        (
            5                     ,
            'Ronggeng Dukuh Paruk',
            'Ahmad Tohari'        ,
            '978-979-461-392-6'   ,
            2                     ,
            0                     ,
            0
        )
        ,
        (
            6                  ,
            'Negeri 5 Menara'  ,
            'Ahmad Fuadi'      ,
            '978-979-22-4861-6',
            5                  ,
            0                  ,
            0
        )
        ,
        (
            7                  ,
            'Cantik Itu Luka'  ,
            'Eka Kurniawan'    ,
            '978-602-03-1258-3',
            3                  ,
            0                  ,
            0
        )
        ,
        (
            8                  ,
            'Hujan'            ,
            'Tere Liye'        ,
            '978-602-03-2478-4',
            3                  ,
            1                  ,
            0
        )
        ,
        (
            9                  ,
            'Pulang'           ,
            'Leila S. Chudori' ,
            '978-979-91-0515-8',
            2                  ,
            0                  ,
            0
        )
        ,
        (
            10                 ,
            'Filosofi Kopi'    ,
            'Dee Lestari'      ,
            '978-979-96257-3-1',
            3                  ,
            0                  ,
            0
        )
    ;
    -- ==============================================================================
    -- SEED DATA: PEMINJAMAN DENGAN BERBAGAI STATUS
    -- ==============================================================================
    INSERT INTO `peminjaman`
        (
            `id`                 ,
            `buku_id`            ,
            `nama_peminjam`      ,
            `user_id`            ,
            `tanggal_pinjam`     ,
            `tanggal_jatuh_tempo`,
            `tanggal_kembali`    ,
            `status`             ,
            `catatan_admin`
        )
    VALUES
        (
            1                          ,
            1                          ,
            'Budi Santoso (Masyarakat)',
            4                          ,
            CURDATE() - INTERVAL 4 DAY ,
            CURDATE() + INTERVAL 7 DAY ,
            NULL                       ,
            'active'                   ,
            'Disetujui admin'
        )
        ,
        (
            1                          ,
            1                          ,
            'Budi Santoso (Masyarakat)',
            NULL                       ,
            CURDATE() - INTERVAL 4 DAY ,
            CURDATE() + INTERVAL 7 DAY ,
            NULL                       ,
            'active'                   ,
            'Disetujui admin'
        )
        ,
        (
            2                         ,
            3                         ,
            'Siti Rahayu'             ,
            NULL                      ,
            CURDATE() - INTERVAL 3 DAY,
            CURDATE() + INTERVAL 7 DAY,
            NULL                      ,
            'active'                  ,
            'Disetujui admin'
        )
        ,
        (
            3                         ,
            8                         ,
            'Ahmad Fauzi'             ,
            NULL                      ,
            CURDATE()                 ,
            CURDATE() + INTERVAL 7 DAY,
            NULL                      ,
            'pending'                 ,
            'Menunggu verifikasi admin'
        )
        ,
        (
            4                          ,
            2                          ,
            'Rina Marlina'             ,
            NULL                       ,
            CURDATE() - INTERVAL 15 DAY,
            CURDATE() - INTERVAL 8 DAY ,
            CURDATE() - INTERVAL 7 DAY ,
            'completed'                ,
            'Buku dikembalikan dalam kondisi baik'
        )
    ;
    -- ==============================================================================
    -- DATABASE VIEWS
    -- ==============================================================================
    -- 1. View Ringkasan Statistik Dashboard
    CREATE OR REPLACE VIEW `v_dashboard_stats`
    AS
    SELECT
        (
            SELECT
                COALESCE(SUM(stok), 0)
            FROM
                buku
            WHERE
                is_deleted = 0)                  AS total_buku
        ,
        (
            SELECT
                COUNT(*)
            FROM
                peminjaman
            WHERE
                status = 'active')               AS total_dipinjam
        ,
        (
            SELECT
                COUNT(*)
            FROM
                peminjaman
            WHERE
                status = 'pending')              AS total_pending
        ,
        (
            SELECT
                COUNT(*)
            FROM
                peminjaman
            WHERE
                status              = 'active'
            AND tanggal_jatuh_tempo < CURDATE()) AS total_jatuh_tempo
        ,
        (
            SELECT
                COUNT(DISTINCT nama_peminjam)
            FROM
                peminjaman
            WHERE
                status = 'active')               AS peminjam_aktif
        ,
        (
            SELECT
                COUNT(*)
            FROM
                users
            WHERE
                role       = 'tamu'
            AND is_deleted = 0)                  AS total_anggota;
    -- 2. View Pengajuan Menunggu Verifikasi (Pending)
    CREATE OR REPLACE VIEW `v_pengajuan_pending`
    AS
    SELECT
        p.id
        ,
        p.buku_id
        ,
        b.judul      AS judul_buku
        ,
        b.penulis
        ,
        b.isbn
        ,
        p.nama_peminjam
        ,
        p.user_id
        ,
        p.tanggal_pinjam
        ,
        p.tanggal_jatuh_tempo
        ,
        p.status
        ,
        p.created_at AS waktu_pengajuan
    FROM
        peminjaman p
    JOIN
        buku b
    ON
        p.buku_id = b.id
    WHERE
        p.status = 'pending'
    ORDER BY
        p.id ASC;
    -- 3. View Peminjaman Aktif & Overdue
    CREATE OR REPLACE VIEW `v_peminjaman_aktif`
    AS
    SELECT
        p.id
        ,
        p.buku_id
        ,
        b.judul                                    AS judul_buku
        ,
        b.penulis
        ,
        b.isbn
        ,
        p.nama_peminjam
        ,
        p.user_id
        ,
        p.tanggal_pinjam
        ,
        p.tanggal_jatuh_tempo
        ,
        CASE
            WHEN
                p.tanggal_jatuh_tempo < CURDATE()
            THEN 'overdue'
            ELSE 'active'
        END                                        AS status_tempo
        ,
        DATEDIFF(CURDATE(), p.tanggal_jatuh_tempo) AS hari_terlambat
    FROM
        peminjaman p
    JOIN
        buku b
    ON
        p.buku_id = b.id
    WHERE
        p.status = 'active'
    ORDER BY
        p.tanggal_jatuh_tempo ASC;
    -- 4. View Riwayat Pengembalian & Laporan
    CREATE OR REPLACE VIEW `v_riwayat_pengembalian`
    AS
    SELECT
        p.id
        ,
        p.buku_id
        ,
        b.judul AS judul_buku
        ,
        b.penulis
        ,
        b.isbn
        ,
        p.nama_peminjam
        ,
        p.tanggal_pinjam
        ,
        p.tanggal_jatuh_tempo
        ,
        p.tanggal_kembali
        ,
        p.status
        ,
        p.catatan_admin
    FROM
        peminjaman p
    JOIN
        buku b
    ON
        p.buku_id = b.id
    ORDER BY
        p.id DESC;
    -- 5. View Data Masyarakat / Anggota Terdaftar
    CREATE OR REPLACE VIEW `v_data_anggota`
    AS
    SELECT
        u.id
        ,
        u.username
        ,
        u.nama_lengkap
        ,
        u.email
        ,
        u.telepon
        ,
        u.created_at
        ,
        (
            SELECT
                COUNT(*)
            FROM
                peminjaman p
            WHERE
                p.user_id = u.id)     AS total_riwayat_pinjam
        ,
        (
            SELECT
                COUNT(*)
            FROM
                peminjaman p
            WHERE
                p.user_id = u.id
            AND p.status  = 'active') AS pinjaman_aktif
    FROM
        users u
    WHERE
        u.role       = 'tamu'
    AND u.is_deleted = 0
    ORDER BY
        u.id DESC;