"use strict";

const words = (text) => text.split("|").map((item) => item.trim()).filter(Boolean);

const STRICT = words(`
كس|كسم|كسمك|كسمكم|كسامك|كسختك|كسخواتك|كسعرضك|كسمين|كس امك|كس اختك|كس عرضك|كس ام|كس اخت|كس امها|كس ابوك|
طيز|طياز|طيزك|زب|زبر|زبري|ازبار|زبي|نيك|انيك|انيكك|ينيك|ينيكك|تنيك|نيكه|نياك|نياكه|منيوك|منيوكه|منايك|متناك|متناكه|انتاك|ناك|ناكك|
شرموط|شرموطه|شراميط|شرموطات|قحبه|قحاب|قحبات|كحبه|كحاب|عاهر|عاهره|عواهر|مومس|مومسات|داعر|داعره|شلفه|
معرص|معرصه|معرصين|لوطي|لوطيه|مخنث|مخنثه|ديوث|ديايثه|كواد|عكروت|
خرا|خراء|خري|احا|تفو|سكس|بضان|نكمك|
ابن الكلب|ابن كلب|بنت الكلب|بنت كلب|ولد الكلب|ابن ستين كلب|ابن الحرام|ابن حرام|ولد حرام|ولد الحرام|بنت حرام|بنت الحرام|ابن الزنا|ابن زنا|ولد زنا|ولد الزنا|ابن الوسخه|بنت الوسخه|
يلعن ابوك|يلعن ابوكم|يلعن ابو|يلعن امك|يلعن اهلك|يلعن والديك|يلعن دينك|يلعن دين|يلعن شكلك|يلعن روحك|يلعن اختك|يلعن جدك|ينعل ابوك|ينعل ابو|ينعن ابوك|ينعن ابو|
يلعنك|يلعنكم|يلعنج|ينعلك|ينعنك|الله يلعنك|الله يلعنكم|الله يلعن ابوك|لعنه الله عليك|لعنه الله عليكم|عليك اللعنه|عليكم اللعنه|اللعنه عليك|اللعنه عليكم|
تبا لك|تبا لكم|تف عليك|تفو عليك|تف عليكم|كل زق|كل خرا|كل تبن|انقلع|انقلعي|انقلعوا|انطم|انطمي|طز فيك|طز فيكم|الله ياخذك|الله ياخذكم|عساك تموت|روح موت|روح انتحر|
طرش بحر|خضيري|بيسري|ايري فيك|ايري فيكم|ايري بامك|
مادرجود|مادر جود|بهنجود|بهن جود|جوتيا|كاندو|رندي|حرامزاده|حرامخور|كتيا|كنجر|كنجري|بهروا|بهوسري|جاكش|
كس كش|كسكش|كيرم|بكيرم|مادرجنده|مادر جنده|ننه جنده|حرومزاده|كس ننت|كسننت|كسخل|كاييدم|كاييدمت|كونده|
kos omak|kosomak|kossomak|kosommak|kosomk|kousomak|kosomok|kos okhtak|kos o5tak|kosokhtak|koso5tak|teez|teezak|tizak|zebi|zbi|zobi|zeby|nikmok|nik mok|nik omak|manyak|manyok|metnak|metnaka|
sharmouta|sharmoota|sharmota|sharmuta|charmouta|sharmout|a7a|9a7ba|qahba|kahba|gahba|ga7ba|9ahba|khawal|5awal|m3aras|m3ras|khara|5ara|tfu|
ibn el kalb|ibn al kalb|ibn kalb|ibn el sharmouta|yel3an abook|yel3an abok|yil3an abook|yla3n abook|yel3an deenak|yil3an deenak|
fuck|fucks|fucked|fucker|fuckers|fucking|fuckin|fuckoff|fuckface|fuckhead|fuckwit|fucktard|motherfucker|motherfuckers|motherfucking|mofo|fck|fcking|fcked|fuk|fuking|fukin|fukc|phuck|fking|fkn|fvck|fuckk|
shit|shits|shitty|shithead|shitface|bullshit|horseshit|dipshit|shithole|cunt|cunts|twat|wanker|wank|tosser|bollocks|bellend|knobhead|dickhead|dickface|cocksucker|asshole|assholes|arsehole|jackass|dumbass|smartass|
bastard|bastards|bitch|bitches|bitchy|son of a bitch|sonofabitch|slut|sluts|whore|whores|skank|thot|stfu|gtfo|wtf|kys|kill yourself|go kill yourself|go to hell|screw you|piss off|fuck you|fuck off|
nigger|niggers|nigga|niggas|chink|gook|spic|kike|wetback|raghead|towelhead|sand nigger|camel jockey|faggot|faggots|fag|fags|tranny|paki|beaner|honky|
porn|porno|dildo|blowjob|handjob|jizz|boner|milf|pussy|pussies|tits|titties|scumbag|
puta|putas|puto madre|hijo de puta|hija de puta|hijueputa|joder|jodete|mierda|pendejo|pendeja|pendejos|cabron|cabrona|chingar|chingada|chingado|chinga tu madre|culero|culera|maricon|marica|gilipollas|malparido|malparida|verga|vete a la mierda|me cago en|concha tu madre|conchatumadre|
porra|caralho|foda|foder|fodase|foda se|fodido|buceta|boceta|viado|arrombado|merda|puta que pariu|filho da puta|vagabunda|vadia|cuzao|
putain|merde|connard|connasse|salope|encule|enculer|niquer|nique|nique ta mere|ntm|fils de pute|pute|batard|salaud|ta gueule|ferme ta gueule|va te faire foutre|conne|
scheisse|scheiss|scheise|arschloch|fick|ficken|fick dich|fotze|hurensohn|hure|wichser|schlampe|missgeburt|verpiss dich|spast|spasti|mistkerl|drecksau|schwuchtel|miststuck|vollidiot|
cazzo|cazzi|vaffanculo|fanculo|stronzo|stronza|puttana|troia|coglione|coglioni|minchia|figlio di puttana|porca puttana|bastardo|bastarda|frocio|testa di cazzo|cornuto|zoccola|mignotta|
блять|блядь|бля|блядина|сука|суки|сучка|хуй|хуя|хуе|хуйня|хуевый|нахуй|похуй|пизда|пиздец|пиздюк|ебать|ебал|ебаный|ебанат|ебло|еблан|мудак|мудила|мудило|пидор|пидорас|пидарас|гандон|шлюха|долбоеб|уебок|уебище|сволочь|залупа|говно|гавно|дерьмо|жопа|заебал|отъебись|иди нахуй|
blyat|blyad|bliat|pizdec|pizdets|pizda|nahui|nahuy|pohui|mudak|pidor|pidaras|gandon|eblan|ebat|
kurwa|kurwy|chuj|pierdole|pierdolic|jebac|jebany|skurwysyn|spierdalaj|cipa|picka|kurac|jebem ti|picka materina|
amk|aminakoyim|aminakoyayim|amina koyim|amina koyayim|anani sikeyim|orospu|orospu cocugu|orospucocugu|siktir|siktir git|sikeyim|sikerim|sikik|yarrak|yarak|pezevenk|ibne|gavat|kahpe|serefsiz|yavsak|
koskesh|kos kesh|kiram|jende|jendeh|madar jende|madarjende|kos nanat|kos nane|koskhol|kosekhol|haroomzade|haramzadeh|pedar sag|pedarsag|gaeedam|gaidam|kos madaret|
madarchod|maderchod|madarchood|maderchood|bhenchod|behenchod|bhenchodd|behnchod|benchod|bhencho|bhosdike|bhosdi|bhosadike|bhosdiwale|bhosda|bhosri|chutiya|chutia|chootiya|chutiye|choot|lund|lauda|lavda|lawda|lavde|lawde|lodu|gaandu|gandu|gaand|randi|randwa|raand|haramzada|haramzadi|haramkhor|kuttiya|kutiya|jhaatu|jhant|chodu|bsdk|mkc|bkl|chinal|chhinal|kanjar|kanjri|bharwa|bhadwa|teri maa ki|teri ma ki|maa ki chut|teri behen ki|gaand mara|gand mara|randi ka|randi ki|
khanki|khankir|khankir pola|bokachoda|banchod|bainchod|chutmarani|shuorer baccha|kuttar baccha|haramjada|
muji|machikne|machikney|randi ko chhoro|randiko|
punda|pundai|thevidiya|thevdiya|thevidiyaa|oombu|otha|ommala|myre|myru|kunna|thayoli|poolu|pulayadi|koothichi|koothi|
putang ina|putangina|tangina|tang ina|putragis|punyeta|ulol|ulul|tarantado|tarantada|pakyu|pakshet|kupal|kantot|kantutan|jakol|burat|pokpok|hindot|pekpek|tamod|hayop ka|
bangsat|bajingan|kontol|memek|ngentot|ngewe|entot|jancok|jancuk|pelacur|lonte|perek|pukimak|puki|butoh|keparat|brengsek|taik|kampang|haram jadah|
malaka|malakas|gamoto|klootzak|godverdomme|kutwijf|hoer|
du ma|du me|dit me|dit me may|dit con me|dit con me may|do cho|
मादरचोद|मादरचौद|बहनचोद|भेनचोद|भैनचोद|बहनचोद|चूतिया|चुतिया|चूत|लंड|लन्ड|लौड़ा|लोड़ा|लवड़ा|गांडू|गांड|गाण्ड|रंडी|रण्डी|रन्डी|हरामी|हरामज़ादा|हरामजादा|हरामखोर|कुतिया|भोसड़ी|भोसड़ीके|भोसडीके|झाटू|चोदू|मुजी|माचिक्ने|
খানকি|খানকির|মাগী|চুদি|চোদা|চুদা|হারামজাদা|হারামি|শুয়োরের বাচ্চা|বোকাচোদা|গান্ডু|চুতমারানি|বাঞ্চোত|বানচোদ|কুত্তার বাচ্চা|
புண்டை|தேவடியா|ஓத்த|ஒம்மாள|சுன்னி|മൈര്|കുണ്ണ|തായോളി|പൂറ്|പുലയാടി|കൂതിച്ചി|
μαλακα|μαλακας|γαμωτο|πουτανα
`);

