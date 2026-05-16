/* =============================================
   IoT Solar Panel Monitoring — Dashboard JS
   Version 2.0.0 — Real-time via WebSocket
   ALL DATA FROM API — No mock data
   ============================================= */

const API_BASE = ''; // Same origin
const PANEL_ID = 'PANEL-001';

// ── Chart.js Global Config ──
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 16;

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getThemeTokens() {
  return {
    primary: getCSSVar('--primary'),
    success: getCSSVar('--success'),
    danger: getCSSVar('--danger'),
    warning: getCSSVar('--warning'),
    info: getCSSVar('--info'),
    textPrimary: getCSSVar('--text-primary'),
    textSecondary: getCSSVar('--text-secondary'),
    textMuted: getCSSVar('--text-muted'),
    borderColor: getCSSVar('--border-color'),
  };
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// =============================================
// DATE-TIME CLOCK
// =============================================
function updateClock() {
  const el = document.getElementById('datetime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('vi-VN', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
setInterval(updateClock, 1000);
updateClock();

// =============================================
// THEME TOGGLE
// =============================================
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem('solar-theme', theme);
  setTimeout(() => renderAllCharts(), 100);
}

themeToggle.addEventListener('click', () => {
  const current = root.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

const savedTheme = localStorage.getItem('solar-theme');
if (savedTheme) setTheme(savedTheme);

// =============================================
// CONNECTION STATUS
// =============================================
function setConnectionStatus(connected, text) {
  const el = document.getElementById('connectionStatus');
  const textEl = el.querySelector('.conn-text');
  if (connected) {
    el.classList.add('connected');
    textEl.textContent = text || 'Đã kết nối';
    document.getElementById('infoStatus').textContent = 'Active';
  } else {
    el.classList.remove('connected');
    textEl.textContent = text || 'Mất kết nối';
    document.getElementById('infoStatus').textContent = 'Offline';
  }
}

// =============================================
// WEBSOCKET — REAL-TIME DATA
// =============================================
let ws = null;
let fallbackTimer = null;
let realtimeData = { voltage: [], current: [], labels: [] };
const MAX_REALTIME_POINTS = 60;

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    setConnectionStatus(true, 'WebSocket connected');
    showToast('✅ Kết nối WebSocket thành công', 'success', 3000);
    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
  };

  ws.onmessage = (event) => {
    try {
      const { type, data } = JSON.parse(event.data);
      if (type === 'new-reading') handleNewReading(data);
      if (type === 'status-change') handleStatusChange(data);
      if (type === 'alert') handleAlert(data);
      if (type === 'welcome') console.log('WS:', data.message);
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };

  ws.onclose = () => {
    setConnectionStatus(false, 'Đang kết nối lại...');
    if (!fallbackTimer) {
      fallbackTimer = setInterval(pollLatestReading, 5000);
    }
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => {
    setConnectionStatus(false, 'Lỗi kết nối');
  };
}

// Handle incoming real-time sensor data
function handleNewReading(data) {
  // Update KPI cards
  updateKPIValue('kpiVoltage', data.voltage, 'V');
  updateKPIValue('kpiCurrent', data.current, 'A');
  updateKPIValue('kpiPower', data.power || (data.voltage * data.current).toFixed(1), 'W');
  updateKPIValue('kpiLight', data.lightIntensity, 'lux');
  updateKPIValue('kpiAngle', data.servoAngle, '°');

  // Update device info
  document.getElementById('infoAngle').textContent = data.servoAngle + '°';

  // Update servo visual
  updateServoVisual(data.servoAngle);

  // Update real-time chart
  const now = new Date();
  const label = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  realtimeData.labels.push(label);
  realtimeData.voltage.push(data.voltage);
  realtimeData.current.push(data.current);

  if (realtimeData.labels.length > MAX_REALTIME_POINTS) {
    realtimeData.labels.shift();
    realtimeData.voltage.shift();
    realtimeData.current.shift();
  }

  updateRealtimeChart();

  // Update status pills based on real data
  const powerVal = data.power || data.voltage * data.current;
  document.getElementById('pillCharging').querySelector('.pill-dot').style.background =
    powerVal > 5 ? 'var(--info)' : 'var(--text-muted)';
  document.getElementById('pillSun').querySelector('.pill-dot').style.background =
    data.lightIntensity > 500 ? 'var(--primary)' : 'var(--text-muted)';
}

function handleStatusChange(data) {
  showToast(`Trạng thái ${data.panelId}: ${data.state}`, 'info');
  // Refresh status chart with real data
  fetchStatusData();
}

function handleAlert(data) {
  const toastType = data.severity === 'danger' ? 'error' : data.severity;
  showToast(`⚠️ ${data.message}`, toastType, 8000);
}

function updateKPIValue(id, value, unit) {
  const el = document.getElementById(id);
  if (!el) return;
  const numVal = typeof value === 'number' ? value.toFixed(value >= 100 ? 0 : 1) : value;
  el.innerHTML = `<span class="kpi-number kpi-flash">${numVal}</span><span class="kpi-unit">${unit}</span>`;
}

// REST API fallback when WebSocket is down
async function pollLatestReading() {
  try {
    const res = await fetch(`${API_BASE}/api/realtime/latest/${PANEL_ID}`);
    const json = await res.json();
    if (json.success) handleNewReading(json.data);
  } catch (e) {
    console.warn('Polling failed:', e.message);
  }
}

// =============================================
// SERVO CONTROL
// =============================================
const servoSlider = document.getElementById('servoSlider');
const servoNeedle = document.getElementById('servoNeedle');
const servoAngleDisplay = document.getElementById('servoAngleDisplay');

function updateServoVisual(angle) {
  if (servoNeedle) {
    const cssAngle = 180 - angle;
    servoNeedle.style.transform = `rotate(${cssAngle}deg)`;
  }
  if (servoAngleDisplay) servoAngleDisplay.textContent = angle + '°';
  if (servoSlider && !servoSlider._userDragging) servoSlider.value = angle;
}

async function sendServoCommand(angle) {
  try {
    const res = await fetch(`${API_BASE}/api/control/servo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angle: parseInt(angle) }),
    });
    const json = await res.json();
    if (json.success) {
      showToast(`🎮 Servo → ${angle}°`, 'success', 2000);
      updateServoVisual(angle);
    } else {
      showToast(`❌ ${json.error}`, 'error');
    }
  } catch (e) {
    showToast(`❌ Không thể điều khiển servo: ${e.message}`, 'error');
  }
}

let servoDebounce = null;
servoSlider.addEventListener('mousedown', () => { servoSlider._userDragging = true; });
servoSlider.addEventListener('mouseup', () => { servoSlider._userDragging = false; });
servoSlider.addEventListener('input', (e) => {
  const angle = e.target.value;
  updateServoVisual(angle);
  clearTimeout(servoDebounce);
  servoDebounce = setTimeout(() => sendServoCommand(angle), 300);
});

document.querySelectorAll('.servo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const angle = btn.dataset.angle;
    servoSlider.value = angle;
    updateServoVisual(angle);
    sendServoCommand(angle);
  });
});

// =============================================
// CHARTS — ALL DATA FROM API
// =============================================
let chartDaily = null;
let chartRealtime = null;
let chartStatus = null;

function renderAllCharts() {
  const t = getThemeTokens();
  renderRealtimeChart(t);
  fetchDailyData();
  fetchStatusData();
}

// ── Daily Power Chart (data from API) ──
async function fetchDailyData() {
  const t = getThemeTokens();
  const ctx = document.getElementById('chartDailyPower');
  if (chartDaily) chartDaily.destroy();

  let data = Array(24).fill(0);
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  try {
    const res = await fetch(`${API_BASE}/api/readings/daily/${PANEL_ID}`);
    const json = await res.json();
    if (json.success && json.data) {
      data = json.data;
    }
  } catch (e) {
    console.warn('Failed to fetch daily data:', e.message);
  }

  chartDaily = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Công Suất (W)',
        data,
        borderColor: t.primary,
        backgroundColor: createGradient(ctx, t.primary),
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: t.primary,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', cornerRadius: 10, padding: 12, displayColors: false,
          callbacks: { label: (ctx) => `⚡ ${ctx.parsed.y.toFixed(1)} W` } },
      },
      scales: {
        x: { grid: { color: t.borderColor, drawBorder: false }, ticks: { color: t.textMuted, maxTicksLimit: 12 } },
        y: { grid: { color: t.borderColor, drawBorder: false }, ticks: { color: t.textMuted, callback: v => v + 'W' }, beginAtZero: true },
      },
    },
  });
}

// ── Realtime V/A Chart (data from WebSocket) ──
function renderRealtimeChart(t) {
  const ctx = document.getElementById('chartRealtime');
  if (chartRealtime) chartRealtime.destroy();

  chartRealtime = new Chart(ctx, {
    type: 'line',
    data: {
      labels: realtimeData.labels,
      datasets: [
        {
          label: 'Voltage (V)',
          data: realtimeData.voltage,
          borderColor: t.primary,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          label: 'Current (A)',
          data: realtimeData.current,
          borderColor: t.info,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'top', labels: { color: t.textSecondary, font: { size: 11 } } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', cornerRadius: 10, padding: 10 },
      },
      scales: {
        x: { display: true, grid: { display: false }, ticks: { color: t.textMuted, maxTicksLimit: 8, font: { size: 9 } } },
        y: { grid: { color: t.borderColor, drawBorder: false }, ticks: { color: t.textMuted }, beginAtZero: true },
      },
    },
  });
}

function updateRealtimeChart() {
  if (!chartRealtime) return;
  chartRealtime.data.labels = realtimeData.labels;
  chartRealtime.data.datasets[0].data = realtimeData.voltage;
  chartRealtime.data.datasets[1].data = realtimeData.current;
  chartRealtime.update('none');
}

// ── System Status Doughnut (data from API) ──
async function fetchStatusData() {
  const t = getThemeTokens();
  const ctx = document.getElementById('chartSystemStatus');
  if (chartStatus) chartStatus.destroy();

  let statusData = [0, 0, 0]; // [charging, full, errors]

  try {
    const res = await fetch(`${API_BASE}/api/status/system/overview`);
    const json = await res.json();
    if (json.success && json.data) {
      statusData = [
        parseInt(json.data.charging) || 0,
        parseInt(json.data.full) || 0,
        parseInt(json.data.errors) || 0,
      ];
    }
  } catch (e) {
    console.warn('Failed to fetch status data:', e.message);
  }

  // Update doughnut center text
  const centerEl = document.getElementById('doughnutCenter');
  if (centerEl) {
    centerEl.querySelector('.doughnut-value').textContent = statusData[0] + '%';
  }

  chartStatus = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Đang Sạc', 'Đầy', 'Lỗi'],
      datasets: [{ data: statusData, backgroundColor: [t.info + 'cc', t.success + 'cc', t.danger + 'cc'],
        borderColor: [t.info, t.success, t.danger], borderWidth: 2, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { color: t.textSecondary, padding: 16, font: { size: 12, weight: 500 } } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', cornerRadius: 10, callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%` } },
      },
    },
  });
}

