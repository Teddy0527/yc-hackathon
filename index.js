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

    const { query, current_page, other_pages } = req.body;

    const allPages = [current_page, ...other_pages];


    // handle the population of each cache if it doesnt exist
    if (convoHistory.length === 0) {
        console.log("No Conversation History!")
        convoHistory.set(req.body.userId, []);
    }
    if (stepsCache.length === 0) {
        console.log("No Steps Cache!")
        stepsCache.set(req.body.userId, []);
    }
    if (openPages.length === 0) {
        console.log("No Open Pages!")
        openPages.set(req.body.userId, []);
    }

    // these are the tools available to the user
    const tools = JSON.parse(fs.readFileSync("./tools.json", "utf8"));

    // prompt 
    const rawPrompt = fs.readFileSync("./prompts/call.txt", "utf8");
    const prompt = rawPrompt
        .replace("{{AVAILABLE_TABS}}", JSON.stringify(allPages || []))
        .replace("{{CURRENT_PAGE}}", JSON.stringify(current_page || []))
        .replace("{{CONVERSATION_HISTORY}}", JSON.stringify(convoHistory.get(req.body.userId) || []))
        .replace("{{TOOLS}}", JSON.stringify(tools || []))
        .replace("{{ACTION_HISTORY}}", JSON.stringify(stepsCache.get(req.body.userId) || []));

    // call the llm
    try {
        const response = await callLLM(prompt, query, convoHistory.get(req.body.userId));

        // Update history
        convoHistory.get(req.body.userId).push({ role: "user", content: query || "No text provided" });
        convoHistory.get(req.body.userId).push({ role: "assistant", content: response });

        res.status(200).send(response);
    } catch (error) {
        console.error("Error in /call:", error);
        res.status(500).send("Error generating response");
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
