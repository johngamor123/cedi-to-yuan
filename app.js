
"use strict";

// BUSINESS SETTINGS — CHANGE THESE TO YOUR ACTUAL RATES
const WHATSAPP_NUMBER = "233247583711";
const BUSINESS_NAME = "Cedi to Yuan";
const BUY_RATE_CNY_PER_GHS = 0.55;
const SELL_RATE_GHS_PER_CNY = 3.00;

/** @typedef {"buy" | "sell"} Direction */
/** @typedef {"CNY" | "GHS"} Currency */

let currentDirection = /** @type {Direction} */ ("buy");
let previousOrderScreen = "buyScreen";
let toastTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

/** @param {string} id @returns {HTMLElement} */
function $(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing HTML element: " + id);
  return element;
}

/** @param {number} amount @param {Currency} currency @returns {string} */
function formatMoney(amount, currency) {
  if (!Number.isFinite(amount)) return "—";
  const formatted = amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return currency === "CNY" ? "¥" + formatted : "GH₵" + formatted;
}

/** @param {Direction} direction @returns {number} */
function getRate(direction) {
  return direction === "buy"
    ? BUY_RATE_CNY_PER_GHS
    : SELL_RATE_GHS_PER_CNY;
}

/** @param {string} message */
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;

  if (toastTimer !== null) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toastTimer = null;
  }, 3200);
}

