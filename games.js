// --- IMPORTACIONES ---
import { 
    localPlayersCache, loggedInPlayerId, showFeedback, 
    recordGamePlay, getGamePlays 
} from './main.js';

// --- VARIABLES GLOBALES DE JUEGOS ---
let isGame1Spinning = false, game1SelectedBet = 0;
let isGame2Spinning = false, game2SelectedBet = 0;
let isGame3Spinning = false, game3SelectedBet = 0;
let isGame4Spinning = false, game4SelectedBet = 0;
let isGame5Spinning = false, game5SelectedBet = 0;
let isGame6Spinning = false, game6SelectedBet = 0;

const slotReels = ['KUR', 'MAG', 'OAZ']; // Kuriboh, Mago, Ojo Azul

// --- DOM ELEMENTS ---
const gameModals = {
    "game_1": { modal: document.getElementById('game-1-modal'), openBtn: document.getElementById('open-game-1'), closeBtn: document.getElementById('game-1-close-button') },
    "game_2": { modal: document.getElementById('game-2-modal'), openBtn: document.getElementById('open-game-2'), closeBtn: document.getElementById('game-2-close-button') },
    "game_3": { modal: document.getElementById('game-3-modal'), openBtn: document.getElementById('open-game-3'), closeBtn: document.getElementById('game-3-close-button') },
    "game_4": { modal: document.getElementById('game-4-modal'), openBtn: document.getElementById('open-game-4'), closeBtn: document.getElementById('game-4-close-button') },
    "game_5": { modal: document.getElementById('game-5-modal'), openBtn: document.getElementById('open-game-5'), closeBtn: document.getElementById('game-5-close-button') },
    "game_6": { modal: document.getElementById('game-6-modal'), openBtn: document.getElementById('open-game-6'), closeBtn: document.getElementById('game-6-close-button') }
};

// Juego 1 (BetCards)
const game1BetOptions = document.getElementById('game-1-bet-options');
const game1Grid = document.getElementById('game-1-grid');
const game1Cards = game1Grid.querySelectorAll('.bet-card');
const game1Feedback = document.getElementById('game-1-feedback');
const game1Step1 = document.getElementById('game-1-step-1');
const game1Step2 = document.getElementById('game-1-step-2');

// Juego 2 (Dados)
const game2BetOptions = document.getElementById('game-2-bet-options');
const game2Step1 = document.getElementById('game-2-step-1');
const game2Step2 = document.getElementById('game-2-step-2');
const game2BetDisplay = document.getElementById('game-2-bet-display');
const game2ChoiceLow = document.getElementById('game-2-choice-low');
const game2ChoiceSeven = document.getElementById('game-2-choice-seven');
const game2ChoiceHigh = document.getElementById('game-2-choice-high');
const game2Dice1 = document.getElementById('game-2-dice-1');
const game2Dice2 = document.getElementById('game-2-dice-2');
const game2Feedback = document.getElementById('game-2-feedback');

// Juego 3 (Moneda)
const game3BetOptions = document.getElementById('game-3-bet-options');
const game3Step1 = document.getElementById('game-3-step-1');
const game3Step2 = document.getElementById('game-3-step-2');
const game3BetDisplay = document.getElementById('game-3-bet-display');
const game3ChoiceHeads = document.getElementById('game-3-choice-heads');
const game3ChoiceTails = document.getElementById('game-3-choice-tails');
const game3Coin = document.getElementById('game-3-coin');
const game3Feedback = document.getElementById('game-3-feedback');

// Juego 4 (Ruleta Exodia)
const game4BetOptions = document.getElementById('game-4-bet-options');
const game4Step1 = document.getElementById('game-4-step-1');
const game4SpinButton = document.getElementById('game-4-spin-button');
const game4Result = document.getElementById('game-4-result');
const game4Feedback = document.getElementById('game-4-feedback');

// Juego 5 (Slots)
const game5BetOptions = document.getElementById('game-5-bet-options');
const game5Step1 = document.getElementById('game-5-step-1');
const game5SpinButton = document.getElementById('game-5-spin-button');
const game5SlotsContainer = document.getElementById('game-5-slots-container');
const game5Slot1 = document.getElementById('game-5-slot-1');
const game5Slot2 = document.getElementById('game-5-slot-2');
const game5Slot3 = document.getElementById('game-5-slot-3');
const game5Feedback = document.getElementById('game-5-feedback');

