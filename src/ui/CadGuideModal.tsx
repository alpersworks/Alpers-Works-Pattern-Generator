import React from 'react';
import { X } from 'lucide-react';
import type { Locale } from '../engine/types';
import type { Translations } from '../i18n/translations';

interface CadGuideModalProps {
  open: boolean;
  locale: Locale;
  t: Translations;
  onClose: () => void;
}

export const CadGuideModal: React.FC<CadGuideModalProps> = ({
  open,
  locale,
  t,
  onClose,
}) => {
  if (!open) return null;

  const isTr = locale === 'tr';

  const sections = isTr
    ? [
        {
          title: '01. AutoCAD / DraftSight / LibreCAD (DXF)',
          body: 'Tüm DXF çıktıları hem $INSUNITS = 4 (milimetre) hem de $MEASUREMENT = 1 (metrik) başlıklarıyla üretilir. HOLES (Kırmızı), PANEL_OUTLINE (Mavi) ve isteğe bağlı ALIGNMENT_MARKS (Yeşil) katmanları ayrıdır. Eski CNC kontrolörleri için Dışa Aktar penceresinde AutoCAD R12 uyumluluk modunu açabilirsiniz.',
        },
        {
          title: '02. Rhino 3D',
          body: 'Small Objects — Millimeters şablonunu açın ve File → Import komutuyla .dxf dosyasını aktarın. PANEL_OUTLINE ile HOLES eğrilerini birlikte seçip PlanarSrf veya ExtrudeCrv (Solid=Yes) uygulayarak STEP (.stp) ihracına hazır 3D katı sac oluşturabilirsiniz.',
        },
        {
          title: '03. SolidWorks',
          body: 'File → Open ile .dxf dosyasını seçin. DXF/DWG Import Wizard içinde "2D sketch" ve birim olarak Millimeters seçin; ardından Extruded Boss/Base ile sac kalınlığı verin.',
        },
        {
          title: '04. LightBurn / Epilog / Trotec (Lazer Kesim SVG)',
          body: 'Lazer Kesim SVG profili tüm delikleri dolgusuz 0,1 mm Kırmızı (#FF0000), dış çerçeveyi ise Mavi (#0000FF) olarak ayırır. Parçanın kaymaması için kesim sırasını önce Kırmızı (iç delikler), sonra Mavi (dış sınır) yapın.',
        },
      ]
    : [
        {
          title: '01. AutoCAD / DraftSight / LibreCAD (DXF)',
          body: 'Every DXF file embeds both $INSUNITS = 4 (Millimeters) and $MEASUREMENT = 1 (Metric). Layers are cleanly separated into HOLES (Red), PANEL_OUTLINE (Blue), and optional ALIGNMENT_MARKS (Green). For older CNC controllers, toggle Legacy AutoCAD R12 mode in the Export dialog.',
        },
        {
          title: '02. Rhino 3D',
          body: 'Open a Small Objects — Millimeters template and run Import (not Open). Select PANEL_OUTLINE and HOLES together, then run PlanarSrf or ExtrudeCrv (Solid=Yes) to build a watertight 3D sheet ready for STEP export.',
        },
        {
          title: '03. SolidWorks',
          body: 'Open the .dxf file via File → Open, select "Import to a new part as: 2D sketch" with Millimeters units, and extrude directly to your target sheet thickness.',
        },
        {
          title: '04. LightBurn / Epilog / Trotec (Laser Cut SVG)',
          body: 'Use the Laser Cut SVG profile: no fills, 0.1 mm hairline strokes with Red (#FF0000) for inner holes and Blue (#0000FF) for the outer perimeter. Set Pass 1 to Red and Pass 2 to Blue so the workpiece never shifts before inner cutouts finish.',
        },
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-[#E4E4E7] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[86vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#E4E4E7]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">
              {t.cadGuideTitle}
            </h2>
            <p className="text-xs text-[#595959] mt-0.5">{t.cadGuideSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="p-1.5 text-[#595959] hover:text-[#1A1A1A] hover:bg-[#F4F4F5] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto aw-scroll space-y-5">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-1.5 pb-4 border-b border-[#F4F4F5] last:border-b-0 last:pb-0">
              <h3 className="font-display text-sm font-semibold text-[#1A1A1A]">{sec.title}</h3>
              <p className="text-xs leading-relaxed text-[#595959]">{sec.body}</p>
            </div>
          ))}

          {/* Kerf & Acoustic Reference Table */}
          <div className="pt-2">
            <h3 className="font-display text-sm font-semibold text-[#1A1A1A] mb-2">
              {isTr ? 'Üretim Referans Değerleri' : 'Fabrication Reference Values'}
            </h3>
            <div className="overflow-x-auto border border-[#E4E4E7] rounded-md">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E4E4E7] text-[#595959]">
                    <th className="py-2 px-3 font-medium">{isTr ? 'Malzeme / Süreç' : 'Material / Process'}</th>
                    <th className="py-2 px-3 font-medium text-right">{isTr ? 'Önerilen Kerf' : 'Typical Kerf'}</th>
                    <th className="py-2 px-3 font-medium text-right">{isTr ? 'Min. Köprü (B ≥ t)' : 'Min Bridge (B ≥ t)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5] font-mono-tabular text-[#1A1A1A]">
                  <tr>
                    <td className="py-2 px-3 font-sans text-[#2D2D2D]">3 mm MDF / Plywood</td>
                    <td className="py-2 px-3 text-right">0.15 – 0.25 mm</td>
                    <td className="py-2 px-3 text-right">≥ 2.5 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-[#2D2D2D]">3 mm Cast Acrylic</td>
                    <td className="py-2 px-3 text-right">0.10 – 0.20 mm</td>
                    <td className="py-2 px-3 text-right">≥ 2.0 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-[#2D2D2D]">1.5 mm Aluminum / Steel (Laser)</td>
                    <td className="py-2 px-3 text-right">0.08 – 0.15 mm</td>
                    <td className="py-2 px-3 text-right">≥ 1.5 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-[#2D2D2D]">Sheet Punching (CNC Turret)</td>
                    <td className="py-2 px-3 text-right">0.00 mm</td>
                    <td className="py-2 px-3 text-right">≥ 1.0× t</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
