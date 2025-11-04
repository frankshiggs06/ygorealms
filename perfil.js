// --- PERFIL (Página) ---
import { requireAuth, initializeAuth, updateUserDisplay, sessionManager, getPlayersCache, onSessionChange, getCurrentUser } from './auth.js';
import { db, dbPlayersRef, doc, updateDoc, getDocs, query, collection } from './firebase.js';

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

let avatarImg,
    passwordOldInput,
    passwordNewInput,
    passwordSaveBtn,
    passwordFeedback;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeAuth();
    updateUserDisplay();
    if (!requireAuth()) return;
    // Resolver elementos
    avatarImg = document.getElementById('profile-avatar-img');
    passwordOldInput = document.getElementById('profile-password-old');
    passwordNewInput = document.getElementById('profile-password-new');
    passwordSaveBtn = document.getElementById('profile-password-save');
    passwordFeedback = document.getElementById('profile-password-feedback');

    initProfilePage();

    // Mantener encabezado sincronizado si cambia la sesión
    onSessionChange(() => {
        updateUserDisplay();
    });
});

function showMsg(el, text, isError = false) {
    if (!el) return;
    el.textContent = text || '';
    el.className = `text-xs ${isError ? 'text-red-400' : 'text-green-400'} h-5`;
}

// Avatar por defecto según deck
function getDefaultAvatarForDeck(deck) {
    const d = (deck || '').toLowerCase();
    if (/azul|blue|kaiba/.test(d)) return './perfiles/kaiba.png';
    if (/roj|red|joey/.test(d)) return './perfiles/joey.png';
    if (/toon|pegasus|pegaso|ojo/.test(d)) return './perfiles/pegasus.png';
    return './perfiles/yugi.png';
}

function initProfilePage() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const cache = getPlayersCache();
    const player = cache.get(currentUser.id);
    if (!player) return;

    // Avatar: solo mostrar por defecto (o el guardado si existe)
    avatarImg.src = player.avatarData || getDefaultAvatarForDeck(player.deck);

    // Contraseña
    passwordSaveBtn.addEventListener('click', async () => {
        const oldPass = (passwordOldInput.value || '').trim();
        const newPass = (passwordNewInput.value || '').trim();
        if (!oldPass || !newPass) { showMsg(passwordFeedback, 'Completa ambas contraseñas.', true); return; }
        if (player.password !== oldPass) { showMsg(passwordFeedback, 'La contraseña actual no coincide.', true); return; }
        if (newPass.length < 4) { showMsg(passwordFeedback, 'La nueva contraseña es muy corta.', true); return; }
        try {
            await updateDoc(doc(dbPlayersRef, player.id), { password: newPass, passwordUpdatedAt: Date.now() });
            const updated = { ...player, password: newPass };
            sessionManager.saveSession(updated);
            showMsg(passwordFeedback, 'Contraseña actualizada.');
            passwordOldInput.value = '';
            passwordNewInput.value = '';
        } catch (err) {
            console.error('Error cambiando contraseña:', err);
            showMsg(passwordFeedback, 'No se pudo actualizar la contraseña.', true);
        }
    });
}
