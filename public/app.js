/* ═══════════════════════════════════════════
   School Hub — App Logic v2
   ═══════════════════════════════════════════ */

const modules = [
  { id: "dashboard",      label: "Command Center",  icon: "🏠", group: "Overview" },
  { id: "announcements",  label: "Announcements",   icon: "📢", group: "Overview" },
  { id: "students",       label: "Students",         icon: "🎓", group: "People" },
  { id: "teachers",       label: "Teachers",         icon: "👨‍🏫", group: "People" },
  { id: "classes",        label: "Classes",           icon: "🏫", group: "Academics" },
  { id: "attendance",     label: "Attendance",        icon: "✅", group: "Academics" },
  { id: "exams",          label: "Exams",             icon: "📝", group: "Academics" },
  { id: "fees",           label: "Fees",              icon: "💰", group: "Finance" },
  { id: "reports",        label: "Reports",           icon: "📊", group: "Finance" },
];

const configurations = {
  students: {
    title: "Students", description: "Manage admissions, guardians, and enrollment status.",
    button: "Add student",
    fields: [
      ["name",        "Student name",     "text",   true],
      ["admissionNo", "Admission number", "text",   true],
      ["className",   "Class / section",  "text",   true],
      ["guardian",    "Guardian name",    "text"],
      ["phone",       "Phone",            "tel"],
      ["dob",         "Date of birth",    "date"],
      ["status",      "Status",           ["Active", "Inactive"]],
    ],
    columns: [["name","Student"],["admissionNo","Admission no."],["className","Class"],["guardian","Guardian"],["phone","Phone"],["status","Status"]],
  },
  teachers: {
    title: "Teachers", description: "Maintain faculty records and teaching assignments.",
    button: "Add teacher",
    fields: [
      ["name",       "Teacher name",    "text", true],
      ["employeeNo", "Employee number", "text", true],
      ["subject",    "Subject",         "text", true],
      ["phone",      "Phone",           "tel"],
      ["email",      "Email",           "email"],
      ["status",     "Status",          ["Active", "Inactive"]],
    ],
    columns: [["name","Teacher"],["employeeNo","Employee no."],["subject","Subject"],["phone","Phone"],["email","Email"],["status","Status"]],
  },
  classes: {
    title: "Classes", description: "Assign class teachers, rooms, and enrollment counts.",
    button: "Add class",
    fields: [
      ["name",     "Class name",    "text",   true],
      ["teacher",  "Class teacher", "text",   true],
      ["room",     "Room",          "text"],
      ["students", "Students",      "number"],
    ],
    columns: [["name","Class"],["teacher","Class teacher"],["room","Room"],["students","Students"]],
  },
  attendance: {
    title: "Attendance", description: "Record daily attendance for enrolled students.",
    button: "Mark attendance",
    fields: [
      ["student",   "Student",         "text", true],
      ["className", "Class / section", "text", true],
      ["date",      "Date",            "date", true],
      ["status",    "Status",          ["Present", "Absent", "Late"], true],
    ],
    columns: [["student","Student"],["className","Class"],["date","Date"],["status","Status"]],
  },
  fees: {
    title: "Fees", description: "Track invoices, collections, and pending balances.",
    button: "Add invoice",
    fields: [
      ["student", "Student",        "text",   true],
      ["invoice", "Invoice number", "text",   true],
      ["amount",  "Amount (₹)",     "number", true],
      ["paid",    "Paid amount (₹)","number"],
      ["dueDate", "Due date",       "date",   true],
      ["status",  "Status",         ["Pending", "Paid", "Partial"]],
    ],
    columns: [["student","Student"],["invoice","Invoice"],["amount","Amount"],["paid","Paid"],["dueDate","Due date"],["status","Status"]],
  },
  exams: {
    title: "Exams", description: "Schedule assessments and define total marks.",
    button: "Schedule exam",
    fields: [
      ["name",       "Exam name",      "text",   true],
      ["className",  "Class / section","text",   true],
      ["subject",    "Subject",        "text",   true],
      ["date",       "Exam date",      "date",   true],
      ["totalMarks", "Total marks",    "number"],
    ],
    columns: [["name","Exam"],["className","Class"],["subject","Subject"],["date","Date"],["totalMarks","Marks"]],
  },
  announcements: {
    title: "Announcements", description: "Post notices and important communications to all staff.",
    button: "Post announcement",
    fields: [
      ["title",    "Title",    "text",    true],
      ["body",     "Message",  "textarea", true],
      ["category", "Category", ["General", "Exam", "Holiday", "Fee"]],
      ["date",     "Date",     "date",    true],
    ],
    columns: [["title","Title"],["category","Category"],["date","Date"],["body","Message"]],
  },
};