const DENSE = words(`
操你妈|操你媽|肏你妈|他妈的|他媽的|傻逼|傻屄|煞笔|婊子|狗娘养的|王八蛋|混蛋|贱人|草泥马|去死|屌你|鸡巴|妈的|
くそったれ|クソ野郎|くそやろう|死ね|まんこ|ちんこ|ファック|バカヤロウ|ばかやろう|馬鹿野郎|ぶっ殺す|キチガイ|気違い|
시발|씨발|씨팔|시팔|ㅅㅂ|병신|븅신|ㅂㅅ|개새끼|개새기|좆|존나|졸라|미친놈|미친년|지랄|염병|엿먹어|꺼져|
ควย|เหี้ย|สัส|อีดอก|ไอ้สัตว์|เย็ดแม่
`);

const CONTEXT = words(`
حمار|حماره|حمير|غبي|غبيه|اغبياء|اغبيا|كلب|كلبه|كلاب|حقير|حقيره|تافه|تافهه|زباله|وسخ|وسخه|وصخ|قذر|قذره|منحط|منحطه|تبن|حيوان|حيوانه|حيوانات|بهيمه|بهايم|ثور|بقره|خروف|تيس|بغل|قرد|قرده|قرود|خنزير|خنازير|جحش|دب|
هطف|هطفه|خبل|خبله|مخبول|اهبل|هبله|مهبول|اهطل|معتوه|متخلف|متخلفه|معاق|معوق|احمق|حمقاء|سافل|سافله|سفيه|واطي|واطيه|نذل|نذله|خسيس|وضيع|حثاله|نجس|نجسه|عفن|معفن|معفنه|مقرف|خايس|خايسه|زفت|جزمه|صرمه|
ملعون|ملعونه|لعين|لعينه|منافق|كذاب|حرامي|خاين|خاينه|زنجي|يهودي|كافر|شاذ|منحرف|خول|قواد|كير|عير|زاني|زانيه|سحاقيه|ابله|بليد|بليده|مغفل|مغفله|اثول|دلخ|خبيث|خبيثه|ساقط|ساقطه|فاسق|فاجر|فاجره|زق|سربوت|صربوت|مطي|زمال|سرسري|فرخ|لبوه|كتا|كمينه|
7mar|hmar|7ayawan|hayawan|7aiwan|kalb|kelb|ghabi|8abi|ghbi|
idiot|idiots|stupid|dumb|moron|morons|loser|fool|imbecile|cretin|dimwit|halfwit|nitwit|pig|dog|donkey|trash|garbage|ugly|fatso|freak|creep|pervert|clown|rat|snake|scum|jerk|psycho|weirdo|ass|arse|dick|prick|cock|cum|hoe|ho|coon|dyke|bimbo|hooker|rape|rapist|spastic|retard|retards|retarded|harami|
puto|cono|zorra|perra|idiota|estupido|imbecil|otario|desgracado|babaca|debile|cretin|abruti|arsch|dummkopf|penner|schwanz|
gago|gaga|tanga|bobo|inutil|gunggong|engot|anjing|babi|asu|goblok|tolol|bodoh|bego|pantat|sialan|celaka|
kutta|kutte|kamina|kamine|kaminey|saala|saali|gadha|ullu|suar|suwar|tatti|hijra|chakka|dalla|magi|kukur|kir|
salak|aptal|gerizekali|
गधा|कुत्ता|कुत्ते|साला|सूअर|उल्लू|पागल|बेवकूफ|कमीना|कमीने|শুয়োর|কুত্তা
`);

