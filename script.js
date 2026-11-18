// ==============================================================================
// APLIKASI: BACA GEH! (Sistem Informasi Perpustakaan Digital)
// JAVASCRIPT UTAMA: Integrasi Real-Time dengan Backend PHP & Database MariaDB
// ==============================================================================

// Deteksi Endpoint API secara cerdas (mendukung port 80 Apache, Five Server port 5500, dll)
function getApiEndpoint() {
    const port = window.location.port;
    if (window.location.protocol === 'file:' || (port && port !== '80' && port !== '443')) {
        return 'http://localhost/perpustakaan/api.php';
    }
    return 'api.php';
}

const API_URL = getApiEndpoint();
let currentUser = null;
let cachedBooks = [];
let cachedUsers = [];
let bookCurrentPage = 1;
let userCurrentPage = 1;

// Matriks Otorisasi Rute Tab (Route-Level RBAC)
const ROLE_ALLOWED_TABS = {
    master:   ['dashboard', 'books', 'borrow', 'verify', 'return', 'members', 'history'],
    admin:    ['dashboard', 'books', 'borrow', 'verify', 'return', 'members', 'history'],
    pimpinan: ['dashboard', 'books', 'history'],
    tamu:     ['dashboard', 'books', 'borrow']
};

// ==================== SVG VECTOR ICON REGISTRY ====================
const ICONS_SVG = {
    'clock': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    'check': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    'check-circle': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    'alert-triangle': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    'book-open': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
    'x-circle': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    'crown': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path></svg>`,
    'shield': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    'user-tie': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M21 21v-2a4 4 0 0 0-3-3.85"></path></svg>`,
    'user': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    'chevron-left': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
    'chevron-right': `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
};

function getSvgIcon(name, customStyle = '') {
    const icon = ICONS_SVG[name];
    if (!icon) return '';
    if (customStyle) {
        return icon.replace('<svg ', `<svg style="${customStyle}" `);
    }
    return icon;
}

// ==================== SWEETALERT2 MODERN NOTIFICATION HELPERS ====================
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

function showToast(icon, title) {
    Toast.fire({ icon, title });
}

function showAlert(icon, title, text = '') {
    return Swal.fire({
        icon,
        title,
        text,
        confirmButtonColor: '#E67E22',
        confirmButtonText: 'Tutup'
    });
}

async function showConfirm({
    title,
    text = '',
    icon = 'warning',
    confirmButtonText = 'Ya, Lanjutkan',
    cancelButtonText = 'Batal',
    confirmButtonColor = '#E67E22'
}) {
    const result = await Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonColor,
        cancelButtonColor: '#94A3B8',
        confirmButtonText,
        cancelButtonText,
        reverseButtons: true
    });
    return result.isConfirmed;
}

// ==================== REUSABLE PAGINATION UI COMPONENT ====================
function renderPaginationUI({ containerId, pagination, onPageChange, label = 'data' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!pagination || pagination.totalPages <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    const { page, totalPages, totalRecords, hasPrev, hasNext } = pagination;

    let buttonsHtml = '';

    // Tombol Sebelumnya
    buttonsHtml += `
        <button type="button" class="pagination-btn" ${!hasPrev ? 'disabled' : ''} onclick="${onPageChange}(${page - 1})">
            ${getSvgIcon('chevron-left')} Sebelumnya
        </button>
    `;

    // Tombol Nomor Halaman
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
            buttonsHtml += `
                <button type="button" class="pagination-btn ${i === page ? 'active' : ''}" onclick="${onPageChange}(${i})">
                    ${i}
                </button>
            `;
        } else if (i === page - 2 || i === page + 2) {
            buttonsHtml += `<span style="padding: 0 4px; color: var(--text-light); user-select: none;">...</span>`;
        }
    }

    // Tombol Selanjutnya
    buttonsHtml += `
        <button type="button" class="pagination-btn" ${!hasNext ? 'disabled' : ''} onclick="${onPageChange}(${page + 1})">
            Selanjutnya ${getSvgIcon('chevron-right')}
        </button>
    `;

    container.innerHTML = `
        <div class="pagination-info">
            Menampilkan halaman <strong>${page}</strong> dari <strong>${totalPages}</strong> (Total <strong>${totalRecords}</strong> ${label})
        </div>
        <div class="pagination-buttons">
            ${buttonsHtml}
        </div>
    `;
}

// Helper: Bersihkan seluruh state DOM dan kembalikan tampilan ke Dashboard
function resetAppStateToDashboard() {
    // 1. Reset menu sidebar
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        if (li.dataset.tab === 'dashboard') {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });

    // 2. Reset konten tab
    document.querySelectorAll('.tab-content').forEach(section => {
        if (section.id === 'dashboard') {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // 3. Reset title & subtitle header
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    if (pageTitle) pageTitle.textContent = 'Dashboard Perpustakaan';
    if (pageSubtitle) pageSubtitle.textContent = 'Selamat datang di Sistem Informasi BACA GEH!';

    // 4. Tutup semua modal yang mungkin masih aktif
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));

    // 5. Bersihkan nilai input form dan filter pencarian
    const searchBook = document.getElementById('searchBook');
    if (searchBook) searchBook.value = '';
    const searchUser = document.getElementById('searchUser');
    if (searchUser) searchUser.value = '';
    const filterUserRole = document.getElementById('filterUserRole');
    if (filterUserRole) filterUserRole.value = 'all';

    // 6. Reset pagination & cache
    bookCurrentPage = 1;
    userCurrentPage = 1;
    cachedUsers = [];
}

// ==================== 1. AUTENTIKASI: SUBMIT LOGIN ====================
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await res.json();

        if (result.success) {
            currentUser = result.user;
            document.getElementById('loginPage').classList.remove('active');
            document.getElementById('mainApp').classList.add('active');
            await initializeApp();
            showToast('success', `Selamat datang, ${currentUser.fullName}!`);
        } else {
            showAlert('error', 'Login Gagal', result.message);
        }
    } catch (err) {
        console.error('Error saat login:', err);
        showAlert('error', 'Koneksi Terputus', 'Gagal menghubungi server database. Pastikan modul Apache & MySQL di XAMPP sudah aktif!');
    }
});

// ==================== 2. LOGOUT ====================
document.getElementById('logoutBtn').addEventListener('click', async function() {
    const confirmed = await showConfirm({
        title: 'Konfirmasi Keluar',
        text: 'Yakin ingin keluar dari sistem informasi perpustakaan BACA GEH!?',
        icon: 'question',
        confirmButtonText: 'Ya, Keluar'
    });

    if (confirmed) {
        currentUser = null;
        resetAppStateToDashboard();
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('mainApp').classList.remove('active');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        showToast('info', 'Anda telah berhasil keluar dari akun');
    }
});

// ==================== 5. ROLE-BASED ACCESS CONTROL (RBAC) ====================
function applyRolePermissions() {
    if (!currentUser) return;

    // 1. Tampilkan identitas nama lengkap & label peran di header
    document.getElementById('currentUser').textContent = currentUser.fullName;
    document.getElementById('userRoleBadge').textContent = currentUser.roleLabel;

    // 2. Elemen navigasi & aksi
    const menuBorrow = document.querySelector('.sidebar-menu li[data-tab="borrow"]');
    const menuVerify = document.getElementById('menuVerify');
    const menuReturn = document.getElementById('menuReturn');
    const menuMembers = document.getElementById('menuMembers');
    const menuHistory = document.getElementById('menuHistory');

    const addBookBtn = document.getElementById('addBookBtn');
    const qaReturnBtn = document.getElementById('qaReturnBtn');
    const qaVerifyBtn = document.getElementById('qaVerifyBtn');
    const cardPendingBox = document.getElementById('cardPendingBox');
    const borrowerInput = document.getElementById('borrowerName');
    const btnOpenAddUser = document.getElementById('btnOpenAddUser');

    // Reset default tampil
    if (menuBorrow) menuBorrow.style.display = 'flex';
    if (menuVerify) menuVerify.style.display = 'flex';
    if (menuReturn) menuReturn.style.display = 'flex';
    if (menuMembers) menuMembers.style.display = 'flex';
    if (menuHistory) menuHistory.style.display = 'flex';
    if (addBookBtn) addBookBtn.style.display = 'inline-flex';
    if (qaReturnBtn) qaReturnBtn.style.display = 'inline-flex';
    if (qaVerifyBtn) qaVerifyBtn.style.display = 'inline-flex';
    if (cardPendingBox) cardPendingBox.style.display = 'flex';
    if (btnOpenAddUser) btnOpenAddUser.style.display = 'inline-flex';

    if (borrowerInput) {
        borrowerInput.value = '';
        borrowerInput.removeAttribute('readonly');
    }

    // Aturan Peran (Matrix Privilege)
    if (currentUser.role === 'master' || currentUser.role === 'admin') {
        // Master & Penanggung Jawab (Admin): Hak Akses Kelola Pengguna
        if (btnOpenAddUser) btnOpenAddUser.style.display = 'inline-flex';
    } else if (currentUser.role === 'pimpinan') {
        // Kepala Perpustakaan (Pimpinan): Executive Monitoring
        if (menuBorrow) menuBorrow.style.display = 'none';
        if (menuVerify) menuVerify.style.display = 'none';
        if (menuReturn) menuReturn.style.display = 'none';
        if (menuMembers) menuMembers.style.display = 'none';
        if (addBookBtn) addBookBtn.style.display = 'none';
        if (qaReturnBtn) qaReturnBtn.style.display = 'none';
        if (qaVerifyBtn) qaVerifyBtn.style.display = 'none';
        if (btnOpenAddUser) btnOpenAddUser.style.display = 'none';
    } else if (currentUser.role === 'tamu') {
        // Masyarakat / Pengguna: Layanan Peminjaman & Katalog Mandiri
        if (menuVerify) menuVerify.style.display = 'none';
        if (menuReturn) menuReturn.style.display = 'none';
        if (menuMembers) menuMembers.style.display = 'none';
        if (menuHistory) menuHistory.style.display = 'none';
        if (addBookBtn) addBookBtn.style.display = 'none';
        if (qaReturnBtn) qaReturnBtn.style.display = 'none';
        if (qaVerifyBtn) qaVerifyBtn.style.display = 'none';
        if (cardPendingBox) cardPendingBox.style.display = 'none';
        if (btnOpenAddUser) btnOpenAddUser.style.display = 'none';

        // Kunci input peminjam ke nama masyarakat yang sedang login
        if (borrowerInput) {
            borrowerInput.value = currentUser.fullName;
            borrowerInput.setAttribute('readonly', 'true');
        }
    }

    // Audit Tab Aktif: Jika tab yang sedang aktif di DOM tidak diizinkan untuk peran ini, alihkan ke dashboard
    const currentActiveContent = document.querySelector('.tab-content.active');
    const activeTabId = currentActiveContent ? currentActiveContent.id : 'dashboard';
    const allowedTabs = ROLE_ALLOWED_TABS[currentUser.role] || ['dashboard', 'books'];
    if (!allowedTabs.includes(activeTabId)) {
        switchTab('dashboard');
    }
}

// ==================== 6. INITIALIZE APP ====================
async function initializeApp() {
    // Selalu paksa reset ke halaman Dashboard saat inisialisasi login baru
    await switchTab('dashboard');
    applyRolePermissions();
    await updateDashboard();
    await renderBooks();
    await renderBorrowOptions();
    await renderActiveBorrows();
    setDefaultDates();

    console.log(`[BACA GEH!] Aktif. User: ${currentUser.fullName} (${currentUser.role})`);
    console.log(`[BACA GEH!] Endpoint Database: ${API_URL}`);
}

// ==================== 7. SET DEFAULT DATES ====================
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const borrowDateInput = document.getElementById('borrowDate');
    if (borrowDateInput) borrowDateInput.value = today;

    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + 7);
    const returnDateInput = document.getElementById('returnDate');
    if (returnDateInput) returnDateInput.value = returnDate.toISOString().split('T')[0];
}

// ==================== 8. TAB NAVIGATION & ROUTE GUARD ====================
document.querySelectorAll('.sidebar-menu li').forEach(item => {
    item.addEventListener('click', function() {
        const tab = this.dataset.tab;
        switchTab(tab);
    });
});

async function switchTab(tab) {
    // Route Guard: Periksa apakah peran pengguna yang aktif diizinkan membuka tab tujuan
    const userRole = currentUser ? currentUser.role : 'tamu';
    const allowedTabs = ROLE_ALLOWED_TABS[userRole] || ['dashboard', 'books'];
    if (!allowedTabs.includes(tab)) {
        console.warn(`[RouteGuard] Akses ke tab "${tab}" ditolak untuk peran "${userRole}". Dialihkan otomatis ke "dashboard".`);
        tab = 'dashboard';
    }

    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    const targetLi = document.querySelector(`.sidebar-menu li[data-tab="${tab}"]`);
    if (targetLi) targetLi.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(tab);
    if (targetContent) targetContent.classList.add('active');

    const titles = {
        dashboard: ['Dashboard Perpustakaan', 'Selamat datang di Sistem Informasi BACA GEH!'],
        books: ['Daftar Koleksi Buku', 'Kelola dan jelajahi seluruh koleksi buku BACA GEH!'],
        borrow: ['Formulir Peminjaman Buku', 'Lengkapi formulir pengajuan peminjaman buku perpustakaan'],
        verify: ['Verifikasi Pengajuan Pinjaman', 'Persetujuan dan verifikasi peminjaman buku oleh penanggung jawab'],
        return: ['Pengembalian Buku', 'Kelola pengembalian buku dan pemulihan stok buku'],
        members: ['Kelola Pengguna Sistem', 'Manajemen akun Master, Pimpinan, Admin, dan Masyarakat'],
        history: ['Laporan & Riwayat Transaksi', 'Rekapitulasi lengkap riwayat peminjaman buku masyarakat']
    };

    if (titles[tab]) {
        document.getElementById('pageTitle').textContent = titles[tab][0];
        document.getElementById('pageSubtitle').textContent = titles[tab][1];
    }

    // Refresh data tab terpilih
    if (tab === 'dashboard') await updateDashboard();
    if (tab === 'books') await renderBooks();
    if (tab === 'borrow') {
        await renderBorrowOptions();
        await renderActiveBorrows();
    }
    if (tab === 'verify') await renderPendingList();
    if (tab === 'return') await renderReturnList();
    if (tab === 'members') await renderUsersList();
    if (tab === 'history') await renderHistory();
}

// ==================== 9. DASHBOARD: STATISTIK REAL-TIME ====================
async function updateDashboard() {
    try {
        const res = await fetch(`${API_URL}?action=get_dashboard`);
        const json = await res.json();
        if (json.success && json.data) {
            const stats = json.data;
            document.getElementById('totalBooks').textContent = stats.totalBooks;
            document.getElementById('borrowedBooks').textContent = stats.borrowedBooks;
            const pendingEl = document.getElementById('pendingBorrows');
            if (pendingEl) pendingEl.textContent = stats.pendingBorrows;
            document.getElementById('pendingReturns').textContent = stats.pendingReturns;
            const membersEl = document.getElementById('totalMembers');
            if (membersEl) membersEl.textContent = stats.totalMembers;
        }
    } catch (e) {
        console.error('Error memuat statistik dashboard:', e);
    }
}

// ==================== 10. BUKU: READ & SEARCH (DENGAN PAGINATION) ====================
async function renderBooks(targetPage = null) {
    if (targetPage !== null) bookCurrentPage = targetPage;
    const container = document.getElementById('bookList');
    const searchInput = document.getElementById('searchBook');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let paginationData = null;
    try {
        const res = await fetch(`${API_URL}?action=get_books&page=${bookCurrentPage}&limit=8&search=${encodeURIComponent(searchTerm)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            cachedBooks = json.data;
            paginationData = json.pagination;
        }
    } catch (e) {
        console.error('Error memuat buku dari database:', e);
    }

    if (cachedBooks.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-book-open" style="font-size: 48px; margin-bottom: 16px; display: block; color: var(--text-light);"></i>
                <p>Tidak ada koleksi buku yang ditemukan.</p>
            </div>
        `;
        renderPaginationUI({ containerId: 'bookPagination', pagination: null });
        return;
    }

    const canManage = currentUser && (currentUser.role === 'admin' || currentUser.role === 'master');

    container.innerHTML = cachedBooks.map(book => `
        <div class="book-card">
            <div class="book-icon"><i class="fas fa-book"></i></div>
            <h4>${book.title}</h4>
            <p>${book.author}</p>
            <p style="font-size: 12px; color: #95A5A6;">ISBN: ${book.isbn}</p>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span class="book-status ${book.stock > 0 ? 'available' : 'borrowed'}">
                    ${book.stock > 0 ? `Tersedia (${book.stock})` : 'Stok Habis'}
                </span>
                ${canManage ? `
                <div style="display: flex; gap: 6px;">
                    <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px;" 
                            onclick="openEditBookModal(${book.id})" title="Edit Data Buku">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px; color: #EF4444;" 
                            onclick="deleteBook(${book.id})" title="Hapus Buku">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    renderPaginationUI({
        containerId: 'bookPagination',
        pagination: paginationData,
        onPageChange: 'changeBookPage',
        label: 'koleksi buku'
    });
}

function changeBookPage(page) {
    bookCurrentPage = page;
    renderBooks();
}

const searchInputEl = document.getElementById('searchBook');
if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
        bookCurrentPage = 1;
        renderBooks();
    });
}

// ==================== 11. BUKU: MODAL TAMBAH BUKU ====================
function showAddBookModal() {
    document.getElementById('addBookModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.getElementById('addBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('newBookTitle').value.trim();
    const author = document.getElementById('newBookAuthor').value.trim();
    const isbn = document.getElementById('newBookIsbn').value.trim();
    const stock = parseInt(document.getElementById('newBookStock').value);

    if (!title || !author || !isbn) {
        showAlert('warning', 'Formulir Tidak Lengkap', 'Semua kolom judul, penulis, dan ISBN harus diisi!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=add_book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, isbn, stock })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('addBookModal');
            this.reset();
            document.getElementById('newBookStock').value = 1;
            await renderBooks();
            await renderBorrowOptions();
            await updateDashboard();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Menambah Buku', result.message);
        }
    } catch (err) {
        console.error('Error saat tambah buku:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal menambahkan buku ke database: ' + err.message);
    }
});

// ==================== 12. BUKU: MODAL EDIT BUKU ====================
function openEditBookModal(bookId) {
    const book = cachedBooks.find(b => b.id === bookId);
    if (!book) return;

    document.getElementById('editBookId').value = book.id;
    document.getElementById('editBookTitle').value = book.title;
    document.getElementById('editBookAuthor').value = book.author;
    document.getElementById('editBookIsbn').value = book.isbn;
    document.getElementById('editBookStock').value = book.stock;

    document.getElementById('editBookModal').classList.add('active');
}

document.getElementById('editBookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editBookId').value);
    const title = document.getElementById('editBookTitle').value.trim();
    const author = document.getElementById('editBookAuthor').value.trim();
    const isbn = document.getElementById('editBookIsbn').value.trim();
    const stock = parseInt(document.getElementById('editBookStock').value);

    if (!id || !title || !author || !isbn) {
        showAlert('warning', 'Formulir Tidak Lengkap', 'Semua kolom harus diisi!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=update_book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, title, author, isbn, stock })
        });
        const result = await res.json();

        if (result.success) {
            closeModal('editBookModal');
            await renderBooks();
            await renderBorrowOptions();
            await updateDashboard();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Memperbarui Buku', result.message);
        }
    } catch (err) {
        console.error('Error saat edit buku:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal memperbarui data buku: ' + err.message);
    }
});

// ==================== 13. BUKU: SOFT DELETE BUKU ====================
async function deleteBook(id) {
    const book = cachedBooks.find(b => b.id === id);
    const bookTitle = book ? `"${book.title}"` : 'buku ini';

    const confirmed = await showConfirm({
        title: 'Hapus Koleksi Buku?',
        text: `Buku ${bookTitle} akan dinonaktifkan (soft delete) dari perpustakaan. Data riwayat peminjaman masa lalu tetap aman.`,
        icon: 'warning',
        confirmButtonText: 'Ya, Hapus Buku'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_URL}?action=delete_book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const result = await res.json();
        if (result.success) {
            await renderBooks();
            await renderBorrowOptions();
            await updateDashboard();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Menghapus Buku', result.message);
        }
    } catch (err) {
        console.error('Error saat hapus buku:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal menghapus buku dari database: ' + err.message);
    }
}

// ==================== 14. PEMINJAMAN: PILIHAN BUKU (SEMUA BUKU TERSEDIA) ====================
async function renderBorrowOptions() {
    const select = document.getElementById('borrowBook');
    if (!select) return;

    try {
        // Ambil seluruh buku yang stok > 0 tanpa terpotong pagination
        const res = await fetch(`${API_URL}?action=get_books&limit=all`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            const availableBooks = json.data.filter(b => b.stock > 0);
            if (availableBooks.length === 0) {
                select.innerHTML = `<option value="">-- Tidak ada buku tersedia saat ini --</option>`;
                return;
            }

            select.innerHTML = `
                <option value="">-- Pilih Buku Tersedia --</option>
                ${availableBooks.map(b => `
                    <option value="${b.id}">${b.title} (${b.author}) - Stok: ${b.stock}</option>
                `).join('')}
            `;
        }
    } catch (e) {
        console.error('Error memuat opsi buku pinjam:', e);
    }
}

// ==================== 15. PEMINJAMAN: SUBMIT FORM PENGAJUAN ====================
document.getElementById('borrowForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const bookId = parseInt(document.getElementById('borrowBook').value);
    const borrower = document.getElementById('borrowerName').value.trim();
    const borrowDate = document.getElementById('borrowDate').value;
    const returnDate = document.getElementById('returnDate').value;

    if (!bookId) {
        showAlert('warning', 'Pilihan Belum Lengkap', 'Silakan pilih buku yang ingin dipinjam!');
        return;
    }
    if (!borrower) {
        showAlert('warning', 'Identitas Kosong', 'Identitas nama peminjam harus diisi!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=borrow_book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookId,
                borrower,
                borrowDate,
                returnDate,
                userId: currentUser ? currentUser.id : null
            })
        });
        const result = await res.json();

        if (result.success) {
            // Tampilkan notifikasi konfirmasi sukses pengajuan
            const confirmAlert = document.getElementById('borrowConfirmAlert');
            const confirmMsg = document.getElementById('borrowConfirmMessage');
            if (confirmAlert && confirmMsg) {
                confirmMsg.textContent = result.message;
                confirmAlert.style.display = 'block';
                confirmAlert.scrollIntoView({ behavior: 'smooth' });
            }

            showToast('success', result.message);

            this.reset();
            setDefaultDates();
            applyRolePermissions();
            await renderBorrowOptions();
            await renderActiveBorrows();
            await updateDashboard();
        } else {
            showAlert('error', 'Pengajuan Ditolak', result.message);
        }
    } catch (err) {
        console.error('Error saat pengajuan pinjaman:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal mengirim pengajuan peminjaman: ' + err.message);
    }
});

// ==================== 16. PEMINJAMAN: DAFTAR STATUS AKTIF & PENDING ====================
async function renderActiveBorrows() {
    const container = document.getElementById('activeBorrows');
    if (!container) return;

    let items = [];
    try {
        // Ambil pending dan active
        const [resActive, resPending] = await Promise.all([
            fetch(`${API_URL}?action=get_active_borrows`),
            fetch(`${API_URL}?action=get_pending_borrows`)
        ]);

        const jsonActive = await resActive.json();
        const jsonPending = await resPending.json();

        if (jsonPending.success && Array.isArray(jsonPending.data)) {
            items = items.concat(jsonPending.data.map(p => ({ ...p, isPending: true })));
        }
        if (jsonActive.success && Array.isArray(jsonActive.data)) {
            items = items.concat(jsonActive.data.map(a => ({ ...a, isPending: false })));
        }

        // Jika masyarakat yang login, hanya tampilkan pinjamannya sendiri
        if (currentUser && currentUser.role === 'tamu') {
            items = items.filter(it => it.user_id == currentUser.id || it.borrower == currentUser.fullName);
        }
    } catch (e) {
        console.error('Error memuat daftar peminjaman aktif:', e);
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-light);">
                <i class="fas fa-clipboard-list" style="font-size: 32px; color: #10B981; margin-bottom: 12px; display: block;"></i>
                <p>Belum ada pengajuan atau peminjaman aktif.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(b => {
        let statusBadge = '';
        if (b.isPending) {
            statusBadge = `<span class="borrow-status pending">${getSvgIcon('clock')} Menunggu Verifikasi</span>`;
        } else if (b.status === 'overdue') {
            statusBadge = `<span class="borrow-status overdue">${getSvgIcon('alert-triangle')} Jatuh Tempo</span>`;
        } else {
            statusBadge = `<span class="borrow-status active">${getSvgIcon('check')} Disetujui / Aktif</span>`;
        }

        return `
            <div class="borrow-item" style="border-left: 4px solid ${b.isPending ? '#F59E0B' : '#10B981'};">
                <div class="borrow-info">
                    <h5>${b.bookTitle}</h5>
                    <p>Peminjam: <strong>${b.borrower}</strong> | Rencana Kembali: ${formatDate(b.returnDate)}</p>
                </div>
                ${statusBadge}
            </div>
        `;
    }).join('');
}

// ==================== 17. VERIFIKASI: PENGAJUAN PENDING (ADMIN & MASTER) ====================
async function renderPendingList() {
    const container = document.getElementById('pendingList');
    if (!container) return;

    let pendings = [];
    try {
        const res = await fetch(`${API_URL}?action=get_pending_borrows`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            pendings = json.data;
        }
    } catch (e) {
        console.error('Error memuat pengajuan pending:', e);
    }

    if (pendings.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-check-double" style="font-size: 40px; color: #10B981; margin-bottom: 14px; display: block;"></i>
                <p style="font-size: 15px; font-weight: 500;">Semua pengajuan peminjaman telah diverifikasi!</p>
                <span style="font-size: 13px;">Tidak ada pengajuan masyarakat yang tertunda saat ini.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = pendings.map(p => `
        <div class="return-item" style="background: white; border: 1.5px solid #FDE68A; border-radius: 14px; margin-bottom: 12px; padding: 16px 20px;">
            <div class="borrow-info">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <h5 style="margin: 0; font-size: 16px;">${p.judul_buku}</h5>
                    <span style="background: #FEF3C7; color: #B45309; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">Pending</span>
                </div>
                <p style="margin: 4px 0;">Pemohon: <strong>${p.nama_peminjam}</strong></p>
                <p style="font-size: 12px; color: var(--text-light);">Tgl Pinjam: ${formatDate(p.tanggal_pinjam)} | Rencana Kembali: ${formatDate(p.tanggal_jatuh_tempo)}</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-primary" style="padding: 8px 14px; font-size: 13px;" onclick="verifyBorrow(${p.id}, 'approve')">
                    <i class="fas fa-check"></i> Setujui
                </button>
                <button class="btn-secondary" style="padding: 8px 14px; font-size: 13px; color: #EF4444; border-color: #FCA5A5;" onclick="verifyBorrow(${p.id}, 'reject')">
                    <i class="fas fa-times"></i> Tolak
                </button>
            </div>
        </div>
    `).join('');
}

async function verifyBorrow(borrowId, decision) {
    const isApprove = decision === 'approve';
    const actionText = isApprove ? 'menyetujui' : 'menolak';

    const confirmed = await showConfirm({
        title: `${isApprove ? 'Setujui' : 'Tolak'} Pengajuan?`,
        text: `Konfirmasi untuk ${actionText} pengajuan peminjaman buku ini.`,
        icon: isApprove ? 'question' : 'warning',
        confirmButtonText: `Ya, ${isApprove ? 'Setujui' : 'Tolak'}`,
        confirmButtonColor: isApprove ? '#10B981' : '#EF4444'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_URL}?action=verify_borrow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ borrowId, decision })
        });
        const result = await res.json();
        if (result.success) {
            await renderPendingList();
            await updateDashboard();
            await renderBooks();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Verifikasi Gagal', result.message);
        }
    } catch (err) {
        console.error('Error saat verifikasi pengajuan:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal memproses verifikasi: ' + err.message);
    }
}

// ==================== 18. PENGEMBALIAN BUKU (ADMIN & MASTER) ====================
async function renderReturnList() {
    const container = document.getElementById('returnList');
    if (!container) return;

    let activeBorrows = [];
    try {
        const res = await fetch(`${API_URL}?action=get_active_borrows`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            activeBorrows = json.data;
        }
    } catch (e) {
        console.error('Error memuat daftar pengembalian:', e);
    }

    if (activeBorrows.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-check-circle" style="font-size: 36px; color: #10B981; margin-bottom: 12px; display: block;"></i>
                <p>Tidak ada buku yang sedang dipinjam saat ini.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = activeBorrows.map(b => `
        <div class="return-item">
            <div class="borrow-info">
                <h5>${b.bookTitle}</h5>
                <p>Peminjam: <strong>${b.borrower}</strong> | Pinjam: ${formatDate(b.borrowDate)} | Jatuh Tempo: ${formatDate(b.returnDate)}</p>
            </div>
            <button class="btn-return" onclick="returnBook(${b.id})">
                <i class="fas fa-undo-alt"></i> Proses Pengembalian
            </button>
        </div>
    `).join('');
}

async function returnBook(borrowId) {
    const confirmed = await showConfirm({
        title: 'Pengembalian Buku Fisik',
        text: 'Konfirmasi bahwa buku fisik telah diterima dan dikembalikan ke rak perpustakaan untuk memulihkan stok?',
        icon: 'question',
        confirmButtonText: 'Ya, Terima Buku',
        confirmButtonColor: '#10B981'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_URL}?action=return_book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ borrowId })
        });
        const result = await res.json();
        if (result.success) {
            await renderReturnList();
            await renderBooks();
            await renderBorrowOptions();
            await updateDashboard();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Memproses Pengembalian', result.message);
        }
    } catch (err) {
        console.error('Error saat proses pengembalian:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal memproses pengembalian: ' + err.message);
    }
}

// ==================== 19. KELOLA PENGGUNA TERPUSAT (DENGAN PAGINATION) ====================
async function renderUsersList(targetPage = null) {
    if (targetPage !== null) userCurrentPage = targetPage;
    const container = document.getElementById('membersList');
    if (!container) return;

    const searchInput = document.getElementById('searchUser');
    const roleSelect = document.getElementById('filterUserRole');
    const search = searchInput ? searchInput.value.trim() : '';
    const role = roleSelect ? roleSelect.value : 'all';

    let paginationData = null;
    try {
        const res = await fetch(`${API_URL}?action=get_all_users&page=${userCurrentPage}&limit=6&search=${encodeURIComponent(search)}&role=${encodeURIComponent(role)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            cachedUsers = json.data;
            paginationData = json.pagination;
        } else {
            cachedUsers = [];
        }
    } catch (e) {
        console.error('Error memuat data pengguna:', e);
        cachedUsers = [];
    }

    if (cachedUsers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-users-slash" style="font-size: 36px; margin-bottom: 12px; display: block;"></i>
                <p style="font-size: 15px; font-weight: 500;">Tidak ada akun pengguna yang ditemukan.</p>
                <span style="font-size: 13px;">Gunakan tombol "Tambah Pengguna Baru" untuk mendaftarkan akun.</span>
            </div>
        `;
        renderPaginationUI({ containerId: 'userPagination', pagination: null });
        return;
    }

    container.innerHTML = cachedUsers.map(u => {
        let roleBadge = '';
        if (u.role === 'master') {
            roleBadge = `<span style="background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">${getSvgIcon('crown')} Master</span>`;
        } else if (u.role === 'pimpinan') {
            roleBadge = `<span style="background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">${getSvgIcon('user-tie')} Pimpinan</span>`;
        } else if (u.role === 'admin') {
            roleBadge = `<span style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">${getSvgIcon('shield')} Admin</span>`;
        } else {
            roleBadge = `<span style="background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">${getSvgIcon('user')} Masyarakat</span>`;
        }

        const isSelf = currentUser && currentUser.id === u.id;
        const isMaster = currentUser && currentUser.role === 'master';
        const isAdmin = currentUser && currentUser.role === 'admin';

        let canEdit = false;
        let canDelete = false;

        if (isMaster) {
            canEdit = true;
            canDelete = (u.role !== 'master') && !isSelf;
        } else if (isAdmin) {
            canEdit = (u.role === 'admin' || u.role === 'tamu');
            canDelete = (u.role === 'admin' || u.role === 'tamu') && !isSelf;
        }

        return `
            <div class="return-item" style="background: white; border-radius: 14px; margin-bottom: 12px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E8ECF1;">
                <div class="borrow-info" style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <h5 style="margin: 0; font-size: 15px; color: var(--primary);">${u.nama_lengkap}</h5>
                        <span style="font-size: 13px; color: var(--text-light); font-weight: 500;">@${u.username}</span>
                        ${roleBadge}
                        ${isSelf ? '<span style="background: #FEF3C7; color: #B45309; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">AKUN ANDA</span>' : ''}
                    </div>
                    <div style="margin-top: 6px; font-size: 12px; color: var(--text-light); display: flex; gap: 16px; flex-wrap: wrap;">
                        <span><i class="fas fa-envelope"></i> ${u.email ? u.email : '-'}</span>
                        <span><i class="fas fa-phone"></i> ${u.telepon ? u.telepon : '-'}</span>
                        <span><i class="fas fa-calendar"></i> Terdaftar: ${formatDate(u.created_at)}</span>
                        <span><i class="fas fa-book-reader"></i> Total Pinjam: <strong>${u.total_pinjam}</strong></span>
                        <span><i class="fas fa-clock"></i> Aktif: <strong style="color: ${u.pinjaman_aktif > 0 ? '#D97706' : '#10B981'};">${u.pinjaman_aktif}</strong></span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-left: 16px; align-items: center;">
                    ${canEdit ? `
                        <button type="button" class="btn-secondary" style="padding: 6px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;" 
                                onclick="openEditUserModal(${u.id})" title="Edit Akun Pengguna">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button type="button" class="btn-secondary" style="padding: 6px 12px; font-size: 12px; color: #EF4444; border-color: #FCA5A5; display: inline-flex; align-items: center; gap: 6px;" 
                                onclick="deleteUser(${u.id}, '${u.username}')" title="Hapus Akun Pengguna">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    renderPaginationUI({
        containerId: 'userPagination',
        pagination: paginationData,
        onPageChange: 'changeUserPage',
        label: 'akun pengguna'
    });
}

