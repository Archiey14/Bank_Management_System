import { Link } from 'react-router-dom'
import { COMPANY, LEGAL_LAST_UPDATED } from '../config/legal'
import BrandLogo from '../components/BrandLogo'
import ThemeToggle from '../components/ThemeToggle'
import SiteFooter from '../components/SiteFooter'
import './legal.css'

export default function Privacy() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header__left">
          <BrandLogo size={32} tagline={false} />
          <nav className="legal-header__nav">
            <Link to="/">Home</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy" className="active">Privacy</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />
          <Link to="/login" className="cookie-btn cookie-btn--outline" style={{ textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </header>

      <main className="legal-container">
        <article className="legal-card">
          <div className="legal-eyebrow">Privacy &amp; Data Protection</div>
          <h1 className="legal-title">Privacy Policy</h1>
          <div className="legal-updated">Last Updated: {LEGAL_LAST_UPDATED}</div>

          <div className="legal-body">
            <p>
              At <strong>{COMPANY.name}</strong>, safeguarding your personal and financial data is
              fundamental to our service. This Privacy Policy details the types of information we
              collect, how that data is stored and processed, the security measures we employ, and
              your rights regarding your personal information.
            </p>

            <div className="legal-box">
              <strong>Our Privacy Commitment:</strong> We never sell, rent, or trade your personal
              or banking data to third-party advertisers. All data collected is strictly utilized to
              deliver secure and reliable banking operations.
            </div>

            <h2>1. Information We Collect</h2>
            <p>We collect information you provide directly to us when interacting with our banking services:</p>
            <ul>
              <li>
                <strong>Profile &amp; Contact Data:</strong> Your full name, email address, phone number,
                and optional avatar/profile picture.
              </li>
              <li>
                <strong>Authentication Information:</strong> Encrypted password hashes, two-step
                verification (TOTP) configuration data, and password reset tokens. Plaintext passwords
                are never stored or accessible by bank staff.
              </li>
              <li>
                <strong>Account Application Information:</strong> Date of birth, permanent account
                numbers (PAN), occupation, income band, physical address, and nominee details submitted
                for account opening.
              </li>
              <li>
                <strong>Financial &amp; Transaction Records:</strong> Account numbers, ledger transaction
                entries (deposits, withdrawals, transfers, bill payments, and fixed deposits), amounts,
                timestamps, balances, and counterparty account details.
              </li>
              <li>
                <strong>Audit &amp; System Logs:</strong> Timestamps of sensitive staff and administrative
                actions, client IP addresses for request logging, and rate-limiting metrics to protect
                against unauthorized access.
              </li>
            </ul>

            <h2>2. How We Handle Account &amp; Transaction Information</h2>
            <p>
              Your banking transactions are maintained in an immutable, append-only ledger. When you
              initiate a deposit, withdrawal, or transfer:
            </p>
            <ul>
              <li>
                <strong>Atomic Balances:</strong> Balance modifications occur within database transactions
                ensuring complete consistency and preventing double-spending or overdrafts.
              </li>
              <li>
                <strong>Auditability:</strong> Every financial transaction is associated with the initiating
                user, the affected account, and a unique transfer reference.
              </li>
              <li>
                <strong>Restricted Staff Access:</strong> Bank staff members only access customer accounts
                for legitimate administrative purposes such as customer verification, counter deposits,
                or application approvals.
              </li>
            </ul>

            <h2>3. Data Security &amp; Storage</h2>
            <p>
              We implement comprehensive technical and organizational safeguards to ensure data integrity
              and confidentiality:
            </p>
            <ul>
              <li>
                <strong>Password Encryption:</strong> Passwords are processed with industry-standard
                salted bcrypt hashing before storage.
              </li>
              <li>
                <strong>Stateless Authentication:</strong> User authentication is managed using signed,
                time-limited JSON Web Tokens (JWT) verified cryptographically on each request.
              </li>
              <li>
                <strong>Transport Security:</strong> All client-to-server communications require TLS/HTTPS
                encryption to prevent interception of sensitive financial data in transit.
              </li>
              <li>
                <strong>Access Control:</strong> Strict role-based authorization separates customer, staff,
                and administrator capabilities on both the frontend and backend.
              </li>
            </ul>

            <h2>4. Cookie Usage &amp; Preferences</h2>
            <p>
              We use necessary cookies for session authentication and CSRF protection. In addition,
              we support optional functional cookies to remember your visual theme preference (Light,
              Dark, or System default) and anonymous performance metrics. You can update your cookie
              preferences at any time using the Cookie Settings link in the footer.
            </p>

            <h2>5. Your Privacy Rights</h2>
            <p>As a valued customer of {COMPANY.name}, you have the right to:</p>
            <ul>
              <li>
                <strong>Access &amp; Review:</strong> View all your personal details, account balances, and
                transaction history in real-time through your dashboard.
              </li>
              <li>
                <strong>Correction &amp; Updates:</strong> Edit and update your personal information
                (such as your name, phone number, and avatar) directly in the Edit Profile settings.
              </li>
              <li>
                <strong>Data Export:</strong> Download comprehensive account statements and transaction
                histories in CSV format.
              </li>
              <li>
                <strong>Account Closure:</strong> Request closure of your accounts and cessation of active
                processing once all balances have been settled.
              </li>
            </ul>

            <h2>6. Contact Us &amp; Grievance Redressal</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or how your
              data is managed, please contact:
            </p>
            <ul>
              <li><strong>Privacy Inquiries:</strong> <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a></li>
              <li><strong>Customer Support:</strong> <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a></li>
              <li><strong>Grievance Officer:</strong> {COMPANY.grievanceOfficer}</li>
            </ul>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

