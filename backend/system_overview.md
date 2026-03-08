# System Overview: Browser Copilot Backend

This document outlines the architecture and execution flow of the Browser Copilot system.

## Request/Response Lifecycle

1.  **Incoming Request**: The frontend sends a `POST /call` request with the following body:
    ```json
    {
      "userId": "user_id_here",
      "query": "User's request string",
      "current_page": { "url": "...", "title": "..." },
      "other_pages": [ { "url": "...", "title": "..." } ]
    }
    ```

2.  **State Management**: The backend retrieves or initializes three caches per user:
    -   `convoHistory`: Stores previous messages to maintain context.
    -   `allPages`: Stores page navigation history (experimental).
    -   `stepsCache`: Stores a history of tool actions taken by the AI.

3.  **Prompt Construction**: 
    -   The system reads the base prompt from `prompts/call.txt`.
    -   It injects the current browser state (tabs, tools, and history).

4.  **LLM Call**: 
    -   The `callLLM` helper in `call.js` communicates with the Shisa AI endpoint.
    -   It uses a robust regex-based parser to extract JSON from the LLM's response, handling potential markdown wrapping.

5.  **Output Format**: The system always responds with:
    ```json
    {
      "response": "A natural language explanation to the user",
      "tool_calls": [
        {
          "name": "tool_name",
          "arguments": {
            "rationale": "Direct explanation for this action",
            "..." : "Other tool-specific arguments"
          }
        }
      ]
    }
    ```

## Tooling System

All tools are defined in `tools.json`. Every tool call **must** include a `rationale` field. This ensures the AI provides transparency for its actions, which can be displayed to the user or used for debugging.

### Key Tools:
-   `tab_change`: Allows the AI to navigate between open tabs.
-   `click`: Allows for interaction using a simple description of the target element.

## Data Persistence
Currently, all caches are stored in-memory using `Map` objects. While suitable for local development, this will reset on server restart. Future iterations may implement Redis or a database for persistent multi-tenant support.
