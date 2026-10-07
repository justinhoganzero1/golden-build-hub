# Project Rules

- Whole-book rewrites must stage and validate every chapter before one final database replacement, because partial saves can corrupt a manuscript.
- Long-running text generation uses the Lovable AI Gateway Responses API through shared server-only helpers, because credentials and prompts must never reach the browser.- Member AI agents, agent stats and chat histories live in the backend (user_agents, agent_stats, agent_chats) with localStorage only as a cache, so they follow the member across devices.
