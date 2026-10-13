"use strict";
const $ = id => document.getElementById(id);
let data = { scratch: "", notes: [] }, editing = null, viewing = null, editingVersion = null, queue = Promise.resolve();
function status(message) { $("status").textContent = message; }
function persist(next, fields = ["notes"]) {
  const snapshot = structuredClone(next);
  queue = queue.catch(() => {}).then(async () => {
    const stored = await chrome.storage.local.get("memoData");
    const merged = stored.memoData ? structuredClone(stored.memoData) : { scratch: "", notes: [] };
    for (const field of fields) merged[field] = snapshot[field];
    await chrome.storage.local.set({ memoData: merged });
  });
  return queue;
}
function switchTab(temp) {
  $("tempPanel").hidden = !temp; $("notesPanel").hidden = temp;
  $("tempTab").setAttribute("aria-selected", String(temp));
  $("notesTab").setAttribute("aria-selected", String(!temp));
}
function render() {
  $("count").textContent = data.notes.length;
  $("chars").textContent = data.scratch.length + "文字";
  const list = $("list"); list.replaceChildren();
  const query = $("search").value.toLocaleLowerCase();
  const notes = data.notes.filter(n => (n.title + "\n" + n.body).toLocaleLowerCase().includes(query));
  if (!notes.length) {
    const empty = document.createElement("p"); empty.className = "empty";
    empty.textContent = query ? "一致するメモがありません" : "まだメモがありません。\n「新規メモ」からはじめましょう。"; list.append(empty);
  }
  for (const note of notes) {
    const card = document.createElement("article"); card.className = "note";
    card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-label", note.title + "を開く");
    card.onclick = event => { if (!busy && !event.target?.closest("button")) openViewer(note); };
    card.onkeydown = event => {
      if (event.target !== card || busy) return;
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openViewer(note); }
    };
    const heading = document.createElement("h3"); heading.textContent = note.title;
    const body = document.createElement("p"); body.textContent = note.body;
    const bottom = document.createElement("div"); bottom.className = "note-bottom";
    const time = document.createElement("small"); time.textContent = new Date(note.updatedAt).toLocaleString("ja-JP");
    const edit = document.createElement("button"); edit.textContent = "編集"; edit.onclick = () => openEditor(note);
    const remove = document.createElement("button"); remove.textContent = "削除"; remove.className = "danger";
    remove.onclick = () => action(async () => {
      if (!confirm("「" + note.title + "」を削除しますか？")) return;
      const next = { ...data, notes: data.notes.filter(n => n.id !== note.id) };
      await persist(next); data = next; render(); status("メモを削除しました");
    });
    bottom.append(time, edit, remove); card.append(heading, body, bottom); list.append(card);
  }
}
function openViewer(note) {
  viewing = note.id;
  $("viewTitle").textContent = note.title;
  $("viewDate").textContent = "更新: " + new Date(note.updatedAt).toLocaleString("ja-JP");
  $("viewBody").textContent = note.body;
  $("viewer").hidden = false; $("editor").hidden = true;
  $("list").hidden = true; $("search").hidden = true; $("newNote").hidden = true;
  $("backToList").focus();
}
$("backToList").onclick = () => { closeEditor(); render(); };
$("editViewed").onclick = () => {
  const note = data.notes.find(note => note.id === viewing);
  if (note) openEditor(note);
  else { closeEditor(); render(); status("このメモは削除されています"); }
};
function openEditor(note = null) {
  $("viewer").hidden = true;
  editing = note?.id ?? null; editingVersion = note ? JSON.stringify(note) : null; $("title").value = note?.title ?? ""; $("body").value = note?.body ?? "";
  $("editorHeading").textContent = note ? "メモを編集" : "新規メモ";
  $("editor").hidden = false; $("list").hidden = true; $("search").hidden = true; $("newNote").hidden = true;
  $("title").focus();
}
function closeEditor() { $("viewer").hidden = true; viewing = null;
  $("editor").hidden = true; $("list").hidden = false; $("search").hidden = false; $("newNote").hidden = false; editing = null;
}
let busy = false;
async function action(fn) {
  if (busy) return; busy = true; document.querySelectorAll("button,input,textarea").forEach(el => el.disabled = true);
  try { await queue; const latest = await chrome.storage.local.get("memoData"); if (latest.memoData) data = latest.memoData; await fn(); } catch (error) { console.error(error); status("処理に失敗しました。保存容量やファイルを確認して再試行してください。"); }
  finally { busy = false; document.querySelectorAll("button,input,textarea").forEach(el => el.disabled = false); }
}
$("tempTab").onclick = () => switchTab(true);
$("notesTab").onclick = () => switchTab(false);
$("scratch").oninput = () => {
  data.scratch = $("scratch").value; $("chars").textContent = data.scratch.length + "文字";
  status("保存中…"); persist(data, ["scratch"]).then(() => status("一時メモを保存しました")).catch(() => status("保存できませんでした。内容をコピーして保管してください。"));
};
$("clearTemp").onclick = () => action(async () => {
  if (!confirm("一時メモをすべて消去しますか？")) return;
  const next = { ...data, scratch: "" }; await persist(next, ["scratch"]); data = next; $("scratch").value = ""; render(); status("一時メモを消去しました");
});
$("keepTemp").onclick = () => {
  if (!data.scratch.trim()) return status("一時メモを入力してください");
  switchTab(false); openEditor(); $("body").value = data.scratch; $("title").value = data.scratch.split("\n")[0].slice(0, 200);
};
$("newNote").onclick = () => openEditor();
$("cancel").onclick = closeEditor;
$("search").oninput = render;
$("editor").onsubmit = event => {
  event.preventDefault(); action(async () => {
    const title = $("title").value.trim() || "無題のメモ", body = $("body").value;
    if (!body.trim() && !$("title").value.trim()) return status("タイトルまたは本文を入力してください");
    const now = new Date().toISOString();
    const previous = data.notes.find(n => n.id === editing); if (editing && JSON.stringify(previous) !== editingVersion) return status("このメモは別の画面で変更・削除されています。内容をコピーして新規メモとして保存してください。");
    const note = { id: previous?.id ?? crypto.randomUUID(), title, body, createdAt: previous?.createdAt ?? now, updatedAt: now };
    const next = { ...data, notes: [note, ...data.notes.filter(n => n.id !== note.id)] };
    await persist(next); data = next; closeEditor(); render(); status("メモを保存しました");
  });
};
$("export").onclick = () => action(async () => {
  await queue;
  const blob = new Blob([JSON.stringify({ format: "edge-two-memos", version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "ふたつのメモ-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); status("データをエクスポートしました");
});
$("import").onclick = () => $("file").click();
function validateImport(value) {
  if (!value || value.format !== "edge-two-memos" || value.version !== 1 || typeof value.scratch !== "string" || !Array.isArray(value.notes)) throw new Error("Unsupported backup");
  if (value.notes.length > 10000) throw new Error("Too many notes");
  for (const n of value.notes) {
    if (!n || typeof n.title !== "string" || typeof n.body !== "string" || typeof n.createdAt !== "string" || typeof n.updatedAt !== "string" || !Number.isFinite(Date.parse(n.createdAt)) || !Number.isFinite(Date.parse(n.updatedAt))) throw new Error("Invalid note");
  }
  return value;
}
$("file").onchange = () => action(async () => {
  try {
    const file = $("file").files[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) throw new Error("File too large");
    const imported = validateImport(JSON.parse(await file.text()));
    if (!confirm(imported.notes.length + "件のメモを追加します。一時メモは末尾に追加します。よろしいですか？")) return;
    const next = { scratch: [data.scratch, imported.scratch].filter(Boolean).join("\n\n"), notes: [...imported.notes.map(n => ({ ...n, id: crypto.randomUUID() })), ...data.notes] };
    await persist(next, ["scratch", "notes"]); data = next; $("scratch").value = data.scratch; render(); status("データをインポートしました");
  } finally { $("file").value = ""; }
});
async function init() {
  const stored = await chrome.storage.local.get("memoData");
  if (stored.memoData) {
    validateImport({ ...stored.memoData, format: "edge-two-memos", version: 1 });
    data = stored.memoData;
  }
  $("scratch").value = data.scratch; render(); switchTab(true);
}
document.querySelectorAll("button,input,textarea").forEach(el => el.disabled = true);
init().then(() => document.querySelectorAll("button,input,textarea").forEach(el => el.disabled = false))
  .catch(error => { console.error(error); status("データを読み込めませんでした。拡張を開き直してください。"); });


$("openLarge").onclick = () => action(async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") });
});
$("exportHtml").onclick = () => action(async () => {
  if (!$("editor").hidden && !confirm("編集中の内容は含まれません。保存済みのメモをHTMLに出力しますか？")) return;
  const blob = new Blob([createMemoBackupHtml(data)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "ふたつのメモ-" + new Date().toISOString().slice(0, 10) + ".html";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  status("HTMLを保存しました。ブラウザーで開いてメモを確認できます");
});
if (chrome.storage.onChanged) chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.memoData || busy) return;
  const next = changes.memoData.newValue;
  if (!next || JSON.stringify(next) === JSON.stringify(data)) return;
  data = next;
  $("scratch").value = data.scratch; render();
  if (!$("editor").hidden) status("別の画面でデータが更新されました。編集中の内容は保持しています");
});