const ADDRESS = new Set(words(`
يا|ي|ايها|ايتها|انت|انتي|انتم|انتو|انتوا|انتن|انك|انكم|لانك|لانكم|يالك|يالكم|شكلك|
you|u|ur|youre|ure|ya|yu|thou|such|
tu|toi|eres|du|sen|sei|tum|aap|tera|teri|tere|tuh|tumi|tui|kau|engkau|kamu|lu|lo|loe|elo|elu|dasar|ikaw|ты|вы|
तू|तुम|तेरा|तेरी
`));

const AFTER = new Set(words("ka|kau|kayo|lu|lo|kamu|ho|hai|hain|mo"));

const FILLERS = new Set(words(`
والله|مره|صدق|فعلا|جد|ياخي|عباره|عن|ابن|بنت|ولد|اكبر|
a|an|are|r|re|is|so|the|big|fat|fucking|fuckin|freaking|total|complete|little|real|bloody|damn|such|
ein|eine|einen|bist|un|une|una|uno|es|sei|bir|ek|bada|bara|такой|такая|ты
`));

const ALLOW = new Set(words(`
نيكي|نيكيتا|نيكول|نيكون|نيكل|نيكوتين|نايك|بكس|بكسه|بكسات|بكسي|زبون|زبونه|زبوني|زبونك|زباين|زبده|زبيب|كسر|كسره|كسول|كسوه|كسب|كسكس|كسكسي|
معرس|معرسه|المعرس|عرس|عرسه|العرس|هناك|اير|زبير|الزبير|كسي|كاندي|بدرسك|جنده|وجنده|عرصه|عرصات|البزاز|
retarder|retarders|retarding|
nikon|nike|niki|nicky|cumin|cocktail|cockpit|peacock|hancock|dickens|dickson|scunthorpe|shitake|shiitake|assess|assist|assume|class|pass|bass|grass|glass|mass|analyst|analysis|therapist
`));

