
const $ = id => document.getElementById(id);

let authMode = "signup";
let currentUser = null;

let prices = {
    BTC: 6500000,
    ETH: 250000
};

const initialPrices = { ...prices };
let chartPoints = [6500000];
let account = null;
let timer = null;

// Demo data is stored separately for each browser account.
function getUsers() {
    try {
        return JSON.parse(localStorage.getItem("tradex_users") || "{}");
    } catch {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem("tradex_users", JSON.stringify(users));
}

function getAccountKey(email) {
    return "tradex_account_" + email.toLowerCase();
}

function loadAccount(email) {
    try {
        account = JSON.parse(
            localStorage.getItem(getAccountKey(email))
        );
    } catch {
        account = null;
    }

    if (!account || typeof account.balance !== "number") {
        account = {
            balance: 0,
            holdings: { BTC: 0, ETH: 0 },
            history: []
        };
        saveAccount();
    }

    account.holdings ||= { BTC: 0, ETH: 0 };
    account.history ||= [];
}

function saveAccount() {
    if (!currentUser || !account) return;

    localStorage.setItem(
        getAccountKey(currentUser.email),
        JSON.stringify(account)
    );
}

function money(value) {
    return "₹" + value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showAuth(mode) {
    authMode = mode;

    $("hero").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("authSection").classList.remove("hidden");

    $("authTitle").textContent =
        mode === "signup" ? "Create your account" : "Welcome back";

    $("authSubtitle").textContent =
        mode === "signup"
            ? "Join TradeX and start practising."
            : "Login to your demo trading account.";

    $("nameField").classList.toggle("hidden", mode === "login");
    $("fullName").required = mode === "signup";

    $("password").autocomplete =
        mode === "signup" ? "new-password" : "current-password";

    $("submitAuth").textContent =
        mode === "signup" ? "Create Account" : "Login";

    $("switchText").firstChild.textContent =
        mode === "signup"
            ? "Already have an account? "
            : "New to TradeX? ";

    $("switchAuth").textContent =
        mode === "signup" ? "Login" : "Sign Up";

    $("authMessage").textContent = "";
    $("authMessage").style.color = "#1bd99a";
    $("authForm").reset();
}

function showHome() {
    $("authSection").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("hero").classList.remove("hidden");
}

function showDashboard() {
    $("hero").classList.add("hidden");
    $("authSection").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("navButtons").classList.add("hidden");
    $("userNav").classList.remove("hidden");

    $("userName").textContent = currentUser.name;
    $("welcomeName").textContent = currentUser.name;

    render();
    drawChart();

    if (timer) clearInterval(timer);
    timer = setInterval(updatePrices, 1000);
}

// SHA-256 password hashing for this local demonstration.
// Browser-side hashing is NOT a replacement for server security.
async function hashPassword(password) {
    if (!crypto.subtle) {
        throw new Error("Use localhost or HTTPS to run this demo.");
    }

    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

$("showSignup").addEventListener("click", () => showAuth("signup"));
$("showLogin").addEventListener("click", () => showAuth("login"));
$("heroSignup").addEventListener("click", () => showAuth("signup"));
$("closeAuth").addEventListener("click", showHome);

$("switchAuth").addEventListener("click", () => {
    showAuth(authMode === "signup" ? "login" : "signup");
});

$("authForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("fullName").value.trim();
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;

    const users = getUsers();
    const message = $("authMessage");

    try {
        if (authMode === "signup") {
            if (name.length < 2) {
                throw new Error("Enter your full name.");
            }

            if (password.length < 8) {
                throw new Error("Password must have at least 8 characters.");
            }

            if (users[email]) {
                throw new Error("Account already exists. Please login.");
            }

            const passwordHash = await hashPassword(password);

            users[email] = {
                name,
                passwordHash
            };

            saveUsers(users);

            currentUser = { name, email };
            loadAccount(email);
            showDashboard();

        } else {
            const user = users[email];

            if (!user) {
                throw new Error("Account not found. Please sign up first.");
            }

            const passwordHash = await hashPassword(password);

            if (passwordHash !== user.passwordHash) {
                throw new Error("Incorrect email or password.");
            }

            currentUser = { name: user.name, email };
            loadAccount(email);
            showDashboard();
        }
    } catch (error) {
        message.textContent = error.message;
        message.style.color = "#ff6178";
    }
});

$("logoutBtn").addEventListener("click", () => {
    saveAccount();

    currentUser = null;
    account = null;

    if (timer) clearInterval(timer);

    $("userNav").classList.add("hidden");
    $("navButtons").classList.remove("hidden");

    prices = { ...initialPrices };
    chartPoints = [prices.BTC];

    showHome();
});

function render() {
    if (!account) return;

    $("balance").textContent = money(account.balance);

    $("btcPrice").textContent = money(prices.BTC);
    $("ethPrice").textContent = money(prices.ETH);

    ["BTC", "ETH"].forEach(asset => {
        const change =
            ((prices[asset] - initialPrices[asset]) /
            initialPrices[asset]) * 100;

        const el = $(asset.toLowerCase() + "Change");

        el.textContent =
            (change >= 0 ? "+" : "") + change.toFixed(2) + "%";

        el.style.color = change >= 0 ? "#1bd99a" : "#ff6178";
    });

    const historyElement = $("tradeHistory");
    historyElement.replaceChildren();

    if (!account.history.length) {
        historyElement.textContent = "No trades yet.";
        historyElement.className = "muted";
        return;
    }

    historyElement.className = "";

    account.history.forEach(item => {
        const row = document.createElement("div");
        row.className = "trade-row";

        const title = document.createElement("b");
        title.textContent = `${item.side} ${item.asset} — ${money(item.amount)}`;

        const detail = document.createElement("div");
        detail.className = "muted";
        detail.textContent = item.message;

        row.append(title, detail);
        historyElement.appendChild(row);
    });
}

$("addFunds").addEventListener("click", () => {
    const amount = Number($("fundAmount").value);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid demo amount.");
        return;
    }

    account.balance += amount;
    $("fundAmount").value = "";

    saveAccount();
    render();
});

function trade(side) {
    const asset = $("asset").value;
    const amount = Number($("tradeAmount").value);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid trade amount.");
        return;
    }

    const quantity = amount / prices[asset];

    if (side === "BUY") {
        if (amount > account.balance) {
            alert("Insufficient demo funds. Add practice funds first.");
            return;
        }

        account.balance -= amount;
        account.holdings[asset] += quantity;

    } else {
        if (quantity > account.holdings[asset]) {
            alert("Not enough demo holdings to sell.");
            return;
        }

        account.holdings[asset] -= quantity;
        account.balance += amount;
    }

    account.history.unshift({
        side,
        asset,
        amount,
        message: `${quantity.toFixed(8)} units at ${money(prices[asset])}`
    });

    account.history = account.history.slice(0, 30);

    $("tradeAmount").value = "";

    saveAccount();
    render();
}

$("buyBtn").addEventListener("click", () => trade("BUY"));
$("sellBtn").addEventListener("click", () => trade("SELL"));

function updatePrices() {
    for (const asset of ["BTC", "ETH"]) {
        const movement = (Math.random() - 0.5) * 0.004;
        prices[asset] *= 1 + movement;
    }

    chartPoints.push(prices.BTC);

    if (chartPoints.length > 45) {
        chartPoints.shift();
    }

    render();
    drawChart();
}

function drawChart() {
    const canvas = $("priceChart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;

    const min = Math.min(...chartPoints);
    const max = Math.max(...chartPoints);
    const range = max - min || 1;

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();

    chartPoints.forEach((value, index) => {
        const x = index / Math.max(chartPoints.length - 1, 1) * width;
        const y = height - 10 - ((value - min) / range) * (height - 20);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "#438cff";
    ctx.lineWidth = 2;
    ctx.stroke();
}

window.addEventListener("resize", drawChart);

// Start with the public landing page and zero-balance demo accounts.
showHome();