// Juego 6 (Ojo de Anubis)
const game6BetOptions = document.getElementById('game-6-bet-options');
const game6Step1 = document.getElementById('game-6-step-1');
const game6Step2 = document.getElementById('game-6-step-2');
const game6Grid = document.getElementById('game-6-grid');
const game6Sarcophagi = game6Grid.querySelectorAll('.sarcophagus');
const game6Feedback = document.getElementById('game-6-feedback');


// --- INICIALIZACIÓN DE TODOS LOS JUEGOS ---
export function initGames() {
    // Juego 1: BetCards
    gameModals['game_1'].openBtn.addEventListener('click', () => openGameModal('game_1', resetGame1Modal));
    gameModals['game_1'].closeBtn.addEventListener('click', () => closeGameModal('game_1'));
    game1BetOptions.addEventListener('click', (e) => selectBet(e, 'game_1'));
    game1Cards.forEach(card => card.addEventListener('click', (e) => handleBetCardClick(e.currentTarget)));

    // Juego 2: Dados
    gameModals['game_2'].openBtn.addEventListener('click', () => openGameModal('game_2', resetGame2Modal));
    gameModals['game_2'].closeBtn.addEventListener('click', () => closeGameModal('game_2'));
    game2BetOptions.addEventListener('click', (e) => selectBet(e, 'game_2'));
    [game2ChoiceLow, game2ChoiceSeven, game2ChoiceHigh].forEach(btn => {
        btn.addEventListener('click', (e) => handleDiceRoll(e.currentTarget.id));
    });

    // Juego 3: Moneda
    gameModals['game_3'].openBtn.addEventListener('click', () => openGameModal('game_3', resetGame3Modal));
    gameModals['game_3'].closeBtn.addEventListener('click', () => closeGameModal('game_3'));
    game3BetOptions.addEventListener('click', (e) => selectBet(e, 'game_3'));
    [game3ChoiceHeads, game3ChoiceTails].forEach(btn => {
        btn.addEventListener('click', (e) => handleCoinFlip(e.currentTarget.id === 'game-3-choice-heads'));
    });

    // Juego 4: Ruleta Exodia
    gameModals['game_4'].openBtn.addEventListener('click', () => openGameModal('game_4', resetGame4Modal));
    gameModals['game_4'].closeBtn.addEventListener('click', () => closeGameModal('game_4'));
    game4BetOptions.addEventListener('click', (e) => selectBet(e, 'game_4'));
    game4SpinButton.addEventListener('click', handleExodiaSpin);

    // Juego 5: Slots
    gameModals['game_5'].openBtn.addEventListener('click', () => openGameModal('game_5', resetGame5Modal));
    gameModals['game_5'].closeBtn.addEventListener('click', () => closeGameModal('game_5'));
    game5BetOptions.addEventListener('click', (e) => selectBet(e, 'game_5'));
    game5SpinButton.addEventListener('click', handleSlotSpin);
    
    // Juego 6: Anubis
    gameModals['game_6'].openBtn.addEventListener('click', () => openGameModal('game_6', resetGame6Modal));
    gameModals['game_6'].closeBtn.addEventListener('click', () => closeGameModal('game_6'));
    game6BetOptions.addEventListener('click', (e) => selectBet(e, 'game_6'));
    game6Sarcophagi.forEach(sarc => sarc.addEventListener('click', (e) => handleAnubisChoice(e.currentTarget)));
}

// --- FUNCIONES GENÉRICAS DE MODALES ---
function openGameModal(gameId, resetFunction) {
    if (!loggedInPlayerId) return;
    resetFunction();
    gameModals[gameId].modal.classList.remove('hidden', 'opacity-0', 'visibility-hidden');
}

function closeGameModal(gameId) {
    gameModals[gameId].modal.classList.add('hidden', 'opacity-0', 'visibility-hidden');
}

