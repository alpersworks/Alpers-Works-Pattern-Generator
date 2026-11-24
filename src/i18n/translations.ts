import type { Locale } from '../engine/types';

export interface Translations {
  // Header & navigation
  navStudio: string;
  navTemplates: string;
  navCadGuide: string;
  exportPrimary: string;

  // Mode toggle & history
  modeSimple: string;
  modeAdvanced: string;
  advancedActiveHint: string;
  undo: string;
  redo: string;
  randomize: string;
  shareUrl: string;
  copied: string;
  resetDefaults: string;

  // Sections
  secPresets: string;
  secPanel: string;
  secMotif: string;
  secTopology: string;
  secAttractors: string;
  secImageMap: string;
  secAppearance: string;
  secFabrication: string;

  // Panel controls
  panelAspectPresets: string;
  panelShape: string;
  shapeRect: string;
  shapeRounded: string;
  shapeCircle: string;
  shapeCapsule: string;
  shapeTriangle: string;
  shapeHexagon: string;
  shapeOctagon: string;
  shapeArch: string;
  shapeLShape: string;
  shapeCustomPoly: string;
  shapeCustomSvg: string;
  drawPolygon: string;
  finishDrawing: string;
  cancelDrawing: string;
  resetPolygon: string;
  uploadPanelSvg: string;
  customPolyHint: string;
  drawPolyHint: string;
  widthMm: string;
  heightMm: string;
  cornerRadiusMm: string;
  borderMarginMm: string;
  edgeClipMode: string;
  clipCenter: string;
  clipComplete: string;
  clipBoundary: string;

  // Motif controls
  uploadSvg: string;
  customSvgActive: string;
  clearCustomSvg: string;
  svgError: string;
  pivotMode: string;
  pivotLeft: string;
  pivotCenter: string;
  pivotRight: string;
  orientationMode: string;
  orientFlow: string;
  orientFixed: string;
  orientRadial: string;
  baseAngle: string;
  kerfComp: string;
  kerfHint: string;

  // Motif names
  motifNames: Record<string, string>;

  // Topology names & controls
  topologyNames: Record<string, string>;
  densityLabel: string;
  sizeLabel: string;
  spreadLabel: string;
  pitchMm: string;
  centerScale: string;
  transitionRadiusMm: string;
  edgeCompression: string;
  edgeCompressionHint: string;
  continuityMode: string;
  contInfinite: string;
  contIsolated: string;
  ambientScale: string;
  waveAmplitude: string;
  waveFrequency: string;
  vortexTwist: string;
  seedLabel: string;
  jitterLabel: string;

  // Attractors
  attractorHintSimple: string;
  attractorHintAdvanced: string;
  addPointAttractor: string;
  addLineAttractor: string;
  attractorRadius: string;
  attractorWeight: string;
  attractorFalloff: string;
  falloffSmooth: string;
  falloffLinear: string;
  falloffGaussian: string;
  remove: string;

  // Image halftone
  uploadImage: string;
  removeImage: string;
  imageTarget: string;
  targetScale: string;
  targetAngle: string;
  targetBoth: string;
  invertLuminance: string;
  contrastLabel: string;
  strengthLabel: string;
  referenceOpacity: string;

  // Studio appearance
  studioModeLabel: string;
  studioLight: string;
  studioDark: string;
  studioMetal: string;
  studioCad: string;
  panelColor: string;
  shapeColor: string;
  transparentBg: string;
  renderStyle: string;
  styleFill: string;
  styleStroke: string;
  styleBoth: string;
  strokeWidthMm: string;
  materialThicknessMm: string;

  // Canvas toolbar & telemetry
  fitView: string;
  actualScale: string;
  toggleGrid: string;
  toggleMargin: string;
  toggleAttractors: string;
  toggleCollisions: string;
  metricShapes: string;
  metricFocusOar: string;
  metricPanelOar: string;
  metricMinBridge: string;
  statusOptimal: string;
  statusThinBridge: string;
  statusCollision: string;
  oarBandLow: string;
  oarBandBalanced: string;
  oarBandOpen: string;
  oarBandHigh: string;
  canvasHint: string;

