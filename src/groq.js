export async function evaluateMetaphor(word, userText) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    if (!userText || userText.trim().length === 0) {
        return {
            score: 0,
            feedback: "No escribiste nada, así que no hay nada que evaluar."
        };
    }

    if (!apiKey || apiKey === "tu_groq_api_key") {
        console.error("No GROQ API key found or still using placeholder!");
        return {
            score: Math.floor(Math.random() * 5) + 1,
            feedback: "Error: Falta la API Key de Groq. Configura el archivo .env"
        };
    }

    const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `Eres un estricto juez de freestyle y métrica, experto en figuras retóricas y poesía. 
Tu tarea es evaluar objetivamente la figura literaria que el usuario ha escrito usando la palabra dada o su CAMPO SEMÁNTICO.
Consideraciones CRÍTICAS:
1. Si el usuario no usa la forma literal de la palabra pero hace una metáfora, analogía o juego de palabras inteligente con su CAMPO SEMÁNTICO (ej: hablar de 'zapatos grandes' para la palabra 'TALLE'), es un recurso brillante. Da puntaje MUY ALTO (8-10) por asociación conceptual.
2. Si el texto no tiene sentido, es extremadamente literal o no usa la palabra de forma ingeniosa, da puntaje bajo (1-4).
3. Si es una buena metáfora, personificación o comparación clásica, da puntaje medio-alto (6-8).
4. El feedback debe ser MUY ESPECÍFICO criticando o alabando la figura retórica o el ingenio del campo semántico usado.
5. Máximo 15 palabras para el feedback.

Debes devolver ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "score": (número del 1 al 10),
  "feedback": "Tu crítica destructiva/constructiva específica (máximo 15 palabras)"
}
NO DEVUELVAS NADA MÁS QUE EL JSON.`
            },
            {
                role: "user",
                content: `Palabra base: "${word}".
Texto del jugador: "${userText}".`
            }
        ],
        temperature: 0.5,
        response_format: { type: "json_object" }
    };

    try {
        console.log(`Evaluating with Groq: "${userText}" for word "${word}"`);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error("Groq API Error details:", errData);
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const resultText = data.choices[0].message.content;
        console.log("Groq Raw Response:", resultText);
        return JSON.parse(resultText);

    } catch (error) {
        console.error("Detailed Error evaluating text with Groq:", error);
        return {
            score: 0,
            feedback: "La IA tuvo un lapsus literario (error de conexión)."
        };
    }
}

export async function evaluateMemoryRound(correctWords, userInputs) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) return { score: 5, feedback: "Error de API en Bonus." };

    const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `Eres un juez de freestyle. Evalúa un reto de memoria.
Reglas:
1. El usuario debía recordar estas 6 palabras en este orden exacto: ${correctWords.join(", ")}.
2. El usuario escribió: ${userInputs.join(", ")}.
3. Da puntaje basado en precisión y posición (máximo 10 puntos).
4. Devuelve ÚNICAMENTE un JSON: {"score": (1-10), "feedback": "breve crítica"}`
            }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
    };

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (e) {
        return { score: 0, feedback: "La memoria falló." };
    }
}

export async function evaluateFinalMatch(history, playerNamesString) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) return "Sin API Key para resumen final.";

    // Format history for context
    let context = "";
    Object.keys(history).forEach(rNum => {
        const r = history[rNum];
        context += `Ronda ${rNum} (${r.word || 'n/a'}):\n`;
        // Each player (player1, player2, player3, etc.)
        Object.keys(r).filter(k => k.startsWith('player')).forEach(slot => {
            const p = r[slot];
            context += `- ${slot}: "${p.text}" (${p.score} pts)\n`;
        });
        context += "\n";
    });

    const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `Eres un crítico literario legendario. Vas a dar un veredicto FINAL de la batalla de figuras literarias.
Analiza quién tuvo más ingenio y técnica basándote en el historial de los siguientes participantes: ${playerNamesString}.
Sé breve (máximo 40 palabras). Da un veredicto épico y declara quién es el 'Maestro del RhymeStrain'.`
            },
            {
                role: "user",
                content: `Aquí está el resumen de la partida:\n${context}`
            }
        ],
        temperature: 0.7
    };

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        return "Una batalla épica de la cual no se pueden expresar palabras.";
    }
}