function changeUserPage(page) {
    userCurrentPage = page;
    renderUsersList();
}

const renderMembersList = renderUsersList;

// Event listener pencarian & filter pengguna
const searchUserEl = document.getElementById('searchUser');
if (searchUserEl) {
    searchUserEl.addEventListener('input', () => {
        userCurrentPage = 1;
        renderUsersList();
    });
}
const filterUserRoleEl = document.getElementById('filterUserRole');
if (filterUserRoleEl) {
    filterUserRoleEl.addEventListener('change', () => {
        userCurrentPage = 1;
        renderUsersList();
    });
}

// Buka Modal Tambah Pengguna Baru
function showAddUserModal() {
    if (!currentUser || (currentUser.role !== 'master' && currentUser.role !== 'admin')) {
        showAlert('warning', 'Akses Terbatas', 'Anda tidak memiliki hak akses untuk menambah pengguna!');
        return;
    }

    const roleSelect = document.getElementById('newUserRole');
    if (!roleSelect) return;

    if (currentUser.role === 'master') {
        roleSelect.innerHTML = `
            <option value="tamu" selected>Masyarakat / Pengguna</option>
            <option value="admin">Penanggung Jawab (Admin Staf)</option>
            <option value="pimpinan">Kepala Perpustakaan (Pimpinan)</option>
        `;
    } else if (currentUser.role === 'admin') {
        roleSelect.innerHTML = `
            <option value="tamu" selected>Masyarakat / Pengguna</option>
            <option value="admin">Penanggung Jawab (Admin Staf)</option>
        `;
    }

    const form = document.getElementById('addUserForm');
    if (form) form.reset();
    document.getElementById('addUserModal').classList.add('active');
}