  // Export modal
  exportTitle: string;
  exportSubtitle: string;
  exportLicenseNote: string;
  tabVector: string;
  tabCad: string;
  tabImage: string;
  tabWeb: string;
  downloadGraphicSvg: string;
  graphicSvgDesc: string;
  downloadLaserSvg: string;
  laserSvgDesc: string;
  downloadDxf: string;
  dxfDesc: string;
  dxfLegacyR12: string;
  dxfIncludeOutline: string;
  dxfIncludeMarks: string;
  downloadPng: string;
  downloadWebp: string;
  resolutionScale: string;
  copyCss: string;
  cssLargeWarning: string;
  copyShareLink: string;
  downloadPresetJson: string;
  importPresetJson: string;
  close: string;

  // Templates & CAD guide modals
  templatesTitle: string;
  templatesSubtitle: string;
  applyTemplate: string;
  cadGuideTitle: string;
  cadGuideSubtitle: string;
  openControls: string;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    navStudio: 'Studio',
    navTemplates: 'Templates',
    navCadGuide: 'CAD Guide',
    exportPrimary: 'Export',

    modeSimple: 'Simple',
    modeAdvanced: 'Advanced',
    advancedActiveHint: 'Custom engineering parameters active',
    undo: 'Undo',
    redo: 'Redo',
    randomize: 'Randomize',
    shareUrl: 'Share',
    copied: 'Copied',
    resetDefaults: 'Reset',

    secPresets: 'Starter Templates',
    secPanel: 'Panel & Margin',
    secMotif: 'Motif & Kerf',
    secTopology: 'Pattern Flow & Density',
    secAttractors: 'Focal Attractors',
    secImageMap: 'Image Halftone Map',
    secAppearance: 'Surface & Style',
    secFabrication: 'Material & Verification',

    panelAspectPresets: 'Format Presets',
    panelShape: 'Boundary Shape',
    shapeRect: 'Rectangle',
    shapeRounded: 'Rounded',
    shapeCircle: 'Circle',
    shapeCapsule: 'Capsule',
    shapeTriangle: 'Triangle',
    shapeHexagon: 'Hexagon',
    shapeOctagon: 'Octagon',
    shapeArch: 'Arch',
    shapeLShape: 'L-Shape',
    shapeCustomPoly: 'Custom Draw',
    shapeCustomSvg: 'Custom SVG',
    drawPolygon: 'Draw on Canvas',
    finishDrawing: 'Finish Shape',
    cancelDrawing: 'Cancel',
    resetPolygon: 'Reset Shape',
    uploadPanelSvg: 'Upload Panel SVG',
    customPolyHint: 'Drag corners to reshape · Click edge + to add point · Right-click corner to remove.',
    drawPolyHint: 'Click on the canvas to place corners. Click the first point or press Enter to close.',
    widthMm: 'Width (mm)',
    heightMm: 'Height (mm)',
    cornerRadiusMm: 'Corner Radius (mm)',
    borderMarginMm: 'Border Margin (mm)',
    edgeClipMode: 'Edge Behavior',
    clipCenter: 'Center',
    clipComplete: 'Complete',
    clipBoundary: 'Edge Clip',

    uploadSvg: 'Upload Custom SVG',
    customSvgActive: 'Custom SVG',
    clearCustomSvg: 'Remove',
    svgError: 'Could not parse vector shapes from this SVG file.',
    pivotMode: 'Pivot Origin',
    pivotLeft: 'Left',
    pivotCenter: 'Center',
    pivotRight: 'Right',
    orientationMode: 'Orientation',
    orientFlow: 'Flow',
    orientFixed: 'Fixed',
    orientRadial: 'Radial',
    baseAngle: 'Base Angle',
    kerfComp: 'Laser Kerf Compensation (mm)',
    kerfHint: 'Inward offset by kerf/2. Typical: 0.15–0.25 mm MDF, 0.10–0.20 mm acrylic.',

    motifNames: {
      circle: 'Circle',
      hexagon: 'Hexagon',
      square: 'Square',
      rounded_square: 'Squircle',
      diamond: 'Diamond',
      star_4: '4-Point Star',
      capsule_slot: 'Capsule',
      chamfer_slot: 'Chamfer Slot',
      chevron: 'Chevron',
      trapezoid: 'Trapezoid',
    },

    topologyNames: {
      hexagonal: 'Hexagonal Lattice',
      square_grid: 'Orthogonal Grid',
      staggered_matrix: 'Staggered Matrix',
      diamond_matrix: 'Diamond Matrix',
      wave_flow: 'Wave Flow',
      vortex: 'Vortex Spiral',
      fibonacci: 'Fibonacci Spiral',
      concentric_radial: 'Concentric Radial',
      diagonal_stripes: 'Diagonal Flow',
      sine_interference: 'Moiré Interference',
      sunburst_rays: 'Sunburst Rays',
      organic_voronoi: 'Organic Cellular',
    },