function createGradient(canvas, color) {
  const ctx = canvas.getContext ? canvas.getContext('2d') : canvas.ctx;
  const gradient = (ctx.createLinearGradient ? ctx : ctx.canvas.getContext('2d')).createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(0.6, color + '10');
  gradient.addColorStop(1, color + '00');
  return gradient;
}

// =============================================
// HISTORY TABLE — DATA FROM API
// =============================================
async function fetchHistory(days = 1) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">⏳ Đang tải dữ liệu...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/api/readings/history?panelId=${PANEL_ID}&days=${days}`);
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">📭 Chưa có dữ liệu. Kết nối Arduino và đợi 1-2 phút để dữ liệu được lưu.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(row => {
      const time = new Date(row.created_at).toLocaleString('vi-VN');
      const voltage = parseFloat(row.voltage).toFixed(1);
      const current = parseFloat(row.current).toFixed(1);
      const power = parseFloat(row.power).toFixed(1);
      const light = row.light_intensity || 0;
      const angle = row.servo_angle || 90;
      const pwr = parseFloat(row.power);
      const status = pwr > 5 ? 'charging' : 'full';
      const statusText = status === 'charging' ? 'Đang sạc' : 'Đầy';

      return `
        <tr>
          <td>${time}</td>
          <td>${voltage}</td>
          <td>${current}</td>
          <td>${power}</td>
          <td>${light}</td>
          <td>${angle}°</td>
          <td><span class="status-badge ${status}">${statusText}</span></td>
        </tr>
      `;
    }).join('');

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--danger);">❌ Lỗi tải dữ liệu: ${e.message}</td></tr>`;
  }
}

document.getElementById('filterChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  fetchHistory(parseInt(chip.dataset.filter));
  showToast(`📋 Đang tải dữ liệu ${chip.dataset.filter} ngày...`, 'info', 2000);
});

// =============================================
// UPTIME
// =============================================
let uptimeSeconds = 0;
function updateUptime() {
  uptimeSeconds++;
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const el = document.getElementById('infoUptime');
  if (el) el.textContent = `${h}h ${m}m`;
}
setInterval(updateUptime, 1000);

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  renderAllCharts();
  fetchHistory(1);
  updateServoVisual(90);
  connectWebSocket();
});
