# Alper's Works Pattern Generator

**Open-Source Parametric Design, Perforation & CAD Studio — 100% Free, Browser-Based, Built for Graphic Design to Industrial Product Manufacturing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-1A1A1A.svg)](./LICENSE)
[![100% Free & Open Source](https://img.shields.io/badge/Free_%26_Open_Source-No_Watermarks-15803D.svg)](#license--commercial-freedom)
[![Runs Locally](https://img.shields.io/badge/Client--Side-Zero_Backend-2D2D2D.svg)](#quick-start)

> **[Türkçe Tanıtım & Özellikler için aşağı kaydırın ↓](#türkçe-tanıtım)**

---

## Why Alper's Works Pattern Generator?

Designers and engineers often have to bounce between graphic vector tools, complex 3D CAD plugins, and separate CAM/DFM checkers just to create a parametric pattern or perforation layout.

**Alper's Works Pattern Generator** bridges the entire creative and engineering spectrum in a single, fast, Swiss-minimalist web studio — running **100% locally in your browser** with zero accounts, zero paywalls, and true **1:1 millimeter precision**. Whether you are crafting a brand identity poster, a CSS background texture, an acoustic speaker grille, an architectural facade panel, or a laser-cut metal enclosure, your design goes from concept to production-ready files in seconds.

---

## From Graphic Design to Product Engineering

| Discipline | What You Can Create | Best Export Formats |
| :--- | :--- | :--- |
| **Graphic & Brand Design** | Halftone posters, optical moiré artwork, packaging textures, editorial grids | Graphic `.SVG`, High-Res `.PNG` / `.WebP` (up to 4×) |
| **Web & UI Design** | Lightweight hero backgrounds, geometric surface textures, interactive design systems | Compact `CSS` Data URI, `.SVG`, Shareable URL |
| **Interior & Lighting** | Decorative room dividers, backlit perforated screens, shadow-casting canopies | Graphic `.SVG`, Laser `.SVG`, `.DXF` |
| **Architecture & Facades** | Parametric sun-shading panels, arched mashrabiya screens, L-corner facade sheets (up to `5000 × 5000 mm`) | Layered `.DXF` (AutoCAD / Rhino / SolidWorks) |
| **Audio & Acoustics** | Hi-Fi speaker grilles, circular tweeter discs, hexagonal acoustic tiles with exact Open Area Ratio (OAR %) | `.DXF` + Live Focus & Panel OAR Telemetry |
| **Industrial & Product Design** | CNC-punched & laser-cut enclosures, ventilation grilles with real-time bridge safety & kerf compensation | Laser `.SVG` (`#FF0000` / `#0000FF`), `.DXF` (AC1015 & Legacy R12) |

---

## Key Capabilities

### 1. Flexible Workspace & Custom Panel Shapes (`50 – 5000 mm`)
- **True 1:1 Millimeter Dimensions**: Adjust width and height from `50 mm` up to `5000 mm` via slider or direct keyboard entry.
- **11 Panel Geometries**: `Rectangle`, `Rounded Rectangle`, `Circle`, `Capsule`, `Triangle`, `Hexagon`, `Octagon`, `Arch`, `L-Shape`, **Custom Freehand Polygon**, and **Custom SVG Boundary**.
- **Interactive Polygon Drawing & Vertex Editing**: Draw custom shapes point-by-point directly on the canvas, drag vertices (`Shift` to snap), insert points from edge midpoints (`+`), or right-click to remove corners.
- **Custom SVG Boundary Import**: Upload any closed `.svg` contour to use as your panel perimeter while preserving its natural aspect ratio.
- **Configurable Safe Margin & Edge Behavior**: `Center Inside`, `Complete Shape`, or `Clean Edge Clip` (Sutherland-Hodgman boundary slicing).

### 2. 12 Parametric Pattern Topologies & C¹ Adaptive Compression
- **12 Flow Topologies**:
  - `Hexagonal Lattice` · `Orthogonal Grid` · `Staggered Matrix` · `Diamond Matrix`
  - `Wave Flow` · `Vortex Spiral` · `Fibonacci Spiral` · `Concentric Radial`
  - `Diagonal Flow` · `Moiré Interference` · `Sunburst Rays` · `Organic Cellular`
- **C¹ Continuous Adaptive Edge Compression**: Smooth piecewise radial pitch compression (`k`) that tightens outer spacing with zero density kinks at the transition boundary.
- **Deterministic Seeding**: Powered by `Mulberry32` PRNG so every randomized or organic pattern is 100% reproducible across devices and shared links.

### 3. Motifs, Multi-Attractors & Halftone Image Mapping
- **10 Built-in Motifs + Custom SVG Motif Upload**: Includes geometric and architectural slots (`Circle`, `Hexagon`, `Square`, `Squircle`, `Diamond`, `4-Point Star`, `Capsule`, `Chamfer Slot`, `Chevron`, `Trapezoid`) plus a sanitized `.svg` importer preserving `evenodd` inner holes.
- **Interactive Multi-Attractor Canvas**: Drag point or line attractors directly on the canvas, resize influence radii live, snap to center axes with `Shift`, or double-click in Advanced mode to add multiple attractors.
- **Image Brightness / Halftone Modulator**: Upload any photo or logo to drive motif scale and rotation from pixel luminance with Contrast, Invert, Blend Strength, and Reference Overlay controls.

### 4. Real-Time Engineering & DFM Verification
- **Exact Shoelace Open Area Ratio (OAR)**: Live calculation for both **Full Panel OAR** and **Focus Zone OAR** (accurately clipped against any convex or concave panel boundary).
- **Spatial Hash Bridge & Collision Check**: Real-time minimum ligament (bridge) width in `mm` with instant visual highlighting for overlaps and thin bridges below target sheet thickness.
- **True Laser Kerf Compensation**: Inward normal offset (`0.00 – 1.00 mm`) for MDF, acrylic, aluminum, and steel laser cutting.

### 5. Studio Preview & Production Exports
- **4 Studio Viewport Modes**: `Architectural Light`, `Acoustic Dark`, `Brushed Metal`, and `CAD / Laser Wireframe` at 60 FPS on HiDPI displays.
- **Simple & Advanced Modes + Bilingual UI**: Switch effortlessly between Simple and Advanced workspaces, and toggle between **English** and **Türkçe** anytime.
- **12 Multi-Industry Starter Templates**: Ready-to-customize recipes spanning graphic design, architecture, acoustics, lighting, and industrial CNC.
- **Instant Exports**:
  - **Graphic SVG** (`1:1 mm`, custom fill/stroke colors, optional transparent background)
  - **Laser Cut SVG** (`0.1 mm` hairline strokes: Pass 1 `#FF0000` holes + Pass 2 `#0000FF` outline for LightBurn, Epilog, Trotec)
  - **Layered CAD DXF** (`$INSUNITS = 4` mm, `$MEASUREMENT = 1` metric; separated `HOLES`, `PANEL_OUTLINE`, and `ALIGNMENT_MARKS` layers + Legacy AutoCAD R12 mode)
  - **High-Res PNG & WebP** (`1×`, `2×`, `4×`)
  - **CSS Background Data URI**, **Shareable URL Hash**, and **JSON Recipe Save/Load**

---

## Quick Start

```bash
git clone https://github.com/alpersworks/Alpers-Works-Pattern-Generator.git
cd Alpers-Works-Pattern-Generator
npm install
npm run dev
```

Build for production (static deployment ready for Vercel, Netlify, or GitHub Pages):

```bash
npm run build
```

Type-check:

```bash
npm run lint
```

## CAD & Laser Import Guide

See [`docs/CAD-IMPORT-GUIDE.md`](./docs/CAD-IMPORT-GUIDE.md) for verified `1:1 mm` import workflows in **AutoCAD**, **Rhino 3D**, **SolidWorks**, and **LightBurn**.

---

## License & Commercial Freedom

This project is **100% free and open-source** under the [**MIT License**](./LICENSE).

- **No accounts, no subscriptions, no watermarks, no tracking.**
- **All generated SVG, Laser SVG, DXF, PNG, WebP, and CSS outputs belong 100% to you** — free to use in commercial products, client projects, architectural facades, branding, and physical manufacturing without attribution.

---

## Türkçe Tanıtım

### Alper's Works Pattern Generator Nedir?

**Alper's Works Pattern Generator**, grafik tasarımdan endüstriyel ürün tasarımına, mimari cephe panellerinden akustik hoparlör ızgaralarına kadar her ölçekte parametrik desen ve perforasyon (delik deseni) üretebilmeniz için geliştirilmiş **tamamen ücretsiz ve açık kaynaklı** bir tarayıcı stüdyosudur.

Herhangi bir kurulum, üyelik veya abonelik gerektirmeden doğrudan tarayıcınızda **1:1 gerçek milimetre hassasiyetiyle** çalışır.

### Neler Yapabilirsiniz?
- **Grafik & Marka Tasarımı:** Halftone afişler, optik Moiré dokular, ambalaj desenleri, yüksek çözünürlüklü PNG/WebP ve vektör SVG çıktıları.
- **Web & Arayüz Tasarımı:** Tek tıkla kopyalanabilen hafif CSS Data URI arka planları ve paylaşılabilir tasarım bağlantıları.
- **Mimari, İç Mekan & Aydınlatma:** `50 mm`'den `5000 × 5000 mm`'ye kadar kemerli, altıgen, L-köşe veya özel çizilmiş parametrik cephe ve seperatör panelleri.
- **Akustik & Ses Mühendisliği:** Gerçek zamanlı **Açık Alan Oranı (OAR %)** hesabıyla hoparlör ızgaraları ve akustik karolar.
- **Ürün Tasarımı & Lazer / CNC Üretim:** Malzeme kalınlığına göre canlı **minimum köprü genişliği** ve **çakışma kontrolü**, **Lazer Kerf telafisi**, katmanlı **DXF** (`AutoCAD`, `Rhino`, `SolidWorks`) ve **Lazer Kesim SVG** (`LightBurn`, `Epilog`, `Trotec`) çıktıları.

### Öne Çıkan Özellikler
- **Esnek Çalışma Alanı (`50 – 5000 mm`):** Elle tam milimetre girişi veya slider kontrolü.
- **11 Panel Geometrisi:** Dikdörtgen, Yuvarlak, Dairesel, Kapsül, Üçgen, Altıgen, Sekizgen, Kemer, L-Şekli, **Tuvalde Serbest Çokgen Çizimi / Köşe Düzenleme** ve **Özel SVG Sınır Yükleme**.
- **12 Parametrik Desen Akışı:** Heksagonal, Kare Izgara, Kademeli Matris, Baklava Matris, Dalgalı Akış, Vorteks, Fibonacci, Radyal Konsantrik, Diyagonal Akış, Moiré Girişim, Işınsal Güneş ve Organik Hücresel.
- **12 Sektörel Hazır Şablon & 10 Hazır Motif + Özel SVG Motif Yükleme.**
- **Görsel Parlaklık Haritası (Halftone):** Herhangi bir fotoğraf veya logoyu desen boyutu ve açısına dönüştürme.
- **%100 Ücretsiz, Açık Kaynak (MIT) ve Ticari Özgürlük:** Ürettiğiniz tüm desenler ve CAD/grafik dosyaları tamamen size aittir; ticari projelerinizde ve fiziksel üretimlerinizde özgürce kullanabilirsiniz.
