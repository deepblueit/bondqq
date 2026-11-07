// Fixed facts: the midterm timetable (Cairo time, UTC+2 in November 2026).
export const APP_VERSION = '1.0.0';
export const STUDENT = 'وسام';
export const HELPER = 'يوسف';

export const SUBJECTS = [
  { id: 'eis', title: 'أنظمة معلومات المؤسسات', short: 'أنظمة المؤسسات', doctor: 'د. محمد وجدي',
    start: '2026-11-09T12:00:00+02:00', end: '2026-11-09T13:00:00+02:00', color: '#5B5BD6', soft: '#ECECFD', icon: 'layers' },
  { id: 'pf', title: 'مبادئ المالية العامة', short: 'المالية العامة', doctor: 'أ.م.د. أحمد حسين',
    start: '2026-11-10T12:00:00+02:00', end: '2026-11-10T13:00:00+02:00', color: '#0E9F6E', soft: '#E3F6EE', icon: 'coins' },
  { id: 'iti', title: 'تكنولوجيا المعلومات والابتكار', short: 'التكنولوجيا والابتكار', doctor: 'د. إبراهيم سيد',
    start: '2026-11-12T12:00:00+02:00', end: '2026-11-12T13:00:00+02:00', color: '#F08A24', soft: '#FDF0E2', icon: 'lightbulb' },
  { id: 'risk', title: 'إدارة مخاطر وأمن تكنولوجيا المعلومات', short: 'المخاطر والأمن', doctor: 'د. محمد وجدي',
    start: '2026-11-16T12:00:00+02:00', end: '2026-11-16T13:00:00+02:00', color: '#E5484D', soft: '#FCE8E9', icon: 'target' },
  { id: 'stats', title: 'الإحصاء التطبيقي', short: 'الإحصاء', doctor: 'د. أسماء',
    start: '2026-11-17T12:00:00+02:00', end: '2026-11-17T13:00:00+02:00', color: '#0B8FC7', soft: '#E1F2FA', icon: 'dice-5' },
  { id: 'eb', title: 'الأعمال الإلكترونية', short: 'الأعمال الإلكترونية', doctor: 'د. محمد عبد الله',
    start: '2026-11-19T12:00:00+02:00', end: '2026-11-19T13:00:00+02:00', color: '#8B5CF6', soft: '#F0EAFE', icon: 'compass' },
].map((s, i) => ({ ...s, order: i, startTs: Date.parse(s.start), endTs: Date.parse(s.end) }));

export const SUBJECT = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));

export const DEFAULT_SETTINGS = {
  mode: 'solo',            // 'solo' | 'together'
  theme: 'auto',           // 'auto' | 'light' | 'dark'
  font: 1,                 // font scale
  wake: '08:00',
  sleep: '00:30',
  wakeExam: '07:30',
  sleepBeforeExam: '23:30',
  leave: '10:45',          // leave home on exam days
  restUntil: '15:00',      // rest + lunch after exam until
  lunch: '15:00',          // 45 min
  dinner: '20:30',         // 30 min
  dailyCap: 8,             // max hours of regular study per day (exam days: 5)
  work: { enabled: false, days: [0, 1, 2, 3, 4], from: '09:00', to: '17:00', offOnExamDays: true },
  onboarded: false,
};

export const TYPE_LABEL = {
  essay: 'مقالي', explain: 'اشرحي', define: 'تعريف', compare: 'قارني', list: 'اذكري',
  reason: 'علل', mcq: 'اختيار', tf: 'صح وغلط', problem: 'مسألة',
};
export const PRIORITY_LABEL = { 1: 'أساسي', 2: 'مهم', 3: 'لو فيه وقت' };
export const CONF_LABEL = {
  high: 'من محاضراتك وصورك مباشرة',
  medium: 'مبني على فهرس الكتاب والمنهج المعتاد، قارني العناوين بالكتاب',
  low: 'احتياطي: مش أكيد إنه في الميدترم',
};
