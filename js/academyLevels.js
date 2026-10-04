/**
 * Transcribble Drawing Academy - Level Configuration Architecture
 * Defines levels across 4 escalating difficulty tiers with local SVG assets,
 * target pass accuracies, grid configurations, and tier-specific metadata.
 */

const ACADEMY_LEVELS = [
  // =========================================================================
  // STAGE 1: Direct Tracing
  // Reference SVG drawn at 30% opacity directly on center of user canvas.
  // =========================================================================
  {
    id: 't1_apple',
    name: 'Crisp Apple',
    tier: 1,
    tierName: 'Direct Tracing',
    tierBadge: 'Direct Trace',
    icon: '🍎',
    filepath: '/assets/Easy/apple.svg',
    targetAccuracy: 70, // 70% required to pass
    description: 'Trace directly over the faded reference silhouette. Follow the outer apple contour and stem.',
    hint: 'Keep your strokes continuous and steady along the guide lines.'
  },
  {
    id: 't1_heart',
    name: 'Double Hearts',
    tier: 1,
    tierName: 'Direct Tracing',
    tierBadge: 'Direct Trace',
    icon: '💖',
    filepath: '/assets/Easy/heart.svg',
    targetAccuracy: 70,
    description: 'Practice smooth, rounded curves and symmetrical loops directly over the reference.',
    hint: 'Start from the top cleft and sweep downwards smoothly to the point.'
  },
  {
    id: 't1_cloud',
    name: 'Fluffy Cloud',
    tier: 1,
    tierName: 'Direct Tracing',
    tierBadge: 'Direct Trace',
    icon: '☁️',
    filepath: '/assets/Easy/cloud.svg',
    targetAccuracy: 75,
    description: 'Trace overlapping rounded puffs to build consistent curve confidence.',
    hint: 'Connect each curve cleanly to the next along the silhouette.'
  },

  // =========================================================================
  // STAGE 2: Grid Tracing
  // Direct tracing with a rigid 8x8 or 16x16 grid overlay to teach proportion.
  // =========================================================================
  {
    id: 't2_umbrella',
    name: 'Rain Umbrella',
    tier: 2,
    tierName: 'Grid Tracing',
    tierBadge: 'Grid Trace',
    icon: '☂️',
    filepath: '/assets/Easy/ryanlerch_umbrella_outline.svg',
    targetAccuracy: 75,
    gridSize: 8, // 8x8 grid
    description: 'Use the 8x8 grid lines to judge canopy curvature and handle centering.',
    hint: 'Notice which grid intersection the umbrella tip touches.'
  },
  {
    id: 't2_shamrock',
    name: 'Lucky Shamrock',
    tier: 2,
    tierName: 'Grid Tracing',
    tierBadge: 'Grid Trace',
    icon: '☘️',
    filepath: '/assets/Easy/Shamrock-Outline.svg',
    targetAccuracy: 75,
    gridSize: 8, // 8x8 grid
    description: 'Align the three distinct clover leaves using the grid quadrant lines.',
    hint: 'Observe how each leaf fits neatly into its own grid cell sector.'
  },
  {
    id: 't2_pine',
    name: 'Winter Pine',
    tier: 2,
    tierName: 'Grid Tracing',
    tierBadge: 'Grid Trace',
    icon: '🌲',
    filepath: '/assets/Easy/jean_victor_balin_sapin_02_bw.svg',
    targetAccuracy: 78,
    gridSize: 16, // 16x16 grid for finer detail
    description: 'Navigate jagged needle branches using the dense 16x16 proportional grid.',
    hint: 'Use the horizontal grid rungs to gauge the stepping width of each branch tier.'
  },

  // =========================================================================
  // STAGE 3: Side-by-Side with Grid
  // Split canvas: Left has reference + grid; Right has blank grid + starting anchor dot.
  // =========================================================================
  {
    id: 't3_coupe',
    name: 'Classic Coupe',
    tier: 3,
    tierName: 'Side-by-Side Grid',
    tierBadge: 'Split Grid',
    icon: '🚗',
    filepath: '/assets/Easy/auto.svg',
    targetAccuracy: 65,
    gridSize: 8,
    // Relative starting anchor coordinate on right canvas [0.0 - 1.0]
    startAnchor: { xRatio: 0.18, yRatio: 0.60, label: 'Start: Front Bumper' },
    description: 'Observe the reference grid on the left and replicate cell-by-cell on the right. Begin at the anchor dot.',
    hint: 'Count cells from the left edge to find the wheel positions.'
  },
  {
    id: 't3_shirt',
    name: 'Crewneck Tee',
    tier: 3,
    tierName: 'Side-by-Side Grid',
    tierBadge: 'Split Grid',
    icon: '👕',
    filepath: '/assets/Easy/ryanlerch_shirt_outline.svg',
    targetAccuracy: 70,
    gridSize: 8,
    startAnchor: { xRatio: 0.50, yRatio: 0.22, label: 'Start: Collar Center' },
    description: 'Recreate symmetrical shoulder angles and sleeves using matching grid coordinates.',
    hint: 'Anchor your first stroke at the center collar, then branch out to each shoulder.'
  },
  {
    id: 't3_hourglass',
    name: 'Antique Hourglass',
    tier: 3,
    tierName: 'Side-by-Side Grid',
    tierBadge: 'Split Grid',
    icon: '⏳',
    filepath: '/assets/Easy/johnny_automatic_hourglass.svg',
    targetAccuracy: 70,
    gridSize: 16,
    startAnchor: { xRatio: 0.50, yRatio: 0.16, label: 'Start: Top Rim' },
    description: 'Replicate the delicate glass bulbs and narrow center pinch using fine 16x16 cell alignment.',
    hint: 'Draw the top and bottom plates first, then connect the tapered glass waist.'
  },

  // =========================================================================
  // STAGE 4: Freestyle Studio
  // Split canvas without grids. User replicates freehand with color-matching targets.
  // =========================================================================
  {
    id: 't4_elephant',
    name: 'Gentle Elephant',
    tier: 4,
    tierName: 'Freestyle Studio',
    tierBadge: 'Freestyle',
    icon: '🐘',
    filepath: '/assets/Easy/Anonymous-elephant-outline.svg',
    targetAccuracy: 60,
    targetColors: [
      { hex: '#1E1E1E', name: 'Ink Black', label: 'Outline' },
      { hex: '#868E96', name: 'Warm Slate', label: 'Body Accent' }
    ],
    description: 'Draw completely freehand on the right side with no grid guides. Match designated palette colors.',
    hint: 'Break the silhouette down into simple circles and cylinders before detailing the trunk and ears.'
  },
  {
    id: 't4_moon',
    name: 'Moon & Cloud',
    tier: 4,
    tierName: 'Freestyle Studio',
    tierBadge: 'Freestyle',
    icon: '🌙',
    filepath: '/assets/Easy/Cloud-Covered-Moon-Outline.svg',
    targetAccuracy: 60,
    targetColors: [
      { hex: '#1E1E1E', name: 'Ink Black', label: 'Line Art' },
      { hex: '#FFF3BF', name: 'Pastel Butter', label: 'Moon' },
      { hex: '#A5D8FF', name: 'Pastel Sky', label: 'Cloud' }
    ],
    description: 'Replicate the celestial composition freehand. Switch colors in your palette to fill required targets.',
    hint: 'Sketch the crescent moon arc first, then drape the puffy cloud across the lower half.'
  }
];

// Helper functions for level retrieval
function getAcademyLevelById(id) {
  return ACADEMY_LEVELS.find(lvl => lvl.id === id) || ACADEMY_LEVELS[0];
}

function getAcademyLevelsByTier(tier) {
  return ACADEMY_LEVELS.filter(lvl => lvl.tier === tier);
}

// Export to window
if (typeof window !== 'undefined') {
  window.ACADEMY_LEVELS = ACADEMY_LEVELS;
  window.getAcademyLevelById = getAcademyLevelById;
  window.getAcademyLevelsByTier = getAcademyLevelsByTier;
}
