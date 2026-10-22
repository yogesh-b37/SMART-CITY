const STORAGE_KEY = "civicpulse-issues-v1";

const sampleIssues = [
  {
    id: "CP-2408",
    title: "Pothole on Maple Street",
    category: "Roads & sidewalks",
    location: "Maple St & 4th Ave",
    status: "open",
    priority: "High",
    description: "Large pothole causing cars to swerve into the next lane.",
    createdAt: daysAgo(0),
  },
  {
    id: "CP-2407",
    title: "Broken streetlight near park",
    category: "Street lighting",
    location: "Riverside Park, north gate",
    status: "in-progress",
    priority: "Normal",
    description: "Streetlight has been out for several nights.",
    createdAt: daysAgo(1),
  },
  {
    id: "CP-2406",
    title: "Overflowing recycling bins",
    category: "Waste & recycling",
    location: "Oakwood Plaza",
    status: "open",
    priority: "Normal",
    description: "Public recycling bins are full and need collection.",
    createdAt: daysAgo(1),
  },
  {
    id: "CP-2405",
    title: "Fallen branch blocking sidewalk",
    category: "Parks & public spaces",
    location: "Willow Creek Trail",
    status: "in-progress",
    priority: "Urgent",
    description: "A large branch is blocking the walking path.",
    createdAt: daysAgo(2),
  },
  {
    id: "CP-2404",
    title: "Water pooling at crosswalk",
    category: "Water & drainage",
    location: "Pine St & 8th Avenue",
    status: "resolved",
    priority: "Normal",
    description: "Standing water at the pedestrian crossing after rain.",
    createdAt: daysAgo(3),
  },
  {
    id: "CP-2403",
    title: "Traffic signal timing issue",
    category: "Traffic & safety",
    location: "Central Blvd & 2nd St",
    status: "open",
    priority: "High",
    description: "The signal is not giving pedestrians enough crossing time.",
    createdAt: daysAgo(4),
  },
  {
    id: "CP-2402",
    title: "Damaged bench in public square",
    category: "Parks & public spaces",
    location: "Founders Square",
    status: "resolved",
    priority: "Normal",
    description: "One of the park benches has a damaged seat.",
    createdAt: daysAgo(7),
  },
  {
    id: "CP-2401",
    title: "Street sign needs replacement",
    category: "Roads & sidewalks",
    location: "Cedar Lane & 3rd St",
    status: "in-progress",
    priority: "Normal",
    description: "The street sign is difficult to read.",
    createdAt: daysAgo(12),
  },
];

const categoryDetails = {
  "Roads & sidewalks": { icon: "🛣️", className: "roads" },
  "Street lighting": { icon: "💡", className: "lighting" },
  "Waste & recycling": { icon: "♻️", className: "waste" },
  "Parks & public spaces": { icon: "🌳", className: "parks" },
  "Water & drainage": { icon: "💧", className: "water" },
  "Traffic & safety": { icon: "🚦", className: "traffic" },
  Other: { icon: "📍", className: "other" },
};

const statusLabels = {
  open: "Open",
  "in-progress": "In progress",
  resolved: "Resolved",
};
const statusSequence = ["open", "in-progress", "resolved"];
const issueList = document.querySelector("#issue-list");
const searchInput = document.querySelector("#issue-search");
const statusFilter = document.querySelector("#status-filter");
const dialog = document.querySelector("#report-dialog");
let showAllIssues = false;
let toastTimer;

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function loadIssues() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [...sampleIssues];
    const parsed = JSON.parse(saved);
    if (
      !Array.isArray(parsed) ||
      parsed.some((issue) => !isValidIssue(issue))
    ) {
      throw new Error("Saved issue data has an invalid format.");
    }
    return parsed;
  } catch (error) {
    console.error("Unable to load saved CivicPulse reports.", error);
    showToast(
      "Saved reports could not be loaded. Your new reports may not persist.",
    );
    return [...sampleIssues];
  }
}

function isValidIssue(issue) {
  return (
    issue !== null &&
    typeof issue === "object" &&
    typeof issue.id === "string" &&
    typeof issue.title === "string" &&
    typeof issue.category === "string" &&
    typeof issue.location === "string" &&
    statusSequence.includes(issue.status) &&
    typeof issue.createdAt === "string"
  );
}

let issues = loadIssues();