    densityLabel: 'Spacing',
    sizeLabel: 'Shape Size',
    spreadLabel: 'Focal Spread',
    pitchMm: 'Center Pitch (mm)',
    centerScale: 'Core Scale',
    transitionRadiusMm: 'Transition Radius R (mm)',
    edgeCompression: 'Edge Compression (k)',
    edgeCompressionHint: 'C¹ continuous radial pitch compression. k < 1 tightens outer spacing smoothly without boundary kinks.',
    continuityMode: 'Continuity Mode',
    contInfinite: 'Full Panel Micro-Texture',
    contIsolated: 'Isolated Focal Island',
    ambientScale: 'Outer Texture Scale',
    waveAmplitude: 'Wave Amplitude (mm)',
    waveFrequency: 'Wave Cycles',
    vortexTwist: 'Spiral Twist',
    seedLabel: 'Deterministic Seed',
    jitterLabel: 'Organic Jitter',

    attractorHintSimple: 'Drag the focal handle directly on the canvas. Hold Shift to snap to center axes.',
    attractorHintAdvanced: 'Drag handles to move, drag ring to resize, or double-click the canvas to add a new attractor.',
    addPointAttractor: 'Add Point',
    addLineAttractor: 'Add Line',
    attractorRadius: 'Radius (mm)',
    attractorWeight: 'Weight',
    attractorFalloff: 'Falloff',
    falloffSmooth: 'Smoothstep',
    falloffLinear: 'Linear',
    falloffGaussian: 'Gaussian',
    remove: 'Remove',

    uploadImage: 'Upload Photo or Logo',
    removeImage: 'Clear Image',
    imageTarget: 'Modulate',
    targetScale: 'Size',
    targetAngle: 'Angle',
    targetBoth: 'Both',
    invertLuminance: 'Invert Brightness',
    contrastLabel: 'Contrast',
    strengthLabel: 'Blend Strength',
    referenceOpacity: 'Reference Overlay',

    studioModeLabel: 'Viewport Simulation',
    studioLight: 'Architectural Light',
    studioDark: 'Acoustic Dark',
    studioMetal: 'Brushed Metal',
    studioCad: 'CAD / Laser Wireframe',
    panelColor: 'Surface Color',
    shapeColor: 'Pattern Color',
    transparentBg: 'Transparent Background',
    renderStyle: 'Draw Mode',
    styleFill: 'Fill',
    styleStroke: 'Outline',
    styleBoth: 'Both',
    strokeWidthMm: 'Stroke Width (mm)',
    materialThicknessMm: 'Target Sheet Thickness (mm)',

    fitView: 'Fit (F)',
    actualScale: '1:1 (0)',
    toggleGrid: 'Grid',
    toggleMargin: 'Margin',
    toggleAttractors: 'Handles',
    toggleCollisions: 'DFM Check',
    metricShapes: 'Shapes',
    metricFocusOar: 'Focus OAR',
    metricPanelOar: 'Panel OAR',
    metricMinBridge: 'Min Bridge',
    statusOptimal: 'Safe',
    statusThinBridge: 'Thin Bridge',
    statusCollision: 'Overlap',
    oarBandLow: 'Decorative (<25%)',
    oarBandBalanced: 'Balanced (25–40%)',
    oarBandOpen: 'Acoustic Open (40–55%)',
    oarBandHigh: 'High Transparency (55%+)',
    canvasHint: 'Scroll to zoom · Drag background to pan · Drag handle to focus',

