"""
🔌 Python Serial Bridge (2 chiều) — Kết nối Proteus COMPIM ↔ Backend
- Đọc sensor data từ Arduino → POST lên API
- Nhận lệnh servo từ Dashboard → Gửi xuống Arduino qua Serial

Cách dùng:
  1. Tạo cặp COM ảo bằng VSPE: COM3 ↔ COM4
  2. Proteus COMPIM dùng COM3
  3. Chạy: pip install pyserial requests flask
  4. Chạy: python bridge.py
  5. Sửa backend/.env: ARDUINO_BRIDGE=http://localhost:5001
"""
import serial
import requests
import threading
import time
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

# === CẤU HÌNH ===
SERIAL_PORT = 'COM4'       # Đầu bên kia của cặp VSPE (Proteus dùng COM3)
BAUD_RATE = 9600
API_URL = 'http://localhost:5000/api/readings'
BRIDGE_PORT = 5001          # Port nhận lệnh servo từ backend

ser = None  # Serial connection (global)


class ServoHandler(BaseHTTPRequestHandler):
    """HTTP handler nhận lệnh servo từ backend và gửi xuống Arduino"""

    def do_POST(self):
        if self.path == '/servo':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                angle = int(data.get('angle', 90))
                angle = max(0, min(180, angle))

                # Gửi lệnh xuống Arduino qua Serial
                command = f"SERVO:{angle}\n"
                ser.write(command.encode('utf-8'))
                print(f"\n🎮 Servo → {angle}° (sent to Arduino)")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'angle': angle}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Tắt log HTTP để console không bị spam


def start_servo_server():
    """Chạy HTTP server nhận lệnh servo trên port 5001"""
    server = HTTPServer(('0.0.0.0', BRIDGE_PORT), ServoHandler)
    print(f"🎮 Servo control server: http://localhost:{BRIDGE_PORT}/servo")
    server.serve_forever()


def parse_line(line):
    """Parse: PANEL-001|18.50|5.20|96.20|4500|90"""
    parts = line.strip().split('|')
    if len(parts) < 6:
        return None
    try:
        return {
            'panelId': parts[0],
            'voltage': float(parts[1]),
            'current': float(parts[2]),
            'power': float(parts[3]),
            'lightIntensity': int(parts[4]),
            'servoAngle': int(parts[5]),
        }
    except (ValueError, IndexError):
        return None


def serial_reader():
    """Đọc serial data từ Arduino và POST lên backend API"""
    global ser
    count = 0
    errors = 0

    while True:
        try:
            raw = ser.readline()
            if not raw:
                continue

            line = raw.decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            data = parse_line(line)
            if not data:
                continue

            count += 1

            try:
                res = requests.post(API_URL, json=data, timeout=2)
                status = "✅" if res.status_code == 201 else f"⚠️  {res.status_code}"
            except requests.exceptions.ConnectionError:
                status = "❌ Backend offline"
                errors += 1
            except Exception as e:
                status = f"❌ {e}"
                errors += 1

            sys.stdout.write(
                f"\r[{count:>5}] {status}  "
                f"V={data['voltage']:>6.2f}  "
                f"I={data['current']:>5.2f}  "
                f"P={data['power']:>7.2f}W  "
                f"☀{data['lightIntensity']:>5}lux  "
                f"🔄{data['servoAngle']:>3}°  "
            )
            sys.stdout.flush()

        except Exception as e:
            print(f"\nSerial read error: {e}")
            time.sleep(1)


def main():
    global ser

    print('')
    print('╔═══════════════════════════════════════════════════╗')
    print('║  🔌 Python Serial Bridge — Proteus ↔ Backend     ║')
    print('║  2 chiều: Đọc sensor + Điều khiển servo          ║')
    print('║  Ctrl+C để dừng                                  ║')
    print('╚═══════════════════════════════════════════════════╝')
    print('')

    # 1. Kết nối Serial
    print(f"🔌 Connecting to {SERIAL_PORT} @ {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    except serial.SerialException as e:
        print(f"❌ Cannot open {SERIAL_PORT}: {e}")
        print("   → Kiểm tra VSPE đã tạo cặp COM port chưa")
        print("   → Kiểm tra Proteus có đang dùng COM3 không")
        sys.exit(1)

    print(f"✅ Connected to {SERIAL_PORT}")
    print(f"📡 Sending data to {API_URL}")
    print('')

    # 2. Chạy servo control server (background thread)
    servo_thread = threading.Thread(target=start_servo_server, daemon=True)
    servo_thread.start()

    # 3. Đọc serial data (main thread)
    try:
        serial_reader()
    except KeyboardInterrupt:
        print('\n\n🔌 Bridge stopped.')
        ser.close()


if __name__ == '__main__':
    main()
