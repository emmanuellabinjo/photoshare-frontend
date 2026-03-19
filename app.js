// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = "https://photoshare-api.thankfulocean-8f670a50.eastus.azurecontainerapps.io/api";
// Change above URL to your actual App Service URL before deploying.

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser = null;
let currentToken = null;
let currentPhoto = null;
let offset = 0;
const LIMIT = 12;
let lastSearch = "";
let isAuthMode = "login"; // "login" | "register"

// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  const stored = localStorage.getItem("ps_token");
  const storedUser = localStorage.getItem("ps_user");
  if (stored && storedUser) {
    currentToken = stored;
    currentUser = JSON.parse(storedUser);
    updateNavAuth();
  }
  loadPhotos();

  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
})();

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function updateNavAuth() {
  const btnAuth = document.getElementById("btnAuth");
  const btnLogout = document.getElementById("btnLogout");
  const btnCreatorDash = document.getElementById("btnCreatorDash");
  const navUser = document.getElementById("navUser");

  if (currentUser) {
    btnAuth.style.display = "none";
    btnLogout.style.display = "";
    navUser.textContent = `👤 ${currentUser.displayName}`;
    btnCreatorDash.style.display = currentUser.role === "creator" ? "" : "none";
  } else {
    btnAuth.style.display = "";
    btnLogout.style.display = "none";
    btnCreatorDash.style.display = "none";
    navUser.textContent = "";
  }
}
function logout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem("ps_token");
  localStorage.removeItem("ps_user");
  updateNavAuth();
}

function openAuth() {
  document.getElementById("authOverlay").classList.add("open");
  document.getElementById("authEmail").focus();
}

function closeAuthOverlay(e) {
  if (e.target === document.getElementById("authOverlay")) {
    document.getElementById("authOverlay").classList.remove("open");
  }
}

function toggleAuth() {
  isAuthMode = isAuthMode === "login" ? "register" : "login";
  const isReg = isAuthMode === "register";
  document.getElementById("authTitle").textContent = isReg ? "Create Account" : "Sign In";
  document.getElementById("authSubtitle").textContent = isReg
    ? "Join PhotoShare as a viewer"
    : "Welcome back to PhotoShare";
  document.getElementById("nameGroup").style.display = isReg ? "" : "none";
  document.getElementById("authSubmit").textContent = isReg ? "Register" : "Sign In";
  document.getElementById("authToggleText").textContent = isReg
    ? "Already have an account? "
    : "New to PhotoShare? ";
  document.getElementById("authMsg").innerHTML = "";
}

async function submitAuth() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const displayName = document.getElementById("authName").value.trim();
  const msgEl = document.getElementById("authMsg");

  msgEl.innerHTML = "";

  if (!email || !password) {
    msgEl.innerHTML = '<div class="msg error">Email and password are required.</div>';
    return;
  }

  try {
    const endpoint =
      isAuthMode === "register"
        ? `${API_BASE}/auth/register`
        : `${API_BASE}/auth/login`;

    const body =
      isAuthMode === "register"
        ? { email, password, displayName }
        : { email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      msgEl.innerHTML = `<div class="msg error">${data.error || "Authentication failed"}</div>`;
      return;
    }

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem("ps_token", currentToken);
    localStorage.setItem("ps_user", JSON.stringify(currentUser));
    updateNavAuth();
    document.getElementById("authOverlay").classList.remove("open");

    // Redirect creator to creator dashboard
    if (currentUser.role === "creator") {
      window.location.href = "/creator.html";
    }
  } catch (err) {
    msgEl.innerHTML = '<div class="msg error">Network error. Please try again.</div>';
  }
}