export async function evaluateSolitarioStory(wordsInGame, userText) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    if (!userText || userText.trim().length === 0) {
        return {
            score: 0,
            feedback: "No escribiste nada, cero puntos."
        };
    }

    if (!apiKey) {
        return {
            score: Math.floor(Math.random() * 10) + 1,
            feedback: "Error: Falta la API Key de Groq. Configura el archivo .env"
        };
    }

    const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `Eres un estricto juez literario evaluando una historia corta.
Reglas que el usuario debía seguir:
1. Usar la mayor cantidad posible de estas palabras (o su campo semántico): ${wordsInGame.join(", ")}.
2. Escribir una historia coherente y creativa usando figuras literarias.
3. La longitud debía ser entre 70 y 100 palabras (esto se verificó por UI, pero puedes penalizar si ves que es muy pobre el contenido).

Consideraciones CRÍTICAS:
- Da hasta 5 puntos por la retención y el uso de las palabras (ya sea de forma literal o conceptual).
- Da hasta 5 puntos por la creatividad, coherencia y uso de figuras literarias.
- El puntaje total sumado debe ser un número entero entre 1 y 10.
- El feedback debe ser MUY ESPECÍFICO criticando o alabando la historia y las palabras recordadas.
- Máximo 20 palabras para el feedback.

Debes devolver ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "score": (número del 1 al 10),
  "feedback": "Tu crítica específica (máximo 20 palabras)"
}
NO DEVUELVAS NADA MÁS QUE EL JSON.`
            },
            {
                role: "user",
                content: `Texto del jugador: "${userText}".`
            }
        ],
        temperature: 0.5,
        response_format: { type: "json_object" }
    };

    try {
        console.log(`Evaluating Solitario Story with Groq...`);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Groq API Error details");
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);

    } catch (error) {
        console.error("Detailed Error evaluating solitario story:", error);
        return {
            score: 0,
            feedback: "La IA tuvo un lapsus literario (error de conexión)."
        };
    }
}

// -- PET CHAT WITH MEMORY --
export async function chatWithPet(petDef, userStats, chatHistory, userMessage) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) return "Error: Falta la API Key de Groq.";

    // Format chat history for the prompt
    const formattedHistory = chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
    }));

    // Construct system prompt with pet personality and user memory
    const systemPrompt = `Eres el compañero mascota en un juego literario de rimas llamado "Rhymes Train".
Adopta completamente tu personaje:
- Nombre: ${petDef.name}
- Tipo/Estilo: ${petDef.type}
- Especialidad: ${petDef.specialty || 'General'}
- Tono: Habla de acuerdo a tu tipo y nombre (ej. Si eres de fuego, usa metaforas cálidas; si eres un fantasma, habla con misterio, etc.).
- Recuerda que eres una pequeña mascota virtual que acompaña al jugador.

ESTADÍSTICAS DEL JUGADOR (MEMORIA RECIENTE Y A LARGO PLAZO):
- Victorias Totales: ${userStats?.matchesWon || 0}
- Partidas Jugadas: ${userStats?.matchesPlayed || 0}
- Batallas Ganadas (Cartas): ${userStats?.battlesWon || 0}
- Batallas Perdidas (Cartas): ${userStats?.battlesLost || 0}
- Skill Points (Moneda del juego): ${userStats?.skillPoints || 0}

Instrucciones:
1. Responde al usuario de forma natural, amigable (o según tu tono) y concisa (máximo 3 o 4 oraciones cortas).
2. Si el usuario te pregunta por estadísticas, victorias, derrotas, haz referencia a esos datos en la respuesta. Por ejemplo, felicítalo si tiene muchas victorias o anímalo si ha perdido batallas.
3. Eres consciente de que están dentro del mundo de Rhymes Train.
4. NUNCA rompas el personaje.`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: userMessage }
    ];

    const payload = {
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.7,
        max_completion_tokens: 150
    };

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("API Error");

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (err) {
        console.error("Pet Chat Error:", err);
        return "*La mascota te mira confundida, como si algo interfiriera en su mente* (Fallo de conexión).";
    }
}

// -- NPC CHAT WITH MEMORY --
export async function chatWithNPC(npcDef, chatHistory, userMessage) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) return { message: "Error: Falta la API Key de Groq.", action: "idle" };

    const formattedHistory = chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
    }));

    const systemPrompt = `Eres un Personaje No Jugable (NPC) en un mundo virtual 3D inspirado en rimas y poesía llamado "Rhymes Train".
Adopta completamente tu personaje:
- Nombre: ${npcDef.name}
- Rol: ${npcDef.role}
- Personalidad: ${npcDef.personality}

Instrucciones:
1. Responde al usuario de forma inmersiva y concisa (máximo 3 o 4 oraciones cortas).
2. Recuerda que estás dentro del Mundo Virtual de Rhymes Train. Tienes conciencia espacial y del entorno.
3. El usuario puede pedirte que hagas acciones físicas (como seguirlo, detenerte, saltar, lanzarte al vacío).
4. Elige una acción de la siguiente lista basada en el contexto de la conversación: "idle", "follow", "stop", "jump", "suicide". 
    - "idle": Acción por defecto.
    - "follow": Comienzas a seguir al jugador.
    - "stop": Dejas de seguir al jugador.
    - "jump": Das un salto pequeño.
    - "suicide": Te lanzas al precipicio o desapareces del mundo.
5. NUNCA rompas el personaje.

Debes devolver ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "message": "Tu respuesta hablada aquí",
  "action": "acción_elegida"
}
NO DEVUELVAS NADA MÁS QUE EL JSON.`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: userMessage }
    ];

    const payload = {
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.7,
        max_completion_tokens: 150,
        response_format: { type: "json_object" }
    };

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("API Error");

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        return result; 
    } catch (err) {
        console.error("NPC Chat Error:", err);
        return { message: "*El NPC parece estar bugeado temporalmente* (Fallo de conexión).", action: "idle" };
    }
}
