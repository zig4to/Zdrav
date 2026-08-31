/* Zdrav — preklop med temno in svetlo temo.
   Temna je privzeta (data-theme="dark" na <html>). Izbira se shrani v localStorage;
   uporabi se ze v <head> (glej index.html), da ob nalaganju ne utripne. */
(function () {
  var KEY = "zdrav-theme";
  var root = document.documentElement;

  function currentTheme() {
    return root.dataset.theme === "light" ? "light" : "dark";
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f8f4" : "#0d1410");
  }

  // Poskrbi za pravilno barvo statusne vrstice ob zagonu.
  setTheme(currentTheme());

  var btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", function () {
      setTheme(currentTheme() === "light" ? "dark" : "light");
    });
  }
})();
