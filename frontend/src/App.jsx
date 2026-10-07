import { useEffect, useState } from 'react';
import {
  ArrowRight, AudioLines, BookOpen, Check, Heart, Leaf,
  MessageCircle, Phone, ShieldCheck,
} from 'lucide-react';
import Chat from './Chat.jsx';

function Brand({ light = false }) {
  return <a className={`landing-brand ${light ? 'brand-light' : ''}`} href="#home" aria-label="Nia home"><span className="landing-brand-mark"><Heart size={18} fill="currentColor" /></span><span>nia<span>.</span></span></a>;
}

function LandingPage({ onChat }) {
  return (
    <div className="landing-page" id="home">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#your-space">Your space</a>
        </nav>
        <button className="nav-chat-button" onClick={onChat}>Go to chat <ArrowRight size={15} /></button>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <h1>Because nobody<br />should have to<br className="hero-mobile-break" />{' '}<em>figure it<br />out alone.</em></h1>
            <p className="hero-description">A private, judgement-free space to talk through pregnancy, reproductive health, and the feelings in between.</p>
            <div className="hero-actions">
              <button className="primary-cta" onClick={onChat}><MessageCircle size={17} /> Start a private chat <ArrowRight size={16} /></button>
              <button className="secondary-cta" onClick={onChat}><span className="voice-cta-icon"><Phone size={15} /></span> Talk by voice</button>
            </div>
          </div>

          <div className="hero-art" aria-label="Illustration of a warm and welcoming conversation">
            <div className="hero-blob blob-back" />
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-person person-left"><div className="person-hair hair-left" /><div className="person-face face-left"><span className="face-eye eye-left" /><span className="face-eye eye-right" /><span className="face-smile" /></div><div className="person-neck" /><div className="person-body body-left"><span className="shirt-heart"><Heart size={25} fill="currentColor" /></span></div></div>
            <div className="hero-person person-right"><div className="person-hair hair-right" /><div className="person-face face-right"><span className="face-eye eye-left" /><span className="face-eye eye-right" /><span className="face-smile" /></div><div className="person-neck" /><div className="person-body body-right"><span className="body-detail" /></div></div>
            <div className="chat-note note-top"><span className="note-flower">✿</span><span>you can take your time</span></div>
            <div className="chat-note note-bottom"><span className="note-heart"><Heart size={15} fill="currentColor" /></span><span>Here with you, not over you.</span></div>
            <span className="art-star star-a">✦</span><span className="art-star star-b">✳</span><span className="art-dot dot-a" /><span className="art-dot dot-b" />
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-heading"><div><div className="section-eyebrow"><span /> A SMALL FIRST STEP</div><h2>Start wherever<br />you are.</h2></div><p>No perfect words needed. Choose the way you want to begin, and take things at your own pace.</p></div>
          <div className="how-cards">
            <article className="how-card how-card-chat"><div className="how-card-number">01 <span>—</span> CHAT</div><div className="how-icon"><MessageCircle size={21} /></div><h3>Put it into words</h3><p>Ask a question or tell Nia what’s on your mind. You can pause, change the subject, or start over whenever you like.</p><button onClick={onChat}>Open the chat <ArrowRight size={15} /></button><div className="card-decoration chat-decoration"><span /><span /><span /></div></article>
            <article className="how-card how-card-voice"><div className="how-card-number">02 <span>—</span> VOICE</div><div className="how-icon"><AudioLines size={21} /></div><h3>Talk it through</h3><p>Prefer speaking? Start in chat and choose “Talk instead” to use your browser’s microphone and spoken replies.</p><button onClick={onChat}>Go to voice chat <ArrowRight size={15} /></button><div className="card-decoration sound-decoration"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><span className="how-small-note">Browser voice feature · not a phone line</span></article>
            <article className="how-card how-card-care"><div className="how-card-number">03 <span>—</span> NEXT STEP</div><div className="how-icon"><Leaf size={21} /></div><h3>Explore what helps</h3><p>Use the conversation to prepare questions for a qualified provider or think about someone you trust.</p><button onClick={onChat}>Find your starting point <ArrowRight size={15} /></button><div className="card-decoration leaf-decoration"><Leaf size={77} /></div></article>
          </div>
        </section>

        <section className="promise-section" id="your-space">
          <div className="promise-art"><div className="promise-ring" /><div className="promise-heart"><Heart size={32} fill="currentColor" /></div><span className="promise-spark promise-spark-a">✦</span><span className="promise-spark promise-spark-b">✿</span></div>
          <div className="promise-copy"><div className="section-eyebrow"><span /> YOUR SPACE, YOUR PACE</div><h2>You deserve care<br />that <em>listens first.</em></h2><p>Nia is a supportive information tool, not a healthcare provider. It can’t diagnose, prescribe, or replace professional care. For urgent medical help, contact local emergency services or go to a health facility.</p><button className="primary-cta promise-cta" onClick={onChat}>Start a conversation <ArrowRight size={16} /></button></div>
        </section>
      </main>

    </div>
  );
}

export default function App() {
  const [isChat, setIsChat] = useState(window.location.hash === '#chat');

  useEffect(() => {
    const syncRoute = () => setIsChat(window.location.hash === '#chat');
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  const goChat = () => {
    if (window.location.hash !== '#chat') window.location.hash = 'chat';
    setIsChat(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goHome = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    setIsChat(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return isChat ? <Chat onHome={goHome} /> : <LandingPage onChat={goChat} />;
}