// --- Lógica de Selección de Apuesta (Reutilizable) ---
function selectBet(event, gameId) {
    let betOptions, step1, step2, feedback, betDisplay, spinButton, grid;
    let isSpinning;

    // Asignar variables según el juego
    if (gameId === 'game_1') {
        [betOptions, step1, step2, feedback, isSpinning, grid] = 
        [game1BetOptions, game1Step1, game1Step2, game1Feedback, isGame1Spinning, game1Grid];
    } else if (gameId === 'game_2') {
        [betOptions, step1, step2, feedback, isSpinning, betDisplay] = 
        [game2BetOptions, game2Step1, game2Step2, game2Feedback, isGame2Spinning, game2BetDisplay];
    } else if (gameId === 'game_3') {
        [betOptions, step1, step2, feedback, isSpinning, betDisplay] =
        [game3BetOptions, game3Step1, game3Step2, game3Feedback, isGame3Spinning, game3BetDisplay];
    } else if (gameId === 'game_4') {
        [betOptions, step1, feedback, isSpinning, spinButton] =
        [game4BetOptions, game4Step1, game4Feedback, isGame4Spinning, game4SpinButton];
    } else if (gameId === 'game_5') {
        [betOptions, step1, feedback, isSpinning, spinButton, grid] =
        [game5BetOptions, game5Step1, game5Feedback, isGame5Spinning, game5SpinButton, game5SlotsContainer];
    } else if (gameId === 'game_6') {
        [betOptions, step1, step2, feedback, isSpinning, grid] =
        [game6BetOptions, game6Step1, game6Step2, game6Feedback, isGame6Spinning, game6Grid];
    }

    if (isSpinning) return;
    if (event.target.classList.contains('bet-button')) {
        betOptions.querySelectorAll('.bet-button').forEach(b => b.classList.remove('selected'));
        event.target.classList.add('selected');
        const selectedBet = parseInt(event.target.dataset.bet);

        const player = localPlayersCache.get(loggedInPlayerId);
        if (player.dp < selectedBet) {
            showFeedback(feedback, `DP insuficientes. Necesitas ${selectedBet} DP.`, true, 2000);
            if (grid) grid.classList.add('opacity-50', 'pointer-events-none');
            if (step2) step2.classList.add('hidden');
            if (spinButton) spinButton.classList.add('hidden');
            return;
        }
        
        // Asignar apuesta
        if (gameId === 'game_1') game1SelectedBet = selectedBet;
        else if (gameId === 'game_2') game2SelectedBet = selectedBet;
        else if (gameId === 'game_3') game3SelectedBet = selectedBet;
        else if (gameId === 'game_4') game4SelectedBet = selectedBet;
        else if (gameId === 'game_5') game5SelectedBet = selectedBet;
        else if (gameId === 'game_6') game6SelectedBet = selectedBet;

        // Avanzar al siguiente paso
        step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');
        if (betDisplay) betDisplay.textContent = selectedBet;
        if (grid) grid.classList.remove('opacity-50', 'pointer-events-none');
        if (spinButton) spinButton.classList.remove('hidden');
        if (feedback) feedback.textContent = (gameId === 'game_1' || gameId === 'game_6') ? '¡Elige tu carta!' : '';
    }
}


// --- Lógica Juego 1: BetCards ---
function resetGame1Modal() {
    game1Feedback.textContent = '';
    game1SelectedBet = 0;
    isGame1Spinning = false;
    game1Step1.classList.remove('hidden');
    game1Step2.classList.add('hidden');
    game1BetOptions.querySelectorAll('.bet-button').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    game1Grid.classList.add('opacity-50', 'pointer-events-none');
    game1Cards.forEach(card => {
        card.classList.remove('is-flipped', 'chosen');
        const back = card.querySelector('.card-back');
        back.classList.remove('win', 'lose');
        back.textContent = '';
    });
}