function saveIssues() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
    return true;
  } catch (error) {
    console.error("Unable to save CivicPulse reports.", error);
    showToast(
      "Your browser could not save this change. Check available storage and try again.",
    );
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function formatRelativeDate(value) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 0) return "Just now";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderIssues() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = statusFilter.value;
  const matching = issues.filter((issue) => {
    const matchesQuery =
      `${issue.title} ${issue.category} ${issue.location} ${issue.id}`
        .toLowerCase()
        .includes(query);
    return matchesQuery && (filter === "all" || issue.status === filter);
  });
  const visible = showAllIssues ? matching : matching.slice(0, 5);
  issueList.innerHTML = visible
    .map((issue) => {
      const category = categoryDetails[issue.category] || categoryDetails.Other;
      const priority = issue.priority || "Normal";
      const priorityClass =
        priority === "Urgent"
          ? "urgent"
          : priority === "High"
            ? "high"
            : "normal";
      return `<article class="issue-row">
      <div class="issue-icon ${category.className}" aria-hidden="true">${category.icon}</div>
      <div class="issue-main">
        <div class="issue-title"><span class="priority-mark ${priorityClass}"></span>${escapeHtml(issue.title)}</div>
        <div class="issue-meta"><span class="issue-location">${escapeHtml(issue.location)}</span><span class="issue-meta-separator">·</span><span>${escapeHtml(formatRelativeDate(issue.createdAt))}</span></div>
      </div>
      <div class="issue-end"><button type="button" class="status-pill ${issue.status}" data-status-id="${escapeHtml(issue.id)}" aria-label="Change status for ${escapeHtml(issue.title)}">${statusLabels[issue.status]}</button><button type="button" class="icon-button issue-menu" data-description-id="${escapeHtml(issue.id)}" aria-label="View details for ${escapeHtml(issue.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></div>
    </article>`;
    })
    .join("");
  document
    .querySelector("#empty-state")
    .classList.toggle("hidden", matching.length > 0);
  const loadMore = document.querySelector("#load-more");
  loadMore.classList.toggle("hidden", matching.length <= 5);
  loadMore.innerHTML = showAllIssues
    ? "Show fewer issues <span>↑</span>"
    : `Show all issues <span>↓</span>`;
  document.querySelector("#nav-count").textContent = String(issues.length);
}

function renderStats() {
  const open = issues.filter((issue) => issue.status !== "resolved").length;
  const resolved = issues.filter((issue) => issue.status === "resolved").length;
  const currentMonth = new Date();
  const resolvedThisMonth = issues.filter((issue) => {
    const date = new Date(issue.createdAt);
    return (
      issue.status === "resolved" &&
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  }).length;
  document.querySelector("#stat-total").textContent = String(issues.length);
  document.querySelector("#stat-open").textContent = String(open);
  document.querySelector("#stat-resolved").textContent =
    String(resolvedThisMonth);
  document.querySelector("#resolution-rate").textContent =
    `${issues.length ? Math.round((resolved / issues.length) * 100) : 0}%`;

  const totals = new Map();
  issues.forEach((issue) =>
    totals.set(issue.category, (totals.get(issue.category) || 0) + 1),
  );
  const categories = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const max = categories[0]?.[1] || 1;
  document.querySelector("#category-list").innerHTML =
    categories
      .map(([name, count]) => {
        const category = categoryDetails[name] || categoryDetails.Other;
        return `<div class="category-item"><span class="category-icon ${category.className}">${category.icon}</span><span class="category-name">${escapeHtml(name)}</span><span class="category-total">${count}</span><div class="category-track"><div class="category-fill" style="width:${Math.round((count / max) * 100)}%"></div></div></div>`;
      })
      .join("") || '<p class="category-empty">No reports yet.</p>';
}

function render() {
  renderIssues();
  renderStats();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

document.querySelector("#today-label").textContent =
  new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
document
  .querySelector("#open-report")
  .addEventListener("click", () => dialog.showModal());
document
  .querySelector("#close-report")
  .addEventListener("click", () => dialog.close());
document
  .querySelector("#cancel-report")
  .addEventListener("click", () => dialog.close());
document.querySelector("#view-all").addEventListener("click", () => {
  showAllIssues = true;
  renderIssues();
});
document.querySelector("#load-more").addEventListener("click", () => {
  showAllIssues = !showAllIssues;
  renderIssues();
});
searchInput.addEventListener("input", renderIssues);
statusFilter.addEventListener("change", renderIssues);

issueList.addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-status-id]");
  if (statusButton) {
    const issue = issues.find(
      (item) => item.id === statusButton.dataset.statusId,
    );
    if (!issue) return;
    const previousStatus = issue.status;
    issue.status =
      statusSequence[
        (statusSequence.indexOf(issue.status) + 1) % statusSequence.length
      ];
    if (!saveIssues()) {
      issue.status = previousStatus;
      return;
    }
    render();
    showToast(`Issue marked ${statusLabels[issue.status].toLowerCase()}.`);
    return;
  }
  const detailsButton = event.target.closest("[data-description-id]");
  if (detailsButton) {
    const issue = issues.find(
      (item) => item.id === detailsButton.dataset.descriptionId,
    );
    if (issue)
      showToast(issue.description || `${issue.category} · ${issue.location}`);
  }
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelector("#report-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const issue = {
    id: `CP-${String(Date.now()).slice(-6)}`,
    title: String(values.get("title")).trim(),
    category: String(values.get("category")),
    priority: String(values.get("priority")),
    location: String(values.get("location")).trim(),
    description: String(values.get("description")).trim(),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  issues.unshift(issue);
  if (!saveIssues()) {
    issues.shift();
    return;
  }
  form.reset();
  document.querySelector("#form-error").classList.add("hidden");
  dialog.close();
  showAllIssues = false;
  searchInput.value = "";
  statusFilter.value = "all";
  render();
  showToast("Report submitted. The city team will take a look.");
});

render();
