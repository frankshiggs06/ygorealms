// --- IMPORTACIONES DE FIREBASE ---
const loginVideo = document.getElementById('loginVideo');
let firstPlay = true;

if (loginVideo) {
    loginVideo.addEventListener('ended', () => {
        if (firstPlay) {
            loginVideo.muted = true;
            firstPlay = false;
        }
        loginVideo.currentTime = 0;
        loginVideo.play();
    });
}
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getFirestore, setLogLevel, collection, doc, 
    onSnapshot, addDoc, setDoc, updateDoc, 
    getDocs, query, writeBatch, deleteDoc, where // Añadido where para consultas filtradas
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Importar el gestor de sesión global para comprobar inicio de sesión
import { sessionManager, getCurrentUser, isLoggedIn } from './auth.js';

// --- FUNCIONALIDAD DE SECCIONES DESPLEGABLES ---
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar las secciones desplegables cuando el DOM esté cargado
    initCollapsibleSections();
});

function initCollapsibleSections() {
    // Obtener todas las secciones
    const sections = document.querySelectorAll('section');
    
    sections.forEach(section => {
        const sectionId = section.id;
        // No hacer desplegables las secciones especificadas
        if (sectionId === 'ranking' || sectionId === 'juegos' || sectionId === 'eventos') {
            return;
        }
        
        const title = section.querySelector('h2');
        if (title) {
            // Añadir clase para estilo
            title.classList.add('section-title');
            // Añadir clase collapsed inicialmente
            title.classList.add('collapsed');
            
            // Obtener el contenido de la sección (todo excepto el título)
            const content = document.createElement('div');
            content.classList.add('section-content');
            // Añadir clase collapsed inicialmente
            content.classList.add('collapsed');
            
            // Mover todos los elementos después del título al contenedor de contenido
            let nextElement = title.nextElementSibling;
            while (nextElement) {
                const current = nextElement;
                nextElement = nextElement.nextElementSibling;
                content.appendChild(current);
            }
            
            // Añadir el contenedor de contenido después del título
            title.after(content);
            
            // Añadir evento de clic al título
            title.addEventListener('click', () => {
                title.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            });
        }
    });
}

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyABsmkXrhStMBi6517stczD0KcgVAPNm_A",
    authDomain: "torneo-duelistas-f535a.firebaseapp.com",
    projectId: "torneo-duelistas-f535a",
    storageBucket: "torneo-duelistas-f535a.firebasestorage.app",
    messagingSenderId: "701455896792",
    appId: "1:701455896792:web:667ec25f0defd7c98c87ad"
};
        
// --- VARIABLES GLOBALES ---
// Evitar doble inicialización si otro módulo ya creó la app
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('debug'); 

let userId;
let dbPlayersRef; 
let dbHistoryRef; 
let dbMarketplaceRef; // NUEVO: Para el Marketplace
let dbCardbaseRef; // NUEVO: Para la base de cartas
let localPlayersCache = new Map();
let localMarketplaceCache = new Map(); // NUEVO: Cache para listados
let loggedInPlayerId = sessionManager.getCurrentUser()?.name;

const TOTAL_GAMES = 3; // Reducido de 6 a 3
const DAILY_PLAY_LIMIT = 3;

// --- DOM ELEMENTS (MAIN) ---
const dpTableBody = document.getElementById('dp-table-body');
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
// NUEVO: DOM del Marketplace
const marketSellCardSelect = document.getElementById('market-sell-card-select');
const marketSellPriceInput = document.getElementById('market-sell-price');
const marketSellButton = document.getElementById('market-sell-button');
const marketSellFeedback = document.getElementById('market-sell-feedback');
const marketListingsBody = document.getElementById('market-listings-body');
const marketBuyFeedback = document.getElementById('market-buy-feedback');
// DOM del Constructor de Deck (solo existe en packs.html)
const deckBuilderGrid = document.getElementById('deck-builder-grid');
const deckBuilderFeedback = document.getElementById('deck-builder-feedback');


// --- AUTENTICACIÓN Y INICIALIZACIÓN ---

export async function initializeAppWithAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            
            const basePath = `torneo/torneo-data`; 
            dbPlayersRef = collection(db, `${basePath}/players`);
            dbHistoryRef = collection(db, `${basePath}/history`);
            dbMarketplaceRef = collection(db, `${basePath}/marketplace`); // NUEVO
            dbCardbaseRef = collection(db, `${basePath}/cardbase`); // NUEVO: Para la base de cartas

            await seedInitialData();
            initPlayersListener();
            initHistoryListener();
            initMarketplaceListener(); // NUEVO
            
            if (dbLoadingFeedback) {
                dbLoadingFeedback.textContent = "¡Conexión exitosa!";
                dbLoadingFeedback.className = "text-green-400 text-sm h-5 text-center";
            }
            
            // Iniciar los "módulos" (ahora son solo funciones)
            initStore();
            initGames();
            initAdmin();
            initMarketplace(); // NUEVO

        } else {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Error de autenticación:", error);
                if (dbLoadingFeedback) {
                    dbLoadingFeedback.textContent = "Error al conectar con la DB.";
                    dbLoadingFeedback.className = "text-red-400 text-sm h-5 text-center";
                }
            }
        }
    });
}

// --- ESTRUCTURA DE DATOS PARA JUEGOS ---
function getInitialGamePlays() {
    let plays = {};
    for (let i = 1; i <= TOTAL_GAMES; i++) { // TOTAL_GAMES ahora es 3
        plays[`game_${i}`] = { count: 0, reset_timestamp: null };
    }
    return plays;
}

// --- LÓGICA DE DATOS INICIALES (SEEDING) ---
async function seedInitialData() {
    const playerQuery = query(dbPlayersRef);
    const snapshot = await getDocs(playerQuery);
    if (snapshot.empty) {
        console.log("Base de datos vacía. Sin usuarios de prueba.");
        if (typeof dbLoadingFeedback !== 'undefined' && dbLoadingFeedback) {
            dbLoadingFeedback.textContent = "Conecta y usa registro para crear usuarios.";
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

    for (let i = 1; i <= TOTAL_GAMES; i++) { // TOTAL_GAMES ahora es 3
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
            await updateDoc(doc(dbPlayersRef, player.name), { game_plays: plays });
            player.game_plays = plays;
            localPlayersCache.set(player.name, player);
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
            playerData.name = doc.id; // Usando el ID del documento como nombre
            playerPromises.push(checkAndResetGamePlays(playerData));
        });
        
        const updatedPlayers = await Promise.all(playerPromises);
        localPlayersCache.clear();
        updatedPlayers.forEach(player => localPlayersCache.set(player.name, player));
        
        const players = Array.from(localPlayersCache.values());
        
        const sortedByDp = [...players].sort((a, b) => b.dp - a.dp);
        const sortedByWins = [...players].sort((a, b) => (b.wins_semanales || 0) - (a.wins_semanales || 0));

        // Actualizar UI
        updateDPTable(sortedByDp);
        updateRankingTable(sortedByWins);
        updateAdminDropdowns(players);
        updateMarketplaceSellDropdown(); // NUEVO: Actualizar dropdown de venta
        updateMarketplaceListings(); // <<< ¡ESTA ES LA CORRECCIÓN!
        // Actualizar constructor de deck si estamos en packs.html
        if (deckBuilderGrid) {
            renderDeckBuilder();
        }
        
        if (loggedInPlayerId) {
            updateGameButtonsUI();
            updatePackButtonsUI(); // NUEVO: Actualizar botones de pack
        }
    });
}
// Normalizes duel history text for display to ensure both DP changes are visible.
function normalizeDuelHistoryText(text) {
    try {
        if (typeof text !== 'string') return text;
        if (!text.startsWith('Duelo registrado:')) return text;

        const hasWinner = /Ganador\s*\+\d+\s*DP/.test(text);
        const hasLoser = /Perdedor\s*[+-]\d+\s*DP/.test(text);

        // If loser DP is present but winner DP is missing, reconstruct winner DP based on flags
        if (!hasWinner && hasLoser) {
            const surrender = /\(Rendición\)/.test(text);
            const flawless = /\(Flawless\)/.test(text);
            let winnerGain = 100; // base gain
            if (surrender) winnerGain += 50;
            if (flawless) winnerGain += 100;

            // Insert the winner DP before the loser DP inside the first parentheses block
            // e.g. "(Perdedor +25 DP)" => "(Ganador +100 DP y Perdedor +25 DP)"
            return text.replace(/\((Perdedor\s*[+-]\d+\s*DP)\)/, `(Ganador +${winnerGain} DP y $1)`);
        }
    } catch (_) {
        // Fail-safe: return original text if anything unexpected happens
        return text;
    }
    return text;
}

