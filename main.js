// Application State
const appState = {
  stocks: new Map(),
  chart: null,
  socket: null,
  colors: [
    "#00f3ff",
    "#ff00ff",
    "#00ff88",
    "#ffaa00",
    "#bc13fe",
    "#ff0055",
    "#00ffff",
    "#ffff00"
  ],
  colorIndex: 0
};

// Stock Data Service (Simulated with realistic data generation)
class StockService {
  constructor() {
    this.basePrices = {
      AAPL: 175.5,
      GOOGL: 142.3,
      MSFT: 380.2,
      AMZN: 155.8,
      TSLA: 245.6,
      META: 505.2,
      NVDA: 485.1,
      NFLX: 485.9,
      AMD: 145.3,
      INTC: 42.5,
      CRM: 285.4,
      ORCL: 115.2
    };
    this.historicalData = new Map();
  }

  getRandomPrice(base, volatility = 0.02) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    return base * (1 + change);
  }

  generateHistory(symbol, days = 365) {
    const base = this.basePrices[symbol] || 100 + Math.random() * 200;
    const data = [];
    let current = base;
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      current = this.getRandomPrice(current, 0.015);
      data.push({
        x: date.toISOString().split("T")[0],
        y: parseFloat(current.toFixed(2))
      });
    }
    return data;
  }

  getStockInfo(symbol) {
    if (!this.historicalData.has(symbol)) {
      this.historicalData.set(symbol, this.generateHistory(symbol));
    }
    return {
      symbol: symbol.toUpperCase(),
      data: this.historicalData.get(symbol),
      current: this.historicalData.get(symbol).slice(-1)[0].y
    };
  }
}

const stockService = new StockService();

// Chart Manager
class ChartManager {
  constructor() {
    this.ctx = document.getElementById("stockChart").getContext("2d");
    this.chart = null;
    this.init();
  }

