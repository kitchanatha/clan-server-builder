// Bot-facing messages in Thai and English. Placeholders: {name}.
import type { Lang } from './catalog.js';

const STRINGS = {
  welcomeTitle: { th: 'ยินดีต้อนรับสู่ {guild}', en: 'Welcome to {guild}' },
  welcomeBody: {
    th: 'อ่านกฎใน {rules} แล้วกด **ลงทะเบียน** กรอกชื่อในเกม บอทจะตั้งชื่อเล่นให้และเปิดเซิร์ฟให้คุณ\nการลงทะเบียนถือว่ายอมรับกฎ',
    en: 'Read the rules in {rules}, then press **Register** and enter your in-game name. The bot sets your nickname and unlocks the server.\nRegistering means you accept the rules.',
  },
  registerButton: { th: 'ลงทะเบียน', en: 'Register' },
  registerTitle: { th: 'ลงทะเบียน', en: 'Register' },
  registered: { th: 'ลงทะเบียนแล้ว ชื่อของคุณคือ **{nick}**', en: 'You are registered as **{nick}**.' },
  nickFailed: {
    th: 'ลงทะเบียนแล้ว แต่บอทเปลี่ยนชื่อเล่นของคุณไม่ได้ (เจ้าของเซิร์ฟหรือยศสูงกว่าบอท) กรุณาตั้งชื่อเป็น **{nick}** เอง',
    en: 'Registered, but the bot could not change your nickname (server owner or a role above the bot). Please set it to **{nick}** yourself.',
  },
  invalidIgn: { th: 'ชื่อในเกมต้องยาว 2–32 ตัวอักษร', en: 'In-game name must be 2–32 characters.' },
  joinGreeting: {
    th: 'ยินดีต้อนรับ {user} สู่ **{guild}**! ไปลงทะเบียนที่ {welcome} ได้เลย (สมาชิกคนที่ {count})',
    en: 'Welcome {user} to **{guild}**! Register in {welcome} to get started. (member #{count})',
  },
  goodbyeDefault: { th: '**{name}** ออกจากเซิร์ฟแล้ว', en: '**{name}** has left the server.' },
  pickRolesTitle: { th: 'เลือกบทบาทของคุณ', en: 'Pick your roles' },
  pickRolesBody: {
    th: 'เลือกอาชีพและการแจ้งเตือนที่อยากได้ เปลี่ยนได้ตลอด',
    en: 'Choose your class and the alerts you want. You can change them any time.',
  },
  pickClassPlaceholder: { th: 'เลือกอาชีพ', en: 'Choose your class' },
  pickPingPlaceholder: { th: 'เลือกการแจ้งเตือน', en: 'Choose alerts' },
  rolesUpdated: { th: 'อัปเดตบทบาทแล้ว', en: 'Roles updated.' },
  rankSet: { th: 'ตั้งยศ {user} เป็น **{rank}** แล้ว', en: 'Set {user} to **{rank}**.' },
  rankRemoved: { th: 'ลบยศของ {user} แล้ว', en: 'Removed rank from {user}.' },
  leaderOnly: { th: 'เฉพาะ Leader เท่านั้นที่ตั้งยศนี้ได้', en: 'Only Leaders can give this rank.' },
  cannotTargetSelf: { th: 'เปลี่ยนยศตัวเองไม่ได้', en: 'You cannot change your own rank.' },
  roleTooHigh: {
    th: 'บอทจัดการบทบาทนี้ไม่ได้ ลากบทบาทของบอทให้อยู่สูงกว่าใน Server Settings → Roles',
    en: 'The bot cannot manage this role. Drag the bot role higher in Server Settings → Roles.',
  },
  acceptRules: { th: 'ยอมรับกฎ', en: 'I accept the rules' },
  acceptedRules: { th: 'เรียบร้อย! ตอนนี้คุณเข้าใช้งานเซิร์ฟได้แล้ว', en: 'Done! You can now use the server.' },
  alreadyAccepted: { th: 'คุณยอมรับกฎไปแล้ว', en: 'You already accepted the rules.' },
  memberJoined: { th: '{user} เข้ามาในเซิร์ฟแล้ว ยินดีต้อนรับ!', en: '{user} just joined. Welcome!' },
  rulesTitle: { th: 'กฎของกิลด์', en: 'Guild rules' },
  announcementsIntro: { th: 'ประกาศจากทีมงานจะอยู่ที่นี่', en: 'Staff announcements go here.' },

  applyTitle: { th: 'สมัครเข้ากิลด์', en: 'Join the guild' },
  applyBody: {
    th: 'กดปุ่ม **สมัคร** แล้วเลือกอาชีพ จากนั้นกรอกข้อมูล ทีมงานจะตอบกลับเร็วๆ นี้',
    en: 'Press **Apply**, pick your class and fill in the form. Officers will reply soon.',
  },
  applyButton: { th: 'สมัคร', en: 'Apply' },
  pickClass: { th: 'เลือกอาชีพของคุณ', en: 'Pick your class' },
  formTitle: { th: 'ใบสมัคร', en: 'Application' },
  fieldIgn: { th: 'ชื่อในเกม', en: 'In-game name' },
  fieldPower: { th: 'พลังรบ (ตัวเลข)', en: 'Combat power (number)' },
  fieldPlaytime: { th: 'เล่นช่วงเวลาไหนบ้าง', en: 'When do you usually play?' },
  fieldNote: { th: 'อยากบอกอะไรเพิ่มไหม', en: 'Anything else?' },
  applied: { th: 'ส่งใบสมัครแล้ว ทีมงานจะแจ้งผลทาง DM', en: 'Application sent. Officers will DM you the result.' },
  alreadyPending: { th: 'คุณมีใบสมัครที่รอพิจารณาอยู่แล้ว', en: 'You already have an application waiting for review.' },
  alreadyMember: { th: 'คุณเป็นสมาชิกกิลด์อยู่แล้ว', en: 'You are already a guild member.' },
  newApplication: { th: 'ใบสมัครใหม่', en: 'New application' },
  approve: { th: 'รับเข้ากิลด์', en: 'Approve' },
  reject: { th: 'ปฏิเสธ', en: 'Reject' },
  approvedBy: { th: 'รับเข้าโดย {user}', en: 'Approved by {user}' },
  rejectedBy: { th: 'ปฏิเสธโดย {user}', en: 'Rejected by {user}' },
  dmApproved: { th: 'ใบสมัครเข้า {guild} ผ่านแล้ว ยินดีต้อนรับ!', en: 'Your application to {guild} was approved. Welcome!' },
  dmRejected: { th: 'ใบสมัครเข้า {guild} ไม่ผ่านในครั้งนี้', en: 'Your application to {guild} was not accepted this time.' },
  staffOnly: { th: 'คำสั่งนี้ใช้ได้เฉพาะ Officer และ Leader', en: 'Only Officers and Leaders can do this.' },
  alreadyReviewed: { th: 'ใบสมัครนี้ถูกพิจารณาไปแล้ว', en: 'This application was already reviewed.' },
  invalidPower: { th: 'พลังรบต้องเป็นตัวเลข', en: 'Combat power must be a number.' },

  rosterTitle: { th: 'รายชื่อสมาชิก ({count} คน)', en: 'Roster ({count} members)' },
  rosterEmpty: { th: 'ยังไม่มีสมาชิกในรายชื่อ', en: 'No one in the roster yet.' },
  rosterMore: { th: '...และอีก {count} คน', en: '...and {count} more' },
  profileSaved: { th: 'บันทึกโปรไฟล์แล้ว', en: 'Profile saved.' },
  notInRoster: { th: 'คุณยังไม่อยู่ในรายชื่อ ใช้ /profile เพื่อเพิ่ม', en: 'You are not in the roster yet. Use /profile to add yourself.' },
  removedFromRoster: { th: 'ลบ {user} ออกจากรายชื่อแล้ว', en: 'Removed {user} from the roster.' },
  exportReady: { th: 'ไฟล์รายชื่อสมาชิก', en: 'Roster export' },
  featureOff: { th: 'ฟีเจอร์นี้ยังไม่ได้เปิดในเซิร์ฟนี้', en: 'This feature is not turned on for this server.' },
  notSetUp: { th: 'เซิร์ฟนี้ยังไม่ได้ตั้งค่าบนเว็บไซต์', en: 'This server has not been set up on the dashboard yet.' },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof STRINGS;

export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  let s: string = STRINGS[key][lang];
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