async function handleBetCardClick(chosenCard) {
    if (isGame1Spinning) return;
    if (game1SelectedBet === 0) return showFeedback(game1Feedback, 'Primero selecciona una apuesta.', true, 2000);
    
    const player = localPlayersCache.get(loggedInPlayerId);
    if (player.dp < game1SelectedBet) return showFeedback(game1Feedback, `DP insuficientes. Necesitas ${game1SelectedBet} DP.`, true, 2000);

    const check = getGamePlays('game_1');
    if (!check.canPlay) return showFeedback(game1Feedback, check.reason, true, 2000);

    isGame1Spinning = true;
    game1Feedback.textContent = '...';
    game1BetOptions.querySelectorAll('.bet-button').forEach(b => b.disabled = true);
    const chosenIndex = parseInt(chosenCard.dataset.index);

    const winIndex = Math.floor(Math.random() * 3);
    const didWin = (chosenIndex === winIndex);
    const payoutMultiplier = didWin ? 1.5 : 0;
    const dpChange = (game1SelectedBet * payoutMultiplier) - game1SelectedBet;
    const historyText = `${player.name} jugó Eternals BetCards. Apostó ${game1SelectedBet} DP y ${didWin ? `ganó ${game1SelectedBet * 1.5} DP` : 'perdió'}. (Neto: ${dpChange} DP)`;
    const historyType = didWin ? 'game_win' : 'game_lose';

    game1Cards.forEach((card, index) => {
        const back = card.querySelector('.card-back');
        if (index === winIndex) { back.classList.add('win'); back.textContent = 'RARA (x1.5)'; } 
        else { back.classList.add('lose'); back.textContent = 'COMÚN (x0)'; }
        setTimeout(() => card.classList.add('is-flipped'), index * 200);
    });
    chosenCard.classList.add('chosen');

    try {
        await recordGamePlay('game_1', check.currentData, dpChange, historyText, historyType);
        setTimeout(() => {
            showFeedback(game1Feedback, didWin ? `¡Ganaste! Recibes ${game1SelectedBet * 1.5} DP` : `¡Perdiste! Pierdes ${game1SelectedBet} DP.`, false, 0);
            setTimeout(() => closeGameModal('game_1'), 2000);
        }, 1000);
    } catch (error) {
        console.error("Error al jugar:", error);
        showFeedback(game1Feedback, 'Error al conectar con la base de datos.', true);
        isGame1Spinning = false;
    }
}

// --- Lógica Juego 2: Duelo de Dados ---
function resetGame2Modal() {
    game2Feedback.textContent = '';
    game2SelectedBet = 0;
    isGame2Spinning = false;
    game2Step1.classList.remove('hidden');
    game2Step2.classList.add('hidden');
    game2BetOptions.querySelectorAll('.bet-button').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    [game2ChoiceLow, game2ChoiceSeven, game2ChoiceHigh].forEach(b => b.disabled = false);
    game2Dice1.textContent = '?';
    game2Dice2.textContent = '?';
}

async function handleDiceRoll(choice) {
    if (isGame2Spinning) return;
    if (game2SelectedBet === 0) return showFeedback(game2Feedback, 'Primero selecciona una apuesta.', true, 2000);
    
    const player = localPlayersCache.get(loggedInPlayerId);
    if (player.dp < game2SelectedBet) return showFeedback(game2Feedback, `DP insuficientes. Necesitas ${game2SelectedBet} DP.`, true, 2000);

    const check = getGamePlays('game_2');
    if (!check.canPlay) return showFeedback(game2Feedback, check.reason, true, 2000);

    isGame2Spinning = true;
    game2Feedback.textContent = 'Lanzando dados...';
    game2BetOptions.querySelectorAll('.bet-button').forEach(b => b.disabled = true);
    [game2ChoiceLow, game2ChoiceSeven, game2ChoiceHigh].forEach(b => b.disabled = true);

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    
    game2Dice1.textContent = d1;
    game2Dice2.textContent = d2;

    let didWin = false;
    let payoutMultiplier = 0;

    if (total < 7 && choice === 'game-2-choice-low') { didWin = true; payoutMultiplier = 2; }
    else if (total === 7 && choice === 'game-2-choice-seven') { didWin = true; payoutMultiplier = 5; }
    else if (total > 7 && choice === 'game-2-choice-high') { didWin = true; payoutMultiplier = 2; }

    const dpChange = (game2SelectedBet * payoutMultiplier) - game2SelectedBet;
    const historyText = `${player.name} jugó Duelo de Dados. Apostó ${game2SelectedBet} DP y ${didWin ? `ganó ${game2SelectedBet * payoutMultiplier} DP` : 'perdió'}. (Total: ${total}, Neto: ${dpChange} DP)`;
    const historyType = didWin ? 'game_win' : 'game_lose';

    try {
        await recordGamePlay('game_2', check.currentData, dpChange, historyText, historyType);
        setTimeout(() => {
            showFeedback(game2Feedback, didWin ? `¡Ganaste! El total fue ${total}. Recibes ${game2SelectedBet * payoutMultiplier} DP` : `¡Perdiste! El total fue ${total}.`, false, 0);
            setTimeout(() => closeGameModal('game_2'), 2000);
        }, 500);
    } catch (error) {
        console.error("Error al jugar dados:", error);
        showFeedback(game2Feedback, 'Error al conectar con la base de datos.', true);
        isGame2Spinning = false;
    }
}

