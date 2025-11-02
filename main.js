// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, setLogLevel, collection, doc, 
    onSnapshot, addDoc, setDoc, updateDoc, 
    getDocs, query, writeBatch, deleteDoc // Añadido deleteDoc para el reseteo
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('debug'); 

let userId;
let dbPlayersRef; 
let dbHistoryRef; 
let dbMarketplaceRef; // NUEVO: Para el Marketplace
let localPlayersCache = new Map();
let localMarketplaceCache = new Map(); // NUEVO: Cache para listados
let loggedInPlayerId = null;

const playerPasswords = {
    "Pepito": "pepe",
    "Prometeus": "falerini",
    "Rela": "itachikun10"
};
const TOTAL_GAMES = 3; // Reducido de 6 a 3
const DAILY_PLAY_LIMIT = 3;

// --- DOM ELEMENTS (MAIN) ---
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


// --- AUTENTICACIÓN Y INICIALIZACIÓN ---

async function initializeAppWithAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            
            const basePath = `torneo/torneo-data`; 
            dbPlayersRef = collection(db, `${basePath}/players`);
            dbHistoryRef = collection(db, `${basePath}/history`);
            dbMarketplaceRef = collection(db, `${basePath}/marketplace`); // NUEVO

            await seedInitialData();
            initPlayersListener();
            initHistoryListener();
            initMarketplaceListener(); // NUEVO
            
            dbLoadingFeedback.textContent = "¡Conexión exitosa!";
            dbLoadingFeedback.className = "text-green-400 text-sm h-5 text-center";
            
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
                dbLoadingFeedback.textContent = "Error al conectar con la DB.";
                dbLoadingFeedback.className = "text-red-400 text-sm h-5 text-center";
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
        updateMarketplaceSellDropdown(loggedInPlayerId); // NUEVO: Actualizar dropdown de venta
        
        if (loggedInPlayerId) {
            updateGameButtonsUI();
            updatePackButtonsUI(); // NUEVO: Actualizar botones de pack
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
    // Disparar manualmente el evento de cambio
    updateCardInventoryView(adminCardInventorySelect.value);
}


