---
trigger: always_on
---

# Documentation Style: "Attic Notes"

## Philosophy

Documentation should feel like jaded technical notes found in an old box in an attic: timeless, purely functional, and devoid of corporate polish or "friendly" filler. It is written for a competent future self, not a customer or corporate.

## Rules

1.  **Lowercase Headers:** Use lowercase for all file headers and section titles (e.g., `// gemini manager` instead of `// Gemini Manager`).
2.  **Telegraphic Conciseness:** Remove articles (a, an, the) where possible. Use sentence fragments. Get straight to the point.
    - _Bad:_ "This function is responsible for handling the process lifecycle."
    - _Good:_ "handles process lifecycle."
3.  **No Branding/Hype:** Avoid words like "powerful," "seamless," "robust," or "modern." Just describe what it is end of story.
4.  **Structure:**
    - **File Header:** 1-2 lines at the top of the file describing the module's purpose.
    - **Section Headers:** Simple comments separating logical blocks (e.g., `// ipc handlers`, `// state management`).
5.  **Tone:** Objective, detached, mechanical.