    exportTitle: 'Export & Share',
    exportSubtitle: 'True 1:1 millimeter CAD geometry and lossless web graphics.',
    exportLicenseNote: 'MIT open-source engine. Every generated file is 100% yours for commercial and physical production.',
    tabVector: 'SVG & Laser',
    tabCad: 'CAD DXF',
    tabImage: 'PNG & WebP',
    tabWeb: 'CSS & Share',
    downloadGraphicSvg: 'Download Graphic SVG',
    graphicSvgDesc: 'Illustrator & Figma ready, 1:1 mm dimensions with your active fill/stroke styling.',
    downloadLaserSvg: 'Download Laser Cut SVG',
    laserSvgDesc: 'No fill, 0.1 mm hairline strokes. Red #FF0000 holes (Pass 1) and Blue #0000FF perimeter (Pass 2).',
    downloadDxf: 'Download Layered DXF',
    dxfDesc: 'Metric DXF ($INSUNITS=4 mm, $MEASUREMENT=1) with separated HOLES and PANEL_OUTLINE layers.',
    dxfLegacyR12: 'Legacy AutoCAD R12 (AC1009) compatibility',
    dxfIncludeOutline: 'Include PANEL_OUTLINE cut perimeter',
    dxfIncludeMarks: 'Include ALIGNMENT_MARKS registration crosshairs',
    downloadPng: 'Download PNG',
    downloadWebp: 'Download WebP',
    resolutionScale: 'Resolution Multiplier',
    copyCss: 'Copy CSS Snippet',
    cssLargeWarning: 'High shape count detected. Consider downloading an external .svg file instead of inlining in CSS.',
    copyShareLink: 'Copy Shareable Link',
    downloadPresetJson: 'Save Recipe (.json)',
    importPresetJson: 'Load Recipe (.json)',
    close: 'Close',

