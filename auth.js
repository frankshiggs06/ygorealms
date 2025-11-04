// --- SISTEMA DE AUTENTICACIÓN GLOBAL ---
// Este archivo maneja la autenticación y sesión en toda la aplicación

import { 
    auth, db, dbPlayersRef, dbHistoryRef, dbMarketplaceRef,
    signInAnonymously, onAuthStateChanged, collection, doc,
    onSnapshot, addDoc, setDoc, updateDoc, getDocs, query,
    writeBatch, deleteDoc
} from './firebase.js';

// --- CONSTANTES ---
const SESSION_KEY = 'ygo_session';
const TOTAL_GAMES = 3; // usado para sembrar/gestionar plays iniciales


// --- VARIABLES GLOBALES ---
let userId;
let localPlayersCache = new Map();
let localMarketplaceCache = new Map();

// --- CONSTANTES ---
// Listas completas de Decks Iniciales disponibles en toda la app
export const STARTER_DECKS = {
    Yugi: {
        monsters: [
            'Mystical Elf',
            'Feral Imp',
            'Winged Dragon, Guardian of the Fortress #1',
            'Summoned Skull',
            'Beaver Warrior',
            'Dark Magician',
            'Gaia The Fierce Knight',
            'Curse of Dragon',
            'Celtic Guardian',
            'Mammoth Graveyard',
            'Great White',
            'Silver Fang',
            'Giant Soldier of Stone',
            'Dragon Zombie',
            'Doma The Angel of Silence',
            'Ansatsu',
            'Witty Phantom',
            'Claw Reacher',
            'Mystic Clown',
            'Ancient Elf',
            'Magical Ghost',
            'The Stern Mystic',
            'Wall of Illusion',
            'Neo the Magic Swordsman',
            'Baron of the Fiend Sword',
            'Man-Eating Treasure Chest',
            'Sorcerer of the Doomed',
            'Trap Master',
            'Man-Eater Bug'
        ],
        spells: [
            'Sword of Dark Destruction',
            'Book of Secret Arts',
            'Dark Hole',
            'Dian Keto the Cure Master',
            'Fissure',
            'De-Spell',
            'Monster Reborn',
            'Change of Heart',
            'Last Will',
            'Soul Exchange',
            'Card Destruction',
            'Yami',
            'Remove Trap'
        ],
        traps: [
            'Trap Hole',
            'Two-Pronged Attack',
            'Reinforcements',
            'Waboku',
            'Dragon Capture Jar',
            'Reverse Trap',
            'Castle Walls',
            'Ultimate Offering'
        ]
    },
    Joey: {
        monsters: [
            'Red-Eyes Black Dragon',
            '7 Colored Fish',
            'Sky Scout',
            'Darkfire Soldier #1',
            'Armored Lizard',
            'Island Turtle',
            'Masaki the Legendary Swordsman',
            'Spirit of the Harp',
            'Baby Dragon',
            'Flame Manipulator',
            'Swordsman of Landstar',
            'Gearfried the Iron Knight',
            'Maha Vailo',
            'Big Eye',
            'Karate Man',
            'White Magical Hat',
            'Sangan',
            'Princess of Tsurugi',
            'Penguin Soldier',
            'Time Wizard',
            'Magician of Faith',
            'Milus Radiant'
        ],
        spells: [
            'Dragon Treasure',
            'Malevolent Nuzzler',
            'Mountain',
            'Block Attack',
            'Change of Heart',
            'Dark Hole',
            'De-Spell',
            'Dian Keto the Cure Master',
            'Eternal Rest',
            'Fissure',
            'Giant Trunade',
            'Monster Reborn',
            'Polymerization',
            'Remove Trap',
            'Shield & Sword',
            'Scapegoat',
            'The Reliable Guardian'
        ],
        traps: [
            'Ultimate Offering',
            'Seven Tools of the Bandit',
            'Castle Walls',
            'Fake Trap',
            'Just Desserts',
            'Reinforcements',
            'Reverse Trap',
            'Trap Hole',
            'Waboku'
        ],
        extra: [
            'Thousand Dragon',
            'Flame Swordsman'
        ]
    },
    Pegasus: {
        monsters: [
            'Ryu-Ran',
            'Illusionist Faceless Mage',
            'Rogue Doll',
            'Uraby',
            'Red Archery Girl',
            'Aqua Madoor',
            'Toon Alligator',
            'Giant Soldier of Stone',
            'Blue-Eyes Toon Dragon',
            'Manga Ryu-Ran',
            'Toon Summoned Skull',
            'Toon Mermaid',
            'Sonic Bird',
            'Witch of the Black Forest',
            'Dream Clown',
            'Mask of Darkness',
            "Hiro's Shadow Scout",
            'Muka Muka',
            'Man-Eater Bug',
            'Hane-Hane',
            'Jigen Bakudan',
            'Armed Ninja',
            'Relinquished'
        ],
        spells: [
            'Toon World',
            'Black Pendant',
            'Ring of Magnetism',
            'Yami',
            'Change of Heart',
            'Dark Hole',
            'De-Spell',
            'Dian Keto the Cure Master',
            'Fissure',
            'Graceful Charity',
            'Monster Reborn',
            'Remove Trap',
            'Soul Release',
            'Stop Defense',
            'Mystical Space Typhoon',
            'Rush Recklessly',
            'Black Illusion Ritual'
        ],
        traps: [
            "Robbin' Goblin",
            'Ultimate Offering',
            'Magic Jammer',
            'Seven Tools of the Bandit',
            'Castle Walls',
            'Enchanted Javelin',
            'Gryphon Wing',
            'Reinforcements',
            'Trap Hole',
            'Waboku'
        ]
    },
    Kaiba: {
        monsters: [
            'Blue-Eyes White Dragon',
            'Judge Man',
            'Swordstalker',
            'Gyakutenno Megami',
            'Rude Kaiser',
            'La Jinn the Mystical Genie of the Lamp',
            'Battle Ox',
            'Ryu-Kishin Powered',
            'Rogue Doll',
            'Skull Red Bird',
            'Kojikocy',
            'Koumori Dragon',
            'Pale Beast',
            'Destroyer Golem',
            'Mystic Clown',
            'Uraby',
            'Mystic Horseman',
            'D. Human',
            'Dark Titan of Terror',
            'Ogre of the Black Shadow',
            'Terra the Terrible',
            'Dark Assailant',
            'Hitotsu-Me Giant',
            'Master & Expert',
            'Ryu-Kishin',
            'Unknown Warrior of Fiend',
            'Lord of D.',
            'Mysterious Puppeteer',
            'The Wicked Worm Beast',
            'Trap Master',
            'Hane-Hane'
        ],
        spells: [
            'Dark Energy',
            'Invigoration',
            'Sogen',
            'Ancient Telescope',
            'Dark Hole',
            'De-Spell',
            'Fissure',
            'Monster Reborn',
            'Ookazi',
            'Remove Trap',
            'The Flute of Summoning Dragon',
            'The Inexperienced Spy'
        ],
        traps: [
            'Ultimate Offering',
            'Castle Walls',
            'Just Desserts',
            'Reinforcements',
            'Reverse Trap',
            'Trap Hole',
            'Two-Pronged Attack'
        ]
    }
};


