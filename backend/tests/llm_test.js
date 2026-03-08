import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: "../.env" });

const API_KEY = process.env.LLM_API_KEY;

const client = new OpenAI({
    apiKey: API_KEY,
    baseURL: "https://api.shisa.ai/openai/v1"
});

async function simpleTest() {
    const response = await client.chat.completions.create({
        model: "shisa-ai/shisa-v2.1-llama3.3-70b",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello! Are you image compatible? Like can i send you a screenshot, and you can parse it?" }
        ],
        temperature: 0.7
    });

    console.log(response.choices[0].message.content);
}

simpleTest();