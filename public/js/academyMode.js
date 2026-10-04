/**
 * AcademyModeManager - Progressive Drawing Educational System
 * Implements:
 * 1. Asset Management & Level Configuration
 * 2. Progressive Difficulty State Machine (Tiers 1-4)
 * 3. Accuracy Evaluation Engine (Canvas Pixel Matching with 3px Tolerance Margin)
 */

class AcademyModeManager {
  constructor() {
    // DOM Elements
    this.view = null;
    this.refCanvas = null;
    this.refCtx = null;
    this.gridCanvas = null;
    this.gridCtx = null;
    this.drawCanvas = null;
    this.drawCtx = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;

    // Canvas Dimensions
    this.CANVAS_WIDTH = 1200;
    this.CANVAS_HEIGHT = 800;

    // Current State
    this.currentLevelIndex = 0;
    this.currentLevel = null;
    this.currentTier = 1;

    // Drawing Tool State
    this.isDrawing = false;
    this.hasMoved = false;
    this.lastX = 0;
    this.lastY = 0;
    this.currentTool = 'brush'; // 'brush' | 'eraser'
    this.currentColor = '#1E1E1E';
    this.currentSize = 8;
    this.smoothingEnabled = true;
    this.strokePoints = [];

    // Color tracking for Tier 4 color matching
    this.usedColors = new Set();

    // Undo Stack
    this.undoStack = [];
    this.maxUndoSteps = 25;

    // Loaded reference SVG layout cache
    this.currentSVGLayout = null;
  }

  // =========================================================================
  // 1. Asset Management & SVG Loading
  // =========================================================================

  /**
   * Loads an SVG file, computes its aspect ratio, scales and centers it within
   * the assigned bounding box without distortion, and draws onto the canvas context.
   *
   * @param {string} filepath - Path to the local SVG asset
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context
   * @param {Object} options - { bounds: { x, y, width, height }, opacity: number, clearBefore: boolean }
   * @returns {Promise<{ img: HTMLImageElement, drawX: number, drawY: number, drawWidth: number, drawHeight: number }>}
   */
  loadSVGToCanvas(filepath, ctx, options = {}) {
    return new Promise((resolve, reject) => {
      const bounds = options.bounds || {
        x: 0,
        y: 0,
        width: ctx.canvas.width,
        height: ctx.canvas.height
      };
      const opacity = typeof options.opacity === 'number' ? options.opacity : 1.0;
      const padding = options.padding || 40;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Calculate available drawing area within padding
        const targetX = bounds.x + padding;
        const targetY = bounds.y + padding;
        const targetW = Math.max(10, bounds.width - padding * 2);
        const targetH = Math.max(10, bounds.height - padding * 2);

        // Aspect ratio calculation preserving SVG proportions
        const naturalW = img.naturalWidth || img.width || 400;
        const naturalH = img.naturalHeight || img.height || 400;
        const imgAspect = naturalW / naturalH;
        const targetAspect = targetW / targetH;

        let drawW, drawH;
        if (imgAspect > targetAspect) {
          // Constrained by width
          drawW = targetW;
          drawH = targetW / imgAspect;
        } else {
          // Constrained by height
          drawH = targetH;
          drawW = targetH * imgAspect;
        }

        // Center within assigned boundary
        const drawX = targetX + (targetW - drawW) / 2;
        const drawY = targetY + (targetH - drawH) / 2;

        if (options.clearBefore) {
          ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();

        resolve({
          img,
          drawX,
          drawY,
          drawWidth: drawW,
          drawHeight: drawH,
          bounds
        });
      };

      img.onerror = (err) => {
        console.error(`[AcademyMode] Failed to load SVG from ${filepath}:`, err);
        reject(new Error(`Failed to load SVG from ${filepath}`));
      };

      img.src = filepath;
    });
  }

  // =========================================================================
  // Initialization & View Lifecycle
  // =========================================================================

  init() {
    this.view = document.getElementById('academyModeView');
    this.refCanvas = document.getElementById('academyRefCanvas');
    this.gridCanvas = document.getElementById('academyGridCanvas');
    this.drawCanvas = document.getElementById('academyDrawingCanvas');

    if (!this.view || !this.drawCanvas) {
      console.warn('[AcademyMode] Required DOM elements not found.');
      return;
    }

    this.refCtx = this.refCanvas.getContext('2d');
    this.gridCtx = this.gridCanvas.getContext('2d');
    this.drawCtx = this.drawCanvas.getContext('2d', { willReadFrequently: true });

    // Hidden in-memory offscreen reference canvas for accurate 100% opacity pixel matching
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.CANVAS_WIDTH;
    this.offscreenCanvas.height = this.CANVAS_HEIGHT;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    this.initCanvasDimensions();
    this.bindUIEvents();
    this.bindCanvasEvents();

    console.log('🎓 Academy Mode Manager initialized.');
  }

  initCanvasDimensions() {
    const w = this.CANVAS_WIDTH;
    const h = this.CANVAS_HEIGHT;

    [this.refCanvas, this.gridCanvas, this.drawCanvas, this.offscreenCanvas].forEach(c => {
      if (c) {
        c.width = w;
        c.height = h;
      }
    });
  }

