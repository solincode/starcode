from astroquery.gaia import Gaia
import pandas as pd

print("El script sí se está ejecutando...")

OUTPUT_FILE = "e5084979-4c81-11f1-b4f2-bc97e148b76b-O-result.csv"

N_POR_CLASE = 250

consultas = {
    "Azul": f"""
        SELECT TOP {N_POR_CLASE}
            source_id,
            ra,
            dec,
            teff_gspphot,
            phot_g_mean_mag,
            bp_rp
        FROM gaiadr3.gaia_source
        WHERE teff_gspphot >= 10000
          AND teff_gspphot IS NOT NULL
          AND phot_g_mean_mag IS NOT NULL
          AND bp_rp IS NOT NULL
    """,

    "Blanca": f"""
        SELECT TOP {N_POR_CLASE}
            source_id,
            ra,
            dec,
            teff_gspphot,
            phot_g_mean_mag,
            bp_rp
        FROM gaiadr3.gaia_source
        WHERE teff_gspphot >= 7500
          AND teff_gspphot < 10000
          AND teff_gspphot IS NOT NULL
          AND phot_g_mean_mag IS NOT NULL
          AND bp_rp IS NOT NULL
    """,

    "Amarilla": f"""
        SELECT TOP {N_POR_CLASE}
            source_id,
            ra,
            dec,
            teff_gspphot,
            phot_g_mean_mag,
            bp_rp
        FROM gaiadr3.gaia_source
        WHERE teff_gspphot >= 5200
          AND teff_gspphot < 7500
          AND teff_gspphot IS NOT NULL
          AND phot_g_mean_mag IS NOT NULL
          AND bp_rp IS NOT NULL
    """,

    "Roja": f"""
        SELECT TOP {N_POR_CLASE}
            source_id,
            ra,
            dec,
            teff_gspphot,
            phot_g_mean_mag,
            bp_rp
        FROM gaiadr3.gaia_source
        WHERE teff_gspphot < 5200
          AND teff_gspphot IS NOT NULL
          AND phot_g_mean_mag IS NOT NULL
          AND bp_rp IS NOT NULL
    """
}

dataframes = []

for clase, query in consultas.items():
    print(f"\nDescargando estrellas reales: {clase}")

    job = Gaia.launch_job_async(query)
    tabla = job.get_results()

    df = tabla.to_pandas()
    df["clase_referencia"] = clase

    print(f"{clase}: {len(df)} fuentes descargadas")

    dataframes.append(df)

dataset = pd.concat(dataframes, ignore_index=True)

dataset = dataset.sample(frac=1, random_state=42).reset_index(drop=True)

dataset.to_csv(OUTPUT_FILE, index=False)

print("\nCSV creado correctamente:")
print(OUTPUT_FILE)

print("\nTotal de fuentes:", len(dataset))

print("\nDistribución final:")
print(dataset["clase_referencia"].value_counts())