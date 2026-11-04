const BASE_SHARED = 0;
const BASE_REVIEW = 0;
const BASE_PROJECTS = 0;
const LOCAL_KEY = "rd-ideas-v1";

const dict = {
  ar: {
    title: "BQ Connect",
    bqTag: "One team. One family.",
    bqSignIn: "دخول",
    bqCreatePost: "إنشاء منشور",
    bqPostTitle: "المنشور",
    bqComposePh: "شارك فكرتك أو ملاحظتك أو تحسين تقترحه...",
    bqAddLocation: "أضف الموقع",
    bqTagPeople: "أشر لزملاء / فريق",
    bqAddProject: "أضف مشروع",
    bqProjectPh: "اسم المشروع",
    createTitle: "ماذا تريد أن تنشر؟",
    createPostSub: "منشور عادي، اقتراح، شكوى، شكر، قصة، مقال أو استطلاع",
    createPollSub: "سؤال بخيارات يصوّت عليها الزملاء",
    composeChange: "تغيير",
    composeMore: "تفاصيل إضافية",
    headPost: "منشور جديد",
    headIdea: "فكرة جديدة",
    headAnnouncement: "إعلان جديد",
    headSuggestion: "اقتراح جديد",
    headComplaint: "شكوى جديدة",
    headThanks: "رسالة شكر",
    headStory: "قصة جديدة",
    headArticle: "مقال جديد",
    headPoll: "استطلاع جديد",
    bodyPost: "نص المنشور",
    phBodyPost: "اكتب تحديثاً أو خبراً من العمل...",
    titleAnnouncement: "عنوان الإعلان",
    phTitleAnnouncement: "مثال: اجتماع السلامة الشهري",
    bodyAnnouncement: "نص الإعلان",
    phBodyAnnouncement: "اكتب الموضوع، والموعد، والمطلوب من الموظفين...",
    titleSuggestion: "عنوان الاقتراح",
    phTitleSuggestion: "مثال: تبسيط طلبات الصيانة",
    bodySuggestion: "تفاصيل الاقتراح",
    phBodySuggestion: "وش الإجراء الحالي؟ ووش التحسين اللي تقترحه؟",
    titleComplaint: "عنوان الشكوى",
    phTitleComplaint: "مثال: تأخر وصول مهمات السلامة",
    bodyComplaint: "تفاصيل الشكوى",
    phBodyComplaint: "وش المشكلة؟ ومن متى؟ ووين صارت؟",
    bodyThanks: "رسالة الشكر",
    phBodyThanks: "اكتب سبب شكرك وتقديرك...",
    bodyStory: "تعليق على القصة",
    phTitleArticle: "عنوان واضح للمقال",
    phBodyArticle: "اكتب المقال هنا...",
    titlePoll: "سؤال الاستطلاع",
    phTitlePoll: "مثال: أي وقت يناسب اجتماع الفريق؟",
    bodyPoll: "توضيح (اختياري)",
    phBodyPoll: "أضف تفاصيل تساعد الزملاء على الاختيار...",
    createIdeaSub: "قدّم فكرة تطوير للمراجعة",
    createAnnounceSub: "إعلان رسمي لجميع الموظفين",
    createAnnounceGroupSub: "إعلان رسمي أو فعالية للموظفين",
    createPlainAnnounce: "إعلان رسمي",
    typeEvent: "فعالية",
    createEventSub: "موعد ومكان، والزملاء يأكدون حضورهم",
    headEvent: "فعالية جديدة",
    titleEvent: "اسم الفعالية",
    phTitleEvent: "مثال: لقاء السلامة الربعي",
    bodyEvent: "التفاصيل (اختياري)",
    phBodyEvent: "وش برنامج الفعالية، ومن المعنيين بالحضور؟",
    eventWhen: "الموعد",
    eventWhere: "المكان",
    eventWherePh: "مثال: قاعة الاجتماعات، المبنى الرئيسي",
    eventDateError: "حدد موعد الفعالية، ولازم يكون بعد الوقت الحالي.",
    eventGoing: "بحضر",
    eventGoingOn: "مسجّل حضورك",
    eventCount: "{n} بيحضرون",
    eventPast: "انتهت الفعالية",
    upcomingEvents: "الفعاليات القادمة",
    alertEvent: "تذكير: الفعالية تبدأ خلال ساعة",
    draftRestored: "رجّعنا مسودتك اللي ما نشرتها.",
    draftDiscard: "ابدأ من جديد",
    similarTitle: "أفكار قريبة من فكرتك",
    similarLead: "لو وحدة منها نفس فكرتك، ادعمها بدل ما تتكرر.",
    similarSupport: "ادعمها",
    similarSupported: "دعمتها",
    similarOpen: "افتح",
    ackButton: "اطلعت على الإعلان",
    ackDone: "تم الاطلاع",
    ackCount: "اطلع عليه {n} من {total} ({p}%)",
    ackCountShort: "اطلع عليه {n}",
    pinAction: "تثبيت أعلى الإعلانات",
    unpinAction: "إلغاء التثبيت",
    pinnedTag: "مثبّت",
    exportTitle: "تصدير التقارير",
    exportLead: "ملف CSV يفتح في Excel، حسب الفترة المختارة فوق.",
    exportIdeas: "الأفكار والاقتراحات والشكاوى",
    exportDepts: "ملخص الأقسام",
    exportFailed: "تعذّر التصدير، جرّب مرة ثانية.",
    createPlainPost: "منشور عادي",
    createPlainSub: "تحديث أو صورة من العمل",
    createSuggestSub: "تحسين على إجراء أو خدمة",
    createComplaintSub: "مشكلة تحتاج متابعة وحل",
    createThanksSub: "تقدير لزميل أو فريق",
    createStorySub: "تحديث سريع بالصور",
    createArticleSub: "موضوع مفصّل بعنوان",
    workIdeas: "الأفكار",
    workProjects: "المشاريع",
    geoLocating: "جاري تحديد موقعك…",
    geoNaming: "تم تحديد موقعك، جاري جلب اسم المكان…",
    geoPinned: "تم تحديد موقعك على الخريطة",
    geoOnMap: "الموقع على الخريطة",
    geoDenied: "لم يُسمح بالوصول للموقع. فعّل إذن الموقع من المتصفح أو اكتب المكان.",
    geoFailed: "تعذّر تحديد الموقع. اكتب المكان يدويًا.",
    geoUnavailable: "تحديد الموقع يحتاج اتصال آمن (https). اكتب المكان يدويًا.",
    bqPhoto: "صورة",
    bqVideo: "فيديو",
    bqPoll: "استطلاع",
    bqFile: "ملف",
    bqSoon: "رفع الملفات غير متاح حالياً. تقدر ترفق صورة أو فيديو.",
    bqStoryCaption: "أضف تعليقاً على القصة (اختياري)",
    bqStoryNeedsMedia: "القصة لازم تكون صورة أو فيديو.",
    bqAddMedia: "أضف صورة أو فيديو",
    bqAddMediaSub: "فيديو حتى 60 ثانية، ونضغطه تلقائياً قبل الرفع",
    bqUploading: "جارٍ رفع الملف...",
    bqPreparing: "جارٍ تجهيز الفيديو... {n}%",
    bqUploadingPct: "جارٍ الرفع... {n}%",
    bqUploadFail: "تعذّر رفع الملف. حاول مرة ثانية.",
    bqMediaBad: "نوع الملف غير مدعوم. استخدم صورة أو فيديو MP4 / WebM / MOV.",
    bqVideoBig: "الفيديو كبير جداً. اختر مقطعاً أقصر أو بجودة أقل.",
    bqVideoLong: "الفيديو أطول من 60 ثانية.",
    bqReelsEmpty: "ما فيه ريلز حالياً. الريلز فيديوهات بس، صوّر أول فيديو من موقعك.",
    bqAddStory: "أضف قصة",
    bqMute: "كتم الصوت",
    bqUnmute: "تشغيل الصوت",
    bqClose: "إغلاق",
    bqCamHint: "اضغط للصورة، واضغط مطوّلاً للفيديو",
    bqCamGallery: "المعرض",
    bqCamShutter: "التقاط",
    bqCamFlip: "قلب الكاميرا",
    bqCamRetake: "إعادة",
    bqCamOpenDevice: "افتح كاميرا الجهاز",
    bqCamUnsupported: "المتصفح ما يسمح بالكاميرا هنا. افتح كاميرا الجهاز أو اختر من المعرض.",
    bqCamDenied: "ما تم السماح بالكاميرا. فعّل الإذن من إعدادات المتصفح أو اختر من المعرض.",
    bqCamMissing: "ما لقينا كاميرا في هذا الجهاز. اختر صورة أو فيديو من المعرض.",
    navReels: "ريلز",
    feedMenu: "اختيار المحتوى",
    exSearch: "بحث",
    exEmpty: "ما فيه نتائج",
    fpMore: "المزيد",
    fpAllComments: "عرض كل التعليقات ({n})",
    fpCopied: "تم نسخ الرابط",
    fpSwipe: "اسحب للتفاصيل",
    igPosts: "المنشورات",
    igFollowers: "المتابعون",
    igFollowing: "المتابَعون",
    igEditProfile: "تعديل الملف الشخصي",
    igShareProfile: "مشاركة الملف",
    igCopied: "تم النسخ",
    igNewHighlight: "جديد",
    igHighlightNew: "هايلايت جديد",
    igHighlightEdit: "تعديل الهايلايت",
    igHighlightName: "اسم الهايلايت",
    igHighlightPick: "اختر القصص، وأول قصة تختارها تكون الغلاف. اضغط مطوّلاً على قصة لتجعلها الغلاف.",
    igHighlightDefault: "هايلايت",
    igHighlightBtn: "هايلايت",
    igArchiveEmpty: "ما عندك قصص سابقة. انشر قصة وبعدها تقدر تضيفها للهايلايت.",
    igCover: "الغلاف",
    igNeedPick: "اختر قصة وحدة على الأقل.",
    igDeleteHighlight: "حذف الهايلايت",
    igDeleteAsk: "تبي تحذف هذا الهايلايت؟ القصص نفسها ما تنحذف.",
    igDone: "تم",
    igCancel: "إلغاء",
    igChangePhoto: "تغيير الصورة",
    igRemovePhoto: "إزالة الصورة",
    igName: "الاسم",
    igRole: "المسمى الوظيفي",
    igBio: "النبذة",
    igLockedNote: "الاسم والمسمى من ملف الموظفين، وما تنعدل من هنا.",
    igTabGrid: "المنشورات",
    igTabReels: "الفيديو",
    igTabIdeas: "الأفكار",
    igTabSaved: "المحفوظات",
    igEmptyGrid: "شارك أول منشور لك",
    igEmptyReels: "ما عندك فيديوهات بعد",
    igEmptyIdeas: "ما شاركت أفكار بعد",
    igLevelLine: "{badge} · المستوى {n} · {pts} نقطة",
    bqCamTextPh: "اكتب كلامك هنا",
    bqCamColor: "تغيير اللون",
    bqCamFlash: "الفلاش",
    bqCamSettings: "الإعدادات",
    bqCamNext: "التالي",
    bqToolText: "نص",
    bqToolLoop: "تكرار",
    bqToolLayout: "تخطيط",
    bqToolFilter: "فلاتر",
    bqToolHands: "بدون يد",
    bqToolTimer: "مؤقت",
    bqToolMore: "المزيد",
    bqSetMirror: "عكس صورة الكاميرا الأمامية",
    bqSetLines: "خطوط الشبكة",
    bqSetSave: "احفظ نسخة على جهازي بعد النشر",
    bqFilterNone: "عادي",
    bqFilterWarm: "دافئ",
    bqFilterCool: "بارد",
    bqFilterMono: "أبيض وأسود",
    bqFilterVivid: "زاهي",
    bqFilterFade: "باهت",
    bqTextHint: "اكتب نصك، اضغط الدائرة لتغيير اللون، ثم زر الالتقاط",
    bqTextEmpty: "اكتب نص أولاً.",
    bqLoopHint: "اضغط زر الالتقاط لتصوير مقطع قصير يتكرر",
    bqLoopBusy: "جارٍ تجهيز المقطع...",
    bqLayoutHint: "تخطيط {n} صور: التقط الصورة {i}",
    bqHandsOn: "بدون يد: اضغط مرة للبدء ومرة للإيقاف",
    bqTimerOn: "مؤقت {n} ثوانٍ قبل الالتقاط",
    bqCamZoom: "التقريب",
    bqCamExposure: "الإضاءة",
    bqToolOff: "تم الإيقاف",
    bqFlashScreen: "الفلاش غير متاح لهذه الكاميرا، بنستخدم إضاءة الشاشة",
    bqMoreTypes: "أنواع أخرى",
    bqIdeaHub: "مركز الأفكار",
    bqNewIdea: "فكرة جديدة",
    bqFeatured: "تحدي مميز",
    bqChallengeSub: "شارك أفكارك وساعدنا نبني مستقبل أكثر كفاءة.",
    bqJoin: "شارك في التحدي",
    bqExplore: "استكشف",
    bqProjectsDepts: "المشاريع والأقسام",
    bqProjectsDeptsSub: "تحديثات من المواقع والفرق",
    bqRecognitionSub: "شارات للمساهمات والأفكار والعمل الجماعي.",
    bqAnnouncements: "إعلانات الشركة",
    bqAnnouncementsSub: "تحديثات مهمة لكل الموظفين.",
    bqMessagesSub: "تواصل مع زملائك",
    bqAlertsLead: "تابع التعليقات وتقدّم الأفكار وإعلانات الشركة.",
    bqViewAll: "عرض الكل",
    bqShowLess: "عرض أقل",
    bqPts: "نقطة",
    bqComment: "تعليق",
    bqShare: "مشاركة",
    bqPeopleStory: "الناس",
    bqEditProfile: "تعديل الملف الشخصي",
    chipInnovation: "الابتكار",
    bqEmployeesOnly: "لموظفي بن قريعة فقط",
    navIdeas: "الأفكار",
    navIdeasSub: "شارك وحل",
    navPeople: "الناس",
    navPeopleSub: "تواصل وادعم",
    navProjects: "المشاريع",
    navProjectsSub: "شوف وش يصير",
    navRecognition: "التقدير",
    navRecognitionSub: "احتفِ بالنجاح",
    navGrowth: "النمو",
    navGrowthSub: "ابنِ مستقبلنا",
    chipAll: "الكل",
    chipFollowing: "متابعة",
    chipProjects: "المشاريع",
    chipRnd: "البحث والتطوير",
    chipSafety: "السلامة",
    chipDepts: "الأقسام",
    hubTop: "الأعلى",
    hubReview: "قيد المراجعة",
    hubDone: "تم التنفيذ",
    topicOps: "العمليات",
    topicMaint: "الصيانة",
    topicCost: "توفير التكلفة",
    bqMakeIdea: "حوّلها إلى فكرة",
    bqMakeIdeaSub: "أرسلها للبحث والتطوير للمراجعة",
    typeAnnouncement: "إعلان",
    bqMyPosts: "منشوراتي",
    bqMyIdeas: "أفكاري",
    bqMyTeams: "فرقي",
    bqAchievements: "الإنجازات",
    bqLevel: "المستوى {n}",
    bqBadge: "مساهم في الابتكار",
    bqPoints: "النقاط",
    bqMoments: "لحظات بن قريعة",
    bqMomentsLead: "مقاطع قصيرة من المشاريع والابتكار والسلامة.",
    bqStoriesTitle: "القصص",
    bqStoriesLead: "تحديثات سريعة من الفرق والفعاليات.",
    bqRankTitle: "الأكثر مساهمة",
    bqRankLead: "التقدير يظهر لمن نشر وشارك داخل التطبيق.",
    bqYourStory: "قصتك",
    bqIdeasCount: "أفكار",
    bqPostsCount: "منشورات",
    skip: "تخطَّ إلى المحتوى",
    langGroup: "اللغة",
    brandSub: "البحث والتطوير",
    navWelcome: "الترحيب",
    navInspire: "المجالات",
    navSubmit: "شارك",
    navExplore: "الأعمال",
    navInbox: "المنتدى",
    ctaForum: "ادخل المنتدى",
    loginTitle: "تسجيل الدخول",
    loginLead: "للموظفين. رقم البطاقة، وآخر 4 أرقام من الهوية، ثم رقم الجوال المسجّل.",
    labelMobile: "رقم الجوال",
    phMobile: "05xxxxxxxx",
    loginSecure: "رقم الجوال يتأكد ولا يظهر داخل التطبيق. رمز التحقق يُرسل إذا كانت خدمة الرسائل مفعّلة.",
    labelOtp: "رمز التحقق",
    phOtp: "••••••",
    confirmOtp: "تأكيد الرمز",
    otpSent: "أرسلنا رمز التحقق إلى جوالك. أدخله خلال ٥ دقائق.",
    otpBad: "الرمز غير صحيح أو انتهت مدته.",
    smsFailed: "تعذر إرسال الرمز إلى الجوال. حاول بعد قليل.",
    announceKicker: "إعلان",
    alertAnnounce: "إعلان من {name}",
    loginButton: "دخول",
    logout: "تسجيل الخروج",
    drawerMenu: "القائمة",
    drawerProfile: "الملف الشخصي",
    drawerDept: "قسمك",
    drawerSettings: "الإعدادات",
    setAccount: "حسابك",
    setAccountInfo: "معلومات الحساب",
    setPrivacy: "الخصوصية والأمان",
    setPrivacyBody: "يظهر للزملاء اسمك وقسمك ومنصبك فقط. رقم البطاقة والهوية والجوال ما تنعرض داخل التطبيق.",
    setDisplay: "العرض",
    setNotify: "الإشعارات",
    setMail: "إعلانات الشركة",
    setMore: "المزيد",
    setAbout: "عن بن قريعة",
    setDept: "القسم",
    setRole: "المنصب",
    setAccountNote: "القسم والمنصب من ملف الموظفين، وما تنعدل من هنا. صورة العرض تقدر تغيّرها متى ما بغيت.",
    setPhotoChange: "تغيير صورة العرض",
    setPhotoHint: "اضغط على الدائرة وأضف صورة عرض",
    setPhotoRemove: "إزالة الصورة",
    postingAs: "النشر باسم {name}",
    navHome: "الرئيسية",
    navAlerts: "الإشعارات",
    navProfile: "حسابي",
    alertLike: "أعجب {name} ب{noun}",
    alertDislike: "ضغط {name} عدم إعجاب على {noun}",
    alertComment: "علّق {name} على {noun}",
    alertStatus: "غيّر {name} حالة فكرتك إلى {status}",
    alertMention: "أشار {name} إليك {where}",
    alertThanks: "شكرك {name}",
    alertRepost: "أعاد {name} نشر {noun}",
    alertComplaint: "أرسل {name} شكوى",
    alertMessage: "أرسل {name} رسالة",
    statusLog: "سجل الحالة",
    alertAnon: "شخص",
    alertEmpty: "ما فيه إشعارات بعد.",
    profileEmpty: "ما نشرت أفكار بعد.",
    tabMine: "أفكاري",
    tabSaved: "المحفوظات",
    savedEmpty: "ما حفظت أفكار بعد.",
    editIdea: "تعديل",
    saveLabel: "حفظ",
    newIdea: "نشر",
    composerHint: "شارك فكرة للفريق…",
    back: "رجوع",
    justNow: "الآن",
    minsAgo: "منذ {n} د",
    hoursAgo: "منذ {n} س",
    daysAgo: "منذ {n} ي",
    badge: "Bin Quraya · البحث والتطوير",
    web: "نفط وغاز · خطوط أنابيب · معدات ثقيلة",
    line1: "أفكار اليوم.",
    line2: "غدٌ أكثر أماناً.",
    footerEnd: "غدٌ أكثر أماناً",
    lead: "فكرة من الموقع أو الورشة أو خط الأنابيب قد تحمي فريقاً كاملاً.",
    thanks: "شكراً لكونك جزءاً من رحلة بن قريعة.",
    aboutKicker: "بن قريعة",
    aboutTitle: "شركة تنفيذ في النفط والغاز، والأفكار تجي من الميدان.",
    aboutLead: "بن قريعة من أكبر شركات التنفيذ والمقاولات السعودية في النفط والغاز. بدأت من أبقيق، ومقرها اليوم الظهران، وتنفّذ خطوط الأنابيب والمصانع والبنية التحتية، وتملك من أكبر أساطيل الرافعات المتنقلة في الشرق الأوسط.",
    aboutSince: "منذ 1975",
    aboutHeroTitle: "نبني طاقة المملكة من الميدان",
    aboutStatYears: "سنة في الميدان",
    aboutStatKm: "كم خطوط أنابيب",
    aboutStatAssets: "معدة وأصل",
    aboutStatCranes: "رافعة متنقلة",
    aboutWhat: "وش نسوي",
    aboutSvc1: "مشاريع EPC متكاملة",
    aboutSvc2: "خطوط الأنابيب",
    aboutSvc3: "إيقاف المصانع الدوري",
    aboutSvc4: "أعمال ميكانيكية وكهربائية",
    aboutSvc5: "المصافي والبتروكيماويات",
    aboutSvc6: "محطات وشبكات الكهرباء",
    aboutSvc7: "الحماية الكاثودية",
    aboutSvc8: "الطرق والمباني والمرافق",
    aboutSvc9: "التشغيل والصيانة",
    aboutDivisions: "قطاعاتنا",
    aboutDivBuild: "الإنشاءات ومشاريع النفط والغاز",
    aboutDivRental: "رافعات من 50 إلى 500 طن ومعدات ثقيلة",
    aboutDivRig: "نقل منصات الحفر",
    aboutDivPower: "تأجير المولدات وقطاع الطاقة",
    aboutJourney: "رحلتنا",
    aboutY1975: "تأسيس «أسكو» في أبقيق",
    aboutY1975s: "رافعة وحدة، 3 سيارات، و25 موظف يشتغلون مقاولين من الباطن لمشاريع أرامكو.",
    aboutY1982: "ولادة مؤسسة بن قريعة",
    aboutY1982s: "أسسها عوض بن قريعة وتسجّلت مقاول ميكانيكي لدى أرامكو.",
    aboutY1986: "نقلة خط شرق غرب",
    aboutY1986s: "عقود طويلة في مشروع إعادة تأهيل خط الأنابيب شرق غرب في أبقيق، ومعها كبر أسطول الرافعات.",
    aboutY2004: "المقر الجديد في الظهران",
    aboutY2004s: "توسّع الأسطول ليشمل اللوادر والبلدوزرات والقريدرات والشاحنات.",
    aboutY2010: "أكثر من 400 رافعة",
    aboutY2010s: "من أكبر أساطيل الرافعات المتنقلة في المنطقة، مع التصميم والتنفيذ.",
    aboutY2020: "التوسع في الطاقة",
    aboutY2020s: "محطات كهربائية وأعمال مدنية، وتدريب المشغلين بمحاكاة الواقع الافتراضي.",
    aboutProjects: "مشاريع بارزة",
    aboutP1: "مشروع غاز الخف",
    aboutP2: "خط أنابيب سوائل الغاز في الخفجي",
    aboutP3: "خط غاز الوقود PP10",
    aboutP4: "شبكة توزيع الغاز في المدينة الصناعية الثانية بالدمام",
    aboutP5: "مرافق الغاز غير التقليدي في شمال المملكة",
    aboutV1: "السلامة أولاً",
    aboutV2: "الجودة",
    aboutV3: "الموثوقية",
    aboutApp: "مساحة موظفي بن قريعة: الإعلانات الرسمية، الأفكار، التهاني، والتواصل بين الأقسام والمواقع، في مكان واحد.",
    factYears: "سنة خبرة",
    factPeople: "القوى العاملة",
    factPipes: "كم من خطوط الأنابيب",
    factAssets: "معدة وأصل",
    cta: "شارك فكرتك",
    pillarPeople: "الأفراد",
    pillarIdeas: "الأفكار",
    pillarTech: "التقنية",
    pillarImpact: "الأثر",
    step1t: "ترحيب",
    step1d: "الصفحة التعريفية",
    step2t: "استلهم",
    step2d: "مجالات التركيز",
    step3t: "أرسل",
    step3d: "نموذج سريع",
    step4t: "تأكيد",
    step4d: "رد فوري",
    step5t: "استكشف",
    step5d: "أعمال القسم",
    principlesKicker: "شارك",
    principlesTitle: "شارك أفكارك، وكن جزءاً مما هو قادم.",
    innovate: "ابتكر",
    collaborate: "تعاون",
    solve: "عالج",
    grow: "انمُ",
    together: "معاً نبني غداً أكثر أماناً.",
    inspireKicker: "استلهم",
    inspireTitle: "ماذا لو غيّرت فكرتك طريقة عمل الموقع؟",
    inspireSub: "السلامة، الأسطول، خطوط الأنابيب، الورش، والجودة. فكرتك الصغيرة قد تصير إجراء أو أداة.",
    formKicker: "شارك فكرتك",
    formTitle: "كل فكرة تُحسب.",
    formLead: "أدخل رقم بطاقتك وآخر 4 أرقام من هويتك. اسمك يظهر لك وحدك بعد التحقق، وما تنعرض أسماء الموظفين.",
    labelPerson: "ثبّت هويتك",
    labelBadge: "رقم البطاقة",
    phBadge: "مثال: 112",
    labelCode: "آخر 4 أرقام من الهوية",
    phCode: "••••",
    verify: "تحقق",
    verifying: "جارٍ التحقق…",
    changePerson: "تغيير",
    mismatch: "البيانات غير مطابقة. رقم البطاقة من غير أصفار في البداية، وآخر 4 أرقام من الهوية الوطنية وليس الجوال، والجوال المسجّل مثل 05xxxxxxxx.",
    limited: "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.",
    deptUnknown: "غير محدد",
    errPerson: "تحقق من بياناتك قبل إرسال الفكرة.",
    labelTitle: "عنوان الفكرة",
    labelArticleTitle: "عنوان المقال",
    labelArticle: "المقال",
    phTitle: "عنوان قصير يوضّح الفكرة",
    labelIdea: "الفكرة",
    phIdea: "وش تقترح بالضبط؟",
    labelProblem: "المشكلة",
    phProblem: "وش يصير اليوم ويحتاج يتغير؟",
    labelPros: "الإيجابيات",
    phPros: "اكتب فائدة",
    labelCons: "السلبيات",
    phCons: "اكتب عائق أو تكلفة",
    addPoint: "أضف نقطة",
    labelImpact: "الأثر المتوقع",
    phImpact: "وش يتغير إذا طُبقت الفكرة؟",
    labelPlace: "وين تنطبق",
    place_workshop: "ورشة",
    place_line: "خط",
    place_fleet: "أسطول",
    place_office: "مكتب",
    place_site: "موقع",
    place_warehouse: "مستودع",
    place_other: "أخرى",
    phPlaceOther: "اكتب المكان",
    namedMode: "باسمي",
    anonMode: "مجهول",
    namedNote: "اسمك وقسمك يظهران مع الفكرة.",
    anonNote: "اسمك وقسمك ما يظهران في المنتدى.",
    anonAuthor: "مجهول",
    sortNew: "الأحدث",
    sortTop: "الأكثر إعجاباً",
    likeLabel: "إعجاب",
    dislikeLabel: "عدم إعجاب",
    peopleButton: "التفاعل",
    peopleTitle: "مين تفاعل",
    peopleLikes: "الإعجابات",
    peopleDislikes: "عدم الإعجاب",
    peopleSaves: "الحفظ",
    peopleNone: "ما فيه أحد",
    peopleEmpty: "ما فيه أحد",
    sortGroup: "ترتيب الأفكار",
    commentsTitle: "التعليقات",
    commentPlaceholder: "اكتب تعليقك",
    commentSend: "أضف التعليق",
    commentAnon: "علّق كمجهول",
    rateLabel: "تقييمك",
    noComments: "لا تعليقات بعد. كن أول من يشارك رأيه.",
    needVerify: "تحقق من بطاقتك في نموذج المشاركة قبل التعليق.",
    submit: "نشر",
    sending: "جارٍ الإرسال…",
    savedLocal: "دليل الموظفين يحتاج تشغيل الموقع من الخادم.",
    errDirectory: "تعذر الوصول لدليل الموظفين.",
    exploreKicker: "داخل البحث والتطوير",
    exploreTitle: "نحوّل الأفكار إلى أثر حقيقي.",
    exploreCta: "عندك فكرة أكبر؟",
    exploreCtaSub: "لنبنِها معاً.",
    inboxKicker: "المنتدى",
    inboxTitle: "أفكار الفريق",
    inboxLead: "كل منشور باسمك. فكرة أو اقتراح أو شكوى أو شكر، والفريق يشوفه.",
    inboxSearch: "ابحث في المنشورات والناس والأقسام",
    feedFollowing: "متابعة",
    feedForYou: "لك",
    feedCompany: "الشركة",
    feedToday: "اليوم",
    typePost: "منشور",
    typeIdea: "فكرة",
    openIdea: "افتح الفكرة",
    ideaMore: "و{n} نقاط أخرى",
    typeSuggestion: "اقتراح",
    typeComplaint: "شكوى",
    typeThanks: "شكر",
    typeStory: "قصة",
    typePoll: "استطلاع",
    typeArticle: "مقال",
    readArticle: "اقرأ المقال",
    postPhoto: "صورة",
    photoBig: "الصورة أكبر من الحد.",
    thanksTo: "لمن الشكر",
    pollOptions: "الخيارات",
    pollPh: "خيار",
    mention: "أشر لزميل",
    repost: "إعادة نشر",
    follow: "متابعة",
    following: "متابَع",
    bio: "سطر قصير عنك",
    saveBio: "حفظ الحساب",
    tabSuggestions: "اقتراحاتي",
    tabThanks: "الشكر",
    navMessages: "الرسائل",
    navGroups: "المجموعات",
    mailLead: "اربط إيميل شركتك. تظهر فقط الرسائل الواردة من announce@binquraya.com.",
    mailUser: "name@binquraya.com",
    mailPass: "كلمة مرور التطبيق من جوجل",
    mailConnect: "ربط البريد",
    mailBad: "استخدم إيميل @binquraya.com وكلمة مرور التطبيق.",
    mailOk: "تم الربط. رسائل الإعلانات ستظهر في التنبيهات.",
    achievementTitle: "عنوان الإنجاز",
    achievementText: "اكتب إنجاز القسم أو أي تحديث يخصه",
    achievementAdd: "أضف إنجاز",
    achievementEmpty: "لا إنجازات لهذا القسم بعد.",
    dmSearch: "بحث في الرسائل",
    dmPlaceholder: "اكتب رسالة",
    dmSend: "إرسال",
    dmEmpty: "ما فيه رسائل بعد.",
    dmHint: "ابدأ المحادثة",
    dmPhoto: "صورة",
    dmAttach: "صورة أو GIF",
    dmReply: "رد",
    dmUnsend: "حذف",
    dmTooBig: "الصورة كبيرة. صغّرها ثم أعد الإرسال.",
    dmReplying: "رد على {name}",
    groupName: "اسم المجموعة أو الموقع",
    groupCreate: "إنشاء",
    groupEmpty: "ما فيه مجموعات بعد.",
    groupLead: "كل أقسام الشركة من ملف الموظفين. افتح أي قسم لتشوف بروفايله وإنجازاته.",
    groupMine: "قسمك",
    groupFeed: "منشورات المجموعة",
    deptFollow: "تابع القسم",
    deptFollowing: "القسم متابَع",
    deptPeople: "الموظفون",
    deptPosts: "المنشورات",
    deptWins: "الإنجازات",
    deptSearch: "ابحث عن موظف في القسم",
    membersCount: "{n} موظف",
    personMessage: "مراسلة",
    peopleEmpty: "ما فيه موظفين بهذا الاسم.",
    loadMore: "عرض المزيد",
    searchPeople: "الناس",
    searchDepts: "الأقسام",
    inboxEmpty: "لا توجد أفكار بعد. كن أول من يشارك.",
    inboxNoMatch: "لا توجد نتائج مطابقة.",
    anonymous: "بدون اسم",
    statusReceived: "مستلمة",
    statusReview: "قيد المراجعة",
    statusProject: "أصبحت مشروعاً",
    statusResolved: "تم الحل",
    statusLocked: "الفكرة تبدأ مستلمة. مدير القسم فقط يغيّر الحالة بعدها.",
    remove: "حذف",
    removeAsk: "حذف هذه الفكرة؟",
    confirmQuote: "«التقدم يبدأ بأشخاص يهتمون.»",
    sparkKicker: "تحدي اليوم",
    sparkGo: "اعرض فكرتك",
    sparkLaunch: "جاوب سؤال قسمك وخلّها بطاقة جاهزة",
    sparkLive: "يتجدد غداً",
    angleLead: "ابدأ من زاوية",
    angleTime: "نختصر وقت الفريق",
    angleSafe: "نرفع الأمان",
    angleWaste: "نقلل الهدر",
    angleInfo: "نوصل المعلومة أسرع",
    strengthLabel: "اكتمال الفكرة {n}%",
    sparkDept: "قسمك شارك {n} فكرة. دورك تكمل.",
    sparkDeptEmpty: "كن أول واحد من قسمك يعرض فكرة.",
    sparkFor: "سؤال {name} · يتجدد كل يوم",
    sparkForAll: "سؤال اليوم · يتجدد كل يوم",
    studioIdea: "الفكرة",
    studioProblem: "المشكلة",
    studioBalance: "الموازنة",
    studioImpact: "الأثر",
    studioNext: "التالي",
    studioBack: "السابق",
    studioHint1: "اكتب العنوان والفكرة كأنك تشرحها لزميل في الموقع.",
    studioHint2: "حدد المكان، ثم صف المشكلة اللي تصير اليوم.",
    studioHint3: "حط الإيجابيات قدام السلبيات عشان القرار يكون واضح.",
    studioHint4: "هذي معاينة الفكرة قبل الإرسال. عدّل الأثر إذا ناقص.",
    rankReady: "جاهز تنطلق",
    rankStart: "بداية",
    rankContributor: "مساهم",
    rankMaker: "مبدع",
    rankLead: "رائد أفكار",
    statIdeas: "أفكار",
    statLikes: "إعجابات",
    statPoints: "نقاط",
    rankLeft: "باقي {n} نقطة وتصير {rank}.",
    rankTop: "وصلت أعلى رتبة. استمر.",
    pointsHow: "كيف تجتمع النقاط",
    pointIdea: "كل فكرة",
    pointLike: "كل إعجاب",
    pointReply: "كل رد",
    pointProject: "كل مشروع",
    pointTotal: "المجموع",
    raceKicker: "سباق الأقسام",
    raceEmpty: "أول قسم ينشر فكرة يتصدر السباق.",
    boostIdea: "ادعم فكرة زميل: {title}",
    hotIdea: "الأكثر تفاعلاً",
    statShared: "أفكار مشارَكة",
    statReview: "قيد المراجعة",
    statProjects: "أصبحت مشاريع",
    errTitle: "اكتب عنواناً للفكرة.",
    errRequired: "اكتب تفاصيل الفكرة قبل الإرسال.",
    errFailed: "تعذر إرسال الفكرة. حاول مرة أخرى.",
    bqAddMore: "أضف صور",
    bqGalleryMax: "الحد الأقصى 10 صور في المنشور.",
    bqGalleryNoVideo: "الفيديو ينشر لحاله. احذفه إذا تبي تضيف عدة صور.",
    tagsTrending: "هاشتاقات رائجة",
    tagPosts: "{n} منشور",
    pmReport: "إبلاغ",
    pmCopyLink: "نسخ الرابط",
    pmShare: "مشاركة",
    pmOpen: "عرض المنشور",
    pmEdit: "تعديل",
    pmDelete: "حذف",
    pmHide: "إخفاء المنشور",
    pmCancel: "إلغاء",
    reportTitle: "ليش تبلّغ عن هذا المنشور؟",
    reportLead: "البلاغ سري، وصاحب المنشور ما يعرف مين بلّغ.",
    reasonSpam: "مزعج أو مكرر",
    reasonOffensive: "مسيء أو غير لائق",
    reasonFalse: "معلومة غير صحيحة",
    reasonPrivate: "يكشف معلومات خاصة",
    reasonOther: "سبب آخر",
    reportThanks: "وصل بلاغك، وما راح يظهر لك هذا المنشور.",
    reportFail: "تعذر إرسال البلاغ. حاول مرة ثانية.",
    hiddenOwner: "مخفي عن الزملاء بعد المراجعة",
    alertReport: "بلاغ جديد على منشور",
    alertReportAuto: "انخفى منشور تلقائياً بعد عدة بلاغات",
    alertHidden: "انخفى منشورك بعد مراجعة المشرف",
    alertRestored: "رجع منشورك يظهر للزملاء",
    drawerMod: "الإشراف",
    modTitle: "الإشراف",
    modLead: "المنشورات اللي انبلّغ عنها أو انخفت. البلاغات سرية.",
    modEmpty: "ما فيه بلاغات. كل شي تمام.",
    modReports: "{n} بلاغ",
    modHiddenAuto: "مخفي تلقائياً",
    modHiddenMod: "مخفي من مشرف",
    modHide: "إخفاء",
    modRestore: "إظهار",
    modDismiss: "تجاهل",
    modOpen: "عرض",
    drawerDash: "لوحة الإدارة",
    dashTitle: "لوحة الإدارة",
    dash7: "7 أيام",
    dash30: "30 يوم",
    dash90: "90 يوم",
    dash365: "سنة",
    dashPosts: "منشورات",
    dashIdeas: "أفكار",
    dashComments: "تعليقات",
    dashLikes: "إعجابات",
    dashActive: "موظفين متفاعلين",
    dashOfEmployees: "من {n} موظف",
    dashFunnel: "مسار الأفكار",
    dashConversion: "{n}% من الأفكار صارت مشاريع",
    dashReviewDays: "متوسط الوصول للمراجعة: {n} يوم",
    dashProjectDays: "متوسط التحول لمشروع: {n} يوم",
    dashComplaints: "الشكاوى",
    dashOpen: "مفتوحة",
    dashResolved: "محلولة",
    dashResolveDays: "متوسط الحل: {n} يوم",
    dashWeekly: "النشاط آخر 12 أسبوع",
    dashDepts: "الأقسام الأكثر مساهمة",
    dashParticipation: "مشاركة {n}%",
    dashTopIdeas: "أبرز الأفكار",
    dashContributors: "الأكثر مساهمة",
    dashPoints: "{n} نقطة",
    dashReported: "مبلّغ عنها",
    dashHidden: "مخفية",
    dashOpenMod: "افتح الإشراف",
    dashEmpty: "ما فيه بيانات في هذي الفترة.",
    dashLoading: "جاري التحميل…",
    dashFail: "تعذر تحميل اللوحة.",
    setTheme: "المظهر",
    themeSystem: "حسب الجهاز",
    themeLight: "فاتح",
    themeDark: "داكن",
    themeHint: "الفاتح هو المظهر الأساسي. الداكن و«حسب الجهاز» اختياريين.",
    setPrivacySub: "كلمة المرور، التحقق بخطوتين، الأجهزة",
    setTfaOn: "محمي",
    setTfaOff: "فعّل الحماية",
    setInstalled: "مثبّت",
    setInstall: "تثبيت التطبيق",
    installLead: "ثبّت BQ Connect على شاشة جوالك، ويفتح بملء الشاشة مثل أي تطبيق.",
    installBtn: "تثبيت التطبيق",
    installDone: "التطبيق مثبّت على جهازك وتفتحه من الشاشة الرئيسية.",
    installPerk1: "أيقونة على الشاشة الرئيسية",
    installPerk2: "يفتح بملء الشاشة بدون شريط المتصفح",
    installPerk3: "أسرع في الفتح ويحدّث نفسه تلقائياً",
    installAnd1: "افتح رابط BQ Connect في متصفح Chrome.",
    installAnd2: "اضغط زر القائمة ⋮ فوق، واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
    installAnd3: "اضغط «تثبيت»، وبتلقى أيقونة BQ Connect في الشاشة الرئيسية وقائمة التطبيقات.",
    installIos1: "افتح رابط BQ Connect في متصفح Safari.",
    installIos2: "اضغط زر المشاركة (المربع اللي فيه سهم) تحت الشاشة.",
    installIos3: "انزل واختر «إضافة إلى الشاشة الرئيسية»، ثم «إضافة».",
    installHttps: "التثبيت يحتاج الرابط الرسمي الآمن (يبدأ بـ https). افتح التطبيق من الرابط اللي ترسله إدارة تقنية المعلومات وبعدها ثبّته.",
  },
  en: {
    title: "BQ Connect",
    bqTag: "One team. One family.",
    bqSignIn: "Sign In",
    bqCreatePost: "Create Post",
    bqPostTitle: "Post",
    bqComposePh: "Share your idea, observation or improvement...",
    bqAddLocation: "Add Location",
    bqTagPeople: "Tag People / Team",
    bqAddProject: "Add Project",
    bqProjectPh: "Project name",
    createTitle: "What would you like to publish?",
    createPostSub: "Post, suggestion, complaint, thanks, story, article or poll",
    createPollSub: "A question colleagues can vote on",
    composeChange: "Change",
    composeMore: "More details",
    headPost: "New post",
    headIdea: "New idea",
    headAnnouncement: "New announcement",
    headSuggestion: "New suggestion",
    headComplaint: "New complaint",
    headThanks: "Thank-you note",
    headStory: "New story",
    headArticle: "New article",
    headPoll: "New poll",
    bodyPost: "Post text",
    phBodyPost: "Write a work update or news...",
    titleAnnouncement: "Announcement title",
    phTitleAnnouncement: "e.g. Monthly safety meeting",
    bodyAnnouncement: "Announcement text",
    phBodyAnnouncement: "Write the subject, the date and what employees need to do...",
    titleSuggestion: "Suggestion title",
    phTitleSuggestion: "e.g. Simplify maintenance requests",
    bodySuggestion: "Suggestion details",
    phBodySuggestion: "What happens today, and what would you improve?",
    titleComplaint: "Complaint title",
    phTitleComplaint: "e.g. Safety supplies arriving late",
    bodyComplaint: "Complaint details",
    phBodyComplaint: "What is the issue, since when, and where?",
    bodyThanks: "Thank-you message",
    phBodyThanks: "Say why you're thanking them...",
    bodyStory: "Story caption",
    phTitleArticle: "A clear title for the article",
    phBodyArticle: "Write the article here...",
    titlePoll: "Poll question",
    phTitlePoll: "e.g. Which time suits the team meeting?",
    bodyPoll: "Details (optional)",
    phBodyPoll: "Add context to help colleagues choose...",
    createIdeaSub: "Submit an improvement idea for review",
    createAnnounceSub: "Official notice for all employees",
    createAnnounceGroupSub: "An official notice or an event for employees",
    createPlainAnnounce: "Official announcement",
    typeEvent: "Event",
    createEventSub: "A time and place, colleagues confirm attendance",
    headEvent: "New event",
    titleEvent: "Event name",
    phTitleEvent: "e.g. Quarterly safety meeting",
    bodyEvent: "Details (optional)",
    phBodyEvent: "What's the agenda, and who should attend?",
    eventWhen: "Date and time",
    eventWhere: "Place",
    eventWherePh: "e.g. Meeting hall, main building",
    eventDateError: "Set the event time, and it must be in the future.",
    eventGoing: "I'll attend",
    eventGoingOn: "You're attending",
    eventCount: "{n} attending",
    eventPast: "Event ended",
    upcomingEvents: "Upcoming events",
    alertEvent: "Reminder: the event starts within an hour",
    draftRestored: "We restored your unpublished draft.",
    draftDiscard: "Start over",
    similarTitle: "Ideas close to yours",
    similarLead: "If one of them is the same idea, support it instead of repeating it.",
    similarSupport: "Support",
    similarSupported: "Supported",
    similarOpen: "Open",
    ackButton: "I've read this",
    ackDone: "Read",
    ackCount: "Read by {n} of {total} ({p}%)",
    ackCountShort: "Read by {n}",
    pinAction: "Pin to top of announcements",
    unpinAction: "Unpin",
    pinnedTag: "Pinned",
    exportTitle: "Export reports",
    exportLead: "A CSV file that opens in Excel, for the period selected above.",
    exportIdeas: "Ideas, suggestions and complaints",
    exportDepts: "Department summary",
    exportFailed: "Export failed, try again.",
    createPlainPost: "Standard post",
    createPlainSub: "A work update or photo",
    createSuggestSub: "Improve a process or service",
    createComplaintSub: "An issue that needs follow-up",
    createThanksSub: "Recognise a colleague or team",
    createStorySub: "A quick photo update",
    createArticleSub: "A detailed write-up with a title",
    workIdeas: "Ideas",
    workProjects: "Projects",
    geoLocating: "Locating you…",
    geoNaming: "Location found, getting the place name…",
    geoPinned: "Location pinned on the map",
    geoOnMap: "Location on map",
    geoDenied: "Location access was blocked. Allow it in the browser or type the place.",
    geoFailed: "Couldn't get your location. Type the place instead.",
    geoUnavailable: "Location needs a secure (https) connection. Type the place instead.",
    bqPhoto: "Photo",
    bqVideo: "Video",
    bqPoll: "Poll",
    bqFile: "File",
    bqSoon: "File uploads aren't available yet. You can attach a photo or a video.",
    bqStoryCaption: "Add a caption (optional)",
    bqStoryNeedsMedia: "A story has to be a photo or a video.",
    bqAddMedia: "Add a photo or video",
    bqAddMediaSub: "Videos up to 60 seconds, compressed automatically before upload",
    bqUploading: "Uploading...",
    bqPreparing: "Preparing video... {n}%",
    bqUploadingPct: "Uploading... {n}%",
    bqUploadFail: "Upload failed. Please try again.",
    bqMediaBad: "Unsupported file. Use a photo or an MP4 / WebM / MOV video.",
    bqVideoBig: "That video is too large. Pick a shorter or lower-quality clip.",
    bqVideoLong: "That video is longer than 60 seconds.",
    bqReelsEmpty: "No reels yet. Reels are videos only, record the first one from your site.",
    bqAddStory: "Add a story",
    bqMute: "Mute",
    bqUnmute: "Unmute",
    bqClose: "Close",
    bqCamHint: "Tap for a photo, hold for a video",
    bqCamGallery: "Gallery",
    bqCamShutter: "Capture",
    bqCamFlip: "Flip camera",
    bqCamRetake: "Retake",
    bqCamOpenDevice: "Open device camera",
    bqCamUnsupported: "This browser can't use the camera here. Open the device camera or pick from the gallery.",
    bqCamDenied: "Camera access wasn't allowed. Enable it in browser settings or pick from the gallery.",
    bqCamMissing: "No camera found on this device. Pick a photo or video from the gallery.",
    navReels: "Reels",
    feedMenu: "Choose feed",
    exSearch: "Search",
    exEmpty: "No results",
    fpMore: "more",
    fpAllComments: "View all {n} comments",
    fpCopied: "Link copied",
    fpSwipe: "Swipe for details",
    igPosts: "Posts",
    igFollowers: "Followers",
    igFollowing: "Following",
    igEditProfile: "Edit profile",
    igShareProfile: "Share profile",
    igCopied: "Copied",
    igNewHighlight: "New",
    igHighlightNew: "New highlight",
    igHighlightEdit: "Edit highlight",
    igHighlightName: "Highlight name",
    igHighlightPick: "Pick stories. The first one you pick is the cover; long-press a story to make it the cover.",
    igHighlightDefault: "Highlight",
    igHighlightBtn: "Highlight",
    igArchiveEmpty: "You don't have past stories yet. Post a story, then add it to a highlight.",
    igCover: "Cover",
    igNeedPick: "Pick at least one story.",
    igDeleteHighlight: "Delete highlight",
    igDeleteAsk: "Delete this highlight? The stories themselves stay.",
    igDone: "Done",
    igCancel: "Cancel",
    igChangePhoto: "Change photo",
    igRemovePhoto: "Remove photo",
    igName: "Name",
    igRole: "Job title",
    igBio: "Bio",
    igLockedNote: "Name and title come from the employee file and can't be edited here.",
    igTabGrid: "Posts",
    igTabReels: "Videos",
    igTabIdeas: "Ideas",
    igTabSaved: "Saved",
    igEmptyGrid: "Share your first post",
    igEmptyReels: "No videos yet",
    igEmptyIdeas: "No ideas shared yet",
    igLevelLine: "{badge} · Level {n} · {pts} pts",
    bqCamTextPh: "Type your text",
    bqCamColor: "Change colour",
    bqCamFlash: "Flash",
    bqCamSettings: "Settings",
    bqCamNext: "Next",
    bqToolText: "Text",
    bqToolLoop: "Loop",
    bqToolLayout: "Layout",
    bqToolFilter: "Filters",
    bqToolHands: "Hands-free",
    bqToolTimer: "Timer",
    bqToolMore: "More",
    bqSetMirror: "Mirror front camera",
    bqSetLines: "Grid lines",
    bqSetSave: "Save a copy to my device after posting",
    bqFilterNone: "Normal",
    bqFilterWarm: "Warm",
    bqFilterCool: "Cool",
    bqFilterMono: "Mono",
    bqFilterVivid: "Vivid",
    bqFilterFade: "Fade",
    bqTextHint: "Type your text, tap the circle to change colour, then capture",
    bqTextEmpty: "Type some text first.",
    bqLoopHint: "Tap capture to record a short looping clip",
    bqLoopBusy: "Preparing your clip...",
    bqLayoutHint: "{n}-photo layout: take photo {i}",
    bqHandsOn: "Hands-free: tap once to start, again to stop",
    bqTimerOn: "{n}-second timer before capture",
    bqCamZoom: "Zoom",
    bqCamExposure: "Brightness",
    bqToolOff: "Turned off",
    bqFlashScreen: "This camera has no flash, so the screen will light up instead",
    bqMoreTypes: "More types",
    bqIdeaHub: "Idea Hub",
    bqNewIdea: "New Idea",
    bqFeatured: "Featured Challenge",
    bqChallengeSub: "Share your ideas and help us build a more efficient future.",
    bqJoin: "Join Challenge",
    bqExplore: "Explore",
    bqProjectsDepts: "Projects & Departments",
    bqProjectsDeptsSub: "Updates from sites and teams",
    bqRecognitionSub: "Badges for contributions, ideas and teamwork.",
    bqAnnouncements: "Company Announcements",
    bqAnnouncementsSub: "Important updates for all employees.",
    bqMessagesSub: "Talk to your colleagues",
    bqAlertsLead: "Follow comments, idea progress and company news.",
    bqViewAll: "View All",
    bqShowLess: "Show less",
    bqPts: "pts",
    bqComment: "Comment",
    bqShare: "Share",
    bqPeopleStory: "People",
    bqEditProfile: "Edit profile",
    chipInnovation: "Innovation",
    bqEmployeesOnly: "For Bin Quraya employees only",
    navIdeas: "Ideas",
    navIdeasSub: "Share and solve",
    navPeople: "People",
    navPeopleSub: "Connect and support",
    navProjects: "Projects",
    navProjectsSub: "See what's happening",
    navRecognition: "Recognition",
    navRecognitionSub: "Celebrate success",
    navGrowth: "Growth",
    navGrowthSub: "Build our future",
    chipAll: "All",
    chipFollowing: "Following",
    chipProjects: "Projects",
    chipRnd: "R&D",
    chipSafety: "Safety",
    chipDepts: "Departments",
    hubTop: "Top",
    hubReview: "In review",
    hubDone: "Implemented",
    topicOps: "Operations",
    topicMaint: "Maintenance",
    topicCost: "Cost saving",
    bqMakeIdea: "Make it an Idea",
    bqMakeIdeaSub: "Send to R&D for review",
    typeAnnouncement: "Announcement",
    bqMyPosts: "My posts",
    bqMyIdeas: "My ideas",
    bqMyTeams: "My teams",
    bqAchievements: "Achievements",
    bqLevel: "Level {n}",
    bqBadge: "Innovation contributor",
    bqPoints: "Points",
    bqMoments: "BQ Moments",
    bqMomentsLead: "Short clips from projects, innovation and safety.",
    bqStoriesTitle: "Stories",
    bqStoriesLead: "Quick updates from teams and events.",
    bqRankTitle: "Top contributors",
    bqRankLead: "Recognition is for people who post and take part in the app.",
    bqYourStory: "Your story",
    bqIdeasCount: "Ideas",
    bqPostsCount: "Posts",
    skip: "Skip to content",
    langGroup: "Language",
    brandSub: "Research & Development",
    navWelcome: "Welcome",
    navInspire: "Focus",
    navSubmit: "Share",
    navExplore: "Explore",
    navInbox: "Forum",
    ctaForum: "Enter the forum",
    loginTitle: "Sign in",
    loginLead: "Employees only. Badge, the last 4 ID digits, then the mobile number on file.",
    labelMobile: "Mobile number",
    phMobile: "05xxxxxxxx",
    loginSecure: "Your mobile is checked and stays hidden. A code is sent only when the text service is switched on.",
    labelOtp: "Verification code",
    phOtp: "••••••",
    confirmOtp: "Confirm code",
    otpSent: "We sent a code to your mobile. Enter it within 5 minutes.",
    otpBad: "That code is wrong or expired.",
    smsFailed: "The code could not be sent to your mobile. Try again shortly.",
    announceKicker: "Announcement",
    alertAnnounce: "Announcement from {name}",
    loginButton: "Sign in",
    logout: "Log out",
    drawerMenu: "Menu",
    drawerProfile: "Profile",
    drawerDept: "Your department",
    drawerSettings: "Settings",
    setAccount: "Your account",
    setAccountInfo: "Account information",
    setPrivacy: "Privacy and safety",
    setPrivacyBody: "Colleagues see your name, department, and position only. Your badge, ID, and mobile stay hidden.",
    setDisplay: "Display",
    setNotify: "Notifications",
    setMail: "Company announcements",
    setMore: "More",
    setAbout: "About Bin Quraya",
    setDept: "Department",
    setRole: "Position",
    setAccountNote: "Department and position come from the employee file and cannot be edited here. You can change your photo any time.",
    setPhotoChange: "Change profile photo",
    setPhotoHint: "Tap the circle to add a profile photo",
    setPhotoRemove: "Remove photo",
    postingAs: "Posting as {name}",
    navHome: "Home",
    navAlerts: "Notifications",
    navProfile: "Profile",
    alertLike: "{name} liked your {noun}",
    alertDislike: "{name} disliked your {noun}",
    alertComment: "{name} commented on your {noun}",
    alertStatus: "{name} moved your idea to {status}",
    alertMention: "{name} mentioned you {where}",
    alertThanks: "{name} thanked you",
    alertRepost: "{name} reposted your {noun}",
    alertComplaint: "{name} sent a complaint",
    alertMessage: "{name} sent you a message",
    statusLog: "Status log",
    alertAnon: "Someone",
    alertEmpty: "No notifications yet.",
    profileEmpty: "You have not posted an idea yet.",
    tabMine: "Your ideas",
    tabSaved: "Saved",
    savedEmpty: "You have not saved an idea yet.",
    editIdea: "Edit",
    saveLabel: "Save",
    newIdea: "Post",
    composerHint: "Share an idea with the team…",
    back: "Back",
    justNow: "now",
    minsAgo: "{n}m",
    hoursAgo: "{n}h",
    daysAgo: "{n}d",
    badge: "Bin Quraya · Research & Development",
    web: "Oil and gas · Pipelines · Heavy equipment",
    line1: "Ideas today.",
    line2: "A safer tomorrow.",
    footerEnd: "A safer tomorrow",
    lead: "An idea from a site, a workshop, or a pipeline can protect a whole crew.",
    thanks: "Thank you for being part of the Bin Quraya journey.",
    aboutKicker: "Bin Quraya",
    aboutTitle: "An oil and gas contractor. The ideas come from the field.",
    aboutLead: "Bin Quraya is one of the largest Saudi EPC companies in oil and gas. It started in Abqaiq, is now based in Dhahran, builds pipelines, plants and infrastructure, and runs one of the largest mobile crane fleets in the Middle East.",
    aboutSince: "Since 1975",
    aboutHeroTitle: "Building the Kingdom's energy from the field",
    aboutStatYears: "years in the field",
    aboutStatKm: "km of pipelines",
    aboutStatAssets: "equipment and assets",
    aboutStatCranes: "mobile cranes",
    aboutWhat: "What we do",
    aboutSvc1: "Full EPC projects",
    aboutSvc2: "Pipelines",
    aboutSvc3: "Plant shutdowns",
    aboutSvc4: "Mechanical and electrical",
    aboutSvc5: "Refineries and petrochemicals",
    aboutSvc6: "Power plants and grids",
    aboutSvc7: "Cathodic protection",
    aboutSvc8: "Roads, buildings and utilities",
    aboutSvc9: "Operations and maintenance",
    aboutDivisions: "Our divisions",
    aboutDivBuild: "Construction and oil and gas projects",
    aboutDivRental: "50 to 500 ton cranes and heavy equipment",
    aboutDivRig: "Drilling rig moves",
    aboutDivPower: "Generator rental and power",
    aboutJourney: "Our journey",
    aboutY1975: "ASCO founded in Abqaiq",
    aboutY1975s: "One crane, three trucks and 25 people subcontracting on Aramco projects.",
    aboutY1982: "Bin Quraya Est. is born",
    aboutY1982s: "Founded by Awad Bin Quraya and registered with Aramco as a mechanical contractor.",
    aboutY1986: "The East-West leap",
    aboutY1986s: "Long-form contracts on the East-West Pipeline reconditioning at Abqaiq, and a much bigger crane fleet.",
    aboutY2004: "New headquarters in Dhahran",
    aboutY2004s: "The fleet grows to loaders, bulldozers, graders and trucks.",
    aboutY2010: "Over 400 cranes",
    aboutY2010s: "One of the region's largest mobile crane fleets, plus design and build.",
    aboutY2020: "Expanding into power",
    aboutY2020s: "Electrical stations and civil works, with VR simulators for operator training.",
    aboutProjects: "Highlighted projects",
    aboutP1: "Khuff Gas Project",
    aboutP2: "Khafji NGL Pipeline",
    aboutP3: "Fuel Gas Pipeline PP10",
    aboutP4: "Natural gas distribution, Dammam 2nd Industrial City",
    aboutP5: "Northern Arabia unconventional gas facilities",
    aboutV1: "Safety first",
    aboutV2: "Quality",
    aboutV3: "Reliability",
    aboutApp: "The Bin Quraya staff space: official announcements, ideas, thanks and talk across departments and sites, in one place.",
    factYears: "Years of experience",
    factPeople: "Manpower",
    factPipes: "Kilometres of pipelines",
    factAssets: "Equipment and assets",
    cta: "Share your idea",
    pillarPeople: "People",
    pillarIdeas: "Ideas",
    pillarTech: "Technology",
    pillarImpact: "Impact",
    step1t: "Welcome",
    step1d: "Branded landing",
    step2t: "Get inspired",
    step2d: "Our focus areas",
    step3t: "Submit",
    step3d: "Quick simple form",
    step4t: "Confirmation",
    step4d: "Real-time feedback",
    step5t: "Explore",
    step5d: "Ongoing R&D work",
    principlesKicker: "Share",
    principlesTitle: "Share your ideas, and be part of what's next.",
    innovate: "Innovate",
    collaborate: "Collaborate",
    solve: "Solve",
    grow: "Grow",
    together: "Together we build a safer tomorrow.",
    inspireKicker: "Get inspired",
    inspireTitle: "What if your next idea changed how the site works?",
    inspireSub: "Safety, fleet, pipelines, workshops, and quality. A short idea can become a tool or a better way of working.",
    formKicker: "Share your idea",
    formTitle: "Every idea counts.",
    formLead: "Enter your badge number and the last 4 digits of your ID. Only your own name appears after verification. The employee list stays hidden.",
    labelPerson: "Confirm it's you",
    labelBadge: "Badge number",
    phBadge: "e.g. 112",
    labelCode: "Last 4 digits of your ID",
    phCode: "••••",
    verify: "Verify",
    verifying: "Checking…",
    changePerson: "Change",
    mismatch: "Those details do not match. Use the badge without a leading zero, the last 4 digits of the national ID, and the mobile on file, such as 05xxxxxxxx.",
    limited: "Too many attempts. Wait a moment and try again.",
    deptUnknown: "Not set",
    errPerson: "Verify your details before sending the idea.",
    labelTitle: "Idea title",
    labelArticleTitle: "Article title",
    labelArticle: "Article",
    phTitle: "A short title for the idea",
    labelIdea: "The idea",
    phIdea: "What exactly do you propose?",
    labelProblem: "The problem",
    phProblem: "What happens today that should change?",
    labelPros: "Pros",
    phPros: "Write a benefit",
    labelCons: "Cons",
    phCons: "Write a cost or obstacle",
    addPoint: "Add a point",
    labelImpact: "Expected impact",
    phImpact: "What changes if this is adopted?",
    labelPlace: "Where it applies",
    place_workshop: "Workshop",
    place_line: "Pipeline",
    place_fleet: "Fleet",
    place_office: "Office",
    place_site: "Site",
    place_warehouse: "Warehouse",
    place_other: "Other",
    phPlaceOther: "Type the place",
    namedMode: "My name",
    anonMode: "Anonymous",
    namedNote: "Your name and department appear with the idea.",
    anonNote: "Your name and department stay off the forum.",
    anonAuthor: "Anonymous",
    sortNew: "Newest",
    sortTop: "Top",
    likeLabel: "Like",
    dislikeLabel: "Dislike",
    peopleButton: "Activity",
    peopleTitle: "Who engaged",
    peopleLikes: "Likes",
    peopleDislikes: "Dislikes",
    peopleSaves: "Saves",
    peopleNone: "Nobody yet",
    peopleEmpty: "Nobody yet",
    sortGroup: "Sort ideas",
    commentsTitle: "Comments",
    commentPlaceholder: "Write a comment",
    commentSend: "Add comment",
    commentAnon: "Comment anonymously",
    rateLabel: "Your rating",
    noComments: "No comments yet. Be the first to respond.",
    needVerify: "Verify your badge in the share form before commenting.",
    submit: "Post",
    sending: "Sending…",
    savedLocal: "The employee directory needs the site server to be running.",
    errDirectory: "The employee directory could not be reached.",
    exploreKicker: "Inside R&D",
    exploreTitle: "Turning ideas into real impact.",
    exploreCta: "Have a bigger idea?",
    exploreCtaSub: "Let's build it together.",
    inboxKicker: "Forum",
    inboxTitle: "Team ideas",
    inboxLead: "Every post uses your name. Share an idea, suggestion, complaint, or thanks.",
    inboxSearch: "Search posts, people, and departments",
    feedFollowing: "Following",
    feedForYou: "For you",
    feedCompany: "Company",
    feedToday: "Today",
    typePost: "Post",
    typeIdea: "Idea",
    openIdea: "Open idea",
    ideaMore: "and {n} more",
    typeSuggestion: "Suggestion",
    typeComplaint: "Complaint",
    typeThanks: "Thanks",
    typeStory: "Story",
    typePoll: "Poll",
    typeArticle: "Article",
    readArticle: "Read article",
    postPhoto: "Photo",
    photoBig: "That photo is too large.",
    thanksTo: "Thank",
    pollOptions: "Choices",
    pollPh: "Choice",
    mention: "Mention a colleague",
    repost: "Repost",
    follow: "Follow",
    following: "Following",
    bio: "A short line about you",
    saveBio: "Save profile",
    tabSuggestions: "Suggestions",
    tabThanks: "Thanks",
    navMessages: "Messages",
    navGroups: "Groups",
    mailLead: "Connect your company email. Only mail from announce@binquraya.com is shown.",
    mailUser: "name@binquraya.com",
    mailPass: "Google app password",
    mailConnect: "Connect mail",
    mailBad: "Use an @binquraya.com email and an app password.",
    mailOk: "Connected. Announcements will show in notifications.",
    achievementTitle: "Achievement title",
    achievementText: "Write a department achievement or update",
    achievementAdd: "Add achievement",
    achievementEmpty: "No achievements for this department yet.",
    dmSearch: "Search messages",
    dmPlaceholder: "Write a message",
    dmSend: "Send",
    dmEmpty: "No messages yet.",
    dmHint: "Start the conversation",
    dmPhoto: "Photo",
    dmAttach: "Photo or GIF",
    dmReply: "Reply",
    dmUnsend: "Delete",
    dmTooBig: "That image is too large. Use a smaller one.",
    dmReplying: "Replying to {name}",
    groupName: "Group or site name",
    groupCreate: "Create",
    groupEmpty: "No groups yet.",
    groupLead: "Every company department from the employee file. Open one to see its profile and achievements.",
    groupMine: "Your department",
    groupFeed: "Group posts",
    deptFollow: "Follow department",
    deptFollowing: "Department followed",
    deptPeople: "People",
    deptPosts: "Posts",
    deptWins: "Achievements",
    deptSearch: "Search people in this department",
    membersCount: "{n} employees",
    personMessage: "Message",
    peopleEmpty: "No employees match that name.",
    loadMore: "Show more",
    searchPeople: "People",
    searchDepts: "Departments",
    inboxEmpty: "No ideas yet. Be the first to share one.",
    inboxNoMatch: "No matching ideas.",
    anonymous: "Anonymous",
    statusReceived: "Received",
    statusReview: "Under review",
    statusProject: "Became a project",
    statusResolved: "Resolved",
    statusLocked: "An idea starts as received. Only a manager in the department can change it.",
    remove: "Delete",
    removeAsk: "Delete this idea?",
    confirmQuote: "“Progress starts with people who care.”",
    sparkKicker: "Today's challenge",
    sparkGo: "Share your idea",
    sparkLaunch: "Answer your department's question and shape the card",
    sparkLive: "Refreshes tomorrow",
    angleLead: "Start from an angle",
    angleTime: "Save the team's time",
    angleSafe: "Make it safer",
    angleWaste: "Cut the waste",
    angleInfo: "Get information there faster",
    strengthLabel: "Idea completeness {n}%",
    sparkDept: "Your department has shared {n} ideas. Add yours.",
    sparkDeptEmpty: "Be the first in your department to share an idea.",
    sparkFor: "{name} question · refreshes daily",
    sparkForAll: "Today's question · refreshes daily",
    studioIdea: "Idea",
    studioProblem: "Problem",
    studioBalance: "Balance",
    studioImpact: "Impact",
    studioNext: "Next",
    studioBack: "Back",
    studioHint1: "Write the title and idea as if you were explaining it to a teammate on site.",
    studioHint2: "Pick where it applies, then describe the problem as it happens today.",
    studioHint3: "Put the pros beside the cons so the decision is clear.",
    studioHint4: "This is the idea before you send it. Add the impact if it is missing.",
    rankReady: "Ready",
    rankStart: "Starter",
    rankContributor: "Contributor",
    rankMaker: "Maker",
    rankLead: "Idea lead",
    statIdeas: "Ideas",
    statLikes: "Likes",
    statPoints: "Points",
    rankLeft: "{n} points to reach {rank}.",
    rankTop: "You are at the top rank. Keep going.",
    pointsHow: "How points add up",
    pointIdea: "Each idea",
    pointLike: "Each like",
    pointReply: "Each reply",
    pointProject: "Each project",
    pointTotal: "Total",
    raceKicker: "Department race",
    raceEmpty: "The first department to post an idea leads the race.",
    boostIdea: "Support a colleague: {title}",
    hotIdea: "Most active",
    statShared: "Ideas shared",
    statReview: "Under review",
    statProjects: "Became projects",
    errTitle: "Add a title for the idea.",
    errRequired: "Write the idea details before sending.",
    errFailed: "The idea could not be sent. Try again.",
    bqAddMore: "Add photos",
    bqGalleryMax: "Up to 10 photos per post.",
    bqGalleryNoVideo: "A video is posted on its own. Remove it to add several photos.",
    tagsTrending: "Trending hashtags",
    tagPosts: "{n} posts",
    pmReport: "Report",
    pmCopyLink: "Copy link",
    pmShare: "Share",
    pmOpen: "View post",
    pmEdit: "Edit",
    pmDelete: "Delete",
    pmHide: "Hide post",
    pmCancel: "Cancel",
    reportTitle: "Why are you reporting this post?",
    reportLead: "Reports are private. The author won't know who reported.",
    reasonSpam: "Spam or repeated",
    reasonOffensive: "Offensive or inappropriate",
    reasonFalse: "False information",
    reasonPrivate: "Reveals private information",
    reasonOther: "Something else",
    reportThanks: "Thanks. We got your report and you won't see this post again.",
    reportFail: "The report could not be sent. Try again.",
    hiddenOwner: "Hidden from colleagues after review",
    alertReport: "New report on a post",
    alertReportAuto: "A post was hidden automatically after several reports",
    alertHidden: "Your post was hidden after a moderator review",
    alertRestored: "Your post is visible to colleagues again",
    drawerMod: "Moderation",
    modTitle: "Moderation",
    modLead: "Reported and hidden posts. Reports are private.",
    modEmpty: "No reports. All clear.",
    modReports: "{n} reports",
    modHiddenAuto: "Hidden automatically",
    modHiddenMod: "Hidden by a moderator",
    modHide: "Hide",
    modRestore: "Show",
    modDismiss: "Dismiss",
    modOpen: "View",
    drawerDash: "Dashboard",
    dashTitle: "Dashboard",
    dash7: "7 days",
    dash30: "30 days",
    dash90: "90 days",
    dash365: "Year",
    dashPosts: "Posts",
    dashIdeas: "Ideas",
    dashComments: "Comments",
    dashLikes: "Likes",
    dashActive: "Active employees",
    dashOfEmployees: "of {n} employees",
    dashFunnel: "Idea pipeline",
    dashConversion: "{n}% of ideas became projects",
    dashReviewDays: "Average time to review: {n} days",
    dashProjectDays: "Average time to project: {n} days",
    dashComplaints: "Complaints",
    dashOpen: "Open",
    dashResolved: "Resolved",
    dashResolveDays: "Average time to resolve: {n} days",
    dashWeekly: "Activity, last 12 weeks",
    dashDepts: "Top contributing departments",
    dashParticipation: "{n}% participating",
    dashTopIdeas: "Top ideas",
    dashContributors: "Top contributors",
    dashPoints: "{n} pts",
    dashReported: "Reported",
    dashHidden: "Hidden",
    dashOpenMod: "Open moderation",
    dashEmpty: "No data for this period.",
    dashLoading: "Loading…",
    dashFail: "The dashboard could not load.",
    setTheme: "Appearance",
    themeSystem: "Match device",
    themeLight: "Light",
    themeDark: "Dark",
    themeHint: "Light is the default. Dark and Match device are optional.",
    setPrivacySub: "Password, two-step verification, devices",
    setTfaOn: "Protected",
    setTfaOff: "Turn on",
    setInstalled: "Installed",
    setInstall: "Install the app",
    installLead: "Install BQ Connect on your phone's home screen. It opens full screen like any app.",
    installBtn: "Install app",
    installDone: "The app is installed. Open it from your home screen.",
    installPerk1: "An icon on your home screen",
    installPerk2: "Opens full screen without the browser bar",
    installPerk3: "Opens faster and updates itself",
    installAnd1: "Open the BQ Connect link in Chrome.",
    installAnd2: "Tap the ⋮ menu at the top and choose \"Install app\" or \"Add to Home screen\".",
    installAnd3: "Tap \"Install\". BQ Connect appears on your home screen and in your app list.",
    installIos1: "Open the BQ Connect link in Safari.",
    installIos2: "Tap the Share button (the square with an arrow) at the bottom.",
    installIos3: "Scroll down, choose \"Add to Home Screen\", then \"Add\".",
    installHttps: "Installing needs the official secure link (starting with https). Open the app from the link IT sends you, then install it.",
  },
};

