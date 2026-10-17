const initialStocks = {
  RELIANCE:1428.50, TCS:3984.20, INFY:1562.80,
  HDFCBANK:1712.35, ICICIBANK:1324.15, SBIN:987.45
};

let state;
try {
  state = JSON.parse(localStorage.getItem("tradex-demo-state"));
} catch(e) {}

if (!state || typeof state.balance !== "number") {
  state = {
    balance:0,
    stocks:{...initialStocks},
    holdings:{},
    orders:[],
    transactions:[]
  };
}
state.stocks = {...initialStocks,...state.stocks};

try {
  if (!localStorage.getItem("tradex-zero-balance-v1")) {
    state.balance = 0;
    localStorage.setItem("tradex-zero-balance-v1", "yes");
    localStorage.setItem("tradex-demo-state", JSON.stringify(state));
  }
} catch (e) {}

let selected = "RELIANCE";
let side = "BUY";
let fundMode = "deposit";
let history = [];
let lastPrice = state.stocks[selected];
let toastTimer;

let authMode = "login";
let currentUser = null;
const USERS_KEY = "tradex-demo-users";
const SESSION_KEY = "tradex-demo-session";

function showAuth(mode) {
  authMode = mode;
  document.getElementById("loginTab").classList.toggle("active", mode === "login");
  document.getElementById("signupTab").classList.toggle("active", mode === "signup");
  document.getElementById("nameWrap").style.display = mode === "signup" ? "block" : "none";
  document.getElementById("authName").required = mode === "signup";
  document.getElementById("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
  document.getElementById("authSubmit").textContent = mode === "signup" ? "Create Account" : "Login";
}
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch (e) { return []; }
}
function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim().toLowerCase();
  const password = document.getElementById("authPassword").value;
  const name = document.getElementById("authName").value.trim();
  const users = getUsers();
  if (authMode === "signup") {
    if (!name) return notify("Please enter your name");
    if (users.some(user => user.email === email)) return notify("Account already exists. Please login.");
    users.push({name, email, password});
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    loginUser({name, email});
    notify("Demo account created");
  } else {
    const user = users.find(user => user.email === email && user.password === password);
    if (!user) return notify("Incorrect email or password, or please sign up first.");
    loginUser({name: user.name, email: user.email});
    notify("Login successful");
  }
}
function loginUser(user) {
  currentUser = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify({name:user.name, email:user.email}));
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("userBar").style.display = "flex";
  document.getElementById("userGreeting").textContent = "Hi, " + user.name;
}
function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("userBar").style.display = "none";
  showAuth("login");
}
function restoreSession() {
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (user && user.email) loginUser(user);
  } catch (e) {}
}