// --- CLASE PARA MANEJAR LA SESIÓN ---
class SessionManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.callbacks = [];
    }

    // Guardar sesión en localStorage
    saveSession(userData) {
        const sessionData = {
            userId: userData.id,
            userData: userData,
            timestamp: Date.now()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        this.currentUser = userData;
        this.isAuthenticated = true;
        this.notifyCallbacks();
    }

    // Recuperar sesión desde localStorage
    loadSession() {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (sessionData) {
            try {
                const parsed = JSON.parse(sessionData);
                // Verificar que la sesión no sea muy antigua (opcional)
                const dayInMs = 24 * 60 * 60 * 1000;
                if (Date.now() - parsed.timestamp < dayInMs) {
                    this.currentUser = parsed.userData;
                    this.isAuthenticated = true;
                    return parsed.userData;
                } else {
                    this.clearSession();
                }
            } catch (error) {
                console.error('Error al cargar sesión:', error);
                this.clearSession();
            }
        }
        return null;
    }

    // Limpiar sesión
    clearSession() {
        localStorage.removeItem(SESSION_KEY);
        this.currentUser = null;
        this.isAuthenticated = false;
        this.notifyCallbacks();
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar si está autenticado
    isLoggedIn() {
        return this.isAuthenticated;
    }

    // Agregar callback para cambios de sesión
    onSessionChange(callback) {
        this.callbacks.push(callback);
    }

    // Notificar a todos los callbacks
    notifyCallbacks() {
        this.callbacks.forEach(callback => {
            try {
                callback(this.currentUser, this.isAuthenticated);
            } catch (error) {
                console.error('Error en callback de sesión:', error);
            }
        });
    }
}

// --- INSTANCIA GLOBAL DEL MANAGER ---
const sessionManager = new SessionManager();

// --- FUNCIONES DE INICIALIZACIÓN ---
function getInitialGamePlays() {
    let plays = {};
    for (let i = 1; i <= TOTAL_GAMES; i++) {
        plays[`game_${i}`] = { count: 0, reset_timestamp: null };
    }
    return plays;
}

async function seedInitialData() {
    const playerQuery = query(dbPlayersRef);
    const snapshot = await getDocs(playerQuery);
    if (snapshot.empty) {
        console.log("Base de datos vacía. Sin usuarios de prueba.");
        // No crear usuarios iniciales automáticamente.
    }
}

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
        
        // Si hay un usuario logueado, actualizar sus datos
        if (sessionManager.isLoggedIn()) {
            const currentUser = sessionManager.getCurrentUser();
            const updatedUser = localPlayersCache.get(currentUser.id);
            if (updatedUser) {
                sessionManager.saveSession(updatedUser);
            }
        }
        
        // Notificar cambios
        sessionManager.notifyCallbacks();
    });
}