const DEPT_LABELS = {
  "Construction Department": "الإنشاءات",
  "Logistics Department": "الخدمات اللوجستية",
  "Facility & Maintainance Department": "المرافق والصيانة",
  "Fabrication Department": "التصنيع",
  "Corporate HSE Department": "السلامة",
  "Quality Department": "الجودة",
  "Engineering Department": "الهندسة",
  "Warehouse Department": "المستودعات",
  "Procurement Department": "المشتريات",
  "Project Control Department": "ضبط المشاريع",
  "CEO": "مكتب الرئيس التنفيذي",
  "HR Department": "الموارد البشرية",
  "Finance Department": "المالية",
  "Admimistration Department": "الشؤون الإدارية",
  "IT Department": "تقنية المعلومات",
  "Technical Department": "القسم الفني",
  "HR - Medical Devision": "الطبية",
  "Subcontract Department": "العقود من الباطن",
  "SAP Department": "ساب",
  "Internal Audit Department": "المراجعة الداخلية",
  "Supply Chain Departmnet": "سلسلة الإمداد",
  "Transport Department": "النقل",
  "Bus Driver": "النقل",
  "Jafurah": "الجافورة",
};

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const areas = [
  { id: "safety", ar: "السلامة في المواقع", en: "Site safety", icon: `<svg viewBox="0 0 48 48"><path d="M24 6 10 12v12c0 10 6 16 14 18 8-2 14-8 14-18V12L24 6z" ${stroke}/><path d="m17 24 5 5 9-10" ${stroke}/></svg>` },
  { id: "fleet", ar: "الأسطول والمعدات الثقيلة", en: "Fleet and heavy equipment", icon: `<svg viewBox="0 0 48 48"><path d="M6 30V18h18l6 8h10v4" ${stroke}/><circle cx="16" cy="32" r="3" ${stroke}/><circle cx="34" cy="32" r="3" ${stroke}/></svg>` },
  { id: "pipes", ar: "خطوط الأنابيب والإنشاء", en: "Pipelines and construction", icon: `<svg viewBox="0 0 48 48"><path d="M8 30h32M14 30V16h8v14M26 30V12h8v18" ${stroke}/></svg>` },
  { id: "fab", ar: "الورش والتصنيع", en: "Workshops and fabrication", icon: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="6" ${stroke}/><path d="M24 8v4M24 36v4M8 24h4M36 24h4M12 12l3 3M33 33l3 3M36 12l-3 3M15 33l-3 3" ${stroke}/></svg>` },
  { id: "quality", ar: "الجودة والاعتمادية", en: "Quality and reliability", icon: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" ${stroke}/><path d="m16 24 5 5 11-12" ${stroke}/></svg>` },
  { id: "sustainability", ar: "الطاقة والاستدامة", en: "Energy and sustainability", icon: `<svg viewBox="0 0 48 48"><path d="M24 40V22" ${stroke}/><path d="M24 26c-8-1-14-8-14-16 8 0 15 4 16 12 1-8 8-12 16-12 0 8-6 15-14 16" ${stroke}/></svg>` },
];