// ── State ────────────────────────────────────────────────
const state = {
  data: null,
  active: "dashboard",
  editing: null,
  search: "",
  token: sessionStorage.getItem("school-hub-session"),
};

// ── DOM refs ─────────────────────────────────────────────
const page         = document.querySelector("#page");
const navigation   = document.querySelector("#navigation");
const dialog       = document.querySelector("#recordDialog");
const form         = document.querySelector("#recordForm");
const search       = document.querySelector("#search");
const themeToggle  = document.querySelector("#themeToggle");
const loginToggle  = document.querySelector("#loginThemeToggle");
const loginScreen  = document.querySelector("#loginScreen");
const appShell     = document.querySelector("#appShell");
const loginForm    = document.querySelector("#loginForm");
const loginBtn     = document.querySelector("#loginBtn");

// ── Theme ────────────────────────────────────────────────
function updateThemeToggle() {
  const dark = document.documentElement.dataset.theme === "dark";
  const label = `Switch to ${dark ? "light" : "dark"} theme`;
  [themeToggle, loginToggle].forEach((t) => {
    t.setAttribute("aria-label", label);
    t.title = label;
    t.querySelector(".theme-icon").textContent = dark ? "☀️" : "🌙";
  });
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("school-hub-theme", next);
  updateThemeToggle();
}

// ── API ──────────────────────────────────────────────────
async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const response = await fetch(url, { headers, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Something went wrong.");
  }
  return response.status === 204 ? null : response.json();
}

// ── Auth ─────────────────────────────────────────────────
function showView(authenticated) {
  loginScreen.hidden = authenticated;
  appShell.hidden    = !authenticated;
}

async function load() {
  state.data = await request("/api/bootstrap");
  document.querySelector("#academicYear").textContent = state.data.school.academicYear;
  document.querySelector("#term").textContent         = state.data.school.term;
  render();
}

async function signIn(event) {
  event.preventDefault();
  document.querySelector("#loginError").textContent = "";
  const btnText   = loginBtn.querySelector(".btn-text");
  const btnLoader = loginBtn.querySelector(".btn-loader");
  loginBtn.disabled = true;
  btnText.hidden    = true;
  btnLoader.hidden  = false;
  try {
    const credentials = Object.fromEntries(new FormData(loginForm).entries());
    const session     = await request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
    state.token = session.token;
    sessionStorage.setItem("school-hub-session", session.token);
    showView(true);
    loginForm.reset();
    await load();
  } catch (err) {
    document.querySelector("#loginError").textContent = err.message;
  } finally {
    loginBtn.disabled = false;
    btnText.hidden    = false;
    btnLoader.hidden  = true;
  }
}

async function signOut() {
  try { await request("/api/auth/logout", { method: "POST" }); } catch (_) {}
  state.token = null;
  state.data  = null;
  sessionStorage.removeItem("school-hub-session");
  showView(false);
}

async function initializeSession() {
  updateThemeToggle();
  if (!state.token) { showView(false); return; }
  try {
    await request("/api/auth/session");
    showView(true);
    await load();
  } catch {
    state.token = null;
    sessionStorage.removeItem("school-hub-session");
    showView(false);
  }
}

// ── Helpers ──────────────────────────────────────────────
const currency = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const formatDate = (v) =>
  v ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${v}T00:00:00`)) : "—";

const escapeHtml = (v) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function presentValue(key, value) {
  if (key === "amount" || key === "paid") return currency(Number(value || 0));
  if (key === "date"   || key === "dueDate") return formatDate(value);
  if (key === "body")  return `<span style="max-width:240px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(String(value ?? ""))}</span>`;
  if (key === "status" || key === "category")
    return `<span class="badge ${escapeHtml(String(value ?? ""))}">${escapeHtml(String(value ?? ""))}</span>`;
  return escapeHtml(String(value ?? "—"));
}