  init() {
    Chart.defaults.color = "#64748b";
    Chart.defaults.font.family = "JetBrains Mono";

    this.chart = new Chart(this.ctx, {
      type: "line",
      data: {
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(10, 10, 15, 0.9)",
            titleColor: "#00f3ff",
            bodyColor: "#fff",
            borderColor: "rgba(0, 243, 255, 0.3)",
            borderWidth: 1,
            padding: 12,
            titleFont: { family: "Space Grotesk", size: 14 },
            bodyFont: { family: "JetBrains Mono", size: 12 },
            callbacks: {
              label: function (context) {
                return `${context.dataset.label}: $${context.parsed.y.toFixed(
                  2
                )}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
              drawBorder: false
            },
            ticks: {
              color: "#64748b",
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
              drawBorder: false
            },
            ticks: {
              color: "#64748b",
              callback: function (value) {
                return "$" + value.toFixed(0);
              }
            }
          }
        },
        elements: {
          line: {
            tension: 0.4,
            borderWidth: 2
          },
          point: {
            radius: 0,
            hitRadius: 20,
            hoverRadius: 6
          }
        }
      }
    });
  }

  addStock(symbol, color) {
    const info = stockService.getStockInfo(symbol);
    const dataset = {
      label: symbol,
      data: info.data,
      borderColor: color,
      backgroundColor: color + "20",
      fill: false,
      pointBackgroundColor: color,
      pointBorderColor: "#fff",
      pointBorderWidth: 2
    };

    this.chart.data.datasets.push(dataset);
    this.chart.update();
    this.updateLegend();
  }

  removeStock(symbol) {
    const index = this.chart.data.datasets.findIndex((d) => d.label === symbol);
    if (index > -1) {
      this.chart.data.datasets.splice(index, 1);
      this.chart.update();
      this.updateLegend();
    }
  }

  updateLegend() {
    const legend = document.getElementById("chartLegend");
    legend.innerHTML = this.chart.data.datasets
      .map(
        (dataset) => `
                    <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${
                          dataset.borderColor
                        }"></div>
                        <span class="text-sm mono font-bold">${
                          dataset.label
                        }</span>
                        <span class="text-xs text-gray-400">$${dataset.data
                          .slice(-1)[0]
                          .y.toFixed(2)}</span>
                    </div>
                `
      )
      .join("");
  }

  timeRange(range) {
    // Simulate time range changes by filtering data
    const days = { "1D": 1, "1W": 7, "1M": 30, "1Y": 365 }[range] || 365;

    this.chart.data.datasets.forEach((dataset) => {
      const fullData = stockService.historicalData.get(dataset.label);
      dataset.data = fullData.slice(-days);
    });
    this.chart.update();

    showToast(`Switched to ${range} view`);
  }
}

// WebSocket Manager (Simulated for Demo)
class WebSocketManager {
  constructor() {
    this.callbacks = [];
    this.isConnected = false;
    this.simulateConnection();
  }

  simulateConnection() {
    // Simulate WebSocket connection
    setTimeout(() => {
      this.isConnected = true;
      this.updateStatus();
      showToast("Connected to real-time feed");

      // Simulate random stock updates
      setInterval(() => this.simulateStockUpdate(), 5000);
      // Simulate user activity
      setInterval(() => this.simulateUserActivity(), 15000);
    }, 1000);
  }

  updateStatus() {
    const statusEl = document.getElementById("connectionStatus");
    if (this.isConnected) {
      statusEl.className =
        "connection-status connected px-4 py-2 rounded-full text-sm mono flex items-center gap-2";
      statusEl.innerHTML = `
                        <span class="w-2 h-2 rounded-full bg-current live-pulse"></span>
                        <span>Live</span>
                    `;
    } else {
      statusEl.className =
        "connection-status disconnected px-4 py-2 rounded-full text-sm mono flex items-center gap-2";
      statusEl.innerHTML = `
                        <span class="w-2 h-2 rounded-full bg-current"></span>
                        <span>Disconnected</span>
                    `;
    }
  }

  simulateStockUpdate() {
    const symbols = Array.from(appState.stocks.keys());
    if (symbols.length === 0) return;

    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const stock = appState.stocks.get(randomSymbol);
    const lastPrice = stock.data[stock.data.length - 1].y;
    const change = (Math.random() - 0.5) * 2;
    const newPrice = parseFloat((lastPrice + change).toFixed(2));

    stock.data.push({
      x: new Date().toISOString(),
      y: newPrice
    });

    this.broadcast("priceUpdate", { symbol: randomSymbol, price: newPrice });
  }

  simulateUserActivity() {
    const actions = ["add", "remove"];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const symbols = ["UBER", "COIN", "PLTR", "SQ", "SHOP"];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

    if (action === "add" && !appState.stocks.has(randomSymbol)) {
      this.broadcast("stockAdded", { symbol: randomSymbol, source: "remote" });
    } else if (action === "remove" && appState.stocks.has(randomSymbol)) {
      this.broadcast("stockRemoved", {
        symbol: randomSymbol,
        source: "remote"
      });
    }
  }

  on(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  broadcast(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((cb) => cb(data));
    }
  }

  emit(event, data) {
    // Simulate server acknowledgment
    setTimeout(() => {
      this.broadcast(event, data);
    }, 100);
  }
}

// UI Manager
function renderStockList() {
  const list = document.getElementById("stockList");
  if (appState.stocks.size === 0) {
    list.innerHTML =
      '<div class="text-gray-500 text-center py-8 text-sm">No stocks tracked yet</div>';
    return;
  }

  list.innerHTML = Array.from(appState.stocks.entries())
    .map(
      ([symbol, data]) => `
                <div class="stock-card glass rounded-xl p-4 border border-white/10 flex justify-between items-center cursor-pointer group" style="border-left: 4px solid ${
                  data.color
                }">
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xl font-bold mono">${symbol}</span>
                            <span class="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">NASDAQ</span>
                        </div>
                        <div class="mt-1 flex items-center gap-3 text-sm">
                            <span class="text-white mono">$${
                              data.current
                            }</span>
                            <span class="${
                              data.change >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            } mono text-xs">
                                ${data.change >= 0 ? "+" : ""}${
        data.changePercent
      }%
                            </span>
                        </div>
                    </div>
                    <button onclick="removeStock('${symbol}')" class="remove-btn p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-all" title="Remove stock">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `
    )
    .join("");

  document.getElementById("totalStocks").textContent = appState.stocks.size;
}

function updateTicker() {
  const ticker = document.getElementById("tickerContent");
  if (appState.stocks.size === 0) return;

  const items = Array.from(appState.stocks.values())
    .map((stock) => {
      const change = stock.change >= 0 ? "+" : "";
      const color = stock.change >= 0 ? "text-green-400" : "text-red-400";
      return `
                    <span class="mx-6">
                        <span class="font-bold text-white">${stock.symbol}</span>
                        <span class="ml-2">$${stock.current}</span>
                        <span class="${color} ml-2">${change}${stock.changePercent}%</span>
                    </span>
                `;
    })
    .join("");

  ticker.innerHTML = items + items; // Duplicate for seamless loop
}

function showToast(message) {
  const toast = document.getElementById("toast");
  document.getElementById("toastMessage").textContent = message;
  toast.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
  }, 3000);
}

function showError(msg) {
  const err = document.getElementById("errorMessage");
  err.textContent = msg;
  err.classList.remove("hidden");
  setTimeout(() => err.classList.add("hidden"), 3000);
}

// Core Functions
function addStock(symbol, source = "local") {
  symbol = symbol.toUpperCase().trim();

  if (!symbol) {
    showError("Please enter a stock symbol");
    return;
  }

  if (appState.stocks.has(symbol)) {
    showError("Stock already tracked");
    return;
  }

  const color = appState.colors[appState.colorIndex % appState.colors.length];
  appState.colorIndex++;

  try {
    const info = stockService.getStockInfo(symbol);
    const previous = info.data[info.data.length - 2].y;
    const current = info.data[info.data.length - 1].y;
    const change = parseFloat((current - previous).toFixed(2));
    const changePercent = parseFloat(((change / previous) * 100).toFixed(2));

    appState.stocks.set(symbol, {
      ...info,
      color,
      change,
      changePercent
    });

    chartInstance.addStock(symbol, color);
    renderStockList();
    updateTicker();

    if (source === "local") {
      wsManager.emit("stockAdded", { symbol, source: "local" });
      showToast(`Added ${symbol} to watchlist`);
      document.getElementById("stockInput").value = "";
    } else {
      showToast(`${symbol} added by another user`);
    }

    // Update viewers count simulation
    document.getElementById("activeUsers").textContent =
      Math.floor(Math.random() * 5) + 1;
  } catch (e) {
    showError("Invalid stock symbol or data unavailable");
  }
}

function removeStock(symbol, source = "local") {
  if (!appState.stocks.has(symbol)) return;

  appState.stocks.delete(symbol);
  chartInstance.removeStock(symbol);
  renderStockList();
  updateTicker();

  if (source === "local") {
    wsManager.emit("stockRemoved", { symbol, source: "local" });
    showToast(`Removed ${symbol}`);
  } else {
    showToast(`${symbol} removed by another user`);
  }
}

// Event Listeners
document.getElementById("addStockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  addStock(document.getElementById("stockInput").value);
});

// WebSocket Event Handlers
wsManager = new WebSocketManager();

wsManager.on("stockAdded", (data) => {
  if (data.source === "remote" && !appState.stocks.has(data.symbol)) {
    addStock(data.symbol, "remote");
  }
});

wsManager.on("stockRemoved", (data) => {
  if (data.source === "remote" && appState.stocks.has(data.symbol)) {
    removeStock(data.symbol, "remote");
  }
});

wsManager.on("priceUpdate", (data) => {
  if (appState.stocks.has(data.symbol)) {
    const stock = appState.stocks.get(data.symbol);
    stock.current = data.price;
    renderStockList();
    updateTicker();

    // Update chart last value
    const dataset = chartInstance.chart.data.datasets.find(
      (d) => d.label === data.symbol
    );
    if (dataset) {
      dataset.data[dataset.data.length - 1].y = data.price;
      chartInstance.chart.update("none");
    }
  }
});

// Initialize
const chartInstance = new ChartManager();

// Add some default stocks
setTimeout(() => {
  ["AAPL", "GOOGL", "MSFT"].forEach((sym) => addStock(sym));
}, 500);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("stockInput").blur();
  }
  if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
    e.preventDefault();
    document.getElementById("stockInput").focus();
  }
});
