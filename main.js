// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, setLogLevel, collection, doc, 
    onSnapshot, addDoc, setDoc, updateDoc, 
    getDocs, query, writeBatch 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- IMPORTACIONES DE MÓDULOS LOCALES ---
import { initStore } from './store.js';
import { initGames } from './games.js';
import { initAdmin } from './admin.js';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyABsmkXrhStMBi6517stczD0KcgVAPNm_A",
    authDomain: "torneo-duelistas-f535a.firebaseapp.com",
    projectId: "torneo-duelistas-f535a",
    storageBucket: "torneo-duelistas-f535a.firebasestorage.app",
    messagingSenderId: "701455896792",
    appId: "1:701455896792:web:667ec25f0defd7c98c87ad"
};
        
// --- VARIABLES GLOBALES Y EXPORTACIONES ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('debug'); 

let userId;
let dbPlayersRef; 
let dbHistoryRef; 
let localPlayersCache = new Map();
let loggedInPlayerId = null;

const playerPasswords = {
    "Pepito": "pepe",
    "Prometeus": "falerini",
    "Rela": "itachikun10"
};
const TOTAL_GAMES = 6;
const DAILY_PLAY_LIMIT = 3;

// Exportar variables y funciones que otros módulos necesitarán
export { 
    db, auth, dbPlayersRef, dbHistoryRef, 
    localPlayersCache, loggedInPlayerId, playerPasswords, 
    showFeedback, recordGamePlay, getGamePlays, getInitialGamePlays,
    DAILY_PLAY_LIMIT, TOTAL_GAMES,
    packButtons, purchaseFeedback,
    adminFeedback, adminWeekFeedback
};

// --- DOM ELEMENTS (Solo los necesarios para main.js) ---
const userTableBody = document.getElementById('user-table-body');
const historyList = document.getElementById('history-list');
const rankingTableBody = document.getElementById('ranking-table-body');
const loginScreen = document.getElementById('login-screen');
const loginButton = document.getElementById('login-button');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginFeedback = document.getElementById('login-feedback');
const dbLoadingFeedback = document.getElementById('db-loading-feedback');
const appContent = document.getElementById('app-content');
const loggedInUserDisplay = document.getElementById('logged-in-user-display');
const packBuyerDisplay = document.getElementById('pack-buyer-display');
const adminUnlockButton = document.getElementById('admin-unlock-button');
const adminLockScreen = document.getElementById('admin-lock-screen');
const purchaseFeedback = document.getElementById('purchase-feedback');
const adminFeedback = document.getElementById('admin-feedback');
const adminWeekFeedback = document.getElementById('admin-week-feedback');
const packButtons = [
    document.getElementById('buy-pack-1'),
    document.getElementById('buy-pack-2'),
    document.getElementById('buy-pack-3'),
    document.getElementById('buy-pack-4'),
    document.getElementById('buy-pack-5'),
    document.getElementById('buy-pack-6')
];
// (DOM elements para store, games, y admin se obtendrán en sus propios módulos)


// --- AUTENTICACIÓN Y INICIALIZACIÓN ---

async function initializeAppWithAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            
            const basePath = `torneo/torneo-data`; 
            dbPlayersRef = collection(db, `${basePath}/players`);
            dbHistoryRef = collection(db, `${basePath}/history`);

            await seedInitialData();
            initPlayersListener();
            initHistoryListener();
            
            dbLoadingFeedback.textContent = "¡Conexión exitosa!";
            dbLoadingFeedback.className = "text-green-400 text-sm h-5 text-center";
            
            // Iniciar los módulos (excepto login, que está aquí)
            initStore();
            initGames();
            initAdmin();

        } else {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Error de autenticación:", error);
                dbLoadingFeedback.textContent = "Error al conectar con la DB.";
                dbLoadingFeedback.className = "text-red-400 text-sm h-5 text-center";
            }
        }
    });
}

// --- ESTRUCTURA DE DATOS PARA JUEGOS ---
function getInitialGamePlays() {
    let plays = {};
    for (let i = 1; i <= TOTAL_GAMES; i++) {
        plays[`game_${i}`] = { count: 0, reset_timestamp: null };
    }
    return plays;
}

