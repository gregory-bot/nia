"""Private, extractive RAG API for the Nia support companion.

There is deliberately no hosted LLM, API key, or conversation persistence here.
Answers are retrieved from reviewed local guidance and returned as written.
"""

from __future__ import annotations

import json
import math
import os
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
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://nia-safety.netlify.app",
]
configured_origins = os.getenv("CORS_ORIGINS", "")
configured_allowed_origins = [
    origin.strip()
    for origin in configured_origins.split(",")
    if origin.strip()
]
if "*" in configured_allowed_origins:
    allowed_origins = ["*"]
else:
    allowed_origins = list(dict.fromkeys([*DEFAULT_ALLOWED_ORIGINS, *configured_allowed_origins]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
    "natokwa na damu nyingi", "nina damu nyingi", "maumivu makali", "nimezimia",
    "nimepoteza fahamu", "homa kali", "saigne beaucoup", "douleur intense",
    "sangrado abundante", "dolor intenso", "نزيف شديد", "ألم شديد",
)

SELF_HARM_TERMS = (
    "suicidal", "suicide", "kill myself", "killing myself", "end my life",
    "take my own life", "want to die", "wish i was dead", "better off dead",
    "don't want to live", "dont want to live", "can't go on", "cannot go on",
    "end everything", "hurt myself", "harm myself", "cut myself", "nataka kujiua", "kujiua",
    "kujiumiza", "quiero suicidarme", "quiero matarme", "me quiero matar",
    "me tuer", "me suicider", "أريد أن أقتل نفسي", "انتحر",
)

SELF_HARM_ANSWER = (
    "I’m really sorry you’re feeling this way, and I’m glad you told me. Your safety matters. "
    "If you might hurt yourself now, please call your local emergency number or go to the nearest "
    "emergency department. If you can, move away from anything you could use to hurt yourself, "
    "and ask someone you trust to stay with you right now. You can also contact a local crisis "
    "support service. Are you in immediate danger right now?"
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

GREETINGS = {
    "hi": "Hi there. I’m here with you. What would you like to talk about?",
    "hello": "Hello. I’m glad you stopped by. What’s on your mind?",
    "hey": "Hey there. I’m here to listen—what would you like to talk about?",
    "hey there": "Hey there. I’m here to listen—what would you like to talk about?",
    "hello sasa": "Sasa! Niko hapa kukusikiliza. Ungependa kuzungumzia nini?",
    "hi sasa": "Sasa! Niko hapa kukusikiliza. Uko na swali gani?",
    "hello nia": "Hello. I’m Nia, and I’m here to listen. What would you like to talk about?",
    "hi nia": "Hi there. I’m Nia, and I’m here with you. What’s on your mind?",
    "good morning": "Good morning. I’m here with you. What would you like to talk about?",
    "good afternoon": "Good afternoon. I’m here with you. What’s on your mind?",
    "good evening": "Good evening. I’m here to listen. What would you like to talk about?",
    "how are you": "I’m here and ready to listen. How are you doing today?",
    "habari": "Habari! Niko hapa kukusikiliza. Ungependa kuzungumzia nini?",
    "habari yako": "Nzuri, asante kwa kuuliza. Niko hapa kukusikiliza—ungependa kuzungumzia nini?",
    "hujambo": "Sijambo, asante! Niko hapa kukusikiliza. Ungependa kuzungumzia nini?",
    "niaje": "Niaje! Niko hapa kukusikiliza. Uko na swali gani?",
    "mambo": "Poa! Niko hapa kukusikiliza. Ungependa kuzungumzia nini?",
    "mambo vipi": "Poa sana! Niko hapa kukusikiliza. Uko na swali gani?",
    "sasa": "Sasa! Niko hapa kukusikiliza. Ungependa kuzungumzia nini?",
    "shikamoo": "Marahaba. Niko hapa kukusikiliza. Ungependa kuzungumzia nini?",
    "bonjour": "Bonjour ! Je suis là pour vous écouter. De quoi aimeriez-vous parler ?",
    "bonsoir": "Bonsoir ! Je suis là pour vous écouter. De quoi aimeriez-vous parler ?",
    "salut": "Salut ! Je suis là pour vous écouter. Qu’aimeriez-vous partager ?",
    "hola": "¡Hola! Estoy aquí para escucharte. ¿De qué te gustaría hablar?",
    "buenos dias": "¡Buenos días! Estoy aquí para escucharte. ¿Qué te gustaría conversar?",
    "buenas tardes": "¡Buenas tardes! Estoy aquí para escucharte. ¿Qué tienes en mente?",
    "buenas noches": "¡Buenas noches! Estoy aquí para escucharte. ¿De qué te gustaría hablar?",
    "olá": "Olá! Estou aqui para ouvir você. Sobre o que gostaria de conversar?",
    "ola": "Olá! Estou aqui para ouvir você. Sobre o que gostaria de conversar?",
    "bom dia": "Bom dia! Estou aqui para ouvir você. O que gostaria de conversar?",
    "hallo": "Hallo! Ich bin hier, um zuzuhören. Worüber möchtest du sprechen?",
    "guten morgen": "Guten Morgen! Ich bin hier, um zuzuhören. Was beschäftigt dich?",
    "ciao": "Ciao! Sono qui per ascoltarti. Di cosa ti va di parlare?",
    "buongiorno": "Buongiorno! Sono qui per ascoltarti. Di cosa vorresti parlare?",
    "merhaba": "Merhaba! Seni dinlemek için buradayım. Ne hakkında konuşmak istersin?",
    "xin chao": "Xin chào! Mình ở đây để lắng nghe. Bạn muốn chia sẻ điều gì?",
    "kumusta": "Kumusta! Nandito ako para makinig. Ano ang gusto mong pag-usapan?",
    "bawo": "Báwo! Mo wà níbí láti gbọ́ ọ. Kí ni o fẹ́ bá mi sọ̀rọ̀ nípa rẹ̀?",
    "selam": "ሰላም! ለማዳመጥ እዚህ ነኝ። ስለ ምን መነጋገር ይፈልጋሉ?",
    "مرحبا": "مرحبًا! أنا هنا للاستماع إليك. عمّ تود أن نتحدث؟",
    "أهلا": "أهلًا! أنا هنا لأستمع إليك. ما الذي تود أن نتحدث عنه؟",
    "السلام عليكم": "وعليكم السلام! أنا هنا للاستماع إليك. ما الذي تود أن نتحدث عنه؟",
    "as salamu alaikum": "Wa alaikum assalam! I’m here to listen. What would you like to talk about?",
    "salaam": "Salaam! I’m here to listen. What would you like to talk about?",
    "नमस्कार": "नमस्कार! मैं आपकी बात सुनने के लिए यहाँ हूँ। आप क्या साझा करना चाहेंगे?",
    "你好": "你好！我在这里倾听。你想聊些什么？",
    "您好": "您好！我在这里倾听。您想聊些什么？",
    "こんにちは": "こんにちは。お話を聞きます。今日は何について話したいですか？",
    "おはよう": "おはようございます。お話を聞きます。何について話したいですか？",
    "안녕하세요": "안녕하세요. 편하게 말씀해 주세요. 무엇에 대해 이야기하고 싶으세요?",
    "안녕": "안녕! 편하게 이야기해도 괜찮아요. 무엇이 궁금하세요?",
    "привет": "Здравствуйте! Я здесь, чтобы выслушать вас. О чём вы хотели бы поговорить?",
    "здравствуйте": "Здравствуйте! Я здесь, чтобы выслушать вас. Что вас беспокоит?",
    "নমস্কার": "নমস্কার! আমি আপনার কথা শুনতে এখানে আছি। আপনি কী নিয়ে কথা বলতে চান?",
    "नमस्ते": "नमस्ते! मैं आपकी बात सुनने के लिए यहाँ हूँ। आप किस बारे में बात करना चाहेंगे?",
    "שלום": "שלום! אני כאן כדי להקשיב. על מה תרצה או תרצי לדבר?",
    "γεια": "Γεια σου! Είμαι εδώ για να σε ακούσω. Τι θα ήθελες να συζητήσουμε;",
    "สวัสดี": "สวัสดีค่ะ ฉันอยู่ตรงนี้เพื่อรับฟัง คุณอยากคุยเรื่องอะไรคะ?",
}


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
    """Index retrieval metadata, not full answer prose that causes topic drift."""
    return " ".join(
        [
            document["title"],
            document.get("category", ""),
            *document.get("phrases", []),
            *document.get("keywords", []),
        ]
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


def greeting_response(message: str) -> str | None:
    """Respond to short, recognized greetings in the visitor's language."""
    normalized = re.sub(r"[^\w\s]", "", message.casefold(), flags=re.UNICODE)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if len(normalized.split()) > 4:
        return None
    return GREETINGS.get(normalized)


def is_self_harm_message(message: str) -> bool:
    """Catch direct self-harm disclosures before any ordinary topic retrieval."""
    normalized = re.sub(r"\s+", " ", message.casefold()).strip()
    return any(term in normalized for term in SELF_HARM_TERMS)


def sources_for(document: dict[str, Any]) -> list[Source]:
    source_records = document.get("sources")
    if source_records is None:
        source_records = [document["source"]]
    return [Source(id=document["id"], **source) for source in source_records]


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "engine": "local-rag", "documents": len(DOCUMENTS)}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if is_self_harm_message(message):
        return ChatResponse(
            answer=SELF_HARM_ANSWER,
            sources=[],
            grounded=False,
            mode="urgent-support",
        )

    if is_emergency(message):
        urgent_document = next((doc for doc in DOCUMENTS if doc["id"] == "urgent-care"), None)
        sources = sources_for(urgent_document) if urgent_document else []
        return ChatResponse(answer=EMERGENCY_ANSWER, sources=sources, grounded=bool(urgent_document))

    greeting = greeting_response(message)
    if greeting:
        return ChatResponse(answer=greeting, sources=[], grounded=False, mode="greeting")

    document, score = retrieve(message)
    if document is None or score < 0.28:
        return ChatResponse(answer=FALLBACK_ANSWER, sources=[], grounded=False)

    return ChatResponse(
        answer=document["content"],
        sources=sources_for(document),
        grounded=True,
    )
