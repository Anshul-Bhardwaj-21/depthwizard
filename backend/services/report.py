"""
report.py
---------
PDF report generation using reportlab (pure Python, no system dependencies).
WeasyPrint was originally considered but requires GTK/Pango/Cairo native libs
which are not available on a standard Windows install.
"""
import json
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER


OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "job_outputs"


def generate_report(job_id: str, format: str = "pdf") -> str:
    job_dir = OUTPUTS_DIR / job_id
    if not job_dir.exists():
        raise FileNotFoundError(f"Job {job_id} not found")

    result_path = job_dir / "result.json"
    res = {}
    if result_path.exists():
        res = json.loads(result_path.read_text())

    out_file = str(job_dir / f"report.pdf")
    doc = SimpleDocTemplate(out_file, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=18, alignment=TA_CENTER, spaceAfter=12)
    heading_style = styles["Heading2"]
    body_style = styles["Normal"]

    story = []

    # Title
    story.append(Paragraph("DepthWizard Analysis Report", title_style))
    story.append(Spacer(1, 0.5*cm))

    # Provenance table
    calib = res.get("calibration") or {}
    bounds = res.get("bounds_wgs84")
    mode = res.get("mode", "relative")
    georef = res.get("georeferenced", False)

    prov_data = [
        ["Job ID", job_id],
        ["Mode", mode],
        ["Georeferenced", str(georef)],
        ["Calibration Scale", f"{calib.get('scale', 'N/A'):.4f}" if isinstance(calib.get('scale'), float) else "N/A"],
        ["Calibration Offset", f"{calib.get('offset', 'N/A'):.4f}" if isinstance(calib.get('offset'), float) else "N/A"],
        ["Inlier Fraction", f"{calib.get('inlier_fraction', 'N/A'):.2%}" if isinstance(calib.get('inlier_fraction'), float) else "N/A"],
        ["Bounds (W,S,E,N)", str(bounds) if bounds else "N/A"],
    ]

    story.append(Paragraph("Provenance", heading_style))
    tbl = Table(prov_data, colWidths=[5*cm, 11*cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.whitesmoke, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 0.5*cm))

    # Images
    for label, fname in [("Digital Surface Model (DSM)", "height_preview.png"), ("RGB Texture", "texture.png")]:
        img_path = job_dir / fname
        if img_path.exists():
            story.append(Paragraph(label, heading_style))
            try:
                rl_img = RLImage(str(img_path), width=12*cm, height=12*cm, kind="proportional")
                story.append(rl_img)
            except Exception:
                story.append(Paragraph(f"(Could not embed {fname})", body_style))
            story.append(Spacer(1, 0.3*cm))

    doc.build(story)
    return out_file
