/* RETIRE 2026職青營會｜營友頁：答案只存本裝置 localStorage */
(function () {
  "use strict";

  /* 與同一 github.io 網域下其他頁面（例如迦南查經）分開：所有 key 都用此前綴 */
  var PREFIX = "retire2026:";
  var STORAGE_KEY = PREFIX + "answers";
  var HIGHLIGHT_KEY = PREFIX + "highlights";

  function $(id) { return document.getElementById(id); }

  function fieldEls() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-key]"));
  }

  function showToast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function loadAnswers() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      fieldEls().forEach(function (el) {
        var key = el.getAttribute("data-key");
        if (el.type === "checkbox") el.checked = !!data[key];
        else if (typeof data[key] === "string") el.value = data[key];
      });
      // 移除已不在頁面上的舊欄位（例如已刪除的「小組」欄 s17-group）
      var current = {};
      fieldEls().forEach(function (el) { current[el.getAttribute("data-key")] = true; });
      var stale = Object.keys(data).filter(function (k) { return k !== "savedAt" && !current[k]; });
      if (stale.length) {
        stale.forEach(function (k) { delete data[k]; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) { console.warn("loadAnswers failed", e); }
  }

  function collectAnswers() {
    var data = { savedAt: new Date().toISOString() };
    fieldEls().forEach(function (el) {
      data[el.getAttribute("data-key")] = el.type === "checkbox" ? el.checked : el.value;
    });
    return data;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectAnswers()));
      return true;
    } catch (e) { return false; }
  }

  function saveAnswers() {
    showToast(persist() ? "已儲存到本裝置" : "儲存失敗（本機空間可能不足）");
  }

  function clearAnswers() {
    if (!confirm("確定清除本裝置上這個營會頁的全部答案？")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    fieldEls().forEach(function (el) {
      if (el.type === "checkbox") el.checked = false; else el.value = "";
    });
    showToast("已清除");
  }

  /* —— 經文標黃（同範本做法，支援多段經文） —— */
  function isHighlightPunctuation(char) {
    return /[，。！？；：、,.!?;:「」『』（）()【】〔〕…—-]/.test(char);
  }

  function highlightTokens(text) {
    var tokens = [], current = "";
    function pushCurrent() {
      if (current) { tokens.push({ text: current, interactive: true }); current = ""; }
    }
    for (var i = 0; i < text.length; i += 1) {
      var char = text.charAt(i);
      if (/\s/.test(char)) { pushCurrent(); tokens.push({ text: char, interactive: false }); continue; }
      current += char;
      var next = text.charAt(i + 1);
      if (isHighlightPunctuation(char) || (current.length >= 8 && !isHighlightPunctuation(next))) pushCurrent();
    }
    pushCurrent();
    return tokens;
  }

  function readHighlights() {
    var saved = {};
    try {
      var ids = JSON.parse(localStorage.getItem(HIGHLIGHT_KEY) || "[]");
      if (Array.isArray(ids)) ids.forEach(function (id) { saved[id] = true; });
    } catch (e) { /* ignore */ }
    return saved;
  }

  function persistHighlights() {
    var ids = [];
    document.querySelectorAll(".hl-unit.highlighted").forEach(function (u) {
      ids.push(u.getAttribute("data-highlight-id"));
    });
    try { localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(ids)); }
    catch (e) { showToast("標記儲存失敗（本機空間可能不足）"); }
  }

  function setHighlight(unit, on) {
    unit.classList.toggle("highlighted", on);
    unit.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function initHighlights() {
    var saved = readHighlights();
    document.querySelectorAll(".scripture").forEach(function (scripture) {
      var passage = scripture.getAttribute("data-passage") || "p";
      scripture.querySelectorAll(".verse").forEach(function (verse) {
        var verseId = verse.id || (passage + "-x");
        var unitIndex = 0;
        Array.prototype.slice.call(verse.childNodes).forEach(function (node) {
          if (node.nodeType !== 3 || !node.nodeValue.trim()) return;
          var fragment = document.createDocumentFragment();
          highlightTokens(node.nodeValue).forEach(function (token) {
            if (!token.interactive) { fragment.appendChild(document.createTextNode(token.text)); return; }
            var unit = document.createElement("span");
            var id = verseId + "-" + unitIndex;
            unitIndex += 1;
            unit.className = "hl-unit";
            unit.setAttribute("data-highlight-id", id);
            unit.setAttribute("role", "button");
            unit.setAttribute("tabindex", "0");
            unit.setAttribute("aria-pressed", saved[id] ? "true" : "false");
            unit.textContent = token.text;
            if (saved[id]) unit.classList.add("highlighted");
            unit.addEventListener("click", function () {
              setHighlight(unit, !unit.classList.contains("highlighted")); persistHighlights();
            });
            unit.addEventListener("keydown", function (ev) {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                setHighlight(unit, !unit.classList.contains("highlighted")); persistHighlights();
              }
            });
            fragment.appendChild(unit);
          });
          node.parentNode.replaceChild(fragment, node);
        });
      });
    });

    document.querySelectorAll("[data-clear-highlights]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var session = btn.getAttribute("data-clear-highlights");
        document.querySelectorAll('.scripture[data-session="' + session + '"] .hl-unit.highlighted')
          .forEach(function (u) { setHighlight(u, false); });
        persistHighlights();
        showToast("已清除經文標記");
      });
    });
  }

  function flashTarget(target) {
    if (!target) return;
    target.classList.remove("verse-target-flash");
    void target.offsetWidth;
    target.classList.add("verse-target-flash");
    clearTimeout(target._flashTimer);
    target._flashTimer = setTimeout(function () { target.classList.remove("verse-target-flash"); }, 1300);
  }

  function initVerseLinks() {
    document.querySelectorAll('a.verse-ref[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function () {
        var target = $(link.getAttribute("href").slice(1));
        setTimeout(function () { flashTarget(target); }, 50);
      });
    });
  }

  /* —— 導覽列：標示目前所在的一節 —— */
  function initNavSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav-chips a[href^='#']"));
    var heads = links.map(function (a) { return $(a.getAttribute("href").slice(1)); });
    var nav = document.querySelector(".nav-chips");
    function update() {
      var offset = (nav ? nav.getBoundingClientRect().height : 0) + 24;
      var idx = 0;
      heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top - offset <= 0) idx = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) idx = heads.length - 1;
      links.forEach(function (a, i) {
        a.classList.toggle("active", i === idx);
        if (i === idx) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    }
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function init() {
    loadAnswers();
    initHighlights();
    initVerseLinks();
    initNavSpy();

    var saveBtn = $("btn-save"), clearBtn = $("btn-clear");
    if (saveBtn) saveBtn.addEventListener("click", saveAnswers);
    if (clearBtn) clearBtn.addEventListener("click", clearAnswers);

    // 自動儲存：輸入時（稍作延遲）及離開欄位時
    var timer;
    fieldEls().forEach(function (el) {
      el.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(persist, 400);
      });
      el.addEventListener("blur", persist);
      el.addEventListener("change", persist);
    });
    window.addEventListener("pagehide", persist);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
