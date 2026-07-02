// Detectar si la app se está ejecutando como PWA instalada
const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
              navigator.standalone || 
              document.referrer.includes('android-app://');

// Forzar altura completa en PWA
if (isPWA) {
    document.documentElement.style.height = '100vh';
    document.body.style.height = '100vh';
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/guardapass/service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado');
            })
            .catch(error => {
                console.log('Error Service Worker:', error);
            });
    });
}

// Instalación PWA
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.add('show');
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                installBtn.classList.remove('show');
            }
            deferredPrompt = null;
        }
    });
}

window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.classList.remove('show');
});

if (isPWA && installBtn) {
    installBtn.style.display = 'none';
}

// Estado
let currentEntryId = null;
let entryToDelete = null;
let cameFromList = false;
let db = null;

// Base de datos
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GuardaPassDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('entries')) {
                const store = db.createObjectStore('entries', { keyPath: 'id' });
                store.createIndex('website', 'website', { unique: false });
            }
        };
    });
}

async function getEntries() {
    return new Promise((resolve) => {
        if (!db) { resolve([]); return; }
        const tx = db.transaction(['entries'], 'readonly');
        const store = tx.objectStore('entries');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

async function saveEntry(website, username, password) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['entries'], 'readwrite');
        const store = tx.objectStore('entries');
        const entry = { id: Date.now().toString(), website, username, password, createdAt: new Date().toISOString() };
        const req = store.add(entry);
        req.onsuccess = () => resolve(entry);
        req.onerror = () => reject(req.error);
    });
}

async function getEntry(id) {
    return new Promise((resolve) => {
        const tx = db.transaction(['entries'], 'readonly');
        const store = tx.objectStore('entries');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function updateEntry(id, website, username, password) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['entries'], 'readwrite');
        const store = tx.objectStore('entries');
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const entry = getReq.result;
            if (entry) {
                entry.website = website;
                entry.username = username;
                entry.password = password;
                entry.updatedAt = new Date().toISOString();
                store.put(entry).onsuccess = () => resolve(entry);
            } else {
                reject(new Error('No encontrada'));
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

async function deleteEntry(id) {
    return new Promise((resolve) => {
        const tx = db.transaction(['entries'], 'readwrite');
        const store = tx.objectStore('entries');
        store.delete(id).onsuccess = () => resolve();
    });
}

// Navegación
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screenId);
    if (el) el.classList.add('active');
}

// Modal
function showDeleteModal(id, website) {
    entryToDelete = id;
    document.getElementById('delete-website-name').textContent = website;
    document.getElementById('delete-modal').classList.add('active');
}

function hideDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    entryToDelete = null;
}

// Utilidades
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    } catch { return false; }
}

function notify(msg, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerHTML = `<span>${msg}</span><button class="notification-close">×</button>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 50);
    const t = setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2500);
    n.querySelector('.notification-close').onclick = () => { clearTimeout(t); n.classList.remove('show'); setTimeout(() => n.remove(), 300); };
    if (type === 'error') n.classList.add('notification-error');
    else n.classList.add('notification-success');
}

// Renderizar lista
async function renderList() {
    const entries = await getEntries();
    const container = document.getElementById('websites-list');
    if (!container) return;
    if (!entries.length) {
        container.innerHTML = `<div class="empty-state"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><p>No hay claves</p><span>Crea tu primera entrada</span></div>`;
        return;
    }
    container.innerHTML = entries.map(e => `
        <div class="list-item">
            <div class="list-item-info"><span class="list-item-website">${e.website}</span><span class="list-item-username">${e.username}</span></div>
            <div class="list-item-actions">
                <button class="btn-icon-sm btn-view" data-id="${e.id}" title="Ver detalles"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                <button class="btn-icon-sm btn-delete-item" data-id="${e.id}" data-website="${e.website}" title="Eliminar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.btn-view').forEach(b => b.onclick = async () => { cameFromList = true; await showDetail(b.dataset.id); });
    document.querySelectorAll('.btn-delete-item').forEach(b => b.onclick = () => showDeleteModal(b.dataset.id, b.dataset.website));
}

async function showDetail(id) {
    const e = await getEntry(id);
    if (!e) return;
    document.getElementById('detail-website').textContent = e.website;
    document.getElementById('detail-username').textContent = e.username;
    const pw = document.getElementById('detail-password');
    pw.textContent = '••••••••';
    pw.classList.add('password-masked');
    document.getElementById('toggle-password').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    document.getElementById('detail-screen').dataset.entryId = id;
    showScreen('detail-screen');
}