// --- Lógica Juego 3: Moneda del Milenio ---
function resetGame3Modal() {
    game3Feedback.textContent = '';
    game3SelectedBet = 0;
    isGame3Spinning = false;
    game3Step1.classList.remove('hidden');
    game3Step2.classList.add('hidden');
    game3Coin.classList.add('hidden');
    game3Coin.textContent = '?';
    game3Coin.style.transform = "rotateY(0deg)";
    game3BetOptions.querySelectorAll('.bet-button').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    [game3ChoiceHeads, game3ChoiceTails].forEach(b => b.disabled = false);
}

async function handleCoinFlip(choseHeads) {
    if (isGame3Spinning) return;
    if (game3SelectedBet === 0) return showFeedback(game3Feedback, 'Primero selecciona una apuesta.', true, 2000);

    const player = localPlayersCache.get(loggedInPlayerId);
    if (player.dp < game3SelectedBet) return showFeedback(game3Feedback, `DP insuficientes. Necesitas ${game3SelectedBet} DP.`, true, 2000);

    const check = getGamePlays('game_3');
    if (!check.canPlay) return showFeedback(game3Feedback, check.reason, true, 2000);

    isGame3Spinning = true;
    game3Feedback.textContent = 'La moneda gira en el aire...';
    game3BetOptions.querySelectorAll('.bet-button').forEach(b => b.disabled = true);
    [game3ChoiceHeads, game3ChoiceTails].forEach(b => b.disabled = true);
    game3Coin.classList.remove('hidden');

    const isHeads = Math.random() < 0.5;
    game3Coin.style.transform = "rotateY(720deg)";
    
    setTimeout(() => {
        game3Coin.textContent = isHeads ? 'CARA' : 'CRUZ';
    }, 250); // Mostrar resultado a mitad de giro

    let didWin = (isHeads && choseHeads) || (!isHeads && !choseHeads);
    let payoutMultiplier = didWin ? 1.9 : 0; // 1.9x por comisión de la casa
    
    const dpChange = (game3SelectedBet * payoutMultiplier) - game3SelectedBet;
    const historyText = `${player.name} jugó Moneda del Milenio. Apostó ${game3SelectedBet} DP y ${didWin ? `ganó ${game3SelectedBet * 1.9} DP` : 'perdió'}. (Neto: ${dpChange} DP)`;
    const historyType = didWin ? 'game_win' : 'game_lose';

    try {
        await recordGamePlay('game_3', check.currentData, dpChange, historyText, historyType);
        setTimeout(() => {
            showFeedback(game3Feedback, didWin ? `¡Ganaste! Salió ${isHeads ? 'CARA'}. Recibes ${game3SelectedBet * 1.9} DP` : `¡Perdiste! Salió ${isHeads ? 'CARA' : 'CRUZ'}.`, false, 0);
            setTimeout(() => closeGameModal('game_3'), 2000);
        }, 1000);
    } catch (error) {
        console.error("Error al jugar moneda:", error);
        showFeedback(game3Feedback, 'Error al conectar con la base de datos.', true);
        isGame3Spinning = false;
    }
}

// --- Lógica Juego 4: Ruleta Exodia ---
function resetGame4Modal() {
    game4Feedback.textContent = '';
    game4SelectedBet = 0;
    isGame4Spinning = false;
    game4Step1.classList.remove('hidden');
    game4SpinButton.classList.add('hidden');
    game4Result.classList.add('hidden');
    game4Result.textContent = 'Girando...';
    game4BetOptions.querySelectorAll('.bet-button').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    game4SpinButton.disabled = false;
}

