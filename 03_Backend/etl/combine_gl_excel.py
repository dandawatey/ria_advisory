"""
Combine all 17 subsidiary GL Excel files into a single Excel file.

Adds a "Subsidiary" column (Excel file name) as the first column of each sheet
before stacking all rows together.

Output: 00_InputSample/combined_gl.xlsx

Usage:
    python etl/combine_gl_excel.py
"""

from pathlib import Path
import logging
import pandas as pd

BASE_DIR   = Path(__file__).resolve().parent.parent.parent
SAMPLE_DIR = BASE_DIR / "00_InputSample"
OUTPUT     = SAMPLE_DIR / "combined_gl.xlsx"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# Ordered list so the combined file has a predictable row order
SUBSIDIARY_MAP = {
    "GL_RIA ADVISORY PHILS.xlsx":              "RIA Advisory Philippines",
    "GL_RIA ADVISORY S. DE RL. DE CV..xlsx":   "RIA Advisory Mexico",
    "GL_RIA Advisory Aggregator LLC.xlsx":     "RIA Advisory Aggregator LLC",
    "GL_RIA Advisory Borrower LLC.xlsx":       "RIA Advisory Borrower LLC",
    "GL_RIA Advisory Canada LTD.xlsx":         "RIA Advisory Canada Ltd",
    "GL_RIA Advisory Guarantor LLC.xlsx":      "RIA Advisory Guarantor LLC",
    "GL_RIA Advisory LLC Pty Ltd.xlsx":        "RIA Advisory Pty Ltd (AUS)",
    "GL_RIA Advisory LLC(USA).xlsx":           "RIA Advisory LLC (USA)",
    "GL_RIA Advisory LLP INDIA.xlsx":          "RIA Advisory LLP India",
    "GL_RIA_Advisory_Ltd.xlsx":                "RIA Advisory Ltd (UK)",
    "GL_Ria Advisory SA (Pty) Ltd.xlsx":       "RIA Advisory SA (ZAF)",
    "GL_SYNERSYS GLOBAL INC.xlsx":             "Synersys Global Inc",
    "GL_TMG Bidco Inc.xlsx":                   "TMG Bidco Inc",
    "GL_TMG Bidco Sub INC.xlsx":               "TMG Bidco Sub Inc",
    "GL_TMG CONSULTING CANADA,INC.xlsx":       "TMG Consulting Canada Inc",
    "GL_TMG Offshore Synersys Global.xlsx":    "TMG Offshore Synersys Global",
    "GL_TMG UTILITY ADVISORY SERVICES.xlsx":   "TMG Utility Advisory Services",
}


def main():
    frames = []

    for fname, subsidiary_name in SUBSIDIARY_MAP.items():
        path = SAMPLE_DIR / fname
        if not path.exists():
            log.warning("Missing: %s — skipped", fname)
            continue

        log.info("Reading %s …", fname)
        df = pd.read_excel(path, sheet_name="General Ledger Entries", dtype=str)

        # Insert Subsidiary columns at the front
        df.insert(0, "Subsidiary",      fname)           # exact file name
        df.insert(1, "Subsidiary Name", subsidiary_name) # human-readable name

        frames.append(df)
        log.info("  → %d rows", len(df))

    if not frames:
        log.error("No files loaded. Check that 00_InputSample contains the GL Excel files.")
        return

    combined = pd.concat(frames, ignore_index=True, sort=False)
    log.info("Combined: %d total rows across %d subsidiaries", len(combined), len(frames))

    log.info("Writing %s …", OUTPUT)
    with pd.ExcelWriter(OUTPUT, engine="openpyxl") as writer:
        combined.to_excel(writer, sheet_name="Combined GL", index=False)

    log.info("Done. Output: %s", OUTPUT)


if __name__ == "__main__":
    main()