async function showEditForm(id) {
    const e = await getEntry(id);
    if (!e) return;
    document.getElementById('edit-website').value = e.website;
    document.getElementById('edit-username').value = e.username;
    document.getElementById('edit-password').value = e.password;
    document.getElementById('edit-password').type = 'password';
    document.getElementById('toggle-edit-password').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    document.getElementById('edit-screen').dataset.entryId = id;
    showScreen('edit-screen');
}

// Inicializar app
async function initApp() {
    try { await initDB(); } catch (e) { console.error('Error DB:', e); }

    document.getElementById('create-btn').onclick = () => { cameFromList = false; document.getElementById('create-form').reset(); showScreen('create-screen'); };
    document.getElementById('list-btn').onclick = async () => { cameFromList = false; await renderList(); showScreen('list-screen'); };
    document.getElementById('back-from-create').onclick = () => showScreen('main-screen');
    document.getElementById('back-from-list').onclick = () => { cameFromList = false; showScreen('main-screen'); };
    document.getElementById('back-from-detail').onclick = async () => { if (cameFromList) { await renderList(); showScreen('list-screen'); } else { showScreen('main-screen'); } };
    document.getElementById('back-from-edit').onclick = () => { const id = document.getElementById('edit-screen').dataset.entryId; if (id) { cameFromList = true; showDetail(id); } else { showScreen('main-screen'); } };
    document.getElementById('edit-btn').onclick = () => { const id = document.getElementById('detail-screen').dataset.entryId; if (id) showEditForm(id); };

    document.getElementById('create-form').onsubmit = async (e) => {
        e.preventDefault();
        const w = document.getElementById('website').value.trim();
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value;
        if (!w || !u || !p) return notify('Completa todos los campos', 'error');
        await saveEntry(w, u, p);
        notify('Entrada creada');
        showScreen('main-screen');
    };

    document.getElementById('edit-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-screen').dataset.entryId;
        const w = document.getElementById('edit-website').value.trim();
        const u = document.getElementById('edit-username').value.trim();
        const p = document.getElementById('edit-password').value;
        if (!w || !u || !p) return notify('Completa todos los campos', 'error');
        await updateEntry(id, w, u, p);
        notify('Entrada actualizada');
        cameFromList = true;
        showDetail(id);
    };

    document.getElementById('toggle-password').onclick = async function() {
        const pwEl = document.getElementById('detail-password');
        const id = document.getElementById('detail-screen').dataset.entryId;
        const entry = await getEntry(id);
        if (!entry) return;
        if (pwEl.classList.contains('password-masked')) {
            pwEl.textContent = entry.password;
            pwEl.classList.remove('password-masked');
            this.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            this.title = 'Ocultar contraseña';
        } else {
            pwEl.textContent = '••••••••';
            pwEl.classList.add('password-masked');
            this.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            this.title = 'Mostrar contraseña';
        }
    };

    document.getElementById('toggle-edit-password').onclick = function() {
        const input = document.getElementById('edit-password');
        if (input.type === 'password') {
            input.type = 'text';
            this.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            this.title = 'Ocultar contraseña';
        } else {
            input.type = 'password';
            this.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            this.title = 'Mostrar contraseña';
        }
    };

    document.getElementById('copy-username').onclick = async () => { if (await copyToClipboard(document.getElementById('detail-username').textContent)) notify('Usuario copiado'); };
    document.getElementById('copy-password').onclick = async () => {
        const entry = await getEntry(document.getElementById('detail-screen').dataset.entryId);
        if (entry && await copyToClipboard(entry.password)) notify('Contraseña copiada');
    };

    document.getElementById('confirm-delete').onclick = async () => {
        if (entryToDelete) { await deleteEntry(entryToDelete); hideDeleteModal(); notify('Entrada eliminada'); await renderList(); showScreen('list-screen'); }
    };
    document.getElementById('cancel-delete').onclick = () => { hideDeleteModal(); showScreen('list-screen'); };
    document.getElementById('delete-modal').onclick = (e) => { if (e.target === document.getElementById('delete-modal')) { hideDeleteModal(); showScreen('list-screen'); } };

    showScreen('main-screen');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}