  isOpen() {
    return this.view && !this.view.classList.contains('hidden') && this.view.style.display !== 'none';
  }

  open(levelId = null) {
    const landingOverlay = document.getElementById('landingOverlay');
    if (landingOverlay) {
      landingOverlay.classList.add('hidden');
    }

    if (this.view) {
      this.view.classList.remove('hidden');
      this.view.style.display = 'flex';
    }

    document.body.classList.add('academy-mode-active');

    // Populate level picker dropdown if needed
    this.populateLevelDropdown();

    // Select initial or requested level
    let targetIdx = 0;
    if (levelId && typeof window.ACADEMY_LEVELS !== 'undefined') {
      const foundIdx = window.ACADEMY_LEVELS.findIndex(lvl => lvl.id === levelId);
      if (foundIdx !== -1) targetIdx = foundIdx;
    }
    this.loadLevel(targetIdx);

    if (typeof window.playSound === 'function') {
      window.playSound('pop');
    }
  }

  close() {
    if (this.view) {
      this.view.classList.add('hidden');
      this.view.style.display = 'none';
    }

    document.body.classList.remove('academy-mode-active');

    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
      appContainer.classList.remove('hidden');
      appContainer.style.display = '';
    }

    const landingOverlay = document.getElementById('landingOverlay');
    if (landingOverlay) {
      landingOverlay.classList.remove('hidden');
      landingOverlay.style.display = '';
    }

