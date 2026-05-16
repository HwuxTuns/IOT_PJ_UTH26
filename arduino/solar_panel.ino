#include <LiquidCrystal.h>
#include <Servo.h>

// 1. Khai báo chân LCD (RS, E, D4, D5, D6, D7)
LiquidCrystal lcd(12, 11, 5, 6, 3, 2);

// 2. Khai báo Servo
Servo solarServo;

// 3. Khai báo chân Cảm biến
const int ldrLeft = A0;   // LDR Trái
const int ldrRight = A1;  // LDR Phải
const int pinVolt = A2;    // Dây đo điện áp từ tấm pin (Solar Panel)
const int pinCurrent = A3; // Biến trở Dòng điện (RV1 trên mạch)

int servoPos = 90; // Góc ban đầu của Servo (đứng giữa)
bool isManual = false;

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
  // --- A. NHẬN LỆNH TỪ BACKEND ---
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.startsWith("SERVO:")) {
      isManual = true; // Chuyển sang chế độ thủ công khi nhận lệnh
      int manualAngle = input.substring(6).toInt();
      servoPos = constrain(manualAngle, 0, 180);
    } 
    else if (input == "AUTO") {
      isManual = false; // Quay lại chế độ tự động
    }
  }

  int lightLeft = analogRead(ldrLeft);
  int lightRight = analogRead(ldrRight);

  // --- B. CHỈ CHẠY LOGIC ĐUỔI NẮNG NẾU KHÔNG Ở CHẾ ĐỘ THỦ CÔNG ---
  if (!isManual) {
    if (lightLeft > lightRight + 50) {
      servoPos++; 
    } 
    else if (lightRight > lightLeft + 50) {
      servoPos--;
    }
  }

  servoPos = constrain(servoPos, 0, 180);
  solarServo.write(servoPos);

  // --- C. ĐỌC ĐIỆN ÁP, DÒNG ĐIỆN & TÍNH CÔNG SUẤT ---
  float v_pin_A2 = analogRead(pinVolt) * (5.0 / 1023.0); 
  float voltage = v_pin_A2 * ((10000.0 + 2200.0) / 2200.0); 

  float current = analogRead(pinCurrent) * (5.0 / 1023.0); 
  float power = voltage * current;
  // --- D. HIỂN THỊ LÊN LCD ---
  lcd.setCursor(0, 0);
  lcd.print("V:"); lcd.print(voltage, 1);
  lcd.print(" I:"); lcd.print(current, 1);
  lcd.print("   "); 

  lcd.setCursor(0, 1);
  lcd.print("P:"); lcd.print(power, 1);
  lcd.print("W Ang:"); lcd.print(servoPos);
  lcd.print("  "); 

  // --- E. GỬI DỮ LIỆU LÊN PYTHON BRIDGE ---
  Serial.print("PANEL-001,"); 
  Serial.print(voltage, 2);   
  Serial.print(",");
  Serial.print(current, 2);
  Serial.print(",");
  Serial.print(power, 2);
  Serial.print(",");
  Serial.print((lightLeft + lightRight) / 2); 
  Serial.print(",");
  Serial.println(servoPos);
  
  delay(1000); 
}
