// Importar las funciones necesarias de Firebase
import { db, dbHistoryRef, dbPlayersRef, query, orderBy, limit, getDocs } from './firebase.js';

// Función para inicializar la barra de eventos en vivo
function initLiveEventsTicker() {
    // Crear la barra de eventos
    const ticker = document.createElement('div');
    ticker.className = 'live-events-ticker';
    ticker.innerHTML = `
        <div class="ticker-content">
            <span class="ticker-label">EVENTO EN VIVO:</span>
            <div class="ticker-wrapper">
                <span id="ticker-text">Cargando último evento...</span>
            </div>
        </div>
    `;
    
    // Insertar después del header y antes del main
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    if (header && main) {
        header.parentNode.insertBefore(ticker, main);
    }
    
    // Agregar estilos CSS
    addTickerStyles();
    
    // Actualizar con el último evento
    updateTickerWithLatestEvent();
}

// Función para agregar estilos CSS para la barra de eventos
function addTickerStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .live-events-ticker {
            background: linear-gradient(90deg, #4c1d95 0%, #6d28d9 100%);
            color: white;
            padding: 10px 0;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35), inset 0 0 24px rgba(160, 32, 240, 0.28);
            margin-bottom: 1rem;
        }

        /* Resplandor diagonal épico cada 2s */
        .live-events-ticker::after {
            content: "";
            position: absolute;
            top: -160%;
            left: -60%;
            width: 55%;
            height: 420%;
            background: linear-gradient(120deg,
                rgba(255,255,255,0) 0%,
                rgba(255,255,255,0.12) 45%,
                rgba(255,255,255,0.55) 50%,
                rgba(255,255,255,0.12) 55%,
                rgba(255,255,255,0) 100%);
            filter: blur(10px);
            opacity: 0.7;
            pointer-events: none;
            mix-blend-mode: screen;
            animation: diagonal-shine 2s linear infinite;
        }

        @keyframes diagonal-shine {
            0%   { transform: translateX(-120%) rotate(25deg); }
            100% { transform: translateX(220%) rotate(25deg); }
        }
        
        .ticker-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 0 16px;
            position: relative;
            z-index: 1; /* por encima del resplandor */
        }
        
        .ticker-label {
            font-weight: 800;
            letter-spacing: 0.02em;
            background-color: #3c096c;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            box-shadow: 0 0 12px rgba(160,32,240,0.4);
        }
        
        .ticker-wrapper {
            position: relative;
            overflow: hidden;
        }
        
        #ticker-text {
            display: inline-block;
            white-space: nowrap;
            text-align: center;
            font-weight: 700;
            letter-spacing: 0.01em;
            /* Glow y micro movimiento, texto centrado y estático */
            animation: glowPulse 3s ease-in-out infinite, microFloat 6s ease-in-out infinite;
        }
        
        @keyframes glowPulse {
            0%, 100% {
                text-shadow: 0 0 6px rgba(252,211,77,0.35), 0 0 12px rgba(160,32,240,0.25);
            }
            50% {
                text-shadow: 0 0 10px rgba(252,211,77,0.6), 0 0 22px rgba(160,32,240,0.45);
            }
        }
        
        @keyframes microFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1px); }
        }
    `;
    document.head.appendChild(style);
}

// Normaliza el texto de eventos de duelo para mostrar ambos cambios de DP
function normalizeDuelHistoryText(text) {
    try {
        if (typeof text !== 'string') return text;
        if (!text.startsWith('Duelo registrado:')) return text;
        const hasWinner = /Ganador\s*\+\d+\s*DP/.test(text);
        const hasLoser = /Perdedor\s*[+-]\d+\s*DP/.test(text);
        if (!hasWinner && hasLoser) {
            const surrender = /\(Rendición\)/.test(text);
            const flawless = /\(Flawless\)/.test(text);
            let winnerGain = 100;
            if (surrender) winnerGain += 50;
            if (flawless) winnerGain += 100;
            return text.replace(/\((Perdedor\s*[+-]\d+\s*DP)\)/, `(Ganador +${winnerGain} DP y $1)`);
        }
    } catch (_) {
        return text;
    }
    return text;
}

// Obtener nombres de jugadores en modo fantasma desde la colección de jugadores
async function fetchGhostNames() {
    try {
        const snap = await getDocs(dbPlayersRef);
        const names = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data && data.ghost && data.name) names.push(data.name);
        });
        return names;
    } catch (e) {
        console.warn('No se pudieron obtener jugadores fantasma:', e);
        return [];
    }
}

// Función para actualizar el ticker con el último evento (excluye jugadores fantasma)
async function updateTickerWithLatestEvent() {
    try {
        const ghostNames = new Set(await fetchGhostNames());
        // Obtener varios eventos recientes para encontrar el primero visible
        const q = query(dbHistoryRef, orderBy("timestamp", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            let chosenText = '';
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                const text = data && data.text;
                if (typeof text !== 'string') continue;
                // Si ningún nombre fantasma aparece en el texto, usar este evento
                let mentionsGhost = false;
                for (const name of ghostNames) {
                    if (text.includes(name)) { mentionsGhost = true; break; }
                }
                if (!mentionsGhost) {
                    chosenText = normalizeDuelHistoryText(text);
                    break;
                }
            }
            const tickerText = document.getElementById('ticker-text');
            if (tickerText && chosenText) {
                tickerText.textContent = chosenText;
            }
        }
    } catch (error) {
        console.error("Error al obtener el último evento:", error);
    }
}

// Exportar las funciones
export {
    initLiveEventsTicker,
    updateTickerWithLatestEvent
};
