"""Private, extractive RAG API for the Nia support companion.

There is deliberately no hosted LLM, API key, or conversation persistence here.
Answers are retrieved from reviewed local guidance and returned as written.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
KNOWLEDGE_PATH = ROOT / "knowledge_base.json"

app = FastAPI(
    title="Nia Care Companion API",
    version="0.1.0",
    description="Local document retrieval for a supportive reproductive-health information demo.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)


class Source(BaseModel):
    id: str
    title: str
    url: str
    publisher: str
    review_status: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    grounded: bool
    mode: str = "local-rag"


STOP_WORDS = {
    "a", "about", "am", "an", "and", "are", "as", "at", "be", "but", "by",
    "can", "could", "do", "for", "from", "get", "give", "have", "he", "help",
    "her", "here", "how", "i", "if", "in", "is", "it", "just", "me", "my",
    "of", "on", "or", "our", "please", "should", "so", "someone", "tell", "that",
    "the", "their", "them", "there", "they", "this", "to", "want", "was", "we",
    "what", "when", "with", "would", "you", "your", "ni", "na", "ya", "niko",
    "sana", "sijui", "sasa", "kwangu", "yangu", "yake", "gani", "vipi", "je",
}

EMERGENCY_TERMS = (
    "heavy bleeding", "severe bleeding", "bleeding heavily", "faint", "passed out",
    "unconscious", "severe pain", "severe stomach pain", "severe abdominal pain",
    "high fever", "fever and chills", "can't breathe", "cannot breathe", "suicid",
    "kill myself", "hurt myself", "overdose", "being attacked", "in immediate danger",
)

EMERGENCY_ANSWER = (
    "I’m glad you told me. What you describe may need urgent, in-person help. Please contact "
    "your local emergency service or go to the nearest health facility now. If possible, ask "
    "someone you trust to stay with you and help you get there. I can stay with you while you "
    "reach out, but I can’t assess or treat an emergency here."
)

FALLBACK_ANSWER = (
    "I want to make sure I don’t guess about something important. I don’t have a reviewed "
    "guide that answers that well yet. If this is about pregnancy or your health, a qualified, "
    "confidential healthcare provider can give advice for your situation. You can also tell me "
    "a little more about what you’re trying to figure out, and I’ll look for relevant guidance."
)


def tokenize(text: str) -> list[str]:
    """Normalize English and Swahili/Sheng words for lightweight local retrieval."""
    return [
        token
        for token in re.findall(r"[a-zA-ZÀ-ÿ]+", text.casefold())
        if len(token) > 1 and token not in STOP_WORDS
    ]


def load_documents() -> list[dict[str, Any]]:
    with KNOWLEDGE_PATH.open(encoding="utf-8") as knowledge_file:
        documents = json.load(knowledge_file)
    if not isinstance(documents, list):
        raise ValueError("Knowledge base must be a JSON list")
    return documents


DOCUMENTS = load_documents()


def document_text(document: dict[str, Any]) -> str:
    return " ".join(
        [document["title"], document["content"], *document.get("keywords", [])]
    )


def retrieve(query: str) -> tuple[dict[str, Any] | None, float]:
    """Return the highest scoring local passage using a BM25-style score."""
    query_tokens = tokenize(query)
    if not query_tokens:
        return None, 0.0

    tokenized_documents = [Counter(tokenize(document_text(doc))) for doc in DOCUMENTS]
    average_length = sum(sum(counts.values()) for counts in tokenized_documents) / max(len(DOCUMENTS), 1)
    document_frequency = Counter(
        token for counts in tokenized_documents for token in counts.keys()
    )
    query_set = set(query_tokens)
    best_document: dict[str, Any] | None = None
    best_score = 0.0

    for document, frequencies in zip(DOCUMENTS, tokenized_documents):
        length = sum(frequencies.values())
        score = 0.0
        for token in query_set:
            frequency = frequencies.get(token, 0)
            if not frequency:
                continue
            inverse_frequency = math.log1p(
                (len(DOCUMENTS) - document_frequency[token] + 0.5)
                / (document_frequency[token] + 0.5)
            )
            denominator = frequency + 1.2 * (0.25 + 0.75 * length / max(average_length, 1))
            score += inverse_frequency * (frequency * 2.2 / denominator)

        keyword_phrases = [str(item).casefold() for item in document.get("phrases", [])]
        phrase_boost = sum(2.0 for phrase in keyword_phrases if phrase in query.casefold())
        title_matches = len(query_set.intersection(tokenize(document["title"])))
        score += phrase_boost + title_matches * 0.35
        if score > best_score:
            best_document, best_score = document, score

    return best_document, best_score


def is_emergency(message: str) -> bool:
    normalized = re.sub(r"\s+", " ", message.casefold())
    return any(term in normalized for term in EMERGENCY_TERMS)


def source_for(document: dict[str, Any]) -> Source:
    return Source(id=document["id"], **document["source"])


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "engine": "local-rag", "documents": len(DOCUMENTS)}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if is_emergency(message):
        urgent_document = next((doc for doc in DOCUMENTS if doc["id"] == "urgent-care"), None)
        sources = [source_for(urgent_document)] if urgent_document else []
        return ChatResponse(answer=EMERGENCY_ANSWER, sources=sources, grounded=bool(urgent_document))

    document, score = retrieve(message)
    if document is None or score < 0.28:
        return ChatResponse(answer=FALLBACK_ANSWER, sources=[], grounded=False)

    return ChatResponse(
        answer=document["content"],
        sources=[source_for(document)],
        grounded=True,
    )
