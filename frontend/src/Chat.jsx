import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, AudioLines, BookOpen, Check, ChevronDown, CircleHelp,
  Heart, Leaf, Menu, Mic, MessageCircle, Phone, Plus, ShieldCheck,
  Volume2, VolumeX, X,
} from 'lucide-react';

function MessageText({ children }) {
  return <div className="message-copy">{children}</div>;
}

export default function Chat({ onHome }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceConversationRef = useRef(false);
  const callTimerRef = useRef(null);

  useEffect(() => {
    fetch('/api/health').then((response) => setApiReady(response.ok)).catch(() => setApiReady(false));
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      window.clearTimeout(callTimerRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const resetChat = () => {
    voiceConversationRef.current = false;
    recognitionRef.current?.stop();
    window.clearTimeout(callTimerRef.current);
    setMessages([]);
    setDraft('');
    setError('');
    window.speechSynthesis?.cancel();
    setVoiceMode(false);
    setCallStatus('idle');
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
      const request = fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanContent,
            history: nextMessages.slice(-8).map(({ role, content: text }) => ({ role, content: text })),
          }),
        });
      const [response] = await Promise.all([
        request,
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ]);
      if (!response.ok) throw new Error('The guide is taking a moment. Please try again.');
      const data = await response.json();
      const answer = { role: 'assistant', content: data.answer, sources: data.sources ?? [] };
      setMessages((current) => [...current, answer]);
      if (voiceConversationRef.current && window.speechSynthesis) {
        setCallStatus('speaking');
        const utterance = new SpeechSynthesisUtterance(data.answer);
        utterance.lang = 'en-GB';
        utterance.rate = 0.94;
        utterance.pitch = 1.08;
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find((voice) => /samantha|ava|karen|moira|tessa|victoria|serena|fiona|zira|jenny|aria|female/i.test(voice.name) && /^en([-_]|$)/i.test(voice.lang))
          || voices.find((voice) => /^en([-_]|$)/i.test(voice.lang));
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          if (voiceConversationRef.current) {
            setCallStatus('listening');
            startVoiceListening();
          }
        };
        utterance.onerror = () => {
          setSpeaking(false);
          if (voiceConversationRef.current) {
            setCallStatus('listening');
            startVoiceListening();
          }
        };
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setError(err.message || 'Could not reach Nia. Please check that the local service is running.');
      setMessages((current) => current.slice(0, -1));
      setDraft(cleanContent);
      if (voiceConversationRef.current) {
        setCallStatus('listening');
        window.setTimeout(() => {
          if (voiceConversationRef.current) startVoiceListening();
        }, 500);
      }
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
      setCallStatus('idle');
      setError('Voice conversation is not available in this browser. Try Chrome, or type your message instead.');
      return;
    }
    if (!voiceConversationRef.current) return;
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-KE';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setListening(false);
      if (transcript && voiceConversationRef.current) {
        setCallStatus('thinking');
        sendMessage(transcript);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (voiceConversationRef.current) {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          voiceConversationRef.current = false;
          setVoiceMode(false);
          setCallStatus('idle');
          setError('Microphone access was blocked. Allow microphone access in your browser settings, then try again.');
          return;
        }
        setError('I couldn’t hear that clearly. Tap the microphone to try again, or type your message.');
        setCallStatus('listening');
        window.setTimeout(() => {
          if (voiceConversationRef.current) startVoiceListening();
        }, 450);
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
    recognition.lang = navigator.language || 'en-KE';
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
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('Microphone access could not start. Check browser permissions, or type your message instead.');
    }
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      voiceConversationRef.current = false;
      window.clearTimeout(callTimerRef.current);
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setListening(false);
      setSpeaking(false);
      setVoiceMode(false);
      setCallStatus('idle');
      return;
    }
    voiceConversationRef.current = true;
    setVoiceMode(true);
    setCallStatus('calling');
    setError('');
    callTimerRef.current = window.setTimeout(() => {
      if (!voiceConversationRef.current) return;
      setCallStatus('listening');
      startVoiceListening();
    }, 6000);
  };

  const toggleSpeak = (text) => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.94;
    utterance.pitch = 1.08;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => /samantha|ava|karen|moira|tessa|victoria|serena|fiona|zira|jenny|aria|female/i.test(voice.name) && /^en([-_]|$)/i.test(voice.lang))
      || voices.find((voice) => /^en([-_]|$)/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;
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
            <div className="privacy-pill"><span /> No account needed</div>
            <button className="text-button" onClick={resetChat}>New chat <Plus size={15} /></button>
          </div>
        </header>

        <div className="workspace chat-workspace">
          <section className="chat-column">
            <section className="chat-card" aria-label="Conversation with Nia">
              <div className="chat-card-header">
                <div className="nia-avatar"><Leaf size={17} /></div>
                <div className="agent-meta"><strong>Nia <span className="verified"><Check size={10} /></span></strong><span><i /> Here to listen, not judge</span></div>
                <button className={`voice-mode-button ${voiceMode ? 'voice-active' : ''}`} onClick={toggleVoiceMode} title="Talk with Nia using your microphone"><Phone size={15} /><span>{voiceMode ? 'End call' : 'Call Nia'}</span></button>
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
                      {message.role === 'assistant' && message.sources?.length > 0 && <div className="source-list">{message.sources.map((source) => <a key={`${source.id}-${source.title}`} href={source.url} target="_blank" rel="noreferrer">{source.title}<span>↗</span></a>)}</div>}
                    </div>
                    {message.role === 'user' && <div className="user-avatar">Y</div>}
                  </div>
                ))}
                {sending && <div className="message-row message-agent"><div className="message-avatar"><Leaf size={15} /></div><div className="typing-bubble" aria-label="Nia is thinking"><i /><i /><i /></div></div>}
                <div ref={messagesEndRef} />
              </div>

              {callStatus !== 'idle' && <div className={`call-status call-${callStatus}`} role="status">
                <span className="call-status-icon">{callStatus === 'calling' ? <Phone size={16} /> : callStatus === 'listening' ? <Mic size={16} /> : callStatus === 'speaking' ? <AudioLines size={17} /> : <span className="call-thinking-dots"><i /><i /><i /></span>}</span>
                <span>{callStatus === 'calling' ? 'Calling Nia…' : callStatus === 'listening' ? 'Nia is listening — speak when you’re ready' : callStatus === 'thinking' ? 'Nia is thinking…' : 'Nia is speaking…'}</span>
                {callStatus === 'calling' && <span className="ring-countdown" aria-label="Connecting"><i /><i /><i /></span>}
                {callStatus === 'listening' && <span className="listening-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
              </div>}

              {error && <div className="error-note" role="alert"><CircleHelp size={15} />{error}</div>}
              <form className="composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
                <label className="sr-only" htmlFor="message-input">Write a message to Nia</label>
                <textarea id="message-input" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={listening ? 'Listening…' : ''} rows={1} maxLength={2000} />
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

        </div>

        <footer className="page-footer"><span>nia is a supportive information tool, not a healthcare provider.</span><button onClick={() => setError('This demo does not store or transmit your conversation beyond the local guide service.')}>Privacy &amp; safety <ChevronDown size={13} /></button><span className="footer-credit"><AudioLines size={13} /> Made for listening</span></footer>
      </main>
    </div>
  );
}
