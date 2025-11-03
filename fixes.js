// Correcciones para los problemas identificados

// 1. Función para agregar el botón de desconexión junto al nombre de usuario
// DESACTIVADA: Ahora se maneja desde auth.js para evitar conflictos
function addLogoutButton() {
    // Esta función ha sido desactivada porque ahora updateUserDisplay() 
    // en auth.js maneja el botón de desconectar de forma integrada
    return;
}

// Función para manejar el cierre de sesión
// DESACTIVADA: Ahora se usa la función logout() de auth.js
function handleLogout() {
    // Esta función ha sido desactivada porque ahora se usa 
    // la función logout() de auth.js que maneja correctamente la sesión
    return;
}

// 2. Función para mejorar la persistencia de sesión
function fixSessionPersistence() {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) {
        const loginInput = document.getElementById('login-input');
        if (loginInput) {
            loginInput.value = savedUser;
            setTimeout(() => {
                const loginButton = document.querySelector('#login-form button');
                if (loginButton) loginButton.click();
            }, 1000);
        }
    }
    
    // Asegurar que el formulario de login guarde el usuario
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function() {
            const username = document.getElementById('login-input').value;
            if (username) localStorage.setItem('loggedInUser', username);
        });
    }
}

// 3. Función para corregir la barra de eventos en vivo
function fixLiveEventsTicker() {
    // Agregar estilos CSS para la barra de eventos
    const style = document.createElement('style');
    style.textContent = `
        .live-events-ticker {
            background: linear-gradient(90deg, #4c1d95 0%, #6d28d9 100%);
            color: white;
            padding: 8px 0;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: none; /* Oculto por defecto hasta que haya eventos */
        }
        
        .ticker-content {
            display: flex;
            align-items: center;
            padding: 0 16px;
            overflow: hidden;
        }
        
        .ticker-label {
            font-weight: bold;
            margin-right: 12px;
            background-color: #3c096c;
            padding: 2px 8px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 10;
        }
        
        .ticker-wrapper {
            overflow: hidden;
            position: relative;
            flex-grow: 1;
        }
        
        #ticker-text {
            display: inline-block;
            white-space: nowrap;
            animation: ticker-bounce 15s linear infinite;
            position: relative;
        }
        
        @keyframes ticker-bounce {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-30%); }
        }
    `;
    document.head.appendChild(style);
    
    // Crear la barra de eventos
    const ticker = document.createElement('div');
    ticker.className = 'live-events-ticker';
    ticker.innerHTML = `
        <div class="ticker-content">
            <span class="ticker-label">EVENTO EN VIVO:</span>
            <div class="ticker-wrapper">
                <span id="ticker-text"></span>
            </div>
        </div>
    `;
    
    // Insertar después del header y antes del main
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    if (header && main) {
        header.parentNode.insertBefore(ticker, main);
    }
    
    // Actualizar con el último evento
    updateTickerWithLatestEvent();
}

// Función para actualizar el ticker con el último evento
function updateTickerWithLatestEvent() {
    // Obtener el último evento del historial
    const historyList = document.getElementById('history-list');
    if (historyList && historyList.children.length > 0) {
        const latestEvent = historyList.children[0].querySelector('p');
        if (latestEvent) {
            const eventText = latestEvent.textContent;
            const tickerText = document.getElementById('ticker-text');
            const ticker = document.querySelector('.live-events-ticker');
            
            if (tickerText && eventText) {
                tickerText.textContent = eventText;
                ticker.style.display = 'block';
            }
        }
    }
}

// 4. Función para corregir el selector de jugadores en el formulario de modificar DP
function fixPlayerSelector() {
    const dpPlayerSelect = document.getElementById('admin-dp-player-select');
    if (!dpPlayerSelect) return;
    
    // Obtener todos los jugadores del selector de duelos
    const duelPlayerSelect = document.getElementById('admin-player-select');
    if (duelPlayerSelect && duelPlayerSelect.options.length > 1) {
        // Copiar opciones del selector de duelos
        dpPlayerSelect.innerHTML = duelPlayerSelect.innerHTML;
    }
}

// Función para manejar la modificación de DP
function handleModifyDP(isAdd) {
    const playerSelect = document.getElementById('admin-dp-player-select');
    const dpAmountInput = document.getElementById('admin-dp-amount');
    
    if (!playerSelect || !dpAmountInput) {
        console.error('No se encontraron los elementos necesarios para modificar DP');
        return;
    }
    
    const selectedOption = playerSelect.options[playerSelect.selectedIndex];
    if (!selectedOption) {
        alert('Por favor selecciona un jugador');
        return;
    }
    
    const playerName = selectedOption.text.split(' (')[0];
    const currentDP = parseInt(selectedOption.text.match(/\((\d+) DP\)/)[1]);
    const dpAmount = parseInt(dpAmountInput.value);
    
    if (isNaN(dpAmount) || dpAmount <= 0) {
        alert('Por favor ingresa una cantidad válida de DP');
        return;
    }
    
    // Calcular nuevos DP
    const newDP = isAdd ? currentDP + dpAmount : currentDP - dpAmount;
    
    // Actualizar la opción en el selector
    selectedOption.text = `${playerName} (${newDP} DP)`;
    
    // Registrar en el historial
    const action = isAdd ? 'sumó' : 'restó';
    addToHistory(`Admin ${action} ${dpAmount} DP a ${playerName}. Nuevo total: ${newDP} DP`);
    
    // Limpiar el campo de cantidad
    dpAmountInput.value = '';
    
    // Mostrar mensaje de éxito
    alert(`Se han ${isAdd ? 'sumado' : 'restado'} ${dpAmount} DP a ${playerName}`);
}

// Función para agregar al historial
function addToHistory(message) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    const listItem = document.createElement('li');
    listItem.className = 'mb-2 p-2 bg-gray-800 rounded';
    
    const timestamp = new Date().toLocaleTimeString();
    listItem.innerHTML = `
        <span class="text-xs text-gray-500">${timestamp}</span>
        <p class="text-sm">${message}</p>
    `;
    
    // Insertar al principio de la lista
    historyList.insertBefore(listItem, historyList.firstChild);
}

// Función para configurar los event listeners de los botones de DP
function setupDPButtons() {
    const addDPButton = document.getElementById('admin-add-dp-btn');
    const subtractDPButton = document.getElementById('admin-subtract-dp-btn');
    
    if (addDPButton) {
        addDPButton.addEventListener('click', function(e) {
            e.preventDefault();
            handleModifyDP(true);
        });
    }
    
    if (subtractDPButton) {
        subtractDPButton.addEventListener('click', function(e) {
            e.preventDefault();
            handleModifyDP(false);
        });
    }
}

// Inicializar todas las correcciones
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        // Aplicar todas las correcciones
        addLogoutButton();
        fixSessionPersistence();
        fixLiveEventsTicker();
        
        // Esperar un poco más para el selector de jugadores
        setTimeout(() => {
            fixPlayerSelector();
            setupDPButtons(); // Configurar los botones de DP
        }, 2000);
        
        // Configurar un observador para actualizar el ticker cuando cambie el historial
        const historyList = document.getElementById('history-list');
        if (historyList) {
            const observer = new MutationObserver(updateTickerWithLatestEvent);
            observer.observe(historyList, { childList: true, subtree: true });
        }
    }, 1000);
});