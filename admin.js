// --- IMPORTACIONES ---
import { 
    db, dbHistoryRef, dbPlayersRef, localPlayersCache, 
    loggedInPlayerId, showFeedback, adminFeedback, adminWeekFeedback,
    getInitialGamePlays 
} from './main.js';
import { 
    addDoc, doc, setDoc, writeBatch, collection 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- DOM ELEMENTS ---
const adminLockScreen = document.getElementById('admin-lock-screen');
const adminPasswordInput = document.getElementById('admin-password');
const adminUnlockButton = document.getElementById('admin-unlock-button');
const adminLockFeedback = document.getElementById('admin-lock-feedback');
const adminContent = document.getElementById('admin-content');

const adminPlayerSelect = document.getElementById('admin-player-select');
const adminPlayerSelectLoser = document.getElementById('admin-player-select-loser');
const adminSurrenderCheckbox = document.getElementById('admin-surrender-checkbox');
const adminFlawlessCheckbox = document.getElementById('admin-flawless-checkbox');
const adminSubmitButton = document.getElementById('admin-submit-button');

const adminNewPlayerName = document.getElementById('admin-new-player-name');
const adminNewPlayerDeck = document.getElementById('admin-new-player-deck');
const adminAddPlayerButton = document.getElementById('admin-add-player-button');

const adminResetWeekButton = document.getElementById('admin-reset-week-button');

const adminCardInventorySelect = document.getElementById('admin-card-inventory-select');
const adminCardInventoryList = document.getElementById('admin-card-inventory-list');

// --- INICIALIZACIÓN ---
export function initAdmin() {
    // Listener para desbloquear panel
    adminUnlockButton.addEventListener('click', () => {
        const password = adminPasswordInput.value;
        if (password === 'as17sa71') {
            adminLockScreen.classList.add('hidden');
            adminContent.classList.remove('hidden');
            adminLockFeedback.textContent = '';
            adminPasswordInput.value = '';
        } else {
            adminLockFeedback.textContent = 'Contraseña incorrecta.';
            setTimeout(() => {
                adminLockFeedback.textContent = '';
            }, 3000);
        }
    });

    // Listener para registrar duelo
    adminSubmitButton.addEventListener('click', registerDuel);

    // Listener para añadir jugador
    adminAddPlayerButton.addEventListener('click', addNewPlayer);

    // Listener para resetear semana
    adminResetWeekButton.addEventListener('click', resetWeeklyRanking);

    // Listener para el selector de inventario
    adminCardInventorySelect.addEventListener('change', (e) => displayPlayerInventory(e.target.value));
    // Escuchar el evento personalizado de main.js para actualizar la UI
    document.addEventListener('adminInventorySelectChange', (e) => displayPlayerInventory(e.detail));
}

// --- LÓGICA DE FUNCIONES ---

async function registerDuel() {
    const winnerId = adminPlayerSelect.value;
    const loserId = adminPlayerSelectLoser.value;
    if (winnerId === loserId) return showFeedback(adminFeedback, "Un jugador no puede enfrentarse a sí mismo.", true);
    
    const didSurrender = adminSurrenderCheckbox.checked;
    const isFlawless = adminFlawlessCheckbox.checked; 
    const winner = localPlayersCache.get(winnerId);
    const loser = localPlayersCache.get(loserId);
    if (!winner || !loser) return showFeedback(adminFeedback, "Error: Jugadores no encontrados.", true);

    let winnerDpChange = 100; 
    let loserDpChange = 0;   
    let eventType = "win";
    let historyBonuses = []; 

    if (didSurrender) {
        winnerDpChange += 50; 
        loserDpChange = -50;  
        eventType = "penalty";
        historyBonuses.push("Surrender");
    }
    if (isFlawless) {
        winnerDpChange += 100;
        historyBonuses.push("Flawless");
    }
    const bonusText = historyBonuses.length > 0 ? ` (${historyBonuses.join(', ')})` : '';
    const historyText = `${winner.name} (+${winnerDpChange} DP) venció a ${loser.name} (${loserDpChange} DP)${bonusText}.`;
    const newWinnerDp = winner.dp + winnerDpChange;
    const newLoserDp = loser.dp + loserDpChange;
    const newWinnerWins = (winner.wins_semanales || 0) + 1;

    try {
        const batch = writeBatch(db);
        const winnerRef = doc(dbPlayersRef, winnerId);
        batch.update(winnerRef, { dp: newWinnerDp, wins_semanales: newWinnerWins });
        if (loserDpChange !== 0) {
            const loserRef = doc(dbPlayersRef, loserId);
            batch.update(loserRef, { dp: newLoserDp });
        }
        await batch.commit();

        const historyEntry = { text: historyText, timestamp: Date.now(), type: eventType };
        await addDoc(dbHistoryRef, historyEntry);
        
        showFeedback(adminFeedback, `Duelo registrado: ${winner.name} vs ${loser.name}.`);
        adminSurrenderCheckbox.checked = false;
        adminFlawlessCheckbox.checked = false;
    } catch (error) {
        console.error("Error al registrar duelo:", error);
        showFeedback(adminFeedback, "Error al registrar el duelo.", true);
    }
}

async function addNewPlayer() {
    const name = adminNewPlayerName.value.trim();
    const deck = adminNewPlayerDeck.value;
    if (!name) return showFeedback(adminFeedback, "El nombre no puede estar vacío.", true);
    if (localPlayersCache.has(name)) return showFeedback(adminFeedback, "Ese jugador ya existe.", true);
    try {
        const newPlayer = {
            name: name, 
            dp: 0, 
            deck: deck, 
            wins_semanales: 0, 
            card_collection: {},
            game_plays: getInitialGamePlays() // Añadir game_plays a nuevos jugadores
        };
        await setDoc(doc(dbPlayersRef, name), newPlayer);
        const historyEntry = {
            text: `Nuevo duelista añadido: ${name} (Deck: ${deck}) con 0 DP.`,
            timestamp: Date.now(), type: 'admin'
        };
        await addDoc(dbHistoryRef, historyEntry);
        showFeedback(adminFeedback, `¡Jugador ${name} añadido! (Recuerda añadir su contraseña al código).`);
        adminNewPlayerName.value = '';
    } catch (error) {
        console.error("Error al añadir jugador:", error);
        showFeedback(adminFeedback, "Error al añadir jugador.", true);
    }
}

async function resetWeeklyRanking() {
    const players = Array.from(localPlayersCache.values());
    if (players.length === 0) return showFeedback(adminWeekFeedback, "No hay jugadores para reiniciar.", true);
    
    const sortedPlayers = [...players].sort((a, b) => (b.wins_semanales || 0) - (a.wins_semanales || 0));
    const winner = sortedPlayers[0];

    if (!winner || (winner.wins_semanales || 0) === 0) {
        return showFeedback(adminWeekFeedback, "Nadie ha ganado duelos esta semana. No se puede cerrar.", true);
    }
    
    const winnerName = winner.name;
    const winnerWins = winner.wins_semanales;

    try {
        const batch = writeBatch(db);
        players.forEach(player => {
            const playerRef = doc(dbPlayersRef, player.id);
            batch.update(playerRef, { wins_semanales: 0 });
        });
        const historyEntry = {
            text: `🏆 ¡CIERRE DE SEMANA! El ganador es ${winnerName} con ${winnerWins} victorias. El ranking semanal se ha reiniciado.`,
            timestamp: Date.now(), type: 'admin'
        };
        const historyDocRef = doc(collection(db, dbHistoryRef.path));
        batch.set(historyDocRef, historyEntry);
        await batch.commit();
        showFeedback(adminWeekFeedback, `¡Semana cerrada! Ganador: ${winnerName}.`);
    } catch (error) {
        console.error("Error al cerrar la semana:", error);
        showFeedback(adminWeekFeedback, "Error al cerrar la semana.", true);
    }
}

function displayPlayerInventory(playerId) {
    if (!playerId) { 
        adminCardInventoryList.innerHTML = `<li class="text-gray-400">Selecciona un jugador...</li>`;
        return;
    }
    const player = localPlayersCache.get(playerId);
    adminCardInventoryList.innerHTML = '';
    if (!player || !player.card_collection || Object.keys(player.card_collection).length === 0) {
        adminCardInventoryList.innerHTML = `<li class="text-gray-400">Este jugador no tiene cartas.</li>`;
        return;
    }
    const collection = player.card_collection;
    const sortedCardNames = Object.keys(collection).sort();
    sortedCardNames.forEach(cardName => {
        const qty = collection[cardName];
        const li = document.createElement('li');
        li.className = "text-gray-200 py-1";
        li.innerHTML = `${cardName} <span class="ml-2 font-bold text-lg text-yellow-300">(x${qty})</span>`;
        adminCardInventoryList.appendChild(li);
    });
}
