export function renderDashboard(): Response {
  return new Response(DASHBOARD_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function renderReferralCodesPage(): Response {
  return new Response(REFERRAL_CODES_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function renderUserTradePage(uid: string): Response {
  return new Response(USER_TRADE_HTML.replaceAll("__UID__", escapeHtml(uid)), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const DASHBOARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>XT Data Dashboard</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --ink: #18201e;
      --muted: #69716d;
      --line: #d8d1c4;
      --panel: #fffdf8;
      --accent: #0f766e;
      --accent-2: #b45309;
      --danger: #b42318;
      --shadow: 0 18px 60px rgba(24, 32, 30, .10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Aptos", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        linear-gradient(135deg, rgba(15,118,110,.10), transparent 34%),
        radial-gradient(circle at 80% 0%, rgba(180,83,9,.12), transparent 32%),
        var(--bg);
    }
    button, input { font: inherit; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 28px; }
    header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 30px; line-height: 1.1; }
    .sub { margin: 8px 0 0; color: var(--muted); }
    .auth, .panel, .card { background: rgba(255,253,248,.88); border: 1px solid var(--line); box-shadow: var(--shadow); }
    .auth { padding: 12px; display: flex; gap: 8px; border-radius: 8px; min-width: min(520px, 100%); }
    input {
      width: 100%;
      border: 1px solid var(--line);
      background: #fffaf0;
      color: var(--ink);
      border-radius: 6px;
      padding: 10px 11px;
    }
    button {
      border: 0;
      border-radius: 6px;
      padding: 10px 13px;
      cursor: pointer;
      color: white;
      background: var(--accent);
      min-height: 40px;
      white-space: nowrap;
    }
    button.secondary { color: var(--ink); background: #e9e2d5; }
    button.warn { background: var(--accent-2); }
    button:disabled { opacity: .55; cursor: wait; }
    select {
      border: 1px solid var(--line);
      background: #fffaf0;
      color: var(--ink);
      border-radius: 6px;
      padding: 10px 11px;
      min-height: 40px;
    }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .card { border-radius: 8px; padding: 16px; min-height: 112px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .value { margin-top: 10px; font-size: 26px; font-weight: 760; }
    .panel { border-radius: 8px; padding: 16px; margin-top: 16px; overflow: hidden; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    .th-toggle {
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .status { min-height: 24px; color: var(--muted); }
    .error { color: var(--danger); }
    .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e4f2ef; color: #115e59; font-size: 12px; }
    .amount-link { color: var(--accent); font-weight: 700; text-decoration: none; }
    .amount-stack { display: flex; flex-direction: column; gap: 4px; }
    .amount-raw { color: var(--muted); font-size: 12px; line-height: 1.2; }
    .filter-panel {
      display: none;
      margin: 0 0 12px auto;
      max-width: 360px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffaf0;
      padding: 12px;
    }
    .filter-panel.open { display: block; }
    .filter-options { display: grid; gap: 8px; max-height: 260px; overflow: auto; margin: 10px 0; }
    .filter-option { display: flex; align-items: center; gap: 8px; color: var(--ink); }
    .filter-option input { width: auto; }
    .filter-actions { display: flex; gap: 8px; justify-content: flex-end; }
    @media (max-width: 880px) {
      header { display: block; }
      .auth { margin-top: 16px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .shell { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      .auth, .toolbar, .actions { display: grid; grid-template-columns: 1fr; }
      table { font-size: 13px; }
      th, td { padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>XT Data Dashboard</h1>
        <p class="sub"><a href="/referrals" style="color: var(--accent); text-decoration: none; font-weight: 700;">Referral codes</a> - Cloudflare D1 UID sync operations</p>
      </div>
      <form class="auth" id="authForm">
        <input id="tokenInput" type="password" autocomplete="current-password" placeholder="Admin token">
        <button type="submit">Unlock</button>
      </form>
    </header>

    <section class="grid">
      <div class="card"><div class="label">Users</div><div class="value" id="userCount">-</div></div>
      <div class="card"><div class="label">Latest Run</div><div class="value" id="latestRun">-</div></div>
      <div class="card"><div class="label">Scheduled State</div><div class="value" id="syncState">-</div></div>
      <div class="card"><div class="label">Next Cursor</div><div class="value" id="nextCursor">-</div></div>
      <div class="card"><div class="label">Balances Shown</div><div class="value" id="balanceRows">-</div></div>
    </section>

    <section class="panel">
      <div class="toolbar">
        <div>
          <strong>Operations</strong>
          <div class="status" id="message">Enter the admin token to load dashboard data.</div>
        </div>
        <div class="actions">
          <button id="refreshBtn" type="button">Refresh</button>
          <button id="importBtn" class="warn" type="button">Run Chunk</button>
          <button id="balanceBtn" class="warn" type="button">Sync Balances</button>
          <button id="referralBtn" class="warn" type="button">Sync Referrals</button>
          <button id="tradeBackfillBtn" class="warn" type="button">Backfill Trades</button>
          <button id="resetBtn" class="secondary" type="button">Reset Sync</button>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="toolbar">
        <strong>UID Rows</strong>
        <select id="sortSelect">
          <option value="recent">Recent</option>
          <option value="balance_desc">Balance high to low</option>
          <option value="balance_asc">Balance low to high</option>
          <option value="trade_30d_desc">30d trade high to low</option>
          <option value="registered_desc">Registration newest first</option>
          <option value="registered_asc">Registration oldest first</option>
        </select>
        <span class="pill" id="pageInfo">Page 1</span>
      </div>
      <div id="referralFilterPanel" class="filter-panel" aria-label="Referral code filter">
        <strong>Referral Code Filter</strong>
        <div class="filter-options" id="referralFilterOptions"></div>
        <div class="filter-actions">
          <button class="secondary" id="referralClearBtn" type="button">Clear</button>
          <button id="referralApplyBtn" type="button">Apply</button>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>UID</th><th><button id="referralFilterBtn" class="th-toggle" type="button">Referral Code</button></th><th><button id="registrationModeBtn" class="th-toggle" type="button">Registered Date</button></th><th>Balance</th><th>30d Trade Volume</th><th>Cumulative Fee</th></tr>
        </thead>
        <tbody id="usersBody">
          <tr><td colspan="6">No data loaded.</td></tr>
        </tbody>
      </table>
      <div class="toolbar" style="margin-top:12px">
        <button class="secondary" id="prevBtn" type="button">Previous</button>
        <button class="secondary" id="nextBtn" type="button">Next</button>
      </div>
    </section>
  </main>
  <script>
    const state = {
      token: sessionStorage.getItem("xtAdminToken") || "",
      offset: 0,
      limit: 25,
      sort: sessionStorage.getItem("xtUserSort") || "recent",
      registrationMode: sessionStorage.getItem("xtRegistrationMode") || "date",
      referralFilterActive: sessionStorage.getItem("xtReferralFilterActive") === "1",
      selectedReferralCodes: parseStoredArray("xtSelectedReferralCodes"),
      includeBlankReferralCode: sessionStorage.getItem("xtIncludeBlankReferralCode") === "1",
      referralOptions: null,
      currentUsers: []
    };
    const el = (id) => document.getElementById(id);
    el("tokenInput").value = state.token;
    el("sortSelect").value = state.sort;
    updateRegistrationModeButton();
    updateReferralFilterButton();

    function headers() {
      return state.token ? { authorization: "Bearer " + state.token } : {};
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }
    function setMessage(text, error = false) {
      el("message").textContent = text;
      el("message").className = error ? "status error" : "status";
    }
    function fmt(value) {
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    }
    function html(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }
    function parseStoredArray(key) {
      try {
        const value = JSON.parse(sessionStorage.getItem(key) || "null");
        return Array.isArray(value) ? value.filter((item) => typeof item === "string") : null;
      } catch {
        return null;
      }
    }
    const numberFormatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    function fmtAmount(value) {
      if (value === null || value === undefined || value === "") return "-";
      const number = typeof value === "number" ? value : Number(value);
      return Number.isFinite(number) ? numberFormatter.format(number) : "-";
    }
    function germanyDateString(date) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date);
    }
    function formatGermanyDateFromMs(value) {
      if (value === null || value === undefined || value === "") return "-";
      const number = typeof value === "number" ? value : Number(value);
      return Number.isFinite(number) ? germanyDateString(new Date(number)) : "-";
    }
    function daysBetweenDateStrings(startDate, endDate) {
      const startParts = startDate.split("-").map(Number);
      const endParts = endDate.split("-").map(Number);
      if (startParts.length !== 3 || endParts.length !== 3) return NaN;
      const start = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
      const end = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
      return Math.floor((end - start) / 86400000);
    }
    function fmtRegistration(user) {
      const date = formatGermanyDateFromMs(user.registered_at);
      if (date === "-") return "-";
      if (state.registrationMode === "days") {
        const days = daysBetweenDateStrings(date, germanyDateString(new Date()));
        return Number.isFinite(days) ? numberFormatter.format(days).replace(".00", "") : "-";
      }
      return date;
    }
    function updateRegistrationModeButton() {
      el("registrationModeBtn").textContent = state.registrationMode === "days" ? "Registered Days" : "Registered Date";
    }
    function updateReferralFilterButton() {
      el("referralFilterBtn").textContent = state.referralFilterActive ? "Referral Code Filtered" : "Referral Code";
    }
    function usersUrl() {
      const params = new URLSearchParams({
        limit: String(state.limit),
        offset: String(state.offset),
        sort: state.sort
      });
      if (state.referralFilterActive) {
        params.set("referralFilter", "1");
        for (const code of state.selectedReferralCodes || []) params.append("referralCode", code);
        if (state.includeBlankReferralCode) params.set("includeBlankReferralCode", "1");
      }
      return "/admin/users?" + params.toString();
    }
    async function loadReferralOptions() {
      if (state.referralOptions) return;
      const data = await api("/admin/referrals/codes?limit=1000&offset=0");
      state.referralOptions = data.codes.map((item) => item.code);
      if (!state.selectedReferralCodes) state.selectedReferralCodes = [...state.referralOptions];
    }
    function renderReferralFilterOptions() {
      const selected = new Set(state.referralFilterActive ? state.selectedReferralCodes || [] : state.referralOptions || []);
      const blankChecked = state.referralFilterActive ? state.includeBlankReferralCode : true;
      el("referralFilterOptions").innerHTML =
        '<label class="filter-option"><input type="checkbox" id="blankReferralOption" ' + (blankChecked ? "checked" : "") + '> <span>(blank)</span></label>' +
        (state.referralOptions || []).map((code) =>
          '<label class="filter-option"><input type="checkbox" class="referralOption" value="' + html(code) + '" ' + (selected.has(code) ? "checked" : "") + '> <span>' + html(code) + '</span></label>'
        ).join("");
    }
    function renderUsers() {
      el("usersBody").innerHTML = state.currentUsers.length
        ? state.currentUsers.map((user) => "<tr><td>" + user.uid + "</td><td>" + fmt(user.register_invite_code) + "</td><td>" + fmtRegistration(user) + "</td><td>" + fmtAmount(user.balance) + "</td><td><a class=\"amount-link\" href=\"/users/" + encodeURIComponent(user.uid) + "/trade\">" + fmtAmount(user.trade_30d_amount) + "</a></td><td><div class=\"amount-stack\"><span>" + fmtAmount(user.cumulative_fee) + "</span><span class=\"amount-raw\">" + fmt(user.cumulative_fee_text) + "</span></div></td></tr>").join("")
        : '<tr><td colspan="6">No rows on this page.</td></tr>';
    }
    async function load() {
      setMessage("Loading...");
      const [sync, users] = await Promise.all([
        api("/admin/sync/uid"),
        api(usersUrl())
      ]);
      el("userCount").textContent = fmt(sync.userCount);
      el("latestRun").textContent = fmt(sync.latestRun?.status);
      el("syncState").textContent = fmt(sync.state?.status);
      el("nextCursor").textContent = fmt(sync.state?.next_cursor);
      el("balanceRows").textContent = String(users.users.filter((user) => user.balance !== null && user.balance !== undefined).length);
      el("pageInfo").textContent = "Rows " + (state.offset + 1) + "-" + (state.offset + users.users.length);
      state.currentUsers = users.users;
      renderUsers();
      setMessage("Dashboard data loaded.");
    }
    el("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      state.token = el("tokenInput").value.trim();
      sessionStorage.setItem("xtAdminToken", state.token);
      state.offset = 0;
      try { await load(); } catch (error) { setMessage(error.message, true); }
    });
    el("refreshBtn").addEventListener("click", () => load().catch((error) => setMessage(error.message, true)));
    el("importBtn").addEventListener("click", async () => {
      setMessage("Running bounded import chunk...");
      try {
        await api("/admin/import/uid?maxPages=5&limit=100", { method: "POST" });
        state.offset = 0;
        await load();
      } catch (error) { setMessage(error.message, true); }
    });
    el("balanceBtn").addEventListener("click", async () => {
      setMessage("Syncing a bounded balance chunk...");
      try {
        await api("/admin/balances/sync?limit=25", { method: "POST" });
        state.offset = 0;
        await load();
      } catch (error) { setMessage(error.message, true); }
    });
    el("referralBtn").addEventListener("click", async () => {
      setMessage("Starting referral-code backfill...");
      try {
        await api("/admin/sync/referrals/start", { method: "POST" });
        state.offset = 0;
        await load();
      } catch (error) { setMessage(error.message, true); }
    });
    el("tradeBackfillBtn").addEventListener("click", async () => {
      setMessage("Starting trade-history backfill...");
      try {
        await api("/admin/sync/trade-backfill/start", { method: "POST" });
        await load();
      } catch (error) { setMessage(error.message, true); }
    });
    el("sortSelect").addEventListener("change", async () => {
      state.sort = el("sortSelect").value;
      sessionStorage.setItem("xtUserSort", state.sort);
      state.offset = 0;
      try { await load(); } catch (error) { setMessage(error.message, true); }
    });
    el("registrationModeBtn").addEventListener("click", () => {
      state.registrationMode = state.registrationMode === "days" ? "date" : "days";
      sessionStorage.setItem("xtRegistrationMode", state.registrationMode);
      updateRegistrationModeButton();
      renderUsers();
    });
    el("referralFilterBtn").addEventListener("click", async () => {
      try {
        await loadReferralOptions();
        renderReferralFilterOptions();
        el("referralFilterPanel").classList.toggle("open");
      } catch (error) { setMessage(error.message, true); }
    });
    el("referralApplyBtn").addEventListener("click", async () => {
      state.selectedReferralCodes = Array.from(document.querySelectorAll(".referralOption:checked")).map((input) => input.value);
      state.includeBlankReferralCode = Boolean(el("blankReferralOption")?.checked);
      const allCodesSelected = Boolean(state.referralOptions) && state.referralOptions.every((code) => state.selectedReferralCodes.includes(code));
      state.referralFilterActive = !(allCodesSelected && state.includeBlankReferralCode);
      state.offset = 0;
      if (state.referralFilterActive) {
        sessionStorage.setItem("xtReferralFilterActive", "1");
        sessionStorage.setItem("xtSelectedReferralCodes", JSON.stringify(state.selectedReferralCodes));
        sessionStorage.setItem("xtIncludeBlankReferralCode", state.includeBlankReferralCode ? "1" : "0");
      } else {
        sessionStorage.removeItem("xtReferralFilterActive");
        sessionStorage.removeItem("xtSelectedReferralCodes");
        sessionStorage.removeItem("xtIncludeBlankReferralCode");
      }
      updateReferralFilterButton();
      el("referralFilterPanel").classList.remove("open");
      try { await load(); } catch (error) { setMessage(error.message, true); }
    });
    el("referralClearBtn").addEventListener("click", async () => {
      state.referralFilterActive = false;
      state.selectedReferralCodes = state.referralOptions ? [...state.referralOptions] : null;
      state.includeBlankReferralCode = false;
      state.offset = 0;
      sessionStorage.removeItem("xtReferralFilterActive");
      sessionStorage.removeItem("xtSelectedReferralCodes");
      sessionStorage.removeItem("xtIncludeBlankReferralCode");
      updateReferralFilterButton();
      el("referralFilterPanel").classList.remove("open");
      try { await load(); } catch (error) { setMessage(error.message, true); }
    });
    el("resetBtn").addEventListener("click", async () => {
      setMessage("Resetting scheduled sync state...");
      try {
        await api("/admin/sync/uid/reset", { method: "POST" });
        await load();
      } catch (error) { setMessage(error.message, true); }
    });
    el("prevBtn").addEventListener("click", () => {
      state.offset = Math.max(0, state.offset - state.limit);
      load().catch((error) => setMessage(error.message, true));
    });
    el("nextBtn").addEventListener("click", () => {
      state.offset += state.limit;
      load().catch((error) => setMessage(error.message, true));
    });
    if (state.token) load().catch((error) => setMessage(error.message, true));
  </script>
</body>
</html>`;

const REFERRAL_CODES_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>XT Referral Codes</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --ink: #18201e;
      --muted: #69716d;
      --line: #d8d1c4;
      --panel: #fffdf8;
      --accent: #0f766e;
      --accent-2: #b45309;
      --danger: #b42318;
      --shadow: 0 18px 60px rgba(24, 32, 30, .10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Aptos", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        linear-gradient(135deg, rgba(15,118,110,.10), transparent 34%),
        radial-gradient(circle at 80% 0%, rgba(180,83,9,.12), transparent 32%),
        var(--bg);
    }
    button, input { font: inherit; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 28px; }
    header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 30px; line-height: 1.1; }
    .sub { margin: 8px 0 0; color: var(--muted); }
    .auth, .panel, .card { background: rgba(255,253,248,.88); border: 1px solid var(--line); box-shadow: var(--shadow); }
    .auth { padding: 12px; display: flex; gap: 8px; border-radius: 8px; min-width: min(520px, 100%); }
    input {
      width: 100%;
      border: 1px solid var(--line);
      background: #fffaf0;
      color: var(--ink);
      border-radius: 6px;
      padding: 10px 11px;
    }
    button {
      border: 0;
      border-radius: 6px;
      padding: 10px 13px;
      cursor: pointer;
      color: white;
      background: var(--accent);
      min-height: 40px;
      white-space: nowrap;
    }
    button.secondary { color: var(--ink); background: #e9e2d5; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .card { border-radius: 8px; padding: 16px; min-height: 112px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .value { margin-top: 10px; font-size: 26px; font-weight: 760; }
    .panel { border-radius: 8px; padding: 16px; margin-top: 16px; overflow: hidden; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .status { min-height: 24px; color: var(--muted); }
    .error { color: var(--danger); }
    .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e4f2ef; color: #115e59; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    @media (max-width: 880px) {
      header { display: block; }
      .auth { margin-top: 16px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .shell { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      .auth, .toolbar { display: grid; grid-template-columns: 1fr; }
      table { font-size: 13px; }
      th, td { padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>XT Referral Codes</h1>
        <p class="sub">Unique registration invite codes and user counts</p>
      </div>
      <form class="auth" id="authForm">
        <input id="tokenInput" type="password" autocomplete="current-password" placeholder="Admin token">
        <button type="submit">Unlock</button>
      </form>
    </header>

    <section class="grid">
      <div class="card"><div class="label">Unique Codes</div><div class="value" id="codeCount">-</div></div>
      <div class="card"><div class="label">Users With Codes</div><div class="value" id="userCount">-</div></div>
      <div class="card"><div class="label">Page Rows</div><div class="value" id="pageRows">-</div></div>
    </section>

    <section class="panel">
      <div class="toolbar">
        <div>
          <strong>Referral Codes</strong>
          <div class="status" id="message">Enter the admin token to load referral code data.</div>
        </div>
        <div class="toolbar">
          <a href="/" style="color: var(--accent); text-decoration: none; font-weight: 700;">Back to dashboard</a>
          <button id="refreshBtn" type="button">Refresh</button>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Code</th><th>Users</th></tr>
        </thead>
        <tbody id="codesBody">
          <tr><td colspan="2">No data loaded.</td></tr>
        </tbody>
      </table>
      <div class="toolbar" style="margin-top:12px">
        <button class="secondary" id="prevBtn" type="button">Previous</button>
        <span class="pill" id="pageInfo">Page 1</span>
        <button class="secondary" id="nextBtn" type="button">Next</button>
      </div>
    </section>
  </main>
  <script>
    const state = { token: sessionStorage.getItem("xtAdminToken") || "", offset: 0, limit: 25 };
    const el = (id) => document.getElementById(id);
    el("tokenInput").value = state.token;

    function headers() {
      return state.token ? { authorization: "Bearer " + state.token } : {};
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }
    function setMessage(text, error = false) {
      el("message").textContent = text;
      el("message").className = error ? "status error" : "status";
    }
    function fmt(value) {
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    }
    async function load() {
      setMessage("Loading...");
      const data = await api("/admin/referrals/codes?limit=" + state.limit + "&offset=" + state.offset);
      el("codeCount").textContent = fmt(data.totalCodes);
      el("userCount").textContent = String(data.codes.reduce((sum, row) => sum + row.users, 0));
      el("pageRows").textContent = String(data.codes.length);
      el("pageInfo").textContent = "Rows " + (state.offset + 1) + "-" + (state.offset + data.codes.length);
      el("codesBody").innerHTML = data.codes.length
        ? data.codes.map((row) => "<tr><td>" + row.code + "</td><td>" + row.users + "</td></tr>").join("")
        : '<tr><td colspan="2">No rows on this page.</td></tr>';
      setMessage("Referral code data loaded.");
    }
    el("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      state.token = el("tokenInput").value.trim();
      sessionStorage.setItem("xtAdminToken", state.token);
      state.offset = 0;
      try { await load(); } catch (error) { setMessage(error.message, true); }
    });
    el("refreshBtn").addEventListener("click", () => load().catch((error) => setMessage(error.message, true)));
    el("prevBtn").addEventListener("click", () => {
      state.offset = Math.max(0, state.offset - state.limit);
      load().catch((error) => setMessage(error.message, true));
    });
    el("nextBtn").addEventListener("click", () => {
      state.offset += state.limit;
      load().catch((error) => setMessage(error.message, true));
    });
    if (state.token) load().catch((error) => setMessage(error.message, true));
  </script>
</body>
</html>`;

const USER_TRADE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>XT User Trade Volume</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --ink: #18201e;
      --muted: #69716d;
      --line: #d8d1c4;
      --panel: #fffdf8;
      --accent: #0f766e;
      --accent-2: #b45309;
      --danger: #b42318;
      --zero: #94a3b8;
      --missing: #d8d1c4;
      --shadow: 0 18px 60px rgba(24, 32, 30, .10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Aptos", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        linear-gradient(135deg, rgba(15,118,110,.10), transparent 34%),
        radial-gradient(circle at 80% 0%, rgba(180,83,9,.12), transparent 32%),
        var(--bg);
    }
    button, input { font: inherit; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 28px; }
    header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 30px; line-height: 1.1; }
    .sub { margin: 8px 0 0; color: var(--muted); }
    .auth, .panel, .card { background: rgba(255,253,248,.88); border: 1px solid var(--line); box-shadow: var(--shadow); }
    .auth { padding: 12px; display: flex; gap: 8px; border-radius: 8px; min-width: min(520px, 100%); }
    input {
      width: 100%;
      border: 1px solid var(--line);
      background: #fffaf0;
      color: var(--ink);
      border-radius: 6px;
      padding: 10px 11px;
    }
    button {
      border: 0;
      border-radius: 6px;
      padding: 10px 13px;
      cursor: pointer;
      color: white;
      background: var(--accent);
      min-height: 40px;
      white-space: nowrap;
    }
    button.secondary { color: var(--ink); background: #e9e2d5; }
    button.active { background: var(--accent-2); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .card { border-radius: 8px; padding: 16px; min-height: 112px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .value { margin-top: 10px; font-size: 26px; font-weight: 760; }
    .panel { border-radius: 8px; padding: 16px; margin-top: 16px; overflow: hidden; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .status { min-height: 24px; color: var(--muted); }
    .error { color: var(--danger); }
    .legend { display: flex; gap: 14px; flex-wrap: wrap; color: var(--muted); font-size: 13px; }
    .legend span::before { content: ""; display: inline-block; width: 12px; height: 12px; margin-right: 6px; vertical-align: -1px; border-radius: 2px; }
    .legend .has::before { background: var(--accent); }
    .legend .zero::before { background: var(--zero); }
    .legend .missing::before { background: repeating-linear-gradient(45deg, transparent 0 3px, var(--missing) 3px 6px); border: 1px solid var(--missing); }
    .chart-wrap { overflow-x: auto; padding: 8px 0 2px; }
    .chart {
      min-height: 380px;
      display: flex;
      align-items: flex-end;
      gap: 3px;
      border-left: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 18px 10px 52px;
      position: relative;
    }
    .bar-slot {
      width: 18px;
      min-width: 18px;
      height: 280px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      position: relative;
    }
    .bar {
      width: 12px;
      min-height: 2px;
      border-radius: 3px 3px 0 0;
      background: var(--accent);
    }
    .bar.zero { background: var(--zero); height: 2px !important; }
    .bar.missing {
      background: repeating-linear-gradient(45deg, transparent 0 3px, var(--missing) 3px 6px);
      border: 1px solid var(--missing);
      height: 24px !important;
      opacity: .9;
    }
    .bar.partial { background: var(--accent-2); }
    .tick {
      position: absolute;
      left: 50%;
      bottom: -42px;
      transform: translateX(-50%) rotate(-42deg);
      transform-origin: center;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }
    @media (max-width: 880px) {
      header { display: block; }
      .auth { margin-top: 16px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .shell { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      .auth, .toolbar, .actions { display: grid; grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>UID __UID__</h1>
        <p class="sub"><a href="/" style="color: var(--accent); text-decoration: none; font-weight: 700;">Back to dashboard</a> - Daily trade volume history</p>
      </div>
      <form class="auth" id="authForm">
        <input id="tokenInput" type="password" autocomplete="current-password" placeholder="Admin token">
        <button type="submit">Unlock</button>
      </form>
    </header>

    <section class="grid">
      <div class="card"><div class="label">UID</div><div class="value" id="uidValue">__UID__</div></div>
      <div class="card"><div class="label">Range</div><div class="value" id="rangeValue">-</div></div>
      <div class="card"><div class="label">Total Volume</div><div class="value" id="totalValue">-</div></div>
      <div class="card"><div class="label">Missing Days</div><div class="value" id="missingValue">-</div></div>
    </section>

    <section class="panel">
      <div class="toolbar">
        <div>
          <strong>Trade Volume</strong>
          <div class="status" id="message">Enter the admin token to load user trade history.</div>
        </div>
        <div class="actions" id="grainButtons">
          <button type="button" data-grain="daily" class="active">Daily</button>
          <button type="button" data-grain="weekly">Weekly</button>
          <button type="button" data-grain="monthly">Monthly</button>
          <button type="button" data-grain="yearly">Yearly</button>
        </div>
      </div>
      <div class="legend">
        <span class="has">Volume</span>
        <span class="zero">Zero</span>
        <span class="missing">No data</span>
      </div>
      <div class="chart-wrap">
        <div class="chart" id="chart"></div>
      </div>
    </section>
  </main>
  <script>
    const uid = "__UID__";
    const state = { token: sessionStorage.getItem("xtAdminToken") || "", grain: "daily" };
    const el = (id) => document.getElementById(id);
    const amountFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    el("tokenInput").value = state.token;

    function headers() {
      return state.token ? { authorization: "Bearer " + state.token } : {};
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }
    function setMessage(text, error = false) {
      el("message").textContent = text;
      el("message").className = error ? "status error" : "status";
    }
    function fmtAmount(value) {
      return amountFormatter.format(Number(value || 0));
    }
    function tickLabel(point, grain) {
      if (grain === "daily") return point.period_start;
      if (point.period_start === point.period_end) return point.period_start;
      return point.period_start + " - " + point.period_end;
    }
    async function load() {
      setMessage("Loading...");
      const data = await api("/admin/users/" + encodeURIComponent(uid) + "/trade-history?grain=" + state.grain);
      const total = data.points.reduce((sum, point) => sum + point.amount, 0);
      const expected = data.points.reduce((sum, point) => sum + point.expected_days, 0);
      const present = data.points.reduce((sum, point) => sum + point.data_days, 0);
      el("rangeValue").textContent = data.startDate + " - " + data.endDate;
      el("totalValue").textContent = fmtAmount(total);
      el("missingValue").textContent = String(expected - present);
      renderChart(data.points, state.grain);
      setMessage("Trade history loaded.");
    }
    function renderChart(points, grain) {
      const maxAmount = Math.max(0, ...points.map((point) => point.amount));
      const width = Math.max(720, points.length * (grain === "daily" ? 21 : 36));
      el("chart").style.width = width + "px";
      el("chart").innerHTML = points.map((point, index) => {
        const height = maxAmount > 0 ? Math.max(2, Math.round((point.amount / maxAmount) * 280)) : 2;
        const isMissing = !point.has_data;
        const isZero = point.has_data && point.amount === 0;
        const isPartial = point.has_data && point.data_days < point.expected_days;
        const cls = isMissing ? "missing" : isZero ? "zero" : isPartial ? "partial" : "";
        const labelEvery = grain === "daily" ? Math.max(1, Math.ceil(points.length / 18)) : 1;
        const label = index % labelEvery === 0 ? '<div class="tick">' + tickLabel(point, grain) + '</div>' : "";
        const title = tickLabel(point, grain) + "\\n" + (isMissing ? "No data" : "Volume: " + fmtAmount(point.amount)) + "\\nData days: " + point.data_days + "/" + point.expected_days;
        return '<div class="bar-slot"><div class="bar ' + cls + '" style="height:' + height + 'px" title="' + title + '"></div>' + label + '</div>';
      }).join("");
    }
    el("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      state.token = el("tokenInput").value.trim();
      sessionStorage.setItem("xtAdminToken", state.token);
      try { await load(); } catch (error) { setMessage(error.message, true); }
    });
    for (const button of el("grainButtons").querySelectorAll("button")) {
      button.addEventListener("click", async () => {
        state.grain = button.dataset.grain;
        for (const candidate of el("grainButtons").querySelectorAll("button")) {
          candidate.classList.toggle("active", candidate === button);
        }
        try { await load(); } catch (error) { setMessage(error.message, true); }
      });
    }
    if (state.token) load().catch((error) => setMessage(error.message, true));
  </script>
</body>
</html>`;
