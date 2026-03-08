import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import fs from "fs"
import { callLLM } from './call.js';

dotenv.config();

// BACKEND IS CURRENTLY CONFIGURED TO BE LOCAL. 
// MAYBE WE CAN REWIRE TO MAKE IT MULTI-TENANT IN FUTURE

const app = express();
const port = process.env.PORT || 3000;

// caches for each user
const convoHistory = new Map();
const allPages = new Map();
const stepsCache = new Map();


// Middleware
app.use(morgan('dev'));
app.use(express.json());

// Routes   
app.get('/', (req, res) => {
    res.status(200).send('Hi!');
});

// tts would be handled via the frontend, which the text generated will be sent to the backend
// we will call the llm for instructions here.
// we will also need to handle the conversation history here.

app.post('/call', async (req, res) => {
    const { query, current_page, other_pages, steps, userId: providedUserId } = req.body;

    // Default userId for local dev if not provided
    const userId = providedUserId || "default_user";

    const allPagesList = [current_page, ...other_pages];

    // handle the population of each cache if it doesnt exist
    if (!convoHistory.has(userId)) {
        console.log("No Conversation History!")
        convoHistory.set(userId, []);
    }
    if (!stepsCache.has(userId)) {
        console.log("No Steps Cache!")
        stepsCache.set(userId, []);
    }
    if (!allPages.has(userId)) {
        console.log("No Page History!")
        allPages.set(userId, []);
    }

    // these are the tools available to the user
    let tools = [];
    try {
        tools = JSON.parse(fs.readFileSync("./tools.json", "utf8"));
    } catch (e) {
        console.error("Error reading tools.json:", e.message);
    }

    // prompt
    let rawPrompt = "";
    try {
        rawPrompt = fs.readFileSync("./prompts/call.txt", "utf8");
    } catch (e) {
        console.error("Error reading call.txt:", e.message);
        return res.status(500).send("Prompt file missing");
    }

    const prompt = rawPrompt
        .replace("{{AVAILABLE_TABS}}", JSON.stringify(allPagesList || []))
        .replace("{{CURRENT_PAGE}}", JSON.stringify(current_page || []))
        .replace("{{CONVERSATION_HISTORY}}", JSON.stringify(convoHistory.get(userId) || []))
        .replace("{{TOOLS}}", JSON.stringify(tools || []))
        .replace("{{ACTION_HISTORY}}", JSON.stringify(steps || stepsCache.get(userId) || []));

    // Debug: log the prompt
    fs.writeFileSync("./debug_prompt.txt", prompt);

    console.log("Constructed Prompt (Preview):", prompt.substring(0, 500) + "...");

    // call the llm
    try {
        const result = await callLLM(prompt, query, convoHistory.get(userId));
        const { response, tool_calls } = result;

        // Update history
        convoHistory.get(userId).push({ role: "user", content: query || "No text provided" });
        convoHistory.get(userId).push({ role: "assistant", content: response });

        // Update steps cache (send all to frontend)
        if (tool_calls && Array.isArray(tool_calls)) {
            stepsCache.get(userId).push(...tool_calls);
        }

        res.status(200).send({ response, tool_calls });
    } catch (error) {
        console.error("Error in /call:", error);
        res.status(500).send("Error generating response");
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