// Submit Form Tambah Pengguna
document.getElementById('addUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const namaLengkap = document.getElementById('newFullName').value.trim();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newUserRole').value;
    const email = document.getElementById('newEmail').value.trim();
    const telepon = document.getElementById('newTelepon').value.trim();

    if (!namaLengkap || !username || !password) {
        showAlert('warning', 'Formulir Tidak Lengkap', 'Nama lengkap, username, dan kata sandi wajib diisi!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=create_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creator_role: currentUser.role,
                nama_lengkap: namaLengkap,
                username: username,
                password: password,
                role: role,
                email: email,
                telepon: telepon
            })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('addUserModal');
            this.reset();
            await renderUsersList();
            await updateDashboard();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Membuat Akun', result.message);
        }
    } catch (err) {
        console.error('Error saat menambah user:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal menambahkan pengguna baru: ' + err.message);
    }
});

// Buka Modal Edit Pengguna
function openEditUserModal(userId) {
    const user = cachedUsers.find(u => u.id === userId);
    if (!user) return;

    // Proteksi hak edit
    if (currentUser.role === 'admin' && (user.role === 'master' || user.role === 'pimpinan')) {
        showAlert('warning', 'Akses Ditolak', 'Admin tidak diizinkan mengubah akun Master atau Pimpinan!');
        return;
    }

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editFullName').value = user.nama_lengkap;
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editTelepon').value = user.telepon || '';
    document.getElementById('editNewPassword').value = '';

    const roleSelect = document.getElementById('editUserRole');
    if (user.role === 'master') {
        roleSelect.innerHTML = `<option value="master" selected>Master Administrator</option>`;
        roleSelect.disabled = true;
    } else {
        roleSelect.disabled = false;
        if (currentUser.role === 'master') {
            roleSelect.innerHTML = `
                <option value="pimpinan" ${user.role === 'pimpinan' ? 'selected' : ''}>Kepala Perpustakaan (Pimpinan)</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Penanggung Jawab (Admin)</option>
                <option value="tamu" ${user.role === 'tamu' ? 'selected' : ''}>Masyarakat / Pengguna</option>
            `;
        } else if (currentUser.role === 'admin') {
            roleSelect.innerHTML = `
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Penanggung Jawab (Admin)</option>
                <option value="tamu" ${user.role === 'tamu' ? 'selected' : ''}>Masyarakat / Pengguna</option>
            `;
        }
    }

    document.getElementById('editUserModal').classList.add('active');
}