function updateGameButtonsUI() {
    if (!loggedInPlayerId) return;
    const player = localPlayersCache.get(loggedInPlayerId);
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
    if (!loggedInPlayerId) return;
    const player = localPlayersCache.get(loggedInPlayerId);
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
            document.getElementById('admin-unlock-button').disabled = false; 
            document.getElementById('admin-lock-screen').querySelector('p.text-xs').classList.add('hidden'); 
            
            updateGameButtonsUI(); // Actualiza los botones de juego al loguear
            updatePackButtonsUI(); // Actualizar botones de pack al loguear
            updateMarketplaceSellDropdown(loggedInPlayerId); // NUEVO: Cargar dropdown de venta
            
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


// --- [INICIO] MÓDULO: store.js ---

// --- DOM DE LA TIENDA ---
const packOpeningModal_store = document.getElementById('pack-opening-modal');
const modalClosePackButton = document.getElementById('modal-close-pack-button');
const packCardList = document.getElementById('pack-card-list');

// --- LISTA DE CARTAS DE LOS PACKS ---
const customPacks = {
    "Poder del Mago": {
        cost: 150,
        cards: {
            common: ["Dark Magician Girl", "Kuriboh", "Celtic Guardian", "Mammoth Graveyard", "Mystical Elf", "Feral Imp", "Book of Secret Arts", "Dark Hole", "Dian Keto the Cure Master", "Fissure", "Stop Defense", "Trap Hole", "Two-Pronged Attack"],
            rare: ["Dark Magician", "Gaia The Fierce Knight", "Black Luster Soldier", "Magician of Black Chaos", "Polymerization", "Monster Reborn", "Swords of Revealing Light", "Mirror Force"],
            superRare: ["Relinquished", "Black Illusion Ritual", "Thousand-Eyes Restrict"]
        },
        pullRates: { common: 4, rare: 1, superRare: 0 },
        luck: { from: "rare", to: "superRare", rate: 0.1 }
    },
    "Furia del Dragón": {
        cost: 150,
        cards: {
            common: ["Blue-Eyes White Dragon", "Hitotsu-Me Giant", "Rude Kaiser", "Kojikocy", "Saggi the Dark Clown", "Beaver Warrior", "Flame Swordsman", "Masaki the Legendary Swordsman", "Kunai with Chain", "Reinforcements", "Red-Eyes B. Dragon", "Gearfried the Iron Knight", "Axe Raider"],
            rare: ["Vorse Raider", "Battle Ox", "La Jinn the Mystical Genie of the Lamp", "Polymerization", "Crush Card Virus", "Enemy Controller", "Red-Eyes Black Metal Dragon", "Time Wizard", "Scapegoat", "Metalmorph"],
            superRare: ["XYZ-Dragon Cannon", "Blue-Eyes Ultimate Dragon", "Paladin of White Dragon"]
        },
        pullRates: { common: 4, rare: 1, superRare: 0 },
        luck: { from: "rare", to: "superRare", rate: 0.1 }
    },
    "Arsenal del Duelista": {
        cost: 300,
        cards: {
            common: ["Fissure", "Dark Hole", "De-Spell", "Stop Defense", "Trap Hole", "Remove Trap", "Mystical Space Typhoon", "Heavy Storm", "Giant Trunade", "Nobleman of Crossout"],
            rare: ["Book of Moon", "Swords of Revealing Light", "Monster Reborn", "Change of Heart", "Pot of Greed", "Graceful Charity", "Harpie's Feather Duster"],
            superRare: ["Raigeki", "Mirror Force", "Magic Cylinder", "Call of the Haunted", "Torrential Tribute", "Imperial Order"]
        },
        pullRates: { common: 3, rare: 1, superRare: 1 }
    },
    "Tesoro del Faraón": {
        cost: 500,
        cards: {
            common: ["Gravekeeper's Spy", "Gravekeeper's Guard", "Gravekeeper's Spear Soldier", "Mystical Tomato", "Spirit Reaper", "Mask of Darkness", "Magician of Faith"],
            rare: ["Gravekeeper's Chief", "Gravekeeper's Visionary", "Necrovalley", "Royal Tribute", "Pot of Avarice"],
            superRare: ["Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One", "Jinzo"]
        },
        pullRates: { common: 4, rare: 1, superRare: 0 },
        luck: { from: "rare", to: "superRare", rate: 0.1 }
    },
    "Legado del Ojo Azul": {
        cost: 1000,
        cards: {
            common: ["Vorse Raider", "X-Head Cannon", "Y-Dragon Head", "Z-Metal Tank", "Cyber Jar", "Sangan", "Witch of the Black Forest"],
            rare: ["Blue-Eyes White Dragon", "Kaibaman", "Cyber Dragon", "Crush Card Virus", "Enemy Controller", "Shrink", "Ring of Destruction"],
            superRare: ["Blue-Eyes Ultimate Dragon", "XYZ-Dragon Cannon", "Chaos Emperor Dragon - Envoy of the End", "Black Luster Soldier - Envoy of the Beginning"]
        },
        pullRates: { common: 4, rare: 1, superRare: 2 }
    },
    "El Cofre Prohibido": {
        cost: 1500,
        cards: {
            rare: ["Book of Moon", "Nobleman of Crossout", "Pot of Greed", "Graceful Charity", "Change of Heart", "Monster Reborn", "Harpie's Feather Duster", "Sangan", "Witch of the Black Forest"],
            superRare: ["Raigeki", "Mirror Force", "Magic Cylinder", "Call of the Haunted", "Torrential Tribute", "Imperial Order", "Jinzo", "Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One"],
            ultraRare: ["Chaos Emperor Dragon - Envoy of the End", "Black Luster Soldier - Envoy of the Beginning", "Dark Magician of Chaos", "Blue-Eyes Shining Dragon"]
        },
        pullRates: { common: 0, rare: 4, superRare: 2, ultraRare: 1 }
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
    if (!loggedInPlayerId) {
        showFeedback(purchaseFeedback, "Debes iniciar sesión para comprar", true);
        return;
    }

    const button = event.currentTarget;
    const packName = button.dataset.name;
    const packCost = parseInt(button.dataset.cost);
    const packData = customPacks[packName];
    
    const player = localPlayersCache.get(loggedInPlayerId);
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
        const pulledCards = openPack(packData);
        
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
function openPack(packData) {
    const pulledCards = [];
    const { cards, pullRates, luck } = packData;

    // Lógica para sacar cartas
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
    return pulledCards;
}

// Función para actualizar el inventario y DP del jugador en Firestore
async function updatePlayerInventory(player, packCost, pulledCards, packName) {
    const newDp = player.dp - packCost;
    const newCollection = { ...player.card_collection };

    pulledCards.forEach(card => {
        newCollection[card] = (newCollection[card] || 0) + 1;
    });

    const playerRef = doc(dbPlayersRef, player.id);
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
        opener.addEventListener('click', () => openGameModal(parseInt(id)));
    });

    // Inicializar listeners específicos de cada juego
    initGame1();
    initGame2();
    initGame3();
    // initGame4, 5, 6 eliminados
}

// --- LÓGICA DE MODAL (ABRIR/CERRAR) ---

function openGameModal(gameId) {
    const player = localPlayersCache.get(loggedInPlayerId);
    if (!player) return;

    // Comprobar si puede jugar
    const playCheck = getGamePlays(`game_${gameId}`);
    if (!playCheck.canPlay) {
        // Encontrar el botón de feedback del modal correcto
        const feedbackEl = gameModals[gameId].querySelector(`[id^="game-${gameId}-feedback"]`);
        showFeedback(feedbackEl, playCheck.reason, true, 2000);
        return;
    }

    currentGame = gameId;
    isGameInProgress = false;
    currentBet = 0;

    const modal = gameModals[gameId];
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
            modal.querySelector('#game-2-dice-1').textContent = '?';
            modal.querySelector('#game-2-dice-2').textContent = '?';
            modal.querySelectorAll('[id^="game-2-choice-"]').forEach(btn => btn.disabled = false);
            break;
        case 3:
            modal.querySelector('#game-3-coin').classList.add('hidden');
            modal.querySelector('#game-3-coin').textContent = '?';
            modal.querySelectorAll('[id^="game-3-choice-"]').forEach(btn => btn.disabled = false);
            break;
        // Casos 4, 5, 6 eliminados
    }
}