function initHistoryListener() {
    onSnapshot(dbHistoryRef, (snapshot) => {
        // Este listener se mantiene para el historial
        // Las páginas individuales pueden suscribirse si necesitan el historial
    });
}

function initMarketplaceListener() {
    onSnapshot(dbMarketplaceRef, (snapshot) => {
        localMarketplaceCache.clear();
        snapshot.forEach((doc) => {
            const listingData = doc.data();
            listingData.id = doc.id;
            localMarketplaceCache.set(doc.id, listingData);
        });
        
        // Notificar cambios del marketplace
        sessionManager.notifyCallbacks();
    });
}

// --- FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ---
export async function initializeAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                // Referencias ya provienen de firebase.js; no reasignar imports
                await seedInitialData();
                
                // Esperar a que se carguen los datos de los jugadores
                const unsubscribe = onSnapshot(dbPlayersRef, (snapshot) => {
                    localPlayersCache.clear();
                    snapshot.forEach((doc) => {
                        const playerData = doc.data();
                        playerData.id = doc.id;
                        localPlayersCache.set(playerData.id, playerData);
                    });
                    
                    // Cargar sesión existente si existe
                    const savedSession = sessionManager.loadSession();
                    if (savedSession) {
                        // Verificar que el usuario aún existe en la base de datos
                        const userExists = localPlayersCache.get(savedSession.id);
                        if (userExists) {
                            sessionManager.saveSession(userExists);
                        } else {
                            sessionManager.clearSession();
                        }
                    }
                    
                    // Notificar cambios
                    sessionManager.notifyCallbacks();
                    
                    // Resolver la promesa una vez que los datos están cargados
                    unsubscribe(); // Desuscribirse del listener temporal
                    initPlayersListener(); // Iniciar el listener permanente
                    initHistoryListener();
                    initMarketplaceListener();
                    resolve(sessionManager);
                });
                
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Error de autenticación:", error);
                    reject(error);
                }
            }
        });
    });
}

// --- FUNCIONES DE LOGIN ---
export function attemptLogin(username, password) {
    if (localPlayersCache.size === 0) {
        return { success: false, message: 'Aún conectando con la base de datos...' };
    }

    let foundPlayer = null;
    for (const player of localPlayersCache.values()) {
        if (player.name.toLowerCase() === username.toLowerCase()) {
            foundPlayer = player;
            break;
        }
    }

    if (foundPlayer && foundPlayer.password === password) {
        sessionManager.saveSession(foundPlayer);
        return { success: true, user: foundPlayer };
    } else {
        return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }
}