// --- LÓGICA DE DATOS INICIALES (SEEDING) ---
async function seedInitialData() {
    const playerQuery = query(dbPlayersRef);
    const snapshot = await getDocs(playerQuery);
    if (snapshot.empty) {
        console.log("Base de datos vacía. Creando datos iniciales...");
        dbLoadingFeedback.textContent = "Creando base de datos inicial...";
        
        const initialGamePlays = getInitialGamePlays();
        const initialPlayers = [
            { id: "Pepito", name: "Pepito", dp: 0, deck: "Yugi", wins_semanales: 0, card_collection: {}, game_plays: initialGamePlays },
            { id: "Prometeus", name: "Prometeus", dp: 0, deck: "Joey", wins_semanales: 0, card_collection: {}, game_plays: initialGamePlays },
            { id: "Rela", name: "Rela", dp: 0, deck: "Kaiba", wins_semanales: 0, card_collection: {}, game_plays: initialGamePlays }
        ];
        
        const initialHistory = []; 

        for (const player of initialPlayers) {
            await setDoc(doc(dbPlayersRef, player.id), player);
        }
        for (const event of initialHistory) {
            await addDoc(dbHistoryRef, event);
        }
    } else {
        console.log("Datos encontrados. Omitiendo creación inicial.");
    }
}

// --- RESETEO DE LÍMITES DE JUEGO ---
async function checkAndResetGamePlays(player) {
    const now = Date.now();
    let plays = player.game_plays || getInitialGamePlays();
    let needsUpdate = false;

    for (let i = 1; i <= TOTAL_GAMES; i++) {
        const gameId = `game_${i}`;
        const gameData = plays[gameId] || { count: 0, reset_timestamp: null };

        if (gameData.reset_timestamp && now > gameData.reset_timestamp) {
            gameData.count = 0;
            gameData.reset_timestamp = null;
            plays[gameId] = gameData;
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        console.log(`Reseteando juegos para ${player.name}`);
        try {
            await updateDoc(doc(dbPlayersRef, player.id), { game_plays: plays });
            player.game_plays = plays;
            localPlayersCache.set(player.id, player);
        } catch (error) {
            console.error("Error al resetear juegos:", error);
        }
    }
    return player; 
}

// --- LISTENERS (TIEMPO REAL) ---
function initPlayersListener() {
    onSnapshot(dbPlayersRef, async (snapshot) => {
        const playerPromises = [];
        snapshot.forEach((doc) => {
            const playerData = doc.data();
            playerData.id = doc.id;
            playerPromises.push(checkAndResetGamePlays(playerData));
        });
        
        const updatedPlayers = await Promise.all(playerPromises);
        localPlayersCache.clear();
        updatedPlayers.forEach(player => localPlayersCache.set(player.id, player));
        
        const players = Array.from(localPlayersCache.values());
        
        const sortedByDp = [...players].sort((a, b) => b.dp - a.dp);
        const sortedByWins = [...players].sort((a, b) => (b.wins_semanales || 0) - (a.wins_semanales || 0));

        // Actualizar UI
        updateUserTable(sortedByDp);
        updateRankingTable(sortedByWins);
        updateAdminDropdowns(players);
        
        if (loggedInPlayerId) {
            updateGameButtonsUI();
        }
    });
}

function initHistoryListener() {
    onSnapshot(dbHistoryRef, (snapshot) => {
        const historyEvents = [];
        snapshot.forEach((doc) => {
            historyEvents.push(doc.data());
        });
        historyEvents.sort((a, b) => b.timestamp - a.timestamp);
        historyList.innerHTML = '';

        if (historyEvents.length === 0) {
            historyList.innerHTML = `<li class="bg-gray-700 p-3 rounded-lg text-center text-gray-400">No hay eventos en la historia.</li>`;
            return;
        }

        historyEvents.forEach(event => {
            const li = document.createElement('li');
            const eventClasses = getHistoryEntryClass(event.type);
            const date = new Date(event.timestamp).toLocaleString('es-ES', { timeStyle: 'short', dateStyle: 'short' });

            li.className = `bg-gray-700 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center ${eventClasses.bg}`;
            li.innerHTML = `
                <span class="text-gray-400 text-sm w-full sm:w-1/4 mb-1 sm:mb-0">${date}</span>
                <p class="w-full sm:w-3/4 ${eventClasses.text}">
                    ${event.text}
                </p>
            `;
            historyList.appendChild(li);
        });
    });
}

// --- FUNCIONES DE ACTUALIZACIÓN DE UI (DOM) ---

function updateUserTable(players) {
    userTableBody.innerHTML = '';
    if (players.length === 0) {
        userTableBody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-gray-400">Cargando jugadores...</td></tr>`;
        return;
    }
    players.forEach(player => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-700 transition duration-150";
        row.innerHTML = `
            <td class="px-4 py-4 whitespace-nowrap text-lg font-semibold text-white">${player.name}</td>
            <td class="px-4 py-4 whitespace-nowrap text-2xl font-extrabold text-yellow-400 dp-score">${player.dp}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-400">${player.deck}</td>
        `;
        userTableBody.appendChild(row);
    });
}

