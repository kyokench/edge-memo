"use strict";
function escapeMemoHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function createMemoBackupHtml(data, date = new Date()) {
  const escape = escapeMemoHtml;
  const cards = data.notes.map(note => `<article><h2>${escape(note.title)}</h2><small>更新: ${escape(new Date(note.updatedAt).toLocaleString("ja-JP"))}</small><pre>${escape(note.body)}</pre></article>`).join("");
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>ふたつのメモ — バックアップ</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f8f9fc;color:#24314a;font:16px/1.8 "Segoe UI","Yu Gothic UI",sans-serif}main{max-width:1000px;margin:auto;padding:36px 24px}h1{font-size:28px;margin-bottom:0}header p,small{color:#6d7890}article{padding:24px;background:white;border:1px solid #dce2ed;border-radius:14px;margin:20px 0}h2{font-size:20px;margin:0 0 8px;overflow-wrap:anywhere}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:16px 0 0}.badge{color:#486abb;font-weight:600}@media print{body{background:white}main{padding:0}article{break-inside:avoid}}</style></head><body><main>
<header><span class="badge">ふたつのメモ / HTMLバックアップ</span><h1>保存したメモ</h1><p>出力日時: ${escape(date.toLocaleString("ja-JP"))}<br>このファイルは出力時点の閲覧用バックアップです。拡張の変更は反映されません。</p></header>
<article><h2>一時メモ</h2><pre>${escape(data.scratch || "（空のメモ）")}</pre></article>
<h2>通常メモ（${data.notes.length}件）</h2>${cards || "<p>通常メモはありません。</p>"}
</main></body></html>`;
}
