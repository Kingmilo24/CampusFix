const express = require("express");
const Database = require("better-sqlite3");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database("campusfix.db");

// Middleware
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "campusfix-demo-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false
    }
  })
);

// Database
db.prepare(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Homepage
app.use(express.static(path.join(__dirname, "public")));

// Student submits a report
app.post("/api/reports", (req, res) => {
  const { problem, location, description, phone } = req.body;

  if (!problem || !location || !description) {
    return res.status(400).json({
      error: "Problem, location and description are required."
    });
  }

  const result = db.prepare(`
    INSERT INTO reports
    (problem, location, description, phone)
    VALUES (?, ?, ?, ?)
  `).run(problem, location, description, phone || "");

  res.json({
    success: true,
    message: "Report submitted successfully.",
    id: result.lastInsertRowid
  });
});

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "campusfix123";

  if (username === adminUsername && password === adminPassword) {
    req.session.isAdmin = true;

    return res.json({
      success: true,
      message: "Login successful."
    });
  }

  res.status(401).json({
    success: false,
    message: "Invalid username or password."
  });
});

// Check admin login
app.get("/api/admin/check", (req, res) => {
  res.json({
    loggedIn: req.session.isAdmin === true
  });
});

// Get reports
app.get("/api/reports", (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const reports = db
    .prepare("SELECT * FROM reports ORDER BY id DESC")
    .all();

  res.json(reports);
});

// Update report status
app.patch("/api/reports/:id", (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const { status } = req.body;

  const allowedStatuses = [
    "Pending",
    "In Progress",
    "Resolved"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status."
    });
  }

  db.prepare(`
    UPDATE reports
    SET status = ?
    WHERE id = ?
  `).run(status, req.params.id);

  res.json({
    success: true,
    message: "Status updated."
  });
});

// Admin logout
app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true,
      message: "Logged out."
    });
  });
});

app.listen(PORT, () => {
  console.log(`CampusFix running on port ${PORT}`);
});
