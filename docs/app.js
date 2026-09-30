"use strict";

const GRUPOS = [
  ["todo", "Todo"],
  ["costco", "Costco"],
  ["lidl", "Lidl mensual"],
  ["precios", "Comprobar precios"],
  ["semanal", "Lidl semanal"],
  ["extras", "Extras"],
  ["casa", "En casa"],
];
const TIPOS = [["comida", "Comidas"], ["cena", "Cenas (ella)"], ["hidrato", "Hidratos"]];

const SUPERS = [["lidl", "Lidl"], ["costco", "Costco"]];
const SIN_PRECIOS = ["casa"];
const CFG = window.BC_CONFIG || {};

const estado = {
  datos: null, filtro: "todo", ocultarMarcados: false,
  remoto: {}, aviso: "", pin: null, pidiendoPin: false, errorPin: "", pendiente: null, abiertos: new Set(),
};
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
const claveRemoto = () => `bc:${estado.datos.mes}:remoto`;

// ---------- estado compartido (Supabase) ----------
const remotoActivo = () => Boolean(CFG.supabaseUrl && CFG.supabaseKey);

async function api(ruta, opciones = {}) {
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: CFG.supabaseKey, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).message || msg; } catch { /* sin cuerpo */ }
    throw new Error(msg);
  }
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

async function cargarEstado() {
  if (!remotoActivo()) {
    estado.aviso = "La web no está conectada a la base de datos: solo lectura.";
    return;
  }
  try {
    const filas = await api(`compra_estado?select=*&mes=eq.${encodeURIComponent(estado.datos.mes)}`);
    estado.remoto = Object.fromEntries(filas.map((f) => [f.item_id, f]));
    guardarLS(claveRemoto(), estado.remoto);
    if (estado.aviso.startsWith("Sin conexión")) estado.aviso = "";
  } catch {
    estado.remoto = leerLS(claveRemoto(), {});
    estado.aviso = "Sin conexión: se muestra la última copia y los cambios no se guardan.";
  }
}

// Pide el PIN si hace falta y después ejecuta la acción
function conPin(accion) {
  if (!remotoActivo()) { estado.aviso = "La web no está conectada a la base de datos: solo lectura."; pintar(); return; }
  if (estado.pin) { accion(); return; }
  estado.pidiendoPin = true;
  estado.pendiente = accion;
  pintar();
}

function errorGuardado(e) {
  if (/PIN/i.test(e.message)) {
    estado.pin = null;
    guardarLS("bc:pin", null);
    estado.aviso = "PIN incorrecto: vuelve a introducirlo.";
  } else {
    estado.aviso = "Sin conexión: los cambios no se han guardado.";
  }
}

const VACIO = { comprado: false, lidl_precio: null, lidl_formato: null, costco_precio: null, costco_formato: null };

function guardarArticulo(id, cambios) {
  conPin(async () => {
    const anterior = estado.remoto[id];
    const fila = { ...VACIO, ...anterior, ...cambios, mes: estado.datos.mes, item_id: id };
    estado.remoto[id] = fila;
    setTimeout(pintar, 0); // después de que el foco pase al siguiente campo
    try {
      await api("rpc/guardar_articulo", {
        method: "POST",
        body: JSON.stringify({
          p_pin: estado.pin, p_mes: fila.mes, p_item: id, p_comprado: fila.comprado,
          p_lidl_precio: fila.lidl_precio, p_lidl_formato: fila.lidl_formato,
          p_costco_precio: fila.costco_precio, p_costco_formato: fila.costco_formato,
        }),
      });
      guardarLS(claveRemoto(), estado.remoto);
    } catch (e) {
      if (anterior) estado.remoto[id] = anterior; else delete estado.remoto[id];
      errorGuardado(e);
      pintar();
    }
  });
}

function desmarcarTodo() {
  conPin(async () => {
    const copia = structuredClone(estado.remoto);
    Object.values(estado.remoto).forEach((f) => { f.comprado = false; });
    pintar();
    try {
      await api("rpc/desmarcar_mes", { method: "POST", body: JSON.stringify({ p_pin: estado.pin, p_mes: estado.datos.mes }) });
    } catch (e) {
      estado.remoto = copia;
      errorGuardado(e);
      pintar();
    }
  });
}

async function comprobarPin(pin) {
  try {
    const ok = await api("rpc/verificar_pin", { method: "POST", body: JSON.stringify({ p_pin: pin }) });
    if (!ok) { estado.errorPin = "PIN incorrecto."; pintar(); return; }
    estado.pin = pin;
    guardarLS("bc:pin", pin);
    estado.pidiendoPin = false;
    estado.errorPin = "";
    const accion = estado.pendiente;
    estado.pendiente = null;
    if (accion) accion(); else pintar();
  } catch {
    estado.errorPin = "Sin conexión: no se ha podido comprobar el PIN.";
    pintar();
  }
}