// ── Count-up animation ────────────────────────────────────
function animateCount(el, end, prefix = "", suffix = "") {
  const duration = 900;
  const start    = Date.now();
  const from     = 0;
  const isFloat  = String(end).includes(".");
  const tick = () => {
    const elapsed  = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    const value    = from + (end - from) * ease;
    el.textContent = prefix + (isFloat ? value.toFixed(1) : Math.round(value)) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Navigation ────────────────────────────────────────────
function renderNavigation() {
  const groups = [...new Set(modules.map((m) => m.group))];
  // Derive pending counts
  const pendingFees = state.data?.fees?.filter((f) => f.status === "Pending").length ?? 0;
  const absentToday = state.data?.attendance?.filter((a) => a.status === "Absent").length ?? 0;
  const badges      = { fees: pendingFees, attendance: absentToday };

  navigation.innerHTML = groups.map((group) => `
    <section class="nav-group">
      <span class="nav-group-title">${group}</span>
      ${modules.filter((m) => m.group === group).map((m) => `
        <button class="nav-item ${state.active === m.id ? "active" : ""}" data-module="${m.id}">
          <span class="nav-icon">${m.icon}</span>
          <span>${m.label}</span>
          ${badges[m.id] ? `<span class="nav-badge">${badges[m.id]}</span>` : ""}
        </button>
      `).join("")}
    </section>
  `).join("");
}

function renderContext() {
  const m = modules.find((m) => m.id === state.active);
  document.querySelector("#contextLabel").textContent = `${m.group} / ${m.label}`;
  document.querySelector("#contextTitle").textContent =
    state.active === "dashboard" ? "Command Center" : m.label;
}

// ── Dashboard ─────────────────────────────────────────────
function renderDashboard() {
  const s = state.data.dashboard;
  const announcements = (state.data.announcements || []).slice(0, 3);

  page.innerHTML = `
    <section class="dashboard-intro">
      <div class="intro-copy">
        <span class="status-pill">Live operations</span>
        <h2>School operations at a glance</h2>
        <p>Review today's attendance, outstanding collections, and upcoming academic priorities.</p>
      </div>
      <div class="intro-badge">
        <span class="eyebrow">Academic session</span>
        <strong>${state.data.school.academicYear}</strong>
        <small>${state.data.school.term} is active</small>
      </div>
    </section>

    <section class="stats">
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Students</span><span class="stat-symbol">🎓</span></div>
        <strong class="stat-value" id="cntStudents">0</strong>
        <span class="stat-note positive">Active enrollment</span>
      </article>
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Teachers</span><span class="stat-symbol">👨‍🏫</span></div>
        <strong class="stat-value" id="cntTeachers">0</strong>
        <span class="stat-note">Faculty members</span>
      </article>
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Attendance</span><span class="stat-symbol">✅</span></div>
        <strong class="stat-value" id="cntAttendance">0%</strong>
        <span class="stat-note positive">Recorded today</span>
      </article>
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Fees Due</span><span class="stat-symbol">💰</span></div>
        <strong class="stat-value" id="cntFees">0</strong>
        <span class="stat-note alert">Outstanding balance</span>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-header">
          <div><span class="eyebrow">Schedule</span><h3>Upcoming Exams</h3></div>
          <button data-open="exams">View all</button>
        </div>
        <div class="exam-list">
          ${s.upcomingExams.map((e) => `
            <div class="exam-item">
              <div><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.className)} · ${escapeHtml(e.subject)}</small></div>
              <span class="date-chip">📅 ${formatDate(e.date)}</span>
            </div>
          `).join("") || "<p class='empty'>No upcoming exams scheduled.</p>"}
        </div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div><span class="eyebrow">Attention</span><h3>Action Center</h3></div>
        </div>
        <div class="action-list">
          <button data-open="attendance">
            <strong>Complete attendance</strong>
            <small>${s.attendanceRate}% recorded today</small>
            <span>Review →</span>
          </button>
          <button data-open="fees">
            <strong>Follow up fees</strong>
            <small>${currency(s.outstandingFees)} outstanding</small>
            <span>Open →</span>
          </button>
          <button data-open="exams">
            <strong>Prepare exams</strong>
            <small>${s.upcomingExams.length} scheduled soon</small>
            <span>Plan →</span>
          </button>
          <button data-open="announcements">
            <strong>Post announcement</strong>
            <small>Keep staff informed</small>
            <span>Write →</span>
          </button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div><span class="eyebrow">Finance</span><h3>Collection Snapshot</h3></div>
          <button data-open="fees">Open fees</button>
        </div>
        <div class="insight">
          <strong id="insightFees">${currency(s.outstandingFees)}</strong>
          <p>Outstanding balance requiring follow-up from the accounts team.</p>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div><span class="eyebrow">Notices</span><h3>Latest Announcements</h3></div>
          <button data-open="announcements">View all</button>
        </div>
        <div class="announcement-list">
          ${announcements.map((a) => `
            <div class="announcement-item">
              <div class="ann-title">${escapeHtml(a.title)}</div>
              <div class="ann-body">${escapeHtml((a.body || "").slice(0, 100))}${(a.body || "").length > 100 ? "…" : ""}</div>
              <div class="ann-meta">
                <span class="ann-category ${escapeHtml(a.category || "General")}">${escapeHtml(a.category || "General")}</span>
                <span class="ann-date">${formatDate(a.date)}</span>
              </div>
            </div>
          `).join("") || "<p class='empty'>No announcements yet.</p>"}
        </div>
      </article>
    </section>
  `;

  // Animate counts
  animateCount(document.getElementById("cntStudents"),  s.studentCount);
  animateCount(document.getElementById("cntTeachers"),  s.teacherCount);
  animateCount(document.getElementById("cntAttendance"), s.attendanceRate, "", "%");
  // Fees: animate raw number, display currency
  const feesEl = document.getElementById("cntFees");
  const feesEnd = s.outstandingFees;
  const startFees = Date.now();
  const tickFees = () => {
    const p = Math.min((Date.now() - startFees) / 900, 1);
    const e = 1 - Math.pow(1 - p, 3);
    feesEl.textContent = currency(Math.round(feesEnd * e));
    if (p < 1) requestAnimationFrame(tickFees);
  };
  requestAnimationFrame(tickFees);
}

