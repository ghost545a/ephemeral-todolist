/**
 * Ephemeral Minimalist To-Do Web App — Phases 1–3
 * Core UI, Ephemeral In-Memory State Engine, File Import/Export System,
 * Refresh Guard, Keyboard Shortcuts & Toast Feedback
 *
 * Architectural Guarantee:
 * Zero persistence. All state lives strictly in memory (`tasks` array) and
 * resets completely on browser refresh.
 */

// --- Ephemeral In-Memory State ---
let tasks = [];
let currentFilter = "all"; // 'all' | 'active' | 'completed'
let editingTaskId = null;
let currentTheme = "light";
let pendingImportTasks = null;
let dragDepth = 0;

// Phase 3: Refresh guard (in-memory toggle, defaults ON every session) and
// a serialized snapshot of the last downloaded list to detect unsaved work.
let refreshGuardEnabled = true;
let lastSavedSnapshot = "[]";

// --- DOM Elements ---
const todoCard = document.getElementById("todo-card");
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptySubtitle = document.getElementById("empty-subtitle");
const activeCounter = document.getElementById("active-counter");
const clearCompletedBtn = document.getElementById("clear-completed-btn");
const filterTabs = document.querySelectorAll(".filter-tab");
const themeToggleBtn = document.getElementById("theme-toggle");

const countAllEl = document.getElementById("count-all");
const countActiveEl = document.getElementById("count-active");
const countCompletedEl = document.getElementById("count-completed");

// Phase 2 DOM Elements (Import / Export / Modal / Toast)
const importBtn = document.getElementById("import-btn");
const importFileInput = document.getElementById("import-file-input");
const exportWrapper = document.getElementById("export-wrapper");
const exportBtn = document.getElementById("export-btn");
const exportMenu = document.getElementById("export-menu");
const exportMenuItems = document.querySelectorAll(".export-menu-item");

const importModal = document.getElementById("import-modal");
const importModalDesc = document.getElementById("import-modal-desc");
const importCancelBtn = document.getElementById("import-cancel-btn");
const importReplaceBtn = document.getElementById("import-replace-btn");
const importMergeBtn = document.getElementById("import-merge-btn");

const toastContainer = document.getElementById("toast-container");

// Phase 3 DOM Elements (Refresh Guard / Save Status)
const refreshGuardToggle = document.getElementById("refresh-guard-toggle");
const saveStatus = document.getElementById("save-status");
const saveStatusText = document.getElementById("save-status-text");

// --- Theme Engine (In-Memory Only, Resets on Refresh) ---
function initTheme() {
  const systemPrefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(systemPrefersDark ? "dark" : "light");

  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        applyTheme(event.matches ? "dark" : "light");
      });
  }
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

// --- Task ID Helper ---
function createTaskId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- Toast Notification Engine ---
function showToast(message, type = "info") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  let iconSvg = "";
  if (type === "success") {
    iconSvg = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
  } else if (type === "error") {
    iconSvg = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`;
  } else {
    iconSvg = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`;
  }

  const badge = document.createElement("span");
  badge.className = "toast-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.innerHTML = iconSvg;

  const textSpan = document.createElement("span");
  textSpan.textContent = message;

  toast.appendChild(badge);
  toast.appendChild(textSpan);
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-leaving");
    setTimeout(() => {
      toast.remove();
    }, 180);
  }, 3200);
}

// --- Core State Mutations ---
function addTask(rawText) {
  const text = rawText.trim();
  if (!text) return;

  const newTask = {
    id: createTaskId(),
    text,
    completed: false,
    createdAt: Date.now(),
  };

  tasks = [newTask, ...tasks];
  render();
}

function toggleTask(id) {
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  render();
}

function startEditingTask(id) {
  editingTaskId = id;
  render();

  const editInput = taskList.querySelector(
    `.task-item[data-id="${id}"] .task-edit-input`
  );
  if (editInput) {
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }
}

function saveEditedTask(id, newRawText) {
  if (editingTaskId !== id) return;
  const trimmed = newRawText.trim();

  if (trimmed) {
    tasks = tasks.map((task) =>
      task.id === id ? { ...task, text: trimmed } : task
    );
  }

  editingTaskId = null;
  render();
}

function cancelEditingTask() {
  if (editingTaskId === null) return;
  editingTaskId = null;
  render();
}

