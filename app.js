document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const resultsContainer = document.getElementById("results-container");
  const tableBody = document.getElementById("table-body");
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-btn");
  const tableHeaders = document.querySelectorAll("th[data-sort]");

  let allData = [];
  let currentSort = { column: null, direction: "asc" };

  // --- File Handling ---

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () =>
      dropZone.classList.remove("drag-over"),
    );
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      allData = parseINI(content);
      renderTable(allData);
      resultsContainer.classList.remove("hidden");
      dropZone.classList.add("hidden");
    };
    reader.readAsText(file);
  }

  // --- Parsing Logic ---

  function parseINI(data) {
    const lines = data.split(/\r?\n/);
    const records = [];
    let currentRecord = null;

    lines.forEach((line) => {
      line = line.trim();
      if (!line) return;

      // Match section header [Car@Track]
      const sectionMatch = line.match(/^\[(.*)@(.*)\]$/);
      if (sectionMatch) {
        if (currentRecord) records.push(currentRecord);
        currentRecord = {
          car: sectionMatch[1].trim(),
          track: sectionMatch[2].trim(),
          date: 0,
          time: 0,
        };
      } else if (currentRecord) {
        const [key, value] = line.split("=").map((s) => s.trim());
        if (key === "DATE") currentRecord.date = parseInt(value);
        if (key === "TIME") currentRecord.time = parseInt(value);
      }
    });

    if (currentRecord) records.push(currentRecord);
    return records;
  }

  // --- Formatting ---

  function formatDate(ms) {
    if (!ms) return "N/A";
    return new Date(ms).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatLapTime(ms) {
    if (!ms) return "N/A";
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(3);
    return `${minutes}:${seconds.padStart(6, "0")}`;
  }

  // --- UI Rendering & Search ---

  function renderTable(data) {
    tableBody.innerHTML = "";
    data.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${item.car}</td>
                <td>${item.track}</td>
                <td>${formatDate(item.date)}</td>
                <td><strong>${formatLapTime(item.time)}</strong></td>
            `;
      tableBody.appendChild(row);
    });
  }

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allData.filter(
      (item) =>
        item.car.toLowerCase().includes(term) ||
        item.track.toLowerCase().includes(term),
    );
    renderTable(filtered);
  });

  clearBtn.addEventListener("click", () => {
    allData = [];
    renderTable([]);
    resultsContainer.classList.add("hidden");
    dropZone.classList.remove("hidden");
    fileInput.value = "";
    searchInput.value = "";
  });

  // --- Sorting ---

  tableHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.getAttribute("data-sort");
      const direction =
        currentSort.column === column && currentSort.direction === "asc"
          ? "desc"
          : "asc";

      currentSort = { column, direction };

      const sorted = [...allData].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (typeof valA === "string") {
          return direction === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          return direction === "asc" ? valA - valB : valB - valA;
        }
      });

      renderTable(sorted);
    });
  });
});
