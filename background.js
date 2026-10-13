"use strict";

// Configure toolbar clicks whenever the service worker starts.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.error("メモのサイドバーを設定できませんでした", error));
