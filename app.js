// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado:', registration.scope);
            })
            .catch(error => {
                console.log('Error al registrar Service Worker:', error);
            });
    });
}

// Estado
let currentEntryId = null;
let entryToDelete = null;
let cameFromList = false;
let db = null;

// Inicializar IndexedDB
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
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

// Almacenamiento con IndexedDB
async function getEntries() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['entries'], 'readonly');
        const store = transaction.objectStore('entries');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function saveEntry(website, username, password) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['entries'], 'readwrite');
        const store = transaction.objectStore('entries');
        const entry = {
            id: Date.now().toString(),
            website,
            username,
            password,
            createdAt: new Date().toISOString()
        };
        
        const request = store.add(entry);
        request.onsuccess = () => resolve(entry);
        request.onerror = () => reject(request.error);
    });
}

async function getEntry(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['entries'], 'readonly');
        const store = transaction.objectStore('entries');
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function updateEntry(id, website, username, password) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['entries'], 'readwrite');
        const store = transaction.objectStore('entries');
        
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
            const entry = getRequest.result;
            if (entry) {
                entry.website = website;
                entry.username = username;
                entry.password = password;
                entry.updatedAt = new Date().toISOString();
                
                const putRequest = store.put(entry);
                putRequest.onsuccess = () => resolve(entry);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Entrada no encontrada'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

async function deleteEntry(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['entries'], 'readwrite');
        const store = transaction.objectStore('entries');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Navegación
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
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
        } else {
            // Fallback para dispositivos móviles
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        }
    } catch {
        return false;
    }
}

function notify(msg, type = 'success') {
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerHTML = `<span>${msg}</span><button class="notification-close">×</button>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 50);
    const t = setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2500);
    n.querySelector('.notification-close').onclick = () => { 
        clearTimeout(t); 
        n.classList.remove('show'); 
        setTimeout(() => n.remove(), 300); 
    };
    if (type === 'error') n.classList.add('notification-error');
    else n.classList.add('notification-success');
}

// Renderizar lista
async function renderList() {
    const entries = await getEntries();
    const container = document.getElementById('websites-list');
    
    if (!entries.length) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <p>No hay claves</p>
                <span>Crea tu primera entrada</span>
            </div>`;
        return;
    }
    
    container.innerHTML = entries.map(e => `
        <div class="list-item">
            <div class="list-item-info">
                <span class="list-item-website">${e.website}</span>
                <span class="list-item-username">${e.username}</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-icon-sm btn-view" data-id="${e.id}" title="Ver detalles">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="btn-icon-sm btn-delete-item" data-id="${e.id}" data-website="${e.website}" title="Eliminar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.btn-view').forEach(b => b.onclick = async () => {
        cameFromList = true;
        await showDetail(b.dataset.id);
    });
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
    document.getElementById('toggle-password').title = 'Mostrar contraseña';
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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar base de datos
    try {
        await initDB();
        console.log('Base de datos inicializada');
    } catch (error) {
        console.error('Error al inicializar DB:', error);
        notify('Error al iniciar la aplicación', 'error');
    }
    
    document.getElementById('create-btn').onclick = () => { 
        cameFromList = false;
        document.getElementById('create-form').reset(); 
        showScreen('create-screen'); 
    };
    
    document.getElementById('list-btn').onclick = async () => { 
        cameFromList = false;
        await renderList(); 
        showScreen('list-screen'); 
    };
    
    document.getElementById('back-from-create').onclick = () => showScreen('main-screen');
    
    document.getElementById('back-from-list').onclick = () => {
        cameFromList = false;
        showScreen('main-screen');
    };
    
    document.getElementById('back-from-detail').onclick = async () => {
        if (cameFromList) {
            await renderList();
            showScreen('list-screen');
        } else {
            showScreen('main-screen');
        }
    };
    
    document.getElementById('back-from-edit').onclick = () => {
        const id = document.getElementById('edit-screen').dataset.entryId;
        if (id) {
            cameFromList = true;
            showDetail(id);
        } else {
            showScreen('main-screen');
        }
    };
    
    document.getElementById('edit-btn').onclick = () => {
        const id = document.getElementById('detail-screen').dataset.entryId;
        if (id) showEditForm(id);
    };
    
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
    
    // Toggle contraseña detalle
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
    
    // Toggle contraseña edición
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
    
    // Copiar
    document.getElementById('copy-username').onclick = async () => {
        if (await copyToClipboard(document.getElementById('detail-username').textContent)) notify('Usuario copiado');
    };
    document.getElementById('copy-password').onclick = async () => {
        const entry = await getEntry(document.getElementById('detail-screen').dataset.entryId);
        if (entry && await copyToClipboard(entry.password)) notify('Contraseña copiada');
    };
    
    // Modal eliminar
    document.getElementById('confirm-delete').onclick = async () => {
        if (entryToDelete) {
            await deleteEntry(entryToDelete);
            hideDeleteModal();
            notify('Entrada eliminada');
            await renderList();
            showScreen('list-screen');
        }
    };
    document.getElementById('cancel-delete').onclick = () => { hideDeleteModal(); showScreen('list-screen'); };
    document.getElementById('delete-modal').onclick = (e) => { 
        if (e.target === document.getElementById('delete-modal')) { 
            hideDeleteModal(); 
            showScreen('list-screen'); 
        } 
    };
    
    showScreen('main-screen');
});

// Prevenir zoom en móviles
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());