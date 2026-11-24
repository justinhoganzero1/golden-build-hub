(() => {
  const q = new URLSearchParams(location.search).get("q");
  if (!q || document.getElementById("oracle-lunar-ask")) return;
  const a = document.createElement("a");
  a.id = "oracle-lunar-ask";
  a.href = "https://oraclelunar.com/oracle?q=" + encodeURIComponent(q);
  a.target = "_blank"; a.rel = "noopener";
  a.textContent = "🌙 Ask Oracle about this";
  a.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 14px;border-radius:999px;background:#0d1b22;color:#e6c46a;font:600 14px system-ui;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.3);border:1px solid #3aa8a0";
  document.body.appendChild(a);
})();
