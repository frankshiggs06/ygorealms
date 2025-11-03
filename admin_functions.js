// Función para modificar DP de un jugador
async function handleModifyDP(isAdd) {
    const playerSelect = document.getElementById('admin-dp-player-select');
    const amountInput = document.getElementById('admin-dp-amount');
    const playerId = playerSelect.value;
    const amount = parseInt(amountInput.value);
    
    if (!playerId || playerId === "Cargando..." || isNaN(amount) || amount <= 0) {
        showFeedback(adminFeedback, "Selecciona un jugador y una cantidad válida.", true);
        return;
    }
    
    try {
        const playerRef = doc(dbPlayersRef, playerId);
        const playerDoc = await getDoc(playerRef);
        
        if (!playerDoc.exists()) {
            showFeedback(adminFeedback, "Jugador no encontrado.", true);
            return;
        }
        
        const playerData = playerDoc.data();
        const currentDP = playerData.dp || 0;
        const newDP = isAdd ? currentDP + amount : currentDP - amount;
        
        // Actualizar DP del jugador
        await updateDoc(playerRef, { dp: newDP });
        
        // Registrar en el historial
        const action = isAdd ? "sumó" : "restó";
        const historyEntry = {
            timestamp: new Date().toISOString(),
            type: "admin_dp_change",
            text: `Admin ${action} ${amount} DP a ${playerId}.`,
            player: playerId
        };
        
        await addDoc(dbHistoryRef, historyEntry);
        
        showFeedback(adminFeedback, `Se ${action} ${amount} DP a ${playerId} correctamente.`, false);
        amountInput.value = "";
    } catch (error) {
        console.error("Error al modificar DP:", error);
        showFeedback(adminFeedback, "Error al modificar DP.", true);
    }
}

// Función para inicializar los selectores de jugadores para modificar DP
function initDPModifiers() {
    // Llenar el selector de jugadores para modificar DP
    const dpPlayerSelect = document.getElementById('admin-dp-player-select');
    fillPlayerSelector(dpPlayerSelect);
    
    // Agregar event listeners para los botones
    document.getElementById('admin-add-dp-button').addEventListener('click', () => handleModifyDP(true));
    document.getElementById('admin-subtract-dp-button').addEventListener('click', () => handleModifyDP(false));
}

// Exportar las funciones
export { handleModifyDP, initDPModifiers };