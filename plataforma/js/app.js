// ==========================================
// 1. CONFIGURACIÓN GENERAL
// ==========================================

const CSV_FILE = "pleyades_gaia_dr3.csv";

// ==========================================
// 2. ALADIN LITE
// ==========================================

const aladin = A.aladin("#aladin-container", {
  survey: "P/DSS2/color",
  fov: 3.0,
  target: "M45"
});

let catalogoDatos = null;
let catalogoSeleccion = null;
let datosPleyades = [];
let pyodide = null;

// ==========================================
// 3. FUNCIONES AUXILIARES
// ==========================================

function borrarCatalogo(cat) {
  if (!cat) return;
  try {
    if (typeof cat.clear === "function") cat.clear();
    if (typeof aladin.removeCatalog === "function") aladin.removeCatalog(cat);
  } catch (e) {
    console.warn("No se pudo borrar catálogo:", e);
  }
}

function formatearNumero(valor, decimales = 3) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "No disponible";
  return Number(valor).toFixed(decimales);
}

function numeroSeguro(val) {
  if (val === undefined || val === null || val.toString().trim() === "") return NaN;
  return Number(val);
}

function parseCSVLine(line) {
  return line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
}

function csvToObjects(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("El CSV no contiene datos suficientes.");
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i]; });
    return obj;
  });
}

function normalizarFuente(row) {
  const source_id = String(row.source_id);
  const ra = numeroSeguro(row.ra);
  const dec = numeroSeguro(row.dec);
  const parallax = numeroSeguro(row.parallax);
  const pmra = numeroSeguro(row.pmra);
  const pmdec = numeroSeguro(row.pmdec);
  const phot_g_mean_mag = numeroSeguro(row.phot_g_mean_mag);
  const bp_rp = numeroSeguro(row.bp_rp);
  const teff_gspphot = numeroSeguro(row.teff_gspphot);
  const distancia = Number.isFinite(parallax) && parallax > 0 ? 1000 / parallax : NaN;
  return {
    source_id, nombre: `Gaia DR3 ${source_id}`,
    ra, dec, parallax, distancia, pmra, pmdec,
    phot_g_mean_mag, mag: phot_g_mean_mag,
    bp_rp, color: bp_rp, teff_gspphot, temperatura: teff_gspphot
  };
}

function fuenteValida(d) {
  return d.source_id && Number.isFinite(d.ra) && Number.isFinite(d.dec);
}

function actualizarTextoConsola(cantidadFuentes) {
  const intro = document.getElementById("terminal-intro");
  const code = document.getElementById("python-code");
  const out = document.getElementById("python-output");

  if (intro) {
    intro.innerText = `Esta es una consola interactiva de Python.

Archivo disponible: ${CSV_FILE}

El archivo contiene ${cantidadFuentes} estrellas del Cúmulo de Pléyades. Puedes explorar el dataset, revisar sus variables, clasificar estrellas, filtrarlas, graficarlas y construir un diagrama HR.`;
  }

  if (code && code.hasAttribute("data-default")) {
    code.value = `# Consola de análisis en Python
# Archivo de datos cargado: ${CSV_FILE}
# Total de estrellas cargadas: ${cantidadFuentes}

# Puedes comenzar revisando las primeras filas:
print(df.head())

# También puedes revisar las columnas disponibles:
print(df.columns)

# O contar cuántas estrellas hay:
print(len(df))`;
  }

  if (out) {
    out.innerText = "Aquí se mostrarán los resultados de tu código en Python.";
  }
}

// ==========================================
// 4. CARGA DIRECTA DEL CSV EN JAVASCRIPT
// ==========================================

async function cargarDatosPleyadesJS() {
  const info = document.getElementById("object-info");
  const status = document.getElementById("status-python");

  try {
    if (status) {
      status.innerText = "Cargando CSV...";
      status.style.color = "#ffb3d1";
    }

    const response = await fetch(CSV_FILE);
    if (!response.ok) throw new Error(`No se pudo cargar ${CSV_FILE}.`);

    const csvText = await response.text();
    datosPleyades = csvToObjects(csvText).map(normalizarFuente).filter(fuenteValida);

    if (datosPleyades.length === 0) throw new Error("No quedaron fuentes válidas.");

    actualizar_mapa(datosPleyades);
    actualizarTextoConsola(datosPleyades.length);

    if (info) {
      info.innerText = `Dataset cargado correctamente

Archivo: ${CSV_FILE}
Fuentes dibujadas: ${datosPleyades.length}

¿Cómo usar StarsLab?

· Haz clic en cualquier estrella del mapa para ver sus datos físicos aquí.

· En la consola Python puedes explorar el dataset completo con df.head() o graficar con matplotlib.

· Las variables disponibles incluyen: ra, dec, parallax, distancia, mag, color y temperatura.`;
    }

    if (status) {
      status.innerText = "CSV listo";
      status.style.color = "#ffb3d1";
    }

  } catch (error) {
    console.error(error);
    if (info) info.innerText = `ERROR AL CARGAR EL DATASET\n--------------------------\n${error.message}`;
    if (status) { status.innerText = "Error CSV"; status.style.color = "#ff5555"; }
  }
}

