function riyadhDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function hash(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

const BANKS = {
  safety: {
    ar: [
      "وش أخطر عادة صارت عادية في موقعكم، وكيف نوقفها اليوم؟",
      "لو صار تنبيه السلامة أوضح، أي موقف كان بيتغير هذا الأسبوع؟",
      "وين يتأخر تصريح العمل، وكيف نختصره بدون ما نضعف الحماية؟",
      "وش المعدّة اللي تحتاج فحص أذكى قبل ما يبدأ الشفت؟",
      "كيف نخلّي الملاحظة القريبة من الخطر توصل للمشرف خلال دقائق؟",
      "أي منطقة في الموقع تحتاج مسار مشاة أوضح؟",
      "وش التدريب القصير اللي ينقص الفريق قبل شغل هذا الأسبوع؟",
      "لو كل شخص وقف شغل زميله لحظة الخطر، وش اللي يمنعه اليوم؟",
    ],
    en: [
      "Which risky habit became normal on your site, and how do we stop it today?",
      "If a safety warning were clearer, which moment this week would change?",
      "Where does a work permit get delayed, and how do we shorten it without weakening protection?",
      "Which tool needs a smarter check before the shift starts?",
      "How can a near-miss reach the supervisor within minutes?",
      "Which area needs a clearer walkway?",
      "What short training is missing before this week's job?",
      "If anyone could stop a job at the first sign of danger, what gets in the way today?",
    ],
  },
  site: {
    ar: [
      "وش الخطوة في الموقع تتكرر كل يوم وتقدر تصير أسرع؟",
      "وين يضيع وقت الطاقم بين الانتظار والمعدة؟",
      "كيف نرتب تسليم الشفت بحيث ما تضيع معلومة مهمة؟",
      "أي جزء من المخطط ما يطابق الواقع، ووش التعديل البسيط؟",
      "وش الخامة اللي توصل متأخرة وتعطل يومكم؟",
      "لو رفعت صورة واحدة من الموقع كل صباح، وش بتوضح للإدارة؟",
      "وين نقدر نختصر مشوار بين منطقة الشغل والمخزن؟",
      "وش الفكرة اللي تخلي يوم المطر أو الغبار أأمن للفريق؟",
    ],
    en: [
      "Which site step repeats every day and could be faster?",
      "Where does the crew lose time waiting on equipment?",
      "How should shift handover keep the important detail from getting lost?",
      "Which part of the drawing does not match the ground, and what is the small fix?",
      "Which material arrives late and stalls the day?",
      "If one morning photo went to the office, what would it explain?",
      "Where can we shorten the walk between the work area and the store?",
      "What idea makes a dusty or rainy day safer for the crew?",
    ],
  },
  move: {
    ar: [
      "أي شحنة تتأخر لأن معلومتها ناقصة، وكيف نكملها من أول مرة؟",
      "وين تتكدس المواد، ووش الترتيب اللي يخليها تطلع أسرع؟",
      "كيف نعرف موقع المعدة الثقيلة بدون اتصالات زايدة؟",
      "وش الرحلة المتكررة اللي نقدر نجمعها في مشوار واحد؟",
      "أي مستند يوقف البوابة، وكيف نجهزه قبل وصول السائق؟",
      "لو السائق وصل والتعليمات واضحة، وش اللي ناقص اليوم؟",
      "وين نضيع وقت التحميل، وما التغيير الصغير؟",
      "كيف نرجّع العهدة لمكانها قبل نهاية الشفت؟",
    ],
    en: [
      "Which delivery is late because its information is incomplete?",
      "Where do materials pile up, and what layout would move them faster?",
      "How can we know where a heavy machine is without extra calls?",
      "Which repeated trip could become one journey?",
      "Which paper stops the gate, and how do we prepare it before the driver arrives?",
      "If the driver arrives and the instructions are clear, what is still missing?",
      "Where does loading waste time, and what is the small change?",
      "How do we return borrowed gear before the shift ends?",
    ],
  },
  quality: {
    ar: [
      "أي فحص يتأخر لأن النموذج طويل، وكيف نختصره؟",
      "وش العيب اللي يتكرر، ووين نمسكه أبكر؟",
      "كيف نخلّي صورة الفحص أوضح من الوصف المكتوب؟",
      "أي معيار يلتبس على الفريق، ووش المثال اللي يوضحه؟",
      "وين نعيد الشغل لأن التسليم الأول ناقص؟",
      "وش قائمة تحقق من خمس نقاط تمنع خطأ هذا الأسبوع؟",
      "كيف نوصل ملاحظة الجودة لمن ينفذ، مو بس لمن يراجع؟",
      "أي عينة نقدر نفحصها في الموقع بدل ما تنتظر المكتب؟",
    ],
    en: [
      "Which inspection is slow because the form is long?",
      "Which defect keeps returning, and where can we catch it earlier?",
      "How can a photo explain a check better than a written note?",
      "Which standard confuses the crew, and what example would clarify it?",
      "Where do we redo work because the first handover was incomplete?",
      "What five-point checklist would prevent this week's mistake?",
      "How does a quality note reach the person doing the work, not only the reviewer?",
      "Which sample can be checked on site instead of waiting for the office?",
    ],
  },
  build: {
    ar: [
      "وش التفصيل في الرسمة يسبب أسئلة متكررة في الورشة؟",
      "أي قطعة نقدر نجهّزها قبل ما يجي دورها؟",
      "وين يختلف القياس بين المخطط والتنفيذ، وكيف نثبّته؟",
      "وش الأداة الناقصة اللي توقف شغل أكثر من شخص؟",
      "كيف نشارك درس لحام أو تجميع مع الشفت الثاني؟",
      "أي خطوة في التصنيع نقدر نأمّنها بجهاز بسيط؟",
      "وش التعديل الصغير على قطعة يوفّر إعادة شغل؟",
      "لو المهندس وقف عشر دقائق مع الفنّي، وش السؤال الأهم؟",
    ],
    en: [
      "Which drawing detail causes the same question in the workshop?",
      "Which piece can be prepared before its turn arrives?",
      "Where do the drawing and the build disagree, and how do we lock the measurement?",
      "Which missing tool stops more than one person?",
      "How do we pass a welding or assembly lesson to the next shift?",
      "Which fabrication step could be made safer with a simple jig?",
      "What small change to a piece would avoid rework?",
      "If an engineer spent ten minutes with a technician, what is the most useful question?",
    ],
  },
  people: {
    ar: [
      "وش اللي يخلّي الموظف الجديد يضيع في أول أسبوع، وكيف نختصره؟",
      "أي طلب داخلي يتأخر، ووين نعطي الموظف حالة واضحة؟",
      "كيف نخلّي الشكر على شغل زين يوصل لصاحبه بسرعة؟",
      "وش المهارة اللي القسم يحتاجها هذا الشهر وما لقينا لها تدريب قريب؟",
      "وين إجراء الطبي أو الإجازة غير واضح للموظف؟",
      "كيف نعرف ضغط الشفت قبل ما يتحول لإرهاق؟",
      "أي معلومة في التوظيف تتكرر أسئلتها، ونقدر ننشرها مرة واحدة؟",
      "وش الفكرة اللي تخلي اجتماع القسم أقصر وأنفع؟",
    ],
    en: [
      "What makes a new employee lost in week one, and how do we shorten that?",
      "Which internal request is slow, and where can we show a clear status?",
      "How can thanks for good work reach the person quickly?",
      "Which skill does the department need this month without nearby training?",
      "Where is a medical or leave step unclear?",
      "How do we notice shift pressure before it becomes exhaustion?",
      "Which hiring question is repeated and could be answered once?",
      "What would make the department meeting shorter and more useful?",
    ],
  },
  cost: {
    ar: [
      "أي طلب شراء يرجع لأن الوصف ناقص؟",
      "وين ندفع مرتين لنفس الغرض بسبب ضعف التنسيق؟",
      "وش الفاتورة أو العهدة اللي صعب تتبعها اليوم؟",
      "كيف نعرف البديل الأرخص قبل ما يطول الطلب؟",
      "أي بند في الميزانية يفاجئ الفريق آخر الشهر؟",
      "وين نقدر نجمع طلبات صغيرة في طلب واحد أوضح؟",
      "وش الرقم اللي لو شافه مسؤول القسم أسبوعيًا غيّر قراره؟",
      "كيف نسرّع اعتماد المصروف بدون ما نضعف المراجعة؟",
    ],
    en: [
      "Which purchase request comes back because the description is thin?",
      "Where do we pay twice for the same need because teams are not aligned?",
      "Which invoice or advance is hard to trace today?",
      "How do we see a cheaper option before the request sits too long?",
      "Which budget line surprises the team at month end?",
      "Where can small requests become one clearer order?",
      "Which number, seen weekly by the department lead, would change a decision?",
      "How do we approve spend faster without weakening the review?",
    ],
  },
  systems: {
    ar: [
      "أي شاشة في النظام يكرر الموظف إدخالها كل يوم؟",
      "وين تنقطع المعلومة بين الإيميل والنظام والموقع؟",
      "وش التقرير اللي يتجهز يدوي ونقدر نطلعه جاهز؟",
      "أي تنبيه نظام يتجاهله الفريق لأنه كثير أو متأخر؟",
      "كيف نختصر دخول الموظف لمهمة واحدة بدل ثلاث شاشات؟",
      "وش العطل المتكرر اللي يحتاج حل جذري هذا الأسبوع؟",
      "لو صوّرنا خطوات مهمة معقدة، أي مهمة نبدأ فيها؟",
      "وين كلمة المرور أو الصلاحية توقف الشغل أكثر من اللازم؟",
    ],
    en: [
      "Which system screen makes someone type the same thing every day?",
      "Where does information break between email, the system, and the site?",
      "Which report is built by hand and could arrive ready?",
      "Which system alert is ignored because it is noisy or late?",
      "How do we open one task without crossing three screens?",
      "Which repeated outage needs a real fix this week?",
      "If we recorded one confusing task, which task should go first?",
      "Where do access rights stop work more than they should?",
    ],
  },
  office: {
    ar: [
      "أي قرار ينتظر توقيعًا، وكيف نوضّح ناقصه؟",
      "وش الاجتماع اللي يقدر يصير تحديث مكتوب؟",
      "وين تضيع متابعة بين الإدارة والقسم المنفّذ؟",
      "كيف نخلّي أولوية اليوم ظاهرة لكل القسم؟",
      "أي خدمة مكتبية يتأخر طالبها وما يعرف وين وصل طلبه؟",
      "وش العادة الإدارية اللي تقدر تصير نموذجًا قصيرًا؟",
      "لو الإدارة سمعت فكرة واحدة من الميدان اليوم، وش لازم تكون؟",
      "كيف نختصر سلسلة الإيميلات في موضوع واحد؟",
    ],
    en: [
      "Which decision is waiting on a signature, and how do we show what is missing?",
      "Which meeting could become a written update?",
      "Where does follow-up disappear between the office and the crew?",
      "How can today's priority be visible to the whole department?",
      "Which office service leaves the requester unsure of the status?",
      "Which admin habit could become a short form?",
      "If leadership heard one field idea today, what should it be?",
      "How do we collapse an email chain into one clear thread?",
    ],
  },
  plan: {
    ar: [
      "أي نشاط في الجدول يتأخر لأن الاعتماد الذي قبله ناقص؟",
      "وش المعلومة اللي لو وصلت مساءً تغيّر خطة بكرة؟",
      "وين الفرق بين التقدم المكتوب والتقدم الحقيقي في الموقع؟",
      "كيف نعرض خطر الجدول بلون واحد يفهمه غير المخطط؟",
      "أي مورد مشترك يوقف أكثر من نشاط، وكيف نرتبه؟",
      "وش التأخير الصغير هذا الأسبوع لو انمسك اليوم ما يكبر؟",
      "كيف نشارك تحديث الخطة مع المشرف بدون تقرير طويل؟",
      "أي تاريخ في البرنامج ما عاد واقعي، ووش البديل؟",
    ],
    en: [
      "Which schedule activity is late because the step before it is incomplete?",
      "What information, if it arrived tonight, would change tomorrow's plan?",
      "Where does reported progress differ from progress on the ground?",
      "How can a schedule risk be shown in one signal a non-planner understands?",
      "Which shared resource blocks more than one activity?",
      "Which small delay this week will grow if we do not catch it today?",
      "How do we share a plan update with a supervisor without a long report?",
      "Which program date is no longer realistic, and what replaces it?",
    ],
  },
  general: {
    ar: [
      "وش يضيّع وقت فريقك كل يوم، وما أصغر تغيير يرجّعه؟",
      "لو عندك ساعة زيادة هالأسبوع، وين تصرفها في الشغل؟",
      "وش المعلومة اللي تتأخر عن الشخص اللي يحتاجها؟",
      "أي شغل متكرر نقدر نختصره ونبقيه آمن؟",
      "وين تضيع مادة أو أداة بدون ما أحد يلاحظ بسرعة؟",
      "وش الفكرة الصغيرة اللي تخلي بكرة أسهل من اليوم؟",
      "لو زميلك الجديد سألك سؤال واحد، وش لازم نجهّز جوابه؟",
      "وش اللي يزعج العميل أو القسم الثاني وتقدرون تحلونه من عندكم؟",
    ],
    en: [
      "What wastes your team's time every day, and what is the smallest fix?",
      "If you had one extra hour this week, where would you spend it at work?",
      "Which update reaches the person who needs it too late?",
      "Which repeated job can be shorter and still safe?",
      "Where do material or tools disappear before anyone notices?",
      "What small idea would make tomorrow easier than today?",
      "If a new teammate asked one question, what answer should be ready?",
      "What bothers a client or another department that you could solve yourselves?",
    ],
  },
};

function themeOf(name) {
  const text = String(name || "").toLowerCase();
  if (/hse|safety/.test(text)) return "safety";
  if (/construct|jafurah/.test(text)) return "site";
  if (/logistic|warehouse|transport|bus|fleet/.test(text)) return "move";
  if (/quality/.test(text)) return "quality";
  if (/engineer|technical|fabricat/.test(text)) return "build";
  if (/hr|medical/.test(text)) return "people";
  if (/financ|procur|supply|sap/.test(text)) return "cost";
  if (/\bit\b|information/.test(text)) return "systems";
  if (/project control/.test(text)) return "plan";
  if (/facility|admin|ceo|corporate/.test(text)) return "office";
  return "general";
}

const EXTRA = {
  ar: [
    "لو تقدر تلغي خطوة وحدة من شغلك اليومي بدون ما يتأثر الناتج، وش تكون؟",
    "وش الشي اللي تسويه بطريقتك الخاصة وتتمنى الكل يعرفه؟",
    "لو صار عندنا زر واحد في التطبيق يحل مشكلة يومية، وش يسوي؟",
    "وش السؤال اللي ينسأل كل أسبوع وما له جواب مكتوب؟",
    "لو بتشكر قسم ثاني على شي يسهّل شغلك، وش هو وكيف نكبّره؟",
    "وش الهدر اللي تشوفه كل يوم وصار عادي عند الكل؟",
    "لو بديت شغلك من جديد اليوم، وش النصيحة اللي تتمنى أحد قالها لك؟",
    "وش أصغر تجربة نقدر نسويها هالأسبوع ونقيس نتيجتها؟",
    "أي ورقة أو نموذج نقدر نحوله لخطوة رقمية وحدة؟",
    "وش اللي يخلي الشفت الصباحي يسلّم للمسائي بدون أي لبس؟",
    "لو عندك ميزانية صغيرة لتحسين واحد في موقعك، وين تصرفها؟",
    "وش العادة الحلوة في فريقك اللي تستاهل تنتقل لكل الشركة؟",
    "وش الشي اللي يأخذ منك وقت انتظار أكثر من وقت شغل؟",
    "لو الزبون شاف يوم كامل من شغلكم، وش اللي بيبهره ووش اللي بيضايقه؟",
    "وش الفكرة اللي تخلي توفير الطاقة أو الماء عادة يومية في الموقع؟",
    "أي مشكلة صغيرة لو انحلت بترفع معنويات الفريق فوراً؟",
  ],
  en: [
    "If you could drop one step from your daily work without hurting the result, which would it be?",
    "What do you do your own way that you wish everyone knew?",
    "If the app had one button that solved a daily problem, what would it do?",
    "Which question comes up every week and still has no written answer?",
    "If you thanked another department for making your work easier, what would it be for, and how do we grow it?",
    "Which waste do you see every day that everyone now treats as normal?",
    "If you started your job again today, what advice do you wish someone had given you?",
    "What is the smallest experiment we could run this week and measure?",
    "Which paper or form could become one digital step?",
    "What would let the morning shift hand over to the evening shift with zero confusion?",
    "If you had a small budget for one improvement on your site, where would it go?",
    "Which good habit in your team deserves to spread across the company?",
    "What makes you spend more time waiting than working?",
    "If a client watched a full day of your work, what would impress them and what would bother them?",
    "What idea would make saving power or water a daily habit on site?",
    "Which small problem, once fixed, would lift the team's morale right away?",
  ],
};

const TOPICS = {
  transport: { re: /bus|transport|driver|باص|حافل|نقل|مواصلات|سائق/i, ar: "النقل والمواصلات", en: "transport" },
  food: { re: /food|meal|catering|أكل|وجب|طعام|مطعم|كافتير|إعاشة/i, ar: "الأكل والإعاشة", en: "food and catering" },
  housing: { re: /camp|room|accommodation|سكن|غرف|مخيم|كامب/i, ar: "السكن", en: "accommodation" },
  safety: { re: /safety|hse|ppe|سلام|خطر|إصاب|حادث/i, ar: "السلامة", en: "safety" },
  systems: { re: /system|app|login|network|wifi|internet|نظام|تطبيق|شبكة|انترنت|إنترنت/i, ar: "الأنظمة والتقنية", en: "systems and IT" },
  maintenance: { re: /maint|repair|air ?con|صيان|تكييف|عطل|خراب/i, ar: "الصيانة", en: "maintenance" },
  cleaning: { re: /clean|toilet|washroom|نظاف|حمام|دورات المياه/i, ar: "النظافة", en: "cleanliness" },
  pay: { re: /salary|payroll|allowance|راتب|رواتب|بدل|مستحق/i, ar: "الرواتب والمستحقات", en: "pay and allowances" },
};

function topicOf(text) {
  const value = String(text || "");
  return Object.keys(TOPICS).find((key) => TOPICS[key].re.test(value)) || "";
}

const TREND = {
  tag: {
    ar: [
      "الهاشتاق #{tag} صار حديث الشركة هالأسبوع — وش الفكرة اللي تحوّله لتحسين فعلي؟",
      "كثير من الزملاء يكتبون عن #{tag}. لو بيدك تغيير واحد فيه، وش يكون؟",
    ],
    en: [
      "#{tag} is what the company is talking about this week. What idea turns it into a real improvement?",
      "Many colleagues are posting about #{tag}. If you could change one thing about it, what would it be?",
    ],
  },
  topic: {
    ar: [
      "أكثر الملاحظات هالأسبوع عن {topic} — وش الحل البسيط اللي تقترحه؟",
      "{topic} يشغل بال الزملاء هالأسبوع. وش الفكرة اللي تعالجه من جذوره؟",
    ],
    en: [
      "Most feedback this week is about {topic}. What simple fix would you suggest?",
      "{topic} is on colleagues' minds this week. What idea would fix it at the root?",
    ],
  },
};

const REASON = { ar: "مستوحى من الرائج في الشركة هالأسبوع", en: "Inspired by what's trending at the company this week" };

function dayNumber(date) {
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) ? Math.floor(value / 86400000) : 0;
}

