/**
 * Context page — apply UI language from localStorage, no page reload.
 * Server-stored messages are unchanged; only interface strings switch.
 */
(function () {
  "use strict";
  var STORAGE_KEY = "anote_lang";
  var DEFAULT_LANG = "en";

  function getLang() {
    var code = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || DEFAULT_LANG;
    return ANOTE_I18N[code] ? code : DEFAULT_LANG;
  }

  function setLang(code) {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, code);
  }

  function applyLanguage(code) {
    var t = ANOTE_I18N[code];
    if (!t) return;
    document.documentElement.lang = code === "zh" ? "zh-Hans" : code;
    document.title = t.contextTitle + " — Anote in the Void";
    var titleEl = document.getElementById("context-title");
    var introEl = document.getElementById("context-intro");
    var fragileEl = document.getElementById("context-fragile");
    var backEl = document.getElementById("context-back");
    if (titleEl) titleEl.textContent = t.contextTitle;
    if (introEl) introEl.textContent = t.contextIntro;
    if (fragileEl) fragileEl.textContent = t.contextFragile;
    if (backEl) backEl.textContent = t.back;
  }

  function buildDropdown(container, currentCode) {
    if (!container || !ANOTE_LANGS) return;
    container.innerHTML = "";
    ANOTE_LANGS.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.role = "menuitem";
      btn.textContent = item.name;
      btn.className = "lang-option" + (item.code === currentCode ? " current" : "");
      btn.dataset.lang = item.code;
      container.appendChild(btn);
    });
  }

  function openDropdown(btn, dropdown) {
    btn.setAttribute("aria-expanded", "true");
    dropdown.setAttribute("aria-hidden", "false");
    dropdown.classList.add("open");
  }

  function closeDropdown(btn, dropdown) {
    btn.setAttribute("aria-expanded", "false");
    dropdown.setAttribute("aria-hidden", "true");
    dropdown.classList.remove("open");
  }

  function init() {
    var lang = getLang();
    applyLanguage(lang);

    var btn = document.getElementById("lang-btn");
    var dropdown = document.getElementById("lang-dropdown");
    if (!btn || !dropdown) return;

    btn.textContent = lang.toUpperCase();
    buildDropdown(dropdown, lang);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.contains("open");
      if (isOpen) closeDropdown(btn, dropdown);
      else openDropdown(btn, dropdown);
    });

    dropdown.addEventListener("click", function (e) {
      var option = e.target.closest(".lang-option");
      if (!option || !option.dataset.lang) return;
      var code = option.dataset.lang;
      setLang(code);
      applyLanguage(code);
      btn.textContent = code.toUpperCase();
      buildDropdown(dropdown, code);
      closeDropdown(btn, dropdown);
    });

    document.addEventListener("click", function () {
      if (dropdown.classList.contains("open")) closeDropdown(btn, dropdown);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
