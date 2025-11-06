document.addEventListener("DOMContentLoaded", () => {
  const appState = {
    allData: [],
    processedData: [],
    currentPage: 1,
    itemsPerPage: 10,
    sortColumn: "nome",
    sortDirection: "asc",
    filters: {
      nome: "",
      risco: [],
      cnpj: "",
    },
    isMobile: window.innerWidth <= 768,
  };

  const ui = {
    fileInput: document.getElementById("fileInput"),
    filterNome: document.getElementById("filterNome"),
    filterCNPJ: document.getElementById("filterCNPJ"),
    filterRiscoContainer: document.getElementById("filterRiscoContainer"),

    tableBody: document.getElementById("tableBody"),
    noResultsMessage: document.getElementById("noResultsMessage"),

    paginationControls: document.getElementById("paginationControls"),
    paginationSummary: document.getElementById("paginationSummary"),
    pageNumbersContainer: document.getElementById("pageNumbersContainer"),
    itemsPerPage: document.getElementById("itemsPerPage"),
    prevButtons: document.querySelectorAll("[id^='prev']"),
    nextButtons: document.querySelectorAll("[id^='next']"),

    sortableHeaders: document.querySelectorAll("th.sortable"),

    tableContainer: document.querySelector(".overflow-x-auto"),
  };

  function initializeApp() {
    setupEventListeners();
    setupResponsiveFeatures();
    updateUIForScreenSize();
  }

  function setupEventListeners() {
    ui.fileInput.addEventListener("change", handleFileLoad);
    ui.filterNome.addEventListener("input", debounce(handleFilterChange, 300));
    ui.filterCNPJ.addEventListener("input", debounce(handleFilterChange, 300));
    ui.filterRiscoContainer.addEventListener("change", handleFilterChange);
    ui.itemsPerPage.addEventListener("change", handleItemsPerPageChange);

    ui.sortableHeaders.forEach((header) => {
      header.addEventListener("click", handleSortClick);
    });

    ui.prevButtons.forEach((btn) =>
      btn.addEventListener("click", () =>
        handlePageChange(appState.currentPage - 1)
      )
    );
    ui.nextButtons.forEach((btn) =>
      btn.addEventListener("click", () =>
        handlePageChange(appState.currentPage + 1)
      )
    );

    window.addEventListener("resize", debounce(handleResize, 250));
  }

  function setupResponsiveFeatures() {
    if (appState.isMobile) {
      const scrollIndicator = document.createElement("div");
      scrollIndicator.className = "text-xs text-center text-gray-500 mb-2";
      scrollIndicator.innerHTML = "← Deslize para ver mais colunas →";
      ui.tableContainer.parentNode.insertBefore(
        scrollIndicator,
        ui.tableContainer
      );
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function handleResize() {
    const wasMobile = appState.isMobile;
    appState.isMobile = window.innerWidth <= 768;

    if (wasMobile !== appState.isMobile) {
      updateUIForScreenSize();
      renderPagination();
    }
  }

  function updateUIForScreenSize() {
    if (appState.isMobile && appState.itemsPerPage > 10) {
      appState.itemsPerPage = 10;
      ui.itemsPerPage.value = 10;
    }

    if (appState.isMobile) {
      ui.filterNome.placeholder = "Nome...";
      ui.filterCNPJ.placeholder = "CNPJ...";
    } else {
      ui.filterNome.placeholder = "Digite o nome do fundo...";
      ui.filterCNPJ.placeholder = "Digite o CNPJ...";
    }
  }

  function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoadingState(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        appState.allData = json.dados || [];
        appState.currentPage = 1;

        populateRiscoFilter(appState.allData);
        runDataPipeline();

        ui.paginationControls.classList.remove("hidden");
        showLoadingState(false);
      } catch (error) {
        console.error("Erro ao carregar o arquivo:", error);
        showError(
          "Falha ao carregar o arquivo. Verifique se é um JSON válido."
        );
        showLoadingState(false);
      }
    };

    reader.onerror = () => {
      showError("Erro ao ler o arquivo.");
      showLoadingState(false);
    };

    reader.readAsText(file);
  }

  function populateRiscoFilter(data) {
    const ordemCorreta = ["baixo", "médio", "alto"];
    const riscosUnicos = [...new Set(data.map((item) => item.risco))].filter(
      Boolean
    );

    const riscos = riscosUnicos.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();

      const indexA = ordemCorreta.indexOf(aLower);
      const indexB = ordemCorreta.indexOf(bLower);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    ui.filterRiscoContainer.innerHTML = "";

    if (riscos.length === 0) {
      ui.filterRiscoContainer.innerHTML =
        '<span class="text-xs text-gray-500">Nenhum risco definido.</span>';
      return;
    }

    riscos.forEach((risco) => {
      const capitalizedRisco = risco.charAt(0).toUpperCase() + risco.slice(1);
      const wrapper = document.createElement("div");
      wrapper.className = "flex items-center";

      wrapper.innerHTML = `
        <input id="risco-${risco}" name="risco" type="checkbox" value="${risco}" 
               class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer">
        <label for="risco-${risco}" class="ml-2 block text-sm text-gray-900 cursor-pointer select-none whitespace-nowrap">
          ${appState.isMobile ? capitalizedRisco.slice(0, 4) : capitalizedRisco}
        </label>
      `;
      ui.filterRiscoContainer.appendChild(wrapper);
    });
  }

  function handleFilterChange() {
    appState.filters.nome = ui.filterNome.value.toLowerCase();
    appState.filters.cnpj = ui.filterCNPJ.value.toLowerCase();

    const checkedRiscos = ui.filterRiscoContainer.querySelectorAll(
      'input[type="checkbox"]:checked'
    );
    appState.filters.risco = Array.from(checkedRiscos).map((cb) => cb.value);

    appState.currentPage = 1;
    runDataPipeline();
  }

  function handleSortClick(event) {
    const newColumn = event.currentTarget.dataset.column;

    if (appState.sortColumn === newColumn) {
      appState.sortDirection =
        appState.sortDirection === "asc" ? "desc" : "asc";
    } else {
      appState.sortColumn = newColumn;
      appState.sortDirection = "asc";
    }

    updateSortIcons();
    runDataPipeline();
  }

  function handleItemsPerPageChange(event) {
    appState.itemsPerPage = parseInt(event.target.value, 10);
    appState.currentPage = 1;
    runDataPipeline();
  }

  function handlePageChange(newPage) {
    const totalPages = Math.ceil(
      appState.processedData.length / appState.itemsPerPage
    );

    if (newPage < 1) newPage = 1;
    if (newPage > totalPages) newPage = totalPages;

    appState.currentPage = newPage;
    renderTable();
    renderPagination();

    if (appState.isMobile) {
      ui.tableContainer.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  function runDataPipeline() {
    let data = [...appState.allData];

    data = data.filter((item) => {
      const matchNome = item.nome.toLowerCase().includes(appState.filters.nome);
      const matchRisco =
        appState.filters.risco.length === 0 ||
        appState.filters.risco.includes(item.risco);

      const filterCnpj = appState.filters.cnpj.replace(/[.\-/]/g, "");
      const matchCNPJ =
        !filterCnpj ||
        (Array.isArray(item.possivel_cnpj) &&
          item.possivel_cnpj.some((cnpj) =>
            cnpj.replace(/[.\-/]/g, "").includes(filterCnpj)
          ));

      return matchNome && matchRisco && matchCNPJ;
    });

    data.sort((a, b) => {
      const valA = getSortValue(a, appState.sortColumn);
      const valB = getSortValue(b, appState.sortColumn);

      let comparison = 0;
      if (valA > valB) comparison = 1;
      else if (valA < valB) comparison = -1;

      return appState.sortDirection === "asc" ? comparison : comparison * -1;
    });

    appState.processedData = data;
    renderTable();
    renderPagination();
  }

  function renderTable() {
    ui.tableBody.innerHTML = "";

    if (appState.processedData.length === 0) {
      if (appState.allData.length === 0) {
        ui.tableBody.innerHTML = `
          <tr>
            <td colspan="10" class="px-4 py-8 text-center text-gray-500 text-sm">
              <div class="flex flex-col items-center">
                <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                </svg>
                <span>Carregue um arquivo JSON para começar</span>
              </div>
            </td>
          </tr>
        `;
        ui.noResultsMessage.classList.add("hidden");
      } else {
        ui.noResultsMessage.classList.remove("hidden");
      }
      return;
    }

    ui.noResultsMessage.classList.add("hidden");

    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const pageData = appState.processedData.slice(start, end);

    pageData.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.className = `hover:bg-gray-50 ${
        index % 2 === 0 ? "bg-white" : "bg-gray-50"
      }`;

      const cnpjs = (item.possivel_cnpj || [])
        .map((cnpj) => {
          const displayCnpj =
            appState.isMobile && cnpj.length > 14
              ? cnpj.substring(0, 12) + "..."
              : cnpj;
          return `<span class="cnpj-link" data-cnpj="${cnpj}">${displayCnpj}</span>`;
        })
        .join("<br>");

      tr.innerHTML = `
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900 truncate max-w-${
            appState.isMobile ? "20" : "40"
          }">
            ${
              appState.isMobile && item.nome.length > 20
                ? item.nome.substring(0, 18) + "..."
                : item.nome
            }
          </div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm text-gray-700">${cnpjs}</div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <span class="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${getRiscoClasses(
            item.risco
          )}">
            ${appState.isMobile ? getRiscoAbreviado(item.risco) : item.risco}
          </span>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm text-gray-700">${formatCurrency(
            item.aplicacao_inicial
          )}</div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm ${getPerformanceColor(item["12_meses"])}">${
        item["12_meses"]
      }</div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm ${getPerformanceColor(item.no_ano)}">${
        item.no_ano
      }</div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm ${getPerformanceColor(item.no_mes)}">${
        item.no_mes
      }</div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="text-sm text-gray-700">${item.taxa_maxima}</div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
          ${
            appState.isMobile ? getResgateAbreviado(item.resgate) : item.resgate
          }
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap text-center text-sm font-medium">
          <a href="${
            item.lamina_link
          }" target="_blank" rel="noopener noreferrer" 
             title="Baixar Lâmina" class="text-blue-600 hover:text-blue-900 inline-block p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </a>
        </td>
      `;

      ui.tableBody.appendChild(tr);
    });

    ui.tableBody.querySelectorAll(".cnpj-link").forEach((link) => {
      link.addEventListener("click", handleCnpjClick);
    });
  }

  function renderPagination() {
    const totalItems = appState.processedData.length;
    const totalPages = Math.ceil(totalItems / appState.itemsPerPage);
    const currentPage = appState.currentPage;

    const startItem =
      totalItems === 0 ? 0 : (currentPage - 1) * appState.itemsPerPage + 1;
    const endItem = Math.min(startItem + appState.itemsPerPage - 1, totalItems);

    if (appState.isMobile) {
      ui.paginationSummary.textContent = `${startItem}-${endItem} de ${totalItems}`;
    } else {
      ui.paginationSummary.textContent = `Mostrando ${startItem}-${endItem} de ${totalItems} resultados`;
    }

    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;

    ui.prevButtons.forEach((btn) => {
      btn.disabled = !hasPrev;
      btn.classList.toggle("opacity-50", !hasPrev);
      btn.classList.toggle("cursor-not-allowed", !hasPrev);
    });

    ui.nextButtons.forEach((btn) => {
      btn.disabled = !hasNext;
      btn.classList.toggle("opacity-50", !hasNext);
      btn.classList.toggle("cursor-not-allowed", !hasNext);
    });

    renderPageNumbers(currentPage, totalPages);
  }

  function renderPageNumbers(currentPage, totalPages) {
    ui.pageNumbersContainer.innerHTML = "";

    if (totalPages <= 1) return;

    if (appState.isMobile) {
      const mobileInfo = document.createElement("span");
      mobileInfo.className =
        "px-3 py-2 text-xs text-gray-600 whitespace-nowrap";
      mobileInfo.textContent = `Página ${currentPage} de ${totalPages}`;
      ui.pageNumbersContainer.appendChild(mobileInfo);
    } else {
      const createPageButton = (page, isActive = false, isEllipsis = false) => {
        const button = document.createElement("button");

        if (isEllipsis) {
          button.className = "px-3 py-2 text-sm text-gray-500 cursor-default";
          button.textContent = "...";
          button.disabled = true;
        } else {
          button.className = `px-3 py-2 text-sm border font-medium ${
            isActive
              ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
              : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
          }`;
          button.textContent = page;

          if (!isActive) {
            button.addEventListener("click", () => handlePageChange(page));
          }
        }

        return button;
      };

      let pagesToShow = [];

      if (totalPages <= 7) {
        pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
      } else {
        pagesToShow = [1];

        if (currentPage > 3) pagesToShow.push("...");

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          pagesToShow.push(i);
        }

        if (currentPage < totalPages - 2) pagesToShow.push("...");
        pagesToShow.push(totalPages);
      }

      pagesToShow.forEach((page) => {
        if (page === "...") {
          ui.pageNumbersContainer.appendChild(
            createPageButton(page, false, true)
          );
        } else {
          const isActive = page === currentPage;
          ui.pageNumbersContainer.appendChild(createPageButton(page, isActive));
        }
      });
    }
  }

  function updateSortIcons() {
    ui.sortableHeaders.forEach((header) => {
      const column = header.dataset.column;
      header.classList.remove("sort-asc", "sort-desc");

      if (column === appState.sortColumn) {
        header.classList.add(
          appState.sortDirection === "asc" ? "sort-asc" : "sort-desc"
        );
      }
    });
  }

  function getSortValue(item, column) {
    const value = item[column];
    const normalizeString = (str) =>
      str
        ? str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        : "";

    switch (column) {
      case "nome":
      case "risco":
        return normalizeString(value);

      case "possivel_cnpj":
        const firstCnpj =
          Array.isArray(value) && value.length > 0 ? value[0] : "";
        return normalizeString(firstCnpj);

      case "aplicacao_inicial":
        return (
          parseFloat(
            value.replace("R$ ", "").replace(/\./g, "").replace(",", ".")
          ) || 0
        );

      case "12_meses":
      case "no_ano":
      case "no_mes":
      case "taxa_maxima":
        const parsedValue = parseFloat(
          value.replace("%", "").replace(",", ".")
        );
        return isNaN(parsedValue) ? -Infinity : parsedValue;

      default:
        return value;
    }
  }

  function getRiscoClasses(risco) {
    if (!risco) return "bg-gray-100 text-gray-800";
    switch (risco.toLowerCase()) {
      case "baixo":
        return "bg-green-100 text-green-800";
      case "médio":
        return "bg-yellow-100 text-yellow-800";
      case "alto":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getRiscoAbreviado(risco) {
    if (!risco) return "-";
    switch (risco.toLowerCase()) {
      case "baixo":
        return "Bx";
      case "médio":
        return "Md";
      case "alto":
        return "At";
      default:
        return risco.slice(0, 2);
    }
  }

  function getResgateAbreviado(resgate) {
    if (!resgate) return "-";
    if (resgate.toLowerCase().includes("diário")) return "D+0";
    if (resgate.toLowerCase().includes("+1")) return "D+1";
    return resgate;
  }

  function formatCurrency(value) {
    if (!value) return "-";
    if (appState.isMobile && value.includes("R$")) {
      return value.replace("R$ ", "R$");
    }
    return value;
  }

  function getPerformanceColor(value) {
    if (!value || typeof value !== "string") return "text-gray-700";
    const num = parseFloat(value.replace("%", "").replace(",", "."));
    if (num > 0) return "text-green-600";
    if (num < 0) return "text-red-600";
    return "text-gray-700";
  }

  async function handleCnpjClick(event) {
    const cnpjComMascara = event.target.dataset.cnpj;
    if (!cnpjComMascara) return;

    const cnpjLimpo = cnpjComMascara.replace(/[.\-/]/g, "");
    const apiUrl = `https://api.maisretorno.com/v4/general/search/${encodeURIComponent(
      cnpjLimpo
    )}`;

    const originalText = event.target.textContent;
    const originalColor = event.target.style.color;

    event.target.textContent = "Buscando...";
    event.target.style.color = "#f97316";
    event.target.classList.add("opacity-70");

    try {
      const response = await fetch(apiUrl);
      if (!response.ok)
        throw new Error(`API respondeu com status ${response.status}`);

      const results = await response.json();

      if (results?.length > 0 && results[0].canonical_url) {
        const redirectUrl = `https://maisretorno.com/${results[0].canonical_url}`;
        window.open(redirectUrl, "_blank");
      } else {
        throw new Error("Nenhum resultado encontrado na API.");
      }
    } catch (error) {
      console.error("Falha ao buscar CNPJ:", error);
      Swal.fire({
        icon: "error",
        title: "Erro na Busca",
        text: `Não foi possível encontrar o fundo com CNPJ ${cnpjComMascara} no Mais Retorno.`,
        confirmButtonColor: "#3085d6",
        confirmButtonText: "OK",
      });
    } finally {
      event.target.textContent = originalText;
      event.target.style.color = originalColor;
      event.target.classList.remove("opacity-70");
    }
  }

  function showLoadingState(show) {
    if (show) {
      ui.tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-8 text-center text-gray-500">
            <div class="flex flex-col items-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <span>Carregando dados...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function showError(message) {
    ui.tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="px-6 py-4 text-center text-red-500">
          <div class="flex flex-col items-center">
            <svg class="w-8 h-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>${message}</span>
          </div>
        </td>
      </tr>
    `;
  }

  initializeApp();
});