const projects = [
  {
    arTitle: "سلامة المعدات الثقيلة",
    enTitle: "Safer heavy equipment",
    arSub: "حول الرافعة والحفار وخط الأنابيب",
    enSub: "Around cranes, excavators, and pipelines",
    arBlurb: "أفكار تقلل الخطر حول الرافعات والحفارات ومواقع الخطوط قبل ما يوصل للفريق.",
    enBlurb: "Ideas that cut risk around cranes, excavators, and pipeline spreads before it reaches the crew.",
    art: `<svg viewBox="0 0 320 180"><rect width="320" height="180" fill="#141820"/><path d="M0 130 L70 90 L120 120 L190 70 L250 115 L320 80 L320 180 L0 180 Z" fill="#222733"/><rect x="150" y="78" width="90" height="18" rx="8" fill="#3a4252"/><circle cx="168" cy="100" r="8" fill="#0d0f14"/><circle cx="214" cy="100" r="8" fill="#0d0f14"/><path d="M40 40h36M40 40v28M244 36h36M280 36v28M40 112h36M76 112v-28M244 116h36M244 116v-28" fill="none" stroke="#ff2b2b" stroke-width="2"/></svg>`,
  },
  {
    arTitle: "أسطول أوضح",
    enTitle: "A clearer fleet",
    arSub: "رافعات، نقل، ومعدات التأجير",
    enSub: "Cranes, transport, and rental equipment",
    arBlurb: "معرفة وين المعدة، وكم توقفت، وكيف نرجّعها للشغل أسرع.",
    enBlurb: "Know where the machine is, how long it stopped, and how to get it back to work sooner.",
    art: `<svg viewBox="0 0 320 180"><rect width="320" height="180" fill="#12151c"/><path d="M0 150h320" stroke="#2c3342" stroke-width="8"/><g fill="#e0b000"><rect x="36" y="78" width="70" height="36" rx="4"/><rect x="130" y="70" width="78" height="44" rx="4"/><rect x="224" y="84" width="64" height="30" rx="4"/></g><circle cx="54" cy="120" r="8" fill="#111"/><circle cx="90" cy="120" r="8" fill="#111"/><circle cx="150" cy="120" r="8" fill="#111"/><circle cx="190" cy="120" r="8" fill="#111"/></svg>`,
  },
  {
    arTitle: "إيقافات أذكى",
    enTitle: "Smarter turnarounds",
    arSub: "صيانة المصانع بوقت أقل",
    enSub: "Plant shutdowns in less time",
    arBlurb: "ترتيب الشغل المتكرر في الإيقافات والورش بخطوات أوضح ومخاطر أقل.",
    enBlurb: "Repeatable shutdown and workshop work, with clearer steps and less risk.",
    art: `<svg viewBox="0 0 320 180"><rect width="320" height="180" fill="#10141b"/><path d="M70 150 V40 H150" fill="none" stroke="#8d93a3" stroke-width="8"/><path d="M150 40 H230 L250 70" fill="none" stroke="#ff2b2b" stroke-width="6"/><rect x="40" y="140" width="70" height="16" fill="#2a3140"/><circle cx="250" cy="78" r="10" fill="#d7dbe6"/></svg>`,
  },
  {
    arTitle: "طاقة أوفر",
    enTitle: "Energy that goes further",
    arSub: "تشغيل أخف على الموقع",
    enSub: "Lighter operations on site",
    arBlurb: "هدر أقل وطاقة أذكى في التشغيل، بما يوافق توجه بن قريعة لتوفير الطاقة.",
    enBlurb: "Less waste and smarter energy in operations, in line with Bin Quraya's move toward energy saving.",
    art: `<svg viewBox="0 0 320 180"><rect width="320" height="180" fill="#101612"/><rect x="70" y="70" width="70" height="80" fill="#243028"/><rect x="160" y="46" width="90" height="104" fill="#1c2820"/><rect x="178" y="62" width="16" height="16" fill="#8fb89a"/><rect x="206" y="62" width="16" height="16" fill="#8fb89a"/><rect x="178" y="90" width="16" height="16" fill="#8fb89a"/><path d="M40 120c20-30 40-30 50-10" fill="none" stroke="#3f8f55" stroke-width="4"/><path d="M0 150h320" stroke="#1a2a1e" stroke-width="16"/></svg>`,
  },
];

let lang = document.documentElement.lang === "en" ? "en" : "ar";
let ideas = [];
let stats = computeStats([]);
let mode = "api";
let sending = false;
let selectedPerson = null;
let sortMode = "new";
let openId = null;
let openComment = null;
let threadWrite = false;
let threadJump = false;
let reelsFocus = null;
let reelsOpening = false;
let view = "home";
let backView = "home";
let profileTab = "grid";
let editingId = null;
let placeChoice = "";
let feedMode = "foryou";
let hubPeriod = "all";
let hubDay = "";
let hubOrder = "new";
let projectChip = "all";
let momentChip = "all";
let tagOpen = false;
let rankAll = false;
const SCREEN_IDS = ["#feed", "#alerts", "#profile", "#person", "#groups", "#department", "#settings", "#recognition", "#growth", "#explore", "#search", "#storyboard", "#announcements", "#moderation", "#dashboard"];
let postType = "idea";
let postMedia = "";
let postExtra = [];
const GALLERY_LIMIT = 10;
let ideaStep = 1;
let sparkPack = null;
let thanksPid = "";
let mentionPids = [];
let mentionNames = {};
let activeGroup = "";
let activeDept = "";
let deptQuery = "";
let deptPage = 0;
let deptTab = "people";
const PLACES = ["workshop", "line", "fleet", "office", "site", "warehouse", "other"];
let alerts = [];
let alertTimer = null;

const form = document.querySelector("#idea-form");
const titleInput = document.querySelector("#title");
const problemInput = document.querySelector("#problem");
const ideaInput = document.querySelector("#idea");
const impactInput = document.querySelector("#impact");
const badgeInput = document.querySelector("#badge");
const verifyButton = document.querySelector("#verify-btn");
const personCard = null;
const personSearchWrap = null;
const counter = document.querySelector("#counter");
const formError = document.querySelector("#form-error");
const loginError = document.querySelector("#login-error");
const gate = document.querySelector("#gate");
const composeDialog = document.querySelector("#compose");
const searchInput = document.querySelector("#inbox-search");
const hubQuery = document.querySelector("#hub-query");
let hubSearchTimer = 0;
const ideasCache = new Map();
let ideasSeq = 0;
const feedView = document.querySelector("#feed");
const detailView = document.querySelector("#detail");

function voterId() {
  let id = localStorage.getItem("rd-voter");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("rd-voter", id);
  }
  return id;
}

function authorBits(item) {
  const author = item && item.author && item.author.name ? item.author : null;
  const name = author ? author.name : item && item.name;
  if (!name) return { name: "—", meta: "", initial: "•" };
  const department = author ? author.department : item.department;
  return {
    name,
    meta: department ? deptLabel(department) : "",
    position: author ? author.position || "" : item.position || "",
    initial: name.trim().charAt(0),
    official: Boolean(author ? author.official : item.official),
    photo: (author ? author.photo : item.photo) || "",
  };
}

function authorPid(item) {
  return String((item && item.author && item.author.pid) || (item && item.pid) || "");
}

function personLink(node, pid) {
  if (!pid) return node;
  node.classList.add("person-link");
  node.setAttribute("role", "link");
  node.tabIndex = 0;
  const go = (event) => {
    event.stopPropagation();
    openPerson(pid);
  };
  node.addEventListener("click", go);
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter") go(event);
  });
  return node;
}

function statusLabel(status) {
  if (status === "review") return t("statusReview");
  if (status === "project") return t("statusProject");
  if (status === "resolved") return t("statusResolved");
  if (!status) return "";
  return t("statusReceived");
}

function fullTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return t("justNow");
  if (minutes < 60) return tf("minsAgo", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tf("hoursAgo", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return tf("daysAgo", { n: days });
  return formatDate(iso);
}

function paintAvatar(node, person) {
  if (!node) return;
  const official = Boolean(person && person.official);
  const photo = !official && person && person.photo ? person.photo : "";
  node.textContent = "";
  node.classList.remove("avatar-ghost");
  node.classList.toggle("avatar-official", official);
  node.classList.toggle("avatar-default", !official && !photo);
  node.style.backgroundImage = photo ? `url("${photo}")` : "";
}

function avatarNode(bits) {
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  if (bits.initial === "؟") {
    avatar.classList.add("avatar-anon");
    avatar.textContent = bits.initial;
  } else paintAvatar(avatar, bits);
  return avatar;
}

function t(key) {
  return dict[lang][key] || "";
}

function tf(key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

function pad(number) {
  return String(number).padStart(4, "0");
}

function computeStats(list) {
  return {
    shared: BASE_SHARED + list.length,
    review: BASE_REVIEW + list.filter((idea) => idea.status === "review").length,
    projects: BASE_PROJECTS + list.filter((idea) => idea.status === "project").length,
    nextNumber: BASE_SHARED + list.length + 1,
  };
}

function deptLabel(name) {
  if (!name || name === "BQ Family") return "";
  if (lang === "en") return name;
  return DEPT_LABELS[name] || name;
}

function personMeta(person) {
  return [person.badge ? `#${person.badge}` : "", deptLabel(person.department), person.position]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(iso) {
  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = t("title");
  localStorage.setItem("rd-lang", lang);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    el.alt = t(el.dataset.i18nAlt);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-set-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.setLang === lang);
  });

  syncFormMode();
  syncPointPlaceholders();
  renderPlaceOptions();
  renderPerson();
  renderAreas();
  renderProjects();
  renderPulse();
  renderInbox();
  renderProfile();
  if (view === "person" && typeof paintPerson === "function") paintPerson();
  if (typeof refreshTerms === "function") refreshTerms();
}

function renderPerson() {
  renderAccount();
}

function renderAccount() {
  if (!selectedPerson) return;
  ["#account-avatar", "#drawer-avatar", "#composer-avatar", "#compose-avatar"].forEach((selector) => paintAvatar(document.querySelector(selector), selectedPerson));
  const composeName = document.querySelector("#compose-name");
  const composeMeta = document.querySelector("#compose-meta");
  if (composeName) composeName.textContent = selectedPerson.name;
  if (composeMeta) composeMeta.textContent = [deptLabel(selectedPerson.department), selectedPerson.position].filter(Boolean).join(" · ");
  document.querySelector("#drawer-name").textContent = selectedPerson.name;
  if (selectedPerson.official) document.querySelector("#drawer-name").appendChild(officialMark());
  document.querySelector("#drawer-meta").textContent = [deptLabel(selectedPerson.department), selectedPerson.position].filter(Boolean).join(" · ");
  document.querySelector("#drawer-bio").textContent = selectedPerson.bio || "";
  const deptButton = document.querySelector('[data-drawer="department"]');
  if (deptButton) deptButton.hidden = !deptLabel(selectedPerson.department);
  document.querySelector('[data-drawer="moderation"]').hidden = !selectedPerson.moderator || selectedPerson.dashboard;
  document.querySelector('[data-drawer="dashboard"]').hidden = !selectedPerson.dashboard;
  ["profile", "saved"].forEach((key) => {
    document.querySelector(`[data-drawer="${key}"]`).hidden = Boolean(selectedPerson.adminAccount);
  });
}

function showGate() {
  closeStoryViewer();
  gate.hidden = false;
  document.querySelector(".app").hidden = true;
  const splash = document.querySelector("#splash");
  if (splash) splash.hidden = false;
  document.querySelectorAll("#gate .gate-card").forEach((card) => {
    card.hidden = true;
  });
}

function showApp() {
  gate.hidden = true;
  document.body.dataset.screen = view || "home";
  document.body.dataset.official = selectedPerson && selectedPerson.announcer ? "1" : "";
  document.body.dataset.adminAccount = selectedPerson && selectedPerson.adminAccount ? "1" : "";
  document.querySelector(".app").hidden = false;
  renderAccount();
  if (selectedPerson && selectedPerson.adminAccount && (view === "home" || !view)) showView("dashboard");
  startAlerts();
  loadSpark();
  if (selectedPerson && !selectedPerson.terms) openTerms(true);
}

function startAlerts() {
  loadAlerts();
  if (alertTimer) clearInterval(alertTimer);
  alertTimer = setInterval(loadAlerts, 20000);
}

function stopAlerts() {
  if (alertTimer) clearInterval(alertTimer);
  alertTimer = null;
}

function saveSession(person, token) {
  selectedPerson = { ...person, token };
  localStorage.setItem("rd-session", JSON.stringify({ token }));
  showApp();
}

function clearSession() {
  if (typeof pushForget === "function") pushForget(selectedPerson);
  selectedPerson = null;
  ideasCache.clear();
  localStorage.removeItem("rd-session");
  closeDrawer();
  stopAlerts();
  alerts = [];
  showGate();
}

async function restoreSession() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("rd-session") || "null");
  } catch {
    saved = null;
  }
  if (!saved || !saved.token) return false;
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: saved.token }),
  });
  if (!response.ok) {
    localStorage.removeItem("rd-session");
    return false;
  }
  const data = await response.json();
  selectedPerson = { ...data.person, token: saved.token };
  return true;
}

function asciiDigits(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function renderAreas() {
  const grid = document.querySelector("#area-grid");
  if (!grid) return;
  grid.replaceChildren();
  areas.forEach((area) => {
    const card = document.createElement("article");
    card.className = "area";
    card.innerHTML = area.icon;
    const label = document.createElement("span");
    label.textContent = area[lang];
    card.appendChild(label);
    grid.appendChild(card);
  });
}

function renderProjects() {
  const grid = document.querySelector("#project-grid");
  if (!grid) return;
  grid.replaceChildren();
  const titleKey = lang === "ar" ? "arTitle" : "enTitle";
  const subKey = lang === "ar" ? "arSub" : "enSub";
  const blurbKey = lang === "ar" ? "arBlurb" : "enBlurb";
  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project";
    const art = document.createElement("div");
    art.className = "project-art";
    art.innerHTML = project.art;
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = project[titleKey];
    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = project[subKey];
    const blurb = document.createElement("p");
    blurb.className = "blurb";
    blurb.textContent = project[blurbKey];
    copy.append(title, sub, blurb);
    card.append(art, copy);
    grid.appendChild(card);
  });
}

function statBlock(value, label) {
  const block = document.createElement("div");
  block.className = "stat";
  const number = document.createElement("b");
  number.textContent = String(value);
  const caption = document.createElement("span");
  caption.textContent = label;
  block.append(number, caption);
  return block;
}

function renderPulse() {
  const pulse = document.querySelector("#pulse");
  if (!pulse) return;
  pulse.replaceChildren(
    statBlock(stats.shared, t("statShared")),
    statBlock(stats.review, t("statReview")),
    statBlock(stats.projects, t("statProjects"))
  );
}

function pointBox(kind) {
  return document.querySelector(kind === "pros" ? "#pros-rows" : "#cons-rows");
}

function syncPointAdd(kind) {
  const button = document.querySelector(`[data-point-add="${kind}"]`);
  if (button) button.hidden = pointBox(kind).children.length >= 8;
}

function displayPlace(value) {
  const text = String(value || "").trim();
  const point = geoPoint(text);
  if (point) return point.name || t("geoPinned");
  if (PLACES.includes(text) && text !== "other") return t("place_" + text);
  return text;
}

function geoPoint(value) {
  const match = /^geo:(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:;(.{1,60}))?$/.exec(String(value || "").trim());
  return match ? { lat: match[1], lng: match[2], name: (match[3] || "").trim() } : null;
}