function initHistoryListener() {
    if (!historyList) return; // Guarda: elemento puede no existir en todas las páginas
    
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
                    ${normalizeDuelHistoryText(event.text)}
                </p>
            `;
            historyList.appendChild(li);
        });
    });
}

// --- FUNCIONES DE ACTUALIZACIÓN DE UI (DOM) ---

function updateDPTable(players) {
    if (!dpTableBody) return; // Guarda: elemento puede no existir en todas las páginas
    
    dpTableBody.innerHTML = '';
    if (players.length === 0) {
        dpTableBody.innerHTML = `<tr><td colspan="2" class="px-4 py-4 text-center text-gray-400">Cargando puntos DP...</td></tr>`;
        return;
    }
    players.forEach(player => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-700 transition duration-150";
        row.innerHTML = `
            <td class="px-4 py-4 whitespace-nowrap text-lg font-semibold text-white">${player.name}</td>
            <td class="px-4 py-4 whitespace-nowrap text-2xl font-extrabold text-yellow-400 dp-score">${player.dp}</td>
        `;
        dpTableBody.appendChild(row);
    });
}

function updateRankingTable(players) {
    if (!rankingTableBody) return; // Guarda: elemento puede no existir en todas las páginas
    
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
    // Usar caché local si no se pasó la lista
    const effectivePlayers = Array.isArray(players) ? players : Array.from(localPlayersCache.values());

    const adminPlayerSelect = document.getElementById('admin-player-select');
    const adminPlayerSelectLoser = document.getElementById('admin-player-select-loser');
    const adminCardInventorySelect = document.getElementById('admin-card-inventory-select');
    const adminDpPlayerSelect = document.getElementById('admin-dp-player-select');

    // Guarda: elementos pueden no existir en todas las páginas
    if (!adminPlayerSelect || !adminPlayerSelectLoser || !adminCardInventorySelect || !adminDpPlayerSelect) return;

    adminPlayerSelect.innerHTML = '';
    adminPlayerSelectLoser.innerHTML = '';
    adminCardInventorySelect.innerHTML = '';
    adminDpPlayerSelect.innerHTML = '';

    if (effectivePlayers.length === 0) {
        [adminPlayerSelect, adminPlayerSelectLoser, adminCardInventorySelect, adminDpPlayerSelect].forEach(sel => {
            sel.innerHTML = `<option>Cargando...</option>`;
        });
        return;
    }

    effectivePlayers.forEach(player => {
        // Para selects de duelo (mostrar nombre + DP)
        const duelOption = document.createElement('option');
        duelOption.value = player.name; // Usamos el ID del documento (nombre)
        duelOption.textContent = `${player.name} (${player.dp} DP)`;

        // Para inventario (solo nombre)
        const inventoryOption = document.createElement('option');
        inventoryOption.value = player.name;
        inventoryOption.textContent = player.name;

        // Para modificar DP (mostrar nombre + DP)
        const dpOption = document.createElement('option');
        dpOption.value = player.name;
        dpOption.textContent = `${player.name} (${player.dp} DP)`;

        adminPlayerSelect.appendChild(duelOption.cloneNode(true));
        adminPlayerSelectLoser.appendChild(duelOption.cloneNode(true));
        adminCardInventorySelect.appendChild(inventoryOption.cloneNode(true));
        adminDpPlayerSelect.appendChild(dpOption.cloneNode(true));
    });

    // Selecciones por defecto basadas en el usuario logueado si existe
    const defaultSelection = loggedInPlayerId || effectivePlayers[0].name;
    [adminPlayerSelect, adminPlayerSelectLoser, adminDpPlayerSelect].forEach(sel => {
        if (sel.querySelector(`option[value="${defaultSelection}"]`)) sel.value = defaultSelection;
    });

    if (adminCardInventorySelect.querySelector(`option[value="${defaultSelection}"]`)) {
        adminCardInventorySelect.value = defaultSelection;
    }
    // Actualizar la vista de inventario
    updateCardInventoryView(adminCardInventorySelect.value);
}


function updateGameButtonsUI() {
    if (!isLoggedIn()) return;
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const player = localPlayersCache.get(currentUser.name);
    if (!player) return;

    const plays = player.game_plays || getInitialGamePlays();
    const gameModals = {
        "game_1": { btnText: document.getElementById('game-1-button-text'), btn: document.getElementById('game-1-button') },
        "game_2": { btnText: document.getElementById('game-2-button-text'), btn: document.getElementById('game-2-button') },
        "game_3": { btnText: document.getElementById('game-3-button-text'), btn: document.getElementById('game-3-button') }
        // Juegos 4, 5, 6 eliminados
    };

    for (let i = 1; i <= TOTAL_GAMES; i++) { // TOTAL_GAMES ahora es 3
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

// Habilitar/deshabilitar botones de pack según DP
function updatePackButtonsUI() {
    if (!isLoggedIn()) return;
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const player = localPlayersCache.get(currentUser.name);
    if (!player) return;

    packButtons.forEach(button => {
        const packCost = parseInt(button.dataset.cost);
        if (player.dp < packCost) {
            button.disabled = true;
        } else {
            button.disabled = false;
        }
    });
}

// --- FUNCIONES DE AYUDA (HELPERS) ---

// --- FUNCIONES DE AYUDA (HELPERS) ---

function getHistoryEntryClass(type) {
    switch(type) {
        case 'win': return { bg: 'border-l-4 border-green-500', text: 'text-green-300' };
        case 'buy': return { bg: 'border-l-4 border-blue-500', text: 'text-blue-300' };
        case 'admin': return { bg: 'border-l-4 border-indigo-500', text: 'text-indigo-300' };
        case 'penalty': return { bg: 'border-l-4 border-red-500', text: 'text-red-300' };
        case 'game_win': return { bg: 'border-l-4 border-pink-500', text: 'text-pink-300' };
        case 'game_lose': return { bg: 'border-l-4 border-gray-500', text: 'text-gray-300' };
        case 'market': return { bg: 'border-l-4 border-teal-500', text: 'text-teal-300' }; // NUEVO
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
            // element.textContent = ''; // No limpiar, solo ocultar
            element.style.opacity = '0';
        }, duration);
    }
}

function getGamePlays(gameId) {
    if (!isLoggedIn()) {
        return { canPlay: false, reason: 'Debes iniciar sesión para jugar.' };
    }
    
    const currentUser = getCurrentUser();
    const player = localPlayersCache.get(currentUser.name);
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
    if (!isLoggedIn()) {
        throw new Error('Debes iniciar sesión para registrar jugadas.');
    }
    
    const currentUser = getCurrentUser();
    const player = localPlayersCache.get(currentUser.name);
    const now = Date.now();

    const newCount = currentData.count + 1;
    const newTimestamp = currentData.reset_timestamp || (now + 24 * 60 * 60 * 1000); 

    let newPlayData = { ...(player.game_plays || getInitialGamePlays()) };
    newPlayData[gameId] = { count: newCount, reset_timestamp: newTimestamp };
    
    const newDp = player.dp + dpChange;

    const playerRef = doc(dbPlayersRef, currentUser.name);
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


// --- [INICIO] MÓDULO: store.js ---

// --- DOM DE LA TIENDA ---
const packOpeningModal_store = document.getElementById('pack-opening-modal');
const modalClosePackButton = document.getElementById('modal-close-pack-button');
const packCardList = document.getElementById('pack-card-list');

// --- LISTA DE CARTAS DE LOS PACKS ---
// --- LISTA DE CARTAS DE LOS PACKS --- 
// ESTA VERSIÓN TIENE LOS PULLRATES CORREGIDOS PARA COINCIDIR CON EL HTML 
const customPacks = { 
    "Poder del Mago": { 
        cost: 250, 
        pullRates: { common: 2, rare: 1, superRare: 0 }, // Total 3 Cartas 
        luck: { from: "rare", to: "superRare", rate: 0.1 } 
    }, 
    "Furia del Dragón": { 
        cost: 250, 
        pullRates: { common: 2, rare: 1, superRare: 0 }, // Total 3 Cartas 
        luck: { from: "rare", to: "superRare", rate: 0.1 } 
    }, 
    "Arsenal del Duelista": { 
        cost: 500, 
        pullRates: { common: 1, rare: 1, superRare: 1 }, // Total 3 Cartas (Garantiza 1 SR) 
    }, 
    "Tesoro del Faraón": { 
        cost: 800, 
        pullRates: { common: 2, rare: 1, superRare: 0 }, // Total 3 Cartas 
        luck: { from: "rare", to: "superRare", rate: 0.1 } // 'luck' pull para Exodia (SR) 
    }, 
    "Legado del Ojo Azul": { 
        cost: 1500, 
        pullRates: { common: 2, rare: 1, superRare: 2 }, // Total 5 Cartas (Garantiza 2 SR) 
    }, 
    "El Cofre Prohibido": { 
        cost: 2500, 
        pullRates: { common: 0, rare: 6, superRare: 3, ultraRare: 1 } // Total 10 Cartas (Garantiza 1 UR, 0 Common) 
    } 
};

// --- LÓGICA DE LA TIENDA ---

// Función para inicializar la tienda
function initStore() {
    packButtons.forEach(button => {
        button.addEventListener('click', handlePackPurchase);
    });
    modalClosePackButton.addEventListener('click', closePackModal);
}

// Manejador de la compra de packs
async function handlePackPurchase(event) {
    // Usar el sistema de autenticación de auth.js
    if (!isLoggedIn()) {
        showFeedback(purchaseFeedback, "Debes iniciar sesión para comprar", true);
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
        showFeedback(purchaseFeedback, "Error: No se encontró la sesión del usuario", true);
        return;
    }

    const button = event.currentTarget;
    const packName = button.dataset.name;
    const packCost = parseInt(button.dataset.cost);
    const packData = customPacks[packName];
    
    const player = localPlayersCache.get(currentUser.name);
    if (!player) {
        showFeedback(purchaseFeedback, "Error: No se encontró al jugador", true);
        return;
    }

    if (player.dp < packCost) {
        showFeedback(purchaseFeedback, `DP insuficientes. Necesitas ${packCost} DP.`, true);
        return;
    }

    // Deshabilitar botones para evitar doble compra
    packButtons.forEach(btn => btn.disabled = true);
    showFeedback(purchaseFeedback, `Procesando compra de ${packName}...`, false, 0);

    try {
        // ¡CAMBIO CLAVE! Ahora consultará la DB
        const pulledCards = await openPack(packName, packData.pullRates, packData.luck);
        
        // Actualizar la base de datos
        await updatePlayerInventory(player, packCost, pulledCards, packName);
        
        // Mostrar el modal con las cartas
        showPackOpeningModal(pulledCards);
        
        showFeedback(purchaseFeedback, `¡${packName} comprado exitosamente!`, false);

    } catch (error) {
        console.error("Error al comprar pack:", error);
        showFeedback(purchaseFeedback, "Error al procesar la compra.", true);
    } finally {
        // Los botones se reactivarán automáticamente por el listener de players
        // que llama a updatePackButtonsUI()
    }
}

// Función para abrir un pack y determinar las cartas
// Función para abrir un pack y determinar las cartas (AHORA LEE DE FIREBASE) 
async function openPack(packName, pullRates, luck) { 
    const pulledCards = []; 
    
    // 1. Crear un objeto para guardar las cartas de la base de datos 
    const cards = { 
        common: [], 
        rare: [], 
        superRare: [], 
        ultraRare: [] 
    }; 

    // 2. Consultar a Firebase por las cartas de ESE pack 
    try { 
        // Asegúrate de que dbCardbaseRef esté definida e inicializada 
        if (!dbCardbaseRef) { 
            throw new Error("dbCardbaseRef no está inicializada."); 
        } 
        
        const q = query(dbCardbaseRef, where("packs", "array-contains", packName)); 
        const querySnapshot = await getDocs(q); 
        
        querySnapshot.forEach((doc) => { 
            const card = doc.data(); 
            // Convertir rareza a camelCase (ej. "Super Rare" -> "superRare") 
            let rarityKey = card.rarity.toLowerCase().replace(/\s(.)/g, (match, group1) => group1.toUpperCase()); 
            
            // Asegurarnos que la primera letra sea minúscula 
            if (rarityKey.includes("Rare")) { 
                 rarityKey = rarityKey.charAt(0).toLowerCase() + rarityKey.slice(1); 
            } 
            if (rarityKey === "common") rarityKey = "common"; // caso especial 

            if (cards[rarityKey]) { 
                cards[rarityKey].push(card.name); 
            } 
        }); 

    } catch (error) { 
        console.error("Error al obtener cartas de la base de datos:", error); 
        throw new Error("No se pudo conectar a la base de datos de cartas."); 
    } 
    
    // 3. Lógica para sacar cartas 
    Object.entries(pullRates).forEach(([rarity, count]) => { 
        for (let i = 0; i < count; i++) { 
            if (cards[rarity] && cards[rarity].length > 0) { 
                let card = cards[rarity][Math.floor(Math.random() * cards[rarity].length)]; 
                
                // Lógica de suerte (reemplazo) 
                if (luck && luck.from === rarity && Math.random() < luck.rate) { 
                    const luckyRarity = luck.to; 
                    if (cards[luckyRarity] && cards[luckyRarity].length > 0) { 
                        card = cards[luckyRarity][Math.floor(Math.random() * cards[luckyRarity].length)]; 
                    } 
                } 
                pulledCards.push(card); 
            } 
        } 
    }); 

    if (pulledCards.length === 0) { 
        console.warn(`No se encontraron cartas para el pack: ${packName}. ¿Está la DB sembrada?`); 
        pulledCards.push("Carta de Relleno (Error de DB)"); 
    } 
    
    return pulledCards; 
}

// Función para actualizar el inventario y DP del jugador en Firestore
async function updatePlayerInventory(player, packCost, pulledCards, packName) {
    const newDp = player.dp - packCost;
    const newCollection = { ...player.card_collection };

    pulledCards.forEach(card => {
        newCollection[card] = (newCollection[card] || 0) + 1;
    });

    const playerRef = doc(dbPlayersRef, player.name); // Usando player.name como ID del documento
    const historyDocRef = doc(collection(db, dbHistoryRef.path));
    
    const historyEntry = {
        text: `${player.name} compró un pack "${packName}" por ${packCost} DP.`,
        timestamp: Date.now(),
        type: 'buy'
    };

    const batch = writeBatch(db);
    batch.update(playerRef, { dp: newDp, card_collection: newCollection });
    batch.set(historyDocRef, historyEntry);
    
    await batch.commit();
}

// Funciones del modal de apertura de pack
function showPackOpeningModal(cards) {
    packCardList.innerHTML = ''; // Limpiar lista anterior
    cards.forEach(card => {
        const li = document.createElement('li');
        li.className = "text-lg text-yellow-200 font-medium";
        li.textContent = card;
        packCardList.appendChild(li);
    });
    
    packOpeningModal_store.classList.remove('hidden', 'opacity-0', 'visibility-hidden');
}

function closePackModal() {
    packOpeningModal_store.classList.add('opacity-0', 'visibility-hidden');
    setTimeout(() => {
        packOpeningModal_store.classList.add('hidden');
    }, 300); // Esperar a que la transición termine
}

// --- [FIN] MÓDULO: store.js ---


// --- [INICIO] MÓDULO: games.js ---

// --- VARIABLES GLOBALES DE JUEGOS ---
let currentGame = 0;
let currentBet = 0;
let isGameInProgress = false;
let gameModalClosers = {};

// --- DOM DE JUEGOS ---
const gameModals = {
    1: document.getElementById('game-1-modal'),
    2: document.getElementById('game-2-modal'),
    3: document.getElementById('game-3-modal')
    // Juegos 4, 5, 6 eliminados
};

const gameOpeners = {
    1: document.getElementById('open-game-1'),
    2: document.getElementById('open-game-2'),
    3: document.getElementById('open-game-3')
    // Juegos 4, 5, 6 eliminados
};

// --- FUNCIÓN DE INICIALIZACIÓN ---
function initGames() {
    Object.entries(gameOpeners).forEach(([id, opener]) => {
        if (opener) opener.addEventListener('click', () => openGameModal(parseInt(id)));
        const btn = document.getElementById(`game-${id}-button`);
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            openGameModal(parseInt(id));
        });
    });

    // Inicializar listeners específicos de cada juego
    initGame1();
    initGame2();
    initGame3();
    // initGame4, 5, 6 eliminados
}

// --- LÓGICA DE MODAL (ABRIR/CERRAR) ---

function openGameModal(gameId) {
    const currentUser = getCurrentUser();
    const player = currentUser ? localPlayersCache.get(currentUser.name) : null;

    // Comprobar si puede jugar
    const playCheck = getGamePlays(`game_${gameId}`);
    const modal = gameModals[gameId];
    const feedbackEl = modal.querySelector(`#game-${gameId}-feedback`) || modal.querySelector(`#game-${gameId}-result`);
    if (!playCheck.canPlay) {
        // Mostrar el modal con el mensaje de límite alcanzado/inicio de sesión
        if (modal) {
            resetGameModal(gameId);
            modal.classList.remove('hidden', 'opacity-0', 'visibility-hidden');
        }
        if (feedbackEl) showFeedback(feedbackEl, playCheck.reason, true, 2500);
        setTimeout(() => closeGameModal(gameId), 3000);
        return;
    }

    currentGame = gameId;
    isGameInProgress = false;
    currentBet = 0;
    if (modal) {
        resetGameModal(gameId); // Resetear el estado visual del modal
        modal.classList.remove('hidden', 'opacity-0', 'visibility-hidden');
    }
}

