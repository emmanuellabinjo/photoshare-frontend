// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = "https://photoshare-api.thankfulocean-8f670a50.eastus.azurecontainerapps.io/api";
// Change above URL to your actual App Service URL before deploying.

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser = null;
let currentToken = null;
let selectedFile = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  const stored = localStorage.getItem("ps_token");
  const storedUser = localStorage.getItem("ps_user");

  if (stored && storedUser) {
    const user = JSON.parse(storedUser);
    if (user.role === "creator") {
      currentToken = stored;
      currentUser = user;
      showDashboard();
    } else {
      // Consumer account — show gate with message
      showLoginGate("You need a creator account to access this page.");
    }
  } else {
    showLoginGate();
  }
})();

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function showDashboard() {
  document.getElementById("loginGate").style.display = "none";
  document.getElementById("dashboard").style.display = "";
  document.getElementById("navUser").textContent = `🎨 ${currentUser.displayName}`;
  loadMyPhotos();
}

function showLoginGate(message) {
  document.getElementById("loginGate").style.display = "";
  document.getElementById("dashboard").style.display = "none";
  if (message) {
    document.getElementById("loginMsg").innerHTML =
      `<div class="msg error">${message}</div>`;
  }
}

async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msgEl = document.getElementById("loginMsg");
  msgEl.innerHTML = "";

  if (!email || !password) {
    msgEl.innerHTML = '<div class="msg error">Email and password are required.</div>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      msgEl.innerHTML = `<div class="msg error">${data.error || "Login failed"}</div>`;
      return;
    }

    if (data.user.role !== "creator") {
      msgEl.innerHTML =
        '<div class="msg error">This account does not have creator access. <a href="/">Go to consumer view →</a></div>';
      return;
    }

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem("ps_token", currentToken);
    localStorage.setItem("ps_user", JSON.stringify(currentUser));
    showDashboard();
  } catch (err) {
    msgEl.innerHTML = '<div class="msg error">Network error. Is the API running?</div>';
  }
}

function logout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem("ps_token");
  localStorage.removeItem("ps_user");
  window.location.href = "/";
}

// ─── FILE SELECTION ───────────────────────────────────────────────────────────
function handleFileSelect(event) {
  const file = event.target.files[0];
  setFile(file);
}

function handleDragOver(event) {
  event.preventDefault();
  document.getElementById("dropZone").classList.add("dragging");
}

function handleDragLeave() {
  document.getElementById("dropZone").classList.remove("dragging");
}

function handleDrop(event) {
  event.preventDefault();
  document.getElementById("dropZone").classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showUploadMsg("Only image files are allowed.", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showUploadMsg("File must be under 5 MB.", "error");
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById("previewImg");
    preview.src = e.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
  document.getElementById("uploadMsg").innerHTML = "";
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
async function uploadPhoto() {
  if (!selectedFile) {
    showUploadMsg("Please select a photo first.", "error");
    return;
  }

  const title = document.getElementById("uploadTitle").value.trim();
  if (!title) {
    showUploadMsg("Title is required.", "error");
    return;
  }

  const caption = document.getElementById("uploadCaption").value.trim();
  const location = document.getElementById("uploadLocation").value.trim();
  const peopleTagged = document.getElementById("uploadPeople").value.trim();

  const formData = new FormData();
  formData.append("photo", selectedFile);
  formData.append("title", title);
  if (caption) formData.append("caption", caption);
  if (location) formData.append("location", location);
  if (peopleTagged) formData.append("peopleTagged", peopleTagged);

  // Animate progress bar
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  progressWrap.style.display = "block";
  progressBar.style.width = "20%";

  const btnUpload = document.getElementById("btnUpload");
  btnUpload.disabled = true;
  btnUpload.textContent = "Uploading…";
  document.getElementById("uploadMsg").innerHTML = "";

  try {
    // Simulate progress
    let pct = 20;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 10, 85);
      progressBar.style.width = pct + "%";
    }, 300);

    const res = await fetch(`${API_BASE}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${currentToken}` },
      body: formData,
    });

    clearInterval(ticker);
    progressBar.style.width = "100%";

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Upload failed");
    }

    setTimeout(() => {
      progressWrap.style.display = "none";
      progressBar.style.width = "0%";
    }, 600);

    showUploadMsg(`✅ "${data.title}" uploaded successfully! AI tags: ${(data.tags || []).join(", ") || "none"}`, "success");

    // Reset form
    resetUploadForm();

    // Reload uploads grid
    loadMyPhotos();
  } catch (err) {
    progressWrap.style.display = "none";
    progressBar.style.width = "0%";
    showUploadMsg(`❌ ${err.message}`, "error");
  } finally {
    btnUpload.disabled = false;
    btnUpload.textContent = "🚀 Upload Photo";
  }
}

function resetUploadForm() {
  selectedFile = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("previewImg").style.display = "none";
  document.getElementById("previewImg").src = "";
  document.getElementById("uploadTitle").value = "";
  document.getElementById("uploadCaption").value = "";
  document.getElementById("uploadLocation").value = "";
  document.getElementById("uploadPeople").value = "";
}

function showUploadMsg(text, type) {
  document.getElementById("uploadMsg").innerHTML =
    `<div class="msg ${type}">${text}</div>`;
}

// ─── MY UPLOADS ───────────────────────────────────────────────────────────────
async function loadMyPhotos() {
  document.getElementById("loadingUploads").style.display = "block";
  document.getElementById("uploadsGrid").innerHTML = "";
  document.getElementById("uploadsEmpty").style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/photos/my`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    const photos = await res.json();
    document.getElementById("loadingUploads").style.display = "none";

    if (!photos.length) {
      document.getElementById("uploadsEmpty").style.display = "block";
      return;
    }

    photos.forEach(renderUploadCard);
  } catch (err) {
    document.getElementById("loadingUploads").innerHTML =
      '<p style="color:#dc2626">Failed to load uploads. Check your connection.</p>';
  }
}

function renderUploadCard(photo) {
  const grid = document.getElementById("uploadsGrid");
  const card = document.createElement("div");
  card.className = "upload-card";

  const stars =
    "★".repeat(Math.round(photo.averageRating || 0)) +
    "☆".repeat(5 - Math.round(photo.averageRating || 0));
  const tags = (photo.tags || [])
    .slice(0, 4)
    .map((t) => `<span class="tag">${escHtml(t)}</span>`)
    .join("");

  card.innerHTML = `
    <img src="${photo.blobUrl}" alt="${escHtml(photo.title)}" loading="lazy"
         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22160%22><rect fill=%22%23e2e8f0%22 width=%22240%22 height=%22160%22/><text fill=%22%2364748b%22 x=%22120%22 y=%2285%22 text-anchor=%22middle%22 font-size=%2240%22>📷</text></svg>'" />
    <div class="upload-card-body">
      <div class="upload-card-title">${escHtml(photo.title)}</div>
      <div class="upload-card-meta">
        ${photo.location ? "📍 " + escHtml(photo.location) + " · " : ""}
        ${new Date(photo.createdAt).toLocaleDateString()}
      </div>
      ${photo.aiCaption ? `<div class="ai-badge">🤖 ${escHtml(photo.aiCaption)}</div>` : ""}
      <div class="upload-card-tags">${tags}</div>
      <div class="upload-card-stats">
        <span>${stars} ${photo.averageRating || 0}/5</span>
        <span>💬 ${photo.commentCount || 0}</span>
        <span>👁 ${(photo.tags || []).length} tags</span>
      </div>
    </div>
  `;

  grid.appendChild(card);
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
