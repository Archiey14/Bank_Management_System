import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { COMPANY, LEGAL_LAST_UPDATED } from '../config/legal'
import BrandLogo from '../components/BrandLogo'
import ThemeToggle from '../components/ThemeToggle'
import SiteFooter from '../components/SiteFooter'
import './legal.css'

export default function Terms() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  const handleDownloadPdf = () => {
    window.print()
  }

  const handleDownloadTxt = () => {
    const termsText = `${COMPANY.name.toUpperCase()} - TERMS & CONDITIONS
Last Updated: ${LEGAL_LAST_UPDATED}
URL: ${window.location.origin}/terms

Welcome to ${COMPANY.name}. These Terms & Conditions govern your access to and use of our online banking portal, customer dashboards, and account services. By creating an account or accessing any of our digital banking services, you acknowledge that you have read, understood, and agreed to be bound by these Terms.

Notice for Customers: If you do not agree with any part of these Terms & Conditions, you must refrain from registering an account and discontinue use of our banking platform immediately.

1. ACCOUNT REGISTRATION & ELIGIBILITY
To open and maintain a bank account with ${COMPANY.name}, you must be at least 18 years of age and possess the legal capacity to enter into binding agreements under applicable laws.
- Accuracy of Information: You agree to provide true, current, and complete information during registration and account applications. Providing false, misleading, or fraudulent details is strictly prohibited.
- Single Account Holder: Each customer is permitted one primary customer profile. Accounts cannot be assigned or transferred without explicit authorization from bank staff.
- Identity Verification: We reserve the right to verify your identity using official government identifiers and documentation before approving accounts.

2. PERMITTED ACCOUNT USAGE
Your ${COMPANY.name} account is intended for legitimate personal and commercial banking activities. You agree not to use the platform for:
- Money laundering, terrorist financing, or any unlawful financial schemes.
- Attempts to bypass or test access control, authentication, or rate-limiting systems.
- Unauthorized automated scraping, bot queries, or disruption of bank operations.
- Impersonating bank employees, staff members, or other account holders.

3. DEPOSITS, WITHDRAWALS & TRANSFERS
All monetary balances in our system are denominated in lawful currency (INR) and tracked through an append-only atomic ledger.
- Deposits: Counter deposits may be made via authorized bank staff, or through verified digital deposit options available in your workspace.
- Withdrawals: Withdrawals are subject to available account balances. Overdrafts are strictly prevented by system transaction checks. Counter withdrawals require verification by authorized bank personnel.
- Transfers: Internal transfers between ${COMPANY.name} accounts occur in real-time using database transactions ensuring both debit and credit legs complete together or neither does.
- Transaction Review: Transfers exceeding regulatory or risk thresholds may be flagged for compliance review by bank staff prior to or following processing.

4. SECURITY & USER RESPONSIBILITIES
The security of your account depends critically upon keeping your access credentials confidential.
- Password Protection: You must maintain a strong password containing letters, numbers, and symbols. Never share your password or two-factor authentication codes with anyone, including bank staff.
- Prompt Notification: You must immediately notify our support team if you suspect unauthorized access or any security breach involving your account.
- Session Security: Always sign out from shared or public computers upon concluding your banking activities.

5. SERVICE AVAILABILITY & LIMITATIONS
While ${COMPANY.name} strives for continuous 24/7 service availability, system maintenance, updates, or telecommunication failures may occasionally result in brief unplanned service interruptions.
To the fullest extent permitted by applicable law, ${COMPANY.name} shall not be liable for indirect, incidental, or consequential damages resulting from network delays, third-party outages, or user errors in entering recipient account details.

6. ACCOUNT FREEZING & TERMINATION
We reserve the right to freeze or restrict access to accounts that exhibit suspicious activity, potential security compromises, or violations of these Terms. Unfreezing is handled following review by bank staff. You may close your account at any time by contacting support, provided all outstanding balances are settled.

7. CONTACT INFORMATION
If you have questions regarding these Terms & Conditions or wish to resolve an inquiry, please reach out to our team:
- Support: ${COMPANY.supportEmail}
- Grievance Officer: ${COMPANY.grievanceOfficer}
`
    const blob = new Blob([termsText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${COMPANY.name.replace(/\s+/g, '_')}_Terms_and_Conditions.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header__left">
          <BrandLogo size={32} tagline={false} />
          <nav className="legal-header__nav">
            <Link to="/">Home</Link>
            <Link to="/terms" className="active">
              Terms
            </Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />
          <Link
            to="/login"
            className="cookie-btn cookie-btn--outline"
            style={{ textDecoration: 'none' }}
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="legal-container">
        <article className="legal-card">
          <div className="legal-eyebrow">Legal Agreement</div>
          <h1 className="legal-title" id="terms-and-conditions">
            Terms &amp; Conditions
          </h1>

          <div className="legal-actions-bar">
            <div className="legal-updated">Last Updated: {LEGAL_LAST_UPDATED}</div>
            <div className="legal-actions">
              <button
                type="button"
                className="legal-btn"
                onClick={handleDownloadPdf}
                title="Download or Print PDF"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                className="legal-btn legal-btn--secondary"
                onClick={handleDownloadTxt}
                title="Download plain text copy"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Download TXT</span>
              </button>
            </div>
          </div>

          <div className="legal-body">
            <p>
              Welcome to <strong>{COMPANY.name}</strong>. These Terms &amp; Conditions govern your
              access to and use of our online banking portal, customer dashboards, and account
              services. By creating an account or accessing any of our digital banking services,
              you acknowledge that you have read, understood, and agreed to be bound by these Terms.
            </p>

            <div className="legal-box">
              <strong>Notice for Customers:</strong> If you do not agree with any part of these
              Terms &amp; Conditions, you must refrain from registering an account and discontinue
              use of our banking platform immediately.
            </div>

            <h2>1. Account Registration &amp; Eligibility</h2>
            <p>
              To open and maintain a bank account with {COMPANY.name}, you must be at least 18 years
              of age and possess the legal capacity to enter into binding agreements under applicable
              laws.
            </p>
            <ul>
              <li>
                <strong>Accuracy of Information:</strong> You agree to provide true, current, and
                complete information during registration and account applications. Providing false,
                misleading, or fraudulent details is strictly prohibited.
              </li>
              <li>
                <strong>Single Account Holder:</strong> Each customer is permitted one primary customer
                profile. Accounts cannot be assigned or transferred without explicit authorization
                from bank staff.
              </li>
              <li>
                <strong>Identity Verification:</strong> We reserve the right to verify your identity
                using official government identifiers and documentation before approving accounts.
              </li>
            </ul>

            <h2>2. Permitted Account Usage</h2>
            <p>
              Your {COMPANY.name} account is intended for legitimate personal and commercial banking
              activities. You agree not to use the platform for:
            </p>
            <ul>
              <li>Money laundering, terrorist financing, or any unlawful financial schemes.</li>
              <li>Attempts to bypass or test access control, authentication, or rate-limiting systems.</li>
              <li>Unauthorized automated scraping, bot queries, or disruption of bank operations.</li>
              <li>Impersonating bank employees, staff members, or other account holders.</li>
            </ul>

            <h2>3. Deposits, Withdrawals &amp; Transfers</h2>
            <p>
              All monetary balances in our system are denominated in lawful currency (INR) and tracked
              through an append-only atomic ledger.
            </p>
            <ul>
              <li>
                <strong>Deposits:</strong> Counter deposits may be made via authorized bank staff, or
                through verified digital deposit options available in your workspace.
              </li>
              <li>
                <strong>Withdrawals:</strong> Withdrawals are subject to available account balances.
                Overdrafts are strictly prevented by system transaction checks. Counter withdrawals
                require verification by authorized bank personnel.
              </li>
              <li>
                <strong>Transfers:</strong> Internal transfers between {COMPANY.name} accounts occur in
                real-time using database transactions ensuring both debit and credit legs complete
                together or neither does.
              </li>
              <li>
                <strong>Transaction Review:</strong> Transfers exceeding regulatory or risk thresholds
                may be flagged for compliance review by bank staff prior to or following processing.
              </li>
            </ul>

            <h2>4. Security &amp; User Responsibilities</h2>
            <p>
              The security of your account depends critically upon keeping your access credentials
              confidential.
            </p>
            <ul>
              <li>
                <strong>Password Protection:</strong> You must maintain a strong password containing
                letters, numbers, and symbols. Never share your password or two-factor authentication
                codes with anyone, including bank staff.
              </li>
              <li>
                <strong>Prompt Notification:</strong> You must immediately notify our support team if
                you suspect unauthorized access or any security breach involving your account.
              </li>
              <li>
                <strong>Session Security:</strong> Always sign out from shared or public computers upon
                concluding your banking activities.
              </li>
            </ul>

            <h2>5. Service Availability &amp; Limitations</h2>
            <p>
              While {COMPANY.name} strives for continuous 24/7 service availability, system
              maintenance, updates, or telecommunication failures may occasionally result in brief
              unplanned service interruptions.
            </p>
            <p>
              To the fullest extent permitted by applicable law, {COMPANY.name} shall not be liable for
              indirect, incidental, or consequential damages resulting from network delays, third-party
              outages, or user errors in entering recipient account details.
            </p>

            <h2>6. Account Freezing &amp; Termination</h2>
            <p>
              We reserve the right to freeze or restrict access to accounts that exhibit suspicious
              activity, potential security compromises, or violations of these Terms. Unfreezing is
              handled following review by bank staff. You may close your account at any time by
              contacting support, provided all outstanding balances are settled.
            </p>

            <h2>7. Contact Information</h2>
            <p>
              If you have questions regarding these Terms &amp; Conditions or wish to resolve an inquiry,
              please reach out to our team:
            </p>
            <ul>
              <li>
                <strong>Support:</strong>{' '}
                <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
              </li>
              <li>
                <strong>Grievance Officer:</strong> {COMPANY.grievanceOfficer}
              </li>
            </ul>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
