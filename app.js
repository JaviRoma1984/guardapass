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
            .then(() => console.log('Service Worker registrado'))
            .catch(error => console.log('Error Service Worker:', error));
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
            if (result.outcome === 'accepted') installBtn.classList.remove('show');
            deferredPrompt = null;
        }
    });
}

window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.classList.remove('show');
});

if (isPWA && installBtn) installBtn.style.display = 'none';

// ===================== ESTADO =====================
let currentEntryId = null;
let entryToDelete = null;
let cameFromList = false;
let db = null;
let vaultKey = null; // CryptoKey AES-GCM en memoria (solo tras desbloquear)

// ===================== CRIPTOGRAFÍA =====================
const KDF_ITERATIONS = 210000;
const textEnc = new TextEncoder();
const textDec = new TextDecoder();
const VERIFIER_PLAINTEXT = 'guardapass-verify';

function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
}

function u8(buf) {
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

// Deriva una llave AES-GCM desde la contraseña maestra (PBKDF2)
async function deriveKey(password, salt, iterations = KDF_ITERATIONS) {
    const baseKey = await crypto.subtle.importKey(
        'raw', textEnc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    // extractable: true → necesario para poder envolverla con biometría
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: u8(salt), iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptObj(key, obj) {
    const iv = randomBytes(12);
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, textEnc.encode(JSON.stringify(obj))
    );
    return { iv, data: new Uint8Array(ct) };
}

async function decryptObj(key, iv, data) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8(iv) }, key, u8(data));
    return JSON.parse(textDec.decode(pt));
}

// ===================== BASE DE DATOS =====================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GuardaPassDB', 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('entries')) {
                database.createObjectStore('entries', { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains('meta')) {
                database.createObjectStore('meta', { keyPath: 'id' });
            }
        };
    });
}

