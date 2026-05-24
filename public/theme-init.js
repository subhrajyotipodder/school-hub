(function () {
  var savedTheme = localStorage.getItem("school-hub-theme");
  var theme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
}());
