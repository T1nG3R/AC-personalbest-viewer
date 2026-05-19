function fuzzyMatch(pattern, string) {
    if (!pattern) return true;
    let patternIdx = 0;
    let stringIdx = 0;
    while (patternIdx < pattern.length && stringIdx < string.length) {
        if (pattern[patternIdx].toLowerCase() === string[stringIdx].toLowerCase()) {
            patternIdx++;
        }
        stringIdx++;
    }
    return patternIdx === pattern.length;
}

function parseSearchQuery(query) {
    const exact = [];
    const tokens = [];
    
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(query)) !== null) {
        exact.push(match[1].toLowerCase());
    }
    
    const remaining = query.replace(quoteRegex, '').trim();
    if (remaining) {
        const parts = remaining.split(/\s+/);
        parts.forEach(part => {
            const lowerPart = part.toLowerCase();
            if (lowerPart.startsWith('car:')) {
                const term = lowerPart.substring(4);
                if (term) tokens.push({ prefix: 'car', term });
            } else if (lowerPart.startsWith('track:')) {
                const term = lowerPart.substring(6);
                if (term) tokens.push({ prefix: 'track', term });
            } else {
                tokens.push({ prefix: null, term: lowerPart });
            }
        });
    }
    
    return { exact, tokens };
}

function rowMatchesQuery(row, parsedQuery) {
    const carLower = row.car.toLowerCase();
    const trackLower = row.track.toLowerCase();

    // Check exact matches
    for (const phrase of parsedQuery.exact) {
        if (!carLower.includes(phrase) && !trackLower.includes(phrase)) {
            return false;
        }
    }

    // Check fuzzy/prefix tokens
    for (const token of parsedQuery.tokens) {
        if (token.prefix === 'car') {
            if (!fuzzyMatch(token.term, row.car)) return false;
        } else if (token.prefix === 'track') {
            if (!fuzzyMatch(token.term, row.track)) return false;
        } else {
            if (!fuzzyMatch(token.term, row.car) && !fuzzyMatch(token.term, row.track)) {
                return false;
            }
        }
    }

    return true;
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const resultsContainer = document.getElementById("results-container");
  const tableBody = document.getElementById("table-body");
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const closeFileBtn = document.getElementById("close-file-btn");
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

  const triggerOnKeyboard = (e, callback) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  copyPath.addEventListener("click", (e) => {
    e.stopPropagation();
    copyPathToClipboard();
  });

  copyPath.addEventListener("keydown", (e) => {
    triggerOnKeyboard(e, copyPathToClipboard);
  });

  function copyPathToClipboard() {
    navigator.clipboard.writeText("Documents\\Assetto Corsa").then(() => {
      const originalText = copyPath.innerText;
      copyPath.innerText = "Copied!";
      copyPath.style.color = "#4CAF50";
      setTimeout(() => {
        copyPath.innerText = originalText;
        copyPath.style.color = "var(--accent-color)";
      }, 1500);
    });
  }

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
      
      // Move focus to search input for immediate interaction
      setTimeout(() => searchInput.focus(), 100);
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

  function updateStats(data) {
    const statTotal = document.getElementById("stat-total");
    const statRecent = document.getElementById("stat-recent");

    if (!data || data.length === 0) {
      statTotal.innerText = "0";
      statRecent.innerText = "N/A";
      return;
    }

    statTotal.innerText = data.length;

    const mostRecent = data.reduce((prev, current) => {
      return prev.date > current.date ? prev : current;
    });

    statRecent.innerText = `${mostRecent.car} @ ${mostRecent.track}`;
    statRecent.title = `Achieved on: ${formatDate(mostRecent.date)}`;
  }

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
    if (searchInput.value.length > 0) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    refreshDisplay();
    clearSearchBtn.classList.add("hidden");
    searchInput.focus();
  });

  closeFileBtn.addEventListener("click", () => {
    allData = [];
    currentSort = { column: null, direction: "asc" };
    refreshDisplay();
    resultsContainer.classList.add("hidden");
    errorMessage.classList.add("hidden");
    dropZone.classList.remove("hidden");
    instructions.classList.remove("hidden");
    fileInput.value = "";
    searchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    
    // Move focus back to select button
    selectBtn.focus();
  });

  // --- Sorting & Display Refresh ---

  function refreshDisplay() {
    const parsedQuery = parseSearchQuery(searchInput.value);
    let displayData = allData.filter((item) => rowMatchesQuery(item, parsedQuery));

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
    updateStats(displayData);
  }

  function updateSortUI() {
    tableHeaders.forEach((header) => {
      header.classList.remove("sort-asc", "sort-desc");
      header.setAttribute("aria-sort", "none");

      if (header.getAttribute("data-sort") === currentSort.column) {
        header.classList.add(`sort-${currentSort.direction}`);
        header.setAttribute("aria-sort", currentSort.direction === "asc" ? "ascending" : "descending");
      }
    });
  }

  tableHeaders.forEach((header) => {
    const sortHandler = () => {
      const column = header.getAttribute("data-sort");
      const direction =
        currentSort.column === column && currentSort.direction === "asc"
          ? "desc"
          : "asc";

      currentSort = { column, direction };
      refreshDisplay();
    };

    header.addEventListener("click", sortHandler);
    header.addEventListener("keydown", (e) => triggerOnKeyboard(e, sortHandler));
  });

  // --- Focus Trapping ---

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;

    const focusableSelector = 'button, input, [tabindex="0"]';
    const allFocusable = Array.from(document.querySelectorAll(focusableSelector))
      .filter(el => {
        // Filter out elements that are hidden or inside hidden containers
        return el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled;
      });

    if (allFocusable.length === 0) return;

    const firstElement = allFocusable[0];
    const lastElement = allFocusable[allFocusable.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: Loop from first to last
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: Loop from last to first
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed', err));
    });
}