function updateRankingTable(players) {
    rankingTableBody.innerHTML = '';
    if (players.length === 0) {
        rankingTableBody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-gray-400">Cargando ranking...</td></tr>`;
        return;
    }
    players.forEach((player, index) => {
        const rankRow = document.createElement('tr');
        rankRow.className = "hover:bg-gray-700 transition duration-150";
        rankRow.innerHTML = `
            <td class="px-4 py-4 whitespace-nowrap text-lg font-bold text-gray-300">${index + 1}</td>
            <td class="px-4 py-4 whitespace-nowrap text-lg font-semibold text-white">${player.name}</td>
            <td class="px-4 py-4 whitespace-nowrap text-2xl font-extrabold text-green-400">${player.wins_semanales || 0}</td>
        `;
        rankingTableBody.appendChild(rankRow);
    });
}

function updateAdminDropdowns(players) {
    const adminPlayerSelect = document.getElementById('admin-player-select');
    const adminPlayerSelectLoser = document.getElementById('admin-player-select-loser');
    const adminCardInventorySelect = document.getElementById('admin-card-inventory-select');
    
    adminPlayerSelect.innerHTML = '';
    adminPlayerSelectLoser.innerHTML = '';
    adminCardInventorySelect.innerHTML = '';

    if (players.length === 0) {
        [adminPlayerSelect, adminPlayerSelectLoser, adminCardInventorySelect].forEach(sel => {
            sel.innerHTML = `<option>Cargando...</option>`;
        });
        return;
    }

    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `${player.name} (${player.dp} DP)`;
        
        const simpleOption = document.createElement('option');
        simpleOption.value = player.id;
        simpleOption.textContent = player.name;
        
        adminPlayerSelect.appendChild(option.cloneNode(true));
        adminPlayerSelectLoser.appendChild(option.cloneNode(true));
        adminCardInventorySelect.appendChild(simpleOption.cloneNode(true));
    });

    // Actualizar la vista de inventario
    const currentSelection = loggedInPlayerId || players[0].id;
    if(adminCardInventorySelect.querySelector(`option[value="${currentSelection}"]`)) {
        adminCardInventorySelect.value = currentSelection;
    }
    document.dispatchEvent(new CustomEvent('adminInventorySelectChange', { detail: adminCardInventorySelect.value }));
}


function updateGameButtonsUI() {
    if (!loggedInPlayerId) return;
    const player = localPlayersCache.get(loggedInPlayerId);
    if (!player) return;

    const plays = player.game_plays || getInitialGamePlays();
    const gameModals = {
        "game_1": { btnText: document.getElementById('game-1-button-text'), btn: document.getElementById('game-1-button') },
        "game_2": { btnText: document.getElementById('game-2-button-text'), btn: document.getElementById('game-2-button') },
        "game_3": { btnText: document.getElementById('game-3-button-text'), btn: document.getElementById('game-3-button') },
        "game_4": { btnText: document.getElementById('game-4-button-text'), btn: document.getElementById('game-4-button') },
        "game_5": { btnText: document.getElementById('game-5-button-text'), btn: document.getElementById('game-5-button') },
        "game_6": { btnText: document.getElementById('game-6-button-text'), btn: document.getElementById('game-6-button') }
    };

    for (let i = 1; i <= TOTAL_GAMES; i++) {
        const gameId = `game_${i}`;
        const gameData = plays[gameId] || { count: 0, reset_timestamp: null };
        const ui = gameModals[gameId];
        
        const playsLeft = DAILY_PLAY_LIMIT - gameData.count;
        ui.btnText.textContent = `Jugar (${playsLeft}/${DAILY_PLAY_LIMIT} Oportunidades)`;
        
        if (playsLeft <= 0) {
            ui.btn.disabled = true;
        } else {
            ui.btn.disabled = false;
        }
    }
}

