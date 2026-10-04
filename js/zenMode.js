/**
 * ZenModeManager - Standalone Single-Player Symmetry & Mandala Sandbox
 * Runs 100% client-side with zero socket/server overhead.
 */
class ZenModeManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.guideCanvas = null;
    this.guideCtx = null;
    this.container = null;
    this.view = null;

    // Drawing state
    this.isDrawing = false;
    this.hasMoved = false;
    this.lastX = 0;
    this.lastY = 0;
    this.currentTool = 'brush'; // 'brush' | 'eraser'
    this.currentColor = '#1E1E1E';
    this.currentSize = 8;
    this.currentSymmetry = 'kaleidoscope'; // 'none' | 'horizontal' | 'vertical' | 'quad' | 'kaleidoscope'
    this.showGuides = true;

    // Undo stack (stores ImageData)
    this.undoStack = [];
    this.maxUndoSteps = 25;

    // Dimensions
    this.CANVAS_WIDTH = 1200;
    this.CANVAS_HEIGHT = 800;

    // Symmetry metadata for UI
    this.symmetryInfo = {
      none: { name: 'Standard Freehand', icon: '✏️' },
      horizontal: { name: 'Horizontal Mirror', icon: '↔️' },
      vertical: { name: 'Vertical Mirror', icon: '↕️' },
      quad: { name: 'Quad Mirror (4-Way)', icon: '✛' },
      kaleidoscope: { name: 'Kaleidoscope (8-Way)', icon: '❄️' }
    };
  }

  init() {
    this.view = document.getElementById('zenModeView');
    this.canvas = document.getElementById('zenDrawingCanvas');
    this.guideCanvas = document.getElementById('zenGuideCanvas');
    this.container = document.getElementById('zenCanvasContainer');

    if (!this.view || !this.canvas) {
      console.warn('[ZenMode] Canvas or view elements not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (this.guideCanvas) {
      this.guideCtx = this.guideCanvas.getContext('2d');
    }

    this.initCanvasSize();
    this.fillCanvasWhite();
    this.drawGuides();
    this.bindUIEvents();
    this.bindCanvasEvents();

    window.addEventListener('resize', () => {
      if (this.isOpen()) {
        this.drawGuides();
      }
    });

    console.log('🧘 Zen Mode Symmetry Studio initialized.');
  }

  isOpen() {
    return this.view && !this.view.classList.contains('hidden') && this.view.style.display !== 'none';
  }

  initCanvasSize() {
    if (!this.canvas) return;
    this.canvas.width = this.CANVAS_WIDTH;
    this.canvas.height = this.CANVAS_HEIGHT;

    if (this.guideCanvas) {
      this.guideCanvas.width = this.CANVAS_WIDTH;
      this.guideCanvas.height = this.CANVAS_HEIGHT;
    }
  }

  fillCanvasWhite() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  saveSnapshot() {
    if (!this.ctx) return;
    try {
      const snap = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.undoStack.push(snap);
      if (this.undoStack.length > this.maxUndoSteps) {
        this.undoStack.shift();
      }
    } catch (e) {
      console.warn('Unable to snapshot Zen canvas:', e);
    }
  }

  undo() {
    if (this.undoStack.length === 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('No strokes to undo', 'info', '↩️', 1800);
      }
      return;
    }
    const previous = this.undoStack.pop();
    this.ctx.putImageData(previous, 0, 0);
    if (typeof window.playSound === 'function') {
      window.playSound('pop');
    }
  }

  clearCanvas() {
    this.saveSnapshot();
    this.fillCanvasWhite();
    if (typeof window.showToast === 'function') {
      window.showToast('Canvas cleared', 'info', '✨', 1800);
    }
  }

  open() {
    const landingOverlay = document.getElementById('landingOverlay');
    if (landingOverlay) {
      landingOverlay.classList.add('hidden');
    }

    if (this.view) {
      this.view.classList.remove('hidden');
      this.view.style.display = 'flex';
    }

    document.body.classList.add('zen-mode-active');

    // Reset snapshot state
    this.undoStack = [];
    this.saveSnapshot();
    this.drawGuides();

    if (typeof window.playSound === 'function') {
      window.playSound('pop');
    }
  }

  close() {
    if (this.view) {
      this.view.classList.add('hidden');
      this.view.style.display = 'none';
    }

    document.body.classList.remove('zen-mode-active');

    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
      appContainer.classList.remove('hidden');
      appContainer.style.display = '';
    }

    const landingOverlay = document.getElementById('landingOverlay');
    if (landingOverlay) {
      landingOverlay.classList.remove('hidden');
    }

    if (typeof window.playSound === 'function') {
      window.playSound('pop');
    }
  }

  setSymmetry(mode) {
    if (!this.symmetryInfo[mode]) return;
    this.currentSymmetry = mode;

    // Update buttons
    const buttons = document.querySelectorAll('.zen-sym-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sym === mode);
    });

    // Update header pill
    const symIcon = document.getElementById('zenSymIcon');
    const symName = document.getElementById('zenSymName');
    const info = this.symmetryInfo[mode];
    if (symIcon) symIcon.textContent = info.icon;
    if (symName) symName.textContent = info.name;

    this.drawGuides();

    if (typeof window.showToast === 'function') {
      window.showToast(`Symmetry: ${info.name}`, 'info', info.icon, 1600);
    }
  }

  setTool(tool) {
    this.currentTool = (tool === 'eraser') ? 'eraser' : 'brush';
    const brushBtn = document.getElementById('btnZenBrush');
    const eraserBtn = document.getElementById('btnZenEraser');
    if (brushBtn) brushBtn.classList.toggle('active', this.currentTool === 'brush');
    if (eraserBtn) eraserBtn.classList.toggle('active', this.currentTool === 'eraser');
  }

  setColor(color) {
    this.currentColor = color;
    this.setTool('brush');

    // Update active swatch
    const swatches = document.querySelectorAll('.zen-swatch');
    swatches.forEach(s => {
      s.classList.toggle('active', s.dataset.color && s.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  setSize(size) {
    this.currentSize = Math.max(1, Math.min(60, parseInt(size, 10) || 8));
    const slider = document.getElementById('zenSizeSlider');
    const badge = document.getElementById('zenSizeBadge');
    if (slider) slider.value = this.currentSize;
    if (badge) badge.textContent = `${this.currentSize}px`;

    // Update presets
    const presets = document.querySelectorAll('.zen-size-preset-dot');
    presets.forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.size, 10) === this.currentSize);
    });
  }

  toggleGuides() {
    this.showGuides = !this.showGuides;
    const label = document.getElementById('zenGuidesLabel');
    if (label) label.textContent = this.showGuides ? 'Guides: On' : 'Guides: Off';
    this.drawGuides();
  }

  drawGuides() {
    if (!this.guideCtx || !this.guideCanvas) return;
    const gctx = this.guideCtx;
    const W = this.guideCanvas.width;
    const H = this.guideCanvas.height;
    const cx = W / 2;
    const cy = H / 2;

    gctx.clearRect(0, 0, W, H);
    if (!this.showGuides || this.currentSymmetry === 'none') return;

    gctx.save();
    gctx.strokeStyle = 'rgba(99, 102, 241, 0.35)'; // Gentle indigo dashed lines
    gctx.lineWidth = 1.5;
    gctx.setLineDash([6, 6]);

    // Draw axes depending on symmetry mode
    if (this.currentSymmetry === 'horizontal' || this.currentSymmetry === 'quad' || this.currentSymmetry === 'kaleidoscope') {
      // Vertical Centerline (reflects Left to Right)
      gctx.beginPath();
      gctx.moveTo(cx, 0);
      gctx.lineTo(cx, H);
      gctx.stroke();
    }

    if (this.currentSymmetry === 'vertical' || this.currentSymmetry === 'quad' || this.currentSymmetry === 'kaleidoscope') {
      // Horizontal Centerline (reflects Top to Bottom)
      gctx.beginPath();
      gctx.moveTo(0, cy);
      gctx.lineTo(W, cy);
      gctx.stroke();
    }

    if (this.currentSymmetry === 'kaleidoscope') {
      // Diagonal lines through center
      // Diagonal 1: (cx - R, cy - R) to (cx + R, cy + R)
      const diagSpan = Math.max(W, H);
      gctx.beginPath();
      gctx.moveTo(cx - diagSpan, cy - diagSpan);
      gctx.lineTo(cx + diagSpan, cy + diagSpan);
      gctx.stroke();

      // Diagonal 2: (cx - R, cy + R) to (cx + R, cy - R)
      gctx.beginPath();
      gctx.moveTo(cx - diagSpan, cy + diagSpan);
      gctx.lineTo(cx + diagSpan, cy - diagSpan);
      gctx.stroke();

      // Faint concentric circle guidelines for radial orientation
      gctx.setLineDash([4, 8]);
      gctx.strokeStyle = 'rgba(99, 102, 241, 0.18)';
      [100, 200, 320].forEach(r => {
        gctx.beginPath();
        gctx.arc(cx, cy, r, 0, Math.PI * 2);
        gctx.stroke();
      });
    }

    // Center focal point dot
    gctx.setLineDash([]);
    gctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
    gctx.beginPath();
    gctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    gctx.fill();

    gctx.restore();
  }

  exportImage() {
    if (!this.canvas) return;
    try {
      // Create a background-rendered copy with crisp white paper backing
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = this.canvas.width;
      exportCanvas.height = this.canvas.height;
      const expCtx = exportCanvas.getContext('2d');

      expCtx.fillStyle = '#FFFFFF';
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      expCtx.drawImage(this.canvas, 0, 0);

      const dataUrl = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `transcribble-zen-${this.currentSymmetry}-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (typeof window.showToast === 'function') {
        window.showToast('Artwork saved to your device!', 'success', '💾', 3000);
      }
      if (typeof window.playSound === 'function') {
        window.playSound('win');
      }
    } catch (e) {
      console.error('Export error:', e);
      if (typeof window.showToast === 'function') {
        window.showToast('Failed to export image', 'danger', '⚠️', 2500);
      }
    }
  }

  // =========================================================================
  // Symmetry Mathematics & Stroke Calculations
  // =========================================================================

  getSymmetryPoints(x, y) {
    const cx = this.CANVAS_WIDTH / 2;
    const cy = this.CANVAS_HEIGHT / 2;
    const dx = x - cx;
    const dy = y - cy;

    switch (this.currentSymmetry) {
      case 'horizontal':
        // Reflect across vertical centerline (Left & Right)
        return [
          { x: cx + dx, y: cy + dy },
          { x: cx - dx, y: cy + dy }
        ];

      case 'vertical':
        // Reflect across horizontal centerline (Top & Bottom)
        return [
          { x: cx + dx, y: cy + dy },
          { x: cx + dx, y: cy - dy }
        ];

      case 'quad':
        // 4 Quadrants: Both horizontal and vertical reflection
        return [
          { x: cx + dx, y: cy + dy },
          { x: cx - dx, y: cy + dy },
          { x: cx + dx, y: cy - dy },
          { x: cx - dx, y: cy - dy }
        ];

      case 'kaleidoscope':
        // 8-Way Dihedral (D4) radial symmetry across 8 radial segments centered on (cx, cy)
        return [
          { x: cx + dx, y: cy + dy }, // original
          { x: cx - dx, y: cy + dy }, // mirror X
          { x: cx + dx, y: cy - dy }, // mirror Y
          { x: cx - dx, y: cy - dy }, // 180° rotation
          { x: cx + dy, y: cy + dx }, // diagonal mirror (y = x)
          { x: cx - dy, y: cy + dx }, // 90° rotation
          { x: cx + dy, y: cy - dx }, // 270° rotation
          { x: cx - dy, y: cy - dx }  // anti-diagonal mirror
        ];

      case 'none':
      default:
        return [{ x: cx + dx, y: cy + dy }];
    }
  }

  drawSymmetryDot(x, y, color, size, isEraser) {
    if (!this.ctx) return;
    const points = this.getSymmetryPoints(x, y);
    const radius = Math.max(1, size / 2);

    this.ctx.save();
    this.ctx.fillStyle = isEraser ? '#FFFFFF' : color;

    points.forEach(pt => {
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  drawSymmetryLine(prevX, prevY, currX, currY, color, size, isEraser) {
    if (!this.ctx) return;
    const pts0 = this.getSymmetryPoints(prevX, prevY);
    const pts1 = this.getSymmetryPoints(currX, currY);

    this.ctx.save();
    this.ctx.strokeStyle = isEraser ? '#FFFFFF' : color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (let i = 0; i < pts0.length; i++) {
      const p0 = pts0[i];
      const p1 = pts1[i];
      this.ctx.beginPath();
      this.ctx.moveTo(p0.x, p0.y);
      this.ctx.lineTo(p1.x, p1.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  getCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // =========================================================================
  // Canvas Interaction Events
  // =========================================================================

  bindCanvasEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.cancelable) e.preventDefault();

      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {}

      this.saveSnapshot();
      this.isDrawing = true;
      this.hasMoved = false;

      const coords = this.getCoords(e);
      this.lastX = coords.x;
      this.lastY = coords.y;

      const isEraser = (this.currentTool === 'eraser');
      this.drawSymmetryDot(this.lastX, this.lastY, this.currentColor, this.currentSize, isEraser);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDrawing) return;
      if (e.cancelable) e.preventDefault();

      this.hasMoved = true;
      const coords = this.getCoords(e);
      const isEraser = (this.currentTool === 'eraser');

      this.drawSymmetryLine(this.lastX, this.lastY, coords.x, coords.y, this.currentColor, this.currentSize, isEraser);
      this.lastX = coords.x;
      this.lastY = coords.y;
    });

    const stopDrawing = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      try {
        if (e && e.pointerId) this.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    this.canvas.addEventListener('pointerup', stopDrawing);
    this.canvas.addEventListener('pointercancel', stopDrawing);
    this.canvas.addEventListener('pointerleave', stopDrawing);

    // Global keyboard shortcuts in Zen Mode
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

  // =========================================================================
  // UI Controls & Toolbar Binding
  // =========================================================================

  bindUIEvents() {
    // Mode Picker Expand/Collapse Toggle for Zen Mode
    const soloItemZen = document.getElementById('soloItemZen');
    if (soloItemZen) {
      soloItemZen.addEventListener('click', (e) => {
        soloItemZen.classList.toggle('expanded');
        const isExp = soloItemZen.classList.contains('expanded');
        soloItemZen.setAttribute('aria-expanded', isExp ? 'true' : 'false');
      });
      soloItemZen.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          soloItemZen.click();
        }
      });
    }

    // Launch button in Home Screen Block 2
    const btnPlayZenMode = document.getElementById('btnPlayZenMode');
    if (btnPlayZenMode) {
      btnPlayZenMode.addEventListener('click', () => {
        this.open();
      });
    }

    // Exit Button ("Back to Home")
    const btnZenExit = document.getElementById('btnZenExit');
    if (btnZenExit) {
      btnZenExit.addEventListener('click', () => {
        this.close();
      });
    }

    // Header Logo returns home
    const zenLogo = document.querySelector('.zen-header-logo');
    if (zenLogo) {
      zenLogo.addEventListener('click', () => {
        this.close();
      });
    }

    // Undo Action
    const btnZenUndo = document.getElementById('btnZenUndo');
    if (btnZenUndo) {
      btnZenUndo.addEventListener('click', () => {
        this.undo();
      });
    }

    // Guides Toggle
    const btnZenGuides = document.getElementById('btnZenToggleGuides');
    if (btnZenGuides) {
      btnZenGuides.addEventListener('click', () => {
        this.toggleGuides();
      });
    }

    // Clear Canvas Action
    const btnZenClear = document.getElementById('btnZenClear');
    if (btnZenClear) {
      btnZenClear.addEventListener('click', async () => {
        if (typeof window.showGameConfirmModal === 'function') {
          const confirmed = await window.showGameConfirmModal({
            icon: '🗑️',
            badge: 'ZEN STUDIO',
            title: 'Clear Drawing Board?',
            message: 'Are you sure you want to clear your geometric sketch?',
            targetName: 'Wipe Canvas',
            subnote: 'You can still use Undo (Ctrl+Z) if needed.',
            confirmText: 'Clear Board',
            cancelText: 'Keep Drawing'
          });
          if (confirmed) {
            this.clearCanvas();
          }
        } else {
          this.clearCanvas();
        }
      });
    }

    // Export PNG Action
    const btnZenExport = document.getElementById('btnZenExport');
    if (btnZenExport) {
      btnZenExport.addEventListener('click', () => {
        this.exportImage();
      });
    }

    // Symmetry Mode Buttons
    const symButtons = document.querySelectorAll('.zen-sym-btn');
    symButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.sym;
        if (mode) this.setSymmetry(mode);
      });
    });

    // Tool Type Buttons (Brush / Eraser)
    const btnBrush = document.getElementById('btnZenBrush');
    const btnEraser = document.getElementById('btnZenEraser');
    if (btnBrush) {
      btnBrush.addEventListener('click', () => this.setTool('brush'));
    }
    if (btnEraser) {
      btnEraser.addEventListener('click', () => this.setTool('eraser'));
    }

    // Brush Size Slider
    const sizeSlider = document.getElementById('zenSizeSlider');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => {
        this.setSize(e.target.value);
      });
    }

    // Size Preset Dots
    const sizePresets = document.querySelectorAll('.zen-size-preset-dot');
    sizePresets.forEach(dot => {
      dot.addEventListener('click', () => {
        const sz = dot.dataset.size;
        if (sz) this.setSize(sz);
      });
    });

    // Palette Swatches
    const swatches = document.querySelectorAll('.zen-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        if (color) this.setColor(color);
      });
    });

    // Custom Color Picker
    const customPicker = document.getElementById('zenCustomColorPicker');
    if (customPicker) {
      customPicker.addEventListener('input', (e) => {
        this.setColor(e.target.value);
      });
    }
  }
}

// Export to window
window.ZenModeManager = ZenModeManager;