// ==========================================
// 5. DIBUJO EN ALADIN
// ==========================================

function actualizar_mapa(datos) {
  borrarCatalogo(catalogoDatos);
  borrarCatalogo(catalogoSeleccion);

  catalogoDatos = A.catalog({
    name: "Pléyades Gaia DR3",
    color: "#ffb3d1",
    shape: "circle",
    sourceSize: 18
  });

  const fuentes = datos.map(d => {
    const source = A.source(d.ra, d.dec, d);
    source.data = d;
    return source;
  });

  catalogoDatos.addSources(fuentes);
  aladin.addCatalog(catalogoDatos);
  console.log(`Fuentes dibujadas en Aladin: ${fuentes.length}`);
}

// ==========================================
// 6. CLICK EN ESTRELLA
// ==========================================

function mostrarObjetoSeleccionado(d) {
  if (!d) return;

  const panel = document.getElementById("object-info");

  panel.innerText = `DATOS DE LA ESTRELLA
--------------------------
Nombre: ${d.nombre || "Gaia DR3 " + d.source_id}
ID Gaia: ${d.source_id}

Coordenadas:
Asc. Recta (RA): ${formatearNumero(d.ra, 5)}°
Declinación (DEC): ${formatearNumero(d.dec, 5)}°

Física estelar:
Paralaje: ${formatearNumero(d.parallax, 3)} mas
Distancia: ${formatearNumero(d.distancia, 1)} pc
Temperatura: ${Number.isNaN(d.temperatura) ? "No disponible" : Math.round(d.temperatura) + " K"}

Fotometría y movimiento:
Magnitud G: ${formatearNumero(d.phot_g_mean_mag, 2)}
Índice de color (BP-RP): ${formatearNumero(d.bp_rp, 2)}
Mov. propio RA: ${formatearNumero(d.pmra, 3)} mas/año
Mov. propio DEC: ${formatearNumero(d.pmdec, 3)} mas/año`;

  borrarCatalogo(catalogoSeleccion);

  catalogoSeleccion = A.catalog({
    name: "Selección",
    color: "#ffffff",
    shape: "circle",
    sourceSize: 25
  });

  const selectedSource = A.source(d.ra, d.dec, d);
  catalogoSeleccion.addSources([selectedSource]);
  aladin.addCatalog(catalogoSeleccion);
}

aladin.on("objectClicked", obj => {
  if (!obj || (!obj.data && !obj.source_id)) {
    borrarCatalogo(catalogoSeleccion);
    document.getElementById("object-info").innerText = "Haz clic en una estrella del mapa para ver sus datos aquí.";
    return;
  }
  const d = obj.data || obj;
  mostrarObjetoSeleccionado(d);
});

// ==========================================
// 7. PYODIDE
// ==========================================

async function initPython() {
  const status = document.getElementById("status-python");

  try {
    status.innerText = "Cargando Python...";
    status.style.color = "#ffb3d1";

    pyodide = await loadPyodide();
    await pyodide.loadPackage(["pandas", "matplotlib"]);

    const response = await fetch(CSV_FILE);
    const csvText = await response.text();
    pyodide.FS.writeFile(CSV_FILE, csvText);

    await pyodide.runPythonAsync(`
import pandas as pd
import js

df_raw = pd.read_csv("${CSV_FILE}")
df = df_raw.copy()

columnas_numericas = [
    "ra", "dec", "parallax", "pmra", "pmdec",
    "phot_g_mean_mag", "bp_rp", "teff_gspphot"
]

for col in columnas_numericas:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna(subset=["source_id", "ra", "dec", "parallax", "phot_g_mean_mag", "bp_rp"])
df = df[df["parallax"] > 0]

df["nombre"] = "Gaia DR3 " + df["source_id"].astype(str)
df["mag"] = df["phot_g_mean_mag"]
df["color"] = df["bp_rp"]
df["distancia"] = 1000 / df["parallax"]
df["temperatura"] = df["teff_gspphot"]

columnas_finales = [
    "source_id", "nombre", "ra", "dec", "parallax", "distancia",
    "pmra", "pmdec", "phot_g_mean_mag", "mag", "bp_rp", "color",
    "teff_gspphot", "temperatura"
]

df = df[columnas_finales]

def update_sky(df_in):
    js.window.actualizar_mapa_json(df_in.to_json(orient="records"))

globals()["df"] = df
globals()["update_sky"] = update_sky
`);

    status.innerText = "Python listo";
    status.style.color = "#ffb3d1";

  } catch (error) {
    console.error(error);
    status.innerText = "Error Python";
    status.style.color = "#ff5555";
  }
}

