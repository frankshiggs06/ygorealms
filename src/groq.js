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
                content: `Eres un estricto profesor de lengua y literatura, experto en figuras retóricas y poesía. 
Tu tarea es evaluar objetivamente la figura literaria que el usuario ha escrito usando la palabra dada.
Consideraciones:
1. Si el texto no tiene sentido o no usa la palabra de forma literaria, da puntaje bajo.
2. Si es una metáfora, personificación o comparación brillante, da puntaje alto.
3. Máximo 15 palabras.

Debes devolver ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "score": (número del 1 al 10),
  "feedback": "Tu crítica destructiva/constructiva corta (máximo 15 palabras)"
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
