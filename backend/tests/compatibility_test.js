import axios from 'axios';

const testInput = {
    "query": "Click the title",
    "current_page": {
        "url": "https://example.com/",
        "title": "Example Domain",
        "html": "<html lang=\"en\"><head><title>Example Domain</title><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>body{background:#eee;width:60vw;margin:15vh auto;font-family:system-ui,sans-serif}h1{font-size:1.5em}div{opacity:0.8}a:link,a:visited{color:#348}</style></head><body><div><h1>Example Domain</h1><p>This domain is for use in documentation examples without needing permission. Avoid use in operations.</p><p><a href=\"https://iana.org/domains/example\" data-gh-id=\"1\">Learn more</a></p></div>\n<div id=\"grandhelper-root\"></div><iframe class=\"html2canvas-container\" width=\"1019\" height=\"796\" scrolling=\"no\" data-html2canvas-ignore=\"true\" style=\"visibility: hidden; position: fixed; left: -10000px; top: 0px; border: 0px;\"></iframe></body></html>"
    },
    "other_pages": [
        {
            "url": "https://mail.google.com/mail/u/0/#inbox",
            "title": "Inbox (361,847) - ryankaminsky@gmail.com - Gmail",
            "html": ""
        },
        {
            "url": "https://github.com/Teddy0527/yc-hackathon/tree/backend",
            "title": "GitHub - Teddy0527/yc-hackathon at backend · GitHub",
            "html": ""
        }
    ],
    "metadata": {
        "timestamp": 1772953241
    }
};

async function testBackend() {
    try {
        console.log("Testing backend with user provided JSON...");
        const response = await axios.post('http://localhost:3000/call', testInput);
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Test failed:", error.response ? error.response.data : error.message);
    }
}

testBackend();