// --- LÓGICA DE LOGIN ---
function initLogin() {
    loginButton.addEventListener('click', () => {
        const usernameInput = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value;
        
        if (localPlayersCache.size === 0) {
            loginFeedback.textContent = 'Aún conectando con la base de datos...';
            setTimeout(() => { loginFeedback.textContent = ''; }, 3000);
            return;
        }

        let foundPlayer = null;
        for (const player of localPlayersCache.values()) {
            if (player.name.toLowerCase() === usernameInput.toLowerCase()) {
                foundPlayer = player;
                break;
            }
        }

        if (foundPlayer && playerPasswords[foundPlayer.name] === password) {
            loggedInPlayerId = foundPlayer.name; 
            appContent.classList.remove('hidden'); 
            loginScreen.classList.add('hidden'); 
            
            loggedInUserDisplay.textContent = foundPlayer.name;
            packBuyerDisplay.textContent = foundPlayer.name;
            adminUnlockButton.disabled = false; 
            adminLockScreen.querySelector('p.text-xs').classList.add('hidden'); 
            
            updateGameButtonsUI(); // Actualiza los botones de juego al loguear
            
        } else {
            loginFeedback.textContent = 'Usuario o contraseña incorrectos.';
            setTimeout(() => { loginFeedback.textContent = ''; }, 3000);
        }
    });
    
    loginPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginButton.click();
        }
    });
}

// --- FUNCIONES DE AYUDA (HELPERS) ---

function getHistoryEntryClass(type) {
    switch(type) {
        case 'win': return { bg: 'border-l-4 border-green-500', text: 'text-green-300' };
        case 'buy': return { bg: 'border-l-4 border-blue-500', text: 'text-blue-300' };
        case 'admin': return { bg: 'border-l-4 border-indigo-500', text: 'text-indigo-300' };
        case 'penalty': return { bg: 'border-l-4 border-red-500', text: 'text-red-300' };
        case 'game_win': return { bg: 'border-l-4 border-pink-500', text: 'text-pink-300' };
        case 'game_lose': return { bg: 'border-l-4 border-gray-500', text: 'text-gray-300' };
        default: return { bg: '', text: 'text-gray-100' };
    }
}

function showFeedback(element, message, isError = false, duration = 3000) {
    element.textContent = message;
    element.className = isError 
        ? 'text-red-400 text-sm mt-2 h-5 feedback-message opacity-100 text-center' 
        : 'text-yellow-300 text-sm mt-2 h-5 feedback-message opacity-100 text-center';
    if(duration > 0) {
        setTimeout(() => {
            element.style.opacity = '0';
        }, duration);
    }
}

function getGamePlays(gameId) {
    const player = localPlayersCache.get(loggedInPlayerId);
    if (!player) return { canPlay: false, reason: 'Jugador no encontrado.' }; // Guardia de seguridad
    
    const data = (player.game_plays && player.game_plays[gameId]) ? 
                 player.game_plays[gameId] : 
                 { count: 0, reset_timestamp: null };

    const now = Date.now();
    
    if (data.reset_timestamp && now < data.reset_timestamp && data.count >= DAILY_PLAY_LIMIT) {
        return { canPlay: false, reason: 'Límite diario alcanzado. Vuelve más tarde.' };
    }
    
    return { canPlay: true, currentData: data };
}

async function recordGamePlay(gameId, currentData, dpChange, historyText, historyType) {
    const player = localPlayersCache.get(loggedInPlayerId);
    const now = Date.now();

    const newCount = currentData.count + 1;
    const newTimestamp = currentData.reset_timestamp || (now + 24 * 60 * 60 * 1000); 

    let newPlayData = { ...(player.game_plays || getInitialGamePlays()) };
    newPlayData[gameId] = { count: newCount, reset_timestamp: newTimestamp };
    
    const newDp = player.dp + dpChange;

    const playerRef = doc(dbPlayersRef, loggedInPlayerId);
    const historyDocRef = doc(collection(db, dbHistoryRef.path));
    
    const historyEntry = {
        text: historyText,
        timestamp: now,
        type: historyType
    };

    const batch = writeBatch(db);
    batch.update(playerRef, { dp: newDp, game_plays: newPlayData });
    batch.set(historyDocRef, historyEntry);
    
    await batch.commit();
}


// --- INICIAR LA APLICACIÓN ---
initLogin();
initializeAppWithAuth();