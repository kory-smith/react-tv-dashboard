// Seed script for D1 database
// Run with: wrangler d1 execute react_tv_dashboard --file=./d1/seed.sql

const bcrypt = require('bcryptjs');

// Generate a hashed password for the admin user
async function generateHash() {
  const hash = await bcrypt.hash('password123', 10);
  console.log(`Admin password hash: ${hash}`);
}

// Call the function to generate the hash
generateHash().catch(console.error);

// You can use the generated hash in the SQL file
// Example contents for seed.sql:
/*
-- Insert default admin user
INSERT INTO Employee (name, wrongNumbers) VALUES ('Admin User', 0);

INSERT INTO User (
  email, 
  hashedPassword, 
  role, 
  employeeId,
  createdAt,
  updatedAt
) VALUES (
  'admin@example.com',
  '$2a$10$JJZaC8xvjOm1YJe0.hekOO8FB4hEt3byeBM4Z5hWCsmPD5xLxkN3S', -- password123
  'ADMIN',
  1,
  DATETIME('now'),
  DATETIME('now')
);

-- Insert sample employees
INSERT INTO Employee (name, wrongNumbers) VALUES ('John Doe', 2);
INSERT INTO Employee (name, wrongNumbers) VALUES ('Jane Smith', 0);
INSERT INTO Employee (name, wrongNumbers) VALUES ('Bob Johnson', 5);

-- Insert sample scores
INSERT INTO Score (employeeId, day, week, month) VALUES (1, 90, 85, 80);
INSERT INTO Score (employeeId, day, week, month) VALUES (2, 75, 80, 75);
INSERT INTO Score (employeeId, day, week, month) VALUES (3, 65, 70, 75);
INSERT INTO Score (employeeId, day, week, month) VALUES (4, 50, 60, 65);

-- Insert sample trend points
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (1, DATETIME('now', '-5 days'), 85);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (1, DATETIME('now', '-4 days'), 88);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (1, DATETIME('now', '-3 days'), 86);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (1, DATETIME('now', '-2 days'), 89);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (1, DATETIME('now', '-1 days'), 90);

INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (2, DATETIME('now', '-5 days'), 70);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (2, DATETIME('now', '-4 days'), 72);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (2, DATETIME('now', '-3 days'), 75);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (2, DATETIME('now', '-2 days'), 73);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (2, DATETIME('now', '-1 days'), 75);

INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (3, DATETIME('now', '-5 days'), 60);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (3, DATETIME('now', '-4 days'), 62);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (3, DATETIME('now', '-3 days'), 65);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (3, DATETIME('now', '-2 days'), 63);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (3, DATETIME('now', '-1 days'), 65);

INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (4, DATETIME('now', '-5 days'), 45);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (4, DATETIME('now', '-4 days'), 48);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (4, DATETIME('now', '-3 days'), 52);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (4, DATETIME('now', '-2 days'), 49);
INSERT INTO TrendPoint (employeeId, timestamp, score) VALUES (4, DATETIME('now', '-1 days'), 50);
*/ 