function closeGameModal(gameId) {
    if (isGameInProgress) return; // No cerrar si el juego está en marcha
    
    const modal = gameModals[gameId];
    if (modal) {
        modal.classList.add('opacity-0', 'visibility-hidden');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
    currentGame = 0;
    currentBet = 0;
}

function resetGameModal(gameId) {
    const modal = gameModals[gameId];
    if (!modal) return;

    // Resetear botones de apuesta
    modal.querySelectorAll('.bet-button').forEach(btn => btn.classList.remove('selected'));
    
    // Ocultar pasos secundarios, mostrar paso 1
    modal.querySelector(`[id^="game-${gameId}-step-1"]`).style.display = 'block';
    const step2 = modal.querySelector(`[id^=game-${gameId}-step-2]`);
    if(step2) step2.style.display = 'none';

    // Resetear feedback
    const feedback = modal.querySelector(`[id^="game-${gameId}-feedback"]`);
    if(feedback) feedback.textContent = '';
    
    // Reseteos específicos de cada juego
    switch(gameId) {
        case 1:
            modal.querySelector('#game-1-grid').classList.add('opacity-50', 'pointer-events-none');
            modal.querySelectorAll('.bet-card').forEach(card => {
                card.classList.remove('is-flipped', 'chosen');
                const back = card.querySelector('.card-back');
                back.classList.remove('win', 'lose');
                back.textContent = '';
            });
            break;
        case 2:
            const diceCont = modal.querySelector('#game-2-dice-container');
            if (diceCont) diceCont.classList.add('hidden');
            const dice1 = modal.querySelector('#game-2-dice-1');
            const dice2 = modal.querySelector('#game-2-dice-2');
            const diceSum = modal.querySelector('#game-2-dice-sum');
            if (dice1) dice1.textContent = '?';
            if (dice2) dice2.textContent = '?';
            if (diceSum) diceSum.textContent = 'Suma: ?';
            const step2Btns = modal.querySelectorAll('#game-2-step-2 button');
            step2Btns.forEach(btn => btn.disabled = false);
            break;
        case 3:
            const coinCont = modal.querySelector('#game-3-coin-container');
            const coin = modal.querySelector('#game-3-coin');
            if (coinCont) coinCont.classList.add('hidden');
            if (coin) {
                coin.style.transform = 'none';
                coin.textContent = '?';
                coin.classList.remove('spin');
            }
            const coinBtns = modal.querySelectorAll('#game-3-step-2 button');
            coinBtns.forEach(btn => btn.disabled = false);
            break;
        // Casos 4, 5, 6 eliminados
    }
}

// --- LÓGICA DE APUESTAS (COMPARTIDA) ---
function selectBet(gameId, betAmount, betButton) {
    if (isGameInProgress) return;
    
    const currentUser = getCurrentUser();
    const player = currentUser ? localPlayersCache.get(currentUser.name) : null;
    const feedback = gameModals[gameId].querySelector(`#game-${gameId}-feedback`) || gameModals[gameId].querySelector(`#game-${gameId}-result`);
    if (!player) {
        if (feedback) showFeedback(feedback, 'Debes iniciar sesión para apostar.', true, 2000);
        return;
    }

    if (player.dp < betAmount) {
        showFeedback(feedback, "No tienes suficientes DP para esta apuesta.", true);
        return;
    }
    
    currentBet = betAmount;
    
    // Actualizar UI de botones de apuesta
    const modal = gameModals[gameId];
    modal.querySelectorAll('.bet-button').forEach(btn => btn.classList.remove('selected'));
    betButton.classList.add('selected');
    
    // Ocultar paso 1, mostrar paso 2
    modal.querySelector(`[id^="game-${gameId}-step-1"]`).style.display = 'none';
    const step2 = modal.querySelector(`[id^="game-${gameId}-step-2"]`);
    if(step2) step2.style.display = 'block';

    // Lógica específica post-apuesta
    switch(gameId) {
        case 1:
            modal.querySelector('#game-1-grid').classList.remove('opacity-50', 'pointer-events-none');
            break;
        case 2:
            const g2Display = modal.querySelector('#game-2-bet-display');
            if (g2Display) g2Display.textContent = betAmount;
            // Mostrar dados y preparar visual
            const diceContSel = modal.querySelector('#game-2-dice-container');
            const dice1Sel = modal.querySelector('#game-2-dice-1');
            const dice2Sel = modal.querySelector('#game-2-dice-2');
            const diceSumSel = modal.querySelector('#game-2-dice-sum');
            if (diceContSel) diceContSel.classList.remove('hidden');
            if (dice1Sel) dice1Sel.textContent = '?';
            if (dice2Sel) dice2Sel.textContent = '?';
            if (diceSumSel) diceSumSel.textContent = 'Suma: ?';
            break;
        case 3:
            const g3Display = modal.querySelector('#game-3-bet-display');
            if (g3Display) g3Display.textContent = betAmount;
            // Mostrar moneda y poner giro idle
            const coinContSel = modal.querySelector('#game-3-coin-container');
            const coinSel = modal.querySelector('#game-3-coin');
            if (coinContSel) coinContSel.classList.remove('hidden');
            if (coinSel) {
                coinSel.classList.add('spin');
                coinSel.textContent = '';
            }
            break;
        // Casos 4, 5, 6 eliminados
    }
}

// --- JUEGO 1: ETERNALS BETCARDS ---
function initGame1() {
    const modal = gameModals[1];
    modal.querySelector('#game-1-close-button').addEventListener('click', () => closeGameModal(1));

    // Listeners de apuestas
    modal.querySelector('#game-1-bet-options').addEventListener('click', e => {
        if (e.target.classList.contains('bet-button')) {
            selectBet(1, parseInt(e.target.dataset.bet), e.target);
        }
    });

    // Listeners de cartas
    modal.querySelector('#game-1-grid').addEventListener('click', async e => {
        const card = e.target.closest('.bet-card');
        if (card && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            await playGame1(card);
        }
    });
}

async function playGame1(chosenCard) {
    const modal = gameModals[1];
    const feedback = modal.querySelector('#game-1-feedback') || modal.querySelector('#game-1-result');
    const cards = modal.querySelectorAll('.bet-card');
    showFeedback(feedback, "Revelando...", false, 0);

    const playCheck = getGamePlays('game_1');
    if (!playCheck.canPlay) {
        showFeedback(feedback, playCheck.reason, true);
        isGameInProgress = false;
        return;
    }

    const currentUser = getCurrentUser();
    const playerName = currentUser?.name || 'Jugador';

    const winningIndex = Math.floor(Math.random() * 3);
    const chosenIndex = parseInt(chosenCard.dataset.index);
    let dpChange = -currentBet;
    let historyText = "";
    let historyType = "";

    if (chosenIndex === winningIndex) {
        // GANÓ
        const winnings = Math.floor(currentBet * 1.5);
        dpChange = winnings - currentBet;
        historyText = `${playerName} ganó ${dpChange} DP en Eternals BetCards (apostó ${currentBet}).`;
        historyType = 'game_win';
        showFeedback(feedback, `¡GANASTE! Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
    } else {
        // PERDIÓ
        historyText = `${playerName} perdió ${currentBet} DP en Eternals BetCards.`;
        historyType = 'game_lose';
        showFeedback(feedback, `¡Mala suerte! Pierdes ${currentBet} DP.`, true, 5000);
    }

    // Voltear cartas
    cards.forEach((card, index) => {
        const back = card.querySelector('.card-back');
        if (index === winningIndex) {
            back.classList.add('win');
            back.textContent = 'GANADORA';
        } else {
            back.classList.add('lose');
            back.textContent = 'PIERDE';
        }
        if (index === chosenIndex) {
            card.classList.add('chosen');
        }
        setTimeout(() => card.classList.add('is-flipped'), index * 100 + 300);
    });

    try {
        await recordGamePlay('game_1', playCheck.currentData, dpChange, historyText, historyType);
    } catch (e) {
        console.error(e);
        showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
    } finally {
        isGameInProgress = false; // <<< CORRECCIÓN AQUÍ
    }

    setTimeout(() => {
        closeGameModal(1);
    }, 5000);
}


// --- JUEGO 2: DUELO DE DADOS ---
function initGame2() {
    const modal = gameModals[2];
    modal.querySelector('#game-2-close-button').addEventListener('click', () => closeGameModal(2));

    modal.querySelector('#game-2-bet-options').addEventListener('click', e => {
        if (e.target.classList.contains('bet-button')) {
            selectBet(2, parseInt(e.target.dataset.bet), e.target);
        }
    });

    modal.querySelector('#game-2-step-2').addEventListener('click', async e => {
        const choice = e.target.closest('button');
        if (choice && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            let choiceType = '';
            if (choice.id.includes('less') || choice.id.includes('low')) choiceType = 'low';
            else if (choice.id.includes('equal') || choice.id.includes('seven')) choiceType = 'seven';
            else if (choice.id.includes('greater') || choice.id.includes('high')) choiceType = 'high';
            // Deshabilitar botones
            modal.querySelectorAll('#game-2-step-2 button').forEach(btn => btn.disabled = true);
            // Mostrar dados
            const diceCont = modal.querySelector('#game-2-dice-container');
            if (diceCont) diceCont.classList.remove('hidden');
            await playGame2(choiceType);
        }
    });
}

async function playGame2(choice) {
    const modal = gameModals[2];
    const feedback = modal.querySelector('#game-2-feedback') || modal.querySelector('#game-2-result');
    const dice1El = modal.querySelector('#game-2-dice-1');
    const dice2El = modal.querySelector('#game-2-dice-2');
    const sumEl = modal.querySelector('#game-2-dice-sum');
    
    showFeedback(feedback, "Lanzando dados...", false, 0);

    const playCheck = getGamePlays('game_2');
    if (!playCheck.canPlay) {
        showFeedback(feedback, playCheck.reason, true);
        isGameInProgress = false;
        return;
    }

    // Simulación de lanzamiento
    let animInterval = setInterval(() => {
        dice1El.textContent = Math.floor(Math.random() * 6) + 1;
        dice2El.textContent = Math.floor(Math.random() * 6) + 1;
        if (sumEl) {
            const s = parseInt(dice1El.textContent) + parseInt(dice2El.textContent);
            sumEl.textContent = `Suma: ${isNaN(s) ? '?' : s}`;
        }
    }, 100);

    setTimeout(async () => {
        clearInterval(animInterval);
        
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        dice1El.textContent = d1;
        dice2El.textContent = d2;
        if (sumEl) sumEl.textContent = `Suma: ${total}`;

        let resultType = '';
        if (total < 7) resultType = 'low';
        if (total === 7) resultType = 'seven';
        if (total > 7) resultType = 'high';

        let dpChange = -currentBet;
        let historyText = "";
        let historyType = "";
        let winnings = 0;

        if (choice === resultType) {
            // GANÓ
            const multiplier = (choice === 'seven') ? 4 : 1.5;
            winnings = currentBet * multiplier;
            dpChange = winnings - currentBet;
            const currentUser2 = getCurrentUser();
            const playerName2 = currentUser2?.name || 'Jugador';
            historyText = `${playerName2} ganó ${dpChange} DP en Duelo de Dados (apostó ${currentBet} al ${total}).`;
            historyType = 'game_win';
            showFeedback(feedback, `¡GANASTE! Salió ${total}. Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
        } else {
            // PERDIÓ
            const currentUser2b = getCurrentUser();
            const playerName2b = currentUser2b?.name || 'Jugador';
            historyText = `${playerName2b} perdió ${currentBet} DP en Duelo de Dados (salió ${total}).`;
            historyType = 'game_lose';
            showFeedback(feedback, `¡Mala suerte! Salió ${total}. Pierdes ${currentBet} DP.`, true, 5000);
        }

        try {
            await recordGamePlay('game_2', playCheck.currentData, dpChange, historyText, historyType);
        } catch (e) {
            console.error(e);
            showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
        } finally {
            isGameInProgress = false; // <<< CORRECCIÓN AQUÍ
        }

        setTimeout(() => {
            closeGameModal(2);
        }, 5000);

    }, 2000); // Duración de la animación
}