function metaGet(id) {
    return new Promise((resolve) => {
        const req = db.transaction(['meta'], 'readonly').objectStore('meta').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

function metaPut(obj) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(['meta'], 'readwrite').objectStore('meta').put(obj);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Registros crudos (cifrados) tal cual están en IndexedDB
function getRawEntries() {
    return new Promise((resolve) => {
        if (!db) return resolve([]);
        const req = db.transaction(['entries'], 'readonly').objectStore('entries').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

function getRawEntry(id) {
    return new Promise((resolve) => {
        const req = db.transaction(['entries'], 'readonly').objectStore('entries').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

function putRawEntry(record) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(['entries'], 'readwrite').objectStore('entries').put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ===================== ENTRADAS (cifradas) =====================
async function getEntries() {
    if (!vaultKey) return [];
    const raw = await getRawEntries();
    const out = [];
    for (const r of raw) {
        try {
            if (r.data && r.iv) {
                const obj = await decryptObj(vaultKey, r.iv, r.data);
                out.push({ id: r.id, ...obj });
            }
        } catch (e) { /* registro no descifrable: se omite */ }
    }
    return out;
}

async function getEntry(id) {
    if (!vaultKey) return null;
    const r = await getRawEntry(id);
    if (!r || !r.data) return null;
    try {
        const obj = await decryptObj(vaultKey, r.iv, r.data);
        return { id: r.id, ...obj };
    } catch (e) { return null; }
}

async function saveEntry(website, username, password) {
    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    const { iv, data } = await encryptObj(vaultKey, { website, username, password, createdAt });
    await putRawEntry({ id, iv, data, createdAt });
}

async function updateEntry(id, website, username, password) {
    const existing = await getRawEntry(id);
    const createdAt = existing?.createdAt || new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const { iv, data } = await encryptObj(vaultKey, { website, username, password, createdAt, updatedAt });
    await putRawEntry({ id, iv, data, createdAt });
}

function deleteEntry(id) {
    return new Promise((resolve) => {
        const req = db.transaction(['entries'], 'readwrite').objectStore('entries').delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
    });
}

// Migra entradas antiguas guardadas en texto plano al formato cifrado
async function migratePlaintextEntries() {
    const raw = await getRawEntries();
    for (const r of raw) {
        if (r.password !== undefined && !r.data) {
            const { iv, data } = await encryptObj(vaultKey, {
                website: r.website, username: r.username, password: r.password,
                createdAt: r.createdAt || new Date().toISOString()
            });
            await putRawEntry({ id: r.id, iv, data, createdAt: r.createdAt });
        }
    }
}

// ===================== CONTRASEÑA MAESTRA =====================
async function createMaster(password) {
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt, KDF_ITERATIONS);
    const verifierIv = randomBytes(12);
    const verifier = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: verifierIv }, key, textEnc.encode(VERIFIER_PLAINTEXT)
    ));
    await metaPut({ id: 'vault', salt, iterations: KDF_ITERATIONS, verifierIv, verifier, biometric: null });
    vaultKey = key;
    await migratePlaintextEntries();
}

async function unlockWithMaster(password) {
    const meta = await metaGet('vault');
    if (!meta) throw new Error('no-vault');
    const key = await deriveKey(password, meta.salt, meta.iterations || KDF_ITERATIONS);
    try {
        const txt = textDec.decode(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: u8(meta.verifierIv) }, key, u8(meta.verifier)
        ));
        if (txt !== VERIFIER_PLAINTEXT) throw new Error('bad');
    } catch (e) {
        throw new Error('wrong-password');
    }
    vaultKey = key;
}

// ===================== BIOMETRÍA (WebAuthn + PRF) =====================
async function biometricSupported() {
    try {
        if (!window.PublicKeyCredential) return false;
        if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
}

// Deriva una llave AES-GCM (para envolver/desenvolver la del baúl) desde el secreto PRF
async function wrapKeyFromSecret(secret) {
    const base = await crypto.subtle.importKey('raw', u8(secret), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: textEnc.encode('guardapass-biometric') },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['wrapKey', 'unwrapKey']
    );
}

function getPrfSecret(credential) {
    const ext = credential.getClientExtensionResults ? credential.getClientExtensionResults() : {};
    return ext && ext.prf && ext.prf.results ? ext.prf.results.first : null;
}

async function enableBiometric() {
    if (!vaultKey) throw new Error('locked');
    const meta = await metaGet('vault');
    const prfSalt = randomBytes(32);

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: randomBytes(32),
            rp: { name: 'GuardaPass', id: location.hostname },
            user: { id: randomBytes(16), name: 'guardapass', displayName: 'GuardaPass' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred'
            },
            timeout: 60000,
            extensions: { prf: { eval: { first: prfSalt } } }
        }
    });

    const credentialId = new Uint8Array(credential.rawId);
    let prfSecret = getPrfSecret(credential);

    // Algunas plataformas no devuelven el secreto PRF al crear: se pide con una aserción
    if (!prfSecret) {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: randomBytes(32),
                allowCredentials: [{ type: 'public-key', id: credentialId }],
                userVerification: 'required',
                timeout: 60000,
                extensions: { prf: { eval: { first: prfSalt } } }
            }
        });
        prfSecret = getPrfSecret(assertion);
    }

    if (!prfSecret) throw new Error('no-prf');

    const wrapKey = await wrapKeyFromSecret(prfSecret);
    const wrapIv = randomBytes(12);
    const wrappedKey = new Uint8Array(
        await crypto.subtle.wrapKey('raw', vaultKey, wrapKey, { name: 'AES-GCM', iv: wrapIv })
    );

    meta.biometric = { credentialId, prfSalt, wrapIv, wrappedKey };
    await metaPut(meta);
}

async function unlockWithBiometric() {
    const meta = await metaGet('vault');
    if (!meta || !meta.biometric) throw new Error('no-bio');
    const b = meta.biometric;

    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge: randomBytes(32),
            allowCredentials: [{ type: 'public-key', id: u8(b.credentialId) }],
            userVerification: 'required',
            timeout: 60000,
            extensions: { prf: { eval: { first: u8(b.prfSalt) } } }
        }
    });

    const prfSecret = getPrfSecret(assertion);
    if (!prfSecret) throw new Error('no-prf');

    const wrapKey = await wrapKeyFromSecret(prfSecret);
    vaultKey = await crypto.subtle.unwrapKey(
        'raw', u8(b.wrappedKey), wrapKey, { name: 'AES-GCM', iv: u8(b.wrapIv) },
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
}

async function disableBiometric() {
    const meta = await metaGet('vault');
    if (meta) { meta.biometric = null; await metaPut(meta); }
}

// ===================== BLOQUEO / AUTO-BLOQUEO =====================
const AUTO_LOCK_MS = 2 * 60 * 1000;
let lockTimer = null;

function resetLockTimer() {
    if (!vaultKey) return;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockApp, AUTO_LOCK_MS);
}

function lockApp() {
    vaultKey = null;
    clearTimeout(lockTimer);
    showLockScreen();
}

