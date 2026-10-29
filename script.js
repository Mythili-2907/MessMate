const form = document.getElementById("feedbackForm");
const stars = [...document.querySelectorAll("#stars button")];
const ratingText = document.getElementById("ratingText");
const message = document.getElementById("message");
const list = document.getElementById("feedbackList");
let selectedRating = 0;
let adminToken = sessionStorage.getItem("messmateAdminToken") || "";
const labels = ["Very poor", "Poor", "Average", "Good", "Excellent"];

stars.forEach(button => button.addEventListener("click", () => {
  selectedRating = Number(button.dataset.rating);
  stars.forEach(star => star.classList.toggle("active", Number(star.dataset.rating) <= selectedRating));
  ratingText.textContent = `${labels[selectedRating - 1]} · ${selectedRating}/5`;
}));

form.addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "";
  if (!selectedRating) { message.textContent = "Please choose a star rating first."; return; }
  const payload = {
    student_name: document.getElementById("studentName").value.trim(),
    meal: document.getElementById("meal").value,
    rating: selectedRating,
    comments: document.getElementById("comments").value.trim()
  };
  try {
    const response = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not submit feedback.");
    message.textContent = result.message;
    form.reset(); selectedRating = 0;
    stars.forEach(star => star.classList.remove("active"));
    ratingText.textContent = "Tap a star to rate your meal";
    await loadFeedback();
  } catch (error) { message.textContent = error.message || "Server connection failed."; }
});

document.getElementById("mealFilter").addEventListener("change", loadFeedback);
document.getElementById("adminToggle").addEventListener("click", () => {
  document.getElementById("loginForm").classList.toggle("hidden");
});
document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const output = document.getElementById("loginMessage");
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("adminUsername").value,
        password: document.getElementById("adminPassword").value
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    adminToken = result.token;
    sessionStorage.setItem("messmateAdminToken", adminToken);
    output.textContent = "Admin login successful. Edit/delete controls enabled.";
    document.getElementById("adminToggle").textContent = "✓ Admin logged in";
    document.getElementById("adminControls").classList.remove("hidden");
    await loadFeedback();
  } catch (error) { output.textContent = error.message || "Login failed."; }
});