// --- LÓGICA DE APUESTAS (COMPARTIDA) ---
function selectBet(gameId, betAmount, betButton) {
    if (isGameInProgress) return;
    
    const player = localPlayersCache.get(loggedInPlayerId);
    const feedback = gameModals[gameId].querySelector(`[id^="game-${gameId}-feedback"]`);

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
            modal.querySelector('#game-2-bet-display').textContent = betAmount;
            break;
        case 3:
            modal.querySelector('#game-3-bet-display').textContent = betAmount;
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
    const feedback = modal.querySelector('#game-1-feedback');
    const cards = modal.querySelectorAll('.bet-card');
    showFeedback(feedback, "Revelando...", false, 0);

    const playCheck = getGamePlays('game_1');
    if (!playCheck.canPlay) {
        showFeedback(feedback, playCheck.reason, true);
        isGameInProgress = false;
        return;
    }

    const winningIndex = Math.floor(Math.random() * 3);
    const chosenIndex = parseInt(chosenCard.dataset.index);
    let dpChange = -currentBet;
    let historyText = "";
    let historyType = "";

    if (chosenIndex === winningIndex) {
        // GANÓ
        const winnings = Math.floor(currentBet * 1.5);
        dpChange = winnings - currentBet;
        historyText = `${loggedInPlayerId} ganó ${dpChange} DP en Eternals BetCards (apostó ${currentBet}).`;
        historyType = 'game_win';
        showFeedback(feedback, `¡GANASTE! Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
    } else {
        // PERDIÓ
        historyText = `${loggedInPlayerId} perdió ${currentBet} DP en Eternals BetCards.`;
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
    }

    isGameInProgress = false; // <<< CORRECCIÓN AQUÍ
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
        const choice = e.target.closest('.bet-button');
        if (choice && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            let choiceType = '';
            if (choice.id.includes('low')) choiceType = 'low';
            if (choice.id.includes('seven')) choiceType = 'seven';
            if (choice.id.includes('high')) choiceType = 'high';
            
            modal.querySelectorAll('[id^="game-2-choice-"]').forEach(btn => btn.disabled = true);
            await playGame2(choiceType);
        }
    });
}

async function playGame2(choice) {
    const modal = gameModals[2];
    const feedback = modal.querySelector('#game-2-feedback');
    const dice1El = modal.querySelector('#game-2-dice-1');
    const dice2El = modal.querySelector('#game-2-dice-2');
    
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
    }, 100);

    setTimeout(async () => {
        clearInterval(animInterval);
        
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        dice1El.textContent = d1;
        dice2El.textContent = d2;

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
            const multiplier = (choice === 'seven') ? 5 : 2;
            winnings = currentBet * multiplier;
            dpChange = winnings - currentBet;
            historyText = `${loggedInPlayerId} ganó ${dpChange} DP en Duelo de Dados (apostó ${currentBet} al ${total}).`;
            historyType = 'game_win';
            showFeedback(feedback, `¡GANASTE! Salió ${total}. Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
        } else {
            // PERDIÓ
            historyText = `${loggedInPlayerId} perdió ${currentBet} DP en Duelo de Dados (salió ${total}).`;
            historyType = 'game_lose';
            showFeedback(feedback, `¡Mala suerte! Salió ${total}. Pierdes ${currentBet} DP.`, true, 5000);
        }

        try {
            await recordGamePlay('game_2', playCheck.currentData, dpChange, historyText, historyType);
        } catch (e) {
            console.error(e);
            showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
        }

        isGameInProgress = false; // <<< CORRECCIÓN AQUÍ
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
        const choice = e.target.closest('.bet-button');
        if (choice && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            let choiceType = choice.id.includes('heads') ? 'CARA' : 'CRUZ';
            modal.querySelectorAll('[id^="game-3-choice-"]').forEach(btn => btn.disabled = true);
            await playGame3(choiceType);
        }
    });
}