async function placeName(lat, lng) {
  if (!selectedPerson) return "";
  try {
    const response = await fetch("/api/place-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token, lat, lng, lang }),
    });
    if (!response.ok) return "";
    const data = await response.json();
    return String(data.name || "").replace(/[;|]/g, " ").trim().slice(0, 55);
  } catch {
    return "";
  }
}

function mapUrl(point) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

function locateMe() {
  const input = document.querySelector("#post-place");
  const label = document.querySelector("#row-place-val");
  if (geoPoint(input.value)) {
    input.value = "";
    paintComposeRows();
    return;
  }
  if (!navigator.geolocation || !window.isSecureContext) {
    formError.textContent = t("geoUnavailable");
    input.hidden = false;
    input.focus();
    return;
  }
  label.textContent = t("geoLocating");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const point = `geo:${position.coords.latitude.toFixed(5)},${position.coords.longitude.toFixed(5)}`;
      input.value = point;
      input.hidden = true;
      if (postType === "idea") setPlaceValue("");
      formError.textContent = "";
      label.textContent = t("geoNaming");
      const name = await placeName(position.coords.latitude, position.coords.longitude);
      if (name && input.value === point) input.value = `${point};${name}`;
      paintComposeRows();
    },
    (error) => {
      formError.textContent = t(error.code === 1 ? "geoDenied" : "geoFailed");
      input.hidden = false;
      paintComposeRows();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

function renderPlaceOptions() {
  const box = document.querySelector("#place-options");
  if (!box) return;
  box.replaceChildren();
  PLACES.forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-option";
    button.dataset.place = key;
    button.textContent = t("place_" + key);
    button.addEventListener("click", () => {
      placeChoice = placeChoice === key ? "" : key;
      const pinned = document.querySelector("#post-place");
      if (placeChoice && pinned.value) {
        pinned.value = "";
        pinned.hidden = true;
        paintComposeRows();
      }
      syncPlace();
    });
    box.appendChild(button);
  });
  syncPlace();
}

function syncPlace() {
  document.querySelectorAll(".place-option").forEach((button) => {
    const on = button.dataset.place === placeChoice;
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const other = document.querySelector("#place-other");
  if (!other) return;
  other.hidden = placeChoice !== "other";
  if (placeChoice !== "other") other.value = "";
}

function placeValue() {
  if (placeChoice === "other") return document.querySelector("#place-other").value.trim();
  return placeChoice;
}

function setPlaceValue(value) {
  const text = String(value || "").trim();
  const other = document.querySelector("#place-other");
  const known = PLACES.find((key) => key !== "other" && (key === text || dict.ar["place_" + key] === text || dict.en["place_" + key] === text));
  placeChoice = known || (text ? "other" : "");
  if (other) other.value = known || !text ? "" : text;
  syncPlace();
}

function syncPointPlaceholders() {
  document.querySelectorAll("#pros-rows input").forEach((input) => {
    input.placeholder = t("phPros");
  });
  document.querySelectorAll("#cons-rows input").forEach((input) => {
    input.placeholder = t("phCons");
  });
}

function addPointRow(kind, value) {
  const box = pointBox(kind);
  if (!box || box.children.length >= 8) return null;
  const row = document.createElement("label");
  row.className = "point-row";
  const bullet = document.createElement("span");
  bullet.className = "point-bullet";
  bullet.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.maxLength = 160;
  input.value = value || "";
  input.placeholder = t(kind === "pros" ? "phPros" : "phCons");
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const rows = [...box.querySelectorAll("input")];
      const index = rows.indexOf(input);
      const next = rows[index + 1];
      if (next) next.focus();
      else {
        const created = addPointRow(kind, "");
        if (created) created.querySelector("input").focus();
      }
    }
    if (event.key === "Backspace" && !input.value && box.children.length > 1) {
      event.preventDefault();
      const previous = row.previousElementSibling;
      row.remove();
      syncPointAdd(kind);
      const focus = previous ? previous.querySelector("input") : box.querySelector("input");
      if (focus) focus.focus();
    }
  });
  row.append(bullet, input);
  box.appendChild(row);
  syncPointAdd(kind);
  return row;
}

function setPointRows(kind, lines) {
  const box = pointBox(kind);
  if (!box) return;
  box.replaceChildren();
  const list = Array.isArray(lines) && lines.length ? lines.slice(0, 8) : [""];
  list.forEach((line) => addPointRow(kind, line));
}

function readPointRows(kind) {
  const box = pointBox(kind);
  if (!box) return [];
  return [...box.querySelectorAll("input")].map((input) => input.value.trim()).filter(Boolean).slice(0, 8);
}

function briefChips(idea) {
  const bits = [];
  if (idea.place) bits.push(displayPlace(idea.place));
  if (idea.pros && idea.pros.length) bits.push(`${idea.pros.length} ${t("labelPros")}`);
  if (idea.cons && idea.cons.length) bits.push(`${idea.cons.length} ${t("labelCons")}`);
  if (!bits.length) return null;
  const row = document.createElement("p");
  row.className = "chips";
  row.textContent = bits.join("  ·  ");
  return row;
}

function pointList(items, kind) {
  const list = document.createElement("ul");
  list.className = `points ${kind}`;
  items.forEach((item) => {
    const line = document.createElement("li");
    line.textContent = item;
    list.appendChild(line);
  });
  return list;
}

function briefSection(label, content, kind) {
  if (!content || (Array.isArray(content) && !content.length)) return null;
  const section = document.createElement("section");
  section.className = "brief";
  const heading = document.createElement("h4");
  heading.textContent = label;
  section.appendChild(heading);
  if (Array.isArray(content)) section.appendChild(pointList(content, kind));
  else {
    const paragraph = document.createElement("p");
    paragraph.textContent = content;
    section.appendChild(paragraph);
  }
  return section;
}

function appendBrief(parent, idea) {
  [
    briefSection(t("labelPlace"), displayPlace(idea.place)),
    briefSection(t("labelProblem"), idea.problem),
    briefSection(t("labelPros"), idea.pros, "pros"),
    briefSection(t("labelCons"), idea.cons, "cons"),
    briefSection(t("labelImpact"), idea.impact),
  ].forEach((section) => {
    if (section) parent.appendChild(section);
  });
}

function ideaHaystack(idea) {
  const author = idea.author || {};
  return [
    pad(idea.number),
    idea.title,
    idea.text,
    idea.problem,
    idea.impact,
    idea.place,
    displayPlace(idea.place),
    ...(idea.pros || []),
    ...(idea.cons || []),
    author.name,
    author.position,
    author.department || "",
    DEPT_LABELS[author.department] || "",
    idea.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

function foldSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/\s+/g, " ")
    .trim();
}

function searchWords(query) {
  const folded = foldSearch(query).replace(/^#(?=\d)/, "");
  return folded ? folded.split(" ").map((word) => word.replace(/^ال(?=\S{2})/, "")) : [];
}

function searchQuery(query) {
  const words = searchWords(query);
  const depts = !words.length ? [] : Object.keys(DEPT_LABELS)
    .filter((name) => words.every((word) => foldSearch(`${name} ${DEPT_LABELS[name]}`).includes(word)))
    .slice(0, 12);
  return { q: query, depts };
}

const haystacks = new WeakMap();

function ideaMatches(idea, words) {
  if (!words.length) return true;
  let text = haystacks.get(idea);
  if (text === undefined) {
    text = foldSearch(ideaHaystack(idea));
    haystacks.set(idea, text);
  }
  return words.every((word) => text.includes(word));
}

function sortedIdeas(list) {
  return list.slice().sort((a, b) => {
    if (sortMode === "top") {
      const score = (b.rating?.likes || 0) - (b.rating?.dislikes || 0) - ((a.rating?.likes || 0) - (a.rating?.dislikes || 0));
      if (score) return score;
      const likes = (b.rating?.likes || 0) - (a.rating?.likes || 0);
      if (likes) return likes;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

let hotId = null;

function sparkText() {
  const pack = sparkPack || { ar: "وش يضيّع وقت فريقك اليوم، وما أصغر تغيير يرجّعه؟", en: "What wastes your team's time today, and what is the smallest fix?" };
  const text = lang === "en" ? pack.en : pack.ar;
  return text || (lang === "en" ? pack.ar : pack.en) || "";
}

let sparkLoading = false;

async function loadSpark() {
  if (!selectedPerson || sparkLoading) return;
  sparkLoading = true;
  try {
    const response = await fetch("/api/spark", { headers: { "x-session": selectedPerson.token } });
    if (response.ok) sparkPack = await response.json();
  } catch {
    sparkPack = sparkPack || null;
  } finally {
    sparkLoading = false;
  }
  renderSpark();
}

function deptIdeaCount() {
  if (!selectedPerson || !selectedPerson.department) return 0;
  return ideas.filter((idea) => (!idea.type || idea.type === "idea") && idea.author && idea.author.department === selectedPerson.department).length;
}

function renderSpark() {
  const question = document.querySelector("#spark-q");
  const dept = document.querySelector("#spark-dept");
  const who = document.querySelector("#spark-for");
  if (!question || !dept) return;
  question.textContent = sparkText();
  const why = document.querySelector("#spark-why");
  if (why) {
    const reason = sparkPack && sparkPack.reason ? (lang === "en" ? sparkPack.reason.en : sparkPack.reason.ar) : "";
    why.textContent = reason || "";
    why.hidden = !reason;
  }
  if (who) {
    const name = sparkPack && sparkPack.department ? deptLabel(sparkPack.department) : "";
    who.textContent = name ? tf("sparkFor", { name }) : t("sparkForAll");
  }
  const count = deptIdeaCount();
  dept.textContent = count ? tf("sparkDept", { n: count }) : t("sparkDeptEmpty");
  const more = document.querySelector("#spark-more");
  if (!more) return;
  more.replaceChildren();
  (sparkPack && sparkPack.others ? sparkPack.others : []).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spark-other";
    const label = document.createElement("b");
    label.textContent = deptLabel(item.department) || item.department;
    const text = document.createElement("span");
    text.textContent = lang === "en" ? item.en : item.ar;
    button.append(label, text);
    button.addEventListener("click", () => openCompose({ problem: lang === "en" ? item.en : item.ar }));
    more.appendChild(button);
  });
}

const HUB_PERIOD_DAYS = { week: 7, month: 30, year: 365 };

function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function inHubPeriod(idea) {
  if (hubPeriod === "all") return true;
  const at = new Date(idea.createdAt);
  if (Number.isNaN(at.getTime())) return false;
  if (hubPeriod === "day") return !hubDay || localDay(at) === hubDay;
  if (hubPeriod === "today") return localDay(at) === localDay(new Date());
  return Date.now() - at.getTime() <= HUB_PERIOD_DAYS[hubPeriod] * 86400000;
}

function matchesChip(idea) {
  if (view !== "hub") return true;
  if (idea.type && idea.type !== "idea") return false;
  return inHubPeriod(idea);
}

const cardMemo = new Map();

function memoCard(idea, hub) {
  const key = `${hub ? "h" : "f"}:${idea.id}`;
  const sig = `${lang}|${hotId === idea.id}|${Math.floor(Date.now() / 60000)}|${JSON.stringify(idea)}`;
  const hit = cardMemo.get(key);
  if (hit && hit.sig === sig) return hit.node;
  const node = hub ? hubCard(idea) : feedPost(idea);
  cardMemo.set(key, { sig, node });
  return node;
}

function pruneCards() {
  const live = new Set(ideas.map((idea) => idea.id));
  cardMemo.forEach((value, key) => {
    if (!live.has(key.slice(2))) cardMemo.delete(key);
  });
}

function renderInbox() {
  const list = document.querySelector("#inbox-list");
  const words = searchWords(view === "hub" ? hubQuery.value : searchInput.value);
  document.body.classList.toggle("hub-searching", view === "hub" && words.length > 0);
  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === sortMode);
  });
  document.querySelectorAll("[data-feed]").forEach((button) => {
    const on = button.dataset.feed === feedMode;
    button.classList.toggle("on", on);
    button.setAttribute("aria-selected", String(on));
  });
  renderStories();
  if (view === "explore") renderExplore();
  if (view === "search") renderSearch();
  document.querySelectorAll("[data-hub-order]").forEach((button) => button.classList.toggle("on", button.dataset.hubOrder === hubOrder));
  const filtered = sortedIdeas(ideas).filter((idea) => idea.type !== "story").filter((idea) => ideaMatches(idea, words)).filter(matchesChip);
  const hub = view === "hub";
  if (hub) {
    const direction = hubOrder === "old" ? 1 : -1;
    filtered.sort((a, b) => direction * (new Date(a.createdAt) - new Date(b.createdAt)));
  }
  let bestScore = 0;
  hotId = null;
  ideas.forEach((idea) => {
    const score = (idea.rating?.likes || 0) - (idea.rating?.dislikes || 0);
    if (score > bestScore) {
      bestScore = score;
      hotId = idea.id;
    }
  });
  renderSpark();
  renderAnnounce();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = words.length ? t("inboxNoMatch") : hub ? t("hubEmpty") : view === "home" && feedMode === "following" ? t("feedFollowEmpty") : ideas.length ? t("inboxNoMatch") : t("inboxEmpty");
    list.replaceChildren(empty);
  } else {
    const nodes = filtered.map((idea) => memoCard(idea, hub));
    const same = nodes.length === list.children.length && nodes.every((node, index) => list.children[index] === node);
    if (!same) list.replaceChildren(...nodes);
  }
  pruneCards();
  list.classList.toggle("hub-list", hub);
  if (openId && detailView && !detailView.hidden) renderThread();
  if (typeof refreshMediaViewer === "function") refreshMediaViewer();
}

function svgIcon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.appendChild(shape);
  return svg;
}

const ICONS = {
  reply: "M4 5.5h16a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H9.2L4 21.2v-4.5H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z",
  like: "M12 20.6s-6.6-4.2-9.1-8C1.1 10.2 1.6 6.6 4.5 5.3c2.1-1 4.4-.3 5.6 1.6L12 9.2l1.9-2.3c1.2-1.9 3.5-2.6 5.6-1.6 2.9 1.3 3.4 4.9 1.6 7.3-2.5 3.8-9.1 8-9.1 8z",
  dislike: "M7 3.2h8.2A2.2 2.2 0 0 1 17.4 5.4v6.2a2.2 2.2 0 0 1-2.2 2.2H13l-.7 3.6a1.8 1.8 0 0 1-1.7 1.4 1.6 1.6 0 0 1-1.5-1L7.2 14H4.4A1.4 1.4 0 0 1 3 12.6V4.6A1.4 1.4 0 0 1 4.4 3.2H7z",
  save: "M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z",
  repost: "M17 2l4 4-4 4M21 6H8a4 4 0 0 0-4 4v3M7 22l-4-4 4-4M3 18h13a4 4 0 0 0 4-4v-3",
  sound: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4 4 0 0 1 0 6M18.6 6.5a7.5 7.5 0 0 1 0 11",
  muted: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5",
  camera: "M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z",
};

function voteButton(idea, kind) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action ${kind}`;
  button.classList.toggle("on", idea.rating?.mine === kind);
  button.setAttribute("aria-label", t(kind === "like" ? "likeLabel" : "dislikeLabel"));
  button.appendChild(svgIcon(ICONS[kind]));
  const count = document.createElement("span");
  const total = kind === "like" ? idea.rating?.likes || 0 : idea.rating?.dislikes || 0;
  if (total) count.textContent = String(total);
  button.appendChild(count);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    rateIdea(idea.id, kind);
  });
  return button;
}

function typeLabel(type) {
  const map = {
    post: "typePost",
    announcement: "typeAnnouncement",
    event: "typeEvent",
    idea: "typeIdea",
    suggestion: "typeSuggestion",
    complaint: "typeComplaint",
    thanks: "typeThanks",
    story: "typeStory",
    poll: "typePoll",
    article: "typeArticle",
  };
  return t(map[type] || "typeIdea");
}

function seenStorySet() {
  try {
    const parsed = JSON.parse(localStorage.getItem("rd-story-seen") || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markStorySeen(id) {
  const seen = seenStorySet();
  seen.add(id);
  localStorage.setItem("rd-story-seen", JSON.stringify([...seen].slice(-200)));
}

function storyPeople() {
  const map = new Map();
  const now = Date.now();
  ideas.filter((idea) => idea.type === "story" && idea.media && !(Date.parse(idea.expiresAt) < now)).forEach((idea) => {
    const key = String((idea.author && idea.author.pid) || idea.pid || idea.id);
    if (!map.has(key)) map.set(key, { key, mine: Boolean(idea.mine), bits: authorBits(idea), items: [] });
    const row = map.get(key);
    row.mine = row.mine || Boolean(idea.mine);
    row.items.push(idea);
  });
  const seen = seenStorySet();
  const rows = [...map.values()];
  rows.forEach((row) => row.items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
  rows.sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    const aSeen = a.items.every((item) => seen.has(item.id));
    const bSeen = b.items.every((item) => seen.has(item.id));
    if (aSeen !== bSeen) return aSeen ? 1 : -1;
    return new Date(b.items[b.items.length - 1].createdAt) - new Date(a.items[a.items.length - 1].createdAt);
  });
  return rows;
}

function storyFace(bits, seen) {
  const ring = document.createElement("span");
  ring.className = seen ? "ring seen" : "ring";
  const face = document.createElement("i");
  paintAvatar(face, bits);
  ring.appendChild(face);
  return ring;
}

function renderStories() {
  const strip = document.querySelector("#stories");
  if (!strip || storyOrder) return;
  const people = storyPeople();
  const mine = people.find((row) => row.mine);
  const seen = seenStorySet();
  strip.hidden = false;
  strip.replaceChildren();
  const yours = document.createElement("button");
  yours.type = "button";
  yours.className = "story-chip mine";
  yours.append(storyFace(selectedPerson || {}, mine ? mine.items.every((item) => seen.has(item.id)) : true));
  const plus = document.createElement("b");
  plus.className = "story-plus";
  plus.textContent = "+";
  const yoursName = document.createElement("small");
  yoursName.textContent = t("bqYourStory");
  yours.append(plus, yoursName);
  yours.addEventListener("click", (event) => {
    if (event.target === plus || !mine) {
      openStoryCamera();
      return;
    }
    const next = mine.items.findIndex((item) => !seen.has(item.id));
    openStoryViewer(mine.key, next < 0 ? 0 : next);
  });
  strip.appendChild(yours);
  people.filter((row) => !row.mine).forEach((row) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-chip";
    const watched = row.items.every((item) => seen.has(item.id));
    button.append(storyFace(row.bits, watched));
    const name = document.createElement("small");
    name.textContent = row.bits.name;
    button.appendChild(name);
    button.addEventListener("click", () => {
      const index = row.items.findIndex((item) => !seenStorySet().has(item.id));
      openStoryViewer(row.key, index < 0 ? 0 : index);
    });
    strip.appendChild(button);
  });
}

let storyTimer = 0;
let storyGroup = 0;
let storyIndex = 0;
let storyPaused = false;
let storyElapsed = 0;
let storyStamp = 0;
const STORY_MS = 5200;

let storyMuted = false;

function storyVideo() {
  return document.querySelector("#story-stage video");
}

function paintStoryMute() {
  const button = document.querySelector("#story-mute");
  if (!button) return;
  const video = storyVideo();
  button.hidden = !video;
  button.replaceChildren(svgIcon(storyMuted ? ICONS.muted : ICONS.sound));
  button.setAttribute("aria-label", t(storyMuted ? "bqUnmute" : "bqMute"));
}

let storyDeck = null;
let storyOrder = null;

function viewerRows() {
  return storyDeck ? [storyDeck] : storyOrder || storyPeople();
}

function openStoryDeck(deck, index) {
  if (!deck || !deck.items.length) return;
  storyDeck = deck;
  storyGroup = 0;
  storyIndex = Math.max(0, Math.min(index || 0, deck.items.length - 1));
  paintStoryFrame();
}

function closeStoryViewer() {
  closeStoryChat(false);
  clearTimeout(storyTimer);
  const video = storyVideo();
  if (video) video.pause();
  const viewer = document.querySelector("#story-view");
  if (viewer) viewer.hidden = true;
  storyPaused = false;
  storyDeck = null;
  storyOrder = null;
  renderStories();
  if (view === "profile") renderProfile();
}

function paintStoryFrame() {
  closeStoryChat(false);
  const people = viewerRows();
  const person = people[storyGroup];
  const view = document.querySelector("#story-view");
  if (!person || !view) {
    closeStoryViewer();
    return;
  }
  const item = person.items[storyIndex];
  if (!item) {
    closeStoryViewer();
    return;
  }
  markStorySeen(item.id);
  const bars = document.querySelector("#story-bars");
  bars.replaceChildren();
  person.items.forEach((_, index) => {
    const bar = document.createElement("b");
    const fill = document.createElement("i");
    if (index < storyIndex) fill.style.width = "100%";
    bar.appendChild(fill);
    bars.appendChild(bar);
  });
  const bits = person.bits;
  const avatar = document.querySelector("#story-avatar");
  const cover = bits.cover && !isVideoSrc(bits.cover) ? bits.cover : "";
  paintAvatar(avatar, cover ? { photo: cover } : person.mine && selectedPerson ? selectedPerson : bits);
  document.querySelector("#story-hl").hidden = Boolean(storyDeck) || !person.mine;
  document.querySelector("#story-name").textContent = bits.name;
  document.querySelector("#story-time").textContent = timeAgo(item.createdAt);
  const stage = document.querySelector("#story-stage");
  const previous = storyVideo();
  if (previous) previous.pause();
  stage.replaceChildren();
  stage.style.background = "#000";
  if (isVideoSrc(item.media)) {
    const video = document.createElement("video");
    video.src = item.media;
    video.playsInline = true;
    video.muted = storyMuted;
    video.preload = "auto";
    video.addEventListener("ended", () => stepStory(1));
    stage.appendChild(video);
    video.play().catch(() => {
      storyMuted = true;
      video.muted = true;
      paintStoryMute();
      video.play().catch(() => {});
    });
  } else {
    const img = document.createElement("img");
    img.alt = "";
    img.src = item.media;
    stage.appendChild(img);
  }
  const caption = document.createElement("p");
  caption.className = "story-caption";
  caption.textContent = item.text || item.title || "";
  if (caption.textContent) stage.appendChild(caption);
  paintStoryMute();
  paintStorySocial(item);
  view.hidden = false;
  storyPaused = false;
  storyElapsed = 0;
  storyStamp = Date.now();
  runStoryClock();
}

function storySocialIdea(item) {
  return ideas.find((idea) => idea.id === item.id) || (typeof admPeek !== "undefined" ? admPeek.get(item.id) : null) || null;
}

function currentStoryItem() {
  const row = viewerRows()[storyGroup];
  return row ? row.items[storyIndex] : null;
}

async function peekStory(item) {
  if (!selectedPerson || typeof admPeek === "undefined") return;
  const response = await fetch(`/api/ideas/${encodeURIComponent(item.id)}/peek`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token }),
  }).catch(() => null);
  if (!response || !response.ok) return;
  const data = await response.json();
  if (!data.idea) return;
  admPeek.set(item.id, data.idea);
  const now = currentStoryItem();
  if (now && now.id === item.id && !document.querySelector("#story-view").hidden) paintStorySocial(item);
}

async function likeStory(idea) {
  if (!selectedPerson) return;
  const response = await fetch(`/api/ideas/${encodeURIComponent(idea.id)}/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token, vote: "like" }),
  }).catch(() => null);
  if (!response || !response.ok) return;
  takeIdeas(await response.json());
  const now = currentStoryItem();
  if (now) paintStorySocial(now);
}

let storyChatReply = null;
let storyChatTimer = 0;

function storyChatOpen() {
  const chat = document.querySelector("#story-chat");
  return Boolean(chat && chat.classList.contains("open"));
}

function closeStoryChat(resume) {
  const chat = document.querySelector("#story-chat");
  if (!chat || !chat.classList.contains("open")) return;
  chat.classList.remove("open");
  storyChatReply = null;
  const input = chat.querySelector(".story-chat-form input");
  if (input) input.blur();
  clearTimeout(storyChatTimer);
  storyChatTimer = setTimeout(() => {
    if (!chat.classList.contains("open")) chat.hidden = true;
  }, 240);
  if (resume) resumeStory();
}

function storyChatRow(comment, idea, nested) {
  const bits = authorBits(comment);
  const row = document.createElement("article");
  row.className = nested ? "story-chat-item reply" : "story-chat-item";
  const face = avatarNode(bits);
  const body = document.createElement("div");
  body.className = "story-chat-body";
  const meta = document.createElement("p");
  meta.className = "story-chat-meta";
  const name = document.createElement("strong");
  name.textContent = bits.name;
  if (comment.author && comment.author.official) name.appendChild(officialMark());
  const time = document.createElement("time");
  time.dateTime = comment.createdAt || "";
  time.textContent = timeAgo(comment.createdAt);
  meta.append(name, time);
  body.appendChild(meta);
  if (comment.text) {
    const text = document.createElement("p");
    text.className = "story-chat-text";
    text.textContent = comment.text;
    body.appendChild(text);
  }
  if (comment.media) {
    const img = document.createElement("img");
    img.className = "story-chat-media";
    img.alt = "";
    img.src = comment.media;
    body.appendChild(img);
  }
  if (idea.canReply !== false && comment.id) {
    const answer = document.createElement("button");
    answer.type = "button";
    answer.className = "story-chat-reply";
    answer.textContent = t("twdReply");
    answer.addEventListener("click", () => {
      storyChatReply = { id: comment.id, name: bits.name };
      paintStoryChatTo();
      const input = document.querySelector("#story-chat .story-chat-form input");
      if (input) input.focus();
    });
    body.appendChild(answer);
  }
  row.append(face, body);
  if (comment.id) {
    const like = document.createElement("button");
    like.type = "button";
    like.className = comment.liked ? "story-chat-like on" : "story-chat-like";
    like.setAttribute("aria-label", t("likeLabel"));
    like.setAttribute("aria-pressed", String(Boolean(comment.liked)));
    like.appendChild(svgIcon(ICONS.like));
    const likes = document.createElement("span");
    likes.textContent = comment.likes ? compactCount(comment.likes) : "";
    like.appendChild(likes);
    like.addEventListener("click", () => {
      const on = !like.classList.contains("on");
      like.classList.toggle("on", on);
      const next = Math.max(0, (Number(comment.likes) || 0) + (on === Boolean(comment.liked) ? 0 : on ? 1 : -1));
      likes.textContent = next ? compactCount(next) : "";
      likeComment(idea.id, comment.id).then(() => paintStoryChat());
    });
    row.appendChild(like);
  }
  const pid = authorPid(comment);
  if (pid) {
    [face, name].forEach((node) => {
      node.classList.add("person-link");
      node.addEventListener("click", () => {
        closeStoryViewer();
        openPerson(pid);
      });
    });
  }
  return row;
}

function paintStoryChatTo() {
  const to = document.querySelector("#story-chat .story-chat-to");
  if (!to) return;
  to.hidden = !storyChatReply;
  to.replaceChildren();
  if (!storyChatReply) return;
  const label = document.createElement("span");
  const target = document.createElement("b");
  target.textContent = storyChatReply.name;
  label.append(`${t("twdReplyingTo")} `, target);
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.setAttribute("aria-label", t("pmCancel"));
  cancel.textContent = "×";
  cancel.addEventListener("click", () => {
    storyChatReply = null;
    paintStoryChatTo();
  });
  to.append(label, cancel);
}

function paintStoryChat(toEnd) {
  const chat = document.querySelector("#story-chat");
  if (!chat) return;
  const idea = storySocialIdea({ id: chat.dataset.id });
  const list = chat.querySelector(".story-chat-list");
  const keep = list.scrollTop;
  const comments = idea && Array.isArray(idea.comments) ? idea.comments : [];
  chat.querySelector(".story-chat-head h3").textContent = comments.length ? tf("storyComments", { n: comments.length }) : t("storyChatTitle");
  list.replaceChildren();
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "story-chat-empty";
    empty.textContent = t("storyChatEmpty");
    list.appendChild(empty);
  }
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootOf = (comment) => {
    let node = comment;
    for (let hops = 0; node.parentId && byId.has(node.parentId) && hops < 50; hops += 1) node = byId.get(node.parentId);
    return node.id;
  };
  const groups = new Map();
  comments.forEach((comment) => {
    const root = rootOf(comment);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(comment);
  });
  groups.forEach((rows, root) => rows.forEach((comment) => list.appendChild(storyChatRow(comment, idea, comment.id !== root))));
  const form = chat.querySelector(".story-chat-form");
  const closed = chat.querySelector(".story-chat-closed");
  const open = Boolean(idea) && idea.canReply !== false;
  form.hidden = !open;
  closed.hidden = open || !idea;
  paintStoryChatTo();
  list.scrollTop = toEnd ? list.scrollHeight : keep;
}

