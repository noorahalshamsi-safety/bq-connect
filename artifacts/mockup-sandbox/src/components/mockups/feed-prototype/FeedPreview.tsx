import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type Actor = { badge: string; name: string };
type PreviewSession = { token: string; actor: string | number; actors: Actor[]; synthetic: true };
type Idea = {
  text?: unknown;
  id: string | number;
  title?: string;
  content?: string;
  description?: string;
  body?: string;
  kind?: string;
  story?: boolean;
  saved?: boolean;
  author?: { name?: string; badge?: string; avatar?: string } | string;
  authorName?: string;
  createdAt?: string;
  created_at?: string;
  group?: string;
  [key: string]: unknown;
};
type FeedPayload = {
  ideas?: Idea[];
  stats?: Record<string, unknown>;
  page?: { version?: string; state?: "more" | "end"; nextCursor?: string | null; order?: string; limit?: number };
};
type RequestState = "loading" | "more" | "end" | "error" | "restart";

const API = "/__mockup/prototype";
const MAX_POSTS = 80;
const MAX_SEEN = 320;

const copy = {
  en: {
    eyebrow: "ENGINEERING SANDBOX · NOT THE LIVE FEED",
    title: "BQ Connect",
    subtitle: "Pagination preview",
    intro: "A private, synthetic view for inspecting feed behavior. Every request uses a fixture actor and the prototype proxy.",
    synthetic: "SYNTHETIC SESSION",
    actor: "Act as",
    refresh: "Refresh",
    scope: "Feed scope",
    company: "Company",
    following: "Following",
    today: "Today",
    group: "Group",
    groupPlaceholder: "Group ID",
    kind: "Story / kind",
    allKinds: "All content",
    stories: "Stories",
    posts: "Posts",
    polls: "Polls",
    announcements: "Announcements",
    events: "Events",
    saved: "Saved only",
    search: "Search (unsupported)",
    searchPlaceholder: "Try a term to inspect the API response",
    searchButton: "Test search",
    sort: "Sort (unsupported)",
    legacy: "Legacy order",
    newest: "Newest",
    oldest: "Oldest",
    top: "Top",
    infinite: "Load as I scroll",
    insert: "Simulate insert",
    expire: "Simulate expiry",
    error: "Simulate error",
    controls: "Fixture controls",
    controlsNote: "Controls alter private test fixtures only. The next feed request is made to observe the result.",
    total: "Raw feed stats",
    visible: "Visible",
    page: "Page state",
    loading: "Requesting the synthetic feed…",
    loadingMore: "Loading the next window…",
    loadMore: "Load more",
    end: "You are at the end of this window.",
    empty: "Nothing in this window",
    emptyNote: "Try another scope or clear a filter. This is the real response, not a placeholder feed.",
    errorTitle: "The preview request did not complete",
    retry: "Retry first window",
    restart: "Restart pagination",
    restartTitle: "This cursor cannot continue",
    restartNote: "The proxy reported a cursor revision or expiry. Restart from the first window to continue.",
    unsupportedTitle: "The API requires a product decision",
    unsupportedNote: "Search and non-legacy sorting are intentionally not simulated client-side.",
    evicted: "Older cards were evicted to keep this preview bounded.",
    evictionCount: "Evicted",
    post: "Post",
    savedFlag: "Saved",
    notSaved: "Not saved",
    noTitle: "Untitled post",
    noText: "No text content was returned for this item.",
    author: "BQ Connect member",
    deepLink: "Deep-linked item",
    clearDeepLink: "Return to feed",
    toggleLanguage: "العربية",
    searchHint: "Submitting search calls the API and displays its actual 422 response.",
    savedReadOnly: "Saved flags are read-only in this prototype.",
    groupHint: "Enter a group identifier to request that scope.",
    requestFailed: "Request failed",
    pageEnd: "end",
    pageMore: "more",
    sessionError: "Could not create a synthetic actor session.",
    noItems: "The item endpoint returned no matching authorized item.",
    requestId: "HTTP",
  },
  ar: {
    eyebrow: "مساحة اختبار هندسية · ليست الخلاصة المباشرة",
    title: "BQ Connect",
    subtitle: "معاينة ترقيم الصفحات",
    intro: "عرض خاص اصطناعي لفحص سلوك الخلاصة. يستخدم كل طلب ممثلاً تجريبياً وواجهة المعاينة.",
    synthetic: "جلسة اصطناعية",
    actor: "التصرف بصفة",
    refresh: "تحديث",
    scope: "نطاق الخلاصة",
    company: "الشركة",
    following: "المتابَعون",
    today: "اليوم",
    group: "مجموعة",
    groupPlaceholder: "معرّف المجموعة",
    kind: "قصة / نوع",
    allKinds: "كل المحتوى",
    stories: "قصص",
    posts: "منشورات",
    polls: "استطلاعات",
    announcements: "إعلانات",
    events: "فعاليات",
    saved: "المحفوظ فقط",
    search: "بحث (غير مدعوم)",
    searchPlaceholder: "اكتب كلمة لفحص استجابة الواجهة",
    searchButton: "اختبار البحث",
    sort: "الترتيب (غير مدعوم)",
    legacy: "الترتيب السابق",
    newest: "الأحدث",
    oldest: "الأقدم",
    top: "الأعلى",
    infinite: "التحميل أثناء التمرير",
    insert: "محاكاة إضافة",
    expire: "محاكاة انتهاء الصلاحية",
    error: "محاكاة خطأ",
    controls: "عناصر التحكم التجريبية",
    controlsNote: "تغيّر هذه العناصر بيانات الاختبار الخاصة فقط، ثم يُرسل طلب الخلاصة التالي لمعاينة النتيجة.",
    total: "إحصاءات الخلاصة الخام",
    visible: "المعروض",
    page: "حالة الصفحة",
    loading: "جارٍ طلب الخلاصة الاصطناعية…",
    loadingMore: "جارٍ تحميل النافذة التالية…",
    loadMore: "تحميل المزيد",
    end: "وصلت إلى نهاية هذه النافذة.",
    empty: "لا توجد عناصر في هذه النافذة",
    emptyNote: "جرّب نطاقاً آخر أو أزل أحد المرشحات. هذه هي الاستجابة الفعلية وليست بيانات بديلة.",
    errorTitle: "تعذّر إكمال طلب المعاينة",
    retry: "إعادة طلب النافذة الأولى",
    restart: "إعادة بدء الترقيم",
    restartTitle: "تعذّر متابعة هذا المؤشر",
    restartNote: "أبلغت الواجهة عن تغيّر إصدار المؤشر أو انتهاء صلاحيته. أعد البدء من النافذة الأولى.",
    unsupportedTitle: "تتطلب الواجهة قراراً بشأن المنتج",
    unsupportedNote: "لا تتم محاكاة البحث أو الترتيب غير السابق على الجهاز.",
    evicted: "أُزيلت عناصر أقدم لإبقاء المعاينة محدودة.",
    evictionCount: "تمت الإزالة",
    post: "منشور",
    savedFlag: "محفوظ",
    notSaved: "غير محفوظ",
    noTitle: "منشور بلا عنوان",
    noText: "لم يُرجع هذا العنصر محتوى نصياً.",
    author: "عضو في BQ Connect",
    deepLink: "عنصر مرتبط مباشرة",
    clearDeepLink: "العودة إلى الخلاصة",
    toggleLanguage: "English",
    searchHint: "إرسال البحث يستدعي الواجهة ويعرض استجابة 422 الفعلية.",
    savedReadOnly: "علامات الحفظ للقراءة فقط في هذه المعاينة.",
    groupHint: "أدخل معرّف مجموعة لطلب هذا النطاق.",
    requestFailed: "فشل الطلب",
    pageEnd: "نهاية",
    pageMore: "المزيد",
    sessionError: "تعذّر إنشاء جلسة ممثل اصطناعي.",
    noItems: "لم تُرجع واجهة العنصر أي عنصر مطابق ومصرّح به.",
    requestId: "HTTP",
  },
} as const;

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const item = payload as { detail?: unknown; error?: unknown; message?: unknown };
    if (typeof item.detail === "string") return item.detail;
    if (typeof item.message === "string") return item.message;
    if (typeof item.error === "string") return item.error;
  }
  return fallback;
}

