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

let issues = [];

async function apiRequest(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "The server could not complete the request.");
  }
  return result;
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

issueList.addEventListener("click", async (event) => {
  const statusButton = event.target.closest("[data-status-id]");
  if (statusButton) {
    const issue = issues.find(
      (item) => item.id === statusButton.dataset.statusId,
    );
    if (!issue) return;
    const status =
      statusSequence[
        (statusSequence.indexOf(issue.status) + 1) % statusSequence.length
      ];
    statusButton.disabled = true;
    try {
      const updatedIssue = await apiRequest(
        `/api/issues/${encodeURIComponent(issue.id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      issues = issues.map((item) =>
        item.id === updatedIssue.id ? updatedIssue : item,
      );
      render();
      showToast(`Issue marked ${statusLabels[updatedIssue.status].toLowerCase()}.`);
    } catch (error) {
      console.error("Unable to update CivicPulse issue status.", error);
      showToast("The issue status could not be updated. Please try again.");
      statusButton.disabled = false;
    }
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

document.querySelector("#report-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const issue = {
    title: String(values.get("title")).trim(),
    category: String(values.get("category")),
    priority: String(values.get("priority")),
    location: String(values.get("location")).trim(),
    description: String(values.get("description")).trim(),
  };
  const submitButton = form.querySelector('button[type="submit"]');
  const errorMessage = document.querySelector("#form-error");
  submitButton.disabled = true;
  errorMessage.classList.add("hidden");
  try {
    const createdIssue = await apiRequest("/api/issues", {
      method: "POST",
      body: JSON.stringify(issue),
    });
    issues.unshift(createdIssue);
    form.reset();
    dialog.close();
    showAllIssues = false;
    searchInput.value = "";
    statusFilter.value = "all";
    render();
    showToast("Report submitted. The city team will take a look.");
  } catch (error) {
    console.error("Unable to submit CivicPulse report.", error);
    errorMessage.textContent =
      "Your report could not be submitted. Please try again.";
    errorMessage.classList.remove("hidden");
  } finally {
    submitButton.disabled = false;
  }
});

apiRequest("/api/issues")
  .then((loadedIssues) => {
    issues = loadedIssues;
    render();
  })
  .catch((error) => {
    console.error("Unable to load CivicPulse reports.", error);
    showToast("Reports could not be loaded. Check that the backend is running.");
  });
