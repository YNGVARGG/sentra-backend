-- Insert sample customers (password: 'password123' hashed with bcrypt)
INSERT INTO customers (phone, name, password_hash, address, emergency_contacts, medical_alerts) VALUES
('+254700123456', 'John Doe', '$2b$10$rHKJEtPZVXBiYFuGpjVpWeZjkPaLQPH4nNfmOm3nKoqTzLyFgfLmK', '123 Main St, Nairobi', 
 '[{"name": "Jane Doe", "phone": "+254700123457", "relationship": "wife"}]', 
 '[{"condition": "diabetes", "medication": "insulin", "notes": "severe"}]'),
('+254700123458', 'Alice Smith', '$2b$10$rHKJEtPZVXBiYFuGpjVpWeZjkPaLQPH4nNfmOm3nKoqTzLyFgfLmK', '456 Oak Ave, Mombasa', 
 '[{"name": "Bob Smith", "phone": "+254700123459", "relationship": "husband"}]', 
 '[]'),
('+254700123460', 'Michael Johnson', '$2b$10$rHKJEtPZVXBiYFuGpjVpWeZjkPaLQPH4nNfmOm3nKoqTzLyFgfLmK', '789 Pine Rd, Kisumu', 
 '[{"name": "Sarah Johnson", "phone": "+254700123461", "relationship": "daughter"}]', 
 '[{"condition": "heart condition", "medication": "beta blockers", "notes": "mild"}]');

-- Insert sample operators
INSERT INTO operators (name, email, password_hash, language_skills, center_location, shift_schedule, performance_metrics) VALUES
('Mary Operator', 'mary@sentra.com', '$2b$10$rHKJEtPZVXBiYFuGpjVpWeZjkPaLQPH4nNfmOm3nKoqTzLyFgfLmK', 
 ARRAY['English', 'Swahili'], 'Nairobi Center', 
 '{"shifts": [{"day": "Monday", "start": "08:00", "end": "16:00"}]}', 
 '{"response_time_avg": 45, "emergencies_handled": 127}'),
('Peter Responder', 'peter@sentra.com', '$2b$10$rHKJEtPZVXBiYFuGpjVpWeZjkPaLQPH4nNfmOm3nKoqTzLyFgfLmK', 
 ARRAY['English', 'French'], 'Mombasa Center', 
 '{"shifts": [{"day": "Tuesday", "start": "16:00", "end": "00:00"}]}', 
 '{"response_time_avg": 38, "emergencies_handled": 89}');

-- Insert sample devices
INSERT INTO devices (customer_id, type, location, status, battery_level) VALUES
(1, 'panic_button', 'bedroom', 'online', 85),
(1, 'door_sensor', 'front_door', 'online', 92),
(1, 'motion_detector', 'living_room', 'online', 78),
(2, 'panic_button', 'kitchen', 'online', 94),
(2, 'window_sensor', 'bedroom_window', 'offline', 23),
(3, 'panic_button', 'bathroom', 'online', 67),
(3, 'smoke_detector', 'kitchen', 'online', 88);

-- Insert sample emergencies
INSERT INTO emergencies (customer_id, device_id, severity, status, type, description, location_data) VALUES
(1, 1, 'high', 'resolved', 'panic', 'Customer pressed panic button', 
 '{"lat": -1.2921, "lng": 36.8219, "address": "123 Main St, Nairobi"}'),
(2, 4, 'medium', 'pending', 'intrusion', 'Door sensor triggered', 
 '{"lat": -4.0435, "lng": 39.6682, "address": "456 Oak Ave, Mombasa"}'),
(3, 7, 'high', 'in_progress', 'fire', 'Smoke detector activated', 
 '{"lat": -0.0917, "lng": 34.7680, "address": "789 Pine Rd, Kisumu"}');

-- Insert sample emergency responses
INSERT INTO emergency_responses (emergency_id, operator_id, action, response_time, notes) VALUES
(1, 1, 'contacted_customer', 32, 'Customer confirmed false alarm'),
(1, 1, 'dispatched_security', 45, 'Security team sent as precaution'),
(2, 2, 'attempted_contact', 28, 'Customer not responding to calls'),
(3, 1, 'contacted_fire_department', 18, 'Fire department dispatched immediately');