['click', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, resetLockTimer, { passive: true })
);

// ===================== UI: BLOQUEO =====================
function showLockError(msg) {
    const el = document.getElementById('lock-error');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideLockError() {
    const el = document.getElementById('lock-error');
    el.textContent = '';
    el.style.display = 'none';
}

async function showLockScreen() {
    const meta = await metaGet('vault');
    const creating = !meta;

    document.getElementById('lock-title').textContent = creating ? 'Crea tu contraseña maestra' : 'Desbloquear';
    document.getElementById('lock-subtitle').textContent = creating
        ? 'Solo tú la conocerás. Protegerá todas tus claves.'
        : 'Introduce tu contraseña maestra';
    document.getElementById('master-confirm-group').style.display = creating ? 'block' : 'none';
    document.getElementById('lock-warning').style.display = creating ? 'block' : 'none';
    document.getElementById('lock-submit').textContent = creating ? 'Crear y entrar' : 'Desbloquear';
    document.getElementById('master-password').value = '';
    document.getElementById('master-password-confirm').value = '';
    hideLockError();

    const canBio = !creating && meta.biometric && await biometricSupported();
    document.getElementById('biometric-unlock-btn').style.display = canBio ? 'flex' : 'none';

    showScreen('lock-screen');
    setTimeout(() => document.getElementById('master-password').focus(), 100);
}

async function afterUnlock() {
    resetLockTimer();
    await refreshBiometricUI();
    showScreen('main-screen');
}

async function refreshBiometricUI() {
    const supported = await biometricSupported();
    const meta = await metaGet('vault');
    const enabled = !!(meta && meta.biometric);
    document.getElementById('enable-biometric-btn').style.display = (supported && !enabled) ? 'block' : 'none';
    document.getElementById('disable-biometric-btn').style.display = (supported && enabled) ? 'block' : 'none';
}

// ===================== NAVEGACIÓN =====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screenId);
    if (el) el.classList.add('active');
}

// ===================== MODAL =====================
function showDeleteModal(id, website) {
    entryToDelete = id;
    document.getElementById('delete-website-name').textContent = website;
    document.getElementById('delete-modal').classList.add('active');
}

function hideDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    entryToDelete = null;
}

// ===================== UTILIDADES =====================
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
    const span = document.createElement('span');
    span.textContent = msg;
    const close = document.createElement('button');
    close.className = 'notification-close';
    close.textContent = '×';
    n.append(span, close);
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 50);
    const t = setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2500);
    close.onclick = () => { clearTimeout(t); n.classList.remove('show'); setTimeout(() => n.remove(), 300); };
    n.classList.add(type === 'error' ? 'notification-error' : 'notification-success');
}

const EYE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const EYE_OFF_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

// ===================== LISTA (sin innerHTML de datos → sin XSS) =====================
async function renderList() {
    const entries = await getEntries();
    const container = document.getElementById('websites-list');
    if (!container) return;
    container.innerHTML = '';

    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><p>No hay claves</p><span>Crea tu primera entrada</span>';
        container.appendChild(empty);
        return;
    }

    entries.forEach(e => {
        const item = document.createElement('div');
        item.className = 'list-item';

        const info = document.createElement('div');
        info.className = 'list-item-info';
        const w = document.createElement('span');
        w.className = 'list-item-website';
        w.textContent = e.website;
        const u = document.createElement('span');
        u.className = 'list-item-username';
        u.textContent = e.username;
        info.append(w, u);

        const actions = document.createElement('div');
        actions.className = 'list-item-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-icon-sm btn-view';
        viewBtn.title = 'Ver detalles';
        viewBtn.innerHTML = EYE_SVG;
        viewBtn.onclick = async () => { cameFromList = true; await showDetail(e.id); };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-icon-sm btn-delete-item';
        delBtn.title = 'Eliminar';
        delBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        delBtn.onclick = () => showDeleteModal(e.id, e.website);

        actions.append(viewBtn, delBtn);
        item.append(info, actions);
        container.appendChild(item);
    });
}

async function showDetail(id) {
    const e = await getEntry(id);
    if (!e) return;
    document.getElementById('detail-website').textContent = e.website;
    document.getElementById('detail-username').textContent = e.username;
    const pw = document.getElementById('detail-password');
    pw.textContent = '••••••••';
    pw.classList.add('password-masked');
    const toggle = document.getElementById('toggle-password');
    toggle.innerHTML = EYE_SVG;
    toggle.title = 'Mostrar contraseña';
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
    document.getElementById('toggle-edit-password').innerHTML = EYE_SVG;
    document.getElementById('edit-screen').dataset.entryId = id;
    showScreen('edit-screen');
}

