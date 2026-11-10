import { Link } from 'react-router-dom'
import './landing.css'
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon, TrendUpIcon } from '../components/icons'

/* Small local icon set for the feature cards */
const Icon = ({ children }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const WalletIcon = () => (
  <Icon>
    <path d="M3 7a2 2 0 012-2h13v4" />
    <path d="M3 7v11a2 2 0 002 2h15a1 1 0 001-1V10a1 1 0 00-1-1H5a2 2 0 01-2-2z" />
    <circle cx="16.5" cy="14.5" r="1.2" />
  </Icon>
)
const SwapIcon = () => (
  <Icon>
    <path d="M4 8h14M14 4l4 4-4 4" />
    <path d="M20 16H6M10 12l-4 4 4 4" />
  </Icon>
)
const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 5.2a3.2 3.2 0 010 5.6M18 14.4c2 .7 3 2.6 3 5.6" />
  </Icon>
)
const ChartIcon = () => (
  <Icon>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Icon>
)
const KeyIcon = () => (
  <Icon>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M16 7l3 3" />
  </Icon>
)
const HeadsetIcon = () => (
  <Icon>
    <path d="M4 14v-2a8 8 0 0116 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
    <path d="M19 20c0 1.1-1.8 2-4 2" />
  </Icon>
)

const features = [
  {
    icon: <WalletIcon />,
    title: 'Accounts, simplified',
    text: 'Open, review and manage savings and current accounts from one clear workspace.',
  },
  {
    icon: <SwapIcon />,
    title: 'Real-time transactions',
    text: 'Deposits, withdrawals and transfers post instantly, with a full audit trail.',
  },
  {
    icon: <UsersIcon />,
    title: 'Customer profiles',
    text: 'Keep every customer’s details, accounts and history together in a single view.',
  },
  {
    icon: <ChartIcon />,
    title: 'Reports at a glance',
    text: 'Daily activity, balances and trends — ready when you start your day.',
  },
  {
    icon: <KeyIcon />,
    title: 'Role-based access',
    text: 'Give tellers, managers and admins exactly the access their job needs.',
  },
  {
    icon: <HeadsetIcon />,
    title: 'Support that responds',
    text: 'Reach the Northbank team when you need a hand, without leaving the workspace.',
  },
]

const stats = [
  { num: '$24.5M', cap: 'Total deposits' },
  { num: '18,492', cap: 'Active accounts' },
  { num: '1,284', cap: 'Transactions today' },
  { num: '99.99%', cap: 'Uptime' },
]

const roles = [
  { name: 'Teller', perms: ['Deposits', 'Withdrawals'] },
  { name: 'Branch manager', perms: ['Approvals', 'Reports'] },
  { name: 'Compliance', perms: ['Audit log', 'Reviews'] },
  { name: 'Administrator', perms: ['Users', 'Settings'] },
]

export default function Landing() {
  return (
    <div className="lp">
      {/* ---------- Hero ---------- */}
      <header className="lp-hero">
        <nav className="lp-nav">
          <Link to="/" className="lp-logo">
            <span className="lp-logo__name">northbank</span>
            <span className="lp-logo__sub">Banking workspace</span>
          </Link>

          <div className="lp-nav__links">
            <a href="#features">Features</a>
            <a href="#security">Security</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="lp-nav__actions">
            <Link to="/login" className="lp-nav__signin">
              Sign in
            </Link>
            <Link to="/signup" className="lp-btn lp-btn--light">
              Get started
            </Link>
          </div>
        </nav>

        <div className="lp-hero__body">
          <span className="lp-pill">Your secure workspace</span>
          <h1 className="lp-headline">
            <span>Your bank.</span>
            <span>All in one place.</span>
          </h1>
          <p className="lp-lead">
            A clearer view of your operations. A simpler way to serve your customers — accounts,
            transactions and people, thoughtfully connected.
          </p>
          <div className="lp-hero__cta">
            <Link to="/signup" className="lp-btn lp-btn--primary">
              Create an account
              <ArrowRightIcon />
            </Link>
            <Link to="/login" className="lp-btn lp-btn--ghost">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Stats strip ---------- */}
      <section className="lp-stats" aria-label="Northbank at a glance">
        {stats.map((s, i) => (
          <div className="lp-stat" key={s.cap}>
            <div className="lp-stat__num">
              {s.num}
              {i === 0 && (
                <span className="lp-stat__badge">
                  <TrendUpIcon /> 8.2%
                </span>
              )}
            </div>
            <div className="lp-stat__cap">{s.cap}</div>
          </div>
        ))}
      </section>

      {/* ---------- Features ---------- */}
      <section className="lp-section" id="features">
        <div className="lp-eyebrow">What you can do</div>
        <h2 className="lp-title">Everything your team needs, connected</h2>
        <p className="lp-sub">
          One workspace for the day-to-day of running a bank, designed to stay out of your way.
        </p>

        <div className="lp-grid">
          {features.map((f) => (
            <article className="lp-card" key={f.title}>
              <span className="lp-card__icon">{f.icon}</span>
              <h3 className="lp-card__title">{f.title}</h3>
              <p className="lp-card__text">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Security ---------- */}
      <section className="lp-section lp-section--tint" id="security">
        <div className="lp-split">
          <div>
            <div className="lp-eyebrow">Security</div>
            <h2 className="lp-title lp-title--left">A secure space for your team</h2>
            <p className="lp-sub lp-sub--left">
              Every action is tied to a person and a role, so you always know who did what.
            </p>
            <ul className="lp-checks">
              {['Role-based access for every team member', 'Complete audit trail on each transaction', 'Encrypted sessions and protected credentials'].map(
                (t) => (
                  <li key={t}>
                    <span className="lp-checks__tick">
                      <CheckIcon />
                    </span>
                    {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="lp-roles">
            <div className="lp-roles__head">
              <ShieldCheckIcon size={18} />
              <div>
                <div className="lp-roles__title">Access roles</div>
                <div className="lp-roles__sub">Built around your operations.</div>
              </div>
            </div>
            {roles.map((r) => (
              <div className="lp-roles__row" key={r.name}>
                <span className="lp-roles__name">{r.name}</span>
                <span className="lp-roles__perms">
                  {r.perms.map((p) => (
                    <span className="lp-chip" key={p}>
                      {p}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="lp-cta">
        <h2>Ready to see your bank clearly?</h2>
        <p>Create your workspace in minutes, or sign in to pick up where you left off.</p>
        <div className="lp-hero__cta lp-hero__cta--center">
          <Link to="/signup" className="lp-btn lp-btn--light">
            Create an account
            <ArrowRightIcon />
          </Link>
          <Link to="/login" className="lp-btn lp-btn--ghost">
            Sign in
          </Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer" id="contact">
        <div className="lp-footer__brand">
          <a
            href="#top"
            className="lp-logo__name"
            aria-label="Back to top"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            northbank
          </a>
          <span>Banking, thoughtfully connected.</span>
        </div>
        <div className="lp-footer__links">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#support">Contact support</a>
        </div>
        <div className="lp-footer__copy">© 2026 Northbank</div>
      </footer>
    </div>
  )
}
