export function renderDashboard(): Response {
  return new Response(DASHBOARD_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
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
    .status { min-height: 24px; color: var(--muted); }
    .error { color: var(--danger); }
    .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e4f2ef; color: #115e59; font-size: 12px; }
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
        <p class="sub">Cloudflare D1 UID sync operations</p>
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
        </select>
        <span class="pill" id="pageInfo">Page 1</span>
      </div>
      <table>
        <thead>
          <tr><th>UID</th><th>Referral Code</th><th>Balance</th><th>30d Trade Volume</th></tr>
        </thead>
        <tbody id="usersBody">
          <tr><td colspan="4">No data loaded.</td></tr>
        </tbody>
      </table>
      <div class="toolbar" style="margin-top:12px">
        <button class="secondary" id="prevBtn" type="button">Previous</button>
        <button class="secondary" id="nextBtn" type="button">Next</button>
      </div>
    </section>
  </main>
  <script>
    const state = { token: sessionStorage.getItem("xtAdminToken") || "", offset: 0, limit: 25, sort: sessionStorage.getItem("xtUserSort") || "recent" };
    const el = (id) => document.getElementById(id);
    el("tokenInput").value = state.token;
    el("sortSelect").value = state.sort;

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
    const numberFormatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    function fmtAmount(value) {
      if (value === null || value === undefined || value === "") return "-";
      const number = typeof value === "number" ? value : Number(value);
      return Number.isFinite(number) ? numberFormatter.format(number) : "-";
    }
    async function load() {
      setMessage("Loading...");
      const [sync, users] = await Promise.all([
        api("/admin/sync/uid"),
        api("/admin/users?limit=" + state.limit + "&offset=" + state.offset + "&sort=" + state.sort)
      ]);
      el("userCount").textContent = fmt(sync.userCount);
      el("latestRun").textContent = fmt(sync.latestRun?.status);
      el("syncState").textContent = fmt(sync.state?.status);
      el("nextCursor").textContent = fmt(sync.state?.next_cursor);
      el("balanceRows").textContent = String(users.users.filter((user) => user.balance !== null && user.balance !== undefined).length);
      el("pageInfo").textContent = "Rows " + (state.offset + 1) + "-" + (state.offset + users.users.length);
      el("usersBody").innerHTML = users.users.length
        ? users.users.map((user) => "<tr><td>" + user.uid + "</td><td>" + fmt(user.register_invite_code) + "</td><td>" + fmtAmount(user.balance) + "</td><td>" + fmtAmount(user.trade_30d_amount) + "</td></tr>").join("")
        : '<tr><td colspan="4">No rows on this page.</td></tr>';
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
      setMessage("Syncing a bounded referral-code chunk...");
      try {
        await api("/admin/referrals/sync?limit=25", { method: "POST" });
        state.offset = 0;
        await load();
      } catch (error) { setMessage(error.message, true); }
    });
    el("sortSelect").addEventListener("change", async () => {
      state.sort = el("sortSelect").value;
      sessionStorage.setItem("xtUserSort", state.sort);
      state.offset = 0;
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