function deleteTaskWithAnimation(id) {
  const itemEl = taskList.querySelector(`.task-item[data-id="${id}"]`);
  if (itemEl) {
    itemEl.classList.add("removing");
    setTimeout(() => {
      tasks = tasks.filter((task) => task.id !== id);
      if (editingTaskId === id) editingTaskId = null;
      render();
    }, 210);
  } else {
    tasks = tasks.filter((task) => task.id !== id);
    render();
  }
}

function clearCompletedTasks() {
  const completedCount = tasks.filter((task) => task.completed).length;
  if (completedCount === 0) return;

  const notifyCleared = () =>
    showToast(
      `Completed tasks cleared (${completedCount})`,
      "info"
    );

  const completedEls = taskList.querySelectorAll(".task-item.completed");
  if (completedEls.length > 0) {
    completedEls.forEach((el) => el.classList.add("removing"));
    setTimeout(() => {
      tasks = tasks.filter((task) => !task.completed);
      render();
      notifyCleared();
    }, 210);
  } else {
    tasks = tasks.filter((task) => !task.completed);
    render();
    notifyCleared();
  }
}

function setFilter(filter) {
  currentFilter = filter;
  editingTaskId = null;

  filterTabs.forEach((tab) => {
    const isMatch = tab.dataset.filter === filter;
    tab.classList.toggle("active", isMatch);
    tab.setAttribute("aria-selected", String(isMatch));
  });

  render();
}

// ==========================================================================
// PHASE 2: Download / Export Engine (.json & .txt)
// ==========================================================================
function getFormattedDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toggleExportMenu(forceState) {
  const isOpen =
    typeof forceState === "boolean" ? forceState : exportMenu.hidden;
  if (isOpen && tasks.length === 0) return;
  exportMenu.hidden = !isOpen;
  exportBtn.setAttribute("aria-expanded", String(isOpen));
}

