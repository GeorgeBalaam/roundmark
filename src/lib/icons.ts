/**
 * Roundmark iconography.
 * ---------------------------------------------------------------------------
 * One icon library: `lucide-react`. No emoji as structural icons. Import named
 * concepts from here so the same idea always renders the same glyph; this keeps
 * the set uniform and prevents two screens picking different icons for one thing.
 *
 * SIZE — pass the `size` prop using one of the constants below (px). Icons
 * inherit `currentColor`, so set colour via the parent's text colour (or a
 * `style={{ color: … }}` for accents like medals/side-comps).
 *
 *   ICON_SM (16)  Inline with text, nav items, badges, buttons, table rows.
 *   ICON_MD (20)  Card/section headers, emphasised rows.
 *   ICON_LG (28)  Feature tiles, stat glyphs.
 *   ICON_XL (44)  Empty-state illustrations, hero.
 */

export const ICON_SM = 16;
export const ICON_MD = 20;
export const ICON_LG = 28;
export const ICON_XL = 44;

export {
  // Primary navigation / domain
  Flag as EventIcon, // golf day / events
  Trophy as TrophyIcon, // history, winners
  User as PlayerIcon, // my scores / a player
  Users as TeamsIcon, // teams / players group
  Settings as SettingsIcon,
  LogOut as SignOutIcon,
  Link as LinkIcon, // QR / scoring links
  Handshake as SponsorIcon,
  ClipboardList as RegistrationIcon, // sign-ups

  // Status / feedback
  Lock as LockIcon,
  Mail as MailIcon,
  CheckCircle2 as SuccessIcon, // big success tick (confirmation screens)
  Check as CheckIcon, // inline tick (saved, done, feature list)
  Circle as TodoIcon, // not-done checklist marker
  Radio as GoLiveIcon, // publish / go live

  // Actions
  Plus as AddIcon,
  Printer as PrintIcon,
  Download as DownloadIcon,
  Scale as BalanceIcon, // auto-balance teams
  Play as ResumeIcon,
  Pause as PauseIcon,
  X as CloseIcon, // remove / dismiss

  // Chevrons / arrows
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  ChevronUp as MoveUpIcon,
  ChevronDown as MoveDownIcon,
  ChevronDown as DisclosureIcon, // expand/collapse a menu

  // Results / side competitions
  Medal as MedalIcon, // podium places (colour by rank)
  Target as NearestPinIcon,
  Rocket as LongestDriveIcon,

  // Marketing feature tiles
  ClipboardList as SetupIcon,
  Smartphone as MobileIcon,
  BarChart3 as LeaderboardIcon,
  ShieldCheck as SecureIcon,

  // Event-page builder: block-type glyphs
  Type as TextBlockIcon,
  Image as ImageBlockIcon,
  Columns2 as FeatureBlockIcon, // text beside an image
  MousePointerClick as ButtonBlockIcon, // CTA
  Video as VideoBlockIcon,
  MapPin as MapPinIcon, // venue
  Clock as ScheduleBlockIcon,
  HelpCircle as FaqBlockIcon,

  // Event-page builder: preview device toggle + block actions
  Monitor as DesktopIcon, // mobile uses MobileIcon above
  Copy as DuplicateIcon,
  ExternalLink as OpenExternalIcon, // open the real page in a new tab

  // Multi-organiser / access
  UserPlus as InviteIcon,
  Crown as OwnerIcon,
} from 'lucide-react';
