const state = {
  connected: false,
  demo: false,
  address: "",
  hasDeposit: false,
  balance: 0,
  risk: "Balanced",
  protectedPercent: 64,
  decisions: [
    { title: "Rebalanced to protected reserve", detail: "Volatility moved above the balanced-policy threshold.", time: "Today · 09:42", tx: "0x8f92…29c1" },
    { title: "Position evaluated", detail: "No action required. Exposure remained inside guardrails.", time: "Yesterday · 18:10", tx: "0x11a4…0f8e" },
    { title: "Risk profile updated", detail: "Balanced policy selected by wallet owner.", time: "Aug 06 · 12:28", tx: "0x22c1…af43" }
  ],
  activity: [
    { icon: "↗", title: "AI rebalance confirmed", detail: "Protected reserve +12% · 0x8f92…29c1", time: "Today · 09:42" },
    { icon: "+", title: "Deposit received", detail: "2,500 USDT · 0x1be0…a204", time: "Aug 06 · 12:26" },
    { icon: "◌", title: "Risk profile set", detail: "Balanced policy", time: "Aug 06 · 12:28" }
  ]
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function showToast(message) {
  const region = $("#toastRegion");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function setView(view) {
  const isApp = view === "app";
  $("#landingView").hidden = isApp;
  $("#siteFooter").hidden = isApp;
  $("#appView").hidden = !isApp;
  document.body.classList.toggle("is-app", isApp);
  if (!isApp) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(initAnimations, 100);
  } else {
    window.scrollTo({ top: 0, behavior: "instant" });
    updateDashboard();
  }
}

function openModal(content) {
  $("#modalContent").innerHTML = content;
  $("#modalBackdrop").hidden = false;
  document.body.classList.add("is-modal-open");
  window.setTimeout(() => $("#modalBackdrop .modal button, #modalBackdrop input")?.focus(), 30);
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
  $("#modalContent").innerHTML = "";
  document.body.classList.remove("is-modal-open");
}

function connectModal() {
  openModal(`
    <span class="eyebrow">Wallet connection</span>
    <h2 id="modalTitle">Enter Gren.</h2>
    <p>Connect an EVM wallet to view your vault. Gren never takes custody of your funds.</p>
    <div class="wallet-options">
      <button class="wallet-option" type="button" data-wallet="MetaMask"><span><i class="wallet-icon">M</i> MetaMask</span><small>Popular</small></button>
      <button class="wallet-option" type="button" data-wallet="BO Wallet"><span><i class="wallet-icon">B</i> BO Wallet</span><small>BOT Chain</small></button>
      <button class="wallet-option" type="button" data-wallet="WalletConnect"><span><i class="wallet-icon">W</i> WalletConnect</span><small>QR or mobile</small></button>
    </div>
    <p class="modal-note">Demo mode is available without a wallet.</p>
  `);
}

function connectWallet(wallet) {
  state.connected = true;
  state.demo = false;
  state.address = wallet === "BO Wallet" ? "0x7a4e…18c2" : "0x91b3…4f0a";
  closeModal();
  setView("app");
  showToast(`${wallet} connected. Switch to BOT Chain 677 when ready.`);
  updateWalletChip();
}

function demoModal() {
  state.connected = true;
  state.demo = true;
  state.hasDeposit = true;
  state.address = "Demo wallet · 0x91b3…4f0a";
  state.balance = 12486.2;
  setView("app");
  showToast("Demo vault loaded. Explore the complete operating loop.");
}

function depositModal() {
  if (!state.connected) {
    connectModal();
    return;
  }
  openModal(`
    <span class="eyebrow">Fund your vault</span>
    <h2 id="modalTitle">Make a deposit.</h2>
    <p>Choose an approved asset. Your deposit receives vault shares and activates Gren’s policy engine.</p>
    <form class="form-stack" id="depositForm">
      <div class="field"><label for="depositAsset">Asset</label><select id="depositAsset"><option value="USDT">USDT</option><option value="WBOT">WBOT</option></select></div>
      <div class="field"><label for="depositAmount">Amount</label><input id="depositAmount" type="number" inputmode="decimal" min="1" step="0.01" placeholder="2,500.00" required /></div>
      <button class="pill-button pill-button--dark full-button" type="submit">Approve asset <span>→</span></button>
    </form>
    <p class="modal-note">Transactions are simulated in this product demo.</p>
  `);
}

function submitDeposit(event) {
  event.preventDefault();
  const amount = Number($("#depositAmount")?.value || 0);
  const asset = $("#depositAsset")?.value || "USDT";
  if (!amount || amount <= 0) {
    showToast("Enter a deposit amount to continue.");
    return;
  }
  const button = $("#depositForm button");
  button.disabled = true;
  button.textContent = "Approving…";
  window.setTimeout(() => {
    button.textContent = `Deposit ${amount.toLocaleString()} ${asset} →`;
    button.disabled = false;
    button.dataset.confirmDeposit = "true";
  }, 650);
}

function confirmDeposit(event) {
  const button = event.target.closest("button[data-confirm-deposit]");
  if (!button) return;
  const amount = Number($("#depositAmount")?.value || 0);
  const asset = $("#depositAsset")?.value || "USDT";
  state.hasDeposit = true;
  state.balance += amount;
  state.activity.unshift({ icon: "+", title: "Deposit received", detail: `${amount.toLocaleString()} ${asset} · Demo transaction`, time: "Just now" });
  closeModal();
  updateDashboard();
  showToast(`Deposit successful. Gren is now managing your portfolio.`);
}

function withdrawModal() {
  if (!state.hasDeposit) {
    showToast("Make a deposit before withdrawing.");
    return;
  }
  openModal(`
    <span class="eyebrow">Keep control</span>
    <h2 id="modalTitle">Withdraw funds.</h2>
    <p>Redeem vault shares back to your connected wallet at any time.</p>
    <form class="form-stack" id="withdrawForm">
      <div class="field"><label for="withdrawAmount">Amount <small>(available ${money(state.balance)})</small></label><input id="withdrawAmount" type="number" inputmode="decimal" min="1" max="${state.balance}" step="0.01" placeholder="${state.balance.toFixed(2)}" required /></div>
      <button class="pill-button pill-button--dark full-button" type="submit">Review withdrawal <span>→</span></button>
    </form>
    <p class="modal-note">Transactions are simulated in this product demo.</p>
  `);
}

function submitWithdraw(event) {
  event.preventDefault();
  const amount = Number($("#withdrawAmount")?.value || 0);
  if (!amount || amount <= 0 || amount > state.balance) {
    showToast("Enter an amount within the available balance.");
    return;
  }
  const button = $("#withdrawForm button");
  button.textContent = "Confirm withdrawal →";
  button.dataset.confirmWithdraw = String(amount);
}

function confirmWithdraw(event) {
  const button = event.target.closest("button[data-confirm-withdraw]");
  if (!button) return;
  const amount = Number(button.dataset.confirmWithdraw);
  state.balance = Math.max(0, state.balance - amount);
  state.hasDeposit = state.balance > 0;
  state.activity.unshift({ icon: "↗", title: "Withdrawal completed", detail: `${amount.toLocaleString()} USDT · Demo transaction`, time: "Just now" });
  closeModal();
  updateDashboard();
  showToast("Withdrawal complete. Your funds are back in your wallet.");
}

function runAgent() {
  if (!state.hasDeposit) {
    showToast("Fund the vault before running an evaluation.");
    return;
  }
  const buttons = $$('[data-action="run-agent"]');
  buttons.forEach((button) => { button.disabled = true; button.textContent = "Evaluating…"; });
  window.setTimeout(() => {
    const shift = state.risk === "Conservative" ? 8 : state.risk === "Aggressive" ? -8 : 4;
    state.protectedPercent = Math.max(40, Math.min(78, state.protectedPercent + shift));
    const direction = shift > 0 ? "protected reserve" : "BDEX liquidity";
    state.decisions.unshift({ title: `Rebalanced toward ${direction}`, detail: `${state.risk} policy stayed within its exposure guardrails.`, time: "Just now", tx: "0x34b2…7d90" });
    state.activity.unshift({ icon: "↗", title: "AI evaluation executed", detail: `Allocation updated · ${state.protectedPercent}% protected`, time: "Just now" });
    buttons.forEach((button) => { button.disabled = false; button.textContent = button.classList.contains("pill-button") ? "Run evaluation" : "Run evaluation"; });
    updateDashboard();
    showToast("AI decision executed and added to the public log.");
  }, 1200);
}

function selectRisk(risk) {
  if (!state.hasDeposit) {
    showToast("Deposit first to set a vault risk profile.");
    return;
  }
  state.risk = risk;
  const profile = {
    Conservative: { maxDex: "25%", slippage: "0.5%", description: "Prioritizes withdrawal liquidity and keeps market exposure deliberately low." },
    Balanced: { maxDex: "45%", slippage: "0.8%", description: "Targets measured growth while preserving withdrawal liquidity during elevated volatility." },
    Aggressive: { maxDex: "70%", slippage: "1.2%", description: "Allows greater market exposure while staying inside contract-enforced limits." }
  }[risk];
  $$("[data-risk]").forEach((button) => button.classList.toggle("is-active", button.dataset.risk === risk));
  $("#maxDex").textContent = profile.maxDex;
  $("#maxSlippage").textContent = profile.slippage;
  $(".risk-copy span").textContent = `${risk} policy`;
  $(".risk-copy p").textContent = profile.description;
  $("#riskSaved").textContent = "Saved";
  state.decisions.unshift({ title: `Risk profile set to ${risk}`, detail: `New guardrails will apply to future agent evaluations.`, time: "Just now", tx: "0x9c31…a02b" });
  updateDecisionViews();
  showToast(`${risk} policy saved to your vault.`);
}

function updateWalletChip() {
  const chip = $("#walletChip");
  chip.classList.toggle("is-connected", state.connected);
  chip.querySelector("span").textContent = state.connected ? state.address : "Connect wallet";
}

function updateDashboard() {
  updateWalletChip();
  $("#emptyState").hidden = state.hasDeposit;
  $("#dashboard").hidden = !state.hasDeposit;
  if (!state.hasDeposit) return;
  const protectedValue = state.balance * (state.protectedPercent / 100);
  $("#portfolioValue").textContent = money(state.balance);
  $("#protectedPercent").textContent = `${state.protectedPercent}%`;
  $("#protectedValue").textContent = money(protectedValue);
  $("#dexValue").textContent = money(state.balance - protectedValue);
  $("#strategyProtected").textContent = `${state.protectedPercent}%`;
  $("#strategyDex").textContent = `${100 - state.protectedPercent}%`;
  updateDecisionViews();
  updateActivityView();
}

function decisionRow(decision, table = false) {
  return `<div class="decision-row"><i></i><div><strong>${decision.title}</strong><small>${decision.detail}</small></div>${table ? `<span>${decision.tx}</span>` : ""}<time>${decision.time}</time></div>`;
}

function updateDecisionViews() {
  $("#overviewDecisionList").innerHTML = state.decisions.slice(0, 3).map((decision) => decisionRow(decision)).join("");
  $("#decisionTable").innerHTML = state.decisions.map((decision) => decisionRow(decision, true)).join("");
  $("#decisionCount").textContent = String(Math.min(state.decisions.length, 9));
}

function updateActivityView() {
  $("#activityList").innerHTML = state.activity.map((item) => `<div class="activity-item"><span class="activity-icon">${item.icon}</span><div><strong>${item.title}</strong><small>${item.detail}</small></div><time>${item.time}</time></div>`).join("");
}

function switchAppTab(tab) {
  $$('[data-app-tab]').forEach((button) => button.classList.toggle("is-active", button.dataset.appTab === tab));
  $$('[data-app-panel]').forEach((panel) => panel.classList.toggle("is-active", panel.dataset.appPanel === tab));
  $("#appSectionTitle").textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initAnimations() {
  if (!window.gsap || !window.ScrollTrigger || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.body.classList.remove("has-gsap");
    return;
  }
  document.body.classList.add("has-gsap");
  gsap.registerPlugin(ScrollTrigger);
  gsap.killTweensOf("[data-reveal]");
  gsap.utils.toArray("[data-reveal]").forEach((element, index) => {
    gsap.to(element, { opacity: 1, y: 0, duration: .9, delay: index % 3 * .08, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 88%", once: true } });
  });
  gsap.fromTo(".hero-content", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.15, ease: "power3.out", delay: .12 });
  gsap.fromTo(".artifact", { opacity: 0, scale: .82 }, { opacity: 1, scale: 1, duration: 1, stagger: .1, ease: "power3.out", delay: .25 });
  gsap.utils.toArray("[data-parallax]").forEach((artifact) => gsap.to(artifact, { y: Number(artifact.dataset.parallax), ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } }));
  const story = document.querySelector(".story");
  if (story) {
    ScrollTrigger.create({ trigger: story, start: "top top", end: "bottom bottom", scrub: true, onUpdate: (self) => setStoryScene(Math.min(2, Math.floor(self.progress * 3))) });
  }
  ScrollTrigger.create({ trigger: ".architecture", start: "top 65%", end: "bottom 35%", onEnter: () => $("#siteHeader").classList.add("is-dark"), onLeaveBack: () => $("#siteHeader").classList.remove("is-dark"), onLeave: () => $("#siteHeader").classList.remove("is-dark"), onEnterBack: () => $("#siteHeader").classList.add("is-dark") });
  gsap.fromTo(".flow-line", { strokeDashoffset: 220 }, { strokeDashoffset: 0, stagger: .2, duration: 1.8, ease: "none", scrollTrigger: { trigger: ".architecture-diagram", start: "top 80%", end: "bottom 50%", scrub: true } });
}

function setStoryScene(index) {
  $$('[data-story-scene]').forEach((scene) => scene.classList.toggle("is-active", Number(scene.dataset.storyScene) === index));
  $$('[data-stage-panel]').forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.stagePanel) === index));
  $$(".story-progress i").forEach((progress, i) => progress.classList.toggle("is-active", i === index));
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "connect") connectModal();
  if (action === "view-demo") demoModal();
  if (action === "home") { setView("landing"); document.body.classList.remove("is-app"); }
  if (action === "deposit") depositModal();
  if (action === "withdraw") withdrawModal();
  if (action === "run-agent") runAgent();
  if (action === "close-modal") closeModal();
  const wallet = event.target.closest("[data-wallet]")?.dataset.wallet;
  if (wallet) connectWallet(wallet);
  const risk = event.target.closest("[data-risk]")?.dataset.risk;
  if (risk) selectRisk(risk);
  const appTab = event.target.closest("[data-app-tab]")?.dataset.appTab;
  if (appTab) switchAppTab(appTab);
  confirmDeposit(event);
  confirmWithdraw(event);
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "depositForm") submitDeposit(event);
  if (event.target.id === "withdrawForm") submitWithdraw(event);
});

$("#modalBackdrop").addEventListener("click", (event) => { if (event.target.id === "modalBackdrop") closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal(); });

updateDecisionViews();
updateActivityView();
initAnimations();
