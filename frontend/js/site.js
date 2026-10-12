(function () {
  var root = document.documentElement;
  var toggle = document.querySelector(".nav-toggle"), nav = document.getElementById("nav");
  if (toggle) toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", open);
  });
  var tb = document.querySelector(".theme-btn");
  if (tb) tb.addEventListener("click", function () {
    var next = root.dataset.theme === "dark" ? "light" : "dark"; root.dataset.theme = next;
    try { localStorage.setItem("rl-theme", next); } catch (e) {}
  });
  // donation amount chips
  var amt = document.getElementById("amount");
  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      amt.value = c.dataset.amount;
      document.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c); });
    });
  });
  // gentle one-time reveal for cards
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .12 });
    document.querySelectorAll(".grid3 .card, .photo-card, .profile").forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }
  // confirm destructive admin actions
  document.querySelectorAll("form[data-confirm]").forEach(function (f) {
    f.addEventListener("submit", function (e) { if (!confirm(f.dataset.confirm)) e.preventDefault(); });
  });
})();
