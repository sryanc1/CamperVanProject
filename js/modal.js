// ── modal.js ─────────────────────────────────────────────────
// Generic modal system: form modals + confirm dialogs.

let modalResolve = null;
const overlay = () => document.getElementById("modal-overlay");

export function showModal(fields, title) {
  return new Promise(resolve => {
    modalResolve = resolve;
    const fieldsHTML = fields.map(f => `
      <label class="modal-label">
        ${f.label}
        <input type="${f.type || "text"}" name="${f.name}" class="modal-input"
          value="${f.default || ""}" placeholder="${f.placeholder || ""}"
          ${f.required ? "required" : ""} />
      </label>`).join("");

    overlay().innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <form id="modal-form">
          ${fieldsHTML}
          <div class="modal-actions">
            <button type="button" class="btn-secondary" data-modal="cancel">Cancel</button>
            <button type="submit" class="btn-primary">Confirm</button>
          </div>
        </form>
      </div>`;
    overlay().style.display = "flex";
    setTimeout(() => { const f = document.querySelector("#modal-form input"); if (f) f.focus(); }, 50);
  });
}

export function showConfirm(message) {
  return new Promise(resolve => {
    modalResolve = resolve;
    overlay().innerHTML = `
      <div class="modal">
        <p class="modal-confirm-msg">${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-modal="cancel">Cancel</button>
          <button type="button" class="btn-danger" data-modal="confirm">Remove</button>
        </div>
      </div>`;
    overlay().style.display = "flex";
  });
}

export function closeModal(result) {
  overlay().style.display = "none";
  overlay().innerHTML = "";
  if (modalResolve) { modalResolve(result); modalResolve = null; }
}

export function initModalListeners() {
  overlay().addEventListener("click", e => {
    if (e.target === overlay()) closeModal(null);
    if (e.target.dataset.modal === "cancel")  closeModal(null);
    if (e.target.dataset.modal === "confirm") closeModal(true);
  });
  overlay().addEventListener("submit", e => {
    if (e.target.id === "modal-form") {
      e.preventDefault();
      closeModal(Object.fromEntries(new FormData(e.target)));
    }
  });
}