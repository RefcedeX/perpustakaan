<?php
/**
 * API Backend RESTful untuk BACA GEH!
 * Sistem Informasi Perpustakaan Digital Berbasis MariaDB/MySQL (XAMPP)
 * Mode Produksi: Manajemen Pengguna Terpusat (Master & Admin)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Konfigurasi Database XAMPP
$host = '127.0.0.1';
$db   = 'perpustakaan_digital';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Gagal koneksi ke database MariaDB: ' . $e->getMessage()
    ]);
    exit;
}

// Ambil input JSON atau POST
$rawInput = file_get_contents('php://input');
$jsonInput = json_decode($rawInput, true);
$input = is_array($jsonInput) ? $jsonInput : $_POST;
$action = $_GET['action'] ?? $input['action'] ?? '';

// Helper label role
function getRoleLabel($role) {
    switch ($role) {
        case 'master':   return 'Master Administrator';
        case 'pimpinan': return 'Kepala Perpustakaan (Pimpinan)';
        case 'admin':    return 'Penanggung Jawab (Admin)';
        case 'tamu':     return 'Masyarakat / Pengguna';
        default:         return ucfirst($role);
    }
}

try {
    switch ($action) {
        // ==================== 1. AUTH: LOGIN (100% BCRYPT VERIFY, ZERO BACKDOOR) ====================
        case 'login':
            $username = trim($input['username'] ?? '');
            $password = trim($input['password'] ?? '');

            if (!$username || !$password) {
                echo json_encode(['success' => false, 'message' => 'Username dan kata sandi wajib diisi!']);
                exit;
            }

            $stmt = $pdo->prepare("
                SELECT id, username, password, nama_lengkap, role 
                FROM users 
                WHERE username = ? AND is_deleted = 0 
                LIMIT 1
            ");
            $stmt->execute([$username]);
            $userData = $stmt->fetch();

            if ($userData) {
                // Keamanan Produksi: Verifikasi hash kriptografis murni tanpa bypass password mentah
                $passwordMatch = password_verify($password, $userData['password']);

                if ($passwordMatch) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Login berhasil! Selamat datang di BACA GEH!',
                        'user' => [
                            'id'        => (int)$userData['id'],
                            'username'  => $userData['username'],
                            'fullName'  => $userData['nama_lengkap'],
                            'role'      => $userData['role'],
                            'roleLabel' => getRoleLabel($userData['role'])
                        ]
                    ]);
                    exit;
                }
            }

            echo json_encode(['success' => false, 'message' => 'Username atau kata sandi salah!']);
            break;

        // ==================== 2. KELOLA PENGGUNA: BUAT AKUN BARU (MASTER & ADMIN) ====================
        case 'create_user':
        case 'register':
            $creatorRole = trim($input['creator_role'] ?? '');
            $namaLengkap = trim($input['nama_lengkap'] ?? '');
            $username    = trim($input['username'] ?? '');
            $password    = trim($input['password'] ?? '');
            $role        = trim($input['role'] ?? 'tamu');
            $email       = trim($input['email'] ?? '');
            $telepon     = trim($input['telepon'] ?? '');

            // Validasi otorisasi pembuatan akun
            if (!in_array($creatorRole, ['master', 'admin'])) {
                echo json_encode(['success' => false, 'message' => 'Pembuatan akun hanya dapat dilakukan melalui dashboard oleh Master atau Admin!']);
                exit;
            }

            if (!$namaLengkap || !$username || !$password) {
                echo json_encode(['success' => false, 'message' => 'Nama lengkap, username, dan kata sandi wajib diisi!']);
                exit;
            }

            // Pembatasan hierarki peran
            if ($creatorRole === 'admin') {
                if (in_array($role, ['master', 'pimpinan'])) {
                    echo json_encode(['success' => false, 'message' => 'Admin hanya dapat membuat akun Masyarakat atau staf Admin!']);
                    exit;
                }
            }

            if (!in_array($role, ['pimpinan', 'admin', 'tamu'])) {
                $role = 'tamu';
            }

            // Cek apakah username sudah ada di akun aktif
            $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND is_deleted = 0 LIMIT 1");
            $checkStmt->execute([$username]);
            if ($checkStmt->fetch()) {
                echo json_encode(['success' => false, 'message' => "Username \"$username\" sudah digunakan! Silakan gunakan username lain."]);
                exit;
            }

            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            $insertUser = $pdo->prepare("
                INSERT INTO users (username, password, nama_lengkap, role, email, telepon, is_deleted)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            ");
            $insertUser->execute([$username, $hashedPassword, $namaLengkap, $role, $email, $telepon]);

            echo json_encode([
                'success' => true,
                'message' => "Akun untuk \"$namaLengkap\" sebagai " . getRoleLabel($role) . " berhasil dibuat!"
            ]);
            break;

        // ==================== 3. KELOLA PENGGUNA: AMBIL SEMUA PENGGUNA (PAGINATED) ====================
        case 'get_all_users':
        case 'get_members':
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limitParam = $_GET['limit'] ?? '6';
            $limit = ($limitParam === 'all' || $limitParam === '0') ? 0 : max(1, (int)$limitParam);
            $search = trim($_GET['search'] ?? '');
            $roleFilter = trim($_GET['role'] ?? '');

            $baseWhere = "WHERE u.is_deleted = 0";
            $params = [];

            if ($search !== '') {
                $baseWhere .= " AND (u.nama_lengkap LIKE ? OR u.username LIKE ? OR u.email LIKE ?)";
                $param = "%$search%";
                $params[] = $param;
                $params[] = $param;
                $params[] = $param;
            }

            if ($roleFilter !== '' && $roleFilter !== 'all') {
                $baseWhere .= " AND u.role = ?";
                $params[] = $roleFilter;
            }

            // Hitung total records aktif
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM users u $baseWhere");
            $countStmt->execute($params);
            $totalRecords = (int)$countStmt->fetchColumn();

            $query = "
                SELECT 
                    u.id, 
                    u.username, 
                    u.nama_lengkap, 
                    u.role, 
                    u.email, 
                    u.telepon, 
                    u.created_at,
                    (SELECT COUNT(*) FROM peminjaman p WHERE p.user_id = u.id) AS total_pinjam,
                    (SELECT COUNT(*) FROM peminjaman p WHERE p.user_id = u.id AND p.status = 'active') AS pinjaman_aktif,
                    (SELECT COUNT(*) FROM peminjaman p WHERE p.user_id = u.id AND p.status = 'pending') AS pinjaman_pending
                FROM users u
                $baseWhere
                ORDER BY FIELD(u.role, 'master', 'pimpinan', 'admin', 'tamu'), u.id DESC
            ";

            if ($limit > 0) {
                $offset = ($page - 1) * $limit;
                $query .= " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
            }

            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $users = $stmt->fetchAll();

            foreach ($users as &$u) {
                $u['roleLabel'] = getRoleLabel($u['role']);
            }

            $totalPages = $limit > 0 ? (int)ceil($totalRecords / $limit) : 1;

            echo json_encode([
                'success' => true, 
                'data' => $users,
                'pagination' => [
                    'page'         => $page,
                    'limit'        => $limit,
                    'totalRecords' => $totalRecords,
                    'totalPages'   => max(1, $totalPages),
                    'hasPrev'      => $page > 1,
                    'hasNext'      => $page < $totalPages
                ]
            ]);
            break;

        // ==================== 4. KELOLA PENGGUNA: EDIT / RESET PASSWORD ====================
        case 'update_user':
            $creatorRole = trim($input['creator_role'] ?? '');
            $creatorId   = (int)($input['creator_id'] ?? 0);
            $userId      = (int)($input['user_id'] ?? 0);
            $namaLengkap = trim($input['nama_lengkap'] ?? '');
            $role        = trim($input['role'] ?? '');
            $newPassword = trim($input['new_password'] ?? '');
            $email       = trim($input['email'] ?? '');
            $telepon     = trim($input['telepon'] ?? '');

            if (!in_array($creatorRole, ['master', 'admin'])) {
                echo json_encode(['success' => false, 'message' => 'Anda tidak memiliki hak akses untuk mengedit pengguna!']);
                exit;
            }

            if (!$userId || !$namaLengkap) {
                echo json_encode(['success' => false, 'message' => 'ID pengguna dan nama lengkap wajib diisi!']);
                exit;
            }

            $targetStmt = $pdo->prepare("SELECT id, role, username FROM users WHERE id = ? AND is_deleted = 0");
            $targetStmt->execute([$userId]);
            $targetUser = $targetStmt->fetch();

            if (!$targetUser) {
                echo json_encode(['success' => false, 'message' => 'Data pengguna tidak ditemukan!']);
                exit;
            }

            // Admin tidak boleh mengedit Master atau Pimpinan
            if ($creatorRole === 'admin' && in_array($targetUser['role'], ['master', 'pimpinan'])) {
                echo json_encode(['success' => false, 'message' => 'Admin tidak diizinkan mengubah akun Master atau Pimpinan!']);
                exit;
            }

            // Admin tidak boleh mengubah role target menjadi Master atau Pimpinan
            if ($creatorRole === 'admin' && in_array($role, ['master', 'pimpinan'])) {
                echo json_encode(['success' => false, 'message' => 'Admin tidak diizinkan menetapkan peran Master atau Pimpinan!']);
                exit;
            }

            // Jika Master akun sedang diedit, role harus tetap master
            if ($targetUser['role'] === 'master') {
                $role = 'master';
            }

            if ($newPassword !== '') {
                $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
                $updStmt = $pdo->prepare("
                    UPDATE users 
                    SET nama_lengkap = ?, role = ?, password = ?, email = ?, telepon = ? 
                    WHERE id = ?
                ");
                $updStmt->execute([$namaLengkap, $role, $hashed, $email, $telepon, $userId]);
            } else {
                $updStmt = $pdo->prepare("
                    UPDATE users 
                    SET nama_lengkap = ?, role = ?, email = ?, telepon = ? 
                    WHERE id = ?
                ");
                $updStmt->execute([$namaLengkap, $role, $email, $telepon, $userId]);
            }

            echo json_encode([
                'success' => true,
                'message' => "Data akun \"$namaLengkap\" berhasil diperbarui!"
            ]);
            break;

        // ==================== 5. KELOLA PENGGUNA: SOFT DELETE AKUN ====================
        case 'delete_user':
        case 'delete_member':
            $creatorRole = trim($input['creator_role'] ?? '');
            $creatorId   = (int)($input['creator_id'] ?? 0);
            $userId      = (int)($input['user_id'] ?? $input['memberId'] ?? 0);

            if (!in_array($creatorRole, ['master', 'admin'])) {
                echo json_encode(['success' => false, 'message' => 'Anda tidak memiliki hak akses untuk menghapus akun!']);
                exit;
            }

            if (!$userId) {
                echo json_encode(['success' => false, 'message' => 'ID pengguna tidak valid!']);
                exit;
            }

            if ($userId === $creatorId) {
                echo json_encode(['success' => false, 'message' => 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif!']);
                exit;
            }

            $targetStmt = $pdo->prepare("SELECT id, role, nama_lengkap FROM users WHERE id = ? AND is_deleted = 0");
            $targetStmt->execute([$userId]);
            $target = $targetStmt->fetch();

            if (!$target) {
                echo json_encode(['success' => false, 'message' => 'Pengguna tidak ditemukan!']);
                exit;
            }

            if ($target['role'] === 'master') {
                echo json_encode(['success' => false, 'message' => 'Akun Master Utama tidak dapat dihapus!']);
                exit;
            }

            if ($creatorRole === 'admin' && in_array($target['role'], ['pimpinan', 'master'])) {
                echo json_encode(['success' => false, 'message' => 'Admin tidak memiliki hak akses untuk menghapus akun Pimpinan!']);
                exit;
            }

            // Pastikan tidak ada pinjaman aktif atau pending
            $chkActive = $pdo->prepare("SELECT COUNT(*) FROM peminjaman WHERE user_id = ? AND status IN ('pending', 'active')");
            $chkActive->execute([$userId]);
            if ($chkActive->fetchColumn() > 0) {
                echo json_encode(['success' => false, 'message' => 'Pengguna ini masih memiliki peminjaman aktif atau pengajuan tertunda!']);
                exit;
            }

            // Terapkan Soft Delete: Update is_deleted = 1, deleted_at = NOW()
            $del = $pdo->prepare("UPDATE users SET is_deleted = 1, deleted_at = NOW() WHERE id = ?");
            $del->execute([$userId]);

            echo json_encode([
                'success' => true,
                'message' => "Akun \"{$target['nama_lengkap']}\" berhasil dinonaktifkan (soft deleted) dari sistem BACA GEH!"
            ]);
            break;

        // ==================== 6. DASHBOARD: STATS ====================
        case 'get_dashboard':
            $statsStmt = $pdo->query("SELECT * FROM v_dashboard_stats LIMIT 1");
            $stats = $statsStmt->fetch() ?: [
                'total_buku'        => 0,
                'total_dipinjam'    => 0,
                'total_pending'     => 0,
                'total_jatuh_tempo' => 0,
                'peminjam_aktif'    => 0,
                'total_anggota'     => 0
            ];

            echo json_encode([
                'success' => true,
                'data' => [
                    'totalBooks'     => (int)$stats['total_buku'],
                    'borrowedBooks'  => (int)$stats['total_dipinjam'],
                    'pendingBorrows' => (int)$stats['total_pending'],
                    'pendingReturns' => (int)$stats['total_jatuh_tempo'],
                    'activeUsers'    => (int)$stats['peminjam_aktif'],
                    'totalMembers'   => (int)$stats['total_anggota']
                ]
            ]);
            break;

        // ==================== 7. BUKU: GET ALL / SEARCH (PAGINATED) ====================
        case 'get_books':
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limitParam = $_GET['limit'] ?? '8';
            $limit = ($limitParam === 'all' || $limitParam === '0') ? 0 : max(1, (int)$limitParam);
            $search = trim($_GET['search'] ?? '');

            $baseWhere = "WHERE is_deleted = 0";
            $params = [];

            if ($search !== '') {
                $baseWhere .= " AND (judul LIKE ? OR penulis LIKE ? OR isbn LIKE ?)";
                $param = "%$search%";
                $params[] = $param;
                $params[] = $param;
                $params[] = $param;
            }

            // Hitung total koleksi buku aktif
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM buku $baseWhere");
            $countStmt->execute($params);
            $totalRecords = (int)$countStmt->fetchColumn();

            $query = "
                SELECT id, judul AS title, penulis AS author, isbn, stok AS stock, dipinjam AS borrowed
                FROM buku 
                $baseWhere
                ORDER BY id DESC
            ";

            if ($limit > 0) {
                $offset = ($page - 1) * $limit;
                $query .= " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
            }

            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $books = $stmt->fetchAll();

            $totalPages = $limit > 0 ? (int)ceil($totalRecords / $limit) : 1;

            echo json_encode([
                'success' => true, 
                'data' => $books,
                'pagination' => [
                    'page'         => $page,
                    'limit'        => $limit,
                    'totalRecords' => $totalRecords,
                    'totalPages'   => max(1, $totalPages),
                    'hasPrev'      => $page > 1,
                    'hasNext'      => $page < $totalPages
                ]
            ]);
            break;

        // ==================== 8. BUKU: TAMBAH (CREATE) ====================
        case 'add_book':
            $title  = trim($input['title'] ?? '');
            $author = trim($input['author'] ?? '');
            $isbn   = trim($input['isbn'] ?? '');
            $stock  = (int)($input['stock'] ?? 1);

            if (!$title || !$author || !$isbn) {
                echo json_encode(['success' => false, 'message' => 'Semua kolom judul, penulis, dan ISBN harus diisi!']);
                exit;
            }

            if ($stock < 1) {
                echo json_encode(['success' => false, 'message' => 'Stok buku minimal 1 eksemplar!']);
                exit;
            }

            // Cek ISBN hanya di antara buku-buku yang masih aktif (belum di-soft delete)
            $checkStmt = $pdo->prepare("SELECT id FROM buku WHERE isbn = ? AND is_deleted = 0 LIMIT 1");
            $checkStmt->execute([$isbn]);
            if ($checkStmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Buku dengan nomor ISBN tersebut sudah terdaftar!']);
                exit;
            }

            $insertStmt = $pdo->prepare("
                INSERT INTO buku (judul, penulis, isbn, stok, dipinjam, is_deleted) 
                VALUES (?, ?, ?, ?, 0, 0)
            ");
            $insertStmt->execute([$title, $author, $isbn, $stock]);

            echo json_encode([
                'success' => true,
                'message' => "Buku \"$title\" berhasil ditambahkan ke koleksi BACA GEH!",
                'id' => (int)$pdo->lastInsertId()
            ]);
            break;

        // ==================== 9. BUKU: EDIT (UPDATE) ====================
        case 'update_book':
            $id     = (int)($input['id'] ?? 0);
            $title  = trim($input['title'] ?? '');
            $author = trim($input['author'] ?? '');
            $isbn   = trim($input['isbn'] ?? '');
            $stock  = (int)($input['stock'] ?? 1);

            if (!$id || !$title || !$author || !$isbn) {
                echo json_encode(['success' => false, 'message' => 'ID, judul, penulis, dan ISBN wajib diisi!']);
                exit;
            }

            if ($stock < 0) {
                echo json_encode(['success' => false, 'message' => 'Stok tidak boleh bernilai negatif!']);
                exit;
            }

            $curStmt = $pdo->prepare("SELECT id, dipinjam FROM buku WHERE id = ? AND is_deleted = 0");
            $curStmt->execute([$id]);
            $currentBook = $curStmt->fetch();

            if (!$currentBook) {
                echo json_encode(['success' => false, 'message' => 'Data buku tidak ditemukan!']);
                exit;
            }

            $isbnStmt = $pdo->prepare("SELECT id FROM buku WHERE isbn = ? AND id != ? AND is_deleted = 0 LIMIT 1");
            $isbnStmt->execute([$isbn, $id]);
            if ($isbnStmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Nomor ISBN tersebut sudah digunakan oleh buku lain!']);
                exit;
            }

            $updStmt = $pdo->prepare("
                UPDATE buku 
                SET judul = ?, penulis = ?, isbn = ?, stok = ? 
                WHERE id = ?
            ");
            $updStmt->execute([$title, $author, $isbn, $stock, $id]);

            echo json_encode([
                'success' => true,
                'message' => "Data buku \"$title\" berhasil diperbarui!"
            ]);
            break;

        // ==================== 10. BUKU: SOFT DELETE ====================
        case 'delete_book':
            $id = (int)($input['id'] ?? 0);
            if (!$id) {
                echo json_encode(['success' => false, 'message' => 'ID buku tidak valid!']);
                exit;
            }

            $stmt = $pdo->prepare("SELECT id, judul, dipinjam FROM buku WHERE id = ? AND is_deleted = 0");
            $stmt->execute([$id]);
            $book = $stmt->fetch();

            if (!$book) {
                echo json_encode(['success' => false, 'message' => 'Buku tidak ditemukan!']);
                exit;
            }

            if ((int)$book['dipinjam'] > 0) {
                echo json_encode(['success' => false, 'message' => 'Buku sedang dipinjam oleh pembaca, tidak dapat dihapus!']);
                exit;
            }

            // Terapkan Soft Delete: Update is_deleted = 1, deleted_at = NOW()
            $delStmt = $pdo->prepare("UPDATE buku SET is_deleted = 1, deleted_at = NOW() WHERE id = ?");
            $delStmt->execute([$id]);

            echo json_encode([
                'success' => true,
                'message' => "Buku \"{$book['judul']}\" berhasil dinonaktifkan (soft deleted) dari perpustakaan!"
            ]);
            break;

        // ==================== 11. PEMINJAMAN: PENGAJUAN PINJAM ====================
        case 'borrow_book':
            $bookId     = (int)($input['bookId'] ?? 0);
            $borrower   = trim($input['borrower'] ?? '');
            $borrowDate = trim($input['borrowDate'] ?? date('Y-m-d'));
            $returnDate = trim($input['returnDate'] ?? date('Y-m-d', strtotime('+7 days')));
            $userId     = !empty($input['userId']) ? (int)$input['userId'] : null;

            if (!$bookId || !$borrower) {
                echo json_encode(['success' => false, 'message' => 'Silakan pilih buku dan lengkapi identitas peminjam!']);
                exit;
            }

            // Cek apakah ada pinjaman aktif yang jatuh tempo
            $overdueCheck = $pdo->prepare("
                SELECT COUNT(*) FROM peminjaman 
                WHERE nama_peminjam = ? AND status = 'active' AND tanggal_jatuh_tempo < CURDATE()
            ");
            $overdueCheck->execute([$borrower]);
            if ($overdueCheck->fetchColumn() > 0) {
                echo json_encode(['success' => false, 'message' => 'Anda memiliki buku yang telah jatuh tempo! Harap selesaikan pengembalian terlebih dahulu.']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                $lockStmt = $pdo->prepare("SELECT id, judul, stok FROM buku WHERE id = ? AND is_deleted = 0 FOR UPDATE");
                $lockStmt->execute([$bookId]);
                $book = $lockStmt->fetch();

                if (!$book || (int)$book['stok'] <= 0) {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Maaf, stok buku ini saat ini sedang habis di BACA GEH!']);
                    exit;
                }

                // Booking stok
                $updateBook = $pdo->prepare("UPDATE buku SET stok = stok - 1, dipinjam = dipinjam + 1 WHERE id = ?");
                $updateBook->execute([$bookId]);

                $insertBorrow = $pdo->prepare("
                    INSERT INTO peminjaman (buku_id, nama_peminjam, user_id, tanggal_pinjam, tanggal_jatuh_tempo, status, catatan_admin)
                    VALUES (?, ?, ?, ?, ?, 'pending', 'Menunggu verifikasi admin')
                ");
                $insertBorrow->execute([$bookId, $borrower, $userId, $borrowDate, $returnDate]);

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => "Pengajuan peminjaman buku \"{$book['judul']}\" berhasil dikirim! Silakan tunggu verifikasi dari Admin BACA GEH."
                ]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'message' => 'Gagal memproses pengajuan: ' . $e->getMessage()]);
            }
            break;

        // ==================== 12. VERIFIKASI: GET PENDING ====================
        case 'get_pending_borrows':
            $stmt = $pdo->query("SELECT * FROM v_pengajuan_pending");
            $pendings = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $pendings]);
            break;

        // ==================== 13. VERIFIKASI: SETUJUI / TOLAK ====================
        case 'verify_borrow':
            $borrowId = (int)($input['borrowId'] ?? 0);
            $decision = trim($input['decision'] ?? '');
            $notes    = trim($input['notes'] ?? '');

            if (!$borrowId || !in_array($decision, ['approve', 'reject'])) {
                echo json_encode(['success' => false, 'message' => 'ID peminjaman atau keputusan verifikasi tidak valid!']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                $chkStmt = $pdo->prepare("
                    SELECT p.id, p.buku_id, p.status, p.nama_peminjam, b.judul 
                    FROM peminjaman p 
                    JOIN buku b ON p.buku_id = b.id 
                    WHERE p.id = ? FOR UPDATE
                ");
                $chkStmt->execute([$borrowId]);
                $borrow = $chkStmt->fetch();

                if (!$borrow || $borrow['status'] !== 'pending') {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Pengajuan tidak ditemukan atau sudah diverifikasi sebelumnya!']);
                    exit;
                }

                if ($decision === 'approve') {
                    $catatan = $notes ? $notes : 'Pengajuan disetujui oleh admin';
                    $upd = $pdo->prepare("UPDATE peminjaman SET status = 'active', catatan_admin = ? WHERE id = ?");
                    $upd->execute([$catatan, $borrowId]);
                    $msg = "Pengajuan pinjaman buku \"{$borrow['judul']}\" oleh {$borrow['nama_peminjam']} telah DISETUJUI!";
                } else {
                    $catatan = $notes ? $notes : 'Pengajuan ditolak oleh admin';
                    $upd = $pdo->prepare("UPDATE peminjaman SET status = 'rejected', catatan_admin = ? WHERE id = ?");
                    $upd->execute([$catatan, $borrowId]);

                    $restoreBook = $pdo->prepare("UPDATE buku SET stok = stok + 1, dipinjam = dipinjam - 1 WHERE id = ?");
                    $restoreBook->execute([$borrow['buku_id']]);
                    $msg = "Pengajuan pinjaman buku \"{$borrow['judul']}\" oleh {$borrow['nama_peminjam']} telah DITOLAK (stok buku dipulihkan).";
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => $msg]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'message' => 'Gagal memverifikasi: ' . $e->getMessage()]);
            }
            break;

        // ==================== 14. PEMINJAMAN: GET ACTIVE ====================
        case 'get_active_borrows':
            $stmt = $pdo->query("SELECT * FROM v_peminjaman_aktif");
            $activeBorrows = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $activeBorrows]);
            break;

        // ==================== 15. PENGEMBALIAN BUKU ====================
        case 'return_book':
            $borrowId = (int)($input['borrowId'] ?? 0);
            if (!$borrowId) {
                echo json_encode(['success' => false, 'message' => 'ID peminjaman tidak valid!']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                $chk = $pdo->prepare("
                    SELECT p.id, p.buku_id, p.nama_peminjam, p.status, b.judul 
                    FROM peminjaman p 
                    JOIN buku b ON p.buku_id = b.id 
                    WHERE p.id = ? FOR UPDATE
                ");
                $chk->execute([$borrowId]);
                $borrow = $chk->fetch();

                if (!$borrow || $borrow['status'] !== 'active') {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Transaksi tidak ditemukan atau tidak sedang dalam status aktif!']);
                    exit;
                }

                $updBorrow = $pdo->prepare("
                    UPDATE peminjaman 
                    SET status = 'completed', tanggal_kembali = CURDATE(), catatan_admin = 'Buku telah dikembalikan' 
                    WHERE id = ?
                ");
                $updBorrow->execute([$borrowId]);

                $updBook = $pdo->prepare("
                    UPDATE buku 
                    SET stok = stok + 1, dipinjam = dipinjam - 1 
                    WHERE id = ?
                ");
                $updBook->execute([$borrow['buku_id']]);

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => "Buku \"{$borrow['judul']}\" berhasil diproses pengembaliannya!"
                ]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'message' => 'Gagal memproses pengembalian: ' . $e->getMessage()]);
            }
            break;

        // ==================== 16. RIWAYAT & LAPORAN ====================
        case 'get_history':
            $userId = !empty($_GET['userId']) ? (int)$_GET['userId'] : null;
            if ($userId) {
                $stmt = $pdo->prepare("
                    SELECT * FROM v_riwayat_pengembalian 
                    WHERE user_id = ? OR nama_peminjam = (SELECT nama_lengkap FROM users WHERE id = ?)
                    ORDER BY id DESC
                ");
                $stmt->execute([$userId, $userId]);
            } else {
                $stmt = $pdo->query("SELECT * FROM v_riwayat_pengembalian ORDER BY id DESC");
            }
            $history = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $history]);
            break;

        default:
            echo json_encode([
                'success' => false,
                'message' => 'Aksi API tidak valid: ' . htmlspecialchars($action)
            ]);
            break;
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Terjadi kesalahan server: ' . $e->getMessage()
    ]);
}