async function handleExodiaSpin() {
    if (isGame4Spinning) return;
    if (game4SelectedBet === 0) return showFeedback(game4Feedback, 'Primero selecciona una apuesta.', true, 2000);
    
    const player = localPlayersCache.get(loggedInPlayerId);
    if (player.dp < game4SelectedBet) return showFeedback(game4Feedback, `DP insuficientes. Necesitas ${game4SelectedBet} DP.`, true, 2000);

    const check = getGamePlays('game_4');
    if (!check.canPlay) return showFeedback(game4Feedback, check.reason, true, 2000);

    isGame4Spinning = true;
    game4SpinButton.disabled = true;
    game4Result.classList.remove('hidden');
    game4Result.textContent = 'Girando...';
    game4Feedback.textContent = '';
    
    const roll = Math.random(); // 0 a 1
    let payoutMultiplier = 0;
    let resultText = '';

    if (roll < 0.60) { // 60%
        payoutMultiplier = 0; resultText = '¡Nada! (x0)';
    } else if (roll < 0.90) { // 30%
        payoutMultiplier = 2; resultText = '¡Premio! (x2)';
    } else { // 10%
        payoutMultiplier = 5; resultText = '¡PREMIO MAYOR! (x5)';
    }

    const dpChange = (game4SelectedBet * payoutMultiplier) - game4SelectedBet;
    const historyText = `${player.name} jugó Ruleta de Exodia. Apostó ${game4SelectedBet} DP y ${payoutMultiplier > 0 ? `ganó ${game4SelectedBet * payoutMultiplier} DP` : 'perdió'}. (Neto: ${dpChange} DP)`;
    const historyType = payoutMultiplier > 0 ? 'game_win' : 'game_lose';

    try {
        await recordGamePlay('game_4', check.currentData, dpChange, historyText, historyType);
        setTimeout(() => {
            game4Result.textContent = resultText;
            showFeedback(game4Feedback, payoutMultiplier > 0 ? `¡Ganaste! Recibes ${game4SelectedBet * payoutMultiplier} DP` : `¡Perdiste! Pierdes ${game4SelectedBet} DP.`, false, 0);
            setTimeout(() => closeGameModal('game_4'), 2000);
        }, 1500); // Simular giro
    } catch (error) {
        console.error("Error al jugar ruleta:", error);
        showFeedback(game4Feedback, 'Error al conectar con la base de datos.', true);
        isGame4Spinning = false;
    }
}

// --- Lógica Juego 5: Slots ---
function resetGame5Modal() {
    game5Feedback.textContent = '';
    game5SelectedBet = 0;
    isGame5Spinning = false;
    game5Step1.classList.remove('hidden');
    game5SpinButton.classList.add('hidden');
    game5SlotsContainer.classList.add('hidden');
    [game5Slot1, game5Slot2, game5Slot3].forEach(s => s.textContent = '❓');
    game5BetOptions.querySelectorAll('.bet-button').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    game5SpinButton.disabled = false;
}

function getSlotEmoji(reel) {
    if (reel === 'KUR') return '🌰'; // Kuriboh
    if (reel === 'MAG') return '🧙'; // Mago
    if (reel === 'OAZ') return '🐉'; // Ojo Azul
    return '❓';
}

async function handleSlotSpin() {
    if (isGame5Spinning) return;
    if (game5SelectedBet === 0) return showFeedback(game5Feedback, 'Primero selecciona una apuesta.', true, 2000);
    
    const player = localPlayersCache.get(loggedInPlayerId);
    if (player.dp < game5SelectedBet) return showFeedback(game5Feedback, `DP insuficientes. Necesitas ${game5SelectedBet} DP.`, true, 2000);

    const check = getGamePlays('game_5');
    if (!check.canPlay) return showFeedback(game5Feedback, check.reason, true, 2000);

    isGame5Spinning = true;
    game5SpinButton.disabled = true;
    game5Feedback.textContent = 'Girando...';
    
    // Simular giro
    const r1 = slotReels[Math.floor(Math.random() * slotReels.length)];
    const r2 = slotReels[Math.floor(Math.random() * slotReels.length)];
    const r3 = slotReels[Math.floor(Math.random() * slotReels.length)];

    setTimeout(() => game5Slot1.textContent = getSlotEmoji(slotReels[Math.floor(Math.random() * slotReels.length)]), 200);
    setTimeout(() => game5Slot2.textContent = getSlotEmoji(slotReels[Math.floor(Math.random() * slotReels.length)]), 400);
    setTimeout(() => game5Slot3.textContent = getSlotEmoji(slotReels[Math.floor(Math.random() * slotReels.length)]), 600);
    
    setTimeout(() => game5Slot1.textContent = getSlotEmoji(slotReels[Math.floor(Math.random() * slotReels.length)]), 800);
    setTimeout(() => game5Slot2.textContent = getSlotEmoji(slotReels[Math.floor(Math.random() * slotReels.length)]), 1000);
    
    setTimeout(() => game5Slot1.textContent = getSlotEmoji(r1), 1200);
    setTimeout(() => game5Slot2.textContent = getSlotEmoji(r2), 1400);
    setTimeout(() => game5Slot3.textContent = getSlotEmoji(r3), 1600);
    
    let payoutMultiplier = 0;
    if (r1 === r2 && r2 === r3) {
        if (r1 === 'KUR') payoutMultiplier = 3;
        if (r1 === 'MAG') payoutMultiplier = 10;
        if (r1 === 'OAZ') payoutMultiplier = 25;
    }

    const dpChange = (game5SelectedBet * payoutMultiplier) - game5SelectedBet;
    const historyText = `${player.name} jugó Jackpot del Mago. Apostó ${game5SelectedBet} DP y ${payoutMultiplier > 0 ? `ganó ${game5SelectedBet * payoutMultiplier} DP` : 'perdió'}. (Neto: ${dpChange} DP)`;
    const historyType = payoutMultiplier > 0 ? 'game_win' : 'game_lose';

    try {
        await recordGamePlay('game_5', check.currentData, dpChange, historyText, historyType);
        setTimeout(() => {
            if(payoutMultiplier > 0) showFeedback(game5Feedback, `¡JACKPOT! Ganas ${game5SelectedBet * payoutMultiplier} DP`, false, 0);
            else showFeedback(game5Feedback, `¡Perdiste! Pierdes ${game5SelectedBet} DP.`, false, 0);
            
            setTimeout(() => closeGameModal('game_5'), 2000);
        }, 2000);
    } catch (error) {
        console.error("Error al jugar slots:", error);
        showFeedback(game5Feedback, 'Error al conectar con la base de datos.', true);
        isGame5Spinning = false;
    }
}