async function playGame3(choice) {
    const modal = gameModals[3];
    const feedback = modal.querySelector('#game-3-feedback');
    const coinEl = modal.querySelector('#game-3-coin');
    
    showFeedback(feedback, "Lanzando moneda...", false, 0);
    coinEl.classList.remove('hidden');
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
            winnings = Math.floor(currentBet * 1.9); // 1.9x
            dpChange = winnings - currentBet;
            historyText = `${loggedInPlayerId} ganó ${dpChange} DP en Moneda del Milenio (apostó ${currentBet}).`;
            historyType = 'game_win';
            showFeedback(feedback, `¡GANASTE! Salió ${result}. Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
        } else {
            // PERDIÓ
            historyText = `${loggedInPlayerId} perdió ${currentBet} DP en Moneda del Milenio (salió ${result}).`;
            historyType = 'game_lose';
            showFeedback(feedback, `¡Mala suerte! Salió ${result}. Pierdes ${currentBet} DP.`, true, 5000);
        }

        try {
            await recordGamePlay('game_3', playCheck.currentData, dpChange, historyText, historyType);
        } catch (e) {
            console.error(e);
            showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
        }

        isGameInProgress = false; // <<< CORRECCIÓN AQUÍ
        setTimeout(() => {
            closeGameModal(3);
        }, 5000);

    }, 2000); // Duración de la animación
}

// --- [FIN] MÓDULO: games.js ---


// --- [INICIO] MÓDULO: admin.js ---

// --- DOM DEL ADMIN ---
const adminLockScreen = document.getElementById('admin-lock-screen'); // Sin sufijo, ahora es único
const adminPasswordInput = document.getElementById('admin-password');
const adminUnlockButton = document.getElementById('admin-unlock-button'); // Sin sufijo
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


// --- CONSTANTES DEL ADMIN ---
const ADMIN_PASSWORD = "as17sa71";

// --- FUNCIÓN DE INICIALIZACIÓN ---
function initAdmin() {
    adminUnlockButton.addEventListener('click', unlockAdminPanel);
    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminUnlockButton.click();
    });
    
    adminSubmitButton.addEventListener('click', registerDuel);
    adminAddPlayerButton.addEventListener('click', addNewPlayer);
    adminResetWeekButton.addEventListener('click', resetWeeklyRanking);
    
    adminCardInventorySelect.addEventListener('change', (e) => {
        updateCardInventoryView(e.target.value);
    });

    // NUEVO: Listener para el botón de reseteo
    adminFactoryResetButton.addEventListener('click', handleFactoryResetClick);
}

// --- LÓGICA DEL PANEL DE ADMIN ---

function unlockAdminPanel() {
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        adminLockScreen.classList.add('hidden');
        adminContent.classList.remove('hidden');
    } else {
        adminLockFeedback.textContent = "Contraseña incorrecta.";
        setTimeout(() => { adminLockFeedback.textContent = ''; }, 3000);
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
    let loserDpLoss = 0;
    let historyText = `Duelo registrado: ${winner.name} venció a ${loser.name}.`;
    
    const isSurrender = adminSurrenderCheckbox.checked;
    const isFlawless = adminFlawlessCheckbox.checked;

    if (isSurrender) {
        winnerDpGain += 50;
        loserDpLoss = -50;
        historyText += ` (Perdedor se rindió: -50 DP).`;
    }
    if (isFlawless) {
        winnerDpGain += 100;
        historyText += ` (Victoria Flawless: +100 DP).`;
    }

    const newWinnerDp = winner.dp + winnerDpGain;
    const newLoserDp = Math.max(0, loser.dp + loserDpLoss); // Evitar DP negativos
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
    const newDeck = adminNewPlayerDeck.value;

    if (!newName) {
        showFeedback(adminFeedback, "El nombre no puede estar vacío.", true);
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
        
        // Resetear victorias de todos
        players.forEach(player => {
            const playerRef = doc(dbPlayersRef, player.id);
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

        // 1. Borrar todos los jugadores
        const playersSnapshot = await getDocs(dbPlayersRef);
        playersSnapshot.forEach(doc => batch.delete(doc.ref));

        // 2. Borrar todo el historial
        const historySnapshot = await getDocs(dbHistoryRef);
        historySnapshot.forEach(doc => batch.delete(doc.ref));

        // 3. Borrar todos los listados del marketplace (NUEVO)
        const marketplaceSnapshot = await getDocs(dbMarketplaceRef);
        marketplaceSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        
        showFeedback(adminResetFeedback, "¡Borrado completo! Volviendo a sembrar datos...", false, 0);

        // Volver a sembrar los datos iniciales
        // seedInitialData se llamará automáticamente por el listener de players al ver que está vacío
        // Pero lo llamamos manualmente para asegurar
        await seedInitialData();

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
        
        const isOwner = listing.sellerId === loggedInPlayerId;
        const player = localPlayersCache.get(loggedInPlayerId);
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

function updateMarketplaceSellDropdown(playerId) {
    marketSellCardSelect.innerHTML = '';
    if (!playerId) {
        marketSellCardSelect.innerHTML = `<option>Inicia sesión para vender</option>`;
        return;
    }
    
    const player = localPlayersCache.get(playerId);
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
    const cardName = marketSellCardSelect.value;
    const price = parseInt(marketSellPriceInput.value);
    const player = localPlayersCache.get(loggedInPlayerId);

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
            sellerId: loggedInPlayerId,
            sellerName: player.name,
            timestamp: Date.now()
        };
        
        // 2. Actualizar el inventario del jugador
        const newCollection = { ...player.card_collection };
        newCollection[cardName] = newCollection[cardName] - 1;
        if (newCollection[cardName] === 0) {
            delete newCollection[cardName]; // Limpiar si ya no tiene
        }
        
        const playerRef = doc(dbPlayersRef, loggedInPlayerId);
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

    const buyer = localPlayersCache.get(loggedInPlayerId);
    if (!buyer) {
        showFeedback(marketBuyFeedback, "Debes iniciar sesión para comprar.", true);
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


// --- INICIAR LA APLICACIÓN ---
// Esperar a que el DOM esté completamente cargado para iniciar
document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initializeAppWithAuth();
});


    "Rela": "itachikun10"
};
const TOTAL_GAMES = 3; // Reducido de 6 a 3
const DAILY_PLAY_LIMIT = 3;

// --- DOM ELEMENTS (MAIN) ---
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


// --- AUTENTICACIÓN Y INICIALIZACIÓN ---

async function initializeAppWithAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            
            const basePath = `torneo/torneo-data`; 
            dbPlayersRef = collection(db, `${basePath}/players`);
            dbHistoryRef = collection(db, `${basePath}/history`);
            dbMarketplaceRef = collection(db, `${basePath}/marketplace`); // NUEVO

            await seedInitialData();
            initPlayersListener();
            initHistoryListener();
            initMarketplaceListener(); // NUEVO
            
            dbLoadingFeedback.textContent = "¡Conexión exitosa!";
            dbLoadingFeedback.className = "text-green-400 text-sm h-5 text-center";
            
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
                dbLoadingFeedback.textContent = "Error al conectar con la DB.";
                dbLoadingFeedback.className = "text-red-400 text-sm h-5 text-center";
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
        updateMarketplaceSellDropdown(loggedInPlayerId); // NUEVO: Actualizar dropdown de venta
        
        if (loggedInPlayerId) {
            updateGameButtonsUI();
            updatePackButtonsUI(); // NUEVO: Actualizar botones de pack
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
    // Disparar manualmente el evento de cambio
    updateCardInventoryView(adminCardInventorySelect.value);
}


function updateGameButtonsUI() {
    if (!loggedInPlayerId) return;
    const player = localPlayersCache.get(loggedInPlayerId);
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
    if (!loggedInPlayerId) return;
    const player = localPlayersCache.get(loggedInPlayerId);
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
            document.getElementById('admin-unlock-button').disabled = false; 
            document.getElementById('admin-lock-screen').querySelector('p.text-xs').classList.add('hidden'); 
            
            updateGameButtonsUI(); // Actualiza los botones de juego al loguear
            updatePackButtonsUI(); // Actualizar botones de pack al loguear
            updateMarketplaceSellDropdown(loggedInPlayerId); // NUEVO: Cargar dropdown de venta
            
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


// --- [INICIO] MÓDULO: store.js ---

// --- DOM DE LA TIENDA ---
const packOpeningModal_store = document.getElementById('pack-opening-modal');
const modalClosePackButton = document.getElementById('modal-close-pack-button');
const packCardList = document.getElementById('pack-card-list');

// --- LISTA DE CARTAS DE LOS PACKS ---
const customPacks = {
    "Poder del Mago": {
        cost: 150,
        cards: {
            common: ["Dark Magician Girl", "Kuriboh", "Celtic Guardian", "Mammoth Graveyard", "Mystical Elf", "Feral Imp", "Book of Secret Arts", "Dark Hole", "Dian Keto the Cure Master", "Fissure", "Stop Defense", "Trap Hole", "Two-Pronged Attack"],
            rare: ["Dark Magician", "Gaia The Fierce Knight", "Black Luster Soldier", "Magician of Black Chaos", "Polymerization", "Monster Reborn", "Swords of Revealing Light", "Mirror Force"],
            superRare: ["Relinquished", "Black Illusion Ritual", "Thousand-Eyes Restrict"]
        },
        pullRates: { common: 4, rare: 1, superRare: 0 },
        luck: { from: "rare", to: "superRare", rate: 0.1 }
    },
    "Furia del Dragón": {
        cost: 150,
        cards: {
            common: ["Blue-Eyes White Dragon", "Hitotsu-Me Giant", "Rude Kaiser", "Kojikocy", "Saggi the Dark Clown", "Beaver Warrior", "Flame Swordsman", "Masaki the Legendary Swordsman", "Kunai with Chain", "Reinforcements", "Red-Eyes B. Dragon", "Gearfried the Iron Knight", "Axe Raider"],
            rare: ["Vorse Raider", "Battle Ox", "La Jinn the Mystical Genie of the Lamp", "Polymerization", "Crush Card Virus", "Enemy Controller", "Red-Eyes Black Metal Dragon", "Time Wizard", "Scapegoat", "Metalmorph"],
            superRare: ["XYZ-Dragon Cannon", "Blue-Eyes Ultimate Dragon", "Paladin of White Dragon"]
        },
        pullRates: { common: 4, rare: 1, superRare: 0 },
        luck: { from: "rare", to: "superRare", rate: 0.1 }
    },
    "Arsenal del Duelista": {
        cost: 300,
        cards: {
            common: ["Fissure", "Dark Hole", "De-Spell", "Stop Defense", "Trap Hole", "Remove Trap", "Mystical Space Typhoon", "Heavy Storm", "Giant Trunade", "Nobleman of Crossout"],
            rare: ["Book of Moon", "Swords of Revealing Light", "Monster Reborn", "Change of Heart", "Pot of Greed", "Graceful Charity", "Harpie's Feather Duster"],
            superRare: ["Raigeki", "Mirror Force", "Magic Cylinder", "Call of the Haunted", "Torrential Tribute", "Imperial Order"]
        },
        pullRates: { common: 3, rare: 1, superRare: 1 }
    },
    "Tesoro del Faraón": {
        cost: 500,
        cards: {
            common: ["Gravekeeper's Spy", "Gravekeeper's Guard", "Gravekeeper's Spear Soldier", "Mystical Tomato", "Spirit Reaper", "Mask of Darkness", "Magician of Faith"],
            rare: ["Gravekeeper's Chief", "Gravekeeper's Visionary", "Necrovalley", "Royal Tribute", "Pot of Avarice"],
            superRare: ["Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One", "Jinzo"]
        },
        pullRates: { common: 4, rare: 1, superRare: 0 },
        luck: { from: "rare", to: "superRare", rate: 0.1 }
    },
    "Legado del Ojo Azul": {
        cost: 1000,
        cards: {
            common: ["Vorse Raider", "X-Head Cannon", "Y-Dragon Head", "Z-Metal Tank", "Cyber Jar", "Sangan", "Witch of the Black Forest"],
            rare: ["Blue-Eyes White Dragon", "Kaibaman", "Cyber Dragon", "Crush Card Virus", "Enemy Controller", "Shrink", "Ring of Destruction"],
            superRare: ["Blue-Eyes Ultimate Dragon", "XYZ-Dragon Cannon", "Chaos Emperor Dragon - Envoy of the End", "Black Luster Soldier - Envoy of the Beginning"]
        },
        pullRates: { common: 4, rare: 1, superRare: 2 }
    },
    "El Cofre Prohibido": {
        cost: 1500,
        cards: {
            rare: ["Book of Moon", "Nobleman of Crossout", "Pot of Greed", "Graceful Charity", "Change of Heart", "Monster Reborn", "Harpie's Feather Duster", "Sangan", "Witch of the Black Forest"],
            superRare: ["Raigeki", "Mirror Force", "Magic Cylinder", "Call of the Haunted", "Torrential Tribute", "Imperial Order", "Jinzo", "Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One"],
            ultraRare: ["Chaos Emperor Dragon - Envoy of the End", "Black Luster Soldier - Envoy of the Beginning", "Dark Magician of Chaos", "Blue-Eyes Shining Dragon"]
        },
        pullRates: { common: 0, rare: 4, superRare: 2, ultraRare: 1 }
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
    if (!loggedInPlayerId) {
        showFeedback(purchaseFeedback, "Debes iniciar sesión para comprar", true);
        return;
    }

    const button = event.currentTarget;
    const packName = button.dataset.name;
    const packCost = parseInt(button.dataset.cost);
    const packData = customPacks[packName];
    
    const player = localPlayersCache.get(loggedInPlayerId);
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
        const pulledCards = openPack(packData);
        
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
function openPack(packData) {
    const pulledCards = [];
    const { cards, pullRates, luck } = packData;

    // Lógica para sacar cartas
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
    return pulledCards;
}

// Función para actualizar el inventario y DP del jugador en Firestore
async function updatePlayerInventory(player, packCost, pulledCards, packName) {
    const newDp = player.dp - packCost;
    const newCollection = { ...player.card_collection };

    pulledCards.forEach(card => {
        newCollection[card] = (newCollection[card] || 0) + 1;
    });

    const playerRef = doc(dbPlayersRef, player.id);
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
        opener.addEventListener('click', () => openGameModal(parseInt(id)));
    });

    // Inicializar listeners específicos de cada juego
    initGame1();
    initGame2();
    initGame3();
    // initGame4, 5, 6 eliminados
}

// --- LÓGICA DE MODAL (ABRIR/CERRAR) ---

function openGameModal(gameId) {
    const player = localPlayersCache.get(loggedInPlayerId);
    if (!player) return;

    // Comprobar si puede jugar
    const playCheck = getGamePlays(`game_${gameId}`);
    if (!playCheck.canPlay) {
        // Encontrar el botón de feedback del modal correcto
        const feedbackEl = gameModals[gameId].querySelector(`[id^="game-${gameId}-feedback"]`);
        showFeedback(feedbackEl, playCheck.reason, true, 2000);
        return;
    }

    currentGame = gameId;
    isGameInProgress = false;
    currentBet = 0;

    const modal = gameModals[gameId];
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
            modal.querySelector('#game-2-dice-1').textContent = '?';
            modal.querySelector('#game-2-dice-2').textContent = '?';
            modal.querySelectorAll('[id^="game-2-choice-"]').forEach(btn => btn.disabled = false);
            break;
        case 3:
            modal.querySelector('#game-3-coin').classList.add('hidden');
            modal.querySelector('#game-3-coin').textContent = '?';
            modal.querySelectorAll('[id^="game-3-choice-"]').forEach(btn => btn.disabled = false);
            break;
        // Casos 4, 5, 6 eliminados
    }
}

// --- LÓGICA DE APUESTAS (COMPARTIDA) ---
function selectBet(gameId, betAmount, betButton) {
    if (isGameInProgress) return;
    
    const player = localPlayersCache.get(loggedInPlayerId);
    const feedback = gameModals[gameId].querySelector(`[id^="game-${gameId}-feedback"]`);

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
            modal.querySelector('#game-2-bet-display').textContent = betAmount;
            break;
        case 3:
            modal.querySelector('#game-3-bet-display').textContent = betAmount;
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
    const feedback = modal.querySelector('#game-1-feedback');
    const cards = modal.querySelectorAll('.bet-card');
    showFeedback(feedback, "Revelando...", false, 0);

    const playCheck = getGamePlays('game_1');
    if (!playCheck.canPlay) {
        showFeedback(feedback, playCheck.reason, true);
        isGameInProgress = false;
        return;
    }

    const winningIndex = Math.floor(Math.random() * 3);
    const chosenIndex = parseInt(chosenCard.dataset.index);
    let dpChange = -currentBet;
    let historyText = "";
    let historyType = "";

    if (chosenIndex === winningIndex) {
        // GANÓ
        const winnings = Math.floor(currentBet * 1.5);
        dpChange = winnings - currentBet;
        historyText = `${loggedInPlayerId} ganó ${dpChange} DP en Eternals BetCards (apostó ${currentBet}).`;
        historyType = 'game_win';
        showFeedback(feedback, `¡GANASTE! Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
    } else {
        // PERDIÓ
        historyText = `${loggedInPlayerId} perdió ${currentBet} DP en Eternals BetCards.`;
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
        const choice = e.target.closest('.bet-button');
        if (choice && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            let choiceType = '';
            if (choice.id.includes('low')) choiceType = 'low';
            if (choice.id.includes('seven')) choiceType = 'seven';
            if (choice.id.includes('high')) choiceType = 'high';
            
            modal.querySelectorAll('[id^="game-2-choice-"]').forEach(btn => btn.disabled = true);
            await playGame2(choiceType);
        }
    });
}

