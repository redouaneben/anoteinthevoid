/**
 * Anote in the Void — script.js
 *
 * Concept:
 * - #slot: displays only the message from the server (GET /message). Read-only. Blur 8px initially.
 *   Unblur is visual and proportional to what the user types in #input-slot; #slot never shows typed text.
 * - #input-slot: compose area (max 240 chars). Unblurs #slot progressively. Cleared and hidden after send.
 * - #submit-btn: POST /message with #input-slot content. On success: "Sent!", then compose area disappears,
 *   #slot fully unblurs (never re-blurs), poetic line appears at bottom (in current UI language).
 * - Sent messages are stored for the next visitor; never shown in #slot to the current user.
 * - Language: UI strings and poetic lines come from ANOTE_I18N; selection stored in localStorage.
 *
 * Test: node server.js then http://localhost:3000
 */

(function () {
  "use strict";

  var STORAGE_KEY = "anote_lang";
  var DEFAULT_LANG = "en";
  var MAX_BLUR_PX = 8;
  var MAX_CHARS = 240;
  var DEFAULT_MESSAGE = "Someone was here before you.";
  var BLUR_REVEAL_MS = 700;

  var slot = document.getElementById("slot");
  var inputSlot = document.getElementById("input-slot");
  var submitBtn = document.getElementById("submit-btn");
  var composeArea = document.getElementById("compose-area");
  var poeticFooter = document.getElementById("poetic-footer");
  var langBtn = document.getElementById("lang-btn");
  var langDropdown = document.getElementById("lang-dropdown");

  if (!slot || !inputSlot || !submitBtn || !composeArea || !poeticFooter) return;

  slot.contentEditable = "false";
  slot.setAttribute("aria-readonly", "true");

  function getLang() {
    var code = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || DEFAULT_LANG;
    return typeof ANOTE_I18N !== "undefined" && ANOTE_I18N[code] ? code : DEFAULT_LANG;
  }

  function setLang(code) {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, code);
  }

  function t() {
    var code = getLang();
    return (typeof ANOTE_I18N !== "undefined" && ANOTE_I18N[code]) ? ANOTE_I18N[code] : ANOTE_I18N.en;
  }

  /** Apply current language to main page: title, placeholder, button label. */
  function applyLanguage() {
    var code = getLang();
    var cur = t();
    document.documentElement.lang = code === "zh" ? "zh-Hans" : code;
    document.title = cur.title;
    if (inputSlot) inputSlot.placeholder = cur.placeholder;
    if (submitBtn && !document.body.classList.contains("sent")) submitBtn.textContent = cur.buttonLeave;
  }

  /** Sets #slot content (server message only). Wraps in quotation marks for a quote style. */
  function setSlotMessage(text) {
    var raw = text || DEFAULT_MESSAGE;
    slot.textContent = "\u201C" + raw + "\u201D";
    slot.style.filter = "blur(" + MAX_BLUR_PX + "px)";
  }

  function updateBlurFromInput() {
    var len = inputSlot.value.length;
    var blur = Math.max(0, MAX_BLUR_PX - (len / MAX_CHARS) * MAX_BLUR_PX);
    slot.style.filter = "blur(" + blur + "px)";
  }

  function setSlotBlur(px) {
    slot.style.filter = "blur(" + Math.max(0, px) + "px)";
  }

  function autoResizeTextarea() {
    inputSlot.style.height = "auto";
    inputSlot.style.height = inputSlot.scrollHeight + "px";
  }

  function pickRandomPoetic() {
    var cur = t();
    var lines = cur.poetic;
    if (!lines || !lines.length) return "";
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function loadMessage() {
    fetch("/message")
      .then(function (res) {
        if (!res.ok) throw new Error("GET failed");
        return res.text();
      })
      .then(function (msg) {
        setSlotMessage(msg);
        inputSlot.value = "";
        updateBlurFromInput();
        autoResizeTextarea();
      })
      .catch(function () {
        setSlotMessage(DEFAULT_MESSAGE);
        inputSlot.value = "";
        updateBlurFromInput();
        autoResizeTextarea();
      });
  }

  function playSentFeedback() {
    var cur = t();
    inputSlot.value = "";
    autoResizeTextarea();
    submitBtn.disabled = true;
    submitBtn.textContent = cur.buttonSent;

    updateBlurFromInput();
    setSlotBlur(MAX_BLUR_PX);

    slot.style.transition = "filter " + (BLUR_REVEAL_MS / 1000) + "s ease-out";
    setSlotBlur(0);

    document.body.classList.add("sent");
    poeticFooter.textContent = pickRandomPoetic();
    document.body.classList.add("poetic-visible");
  }

  function buildLangDropdown() {
    if (!langDropdown || typeof ANOTE_LANGS === "undefined") return;
    var code = getLang();
    langDropdown.innerHTML = "";
    ANOTE_LANGS.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.role = "menuitem";
      btn.textContent = item.name;
      btn.className = "lang-option" + (item.code === code ? " current" : "");
      btn.dataset.lang = item.code;
      langDropdown.appendChild(btn);
    });
  }

  function openLangDropdown() {
    if (langBtn) langBtn.setAttribute("aria-expanded", "true");
    if (langDropdown) {
      langDropdown.setAttribute("aria-hidden", "false");
      langDropdown.classList.add("open");
    }
  }

  function closeLangDropdown() {
    if (langBtn) langBtn.setAttribute("aria-expanded", "false");
    if (langDropdown) {
      langDropdown.setAttribute("aria-hidden", "true");
      langDropdown.classList.remove("open");
    }
  }

  inputSlot.addEventListener("input", function () {
    updateBlurFromInput();
    autoResizeTextarea();
  });

  submitBtn.addEventListener("click", function () {
    var text = inputSlot.value.trim();
    if (!text || text.length > MAX_CHARS) return;

    submitBtn.disabled = true;

    fetch("/message", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: text,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("POST failed");
        return res.text();
      })
      .then(function () {
        playSentFeedback();
      })
      .catch(function () {
        setSlotMessage(DEFAULT_MESSAGE);
        loadMessage();
        submitBtn.disabled = false;
        applyLanguage();
      });
  });

  slot.addEventListener("focus", function (e) {
    e.preventDefault();
    inputSlot.focus();
  });
  slot.addEventListener("click", function (e) {
    e.preventDefault();
    inputSlot.focus();
  });

  if (langBtn && langDropdown) {
    langBtn.textContent = getLang().toUpperCase();
    buildLangDropdown();
    langBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (langDropdown.classList.contains("open")) closeLangDropdown();
      else openLangDropdown();
    });
    langDropdown.addEventListener("click", function (e) {
      var option = e.target.closest(".lang-option");
      if (!option || !option.dataset.lang) return;
      var code = option.dataset.lang;
      setLang(code);
      applyLanguage();
      langBtn.textContent = code.toUpperCase();
      buildLangDropdown();
      closeLangDropdown();
    });
    document.addEventListener("click", function () {
      if (langDropdown.classList.contains("open")) closeLangDropdown();
    });
  }

  applyLanguage();
  loadMessage();
})();