function poolFor(department) {
  const key = themeOf(department);
  const pool = { ar: [], en: [] };
  [key === "general" ? null : BANKS[key], BANKS.general, EXTRA].filter(Boolean).forEach((bank) => {
    pool.ar.push(...bank.ar);
    pool.en.push(...bank.en);
  });
  return pool;
}

function order(length, seed) {
  const list = Array.from({ length }, (_, index) => index);
  let value = hash(seed) || 1;
  for (let index = length - 1; index > 0; index -= 1) {
    value = (value * 1103515245 + 12345) >>> 0;
    const swap = value % (index + 1);
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

function fromBank(date, department) {
  const pool = poolFor(department);
  const slot = order(pool.ar.length, `spark:${department}`)[dayNumber(date) % pool.ar.length];
  return { ar: pool.ar[slot], en: pool.en[slot] };
}

function trendQuestion(kind, value, day) {
  const bank = TREND[kind];
  const slot = Math.floor(day / 4) % bank.ar.length;
  const ar = kind === "tag" ? { tag: value } : { topic: TOPICS[value].ar };
  const en = kind === "tag" ? { tag: value } : { topic: TOPICS[value].en };
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, name) => vars[name] || "");
  const question = { ar: fill(bank.ar[slot], ar), en: fill(bank.en[slot], en), reason: REASON };
  if (kind === "topic") question.en = question.en.charAt(0).toUpperCase() + question.en.slice(1);
  return question;
}

function pick(date, department, signals = {}) {
  const day = dayNumber(date);
  const topic = (signals.deptTopics && signals.deptTopics[department]) || signals.topic;
  if (day % 4 === 0 && topic && TOPICS[topic]) return trendQuestion("topic", topic, day);
  if (day % 4 === 2 && signals.tag) return trendQuestion("tag", signals.tag, day);
  return fromBank(date, department);
}

function build(date, departments, signals) {
  const items = { "*": pick(date, "*", signals) };
  departments.forEach((name) => {
    if (name) items[name] = pick(date, name, signals);
  });
  return items;
}

module.exports = { riyadhDate, build, topicOf };