async function playGame2(choice) {
    const modal = gameModals[2];
    const feedback = modal.querySelector('#game-2-feedback');
    const dice1El = modal.querySelector('#game-2-dice-1');
    const dice2El = modal.querySelector('#game-2-dice-2');
    
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
    }, 100);

    setTimeout(async () => {
        clearInterval(animInterval);
        
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        dice1El.textContent = d1;
        dice2El.textContent = d2;

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
            const multiplier = (choice === 'seven') ? 5 : 2;
            winnings = currentBet * multiplier;
            dpChange = winnings - currentBet;
            historyText = `${loggedInPlayerId} ganó ${dpChange} DP en Duelo de Dados (apostó ${currentBet} al ${total}).`;
            historyType = 'game_win';
            showFeedback(feedback, `¡GANASTE! Salió ${total}. Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
        } else {
            // PERDIÓ
            historyText = `${loggedInPlayerId} perdió ${currentBet} DP en Duelo de Dados (salió ${total}).`;
            historyType = 'game_lose';
            showFeedback(feedback, `¡Mala suerte! Salió ${total}. Pierdes ${currentBet} DP.`, true, 5000);
        }

        try {
            await recordGamePlay('game_2', playCheck.currentData, dpChange, historyText, historyType);
        } catch (e) {
            console.error(e);
            showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
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
        const choice = e.target.closest('.bet-button');
        if (choice && currentBet > 0 && !isGameInProgress) {
            isGameInProgress = true;
            let choiceType = choice.id.includes('heads') ? 'CARA' : 'CRUZ';
            modal.querySelectorAll('[id^="game-3-choice-"]').forEach(btn => btn.disabled = true);
            await playGame3(choiceType);
        }
    });
}

async function playGame3(choice) {
    const modal = gameModals[3];
    const feedback = modal.querySelector('#game-3-feedback');
    const coinEl = modal.querySelector('#game-3-coin');
    
    showFeedback(feedback, "Lanzando moneda...", false, 0);
    coinEl.classList.remove('hidden');
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
            winnings = Math.floor(currentBet * 1.9); // 1.9x
            dpChange = winnings - currentBet;
            historyText = `${loggedInPlayerId} ganó ${dpChange} DP en Moneda del Milenio (apostó ${currentBet}).`;
            historyType = 'game_win';
            showFeedback(feedback, `¡GANASTE! Salió ${result}. Recibes ${winnings} DP (+${dpChange} DP).`, false, 5000);
        } else {
            // PERDIÓ
            historyText = `${loggedInPlayerId} perdió ${currentBet} DP en Moneda del Milenio (salió ${result}).`;
            historyType = 'game_lose';
            showFeedback(feedback, `¡Mala suerte! Salió ${result}. Pierdes ${currentBet} DP.`, true, 5000);
        }

        try {
            await recordGamePlay('game_3', playCheck.currentData, dpChange, historyText, historyType);
        } catch (e) {
            console.error(e);
            showFeedback(feedback, "Error al guardar el resultado.", true, 5000);
        }

        setTimeout(() => {
            closeGameModal(3);
        }, 5000);

    }, 2000); // Duración de la animación
}

// --- [FIN] MÓDULO: games.js ---


// --- [INICIO] MÓDULO: admin.js ---

// --- DOM DEL ADMIN ---
const adminLockScreen = document.getElementById('admin-lock-screen'); // Sin sufijo, ahora es único
const adminPasswordInput = document.getElementById('admin-password');
const adminUnlockButton = document.getElementById('admin-unlock-button'); // Sin sufijo
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


// --- CONSTANTES DEL ADMIN ---
const ADMIN_PASSWORD = "as17sa71";

// --- FUNCIÓN DE INICIALIZACIÓN ---
function initAdmin() {
    adminUnlockButton.addEventListener('click', unlockAdminPanel);
    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminUnlockButton.click();
    });
    
    adminSubmitButton.addEventListener('click', registerDuel);
    adminAddPlayerButton.addEventListener('click', addNewPlayer);
    adminResetWeekButton.addEventListener('click', resetWeeklyRanking);
    
    adminCardInventorySelect.addEventListener('change', (e) => {
        updateCardInventoryView(e.target.value);
    });

    // NUEVO: Listener para el botón de reseteo
    adminFactoryResetButton.addEventListener('click', handleFactoryResetClick);
}

// --- LÓGICA DEL PANEL DE ADMIN ---

function unlockAdminPanel() {
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        adminLockScreen.classList.add('hidden');
        adminContent.classList.remove('hidden');
    } else {
        adminLockFeedback.textContent = "Contraseña incorrecta.";
        setTimeout(() => { adminLockFeedback.textContent = ''; }, 3000);
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
    let loserDpLoss = 0;
    let historyText = `Duelo registrado: ${winner.name} venció a ${loser.name}.`;
    
    const isSurrender = adminSurrenderCheckbox.checked;
    const isFlawless = adminFlawlessCheckbox.checked;

    if (isSurrender) {
        winnerDpGain += 50;
        loserDpLoss = -50;
        historyText += ` (Perdedor se rindió: -50 DP).`;
    }
    if (isFlawless) {
        winnerDpGain += 100;
        historyText += ` (Victoria Flawless: +100 DP).`;
    }

    const newWinnerDp = winner.dp + winnerDpGain;
    const newLoserDp = Math.max(0, loser.dp + loserDpLoss); // Evitar DP negativos
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
    const newDeck = adminNewPlayerDeck.value;

    if (!newName) {
        showFeedback(adminFeedback, "El nombre no puede estar vacío.", true);
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
        
        // Resetear victorias de todos
        players.forEach(player => {
            const playerRef = doc(dbPlayersRef, player.id);
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

        // 1. Borrar todos los jugadores
        const playersSnapshot = await getDocs(dbPlayersRef);
        playersSnapshot.forEach(doc => batch.delete(doc.ref));

        // 2. Borrar todo el historial
        const historySnapshot = await getDocs(dbHistoryRef);
        historySnapshot.forEach(doc => batch.delete(doc.ref));

        // 3. Borrar todos los listados del marketplace (NUEVO)
        const marketplaceSnapshot = await getDocs(dbMarketplaceRef);
        marketplaceSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        
        showFeedback(adminResetFeedback, "¡Borrado completo! Volviendo a sembrar datos...", false, 0);

        // Volver a sembrar los datos iniciales
        // seedInitialData se llamará automáticamente por el listener de players al ver que está vacío
        // Pero lo llamamos manualmente para asegurar
        await seedInitialData();

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
        
        const isOwner = listing.sellerId === loggedInPlayerId;
        const player = localPlayersCache.get(loggedInPlayerId);
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

function updateMarketplaceSellDropdown(playerId) {
    marketSellCardSelect.innerHTML = '';
    if (!playerId) {
        marketSellCardSelect.innerHTML = `<option>Inicia sesión para vender</option>`;
        return;
    }
    
    const player = localPlayersCache.get(playerId);
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
    const cardName = marketSellCardSelect.value;
    const price = parseInt(marketSellPriceInput.value);
    const player = localPlayersCache.get(loggedInPlayerId);

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
            sellerId: loggedInPlayerId,
            sellerName: player.name,
            timestamp: Date.now()
        };
        
        // 2. Actualizar el inventario del jugador
        const newCollection = { ...player.card_collection };
        newCollection[cardName] = newCollection[cardName] - 1;
        if (newCollection[cardName] === 0) {
            delete newCollection[cardName]; // Limpiar si ya no tiene
        }
        
        const playerRef = doc(dbPlayersRef, loggedInPlayerId);
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

    const buyer = localPlayersCache.get(loggedInPlayerId);
    if (!buyer) {
        showFeedback(marketBuyFeedback, "Debes iniciar sesión para comprar.", true);
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


// --- INICIAR LA APLICACIÓN ---
// Esperar a que el DOM esté completamente cargado para iniciar
document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initializeAppWithAuth();
});

