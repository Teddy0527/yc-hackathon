import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: "https://api.shisa.ai/openai/v1"
});

/**
 * Mocking the state for the test
 */
const mockState = {
    current_page: {

    },
    other_pages: [

    ],
    convoHistory: [],
    tools: JSON.parse(fs.readFileSync(path.join(__dirname, "../tools.json"), "utf8")),
    stepsCache: []
};

/**
 * Helper to build the prompt like index.js does
 */
function buildPrompt(state) {
    const rawPrompt = fs.readFileSync(path.join(__dirname, "../prompts/call.txt"), "utf8");
    const allPages = [state.current_page, ...state.other_pages];

    return rawPrompt
        .replace("{{AVAILABLE_TABS}}", JSON.stringify(allPages))
        .replace("{{CURRENT_PAGE}}", JSON.stringify(state.current_page))
        .replace("{{CONVERSATION_HISTORY}}", JSON.stringify(state.convoHistory))
        .replace("{{TOOLS}}", JSON.stringify(state.tools))
        .replace("{{ACTION_HISTORY}}", JSON.stringify(state.stepsCache));
}

async function runTest(query) {
    console.log(`\n--- Testing Query: "${query}" ---`);

    const prompt = buildPrompt(mockState);

    try {
        const response = await client.chat.completions.create({
            model: "shisa-ai/shisa-v2.1-llama3.3-70b",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt },
                { role: "user", content: query }
            ],
            temperature: 0
        });

        const content = response.choices[0].message.content;
        console.log("LLM Response:\n", content);

        // Robust JSON extraction
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log("✅ JSON Parsed successfully.");
                if (parsed.response) console.log(`   Response: ${parsed.response}`);
                if (parsed.tool_calls && parsed.tool_calls.length > 0) {
                    console.log(`   Tool Calls: ${JSON.stringify(parsed.tool_calls)}`);
                } else {
                    console.log("   No tool calls.");
                }
            } catch (e) {
                console.log("❌ Failed to parse matched JSON segment.");
            }
        } else {
            console.log("❌ No JSON found in response.");
        }

    } catch (error) {
        console.error("Test Error:", error);
    }
}

// Test cases
async function main() {
    // Case 1: Clear request for an action
    await runTest("Click on the search bar");

    // Case 2: Request requiring more info/clarification
    await runTest("Change tabs to the Hacker News tab");
}

main();
