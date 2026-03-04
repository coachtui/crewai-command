// ============================================================================
// Cru — Request Access Page
// Route: /request-access (public, no auth required)
// Captures leads into the lead_requests Supabase table.
// Spam prevention: honeypot field + client-side 30s rate limit.
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FormState {
  name: string;
  email: string;
  company: string;
  job_sites: string;
  workers: string;
  notes: string;
  // Honeypot — must stay empty for real submissions
  website: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  company: '',
  job_sites: '',
  workers: '',
  notes: '',
  website: '',
};

// ============================================================================
// Success screen
// ============================================================================

function SuccessScreen() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <div className="max-w-lg mx-auto w-full px-4 py-16 flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-primary-subtle rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={28} className="text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">You're on the list!</h1>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Thanks for your interest in Cru. We'll be in touch shortly with next steps.
          In the meantime, reach us at{' '}
          <a href="mailto:hello@cruwork.app" className="text-primary hover:underline">
            hello@cruwork.app
          </a>
          .
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Request Access Form
// ============================================================================

export function RequestAccess() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSubmitAt, setLastSubmitAt] = useState(0);

  if (status === 'success') return <SuccessScreen />;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot: if filled, silently succeed (bot)
    if (form.website) {
      setStatus('success');
      return;
    }

    // Client-side rate limit: 30 seconds between submits
    const now = Date.now();
    if (lastSubmitAt > 0 && now - lastSubmitAt < 30_000) {
      setErrorMsg('Please wait a moment before submitting again.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const { error } = await supabase.from('lead_requests').insert({
        name:      form.name.trim(),
        email:     form.email.trim().toLowerCase(),
        company:   form.company.trim(),
        job_sites: form.job_sites ? parseInt(form.job_sites, 10) : null,
        workers:   form.workers   ? parseInt(form.workers,   10) : null,
        notes:     form.notes.trim() || null,
      });

      if (error) throw error;

      setLastSubmitAt(now);
      setStatus('success');
    } catch (err) {
      console.error('RequestAccess submit error:', err);
      setErrorMsg(
        'Something went wrong. Please try again or email us at hello@cruwork.app'
      );
      setStatus('error');
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

  const selectClass =
    'w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none cursor-pointer';

  const labelClass = 'block text-sm font-medium text-text-primary mb-1.5';

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <img src="/image/cru-logo-tiff.png" alt="Cru logo" className="h-7 w-auto" />
            <span className="font-bold text-text-primary">Cru</span>
          </Link>
          <Link
            to="/login"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Request access</h1>
          <p className="text-text-secondary">
            Tell us about your crew and we'll get you set up.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/*
            Honeypot field — visually hidden from real users.
            Bots that fill in all fields will trip this check.
          */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={handleChange}
            />
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className={labelClass}>
              Your name <span className="text-error" aria-hidden="true">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="John Martinez"
              value={form.name}
              onChange={handleChange}
              className={inputClass}
              aria-required="true"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={labelClass}>
              Work email <span className="text-error" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="john@company.com"
              value={form.email}
              onChange={handleChange}
              className={inputClass}
              aria-required="true"
            />
          </div>

          {/* Company */}
          <div>
            <label htmlFor="company" className={labelClass}>
              Company name <span className="text-error" aria-hidden="true">*</span>
            </label>
            <input
              id="company"
              name="company"
              type="text"
              required
              autoComplete="organization"
              placeholder="Martinez Construction"
              value={form.company}
              onChange={handleChange}
              className={inputClass}
              aria-required="true"
            />
          </div>

          {/* Job sites + crew size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="job_sites" className={labelClass}>
                Active job sites
              </label>
              <select
                id="job_sites"
                name="job_sites"
                value={form.job_sites}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">Select</option>
                <option value="1">1</option>
                <option value="3">2–3</option>
                <option value="5">4–6</option>
                <option value="10">7+</option>
              </select>
            </div>
            <div>
              <label htmlFor="workers" className={labelClass}>
                Crew size
              </label>
              <select
                id="workers"
                name="workers"
                value={form.workers}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">Select</option>
                <option value="3">1–5</option>
                <option value="12">6–20</option>
                <option value="35">21–50</option>
                <option value="75">51+</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className={labelClass}>
              Anything else?{' '}
              <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Tell us about your current workflow or any specific needs…"
              value={form.notes}
              onChange={handleChange}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Error message */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-error"
            >
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? 'Submitting…' : 'Request access'}
          </button>

          <p className="text-xs text-text-tertiary text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