    templatesTitle: 'Multi-Industry Templates',
    templatesSubtitle: 'Verified parametric starting points across graphic design, architecture, acoustics, and CNC fabrication.',
    applyTemplate: 'Load Template',
    cadGuideTitle: 'CAD & Laser Fabrication Guide',
    cadGuideSubtitle: 'Verified 1:1 mm import steps for AutoCAD, Rhino 3D, SolidWorks, and LightBurn.',
    openControls: 'Controls',
  },
  tr: {
    navStudio: 'Stüdyo',
    navTemplates: 'Şablonlar',
    navCadGuide: 'CAD Rehberi',
    exportPrimary: 'Dışa Aktar',

    modeSimple: 'Basit',
    modeAdvanced: 'Gelişmiş',
    advancedActiveHint: 'Özel mühendislik ayarları etkin',
    undo: 'Geri Al',
    redo: 'Yinele',
    randomize: 'Rastgele',
    shareUrl: 'Paylaş',
    copied: 'Kopyalandı',
    resetDefaults: 'Sıfırla',

    secPresets: 'Hazır Şablonlar',
    secPanel: 'Panel ve Kenar Payı',
    secMotif: 'Motif ve Kesim Payı',
    secTopology: 'Desen Akışı ve Yoğunluk',
    secAttractors: 'Odak Çekicileri',
    secImageMap: 'Görsel Parlaklık Haritası',
    secAppearance: 'Yüzey ve Görünüm',
    secFabrication: 'Malzeme ve Doğrulama',

    panelAspectPresets: 'Hazır Ebatlar',
    panelShape: 'Panel Geometrisi',
    shapeRect: 'Dikdörtgen',
    shapeRounded: 'Yuvarlak',
    shapeCircle: 'Dairesel',
    shapeCapsule: 'Kapsül',
    shapeTriangle: 'Üçgen',
    shapeHexagon: 'Altıgen',
    shapeOctagon: 'Sekizgen',
    shapeArch: 'Kemer',
    shapeLShape: 'L-Şekli',
    shapeCustomPoly: 'Özel Çizim',
    shapeCustomSvg: 'Özel SVG',
    drawPolygon: 'Tuvalde Çiz',
    finishDrawing: 'Şekli Tamamla',
    cancelDrawing: 'İptal',
    resetPolygon: 'Şekli Sıfırla',
    uploadPanelSvg: 'Panel SVG Yükle',
    customPolyHint: 'Köşeleri sürükleyin · Kenardaki + ile nokta ekleyin · Köşeye sağ tıklayarak silin.',
    drawPolyHint: 'Tuvale tıklayarak köşeleri işaretleyin. Kapatmak için ilk noktaya tıklayın veya Enter’a basın.',
    widthMm: 'Genişlik (mm)',
    heightMm: 'Yükseklik (mm)',
    cornerRadiusMm: 'Köşe Radyusu (mm)',
    borderMarginMm: 'Kenar Payı (mm)',
    edgeClipMode: 'Kenar Kırpma Modu',
    clipCenter: 'Merkez İçeride',
    clipComplete: 'Tam Şekil',
    clipBoundary: 'Sınırda Kırp',

    uploadSvg: 'Özel SVG Yükle',
    customSvgActive: 'Özel SVG',
    clearCustomSvg: 'Kaldır',
    svgError: 'Bu SVG dosyasından geçerli vektör şekli okunamadı.',
    pivotMode: 'Pivot Noktası',
    pivotLeft: 'Sol',
    pivotCenter: 'Merkez',
    pivotRight: 'Sağ',
    orientationMode: 'Yönlendirme',
    orientFlow: 'Akış',
    orientFixed: 'Sabit',
    orientRadial: 'Işınsal',
    baseAngle: 'Temel Açı',
    kerfComp: 'Lazer Kerf Telafisi (mm)',
    kerfHint: 'Konturları kerf/2 içeri ofsetler. Referans: 0,15–0,25 mm MDF, 0,10–0,20 mm akrilik.',

    motifNames: {
      circle: 'Daire',
      hexagon: 'Altıgen',
      square: 'Kare',
      rounded_square: 'Yumuşak Kare',
      diamond: 'Baklava',
      star_4: '4 Köşe Yıldız',
      capsule_slot: 'Kapsül',
      chamfer_slot: 'Pahlı Slot',
      chevron: 'Chevron',
      trapezoid: 'Yamuk',
    },

    topologyNames: {
      hexagonal: 'Heksagonal Örgü',
      square_grid: 'Kare Izgara',
      staggered_matrix: 'Kademeli Matris',
      diamond_matrix: 'Baklava Matris',
      wave_flow: 'Dalgalı Akış',
      vortex: 'Vorteks Spiral',
      fibonacci: 'Fibonacci Spiral',
      concentric_radial: 'Radyal Konsantrik',
      diagonal_stripes: 'Diyagonal Akış',
      sine_interference: 'Moiré Girişim',
      sunburst_rays: 'Işınsal Güneş',
      organic_voronoi: 'Organik Hücresel',
    },

    densityLabel: 'Aralık',
    sizeLabel: 'Şekil Boyutu',
    spreadLabel: 'Odak Yayılımı',
    pitchMm: 'Merkez Hatve (mm)',
    centerScale: 'Çekirdek Ölçeği',
    transitionRadiusMm: 'Geçiş Yarıçapı R (mm)',
    edgeCompression: 'Kenar Sıkıştırma (k)',
    edgeCompressionHint: 'C¹ sürekli radyal sıkıştırma. k < 1 dış hatveyi kırılma yaratmadan yumuşakça sıkıştırır.',
    continuityMode: 'Devamlılık Modu',
    contInfinite: 'Tam Panel Mikro-Doku',
    contIsolated: 'Yalnızca Odak Adası',
    ambientScale: 'Zemin Doku Ölçeği',
    waveAmplitude: 'Dalga Genliği (mm)',
    waveFrequency: 'Dalga Frekansı',
    vortexTwist: 'Burgu Katsayısı',
    seedLabel: 'Deterministik Tohum',
    jitterLabel: 'Organik Sapma',

    attractorHintSimple: 'Tuvaldeki odak halkasını sürükleyin. Shift tuşuyla merkez eksenlere kilitleyin.',
    attractorHintAdvanced: 'Sürükleyerek taşıyın, dış halkadan yarıçapı değiştirin veya tuvale çift tıklayarak yeni çekici ekleyin.',
    addPointAttractor: 'Nokta Ekle',
    addLineAttractor: 'Çizgi Ekle',
    attractorRadius: 'Yarıçap (mm)',
    attractorWeight: 'Ağırlık',
    attractorFalloff: 'Sönüm Eğrisi',
    falloffSmooth: 'Smoothstep',
    falloffLinear: 'Doğrusal',
    falloffGaussian: 'Gauss',
    remove: 'Sil',

    uploadImage: 'Fotoğraf veya Logo Yükle',
    removeImage: 'Görseli Kaldır',
    imageTarget: 'Modülasyon Hedefi',
    targetScale: 'Boyut',
    targetAngle: 'Açı',
    targetBoth: 'İkisi de',
    invertLuminance: 'Parlaklığı Ters Çevir',
    contrastLabel: 'Kontrast',
    strengthLabel: 'Etki Gücü',
    referenceOpacity: 'Referans Görsel Opaklığı',

    studioModeLabel: 'Stüdyo Önizleme Modu',
    studioLight: 'Mimari Beyaz',
    studioDark: 'Akustik Koyu',
    studioMetal: 'Fırçalanmış Metal',
    studioCad: 'CAD / Lazer Kontur',
    panelColor: 'Zemin Rengi',
    shapeColor: 'Desen Rengi',
    transparentBg: 'Şeffaf Arka Plan',
    renderStyle: 'Çizim Stili',
    styleFill: 'Dolgu',
    styleStroke: 'Kontur',
    styleBoth: 'İkisi de',
    strokeWidthMm: 'Kontur Kalınlığı (mm)',
    materialThicknessMm: 'Hedef Malzeme Kalınlığı (mm)',

    fitView: 'Sığdır (F)',
    actualScale: '1:1 (0)',
    toggleGrid: 'Izgara',
    toggleMargin: 'Kenar Payı',
    toggleAttractors: 'Odaklar',
    toggleCollisions: 'Köprü Kontrol',
    metricShapes: 'Şekil',
    metricFocusOar: 'Odak OAR',
    metricPanelOar: 'Panel OAR',
    metricMinBridge: 'Min. Köprü',
    statusOptimal: 'Güvenli',
    statusThinBridge: 'İnce Köprü',
    statusCollision: 'Çakışma',
    oarBandLow: 'Dekoratif (<%25)',
    oarBandBalanced: 'Dengeli (%25–40)',
    oarBandOpen: 'Akustik Açık (%40–55)',
    oarBandHigh: 'Yüksek Şeffaflık (%55+)',
    canvasHint: 'Yakınlaştır: Tekerlek · Kaydır: Boş alanı sürükle · Odak: Halkayı sürükle',

    exportTitle: 'Dışa Aktar ve Paylaş',
    exportSubtitle: 'Gerçek 1:1 milimetre CAD geometrisi ve kayıpsız web çıktıları.',
    exportLicenseNote: 'MIT açık kaynak motoru. Ürettiğiniz tüm dosyalar ticari kullanım ve fiziksel üretim için tamamen size aittir.',
    tabVector: 'SVG ve Lazer',
    tabCad: 'CAD DXF',
    tabImage: 'PNG ve WebP',
    tabWeb: 'CSS ve Paylaş',
    downloadGraphicSvg: 'Grafik SVG İndir',
    graphicSvgDesc: 'Illustrator ve Figma uyumlu, seçili renklerle 1:1 mm ölçekli vektör.',
    downloadLaserSvg: 'Lazer Kesim SVG İndir',
    laserSvgDesc: 'Dolgusuz 0,1 mm çizgi. Kırmızı #FF0000 delikler (1. Geçiş) ve Mavi #0000FF dış çerçeve (2. Geçiş).',
    downloadDxf: 'Katmanlı DXF İndir',
    dxfDesc: 'Metrik DXF ($INSUNITS=4 mm, $MEASUREMENT=1), ayrı HOLES ve PANEL_OUTLINE katmanlarıyla.',
    dxfLegacyR12: 'Eski AutoCAD R12 (AC1009) uyumluluk modu',
    dxfIncludeOutline: 'PANEL_OUTLINE dış kesim çerçevesini dahil et',
    dxfIncludeMarks: 'ALIGNMENT_MARKS hizalama işaretlerini dahil et',
    downloadPng: 'PNG İndir',
    downloadWebp: 'WebP İndir',
    resolutionScale: 'Çözünürlük Çarpanı',
    copyCss: 'CSS Kodunu Kopyala',
    cssLargeWarning: 'Yüksek şekil sayısı nedeniyle CSS içine gömmek yerine harici .svg indirmeniz önerilir.',
    copyShareLink: 'Paylaşım Linkini Kopyala',
    downloadPresetJson: 'Reçete Kaydet (.json)',
    importPresetJson: 'Reçete Yükle (.json)',
    close: 'Kapat',

    templatesTitle: 'Çok Sektörlü Hazır Şablonlar',
    templatesSubtitle: 'Grafik tasarım, mimarlık, akustik ve CNC/lazer üretim için doğrulanmış başlangıç reçeteleri.',
    applyTemplate: 'Şablonu Uygula',
    cadGuideTitle: 'CAD ve Lazer Üretim Rehberi',
    cadGuideSubtitle: 'AutoCAD, Rhino 3D, SolidWorks ve LightBurn için 1:1 mm aktarım adımları.',
    openControls: 'Kontroller',
  },
};
