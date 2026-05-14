// ==========================================
// 1. CONFIGURACIÓN GENERAL
// ==========================================

const CSV_PLEYADES = "pleyades_gaia_dr3.csv";
const CSV_HR = "datos-estrellas.csv";

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

Archivo disponible: ${CSV_PLEYADES}

El archivo contiene ${cantidadFuentes} estrellas del Cúmulo de Pléyades. Puedes explorar el dataset, revisar sus variables, clasificar estrellas, filtrarlas, graficarlas y construir un diagrama HR.`;
  }

  if (code && code.hasAttribute("data-default")) {
    code.value = `# Consola de análisis en Python
# Archivo de datos cargado: ${CSV_PLEYADES}
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
// 4. CARGA DEL CSV DE PLÉYADES (mapa)
// ==========================================

async function cargarDatosPleyadesJS() {
  const info = document.getElementById("object-info");
  const status = document.getElementById("status-python");

  try {
    if (status) { status.innerText = "Cargando CSV..."; status.style.color = "#37d6c6"; }

    const response = await fetch(CSV_PLEYADES);
    if (!response.ok) throw new Error(`No se pudo cargar ${CSV_PLEYADES}.`);

    const csvText = await response.text();
    datosPleyades = csvToObjects(csvText).map(normalizarFuente).filter(fuenteValida);

    if (datosPleyades.length === 0) throw new Error("No quedaron fuentes válidas.");

    actualizar_mapa(datosPleyades);
    actualizarTextoConsola(datosPleyades.length);

    if (info) {
      info.innerText = `Dataset cargado correctamente
-----------------------------
Archivo: ${CSV_PLEYADES}
Fuentes dibujadas: ${datosPleyades.length}

Haz clic en una estrella del mapa para ver sus datos aquí.`;
    }

    if (status) { status.innerText = "CSV listo"; status.style.color = "#00ffcc"; }

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
    color: "#37d6c6",
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
RA: ${formatearNumero(d.ra, 5)}°
DEC: ${formatearNumero(d.dec, 5)}°

Física:
Paralaje: ${formatearNumero(d.parallax, 3)} mas
Distancia: ${formatearNumero(d.distancia, 1)} pc
Temperatura: ${Number.isNaN(d.temperatura) ? "No disponible" : Math.round(d.temperatura) + " K"}

Fotometría y Movimiento:
Magnitud G: ${formatearNumero(d.phot_g_mean_mag, 2)}
Índice Color (BP-RP): ${formatearNumero(d.bp_rp, 2)}
Mov. Propio RA: ${formatearNumero(d.pmra, 3)} mas/año
Mov. Propio DEC: ${formatearNumero(d.pmdec, 3)} mas/año`;

  borrarCatalogo(catalogoSeleccion);
  catalogoSeleccion = A.catalog({ name: "Selección", color: "#ffcc00", shape: "circle", sourceSize: 25 });
  catalogoSeleccion.addSources([A.source(d.ra, d.dec, d)]);
  aladin.addCatalog(catalogoSeleccion);
}

aladin.on("objectClicked", obj => {
  if (!obj || (!obj.data && !obj.source_id)) {
    borrarCatalogo(catalogoSeleccion);
    document.getElementById("object-info").innerText = "Haz clic en una estrella del mapa para ver sus datos aquí.";
    return;
  }
  mostrarObjetoSeleccionado(obj.data || obj);
});

// ==========================================
// 7. PYODIDE — solo carga Pléyades
// ==========================================

async function initPython() {
  const status = document.getElementById("status-python");

  try {
    status.innerText = "Cargando Python...";
    status.style.color = "#37d6c6";

    pyodide = await loadPyodide();
    await pyodide.loadPackage(["pandas", "matplotlib", "numpy"]);

    const r1 = await fetch(CSV_PLEYADES);
    pyodide.FS.writeFile(CSV_PLEYADES, await r1.text());

    await pyodide.runPythonAsync(`
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import io, base64, js

# DataFrame Pléyades
df_raw = pd.read_csv("${CSV_PLEYADES}")
df = df_raw.copy()

for col in ["ra","dec","parallax","pmra","pmdec","phot_g_mean_mag","bp_rp","teff_gspphot"]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna(subset=["source_id","ra","dec","parallax","phot_g_mean_mag","bp_rp"])
df = df[df["parallax"] > 0].copy()
df["nombre"] = "Gaia DR3 " + df["source_id"].astype(str)
df["mag"] = df["phot_g_mean_mag"]
df["color"] = df["bp_rp"]
df["distancia"] = 1000 / df["parallax"]
df["temperatura"] = df["teff_gspphot"]

# Patch plt.show para mostrar gráficos inline
def _show(*a, **kw):
    for _fn in plt.get_fignums():
        _fig = plt.figure(_fn)
        _buf = io.BytesIO()
        _fig.savefig(_buf, format="png", bbox_inches="tight", dpi=130)
        _buf.seek(0)
        _du = "data:image/png;base64," + base64.b64encode(_buf.read()).decode()
        js.window.mostrarGrafico(_du)
        plt.close(_fig)
plt.show = _show

def update_sky(df_in):
    js.window.actualizar_mapa_json(df_in.to_json(orient="records"))

globals().update({"df": df, "plt": plt, "np": np, "pd": pd, "update_sky": update_sky})
`);

    status.innerText = "Python listo ✓";
    status.style.color = "#00ffcc";

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
    actualizar_mapa(JSON.parse(jsonStr));
  } catch (e) {
    console.error("JSON inválido:", e);
  }
};

window.mostrarGrafico = function (dataUrl) {
  const out = document.getElementById("python-output");
  if (out.querySelector("img") === null && out.innerText.trim() === "Ejecutando...") {
    out.innerText = "";
  }
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText = "max-width:100%; display:block; margin:10px auto; border-radius:6px;";
  out.appendChild(img);

  const dlBtn = document.createElement("a");
  dlBtn.href = dataUrl;
  dlBtn.download = `grafico_${Date.now()}.png`;
  dlBtn.innerText = "⬇ Descargar imagen";
  dlBtn.style.cssText = `
    display:inline-block; margin:4px 0 12px 0;
    color:#37d6c6; font-size:11px; font-family:monospace;
    text-decoration:underline; cursor:pointer;
  `;
  out.appendChild(dlBtn);
  setTimeout(() => img.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
};

// ==========================================
// 9. TERMINAL PYTHON — EJECUCIÓN
// ==========================================

window.addEventListener("DOMContentLoaded", async () => {
  await cargarDatosPleyadesJS();
  await initPython();

  const btn = document.getElementById("run-python");
  const out = document.getElementById("python-output");
  const code = document.getElementById("python-code");

  code.addEventListener("input", () => {
    if (code.hasAttribute("data-default")) code.removeAttribute("data-default");
  });

  btn.onclick = async () => {
    out.innerHTML = "";
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
      const tieneImagenes = out.querySelector("img") !== null;

      if (stderr) {
        if (tieneImagenes) {
          const pre = document.createElement("pre");
          pre.style.cssText = "color:#ff6b6b; margin-top:8px; font-size:12px;";
          pre.innerText = stderr;
          out.appendChild(pre);
        } else {
          out.innerText = stderr;
        }
      } else if (stdout) {
        if (tieneImagenes) {
          const pre = document.createElement("pre");
          pre.style.cssText = "color:#fff; margin-top:8px; font-size:13px;";
          pre.innerText = stdout;
          out.appendChild(pre);
        } else {
          out.innerText = stdout;
        }
      } else if (!tieneImagenes) {
        out.innerText = "✔ Código ejecutado exitosamente.";
      }

      setTimeout(() => out.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);

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