function getAuthor(idea: Idea, fallback: string) {
  if (typeof idea.author === "string") return idea.author;
  return idea.author?.name || idea.authorName || fallback;
}

function getText(idea: Idea) {
  const value = idea.text || idea.content || idea.description || idea.body;
  return typeof value === "string" ? value : "";
}

function getDate(idea: Idea) {
  const value = idea.createdAt || idea.created_at;
  if (typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function FeedPreview() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [actorChoice, setActorChoice] = useState("101");
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [sessionRetry, setSessionRetry] = useState(0);
  const [scope, setScope] = useState("company");
  const [group, setGroup] = useState("");
  const [kind, setKind] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("legacy");
  const [infinite, setInfinite] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [evicted, setEvicted] = useState(0);
  const [deepLinked, setDeepLinked] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const [pageState, setPageState] = useState<"more" | "end">("more");
  const [controlBusy, setControlBusy] = useState(false);
  const ideasRef = useRef<Idea[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const requestSerial = useRef(0);
  const seenRef = useRef(new Set<string>());
  const observerTargetRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const t = copy[language];
  const isRTL = language === "ar";

  const filterKey = useMemo(
    () => [scope, group.trim(), kind, savedOnly ? "1" : "0", searchTerm, sort].join("|"),
    [scope, group, kind, savedOnly, searchTerm, sort],
  );

  const addIdeas = useCallback((incoming: Idea[], replace = false) => {
    if (replace) seenRef.current.clear();
    const nextSeen = seenRef.current;
    const unique: Idea[] = [];
    for (const idea of incoming) {
      const id = String(idea.id ?? "");
      if (!id || nextSeen.has(id)) continue;
      nextSeen.add(id);
      unique.push(idea);
      if (nextSeen.size > MAX_SEEN) {
        const oldest = nextSeen.values().next().value as string | undefined;
        if (oldest) nextSeen.delete(oldest);
      }
    }
    let combined = replace ? unique : [...ideasRef.current, ...unique];
    if (combined.length > MAX_POSTS) {
      const removed = combined.length - MAX_POSTS;
      setEvicted((count) => count + removed);
      combined = combined.slice(removed);
    }
    ideasRef.current = combined;
    setIdeas(combined);
  }, []);

  const makeFeedUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({
        pagination: "keyset-v1",
        limit: "8",
        feed: scope === "group" ? "company" : scope,
        sort,
      });
      if (cursor) params.set("cursor", cursor);
      if (scope === "group") params.set("group", group.trim());
      if (kind) params.set("kind", kind);
      if (savedOnly) params.set("saved", "1");
      if (searchTerm) params.set("q", searchTerm);
      return `${API}/feed?${params.toString()}`;
    },
    [scope, group, kind, savedOnly, searchTerm, sort],
  );

  const requestFeed = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (!session) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const serial = ++requestSerial.current;
      loadingRef.current = true;
      setRequestState("loading");
      setErrorMessage("");
      setHttpStatus(null);
      setUnsupported(false);
      if (replace) {
        setIdeas([]);
        ideasRef.current = [];
        setStats(null);
        setEvicted(0);
        setDeepLinked(false);
        setNextCursor(null);
        nextCursorRef.current = null;
        setPageState("more");
        seenRef.current.clear();
      }
      try {
        const response = await fetch(makeFeedUrl(cursor), {
          headers: { "x-session": session.token },
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as FeedPayload & Record<string, unknown>;
        if (serial !== requestSerial.current) return;
        if (!response.ok) {
          if ([401, 403, 409, 410].includes(response.status)) {
            setIdeas([]);
            ideasRef.current = [];
            seenRef.current.clear();
            setStats(null);
          }
          const message = getErrorMessage(payload, `${t.requestFailed} (${response.status})`);
          setHttpStatus(response.status);
          setErrorMessage(message);
          setUnsupported(response.status === 422);
          setRequestState(response.status === 409 || response.status === 410 ? "restart" : "error");
          setNextCursor(null);
          nextCursorRef.current = null;
          return;
        }
        const result = payload as FeedPayload;
        addIdeas(Array.isArray(result.ideas) ? result.ideas : [], replace);
        setStats(result.stats || null);
        const state = result.page?.state === "end" ? "end" : "more";
        setPageState(state);
        const receivedCursor = typeof result.page?.nextCursor === "string" ? result.page.nextCursor : null;
        setNextCursor(receivedCursor);
        nextCursorRef.current = receivedCursor;
        setRequestState(state);
      } catch (error) {
        if ((error as Error).name === "AbortError" || serial !== requestSerial.current) return;
        setErrorMessage((error as Error).message || t.requestFailed);
        setRequestState("error");
      } finally {
        if (serial === requestSerial.current) loadingRef.current = false;
      }
    },
    [session, makeFeedUrl, addIdeas, t.requestFailed],
  );

  const loadFirst = useCallback(() => requestFeed(null, true), [requestFeed]);
  const loadMore = useCallback(() => {
    if (!nextCursor || loadingRef.current || requestState === "restart") return;
    void requestFeed(nextCursor, false);
  }, [nextCursor, requestFeed, requestState]);

  const loadItem = useCallback(
    async (id: string) => {
      if (!session) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const serial = ++requestSerial.current;
      loadingRef.current = true;
      setDeepLinked(true);
      setRequestState("loading");
      setErrorMessage("");
      setUnsupported(false);
      setIdeas([]);
      ideasRef.current = [];
      setStats(null);
      setNextCursor(null);
      nextCursorRef.current = null;
      seenRef.current.clear();
      try {
        const response = await fetch(`${API}/item?id=${encodeURIComponent(id)}`, {
          headers: { "x-session": session.token },
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as FeedPayload & Record<string, unknown>;
        if (serial !== requestSerial.current) return;
        if (!response.ok) {
          setHttpStatus(response.status);
          setErrorMessage(getErrorMessage(payload, `${t.requestFailed} (${response.status})`));
          setUnsupported(response.status === 422);
          setRequestState("error");
          return;
        }
        const items = Array.isArray(payload.ideas) ? payload.ideas : [];
        addIdeas(items.slice(0, MAX_POSTS), true);
        setStats(payload.stats || null);
        setPageState("end");
        setRequestState("end");
        if (!items.length) setErrorMessage(t.noItems);
      } catch (error) {
        if ((error as Error).name === "AbortError" || serial !== requestSerial.current) return;
        setErrorMessage((error as Error).message || t.requestFailed);
        setRequestState("error");
      } finally {
        if (serial === requestSerial.current) loadingRef.current = false;
      }
    },
    [session, addIdeas, t.requestFailed, t.noItems],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    requestSerial.current += 1;
    loadingRef.current = false;
    setSession(null);
    setSessionError("");
    setIdeas([]);
    ideasRef.current = [];
    setRequestState("loading");
    void (async () => {
      try {
        const response = await fetch(`${API}/session?actor=${encodeURIComponent(actorChoice)}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(payload, `${t.sessionError} (${response.status})`));
        if (!payload?.token || !Array.isArray(payload.actors)) throw new Error(t.sessionError);
        setSession(payload as PreviewSession);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSessionError((error as Error).message || t.sessionError);
          setRequestState("error");
        }
      }
    })();
    return () => controller.abort();
  }, [actorChoice, sessionRetry, t.sessionError]);

  useEffect(() => {
    if (!session) return;
    const handleHash = () => {
      const match = window.location.hash.match(/(?:^#|&)idea=([^&]+)/);
      if (match) void loadItem(decodeURIComponent(match[1].replace(/\+/g, " ")));
      else void loadFirst();
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
    // filterKey intentionally restarts the cursor chain whenever a supported or
    // unsupported filter changes; the API response remains authoritative.
  }, [session, filterKey, loadFirst, loadItem]);

  useEffect(() => {
    if (!infinite || !observerTargetRef.current || requestState !== "more" || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(observerTargetRef.current);
    return () => observer.disconnect();
  }, [infinite, requestState, nextCursor, loadMore]);

  const runControl = async (action: "insert" | "expire" | "error") => {
    if (!session || controlBusy) return;
    setControlBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API}/control`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-session": session.token },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHttpStatus(response.status);
        setErrorMessage(getErrorMessage(payload, `${t.requestFailed} (${response.status})`));
        setRequestState("error");
        return;
      }
      // Insert must restart to expose the new fixture. Expire/error need to
      // consume the current cursor when possible so the fixture is exercised.
      if (action === "insert" || deepLinked || requestState === "end" || !nextCursor) {
        await requestFeed(null, true);
        // Expiry only applies to a cursor. Establish a new chain, then consume
        // its cursor immediately so the fixture actually exercises verification.
        if (action === "expire" && nextCursorRef.current) await requestFeed(nextCursorRef.current, false);
      } else {
        await requestFeed(nextCursor, false);
      }
    } catch (error) {
      setErrorMessage((error as Error).message || t.requestFailed);
      setRequestState("error");
    } finally {
      setControlBusy(false);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const statsSummary = stats
    ? Object.entries(stats)
        .slice(0, 4)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${String(value)}`)
        .join(" · ")
    : "—";

  return (
    <main className="fp-shell" dir={isRTL ? "rtl" : "ltr"} data-testid="feed-root">
      <style>{`
        .fp-shell{--ink:#253340;--muted:#687983;--paper:#f3f5ef;--surface:#fbfcf8;--line:#dce3dc;--teal:#176b67;--teal-soft:#e1efea;--coral:#b4523e;--gold:#947229;min-height:100dvh;background:radial-gradient(ellipse at 80% 0%,#e3eee8 0,transparent 38%),var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px clamp(16px,4vw,64px) 64px;box-sizing:border-box}
        .fp-shell *{box-sizing:border-box}.fp-wrap{max-width:1150px;margin:auto}.fp-topline{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid var(--line);padding-bottom:14px;color:var(--muted);font:600 10px/1.2 ui-monospace,SFMono-Regular,monospace;letter-spacing:.13em;text-transform:uppercase}
        .fp-brand{display:flex;align-items:center;gap:11px}.fp-mark{height:28px;width:28px;display:grid;place-items:center;background:var(--teal);color:#f5f5e9;font:700 12px Georgia,serif;border-radius:8px 8px 8px 2px;letter-spacing:-.04em}.fp-lang{border:0;background:none;color:var(--teal);font-weight:700;cursor:pointer;padding:8px}
        .fp-hero{display:grid;grid-template-columns:1fr auto;align-items:end;gap:24px;padding:38px 0 28px}.fp-kicker{color:var(--coral);font:700 10px/1.3 ui-monospace,SFMono-Regular,monospace;letter-spacing:.12em;text-transform:uppercase}.fp-title{font:500 clamp(34px,6vw,62px)/.98 Georgia,"Times New Roman",serif;letter-spacing:-.055em;margin:12px 0 8px;color:#233a3a}.fp-title span{color:var(--teal);font-style:italic}.fp-intro{max-width:580px;color:#687983;line-height:1.65;margin:0;font-size:14px}.fp-status-chip{align-self:center;border:1px solid #a9c8ba;background:#e9f2eb;color:#326758;border-radius:999px;padding:9px 12px;font:700 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;white-space:nowrap}
        .fp-workspace{display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:22px;align-items:start}.fp-main,.fp-side{min-width:0}.fp-toolbar,.fp-side-panel,.fp-feed-head,.fp-state,.fp-card{background:var(--surface);border:1px solid var(--line);border-radius:13px;box-shadow:0 10px 30px rgba(46,70,63,.035)}.fp-toolbar{padding:18px;margin-bottom:14px}.fp-toolbar-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.fp-section-label{font:700 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.1em;color:#71827e;text-transform:uppercase}.fp-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fp-field{display:flex;flex-direction:column;gap:6px;min-width:0}.fp-field label,.fp-label{font-size:11px;font-weight:700;color:#53636a}.fp-shell input,.fp-shell select{min-height:39px;border:1px solid #d6dfd9;border-radius:7px;background:#fffefa;color:var(--ink);padding:0 11px;font:500 12px inherit;outline:none;min-width:0}.fp-shell input:focus,.fp-shell select:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(23,107,103,.12)}.fp-filter-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.fp-search-row{display:flex;gap:7px}.fp-search-row input{flex:1;width:50%}.fp-search-note,.fp-hint{font-size:10px;color:#84918e;line-height:1.45;margin:5px 0 0}.fp-check{display:flex;gap:9px;align-items:center;font-size:12px;font-weight:650;color:#48585b;cursor:pointer;margin-top:14px}.fp-check input{accent-color:var(--teal);min-height:0;width:15px;height:15px}.fp-button{border:1px solid transparent;border-radius:7px;min-height:37px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:700 11px ui-monospace,SFMono-Regular,monospace;letter-spacing:.01em;cursor:pointer;transition:transform .16s ease,opacity .16s ease,background .16s ease}.fp-button:hover:not(:disabled){transform:translateY(-1px)}.fp-button:disabled{opacity:.46;cursor:not-allowed}.fp-button-primary{background:var(--teal);color:#f8fbf7}.fp-button-quiet{background:#edf2ec;color:#42645c;border-color:#d9e6dc}.fp-button-outline{background:transparent;color:#657672;border-color:#dce3dc}.fp-button-danger{background:#f5e8e2;color:#8c4839;border-color:#edd2c7}.fp-feed-head{padding:15px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}.fp-feed-title{font:500 21px Georgia,serif;color:#284446;margin:0}.fp-feed-meta{font:10px ui-monospace,SFMono-Regular,monospace;color:#7c8b87}.fp-card{padding:19px;margin-bottom:11px;animation:fp-rise .34s ease both}.fp-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.fp-byline{display:flex;align-items:center;gap:10px;min-width:0}.fp-avatar{height:34px;width:34px;border-radius:50%;display:grid;place-items:center;background:#dce9df;color:#326b61;font:700 10px ui-monospace,monospace;flex:none}.fp-author{font-size:12px;font-weight:700;color:#34494b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fp-date{font-size:10px;color:#85928e;margin-top:3px}.fp-tag{border-radius:4px;background:#eff2e7;color:#7d6a31;padding:5px 7px;font:700 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}.fp-card h3{font:500 21px/1.24 Georgia,serif;color:#2d4847;margin:17px 0 8px;letter-spacing:-.025em}.fp-copy{font-size:13px;line-height:1.65;color:#667579;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.fp-card-bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #edf0eb;margin-top:16px;padding-top:11px;color:#7b8986;font:10px ui-monospace,monospace}.fp-saved{color:var(--teal);font-weight:700}.fp-side-panel{padding:17px;margin-bottom:13px}.fp-side-title{font:500 17px Georgia,serif;margin:0 0 12px;color:#355151}.fp-side-copy{font-size:11px;line-height:1.6;color:#74827e;margin:0 0 13px}.fp-control-buttons{display:grid;gap:7px}.fp-stat{border-top:1px solid #e8ede7;padding:10px 0 2px}.fp-stat:first-of-type{border-top:0}.fp-stat-label{font:700 9px ui-monospace,monospace;letter-spacing:.1em;color:#88958f;text-transform:uppercase}.fp-stat-value{font:500 15px Georgia,serif;color:#345453;margin-top:5px;overflow-wrap:anywhere}.fp-status-line{display:flex;align-items:center;gap:7px;font:10px ui-monospace,monospace;color:#6c7d78}.fp-dot{width:7px;height:7px;border-radius:50%;background:#65a78b}.fp-state{padding:25px 20px;text-align:center;margin:12px 0;color:#63736f}.fp-state h3{font:500 20px Georgia,serif;color:#355151;margin:0 0 7px}.fp-state p{font-size:12px;line-height:1.6;margin:0 auto 14px;max-width:420px}.fp-error{border-color:#e6c8bb;background:#fcf6f0}.fp-error h3{color:#9a4c3a}.fp-notice{padding:10px 12px;background:#f8f0db;border:1px solid #eddfb8;border-radius:8px;color:#806a32;font-size:11px;line-height:1.5;margin-bottom:12px}.fp-footer{padding:10px 0 0;color:#9aa39d;font:9px ui-monospace,monospace;letter-spacing:.04em}.fp-load-wrap{text-align:center;padding:10px 0 18px}.fp-screenreader{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @keyframes fp-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@media(max-width:900px){.fp-workspace{grid-template-columns:minmax(0,1fr) 250px}.fp-hero{padding-top:30px}}@media(max-width:720px){.fp-shell{padding:17px 14px 40px}.fp-hero{grid-template-columns:1fr;gap:15px;padding:28px 0 20px}.fp-status-chip{justify-self:start}.fp-workspace{grid-template-columns:1fr}.fp-side{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fp-side-panel{margin:0}.fp-toolbar{padding:14px}.fp-controls{grid-template-columns:1fr 1fr}.fp-card{padding:16px}.fp-topline{font-size:9px}.fp-feed-head{padding:13px 14px}}@media(max-width:460px){.fp-side{grid-template-columns:1fr}.fp-controls,.fp-filter-row{grid-template-columns:1fr}.fp-toolbar-head{align-items:flex-start}.fp-topline{letter-spacing:.06em}.fp-card h3{font-size:19px}.fp-feed-head{align-items:flex-start;flex-direction:column}}
        @media(prefers-reduced-motion:reduce){.fp-card{animation:none}.fp-button{transition:none}}
      `}</style>
      <div className="fp-wrap">
        <header className="fp-topline">
          <div className="fp-brand"><span className="fp-mark" aria-hidden="true">BQ</span><span>BQ Connect / Prototypes</span></div>
          <button type="button" className="fp-lang" aria-label={t.toggleLanguage} data-testid="language-toggle" onClick={() => setLanguage((value) => value === "en" ? "ar" : "en")}>{t.toggleLanguage}</button>
        </header>

        <section className="fp-hero" aria-labelledby="fp-title">
          <div>
            <div className="fp-kicker">{t.eyebrow}</div>
            <h1 className="fp-title" id="fp-title">{t.title} <span>{t.subtitle}</span></h1>
            <p className="fp-intro">{t.intro}</p>
          </div>
          <div className="fp-status-chip">{t.synthetic}</div>
        </section>

        <div className="fp-workspace">
          <section className="fp-main" aria-label="Synthetic feed">
            <div className="fp-toolbar">
              <div className="fp-toolbar-head">
                <span className="fp-section-label">01 / Request configuration</span>
                <button type="button" className="fp-button fp-button-primary" data-testid="refresh" disabled={!session || requestState === "loading"} onClick={loadFirst}>{t.refresh}</button>
              </div>
              <div className="fp-controls">
                <div className="fp-field">
                  <label htmlFor="fp-actor">{t.actor}</label>
                  <select id="fp-actor" data-testid="actor-select" value={actorChoice} onChange={(event) => setActorChoice(event.target.value)}>
                    {(session?.actors?.length ? session.actors : [{ badge: "101", name: "Fixture actor 101" }]).map((actor) => (
                      <option key={actor.badge} value={actor.badge}>{actor.name} · {actor.badge}</option>
                    ))}
                  </select>
                </div>
                <div className="fp-field">
                  <label htmlFor="fp-scope">{t.scope}</label>
                  <select id="fp-scope" data-testid="scope" value={scope} onChange={(event) => setScope(event.target.value)}>
                    <option value="company">{t.company}</option><option value="following">{t.following}</option><option value="today">{t.today}</option><option value="group">{t.group}</option>
                  </select>
                </div>
              </div>
              {scope === "group" && <div className="fp-field" style={{ marginTop: 12 }}>
                <label htmlFor="fp-group">{t.group}</label>
                <input id="fp-group" value={group} onChange={(event) => setGroup(event.target.value)} placeholder={t.groupPlaceholder} aria-describedby="fp-group-hint" />
                <p className="fp-hint" id="fp-group-hint">{t.groupHint}</p>
              </div>}
              <div className="fp-filter-row">
                <div className="fp-field">
                  <label htmlFor="fp-kind">{t.kind}</label>
                  <select id="fp-kind" data-testid="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
                    <option value="">{t.allKinds}</option><option value="story">{t.stories}</option><option value="post">{t.posts}</option><option value="poll">{t.polls}</option><option value="announcement">{t.announcements}</option><option value="event">{t.events}</option>
                  </select>
                </div>
                <div className="fp-field">
                  <label htmlFor="fp-sort">{t.sort}</label>
                  <select id="fp-sort" data-testid="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="legacy">{t.legacy}</option><option value="new">{t.newest}</option><option value="old">{t.oldest}</option><option value="top">{t.top}</option>
                  </select>
                </div>
              </div>
              <form onSubmit={submitSearch} style={{ marginTop: 13 }}>
                <label className="fp-label" htmlFor="fp-search">{t.search}</label>
                <div className="fp-search-row" style={{ marginTop: 6 }}>
                  <input id="fp-search" data-testid="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t.searchPlaceholder} />
                  <button className="fp-button fp-button-quiet" type="submit">{t.searchButton}</button>
                </div>
                <p className="fp-search-note">{t.searchHint}</p>
              </form>
              <label className="fp-check"><input type="checkbox" data-testid="saved-toggle" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} /> <span>{t.saved}</span></label>
              <p className="fp-hint">{t.savedReadOnly}</p>
            </div>

            <div className="fp-feed-head">
              <h2 className="fp-feed-title">{deepLinked ? t.deepLink : "Community stream"}</h2>
              <div className="fp-feed-meta">{ideas.length} / {MAX_POSTS} · {t.page}: {pageState === "end" ? t.pageEnd : t.pageMore}</div>
            </div>

            {sessionError && <div className="fp-state fp-error" role="alert"><h3>{t.errorTitle}</h3><p>{sessionError}</p><button className="fp-button fp-button-quiet" onClick={() => setSessionRetry((value) => value + 1)}>{t.retry}</button></div>}
            {unsupported && <div className="fp-notice" role="status"><strong>{t.unsupportedTitle}</strong><br />{errorMessage || t.unsupportedNote} {httpStatus ? `${t.requestId} ${httpStatus}.` : ""}</div>}
            {requestState === "restart" && <div className="fp-state fp-error" role="alert"><h3>{t.restartTitle}</h3><p>{errorMessage}<br />{t.restartNote}</p><button className="fp-button fp-button-primary" onClick={loadFirst}>{t.restart}</button></div>}
            {requestState === "error" && !sessionError && !unsupported && <div className="fp-state fp-error" role="alert"><h3>{t.errorTitle}</h3><p>{errorMessage || t.requestFailed}{httpStatus ? ` · ${t.requestId} ${httpStatus}` : ""}</p><button className="fp-button fp-button-quiet" onClick={deepLinked ? () => loadItem(window.location.hash.split("idea=")[1] || "") : loadFirst}>{t.retry}</button></div>}
            {requestState === "loading" && <div className="fp-state" role="status" aria-live="polite"><h3>{ideas.length ? t.loadingMore : t.loading}</h3><p className="fp-skeleton" aria-hidden="true">••••••••••••</p></div>}
            {requestState !== "loading" && ideas.length === 0 && requestState !== "error" && requestState !== "restart" && <div className="fp-state"><h3>{pageState === "more" ? (language === "ar" ? "لا عناصر ظاهرة في هذه النافذة" : "No visible items in this window") : t.empty}</h3><p>{pageState === "more" ? (language === "ar" ? "تابع التحميل لفحص النافذة التالية." : "Load more to inspect the next bounded window.") : errorMessage || t.emptyNote}</p></div>}
            {evicted > 0 && <div className="fp-notice" role="status">{t.evicted} {t.evictionCount}: {evicted}. <button className="fp-button fp-button-outline" onClick={loadFirst}>{t.refresh}</button></div>}
            <div data-testid="posts">
            {ideas.map((idea, index) => {
              const author = getAuthor(idea, t.author);
              const title = typeof idea.title === "string" ? idea.title : t.noTitle;
              const content = getText(idea);
              const kindLabel = typeof idea.kind === "string" ? idea.kind : idea.story ? t.stories : t.post;
              const avatar = author.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
              return <article className="fp-card" key={String(idea.id)} data-post-id={String(idea.id)} data-testid="post" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}>
                <div className="fp-card-top">
                  <div className="fp-byline"><div className="fp-avatar" aria-hidden="true">{avatar || "BQ"}</div><div><div className="fp-author">{author}</div><div className="fp-date">{getDate(idea)}</div></div></div>
                  <span className="fp-tag">{kindLabel}</span>
                </div>
                <h3>{title}</h3>
                <p className="fp-copy">{content || t.noText}</p>
                <div className="fp-card-bottom"><span>{t.post} · {String(idea.id)}</span><span className={idea.saved ? "fp-saved" : ""}>{idea.saved ? t.savedFlag : t.notSaved}</span></div>
              </article>;
            })}
            </div>

            {deepLinked && <div className="fp-load-wrap"><button className="fp-button fp-button-outline" onClick={() => { window.location.hash = ""; }}>{t.clearDeepLink}</button></div>}
            {!deepLinked && requestState === "more" && nextCursor && <div className="fp-load-wrap"><button className="fp-button fp-button-primary" data-testid="load-more" onClick={loadMore} disabled={!session}>{t.loadMore}</button></div>}
            {!deepLinked && requestState === "end" && ideas.length > 0 && <div className="fp-state"><p>{t.end}</p></div>}
            <div ref={observerTargetRef} aria-hidden="true" />
            <div className="fp-footer">PREVIEW PROXY · KEYSET V1 · WINDOW LIMIT {MAX_POSTS}</div>
          </section>

          <aside className="fp-side" aria-label="Preview controls and diagnostics">
            <section className="fp-side-panel">
              <div className="fp-section-label">02 / Pagination</div>
              <h2 className="fp-side-title" style={{ marginTop: 9 }}>{t.page}</h2>
              <label className="fp-check" style={{ marginTop: 8 }}><input type="checkbox" data-testid="infinite-toggle" checked={infinite} onChange={(event) => setInfinite(event.target.checked)} /><span>{t.infinite}</span></label>
              <p className="fp-side-copy">Keyset cursor chain · 8 records per request. Duplicate IDs are discarded; display is capped at 80.</p>
              <div className="fp-status-line" data-testid="status" role="status" aria-live="polite"><span className="fp-dot" />{requestState === "loading" ? t.loading : requestState === "restart" ? t.restartTitle : requestState === "error" ? t.requestFailed : requestState === "end" ? t.end : `${ideas.length} / ${MAX_POSTS} · ${pageState}`}</div>
            </section>
            <section className="fp-side-panel">
              <div className="fp-section-label">03 / Diagnostics</div>
              <h2 className="fp-side-title" style={{ marginTop: 9 }}>{t.total}</h2>
              <div className="fp-stat"><div className="fp-stat-label">{t.visible} / limit</div><div className="fp-stat-value">{ideas.length} / {MAX_POSTS}</div></div>
              <div className="fp-stat"><div className="fp-stat-label">API stats</div><div className="fp-stat-value" style={{ fontSize: 11 }}>{statsSummary}</div></div>
              {evicted > 0 && <div className="fp-stat"><div className="fp-stat-label">{t.evictionCount}</div><div className="fp-stat-value">{evicted}</div></div>}
            </section>
            <section className="fp-side-panel">
              <div className="fp-section-label">04 / Test fixtures</div>
              <h2 className="fp-side-title" style={{ marginTop: 9 }}>{t.controls}</h2>
              <p className="fp-side-copy">{t.controlsNote}</p>
              <div className="fp-control-buttons">
                <button type="button" className="fp-button fp-button-quiet" data-testid="simulate-insert" disabled={!session || controlBusy} onClick={() => void runControl("insert")}>{t.insert}</button>
                <button type="button" className="fp-button fp-button-outline" data-testid="simulate-expire" disabled={!session || controlBusy} onClick={() => void runControl("expire")}>{t.expire}</button>
                <button type="button" className="fp-button fp-button-danger" data-testid="simulate-error" disabled={!session || controlBusy} onClick={() => void runControl("error")}>{t.error}</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default FeedPreview;