// ---------- precios ----------
const numero = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function leerDecimal(texto) {
  const t = texto.trim().replace("€", "").replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

// "500 g", "1,5 kg", "6 × 1 l", "750 ml", "12 ud" → { cantidad, unidad } en kg, l o ud
function parsearFormato(texto) {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(/,/g, ".").replace(/[×x*]/g, " * ");
  const m = t.match(/^\s*(?:(\d+(?:\.\d+)?)\s*\*\s*)?(\d+(?:\.\d+)?)\s*(kg|kilos?|gr?|gramos?|l|litros?|ml|cl|ud|uds|u|unidades?)\.?\s*$/);
  if (!m) return null;
  const veces = m[1] ? Number(m[1]) : 1;
  const q = Number(m[2]) * veces;
  const u = m[3];
  if (/^k/.test(u)) return { cantidad: q, unidad: "kg" };
  if (/^g/.test(u)) return { cantidad: q / 1000, unidad: "kg" };
  if (u === "ml") return { cantidad: q / 1000, unidad: "l" };
  if (u === "cl") return { cantidad: q / 100, unidad: "l" };
  if (/^l/.test(u)) return { cantidad: q, unidad: "l" };
  return { cantidad: q, unidad: "ud" };
}

function unitario(precio, formato) {
  const f = parsearFormato(formato);
  if (precio == null || !f || !f.cantidad) return null;
  return { valor: precio / f.cantidad, unidad: f.unidad };
}

// Precio por kg/l/ud de cada súper y cuál es el más barato
function comparar(fila) {
  const u = Object.fromEntries(SUPERS.map(([s]) => [s, fila ? unitario(fila[`${s}_precio`], fila[`${s}_formato`]) : null]));
  let barato = null;
  if (u.lidl && u.costco && u.lidl.unidad === u.costco.unidad && u.lidl.valor !== u.costco.valor) {
    barato = u.lidl.valor < u.costco.valor ? "lidl" : "costco";
  }
  return { u, barato };
}

function resumenPrecios(fila) {
  if (!fila) return "";
  const { u } = comparar(fila);
  const partes = SUPERS.filter(([s]) => fila[`${s}_precio`] != null).map(([s, nombre]) =>
    u[s] ? `${nombre} ${numero(u[s].valor)} €/${u[s].unidad}` : `${nombre} ${numero(Number(fila[`${s}_precio`]))} €`);
  return partes.join(" · ");
}

function panelPrecios(x) {
  const fila = estado.remoto[x.id];
  const { u, barato } = comparar(fila);
  return `<div class="precios no-imprimir">${SUPERS.map(([s, nombre]) => {
    const precio = fila && fila[`${s}_precio`] != null ? numero(Number(fila[`${s}_precio`])) : "";
    const formato = (fila && fila[`${s}_formato`]) || "";
    const unit = u[s] ? `${numero(u[s].valor)} €/${u[s].unidad}${barato === s ? " · más barato" : ""}` : "";
    return `<div class="fila-precio">
      <span class="super">${nombre}</span>
      <label class="campo">Precio <input data-id="${x.id}" data-super="${s}" data-campo="precio" inputmode="decimal" placeholder="0,00" value="${escapar(precio)}" aria-label="Precio en ${nombre}"> €</label>
      <label class="campo">Formato <input data-id="${x.id}" data-super="${s}" data-campo="formato" placeholder="500 g" maxlength="40" value="${escapar(formato)}" aria-label="Formato en ${nombre}"></label>
      <span class="unitario ${barato === s ? "barato" : ""}">${unit}</span>
    </div>`;
  }).join("")}<p class="ayuda">Formato: 500 g · 1,5 kg · 6 × 1 l · 750 ml · 12 ud</p></div>`;
}

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
  const items = estado.datos.compra.filter((x) => estado.filtro === "todo" || x.grupo === estado.filtro);
  // Lo marcado como comprado en el .md cuenta siempre como hecho
  const hecho = (x) => x.comprado || Boolean(estado.remoto[x.id] && estado.remoto[x.id].comprado);
  const hechos = items.filter(hecho).length;
  const visibles = estado.ocultarMarcados ? items.filter((x) => !hecho(x)) : items;

  let html = "";
  if (estado.aviso) html += `<p class="aviso no-imprimir" role="status">${escapar(estado.aviso)}</p>`;
  if (estado.pidiendoPin) {
    html += `<form id="form-pin" class="pin no-imprimir">
      <label>PIN para guardar cambios <input id="pin" type="password" autocomplete="current-password" required></label>
      <button type="submit" class="activo">Entrar</button>
      <button type="button" id="cancelar-pin">Cancelar</button>
      ${estado.errorPin ? `<span class="error">${escapar(estado.errorPin)}</span>` : ""}
    </form>`;
  }
  html += `<div class="filtros no-imprimir" role="group" aria-label="Supermercado">${GRUPOS.map(([g, t]) =>
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
    const conPrecios = !SIN_PRECIOS.includes(x.grupo);
    const abierto = estado.abiertos.has(x.id);
    const resumen = conPrecios ? resumenPrecios(estado.remoto[x.id]) : "";
    html += `<li class="articulo ${hecho(x) ? "marcado" : ""}">
      <label><input type="checkbox" data-id="${x.id}" ${hecho(x) ? "checked" : ""} ${x.comprado ? "disabled" : ""}>
        <span class="texto"><strong>${escapar(x.producto)}</strong><span class="detalles">${det}</span>
        ${resumen ? `<span class="resumen-precios">${escapar(resumen)}</span>` : ""}</span>
      </label>
      ${conPrecios ? `<button class="boton-precio no-imprimir ${abierto ? "activo" : ""}" data-precios="${x.id}" aria-expanded="${abierto}" aria-label="Precios de ${escapar(x.producto)}">€</button>` : ""}
      ${abierto ? panelPrecios(x) : ""}</li>`;
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
  // Conserva el campo de precio en el que se está escribiendo al repintar
  const activo = document.activeElement;
  const foco = activo && activo.dataset && activo.dataset.campo
    ? `input[data-id="${activo.dataset.id}"][data-super="${activo.dataset.super}"][data-campo="${activo.dataset.campo}"]` : null;
  const vistas = { menu: vistaMenu, recetas: vistaRecetas, receta: () => vistaReceta(param), compra: vistaCompra, sesion: vistaSesion };
  $("#contenido").innerHTML = (vistas[ruta] || vistaMenu)();
  document.body.dataset.vista = pestana;
  const destino = $("#pin") || (foco && $(foco));
  if (destino) {
    destino.focus();
    const fin = destino.value.length;
    try { destino.setSelectionRange(fin, fin); } catch { /* tipo sin selección */ }
  }
}

document.addEventListener("change", (e) => {
  const d = e.target.dataset || {};
  if (d.id && d.campo) {
    const clave = `${d.super}_${d.campo}`;
    if (d.campo === "precio") {
      const valor = leerDecimal(e.target.value);
      if (Number.isNaN(valor)) { estado.aviso = "Precio no válido: escribe solo el número, por ejemplo 4,49."; pintar(); return; }
      guardarArticulo(d.id, { [clave]: valor });
    } else {
      guardarArticulo(d.id, { [clave]: e.target.value.trim() || null });
    }
  } else if (d.id) {
    const marcado = e.target.checked;
    e.target.checked = !marcado; // se confirma al guardar
    guardarArticulo(d.id, { comprado: marcado });
  } else if (e.target.id === "ocultar") {
    estado.ocultarMarcados = e.target.checked;
    guardarLS("bc:ocultar", estado.ocultarMarcados);
    pintar();
  }
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.precios) {
    const id = b.dataset.precios;
    if (estado.abiertos.has(id)) estado.abiertos.delete(id); else estado.abiertos.add(id);
    pintar();
  } else if (b.id === "cancelar-pin") {
    estado.pidiendoPin = false;
    estado.pendiente = null;
    estado.errorPin = "";
    pintar();
  } else if (b.dataset.filtro) {
    estado.filtro = b.dataset.filtro;
    guardarLS("bc:filtro", estado.filtro);
    pintar();
  } else if (b.id === "imprimir") {
    window.print();
  } else if (b.id === "desmarcar") {
    if (b.dataset.confirmar) {
      desmarcarTodo();
    } else {
      b.dataset.confirmar = "1";
      b.textContent = "¿Seguro? Pulsa otra vez";
      setTimeout(() => { delete b.dataset.confirmar; b.textContent = "Desmarcar todo"; }, 3000);
    }
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "form-pin") return;
  e.preventDefault();
  comprobarPin($("#pin").value);
});

window.addEventListener("hashchange", () => { pintar(); window.scrollTo(0, 0); });

// Sincroniza con lo que marquen los demás; no repinta si se está escribiendo
async function sincronizar() {
  if (!estado.datos || !remotoActivo() || document.visibilityState !== "visible") return;
  if (document.body.dataset.vista !== "compra") return;
  const antes = JSON.stringify(estado.remoto) + estado.aviso;
  await cargarEstado();
  const escribiendo = document.activeElement && document.activeElement.tagName === "INPUT" && document.activeElement.type !== "checkbox";
  if (!escribiendo && JSON.stringify(estado.remoto) + estado.aviso !== antes) pintar();
}
setInterval(sincronizar, 20000);
document.addEventListener("visibilitychange", sincronizar);

async function cargarMes(mes) {
  const r = await fetch(`datos/${mes}.json`, { cache: "no-cache" });
  estado.datos = await r.json();
  guardarLS("bc:mes", mes);
  document.title = `Batch Cooking · ${estado.datos.titulo}`;
  estado.remoto = leerLS(claveRemoto(), {});
  pintar();
  await cargarEstado();
  pintar();
}

async function iniciar() {
  estado.filtro = leerLS("bc:filtro", "todo");
  estado.ocultarMarcados = leerLS("bc:ocultar", false);
  estado.pin = leerLS("bc:pin", null);
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