// Submit Form Edit Pengguna
document.getElementById('editUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userId = parseInt(document.getElementById('editUserId').value);
    const namaLengkap = document.getElementById('editFullName').value.trim();
    const roleSelect = document.getElementById('editUserRole');
    const role = roleSelect.value;
    const newPassword = document.getElementById('editNewPassword').value;
    const email = document.getElementById('editEmail').value.trim();
    const telepon = document.getElementById('editTelepon').value.trim();

    if (!userId || !namaLengkap) {
        showAlert('warning', 'Formulir Tidak Lengkap', 'Nama lengkap tidak boleh kosong!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=update_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creator_role: currentUser.role,
                creator_id: currentUser.id,
                user_id: userId,
                nama_lengkap: namaLengkap,
                role: role,
                new_password: newPassword,
                email: email,
                telepon: telepon
            })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('editUserModal');
            if (currentUser.id === userId) {
                currentUser.fullName = namaLengkap;
                document.getElementById('currentUser').textContent = namaLengkap;
            }
            await renderUsersList();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Memperbarui Akun', result.message);
        }
    } catch (err) {
        console.error('Error saat update user:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal memperbarui akun pengguna: ' + err.message);
    }
});

// Hapus / Nonaktifkan Pengguna (Soft Delete)
async function deleteUser(userId, username) {
    const confirmed = await showConfirm({
        title: 'Nonaktifkan Akun Pengguna?',
        text: `Yakin ingin menonaktifkan akun "@${username}"? Akun akan di-soft delete dan data histori transaksi tetap tersimpan aman.`,
        icon: 'warning',
        confirmButtonText: 'Ya, Nonaktifkan Akun',
        confirmButtonColor: '#EF4444'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_URL}?action=delete_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creator_role: currentUser.role,
                creator_id: currentUser.id,
                user_id: userId
            })
        });
        const result = await res.json();
        if (result.success) {
            await renderUsersList();
            await updateDashboard();
            showToast('success', result.message);
        } else {
            showAlert('error', 'Gagal Menghapus Akun', result.message);
        }
    } catch (err) {
        console.error('Error saat menghapus user:', err);
        showAlert('error', 'Terjadi Kesalahan', 'Gagal menghapus pengguna: ' + err.message);
    }
}

