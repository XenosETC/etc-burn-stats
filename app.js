const API_BASE = "https://etc.blockscout.com/api/v2";
const DEAD_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);
const STORAGE_KEY = "etc-burn-stats-projects";

const defaultProjects = [
  {
    name: "PUPU",
    label: "PepeCoinClassic",
    token: "0x0bD01d2C68f89AbeD94BC85988fa8A6e18EFb2db",
    lp: "0x9f1a8fC0ef058F3001c1628D8130d1C5301201C9",
    icon: "https://pupu-etc-premium-redesign.onrender.com/assets/logo.png",
  },
  {
    name: "PEPE",
    label: "PepeCoin Classic",
    token: "0xBa991144fFDbe47936703606A6e74194Db0DA8Aa",
    lp: "0xCFe10aa566F8238D6509A7F3abBF9bDeE2DDE6dA",
  },
  {
    name: "SHIBC",
    label: "Shiba Classic",
    token: "0x1FDc495289B590e78d455cf7faa6cd804de5Cbc1",
    lp: "0xcCD8dc89EE29D65802f36D75E458CA6F6b18493C",
  },
];

const els = {
  avgBurned: document.querySelector("#avgBurned"),
  bestSignal: document.querySelector("#bestSignal"),
  etcTotalBurned: document.querySelector("#etcTotalBurned"),
  form: document.querySelector("#projectForm"),
  formMessage: document.querySelector("#formMessage"),
  grid: document.querySelector("#projectGrid"),
  heroTopBurn: document.querySelector("#heroTopBurn"),
  heroTokenBurn: document.querySelector("#heroTokenBurn"),
  lastRefresh: document.querySelector("#lastRefresh"),
  refresh: document.querySelector("#refreshBtn"),
  reset: document.querySelector("#resetProjectsBtn"),
  search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortSelect"),
  strongOnly: document.querySelector("#strongOnlyInput"),
  table: document.querySelector("#projectTable"),
  template: document.querySelector("#projectTemplate"),
  totalBurned: document.querySelector("#totalBurned"),
  tracked: document.querySelector("#trackedProjects"),
};

let projects = loadProjects();
let liveStats = [];
let latestRefreshId = 0;

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const clean = saved.filter((project) => project.name && isAddress(project.token) && isAddress(project.lp));
    return mergeProjects(defaultProjects, clean);
  } catch {
    return defaultProjects;
  }
}