function exportTasks(format = "json") {
  if (tasks.length === 0) {
    showToast("Add at least one task before exporting.", "error");
    return;
  }

  const dateStamp = getFormattedDateStamp();
  let content = "";
  let mimeType = "";
  let filename = "";

  if (format === "txt") {
    content = tasks
      .map((t) => `- [${t.completed ? "x" : " "}] ${t.text}`)
      .join("\n");
    mimeType = "text/plain;charset=utf-8";
    filename = `tasks-${dateStamp}.txt`;
  } else {
    const cleanPayload = tasks.map((t) => ({
      id: t.id,
      text: t.text,
      completed: Boolean(t.completed),
    }));
    content = JSON.stringify(cleanPayload, null, 2);
    mimeType = "application/json;charset=utf-8";
    filename = `tasks-${dateStamp}.json`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  toggleExportMenu(false);
  lastSavedSnapshot = serializeTasks();
  render();
  showToast(`List downloaded · ${filename}`, "success");
}

// ==========================================================================
// PHASE 3: Unsaved-Work Detection (in-memory snapshot comparison)
// ==========================================================================
function serializeTasks() {
  return JSON.stringify(
    tasks.map((t) => [t.id, t.text, Boolean(t.completed)])
  );
}

function hasUnsavedChanges() {
  return tasks.length > 0 && serializeTasks() !== lastSavedSnapshot;
}

// ==========================================================================
// PHASE 2: Upload / Import Engine (.json, .txt, .md) & Schema Validation
// ==========================================================================
function parseJsonTasks(rawContent) {
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("Invalid JSON file: could not parse JSON syntax.");
  }

  const candidateArray = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.tasks)
    ? parsed.tasks
    : null;

  if (!candidateArray) {
    throw new Error("Invalid JSON schema: expected an array of task objects.");
  }

  if (candidateArray.length === 0) {
    throw new Error("The uploaded JSON file contains an empty task list.");
  }

  const validatedTasks = [];
  for (let i = 0; i < candidateArray.length; i += 1) {
    const item = candidateArray[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Invalid task item at index ${i}: expected an object.`);
    }
    if (typeof item.text !== "string" || !item.text.trim()) {
      throw new Error(
        `Invalid task at index ${i}: missing or empty "text" property.`
      );
    }
    if (
      item.completed !== undefined &&
      typeof item.completed !== "boolean"
    ) {
      throw new Error(
        `Invalid task at index ${i}: "completed" must be a boolean.`
      );
    }

    validatedTasks.push({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : typeof item.id === "number"
          ? String(item.id)
          : createTaskId(),
      text: item.text.trim().slice(0, 280),
      completed: Boolean(item.completed),
      createdAt: Date.now() + i,
    });
  }

  return validatedTasks;
}

function parseTextTasks(rawContent) {
  const lines = rawContent.split(/\r?\n/);
  const parsedTasks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    // Ignore pure Markdown section headers (e.g. "# My Tasks")
    if (/^#{1,6}\s+/.test(line)) continue;

    // Match Markdown checklist: - [ ] Task, - [x] Task, * [X] Task
    const checklistMatch = line.match(/^[-*+]\s*\[([ xX])\]\s+(.*)$/);
    if (checklistMatch) {
      const isCompleted = checklistMatch[1].toLowerCase() === "x";
      const taskText = checklistMatch[2].trim();
      if (taskText) {
        parsedTasks.push({
          id: createTaskId(),
          text: taskText.slice(0, 280),
          completed: isCompleted,
          createdAt: Date.now() + i,
        });
      }
      continue;
    }

    // Match plain bullet or numbered item: "- Task", "* Task", "1. Task"
    const bulletMatch = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    const cleanText = bulletMatch ? bulletMatch[1].trim() : line;

    if (cleanText) {
      parsedTasks.push({
        id: createTaskId(),
        text: cleanText.slice(0, 280),
        completed: false,
        createdAt: Date.now() + i,
      });
    }
  }

  if (parsedTasks.length === 0) {
    throw new Error("No valid tasks found in the uploaded text file.");
  }

  return parsedTasks;
}

function processUploadedFile(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const isJson =
    fileName.endsWith(".json") || file.type === "application/json";
  const isText =
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    file.type === "text/plain" ||
    file.type === "text/markdown";

  if (!isJson && !isText) {
    showToast(
      "Unsupported file format. Please upload a .json, .txt, or .md file.",
      "error"
    );
    return;
  }

  if (file.size === 0) {
    showToast("The uploaded file is empty.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const rawContent = String(event.target?.result || "");
    if (!rawContent.trim()) {
      showToast("The uploaded file is empty.", "error");
      return;
    }

    try {
      const importedTasks = isJson
        ? parseJsonTasks(rawContent)
        : parseTextTasks(rawContent);

      handleParsedImport(importedTasks, file.name);
    } catch (err) {
      showToast(err.message || "Failed to parse uploaded file.", "error");
    }
  };

  reader.onerror = () => {
    showToast("Error reading file from your device.", "error");
  };

  reader.readAsText(file);
}

function pluralizeTasks(count) {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

function handleParsedImport(importedTasks, fileName) {
  if (tasks.length === 0) {
    tasks = importedTasks;
    // Freshly loaded from a file on disk, so nothing is unsaved yet.
    lastSavedSnapshot = serializeTasks();
    render();
    showToast(`${pluralizeTasks(importedTasks.length)} imported`, "success");
    return;
  }

  // Tasks already exist on screen: prompt with inline Replace vs Merge modal
  pendingImportTasks = importedTasks;
  importModalDesc.textContent = `Found ${pluralizeTasks(
    importedTasks.length
  )} in "${fileName}". Replace your current list or merge them together?`;
  importModal.hidden = false;
  importMergeBtn.focus();
}

function applyPendingImport(mode) {
  if (!pendingImportTasks) {
    closeImportModal();
    return;
  }

  const count = pendingImportTasks.length;

  if (mode === "replace") {
    tasks = [...pendingImportTasks];
    lastSavedSnapshot = serializeTasks();
    showToast(`${pluralizeTasks(count)} imported · list replaced`, "success");
  } else if (mode === "merge") {
    const existingIds = new Set(tasks.map((t) => t.id));
    const normalizedIncoming = pendingImportTasks.map((item) => ({
      ...item,
      id: existingIds.has(item.id) ? createTaskId() : item.id,
    }));
    tasks = [...normalizedIncoming, ...tasks];
    showToast(`${pluralizeTasks(count)} imported · merged`, "success");
  }

  closeImportModal();
  render();
}

function closeImportModal() {
  pendingImportTasks = null;
  importModal.hidden = true;
}

// --- Filtering & Derived Counts ---
function getFilteredTasks() {
  if (currentFilter === "active") {
    return tasks.filter((task) => !task.completed);
  }
  if (currentFilter === "completed") {
    return tasks.filter((task) => task.completed);
  }
  return tasks;
}

// --- Rendering ---
function render() {
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const activeCount = totalCount - completedCount;

  // Update Header Counter
  activeCounter.textContent =
    activeCount === 1 ? "1 active task" : `${activeCount} active tasks`;

  // Update Filter Badges
  countAllEl.textContent = String(totalCount);
  countActiveEl.textContent = String(activeCount);
  countCompletedEl.textContent = String(completedCount);

  // Update Clear Completed Button State
  clearCompletedBtn.disabled = completedCount === 0;

  // Update Export Button & Empty Tooltip State
  const isEmpty = totalCount === 0;
  exportBtn.disabled = isEmpty;
  exportWrapper.classList.toggle("is-empty", isEmpty);
  if (isEmpty) {
    toggleExportMenu(false);
  }

  // Update Save Status Indicator (Phase 3)
  updateSaveStatus();

  // Render Filtered Task List
  const visibleTasks = getFilteredTasks();
  taskList.innerHTML = "";

  if (visibleTasks.length === 0) {
    emptyState.hidden = false;
    updateEmptyStateCopy(totalCount);
  } else {
    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();

    visibleTasks.forEach((task) => {
      fragment.appendChild(createTaskElement(task));
    });

    taskList.appendChild(fragment);
  }
}

function updateEmptyStateCopy(totalCount) {
  if (totalCount === 0) {
    emptyTitle.textContent = "Mind like water";
    emptySubtitle.textContent =
      "Your ephemeral workspace is clear. Add a task above or drop a .json / .txt file here.";
  } else if (currentFilter === "active") {
    emptyTitle.textContent = "All caught up";
    emptySubtitle.textContent =
      "You have no active tasks remaining in this session.";
  } else if (currentFilter === "completed") {
    emptyTitle.textContent = "No completed tasks yet";
    emptySubtitle.textContent =
      "Check off a task to see it appear under Completed.";
  }
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = `task-item${task.completed ? " completed" : ""}`;
  li.dataset.id = task.id;

  const mainDiv = document.createElement("div");
  mainDiv.className = "task-main";

  // Completion Toggle Button
  const checkboxBtn = document.createElement("button");
  checkboxBtn.type = "button";
  checkboxBtn.className = "checkbox-btn";
  checkboxBtn.setAttribute(
    "aria-label",
    task.completed ? "Mark task as active" : "Mark task as completed"
  );
  checkboxBtn.setAttribute("aria-pressed", String(task.completed));
  checkboxBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;
  checkboxBtn.addEventListener("click", () => toggleTask(task.id));
  mainDiv.appendChild(checkboxBtn);

  // Task Content (Inline Edit Mode vs Display Mode)
  if (editingTaskId === task.id) {
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "task-edit-input";
    editInput.value = task.text;
    editInput.maxLength = 280;
    editInput.setAttribute("aria-label", "Edit task description");

    editInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveEditedTask(task.id, editInput.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditingTask();
      }
    });

    editInput.addEventListener("blur", () => {
      saveEditedTask(task.id, editInput.value);
    });

    mainDiv.appendChild(editInput);
  } else {
    const textSpan = document.createElement("span");
    textSpan.className = "task-text";
    textSpan.textContent = task.text;
    textSpan.title = "Double-click to edit";
    textSpan.addEventListener("dblclick", () => startEditingTask(task.id));
    mainDiv.appendChild(textSpan);
  }

  li.appendChild(mainDiv);

  // Action Buttons (Edit & Delete)
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "task-action-btn edit-btn";
  editBtn.title = "Edit task";
  editBtn.setAttribute("aria-label", "Edit task");
  editBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
  `;
  editBtn.addEventListener("click", () => startEditingTask(task.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "task-action-btn delete-btn";
  deleteBtn.title = "Delete task";
  deleteBtn.setAttribute("aria-label", "Delete task");
  deleteBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  `;
  deleteBtn.addEventListener("click", () => deleteTaskWithAnimation(task.id));

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);
  li.appendChild(actionsDiv);

  return li;
}

// --- Event Listeners ---
taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(taskInput.value);
  taskInput.value = "";
  taskInput.focus();
});

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setFilter(tab.dataset.filter);
  });
});

clearCompletedBtn.addEventListener("click", clearCompletedTasks);
themeToggleBtn.addEventListener("click", toggleTheme);

// Export Menu Listeners
exportBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleExportMenu();
});

exportMenuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const format = item.dataset.format || "json";
    exportTasks(format);
  });
});

document.addEventListener("click", (event) => {
  if (!exportMenu.hidden && !exportWrapper.contains(event.target)) {
    toggleExportMenu(false);
  }
});

// Import Button & File Input Listeners
importBtn.addEventListener("click", () => {
  importFileInput.value = "";
  importFileInput.click();
});

importFileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    processUploadedFile(file);
  }
});

// Import Conflict Modal Listeners
importCancelBtn.addEventListener("click", closeImportModal);
importReplaceBtn.addEventListener("click", () => applyPendingImport("replace"));
importMergeBtn.addEventListener("click", () => applyPendingImport("merge"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!importModal.hidden) {
      closeImportModal();
    }
    if (!exportMenu.hidden) {
      toggleExportMenu(false);
    }
  }
});

// Full-Window / Full-Card Drag-and-Drop Support
window.addEventListener("dragenter", (event) => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  dragDepth += 1;
  todoCard.classList.add("drag-over");
});

window.addEventListener("dragover", (event) => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

window.addEventListener("dragleave", (event) => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    todoCard.classList.remove("drag-over");
  }
});

window.addEventListener("drop", (event) => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  dragDepth = 0;
  todoCard.classList.remove("drag-over");

  const file = event.dataTransfer?.files?.[0];
  if (file) {
    processUploadedFile(file);
  }
});

// ==========================================================================
// PHASE 3: Save Status, Accidental Refresh Guard & Keyboard Shortcuts
// ==========================================================================
function updateSaveStatus() {
  if (!saveStatus) return;

  let state = "empty";
  let label = "Nothing to save";

  if (tasks.length > 0) {
    if (hasUnsavedChanges()) {
      state = "unsaved";
      label = "Unsaved changes";
    } else {
      state = "saved";
      label = "All changes downloaded";
    }
  }

  saveStatus.dataset.state = state;
  saveStatusText.textContent = label;
}

function setRefreshGuard(enabled) {
  refreshGuardEnabled = enabled;
  refreshGuardToggle.setAttribute("aria-checked", String(enabled));
}

refreshGuardToggle.addEventListener("click", () => {
  setRefreshGuard(!refreshGuardEnabled);
  showToast(
    refreshGuardEnabled
      ? "Refresh guard on — you'll be warned before losing unsaved tasks"
      : "Refresh guard off",
    "info"
  );
});

// Only warns when the guard is on AND there is undownloaded work in memory.
// If the user confirms, the page reloads and all state is wiped as usual —
// nothing is ever persisted.
window.addEventListener("beforeunload", (event) => {
  if (!refreshGuardEnabled || !hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = ""; // Required for legacy Chromium/Safari prompt
});

function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function focusTaskInput() {
  taskInput.focus();
  taskInput.select();
}

document.addEventListener("keydown", (event) => {
  const isMod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  // Cmd/Ctrl + K → focus new task input (works everywhere)
  if (isMod && !event.shiftKey && !event.altKey && key === "k") {
    event.preventDefault();
    focusTaskInput();
    return;
  }

  // Cmd/Ctrl + S → quick download as JSON (overrides browser "Save page")
  if (isMod && !event.shiftKey && !event.altKey && key === "s") {
    event.preventDefault();

    // Commit any in-progress inline edit so it's included in the download
    const active = document.activeElement;
    if (
      editingTaskId !== null &&
      active &&
      active.classList.contains("task-edit-input")
    ) {
      saveEditedTask(editingTaskId, active.value);
    }

    exportTasks("json");
    return;
  }

  // "/" → focus new task input (only when not already typing)
  if (
    event.key === "/" &&
    !isMod &&
    !event.altKey &&
    !isTypingContext(event.target)
  ) {
    event.preventDefault();
    focusTaskInput();
  }
});

// Show ⌘ instead of Ctrl in hints on Apple platforms
const isApplePlatform = /Mac|iPhone|iPad|iPod/i.test(
  navigator.userAgentData?.platform || navigator.platform || navigator.userAgent
);
if (isApplePlatform) {
  document.querySelectorAll(".mod-key").forEach((el) => {
    el.textContent = "⌘";
  });
}

// --- Initialize App ---
initTheme();
setRefreshGuard(true);
render();
