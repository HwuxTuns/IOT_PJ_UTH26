/**
 * 🧪 Arduino Simulator — Giả lập dữ liệu sensor để test Dashboard + Database
 * 
 * Script này thay thế Arduino thật, gửi data POST lên API mỗi giây.
 * Backend sẽ lưu vào DB và broadcast qua WebSocket.
 * 
 * Cách dùng:
 *   1. Chạy backend trước:  node src/server.js
 *   2. Chạy simulator:      node test-simulator.js
 *   3. Mở dashboard:        http://localhost:5000
 * 
 * Ctrl+C để dừng.
 */

const API_URL = 'http://localhost:5000/api/readings';
const PANEL_ID = 'PANEL-001';
const INTERVAL_MS = 1000; // Gửi mỗi 1 giây (giống Arduino thật)

// Trạng thái servo (thay đổi từ từ như tracking mặt trời)
let servoAngle = 90;
let servoDirection = 1;

/**
 * Tạo dữ liệu sensor thực tế theo thời gian trong ngày
 * Sáng: ánh sáng tăng dần → trưa đỉnh → chiều giảm
 * Tối: gần như không có
 */
function generateReading() {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const timeOfDay = hour + minute / 60; // 0.0 → 24.0

  // Cường độ ánh sáng theo giờ (mô phỏng mặt trời)
  let sunIntensity = 0;
  if (timeOfDay >= 5.5 && timeOfDay <= 18.5) {
    // Đỉnh lúc 12h, dạng sin
    sunIntensity = Math.sin((timeOfDay - 5.5) / 13 * Math.PI);
    sunIntensity = Math.max(0, sunIntensity);
  }

  // Thêm nhiễu ngẫu nhiên nhỏ (±5%) để giống thực tế
  const noise = () => 1 + (Math.random() - 0.5) * 0.1;

  // Điện áp: 0.5V (tối) → 21V (trưa nắng)
  const voltage = (0.5 + sunIntensity * 20.5) * noise();

  // Dòng điện: 0.05A (tối) → 5.5A (trưa nắng)
  const current = (0.05 + sunIntensity * 5.45) * noise();

  // Công suất
  const power = voltage * current;

  // Ánh sáng (lux): 10 (tối) → 8000 (trưa nắng)
  const lightIntensity = Math.round((10 + sunIntensity * 7990) * noise());

  // Servo tracking: xoay từ từ theo hướng mặt trời
  if (sunIntensity > 0.1) {
    // Ban ngày: servo track theo vị trí mặt trời (45°→135°)
    const targetAngle = Math.round(45 + (timeOfDay - 5.5) / 13 * 90);
    if (servoAngle < targetAngle) servoAngle++;
    else if (servoAngle > targetAngle) servoAngle--;
  } else {
    // Ban đêm: servo về vị trí nghỉ (90°)
    if (servoAngle < 90) servoAngle++;
    else if (servoAngle > 90) servoAngle--;
  }

  // Giới hạn servo 0-180
  servoAngle = Math.max(0, Math.min(180, servoAngle));

  return {
    panelId: PANEL_ID,
    voltage: +voltage.toFixed(2),
    current: +current.toFixed(2),
    power: +power.toFixed(2),
    lightIntensity,
    servoAngle,
  };
}

// ── Main Loop ──
let count = 0;
let errors = 0;

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║  🧪 Arduino Simulator — IoT Solar Panel         ║');
console.log('║  Gửi data mỗi 1 giây lên API backend           ║');
console.log('║  Backend sẽ lưu vào DB mỗi 60 giây (aggregate) ║');
console.log('║  Ctrl+C để dừng                                 ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
console.log(`📡 Target: ${API_URL}`);
console.log(`🔋 Panel:  ${PANEL_ID}`);
console.log(`⏱️  Interval: ${INTERVAL_MS}ms`);
console.log('');

const timer = setInterval(async () => {
  const data = generateReading();
  count++;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const status = res.ok ? '✅' : `⚠️  ${res.status}`;
    const now = new Date().toLocaleTimeString('vi-VN');

    process.stdout.write(
      `\r[${count.toString().padStart(5)}] ${status}  ${now}  ` +
      `V=${data.voltage.toFixed(1).padStart(5)}  ` +
      `I=${data.current.toFixed(1).padStart(4)}  ` +
      `P=${data.power.toFixed(1).padStart(6)}W  ` +
      `☀${data.lightIntensity.toString().padStart(5)}lux  ` +
      `🔄${data.servoAngle.toString().padStart(3)}°  `
    );

    // Log tổng hợp mỗi 60 giây
    if (count % 60 === 0) {
      console.log(`\n📊 Minute ${count / 60}: ${count} readings sent, ${errors} errors`);
      console.log(`   → Backend đã aggregate và lưu vào DB!`);
    }
  } catch (e) {
    errors++;
    if (errors <= 3) {
      console.error(`\n❌ Lỗi kết nối: ${e.message}`);
      console.error('   → Kiểm tra backend đang chạy: node src/server.js');
    }
    if (errors === 3) {
      console.error('   (Các lỗi tiếp theo sẽ không hiển thị)');
    }
  }
}, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(timer);
  console.log('\n');
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  📊 Tổng kết: ${count} readings, ${errors} errors`);
  console.log(`║  ⏱️  Thời gian: ${Math.floor(count / 60)} phút ${count % 60} giây`);
  console.log(`║  💾 DB đã lưu ~${Math.floor(count / 60)} aggregated records`);
  console.log('╚══════════════════════════════════════════════╝');
  process.exit(0);
});