// ==========================================
// 8. PYTHON → JAVASCRIPT
// ==========================================

window.actualizar_mapa_json = function (jsonStr) {
  try {
    const datos = JSON.parse(jsonStr);
    actualizar_mapa(datos);
  } catch (e) {
    console.error("JSON inválido:", e);
  }
};

// ==========================================
// 9. TERMINAL PYTHON
// ==========================================

window.addEventListener("DOMContentLoaded", async () => {
  await cargarDatosPleyadesJS();
  await initPython();

  // Botón Graficar diagrama HR
  const btnMision = document.getElementById("btn-mision-1");
  if (btnMision) {
    btnMision.onclick = () => {
      window.location.href = '../diagrama-hr/index.html';
    };
  }

  const btn = document.getElementById("run-python");
  const out = document.getElementById("python-output");
  const code = document.getElementById("python-code");

  code.addEventListener("input", () => {
    if (code.hasAttribute("data-default")) code.removeAttribute("data-default");
  });

  btn.onclick = async () => {
    out.innerText = "Ejecutando...\n";
    try {
      pyodide.globals.set("_code", code.value);
      const res = await pyodide.runPythonAsync(`
import io, traceback
from contextlib import redirect_stdout, redirect_stderr

_out = io.StringIO()
_err = io.StringIO()

try:
    with redirect_stdout(_out), redirect_stderr(_err):
        exec(_code, globals())
except Exception:
    traceback.print_exc(file=_err)

(_out.getvalue(), _err.getvalue())
`);
      const [stdout, stderr] = res.toJs();
      out.innerText = stderr ? stderr : (stdout || "✔ Código ejecutado exitosamente.");
      setTimeout(() => { out.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 50);
    } catch (e) {
      out.innerText = e.toString();
    }
  };
});

// ==========================================
// 10. TERMINAL UI
// ==========================================

window.toggleTerminal = function () {
  const t = document.getElementById("terminal-container");
  const a = document.getElementById("terminal-arrow");
  t.classList.toggle("terminal-open");
  a.innerText = t.classList.contains("terminal-open") ? "▼" : "▲";
};

window.cerrarGuiaConsola = function () {
  const box = document.getElementById("terminal-help-box");
  const code = document.getElementById("python-code");
  if (box) box.style.display = "none";
  if (code) { code.style.minHeight = "230px"; code.style.height = "250px"; }
};

// ==========================================
// 11. TRADUCCIÓN Y ESTILOS POPUP ALADIN
// ==========================================

function traducirYEstilizarAladin() {
  const traducciones = {
    "Base image layer": "Capa de imagen base",
    "Color map:": "Mapa de color:",
    "Reverse": "Invertir",
    "Overlay layers": "Capas superpuestas",
    "Reticle": "Retícula",
    "HEALPix grid": "Grilla HEALPix",
    "Tools": "Herramientas",
    "Export view as PNG": "Exportar vista como PNG",
    "native": "nativo",
    "grayscale": "escala de grises",
    "rainbow": "arcoíris",
  };

  const observer = new MutationObserver(() => {
    document.querySelectorAll(".aladin-box *").forEach(el => {
      const style = el.getAttribute("style") || "";
      const bg = window.getComputedStyle(el).backgroundColor;
      const isRosado =
        style.includes("ffb3d1") ||
        style.includes("pink") ||
        bg.includes("255, 179, 209") ||
        bg.includes("255, 182, 193");

      if (isRosado || el.innerText?.includes("Gaia") || el.innerText?.includes("Pléyades")) {
        el.style.setProperty("color", "#000000", "important");
        el.style.setProperty("font-weight", "700", "important");
        el.style.setProperty("text-shadow", "none", "important");
      }
    });

    document.querySelectorAll(".aladin-box span, .aladin-box div").forEach(el => {
      const bg = el.style.backgroundColor || window.getComputedStyle(el).backgroundColor;
      if (
        el.innerText?.includes("Gaia") ||
        el.innerText?.includes("Pléyades") ||
        (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent")
      ) {
        el.style.color = "#000000";
        el.style.fontWeight = "700";
        el.style.textShadow = "none";
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

traducirYEstilizarAladin();