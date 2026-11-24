export type Point2D = {
  x: number;
  y: number;
};

/** A closed polygon contour in local or world millimeter coordinates. */
export type PolygonRing = Point2D[];

/** A compound shape: array of closed rings (outer rings CCW positive area, holes CW negative area). */
export type CompoundPolygon = PolygonRing[];

export type PanelShape =
  | 'rect'
  | 'rounded_rect'
  | 'circle'
  | 'capsule'
  | 'triangle'
  | 'hexagon'
  | 'octagon'
  | 'arch'
  | 'l_shape'
  | 'custom_polygon'
  | 'custom_svg';

export type EdgeClipMode = 'center' | 'complete' | 'boundary_clip';

export type TopologyType =
  | 'hexagonal'
  | 'square_grid'
  | 'staggered_matrix'
  | 'diamond_matrix'
  | 'wave_flow'
  | 'vortex'
  | 'fibonacci'
  | 'concentric_radial'
  | 'diagonal_stripes'
  | 'sine_interference'
  | 'sunburst_rays'
  | 'organic_voronoi';

export type BuiltInMotifId =
  | 'circle'
  | 'hexagon'
  | 'square'
  | 'rounded_square'
  | 'diamond'
  | 'star_4'
  | 'capsule_slot'
  | 'chamfer_slot'
  | 'chevron'
  | 'trapezoid';

export type MotifId = BuiltInMotifId | 'custom_svg';

export type PivotMode = 'left' | 'center' | 'right';

export type OrientationMode = 'flow' | 'fixed' | 'radial';

export type ContinuityMode = 'infinite_lattice' | 'isolated_island';

export type StudioMode =
  | 'architectural_light'
  | 'acoustic_dark'
  | 'brushed_metal'
  | 'cad_wireframe';

export type RenderStyle = 'fill' | 'stroke' | 'fill_stroke';

export type AttractorFalloff = 'smoothstep' | 'linear' | 'gaussian';

export interface Attractor {
  id: string;
  type: 'point' | 'line';
  /** Normalized 0..1 position across panel width */
  x: number;
  /** Normalized 0..1 position across panel height */
  y: number;
  /** Optional second endpoint for line attractors (normalized 0..1) */
  x2?: number;
  y2?: number;
  /** Influence radius in mm */
  radius: number;
  /** Weight multiplier (0.2 .. 2.0) */
  weight: number;
  falloff: AttractorFalloff;
}

export interface CustomSvgMotifData {
  name: string;
  rings: CompoundPolygon;
  unitArea: number;
  boundingRadius: number;
}

export interface ImageMapConfig {
  enabled: boolean;
  fileName: string;
  target: 'scale' | 'angle' | 'both';
  invert: boolean;
  contrast: number;
  strength: number;
  overlayOpacity: number;
}

export interface ImageLuminanceGrid {
  width: number;
  height: number;
  /** Row-major 0..1 luminance array */
  data: Float32Array;
  dataUrl: string;
}

export interface PatternState {
  // Panel geometry
  panelShape: PanelShape;
  panelW: number;
  panelH: number;
  cornerRadius: number;
  margin: number;
  edgeClipMode: EdgeClipMode;
  /** Normalized [0..1] polygon vertices used for custom_polygon and custom_svg panel shapes */
  customPanelPoints: Point2D[];
  /** Optional display name of an uploaded custom SVG panel boundary */
  customPanelName: string;

  // Motif
  motifId: MotifId;
  pivot: PivotMode;
  orientationMode: OrientationMode;
  baseAngle: number;
  kerf: number;

  // Topology & C1 Adaptive Warp
  topology: TopologyType;
  pitch: number;
  centerScale: number;
  transitionRadius: number;
  edgeSpacingRatio: number;
  continuityMode: ContinuityMode;
  ambientScale: number;
  waveAmplitude: number;
  waveFrequency: number;
  vortexTwist: number;
  seed: number;
  jitter: number;

  // Multi-attractors
  attractors: Attractor[];

  // Image halftone mapping
  imageMap: ImageMapConfig;

  // Appearance & studio preview
  studioMode: StudioMode;
  panelColor: string;
  holeColor: string;
  transparentBg: boolean;
  renderStyle: RenderStyle;
  strokeWidth: number;

  // Overlays & DFM
  showGrid: boolean;
  showMargin: boolean;
  showAttractors: boolean;
  highlightCollisions: boolean;
  materialThickness: number;
}

export interface PatternInstance {
  id: number;
  /** World millimeter position */
  x: number;
  y: number;
  /** Rotation in radians */
  angle: number;
  /** Uniform scale factor */
  scale: number;
  /** Effective outer bounding radius in mm */
  boundingRadius: number;
  /** True if colliding/overlapping a neighbor */
  isColliding: boolean;
  /** True if bridge width < materialThickness */
  isThinBridge: boolean;
  /** Optional clipped rings if boundary_clip trimmed this shape */
  clippedRings?: CompoundPolygon;
}

export interface PatternMetrics {
  instanceCount: number;
  focusOarPercent: number;
  panelOarPercent: number;
  minBridgeMm: number | null;
  collisionCount: number;
  thinBridgeCount: number;
  panelAreaMm2: number;
  totalHoleAreaMm2: number;
  computedMs: number;
}

export interface PatternResult {
  instances: PatternInstance[];
  baseRings: CompoundPolygon;
  unitArea: number;
  unitBoundingRadius: number;
  panelOutline: PolygonRing;
  metrics: PatternMetrics;
}

export type WorkspaceMode = 'simple' | 'advanced';
export type Locale = 'tr' | 'en';
