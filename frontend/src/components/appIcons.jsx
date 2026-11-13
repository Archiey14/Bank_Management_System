const Icon = ({ children, size = 18 }) => (
  <svg
    width={size}
    height={size}
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

export const GridIcon = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </Icon>
)

export const WalletIcon = () => (
  <Icon>
    <path d="M3 7a2 2 0 012-2h13v4" />
    <path d="M3 7v11a2 2 0 002 2h15a1 1 0 001-1V10a1 1 0 00-1-1H5a2 2 0 01-2-2z" />
    <circle cx="16.5" cy="14.5" r="1.2" />
  </Icon>
)

export const SwapIcon = () => (
  <Icon>
    <path d="M4 8h14M14 4l4 4-4 4" />
    <path d="M20 16H6M10 12l-4 4 4 4" />
  </Icon>
)

export const ListIcon = () => (
  <Icon>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </Icon>
)

export const ChartIcon = () => (
  <Icon>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Icon>
)

export const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 5.2a3.2 3.2 0 010 5.6M18 14.4c2 .7 3 2.6 3 5.6" />
  </Icon>
)

export const CogIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
  </Icon>
)

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const ReceiptIcon = () => (
  <Icon>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
)

export const FileIcon = () => (
  <Icon>
    <path d="M7 3h7l5 5v13H7V3z" />
    <path d="M14 3v5h5M10 13h6M10 17h4" />
  </Icon>
)

export const LogoutIcon = () => (
  <Icon size={16}>
    <path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4" />
    <path d="M16 8l4 4-4 4M20 12H9" />
  </Icon>
)

export const ArrowDownIcon = () => (
  <Icon size={14}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)

export const ArrowUpIcon = () => (
  <Icon size={14}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

export { TrendUpIcon, CheckIcon, ArrowRightIcon } from './icons'
