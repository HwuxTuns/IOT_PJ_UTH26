-- =============================================
-- IoT Solar Panel Monitoring - Database Init
-- Version 2.0.0
-- =============================================

CREATE DATABASE IF NOT EXISTS iot_solar_db;
USE iot_solar_db;

-- Table 1: Solar Panels
CREATE TABLE IF NOT EXISTS solar_panels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) UNIQUE NOT NULL,
  location VARCHAR(255),
  angle INT DEFAULT 45,
  status ENUM('active','inactive','error') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_panel_id (panel_id),
  INDEX idx_status (status)
);

-- Table 2: Sensor Readings
CREATE TABLE IF NOT EXISTS sensor_readings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) NOT NULL,
  voltage DECIMAL(5,2),
  current DECIMAL(5,2),
  power DECIMAL(8,2) GENERATED ALWAYS AS (voltage * current) STORED,
  light_intensity INT,
  servo_angle INT DEFAULT 90,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Generated columns for indexing
  reading_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED,
  reading_hour TINYINT GENERATED ALWAYS AS (HOUR(created_at)) STORED,

  FOREIGN KEY (panel_id) REFERENCES solar_panels(panel_id),
  INDEX idx_panel_created (panel_id, created_at DESC),
  INDEX idx_time_series (panel_id, reading_date, reading_hour)
);

-- Table 3: Device Status
CREATE TABLE IF NOT EXISTS device_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) NOT NULL,
  state ENUM('charging','full','error') DEFAULT 'charging',
  error_code VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (panel_id) REFERENCES solar_panels(panel_id),
  INDEX idx_panel_created (panel_id, created_at DESC),
  INDEX idx_state (state)
);

-- Table 4: Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) NOT NULL,
  severity ENUM('low','medium','high') DEFAULT 'low',
  title VARCHAR(255),
  message TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (panel_id) REFERENCES solar_panels(panel_id),
  INDEX idx_resolved (is_resolved)
);

-- =============================================
-- Initial Data (chỉ đăng ký panel, không có data giả)
-- =============================================

-- Đăng ký panel cần thiết (FK cho sensor_readings)
INSERT IGNORE INTO solar_panels (panel_id, location, angle, status) VALUES
  ('PANEL-001', 'Rooftop A', 90, 'active');

-- Khởi tạo trạng thái ban đầu
INSERT IGNORE INTO device_status (panel_id, state) VALUES
  ('PANEL-001', 'charging');