// --- JUEGO 3: MONEDA DEL MILENIO ---
function initGame3() {
    const modal = gameModals[3];
    modal.querySelector('#game-3-close-button').addEventListener('click', () => closeGameModal(3));

    modal.querySelector('#game-3-bet-options').addEventListener('click', e => {
        if (e.target.classList.contains('bet-button')) {
            selectBet(3, parseInt(e.target.dataset.bet), e.target);
        }
    });

    modal.querySelector('#game-3-step-2').addEventListener('click', async e => {
        const choice = e.target.closest('button');
        if (choice && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            let choiceType = choice.id.includes('heads') ? 'CARA' : 'CRUZ';
            modal.querySelectorAll('#game-3-step-2 button').forEach(btn => btn.disabled = true);
            await playGame3(choiceType);
        }
    });
}

async function playGame3(choice) {
    const modal = gameModals[3];
    const feedback = modal.querySelector('#game-3-feedback') || modal.querySelector('#game-3-result');
    const coinCont = modal.querySelector('#game-3-coin-container');
    const coinEl = modal.querySelector('#game-3-coin');
    
    showFeedback(feedback, "Lanzando moneda...", false, 0);
    if (coinCont) coinCont.classList.remove('hidden');
    coinEl.classList.remove('spin'); // detener giro idle si estaba activo
    coinEl.style.transition = 'transform 0.5s';

    const playCheck = getGamePlays('game_3');
    if (!playCheck.canPlay) {
        showFeedback(feedback, playCheck.reason, true);
        isGameInProgress = false;
        return;
    }

    // Animación de giro
    let flips = 0;
    let animInterval = setInterval(() => {
        coinEl.style.transform = `rotateY(${flips * 180}deg)`;
        coinEl.textContent = (flips % 2 === 0) ? "CARA" : "CRUZ";
        flips++;
    }, 150);

    setTimeout(async () => {
        clearInterval(animInterval);
        
        const result = Math.random() < 0.5 ? 'CARA' : 'CRUZ';
        coinEl.style.transform = (result === 'CARA') ? `rotateY(720deg)` : `rotateY(900deg)`; // Asegura que termine en el lado correcto
        coinEl.textContent = result;

        let dpChange = -currentBet;
        let historyText = "";
        let historyType = "";
        let winnings = 0;

        if (choice === result) {
            // GANÓ
            winnings = Math.floor(currentBet * 1.5); // 1.5x
            dpChange = winnings - currentBet;
            const currentUser3 = getCurrentUser();
            const playerName3 = currentUser3?.name || 'Jugador';
            historyText = `${playerName3} ganó ${dpChange} DP en Moneda del Milenio (apostó ${currentBet}).`;
            historyType = 'game_win';
            showFeedback(feedback, `¡GANASTE! Salió ${result}. Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
        } else {
            // PERDIÓ
            const currentUser3b = getCurrentUser();
            const playerName3b = currentUser3b?.name || 'Jugador';
            historyText = `${playerName3b} perdió ${currentBet} DP en Moneda del Milenio (salió ${result}).`;
            historyType = 'game_lose';
            showFeedback(feedback, `¡Mala suerte! Salió ${result}. Pierdes ${currentBet} DP.`, true, 5000);
        }

        try {
            await recordGamePlay('game_3', playCheck.currentData, dpChange, historyText, historyType);
        } catch (e) {
            console.error(e);
            showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
        } finally {
            isGameInProgress = false; // <<< CORRECCIÓN AQUÍ
        }

        setTimeout(() => {
            closeGameModal(3);
        }, 5000);

    }, 2000); // Duración de la animación
}

// --- [FIN] MÓDULO: games.js ---


// --- [INICIO] MÓDULO: admin.js ---

// Constante para la contraseña de administrador
const ADMIN_PASSWORD = 'as17sa71';

// --- DOM DEL ADMIN ---
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
// NUEVOS BOTONES DE RESET
const adminFactoryResetButton = document.getElementById('admin-factory-reset-button');
const adminResetFeedback = document.getElementById('admin-reset-feedback');
let factoryResetTimer = null;


// --- FUNCIÓN DE INICIALIZACIÓN ---
function initAdmin() {
    // Asegurar que el botón de desbloqueo esté habilitado al estar logueado
    if (adminUnlockButton) {
        adminUnlockButton.disabled = false;
    }
    // Ocultar mensaje de "Debes iniciar sesión" si existe
    if (adminLockScreen) {
        const loginHint = adminLockScreen.querySelector('p.text-xs');
        if (loginHint) loginHint.classList.add('hidden');
    }

    adminUnlockButton.addEventListener('click', unlockAdminPanel);
    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminUnlockButton.click();
    });
    
    adminSubmitButton.addEventListener('click', registerDuel);
    adminAddPlayerButton.addEventListener('click', addNewPlayer);
    adminResetWeekButton.addEventListener('click', resetWeeklyRanking);
    
    // Agregar event listeners para los botones de modificar DP
    document.getElementById('admin-add-dp-button').addEventListener('click', () => handleModifyDP(true));
    document.getElementById('admin-subtract-dp-button').addEventListener('click', () => handleModifyDP(false));
    
    adminCardInventorySelect.addEventListener('change', (e) => {
        updateCardInventoryView(e.target.value);
    });

    // NUEVO: Listener para el botón de reseteo
    adminFactoryResetButton.addEventListener('click', handleFactoryResetClick);
}

// Función para manejar la modificación de DP
async function handleModifyDP(isAdd) {
    const playerSelect = document.getElementById('admin-dp-player-select');
    const dpAmountInput = document.getElementById('admin-dp-amount');
    
    if (!playerSelect || !dpAmountInput) {
        console.error('No se encontraron los elementos necesarios para modificar DP');
        return;
    }
    
    const selectedOption = playerSelect.options[playerSelect.selectedIndex];
    if (!selectedOption) {
        showFeedback(adminFeedback, "Por favor selecciona un jugador.", true);
        return;
    }
    
    const playerId = playerSelect.value;
    const player = localPlayersCache.get(playerId);
    
    if (!player) {
        showFeedback(adminFeedback, "Error al encontrar el jugador.", true);
        return;
    }
    
    const dpAmount = parseInt(dpAmountInput.value);
    
    if (isNaN(dpAmount) || dpAmount <= 0) {
        showFeedback(adminFeedback, "Por favor ingresa una cantidad válida de DP.", true);
        return;
    }
    
    // Calcular nuevos DP
    const newDP = isAdd ? player.dp + dpAmount : player.dp - dpAmount;
    
    try {
        // Actualizar en Firebase
        await updatePlayerDP(playerId, newDP);
        
        // Actualizar en caché local
        player.dp = newDP;
        
        // Actualizar la opción en el selector
        selectedOption.text = `${player.name} (${newDP} DP)`;
        
        // Registrar en el historial
        const action = isAdd ? 'sumó' : 'restó';
        const historyEntry = {
            text: `Admin ${action} ${dpAmount} DP a ${player.name}. Nuevo total: ${newDP} DP`,
            timestamp: Date.now(),
            type: 'admin'
        };
        await addDoc(dbHistoryRef, historyEntry);
        
        // Limpiar el campo de cantidad
        dpAmountInput.value = '';
        
        // Mostrar mensaje de éxito
        showFeedback(adminFeedback, `Se han ${isAdd ? 'sumado' : 'restado'} ${dpAmount} DP a ${player.name}`, false);
    } catch (error) {
        console.error("Error al modificar DP:", error);
        showFeedback(adminFeedback, "Error al guardar los cambios en la base de datos.", true);
    }
}

// --- LÓGICA DEL PANEL DE ADMIN ---

// Función para desbloquear el panel de administración
function unlockAdminPanel() {
    if (!sessionManager.isLoggedIn()) {
        adminLockFeedback.textContent = "Debes iniciar sesión primero.";
        setTimeout(() => { adminLockFeedback.textContent = ''; }, 3000);
        return;
    }

    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        adminLockScreen.classList.add('hidden');
        adminContent.classList.remove('hidden');
        adminPasswordInput.value = ''; // Limpiar la contraseña por seguridad
        
        // Inicializar funcionalidades adicionales del admin panel
        // Los event listeners ya están configurados en initAdmin()
    } else {
        adminLockFeedback.textContent = "Contraseña incorrecta.";
        setTimeout(() => { adminLockFeedback.textContent = ''; }, 3000);
    }
}



// Event Listeners para el panel de administración - ELIMINADOS (están en initAdmin)

// Función para actualizar los DP de un jugador en Firebase
async function updatePlayerDP(playerId, newDP) {
    try {
        const playerRef = doc(dbPlayersRef, playerId);
        await updateDoc(playerRef, {
            dp: newDP
        });
        console.log(`DP actualizados para el jugador ${playerId}: ${newDP}`);
    } catch (error) {
        console.error("Error al actualizar DP:", error);
        showFeedback(adminFeedback, "Error al guardar los cambios en la base de datos.", true);
    }
}

async function registerDuel() {
    const winnerId = adminPlayerSelect.value;
    const loserId = adminPlayerSelectLoser.value;

    if (winnerId === loserId) {
        showFeedback(adminFeedback, "El ganador y el perdedor no pueden ser la misma persona.", true);
        return;
    }
    const winner = localPlayersCache.get(winnerId);
    const loser = localPlayersCache.get(loserId);

    if (!winner || !loser) {
        showFeedback(adminFeedback, "Error al encontrar jugadores.", true);
        return;
    }

    let winnerDpGain = 100; // Victoria base
    let loserDpDelta = 25; // El perdedor gana 25 DP por participación

    const isSurrender = adminSurrenderCheckbox.checked;
    const isFlawless = adminFlawlessCheckbox.checked;

    if (isSurrender) {
        winnerDpGain += 50;
        // En caso de rendición, se aplica penalización de -50 DP y NO el +25 DP
        loserDpDelta = -50;
    }
    if (isFlawless) {
        winnerDpGain += 100;
    }

    // Construir historyText después de que winnerDpGain y loserDpDelta estén finalizados
    let historyText = `Duelo registrado: ${winner.name} venció a ${loser.name}. (Ganador +${winnerDpGain} DP`;
    if (loserDpDelta < 0) {
        historyText += ` y Perdedor ${loserDpDelta} DP)`;
    } else {
        historyText += ` y Perdedor +${loserDpDelta} DP)`;
    }

    // Añadir detalles adicionales si aplica
    if (isSurrender) {
        historyText += ` (Rendición)`;
    }
    if (isFlawless) {
        historyText += ` (Flawless)`;
    }

    const newWinnerDp = winner.dp + winnerDpGain;
    const newLoserDp = Math.max(0, loser.dp + loserDpDelta); // Evitar DP negativos
    const newWinnerWins = (winner.wins_semanales || 0) + 1;

    const winnerRef = doc(dbPlayersRef, winnerId);
    const loserRef = doc(dbPlayersRef, loserId);
    const historyDocRef = doc(collection(db, dbHistoryRef.path));
    
    const historyEntry = {
        text: historyText,
        timestamp: Date.now(),
        type: 'win'
    };
    
    const penaltyHistoryEntry = {
        text: `${loser.name} perdió 50 DP por rendirse.`,
        timestamp: Date.now() + 1, // Asegurar orden
        type: 'penalty'
    };

    try {
        const batch = writeBatch(db);
        batch.update(winnerRef, { dp: newWinnerDp, wins_semanales: newWinnerWins });
        batch.update(loserRef, { dp: newLoserDp });
        batch.set(historyDocRef, historyEntry);
        
        if (isSurrender) {
            batch.set(doc(collection(db, dbHistoryRef.path)), penaltyHistoryEntry);
        }
        
        await batch.commit();
        
        showFeedback(adminFeedback, "Duelo registrado con éxito.", false);
        adminSurrenderCheckbox.checked = false;
        adminFlawlessCheckbox.checked = false;
        
    } catch (error) {
        console.error("Error al registrar duelo:", error);
        showFeedback(adminFeedback, "Error al guardar el duelo.", true);
    }
}

async function addNewPlayer() {
    const newName = adminNewPlayerName.value.trim();
    const newPassword = document.getElementById('admin-new-player-password').value.trim();
    const newDeck = adminNewPlayerDeck.value;

    if (!newName || !newPassword) {
        showFeedback(adminFeedback, "El nombre y la contraseña no pueden estar vacíos.", true);
        return;
    }

    // Verificar si el jugador ya existe
    if (localPlayersCache.has(newName) || Array.from(localPlayersCache.values()).some(p => p.name.toLowerCase() === newName.toLowerCase())) {
        showFeedback(adminFeedback, "Ese nombre de jugador ya existe.", true);
        return;
    }

    const newPlayerData = {
        id: newName,
        name: newName,
        dp: 0,
        deck: newDeck,
        password: newPassword, // Añadir la contraseña
        wins_semanales: 0,
        card_collection: {},
        game_plays: getInitialGamePlays()
    };

    try {
        await setDoc(doc(dbPlayersRef, newName), newPlayerData);
        
        const historyEntry = {
            text: `${newName} se ha unido al torneo con el deck de ${newDeck}.`,
            timestamp: Date.now(),
            type: 'admin'
        };
        await addDoc(dbHistoryRef, historyEntry);

        showFeedback(adminFeedback, `Jugador "${newName}" añadido con éxito.`, false);
        adminNewPlayerName.value = '';
        document.getElementById('admin-new-player-password').value = ''; // Limpiar el campo de contraseña
        
    } catch (error) {
        console.error("Error al añadir jugador:", error);
        showFeedback(adminFeedback, "Error al añadir jugador.", true);
    }
}

async function resetWeeklyRanking() {
    showFeedback(adminWeekFeedback, "Reseteando ranking semanal...", false, 0);

    const players = Array.from(localPlayersCache.values());
    if (players.length === 0) {
        showFeedback(adminWeekFeedback, "No hay jugadores para resetear.", true);
        return;
    }

    // Encontrar al ganador
    const sortedByWins = [...players].sort((a, b) => (b.wins_semanales || 0) - (a.wins_semanales || 0));
    const winner = sortedByWins[0];
    
    if (!winner || (winner.wins_semanales || 0) === 0) {
        showFeedback(adminWeekFeedback, "Nadie ganó esta semana. Reseteando...", false);
    }

    try {
        const batch = writeBatch(db);
        
        // Resetear victorias de todos usando el ID correcto (nombre del documento)
        players.forEach(player => {
            const playerRef = doc(dbPlayersRef, player.name);
            batch.update(playerRef, { wins_semanales: 0 });
        });
        
        // Añadir evento a la historia
        const historyText = (winner && (winner.wins_semanales || 0) > 0)
            ? `¡Fin de la semana! El ganador es ${winner.name} con ${winner.wins_semanales} victorias. El ranking ha sido reseteado.`
            : `Fin de la semana. Nadie ganó esta semana. El ranking ha sido reseteado.`;
            
        const historyEntry = {
            text: historyText,
            timestamp: Date.now(),
            type: 'admin'
        };
        batch.set(doc(collection(db, dbHistoryRef.path)), historyEntry);
        
        await batch.commit();
        showFeedback(adminWeekFeedback, "Ranking semanal reseteado con éxito.", false);
        
    } catch (error) {
        console.error("Error al resetear ranking:", error);
        showFeedback(adminWeekFeedback, "Error al resetear el ranking.", true);
    }
}

function updateCardInventoryView(playerId) {
    const player = localPlayersCache.get(playerId);
    if (!player) {
        adminCardInventoryList.innerHTML = `<li class="text-gray-400">Jugador no encontrado.</li>`;
        return;
    }
    
    const collection = player.card_collection;
    if (!collection || Object.keys(collection).length === 0) {
        adminCardInventoryList.innerHTML = `<li class="text-gray-400">${player.name} no tiene cartas.</li>`;
        return;
    }

    adminCardInventoryList.innerHTML = '';
    
    // Ordenar cartas alfabéticamente
    const sortedCards = Object.keys(collection).sort();
    
    sortedCards.forEach(cardName => {
        const count = collection[cardName];
        const li = document.createElement('li');
        li.className = "text-gray-200 flex justify-between";
        li.innerHTML = `
            <span>${cardName}</span>
            <span class="font-bold text-yellow-300">x${count}</span>
        `;
        adminCardInventoryList.appendChild(li);
    });
}

// NUEVA FUNCIÓN: Lógica de doble clic para el reseteo de fábrica
function handleFactoryResetClick() {
    if (factoryResetTimer) {
        // Segundo clic (confirmado)
        clearTimeout(factoryResetTimer);
        factoryResetTimer = null;
        adminFactoryResetButton.disabled = true;
        adminFactoryResetButton.textContent = "¡RESETEANDO...!";
        executeFactoryReset();
    } else {
        // Primer clic
        adminFactoryResetButton.dataset.confirmed = "true";
        adminFactoryResetButton.textContent = "CONFIRMAR RESETEO (¿SEGURO?)";
        showFeedback(adminResetFeedback, "¡Haz clic de nuevo en 5 seg para confirmar!", true, 5000);

        factoryResetTimer = setTimeout(() => {
            adminFactoryResetButton.dataset.confirmed = "false";
            adminFactoryResetButton.textContent = "Iniciar Reseteo de Fábrica";
            factoryResetTimer = null;
            showFeedback(adminResetFeedback, "Reseteo cancelado.", false, 2000);
        }, 5000);
    }
}

// NUEVA FUNCIÓN: Ejecutar el reseteo
async function executeFactoryReset() {
    showFeedback(adminResetFeedback, "Borrando todas las colecciones...", true, 0);

    try {
        const batch = writeBatch(db);

        // 1. Resetear estadísticas de todos los jugadores
        const playersSnapshot = await getDocs(dbPlayersRef);
        const initialGamePlays = getInitialGamePlays(); // Obtener los game plays iniciales una vez

        playersSnapshot.forEach(doc => {
            const playerRef = doc.ref;
            batch.update(playerRef, {
                dp: 0,
                wins_semanales: 0,
                card_collection: {},
                game_plays: initialGamePlays
            });
        });

        // 2. Borrar todo el historial
        const historySnapshot = await getDocs(dbHistoryRef);
        historySnapshot.forEach(doc => batch.delete(doc.ref));

        // 3. Borrar todos los listados del marketplace (NUEVO)
        const marketplaceSnapshot = await getDocs(dbMarketplaceRef);
        marketplaceSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        
        showFeedback(adminResetFeedback, "¡Reseteo de estadísticas completado! Borrando historial y marketplace...", false, 0);

        // No es necesario llamar a seedInitialData ya que los jugadores no se borran

        showFeedback(adminResetFeedback, "¡Reseteo de fábrica completado! La página se recargará.", false, 5000);
        setTimeout(() => location.reload(), 5000);

    } catch (error) {
        console.error("Error en el reseteo de fábrica:", error);
        showFeedback(adminResetFeedback, "Error fatal durante el reseteo.", true, 5000);
        adminFactoryResetButton.disabled = false;
        adminFactoryResetButton.textContent = "Iniciar Reseteo de Fábrica";
    }
}
// --- [FIN] MÓDULO: admin.js ---


// --- [INICIO] MÓDULO: marketplace.js ---

// --- FUNCIÓN DE INICIALIZACIÓN ---
function initMarketplace() {
    marketSellButton.addEventListener('click', listCardForSale);
    marketListingsBody.addEventListener('click', handleBuyCardClick);
}

// --- LISTENER DEL MARKETPLACE ---
function initMarketplaceListener() {
    onSnapshot(dbMarketplaceRef, (snapshot) => {
        localMarketplaceCache.clear();
        snapshot.forEach(doc => {
            localMarketplaceCache.set(doc.id, { id: doc.id, ...doc.data() });
        });
        updateMarketplaceListings();
    });
}

// --- FUNCIONES DE UI DEL MARKETPLACE ---
function updateMarketplaceListings() {
    marketListingsBody.innerHTML = '';
    const listings = Array.from(localMarketplaceCache.values());

    if (listings.length === 0) {
        marketListingsBody.innerHTML = `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400">El marketplace está vacío.</td></tr>`;
        return;
    }
    
    // Ordenar por precio (más barato primero)
    listings.sort((a, b) => a.price - b.price);

    listings.forEach(listing => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-800 transition-colors";
        
        const currentUser = getCurrentUser(); // Importado de auth.js
        const player = currentUser ? localPlayersCache.get(currentUser.name) : null;
        const isOwner = player ? listing.sellerId === player.id : false;
        const canAfford = player ? player.dp >= listing.price : false;
        const buyButtonDisabled = isOwner || !canAfford;

        tr.innerHTML = `
            <td class="px-3 py-3 card-name">${listing.cardName}</td>
            <td class="px-3 py-3 card-price">${listing.price} DP</td>
            <td class="px-3 py-3 text-gray-400">${listing.sellerName}</td>
            <td class="px-3 py-3">
                <button 
                    class="buy-button" 
                    data-listing-id="${listing.id}" 
                    ${buyButtonDisabled ? 'disabled' : ''}
                >
                    ${isOwner ? 'Tuyo' : 'Comprar'}
                </button>
            </td>
        `;
        marketListingsBody.appendChild(tr);
    });
}

function updateMarketplaceSellDropdown() {
    if (!marketSellCardSelect) return; // Si no estamos en la página del marketplace

    marketSellCardSelect.innerHTML = '';
    
    // Obtener el usuario actual del sistema de autenticación
    const currentUser = sessionManager.getCurrentUser();
    if (!currentUser) {
        marketSellCardSelect.innerHTML = `<option>Inicia sesión para vender</option>`;
        return;
    }
    
    const player = localPlayersCache.get(currentUser.name);
    if (!player || !player.card_collection || Object.keys(player.card_collection).length === 0) {
        marketSellCardSelect.innerHTML = `<option>No tienes cartas para vender</option>`;
        return;
    }

    const sortedCards = Object.keys(player.card_collection).sort();
    let hasCards = false;
    
    sortedCards.forEach(cardName => {
        const count = player.card_collection[cardName];
        if (count > 0) {
            hasCards = true;
            const option = document.createElement('option');
            option.value = cardName;
            option.textContent = `${cardName} (Tienes ${count})`;
            marketSellCardSelect.appendChild(option);
        }
    });

    if (!hasCards) {
        marketSellCardSelect.innerHTML = `<option>No tienes cartas para vender</option>`;
    }
}

// --- LÓGICA DE VENTA Y COMPRA ---
async function listCardForSale() {
    if (!isLoggedIn()) {
        showFeedback(marketSellFeedback, "Debes iniciar sesión para vender cartas.", true);
        return;
    }
    
    const currentUser = getCurrentUser();
    const cardName = marketSellCardSelect.value;
    const price = parseInt(marketSellPriceInput.value);
    const player = localPlayersCache.get(currentUser.name);

    if (!player) {
        showFeedback(marketSellFeedback, "No se encontró al jugador.", true);
        return;
    }
    if (!cardName || !player.card_collection || player.card_collection[cardName] < 1) {
        showFeedback(marketSellFeedback, "No tienes esa carta para vender.", true);
        return;
    }
    if (!price || price <= 0) {
        showFeedback(marketSellFeedback, "Debes introducir un precio válido.", true);
        return;
    }

    showFeedback(marketSellFeedback, "Listando tu carta...", false, 0);
    marketSellButton.disabled = true;

    try {
        // 1. Crear el nuevo listado
        const newListing = {
            cardName: cardName,
            price: price,
            sellerId: currentUser.name,
            sellerName: player.name,
            timestamp: Date.now()
        };
        
        // 2. Actualizar el inventario del jugador
        const newCollection = { ...player.card_collection };
        newCollection[cardName] = newCollection[cardName] - 1;
        if (newCollection[cardName] === 0) {
            delete newCollection[cardName]; // Limpiar si ya no tiene
        }
        
        const playerRef = doc(dbPlayersRef, currentUser.name);
        const marketDocRef = doc(collection(db, dbMarketplaceRef.path));
        const historyDocRef = doc(collection(db, dbHistoryRef.path));
        
        const historyEntry = {
            text: `${player.name} listó "${cardName}" por ${price} DP.`,
            timestamp: Date.now(),
            type: 'market'
        };

        // Usar un batch para asegurar que todo pase junto
        const batch = writeBatch(db);
        batch.set(marketDocRef, newListing); // Añadir al marketplace
        batch.update(playerRef, { card_collection: newCollection }); // Quitar carta al jugador
        batch.set(historyDocRef, historyEntry); // Añadir a la historia
        
        await batch.commit();

        showFeedback(marketSellFeedback, "¡Carta listada con éxito!", false);
        marketSellPriceInput.value = '';

    } catch (error) {
        console.error("Error al listar carta:", error);
        showFeedback(marketSellFeedback, "Error al listar la carta.", true);
    } finally {
        marketSellButton.disabled = false;
    }
}

async function handleBuyCardClick(e) {
    if (!e.target.classList.contains('buy-button')) return;

    const button = e.target;
    const listingId = button.dataset.listingId;
    const listing = localMarketplaceCache.get(listingId);
    
    if (!listing) {
        showFeedback(marketBuyFeedback, "Error: Listado no encontrado.", true);
        return;
    }

    if (!isLoggedIn()) {
        showFeedback(marketBuyFeedback, "Debes iniciar sesión para comprar.", true);
        return;
    }
    
    const currentUser = getCurrentUser();
    const buyer = localPlayersCache.get(currentUser.name);
    if (!buyer) {
        showFeedback(marketBuyFeedback, "Error al encontrar al comprador.", true);
        return;
    }

    const seller = localPlayersCache.get(listing.sellerId);

    if (!seller) {
        showFeedback(marketBuyFeedback, "Error al encontrar al vendedor. Cancelando.", true);
        // Si el vendedor no existe (raro), borramos el listado
        await deleteDoc(doc(dbMarketplaceRef, listingId));
        return;
    }
    if (buyer.dp < listing.price) {
        showFeedback(marketBuyFeedback, "No tienes suficientes DP para comprar esto.", true);
        return;
    }
    if (buyer.id === seller.id) {
        showFeedback(marketBuyFeedback, "No puedes comprar tus propias cartas.", true);
        return;
    }

    showFeedback(marketBuyFeedback, "Procesando compra...", false, 0);
    button.disabled = true;

    try {
        // Calcular comisión y ganancia
        const fee = Math.floor(listing.price * 0.1);
        const profit = listing.price - fee;

        // Actualizar comprador
        const newBuyerDp = buyer.dp - listing.price;
        const newBuyerCollection = { ...buyer.card_collection };
        newBuyerCollection[listing.cardName] = (newBuyerCollection[listing.cardName] || 0) + 1;

        // Actualizar vendedor
        const newSellerDp = seller.dp + profit;

        // Referencias de documentos
        const buyerRef = doc(dbPlayersRef, buyer.id);
        const sellerRef = doc(dbPlayersRef, seller.id);
        const listingRef = doc(dbMarketplaceRef, listingId);
        
        // Historial
        const historyBuyEntry = {
            text: `${buyer.name} compró "${listing.cardName}" de ${seller.name} por ${listing.price} DP.`,
            timestamp: Date.now(),
            type: 'market'
        };
        const historySellEntry = {
            text: `${seller.name} vendió "${listing.cardName}" y recibió ${profit} DP (Comisión de ${fee} DP).`,
            timestamp: Date.now() + 1,
            type: 'market'
        };

        // Batch para la transacción
        const batch = writeBatch(db);
        batch.update(buyerRef, { dp: newBuyerDp, card_collection: newBuyerCollection });
        batch.update(sellerRef, { dp: newSellerDp });
        batch.delete(listingRef);
        batch.set(doc(collection(db, dbHistoryRef.path)), historyBuyEntry);
        batch.set(doc(collection(db, dbHistoryRef.path)), historySellEntry);
        
        await batch.commit();
        
        showFeedback(marketBuyFeedback, "¡Compra exitosa!", false);

    } catch (error) {
        console.error("Error al comprar carta:", error);
        showFeedback(marketBuyFeedback, "Error al procesar la compra.", true);
    }
    // El botón se reactivará (o desaparecerá) con el listener del marketplace
}

// --- [FIN] MÓDULO: marketplace.js ---


// --- [INICIO] MÓDULO: deck-builder.js ---
let cardbaseCache = null;

function normalizeRarity(r) {
    if (!r) return 'unknown';
    const k = String(r).toLowerCase();
    if (['ur','ultra','ultra rare','ultrarare','ultra rara'].includes(k)) return 'ultraRare';
    if (['sr','super','super rare','superrare','súper rara','super rara'].includes(k)) return 'superRare';
    if (['rare','rara'].includes(k)) return 'rare';
    if (['common','común'].includes(k)) return 'common';
    return k;
}

function prettyRarity(k) {
    switch(k) {
        case 'common': return 'Common';
        case 'rare': return 'Rare';
        case 'superRare': return 'Super Rare';
        case 'ultraRare': return 'Ultra Rare';
        default: return 'Desconocida';
    }
}

async function loadCardbaseIndex() {
    if (cardbaseCache) return cardbaseCache;
    cardbaseCache = new Map();
    if (!dbCardbaseRef) return cardbaseCache;
    const snap = await getDocs(query(dbCardbaseRef));
    snap.forEach(docItem => {
        const data = docItem.data();
        const name = data.name || docItem.id;
        cardbaseCache.set(name, data);
    });
    return cardbaseCache;
}

function buildDeckCardElement(name, meta, count = 1) {
    const rarityKey = normalizeRarity(meta?.rarity);
    const packsText = Array.isArray(meta?.packs) ? meta.packs.join(', ') : (meta?.packs || '');
    const div = document.createElement('div');
    div.className = `deck-card rarity-${rarityKey}`;
    const countHtml = count > 1 ? `<span class="card-count">x${count}</span>` : '';
    div.innerHTML = `
        <div class="card-glow"></div>
        <div class="mini-art"></div>
        <div class="card-tooltip">
            <span class="card-title">${name}</span>
            <span class="card-rarity">${prettyRarity(rarityKey)}</span>
            <span class="card-pack">Pack: ${packsText || 'N/A'}</span>
            ${countHtml}
        </div>
    `;
    return div;
}

async function renderDeckBuilder() {
    if (!deckBuilderGrid) return; // Solo en packs.html
    deckBuilderGrid.innerHTML = '';
    if (deckBuilderFeedback) {
        deckBuilderFeedback.textContent = 'Cargando tu colección...';
        deckBuilderFeedback.style.opacity = '1';
    }

    if (!isLoggedIn()) {
        if (deckBuilderFeedback) {
            deckBuilderFeedback.textContent = 'Debes iniciar sesión para ver tu colección.';
        }
        return;
    }
    const currentUser = getCurrentUser();
    const player = localPlayersCache.get(currentUser.name);
    if (!player || !player.card_collection) {
        if (deckBuilderFeedback) {
            deckBuilderFeedback.textContent = 'Aún no tienes cartas. ¡Compra packs para empezar!';
        }
        return;
    }

    const cardIndex = await loadCardbaseIndex();
    const frag = document.createDocumentFragment();

    // Normalizar colección: soportar arreglo de nombres o objeto { nombre: cuenta }
    let counts = {};
    if (Array.isArray(player.card_collection)) {
        player.card_collection.forEach((n) => {
            const key = typeof n === 'string' ? n : String(n);
            counts[key] = (counts[key] || 0) + 1;
        });
    } else if (typeof player.card_collection === 'object' && player.card_collection !== null) {
        counts = { ...player.card_collection };
    }

    Object.entries(counts).forEach(([cardName, count]) => {
        const meta = cardIndex.get(cardName) || { name: cardName, rarity: 'unknown', packs: [] };
        frag.appendChild(buildDeckCardElement(cardName, meta, count));
    });
    deckBuilderGrid.appendChild(frag);
    if (deckBuilderFeedback) {
        deckBuilderFeedback.textContent = '';
        deckBuilderFeedback.style.opacity = '0';
    }
}

function initDeckBuilder() {
    renderDeckBuilder();
}

// --- [FIN] MÓDULO: deck-builder.js ---



// --- EXPORTACIONES PARA PÁGINAS INDIVIDUALES ---
export { 
    initStore, 
    updatePackButtonsUI,
    initGames, 
    updateGameButtonsUI,
    initMarketplace, 
    updateMarketplaceSellDropdown, 
    updateMarketplaceListings,
    initAdmin, 
    updateAdminDropdowns, 
    updateCardInventoryView, 
    updateDPTable, 
    updateRankingTable, 
    initHistoryListener,
    localPlayersCache,
    initDeckBuilder
};

// --- [INICIO] MÓDULO: eventos.js ---
// Proveer un inicializador mínimo para eventos.html
export function initEvents() {
    const container = document.getElementById('eventos-container');
    if (container) {
        // Si ya hay contenido, no sobreescribir
        if (container.children.length === 0) {
            container.innerHTML = '<p class="text-gray-300">No hay eventos disponibles todavía.</p>';
        }
    }
}

// --- INICIAR LA APLICACIÓN ---
// Esperar a que el DOM esté completamente cargado para iniciar
document.addEventListener('DOMContentLoaded', () => {
    
    initializeAppWithAuth();
});