// ── Reports view ───────────────────────────────────────────
function renderReports() {
  const fees       = state.data.fees || [];
  const attendance = state.data.attendance || [];
  const students   = state.data.students || [];

  const paid    = fees.filter((f) => f.status === "Paid").length;
  const pending = fees.filter((f) => f.status === "Pending").length;
  const partial = fees.filter((f) => f.status === "Partial").length;
  const present = attendance.filter((a) => a.status === "Present").length;
  const absent  = attendance.filter((a) => a.status === "Absent").length;
  const late    = attendance.filter((a) => a.status === "Late").length;
  const active  = students.filter((s) => s.status === "Active").length;
  const inactive = students.filter((s) => s.status === "Inactive").length;

  const totalRevenue = fees.filter((f) => f.status === "Paid").reduce((acc, f) => acc + Number(f.amount || 0), 0);
  const totalOut     = fees.filter((f) => f.status !== "Paid").reduce((acc, f) => acc + Number(f.amount || 0) - Number(f.paid || 0), 0);

  page.innerHTML = `
    <header class="page-heading">
      <div><h2>Reports & Analytics</h2><p>Summary of key school metrics for the current academic term.</p></div>
    </header>

    <section class="stats">
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Total Students</span><span class="stat-symbol">🎓</span></div>
        <strong class="stat-value">${students.length}</strong>
        <span class="stat-note">${active} active · ${inactive} inactive</span>
      </article>
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Revenue Collected</span><span class="stat-symbol">💵</span></div>
        <strong class="stat-value" style="font-size:1.5rem">${currency(totalRevenue)}</strong>
        <span class="stat-note positive">From ${paid} paid invoices</span>
      </article>
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Outstanding</span><span class="stat-symbol">⚠️</span></div>
        <strong class="stat-value" style="font-size:1.5rem">${currency(totalOut)}</strong>
        <span class="stat-note alert">${pending + partial} unpaid invoices</span>
      </article>
      <article class="stat">
        <div class="stat-header"><span class="stat-label">Attendance Rate</span><span class="stat-symbol">📋</span></div>
        <strong class="stat-value">${attendance.length ? Math.round(present / attendance.length * 100) : 0}%</strong>
        <span class="stat-note">${present} present of ${attendance.length}</span>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-header"><div><span class="eyebrow">Finance</span><h3>Fee Collection Status</h3></div></div>
        <div class="chart-panel">
          <canvas id="feeChart" width="400" height="200"></canvas>
        </div>
        <div style="display:flex;gap:16px;padding:16px 22px;font-size:0.8rem;">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#10b981;display:inline-block"></span> Paid (${paid})</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#f43f5e;display:inline-block"></span> Pending (${pending})</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#f59e0b;display:inline-block"></span> Partial (${partial})</span>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header"><div><span class="eyebrow">Academics</span><h3>Attendance Breakdown</h3></div></div>
        <div class="chart-panel">
          <canvas id="attChart" width="400" height="200"></canvas>
        </div>
        <div style="display:flex;gap:16px;padding:16px 22px;font-size:0.8rem;">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#10b981;display:inline-block"></span> Present (${present})</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#f43f5e;display:inline-block"></span> Absent (${absent})</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:3px;background:#f59e0b;display:inline-block"></span> Late (${late})</span>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header"><div><span class="eyebrow">Students</span><h3>Enrollment Status</h3></div></div>
        <div class="chart-panel">
          <canvas id="studentChart" width="400" height="200"></canvas>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header"><div><span class="eyebrow">Summary</span><h3>Quick Insights</h3></div></div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">
          ${[
            ["Total teachers",  state.data.teachers?.length ?? 0, "👨‍🏫"],
            ["Total classes",   state.data.classes?.length  ?? 0, "🏫"],
            ["Upcoming exams",  state.data.dashboard?.upcomingExams?.length ?? 0, "📝"],
            ["Total invoices",  fees.length, "🧾"],
          ].map(([label, val, icon]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-muted);border-radius:var(--radius-sm);border:1px solid var(--line)">
              <span style="font-size:0.85rem;color:var(--text-muted)">${icon} ${label}</span>
              <strong style="font-size:1rem;font-weight:700">${val}</strong>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;

  // Draw charts after DOM update
  requestAnimationFrame(() => drawCharts(paid, pending, partial, present, absent, late, active, inactive));
}

function drawCharts(paid, pending, partial, present, absent, late, active, inactive) {
  const dark = document.documentElement.dataset.theme === "dark";
  const textColor = dark ? "#94a3b8" : "#64748b";

  const drawDonut = (id, data, colors, labels) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const total = data.reduce((a, b) => a + b, 0);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(cx, cy) - 20;
    const inner = r * 0.55;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (total === 0) {
      ctx.fillStyle = textColor;
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data", cx, cy + 5);
      return;
    }

    let angle = -Math.PI / 2;
    data.forEach((val, i) => {
      if (!val) return;
      const slice = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      // Gap
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
      ctx.fillStyle = dark ? "#0f1829" : "#ffffff";
      ctx.fill();
      angle += slice;
    });

    // Center text
    ctx.fillStyle = dark ? "#f1f5f9" : "#0f172a";
    ctx.font = "bold 28px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total, cx, cy - 8);
    ctx.font = "12px Inter, sans-serif";
    ctx.fillStyle = textColor;
    ctx.fillText("total", cx, cy + 14);
  };

  drawDonut("feeChart",     [paid, pending, partial], ["#10b981","#f43f5e","#f59e0b"]);
  drawDonut("attChart",     [present, absent, late],  ["#10b981","#f43f5e","#f59e0b"]);
  drawDonut("studentChart", [active, inactive],        ["#6366f1","#94a3b8"]);
}

// ── Module view ────────────────────────────────────────────
function renderModule() {
  const config  = configurations[state.active];
  if (!config) return renderDashboard();
  const query   = state.search.toLowerCase();
  const records = (state.data[state.active] || []).filter(
    (r) => !query || Object.values(r).some((v) => String(v).toLowerCase().includes(query))
  );

  const heading = `<header class="page-heading">
    <div><h2>${config.title}</h2><p>${config.description}</p></div>
    ${config.button ? `<button class="button primary" data-create="${state.active}">${config.button}</button>` : ""}
  </header>`;

  page.innerHTML = `${heading}
    <section class="module-toolbar">
      <div><strong>${records.length}</strong> <span>${records.length === 1 ? "record" : "records"}</span></div>
      <div class="filter-pills" aria-label="Filter">
        <span class="active">All records</span>
        <span>Current term</span>
      </div>
    </section>
    <section class="table-panel">
      <table>
        <thead><tr>${config.columns.map(([, l]) => `<th>${l}</th>`).join("")}<th></th></tr></thead>
        <tbody>${records.map((r) => `<tr>
          ${config.columns.map(([k]) => `<td>${presentValue(k, r[k])}</td>`).join("")}
          <td><div class="actions">
            <button class="button ghost" data-edit="${r.id}" style="font-size:0.8rem;padding:6px 12px">Edit</button>
            <button class="button ghost danger" data-delete="${r.id}" style="font-size:0.8rem;padding:6px 12px">Delete</button>
          </div></td>
        </tr>`).join("")}</tbody>
      </table>
      ${records.length ? "" : "<p class='empty'>No records found. Add one to get started.</p>"}
    </section>`;
}

// ── Render ────────────────────────────────────────────────
function render() {
  renderNavigation();
  renderContext();
  if      (state.active === "dashboard")     renderDashboard();
  else if (state.active === "reports")       renderReports();
  else                                       renderModule();
}

// ── Dialog ────────────────────────────────────────────────
function openForm(record) {
  const config = configurations[state.active];
  if (!config) return;
  state.editing = record || null;
  document.querySelector("#dialogMode").textContent  = record ? "Update record" : "New record";
  document.querySelector("#dialogTitle").textContent = `${record ? "Edit" : "Add"} ${config.title.replace(/s$/, "").toLowerCase()}`;
  document.querySelector("#formError").textContent   = "";

  document.querySelector("#formFields").innerHTML = config.fields.map(([key, label, type, required]) => {
    const value = record?.[key] ?? "";
    const req   = required ? "required" : "";
    if (Array.isArray(type)) {
      return `<div class="field"><label for="${key}">${label}</label>
        <select id="${key}" name="${key}" ${req}>
          ${type.map((o) => `<option ${value === o ? "selected" : ""}>${o}</option>`).join("")}
        </select></div>`;
    }
    if (type === "textarea") {
      return `<div class="field full"><label for="${key}">${label}</label>
        <textarea id="${key}" name="${key}" rows="4" ${req} style="resize:vertical">${escapeHtml(String(value))}</textarea></div>`;
    }
    return `<div class="field"><label for="${key}">${label}</label>
      <input id="${key}" name="${key}" type="${type}" value="${escapeHtml(String(value))}" ${req}></div>`;
  }).join("");
  dialog.showModal();
}

async function saveRecord(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form).entries());
  const url     = state.editing ? `/api/${state.active}/${state.editing.id}` : `/api/${state.active}`;
  try {
    await request(url, { method: state.editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
    dialog.close();
    showToast(state.editing ? "✅ Record updated successfully." : "✅ Record created successfully.");
    await load();
  } catch (err) {
    document.querySelector("#formError").textContent = err.message;
  }
}

async function removeRecord(id) {
  if (!confirm("Delete this record? This cannot be undone.")) return;
  try {
    await request(`/api/${state.active}/${id}`, { method: "DELETE" });
    showToast("🗑️ Record deleted.");
    await load();
  } catch (err) { showToast("❌ " + err.message); }
}

// ── Toast ─────────────────────────────────────────────────
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("visible"), 2800);
}

// ── Events ────────────────────────────────────────────────
navigation.addEventListener("click", (e) => {
  const t = e.target.closest("[data-module]");
  if (!t) return;
  state.active = t.dataset.module;
  state.search = "";
  search.value = "";
  render();
});

page.addEventListener("click", (e) => {
  const create = e.target.closest("[data-create]");
  const open   = e.target.closest("[data-open]");
  const edit   = e.target.closest("[data-edit]");
  const remove = e.target.closest("[data-delete]");
  if (create) openForm();
  if (open) { state.active = open.dataset.open; render(); }
  if (edit)   openForm(state.data[state.active]?.find((r) => r.id === edit.dataset.edit));
  if (remove) removeRecord(remove.dataset.delete);
});

search.addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  if (state.active !== "dashboard" && state.active !== "reports") renderModule();
});

themeToggle.addEventListener("click", toggleTheme);
loginToggle.addEventListener("click", toggleTheme);
loginForm.addEventListener("submit", signIn);
document.querySelector("#signOut").addEventListener("click", signOut);
document.querySelector("#quickActions").addEventListener("click", () => {
  if (state.active === "dashboard" || state.active === "reports") { state.active = "students"; render(); }
  openForm();
});
form.addEventListener("submit", saveRecord);
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelDialog").addEventListener("click", () => dialog.close());

// ── Boot ──────────────────────────────────────────────────
initializeSession().catch((err) => {
  page.innerHTML = `<p class="empty">⚠️ ${escapeHtml(err.message)} — Refresh the page to retry.</p>`;
});
