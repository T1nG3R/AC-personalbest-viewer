document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const resultsContainer = document.getElementById("results-container");
  const tableBody = document.getElementById("table-body");
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-btn");
  const tableHeaders = document.querySelectorAll("th[data-sort]");
  const selectBtn = document.getElementById("select-btn");
  const copyPath = document.getElementById("copy-path");
  const instructions = document.getElementById("instructions");
  const errorMessage = document.getElementById("error-message");

  let allData = [];
  let currentSort = { column: null, direction: "asc" };

  // --- File Handling ---

  async function openFilePicker() {
    errorMessage.classList.add("hidden");
    if (window.showOpenFilePicker) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          id: 'assetto-corsa-pb',
          startIn: 'documents',
          types: [{
            description: 'INI Files',
            accept: { 'text/plain': ['.ini'] }
          }],
          multiple: false
        });
        const file = await fileHandle.getFile();
        handleFile(file);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('File System Access API error:', error);
          fileInput.click();
        }
      }
    } else {
      fileInput.click();
    }
  }

  selectBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openFilePicker();
  });

  copyPath.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText("Documents\\Assetto Corsa").then(() => {
      const originalText = copyPath.innerText;
      copyPath.innerText = "Copied!";
      copyPath.style.color = "#4CAF50";
      setTimeout(() => {
        copyPath.innerText = originalText;
        copyPath.style.color = "var(--accent-color)";
      }, 1500);
    });
  });

  dropZone.addEventListener("click", (e) => {
    if (window.getSelection().toString().length > 0) {
      return;
    }

    if (e.target !== fileInput && e.target !== selectBtn) {
      openFilePicker();
    }
  });

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
    errorMessage.classList.add("hidden");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", (e) => {
    errorMessage.classList.add("hidden");
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const data = parseINI(content);

      if (data.length === 0) {
        errorMessage.classList.remove("hidden");
        return;
      }

      errorMessage.classList.add("hidden");
      allData = data;
      refreshDisplay();
      resultsContainer.classList.remove("hidden");
      dropZone.classList.add("hidden");
      instructions.classList.add("hidden");
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
      month: "2-digit",
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
    refreshDisplay();
  });

  clearBtn.addEventListener("click", () => {
    allData = [];
    currentSort = { column: null, direction: "asc" };
    refreshDisplay();
    resultsContainer.classList.add("hidden");
    errorMessage.classList.add("hidden");
    dropZone.classList.remove("hidden");
    instructions.classList.remove("hidden");
    fileInput.value = "";
    searchInput.value = "";
  });

  // --- Sorting & Display Refresh ---

  function refreshDisplay() {
    const term = searchInput.value.toLowerCase();
    let displayData = allData.filter(
      (item) =>
        item.car.toLowerCase().includes(term) ||
        item.track.toLowerCase().includes(term),
    );

    if (currentSort.column) {
      displayData.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        const direction = currentSort.direction;

        if (typeof valA === "string") {
          return direction === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          return direction === "asc" ? valA - valB : valB - valA;
        }
      });
    }

    renderTable(displayData);
    updateSortUI();
  }

  function updateSortUI() {
    tableHeaders.forEach((header) => {
      header.classList.remove("sort-asc", "sort-desc");
      if (header.getAttribute("data-sort") === currentSort.column) {
        header.classList.add(`sort-${currentSort.direction}`);
      }
    });
  }

  tableHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.getAttribute("data-sort");
      const direction =
        currentSort.column === column && currentSort.direction === "asc"
          ? "desc"
          : "asc";

      currentSort = { column, direction };
      refreshDisplay();
    });
  });
});