function adminHeaders() {
  return { "Content-Type": "application/json", "x-admin-token": adminToken };
}
async function loadFeedback() {
  list.replaceChildren();
  const filter = document.getElementById("mealFilter").value;
  try {
    const response = await fetch("/api/feedback" + (filter ? `?meal=${encodeURIComponent(filter)}` : ""));
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not load feedback.");
    document.getElementById("total").textContent = data.summary.total;
    document.getElementById("average").innerHTML = `${data.summary.average_rating ?? "0.0"}<span class="out-of"> / 5</span>`;
    const best = data.mealStats.filter(item => item.average_rating !== null).sort((a,b) => b.average_rating - a.average_rating)[0];
    document.getElementById("topMeal").textContent = best ? best.meal : "—";
    renderMealStats(data.mealStats);
    renderRatingStats(data.ratingStats, Number(data.summary.total));
    if (!data.feedbacks.length) {
      const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No feedback yet. Be the first to share!";
      list.append(empty); return;
    }
    data.feedbacks.forEach(item => list.append(renderCard(item)));
  } catch (error) {
    const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Could not load feedback. Check that the server is running.";
    list.append(empty);
  }
}
function renderMealStats(stats) {
  const container = document.getElementById("mealStats"); container.replaceChildren();
  ["Breakfast", "Lunch", "Dinner"].forEach(meal => {
    const item = stats.find(row => row.meal === meal);
    const row = document.createElement("div"); row.className = "bar-row";
    const label = document.createElement("span"); label.textContent = meal;
    const track = document.createElement("div"); track.className = "bar-track";
    const fill = document.createElement("div"); fill.className = "bar-fill";
    fill.style.width = `${item ? (Number(item.average_rating) / 5) * 100 : 0}%`; track.append(fill);
    const value = document.createElement("span"); value.className = "bar-value";
    value.textContent = item ? `${item.average_rating}/5` : "No ratings";
    row.append(label, track, value); container.append(row);
  });
}
function renderRatingStats(stats, total) {
  const container = document.getElementById("ratingStats"); container.replaceChildren();
  for (let rating = 5; rating >= 1; rating--) {
    const item = stats.find(row => row.rating === rating);
    const count = item ? Number(item.total) : 0;
    const row = document.createElement("div"); row.className = "bar-row";
    const label = document.createElement("span"); label.textContent = `${rating} star${rating > 1 ? "s" : ""}`;
    const track = document.createElement("div"); track.className = "bar-track";
    const fill = document.createElement("div"); fill.className = "bar-fill";
    fill.style.width = `${total ? count / total * 100 : 0}%`; track.append(fill);
    const value = document.createElement("span"); value.className = "bar-value"; value.textContent = `${count} (${total ? Math.round(count / total * 100) : 0}%)`;
    row.append(label, track, value); container.append(row);
  }
}
function renderCard(item) {
  const card = document.createElement("article"); card.className = "feedback-card";
  const title = document.createElement("h4"); title.textContent = item.student_name;
  const meta = document.createElement("div"); meta.className = "feedback-meta";
  const meal = document.createElement("span"); meal.className = "meal-pill"; meal.textContent = item.meal;
  const rating = document.createElement("span"); rating.className = "card-stars"; rating.textContent = "★".repeat(item.rating) + "☆".repeat(5 - item.rating);
  meta.append(meal, rating);
  const comment = document.createElement("p"); comment.className = "comment"; comment.textContent = item.comments;
  const date = document.createElement("time"); date.textContent = `Submitted ${item.created_at}`;
  card.append(title, meta, comment, date);
  if (adminToken) {
    const actions = document.createElement("div"); actions.className = "card-actions";
    const edit = document.createElement("button"); edit.className = "small-btn"; edit.textContent = "Edit";
    edit.addEventListener("click", () => editFeedback(item));
    const remove = document.createElement("button"); remove.className = "small-btn danger"; remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteFeedback(item.id));
    actions.append(edit, remove); card.append(actions);
  }
  return card;
}
async function editFeedback(item) {
  const student_name = prompt("Student name:", item.student_name); if (student_name === null) return;
  const meal = prompt("Meal (Breakfast, Lunch, Dinner):", item.meal); if (meal === null) return;
  const rating = Number(prompt("Rating (1-5):", item.rating)); if (!rating) return;
  const comments = prompt("Comment:", item.comments); if (comments === null) return;
  try {
    const response = await fetch(`/api/feedback/${item.id}`, {
      method: "PUT", headers: adminHeaders(),
      body: JSON.stringify({ student_name, meal, rating, comments })
    });
    const result = await response.json(); if (!response.ok) throw new Error(result.message);
    await loadFeedback(); alert(result.message);
  } catch (error) { alert(error.message || "Could not update feedback."); }
}
async function deleteFeedback(id) {
  if (!confirm("Delete this feedback permanently?")) return;
  try {
    const response = await fetch(`/api/feedback/${id}`, { method: "DELETE", headers: adminHeaders() });
    const result = await response.json(); if (!response.ok) throw new Error(result.message);
    await loadFeedback();
  } catch (error) { alert(error.message || "Could not delete feedback."); }
}
loadFeedback();
document.getElementById("adminToggle").addEventListener("click", function () {
    document.getElementById("admin").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});
document.getElementById("adminSignOut").addEventListener("click", () => {
    adminToken = "";
    sessionStorage.removeItem("messmateAdminToken");

    document.getElementById("adminControls").classList.add("hidden");
    document.getElementById("loginForm").classList.remove("hidden");

    document.getElementById("loginForm").reset();
    document.getElementById("loginMessage").textContent = "";
    document.getElementById("adminToggle").textContent = "♙ Admin login";

    loadFeedback();
    document.getElementById("loginForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});