const demoPlaces = [
  { name: "CaaS Express / Motoboy", category: "Logística", address: "Centro, Guarulhos — SP", icon: "↗", status: "Dados demonstrativos", query: "motoboy logística" },
  { name: "Óticas Dyana", category: "Óticas", address: "Guarulhos — SP", icon: "◉", status: "Dados demonstrativos", query: "ótica" },
  { name: "Hotelaria e serviços locais", category: "Hotéis", address: "Cumbica, Guarulhos — SP", icon: "⌂", status: "Dados demonstrativos", query: "hotel" },
];

const state = { places: demoPlaces, query: "", live: false };
const results = document.querySelector("#results");
const status = document.querySelector("#status");
const meta = document.querySelector("#result-meta");
const input = document.querySelector("#search-input");
const form = document.querySelector("#search-form");

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function render() {
  const query = state.query.trim().toLocaleLowerCase("pt-BR");
  const filtered = state.places.filter((place) => {
    if (!query) return true;
    return [place.name, place.category, place.address, place.query].join(" ").toLocaleLowerCase("pt-BR").includes(query);
  });
  results.innerHTML = filtered.length ? filtered.map((place) => `
    <article class="card">
      <div class="card-icon" aria-hidden="true">${esc(place.icon || "•")}</div>
      <span class="badge">${esc(place.status || "Verificado")}</span>
      <h3>${esc(place.name)}</h3>
      <p>${esc(place.category)}</p>
      <p class="address">⌖ ${esc(place.address)}</p>
    </article>
  `).join("") : `<p class="empty">Nenhum resultado encontrado. Tente outra categoria ou bairro.</p>`;
  meta.textContent = state.live ? "OpenStreetMap · consulta atual · dados sob licença ODbL" : "Dados demonstrativos · fonte aberta ainda não consultada";
  status.textContent = state.live ? `${filtered.length} resultado(s) encontrados.` : `${filtered.length} exemplo(s) exibidos. Clique em uma categoria para consultar a fonte aberta.`;
}

async function loadLivePlaces(query) {
  status.textContent = "Consultando fonte oficial…";
  try {
    const response = await fetch(`/api/places?query=${encodeURIComponent(query || "empresas em Guarulhos SP")}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.places)) throw new Error("Resposta inválida");
    state.places = payload.places.map((place) => ({
      name: place.displayName?.text || place.name || "Empresa sem nome",
      category: place.primaryTypeDisplayName?.text || place.primaryType || place.category || "Empresa local",
      address: place.formattedAddress || "Endereço não informado",
      icon: "•",
      status: "Fonte oficial",
      query: query,
    }));
    state.live = true;
    render();
  } catch (error) {
    state.live = false;
    state.places = demoPlaces;
    render();
    status.textContent = `Consulta oficial indisponível (${error.message}). Exibindo dados demonstrativos.`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = input.value;
  if (state.query.trim()) loadLivePlaces(state.query.trim());
  else render();
});

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.query;
    state.query = button.dataset.query;
    loadLivePlaces(state.query);
    document.querySelector("#explorar").scrollIntoView({ behavior: "smooth" });
  });
});

render();
