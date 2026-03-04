// ============================================================================
// Cru — Public Landing Page
// Route: / (public, no auth required)
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CheckSquare, Calendar, Activity, Clock, LayoutDashboard,
  Smartphone, RefreshCw, Mic, MapPin, Shield, Lock,
  ArrowRight, Menu, X, FileText,
} from 'lucide-react';
import { useAuth } from '../contexts';

// ============================================================================
// Sticky Header
// ============================================================================

function Header() {
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Product', href: '#product' },
    { label: 'Roles', href: '#roles' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" aria-label="Cru home">
            <img src="/image/cru-logo-tiff.png" alt="Cru logo" className="h-8 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-120"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to="/workers"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors duration-120"
              >
                Go to app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-120"
                >
                  Sign in
                </Link>
                <Link
                  to="/request-access"
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors duration-120"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-1 text-text-secondary rounded-lg hover:bg-bg-subtle transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-5 space-y-5">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm text-text-secondary py-2 hover:text-text-primary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
            {isAuthenticated ? (
              <Link
                to="/workers"
                className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold text-center"
                onClick={() => setMobileOpen(false)}
              >
                Go to app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full py-3 border border-gray-200 text-text-primary rounded-lg text-sm font-semibold text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  to="/request-access"
                  className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// ============================================================================
// App UI Mock (tasteful placeholder, no real screenshots needed)
// ============================================================================

function AppMock() {
  return (
    <div
      className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 select-none"
      aria-hidden="true"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <div className="mx-auto text-xs text-gray-400 font-medium">cruwork.app/tasks</div>
      </div>

      <div className="flex" style={{ height: 'calc(100% - 40px)' }}>
        {/* Sidebar mock */}
        <div className="w-12 bg-gray-900 flex flex-col items-center py-4 gap-4 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-3 h-3 rounded bg-white opacity-80" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded ${i === 2 ? 'bg-primary/50' : 'bg-gray-700'}`}
            />
          ))}
        </div>

        {/* Main panel */}
        <div className="flex-1 p-4 overflow-hidden bg-bg-primary">
          {/* Page header row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-3.5 w-14 bg-gray-800 rounded mb-2" />
              <div className="h-2 w-28 bg-gray-300 rounded" />
            </div>
            <div className="h-7 w-20 bg-primary rounded-lg" />
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {/* Pour task — blue highlight */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
              <div className="w-1 h-8 bg-blue-500 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-2.5 w-28 bg-blue-700 rounded mb-1.5" />
                <div className="h-2 w-20 bg-blue-400 rounded opacity-70" />
              </div>
              <div className="h-5 w-14 bg-blue-200 rounded-full flex-shrink-0" />
            </div>
            {/* Regular tasks */}
            {([72, 56, 88] as const).map((w, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-lg p-3 flex items-center gap-3">
                <div className="w-1 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-2.5 bg-gray-300 rounded mb-1.5" style={{ width: w }} />
                  <div className="h-2 bg-gray-200 rounded" style={{ width: w - 20 }} />
                </div>
                <div className="h-5 w-12 bg-green-100 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Worker avatars row */}
          <div className="mt-3 bg-white border border-gray-100 rounded-lg p-3 flex items-center gap-2">
            {['JM', 'RK', 'TL', 'BW'].map((init, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"
              >
                <span className="text-xs font-bold text-primary">{init[0]}</span>
              </div>
            ))}
            <span className="text-xs text-gray-400 ml-1">+3 on site</span>
            <div className="ml-auto h-5 w-16 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hero
// ============================================================================

function Hero() {
  const { isAuthenticated } = useAuth();

  const chips = ['Multi-site', 'Mobile-first', 'Real-time sync', 'Voice input'];

  return (
    <section className="bg-bg-primary pt-16 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-subtle text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
              Built for construction
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight tracking-tightest mb-6">
              Crew scheduling and daily labor tracking built for the jobsite.
            </h1>

            <p className="text-lg text-text-secondary leading-relaxed mb-8">
              Manage multi-site crews, track daily hours, and keep foremen in sync — all from your phone.
              No spreadsheets. No guesswork.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-8">
              {isAuthenticated ? (
                <Link
                  to="/workers"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors"
                >
                  Go to app <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link
                    to="/request-access"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors"
                  >
                    Get started <ArrowRight size={16} />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-text-primary rounded-xl font-semibold hover:border-gray-300 transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>

            {/* Proof chips */}
            <div className="flex flex-wrap gap-2" role="list" aria-label="Key features">
              {chips.map((chip) => (
                <span
                  key={chip}
                  role="listitem"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-text-secondary"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Right: app preview */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-3xl" />
            <AppMock />
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// What it does — split by persona
// ============================================================================

function WhatItDoes() {
  const adminFeatures = [
    { icon: Users,          title: 'Workers',     desc: 'Manage crew members, roles (carpenter, mason, etc.) and job site assignments.' },
    { icon: CheckSquare,    title: 'Tasks',       desc: 'Create and assign tasks. Attach PDFs — specs, plans, drawings — directly to a task so every worker has the right files.' },
    { icon: Calendar,       title: 'Calendar',    desc: 'Visual schedule and Gantt chart view across all your job sites.' },
    { icon: Activity,       title: 'Activities',  desc: 'Track progress and review work activity logs in real time.' },
    { icon: Clock,          title: 'Daily Hours', desc: 'Log and review hours per worker per day across all sites.' },
    { icon: LayoutDashboard, title: 'Dashboard',  desc: 'Operational overview: crew status, active tasks, site activity.' },
  ];

  return (
    <section id="product" className="py-20 bg-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text-primary mb-4">Built for every role on site</h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Two interfaces, one system — tailored to how managers and foremen actually work.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8" id="roles">
          {/* Admin panel */}
          <div className="bg-bg-primary rounded-2xl p-8 border border-gray-100">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">For Admins &amp; Managers</h3>
                <p className="text-xs text-text-secondary">Full operational control</p>
              </div>
            </div>

            <ul className="space-y-4">
              {adminFeatures.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center" aria-hidden="true">
                    <Icon size={14} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{title}</div>
                    <div className="text-sm text-text-secondary">{desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Foreman panel */}
          <div className="bg-gray-900 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
                <Smartphone size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">For Foremen — on site</h3>
                <p className="text-xs text-gray-400">Built for field conditions</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-white mb-1">Today view</div>
                <div className="text-sm text-gray-400">
                  A simplified daily view of exactly what the crew needs to execute today. No clutter, just the work.
                </div>
              </div>

              {/* Mini today mock */}
              <div className="bg-gray-800 rounded-xl p-4" aria-hidden="true">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">
                  Today · North Site
                </div>
                {['Pour foundations — Block C', 'Frame interior walls', 'Inspect rebar grid'].map((task, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-gray-700 last:border-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-blue-400' : 'bg-gray-600'}`} />
                    <span className="text-sm text-gray-200">{task}</span>
                  </div>
                ))}
              </div>

              <ul className="space-y-3">
                {[
                  { label: 'Big tap targets', desc: 'Works with gloves. Tap, done.' },
                  { label: 'Quick entry',     desc: 'Log hours and tasks in seconds, not minutes.' },
                  { label: 'Low-friction by design', desc: 'Fewer taps, clear layouts, readable in sunlight.' },
                ].map(({ label, desc }) => (
                  <li key={label} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded bg-primary/20 flex-shrink-0 flex items-center justify-center" aria-hidden="true">
                      <span className="text-primary text-xs font-bold">✓</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="text-xs text-gray-400">{desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// How it works
// ============================================================================

function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Create company & job sites',
      desc: 'Set up your organization, add your active job sites, and configure your team structure.',
    },
    {
      step: '02',
      title: 'Invite your crew',
      desc: 'Send email invites to workers and foremen. Each member sets their own password on first login and gets assigned to their site.',
    },
    {
      step: '03',
      title: 'Assign tasks & track hours daily',
      desc: 'Managers create and assign tasks. Foremen open the Today view each morning. Hours are logged at end of shift.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-bg-primary px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text-primary mb-4">Up and running in an afternoon</h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            No training sessions. No long onboarding. Three steps and your crew is tracking.
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-10">
          {steps.map(({ step, title, desc }) => (
            <li key={step}>
              <div
                className="text-7xl font-black text-gray-100 leading-none mb-4 select-none"
                aria-hidden="true"
              >
                {step}
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ============================================================================
// Differentiators
// ============================================================================

function Differentiators() {
  const cards = [
    {
      icon: Mic,
      title: 'Voice input',
      desc: 'A floating voice button lets you log tasks and hours hands-free. Works in the field, on the go.',
    },
    {
      icon: MapPin,
      title: 'Job site context',
      desc: 'Workers are assigned to specific sites. Multi-site support keeps each project isolated and clear.',
    },
    {
      icon: RefreshCw,
      title: 'Real-time updates',
      desc: 'Powered by Supabase live sync. Everyone sees the same data, always current — no refresh needed.',
    },
    {
      icon: FileText,
      title: 'File sharing on tasks',
      desc: 'Supes, OMs, and engineers attach PDFs — specs, plans, drawings — directly to tasks. Everyone on the task sees the same files.',
    },
  ];

  return (
    <section className="py-20 bg-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text-primary mb-4">Why crews choose Cru</h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Built for construction, not adapted from something else.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="bg-bg-primary rounded-2xl p-6 border border-gray-100 hover:border-primary/30 transition-colors duration-150"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-subtle flex items-center justify-center mb-4" aria-hidden="true">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================================
// Security & Reliability
// ============================================================================

function Security() {
  const points = [
    {
      icon: Lock,
      title: 'Role-based access',
      desc: 'Admins, superintendents, foremen, and workers each see only what they need.',
    },
    {
      icon: Shield,
      title: 'Tenant isolation',
      desc: "Each company's data is strictly separated. No cross-contamination between organizations.",
    },
    {
      icon: RefreshCw,
      title: 'Auth by Supabase',
      desc: 'Email-based authentication with invite-only account creation and secure token handling.',
    },
  ];

  return (
    <section className="py-16 bg-bg-primary px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Security &amp; Reliability
                </span>
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">
                Enterprise-grade security, field-tested reliability.
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Built on Supabase with row-level access control. Your data stays yours — isolated per tenant, protected by role.
              </p>
            </div>

            <ul className="space-y-5">
              {points.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-4">
                  <div
                    className="w-9 h-9 rounded-lg bg-primary-subtle flex-shrink-0 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary text-sm">{title}</div>
                    <div className="text-sm text-text-secondary">{desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ (placeholder section with anchor)
// ============================================================================

function FAQ() {
  const items = [
    {
      q: 'Is Cru invite-only?',
      a: 'Yes — accounts are created by invitation. Request access and we\'ll set you up.',
    },
    {
      q: 'Does it work on mobile?',
      a: 'Cru is mobile-first. The Foreman Today view is designed specifically for field use with large tap targets and minimal friction.',
    },
    {
      q: 'Can I manage multiple job sites?',
      a: 'Yes. Workers and tasks are scoped to specific job sites. You get a full cross-site view at the admin level.',
    },

  ];

  return (
    <section id="faq" className="py-20 bg-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-text-primary mb-4">Common questions</h2>
        </div>
        <dl className="space-y-6">
          {items.map(({ q, a }) => (
            <div key={q} className="border-b border-gray-100 pb-6 last:border-0">
              <dt className="font-semibold text-text-primary mb-2">{q}</dt>
              <dd className="text-text-secondary text-sm leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ============================================================================
// Pricing placeholder
// ============================================================================

function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-bg-primary px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-text-primary mb-4">Simple pricing, coming soon</h2>
        <p className="text-text-secondary mb-8 leading-relaxed">
          We're in early access. Request access now and lock in founder pricing when we launch.
        </p>
        <Link
          to="/request-access"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors"
        >
          Request early access <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

// ============================================================================
// CTA Band
// ============================================================================

function CTABand() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="py-20 bg-gray-900 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Start running crews with less friction.
        </h2>
        <p className="text-gray-400 mb-8 text-lg">Invite your first worker in minutes.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/workers"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors"
            >
              Go to app <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link
                to="/request-access"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors"
              >
                Get started <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Footer
// ============================================================================

function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <Link to="/" aria-label="Cru home">
            <img src="/image/cru-logo-tiff.png" alt="Cru logo" className="h-7 w-auto opacity-75" />
          </Link>

          <nav className="flex flex-wrap gap-6" aria-label="Footer navigation">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy</a>
            <a
              href="mailto:hello@cruwork.app"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} CruWork. All rights reserved.
          </p>
          <p className="text-xs text-gray-700">cruwork.app</p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// Landing Page — exported component
// ============================================================================

export function Landing() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main>
        <Hero />
        <WhatItDoes />
        <HowItWorks />
        <Differentiators />
        <Security />
        <Pricing />
        <FAQ />
        <CTABand />
      </main>
      <Footer />
    </div>
  );
}
