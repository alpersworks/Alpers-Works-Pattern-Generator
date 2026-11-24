# CAD & Laser Fabrication Import Guide

Alper's Works Pattern Generator outputs true 1:1 millimeter geometry. Follow these verified import steps for each destination software.

## 1. AutoCAD / DraftSight / LibreCAD (DXF)
- All DXF exports include both `$INSUNITS = 4` (Millimeters) and `$MEASUREMENT = 1` (Metric).
- Layers are pre-separated:
  - `HOLES` (ACI Red 1) — All perforation closed polylines.
  - `PANEL_OUTLINE` (ACI Blue 5) — Outer cut perimeter of the panel.
  - `ALIGNMENT_MARKS` (ACI Green 3) — Reference registration crosshairs (optional).
- If opening on a legacy CNC controller that rejects AC1015 `LWPOLYLINE` entities, enable **Legacy R12 (AC1009)** in the Export panel before downloading DXF.

## 2. Rhino 3D
1. Start a new document using the **Small Objects — Millimeters** template.
2. Run `Import` (not Open) and select the `.dxf` file.
3. Verify `Model units: Millimeters` in the import dialog.
4. Select `PANEL_OUTLINE` and `HOLES` together and run `PlanarSrf` or `ExtrudeCrv` (`Solid=Yes`) to create a 3D sheet metal solid ready for STEP export.

## 3. SolidWorks
1. Use `File → Open` and choose `.dxf`.
2. In the DXF/DWG Import Wizard, choose **Import to a new part as: 2D sketch**.
3. Set units to **Millimeters** and disable "Merge points closer than" if your kerf-offset vertices are fine.
4. Extrude Boss/Base to your sheet thickness.

## 4. LightBurn / Epilog / Trotec (Laser Cut SVG)
- Use the dedicated **Laser Cut SVG** export profile.
- All holes are exported with `fill="none"`, `stroke="#FF0000"`, `stroke-width="0.1mm"`.
- The outer panel perimeter is exported with `fill="none"`, `stroke="#0000FF"`, `stroke-width="0.1mm"`.
- In LightBurn, set the **Red** layer to cut first (`Pass 1 — Inner Cuts`) and the **Blue** layer to cut second (`Pass 2 — Outer Perimeter`) so the workpiece never shifts before holes are cut.
- **Recommended Kerf Compensation**:
  - 3 mm MDF / Plywood: `0.15 – 0.25 mm`
  - 3 mm Cast Acrylic: `0.10 – 0.20 mm`
  - 1–2 mm Stainless / Aluminum Fiber Laser: `0.08 – 0.15 mm`
