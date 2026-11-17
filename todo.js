const API_BASE_URL = window.location.port === "5500"
  ? `${window.location.protocol}//${window.location.hostname}:5000/api/todos`
  : "/api/todos";

const addForm = document.querySelector("#add-form");
const newTodoInput = document.querySelector("#new-todo");
const todoList = document.querySelector("#todo-list");
const todoCount = document.querySelector("#todo-count");
const emptyState = document.querySelector("#empty-state");
const emptyMessage = document.querySelector("#empty-message");
const storageMessage = document.querySelector("#storage-message");
const filterButtons = document.querySelectorAll(".filter-button");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editTodoInput = document.querySelector("#edit-todo");
const editErrorMessage = document.querySelector("#edit-error");
const cancelEditButton = document.querySelector("#cancel-edit");

let todos = [];
let activeFilter = "all";
let editingTodoId = null;

document.querySelector("#today").textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long"
}).format(new Date());

renderTodos();
loadTodos();

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = newTodoInput.value.trim();

  if (!text) {
    newTodoInput.focus();
    return;
  }

  const submitButton = addForm.querySelector('button[type="submit"]');
  const submitLabel = submitButton.firstChild;
  submitButton.disabled = true;
  submitLabel.textContent = "저장 중... ";
  storageMessage.textContent = "";

  try {
    const todo = await requestTodos("", { method: "POST", body: { text } });
    todos.unshift(todo);
    storageMessage.textContent = "";
    renderTodos();
    addForm.reset();
  } catch (error) {
    storageMessage.textContent = "백엔드에 저장하지 못했습니다. 서버와 MongoDB 설정을 확인해 주세요.";
    console.error("백엔드에 할 일을 저장하지 못했습니다.", error);
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = "추가 ";
    newTodoInput.focus();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    renderTodos();
  });
});

todoList.addEventListener("change", async (event) => {
  const checkbox = event.target;
  if (!checkbox.matches(".todo-checkbox")) return;

  const todo = todos.find((item) => item.id === checkbox.dataset.id);
  if (!todo) return;

  const completed = checkbox.checked;
  checkbox.disabled = true;
  storageMessage.textContent = "";

  try {
    const updatedTodo = await requestTodos(`/${encodeURIComponent(todo.id)}`, {
      method: "PATCH",
      body: { completed }
    });
    todo.completed = updatedTodo.completed;
    storageMessage.textContent = "";
    renderTodos();
  } catch (error) {
    checkbox.checked = todo.completed;
    checkbox.disabled = false;
    storageMessage.textContent = "완료 상태를 저장하지 못했습니다. 백엔드 서버를 확인해 주세요.";
    console.error("할 일 완료 상태를 저장하지 못했습니다.", error);
  }
});

todoList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const todo = todos.find((item) => item.id === button.dataset.id);
  if (!todo) return;

  if (button.dataset.action === "edit") {
    editingTodoId = todo.id;
    editTodoInput.value = todo.text;
    editErrorMessage.textContent = "";
    editDialog.showModal();
    editTodoInput.focus();
    editTodoInput.select();
  } else if (button.dataset.action === "delete") {
    button.disabled = true;
    storageMessage.textContent = "";

    try {
      await requestTodos(`/${encodeURIComponent(todo.id)}`, { method: "DELETE" });
      todos = todos.filter((item) => item.id !== todo.id);
      storageMessage.textContent = "";
      renderTodos();
    } catch (error) {
      storageMessage.textContent = "백엔드에서 할 일을 삭제하지 못했습니다. 서버를 확인해 주세요.";
      console.error("백엔드에서 할 일을 삭제하지 못했습니다.", error);
      button.disabled = false;
    }
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = editTodoInput.value.trim();
  if (!text) {
    editTodoInput.focus();
    return;
  }

  const todo = todos.find((item) => item.id === editingTodoId);
  if (!todo) {
    closeEditDialog();
    return;
  }

  const saveButton = editForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  cancelEditButton.disabled = true;
  saveButton.textContent = "저장 중...";
  editErrorMessage.textContent = "";

  try {
    const updatedTodo = await requestTodos(`/${encodeURIComponent(todo.id)}`, {
      method: "PATCH",
      body: { text }
    });
    todo.text = updatedTodo.text;
    storageMessage.textContent = "";
    renderTodos();
    closeEditDialog();
  } catch (error) {
    editErrorMessage.textContent = "백엔드에서 수정하지 못했습니다. 서버를 확인해 주세요.";
    console.error("백엔드에서 할 일을 수정하지 못했습니다.", error);
    editTodoInput.focus();
  } finally {
    saveButton.disabled = false;
    cancelEditButton.disabled = false;
    saveButton.textContent = "저장";
  }
});

