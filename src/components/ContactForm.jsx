import React, { useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setFeedback({ text: 'Thanks! Suggestion received.', isError: false });
        setName(''); setEmail(''); setMessage('');
      } else {
        setFeedback({ text: 'Something went wrong. Please try again.', isError: true });
      }
    } catch {
      setFeedback({ text: 'Something went wrong. Please try again.', isError: true });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form className="suggest-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="suggest-name">Your Name</label>
        <input
          id="suggest-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Maria"
        />
      </div>
      <div className="form-group">
        <label htmlFor="suggest-email">Email</label>
        <input
          id="suggest-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="form-group">
        <label htmlFor="suggest-message">Recipe Suggestion</label>
        <textarea
          id="suggest-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the recipe or paste a link…"
          rows={4}
        />
      </div>
      {feedback && (
        <div
          className="save-message"
          style={
            feedback.isError
              ? { backgroundColor: 'rgba(140,59,26,0.1)', color: 'var(--color-terracotta)', borderColor: 'rgba(140,59,26,0.2)' }
              : {}
          }
        >
          {feedback.text}
        </div>
      )}
      <button type="submit" className="save-btn" disabled={isSending}>
        {isSending ? 'Sending…' : 'Send Suggestion'}
      </button>
    </form>
  );
}