function buildStoryChat() {
  const chat = document.createElement("div");
  chat.id = "story-chat";
  chat.className = "story-chat";
  chat.hidden = true;
  const shade = document.createElement("div");
  shade.className = "story-chat-shade";
  shade.addEventListener("click", () => closeStoryChat(true));
  const panel = document.createElement("section");
  panel.className = "story-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", t("storyChatTitle"));
  const head = document.createElement("header");
  head.className = "story-chat-head";
  const grip = document.createElement("i");
  grip.className = "sheet-grip";
  const title = document.createElement("h3");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "story-chat-x";
  close.setAttribute("aria-label", t("storyChatClose"));
  close.textContent = "×";
  close.addEventListener("click", () => closeStoryChat(true));
  head.append(grip, title, close);
  const list = document.createElement("div");
  list.className = "story-chat-list";
  const closed = document.createElement("p");
  closed.className = "story-chat-closed";
  closed.textContent = t("repliesClosed");
  closed.hidden = true;
  const form = document.createElement("form");
  form.className = "story-chat-form";
  const to = document.createElement("p");
  to.className = "story-chat-to";
  to.hidden = true;
  const row = document.createElement("div");
  row.className = "story-chat-row";
  const face = avatarNode(selectedPerson || { name: "", initial: "•" });
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 500;
  input.autocomplete = "off";
  input.enterKeyHint = "send";
  input.placeholder = t("storyCommentPh");
  input.setAttribute("aria-label", t("storyCommentPh"));
  const send = document.createElement("button");
  send.type = "submit";
  send.className = "story-chat-send";
  send.textContent = t("storyChatSend");
  send.disabled = true;
  input.addEventListener("input", () => {
    send.disabled = !input.value.trim();
  });
  row.append(face, input, send);
  const error = document.createElement("p");
  error.className = "story-chat-error";
  form.append(to, row, error);
  let sending = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const idea = storySocialIdea({ id: chat.dataset.id });
    const text = input.value.trim();
    if (!idea || !text || sending) return;
    error.textContent = "";
    sending = true;
    send.disabled = true;
    let result = "failed";
    try {
      if (!(await termsCheck(text))) return;
      result = await addComment(idea.id, text, "", storyChatReply && storyChatReply.id);
    } finally {
      sending = false;
      send.disabled = !input.value.trim();
    }
    if (result === "ok") {
      input.value = "";
      send.disabled = true;
      storyChatReply = null;
      paintStoryChat(true);
      paintStorySocial({ id: idea.id });
      return;
    }
    if (result === "terms") openTerms(true);
    else error.textContent = t(result === "verify" ? "needVerify" : result === "closed" ? "repliesClosed" : result === "offensive" ? "conductBlocked" : "errFailed");
  });
  panel.append(head, list, closed, form);
  chat.append(shade, panel);
  let dragFrom = null;
  head.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    dragFrom = event.clientY;
    panel.style.transition = "none";
    head.setPointerCapture(event.pointerId);
  });
  head.addEventListener("pointermove", (event) => {
    if (dragFrom === null) return;
    panel.style.transform = `translateY(${Math.max(0, event.clientY - dragFrom)}px)`;
  });
  const drop = (event) => {
    if (dragFrom === null) return;
    const moved = event.clientY - dragFrom;
    dragFrom = null;
    panel.style.transition = "";
    panel.style.transform = "";
    if (moved > 70) closeStoryChat(true);
  };
  head.addEventListener("pointerup", drop);
  head.addEventListener("pointercancel", drop);
  return chat;
}

function openStoryComments(idea) {
  pauseStory();
  let chat = document.querySelector("#story-chat");
  if (!chat) {
    chat = buildStoryChat();
    document.querySelector("#story-view").appendChild(chat);
  }
  clearTimeout(storyChatTimer);
  chat.dataset.id = idea.id;
  storyChatReply = null;
  chat.querySelector(".story-chat-error").textContent = "";
  paintStoryChat(false);
  chat.querySelector(".story-chat-list").scrollTop = 0;
  chat.hidden = false;
  void chat.offsetWidth;
  chat.classList.add("open");
}

function paintStorySocial(item) {
  const view = document.querySelector("#story-view");
  let foot = document.querySelector("#story-foot");
  if (!foot) {
    foot = document.createElement("div");
    foot.id = "story-foot";
    foot.className = "story-foot";
    view.appendChild(foot);
  }
  foot.replaceChildren();
  const idea = storySocialIdea(item);
  foot.hidden = !idea;
  if (!idea) {
    peekStory(item);
    return;
  }
  const total = Array.isArray(idea.comments) ? idea.comments.length : 0;
  const talk = document.createElement("button");
  talk.type = "button";
  talk.className = "story-talk";
  talk.appendChild(svgIcon(ICONS.reply));
  const label = document.createElement("span");
  label.textContent = total ? tf("storyComments", { n: total }) : t("storyCommentPh");
  talk.appendChild(label);
  talk.addEventListener("click", () => openStoryComments(idea));
  const liked = idea.rating?.mine === "like";
  const like = document.createElement("button");
  like.type = "button";
  like.className = liked ? "story-act on" : "story-act";
  like.setAttribute("aria-label", t("likeLabel"));
  like.appendChild(svgIcon(ICONS.like));
  const likes = document.createElement("span");
  likes.textContent = idea.rating?.likes ? compactCount(idea.rating.likes) : "";
  like.appendChild(likes);
  like.addEventListener("click", () => {
    like.classList.toggle("on", !liked);
    likeStory(idea);
  });
  const share = document.createElement("button");
  share.type = "button";
  share.className = "story-act";
  share.setAttribute("aria-label", t("bqShare"));
  share.appendChild(svgIcon(FEED_ICONS.share));
  share.addEventListener("click", () => {
    pauseStory();
    feedShare(idea);
  });
  foot.append(talk, like, share);
}

function runStoryClock() {
  clearTimeout(storyTimer);
  const fill = document.querySelectorAll("#story-bars i")[storyIndex];
  const video = storyVideo();
  const tick = () => {
    if (storyPaused) return;
    if (video) {
      if (fill && video.duration) fill.style.width = `${Math.min(100, (video.currentTime / video.duration) * 100)}%`;
      storyTimer = setTimeout(tick, 60);
      return;
    }
    const elapsed = storyElapsed + (Date.now() - storyStamp);
    if (fill) fill.style.width = `${Math.min(100, (elapsed / STORY_MS) * 100)}%`;
    if (elapsed >= STORY_MS) {
      stepStory(1);
      return;
    }
    storyTimer = setTimeout(tick, 40);
  };
  tick();
}

function stepStory(direction) {
  const people = viewerRows();
  const person = people[storyGroup];
  if (!person) {
    closeStoryViewer();
    return;
  }
  let nextIndex = storyIndex + direction;
  let nextGroup = storyGroup;
  if (nextIndex >= person.items.length) {
    nextGroup += 1;
    nextIndex = 0;
  } else if (nextIndex < 0) {
    nextGroup -= 1;
    nextIndex = nextGroup >= 0 ? people[nextGroup].items.length - 1 : 0;
  }
  if (nextGroup < 0 || nextGroup >= people.length) {
    closeStoryViewer();
    return;
  }
  storyGroup = nextGroup;
  storyIndex = nextIndex;
  paintStoryFrame();
}

function openStoryViewer(key, index) {
  storyDeck = null;
  const people = storyPeople();
  const group = people.findIndex((row) => row.key === String(key));
  if (group < 0) return;
  storyOrder = people;
  storyGroup = group;
  storyIndex = Math.max(0, Math.min(index || 0, people[group].items.length - 1));
  paintStoryFrame();
}

function pauseStory() {
  if (storyPaused || document.querySelector("#story-view").hidden) return;
  storyPaused = true;
  storyElapsed += Date.now() - storyStamp;
  clearTimeout(storyTimer);
  const video = storyVideo();
  if (video) video.pause();
}

function resumeStory() {
  if (!storyPaused) return;
  storyPaused = false;
  storyStamp = Date.now();
  const video = storyVideo();
  if (video) video.play().catch(() => {});
  runStoryClock();
}

async function social(action, extra) {
  const response = await fetch("/api/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson ? selectedPerson.token : "", action, ...extra }),
  });
  if (response.status === 401) {
    clearSession();
    return null;
  }
  if (await conductReply(response)) return null;
  if (!response.ok) return null;
  return response.json();
}

function paintFollowPill(button, followed) {
  const on = Boolean(followed);
  button.classList.add("twd-follow", "follow-pill");
  button.classList.toggle("on", on);
  button.setAttribute("aria-pressed", String(on));
  const label = document.createElement("span");
  label.className = "follow-on";
  label.textContent = t(on ? "following" : "follow");
  button.replaceChildren(label);
  if (on) {
    const off = document.createElement("span");
    off.className = "follow-off";
    off.textContent = t("unfollowBtn");
    button.appendChild(off);
  }
}

function followPill(pid, name, followed, done) {
  const button = document.createElement("button");
  button.type = "button";
  paintFollowPill(button, followed);
  const toggle = async () => {
    button.disabled = true;
    const data = await social("follow", { pid });
    button.disabled = false;
    if (!data) return;
    paintFollowPill(button, data.followed);
    if (done) done(Boolean(data.followed), data);
  };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!button.classList.contains("on")) {
      toggle();
      return;
    }
    openSheet(tf("unfollowAsk", { name: name || "" }), t("unfollowAskSub"), [{ label: t("unfollowBtn"), danger: true, run: toggle }]);
  });
  return button;
}

function followButton(idea) {
  return followPill(idea.pid, authorBits(idea).name, idea.followed, () => loadIdeas());
}

function repostButton(idea) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action repost";
  button.classList.toggle("on", Boolean(idea.reposted));
  button.setAttribute("aria-label", t("repost"));
  button.appendChild(svgIcon(ICONS.repost));
  const count = document.createElement("span");
  if (idea.reposts) count.textContent = String(idea.reposts);
  button.appendChild(count);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleRepost(idea.id);
  });
  return button;
}

let repostBusy = false;

async function toggleRepost(id) {
  if (!selectedPerson || repostBusy) return;
  repostBusy = true;
  try {
    const response = await fetch(`/api/ideas/${encodeURIComponent(id)}/repost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token }),
    });
    if (!response.ok) return;
    takeIdeas(await response.json());
    paintIdeas();
    loadAlerts();
  } finally {
    repostBusy = false;
  }
}

function pollBox(idea) {
  const box = document.createElement("div");
  box.className = "poll-box";
  idea.poll.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = option.mine ? "on" : "";
    button.textContent = `${option.text} · ${option.votes}`;
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!selectedPerson) return;
      const response = await fetch(`/api/ideas/${encodeURIComponent(idea.id)}/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: selectedPerson.token, option: option.index }),
      });
      if (!response.ok) return;
      const data = await response.json();
      ideas = data.ideas;
      renderInbox();
    });
    box.appendChild(button);
  });
  return box;
}

function excerpt(value, max) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function isVideoSrc(src) {
  return /^\/media\/[0-9a-f-]+\.(mp4|webm|mov)$/i.test(String(src || ""));
}

function postPhoto(src, lightbox) {
  if (isVideoSrc(src)) {
    const video = document.createElement("video");
    video.className = "post-photo";
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("click", (event) => event.stopPropagation());
    return video;
  }
  const img = document.createElement("img");
  img.className = "post-photo";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = src;
  if (lightbox) {
    img.addEventListener("click", (event) => {
      event.stopPropagation();
      const view = document.querySelector("#dm-view");
      document.querySelector("#dm-view-img").src = src;
      view.showModal();
    });
  }
  return img;
}

function postMediaBlock(idea, lightbox) {
  const list = Array.isArray(idea.gallery) && idea.gallery.length > 1 ? idea.gallery : [];
  if (!list.length) return postPhoto(idea.media, lightbox);
  const strip = document.createElement("div");
  strip.className = "post-gallery";
  list.forEach((src) => strip.appendChild(postPhoto(src, lightbox)));
  return strip;
}

function ideaColumn(label, items, kind, extra) {
  if (!items.length && !extra) return null;
  const section = document.createElement("section");
  section.className = `idea-col ${kind}`;
  const heading = document.createElement("h4");
  heading.textContent = label;
  const list = document.createElement("ul");
  items.forEach((item) => {
    const line = document.createElement("li");
    line.textContent = item;
    list.appendChild(line);
  });
  section.append(heading, list);
  if (extra) {
    const more = document.createElement("p");
    more.className = "idea-more";
    more.textContent = tf("ideaMore", { n: extra });
    section.appendChild(more);
  }
  return section;
}

function ideaSteps(status) {
  const steps = ["received", "review", "project"];
  const index = Math.max(0, steps.indexOf(status || "received"));
  const row = document.createElement("ol");
  row.className = `idea-steps ${status || "received"}`;
  steps.forEach((step, position) => {
    const item = document.createElement("li");
    if (position < index) item.className = "done";
    if (position === index) item.className = "now";
    item.textContent = statusLabel(step);
    row.appendChild(item);
  });
  return row;
}

function ideaBoard(idea, full) {
  const board = document.createElement("div");
  board.className = full ? "idea-board full" : "idea-board";
  const banner = document.createElement("div");
  banner.className = "idea-banner";
  const kicker = document.createElement("span");
  kicker.className = "idea-kicker";
  kicker.textContent = idea.number ? `${t("typeIdea")} ${pad(idea.number)}` : t("typeIdea");
  banner.appendChild(kicker);
  const pill = document.createElement("span");
  pill.className = `idea-pill ${idea.status || "received"}`;
  pill.textContent = statusLabel(idea.status || "received");
  banner.appendChild(pill);

  const title = document.createElement("strong");
  title.className = "idea-title";
  title.textContent = idea.title || excerpt(idea.text, 80);
  const lead = document.createElement("p");
  lead.className = "idea-lead";
  lead.textContent = full ? idea.text : excerpt(idea.text, 180);
  board.append(banner, title, lead);
  if (full) board.appendChild(ideaSteps(idea.status || "received"));

  if (idea.place && displayPlace(idea.place)) {
    const place = document.createElement("p");
    place.className = "idea-place";
    const point = geoPoint(idea.place);
    if (point) {
      const link = document.createElement("a");
      link.href = mapUrl(point);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = point.name || t("geoOnMap");
      place.appendChild(link);
    } else {
      place.textContent = displayPlace(idea.place);
    }
    board.appendChild(place);
  }
  if (idea.media) board.appendChild(postMediaBlock(idea, full));
  if (full && idea.problem) {
    const problem = document.createElement("blockquote");
    problem.className = "idea-problem";
    const label = document.createElement("span");
    label.textContent = t("labelProblem");
    const body = document.createElement("p");
    body.textContent = idea.problem;
    problem.append(label, body);
    board.appendChild(problem);
  }

  const pros = Array.isArray(idea.pros) ? idea.pros : [];
  const cons = Array.isArray(idea.cons) ? idea.cons : [];
  if (pros.length || cons.length) {
    if (pros.length && cons.length) {
      const meter = document.createElement("div");
      meter.className = "idea-meter";
      const fill = document.createElement("i");
      fill.style.width = `${Math.round((pros.length / (pros.length + cons.length)) * 100)}%`;
      meter.appendChild(fill);
      board.appendChild(meter);
    }
    const split = document.createElement("div");
    split.className = "idea-split";
    const shownPros = full ? pros : pros.slice(0, 2);
    const shownCons = full ? cons : cons.slice(0, 2);
    const left = ideaColumn(t("labelPros"), shownPros, "pros", full ? 0 : pros.length - shownPros.length);
    const right = ideaColumn(t("labelCons"), shownCons, "cons", full ? 0 : cons.length - shownCons.length);
    if (left) split.appendChild(left);
    if (right) split.appendChild(right);
    board.appendChild(split);
  }

  if (idea.impact) {
    const impact = document.createElement("p");
    impact.className = "idea-impact";
    const label = document.createElement("span");
    label.textContent = t("labelImpact");
    impact.append(label, document.createTextNode(full ? idea.impact : excerpt(idea.impact, 110)));
    board.appendChild(impact);
  }
  if (!full) {
    const more = document.createElement("span");
    more.className = "article-more";
    more.textContent = t("openIdea");
    board.appendChild(more);
  }
  return board;
}

function postMetaLine(idea, bits) {
  const where = idea.project || displayPlace(idea.place) || bits.meta;
  return [bits.position || bits.meta, where !== (bits.position || bits.meta) ? where : "", timeAgo(idea.createdAt)].filter(Boolean).join(" · ");
}

function openThread(id) {
  openId = id;
  openComment = null;
  SCREEN_IDS.forEach((selector) => {
    const node = document.querySelector(selector);
    if (node) node.hidden = true;
  });
  document.body.dataset.screen = "detail";
  detailView.hidden = false;
  history.replaceState(null, "", `#idea=${encodeURIComponent(id)}`);
  renderThread();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeThread() {
  openId = null;
  openComment = null;
  showView(view);
}

let startRoute = location.hash;
const ROUTE_VIEWS = new Set(["hub", "alerts", "profile", "groups", "explore", "search", "storyboard", "announcements", "recognition", "growth", "settings"]);

function routeHash() {
  if (openId) return `#idea=${encodeURIComponent(openId)}`;
  if (view === "person" && typeof personPage !== "undefined" && personPage && personPage.pid) return `#p=${encodeURIComponent(personPage.pid)}`;
  if (view === "department" && activeDept) return `#d=${encodeURIComponent(activeDept)}`;
  if (ROUTE_VIEWS.has(view) || view === "dashboard" || view === "moderation") return `#v=${view}`;
  return "";
}

function writeRoute() {
  const hash = routeHash();
  if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
}

function restoreRoute() {
  if (!startRoute || !selectedPerson || startRoute.startsWith("#idea=")) return;
  const route = startRoute;
  startRoute = "";
  const page = route.match(/^#v=([a-z]+)$/);
  const person = route.match(/^#p=(.+)$/);
  const dept = route.match(/^#d=(.+)$/);
  const allowed = page && (ROUTE_VIEWS.has(page[1]) || (page[1] === "dashboard" && selectedPerson.dashboard) || (page[1] === "moderation" && selectedPerson.moderator));
  if (allowed && view === "home" && !openId) showView(page[1]);
  else if (person && view === "home" && !openId) openPerson(decodeURIComponent(person[1]));
  else if (dept && view === "home" && !openId) openDepartment(decodeURIComponent(dept[1]));
}

function syncFormMode() {
  const mode = document.querySelector("#compose-mode");
  if (mode) {
    mode.hidden = !editingId;
    mode.textContent = editingId ? t("editIdea") : "";
  }
  paintPostType();
}

function showView(next) {
  if (next !== "storyboard") pauseReels();
  if (!reelsOpening) reelsFocus = null;
  reelsOpening = false;
  if (next !== view) {
    backView = view;
    setHubSearch(false);
    if (searchInput.value) {
      searchInput.value = "";
      document.querySelector("#search-panel").hidden = true;
    }
  }
  view = next;
  openId = null;
  openComment = null;
  document.body.dataset.screen = next === "hub" ? "hub" : next;
  writeRoute();
  SCREEN_IDS.forEach((id) => {
    const node = document.querySelector(id);
    if (node) node.hidden = true;
  });
  detailView.hidden = true;
  const searchWrap = document.querySelector("#search-wrap");
  if (searchWrap) searchWrap.classList.remove("open");
  if (next === "home" || next === "hub") document.querySelector("#feed").hidden = false;
  else if (next !== "settings" && document.querySelector(`#${next}`)) document.querySelector(`#${next}`).hidden = false;
  if (next === "settings") {
    document.querySelector("#settings").hidden = false;
    showSettings("root");
  }
  const dockFor = { groups: "explore", growth: "explore", recognition: "explore", search: "explore" };
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === (dockFor[next] || next));
  });
  if (["home", "hub", "profile", "person", "groups", "recognition", "growth", "storyboard", "announcements", "explore", "search"].includes(next)) loadIdeas();
  if (next === "explore") renderExplore();
  if (next === "search") renderSearch();
  if (next === "groups") loadGroups();
  if (next === "department") renderDepartment();
  if (next === "recognition") renderRecognition();
  if (next === "growth" || next === "storyboard") renderGrowth();
  if (next === "announcements") renderAnnouncements();
  if (next === "moderation") renderModeration();
  if (next === "dashboard") renderDashboard();
  if (next === "alerts") {
    renderAlerts();
    markAlertsRead();
  }
}

function renderThread() {
  const idea = ideas.find((item) => item.id === openId) || (typeof admPeek !== "undefined" ? admPeek.get(openId) : null);
  const body = document.querySelector("#thread-body");
  body.replaceChildren();
  if (!idea) return;

  const bits = authorBits(idea);
  const post = document.createElement("article");
  post.className = "twd";
  if (idea.mine && idea.hidden) post.appendChild(hiddenNote());
  const head = document.createElement("header");
  head.className = "twd-head";
  const who = document.createElement("div");
  who.className = "twd-who";
  const name = document.createElement("strong");
  name.textContent = bits.name;
  if (idea.author && idea.author.official) name.appendChild(officialMark());
  personLink(name, authorPid(idea));
  const role = document.createElement("span");
  role.textContent = bits.position || bits.meta || "";
  who.append(name, role);
  head.append(feedFace(idea, bits), who);
  if (idea.pid && !idea.mine) {
    head.appendChild(followButton(idea));
  }
  const more = document.createElement("button");
  more.type = "button";
  more.className = "fp-more";
  more.setAttribute("aria-label", t("openIdea"));
  more.textContent = "⋯";
  more.addEventListener("click", () => openPostMenu(idea));
  head.appendChild(more);
  post.appendChild(head);

  const isIdea = !idea.type || idea.type === "idea";
  const full = String(idea.text || "").trim();
  const fullText = (className) => {
    const text = document.createElement("p");
    text.className = className;
    fillRichText(text, full);
    return text;
  };
  if (isIdea) {
    post.appendChild(ideaBoard(idea, true));
  } else {
    const { frame, withText } = postFrame(idea, post);
    if (withText) {
      if (idea.title && !full.startsWith(idea.title)) {
        const title = document.createElement("strong");
        title.className = "twd-title";
        title.textContent = idea.title;
        post.appendChild(title);
      }
      if (full) post.appendChild(fullText("twd-text"));
      post.appendChild(frame);
    } else {
      post.appendChild(frame);
      if (idea.type === "article" && full) post.appendChild(fullText("twd-text article-body"));
      else if (full.length > 220) post.appendChild(fullText("twd-text"));
    }
    if (withText && idea.thanksTo) post.appendChild(slideText(`${t("typeThanks")} · ${idea.thanksTo.name}`, "thanks-line"));
    if (withText && Array.isArray(idea.poll) && idea.poll.length) post.appendChild(pollBox(idea));
    if (idea.event && typeof eventBox === "function") post.appendChild(eventBox(idea));
    if (idea.ack && typeof announceFooter === "function") post.appendChild(announceFooter(idea));
    appendBrief(post, idea);
  }
  const translate = translateControl([idea.title, idea.text, idea.problem, idea.impact].filter(Boolean).join("\n"));
  if (translate) post.appendChild(translate);

  const stamp = document.createElement("p");
  stamp.className = "twd-time";
  const time = document.createElement("time");
  time.dateTime = idea.createdAt || "";
  const posted = new Date(idea.createdAt);
  if (!Number.isNaN(posted.getTime())) {
    const locale = lang === "ar" ? "ar-SA" : "en-GB";
    time.textContent = [
      posted.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
      posted.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
    ].join(" · ");
  }
  stamp.appendChild(time);
  const where = feedWhere(idea);
  if (where) stamp.appendChild(where);
  const seen = document.createElement("span");
  seen.className = "twd-views";
  const seenCount = document.createElement("b");
  seenCount.dataset.views = idea.id;
  seenCount.textContent = compactCount(idea.views || 0) || "0";
  seen.append(seenCount, ` ${t("twdViews")}`);
  stamp.appendChild(seen);
  post.appendChild(stamp);

  const counts = [
    [idea.reposts || 0, "twdReposts", null],
    [idea.rating?.likes || 0, "twdLikes", () => openPeople(idea.id)],
    [Array.isArray(idea.comments) ? idea.comments.length : 0, "twdReplies", null],
  ].filter(([n]) => n > 0);
  if (counts.length) {
    const stats = document.createElement("div");
    stats.className = "twd-stats";
    counts.forEach(([n, key, onClick]) => {
      const item = document.createElement(onClick ? "button" : "span");
      if (onClick) {
        item.type = "button";
        item.addEventListener("click", onClick);
      }
      const value = document.createElement("b");
      value.textContent = n.toLocaleString("en-US");
      item.append(value, ` ${t(key)}`);
      stats.appendChild(item);
    });
    post.appendChild(stats);
  }
  const bar = feedActions(idea);
  bar.classList.add("twd-actions");
  bar.querySelector(".action.views")?.remove();
  const replyButton = bar.querySelector(".action.reply");
  const replyFocus = replyButton.cloneNode(true);
  replyButton.replaceWith(replyFocus);
  post.appendChild(bar);

  const tracked = idea.type === "idea" || idea.type === "complaint" || !idea.type;
  const tools = document.createElement("div");
  tools.className = "thread-tools";
  if (tracked && idea.canStatus) {
    const select = document.createElement("select");
    select.className = "status";
    const choices = idea.type === "complaint"
      ? [["received", "statusReceived"], ["review", "statusReview"], ["resolved", "statusResolved"]]
      : [["received", "statusReceived"], ["review", "statusReview"], ["project", "statusProject"]];
    choices.forEach(([value, key]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(key);
      select.appendChild(option);
    });
    select.value = idea.status || "received";
    select.addEventListener("change", () => updateStatus(idea.id, select.value));
    tools.append(select);
  } else if (tracked) {
    const state = document.createElement("span");
    state.className = "status-readonly";
    state.textContent = statusLabel(idea.status);
    const note = document.createElement("span");
    note.className = "status-note";
    note.textContent = t("statusLocked");
    tools.append(state, note);
  }

  const list = Array.isArray(idea.comments) ? idea.comments : [];
  const byId = new Map(list.map((comment) => [comment.id, comment]));
  const parentOf = (comment) => (comment.parentId && byId.has(comment.parentId) ? comment.parentId : "");
  const focus = openComment ? byId.get(openComment) || null : null;
  if (!focus) openComment = null;
  const canAnswer = idea.canReply !== false;
  const goTo = (comment, write) => {
    openComment = comment ? comment.id : null;
    threadWrite = Boolean(write);
    threadJump = true;
    renderThread();
  };
  const actions = { open: (comment) => goTo(comment), reply: canAnswer ? (comment) => goTo(comment, true) : null, like: (comment) => likeComment(idea.id, comment.id) };
  const replies = document.createElement("div");
  replies.className = "replies twd-replies";
  const children = list.filter((comment) => parentOf(comment) === (focus ? focus.id : ""));
  if (!children.length && canAnswer && !focus) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("noComments");
    replies.appendChild(empty);
  } else {
    children.forEach((comment) => replies.appendChild(commentCard(comment, actions)));
  }
  let chain = null;
  let focusCard = null;
  if (focus) {
    const path = [];
    for (let node = focus; node && path.length <= list.length; node = byId.get(parentOf(node))) path.unshift(node);
    chain = document.createElement("div");
    chain.className = "twr-chain";
    path.forEach((comment) => {
      const card = commentCard(comment, comment === focus ? { reply: actions.reply, like: actions.like, focus: true } : { ...actions, linked: true });
      if (comment === focus) focusCard = card;
      chain.appendChild(card);
    });
  }

  const commentForm = document.createElement("form");
  commentForm.className = "twd-reply";
  const commentInput = document.createElement("textarea");
  commentInput.maxLength = 500;
  commentInput.rows = 1;
  commentInput.placeholder = t("twdReplyPh");
  commentInput.setAttribute("aria-label", t("twdReplyPh"));
  replyFocus.addEventListener("click", (event) => {
    event.stopPropagation();
    if (focus) goTo(null, true);
    else commentInput.focus();
  });
  let commentMedia = "";
  const preview = document.createElement("img");
  preview.className = "post-photo";
  preview.hidden = true;
  preview.alt = "";
  const replyingTo = document.createElement("p");
  replyingTo.className = "twd-replying";
  const replyName = document.createElement("b");
  replyName.textContent = focus ? authorBits(focus).name : bits.name;
  replyingTo.append(`${t("twdReplyingTo")} `, replyName);
  const row = document.createElement("div");
  row.className = "twd-reply-row";
  const replyTools = document.createElement("div");
  replyTools.className = "twd-reply-tools";
  const photo = document.createElement("button");
  photo.type = "button";
  photo.className = "twd-reply-media";
  photo.appendChild(svgIcon("M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 16l5-5 4 4 2.5-2.5L20.5 18M15.5 9.5h.01"));
  photo.setAttribute("aria-label", t("postPhoto"));
  const emojiButton = document.createElement("button");
  emojiButton.type = "button";
  emojiButton.className = "twd-reply-media";
  emojiButton.appendChild(svgIcon("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01"));
  emojiButton.setAttribute("aria-label", t("xEmoji"));
  emojiButton.setAttribute("aria-expanded", "false");
  const emojiPanel = document.createElement("div");
  emojiPanel.className = "x-emoji twd-emoji";
  emojiPanel.setAttribute("role", "listbox");
  emojiPanel.hidden = true;
  emojiButton.addEventListener("click", () => {
    if (!emojiPanel.childElementCount) {
      X_EMOJI.forEach((emoji) => {
        const pick = document.createElement("button");
        pick.type = "button";
        pick.setAttribute("role", "option");
        pick.textContent = emoji;
        pick.addEventListener("click", () => insertAtCaret(commentInput, emoji));
        emojiPanel.appendChild(pick);
      });
    }
    emojiPanel.hidden = !emojiPanel.hidden;
    emojiButton.setAttribute("aria-expanded", String(!emojiPanel.hidden));
  });
  const ring = document.createElement("span");
  ring.className = "x-ring empty";
  ring.setAttribute("aria-hidden", "true");
  ring.innerHTML = '<svg viewBox="0 0 24 24"><circle class="x-ring-bg" cx="12" cy="12" r="10"/><circle class="x-ring-fill" cx="12" cy="12" r="10"/></svg><b></b>';
  const ringFill = ring.querySelector(".x-ring-fill");
  ringFill.style.strokeDasharray = String(RING_LENGTH);
  ringFill.style.strokeDashoffset = String(RING_LENGTH);
  const replyEnd = document.createElement("div");
  replyEnd.className = "twd-reply-end";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp,image/gif";
  file.hidden = true;
  photo.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const picked = file.files && file.files[0];
    file.value = "";
    commentError.textContent = "";
    if (!picked) return;
    const data = await fileToData(picked);
    if (picked.size > 120000 || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(data) || data.length > 180000) {
      commentMedia = "";
      preview.hidden = true;
      commentError.textContent = t("photoBig");
      syncReply();
      return;
    }
    commentMedia = data;
    preview.src = data;
    preview.hidden = false;
    syncReply();
  });
  const commentButton = document.createElement("button");
  commentButton.className = "twd-reply-btn";
  commentButton.type = "submit";
  commentButton.textContent = t("twdReply");
  commentButton.disabled = true;
  const syncReply = () => {
    const used = commentInput.value.length;
    const left = commentInput.maxLength - used;
    commentButton.disabled = !commentInput.value.trim() && !commentMedia;
    commentInput.style.height = "auto";
    commentInput.style.height = `${commentInput.scrollHeight + 2}px`;
    commentInput.style.overflowY = commentInput.scrollHeight > commentInput.clientHeight + 2 ? "auto" : "hidden";
    ringFill.style.strokeDashoffset = String(RING_LENGTH * (1 - Math.min(used / commentInput.maxLength, 1)));
    ring.dataset.state = left <= 0 ? "over" : left <= 20 ? "warn" : "";
    ring.classList.toggle("empty", used === 0);
    ring.querySelector("b").textContent = left <= 20 ? String(left) : "";
    if (used || commentMedia) commentForm.classList.add("open");
  };
  commentInput.addEventListener("input", syncReply);
  commentInput.addEventListener("focus", () => commentForm.classList.add("open"));
  commentForm.addEventListener("focusout", (event) => {
    if (commentForm.contains(event.relatedTarget)) return;
    if (commentInput.value || commentMedia) return;
    commentForm.classList.remove("open");
    emojiPanel.hidden = true;
    emojiButton.setAttribute("aria-expanded", "false");
  });
  replyTools.append(photo, emojiButton, file);
  replyEnd.append(ring, commentButton);
  row.append(replyTools, replyEnd);
  const commentError = document.createElement("p");
  commentError.className = "form-error";
  const me = selectedPerson ? String(selectedPerson.name || "") : "";
  const myFace = avatarNode(selectedPerson || { name: me, initial: "•" });
  const replyMain = document.createElement("div");
  replyMain.className = "twd-reply-main";
  replyMain.append(replyingTo, commentInput, preview, emojiPanel, row, commentError);
  commentForm.append(myFace, replyMain);
  let commentSending = false;
  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (commentSending) return;
    commentError.textContent = "";
    const text = commentInput.value.trim();
    if (!text && !commentMedia) {
      commentError.textContent = t("errRequired");
      return;
    }
    commentSending = true;
    commentButton.disabled = true;
    let result = "failed";
    try {
      if (!(await termsCheck(text))) return;
      result = await addComment(idea.id, text, commentMedia, focus && focus.id);
    } finally {
      commentSending = false;
      if (result !== "ok") syncReply();
    }
    if (result === "verify") commentError.textContent = t("needVerify");
    else if (result === "terms") openTerms(true);
    else if (result === "closed") commentError.textContent = t("repliesClosed");
    else if (result === "offensive") commentError.textContent = t("conductBlocked");
    else if (result === "failed") commentError.textContent = t("errFailed");
  });

  body.appendChild(post);
  if (!focus && tools.childElementCount) body.appendChild(tools);
  const history = focus ? null : statusLogNode(idea);
  if (history) body.appendChild(history);
  if (chain) body.appendChild(chain);
  if (idea.canReply === false) {
    const closed = document.createElement("p");
    closed.className = "replies-closed";
    closed.textContent = t(idea.replies === "department" ? "repliesDeptOnly" : "repliesClosed");
    body.appendChild(closed);
  } else {
    body.appendChild(commentForm);
  }
  body.appendChild(replies);
  queueView(idea);
  const write = threadWrite && canAnswer;
  const jump = threadJump;
  threadWrite = false;
  threadJump = false;
  if (write) {
    commentForm.classList.add("open");
    commentInput.focus({ preventScroll: true });
  }
  if (jump) requestAnimationFrame(() => (focusCard || (write ? commentForm : post)).scrollIntoView({ block: focusCard ? "center" : "start" }));
}

