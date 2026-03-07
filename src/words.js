export const WORDS = [
    "Mariposa", "Relámpago", "Silencio", "Ceniza", "Espejo", "Nostalgia", "Laberinto", "Río", "Montaña", "Cielo",
    "Tormenta", "Océano", "Corazón", "Llama", "Sombra", "Arena", "Cristal", "Misterio", "Destino", "Fuego",
    "Gota", "Escudo", "Espada", "Herida", "Lágrima", "Aurora", "Crepúsculo", "Infinito", "Viento", "Raíz",
    "Hoja", "Tierra", "Cicatriz", "Eco", "Sueño", "Niebla", "Abismo", "Tiempo", "Melancolía", "Pasión",
    "Amanecer", "Luz", "Oscuridad", "Hielo", "Alma", "Suspiro", "Veneno", "Miel", "Acero", "Pluma",
    "Reloj", "Estrella", "Luna", "Sol", "Invierno", "Primavera", "Otoño", "Verano", "Lluvia", "Desierto",
    "Cascada", "Espina", "Murmullo", "Campana", "Prisionero", "Cadena", "Libertad", "Sangre", "Lágrima", "Ceniza",
    "Polvo", "Brisa", "Huracán", "Fantasía", "Realidad", "Verdad", "Mentira", "Promesa", "Olvido", "Memoria",
    "Fantasma", "Cazador", "Presa", "Flor", "Veneno", "Canto", "Grito", "Llanto", "Sonrisa", "Mirada",
    "Beso", "Abrazo", "Adiós", "Encuentro", "Camino", "Puente", "Muro", "Puerta", "Llave", "Cofre"
    // In a production app this would contain ~10,000 words to ensure minimal repetition
];

export function getRandomWord() {
    const randomIndex = Math.floor(Math.random() * WORDS.length);
    return WORDS[randomIndex];
}