function mergeProjects(base, extras) {
  const seen = new Set();
  return [...base, ...extras].filter((project) => {
    const key = project.lp.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function saveProjects() {
  const custom = projects.filter((project) => !isDefaultProject(project));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

function isDefaultProject(project) {
  return defaultProjects.some((item) => item.lp.toLowerCase() === project.lp.toLowerCase());
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "");
}

async function fetchJson(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Blockscout returned ${response.status}`);
  return response.json();
}

async function fetchBurnBalanceMap() {
  const balances = new Map();
  const burnWallets = [...DEAD_ADDRESSES];

  const responses = await Promise.all(
    burnWallets.map((address) => fetchJson(`/addresses/${address}/token-balances`)),
  );

  responses.flat().forEach((row) => {
    const token = row.token?.address_hash?.toLowerCase();
    if (!token) return;
    balances.set(token, (balances.get(token) || 0n) + BigInt(row.value || "0"));
  });

  return balances;
}

async function readProject(project, burnBalances) {
  const [tokenInfo, lpInfo] = await Promise.all([
    fetchJson(`/tokens/${project.token}`),
    fetchJson(`/tokens/${project.lp}`),
  ]);

  const lpSupply = BigInt(lpInfo.total_supply || "0");
  const burned = burnBalances.get(project.lp.toLowerCase()) || 0n;
  const burnedPercent = lpSupply > 0n ? Number((burned * 1000000n) / lpSupply) / 10000 : 0;
  const tokenSupply = BigInt(tokenInfo.total_supply || "0");
  const tokenBurned = burnBalances.get(project.token.toLowerCase()) || 0n;
  const tokenBurnedPercent = tokenSupply > 0n ? Number((tokenBurned * 1000000n) / tokenSupply) / 10000 : 0;

  return {
    ...project,
    burned,
    burnedPercent,
    holders: Number(tokenInfo.holders_count || "0"),
    lpHolders: Number(lpInfo.holders_count || "0"),
    lpSupply,
    lpSymbol: lpInfo.symbol || "LP",
    tokenBurned,
    tokenBurnedPercent,
    tokenDecimals: Number(tokenInfo.decimals || 18),
    tokenSupply,
    symbol: tokenInfo.symbol || project.name,
    tokenName: tokenInfo.name || project.label || project.name,
    icon: tokenInfo.icon_url || project.icon || "",
    decimals: Number(lpInfo.decimals || 18),
    custom: !isDefaultProject(project),
  };
}

async function refresh() {
  const refreshId = (latestRefreshId += 1);
  setFormMessage("");
  els.refresh.disabled = true;
  renderLoading();

  const burnBalances = await fetchBurnBalanceMap();
  const results = await Promise.allSettled(projects.map((project) => readProject(project, burnBalances)));
  if (refreshId !== latestRefreshId) return;

  liveStats = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      ...projects[index],
      custom: !isDefaultProject(projects[index]),
      error: result.reason?.message || "Unable to load stats",
    };
  });

  render();
  els.refresh.disabled = false;
}

function renderLoading() {
  els.tracked.textContent = String(projects.length);
  els.etcTotalBurned.textContent = "Loading";
  els.avgBurned.textContent = "Loading";
  els.bestSignal.textContent = "Loading";
  els.heroTokenBurn.textContent = "Loading";
  els.totalBurned.textContent = "Loading";
  els.lastRefresh.textContent = "Loading";
  els.grid.innerHTML = projects
    .map(
      (project) => `
        <article class="project-card skeleton-card">
          <div class="card-head">
            <div>
              <p class="project-symbol">${escapeHtml(project.name)}</p>
              <h3>${escapeHtml(project.label || "Loading on-chain stats")}</h3>
              <p class="pair-label">Fetching Blockscout receipts</p>
            </div>
            <span class="status-pill">Loading</span>
          </div>
          <div class="burn-ring"><span class="burn-percent">--</span><span>dead LP</span></div>
        </article>
      `,
    )
    .join("");
  els.table.innerHTML = `<tr><td colspan="7">Loading project receipts...</td></tr>`;
}

function render() {
  const visible = getVisibleStats();
  els.tracked.textContent = String(projects.length);
  renderSummary(liveStats);
  renderCards(visible);
  renderTable(visible);
}

function getVisibleStats() {
  const query = els.search.value.trim().toLowerCase();
  const strongOnly = els.strongOnly.checked;
  const filtered = liveStats.filter((item) => {
    if (item.error) return true;
    const haystack = [item.name, item.label, item.symbol, item.tokenName, item.token, item.lp].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesStrength = !strongOnly || item.burnedPercent >= 70;
    return matchesQuery && matchesStrength;
  });

  return filtered.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    if (els.sort.value === "burn-asc") return (a.burnedPercent || 0) - (b.burnedPercent || 0);
    if (els.sort.value === "holders-desc") return (b.holders || 0) - (a.holders || 0);
    if (els.sort.value === "name-asc") return String(a.symbol || a.name).localeCompare(String(b.symbol || b.name));
    return (b.burnedPercent || 0) - (a.burnedPercent || 0);
  });
}

function renderSummary(stats) {
  const goodStats = stats.filter((item) => !item.error);
  if (!goodStats.length) {
    els.avgBurned.textContent = "Offline";
    els.bestSignal.textContent = "No data";
    els.etcTotalBurned.textContent = "No data";
    els.heroTopBurn.textContent = "No data";
    els.heroTokenBurn.textContent = "No data";
    els.totalBurned.textContent = "0 / 0";
    els.lastRefresh.textContent = "Failed";
    return;
  }

  const avg = goodStats.reduce((total, item) => total + item.burnedPercent, 0) / goodStats.length;
  const best = goodStats.reduce((winner, item) => (item.burnedPercent > winner.burnedPercent ? item : winner), goodStats[0]);
  const strong = goodStats.filter((item) => item.burnedPercent >= 70).length;
  const totalTokenSupply = goodStats.reduce((total, item) => total + item.tokenSupply, 0n);
  const totalTokenBurned = goodStats.reduce((total, item) => total + item.tokenBurned, 0n);
  const totalTokenBurnedPercent =
    totalTokenSupply > 0n ? Number((totalTokenBurned * 1000000n) / totalTokenSupply) / 10000 : 0;

  els.etcTotalBurned.textContent = `${formatPercent(totalTokenBurnedPercent)}%`;
  els.avgBurned.textContent = `${formatPercent(avg)}%`;
  els.bestSignal.textContent = `${best.symbol} ${formatPercent(best.burnedPercent)}%`;
  els.heroTopBurn.textContent = `${best.symbol} ${formatPercent(best.burnedPercent)}%`;
  els.heroTokenBurn.textContent = `${formatPercent(totalTokenBurnedPercent)}%`;
  els.totalBurned.textContent = `${strong} / ${goodStats.length}`;
  els.lastRefresh.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function renderCards(stats) {
  els.grid.innerHTML = "";

  if (!stats.length) {
    els.grid.innerHTML = `<p class="empty-state">No tracked projects match the current filters.</p>`;
    return;
  }

  stats.forEach((statsItem) => {
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".project-card");
    hydrateCard(card, statsItem);
    els.grid.appendChild(fragment);
  });
}

function hydrateCard(card, stats) {
  card.dataset.lp = stats.lp;
  const image = card.querySelector(".token-image");
  const fallback = card.querySelector(".token-fallback");
  fallback.textContent = (stats.symbol || stats.name || "?").slice(0, 4).toUpperCase();
  if (stats.icon) {
    image.src = stats.icon;
    image.alt = `${stats.symbol || stats.name} token image`;
    image.hidden = false;
    fallback.hidden = true;
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
    });
  } else {
    image.hidden = true;
    fallback.hidden = false;
  }
  card.querySelector(".project-symbol").textContent = stats.symbol || stats.name;
  card.querySelector("h3").textContent = stats.tokenName || stats.label || stats.name;
  card.querySelector(".pair-label").textContent = `${shortAddress(stats.token)} / ${shortAddress(stats.lp)}`;
  card.querySelector(".token-address").textContent = shortAddress(stats.token);
  card.querySelector(".lp-address").textContent = shortAddress(stats.lp);

  const tokenLink = card.querySelector(".token-link");
  const lpLink = card.querySelector(".lp-link");
  const holdersLink = card.querySelector(".holders-link");
  tokenLink.href = blockscoutToken(stats.token);
  lpLink.href = blockscoutToken(stats.lp);
  holdersLink.href = `${blockscoutToken(stats.lp)}?tab=holders`;
  tokenLink.setAttribute("aria-label", `Open ${stats.name} token on Blockscout in a new tab`);
  lpLink.setAttribute("aria-label", `Open ${stats.name} LP token on Blockscout in a new tab`);
  holdersLink.setAttribute("aria-label", `Open ${stats.name} LP holders on Blockscout in a new tab`);

  card.querySelector(".copy-token").addEventListener("click", () => copyAddress(stats.token, card.querySelector(".copy-token")));
  card.querySelector(".copy-lp").addEventListener("click", () => copyAddress(stats.lp, card.querySelector(".copy-lp")));

  if (stats.custom) {
    const removeButton = document.createElement("button");
    removeButton.className = "mini-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeProject(stats.lp));
    card.querySelector(".card-links").appendChild(removeButton);
  }

  if (stats.error) {
    showError(card, stats.error);
    return;
  }

  const angle = Math.max(0, Math.min(360, stats.burnedPercent * 3.6));
  const status = burnStatus(stats.burnedPercent);
  card.style.setProperty("--burn-angle", `${angle}deg`);
  card.querySelector(".burn-ring").setAttribute("aria-label", `Dead LP percentage: ${formatPercent(stats.burnedPercent)}%`);
  card.querySelector(".burn-percent").textContent = `${formatPercent(stats.burnedPercent)}%`;
  card.querySelector(".burned-amount").textContent = `${formatToken(stats.burned, stats.decimals)} ${stats.lpSymbol}`;
  card.querySelector(".lp-supply").textContent = `${formatToken(stats.lpSupply, stats.decimals)} ${stats.lpSymbol}`;
  card.querySelector(".token-burned").textContent = `${formatToken(stats.tokenBurned, stats.tokenDecimals)} ${stats.symbol}`;
  card.querySelector(".token-burn-percent").textContent = `${formatPercent(stats.tokenBurnedPercent)}%`;
  card.querySelector(".holders").textContent = formatNumber(stats.holders);
  card.querySelector(".lp-holders").textContent = formatNumber(stats.lpHolders);
  card.querySelector(".status-pill").textContent = status.label;
  card.querySelector(".status-pill").classList.add(status.className);
  card.querySelector(".card-error").textContent = "";
}

function renderTable(stats) {
  if (!stats.length) {
    els.table.innerHTML = `<tr><td colspan="7">No rows match the current filters.</td></tr>`;
    return;
  }

  els.table.innerHTML = stats
    .map((item) => {
      if (item.error) {
        return `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td colspan="5">${escapeHtml(item.error)}</td>
            <td><a href="${blockscoutToken(item.lp)}" target="_blank" rel="noreferrer">LP</a></td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>
            <div class="table-project">
              ${renderTokenImage(item)}
              <div><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.tokenName)}</span></div>
            </div>
          </td>
          <td>${formatPercent(item.burnedPercent)}%</td>
          <td>${formatToken(item.tokenBurned, item.tokenDecimals)} ${escapeHtml(item.symbol)}</td>
          <td>${formatPercent(item.tokenBurnedPercent)}%</td>
          <td>${formatNumber(item.holders)}</td>
          <td>${formatNumber(item.lpHolders)}</td>
          <td>
            <a href="${blockscoutToken(item.token)}" target="_blank" rel="noreferrer">Token</a>
            <a href="${blockscoutToken(item.lp)}?tab=holders" target="_blank" rel="noreferrer">Holders</a>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderTokenImage(item) {
  if (!item.icon) {
    return `<span class="table-avatar">${escapeHtml(String(item.symbol || item.name || "?").slice(0, 4).toUpperCase())}</span>`;
  }

  return `<img class="table-avatar" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.symbol || item.name)} token image" loading="lazy" />`;
}

function showError(card, message) {
  const pill = card.querySelector(".status-pill");
  pill.textContent = "Error";
  pill.classList.add("danger");
  card.querySelector(".burn-percent").textContent = "--";
  card.querySelector(".card-error").textContent = message;
}

async function copyAddress(address, button) {
  try {
    await navigator.clipboard.writeText(address);
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1400);
  } catch {
    setFormMessage(`Copy failed. Address: ${address}`, "error");
  }
}

function removeProject(lpAddress) {
  projects = projects.filter((project) => project.lp.toLowerCase() !== lpAddress.toLowerCase() || isDefaultProject(project));
  saveProjects();
  refresh();
}

function burnStatus(percent) {
  if (percent >= 95) return { label: "Deep burn", className: "strong" };
  if (percent >= 70) return { label: "Strong", className: "strong" };
  if (percent >= 40) return { label: "Watch", className: "watch" };
  return { label: "Thin", className: "danger" };
}

function setFormMessage(message, type = "ok") {
  els.formMessage.textContent = message;
  els.formMessage.dataset.type = type;
}

function formatPercent(value) {
  if (value >= 99.995) return "100";
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value || 0);
}