// ===================== INICIALIZACIÓN =====================
async function initApp() {
    try { await initDB(); } catch (e) { console.error('Error DB:', e); }

    // --- Bloqueo / maestra ---
    document.getElementById('lock-form').onsubmit = async (e) => {
        e.preventDefault();
        const meta = await metaGet('vault');
        const pw = document.getElementById('master-password').value;

        if (!meta) {
            const pw2 = document.getElementById('master-password-confirm').value;
            if (pw.length < 8) return showLockError('La contraseña maestra debe tener al menos 8 caracteres.');
            if (pw !== pw2) return showLockError('Las contraseñas no coinciden.');
            try { await createMaster(pw); } catch (err) { return showLockError('No se pudo crear la contraseña maestra.'); }
        } else {
            try { await unlockWithMaster(pw); } catch (err) { return showLockError('Contraseña incorrecta.'); }
        }
        await afterUnlock();
    };

    document.getElementById('toggle-master-password').onclick = function () {
        const input = document.getElementById('master-password');
        const confirmInput = document.getElementById('master-password-confirm');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        confirmInput.type = show ? 'text' : 'password';
        this.innerHTML = show ? EYE_OFF_SVG : EYE_SVG;
    };

    document.getElementById('biometric-unlock-btn').onclick = async () => {
        try {
            await unlockWithBiometric();
            await afterUnlock();
        } catch (err) {
            showLockError('No se pudo desbloquear con biometría. Usa tu contraseña maestra.');
        }
    };

    document.getElementById('enable-biometric-btn').onclick = async () => {
        try {
            await enableBiometric();
            await refreshBiometricUI();
            notify('Desbloqueo biométrico activado');
        } catch (err) {
            if (err.message === 'no-prf') {
                notify('Tu dispositivo/navegador no permite derivar la llave biométrica', 'error');
            } else {
                notify('No se pudo activar la biometría', 'error');
            }
        }
    };

    document.getElementById('disable-biometric-btn').onclick = async () => {
        await disableBiometric();
        await refreshBiometricUI();
        notify('Desbloqueo biométrico desactivado');
    };

    document.getElementById('lock-now-btn').onclick = () => lockApp();

    // --- Navegación principal ---
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

    document.getElementById('toggle-password').onclick = async function () {
        const pwEl = document.getElementById('detail-password');
        const id = document.getElementById('detail-screen').dataset.entryId;
        const entry = await getEntry(id);
        if (!entry) return;
        if (pwEl.classList.contains('password-masked')) {
            pwEl.textContent = entry.password;
            pwEl.classList.remove('password-masked');
            this.innerHTML = EYE_OFF_SVG;
            this.title = 'Ocultar contraseña';
        } else {
            pwEl.textContent = '••••••••';
            pwEl.classList.add('password-masked');
            this.innerHTML = EYE_SVG;
            this.title = 'Mostrar contraseña';
        }
    };

    document.getElementById('toggle-edit-password').onclick = function () {
        const input = document.getElementById('edit-password');
        if (input.type === 'password') {
            input.type = 'text';
            this.innerHTML = EYE_OFF_SVG;
            this.title = 'Ocultar contraseña';
        } else {
            input.type = 'password';
            this.innerHTML = EYE_SVG;
            this.title = 'Mostrar contraseña';
        }
    };

    document.getElementById('copy-username').onclick = async () => {
        if (await copyToClipboard(document.getElementById('detail-username').textContent)) notify('Usuario copiado');
    };
    document.getElementById('copy-password').onclick = async () => {
        const entry = await getEntry(document.getElementById('detail-screen').dataset.entryId);
        if (entry && await copyToClipboard(entry.password)) notify('Contraseña copiada');
    };

    document.getElementById('confirm-delete').onclick = async () => {
        if (entryToDelete) { await deleteEntry(entryToDelete); hideDeleteModal(); notify('Entrada eliminada'); await renderList(); showScreen('list-screen'); }
    };
    document.getElementById('cancel-delete').onclick = () => { hideDeleteModal(); showScreen('list-screen'); };
    document.getElementById('delete-modal').onclick = (e) => { if (e.target === document.getElementById('delete-modal')) { hideDeleteModal(); showScreen('list-screen'); } };

    // Arranca siempre bloqueada
    await showLockScreen();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