// --- Lógica Juego 6: Ojo de Anubis ---
function resetGame6Modal() {
    game6Feedback.textContent = '';
    game6SelectedBet = 0;
    isGame6Spinning = false;
    game6Step1.classList.remove('hidden');
    game6Step2.classList.add('hidden');
    game6BetOptions.querySelectorAll('.bet-button').forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });
    game6Grid.classList.add('opacity-50', 'pointer-events-none');
    game6Sarcophagi.forEach(s => {
        s.classList.remove('is-flipped', 'win', 'lose');
        s.textContent = '⚱️';
    });
}

async function handleAnubisChoice(chosenSarc) {
    if (isGame6Spinning) return;
    if (game6SelectedBet === 0) return showFeedback(game6Feedback, 'Primero selecciona una apuesta.', true, 2000);

    const player = localPlayersCache.get(loggedInPlayerId);
    if (player.dp < game6SelectedBet) return showFeedback(game6Feedback, `DP insuficientes. Necesitas ${game6SelectedBet} DP.`, true, 2000);

    const check = getGamePlays('game_6');
    if (!check.canPlay) return showFeedback(game6Feedback, check.reason, true, 2000);

    isGame6Spinning = true;
    game6Feedback.textContent = '...';
    game6BetOptions.querySelectorAll('.bet-button').forEach(b => b.disabled = true);
    
    const chosenIndex = parseInt(chosenSarc.dataset.index);
    const winIndex = Math.floor(Math.random() * 5);
    const didWin = (chosenIndex === winIndex);
    const payoutMultiplier = didWin ? 4 : 0;

    const dpChange = (game6SelectedBet * payoutMultiplier) - game6SelectedBet;
    const historyText = `${player.name} jugó Ojo de Anubis. Apostó ${game6SelectedBet} DP y ${didWin ? `ganó ${game6SelectedBet * 4} DP` : 'perdió'}. (Neto: ${dpChange} DP)`;
    const historyType = didWin ? 'game_win' : 'game_lose';

    game6Sarcophagi.forEach((sarc, index) => {
        sarc.classList.add('is-flipped');
        if (index === winIndex) {
            sarc.classList.add('win');
            sarc.textContent = '🏆';
        } else {
            sarc.classList.add('lose');
            sarc.textContent = '💀';
        }
    });

    try {
        await recordGamePlay('game_6', check.currentData, dpChange, historyText, historyType);
        setTimeout(() => {
            showFeedback(game6Feedback, didWin ? `¡TESORO! Ganas ${game6SelectedBet * 4} DP` : `¡MALDICIÓN! Pierdes ${game6SelectedBet} DP.`, false, 0);
            setTimeout(() => closeGameModal('game_6'), 2000);
        }, 1000);
    } catch (error) {
        console.error("Error al jugar Anubis:", error);
        showFeedback(game6Feedback, 'Error al conectar con la base de datos.', true);
        isGame6Spinning = false;
    }
}