function formatToken(value, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, 3).replace(/0+$/, "");
  const wholeText = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    notation: whole > 999999n ? "compact" : "standard",
  }).format(Number(whole));
  return fractionText && whole < 1000000n ? `${wholeText}.${fractionText}` : wholeText;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function blockscoutToken(address) {
  return `https://etc.blockscout.com/token/${address}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.refresh.addEventListener("click", refresh);
els.search.addEventListener("input", render);
els.sort.addEventListener("change", render);
els.strongOnly.addEventListener("change", render);

els.reset.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  projects = [...defaultProjects];
  setFormMessage("Saved projects reset. Defaults are still tracked.");
  refresh();
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.form);
  const project = {
    name: String(form.get("name")).trim(),
    token: String(form.get("token")).trim(),
    lp: String(form.get("lp")).trim(),
  };

  if (!project.name || !isAddress(project.token) || !isAddress(project.lp)) {
    setFormMessage("Enter a name plus valid ETC token and LP contracts.", "error");
    return;
  }

  const duplicate = projects.some((item) => item.lp.toLowerCase() === project.lp.toLowerCase());
  if (duplicate) {
    setFormMessage("That LP is already tracked.", "error");
    return;
  }

  projects = mergeProjects(projects, [project]);
  saveProjects();
  els.form.reset();
  setFormMessage(`${project.name} added. Fetching live burn stats...`);
  await refresh();
});

refresh();