const ARABIC = /[\u0600-\u06ff]/;
const LATIN = /[a-z]/;
const DENSE_SCRIPT = /[\u0e00-\u0e7f\u1100-\u11ff\u3040-\u30ff\u3130-\u318f\u3400-\u9fff\uac00-\ud7af]/;
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", 9: "g", "@": "a", $: "s", "!": "i" };
const AR_PREFIX = ["وال", "بال", "فال", "كال", "يال", "لل", "ال", "يا", "و", "ف", "ب", "ل", "ك"];
const AR_PRONOUN = ["كما", "كم", "كن", "هم", "هن", "ها", "ني", "ك", "ه", "ي"];
const AR_PLURAL = ["ون", "ين", "ات", "ان"];
const EN_SUFFIX = ["ing", "ers", "er", "ed", "es", "s", "in", "y"];

function normalize(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .normalize("NFC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىیےۍ]/g, "ي")
    .replace(/[ةۀہھە]/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[کڪگ]/g, "ك")
    .replace(/چ/g, "ج")
    .replace(/پ/g, "ب")
    .replace(/ژ/g, "ز")
    .replace(/ڈ/g, "د")
    .replace(/ٹ/g, "ت")
    .replace(/ڑ/g, "ر")
    .replace(/ں/g, "ن")
    .replace(/ڤ/g, "ف")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .replace(/đ/g, "d")
    .replace(/ё/g, "е");
}

function tokenize(text) {
  return text.split(/[^\p{L}\p{N}\p{M}*#@$!]+/u)
    .map((token) => token.replace(/^[*#]+(?=\p{L})|(?<=\p{L})[*#!]+$/gu, ""))
    .filter((token) => /[\p{L}\p{N}]/u.test(token));
}

function squeeze(word) {
  return word.replace(/(.)\1+/gu, "$1");
}

function variants(token) {
  const out = new Set([token]);
  if (LATIN.test(token) && /[0-9@$!]/.test(token)) out.add(token.replace(/[01345789@$!]/g, (char) => LEET[char] || char));
  [...out].forEach((form) => {
    if (/(.)\1/u.test(form)) out.add(squeeze(form));
    if (/(.)\1\1/u.test(form)) out.add(form.replace(/(.)\1{2,}/gu, "$1$1"));
  });
  return [...out];
}

function arabicStems(word) {
  const bases = [{ stem: word, prefix: "" }];
  AR_PREFIX.forEach((prefix) => {
    if (word.startsWith(prefix) && word.length - prefix.length >= 3) bases.push({ stem: word.slice(prefix.length), prefix });
  });
  const out = [];
  bases.forEach(({ stem, prefix }) => {
    out.push({ stem, prefix, suffix: "" });
    const least = prefix ? 3 : 2;
    AR_PRONOUN.forEach((suffix) => {
      if (!stem.endsWith(suffix) || stem.length - suffix.length < least) return;
      const bare = stem.slice(0, -suffix.length);
      out.push({ stem: bare, prefix, suffix });
      if (bare.endsWith("ت")) out.push({ stem: `${bare.slice(0, -1)}ه`, prefix, suffix });
    });
    AR_PLURAL.forEach((suffix) => {
      if (stem.endsWith(suffix) && stem.length - suffix.length >= 4) out.push({ stem: stem.slice(0, -suffix.length), prefix, suffix: "plural" });
    });
  });
  return out;
}

function latinStems(word) {
  const out = [];
  EN_SUFFIX.forEach((suffix) => {
    if (!word.endsWith(suffix) || word.length - suffix.length < 4) return;
    const stem = word.slice(0, -suffix.length);
    out.push(stem);
    if (/(.)\1$/.test(stem)) out.push(stem.slice(0, -1));
    if (suffix === "es" || suffix === "s") out.push(`${stem}e`);
  });
  if (word.endsWith("ies") && word.length > 6) out.push(`${word.slice(0, -3)}y`);
  return out;
}

function candidates(token) {
  const out = [];
  const seen = new Set();
  const push = (word, address, loose) => {
    const key = `${word}|${address ? 1 : 0}|${loose ? 1 : 0}`;
    if (!word || seen.has(key)) return;
    seen.add(key);
    out.push({ word, address, loose });
  };
  variants(token).forEach((form) => {
    push(form, false, false);
    if (ARABIC.test(form)) {
      arabicStems(form).forEach(({ stem, prefix, suffix }) => {
        push(stem, prefix === "يا" || prefix === "يال", Boolean(suffix) && suffix !== "ه" && suffix !== "plural");
      });
    } else if (LATIN.test(form)) {
      latinStems(form).forEach((stem) => push(stem, false, false));
    }
  });
  return out;
}

const strictSet = new Set();
const contextSet = new Set();
const phrases = [];
const dense = [];
const byLength = new Map();

function addTerm(term, context) {
  const norm = normalize(term).trim();
  if (!norm) return;
  if (DENSE_SCRIPT.test(norm)) {
    dense.push(norm.replace(/\s+/g, ""));
    return;
  }
  const parts = tokenize(norm);
  if (!parts.length) return;
  if (parts.length > 1) {
    phrases.push({ parts, label: parts.join(" ") });
    return;
  }
  const word = parts[0];
  (context ? contextSet : strictSet).add(word);
  if (!context) {
    const length = [...word].length;
    if (!byLength.has(length)) byLength.set(length, []);
    byLength.get(length).push(word);
  }
}

STRICT.forEach((term) => addTerm(term, false));
DENSE.forEach((term) => addTerm(term, false));
CONTEXT.forEach((term) => addTerm(term, true));

function plainWord(token) {
  const forms = variants(token);
  if (ARABIC.test(token)) {
    ["و", "ف"].forEach((prefix) => {
      if (token.startsWith(prefix) && token.length > 2) forms.push(token.slice(1));
    });
  }
  return forms;
}

function isAddress(token) {
  return plainWord(token).some((form) => ADDRESS.has(form));
}

function isFiller(token) {
  return plainWord(token).some((form) => FILLERS.has(form) || contextSet.has(form));
}

function addressed(tokens, index) {
  for (let back = index - 1, skipped = 0; back >= 0 && skipped <= 2; back -= 1, skipped += 1) {
    if (isAddress(tokens[back])) return true;
    if (!isFiller(tokens[back])) break;
  }
  const next = tokens[index + 1];
  return Boolean(next && plainWord(next).some((form) => AFTER.has(form)));
}

function masked(token) {
  if (!/[*#]/.test(token)) return "";
  for (const form of variants(token)) {
    const chars = [...form];
    if (chars.filter((char) => char !== "*" && char !== "#").length < 2) continue;
    const pattern = new RegExp(`^${chars.map((char) => (char === "*" || char === "#" ? "." : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("")}$`, "u");
    const word = (byLength.get(chars.length) || []).find((item) => pattern.test(item));
    if (word) return word;
  }
  return "";
}

function phraseForms(token) {
  const forms = new Set(variants(token));
  if (ARABIC.test(token)) {
    ["و", "ف", "يا", "ب"].forEach((prefix) => {
      if (token.startsWith(prefix) && token.length - prefix.length >= 2) forms.add(token.slice(prefix.length));
    });
  }
  return forms;
}

function joinedLetters(tokens) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length >= 2) out.push(run.join(""));
    run = [];
  };
  tokens.forEach((token) => {
    if ([...token].length === 1 && /\p{L}/u.test(token)) run.push(token);
    else flush();
  });
  flush();
  return out;
}

function scan(input) {
  const text = normalize(input);
  if (!text.trim()) return [];
  const found = new Set();
  const flat = text.replace(/\s+/g, "");
  dense.forEach((term) => {
    if (flat.includes(term)) found.add(term);
  });
  const tokens = tokenize(text);
  tokens.forEach((token, index) => {
    if (ALLOW.has(token)) return;
    for (const { word, address, loose } of candidates(token)) {
      if (strictSet.has(word)) {
        found.add(word);
        break;
      }
      if (!loose && contextSet.has(word) && (address || addressed(tokens, index))) {
        found.add(word);
        break;
      }
    }
    const hidden = masked(token);
    if (hidden) found.add(hidden);
  });
  joinedLetters(tokens).forEach((joined) => {
    variants(joined).forEach((form) => {
      if (strictSet.has(form)) found.add(form);
    });
  });
  if (phrases.length && tokens.length > 1) {
    const forms = tokens.map(phraseForms);
    phrases.forEach(({ parts, label }) => {
      for (let start = 0; start + parts.length <= forms.length; start += 1) {
        if (parts.every((part, offset) => forms[start + offset].has(part))) {
          found.add(label);
          break;
        }
      }
    });
  }
  return [...found].slice(0, 12);
}

module.exports = {
  scan,
  normalize,
  size: () => strictSet.size + contextSet.size + phrases.length + dense.length,
};
