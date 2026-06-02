import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ContactForm from './ContactForm';

describe('ContactForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders name, email, message fields and submit button', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe suggestion/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send suggestion/i })).toBeInTheDocument();
  });

  it('shows success message after successful POST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }));
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/recipe suggestion/i), { target: { value: 'Biryani' } });
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }));
    await waitFor(() => expect(screen.getByText(/thanks! suggestion received/i)).toBeInTheDocument());
  });

  it('shows error message when POST fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bob@example.com' } });
    fireEvent.change(screen.getByLabelText(/recipe suggestion/i), { target: { value: 'Tacos' } });
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });

  it('disables submit button while submitting', async () => {
    let resolvePromise;
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(new Promise((r) => { resolvePromise = r; })));
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Carol' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'carol@example.com' } });
    fireEvent.change(screen.getByLabelText(/recipe suggestion/i), { target: { value: 'Pasta' } });
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }));
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    resolvePromise({ ok: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /send suggestion/i })).not.toBeDisabled());
  });
});
