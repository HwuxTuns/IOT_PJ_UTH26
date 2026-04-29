#include <LiquidCrystal.h>
#include <Servo.h>

// 1. Khai báo chân LCD (RS, E, D4, D5, D6, D7)
LiquidCrystal lcd(12, 11, 5, 6, 3, 2);

// 2. Khai báo Servo
Servo solarServo;

// 3. Khai báo chân Cảm biến
const int ldrLeft = A0;   // LDR Trái
const int ldrRight = A1;  // LDR Phải
const int pinVolt = A2;   // Biến trở Điện áp
const int pinCurrent = A3; // Biến trở Dòng điện

int servoPos = 90; // Góc ban đầu của Servo (đứng giữa)

// Biến nhận lệnh từ Web Dashboard qua Serial
String serialBuffer = "";

void setup() {
  lcd.begin(16, 2);
  solarServo.attach(9);
  Serial.begin(9600);
  solarServo.write(servoPos);
  lcd.print("Khoi dong...");
  delay(1000);
  lcd.clear();
}

void loop() {
  // --- A. NHẬN LỆNH TỪ WEB DASHBOARD ---
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      serialBuffer.trim();
      // Lệnh điều khiển Servo: "SERVO:120"
      if (serialBuffer.startsWith("SERVO:")) {
        int angle = serialBuffer.substring(6).toInt();
        angle = constrain(angle, 0, 180);
        servoPos = angle;
        solarServo.write(servoPos);
      }
      serialBuffer = "";
    } else {
      serialBuffer += c;
    }
  }

  // --- B. ĐỌC ÁNH SÁNG & ĐIỀU KHIỂN SERVO TỰ ĐỘNG ---
  int lightLeft = analogRead(ldrLeft);
  int lightRight = analogRead(ldrRight);

  // Tự động xoay theo ánh sáng (nếu không có lệnh manual)
  if (lightLeft > lightRight + 50) {
    servoPos++; 
  } 
  else if (lightRight > lightLeft + 50) {
    servoPos--;
  }
  
  servoPos = constrain(servoPos, 0, 180);
  solarServo.write(servoPos);

  // --- C. ĐỌC ĐIỆN ÁP, DÒNG ĐIỆN & TÍNH CÔNG SUẤT ---
  float v_pin_A2 = analogRead(pinVolt) * (5.0 / 1023.0);
  float voltage = v_pin_A2 * ((10000.0 + 2200.0) / 2200.0);
  float current = analogRead(pinCurrent) * (5.0 / 1023.0); 
  float power = voltage * current;

  // Tính trung bình ánh sáng từ 2 LDR
  int lightAvg = (lightLeft + lightRight) / 2;

  // --- D. HIỂN THỊ LÊN LCD ---
  lcd.setCursor(0, 0);
  lcd.print("V:"); lcd.print(voltage, 1);
  lcd.print(" I:"); lcd.print(current, 1);
  lcd.print("   ");

  lcd.setCursor(0, 1);
  lcd.print("P:"); lcd.print(power, 1);
  lcd.print("W Ang:"); lcd.print(servoPos);
  lcd.print("  "); 

  // --- E. GỬI DỮ LIỆU QUA COMPIM (Lên Backend) ---
  // Format: PANEL-001|Voltage|Current|Power|LightAvg|ServoAngle
  Serial.print("PANEL-001|");
  Serial.print(voltage, 2);
  Serial.print("|");
  Serial.print(current, 2);
  Serial.print("|");
  Serial.print(power, 2);
  Serial.print("|");
  Serial.print(lightAvg);
  Serial.print("|");
  Serial.println(servoPos);

  delay(1000); // Gửi mỗi 1 giây (phù hợp với backend)
}