cancelEditButton.addEventListener("click", closeEditDialog);
editDialog.addEventListener("cancel", (event) => {
  const saveButton = editForm.querySelector('button[type="submit"]');
  if (saveButton.disabled) event.preventDefault();
});
editDialog.addEventListener("close", () => {
  editingTodoId = null;
  editErrorMessage.textContent = "";
});

async function loadTodos() {
  storageMessage.textContent = "백엔드에서 할 일을 불러오는 중...";

  try {
    const result = await requestTodos();
    if (!Array.isArray(result) || result.some((todo) =>
      !todo ||
      typeof todo.id !== "string" ||
      typeof todo.text !== "string" ||
      typeof todo.completed !== "boolean"
    )) {
      throw new Error("백엔드 응답 형식이 올바르지 않습니다.");
    }

    todos = result;
    storageMessage.textContent = "";
  } catch (error) {
    storageMessage.textContent = "할 일을 불러오지 못했습니다. 서버와 MongoDB 설정을 확인해 주세요.";
    console.error("백엔드에서 할 일을 불러오지 못했습니다.", error);
  }

  renderTodos();
}

async function requestTodos(path = "", options = {}) {
  const headers = { Accept: "application/json" };
  const request = {
    method: options.method || "GET",
    headers
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, request);
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error(`백엔드 응답을 읽을 수 없습니다 (${response.status}).`, { cause: error });
  }

  if (!response.ok) {
    const message = result && typeof result.error === "string"
      ? result.error
      : `백엔드 요청에 실패했습니다 (${response.status}).`;
    throw new Error(message);
  }

  return result;
}

function renderTodos() {
  const visibleTodos = todos.filter((todo) => {
    if (activeFilter === "active") return !todo.completed;
    if (activeFilter === "completed") return todo.completed;
    return true;
  });
  const remainingCount = todos.filter((todo) => !todo.completed).length;

  todoCount.textContent = `남은 할 일 ${remainingCount}개`;
  todoList.replaceChildren(...visibleTodos.map(createTodoElement));
  emptyState.hidden = visibleTodos.length > 0;

  if (todos.length === 0) {
    emptyMessage.textContent = "아직 할 일이 없어요.\n새로운 할 일을 추가해 보세요.";
  } else if (visibleTodos.length === 0) {
    emptyMessage.textContent = activeFilter === "active"
      ? "진행 중인 할 일이 없어요."
      : "완료한 할 일이 없어요.";
  }
}

function createTodoElement(todo) {
  const item = document.createElement("li");
  item.className = `todo-item${todo.completed ? " is-completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.className = "todo-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.dataset.id = todo.id;
  checkbox.setAttribute("aria-label", `${todo.text} 완료`);

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;

  const actions = document.createElement("div");
  actions.className = "todo-actions";
  actions.append(
    createActionButton("edit", todo.id, "수정"),
    createActionButton("delete", todo.id, "삭제")
  );

  item.append(checkbox, text, actions);
  return item;
}

function createActionButton(action, id, label) {
  const button = document.createElement("button");
  button.className = `todo-action${action === "delete" ? " todo-action--delete" : ""}`;
  button.type = "button";
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  button.setAttribute("aria-label", `${label} 할 일`);
  return button;
}

function closeEditDialog() {
  if (editDialog.open) editDialog.close();
}
