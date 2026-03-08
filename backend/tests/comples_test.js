import axios from 'axios';

const BASE_URL = 'http://localhost:3000/call';
const USER_ID = 'test_multistep';

const gmailHTML = `
<html><body>
  <div role="main">
    <div gh-id="compose-button"><button>Compose</button></div>
    <div class="inbox">
      <div class="email-row" gh-id="email-1">Meeting tomorrow - John Doe</div>
      <div class="email-row" gh-id="email-2">Invoice #1234 - Billing Team</div>
    </div>
  </div>
</body></html>`;

const composeHTML = `
<html><body>
  <div class="compose-window">
    <input gh-id="to-field" placeholder="To" />
    <input gh-id="subject-field" placeholder="Subject" />
    <div gh-id="body-field" contenteditable="true" placeholder="Compose email"></div>
    <button gh-id="send-button">Send</button>
    <button gh-id="discard-button">Discard</button>
  </div>
</body></html>`;

const steps = [
    {
        query: "switch to my Gmail tab",
        current_page: {
            url: "https://example.com/",
            title: "Example Domain",
            html: "<html><body><h1>Example Domain</h1></body></html>"
        },
        other_pages: [
            { url: "https://mail.google.com/mail/u/0/#inbox", title: "Inbox - user@gmail.com - Gmail", html: gmailHTML },
            { url: "https://github.com", title: "GitHub", html: "" }
        ]
    },
    {
        query: "click compose",
        current_page: {
            url: "https://mail.google.com/mail/u/0/#inbox",
            title: "Inbox - user@gmail.com - Gmail",
            html: gmailHTML
        },
        other_pages: [
            { url: "https://example.com/", title: "Example Domain", html: "" },
            { url: "https://github.com", title: "GitHub", html: "" }
        ]
    },
    {
        query: "send an email to bob@example.com saying hey, are you free tomorrow?",
        current_page: {
            url: "https://mail.google.com/mail/u/0/#compose",
            title: "New Message - Gmail",
            html: composeHTML
        },
        other_pages: [
            { url: "https://mail.google.com/mail/u/0/#inbox", title: "Inbox - user@gmail.com - Gmail", html: "" },
            { url: "https://github.com", title: "GitHub", html: "" }
        ]
    },
    {
        // Edge case: element doesnt exist
        query: "click the Schedule Send button",
        current_page: {
            url: "https://mail.google.com/mail/u/0/#compose",
            title: "New Message - Gmail",
            html: composeHTML  // no schedule send button in this HTML
        },
        other_pages: []
    }
];

async function runStep(step, index) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`STEP ${index + 1}: "${step.query}"`);
    console.log('='.repeat(60));

    try {
        const response = await axios.post(BASE_URL, {
            userId: USER_ID,
            query: step.query,
            current_page: step.current_page,
            other_pages: step.other_pages,
            metadata: { timestamp: Date.now() }
        });

        const { response: llmResponse, tool_calls } = response.data;

        console.log(`Response: ${llmResponse}`);
        if (tool_calls && tool_calls.length > 0) {
            console.log(`Tool Calls:`);
            tool_calls.forEach(tc => {
                console.log(`  - ${tc.name}(${JSON.stringify(tc.arguments)})`);
            });
        } else {
            console.log(`No tool calls.`);
        }

        return response.data;
    } catch (error) {
        console.error(`Step ${index + 1} failed:`, error.response?.data || error.message);
    }
}

async function main() {
    console.log('Starting multi-step browser automation test...\n');
    for (let i = 0; i < steps.length; i++) {
        await runStep(steps[i], i);
        await new Promise(r => setTimeout(r, 500)); // small delay between steps
    }
    console.log('\nAll steps complete.');
}

main();