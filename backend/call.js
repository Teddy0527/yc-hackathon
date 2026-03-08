import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: "https://api.shisa.ai/openai/v1"
});

/**
 * Reusable helper to call the LLM
 * @param {string} prompt - The full prompt string
 * @param {Array} history - Optional conversation history
 * @returns {Promise<string>} - The LLM's response
 */
export async function callLLM(prompt, query, history = []) {
    try {
        const response = await client.chat.completions.create({
            model: "shisa-ai/shisa-v2.1-llama3.3-70b",
            messages: [
                { role: "system", content: "You are a browser automation engine. Always respond in valid JSON." },
                { role: "user", content: prompt },
                { role: "assistant", content: '{"response":' },  // force JSON continuation
                { role: "user", content: query }
            ],
            temperature: 0
        });

        const content = response.choices[0].message.content;

        // Robust JSON extraction
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                response: content,
                tool_calls: []
            };
        }

        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error("JSON Parse Error in callLLM:", e);
            return {
                response: content,
                tool_calls: []
            };
        }
    } catch (error) {
        console.error("LLM Call Error:", error);
        throw error;
    }
}