    // Dismiss any active result modal
    const resultModal = document.getElementById('academyResultModal');
    if (resultModal) {
      resultModal.classList.add('hidden');
    }
  }

  // =========================================================================
  // 2. Progressive Difficulty State Machine (Tiers 1 through 4)
  // =========================================================================

  /**
   * Loads and configures a specific level based on its difficulty tier.
   * Handles canvas clearing, grid generation, anchor dots, and color targets.
   *
   * @param {number} index - Index into ACADEMY_LEVELS
   */
  async loadLevel(index) {
    const levels = window.ACADEMY_LEVELS || [];
    if (index < 0 || index >= levels.length) index = 0;

    this.currentLevelIndex = index;
    const level = levels[index];
    this.currentLevel = level;
    this.currentTier = level.tier;

    // Reset user drawing state
    this.clearUserCanvas(false);
    this.undoStack = [];
    this.usedColors = new Set();
    this.saveSnapshot();

    // Update UI headers & badges
    this.updateLevelUI(level);

    // Clear background contexts
    this.refCtx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    this.gridCtx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    this.offscreenCtx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Apply Tier State Machine
    try {
      switch (level.tier) {
        case 1:
          await this.setupTier1DirectTracing(level);
          break;
        case 2:
          await this.setupTier2GridTracing(level);
          break;
        case 3:
          await this.setupTier3SideBySideGrid(level);
          break;
        case 4:
          await this.setupTier4Freestyle(level);
          break;
        default:
          await this.setupTier1DirectTracing(level);
          break;
      }
    } catch (err) {
      console.error('[AcademyMode] Error during tier setup:', err);
    }
  }

  /**
   * Tier 1 (Direct Tracing):
   * Reference SVG drawn directly on center of user's main canvas at 30% opacity.
   * User traces over it.
   */
  async setupTier1DirectTracing(level) {
    this.setSplitViewLayout(false);

    const fullBounds = {
      x: 0,
      y: 0,
      width: this.CANVAS_WIDTH,
      height: this.CANVAS_HEIGHT
    };

    // 1. Draw reference onto refCanvas at 30% opacity
    const layout = await this.loadSVGToCanvas(level.filepath, this.refCtx, {
      bounds: fullBounds,
      opacity: 0.30,
      padding: 60,
      clearBefore: true
    });
    this.currentSVGLayout = layout;

    // 2. Draw identical SVG onto offscreen canvas at 100% opacity for pixel comparison
    await this.loadSVGToCanvas(level.filepath, this.offscreenCtx, {
      bounds: fullBounds,
      opacity: 1.0,
      padding: 60,
      clearBefore: true
    });
  }

  /**
   * Tier 2 (Grid Tracing):
   * Same as Tier 1 (SVG at 30% opacity), plus a rigid 8x8 or 16x16 grid overlay.
   */
  async setupTier2GridTracing(level) {
    this.setSplitViewLayout(false);

    const fullBounds = {
      x: 0,
      y: 0,
      width: this.CANVAS_WIDTH,
      height: this.CANVAS_HEIGHT
    };

    // 1. Draw reference onto refCanvas at 30% opacity
    const layout = await this.loadSVGToCanvas(level.filepath, this.refCtx, {
      bounds: fullBounds,
      opacity: 0.30,
      padding: 60,
      clearBefore: true
    });
    this.currentSVGLayout = layout;

    // 2. Offscreen reference at 100% opacity
    await this.loadSVGToCanvas(level.filepath, this.offscreenCtx, {
      bounds: fullBounds,
      opacity: 1.0,
      padding: 60,
      clearBefore: true
    });

    // 3. Render rigid grid overlay (8x8 or 16x16)
    const gridSize = level.gridSize || 8;
    this.renderGrid(this.gridCtx, fullBounds, gridSize, {
      color: 'rgba(0, 0, 0, 0.16)',
      lineWidth: 1.5,
      showCoordinates: true
    });
  }

  /**
   * Tier 3 (Side-by-Side with Grid):
   * Canvas area splits:
   * Left: Reference SVG rendered with grid overlay.
   * Right: User drawing area with identical blank grid + starting anchor dot coordinate.
   */
  async setupTier3SideBySideGrid(level) {
    this.setSplitViewLayout(true);

    const halfW = this.CANVAS_WIDTH / 2;
    const leftBounds = { x: 0, y: 0, width: halfW, height: this.CANVAS_HEIGHT };
    const rightBounds = { x: halfW, y: 0, width: halfW, height: this.CANVAS_HEIGHT };

    // 1. Draw reference SVG on the left half at 100% opacity
    const layout = await this.loadSVGToCanvas(level.filepath, this.refCtx, {
      bounds: leftBounds,
      opacity: 1.0,
      padding: 50,
      clearBefore: true
    });
    this.currentSVGLayout = layout;

    // 2. Offscreen reference: draw in the left half for reference (offset will be applied in scoring)
    await this.loadSVGToCanvas(level.filepath, this.offscreenCtx, {
      bounds: leftBounds,
      opacity: 1.0,
      padding: 50,
      clearBefore: true
    });

    // 3. Render identical grids on both halves
    const gridSize = level.gridSize || 8;
    this.renderGrid(this.gridCtx, leftBounds, gridSize, {
      color: 'rgba(0, 0, 0, 0.18)',
      lineWidth: 1.5,
      showCoordinates: true
    });
    this.renderGrid(this.gridCtx, rightBounds, gridSize, {
      color: 'rgba(0, 0, 0, 0.18)',
      lineWidth: 1.5,
      showCoordinates: true
    });

    // 4. Render center dividing boundary line
    this.renderCenterDivider(this.gridCtx);

    // 5. Small starting dot coordinate on user's canvas to anchor first stroke
    if (level.startAnchor) {
      this.renderStartingAnchor(this.gridCtx, rightBounds, level.startAnchor);
    }
  }

  /**
   * Tier 4 (Freestyle):
   * Split canvas without grids.
   * Left: Reference SVG displayed without grids.
   * Right: User replicates freehand.
   * Includes color-matching targets where user must select specific hex codes.
   */
  async setupTier4Freestyle(level) {
    this.setSplitViewLayout(true);

    const halfW = this.CANVAS_WIDTH / 2;
    const leftBounds = { x: 0, y: 0, width: halfW, height: this.CANVAS_HEIGHT };

    // 1. Draw reference SVG on left half without grid
    const layout = await this.loadSVGToCanvas(level.filepath, this.refCtx, {
      bounds: leftBounds,
      opacity: 1.0,
      padding: 50,
      clearBefore: true
    });
    this.currentSVGLayout = layout;

    // 2. Offscreen reference for comparison
    await this.loadSVGToCanvas(level.filepath, this.offscreenCtx, {
      bounds: leftBounds,
      opacity: 1.0,
      padding: 50,
      clearBefore: true
    });

    // 3. Center dividing line
    this.renderCenterDivider(this.gridCtx);

    // 4. Configure Color-Matching Targets Bar
    this.setupColorMatchingTargets(level.targetColors || []);
  }

  /**
   * Renders a rigid square grid overlay on the specified canvas context.
   */
  renderGrid(ctx, bounds, divisions, options = {}) {
    ctx.save();
    ctx.strokeStyle = options.color || 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = options.lineWidth || 1;

    const cellW = bounds.width / divisions;
    const cellH = bounds.height / divisions;

    ctx.beginPath();
    // Vertical lines
    for (let i = 0; i <= divisions; i++) {
      const x = Math.round(bounds.x + i * cellW);
      ctx.moveTo(x, bounds.y);
      ctx.lineTo(x, bounds.y + bounds.height);
    }
    // Horizontal lines
    for (let j = 0; j <= divisions; j++) {
      const y = Math.round(bounds.y + j * cellH);
      ctx.moveTo(bounds.x, y);
      ctx.lineTo(bounds.x + bounds.width, y);
    }
    ctx.stroke();

    // Subtle coordinate letters / numbers in corners if enabled
    if (options.showCoordinates && divisions <= 16) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Numbers along top edge
      for (let i = 0; i < divisions; i++) {
        const x = bounds.x + i * cellW + cellW / 2;
        ctx.fillText(String(i + 1), x, bounds.y + 12);
      }
      // Letters along left edge
      for (let j = 0; j < divisions; j++) {
        const letter = String.fromCharCode(65 + j);
        const y = bounds.y + j * cellH + cellH / 2;
        ctx.fillText(letter, bounds.x + 12, y);
      }
    }

    ctx.restore();
  }

  /**
   * Renders a distinct neo-brutalist dividing line down the middle of the canvas
   */
  renderCenterDivider(ctx) {
    const midX = this.CANVAS_WIDTH / 2;
    ctx.save();
    ctx.strokeStyle = '#1E1E1E';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, this.CANVAS_HEIGHT);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders a glowing starting dot coordinate on user's canvas to anchor their first stroke.
   */
  renderStartingAnchor(ctx, bounds, anchor) {
    const anchorX = bounds.x + bounds.width * anchor.xRatio;
    const anchorY = bounds.y + bounds.height * anchor.yRatio;

    ctx.save();

    // Outer pulse ring
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.fill();

    // Solid core dot
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Anchor pill label
    const labelText = anchor.label || 'Start Here';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    const badgeW = textWidth + 16;
    const badgeH = 22;
    const badgeX = Math.min(bounds.x + bounds.width - badgeW - 10, anchorX + 12);
    const badgeY = anchorY - 11;

    // Label background
    ctx.fillStyle = '#1E1E1E';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    // Label text
    ctx.fillStyle = '#FDE68A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, badgeX + badgeW / 2, badgeY + badgeH / 2);

    ctx.restore();
  }

  // =========================================================================
  // 3. Accuracy Evaluation Engine (Canvas Pixel Matching)
  // =========================================================================

  /**
   * Evaluates user's drawn canvas against reference offscreen canvas.
   *
   * For Tiers 1 & 2: Compares directly within full canvas bounding box.
   * For Tiers 3 & 4: Applies coordinate offset (rightDrawingArea - leftReferenceArea).
   * Tolerance: 3-pixel radius tolerance margin of error.
   */
  evaluateDrawing() {
    const level = this.currentLevel;
    if (!level) return null;

    const W = this.CANVAS_WIDTH;
    const H = this.CANVAS_HEIGHT;

    // Extract user canvas ImageData and offscreen reference ImageData
    const userImgData = this.drawCtx.getImageData(0, 0, W, H);
    const refImgData = this.offscreenCtx.getImageData(0, 0, W, H);

    const userPixels = userImgData.data;
    const refPixels = refImgData.data;

    // Check if user drew anything
    let userDrawnPixelCount = 0;
    for (let i = 3; i < userPixels.length; i += 4) {
      if (userPixels[i] > 30) {
        // Not transparent and not background white
        const r = userPixels[i - 3];
        const g = userPixels[i - 2];
        const b = userPixels[i - 1];
        if (r < 250 || g < 250 || b < 250) {
          userDrawnPixelCount++;
        }
      }
    }

    if (userDrawnPixelCount < 100) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please draw your sketch before submitting!', 'warning', '✏️', 2500);
      }
      return null;
    }

    // Determine coordinate offset for Tiers 3 & 4
    let coordOffsetX = 0;
    if (level.tier >= 3) {
      // Reference was drawn on left half [0, W/2], user drew on right half [W/2, W]
      coordOffsetX = W / 2;
    }

    // Build boolean map of user drawn pixels for instant 2D spatial queries
    // userMap[y * W + x] = 1 if drawn
    const userMap = new Uint8Array(W * H);
    let minUserX = W, maxUserX = 0, minUserY = H, maxUserY = 0;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W;
      for (let x = 0; x < W; x++) {
        const idx = (rowOffset + x) * 4;
        const a = userPixels[idx + 3];
        if (a > 30) {
          const r = userPixels[idx];
          const g = userPixels[idx + 1];
          const b = userPixels[idx + 2];
          if (r < 250 || g < 250 || b < 250) {
            userMap[rowOffset + x] = 1;
            if (x < minUserX) minUserX = x;
            if (x > maxUserX) maxUserX = x;
            if (y < minUserY) minUserY = y;
            if (y > maxUserY) maxUserY = y;
          }
        }
      }
    }

    // Extract reference pixels and bounding box
    const TOLERANCE_RADIUS = 3; // 3-pixel radius tolerance
    const TOL_SQ = TOLERANCE_RADIUS * TOLERANCE_RADIUS; // 9

    let totalRefPixels = 0;
    let matchedRefPixels = 0;

    let minRefX = W, maxRefX = 0, minRefY = H, maxRefY = 0;

    // Step size 1 for subpixel accuracy or 2 for high speed; step 1 is fast (<8ms)
    const step = 2;

    for (let ry = 0; ry < H; ry += step) {
      const refRowOffset = ry * W;
      for (let rx = 0; rx < W; rx += step) {
        const rIdx = (refRowOffset + rx) * 4;
        const a = refPixels[rIdx + 3];

        if (a > 30) {
          const r = refPixels[rIdx];
          const g = refPixels[rIdx + 1];
          const b = refPixels[rIdx + 2];
          // Valid reference stroke/fill
          if (r < 250 || g < 250 || b < 250) {
            // Target coordinate on user drawing canvas with offset applied
            const targetX = rx + coordOffsetX;
            const targetY = ry;

            if (targetX < minRefX) minRefX = targetX;
            if (targetX > maxRefX) maxRefX = targetX;
            if (targetY < minRefY) minRefY = targetY;
            if (targetY > maxRefY) maxRefY = targetY;

            totalRefPixels++;

            // Test if any user pixel exists within 3-pixel radius tolerance
            let foundMatch = false;
            for (let dy = -TOLERANCE_RADIUS; dy <= TOLERANCE_RADIUS && !foundMatch; dy++) {
              const checkY = targetY + dy;
              if (checkY < 0 || checkY >= H) continue;
              const checkRowOffset = checkY * W;

              for (let dx = -TOLERANCE_RADIUS; dx <= TOLERANCE_RADIUS; dx++) {
                if (dx * dx + dy * dy <= TOL_SQ) {
                  const checkX = targetX + dx;
                  if (checkX >= 0 && checkX < W) {
                    if (userMap[checkRowOffset + checkX] === 1) {
                      foundMatch = true;
                      break;
                    }
                  }
                }
              }
            }

            if (foundMatch) {
              matchedRefPixels++;
            }
          }
        }
      }
    }

    if (totalRefPixels === 0) {
      totalRefPixels = 1;
    }

    // Raw coverage recall: percentage of reference pixels traced/replicated
    const rawCoverage = (matchedRefPixels / totalRefPixels) * 100;

    // Precision check: calculate if user scribbled extensively outside target bounding box
    const boundPad = 25;
    const allowedMinX = Math.max(0, minRefX - boundPad);
    const allowedMaxX = Math.min(W - 1, maxRefX + boundPad);
    const allowedMinY = Math.max(0, minRefY - boundPad);
    const allowedMaxY = Math.min(H - 1, maxRefY + boundPad);

    let strayPixelCount = 0;
    let sampledUserPixels = 0;

    for (let y = 0; y < H; y += step) {
      const rowOffset = y * W;
      for (let x = 0; x < W; x += step) {
        if (userMap[rowOffset + x] === 1) {
          sampledUserPixels++;
          if (x < allowedMinX || x > allowedMaxX || y < allowedMinY || y > allowedMaxY) {
            strayPixelCount++;
          }
        }
      }
    }

    // Stray penalty: up to 35% deduction if drawing all over the screen
    let strayRatio = sampledUserPixels > 0 ? (strayPixelCount / sampledUserPixels) : 0;
    let strayPenalty = Math.min(35, Math.round(strayRatio * 50));

    let finalAccuracy = Math.max(0, Math.min(100, Math.round(rawCoverage - strayPenalty)));

    // Tier 4 Color-Matching Verification
    let colorCheckResult = null;
    if (level.tier === 4 && Array.isArray(level.targetColors) && level.targetColors.length > 0) {
      colorCheckResult = this.verifyTier4Colors(level.targetColors);
      if (!colorCheckResult.allUsed) {
        // Minor deduction for missing required palette colors in Tier 4
        finalAccuracy = Math.max(0, finalAccuracy - (colorCheckResult.missingCount * 10));
      }
    }

    const passed = finalAccuracy >= level.targetAccuracy;

    // Determine Letter Grade
    let grade = 'C';
    if (finalAccuracy >= 95) grade = 'S';
    else if (finalAccuracy >= 85) grade = 'A';
    else if (finalAccuracy >= 75) grade = 'B';
    else if (finalAccuracy >= 65) grade = 'C';
    else grade = 'D';

    const result = {
      level,
      tier: level.tier,
      accuracy: finalAccuracy,
      rawCoverage: Math.round(rawCoverage),
      targetAccuracy: level.targetAccuracy,
      passed,
      grade,
      colorCheck: colorCheckResult,
      matchedRefPixels,
      totalRefPixels,
      strayPenalty
    };

    // Show celebratory sound and results modal
    this.showEvaluationModal(result);

    return result;
  }

  /**
   * Verifies if required target colors were selected/used by the user in Tier 4
   */
  verifyTier4Colors(targetColors) {
    const list = targetColors.map(tc => {
      const isUsed = this.usedColors.has(tc.hex.toUpperCase());
      return {
        hex: tc.hex,
        name: tc.name,
        label: tc.label,
        used: isUsed
      };
    });

    const usedCount = list.filter(i => i.used).length;
    return {
      items: list,
      usedCount,
      totalCount: targetColors.length,
      missingCount: targetColors.length - usedCount,
      allUsed: usedCount === targetColors.length
    };
  }

  showEvaluationModal(result) {
    const modal = document.getElementById('academyResultModal');
    if (!modal) return;

    const scoreNumber = document.getElementById('academyResultScore');
    const targetBadge = document.getElementById('academyResultTarget');
    const gradeBadge = document.getElementById('academyResultGrade');
    const titleText = document.getElementById('academyResultTitle');
    const messageText = document.getElementById('academyResultMessage');
    const btnNext = document.getElementById('btnAcademyNextLevel');
    const colorSection = document.getElementById('academyResultColors');

    if (scoreNumber) {
      scoreNumber.textContent = `${result.accuracy}%`;
    }

    if (targetBadge) {
      targetBadge.textContent = `Target: ${result.targetAccuracy}% Accuracy`;
      targetBadge.className = result.passed ? 'badge-target-pass' : 'badge-target-fail';
    }

    if (gradeBadge) {
      gradeBadge.textContent = result.grade;
      gradeBadge.dataset.grade = result.grade;
    }

    if (titleText) {
      titleText.textContent = result.passed ? '🎉 Level Mastered!' : '💪 Keep Practicing!';
    }

    if (messageText) {
      if (result.passed) {
        messageText.textContent = `Excellent drawing! You scored ${result.accuracy}%, surpassing the ${result.targetAccuracy}% target.`;
      } else {
        messageText.textContent = `You scored ${result.accuracy}%. Aim for ${result.targetAccuracy}% by matching contours more closely.`;
      }
    }

    // Color checklist for Tier 4
    if (colorSection) {
      if (result.colorCheck && result.colorCheck.items.length > 0) {
        colorSection.style.display = 'block';
        colorSection.innerHTML = `
          <div class="result-colors-title">🎨 Palette Requirements:</div>
          <div class="result-colors-list">
            ${result.colorCheck.items.map(c => `
              <div class="result-color-pill ${c.used ? 'used' : 'missed'}">
                <span class="color-dot" style="background-color: ${c.hex};"></span>
                <span>${c.name} (${c.label})</span>
                <span class="status-icon">${c.used ? '✓' : '✗'}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        colorSection.style.display = 'none';
        colorSection.innerHTML = '';
      }
    }

    // Show/hide Next Level button
    if (btnNext) {
      const levels = window.ACADEMY_LEVELS || [];
      const hasNext = this.currentLevelIndex < levels.length - 1;
      btnNext.style.display = hasNext ? 'inline-flex' : 'none';
    }

    modal.classList.remove('hidden');

    if (result.passed && typeof window.playSound === 'function') {
      window.playSound('join');
    } else if (typeof window.playSound === 'function') {
      window.playSound('pop');
    }
  }

  // =========================================================================
  // Canvas Drawing & Pointer Interactions
  // =========================================================================

  bindCanvasEvents() {
    if (!this.drawCanvas) return;

    const getCanvasCoords = (e) => {
      const rect = this.drawCanvas.getBoundingClientRect();
      const scaleX = this.drawCanvas.width / rect.width;
      const scaleY = this.drawCanvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const isAllowedDrawingRegion = (x) => {
      // In Tiers 3 & 4, user only draws on the right side
      if (this.currentTier >= 3) {
        return x >= (this.CANVAS_WIDTH / 2);
      }
      return true;
    };

    this.drawCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const coords = getCanvasCoords(e);

      if (!isAllowedDrawingRegion(coords.x)) {
        if (typeof window.showToast === 'function') {
          window.showToast('Draw in the right-side sketch area!', 'info', '👉', 1600);
        }
        return;
      }

      this.isDrawing = true;
      this.hasMoved = false;
      this.lastX = coords.x;
      this.lastY = coords.y;

      // Track used color
      if (this.currentTool === 'brush') {
        this.usedColors.add(this.currentColor.toUpperCase());
        this.updateColorTargetBadges();
      }

      this.saveSnapshot();

      this.strokePoints = [{ x: coords.x, y: coords.y }];

      // Initial dot
      const isEraser = (this.currentTool === 'eraser');
      this.drawDot(coords.x, coords.y, this.currentColor, this.currentSize, isEraser);

      try {
        this.drawCanvas.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    this.drawCanvas.addEventListener('pointermove', (e) => {
      if (!this.isDrawing) return;
      const coords = getCanvasCoords(e);

      // Clamp X in split mode so user doesn't bleed into reference side
      if (this.currentTier >= 3 && coords.x < this.CANVAS_WIDTH / 2) {
        coords.x = this.CANVAS_WIDTH / 2;
      }

      this.hasMoved = true;
      const isEraser = (this.currentTool === 'eraser');

      if (this.smoothingEnabled) {
        this.strokePoints.push({ x: coords.x, y: coords.y });
        if (this.strokePoints.length >= 3) {
          const len = this.strokePoints.length;
          const p0 = this.strokePoints[len - 3];
          const p1 = this.strokePoints[len - 2];
          const p2 = this.strokePoints[len - 1];

          const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
          const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

          this.drawBezier(mid1.x, mid1.y, p1.x, p1.y, mid2.x, mid2.y, this.currentColor, this.currentSize, isEraser);
          this.lastX = coords.x;
          this.lastY = coords.y;
        }
      } else {
        this.drawLine(this.lastX, this.lastY, coords.x, coords.y, this.currentColor, this.currentSize, isEraser);
        this.lastX = coords.x;
        this.lastY = coords.y;
      }
    });

    const stopDrawing = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      // Finish tail of smoothed stroke
      if (this.smoothingEnabled && this.hasMoved && this.strokePoints.length >= 2) {
        const len = this.strokePoints.length;
        const pPrev = this.strokePoints[len - 2];
        const pLast = this.strokePoints[len - 1];
        const midStart = { x: (pPrev.x + pLast.x) / 2, y: (pPrev.y + pLast.y) / 2 };
        const isEraser = (this.currentTool === 'eraser');
        this.drawBezier(midStart.x, midStart.y, pLast.x, pLast.y, pLast.x, pLast.y, this.currentColor, this.currentSize, isEraser);
      }
      this.strokePoints = [];

      try {
        if (e && e.pointerId) this.drawCanvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    this.drawCanvas.addEventListener('pointerup', stopDrawing);
    this.drawCanvas.addEventListener('pointercancel', stopDrawing);
    this.drawCanvas.addEventListener('pointerleave', stopDrawing);
  }

  drawDot(x, y, color, size, isEraser) {
    this.drawCtx.save();
    this.drawCtx.fillStyle = isEraser ? '#FFFFFF' : color;
    if (isEraser) {
      this.drawCtx.globalCompositeOperation = 'destination-out';
    }
    this.drawCtx.beginPath();
    this.drawCtx.arc(x, y, Math.max(1, size / 2), 0, Math.PI * 2);
    this.drawCtx.fill();
    this.drawCtx.restore();
  }

  drawLine(x1, y1, x2, y2, color, size, isEraser) {
    this.drawCtx.save();
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.lineWidth = size;
    if (isEraser) {
      this.drawCtx.globalCompositeOperation = 'destination-out';
      this.drawCtx.strokeStyle = '#FFFFFF';
    } else {
      this.drawCtx.strokeStyle = color;
    }
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(x1, y1);
    this.drawCtx.lineTo(x2, y2);
    this.drawCtx.stroke();
    this.drawCtx.restore();
  }

  drawBezier(x1, y1, cx, cy, x2, y2, color, size, isEraser) {
    this.drawCtx.save();
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.lineWidth = size;
    if (isEraser) {
      this.drawCtx.globalCompositeOperation = 'destination-out';
      this.drawCtx.strokeStyle = '#FFFFFF';
    } else {
      this.drawCtx.strokeStyle = color;
    }
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(x1, y1);
    this.drawCtx.quadraticCurveTo(cx, cy, x2, y2);
    this.drawCtx.stroke();
    this.drawCtx.restore();
  }

  // =========================================================================
  // Canvas Snapshot & Undo
  // =========================================================================

  saveSnapshot() {
    if (!this.drawCtx) return;
    try {
      const snap = this.drawCtx.getImageData(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
      this.undoStack.push(snap);
      if (this.undoStack.length > this.maxUndoSteps) {
        this.undoStack.shift();
      }
    } catch (e) {
      console.warn('[AcademyMode] Snapshot failed:', e);
    }
  }

  undo() {
    if (this.undoStack.length <= 1) {
      if (typeof window.showToast === 'function') {
        window.showToast('Nothing left to undo', 'info', '↩️', 1600);
      }
      return;
    }
    this.undoStack.pop(); // Remove current state
    const previous = this.undoStack[this.undoStack.length - 1];
    if (previous) {
      this.drawCtx.putImageData(previous, 0, 0);
      if (typeof window.playSound === 'function') {
        window.playSound('pop');
      }
    }
  }

  clearUserCanvas(withSnapshot = true) {
    if (withSnapshot) this.saveSnapshot();
    this.drawCtx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
  }

  // =========================================================================
  // UI & View Layout Controls
  // =========================================================================

  setSplitViewLayout(isSplit) {
    const splitLabels = document.getElementById('academySplitLabels');
    if (splitLabels) {
      splitLabels.style.display = isSplit ? 'flex' : 'none';
    }

    const container = document.getElementById('academyCanvasContainer');
    if (container) {
      container.classList.toggle('split-mode', isSplit);
    }
  }

  updateLevelUI(level) {
    const titleEl = document.getElementById('academyLevelTitle');
    const descEl = document.getElementById('academyLevelDesc');
    const targetBadgeEl = document.getElementById('academyTargetBadge');

    if (titleEl) titleEl.textContent = `${level.icon || '✏️'} ${level.name}`;
    if (descEl) descEl.textContent = level.description;
    if (targetBadgeEl) targetBadgeEl.textContent = `Target: ${level.targetAccuracy}% Accuracy`;

    // Update level dropdown selector
    const selector = document.getElementById('academyLevelSelect');
    if (selector) selector.value = level.id;

    // Toggle color target section for Tier 4
    const colorTargetContainer = document.getElementById('academyColorTargetsBar');
    if (colorTargetContainer) {
      colorTargetContainer.style.display = (level.tier === 4) ? 'flex' : 'none';
    }
  }

  setupColorMatchingTargets(targetColors) {
    const container = document.getElementById('academyColorTargetsBar');
    const list = document.getElementById('academyColorTargetsList');
    if (!container || !list) return;

    if (!targetColors || targetColors.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    list.innerHTML = targetColors.map(c => `
      <div class="target-color-pill" data-hex="${c.hex.toUpperCase()}" id="colorTarget_${c.hex.replace('#', '')}">
        <span class="color-dot" style="background-color: ${c.hex};"></span>
        <span class="color-label">${c.name} (${c.label})</span>
        <span class="color-status">○</span>
      </div>
    `).join('');

    this.updateColorTargetBadges();
  }

  updateColorTargetBadges() {
    if (this.currentTier !== 4 || !this.currentLevel.targetColors) return;

    this.currentLevel.targetColors.forEach(c => {
      const el = document.getElementById(`colorTarget_${c.hex.replace('#', '')}`);
      if (el) {
        const isUsed = this.usedColors.has(c.hex.toUpperCase());
        el.classList.toggle('used', isUsed);
        const statusEl = el.querySelector('.color-status');
        if (statusEl) statusEl.textContent = isUsed ? '✓' : '○';
      }
    });
  }

  populateLevelDropdown() {
    const selector = document.getElementById('academyLevelSelect');
    if (!selector) return;

    const levels = window.ACADEMY_LEVELS || [];
    selector.innerHTML = levels.map((lvl, idx) => `
      <option value="${lvl.id}" ${idx === this.currentLevelIndex ? 'selected' : ''}>
        ${lvl.tierName} — ${lvl.name}
      </option>
    `).join('');
  }

  bindUIEvents() {
    // Exit button
    const btnExit = document.getElementById('btnAcademyExit');
    if (btnExit) {
      btnExit.addEventListener('click', () => this.close());
    }

    // Logo click returns home
    const logo = document.querySelector('.academy-header-logo');
    if (logo) {
      logo.addEventListener('click', () => this.close());
    }

    // Level Selector dropdown
    const selector = document.getElementById('academyLevelSelect');
    if (selector) {
      selector.addEventListener('change', (e) => {
        const levels = window.ACADEMY_LEVELS || [];
        const foundIdx = levels.findIndex(lvl => lvl.id === e.target.value);
        if (foundIdx !== -1) {
          this.loadLevel(foundIdx);
        }
      });
    }

    // Previous Level Button
    const btnPrev = document.getElementById('btnAcademyPrevLevel');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.currentLevelIndex > 0) {
          this.loadLevel(this.currentLevelIndex - 1);
        }
      });
    }

    // Next Level Button in Header
    const btnNextHeader = document.getElementById('btnAcademyNextLevelHeader');
    if (btnNextHeader) {
      btnNextHeader.addEventListener('click', () => {
        const levels = window.ACADEMY_LEVELS || [];
        if (this.currentLevelIndex < levels.length - 1) {
          this.loadLevel(this.currentLevelIndex + 1);
        }
      });
    }

    // Submit for accuracy evaluation
    const btnSubmit = document.getElementById('btnAcademySubmit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        this.evaluateDrawing();
      });
    }

    // Undo
    const btnUndo = document.getElementById('btnAcademyUndo');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.undo());
    }

    // Clear
    const btnClear = document.getElementById('btnAcademyClear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.clearUserCanvas(true);
        if (typeof window.showToast === 'function') {
          window.showToast('Drawing cleared', 'info', '🗑️', 1600);
        }
      });
    }

    // Tool selector (Brush / Eraser)
    const btnBrush = document.getElementById('btnAcademyBrush');
    const btnEraser = document.getElementById('btnAcademyEraser');
    if (btnBrush) {
      btnBrush.addEventListener('click', () => {
        this.currentTool = 'brush';
        btnBrush.classList.add('active');
        if (btnEraser) btnEraser.classList.remove('active');
      });
    }
    if (btnEraser) {
      btnEraser.addEventListener('click', () => {
        this.currentTool = 'eraser';
        btnEraser.classList.add('active');
        if (btnBrush) btnBrush.classList.remove('active');
      });
    }

    // Brush Size slider
    const sizeSlider = document.getElementById('academySizeSlider');
    const sizeBadge = document.getElementById('academySizeBadge');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => {
        this.currentSize = parseInt(e.target.value, 10) || 8;
        if (sizeBadge) sizeBadge.textContent = `${this.currentSize}px`;
      });
    }

    // Size preset dots
    const presetDots = document.querySelectorAll('.academy-size-dot');
    presetDots.forEach(dot => {
      dot.addEventListener('click', () => {
        presetDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        const sz = parseInt(dot.dataset.size, 10) || 8;
        this.currentSize = sz;
        if (sizeSlider) sizeSlider.value = sz;
        if (sizeBadge) sizeBadge.textContent = `${sz}px`;
      });
    });

    // Palette Swatches
    const swatches = document.querySelectorAll('.academy-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.currentColor = swatch.dataset.color || '#1E1E1E';
        this.currentTool = 'brush';
        if (btnBrush) btnBrush.classList.add('active');
        if (btnEraser) btnEraser.classList.remove('active');
      });
    });

    // Custom Color Picker
    const customPicker = document.getElementById('academyCustomColorPicker');
    if (customPicker) {
      customPicker.addEventListener('input', (e) => {
        this.currentColor = e.target.value;
        this.currentTool = 'brush';
        if (btnBrush) btnBrush.classList.add('active');
        if (btnEraser) btnEraser.classList.remove('active');
      });
    }

    // Modal Action Buttons
    const btnRetry = document.getElementById('btnAcademyRetry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        const modal = document.getElementById('academyResultModal');
        if (modal) modal.classList.add('hidden');
        this.clearUserCanvas(false);
      });
    }

    const btnNextModal = document.getElementById('btnAcademyNextLevel');
    if (btnNextModal) {
      btnNextModal.addEventListener('click', () => {
        const modal = document.getElementById('academyResultModal');
        if (modal) modal.classList.add('hidden');
        const levels = window.ACADEMY_LEVELS || [];
        if (this.currentLevelIndex < levels.length - 1) {
          this.loadLevel(this.currentLevelIndex + 1);
        }
      });
    }

    const btnModalExit = document.getElementById('btnAcademyModalExit');
    if (btnModalExit) {
      btnModalExit.addEventListener('click', () => {
        const modal = document.getElementById('academyResultModal');
        if (modal) modal.classList.add('hidden');
        this.close();
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.AcademyModeManager = AcademyModeManager;
}
