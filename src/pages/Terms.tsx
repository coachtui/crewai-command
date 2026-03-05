// ============================================================================
// Terms of Service
// Route: /terms (public)
// ============================================================================

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function LegalHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" aria-label="Cru home">
            <img src="/image/cru-logo-tiff.png" alt="Cru logo" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to home
          </Link>
        </div>
      </div>
    </header>
  );
}

function LegalFooter() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 px-4 sm:px-6 lg:px-8 py-10 mt-20">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} AIGA LLC. All rights reserved.</p>
        <nav className="flex gap-6" aria-label="Legal navigation">
          <Link to="/terms" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
          <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy</Link>
          <a href="mailto:hello@cruwork.app" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Contact</a>
        </nav>
      </div>
    </footer>
  );
}

// ============================================================================
// Section helper
// ============================================================================

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-text-primary mb-3">
        {number}. {title}
      </h2>
      <div className="space-y-3 text-text-secondary text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

// ============================================================================
// Page
// ============================================================================

export function Terms() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <LegalHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page title */}
        <div className="mb-12 pb-8 border-b border-gray-100">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Terms of Service</h1>
          <p className="text-text-secondary text-sm">Effective date: March 2026</p>
        </div>

        <div className="prose-container">
          <p className="text-text-secondary text-sm leading-relaxed mb-10">
            These Terms of Service ("Terms") govern your access to and use of the Cru platform ("Service"),
            operated by AIGA LLC ("Company," "we," "us," or "our"). By accessing or using Cru, you agree
            to be bound by these Terms. If you are accessing Cru on behalf of a company or organization,
            you represent that you have the authority to bind that organization to these Terms.
          </p>

          <Section number="1" title="The Service">
            <p>
              Cru is a construction crew management platform that helps companies schedule crews, assign
              tasks, track daily labor hours, and coordinate work across job sites. Access to Cru is
              by invitation only — accounts are created by a company administrator and delivered via email.
            </p>
            <p>
              We reserve the right to modify, suspend, or discontinue the Service at any time, with
              reasonable notice where practicable.
            </p>
          </Section>

          <Section number="2" title="Accounts and Access">
            <p>
              Your account is created through an invitation issued by your organization's administrator.
              You are responsible for maintaining the confidentiality of your login credentials and for
              all activity that occurs under your account.
            </p>
            <p>
              Company administrators are responsible for managing user access within their organization,
              including inviting workers and foremen, assigning job site access, and revoking accounts
              when individuals leave the organization.
            </p>
            <p>
              You agree to notify us immediately at{' '}
              <a href="mailto:hello@cruwork.app" className="text-primary hover:underline">
                hello@cruwork.app
              </a>{' '}
              if you suspect unauthorized access to your account.
            </p>
          </Section>

          <Section number="3" title="Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
              <li>Interfere with or disrupt the integrity, performance, or availability of the Service</li>
              <li>Reverse engineer, decompile, or disassemble any portion of the Service</li>
              <li>Use the Service to store, transmit, or distribute harmful, offensive, or infringing content</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Use automated means to scrape, crawl, or extract data from the Service</li>
            </ul>
          </Section>

          <Section number="4" title="Subscriptions and Billing">
            <p>
              Cru is offered on a subscription basis, billed per job site per month (or annually).
              Subscription fees are due in advance at the start of each billing period.
            </p>
            <p>
              All fees are non-refundable except as required by applicable law or as explicitly stated
              in a written agreement. We reserve the right to change subscription pricing with at least
              30 days' written notice. Continued use of the Service after a price change takes effect
              constitutes acceptance of the new pricing.
            </p>
            <p>
              Failure to pay may result in suspension or termination of access to the Service.
            </p>
          </Section>

          <Section number="5" title="Your Data">
            <p>
              You retain ownership of all data, content, and information you input into Cru ("Customer Data").
              You grant AIGA LLC a limited, non-exclusive license to store, process, and display your
              Customer Data solely as necessary to provide and maintain the Service.
            </p>
            <p>
              We do not sell, rent, or share your Customer Data with third parties except as described
              in our Privacy Policy or as required by law.
            </p>
          </Section>

          <Section number="6" title="Intellectual Property">
            <p>
              The Cru platform — including its software, design, user interface, and content — is owned
              by AIGA LLC and protected by copyright, trademark, and other applicable intellectual property
              laws. These Terms do not grant you any ownership rights in the platform.
            </p>
            <p>
              You are granted a limited, non-transferable, non-sublicensable license to access and use
              the Service during your subscription term, solely for your internal business operations.
            </p>
          </Section>

          <Section number="7" title="Data Isolation and Confidentiality">
            <p>
              Each organization's data is stored separately and is not accessible to other organizations
              using the Service. We implement row-level access controls to enforce this separation.
            </p>
            <p>
              We will treat your Customer Data as confidential and will not access it except as necessary
              to provide the Service, comply with legal obligations, or respond to a support request
              made by your organization.
            </p>
          </Section>

          <Section number="8" title="Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, AIGA LLC
              DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
              FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p>
              We do not warrant that the Service will be uninterrupted, error-free, or free of viruses
              or other harmful components.
            </p>
          </Section>

          <Section number="9" title="Limitation of Liability">
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, AIGA LLC SHALL NOT BE LIABLE FOR
              ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS
              OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH
              YOUR USE OF THE SERVICE.
            </p>
            <p>
              OUR TOTAL CUMULATIVE LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE
              TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO US IN THE TWELVE (12) MONTHS
              IMMEDIATELY PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section number="10" title="Termination">
            <p>
              Either party may terminate these Terms at any time by providing written notice. You may
              cancel your subscription by contacting us at{' '}
              <a href="mailto:hello@cruwork.app" className="text-primary hover:underline">
                hello@cruwork.app
              </a>.
            </p>
            <p>
              Upon termination, your access to the Service will cease at the end of the current billing
              period. We will retain your Customer Data for 30 days following termination, after which
              it may be permanently deleted. You are responsible for exporting any data you wish to
              retain before termination.
            </p>
            <p>
              We may suspend or terminate your access immediately if you breach these Terms or engage
              in conduct that poses a risk to the Service or other users.
            </p>
          </Section>

          <Section number="11" title="Governing Law and Disputes">
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of
              Hawaii, without regard to its conflict of law principles. Any legal action or proceeding
              arising out of or relating to these Terms shall be brought exclusively in the state or
              federal courts located in Hawaii, and you consent to the personal jurisdiction of such courts.
            </p>
          </Section>

          <Section number="12" title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. We will notify you of material changes by
              email or through a notice within the Service at least 14 days before the changes take
              effect. Your continued use of the Service after the effective date of the revised Terms
              constitutes your acceptance of the changes.
            </p>
            <p>
              If you do not agree to the updated Terms, you must stop using the Service before the
              changes take effect.
            </p>
          </Section>

          <Section number="13" title="General">
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between
              you and AIGA LLC with respect to the Service. If any provision of these Terms is held
              to be invalid or unenforceable, the remaining provisions will continue in full force.
              Our failure to enforce any right or provision does not constitute a waiver of that right.
            </p>
          </Section>

          <Section number="14" title="Contact">
            <p>
              For questions or concerns about these Terms, please contact us at:
            </p>
            <div className="mt-2 p-4 bg-white border border-gray-100 rounded-xl">
              <p className="font-medium text-text-primary">AIGA LLC</p>
              <p>Operating as: Cru / CruWork</p>
              <p>
                Email:{' '}
                <a href="mailto:hello@cruwork.app" className="text-primary hover:underline">
                  hello@cruwork.app
                </a>
              </p>
              <p>Website: cruwork.app</p>
            </div>
          </Section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