/** @param {string} screenId */
function showScreen(screenId) {
  const target = $(screenId);
  if (!target.classList.contains("screen")) return;

  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  document.querySelectorAll(".nav-button").forEach(button => {
    const active = button.getAttribute("data-screen") === screenId;
    button.classList.toggle("active", active);

    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  window.scrollTo({ top: 0, behavior: "auto" });
}

/** @param {string} message */
function openWhatsApp(message) {
  const url = "https://wa.me/" + WHATSAPP_NUMBER +
    "?text=" + encodeURIComponent(message);
  window.location.href = url;
}

function openSupportWhatsApp() {
  openWhatsApp(
    "Hello " + BUSINESS_NAME +
    ", I have a question about buying or selling Chinese yuan. " +
    "Please confirm the applicable rate and availability."
  );
}

function updateHomeRates() {
  $("homeBuyRate").textContent =
    "¥" + BUY_RATE_CNY_PER_GHS.toFixed(2) + " / GH₵1";

  $("homeSellRate").textContent =
    "GH₵" + SELL_RATE_GHS_PER_CNY.toFixed(2) + " / ¥1";

  $("homeRateDetails").textContent =
    "Buy yuan: GH₵100 = " +
    formatMoney(100 * BUY_RATE_CNY_PER_GHS, "CNY") +
    " at the displayed rate.";
}

function updateScreenRates() {
  $("buyScreenRate").textContent =
    "GH₵1 = " + formatMoney(BUY_RATE_CNY_PER_GHS, "CNY");

  $("sellScreenRate").textContent =
    "¥1 = " + formatMoney(SELL_RATE_GHS_PER_CNY, "GHS");
}

function updateLiveRates() {
  $("liveBuyRate").textContent =
    "GH₵1 = " + formatMoney(BUY_RATE_CNY_PER_GHS, "CNY");

  $("liveSellRate").textContent =
    "¥1 = " + formatMoney(SELL_RATE_GHS_PER_CNY, "GHS");
}

function updateOrderRateStatus() {
  $("formRateStatus").textContent = currentDirection === "buy"
    ? "GH₵1 = " + formatMoney(BUY_RATE_CNY_PER_GHS, "CNY")
    : "¥1 = " + formatMoney(SELL_RATE_GHS_PER_CNY, "GHS");
}

function updateLiveDirectionLabels() {
  const buying = /** @type {HTMLSelectElement} */ ($("liveDirection")).value === "buy";

  $("liveAmountLabel").textContent = buying
    ? "Amount in Ghana cedis (GH₵)"
    : "Amount in Chinese yuan (¥)";

  $("liveCurrencyPrefix").textContent = buying ? "GH₵" : "¥";
  updateLiveCalculation();
}

/** @param {number} amount @param {Direction} direction @returns {number} */
function calculateExchange(amount, direction) {
  return amount * getRate(direction);
}

function updateLiveCalculation() {
  const input = /** @type {HTMLInputElement} */ ($("liveAmount"));
  const amount = Number(input.value);
  const direction = /** @type {HTMLSelectElement} */ ($("liveDirection")).value;
  const buying = direction === "buy";

  if (!input.value.trim() || !Number.isFinite(amount) || amount <= 0) {
    $("liveResult").textContent = buying ? "¥0.00" : "GH₵0.00";
    $("liveCalculationNote").textContent = "Enter an amount to calculate.";
    return;
  }

  $("liveResult").textContent = formatMoney(
    calculateExchange(amount, buying ? "buy" : "sell"),
    buying ? "CNY" : "GHS"
  );
  $("liveCalculationNote").textContent =
    "Estimated amount before any agreed fees.";
}

/** @param {Direction} direction */
function setDirection(direction) {
  currentDirection = direction;

  $("orderTitle").textContent = direction === "buy" ? "Buy Yuan" : "Sell Yuan";
  $("orderSubtitle").textContent = direction === "buy"
    ? "Pay Ghana cedis and receive Chinese yuan."
    : "Provide Chinese yuan and receive Ghana cedis.";

  $("amountLabel").textContent = direction === "buy"
    ? "Amount in Ghana cedis (GH₵)"
    : "Amount in Chinese yuan (¥)";

  $("currencyPrefix").textContent = direction === "buy" ? "GH₵" : "¥";
  /** @type {HTMLInputElement} */ ($("amount")).value = "";
  $("estimateValue").textContent = direction === "buy" ? "¥0.00" : "GH₵0.00";
  $("estimateNote").textContent = "Enter an amount to calculate.";
  updateOrderRateStatus();
}

/** @param {Direction} direction */
function continueToOrder(direction) {
  currentDirection = direction;
  previousOrderScreen = direction === "buy" ? "buyScreen" : "sellScreen";
  setDirection(direction);
  showScreen("orderScreen");
}

function updateEstimate() {
  const input = /** @type {HTMLInputElement} */ ($("amount"));
  const amount = Number(input.value);

  if (!input.value.trim() || !Number.isFinite(amount) || amount <= 0) {
    $("estimateValue").textContent =
      currentDirection === "buy" ? "¥0.00" : "GH₵0.00";
    $("estimateNote").textContent = "Enter an amount to calculate.";
    return;
  }

  $("estimateValue").textContent = formatMoney(
    calculateExchange(amount, currentDirection),
    currentDirection === "buy" ? "CNY" : "GHS"
  );
  $("estimateNote").textContent =
    "Estimated amount before any agreed fees.";
}

/** @param {string} id @returns {string} */
function getFormValue(id) {
  return /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ ($(id)).value.trim();
}

/** @param {SubmitEvent} event */
function handleOrderSubmit(event) {
  event.preventDefault();

  const amount = Number(getFormValue("amount"));
  const name = getFormValue("customerName");
  const phone = getFormValue("customerPhone");
  const paymentMethod = getFormValue("paymentMethod");
  const note = getFormValue("orderNote");

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter a valid amount.");
    $("amount").focus();
    return;
  }

  if (!name || !phone || !paymentMethod) {
    showToast("Please complete all required fields.");
    return;
  }

  if (!/** @type {HTMLInputElement} */ ($("confirmDetails")).checked) {
    showToast("Please confirm your details.");
    return;
  }

  const estimated = calculateExchange(amount, currentDirection);
  const amountText = formatMoney(
    amount,
    currentDirection === "buy" ? "GHS" : "CNY"
  );
  const estimatedText = formatMoney(
    estimated,
    currentDirection === "buy" ? "CNY" : "GHS"
  );
  const rateText = currentDirection === "buy"
    ? "GH₵1 = " + formatMoney(BUY_RATE_CNY_PER_GHS, "CNY")
    : "¥1 = " + formatMoney(SELL_RATE_GHS_PER_CNY, "GHS");

  let message =
    "CEDI TO YUAN — EXCHANGE REQUEST\n\n" +
    "Request: " + (currentDirection === "buy" ? "BUY CHINESE YUAN" : "SELL CHINESE YUAN") + "\n" +
    "Name: " + name + "\n" +
    "Customer phone: " + phone + "\n" +
    "Amount: " + amountText + "\n" +
    "Displayed rate: " + rateText + "\n" +
    "Estimated amount: " + estimatedText + "\n" +
    "Preferred payment method: " + paymentMethod + "\n";

  if (note) message += "Additional message: " + note + "\n";

  message += "\nPlease confirm availability, the final amount and the exchange instructions.";
  openWhatsApp(message);
}

/** @param {Event} event */
function handleNavigation(event) {
  const button = /** @type {HTMLElement} */ (event.currentTarget);
  const screenId = button.getAttribute("data-screen");
  if (screenId) showScreen(screenId);
}

function connectButtons() {
  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", handleNavigation);
  });

  $("homeBuyButton").addEventListener("click", () => showScreen("buyScreen"));
  $("homeSellButton").addEventListener("click", () => showScreen("sellScreen"));
  $("buyContinue").addEventListener("click", () => continueToOrder("buy"));
  $("sellContinue").addEventListener("click", () => continueToOrder("sell"));
  $("homeRatesButton").addEventListener("click", () => showScreen("liveRatesScreen"));
  $("headerHelpButton").addEventListener("click", () => showScreen("helpScreen"));
  $("homeHelpButton").addEventListener("click", openSupportWhatsApp);
  $("helpWhatsAppButton").addEventListener("click", openSupportWhatsApp);
  $("liveHelpButton").addEventListener("click", openSupportWhatsApp);

  $("liveDirection").addEventListener("change", updateLiveDirectionLabels);
  $("liveAmount").addEventListener("input", updateLiveCalculation);
  $("amount").addEventListener("input", updateEstimate);

  $("liveContinueButton").addEventListener("click", () => {
    const input = /** @type {HTMLInputElement} */ ($("liveAmount"));
    const amount = Number(input.value);
    const direction = /** @type {HTMLSelectElement} */ ($("liveDirection")).value;

    if (!input.value.trim() || !Number.isFinite(amount) || amount <= 0) {
      showToast("Please enter a valid amount.");
      input.focus();
      return;
    }

    continueToOrder(direction === "sell" ? "sell" : "buy");
    /** @type {HTMLInputElement} */ ($("amount")).value = String(amount);
    updateEstimate();
  });

  $("cancelOrder").addEventListener("click", () => showScreen(previousOrderScreen));
  $("orderForm").addEventListener("submit", handleOrderSubmit);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app remains usable if service-worker registration fails.
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  connectButtons();
  updateHomeRates();
  updateScreenRates();
  updateLiveRates();
  updateLiveDirectionLabels();
  $("currentYear").textContent = String(new Date().getFullYear());
  registerServiceWorker();
});
