import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, AudioLines, BookOpen, Check, ChevronDown, CircleHelp,
  Heart, Leaf, Menu, Mic, MessageCircle, Phone, Plus, ShieldCheck,
  Sparkles, Volume2, VolumeX, X,
} from 'lucide-react';

const starterPrompts = [
  { icon: Heart, title: 'I’m not sure what I want', prompt: 'I might be pregnant and I’m not sure what I want to do.' },
  { icon: MessageCircle, title: 'How can I support someone?', prompt: 'How can I support my friend without pressuring her?' },
  { icon: ShieldCheck, title: 'I’m worried about my safety', prompt: 'I feel pressured about a pregnancy decision and need help.' },
];

const welcomeMessage = {
  role: 'assistant',
  content: 'Hi, I’m Nia. I’m here to listen, share general information, and help you think through what matters to you—without judgement or pressure. What’s on your mind?',
  sources: [],
};

function MessageText({ children }) {
  return <div className="message-copy">{children}</div>;
}

export default function Chat({ onHome }) {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceConversationRef = useRef(false);

  useEffect(() => {
    fetch('/api/health').then((response) => setApiReady(response.ok)).catch(() => setApiReady(false));
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const resetChat = () => {
    voiceConversationRef.current = false;
    recognitionRef.current?.stop();
    setMessages([welcomeMessage]);
    setDraft('');
    setError('');
    window.speechSynthesis?.cancel();
    setVoiceMode(false);
    setListening(false);
    setSpeaking(false);
    setMobileMenuOpen(false);
  };

  const sendMessage = async (content = draft) => {
    const cleanContent = content.trim();
    if (!cleanContent || sending) return;

    const userMessage = { role: 'user', content: cleanContent };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    setSending(true);
    setError('');
    setMobileMenuOpen(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanContent,
          history: nextMessages.slice(-8).map(({ role, content: text }) => ({ role, content: text })),
        }),
      });
      if (!response.ok) throw new Error('The guide is taking a moment. Please try again.');
      const data = await response.json();
      const answer = { role: 'assistant', content: data.answer, sources: data.sources ?? [] };
      setMessages((current) => [...current, answer]);
      if (voiceConversationRef.current && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(data.answer);
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          if (voiceConversationRef.current) startVoiceListening();
        };
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setError(err.message || 'Could not reach Nia. Please check that the local service is running.');
      setMessages((current) => current.slice(0, -1));
      setDraft(cleanContent);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  function startVoiceListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceConversationRef.current = false;
      setVoiceMode(false);
      setError('Voice conversation is not available in this browser. Try Chrome, or type your message instead.');
      return;
    }
    if (!voiceConversationRef.current) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-KE';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setListening(false);
      if (transcript && voiceConversationRef.current) sendMessage(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      if (voiceConversationRef.current) {
        setError('I couldn’t hear that clearly. Tap the microphone to try again, or type your message.');
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('Microphone access could not start. Check browser permissions, or type your message instead.');
    }
  }

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not available in this browser. Try Chrome or type your message instead.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-KE';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setDraft((current) => `${current}${current ? ' ' : ''}${transcript}`);
      setListening(false);
      inputRef.current?.focus();
    };
    recognition.onerror = () => {
      setListening(false);
      setError('I couldn’t hear that clearly. You can try again or type instead.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setVoiceMode(true);
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      voiceConversationRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setListening(false);
      setSpeaking(false);
      setVoiceMode(false);
      return;
    }
    voiceConversationRef.current = true;
    setVoiceMode(true);
    startVoiceListening();
  };

  const toggleSpeak = (text) => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <button className="brand-home" onClick={onHome} aria-label="Go to Nia home"><span className="brand-mark"><Heart size={19} fill="currentColor" /></span><span className="brand-name">nia<span>.</span></span></button>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><X size={19} /></button>
        </div>
        <div className="sidebar-intro">
          <span className="eyebrow">YOUR PRIVATE SPACE</span>
          <p>A gentle place to land, whenever you need it.</p>
        </div>
        <button className="new-chat-button" onClick={resetChat}><Plus size={17} /> Start a new chat</button>
        <div className="sidebar-section">
          <span className="eyebrow">HERE FOR YOU</span>
          <div className="sidebar-link active"><MessageCircle size={17} /><span>Talk with Nia</span><span className="active-dot" /></div>
          <button className="sidebar-link" onClick={() => sendMessage('Can you share the general information and resources you have?')}><BookOpen size={17} /><span>Explore support</span></button>
        </div>
        <div className="privacy-card">
          <div className="privacy-icon"><ShieldCheck size={17} /></div>
          <strong>Your space, your pace</strong>
          <p>No account needed. This demo keeps chats in this browser tab only.</p>
        </div>
        <div className="sidebar-bottom"><span className={`connection-dot ${apiReady ? 'connected' : ''}`} />{apiReady ? 'Private guide is ready' : 'Connect the local guide to begin'}</div>
      </aside>

      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}><Menu size={21} /></button>
            <div className="crumb"><button onClick={onHome}>Home</button><span className="crumb-slash">/</span><strong>Talk with Nia</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="privacy-pill"><span /> Private &amp; secure</div>
            <button className="text-button" onClick={resetChat}>New chat <Plus size={15} /></button>
          </div>
        </header>

        <div className="workspace">
          <section className="chat-column">
            <div className="chat-heading">
              <div className="heading-copy">
                <div className="welcome-kicker"><Sparkles size={14} /> A LITTLE SUPPORT, JUST FOR YOU</div>
                <h1>A calmer place<br className="desktop-break" /> to figure things out.</h1>
                <p>Whatever you’re carrying, you don’t have to sort through it alone.</p>
              </div>
              <div className="flower-art" aria-hidden="true">
                <div className="flower-halo" />
                <div className="flower-center"><Heart size={26} fill="currentColor" /></div>
                <i className="petal petal-one" /><i className="petal petal-two" /><i className="petal petal-three" /><i className="petal petal-four" /><i className="petal petal-five" /><i className="petal petal-six" />
                <span className="flower-spark spark-one">✦</span><span className="flower-spark spark-two">✦</span>
              </div>
            </div>

            <section className="chat-card" aria-label="Conversation with Nia">
              <div className="chat-card-header">
                <div className="nia-avatar"><Leaf size={17} /></div>
                <div className="agent-meta"><strong>Nia <span className="verified"><Check size={10} /></span></strong><span><i /> Here to listen, not judge</span></div>
                <button className={`voice-mode-button ${voiceMode ? 'voice-active' : ''}`} onClick={toggleVoiceMode} title="Talk with Nia using your microphone"><Phone size={15} /><span>{voiceMode ? 'End voice chat' : 'Talk instead'}</span></button>
                <button className="icon-button card-menu" onClick={resetChat} aria-label="Start a new conversation"><Plus size={18} /></button>
              </div>

              <div className="conversation" aria-live="polite">
                {messages.map((message, index) => (
                  <div className={`message-row ${message.role === 'user' ? 'message-user' : 'message-agent'}`} key={`${index}-${message.role}`}>
                    {message.role === 'assistant' && <div className="message-avatar"><Leaf size={15} /></div>}
                    <div className="message-content-wrap">
                      {message.role === 'assistant' && <span className="message-author">Nia <span>· just now</span></span>}
                      <div className={`message-bubble ${message.role}`}><MessageText>{message.content}</MessageText></div>
                      {message.role === 'assistant' && <div className="message-tools">
                        <button onClick={() => toggleSpeak(message.content)} aria-label={speaking ? 'Stop reading aloud' : 'Read response aloud'}>{speaking ? <VolumeX size={14} /> : <Volume2 size={14} />} <span>{speaking ? 'Stop' : 'Listen'}</span></button>
                        {message.sources?.length > 0 && <span className="source-label"><BookOpen size={12} /> Grounded in {message.sources.length} guide{message.sources.length === 1 ? '' : 's'}</span>}
                      </div>}
                      {message.role === 'assistant' && message.sources?.length > 0 && <div className="source-list">{message.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}<span>↗</span></a>)}</div>}
                    </div>
                    {message.role === 'user' && <div className="user-avatar">Y</div>}
                  </div>
                ))}
                {sending && <div className="message-row message-agent"><div className="message-avatar"><Leaf size={15} /></div><div className="typing-bubble" aria-label="Nia is thinking"><i /><i /><i /></div></div>}
                <div ref={messagesEndRef} />
              </div>

              {messages.length === 1 && <div className="starter-prompts">
                <span className="starter-label">YOU CAN START ANYWHERE</span>
                <div className="starter-grid">{starterPrompts.map(({ icon: Icon, title, prompt }) => <button className="starter-card" key={title} onClick={() => sendMessage(prompt)}><span className="starter-icon"><Icon size={16} /></span><span>{title}</span><ArrowUp size={14} className="starter-arrow" /></button>)}</div>
              </div>}

              {error && <div className="error-note" role="alert"><CircleHelp size={15} />{error}</div>}
              <form className="composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
                <label className="sr-only" htmlFor="message-input">Write a message to Nia</label>
                <textarea id="message-input" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={listening ? 'I’m listening…' : 'Share what’s on your mind…'} rows={1} maxLength={2000} />
                <div className="composer-footer">
                  <div className="composer-hint"><span className="keyboard-hint">↵</span> to send <span className="hint-divider">·</span> <span>shift + ↵ for a new line</span></div>
                  <div className="composer-actions">
                    <button type="button" className={`mic-button ${listening ? 'mic-listening' : ''}`} onClick={toggleListening} aria-label={listening ? 'Stop listening' : 'Use voice input'}><Mic size={17} /></button>
                    <button type="submit" className="send-button" disabled={!draft.trim() || sending} aria-label="Send message"><ArrowUp size={17} /></button>
                  </div>
                </div>
              </form>
              <div className="chat-disclaimer"><ShieldCheck size={13} /><span>Your messages aren’t saved by this demo. You’re in control of what you share.</span></div>
            </section>
          </section>

          <aside className="support-column">
            <div className="support-card support-card-featured">
              <div className="support-topline"><div className="support-icon soft-pink"><Heart size={18} /></div><span className="tiny-label">A NOTE TO KEEP</span></div>
              <h2>Your choice.<br />Your timing.</h2>
              <p>You deserve accurate information, compassionate care, and space to make decisions without pressure.</p>
              <div className="support-illustration" aria-hidden="true"><div className="ribbon-loop loop-left" /><div className="ribbon-loop loop-right" /><div className="ribbon-knot" /><span>♡</span></div>
            </div>
            <div className="support-card resource-card">
              <div className="resource-heading"><span className="support-icon soft-lilac"><BookOpen size={18} /></span><span className="tiny-label">THOUGHTFUL GUIDANCE</span></div>
              <h3>Grounded, not guessing.</h3>
              <p>Nia uses a small library of reviewed guidance and will say when she doesn’t have enough information.</p>
              <button className="learn-link" onClick={() => sendMessage('What can you help me with, and what should I ask a health professional?')}>What Nia can help with <ArrowUp size={14} /></button>
            </div>
            <div className="gentle-reminder"><div className="reminder-flower">✿</div><p>There’s no one-size-fits-all answer. <strong>You get to choose what feels right for you.</strong></p></div>
            <div className="emergency-note"><span className="emergency-dot" /><p><strong>Need urgent help?</strong> If you may be in immediate danger or have a medical emergency, contact local emergency services or go to the nearest health facility.</p></div>
          </aside>
        </div>

        <footer className="page-footer"><span>nia is a supportive information tool, not a healthcare provider.</span><button onClick={() => setError('This demo does not store or transmit your conversation beyond the local guide service.')}>Privacy &amp; safety <ChevronDown size={13} /></button><span className="footer-credit"><AudioLines size={13} /> Made for listening</span></footer>
      </main>
    </div>
  );
}