function money(n) {
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits:2, maximumFractionDigits:2
  });
}
function save() {
  localStorage.setItem("tradex-demo-state",JSON.stringify(state));
}
function notify(msg) {
  const t=document.getElementById("toast");
  t.textContent=msg;t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),2600);
}
function renderWatchlist() {
  const box=document.getElementById("watchlist");
  box.innerHTML="";
  Object.keys(state.stocks).forEach(name=>{
    const p=state.stocks[name];
    const old=initialStocks[name];
    const change=(p-old)/old*100;
    const row=document.createElement("div");
    row.className="stock"+(name===selected?" active":"");
    row.innerHTML=`<div><strong>${name}</strong><small>DEMO</small></div>
      <div class="quote"><strong>${money(p)}</strong>
      <small class="${change>=0?'live':'red'}">${change>=0?'+':''}${change.toFixed(2)}%</small></div>`;
    row.onclick=()=>selectStock(name);
    box.appendChild(row);
  });
}
function selectStock(name) {
  selected=name;
  lastPrice=state.stocks[name];
  document.getElementById("orderStock").value=name;
  renderWatchlist();renderPrice();drawChart();updateTotal();
}
function renderPrice() {
  const p=state.stocks[selected];
  const change=(p-initialStocks[selected])/initialStocks[selected]*100;
  document.getElementById("symbol").textContent=selected+" · DEMO";
  document.getElementById("price").textContent=money(p);
  const c=document.getElementById("change");
  c.className=change>=0?"live":"red";
  c.textContent=(change>=0?"+":"")+change.toFixed(2)+"% from starting price";
}
function renderWallet() {
  document.getElementById("balance").textContent=money(state.balance);
  let invested=0,value=0;
  Object.entries(state.holdings).forEach(([name,h])=>{
    invested+=h.qty*h.avg;
    value+=h.qty*state.stocks[name];
  });
  document.getElementById("invested").textContent=money(invested);
  document.getElementById("portfolio").textContent=money(value);
  const pnl=value-invested;
  const el=document.getElementById("pnl");
  el.textContent=(pnl>=0?"+":"")+money(pnl);
  el.className=pnl>=0?"live":"red";
  renderHoldings();
}
function renderHoldings() {
  const body=document.getElementById("holdings");
  body.innerHTML="";
  Object.entries(state.holdings).filter(([n,h])=>h.qty>0).forEach(([name,h])=>{
    const pnl=h.qty*(state.stocks[name]-h.avg);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${name}</td><td>${h.qty}</td><td>${money(h.avg)}</td>
      <td>${money(state.stocks[name])}</td>
      <td class="${pnl>=0?'live':'red'}">${money(pnl)}</td>`;
    body.appendChild(tr);
  });
  if(!body.children.length) body.innerHTML='<tr><td colspan="5" class="muted">No holdings yet. Try a demo Buy order.</td></tr>';
}
function renderOrders() {
  const body=document.getElementById("orders");
  body.innerHTML="";
  state.orders.slice(0,20).forEach(o=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${o.time}</td><td>${o.name}</td>
      <td class="${o.side==='BUY'?'live':'red'}">${o.side}</td>
      <td>${o.qty}</td><td>${money(o.price)}</td><td class="live">DEMO FILLED</td>`;
    body.appendChild(tr);
  });
  if(!body.children.length) body.innerHTML='<tr><td colspan="6" class="muted">No orders yet</td></tr>';
}
function renderTransactions() {
  const body=document.getElementById("transactions");
  body.innerHTML="";
  state.transactions.slice(0,20).forEach(t=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${t.time}</td><td>${t.type}</td>
      <td class="${t.type==='Deposit'?'live':'red'}">${money(t.amount)}</td><td class="live">DEMO</td>`;
    body.appendChild(tr);
  });
  if(!body.children.length) body.innerHTML='<tr><td colspan="4" class="muted">No wallet transactions yet</td></tr>';
}
function updateTotal() {
  const qty=Number(document.getElementById("qty").value);
  document.getElementById("total").textContent=money(Math.max(0,qty)*state.stocks[selected]);
}
function setSide(s) {
  side=s;
  document.getElementById("buyTab").className=s==="BUY"?"selected-buy":"";
  document.getElementById("sellTab").className=s==="SELL"?"selected-sell":"";
  const btn=document.getElementById("tradeButton");
  btn.textContent=(s==="BUY"?"Buy ":"Sell ")+selected;
  btn.className=(s==="BUY"?"green-btn":"red-btn")+" full";
}
function trade() {
  const qty=Number(document.getElementById("qty").value);
  const price=state.stocks[selected],amount=qty*price;
  if(!Number.isSafeInteger(qty)||qty<1) return notify("Enter a valid whole-number quantity");
  const h=state.holdings[selected]||{qty:0,avg:0};
  if(side==="BUY") {
    if(amount>state.balance) return notify("Insufficient demo funds. Deposit virtual funds first.");
    h.avg=(h.qty*h.avg+amount)/(h.qty+qty);
    h.qty+=qty;
    state.balance-=amount;
  } else {
    if(qty>h.qty) return notify("You don't own enough shares to sell");
    h.qty-=qty;
    state.balance+=amount;
  }
  state.holdings[selected]=h;
  state.orders.unshift({name:selected,side,qty,price,time:new Date().toLocaleTimeString()});
  save();renderWallet();renderOrders();renderWatchlist();updateTotal();
  notify(`${side} demo order completed: ${qty} ${selected}`);
}
let depositCountdown = null;
let depositDeadline = 0;
const depositUpiId = "rahul3131@fam";
const depositPayeeName = "Rahul";

function openFunds(mode) {
  clearInterval(depositCountdown);
  depositCountdown = null;
  fundMode = mode;
  document.getElementById("modalTitle").textContent = mode === "deposit" ? "Deposit Funds" : "Withdraw Demo Funds";
  document.getElementById("confirmFunds").textContent = mode === "deposit" ? "Generate Payment QR" : "Withdraw";
  document.getElementById("fundAmount").value = "";
  document.getElementById("qrPayment").style.display = "none";
  document.getElementById("depositQrCode").innerHTML = "";
  document.getElementById("depositTimer").textContent = "05:00";
  document.getElementById("depositMessage").textContent = "Payment is not automatically verified.";
  document.getElementById("fundAmount").disabled = false;
  document.getElementById("confirmFunds").disabled = false;
  document.getElementById("fundModalNote").textContent = mode === "deposit"
    ? "Minimum deposit ₹2,000. Payment will not automatically update this demo wallet."
    : "Withdrawals affect demo funds only.";
  document.getElementById("fundAmountLabel").textContent = mode === "deposit" ? "Deposit amount (₹)" : "Amount (₹)";
  document.getElementById("fundAmount").min = mode === "deposit" ? "2000" : "1";
  document.getElementById("fundAmount").max = mode === "deposit" ? "100000" : "";
  document.getElementById("fundModal").classList.add("open");
}

function closeFunds() {
  clearInterval(depositCountdown);
  depositCountdown = null;
  document.getElementById("fundAmount").disabled = false;
  document.getElementById("confirmFunds").disabled = false;
  document.getElementById("fundModal").classList.remove("open");
}

function fundsAction() {
  const amount = Number(document.getElementById("fundAmount").value);
  if (!Number.isSafeInteger(amount) || amount <= 0) return notify("Enter a valid whole-rupee amount");

  if (fundMode === "deposit") {
    if (amount < 2000 || amount > 100000) return notify("Minimum deposit ₹2,000 and maximum ₹1,00,000.");
    if (typeof QRCode === "undefined") return notify("QR library did not load. Check your internet connection.");
    clearInterval(depositCountdown);
    const upiLink = "upi://pay?pa=" + encodeURIComponent(depositUpiId) +
      "&pn=" + encodeURIComponent(depositPayeeName) +
      "&am=" + amount.toFixed(2) + "&cu=INR";
    document.getElementById("depositQrCode").innerHTML = "";
    new QRCode(document.getElementById("depositQrCode"), {
      text: upiLink, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M
    });
    document.getElementById("qrAmount").textContent = "Pay ₹" + amount.toFixed(2);
    document.getElementById("qrPayment").style.display = "block";
    document.getElementById("depositMessage").textContent = "Scan and pay. This page cannot verify payment automatically.";
    document.getElementById("fundAmount").disabled = true;
    document.getElementById("confirmFunds").disabled = true;
    depositDeadline = Date.now() + 5 * 60 * 1000;
    updateDepositTimer();
    depositCountdown = setInterval(updateDepositTimer, 1000);
    return;
  }

  if (amount > state.balance) return notify("Insufficient available demo balance");
  state.balance -= amount;
  state.transactions.unshift({type:"Withdraw", amount, time:new Date().toLocaleTimeString()});
  save(); renderWallet(); renderTransactions(); closeFunds();
  notify("Demo funds withdrawn");
}

function updateDepositTimer() {
  const remaining = Math.max(0, Math.ceil((depositDeadline - Date.now()) / 1000));
  document.getElementById("depositTimer").textContent =
    String(Math.floor(remaining / 60)).padStart(2, "0") + ":" +
    String(remaining % 60).padStart(2, "0");
  if (remaining === 0) {
    clearInterval(depositCountdown);
    depositCountdown = null;
    document.getElementById("depositQrCode").innerHTML = "";
    document.getElementById("depositMessage").textContent =
      "QR request expired. If you already paid, verify the transaction before retrying.";
    document.getElementById("confirmFunds").disabled = false;
    document.getElementById("fundAmount").disabled = false;
    document.getElementById("confirmFunds").textContent = "Generate New QR";
  }
}

/* Moving simulated prices */
const canvas=document.getElementById("chart");
const ctx=canvas.getContext("2d");
function seedHistory() {
  history=[];
  let p=state.stocks[selected];
  for(let i=0;i<65;i++) {
    const open=p;
    p=Math.max(1,p+(Math.random()-.5)*p*.004);
    history.push({open,close:p,high:Math.max(open,p)+Math.random()*p*.001,low:Math.min(open,p)-Math.random()*p*.001});
  }
}
function drawChart() {
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const dpr=window.devicePixelRatio||1;
  canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=rect.width,h=rect.height;
  ctx.clearRect(0,0,w,h);
  const min=Math.min(...history.map(c=>c.low));
  const max=Math.max(...history.map(c=>c.high));
  const pad=(max-min)*.12||1;
  const lo=min-pad,hi=max+pad;
  const y=v=>h-((v-lo)/(hi-lo))*h;
  const step=w/history.length,cw=Math.max(3,step*.58);
  history.forEach((c,i)=>{
    const x=i*step+step/2,up=c.close>=c.open;
    ctx.strokeStyle=up?"#00d395":"#ff5263";
    ctx.fillStyle=ctx.strokeStyle;
    ctx.beginPath();ctx.moveTo(x,y(c.high));ctx.lineTo(x,y(c.low));ctx.stroke();
    const top=y(Math.max(c.open,c.close));
    const bh=Math.max(1,Math.abs(y(c.open)-y(c.close)));
    ctx.fillRect(x-cw/2,top,cw,bh);
  });
  const current=history[history.length-1].close;
  ctx.setLineDash([5,4]);ctx.strokeStyle="#90a4bd";
  ctx.beginPath();ctx.moveTo(0,y(current));ctx.lineTo(w,y(current));ctx.stroke();
  ctx.setLineDash([]);
}
function tick() {
  Object.keys(state.stocks).forEach(name=>{
    const old=state.stocks[name];
    const next=Math.max(.01,old+(Math.random()-.5)*old*.002);
    state.stocks[name]=Number(next.toFixed(2));
  });
  const p=state.stocks[selected];
  const last=history[history.length-1];
  last.high=Math.max(last.high,p);
  last.low=Math.min(last.low,p);
  last.close=p;
  if(Math.random()<.55) {
    history.push({open:p,close:p,high:p,low:p});
    if(history.length>65)history.shift();
  }
  renderWatchlist();renderPrice();renderWallet();updateTotal();drawChart();save();
}
document.getElementById("orderStock").innerHTML=Object.keys(state.stocks).map(n=>`<option value="${n}">${n}</option>`).join("");
document.getElementById("orderStock").addEventListener("change",e=>selectStock(e.target.value));
document.getElementById("qty").addEventListener("input",updateTotal);
document.getElementById("search").addEventListener("input",e=>{
  const q=e.target.value.toUpperCase();
  document.querySelectorAll(".stock").forEach(el=>el.style.display=el.textContent.toUpperCase().includes(q)?"flex":"none");
});
window.addEventListener("resize",drawChart);
seedHistory();renderWatchlist();renderPrice();renderWallet();renderOrders();renderTransactions();setSide("BUY");updateTotal();drawChart();restoreSession();
setInterval(tick,1000);
