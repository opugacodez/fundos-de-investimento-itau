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
    prevButtons: [
      document.getElementById("prevMobile"),
      document.getElementById("prevDesktop"),
    ],
    nextButtons: [
      document.getElementById("nextMobile"),
      document.getElementById("nextDesktop"),
    ],
    sortableHeaders: document.querySelectorAll("th.sortable"),
  };

  function initializeApp() {
    ui.fileInput.addEventListener("change", handleFileLoad);
    ui.filterNome.addEventListener("input", handleFilterChange);
    ui.filterCNPJ.addEventListener("input", handleFilterChange);
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

    updateSortIcons();
  }

  function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        appState.allData = json.dados || [];
        appState.currentPage = 1;
        populateRiscoFilter(appState.allData);
        runDataPipeline();
        ui.paginationControls.classList.remove("hidden");
      } catch (error) {
        console.error("Erro ao carregar ou parsear o JSON:", error);
        ui.tableBody.innerHTML = `<tr><td colspan="10" class="px-6 py-4 text-center text-red-500">Falha ao carregar o arquivo. Verifique se é um JSON válido.</td></tr>`;
      }
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
                <label for="risco-${risco}" class="ml-2 block text-sm text-gray-900 cursor-pointer select-none">
                    ${capitalizedRisco}
                </label>
            `;
      ui.filterRiscoContainer.appendChild(wrapper);
    });
  }

  function handleFilterChange(event) {
    appState.filters.nome = ui.filterNome.value.toLowerCase();
    appState.filters.cnpj = ui.filterCNPJ.value.toLowerCase(); // Atualiza filtro CNPJ

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
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }

      return appState.sortDirection === "asc" ? comparison : comparison * -1;
    });

    appState.processedData = data;

    renderTable();
    renderPagination();
  }

  function renderTable() {
    ui.tableBody.innerHTML = "";

    if (appState.processedData.length === 0) {
      ui.noResultsMessage.classList.remove("hidden");
      if (appState.allData.length === 0) {
        ui.noResultsMessage.classList.add("hidden");
        ui.tableBody.innerHTML = `<tr><td colspan="10" class="px-6 py-4 text-center text-gray-500">Por favor, carregue um arquivo JSON para ver os dados.</td></tr>`;
      }
      return;
    }

    ui.noResultsMessage.classList.add("hidden");

    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const pageData = appState.processedData.slice(start, end);

    pageData.forEach((item) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50";

      const cnpjs = (item.possivel_cnpj || [])
        .map(
          (cnpj) => `<span class="cnpj-link" data-cnpj="${cnpj}">${cnpj}</span>`
        )
        .join("<br>");

      tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${
                      item.nome
                    }</div>
                </td>
                <!-- CÉLULA CNPJ -->
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-700">${cnpjs}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiscoClasses(
                      item.risco
                    )}">
                        ${item.risco}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-700">${
                      item.aplicacao_inicial
                    }</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-700">${item["12_meses"]}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-700">${item.no_ano}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-700">${item.no_mes}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-700">${item.taxa_maxima}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${
                  item.resgate
                }</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <a href="${
                      item.lamina_link
                    }" target="_blank" rel="noopener noreferrer" title="Baixar Lâmina" class="text-blue-600 hover:text-blue-900">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
    ui.paginationSummary.textContent = `Mostrando ${startItem}-${endItem} de ${totalItems} resultados`;

    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;

    ui.prevButtons.forEach((btn) => {
      btn.disabled = !hasPrev;
      btn.classList.toggle("opacity-50", !hasPrev);
    });
    ui.nextButtons.forEach((btn) => {
      btn.disabled = !hasNext;
      btn.classList.toggle("opacity-50", !hasNext);
    });

    const pageContainer = document.getElementById("pageNumbersContainer");

    pageContainer
      .querySelectorAll(".page-number, .page-ellipsis")
      .forEach((btn) => btn.remove());

    const nextButtonDesktop = document.getElementById("nextDesktop");

    const createPageButton = (page) => {
      const pageButton = document.createElement("button");
      pageButton.textContent = page;
      pageButton.className = `page-number relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium`;

      if (page === currentPage) {
        pageButton.classList.add(
          "z-10",
          "bg-blue-50",
          "border-blue-500",
          "text-blue-600"
        );
      } else {
        pageButton.classList.add(
          "bg-white",
          "text-gray-700",
          "hover:bg-gray-50"
        );
        pageButton.addEventListener("click", () => handlePageChange(page));
      }

      pageContainer.insertBefore(pageButton, nextButtonDesktop);
    };

    const createEllipsis = () => {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className =
        "page-ellipsis relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700";
      pageContainer.insertBefore(ellipsis, nextButtonDesktop);
    };

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        createPageButton(i);
      }
    } else {
      const pagesToShow = new Set();
      pagesToShow.add(1);
      pagesToShow.add(totalPages);
      pagesToShow.add(currentPage);

      if (currentPage > 2) pagesToShow.add(currentPage - 1);
      if (currentPage > 3) pagesToShow.add(currentPage - 2);
      if (currentPage < totalPages - 1) pagesToShow.add(currentPage + 1);
      if (currentPage < totalPages - 2) pagesToShow.add(currentPage + 2);

      if (currentPage === 3) pagesToShow.add(2);
      if (currentPage === totalPages - 2) pagesToShow.add(totalPages - 1);

      const sortedPages = [...pagesToShow].sort((a, b) => a - b);

      let lastPage = 0;
      for (const page of sortedPages) {
        if (lastPage + 1 < page) {
          createEllipsis();
        }
        createPageButton(page);
        lastPage = page;
      }
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

  async function handleCnpjClick(event) {
    const cnpjComMascara = event.target.dataset.cnpj;
    if (!cnpjComMascara) return;

    const cnpjLimpo = cnpjComMascara.replace(/[.\-/]/g, "");

    const apiUrl = `https://api.maisretorno.com/v4/general/search/${encodeURIComponent(
      cnpjLimpo
    )}`;

    event.target.textContent = "Buscando...";
    event.target.style.color = "#f97316";

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API respondeu com status ${response.status}`);
      }

      const results = await response.json();

      if (results && results.length > 0 && results[0].canonical_url) {
        const redirectUrl = `https://maisretorno.com/${results[0].canonical_url}`;
        window.open(redirectUrl, "_blank");
        event.target.textContent = cnpjComMascara;
        event.target.style.color = "";
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
      });
      event.target.textContent = cnpjComMascara;
      event.target.style.color = "";
    }
  }

  initializeApp();
});
