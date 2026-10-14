export function chunkText(text, chunkSize = 300) {
    if (!text || !text.trim()) {
        return [];
    }

    const words = text
        .replace(/\s+/g, " ")
        .trim()
        .split(" ");

    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    return chunks;
}