// ==================== 20. LAPORAN & RIWAYAT LENGKAP ====================
async function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    let historyItems = [];
    try {
        const res = await fetch(`${API_URL}?action=get_history`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            historyItems = json.data;
        }
    } catch (e) {
        console.error('Error memuat laporan riwayat:', e);
    }

    if (historyItems.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fas fa-history" style="font-size: 36px; margin-bottom: 12px; display: block;"></i>
                <p>Belum ada riwayat transaksi peminjaman.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = historyItems.map(h => {
        let badgeHtml = '';
        if (h.status === 'completed') {
            badgeHtml = `<span class="borrow-status completed">${getSvgIcon('check-circle')} Selesai Dikembalikan</span>`;
        } else if (h.status === 'active') {
            badgeHtml = `<span class="borrow-status active">${getSvgIcon('book-open')} Sedang Dipinjam</span>`;
        } else if (h.status === 'pending') {
            badgeHtml = `<span class="borrow-status pending">${getSvgIcon('clock')} Menunggu Verifikasi</span>`;
        } else if (h.status === 'rejected') {
            badgeHtml = `<span class="borrow-status rejected">${getSvgIcon('x-circle')} Ditolak</span>`;
        } else {
            badgeHtml = `<span class="borrow-status overdue">${getSvgIcon('alert-triangle')} Jatuh Tempo</span>`;
        }

        return `
            <div class="history-item" style="background: white; border-radius: 14px; margin-bottom: 12px; padding: 16px 20px;">
                <div class="borrow-info">
                    <h5>${h.judul_buku}</h5>
                    <p>Peminjam: <strong>${h.nama_peminjam}</strong> | Pinjam: ${formatDate(h.tanggal_pinjam)} | Kembali: ${h.tanggal_kembali ? formatDate(h.tanggal_kembali) : '-'}</p>
                    ${h.catatan_admin ? `<p style="font-size: 12px; color: var(--text-light); margin-top: 4px;">Catatan: <em>${h.catatan_admin}</em></p>` : ''}
                </div>
                ${badgeHtml}
            </div>
        `;
    }).join('');
}

// ==================== 21. UTILITY FUNCTIONS ====================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Tutup modal jika klik di luar box
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

console.log('[BACA GEH!] Frontend siap digunakan.');
