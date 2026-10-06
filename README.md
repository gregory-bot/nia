# Nia — a private support companion

A responsive React + Python proof of concept for non-judgmental reproductive-health information and support. The public homepage explains why Nia exists and guides visitors into the chat or browser voice experience. The design uses the requested magenta accent (`#C83BB8`).

## Professional project layout

- `frontend/` — React, Vite, landing page, chat, and styles.
- `backend/` — FastAPI service, local RAG knowledge base, and API tests.
- `images/` — supplied visual references.

The root `package.json` provides convenient workspace commands.

## What “our own model” means here

This starter does **not** train or host a foundation model. It has no Gemini/OpenAI key and sends no prompt to a paid AI service. The Python service performs lightweight BM25-style text retrieval over `backend/knowledge_base.json` and returns the selected answer as written, with its source. This is a local, extractive RAG prototype—not a general-purpose generative chatbot. It should prefer saying “I don’t know” over inventing medical or legal advice.

The included knowledge entries are starter summaries, not a clinically or legally approved dataset. Have local reproductive-health clinicians and legal experts review each passage, its source, translation, and resource contacts before public use. Keep approval date and reviewer/version metadata when curating a production knowledge base. The WHO guideline link is a starting point for review, not evidence that this demo has been clinically validated.

## Features

- Public homepage: hero, “why Nia” section, explanation of chat/voice, and clear chat calls-to-action.
- Responsive chat UI with no sign-in or account creation (`/#chat`).
- Python FastAPI endpoint with local knowledge retrieval, safe fallback, and urgent-care escalation wording.
- In-browser microphone input and spoken replies where the browser supports Speech Recognition / Speech Synthesis. This is **not** a telephone call or a human hotline; recognition may be processed by the browser/device.
- No database or server-side conversation history. The client sends recent turns only to the local API for this request; the API uses no history yet. Do not share identifying information in the demo.
- Answers cite the guide entry used. The bundled examples include English and a small amount of Kiswahili/Sheng phrasing; they are not a reviewed translation.

## Run locally

From the repository root:

1. Install frontend dependencies: `npm install`.
2. Create a Python virtual environment if needed: `python3 -m venv .venv`.
3. Install API dependencies: `.venv/bin/pip install -r backend/requirements.txt`.
4. Start the API: `npm run api`.
5. In another terminal, start the web app: `npm run dev` and open the printed Vite URL (usually `http://localhost:5173`).

Production frontend build: `npm run build`. API tests: `npm run test:backend`. The frontend proxies `/api` to the local API. There are no API keys or `.env` values to configure. API health is available at `/api/health`; interactive API documentation is at `/docs` on port 8000.

## Curating the RAG knowledge base

Edit `backend/knowledge_base.json`. Each entry has an `id`, `title`, `category`, exact `content` returned to users, phrases/keywords for retrieval, and a source record. Restart the API after editing; the document list loads at process startup. Prefer primary, current, locally applicable guidance. Keep answers concise and reviewed; do not add dosing instructions, legal eligibility claims, or unverified phone numbers. Add tests for every new safety-sensitive entry.

## Safety and production gaps

This prototype is **not for clinical use** and cannot diagnose, prescribe, determine legal eligibility, or replace a trained provider. The emergency response is not a triage service. Before launch, get local clinical/legal/safeguarding review; establish verified local referral and emergency contacts; test English and Kiswahili with fluent reviewers; add abuse/threat testing, rate limits, monitoring that does not capture message contents, HTTPS, and a documented privacy policy. Browser speech services can have different privacy behavior than the local text RAG service. The interface intentionally makes no promise of end-to-end confidentiality.

## Reference implementation

The supplied Therabot repository uses a React chat UI, voice input/output, and conversation history, with a hosted Therabot/Gemini service and Firebase setup. This project reuses the high-level interaction pattern, but swaps the hosted-model dependency for a local document retriever and keeps this demo's messages in browser memory only.