// ─── PHOTOS ───────────────────────────────────────────────────────────────────
async function loadPhotos(reset = true) {
  if (reset) {
    offset = 0;
    document.getElementById("photoGrid").innerHTML = "";
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("emptyState").style.display = "none";

  try {
    const q = lastSearch ? `&q=${encodeURIComponent(lastSearch)}` : "";
    const res = await fetch(`${API_BASE}/photos?limit=${LIMIT}&offset=${offset}${q}`);
    const photos = await res.json();

    document.getElementById("loading").style.display = "none";

    if (photos.length === 0 && offset === 0) {
      document.getElementById("emptyState").style.display = "block";
    }

    photos.forEach((p) => renderPhotoCard(p));

    document.getElementById("btnLoadMore").style.display =
      photos.length === LIMIT ? "" : "none";
  } catch (err) {
    document.getElementById("loading").innerHTML =
      '<p style="color:#dc2626">Failed to load photos. Is the API running?</p>';
  }
}

function renderPhotoCard(photo) {
  const grid = document.getElementById("photoGrid");
  const card = document.createElement("div");
  card.className = "photo-card";
  card.onclick = () => openDetail(photo.id);

  const tags = (photo.tags || []).slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join("");
  const stars = "★".repeat(Math.round(photo.averageRating || 0)) +
    "☆".repeat(5 - Math.round(photo.averageRating || 0));

  card.innerHTML = `
    <img src="${photo.blobUrl}" alt="${escHtml(photo.title)}" loading="lazy"
         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22200%22><rect fill=%22%23e2e8f0%22 width=%22280%22 height=%22200%22/><text fill=%22%2364748b%22 x=%22140%22 y=%22105%22 text-anchor=%22middle%22 font-size=%2240%22>📷</text></svg>'" />
    <div class="photo-card-body">
      <div class="photo-card-title">${escHtml(photo.title)}</div>
      <div class="photo-card-meta">by ${escHtml(photo.creatorName || "Unknown")} ${photo.location ? "· 📍 " + escHtml(photo.location) : ""}</div>
      <div class="photo-card-tags">${tags}</div>
      <div class="photo-card-stats">
        <span class="stat" title="Rating">${stars} (${photo.ratingCount || 0})</span>
        <span class="stat" title="Comments">💬 ${photo.commentCount || 0}</span>
      </div>
    </div>
  `;
  grid.appendChild(card);
}

function doSearch() {
  lastSearch = document.getElementById("searchInput").value.trim();
  document.getElementById("feedLabel").textContent = lastSearch
    ? `Results for "${lastSearch}"`
    : "All Photos";
  loadPhotos(true);
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  lastSearch = "";
  document.getElementById("feedLabel").textContent = "All Photos";
  loadPhotos(true);
}

function loadMore() {
  offset += LIMIT;
  loadPhotos(false);
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
async function openDetail(photoId) {
  const overlay = document.getElementById("detailOverlay");
  overlay.classList.add("open");

  try {
    const [photoRes, commentsRes] = await Promise.all([
      fetch(`${API_BASE}/photos/${photoId}`),
      fetch(`${API_BASE}/comments/${photoId}`),
    ]);

    currentPhoto = await photoRes.json();
    const comments = await commentsRes.json();

    renderDetail(currentPhoto, comments);
  } catch (err) {
    document.getElementById("detailTitle").textContent = "Failed to load photo";
  }
}

function renderDetail(photo, comments) {
  document.getElementById("detailImg").src = photo.blobUrl;
  document.getElementById("detailImg").alt = photo.title;
  document.getElementById("detailTitle").textContent = photo.title;
  document.getElementById("detailCaption").textContent = photo.caption || "";

  const meta = [];
  if (photo.creatorName) meta.push(`📸 ${photo.creatorName}`);
  if (photo.location) meta.push(`📍 ${photo.location}`);
  if (photo.peopleTagged?.length) meta.push(`👥 ${photo.peopleTagged.join(", ")}`);
  meta.push(`🕒 ${new Date(photo.createdAt).toLocaleDateString()}`);
  document.getElementById("detailMeta").innerHTML = meta.map((m) => `<span>${m}</span>`).join("");

  const aiEl = document.getElementById("detailAiCaption");
  if (photo.aiCaption) {
    aiEl.style.display = "";
    aiEl.textContent = "🤖 AI: " + photo.aiCaption;
  } else {
    aiEl.style.display = "none";
  }

  const tagsEl = document.getElementById("detailTags");
  tagsEl.innerHTML = (photo.tags || []).map((t) => `<span class="tag">${t}</span>`).join("");

  // Stars
  setStars(photo.averageRating || 0);
  document.getElementById("starCount").textContent =
    `${photo.averageRating || 0} / 5 (${photo.ratingCount || 0} ratings)`;

  // Comments
  renderComments(comments);

  // Auth-gated actions
  const isLoggedIn = !!currentUser;
  document.getElementById("commentForm").style.display = isLoggedIn ? "flex" : "none";
  document.getElementById("commentLoginMsg").style.display = isLoggedIn ? "none" : "block";
  document.getElementById("starRating").style.pointerEvents = isLoggedIn ? "auto" : "none";
  document.getElementById("starRating").style.opacity = isLoggedIn ? "1" : "0.6";
}

function renderComments(comments) {
  const list = document.getElementById("commentsList");
  if (!comments.length) {
    list.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.5rem">No comments yet.</p>';
    return;
  }
  list.innerHTML = comments
    .map(
      (c) => `
    <div class="comment">
      <div class="comment-avatar">${c.displayName.charAt(0).toUpperCase()}</div>
      <div class="comment-bubble">
        <div class="comment-name">${escHtml(c.displayName)}</div>
        <div class="comment-text">${escHtml(c.text)}</div>
        <div class="comment-time">${new Date(c.createdAt).toLocaleDateString()}</div>
      </div>
    </div>`
    )
    .join("");
}

function closeDetail(e) {
  if (e.target === document.getElementById("detailOverlay")) {
    document.getElementById("detailOverlay").classList.remove("open");
    currentPhoto = null;
  }
}

function closeDetailBtn() {
  document.getElementById("detailOverlay").classList.remove("open");
  currentPhoto = null;
}

// ─── STARS ───────────────────────────────────────────────────────────────────
function setStars(avg) {
  const stars = document.querySelectorAll(".star");
  stars.forEach((s) => {
    s.classList.toggle("active", parseInt(s.dataset.val) <= Math.round(avg));
  });
}

async function rate(score) {
  if (!currentUser) { openAuth(); return; }
  if (!currentPhoto) return;

  try {
    const res = await fetch(`${API_BASE}/ratings/${currentPhoto.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ score }),
    });

    const data = await res.json();
    if (res.ok) {
      setStars(data.average);
      document.getElementById("starCount").textContent =
        `${data.average} / 5 (${data.count} ratings)`;
      currentPhoto.averageRating = data.average;
      currentPhoto.ratingCount = data.count;
    }
  } catch (err) {
    console.error("Rating failed:", err);
  }
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
async function postComment() {
  if (!currentUser) { openAuth(); return; }
  if (!currentPhoto) return;

  const input = document.getElementById("commentInput");
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`${API_BASE}/comments/${currentPhoto.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (res.ok) {
      input.value = "";
      currentPhoto.commentCount = (currentPhoto.commentCount || 0) + 1;
      // Re-fetch comments to show the new one
      const commentsRes = await fetch(`${API_BASE}/comments/${currentPhoto.id}`);
      const comments = await commentsRes.json();
      renderComments(comments);
    }
  } catch (err) {
    console.error("Comment failed:", err);
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