function threadBack() {
  const idea = ideas.find((item) => item.id === openId) || (typeof admPeek !== "undefined" ? admPeek.get(openId) : null);
  const focus = openComment && idea && Array.isArray(idea.comments) ? idea.comments.find((comment) => comment.id === openComment) : null;
  if (!focus) {
    closeThread();
    return;
  }
  const parent = focus.parentId && idea.comments.find((comment) => comment.id === focus.parentId);
  openComment = parent ? parent.id : null;
  threadJump = true;
  renderThread();
}

function statusEntryNode(entry, compact) {
  const row = document.createElement(compact ? "p" : "article");
  row.className = compact ? "status-latest" : "status-entry";
  const who = entry.name
    ? [entry.name, deptLabel(entry.department), entry.position].filter(Boolean).join(" · ")
    : "—";
  const when = [fullTime(entry.at), timeAgo(entry.at)].filter(Boolean).join(" · ");
  if (compact) {
    row.textContent = [statusLabel(entry.status), who, when].filter(Boolean).join(" · ");
    return row;
  }
  const name = document.createElement("strong");
  name.textContent = who;
  if (entry.official) name.appendChild(officialMark());
  const state = document.createElement("span");
  state.textContent = statusLabel(entry.status);
  const time = document.createElement("small");
  time.textContent = when;
  row.append(name, state, time);
  return row;
}

function statusLogNode(idea) {
  const history = Array.isArray(idea.history) ? idea.history : [];
  if (!history.length) return null;
  const section = document.createElement("section");
  section.className = "status-log";
  const heading = document.createElement("h3");
  heading.textContent = t("statusLog");
  section.appendChild(heading);
  history.slice().reverse().forEach((entry) => section.appendChild(statusEntryNode(entry, false)));
  return section;
}

function commentCard(comment, options) {
  const opts = options || {};
  const bits = authorBits(comment);
  const card = document.createElement("article");
  card.className = ["tw", "twr", opts.focus ? "twr-focus" : "", opts.linked ? "twr-linked" : "", opts.open ? "twr-open" : ""].filter(Boolean).join(" ");
  const main = document.createElement("div");
  main.className = "tw-main";
  const head = document.createElement("header");
  head.className = "tw-head";
  const name = document.createElement("strong");
  name.className = "tw-name";
  name.textContent = bits.name;
  if (comment.author && comment.author.official) name.appendChild(officialMark());
  personLink(name, authorPid(comment));
  const role = document.createElement("span");
  role.className = "tw-role";
  role.textContent = bits.position || bits.meta || "";
  const time = document.createElement("time");
  time.className = "tw-time";
  time.dateTime = comment.createdAt || "";
  time.title = fullTime(comment.createdAt);
  time.textContent = timeAgo(comment.createdAt);
  head.append(name, role, time);
  main.appendChild(head);
  if (opts.focus && comment.replyToName) {
    const to = document.createElement("p");
    to.className = "twd-replying twr-to";
    const target = document.createElement("b");
    target.textContent = comment.replyToName;
    to.append(`${t("twdReplyingTo")} `, target);
    main.appendChild(to);
  }
  if (comment.text) {
    const text = document.createElement("p");
    text.className = "twr-text";
    text.textContent = comment.text;
    main.appendChild(text);
  }
  if (comment.media) {
    const frame = document.createElement("div");
    frame.className = "twr-media";
    frame.appendChild(postPhoto(comment.media, true));
    main.appendChild(frame);
  }
  const count = Number(comment.replies) || 0;
  const foot = document.createElement("div");
  foot.className = "twr-foot";
  if (opts.like && comment.id) {
    const like = document.createElement("button");
    like.type = "button";
    like.className = comment.liked ? "twr-like on" : "twr-like";
    like.setAttribute("aria-label", t("likeLabel"));
    like.setAttribute("aria-pressed", String(Boolean(comment.liked)));
    like.appendChild(svgIcon(ICONS.like));
    const likes = document.createElement("span");
    likes.textContent = comment.likes ? compactCount(comment.likes) : "";
    like.appendChild(likes);
    like.addEventListener("click", (event) => {
      event.stopPropagation();
      const on = !like.classList.contains("on");
      like.classList.toggle("on", on);
      const next = Math.max(0, (Number(comment.likes) || 0) + (on === Boolean(comment.liked) ? 0 : on ? 1 : -1));
      likes.textContent = next ? compactCount(next) : "";
      opts.like(comment);
    });
    foot.appendChild(like);
  }
  if (opts.reply && comment.id) {
    const answer = document.createElement("button");
    answer.type = "button";
    answer.className = "twr-answer";
    answer.textContent = t("twdReply");
    answer.addEventListener("click", (event) => {
      event.stopPropagation();
      opts.reply(comment);
    });
    foot.appendChild(answer);
  }
  if (count && opts.open) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "twr-answer twr-more";
    more.textContent = tf("twrShowReplies", { n: count });
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      opts.open(comment);
    });
    foot.appendChild(more);
  } else if (count) {
    const label = document.createElement("span");
    label.className = "twr-count";
    label.textContent = tf("twrReplyCount", { n: count });
    foot.appendChild(label);
  }
  if (foot.childElementCount) main.appendChild(foot);
  if (opts.open) {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, img, video, .person-link")) return;
      opts.open(comment);
    });
  }
  card.append(personLink(avatarNode(bits), authorPid(comment)), main);
  return card;
}

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

async function loadIdeas() {
  const feed = view === "home" ? feedMode : "company";
  const query = view === "groups" && activeGroup ? `group=${encodeURIComponent(activeGroup)}` : `feed=${encodeURIComponent(feed)}`;
  const seq = ++ideasSeq;
  const cached = selectedPerson ? ideasCache.get(query) : null;
  if (cached) {
    ideas = cached.data.ideas || [];
    stats = cached.data.stats || computeStats(ideas);
    paintIdeas();
  }
  try {
    const response = await fetch(`/api/ideas?${query}`, {
      headers: selectedPerson ? { "x-session": selectedPerson.token } : {},
    });
    if (seq !== ideasSeq) return;
    if (response.status === 401) {
      clearSession();
      return;
    }
    if (!response.ok) return;
    const raw = await response.text();
    if (seq !== ideasSeq) return;
    mode = "api";
    document.querySelector("#mode-note").hidden = true;
    if (cached && cached.raw === raw) return;
    const data = JSON.parse(raw);
    if (selectedPerson) ideasCache.set(query, { raw, data });
    ideas = data.ideas || [];
    stats = data.stats || computeStats(ideas);
  } catch {
    if (seq !== ideasSeq) return;
    ideas = readLocal();
    stats = computeStats(ideas);
    mode = "local";
    document.querySelector("#mode-note").hidden = false;
  }
  paintIdeas();
}

function paintIdeas() {
  renderPulse();
  renderInbox();
  if (view === "profile") renderProfile();
  if (view === "person") paintPerson();
  if (view === "groups") renderGroupFeed();
  if (view === "recognition") renderRecognition();
  if (view === "growth" || view === "storyboard") renderGrowth();
  if (view === "announcements") renderAnnouncements();
  if (view === "department") renderDepartmentPosts();
  paintGlobalAnnounce();
  restoreRoute();
  const hash = (location.hash.startsWith("#idea=") ? location.hash : startRoute).match(/^#idea=(.+)$/);
  if (hash && !openId) {
    const id = decodeURIComponent(hash[1]);
    if (ideas.some((idea) => idea.id === id)) {
      startRoute = "";
      openThread(id);
    }
  }
}

async function saveIdea(payload) {
  if (mode !== "api") throw new Error("directory");
  const response = await fetch("/api/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: payload.token,
      title: payload.title,
      text: payload.text,
      problem: payload.problem,
      pros: payload.pros,
      cons: payload.cons,
      impact: payload.impact,
      place: payload.place,
      project: payload.project || "",
      type: payload.type,
      thanksPid: payload.thanksPid,
      options: payload.options,
      mentions: payload.mentions,
      media: payload.media || "",
      gallery: payload.gallery || [],
      eventAt: payload.eventAt || "",
      groupId: payload.groupId,
      groupName: payload.groupName,
      replies: payload.replies || "all",
      voter: voterId(),
    }),
  });
  if (response.status === 401) throw new Error("employee");
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error === "terms" ? "terms" : "forbidden");
  }
  if (await conductReply(response)) throw new Error("offensive");
  if (!response.ok) throw new Error("save");
  const data = await response.json();
  ideas = data.ideas;
  stats = data.stats;
  return data;
}

async function updateIdea(id, payload) {
  if (mode !== "api") throw new Error("directory");
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-session": payload.token },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) throw new Error("employee");
  if (response.status === 403) throw new Error("forbidden");
  if (await conductReply(response)) throw new Error("offensive");
  if (!response.ok) throw new Error("save");
  const data = await response.json();
  ideas = data.ideas;
  stats = data.stats;
  return data;
}

function editIdea(idea) {
  if (!selectedPerson) {
    showGate();
    return;
  }
  editingId = idea.id;
  const untitled = COMPOSE_COPY[idea.type] && !COMPOSE_COPY[idea.type].title;
  // The API fills an empty title with the start of the text for display; saving it back would freeze the old text.
  titleInput.value = untitled && idea.title === String(idea.text || "").slice(0, 80) ? "" : idea.title || "";
  const pinned = geoPoint(idea.place);
  setPlaceValue(pinned ? "" : idea.place || "");
  problemInput.value = idea.problem || "";
  ideaInput.value = idea.text || "";
  setPointRows("pros", idea.pros || []);
  setPointRows("cons", idea.cons || []);
  impactInput.value = idea.impact || "";
  postType = idea.type || "idea";
  ideaStep = postType === "idea" ? 4 : 1;
  postMedia = idea.media || "";
  postExtra = Array.isArray(idea.gallery) ? idea.gallery.slice(1) : [];
  resetComposeRows();
  if (postType === "event") {
    document.querySelector("#event-place").value = idea.place || "";
    document.querySelector("#event-at").value = idea.event && idea.event.at ? localInputValue(idea.event.at) : "";
  } else if (postType !== "idea" || pinned) document.querySelector("#post-place").value = idea.place || "";
  document.querySelector("#post-project").value = idea.project || "";
  paintComposeRows();
  paintPostType();
  paintPostMedia();
  counter.textContent = `${ideaInput.value.length}/1000`;
  formError.textContent = "";
  syncFormMode();
  if (typeof stopDraft === "function") stopDraft();
  setReplyScope(idea.replies);
  composeDialog.showModal();
  titleInput.focus();
}

async function openPeople(id) {
  if (!selectedPerson || !selectedPerson.token) {
    showGate();
    return;
  }
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}/engagement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token }),
  });
  if (response.status === 401) {
    clearSession();
    return;
  }
  if (!response.ok) return;
  const data = await response.json();
  const body = document.querySelector("#people-body");
  body.replaceChildren();
  [
    ["likes", "peopleLikes", ""],
    ["dislikes", "peopleDislikes", ""],
    ["reposts", "", "repost"],
    ["saves", "peopleSaves", ""],
  ].forEach(([key, label, icon]) => {
    const group = document.createElement("section");
    group.className = "people-group";
    const heading = document.createElement("h3");
    const list = Array.isArray(data[key]) ? data[key] : [];
    if (icon) {
      heading.appendChild(svgIcon(ICONS[icon]));
      heading.append(` ${list.length}`);
    } else {
      heading.textContent = `${t(label)} · ${list.length}`;
    }
    group.appendChild(heading);
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "people-empty";
      empty.textContent = t("peopleNone");
      group.appendChild(empty);
    } else {
      list.forEach((account) => {
        const row = document.createElement("div");
        row.className = "people-row";
        const name = account.name || "—";
        row.appendChild(avatarNode({ ...account, name, initial: "•" }));
        const text = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = name;
        const meta = document.createElement("p");
        meta.textContent = [deptLabel(account.department), account.position].filter(Boolean).join(" · ");
        text.append(strong, meta);
        row.appendChild(text);
        group.appendChild(row);
      });
    }
    body.appendChild(group);
  });
  document.querySelector("#people").showModal();
}

async function toggleSave(id) {
  if (!selectedPerson || !selectedPerson.token) {
    showGate();
    return;
  }
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}/bookmark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token }),
  });
  if (response.status === 401) {
    clearSession();
    return;
  }
  if (!response.ok) return;
  takeIdeas(await response.json());
  renderPulse();
  renderInbox();
  if (openId) renderThread();
  if (view === "profile") renderProfile();
}

async function updateStatus(id, status) {
  if (mode === "local") {
    const idea = ideas.find((item) => item.id === id);
    if (!idea) return;
    idea.status = status;
    idea.history = Array.isArray(idea.history) ? idea.history : [];
    idea.history.push({
      status,
      at: new Date().toISOString(),
      name: selectedPerson ? selectedPerson.name : "",
      department: selectedPerson ? selectedPerson.department : "",
      position: selectedPerson ? selectedPerson.position : "",
    });
    writeLocal(ideas);
    stats = computeStats(ideas);
  } else {
    const response = await fetch(`/api/ideas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session": selectedPerson ? selectedPerson.token : "" },
      body: JSON.stringify({ status, token: selectedPerson ? selectedPerson.token : "" }),
    });
    if (!response.ok) {
      loadIdeas();
      return;
    }
    const data = await response.json();
    ideas = data.ideas;
    stats = data.stats;
  }
  renderPulse();
  renderInbox();
  if (openId) renderThread();
  loadAlerts();
}

async function rateIdea(id, vote) {
  if (!selectedPerson || !selectedPerson.token) {
    showGate();
    return;
  }
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}/rating`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token, vote }),
  });
  if (response.status === 401) {
    clearSession();
    return;
  }
  if (!response.ok) return;
  takeIdeas(await response.json());
  renderPulse();
  renderInbox();
  if (openId) renderThread();
  if (view === "profile") renderProfile();
  if (view === "growth" || view === "storyboard") renderGrowth();
  loadAlerts();
}

async function addComment(id, text, media, replyTo) {
  if (!text && !media) return "failed";
  if (!selectedPerson || !selectedPerson.token) return "verify";
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: selectedPerson.token,
      text,
      media: media || "",
      replyTo: replyTo || "",
      voter: voterId(),
    }),
  });
  if (response.status === 401) {
    clearSession();
    return "verify";
  }
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    return data.error === "terms" ? "terms" : "closed";
  }
  if (await conductReply(response)) return "offensive";
  if (!response.ok) return "failed";
  takeIdeas(await response.json());
  renderPulse();
  renderInbox();
  loadAlerts();
  return "ok";
}

const commentLikeBusy = new Set();

async function likeComment(ideaId, commentId) {
  if (!selectedPerson || commentLikeBusy.has(commentId)) return;
  commentLikeBusy.add(commentId);
  try {
    const response = await fetch(`/api/ideas/${encodeURIComponent(ideaId)}/comment-like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token, commentId }),
    });
    if (response.status === 401) {
      clearSession();
      return;
    }
    if (!response.ok) return;
    takeIdeas(await response.json());
    renderInbox();
    loadAlerts();
  } finally {
    commentLikeBusy.delete(commentId);
  }
}

function takeIdeas(data) {
  ideas = data.ideas || [];
  stats = data.stats || stats;
  if (data.idea && typeof admPeek !== "undefined" && !ideas.some((item) => item.id === data.idea.id)) admPeek.set(data.idea.id, data.idea);
}

function announceItems() {
  const fromAlerts = alerts.filter((item) => item.type === "announce").map((note) => ({
    id: note.ideaId || "",
    title: note.ideaTitle || t("announceKicker"),
    text: note.text || "",
    place: "",
    createdAt: note.createdAt,
  }));
  const fromPosts = ideas.filter((idea) => idea.type === "announcement").map((idea) => ({
    id: idea.id,
    title: idea.title || excerpt(idea.text, 60),
    text: idea.title ? idea.text || "" : "",
    place: idea.project || displayPlace(idea.place) || "",
    createdAt: idea.createdAt,
    pinned: Boolean(idea.pinned),
    source: idea,
  }));
  return [...fromPosts, ...fromAlerts].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.createdAt) - new Date(a.createdAt));
}

function announceDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: "", time: "" };
  const locale = lang === "ar" ? "ar-SA" : "en-GB";
  return {
    day: date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
  };
}

function announceCard(item) {
  const card = document.createElement("article");
  card.className = "announce";
  const brand = document.createElement("div");
  brand.className = "announce-brand";
  const logo = document.createElement("img");
  logo.src = "/img/bq-connect.svg";
  logo.alt = "";
  const word = document.createElement("span");
  word.append("بن قريعة", document.createElement("br"));
  const small = document.createElement("small");
  small.textContent = "BIN QURAYA";
  word.appendChild(small);
  brand.append(logo, word);
  const title = document.createElement("h2");
  title.textContent = item.title;
  const text = document.createElement("p");
  text.textContent = item.text;
  const facts = document.createElement("ul");
  facts.className = "announce-facts";
  const when = announceDate(item.createdAt);
  [when.day, when.time, item.place].filter(Boolean).forEach((value) => {
    const li = document.createElement("li");
    li.textContent = value;
    facts.appendChild(li);
  });
  if (item.pinned) {
    const pin = document.createElement("span");
    pin.className = "announce-pin";
    pin.textContent = t("pinnedTag");
    brand.appendChild(pin);
  }
  card.append(brand, title, text, facts);
  if (item.source && typeof announceFooter === "function") card.appendChild(announceFooter(item.source));
  if (item.id) {
    card.classList.add("tap");
    card.addEventListener("click", () => openThread(item.id));
  }
  return card;
}

function renderAnnounce() {
  const box = document.querySelector("#announce");
  if (!box) return;
  const item = announceItems()[0];
  box.hidden = !item || view !== "home";
  if (!item) return;
  const when = announceDate(item.createdAt);
  document.querySelector("#announce-title").textContent = item.title;
  document.querySelector("#announce-text").textContent = item.text;
  document.querySelector("#announce-date").textContent = when.day;
  document.querySelector("#announce-time").textContent = item.place ? `${when.time} · ${item.place}` : when.time;
  box.onclick = item.id ? () => openThread(item.id) : null;
}

function renderAnnouncements() {
  const list = document.querySelector("#announce-list");
  if (!list) return;
  list.replaceChildren();
  const items = announceItems();
  const events = typeof eventsSection === "function" ? eventsSection() : null;
  if (events) list.appendChild(events);
  if (!items.length && events) return;
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("inboxEmpty");
    list.appendChild(empty);
    return;
  }
  items.forEach((item) => list.appendChild(announceCard(item)));
}

const NOTICE_ICONS = {
  join: "M10 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM4 19.5c1-3 3.2-4.5 6-4.5 1.3 0 2.5.3 3.4.9M18 13.5v6M15 16.5h6",
  like: ICONS.like,
  thanks: ICONS.like,
  dislike: ICONS.dislike,
  repost: ICONS.repost,
  message: ICONS.reply,
  comment: ICONS.reply,
  reply: ICONS.reply,
  "comment-like": ICONS.like,
  status: "M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.7.5-1.1 1.2-1.2 2.1h-4.6c-.1-.9-.5-1.6-1.2-2.1A6 6 0 0 1 12 3z",
  mention: "M16 12a4 4 0 1 1-1.2-2.8M16 8v5.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  complaint: "M12 4 3.5 19h17zM12 10v4M12 16.5v.5",
  announce: "M4 10v4l10 3V7zM14 8.5c2 .8 3 2 3 3.5s-1 2.7-3 3.5",
  event: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
  report: "M5 21V4.5M5 4.5h11l-2 4 2 4H5",
  hidden: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.2-3.1 3.5M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  restored: "M2.5 12c1-1.5 4.5-6 9.5-6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6s-8.5-4.5-9.5-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  achievement: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4M8.5 20h7M10 17h4",
};
NOTICE_ICONS["achievement-ok"] = NOTICE_ICONS.achievement;
NOTICE_ICONS["achievement-no"] = NOTICE_ICONS.achievement;
NOTICE_ICONS.login_new = "M12 3l7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6zM9 12l2 2 4-4";

function renderAlertCount() {
  const badge = document.querySelector("#alert-count");
  const unread = alerts.filter((note) => !note.read).length;
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? "9+" : String(unread);
}

function noticeKind(note) {
  if (note.kind) return note.kind;
  const idea = ideas.find((item) => item.id === note.ideaId) || (typeof admPeek !== "undefined" ? admPeek.get(note.ideaId) : null);
  if (!idea) return "post";
  if (idea.type === "story") return "story";
  if (isVideoSrc(idea.media)) return "reel";
  return idea.type || "idea";
}

function renderAlerts() {
  const list = document.querySelector("#alert-list");
  list.replaceChildren();
  if (!alerts.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("alertEmpty");
    list.appendChild(empty);
    return;
  }
  alerts.forEach((note) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notice";
    if (!note.read) button.classList.add("unread");
    const title = document.createElement("strong");
    const name = note.actorName || "—";
    const keys = {
      like: "alertLike",
      dislike: "alertDislike",
      status: "alertStatus",
      mention: "alertMention",
      thanks: "alertThanks",
      repost: "alertRepost",
      complaint: "alertComplaint",
      message: "alertMessage",
      reply: "alertReply",
      "comment-like": "alertCommentLike",
      announce: "alertAnnounce",
      report: note.text === "auto" ? "alertReportAuto" : "alertReport",
      hidden: "alertHidden",
      restored: "alertRestored",
      event: "alertEvent",
      achievement: "alertAchPending",
      "achievement-ok": "alertAchOk",
      "achievement-no": "alertAchNo",
      login_new: "alertLoginNew",
      join: "alertJoin",
    };
    const achievement = String(note.type || "").startsWith("achievement");
    const key = keys[note.type] || "alertComment";
    const quiet = ["report", "hidden", "restored", "event"].includes(note.type);
    const kind = noticeKind(note);
    const vars = { name, status: statusLabel(note.text), noun: t(`noun_${kind}`) || t("noun_post"), where: t(`in_${kind}`) || t("in_post") };
    title.textContent = note.type === "announce" ? (note.ideaTitle || t("announceKicker")) : tf(key, vars);
    const sub = document.createElement("span");
    if (note.type === "login_new") sub.textContent = [note.ideaTitle, note.text ? `\u2066${note.text}\u2069` : "", t("alertLoginNewHint")].filter(Boolean).join(" · ");
    else sub.textContent = note.type === "announce" ? note.text : note.type === "status" || quiet || achievement ? note.ideaTitle || "" : [note.ideaTitle, note.text].filter(Boolean).join(" — ");
    const time = document.createElement("small");
    time.textContent = timeAgo(note.createdAt);
    const icon = document.createElement("span");
    icon.className = `n-icon n-${note.type || "comment"}`;
    icon.appendChild(svgIcon(NOTICE_ICONS[note.type] || NOTICE_ICONS.comment));
    const body = document.createElement("div");
    body.className = "n-body";
    body.append(title, sub, time);
    button.append(icon, body);
    if (note.type === "status" && note.text) {
      const pill = document.createElement("em");
      pill.className = `n-pill s-${note.text}`;
      pill.textContent = statusLabel(note.text);
      button.appendChild(pill);
    }
    const chev = document.createElement("i");
    chev.className = "chev";
    button.appendChild(chev);
    button.addEventListener("click", () => {
      if (note.type === "login_new") {
        showView("settings");
        showSettings("privacy");
      } else if ((note.type === "report" || note.type === "join") && selectedPerson && selectedPerson.dashboard && typeof admTab !== "undefined") {
        admTab = note.type === "join" ? "joins" : "reports";
        showView("dashboard");
      } else if (note.type === "report" && selectedPerson && selectedPerson.moderator) showView("moderation");
      else if (achievement && note.text) openDepartment(note.text, "achievements");
      else if (note.ideaId) openThread(note.ideaId);
    });
    list.appendChild(button);
  });
}

function contributionPoints(idea) {
  const base = !idea.type || idea.type === "idea" ? 10 : 4;
  return base + (idea.rating?.likes || 0) * 2 + (idea.comments?.length || 0) * 3;
}

function pointsFor(mine, pid) {
  return ideas.reduce((sum, idea) => {
    const author = idea.author && idea.author.pid ? idea.author.pid : idea.pid || "";
    const match = mine ? idea.mine : author === pid;
    return match ? sum + contributionPoints(idea) : sum;
  }, 0);
}

function levelFor(points) {
  return 1 + Math.floor(points / 300);
}

function topicImage(text) {
  const blob = String(text || "");
  if (/hse|safety|سلام/i.test(blob)) return "img/hse.jpg";
  if (/rig|drill|حفار|حفر/i.test(blob)) return "img/rig.jpg";
  if (/maint|صيان|workshop|ورش/i.test(blob)) return "img/maintenance.jpg";
  if (/diesel|fuel|cost|وقود|ديزل|تكلف|توفير/i.test(blob)) return "img/diesel.jpg";
  if (/research|r&d|innov|تطوير|ابتكار|هندس/i.test(blob)) return "img/rnd.jpg";
  if (/oper|تشغيل|عمليات|موقع/i.test(blob)) return "img/operations.jpg";
  return "img/moment.jpg";
}

function ideaBlob(idea) {
  return `${idea.author?.department || ""} ${idea.title || ""} ${idea.text || ""} ${idea.place || ""} ${idea.project || ""}`;
}

function renderRecognition() {
  const list = document.querySelector("#rank-list");
  if (!list) return;
  const totals = new Map();
  ideas.forEach((idea) => {
    const pid = (idea.author && idea.author.pid) || idea.pid;
    if (!pid || !(idea.author && idea.author.name)) return;
    const row = totals.get(pid) || {
      name: idea.author.name,
      meta: [deptLabel(idea.author.department), idea.author.position].filter(Boolean).join(" · "),
      points: 0,
    };
    row.points += contributionPoints(idea);
    totals.set(pid, row);
  });
  const sorted = [...totals.values()].sort((left, right) => right.points - left.points);
  const rows = rankAll ? sorted.slice(0, 50) : sorted.slice(0, 3);
  const allButton = document.querySelector("#rank-all");
  if (allButton) {
    allButton.hidden = sorted.length <= 3;
    allButton.textContent = rankAll ? t("bqShowLess") : t("bqViewAll");
  }
  list.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("inboxEmpty");
    list.appendChild(empty);
    return;
  }
  rows.forEach((row, index) => {
    const card = document.createElement("article");
    card.className = "rank-card";
    const mark = document.createElement("b");
    mark.className = index < 3 ? `medal m${index + 1}` : "medal";
    mark.textContent = String(index + 1);
    const face = avatarNode({ ...row, initial: "•" });
    const copy = document.createElement("div");
    copy.className = "rank-copy";
    const name = document.createElement("strong");
    name.textContent = row.name;
    const meta = document.createElement("span");
    meta.textContent = row.meta;
    copy.append(name, meta);
    const pts = document.createElement("em");
    pts.textContent = `${row.points.toLocaleString("en-US")} ${t("bqPts")}`;
    card.append(mark, face, copy, pts);
    list.appendChild(card);
  });
}

function momentMatches(idea) {
  const blob = ideaBlob(idea);
  if (momentChip === "safety") return /hse|safety|سلام/i.test(blob);
  if (momentChip === "projects") return idea.status === "project" || Boolean(idea.project) || /rig|project|مشروع|حفار/i.test(blob);
  if (momentChip === "innovation") return !idea.type || idea.type === "idea" || /research|r&d|innov|تطوير|ابتكار/i.test(blob);
  return true;
}

function reelAction(path, count, label, onClick, on) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = on ? "reel-act on" : "reel-act";
  button.setAttribute("aria-label", label);
  button.appendChild(svgIcon(path));
  const span = document.createElement("span");
  span.textContent = count ? String(count) : label;
  button.appendChild(span);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function momentCard(idea) {
  const card = document.createElement("article");
  card.className = "reel";
  if (isVideoSrc(idea.media)) {
    const clip = document.createElement("video");
    clip.className = "reel-media";
    clip.src = idea.media;
    clip.muted = true;
    clip.loop = true;
    clip.autoplay = true;
    clip.playsInline = true;
    card.appendChild(clip);
  } else card.style.backgroundImage = `url('${idea.media || topicImage(ideaBlob(idea))}')`;
  const shade = document.createElement("div");
  shade.className = "reel-shade";
  const bits = authorBits(idea);
  const who = document.createElement("div");
  who.className = "reel-who";
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = bits.name;
  const meta = document.createElement("span");
  meta.textContent = postMetaLine(idea, bits);
  copy.append(name, meta);
  who.append(avatarNode(bits), copy);
  const title = document.createElement("h3");
  title.textContent = idea.title || excerpt(idea.text, 90);
  const text = document.createElement("p");
  text.textContent = idea.title ? excerpt(idea.text, 120) : "";
  shade.append(who, title, text);
  const side = document.createElement("div");
  side.className = "reel-side";
  side.append(
    reelAction(ICONS.like, idea.rating?.likes || 0, t("likeLabel"), () => rateIdea(idea.id, "like"), idea.rating?.mine === "like"),
    reelAction(ICONS.reply, Array.isArray(idea.comments) ? idea.comments.length : 0, t("bqComment"), () => openThread(idea.id)),
    reelAction(ICONS.repost, idea.reposts || 0, t("bqShare"), () => openThread(idea.id), Boolean(idea.reposted)),
  );
  card.append(shade, side);
  card.addEventListener("click", () => openThread(idea.id));
  return card;
}

let reelsMuted = false;
let reelsWatcher = null;

function reelVideos() {
  return [...document.querySelectorAll("#growth-stories video")];
}

function pauseReels() {
  reelVideos().forEach((video) => video.pause());
}

function playReel(video) {
  video.muted = reelsMuted;
  video.play().catch(() => {
    reelsMuted = true;
    video.muted = true;
    paintReelMute();
    video.play().catch(() => {});
  });
}

function paintReelMute() {
  document.querySelectorAll("#growth-stories .reel-mute").forEach((button) => {
    button.replaceChildren(svgIcon(reelsMuted ? ICONS.muted : ICONS.sound));
    button.setAttribute("aria-label", t(reelsMuted ? "bqUnmute" : "bqMute"));
  });
  reelVideos().forEach((video) => {
    video.muted = reelsMuted;
  });
}

function watchReels(feed) {
  if (reelsWatcher) reelsWatcher.disconnect();
  if (!("IntersectionObserver" in window)) return;
  reelsWatcher = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector("video");
      if (entry.isIntersecting) markStorySeen(entry.target.dataset.id);
      if (!video) return;
      if (entry.isIntersecting && !document.querySelector("#storyboard").hidden) {
        playReel(video);
        const next = entry.target.nextElementSibling && entry.target.nextElementSibling.querySelector("video");
        if (next) next.preload = "auto";
      } else video.pause();
    });
  }, { root: feed, threshold: 0.6 });
  feed.querySelectorAll(".reel-item").forEach((item) => reelsWatcher.observe(item));
}

function paintReelCounts(item, idea) {
  const like = item.querySelector(".reel-like");
  if (like) {
    like.classList.toggle("on", idea.rating?.mine === "like");
    like.querySelector("span").textContent = idea.rating?.likes ? String(idea.rating.likes) : t("likeLabel");
  }
  const reply = item.querySelector(".reel-reply");
  const count = Array.isArray(idea.comments) ? idea.comments.length : 0;
  if (reply) reply.querySelector("span").textContent = count ? String(count) : t("bqComment");
  const repost = item.querySelector(".reel-repost");
  if (repost) {
    repost.classList.toggle("on", Boolean(idea.reposted));
    repost.querySelector("span").textContent = idea.reposts ? String(idea.reposts) : t("repost");
  }
  const follow = item.querySelector(".reel-follow");
  if (follow && follow.classList.contains("on") !== Boolean(idea.followed)) paintFollowPill(follow, idea.followed);
}

function reelItem(idea) {
  const item = document.createElement("article");
  item.className = "reel-item";
  item.dataset.id = idea.id;
  const clip = document.createElement("video");
  clip.src = idea.media;
  clip.loop = true;
  clip.playsInline = true;
  clip.muted = reelsMuted;
  clip.preload = "metadata";
  item.appendChild(clip);
  const paused = document.createElement("span");
  paused.className = "reel-paused";
  paused.hidden = true;
  paused.appendChild(svgIcon("M8 5.5v13l10.5-6.5z"));
  item.appendChild(paused);
  clip.addEventListener("pause", () => {
    paused.hidden = document.querySelector("#storyboard").hidden;
  });
  clip.addEventListener("play", () => {
    paused.hidden = true;
  });
  item.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    if (clip.paused) playReel(clip);
    else clip.pause();
  });
  const bits = authorBits(idea);
  const info = document.createElement("div");
  info.className = "reel-info";
  const who = document.createElement("div");
  who.className = "reel-who";
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = bits.name;
  const meta = document.createElement("span");
  meta.textContent = [bits.position || deptLabel(idea.author?.department), timeAgo(idea.createdAt)].filter(Boolean).join(" · ");
  copy.append(name, meta);
  const pid = authorPid(idea);
  const face = avatarNode(bits);
  [face, name].forEach((node) => {
    node.addEventListener("click", pauseReels);
    personLink(node, pid);
  });
  who.append(face, copy);
  if (pid && !idea.mine) {
    const follow = followPill(pid, bits.name, idea.followed, () => loadIdeas());
    follow.classList.add("reel-follow");
    who.appendChild(follow);
  }
  info.appendChild(who);
  if (idea.text) {
    const caption = document.createElement("p");
    caption.textContent = idea.text;
    info.appendChild(caption);
  }
  const side = document.createElement("div");
  side.className = "reel-side";
  const like = reelAction(ICONS.like, 0, t("likeLabel"), () => rateIdea(idea.id, "like"), false);
  like.classList.add("reel-like");
  const reply = reelAction(ICONS.reply, 0, t("bqComment"), () => {
    pauseReels();
    openThread(idea.id);
  });
  reply.classList.add("reel-reply");
  const repost = reelAction(ICONS.repost, 0, t("repost"), () => toggleRepost(idea.id), false);
  repost.classList.add("reel-repost");
  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "reel-act reel-mute";
  mute.addEventListener("click", (event) => {
    event.stopPropagation();
    reelsMuted = !reelsMuted;
    paintReelMute();
  });
  side.append(like, reply, repost, mute);
  item.append(info, side);
  paintReelCounts(item, idea);
  return item;
}

function openReel(idea) {
  reelsFocus = { pid: authorPid(idea), id: idea.id, from: view };
  reelsOpening = true;
  showView("storyboard");
}

function closeReelFocus() {
  const from = reelsFocus ? reelsFocus.from : "home";
  reelsFocus = null;
  showView(from);
  if (from === "person" && typeof paintPerson === "function") paintPerson();
}

function renderReels() {
  const feed = document.querySelector("#growth-stories");
  if (!feed) return;
  const back = document.querySelector("#reels-back");
  if (back) back.hidden = !reelsFocus;
  const rows = ideas
    .filter((idea) => idea.media && isVideoSrc(idea.media) && !idea.hidden)
    .filter((idea) => !reelsFocus || authorPid(idea) === reelsFocus.pid)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const signature = `${reelsFocus ? reelsFocus.pid : ""}#${rows.map((idea) => `${idea.id}:${idea.media}`).join("|")}`;
  const jump = reelsFocus && reelsFocus.jump !== false ? reelsFocus.id : "";
  if (jump) {
    reelsFocus.jump = false;
    requestAnimationFrame(() => {
      const target = feed.querySelector(`.reel-item[data-id="${CSS.escape(jump)}"]`);
      if (target) feed.scrollTop = target.offsetTop;
    });
  }
  if (feed.dataset.sig === signature && feed.childElementCount) {
    rows.forEach((idea) => {
      const item = feed.querySelector(`.reel-item[data-id="${CSS.escape(idea.id)}"]`);
      if (item) paintReelCounts(item, idea);
    });
    return;
  }
  feed.dataset.sig = signature;
  pauseReels();
  feed.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "reels-empty";
    const icon = svgIcon(ICONS.camera);
    const text = document.createElement("p");
    text.textContent = t("bqReelsEmpty");
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn";
    add.textContent = t("bqAddStory");
    add.addEventListener("click", () => openStoryCamera());
    empty.append(icon, text, add);
    feed.appendChild(empty);
    return;
  }
  rows.forEach((idea) => feed.appendChild(reelItem(idea)));
  paintReelMute();
  watchReels(feed);
}

function renderGrowth() {
  const moments = document.querySelector("#moments");
  const stories = document.querySelector("#growth-stories");
  document.querySelectorAll("[data-moment]").forEach((button) => button.classList.toggle("on", button.dataset.moment === momentChip));
  if (moments) {
    moments.replaceChildren();
    const rows = ideas.filter((idea) => idea.type !== "story" && idea.type !== "poll").filter(momentMatches).slice(0, 20);
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = t("inboxNoMatch");
      moments.appendChild(empty);
    }
    rows.forEach((idea) => moments.appendChild(momentCard(idea)));
  }
  if (stories && view === "storyboard") renderReels();
}

