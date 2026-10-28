// The feature catalog and game presets shown on the dashboard and used by the bot.
// Everything user-facing has Thai and English text.

export type Lang = 'th' | 'en';
export type Localized = Record<Lang, string>;

export type GameId = 'aion2' | 'rotnw' | 'any';

export interface GamePreset {
  id: GameId;
  name: string;
  tagline: Localized;
  /** Class / job names offered in applications and the roster. */
  classes: string[];
}

export const GAMES: readonly GamePreset[] = [
  {
    id: 'aion2',
    name: 'Aion 2 (Global)',
    tagline: { th: 'กิลด์ Legion / ไซจ์ป้อม', en: 'Legions and fortress sieges' },
    classes: ['Gladiator', 'Templar', 'Ranger', 'Assassin', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter'],
  },
  {
    id: 'rotnw',
    name: 'Ragnarok The New World',
    tagline: { th: 'กิลด์ / WoE', en: 'Guilds and WoE' },
    classes: ['Swordsman', 'Mage', 'Archer', 'Acolyte', 'Merchant', 'Thief'],
  },
  {
    id: 'any',
    name: 'Any MMO',
    tagline: { th: 'เกมไหนก็ได้ที่มีกิลด์', en: 'Any guild-based game' },
    classes: ['Tank', 'Healer', 'DPS', 'Support'],
  },
];

export type FeatureId =
  | 'base'
  | 'welcome'
  | 'goodbye'
  | 'roles'
  | 'recruit'
  | 'roster'
  | 'events'
  | 'attendance'
  | 'tickets'
  | 'dkp';

export type Tier = 'core' | 'free' | 'premium';

export interface Feature {
  id: FeatureId;
  tier: Tier;
  /** Always on and cannot be turned off. */
  locked?: boolean;
  /** Shipped in this build. Unavailable features show as "coming soon". */
  available: boolean;
  name: Localized;
  description: Localized;
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'base', tier: 'core', locked: true, available: true,
    name: { th: 'ผังเซิร์ฟพื้นฐาน', en: 'Base layout' },
    description: { th: 'ห้องประกาศ กฎ แชททั่วไป ห้องเสียง และบทบาทหลัก', en: 'Announcements, rules, chat, voice and the main roles' },
  },
  {
    id: 'welcome', tier: 'free', available: true,
    name: { th: 'ต้อนรับ + ลงทะเบียน', en: 'Welcome + register' },
    description: {
      th: 'ข้อความต้อนรับ สมาชิกใหม่กรอกชื่อในเกม บอทตั้งชื่อเล่นให้อัตโนมัติ',
      en: 'Welcome message; new members enter their in-game name and the bot sets their nickname',
    },
  },
  {
    id: 'goodbye', tier: 'free', available: true,
    name: { th: 'ข้อความลาก่อน', en: 'Goodbye messages' },
    description: { th: 'แจ้งเมื่อมีคนออกจากเซิร์ฟ', en: 'Post a message when someone leaves the server' },
  },
  {
    id: 'roles', tier: 'free', available: true,
    name: { th: 'จัดการบทบาท', en: 'Role management' },
    description: {
      th: 'สมาชิกเลือกบทบาทอาชีพและการแจ้งเตือนเอง ออฟฟิสเซอร์เลื่อนยศด้วย /rank',
      en: 'Members pick class and alert roles; officers promote with /rank',
    },
  },
  {
    id: 'recruit', tier: 'free', available: true,
    name: { th: 'รับสมัครสมาชิก', en: 'Recruitment' },
    description: { th: 'ฟอร์มสมัคร ออฟฟิสเซอร์กดรับหรือปฏิเสธ', en: 'Application form, officers approve or reject' },
  },
  {
    id: 'roster', tier: 'free', available: true,
    name: { th: 'รายชื่อสมาชิก', en: 'Roster' },
    description: { th: 'ชื่อในเกม อาชีพ พลังรบ ส่งออก CSV ได้', en: 'In-game name, class, power; export to CSV' },
  },
  {
    id: 'events', tier: 'premium', available: false,
    name: { th: 'ลงชื่อเรด / วอร์', en: 'Raid / war sign-ups' },
    description: { th: 'สร้างอีเวนต์ กดเข้าร่วมตามตำแหน่ง แจ้งเตือนก่อนเริ่ม', en: 'Create events, join by role, reminders before start' },
  },
  {
    id: 'attendance', tier: 'premium', available: false,
    name: { th: 'เช็กชื่อ + แต้ม', en: 'Attendance + points' },
    description: { th: 'บันทึกคนมาวอร์ ให้แต้ม ดูอันดับ', en: 'Track who showed up, award points, leaderboard' },
  },
  {
    id: 'tickets', tier: 'free', available: false,
    name: { th: 'ทิกเก็ตแจ้งปัญหา', en: 'Support tickets' },
    description: { th: 'สมาชิกเปิดห้องคุยส่วนตัวกับทีมงาน', en: 'Members open a private channel with staff' },
  },
  {
    id: 'dkp', tier: 'premium', available: false,
    name: { th: 'ประมูลของ DKP', en: 'DKP loot bidding' },
    description: { th: 'ใช้แต้มประมูลไอเทม พร้อมประวัติ', en: 'Bid on items with points, with history' },
  },
];

export const DEFAULT_FEATURES: FeatureId[] = ['base', 'welcome', 'goodbye', 'roles', 'recruit', 'roster'];

/** Starting points on the dashboard. Picking one sets the feature list; everything stays editable. */
export interface Template {
  id: 'member' | 'recruiting' | 'full';
  name: Localized;
  description: Localized;
  features: FeatureId[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'member',
    name: { th: 'จัดการสมาชิก', en: 'Member management' },
    description: {
      th: 'ต้อนรับ ลงทะเบียนชื่อในเกม ลาก่อน และบทบาท',
      en: 'Welcome, IGN registration, goodbye and roles',
    },
    features: ['base', 'welcome', 'goodbye', 'roles'],
  },
  {
    id: 'recruiting',
    name: { th: 'กิลด์รับสมาชิก', en: 'Recruiting guild' },
    description: { th: 'จัดการสมาชิก + ใบสมัครและรายชื่อ', en: 'Member management plus applications and roster' },
    features: ['base', 'welcome', 'goodbye', 'roles', 'recruit', 'roster'],
  },
  {
    id: 'full',
    name: { th: 'ครบทุกอย่าง', en: 'Everything' },
    description: { th: 'ทุกฟีเจอร์ที่เปิดให้ใช้ตอนนี้', en: 'Every feature available now' },
    features: ['base', 'welcome', 'goodbye', 'roles', 'recruit', 'roster', 'events', 'attendance', 'tickets'],
  },
];

export function getGame(id: GameId): GamePreset {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown game: ${id}`);
  return g;
}

export function getFeature(id: FeatureId): Feature {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown feature: ${id}`);
  return f;
}