// --- REGISTRO DE USUARIOS ---
export async function registerUser(username, password, email) {
    const name = (username || '').trim();
    const pass = (password || '').trim();
    const mail = (email || '').trim();

    if (!name || !pass || !mail) {
        return { success: false, message: 'Completa nombre, contraseña y correo.' };
    }

    // Validaciones básicas
    if (name.length < 3) {
        return { success: false, message: 'El nombre debe tener al menos 3 caracteres.' };
    }
    if (pass.length < 4) {
        return { success: false, message: 'La contraseña debe tener al menos 4 caracteres.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        return { success: false, message: 'Correo electrónico inválido.' };
    }

    // Evitar duplicados por nombre (insensible a mayúsculas)
    for (const player of localPlayersCache.values()) {
        if (player.name.toLowerCase() === name.toLowerCase()) {
            return { success: false, message: 'Ese nombre de usuario ya existe.' };
        }
    }

    const newPlayer = {
        id: name, // mantener consistencia con referencias por nombre
        name: name,
        email: mail,
        dp: 0,
        deck: 'Starter',
        password: pass,
        wins_semanales: 0,
        card_collection: {},
        game_plays: getInitialGamePlays()
    };

    try {
        await setDoc(doc(dbPlayersRef, name), newPlayer);
        return { success: true };
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        return { success: false, message: 'No se pudo registrar. Intenta de nuevo.' };
    }
}

export function logout() {
    sessionManager.clearSession();
    // Redirigir a la página de login
    window.location.href = 'login.html';
}

// --- FUNCIONES DE UTILIDAD ---
export function getCurrentUser() {
    return sessionManager.getCurrentUser();
}

export function isLoggedIn() {
    return sessionManager.isLoggedIn();
}

export function onSessionChange(callback) {
    sessionManager.onSessionChange(callback);
}

export function getPlayersCache() {
    return localPlayersCache;
}

export function getMarketplaceCache() {
    return localMarketplaceCache;
}

export function getDbRefs() {
    return {
        players: dbPlayersRef,
        history: dbHistoryRef,
        marketplace: dbMarketplaceRef,
        db: db
    };
}

// --- FUNCIÓN PARA ACTUALIZAR UI DEL USUARIO ---
export function updateUserDisplay() {
    const currentUser = sessionManager.getCurrentUser();
    
    // Actualizar displays de usuario en todas las páginas
    const userDisplayElements = [
        'logged-in-user-display',
        'pack-buyer-display'
    ];
    
    userDisplayElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            // Limpiar contenido previo pero preservar estructura
            element.innerHTML = '';
            
            // Agregar el texto del usuario
            const userText = document.createTextNode(currentUser ? currentUser.name : 'Ninguno');
            element.appendChild(userText);
            
            // Si hay usuario, mostrar contador de DP en letra chica, antes del botón de desconectar
            if (currentUser && elementId === 'logged-in-user-display') {
                const player = localPlayersCache.get(currentUser.name);
                if (player) {
                    const dpSpan = document.createElement('span');
                    dpSpan.id = 'user-dp-display';
                    dpSpan.className = 'ml-2 text-xs text-gray-200';
                    dpSpan.textContent = `• DP: ${player.dp}`;
                    element.appendChild(dpSpan);
                }
            }

            // Si hay usuario logueado y es el elemento principal, agregar botón de desconectar
            if (currentUser && elementId === 'logged-in-user-display') {
                // Verificar si ya existe el botón para evitar duplicados
                if (!document.getElementById('logout-button')) {
                    const logoutBtn = document.createElement('button');
                    logoutBtn.id = 'logout-button';
                    logoutBtn.className = 'ml-2 text-xs bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded transition duration-300';
                    logoutBtn.textContent = 'Desconectar';
                    logoutBtn.addEventListener('click', () => {
                        logout();
                    });
                    element.appendChild(logoutBtn);
                }
            }
        }
    });
    
    // Actualizar elementos específicos del marketplace
    const marketplaceMessage = document.getElementById('marketplace-login-message');
    if (marketplaceMessage) {
        if (currentUser) {
            marketplaceMessage.style.display = 'none';
        } else {
            marketplaceMessage.style.display = 'block';
        }
    }
}

// --- FUNCIÓN PARA VERIFICAR AUTENTICACIÓN EN PÁGINAS ---
export function requireAuth() {
    if (!sessionManager.isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// --- EXPORTAR EL MANAGER PARA USO DIRECTO ---
export { sessionManager };