async function loadAlerts() {
  if (!selectedPerson || !selectedPerson.token) return;
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token }),
  });
  if (response.status === 401) {
    clearSession();
    return;
  }
  if (!response.ok) return;
  const data = await response.json();
  alerts = data.notifications || [];
  renderAlertCount();
  renderAnnounce();
  if (view === "alerts" && detailView.hidden) renderAlerts();
}

async function markAlertsRead() {
  if (!selectedPerson || !selectedPerson.token) return;
  alerts.forEach((note) => {
    note.read = true;
  });
  renderAlertCount();
  await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token }),
  });
}

async function removeIdea(id) {
  if (!window.confirm(t("removeAsk"))) return;
  if (mode === "local") {
    ideas = ideas.filter((idea) => idea.id !== id);
    writeLocal(ideas);
    stats = computeStats(ideas);
  } else {
    const response = await fetch(`/api/ideas/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-session": selectedPerson ? selectedPerson.token : "" },
    });
    if (!response.ok) return;
    const data = await response.json();
    ideas = data.ideas;
    stats = data.stats;
  }
  renderPulse();
  if (openId === id) closeThread();
  renderInbox();
}

document.querySelectorAll("[data-set-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.setLang;
    localStorage.setItem("bq-lang-chosen", "1");
    applyI18n();
  });
});

if (!localStorage.getItem("bq-lang-chosen")) document.querySelector("#splash").classList.add("is-picking");
document.querySelectorAll("[data-pick-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.pickLang;
    localStorage.setItem("bq-lang-chosen", "1");
    applyI18n();
    document.querySelector("#splash").classList.remove("is-picking");
    document.querySelector("#splash-signin").focus();
  });
});

ideaInput.addEventListener("input", () => {
  const max = Number(ideaInput.maxLength) || 1000;
  counter.textContent = `${ideaInput.value.length}/${max}`;
  counter.classList.toggle("warn", ideaInput.value.length > max * 0.9);
  formError.textContent = "";
});

searchInput.addEventListener("input", () => {
  renderInbox();
  queueSearch(searchInput.value, document.querySelector("#search-panel"), (person, kind) => {
    document.querySelector("#search-panel").hidden = true;
    searchInput.value = "";
    if (kind === "department") openDepartment(person);
    else social("follow", { pid: person.pid }).then(() => loadIdeas());
  });
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    sortMode = button.dataset.sort;
    renderInbox();
  });
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.people) projectChip = "departments";
    if (button.dataset.projects) projectChip = "all";
    showView(button.dataset.view);
  });
});

document.querySelectorAll("[data-profile]").forEach((button) => {
  button.addEventListener("click", () => {
    profileTab = button.dataset.profile;
    renderProfile();
  });
});

document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loginPerson();
});

document.querySelector("#ig-menu").addEventListener("click", (event) => {
  event.stopPropagation();
  openDrawer();
});

document.querySelector("#logout").addEventListener("click", () => {
  closeDrawer();
  if (selectedPerson && selectedPerson.token) {
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token, op: "logout" }),
      keepalive: true,
    }).catch(() => {});
  }
  clearSession();
});

document.querySelector("#drawer-backdrop").addEventListener("click", closeDrawer);
document.querySelector("#settings-back").addEventListener("click", () => showView("home"));
document.querySelectorAll(".settings-up").forEach((button) => {
  button.addEventListener("click", () => showSettings("root"));
});
document.querySelectorAll("[data-settings]").forEach((button) => {
  button.addEventListener("click", () => showSettings(button.dataset.settings));
});
document.querySelectorAll("[data-drawer]").forEach((button) => {
  button.addEventListener("click", () => {
    closeDrawer();
    const next = button.dataset.drawer;
    if (next === "saved") {
      profileTab = "saved";
      showView("profile");
      return;
    }
    if (next === "department") {
      if (selectedPerson && deptLabel(selectedPerson.department)) openDepartment(selectedPerson.department);
      return;
    }
    showView(next);
  });
});

function paintSettingsAvatar(node) {
  paintAvatar(node, selectedPerson);
}

function paintSettingsRoot() {
  paintSettingsAvatar(document.querySelector("#set-hero-avatar"));
  const name = document.querySelector("#set-hero-name");
  name.textContent = selectedPerson.name;
  if (selectedPerson.official) name.appendChild(officialMark());
  document.querySelector("#set-hero-meta").textContent = [deptLabel(selectedPerson.department), selectedPerson.position].filter(Boolean).join(" · ");
  const pill = document.querySelector("#set-tfa-pill");
  pill.hidden = false;
  pill.classList.toggle("is-on", Boolean(selectedPerson.twoFactor));
  pill.textContent = t(selectedPerson.twoFactor ? "setTfaOn" : "setTfaOff");
  document.querySelector("#set-lang-value").textContent = lang === "ar" ? "العربية" : "English";
  const theme = typeof themeChoice === "function" ? themeChoice() : "light";
  document.querySelector("#set-theme-value").textContent = t({ light: "themeLight", dark: "themeDark" }[theme] || "themeSystem");
  const installed = typeof isStandalone === "function" && isStandalone();
  document.querySelector("#set-install-value").textContent = installed ? t("setInstalled") : "";
}

function showSettings(pane) {
  document.querySelectorAll("[data-settings-pane]").forEach((node) => {
    node.hidden = node.dataset.settingsPane !== pane;
  });
  if (pane === "root" && selectedPerson) paintSettingsRoot();
  if (pane === "account" && selectedPerson) {
    paintSettingsAvatar(document.querySelector("#set-avatar"));
    const official = Boolean(selectedPerson.official);
    document.querySelector("#set-photo-pick").disabled = official;
    document.querySelector("#set-photo-pick .set-photo-cam").hidden = official;
    document.querySelector("#set-photo-hint").hidden = official || Boolean(selectedPerson.photo);
    document.querySelector("#set-photo-remove").hidden = official || !selectedPerson.photo;
    document.querySelector("#set-photo-error").textContent = "";
    document.querySelector("#set-name").textContent = selectedPerson.name;
    document.querySelector("#set-dept").textContent = deptLabel(selectedPerson.department) || "—";
    document.querySelector("#set-role").textContent = selectedPerson.position || "—";
  }
  if (pane === "privacy") paintSecurity();
}

let drawerStartX = null;
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest("input, textarea, button, a, .dm-compose")) return;
  drawerStartX = event.clientX;
});
document.addEventListener("pointerup", (event) => {
  if (drawerStartX == null) return;
  const dx = event.clientX - drawerStartX;
  drawerStartX = null;
  const rtl = document.documentElement.dir !== "ltr";
  if (rtl ? dx < -70 : dx > 70) openDrawer();
  else if (rtl ? dx > 70 : dx < -70) closeDrawer();
});

function openDrawer() {
  document.querySelector("#drawer").classList.add("open");
  document.querySelector("#drawer-backdrop").hidden = false;
}

function closeDrawer() {
  const drawer = document.querySelector("#drawer");
  const backdrop = document.querySelector("#drawer-backdrop");
  if (drawer) drawer.classList.remove("open");
  if (backdrop) backdrop.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (postType === "idea" && ideaStep < 4) {
    advanceIdea(1);
    return;
  }
  const title = titleInput.value.trim();
  const text = ideaInput.value.trim();
  if (!selectedPerson) {
    formError.textContent = mode === "api" ? t("errPerson") : t("errDirectory");
    badgeInput.focus();
    return;
  }
  if (!title && ["idea", "suggestion", "complaint", "poll", "article", "event"].includes(postType)) {
    formError.textContent = t("errTitle");
    titleInput.focus();
    return;
  }
  const eventInput = document.querySelector("#event-at");
  const eventAt = postType === "event" && eventInput.value ? new Date(eventInput.value) : null;
  if (postType === "event" && !(eventAt && eventAt.getTime() > Date.now())) {
    formError.textContent = t("eventDateError");
    eventInput.focus();
    return;
  }
  if (mediaBusy) {
    formError.textContent = t("bqUploading");
    return;
  }
  if (postType === "story" && !postMedia) {
    formError.textContent = t("bqStoryNeedsMedia");
    return;
  }
  const imageOnly = postMedia && ["post", "story", "thanks", "announcement"].includes(postType);
  if (!text && postType !== "poll" && postType !== "event" && !imageOnly) {
    formError.textContent = t("errRequired");
    ideaInput.focus();
    return;
  }
  if (sending) return;
  const checked = [title, text, problemInput.value, impactInput.value, ...document.querySelectorAll(".poll-option")].map((item) => (typeof item === "string" ? item : item.value)).join("\n");
  if (!(await termsCheck(checked))) return;
  sending = true;
  const submitButton = form.querySelector("button[type=submit] span");
  submitButton.textContent = t("sending");
  formError.textContent = "";

  try {
    const payload = {
      token: selectedPerson.token,
      title,
      text,
      problem: problemInput.value.trim(),
      pros: readPointRows("pros"),
      cons: readPointRows("cons"),
      impact: impactInput.value.trim(),
      place: postType === "event"
        ? document.querySelector("#event-place").value.trim()
        : (postType === "idea" && placeValue()) || document.querySelector("#post-place").value.trim(),
      project: document.querySelector("#post-project").value.trim(),
      type: postType,
      eventAt: eventAt ? eventAt.toISOString() : "",
      thanksPid,
      options: [...document.querySelectorAll(".poll-option")].map((input) => input.value.trim()).filter(Boolean),
      mentions: mentionPids,
      media: postType === "poll" ? "" : postMedia,
      gallery: postType === "poll" || postType === "story" ? [] : postExtra,
      groupId: view === "groups" ? activeGroup : "",
      groupName: "",
      replies: replyScope,
    };
    const wasEditing = Boolean(editingId);
    if (editingId) await updateIdea(editingId, payload);
    else await saveIdea(payload);
    if (!wasEditing && typeof clearDraft === "function") clearDraft(payload.type);
    editingId = null;
    syncFormMode();
    form.reset();
    setPointRows("pros", []);
    setPointRows("cons", []);
    setPlaceValue("");
    thanksPid = "";
    mentionPids = [];
    mentionNames = {};
    postMedia = "";
    postExtra = [];
    resetComposeRows();
    paintPostMedia();
    paintMentions();
    counter.textContent = "0/1000";
    paintPostType();
    await loadIdeas();
    composeDialog.close();
    if (payload.type === "story") renderStories();
    else if (!wasEditing) window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    if (error.message === "directory") formError.textContent = t("errDirectory");
    else if (error.message === "employee") {
      clearSession();
    } else if (error.message === "terms") {
      formError.textContent = t("termsNeeded");
      openTerms(true);
    } else if (error.message === "forbidden") formError.textContent = t("errForbidden");
    else if (error.message === "offensive") formError.textContent = t("conductBlocked");
    else formError.textContent = t("errFailed");
  } finally {
    sending = false;
    submitButton.textContent = t("submit");
  }
});

document.querySelector("#open-compose").addEventListener("click", () => openCreateMenu());
document.querySelector("#splash-signin").addEventListener("click", () => {
  document.querySelector("#splash").hidden = true;
  document.querySelector("#login-form").hidden = false;
  document.querySelector("#badge").focus();
});
const storyView = document.querySelector("#story-view");
let storyHold = 0;
let storyHolding = false;
document.querySelector("#story-close").addEventListener("click", (event) => {
  event.stopPropagation();
  closeStoryViewer();
});
document.querySelector("#story-mute").addEventListener("click", (event) => {
  event.stopPropagation();
  storyMuted = !storyMuted;
  const video = storyVideo();
  if (video) video.muted = storyMuted;
  paintStoryMute();
});
storyView.addEventListener("pointerdown", (event) => {
  if (event.target.closest("#story-close, #story-mute, #story-hl, #story-foot, #story-chat")) return;
  storyHolding = false;
  clearTimeout(storyHold);
  storyHold = setTimeout(() => {
    storyHolding = true;
    pauseStory();
  }, 180);
});
storyView.addEventListener("pointerup", (event) => {
  clearTimeout(storyHold);
  if (event.target.closest("#story-close, #story-mute, #story-hl, #story-foot, #story-chat")) return;
  if (storyHolding) {
    storyHolding = false;
    resumeStory();
    return;
  }
  const rect = storyView.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const rtl = document.documentElement.dir === "rtl";
  const previous = rtl ? x > rect.width * 0.72 : x < rect.width * 0.28;
  stepStory(previous ? -1 : 1);
});
storyView.addEventListener("pointercancel", () => {
  clearTimeout(storyHold);
  if (storyHolding) resumeStory();
  storyHolding = false;
});
document.addEventListener("keydown", (event) => {
  if (!storyView || storyView.hidden) return;
  if (storyChatOpen()) {
    if (event.key === "Escape") closeStoryChat(true);
    return;
  }
  if (event.key === "Escape") closeStoryViewer();
  if (event.key === "ArrowRight") stepStory(document.documentElement.dir === "rtl" ? -1 : 1);
  if (event.key === "ArrowLeft") stepStory(document.documentElement.dir === "rtl" ? 1 : -1);
});
document.querySelectorAll("[data-row]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.dataset.row;
    if (row === "tag") {
      tagOpen = !tagOpen;
      paintIdeaStudio();
      if (tagOpen) document.querySelector("#mention-search").focus();
      return;
    }
    if (row === "place") {
      locateMe();
      return;
    }
    const input = document.querySelector(row === "place" ? "#post-place" : "#post-project");
    input.hidden = !input.hidden;
    if (!input.hidden) input.focus();
  });
});
["#post-place", "#post-project"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", paintComposeRows);
});
document.querySelector("#post-add").addEventListener("click", () => pickPostFile(`${IMAGE_ACCEPT},${VIDEO_ACCEPT}`));
document.querySelectorAll("[data-soon]").forEach((button) => {
  button.addEventListener("click", () => {
    formError.textContent = t("bqSoon");
  });
});
document.querySelector("#hub-period").addEventListener("change", (event) => {
  hubPeriod = event.target.value;
  const day = document.querySelector("#hub-day");
  day.hidden = hubPeriod !== "day";
  if (hubPeriod === "day") {
    if (!day.value) day.value = localDay(new Date());
    hubDay = day.value;
    day.max = localDay(new Date());
  }
  renderInbox();
});
document.querySelector("#hub-day").addEventListener("change", (event) => {
  hubDay = event.target.value;
  renderInbox();
});
document.querySelectorAll("[data-hub-order]").forEach((button) => {
  button.addEventListener("click", () => {
    hubOrder = button.dataset.hubOrder;
    renderInbox();
  });
});
document.querySelectorAll("[data-project]").forEach((button) => {
  button.addEventListener("click", () => {
    projectChip = button.dataset.project;
    loadGroups();
  });
});
document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.jump === "groups") projectChip = "all";
    if (button.dataset.jump === "back") {
      showView(backView && backView !== view ? backView : "home");
      return;
    }
    showView(button.dataset.jump);
  });
});
function setHubSearch(open) {
  document.querySelector("#hub-search-row").classList.toggle("open", open);
  document.querySelector("#hub-search").setAttribute("aria-expanded", String(open));
  if (open) {
    hubQuery.focus();
    return;
  }
  clearTimeout(hubSearchTimer);
  if (!hubQuery.value) return;
  hubQuery.value = "";
  if (view === "hub") renderInbox();
}

document.querySelector("#hub-search").addEventListener("click", () => {
  setHubSearch(!document.querySelector("#hub-search-row").classList.contains("open"));
});
hubQuery.addEventListener("input", () => {
  clearTimeout(hubSearchTimer);
  hubSearchTimer = setTimeout(renderInbox, 80);
});
hubQuery.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setHubSearch(false);
  if (event.key === "Enter") hubQuery.blur();
});
document.querySelector("#hub-new").addEventListener("click", () => openCompose({ type: "idea" }));
document.querySelector("#rank-all").addEventListener("click", () => {
  rankAll = !rankAll;
  renderRecognition();
});
document.querySelectorAll("[data-moment]").forEach((button) => {
  button.addEventListener("click", () => {
    momentChip = button.dataset.moment;
    renderGrowth();
  });
});
document.querySelector("#composer-open").addEventListener("click", () => openCreateMenu());
document.querySelector("#spark-go").addEventListener("click", () => openCompose({ problem: sparkText(), type: "idea" }));
document.querySelector("#idea-next").addEventListener("click", () => advanceIdea(1));
document.querySelector("#idea-back").addEventListener("click", () => advanceIdea(-1));
["input", "change"].forEach((name) => {
  form.addEventListener(name, () => {
    if (postType !== "idea") return;
    paintIdeaPreview();
    paintStrength();
  });
});
document.querySelector("#detail-back").addEventListener("click", threadBack);
document.querySelector("#people-close").addEventListener("click", () => document.querySelector("#people").close());
document.querySelector("#people").addEventListener("click", (event) => {
  if (event.target.id === "people") document.querySelector("#people").close();
});

function openCompose(seed) {
  if (!selectedPerson) {
    showGate();
    return;
  }
  const options = seed && !seed.target ? seed : {};
  const seeded = typeof options.problem === "string" ? options.problem : "";
  editingId = null;
  form.reset();
  setPointRows("pros", []);
  setPointRows("cons", []);
  setPlaceValue("");
  thanksPid = "";
  mentionPids = [];
  mentionNames = {};
  postType = options.type || "post";
  postMedia = "";
  postExtra = [];
  ideaStep = 1;
  resetComposeRows();
  const more = document.querySelector(".type-more");
  if (more) more.open = ["suggestion", "complaint", "thanks", "story", "article"].includes(postType);
  paintPostType();
  paintPostMedia();
  paintMentions();
  const banner = document.querySelector("#spark-banner");
  if (banner) {
    banner.hidden = !seeded;
    banner.textContent = seeded ? seeded : "";
  }
  if (seeded) problemInput.value = seeded;
  counter.textContent = "0/1000";
  formError.textContent = "";
  syncFormMode();
  setReplyScope("all");
  if (typeof restoreDraft === "function") restoreDraft(postType, Boolean(seeded));
  composeDialog.showModal();
  if (postType === "story") document.querySelector("#post-add").focus();
  else (seeded || postType !== "idea" ? ideaInput : titleInput).focus();
}
document.querySelector("#compose-close").addEventListener("click", () => {
  editingId = null;
  syncFormMode();
  composeDialog.close();
});
composeDialog.addEventListener("click", (event) => {
  if (event.target === composeDialog) composeDialog.close();
});

document.querySelectorAll("[data-point-add]").forEach((button) => {
  button.addEventListener("click", () => {
    const created = addPointRow(button.dataset.pointAdd, "");
    if (created) created.querySelector("input").focus();
  });
});
setPointRows("pros", []);
setPointRows("cons", []);

let searchTimer = null;

function fileToData(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

const COMPOSE_COPY = {
  post: { heading: "headPost", body: "bodyPost", bodyPh: "phBodyPost" },
  idea: { heading: "headIdea", title: "labelTitle", titlePh: "phTitle", body: "labelIdea", bodyPh: "bqComposePh" },
  announcement: { heading: "headAnnouncement", title: "titleAnnouncement", titlePh: "phTitleAnnouncement", body: "bodyAnnouncement", bodyPh: "phBodyAnnouncement" },
  suggestion: { heading: "headSuggestion", title: "titleSuggestion", titlePh: "phTitleSuggestion", body: "bodySuggestion", bodyPh: "phBodySuggestion" },
  complaint: { heading: "headComplaint", title: "titleComplaint", titlePh: "phTitleComplaint", body: "bodyComplaint", bodyPh: "phBodyComplaint" },
  thanks: { heading: "headThanks", body: "bodyThanks", bodyPh: "phBodyThanks" },
  story: { heading: "headStory", body: "bodyStory", bodyPh: "bqStoryCaption" },
  article: { heading: "headArticle", title: "labelArticleTitle", titlePh: "phTitleArticle", body: "labelArticle", bodyPh: "phBodyArticle" },
  poll: { heading: "headPoll", title: "titlePoll", titlePh: "phTitlePoll", body: "bodyPoll", bodyPh: "phBodyPoll" },
  event: { heading: "headEvent", title: "titleEvent", titlePh: "phTitleEvent", body: "bodyEvent", bodyPh: "phBodyEvent" },
};

function paintPostType() {
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.classList.toggle("on", button.dataset.type === postType);
  });
  composeDialog.dataset.kind = postType;
  const makeIdea = document.querySelector("#make-idea");
  if (makeIdea) makeIdea.setAttribute("aria-checked", postType === "idea" ? "true" : "false");
  const more = document.querySelector(".type-more");
  if (more && ["suggestion", "complaint", "thanks", "story", "article"].includes(postType)) more.open = true;
  const ideaFields = document.querySelector("#idea-fields");
  const pollFields = document.querySelector("#poll-fields");
  const thanksField = document.querySelector("#thanks-field");
  const tools = document.querySelector("#compose-tools");
  const titleLabel = document.querySelector("#title-label");
  const bodyLabel = document.querySelector("#body-label");
  if (ideaFields) ideaFields.hidden = postType !== "idea";
  if (pollFields) pollFields.hidden = postType !== "poll";
  if (thanksField) thanksField.hidden = postType !== "thanks";
  const eventFields = document.querySelector("#event-fields");
  if (eventFields) eventFields.hidden = postType !== "event";
  if (tools) tools.hidden = postType === "poll";
  const article = postType === "article";
  const copy = COMPOSE_COPY[postType] || COMPOSE_COPY.post;
  const heading = document.querySelector("#compose-title");
  if (heading) heading.textContent = t(copy.heading);
  if (titleLabel && copy.title) {
    titleLabel.dataset.i18n = copy.title;
    titleLabel.textContent = t(copy.title);
  }
  if (titleInput && copy.titlePh) titleInput.placeholder = t(copy.titlePh);
  if (bodyLabel) {
    bodyLabel.dataset.i18n = copy.body;
    bodyLabel.textContent = t(copy.body);
  }
  if (titleInput) titleInput.maxLength = article ? 120 : 80;
  if (typeof paintComposeKind === "function") paintComposeKind();
  if (ideaInput) {
    ideaInput.dataset.i18nPlaceholder = copy.bodyPh;
    ideaInput.placeholder = t(copy.bodyPh);
    ideaInput.maxLength = article ? 4000 : 1000;
    ideaInput.rows = article ? 12 : 5;
    if (!article && ideaInput.value.length > 1000) ideaInput.value = ideaInput.value.slice(0, 1000);
    const max = Number(ideaInput.maxLength) || 1000;
    counter.textContent = `${ideaInput.value.length}/${max}`;
  }
  if (postType === "poll") {
    postMedia = "";
    postExtra = [];
    paintPostMedia();
  }
  paintIdeaStudio();
}

function paintIdeaStudio() {
  const on = postType === "idea";
  const studio = document.querySelector("#idea-studio");
  const nav = document.querySelector("#idea-nav");
  const hint = document.querySelector("#studio-hint");
  const submit = form.querySelector("button[type=submit] span");
  const mention = document.querySelector("#mention-field");
  if (studio) studio.hidden = !on;
  if (mention) mention.hidden = !tagOpen || (on && ideaStep !== 4);
  if (nav) nav.hidden = !on;
  if (hint) hint.textContent = on ? t(`studioHint${ideaStep}`) : "";
  document.querySelectorAll(".studio-steps li").forEach((item, index) => {
    item.classList.toggle("now", on && index + 1 === ideaStep);
    item.classList.toggle("done", on && index + 1 < ideaStep);
  });
  document.querySelectorAll("[data-studio]").forEach((node) => {
    if (!on) node.hidden = node.id === "post-preview" ? !postMedia : false;
    else node.hidden = node.dataset.studio !== String(ideaStep);
  });
  if (on && ideaStep === 1) paintPostMedia();
  const next = document.querySelector("#idea-next");
  const back = document.querySelector("#idea-back");
  if (next) next.hidden = !on || ideaStep >= 4;
  if (back) back.hidden = !on || ideaStep <= 1;
  if (submit && !sending) submit.textContent = on && ideaStep < 4 ? t("studioNext") : t("submit");
  composeDialog.classList.toggle("studio-open", on);
  paintAngles();
  paintStrength();
  paintIdeaPreview();
  if (typeof paintSimilar === "function") paintSimilar();
}

function ideaCompleteness() {
  let score = 0;
  if (titleInput.value.trim()) score += 20;
  if (ideaInput.value.trim().length >= 40) score += 20;
  else if (ideaInput.value.trim()) score += 10;
  if (placeValue()) score += 15;
  if (problemInput.value.trim()) score += 15;
  if (readPointRows("pros").length) score += 10;
  if (readPointRows("cons").length) score += 10;
  if (impactInput.value.trim()) score += 10;
  return Math.min(100, score);
}

function paintStrength() {
  const score = postType === "idea" ? ideaCompleteness() : 0;
  const bar = document.querySelector("#strength-bar");
  const label = document.querySelector("#strength-label");
  if (bar) bar.style.width = `${score}%`;
  if (label) label.textContent = postType === "idea" ? tf("strengthLabel", { n: score }) : "";
}

function paintAngles() {
  const row = document.querySelector("#angle-row");
  if (!row) return;
  if (row.dataset.lang === lang && row.childElementCount) return;
  row.dataset.lang = lang;
  row.replaceChildren();
  const lead = document.createElement("span");
  lead.textContent = t("angleLead");
  row.appendChild(lead);
  ["angleTime", "angleSafe", "angleWaste", "angleInfo"].forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(key);
    button.addEventListener("click", () => {
      const line = t(key);
      if (!ideaInput.value.includes(line)) {
        ideaInput.value = ideaInput.value.trim() ? `${ideaInput.value.trim()}\n${line}: ` : `${line}: `;
      }
      ideaInput.focus();
      paintIdeaPreview();
      paintStrength();
    });
    row.appendChild(button);
  });
}

function paintIdeaPreview() {
  const box = document.querySelector("#idea-live");
  if (!box) return;
  box.replaceChildren();
  if (postType !== "idea") return;
  box.appendChild(ideaBoard({
    type: "idea",
    title: titleInput.value.trim() || t("labelTitle"),
    text: ideaInput.value.trim() || t("studioHint1"),
    place: placeValue(),
    problem: problemInput.value.trim(),
    pros: readPointRows("pros"),
    cons: readPointRows("cons"),
    impact: impactInput.value.trim(),
    status: "received",
    media: postMedia,
  }, false));
}

function advanceIdea(delta) {
  if (postType !== "idea") return;
  if (delta > 0 && ideaStep === 1) {
    if (!titleInput.value.trim()) {
      formError.textContent = t("errTitle");
      titleInput.focus();
      return;
    }
    if (!ideaInput.value.trim()) {
      formError.textContent = t("errRequired");
      ideaInput.focus();
      return;
    }
  }
  formError.textContent = "";
  ideaStep = Math.min(4, Math.max(1, ideaStep + delta));
  paintIdeaStudio();
}

function paintPostMedia() {
  const box = document.querySelector("#post-preview");
  const img = box ? box.querySelector("img") : null;
  if (!box || !img) return;
  box.hidden = !postMedia;
  const video = isVideoSrc(postMedia);
  let clip = box.querySelector("video");
  if (video && !clip) {
    clip = document.createElement("video");
    clip.muted = true;
    clip.loop = true;
    clip.playsInline = true;
    clip.autoplay = true;
    box.insertBefore(clip, img);
  }
  img.hidden = video;
  if (clip) {
    clip.hidden = !video;
    if (video) {
      if (clip.getAttribute("src") !== postMedia) clip.src = postMedia;
    } else {
      clip.pause();
      clip.removeAttribute("src");
    }
  }
  if (postMedia && !video) img.src = postMedia;
  else img.removeAttribute("src");
  const extras = document.querySelector("#post-extras");
  extras.replaceChildren();
  postExtra.forEach((src, index) => {
    const thumb = document.createElement("div");
    thumb.className = "post-preview";
    const pic = document.createElement("img");
    pic.alt = "";
    pic.src = src;
    const drop = document.createElement("button");
    drop.type = "button";
    drop.setAttribute("aria-label", "×");
    drop.textContent = "×";
    drop.addEventListener("click", () => {
      postExtra.splice(index, 1);
      paintPostMedia();
    });
    thumb.append(pic, drop);
    extras.appendChild(thumb);
  });
  const add = document.querySelector("#post-add");
  add.hidden = postType !== "story" && Boolean(postMedia) && (video || postExtra.length + 1 >= GALLERY_LIMIT);
  add.setAttribute("aria-label", t(postMedia && !video ? "bqAddMore" : "bqAddMedia"));
}

function paintMentions() {
  const chosen = document.querySelector("#mention-chosen");
  if (!chosen) return;
  chosen.replaceChildren();
  mentionPids.forEach((pid) => {
    const chip = document.createElement("span");
    chip.textContent = mentionNames[pid] || "";
    chosen.appendChild(chip);
  });
  paintComposeRows();
}

function paintComposeRows() {
  const place = document.querySelector("#post-place");
  const project = document.querySelector("#post-project");
  const placeVal = document.querySelector("#row-place-val");
  const projectVal = document.querySelector("#row-project-val");
  const tagVal = document.querySelector("#row-tag-val");
  if (placeVal && place) placeVal.textContent = displayPlace(place.value);
  if (projectVal && project) projectVal.textContent = project.value.trim();
  if (tagVal) tagVal.textContent = mentionPids.length ? String(mentionPids.length) : "";
}

function resetComposeRows() {
  tagOpen = false;
  ["#post-place", "#post-project"].forEach((selector) => {
    const input = document.querySelector(selector);
    if (!input) return;
    input.value = "";
    input.hidden = true;
  });
  paintComposeRows();
}

function queueSearch(value, panel, onPick) {
  clearTimeout(searchTimer);
  const query = String(value || "").trim();
  if (!panel) return;
  if (query.length < 2) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }
  searchTimer = setTimeout(async () => {
    const data = await social("search", searchQuery(query));
    if (!data) return;
    panel.hidden = false;
    panel.replaceChildren();
    (data.people || []).forEach((person) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${t("searchPeople")} · ${person.name} · ${deptLabel(person.department)}`;
      button.addEventListener("click", () => onPick(person, "person"));
      panel.appendChild(button);
    });
    (data.departments || []).forEach((department) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${t("searchDepts")} · ${deptLabel(department)}`;
      button.addEventListener("click", () => onPick(department, "department"));
      panel.appendChild(button);
    });
    if (!panel.childElementCount) panel.hidden = true;
  }, 250);
}

function hueOf(name) {
  let hash = 0;
  for (const ch of String(name || "")) hash = (hash * 33 + ch.charCodeAt(0)) % 360;
  return hash;
}

function paintCover(node, name) {
  if (node) node.style.setProperty("--hue", String(hueOf(name)));
}

function faceNode(person) {
  if (person.photo && !person.official) {
    const img = document.createElement("img");
    img.className = "face";
    img.alt = "";
    img.src = person.photo;
    return img;
  }
  const node = avatarNode({ ...person, initial: "•" });
  node.classList.add("face");
  return node;
}

function orgCard(group) {
  const name = deptLabel(group.department || group.name);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "org-card";
  const cover = document.createElement("span");
  cover.className = "org-cover";
  paintCover(cover, group.department || group.name);
  cover.style.backgroundImage = `url('${topicImage(`${group.department || ""} ${group.name || ""}`)}')`;
  const mark = document.createElement("span");
  mark.className = "org-mark";
  mark.textContent = name.trim().charAt(0) || "•";
  const title = document.createElement("strong");
  title.textContent = name;
  const meta = document.createElement("span");
  meta.className = "muted";
  meta.textContent = tf("membersCount", { n: group.members || 0 });
  button.append(cover, mark, title, meta);
  if (group.mine) {
    const chip = document.createElement("span");
    chip.className = "org-chip";
    chip.textContent = t("groupMine");
    button.appendChild(chip);
  }
  button.addEventListener("click", () => {
    if (group.kind === "department" && group.department) {
      openDepartment(group.department);
      return;
    }
    activeGroup = group.id;
    loadIdeas();
  });
  return button;
}

async function loadGroups() {
  const data = await social("groups");
  const list = document.querySelector("#group-list");
  if (!list) return;
  list.replaceChildren();
  const rows = (data && Array.isArray(data.groups) ? data.groups : []).filter((group) => {
    if (projectChip === "departments") return group.kind === "department";
    if (projectChip === "projects") return group.kind !== "department";
    return true;
  });
  document.querySelectorAll("[data-project]").forEach((button) => button.classList.toggle("on", button.dataset.project === projectChip));
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("groupEmpty");
    list.appendChild(empty);
  }
  rows.forEach((group) => list.appendChild(orgCard(group)));
  renderGroupFeed();
}

function renderGroupFeed() {
  const feed = document.querySelector("#group-feed");
  if (!feed || view !== "groups") return;
  feed.replaceChildren();
  if (!activeGroup) return;
  ideas.filter((idea) => idea.type !== "story").forEach((idea) => feed.appendChild(feedPost(idea)));
}

function showDeptTab(name) {
  deptTab = name;
  document.querySelectorAll("[data-dept-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.deptTab === name);
  });
  document.querySelectorAll("[data-dept-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.deptPanel !== name;
  });
}

function employeeCard(person) {
  const card = document.createElement("article");
  card.className = "person-card";
  const cover = document.createElement("span");
  cover.className = "org-cover";
  paintCover(cover, person.department || activeDept);
  const name = document.createElement("strong");
  name.textContent = person.name || "";
  const role = document.createElement("span");
  role.className = "muted";
  role.textContent = person.position || deptLabel(person.department);
  const actions = document.createElement("div");
  actions.className = "person-actions";
  const follow = followPill(person.pid, person.name, person.followed, (followed) => {
    person.followed = followed;
  });
  actions.append(follow);
  card.append(cover, personLink(faceNode(person), person.pid), personLink(name, person.pid), role, actions);
  return card;
}

let deptReturn = "explore";

async function openDepartment(name, tab) {
  if (view !== "department") deptReturn = view;
  activeDept = name;
  activeGroup = "";
  deptQuery = "";
  deptPage = 0;
  const search = document.querySelector("#dept-search");
  if (search) search.value = "";
  showDeptTab(tab || "people");
  await loadIdeas();
  showView("department");
}

async function renderDepartment(append) {
  const data = await social("department", { department: activeDept, q: deptQuery, page: deptPage });
  const title = document.querySelector("#dept-title");
  const label = deptLabel(activeDept);
  if (title) title.textContent = label;
  const mark = document.querySelector("#dept-mark");
  if (mark) mark.textContent = label.trim().charAt(0) || "•";
  paintCover(document.querySelector("#dept-cover"), activeDept);
  const meta = document.querySelector("#dept-meta");
  if (meta) meta.textContent = tf("membersCount", { n: data && data.total ? data.total : 0 });
  const follow = document.querySelector("#dept-follow");
  if (follow && data) follow.textContent = data.followed ? t("deptFollowing") : t("deptFollow");
  const roles = document.querySelector("#dept-roles");
  if (roles && data && !append) {
    roles.replaceChildren();
    (data.roles || []).forEach((role) => {
      const chip = document.createElement("span");
      chip.textContent = `${role.title} · ${role.count}`;
      roles.appendChild(chip);
    });
  }
  const people = document.querySelector("#dept-people");
  if (people && data) {
    if (!append) people.replaceChildren();
    const more = people.querySelector(".load-more");
    if (more) more.remove();
    (data.people || []).forEach((person) => people.appendChild(employeeCard(person)));
    if (!people.querySelector(".person-card")) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = t("peopleEmpty");
      people.appendChild(empty);
    }
    if ((deptPage + 1) * 12 < (data.matched || 0)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn ghost load-more";
      button.textContent = t("loadMore");
      button.addEventListener("click", () => {
        deptPage += 1;
        renderDepartment(true);
      });
      people.appendChild(button);
    }
  }
  const form = document.querySelector("#achievement-form");
  const profile = data && data.profile ? data.profile : { canPost: false, achievements: [] };
  if (form) form.hidden = !profile.canPost;
  const achievements = document.querySelector("#dept-achievements");
  if (achievements && !append) {
    document.querySelector("#ach-flash").hidden = true;
    renderAchievements(achievements, profile);
  }
  if (!append) renderDepartmentPosts();
}

const ACH_KINDS = { project: "achKindProject", resolved: "achKindResolved", thanks: "achKindThanks", manual: "achKindManual" };

function renderAchievements(achievements, profile) {
  const stats = document.querySelector("#ach-stats");
  if (stats) {
    stats.replaceChildren();
    const counts = profile.counts || {};
    [["project", "achStatProject"], ["resolved", "achStatResolved"], ["thanks", "achStatThanks"], ["manual", "achStatManual"]].forEach(([key, label]) => {
      const cell = document.createElement("div");
      const value = document.createElement("b");
      value.textContent = String(counts[key] || 0);
      const name = document.createElement("span");
      name.textContent = t(label);
      cell.append(value, name);
      stats.appendChild(cell);
    });
  }
  achievements.replaceChildren();
  const items = profile.achievements || [];
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("achievementEmpty");
    achievements.appendChild(empty);
  }
  items.forEach((item) => {
    const kind = item.kind || "manual";
    const card = document.createElement("article");
    card.className = "update ach-card";
    if (item.pending) card.classList.add("pending");
    const tag = document.createElement("span");
    tag.className = `ach-kind k-${kind}`;
    tag.textContent = t(ACH_KINDS[kind] || "achKindManual");
    if (kind !== "manual") {
      const auto = document.createElement("em");
      auto.textContent = `· ${t("achAuto")}`;
      tag.appendChild(auto);
    }
    const heading = document.createElement("h3");
    heading.dir = "auto";
    heading.textContent = item.title;
    const who = document.createElement("strong");
    who.textContent = item.name || "";
    const role = document.createElement("span");
    role.className = "muted";
    role.textContent = [item.position, timeAgo(item.createdAt)].filter(Boolean).join(" · ");
    card.append(tag, heading);
    if (item.text) {
      const text = document.createElement("p");
      text.dir = "auto";
      text.textContent = item.text;
      card.appendChild(text);
    }
    card.append(who, role);
    if (item.pending) {
      const note = document.createElement("span");
      note.className = "ach-pending";
      note.textContent = t("achPending");
      card.appendChild(note);
      if (profile.canApprove) {
        const actions = document.createElement("div");
        actions.className = "ach-review";
        [[true, "achApprove", "ok"], [false, "achReject", ""]].forEach(([approve, label, cls]) => {
          const button = document.createElement("button");
          button.type = "button";
          if (cls) button.className = cls;
          button.textContent = t(label);
          button.addEventListener("click", async () => {
            actions.querySelectorAll("button").forEach((node) => { node.disabled = true; });
            const saved = await social("achievement-review", { department: activeDept, id: item.id, approve });
            if (saved && saved.profile) renderAchievements(achievements, saved.profile);
            else actions.querySelectorAll("button").forEach((node) => { node.disabled = false; });
          });
          actions.appendChild(button);
        });
        card.appendChild(actions);
      }
    }
    if (item.ideaId) {
      card.dataset.idea = item.ideaId;
      card.addEventListener("click", () => openThread(item.ideaId));
    }
    achievements.appendChild(card);
  });
}

function renderDepartmentPosts() {
  const posts = document.querySelector("#dept-posts");
  if (!posts || view !== "department") return;
  posts.replaceChildren();
  ideas.filter((idea) => idea.author && idea.author.department === activeDept && idea.type !== "story").forEach((idea) => {
    posts.appendChild(feedPost(idea));
  });
}

document.querySelectorAll("[data-feed]").forEach((button) => {
  button.addEventListener("click", () => {
    if (feedMode === button.dataset.feed && view === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    feedMode = button.dataset.feed;
    activeGroup = "";
    showView("home");
    renderInbox();
    window.scrollTo({ top: 0 });
  });
});

document.querySelectorAll("[data-type]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.type === "story" && !editingId) {
      composeDialog.close();
      openStoryCamera();
      return;
    }
    postType = button.dataset.type;
    ideaStep = 1;
    paintPostType();
  });
});

document.querySelector("#dept-back").addEventListener("click", () => showView(deptReturn || "explore"));
document.querySelectorAll("[data-dept-tab]").forEach((button) => {
  button.addEventListener("click", () => showDeptTab(button.dataset.deptTab));
});
document.querySelector("#dept-search").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  const query = event.target.value.trim();
  searchTimer = setTimeout(() => {
    deptQuery = query;
    deptPage = 0;
    renderDepartment(false);
  }, 250);
});
document.querySelector("#dept-search-form").addEventListener("submit", (event) => event.preventDefault());
document.querySelector("#dept-follow").addEventListener("click", async () => {
  const data = await social("follow-department", { department: activeDept });
  if (!data) return;
  document.querySelector("#dept-follow").textContent = data.followed ? t("deptFollowing") : t("deptFollow");
});
document.querySelector("#achievement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.querySelector("#achievement-title").value.trim();
  const text = document.querySelector("#achievement-text").value.trim();
  if (!title || !text) return;
  const saved = await social("achievement", { department: activeDept, title, text });
  if (!saved) return;
  document.querySelector("#achievement-title").value = "";
  document.querySelector("#achievement-text").value = "";
  const flash = document.querySelector("#ach-flash");
  flash.textContent = t("achSentPending");
  flash.hidden = !saved.pending;
  if (saved.profile) renderAchievements(document.querySelector("#dept-achievements"), saved.profile);
  else renderDepartment();
});
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
const VIDEO_MAX = 30 * 1024 * 1024;
const VIDEO_SECONDS = 60;

function pickPostFile(accept) {
  const input = document.querySelector("#post-file");
  input.accept = accept;
  input.multiple = postType !== "story" && accept !== VIDEO_ACCEPT;
  input.click();
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("image"))), "image/jpeg", 0.84);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function videoSeconds(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(probe.duration || 0);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(-1);
    };
    probe.src = url;
  });
}

const VIDEO_SOURCE_MAX = 500 * 1024 * 1024;
const VIDEO_TARGET = { long: 1280, short: 720, bitrate: 1800000, audio: 96000 };
let videoKit = null;

function videoCompressor() {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return Promise.resolve(null);
  if (!videoKit) videoKit = import("/js/vendor/mediabunny.min.mjs").catch(() => null);
  return videoKit;
}

async function prepareVideo(file, onProgress, edits) {
  const edited = typeof mediaEdited === "function" && mediaEdited(edits);
  if (!edited && file.size < 3 * 1024 * 1024 && file.type !== "video/quicktime") return file;
  const kit = await videoCompressor();
  const fallback = () => {
    if (edited) throw new Error("edit");
    return file;
  };
  if (!kit) return fallback();
  let input = null;
  try {
    input = new kit.Input({ source: new kit.BlobSource(file), formats: kit.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return fallback();
    const audio = await input.getPrimaryAudioTrack();
    const width = await track.getDisplayWidth();
    const height = await track.getDisplayHeight();
    const scale = Math.min(1, VIDEO_TARGET.long / Math.max(width, height), VIDEO_TARGET.short / Math.min(width, height));
    const outWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
    const outHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
    const output = new kit.Output({ format: new kit.Mp4OutputFormat({ fastStart: "in-memory" }), target: new kit.BufferTarget() });
    const video = { codec: "avc", bitrate: VIDEO_TARGET.bitrate, forceTranscode: true, allowTransformationMetadata: false };
    const custom = edited ? videoEditOptions(kit, edits, outWidth, outHeight) : {};
    if (custom.process) Object.assign(video, custom);
    else if (scale < 1) video.width = outWidth;
    const mute = Boolean(edited && edits.mute);
    const options = {
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      video,
      audio: mute ? { discard: true } : { codec: "aac", bitrate: VIDEO_TARGET.audio },
    };
    if (edited && edits.trim) options.trim = { start: edits.trim.start, end: edits.trim.end };
    const conversion = await kit.Conversion.init(options);
    if (!conversion.isValid || (audio && !mute && conversion.discardedTracks.some((row) => row.track === audio))) return fallback();
    if (onProgress) conversion.onProgress = (progress) => onProgress(Math.min(1, progress));
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || !buffer.byteLength) return fallback();
    return edited || buffer.byteLength < file.size || file.size > VIDEO_MAX ? new Blob([buffer], { type: "video/mp4" }) : file;
  } catch (error) {
    if (edited) throw error && error.message === "edit" ? error : new Error("edit");
    return file;
  } finally {
    if (input) input.dispose();
  }
}

async function trackSeconds(file) {
  const kit = await videoCompressor();
  if (!kit) return -1;
  const input = new kit.Input({ source: new kit.BlobSource(file), formats: kit.ALL_FORMATS });
  try {
    return await input.computeDuration();
  } catch {
    return -1;
  } finally {
    input.dispose();
  }
}

function uploadMedia(blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.setRequestHeader("X-Session", selectedPerson ? selectedPerson.token : "");
    xhr.responseType = "json";
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        clearSession();
        reject(new Error("employee"));
        return;
      }
      if (xhr.status === 413) {
        reject(new Error("big"));
        return;
      }
      const data = xhr.response;
      if (xhr.status < 200 || xhr.status >= 300 || !data || !data.url) {
        reject(new Error("upload"));
        return;
      }
      resolve(data.url);
    };
    xhr.onerror = () => reject(new Error("upload"));
    xhr.send(blob);
  });
}

function percentStatus(target, key) {
  return (part) => {
    target.textContent = tf(key, { n: Math.round(part * 100) });
  };
}

async function sendMediaFile(file, target, edits) {
  const video = /^video\//.test(file.type);
  const edited = typeof mediaEdited === "function" && mediaEdited(edits);
  let ready = file;
  if (video) ready = await prepareVideo(file, percentStatus(target, "bqPreparing"), edits);
  else ready = edited ? await renderPhoto(file, edits) : await shrinkImage(file);
  if (video && ready.size > VIDEO_MAX) throw new Error("big");
  return uploadMedia(ready, percentStatus(target, "bqUploadingPct"));
}

let mediaBusy = false;

document.querySelector("#post-photo-clear").addEventListener("click", () => {
  postMedia = postExtra.shift() || "";
  paintPostMedia();
});
async function mediaFileError(file) {
  const video = /^video\//.test(file.type);
  if (!video && !/^image\//.test(file.type)) return "bqMediaBad";
  if (!video) return "";
  if (!VIDEO_ACCEPT.split(",").includes(file.type)) return "bqMediaBad";
  if (file.size > VIDEO_SOURCE_MAX || (file.size > VIDEO_MAX && !(await videoCompressor()))) return "bqVideoBig";
  let seconds = await videoSeconds(file);
  if (seconds === Infinity) seconds = await trackSeconds(file);
  if (seconds > VIDEO_SECONDS + 0.5) return "bqVideoLong";
  return "";
}

document.querySelector("#post-file").addEventListener("change", async (event) => {
  let files = [...(event.target.files || [])];
  event.target.value = "";
  if (!files.length || mediaBusy) return;
  const single = postType === "story";
  const hasPhotos = Boolean(postMedia) && !isVideoSrc(postMedia);
  if (files.some((file) => /^video\//.test(file.type))) {
    if (!single && (files.length > 1 || hasPhotos)) {
      formError.textContent = t("bqGalleryNoVideo");
      return;
    }
  } else if (!single && isVideoSrc(postMedia)) {
    formError.textContent = t("bqGalleryNoVideo");
    return;
  }
  const room = single ? 1 : GALLERY_LIMIT - (hasPhotos ? 1 + postExtra.length : 0);
  const capped = files.length > room;
  files = files.slice(0, Math.max(0, room));
  for (const file of files) {
    const problem = await mediaFileError(file);
    const trimmable = problem === "bqVideoLong" && files.length === 1 && (await videoCompressor());
    if (problem && !trimmable) {
      formError.textContent = t(problem);
      return;
    }
  }
  if (!files.length) {
    formError.textContent = t("bqGalleryMax");
    return;
  }
  let edits = null;
  if (files.length === 1) {
    formError.textContent = "";
    edits = await openMediaEditor(files[0]);
    if (!edits) return;
  }
  mediaBusy = true;
  formError.textContent = t("bqUploading");
  document.querySelector("#compose-tools").classList.add("busy");
  let failed = "";
  for (const file of files) {
    const video = /^video\//.test(file.type);
    try {
      const url = await sendMediaFile(file, formError, edits);
      if (single || video || !postMedia || isVideoSrc(postMedia)) {
        postMedia = url;
        postExtra = [];
      } else {
        postExtra.push(url);
      }
      paintPostMedia();
    } catch (error) {
      if (error.message === "employee") break;
      failed = error.message === "big" ? t(video ? "bqVideoBig" : "photoBig") : error.message === "image" ? t("bqMediaBad") : error.message === "edit" ? t("meFailed") : t("bqUploadFail");
    }
  }
  mediaBusy = false;
  document.querySelector("#compose-tools").classList.remove("busy");
  formError.textContent = failed || (capped ? t("bqGalleryMax") : "");
  paintPostMedia();
});

document.querySelector("#dm-view-close").addEventListener("click", () => document.querySelector("#dm-view").close());

document.querySelector("#group-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#group-name").value.trim();
  if (!name) return;
  const created = await social("create-group", { name });
  if (!created) return;
  document.querySelector("#group-name").value = "";
  if (created.group) activeGroup = created.group.id;
  loadGroups();
});

document.querySelector("#thanks-search").addEventListener("input", (event) => {
  queueSearch(event.target.value, document.querySelector("#thanks-pick"), (person) => {
    thanksPid = person.pid;
    event.target.value = person.name;
    document.querySelector("#thanks-pick").hidden = true;
  });
});

document.querySelector("#mention-search").addEventListener("input", (event) => {
  queueSearch(event.target.value, document.querySelector("#mention-pick"), (person) => {
    if (!mentionPids.includes(person.pid)) mentionPids.push(person.pid);
    mentionNames[person.pid] = person.name;
    event.target.value = "";
    document.querySelector("#mention-pick").hidden = true;
    paintMentions();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  restoreSession().then((ok) => {
    if (ok) {
      showApp();
      loadIdeas();
    } else {
      showGate();
    }
  });
});
