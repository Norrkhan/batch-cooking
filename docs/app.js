"use strict";

const GRUPOS = [
  ["todo", "Todo"],
  ["costco", "Costco"],
  ["lidl", "Lidl mensual"],
  ["semanal", "Lidl semanal"],
  ["extras", "Extras"],
  ["casa", "En casa"],
];
const TIPOS = [["comida", "Comidas"], ["cena", "Cenas (ella)"], ["hidrato", "Hidratos"]];

const estado = { datos: null, filtro: "todo", ocultarMarcados: false };
const $ = (sel) => document.querySelector(sel);

// ---------- almacenamiento local ----------
function leerLS(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch { return porDefecto; }
}
function guardarLS(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}
const claveMarcados = () => `bc:${estado.datos.mes}:marcados`;

// ---------- markdown mínimo ----------
function escapar(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function enlinea(t) {
  return escapar(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, texto, url) => {
      const receta = url.match(/recetas\/([\w-]+)\.md/);
      return receta ? `<a href="#receta/${receta[1]}">${texto}</a>` : `<a href="${url}">${texto}</a>`;
    });
}
function tabla(lineas) {
  const filas = lineas.map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const [cab, , ...cuerpo] = filas;
  return `<div class="tabla"><table><thead><tr>${cab.map((c) => `<th>${enlinea(c)}</th>`).join("")}</tr></thead>` +
    `<tbody>${cuerpo.map((f) => `<tr>${f.map((c) => `<td>${enlinea(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function markdown(md) {
  const lineas = md.replace(/\r/g, "").split("\n");
  const html = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    if (l.trim().startsWith("```")) {
      const bloque = [];
      i++;
      while (i < lineas.length && !lineas[i].trim().startsWith("```")) bloque.push(lineas[i++]);
      i++;
      html.push(`<pre><code>${escapar(bloque.join("\n"))}</code></pre>`);
      continue;
    }
    const h = l.match(/^(#{1,4}) (.+)/);
    if (h) { const n = h[1].length + 1; html.push(`<h${n}>${enlinea(h[2])}</h${n}>`); i++; continue; }
    if (l.startsWith("|")) {
      const bloque = [];
      while (i < lineas.length && lineas[i].startsWith("|")) bloque.push(lineas[i++]);
      html.push(tabla(bloque));
      continue;
    }
    if (l.startsWith(">")) {
      const bloque = [];
      while (i < lineas.length && lineas[i].startsWith(">")) bloque.push(lineas[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote>${bloque.map(enlinea).join("<br>")}</blockquote>`);
      continue;
    }
    if (/^(\s*[-*] |\s*\d+\. )/.test(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const bloque = [];
      while (i < lineas.length && /^(\s*[-*] |\s*\d+\. )/.test(lineas[i])) {
        bloque.push(lineas[i++].replace(/^\s*([-*]|\d+\.) /, "").replace(/^\[[ xX]\] /, "☐ "));
      }
      const tag = ordenada ? "ol" : "ul";
      html.push(`<${tag}>${bloque.map((b) => `<li>${enlinea(b)}</li>`).join("")}</${tag}>`);
      continue;
    }
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#|\||>|```|\s*[-*] |\s*\d+\. )/.test(lineas[i])) parrafo.push(lineas[i++]);
    html.push(`<p>${enlinea(parrafo.join(" "))}</p>`);
  }
  return html.join("\n");
}

// ---------- vistas ----------
function vistaMenu() {
  return `<article class="md">${markdown(estado.datos.menu_md)}</article>`;
}

function vistaRecetas() {
  const r = estado.datos.recetas;
  return `<h2>Recetas de ${estado.datos.titulo}</h2>` + TIPOS.map(([tipo, titulo]) => {
    const lista = r.filter((x) => x.tipo === tipo);
    if (!lista.length) return "";
    return `<h3>${titulo}</h3><ul class="tarjetas">${lista.map((x) => `
      <li><a class="tarjeta" href="#receta/${x.slug}">
        <strong>${escapar(x.nombre)}</strong>
        <span>${x.meta.pescado && x.meta.pescado.startsWith("sí") ? "🐟 " : ""}${escapar(x.meta.coste_racion || "")}</span>
      </a></li>`).join("")}</ul>`;
  }).join("");
}

function vistaReceta(s) {
  const r = estado.datos.recetas.find((x) => x.slug === s);
  if (!r) return `<p>Receta no encontrada.</p>`;
  return `<a class="volver" href="#recetas">← Recetas</a><article class="md">${markdown(r.md)}</article>`;
}

function vistaSesion() {
  return `<article class="md">${markdown(estado.datos.sesion_md || "Sin plan de sesión.")}</article>`;
}

function vistaCompra() {
  const marcados = leerLS(claveMarcados(), {});
  const items = estado.datos.compra.filter((x) => estado.filtro === "todo" || x.grupo === estado.filtro);
  const hechos = items.filter((x) => marcados[x.id]).length;
  const visibles = estado.ocultarMarcados ? items.filter((x) => !marcados[x.id]) : items;

  let html = `<div class="filtros no-imprimir" role="group" aria-label="Supermercado">${GRUPOS.map(([g, t]) =>
    `<button data-filtro="${g}" class="${estado.filtro === g ? "activo" : ""}">${t}</button>`).join("")}</div>
    <div class="barra no-imprimir">
      <span class="progreso">${hechos} / ${items.length} comprados</span>
      <label><input type="checkbox" id="ocultar" ${estado.ocultarMarcados ? "checked" : ""}> Ocultar comprados</label>
      <button id="imprimir">Imprimir</button>
      <button id="desmarcar" class="peligro">Desmarcar todo</button>
    </div>
    <h2 class="solo-imprimir">Compra · ${estado.datos.titulo} · ${GRUPOS.find(([g]) => g === estado.filtro)[1]}</h2>`;

  let grupo = null, seccion = null;
  for (const x of visibles) {
    if (x.grupo !== grupo) {
      if (grupo !== null) html += `</ul>`;
      html += `<h3 class="grupo">${GRUPOS.find(([g]) => g === x.grupo)[1]}</h3>`;
      grupo = x.grupo; seccion = null;
      html += `<ul class="compra">`;
    }
    if (x.seccion && x.seccion !== seccion) {
      html += `<li class="seccion">${escapar(x.seccion)}</li>`;
      seccion = x.seccion;
    }
    const det = x.detalles.map(([k, v]) => k ? `<span><em>${escapar(k)}:</em> ${enlinea(v)}</span>` : `<span>${enlinea(v)}</span>`).join("");
    html += `<li class="articulo ${marcados[x.id] ? "marcado" : ""}">
      <label><input type="checkbox" data-id="${x.id}" ${marcados[x.id] ? "checked" : ""}>
        <span class="texto"><strong>${escapar(x.producto)}</strong><span class="detalles">${det}</span></span>
      </label></li>`;
  }
  if (grupo !== null) html += `</ul>`;
  if (!visibles.length) html += `<p>No hay artículos pendientes.</p>`;

  const resumen = estado.datos.compra_md.split(/\n## Resumen/)[1];
  if (resumen && estado.filtro === "todo") html += `<section class="md no-imprimir">${markdown("## Resumen" + resumen)}</section>`;
  return html;
}

// ---------- navegación ----------
function pintar() {
  if (!estado.datos) return;
  const [ruta, param] = (location.hash.slice(1) || "menu").split("/");
  const pestana = ruta === "receta" ? "recetas" : ruta;
  document.querySelectorAll(".pestanas a").forEach((a) => a.classList.toggle("activa", a.dataset.pestana === pestana));
  const vistas = { menu: vistaMenu, recetas: vistaRecetas, receta: () => vistaReceta(param), compra: vistaCompra, sesion: vistaSesion };
  $("#contenido").innerHTML = (vistas[ruta] || vistaMenu)();
  document.body.dataset.vista = pestana;
}

document.addEventListener("change", (e) => {
  const id = e.target.dataset && e.target.dataset.id;
  if (id) {
    const marcados = leerLS(claveMarcados(), {});
    if (e.target.checked) marcados[id] = true; else delete marcados[id];
    guardarLS(claveMarcados(), marcados);
    pintar();
  } else if (e.target.id === "ocultar") {
    estado.ocultarMarcados = e.target.checked;
    guardarLS("bc:ocultar", estado.ocultarMarcados);
    pintar();
  }
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.filtro) {
    estado.filtro = b.dataset.filtro;
    guardarLS("bc:filtro", estado.filtro);
    pintar();
  } else if (b.id === "imprimir") {
    window.print();
  } else if (b.id === "desmarcar") {
    if (b.dataset.confirmar) {
      guardarLS(claveMarcados(), {});
      pintar();
    } else {
      b.dataset.confirmar = "1";
      b.textContent = "¿Seguro? Pulsa otra vez";
      setTimeout(() => { delete b.dataset.confirmar; b.textContent = "Desmarcar todo"; }, 3000);
    }
  }
});

window.addEventListener("hashchange", () => { pintar(); window.scrollTo(0, 0); });

async function cargarMes(mes) {
  const r = await fetch(`datos/${mes}.json`, { cache: "no-cache" });
  estado.datos = await r.json();
  guardarLS("bc:mes", mes);
  document.title = `Batch Cooking · ${estado.datos.titulo}`;
  pintar();
}

async function iniciar() {
  estado.filtro = leerLS("bc:filtro", "todo");
  estado.ocultarMarcados = leerLS("bc:ocultar", false);
  try {
    const meses = await (await fetch("datos/meses.json", { cache: "no-cache" })).json();
    const selector = $("#selector-mes");
    selector.innerHTML = meses.map((m) => `<option value="${m.mes}">${m.titulo}</option>`).join("");
    const guardado = leerLS("bc:mes", null);
    selector.value = meses.some((m) => m.mes === guardado) ? guardado : meses[0].mes;
    selector.addEventListener("change", () => cargarMes(selector.value));
    await cargarMes(selector.value);
  } catch {
    $("#contenido").innerHTML = `<p>No se pudieron cargar los datos. Si abres el archivo en local, usa un servidor: <code>python -m http.server -d docs</code></p>`;
  }
}

iniciar();
