const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Hostel@123";
const db = new Database(path.join(__dirname, "hostel.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    meal TEXT NOT NULL CHECK(meal IN ('Breakfast','Lunch','Dinner')),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comments TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();
function requireAdmin(req, res, next) {
  const token = req.get("x-admin-token");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ message: "Please log in as admin first." });
  }
  next();
}

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || "");
  const p = String(password || "");
  if (u !== ADMIN_USER || p !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Incorrect username or password." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  res.json({ message: "Login successful.", token });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  sessions.delete(req.get("x-admin-token"));
  res.json({ message: "Logged out." });
});

app.post("/api/feedback", (req, res) => {
  const { student_name, meal, rating, comments } = req.body || {};
  if (typeof student_name !== "string" || !student_name.trim() ||
      student_name.trim().length > 100 ||
      !["Breakfast", "Lunch", "Dinner"].includes(meal) ||
      !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof comments !== "string" || !comments.trim() || comments.length > 1000) {
    return res.status(400).json({ message: "Please enter a name, meal, 1–5 star rating, and comment (max 1000 characters)." });
  }
  const result = db.prepare(
    "INSERT INTO feedback (student_name, meal, rating, comments) VALUES (?, ?, ?, ?)"
  ).run(student_name.trim(), meal, rating, comments.trim());
  res.status(201).json({ message: "Feedback submitted successfully!", id: result.lastInsertRowid });
});

app.get("/api/feedback", (req, res) => {
  const meal = req.query.meal;
  const allowedMeals = ["Breakfast", "Lunch", "Dinner"];
  if (meal && !allowedMeals.includes(meal)) {
    return res.status(400).json({ message: "Invalid meal filter." });
  }
  const feedbacks = meal
    ? db.prepare("SELECT * FROM feedback WHERE meal = ? ORDER BY id DESC").all(meal)
    : db.prepare("SELECT * FROM feedback ORDER BY id DESC").all();
  const summary = db.prepare(`
    SELECT COUNT(*) AS total, ROUND(AVG(rating), 1) AS average_rating
    FROM feedback ${meal ? "WHERE meal = ?" : ""}
  `).get(...(meal ? [meal] : []));
  const mealStats = db.prepare(`
    SELECT meal, COUNT(*) AS total, ROUND(AVG(rating), 1) AS average_rating
    FROM feedback GROUP BY meal
  `).all();
  const ratingStats = db.prepare(`
    SELECT rating, COUNT(*) AS total FROM feedback GROUP BY rating ORDER BY rating
  `).all();
  res.json({ feedbacks, summary, mealStats, ratingStats });
});

app.put("/api/feedback/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { student_name, meal, rating, comments } = req.body || {};
  if (!Number.isSafeInteger(id) || id < 1 ||
      typeof student_name !== "string" || !student_name.trim() ||
      !["Breakfast", "Lunch", "Dinner"].includes(meal) ||
      !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof comments !== "string" || !comments.trim() ||
      student_name.trim().length > 100 || comments.length > 1000) {
    return res.status(400).json({ message: "Please enter valid feedback details." });
  }
  const result = db.prepare(`
    UPDATE feedback SET student_name = ?, meal = ?, rating = ?, comments = ?
    WHERE id = ?
  `).run(student_name.trim(), meal, rating, comments.trim(), id);
  if (!result.changes) return res.status(404).json({ message: "Feedback not found." });
  res.json({ message: "Feedback updated successfully." });
});

app.delete("/api/feedback/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid feedback ID." });
  const result = db.prepare("DELETE FROM feedback WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ message: "Feedback not found." });
  res.json({ message: "Feedback deleted successfully." });
});

app.listen(PORT, () => console.log(`Hostel Food Feedback System running at http://localhost:${PORT}`));
