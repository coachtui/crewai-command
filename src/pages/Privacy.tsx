// ============================================================================
// Privacy Policy
// Route: /privacy (public)
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

export function Privacy() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <LegalHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page title */}
        <div className="mb-12 pb-8 border-b border-gray-100">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Privacy Policy</h1>
          <p className="text-text-secondary text-sm">Effective date: March 2026</p>
        </div>

        <div className="prose-container">
          <p className="text-text-secondary text-sm leading-relaxed mb-10">
            AIGA LLC ("we," "us," or "our") operates the Cru platform available at cruwork.app
            ("Service"). This Privacy Policy describes how we collect, use, store, and protect
            information when you use Cru, and explains your rights with respect to that information.
            By using the Service, you agree to the practices described in this policy.
          </p>

          <Section number="1" title="Information We Collect">
            <p>
              <strong className="text-text-primary font-medium">Account information.</strong>{' '}
              When you are invited to Cru, we collect your email address. When you set up your
              account, you may provide your name and other profile information. Your organization's
              administrator may also provide your name as part of the invitation process.
            </p>
            <p>
              <strong className="text-text-primary font-medium">Work and operational data.</strong>{' '}
              Information you or your organization enters into the platform, including task assignments,
              daily labor hours, job site details, crew schedules, worker roles, and file uploads
              such as drawings, plans, and specifications.
            </p>
            <p>
              <strong className="text-text-primary font-medium">Usage data.</strong>{' '}
              We may collect technical information about how you access the Service, including your
              device type, browser, IP address, and pages visited. This is used to maintain and
              improve the Service, not to profile individuals.
            </p>
            <p>
              <strong className="text-text-primary font-medium">Communications.</strong>{' '}
              If you contact us by email, we retain records of those communications to assist with
              your request.
            </p>
          </Section>

          <Section number="2" title="How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Authenticate your account and enforce access controls</li>
              <li>Send invitations, account-related notifications, and service announcements</li>
              <li>Respond to support inquiries and resolve issues</li>
              <li>Monitor and improve the performance, security, and reliability of the Service</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>
              We do not use your data for advertising, behavioral profiling, or sale to third parties.
            </p>
          </Section>

          <Section number="3" title="Data Sharing">
            <p>
              We do not sell, rent, or trade your personal information. We share data only in the
              following limited circumstances:
            </p>
            <p>
              <strong className="text-text-primary font-medium">Service providers.</strong>{' '}
              We use third-party vendors to help operate the Service. These providers process data
              on our behalf under appropriate data protection agreements and are not permitted to
              use your data for their own purposes. Our current providers are listed in Section 4.
            </p>
            <p>
              <strong className="text-text-primary font-medium">Legal requirements.</strong>{' '}
              We may disclose information if required to do so by law, court order, or governmental
              authority, or if we believe disclosure is necessary to protect the rights, property,
              or safety of AIGA LLC, our users, or others.
            </p>
            <p>
              <strong className="text-text-primary font-medium">Business transfers.</strong>{' '}
              In the event of a merger, acquisition, or sale of all or substantially all of our
              assets, your information may be transferred as part of that transaction. We will
              notify you of any such change and the choices available to you.
            </p>
          </Section>

          <Section number="4" title="Third-Party Service Providers">
            <p>
              <strong className="text-text-primary font-medium">Supabase.</strong>{' '}
              We use Supabase to store your data and manage authentication. Supabase provides the
              database, storage, and authentication infrastructure for the Service. Data is stored
              with row-level security controls that enforce per-organization data isolation.
              Learn more at{' '}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                supabase.com/privacy
              </a>.
            </p>
            <p>
              <strong className="text-text-primary font-medium">Resend.</strong>{' '}
              We use Resend to deliver transactional emails, including invitations and
              account notifications. Only your email address is shared for this purpose.
              Learn more at{' '}
              <a
                href="https://resend.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                resend.com/privacy
              </a>.
            </p>
          </Section>

          <Section number="5" title="Data Security">
            <p>
              We implement appropriate technical and organizational security measures to protect
              your data against unauthorized access, loss, or alteration. These measures include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Row-level security (RLS) — each organization's data is strictly isolated from others</li>
              <li>Encrypted data transmission over HTTPS</li>
              <li>Invite-only account creation — no self-registration</li>
              <li>Role-based access controls within each organization</li>
            </ul>
            <p>
              While we take security seriously, no method of transmission over the internet or
              electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </Section>

          <Section number="6" title="Data Retention">
            <p>
              We retain your data for as long as your organization's account is active and in good
              standing. If an account is terminated, we retain Customer Data for 30 days following
              the termination date to allow for data export. After this period, data may be
              permanently deleted.
            </p>
            <p>
              You may request deletion of your personal data at any time by contacting us at{' '}
              <a href="mailto:hello@cruwork.app" className="text-primary hover:underline">
                hello@cruwork.app
              </a>. Note that deletion of your account data may affect your organization's
              operational records within the platform.
            </p>
          </Section>

          <Section number="7" title="Your Rights">
            <p>
              Depending on your location, you may have the following rights with respect to your
              personal data:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-text-primary font-medium">Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong className="text-text-primary font-medium">Correction</strong> — request correction of inaccurate or incomplete data</li>
              <li><strong className="text-text-primary font-medium">Deletion</strong> — request deletion of your personal data, subject to legal obligations</li>
              <li><strong className="text-text-primary font-medium">Portability</strong> — request a machine-readable copy of your data</li>
              <li><strong className="text-text-primary font-medium">Objection</strong> — object to certain processing of your data</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:hello@cruwork.app" className="text-primary hover:underline">
                hello@cruwork.app
              </a>. We will respond within a reasonable timeframe.
            </p>
          </Section>

          <Section number="8" title="Cookies and Local Storage">
            <p>
              Cru uses browser local storage and session tokens to maintain your authenticated
              session. These are strictly necessary for the Service to function and are not used
              for advertising or cross-site tracking.
            </p>
            <p>
              We do not use third-party advertising cookies or analytics trackers on the platform.
            </p>
          </Section>

          <Section number="9" title="Children's Privacy">
            <p>
              Cru is a business platform intended for use by adults in a professional capacity.
              We do not knowingly collect personal information from individuals under the age of 18.
              If you believe a minor has provided us with personal information, please contact us
              and we will take appropriate steps to delete it.
            </p>
          </Section>

          <Section number="10" title="International Data Transfers">
            <p>
              AIGA LLC is based in the United States. If you are accessing the Service from outside
              the United States, please be aware that your information may be transferred to, stored,
              and processed in the United States. By using the Service, you consent to this transfer.
            </p>
          </Section>

          <Section number="11" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices
              or applicable law. We will notify you of material changes by email or through a notice
              within the Service before the changes take effect. The "Effective date" at the top of
              this page indicates when the policy was last revised.
            </p>
            <p>
              Your continued use of the Service after we post changes constitutes your acceptance
              of the updated policy.
            </p>
          </Section>

          <Section number="12" title="Contact">
            <p>
              If you have questions, concerns, or requests related to this Privacy Policy, please
              contact us:
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
