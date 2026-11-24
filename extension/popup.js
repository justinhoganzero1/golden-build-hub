document.getElementById("f").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("q").value.trim();
  chrome.tabs.create({ url: "https://oraclelunar.com/oracle" + (q ? "?q=" + encodeURIComponent(q) : "") });
});
