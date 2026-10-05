/**
 * InkslaughtMode - Single-Player Endless Arcade Drawing Defense Engine
 * Implements:
 * 1. $1 Unistroke Gesture Recognizer natively in vanilla JavaScript
 *    Core dictionary: Vertical Line, Horizontal Line, V-Shape, Caret (^), Circle, Lightning Bolt, Star, Ampersand
 * 2. Dedicated Left Margin Grimoire & Skill Pad (4-Rune Inscription Combos)
 * 3. 3-Spell Loadout Selection & Ink EXP Progression (Tiers 1-3)
 * 4. Game Entities & Horizontal Physics Loop (Enemy class with requestAnimationFrame)
 * 5. Margin Bastion Barrier Defenses (Level 1/2: 15s duration; Level 3: Permanent with up to 3 stacks)
 * 6. Difficulty Scaling in strict 45-second intervals (Phases 1-4)
 * 7. Comic Book Aesthetic with Hard Drop Shadows & Dynamic Feedback
 */

(function(global) {
  'use strict';

  // =========================================================================
  // 1. Gesture Recognition Engine ($1 Unistroke Recognizer + Heuristics)
  // =========================================================================

  class DollarRecognizer {
    constructor() {
      this.numPoints = 64;
      this.squareSize = 250.0;
      this.templates = [];
      this.initTemplates();
    }

    /**
     * Initializes canonical template shapes for gestures:
     * Vertical Line, Horizontal Line, V-Shape, Caret, Circle, Lightning Bolt, Star, Ampersand
     */
    initTemplates() {
      // 1. Vertical Line (drawn downward: top to bottom)
      const vertPoints = [];
      for (let i = 0; i <= 20; i++) {
        vertPoints.push({ x: 125, y: 25 + (i / 20) * 200 });
      }
      this.addTemplate('Vertical Line', vertPoints);

      // 2. Horizontal Line (drawn left to right)
      const horizPoints = [];
      for (let i = 0; i <= 20; i++) {
        horizPoints.push({ x: 25 + (i / 20) * 200, y: 125 });
      }
      this.addTemplate('Horizontal Line', horizPoints);

      // 3. V-Shape (down-right to vertex, then up-right)
      const vPoints = [];
      for (let i = 0; i <= 10; i++) {
        vPoints.push({ x: 30 + (i / 10) * 95, y: 40 + (i / 10) * 170 });
      }
      for (let i = 1; i <= 10; i++) {
        vPoints.push({ x: 125 + (i / 10) * 95, y: 210 - (i / 10) * 170 });
      }
      this.addTemplate('V-Shape', vPoints);

      // 4. Caret (^) (up-right to apex, then down-right)
      const caretPoints = [];
      for (let i = 0; i <= 10; i++) {
        caretPoints.push({ x: 30 + (i / 10) * 95, y: 210 - (i / 10) * 170 });
      }
      for (let i = 1; i <= 10; i++) {
        caretPoints.push({ x: 125 + (i / 10) * 95, y: 40 + (i / 10) * 170 });
      }
      this.addTemplate('Caret', caretPoints);

      // 5. Circle (closed loop starting from top sweeping clockwise)
      const circlePoints = [];
      const numC = 36;
      for (let i = 0; i <= numC; i++) {
        const angle = -Math.PI / 2 + (i / numC) * 2 * Math.PI;
        circlePoints.push({
          x: 125 + 95 * Math.cos(angle),
          y: 125 + 95 * Math.sin(angle)
        });
      }
      this.addTemplate('Circle', circlePoints);

      // 6. Lightning Bolt (zig-zag: down-left, right, down-left)
      const boltPoints = [];
      for (let i = 0; i <= 8; i++) {
        boltPoints.push({ x: 170 - (i / 8) * 110, y: 25 + (i / 8) * 85 });
      }
      for (let i = 1; i <= 6; i++) {
        boltPoints.push({ x: 60 + (i / 6) * 110, y: 110 });
      }
      for (let i = 1; i <= 8; i++) {
        boltPoints.push({ x: 170 - (i / 8) * 115, y: 110 + (i / 8) * 115 });
      }
      this.addTemplate('Lightning Bolt', boltPoints);

      // 7. Star (5-Pointed Continuous Unistroke Pentagram)
      const cx = 125, cy = 125, r = 95;
      const starAngles = [
        -Math.PI / 2,                         // Apex
        -Math.PI / 2 + (4 * Math.PI) / 5,     // Bottom-Right
        -Math.PI / 2 + (8 * Math.PI) / 5,     // Top-Left
        -Math.PI / 2 + (2 * Math.PI) / 5,     // Top-Right
        -Math.PI / 2 + (6 * Math.PI) / 5,     // Bottom-Left
        -Math.PI / 2                          // Apex
      ];
      const starPoints = [];
      for (let seg = 0; seg < 5; seg++) {
        const a1 = starAngles[seg];
        const a2 = starAngles[seg + 1];
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        const steps = 8;
        for (let s = (seg === 0 ? 0 : 1); s <= steps; s++) {
          const t = s / steps;
          starPoints.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
        }
      }
      this.addTemplate('Star', starPoints);

      // 8. Ampersand (&) (Continuous unistroke loop and tail)
      const ampersandSpline = [
        { x: 185, y: 215 },
        { x: 130, y: 180 },
        { x: 80, y: 135 },
        { x: 95, y: 80 },
        { x: 125, y: 45 },
        { x: 155, y: 80 },
        { x: 140, y: 120 },
        { x: 90, y: 155 },
        { x: 60, y: 190 },
        { x: 110, y: 220 },
        { x: 165, y: 215 },
        { x: 195, y: 185 }
      ];
      const ampersandPoints = [];
      for (let i = 0; i < ampersandSpline.length - 1; i++) {
        const p1 = ampersandSpline[i];
        const p2 = ampersandSpline[i + 1];
        const steps = 4;
        for (let s = (i === 0 ? 0 : 1); s <= steps; s++) {
          const t = s / steps;
          ampersandPoints.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
        }
      }
      this.addTemplate('Ampersand', ampersandPoints);
    }

    addTemplate(name, points) {
      const resampled = this.resample(points, this.numPoints);
      const scaled = this.scale(resampled, this.squareSize);
      const translated = this.translateToOrigin(scaled);
      this.templates.push({
        name: name,
        points: translated,
        rawPoints: points
      });
    }

    resample(points, n) {
      if (!points || points.length === 0) return [];
      if (points.length === 1) {
        const out = [];
        for (let i = 0; i < n; i++) out.push({ x: points[0].x, y: points[0].y });
        return out;
      }

      const I = this.pathLength(points) / (n - 1);
      let D = 0.0;
      const newPoints = [{ x: points[0].x, y: points[0].y }];
      const pts = points.slice();

      for (let i = 1; i < pts.length; i++) {
        const d = this.distance(pts[i - 1], pts[i]);
        if (D + d >= I) {
          const qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
          const qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
          const q = { x: qx, y: qy };
          newPoints.push(q);
          pts.splice(i, 0, q);
          D = 0.0;
        } else {
          D += d;
        }
      }

      while (newPoints.length < n) {
        newPoints.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
      }
      if (newPoints.length > n) {
        newPoints.length = n;
      }
      return newPoints;
    }

    pathLength(points) {
      let d = 0.0;
      for (let i = 1; i < points.length; i++) {
        d += this.distance(points[i - 1], points[i]);
      }
      return d;
    }

    distance(p1, p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    boundingBox(points) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < points.length; i++) {
        minX = Math.min(minX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxX = Math.max(maxX, points[i].x);
        maxY = Math.max(maxY, points[i].y);
      }
      return {
        x: minX,
        y: minY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1)
      };
    }

    scale(points, size) {
      const box = this.boundingBox(points);
      const is1D = (box.width / box.height < 0.25) || (box.height / box.width < 0.25);
      const newPoints = [];

      for (let i = 0; i < points.length; i++) {
        let qx, qy;
        if (is1D) {
          const maxDim = Math.max(box.width, box.height);
          qx = ((points[i].x - box.x) / maxDim) * size;
          qy = ((points[i].y - box.y) / maxDim) * size;
        } else {
          qx = ((points[i].x - box.x) / box.width) * size;
          qy = ((points[i].y - box.y) / box.height) * size;
        }
        newPoints.push({ x: qx, y: qy });
      }
      return newPoints;
    }

    centroid(points) {
      let x = 0.0, y = 0.0;
      for (let i = 0; i < points.length; i++) {
        x += points[i].x;
        y += points[i].y;
      }
      return { x: x / points.length, y: y / points.length };
    }

    translateToOrigin(points) {
      const c = this.centroid(points);
      const newPoints = [];
      for (let i = 0; i < points.length; i++) {
        newPoints.push({
          x: points[i].x - c.x,
          y: points[i].y - c.y
        });
      }
      return newPoints;
    }

    pathDistance(pts1, pts2) {
      let d = 0.0;
      const n = Math.min(pts1.length, pts2.length);
      for (let i = 0; i < n; i++) {
        d += this.distance(pts1[i], pts2[i]);
      }
      return d / n;
    }

    recognize(rawPoints) {
      if (!rawPoints || rawPoints.length < 5) return null;

      const totalLen = this.pathLength(rawPoints);
      if (totalLen < 25) return null;

      const box = this.boundingBox(rawPoints);
      const startPt = rawPoints[0];
      const endPt = rawPoints[rawPoints.length - 1];
      const startEndDist = this.distance(startPt, endPt);
      const aspectHW = box.height / box.width;
      const aspectWH = box.width / box.height;

      const isClosedLoop = (startEndDist / totalLen < 0.32) &&
                           (box.width > 22 && box.height > 22) &&
                           (aspectHW > 0.55 && aspectHW < 1.8);

      const isVerticalDominant = (aspectHW > 2.2) && (box.width < 50 || aspectHW > 2.8);
      const isHorizontalDominant = (aspectWH > 2.2) && (box.height < 50 || aspectWH > 2.8);

      const resampled = this.resample(rawPoints, this.numPoints);
      const scaled = this.scale(resampled, this.squareSize);
      const translated = this.translateToOrigin(scaled);
      const reversed = translated.slice().reverse();

      let bestDistance = Infinity;
      let bestTemplate = null;

      for (let i = 0; i < this.templates.length; i++) {
        const tmpl = this.templates[i];

        const dForward = this.pathDistance(translated, tmpl.points);
        const dReverse = this.pathDistance(reversed, tmpl.points);
        let d = Math.min(dForward, dReverse);

        // Apply heuristic weights
        if (tmpl.name === 'Circle') {
          let bestCircleDist = Infinity;
          for (let shift = 0; shift < this.numPoints; shift += 8) {
            const shifted = translated.slice(shift).concat(translated.slice(0, shift));
            const shiftedRev = reversed.slice(shift).concat(reversed.slice(0, shift));
            const dF = this.pathDistance(shifted, tmpl.points);
            const dR = this.pathDistance(shiftedRev, tmpl.points);
            bestCircleDist = Math.min(bestCircleDist, dF, dR);
          }
          d = bestCircleDist;
          if (isClosedLoop) d *= 0.55;
          else d *= 1.45;
        } else if (tmpl.name === 'Vertical Line') {
          if (isVerticalDominant) d *= 0.45;
          if (isHorizontalDominant || isClosedLoop) d *= 2.5;
        } else if (tmpl.name === 'Horizontal Line') {
          if (isHorizontalDominant) d *= 0.45;
          if (isVerticalDominant || isClosedLoop) d *= 2.5;
        } else if (tmpl.name === 'V-Shape') {
          const midY = translated[Math.floor(this.numPoints / 2)].y;
          const endsY = (translated[0].y + translated[this.numPoints - 1].y) / 2;
          if (midY > endsY + 15) d *= 0.7;
          else d *= 1.5;
        } else if (tmpl.name === 'Caret') {
          const midY = translated[Math.floor(this.numPoints / 2)].y;
          const endsY = (translated[0].y + translated[this.numPoints - 1].y) / 2;
          if (midY < endsY - 15) d *= 0.7;
          else d *= 1.5;
        } else if (tmpl.name === 'Lightning Bolt') {
          let reversals = 0;
          for (let p = 2; p < resampled.length; p++) {
            const dx1 = resampled[p - 1].x - resampled[p - 2].x;
            const dx2 = resampled[p].x - resampled[p - 1].x;
            if (dx1 * dx2 < -10) reversals++;
          }
          if (reversals >= 1) d *= 0.75;
        } else if (tmpl.name === 'Star') {
          if (startEndDist < box.width * 0.45 && box.width > 25 && box.height > 25) {
            d *= 0.75;
          }
        } else if (tmpl.name === 'Ampersand') {
          if (box.height > box.width * 0.85 && box.height > 30) {
            d *= 0.8;
          }
        }

        if (d < bestDistance) {
          bestDistance = d;
          bestTemplate = tmpl;
        }
      }

      if (!bestTemplate) return null;

      const halfDiagonal = 0.5 * Math.sqrt(this.squareSize * this.squareSize * 2);
      const score = Math.max(0, 1.0 - (bestDistance / halfDiagonal));

      if (score >= 0.55) {
        return {
          name: bestTemplate.name,
          score: score
        };
      }

      return null;
    }
  }

  // =========================================================================
  // 2. Visual Configurations & Spell Grimoire Definitions
  // =========================================================================

  // Symbol visual configuration (Comic Sticker & Post-it Aesthetic)
  const SYMBOL_META = {
    'Vertical Line': { icon: '|', label: 'Slash', color: '#000000', badgeBg: '#FEF08A' },
    'Horizontal Line': { icon: '—', label: 'Dash', color: '#000000', badgeBg: '#BAE6FD' },
    'V-Shape': { icon: 'V', label: 'Vee', color: '#000000', badgeBg: '#DDD6FE' },
    'Caret': { icon: '^', label: 'Caret', color: '#000000', badgeBg: '#BBF7D0' },
    'Circle': { icon: '○', label: 'Loop', color: '#000000', badgeBg: '#FECDD3' },
    'Lightning Bolt': { icon: '⚡', label: 'Bolt', color: '#000000', badgeBg: '#FDE047' },
    'Star': { icon: '★', label: 'Star', color: '#000000', badgeBg: '#F472B6' },
    'Ampersand': { icon: '&', label: 'Ampersand', color: '#000000', badgeBg: '#C084FC' }
  };

  // Arcane Spells & Runic Inscription Formulas (4 Gestures Each)
  const SPELL_DEFS = {
    clean_slate: {
      id: 'clean_slate',
      name: 'Clean Slate',
      icon: '🧹',
      desc: 'Wipes the page clean of ink fiends',
      runes: ['Horizontal Line', 'Vertical Line', 'Circle', 'Ampersand'],
      runeIcons: ['—', '|', '○', '&'],
      cooldown: 36,
      levels: [
        { tier: 1, desc: 'Erases all 1-symbol minions & strips 1 symbol from Tanks.' },
        { tier: 2, desc: 'Erases all minions, strips 2 symbols from Tanks, & pushes them back 160px.' },
        { tier: 3, desc: 'Total Page Erase! Erases all minions, Tanks lose 3 symbols + 500 bonus score.' }
      ]
    },
    freeze_frame: {
      id: 'freeze_frame',
      name: 'Freeze Frame',
      icon: '❄️',
      desc: 'Halts time and freezes enemy advance',
      runes: ['Vertical Line', 'Vertical Line', 'Caret', 'Star'],
      runeIcons: ['|', '|', '^', '★'],
      cooldown: 25,
      levels: [
        { tier: 1, desc: 'Freezes all enemies for 4.5s. Slashing grants 2x score.' },
        { tier: 2, desc: 'Freezes all enemies for 7.0s. Defeated enemies explode into shrapnel.' },
        { tier: 3, desc: 'Freezes for 8.5s. New spawns move at 40% speed for 6s after thaw.' }
      ]
    },
    margin_bastion: {
      id: 'margin_bastion',
      name: 'Margin Bastion',
      icon: '🛡️',
      desc: 'Fortifies the margin with defensive barriers',
      runes: ['Caret', 'V-Shape', 'Caret', 'Ampersand'],
      runeIcons: ['^', 'V', '^', '&'],
      cooldown: 30,
      levels: [
        { tier: 1, desc: '15s Barrier: Absorbs 1 breach attempt & repels invaders 170px.' },
        { tier: 2, desc: '15s Barrier: Absorbs up to 2 breach attempts & zaps attackers on contact.' },
        { tier: 3, desc: 'Permanent Barrier! Absorbs 2 attempts & stacks up to 3 concurrent barriers.' }
      ]
    },
    vortex_well: {
      id: 'vortex_well',
      name: 'Vortex Well',
      icon: '🌀',
      desc: 'Creates an ink singularity at center stage',
      runes: ['Circle', 'Circle', 'Lightning Bolt', 'Star'],
      runeIcons: ['○', '○', '⚡', '★'],
      cooldown: 28,
      levels: [
        { tier: 1, desc: '5s Vortex pulls all enemies toward canvas center.' },
        { tier: 2, desc: '7s Vortex continuously strips 1 symbol from caught enemies.' },
        { tier: 3, desc: 'Collapses in a huge KABOOM, destroying all caught minions with 2x score.' }
      ]
    },
    comic_storm: {
      id: 'comic_storm',
      name: 'Comic Storm',
      icon: '⚡',
      desc: 'Calls down chain lightning across the page',
      runes: ['Lightning Bolt', 'Lightning Bolt', 'V-Shape', 'Star'],
      runeIcons: ['⚡', '⚡', 'V', '★'],
      cooldown: 22,
      levels: [
        { tier: 1, desc: 'Arcs lightning to 4 closest enemies, erasing 1 symbol each.' },
        { tier: 2, desc: 'Arcs to 7 enemies, erasing 1 symbol & stunning them for 2.5s.' },
        { tier: 3, desc: 'Arcs to 10 enemies, triggering chain reaction blasts on all Tanks.' }
      ]
    }
  };

  // =========================================================================
  // 3. Enemy Entity Class
  // =========================================================================

  class Enemy {
    constructor(options = {}) {
      this.isTank = options.isTank || false;
      this.symbolArray = [...(options.symbolArray || ['Vertical Line'])];
      this.initialSymbolCount = this.symbolArray.length;

      this.width = this.isTank ? 78 : 52;
      this.height = this.isTank ? 78 : 52;

      this.x = options.x !== undefined ? options.x : (options.canvasWidth || 1200);

      const topBound = 110;
      const bottomBound = (options.canvasHeight || 800) - 130 - this.height;
      this.y = options.y !== undefined ? options.y : (topBound + Math.random() * (bottomBound - topBound));

      this.speed = options.speed || (this.isTank ? 1.0 : 1.4);

      this.hitFlashTimer = 0;
      this.stunTimer = 0;
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.isDead = false;
    }

    update(dtFactor = 1.0) {
      if (this.stunTimer > 0) {
        this.stunTimer -= 0.016 * dtFactor;
        return;
      }

      this.x -= this.speed * dtFactor;
      this.wobblePhase += 0.05 * dtFactor;

      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer -= 1 * dtFactor;
      }
    }

    render(ctx) {
      if (this.isDead) return;

      ctx.save();

      const wobble = Math.sin(this.wobblePhase) * 3;
      const drawX = this.x;
      const drawY = this.y + wobble;
      const cx = drawX + this.width / 2;
      const cy = drawY + this.height / 2;

      // 1. Comic Ground Contact Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, drawY + this.height + 4, this.width * 0.44, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Trailing Comic Action Speed Dashes
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const trailX = cx + this.width * 0.44;
      ctx.beginPath();
      ctx.moveTo(trailX + 6, cy - 8);
      ctx.lineTo(trailX + 18 + Math.sin(this.wobblePhase * 2) * 5, cy - 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(trailX + 10, cy + 8);
      ctx.lineTo(trailX + 22 + Math.cos(this.wobblePhase * 2) * 5, cy + 8);
      ctx.stroke();
      ctx.restore();

      // 3. Stun stars if stunned
      if (this.stunTimer > 0) {
        ctx.save();
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫', cx + Math.sin(Date.now() * 0.01) * 12, drawY - 20);
        ctx.restore();
      }

      // 4. Enemy Body
      const isHit = (this.hitFlashTimer > 0);
      const bodyColor = isHit ? '#EF4444' : '#000000';

      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';

      if (!this.isTank) {
        // Comic Inkling Minion
        ctx.beginPath();
        const r = this.width * 0.46;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Droplet tail
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.6, cy - r * 0.6);
        ctx.quadraticCurveTo(cx + r * 1.3, cy - r * 1.3, cx + r * 0.3, cy - r * 0.8);
        ctx.fill();
        ctx.stroke();

        // Comic Googly Eyes
        const eyeOffsetX = 7;
        const eyeOffsetY = -4;
        const eyeR = 6.5;

        // Left Eye
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX, cy + eyeOffsetY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx - eyeOffsetX - 2, cy + eyeOffsetY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Right Eye
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx + eyeOffsetX, cy + eyeOffsetY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx + eyeOffsetX - 2, cy + eyeOffsetY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Furrowed Angry Comic Brow
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - eyeOffsetX - 7, cy + eyeOffsetY - 7);
        ctx.lineTo(cx - 1, cy + eyeOffsetY - 4);
        ctx.lineTo(cx + eyeOffsetX + 7, cy + eyeOffsetY - 7);
        ctx.stroke();

        // Sharp snarling comic grin
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 9);
        ctx.lineTo(cx - 5, cy + 14);
        ctx.lineTo(cx, cy + 10);
        ctx.lineTo(cx + 5, cy + 14);
        ctx.lineTo(cx + 10, cy + 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Armored Comic Juggernaut Tank
        const hw = this.width / 2;
        const hh = this.height / 2;

        ctx.beginPath();
        ctx.roundRect(cx - hw, cy - hh, this.width, this.height, 12);
        ctx.fill();
        ctx.stroke();

        // Steel Armor Plates
        ctx.strokeStyle = isHit ? '#FEF08A' : '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - hw + 8, cy - hh + 8, this.width - 16, this.height - 16);

        // Armor Corner Rivets
        const rivets = [
          { rx: cx - hw + 12, ry: cy - hh + 12 },
          { rx: cx + hw - 12, ry: cy - hh + 12 },
          { rx: cx - hw + 12, ry: cy + hh - 12 },
          { rx: cx + hw - 12, ry: cy + hh - 12 }
        ];
        rivets.forEach(rv => {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(rv.rx, rv.ry, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        // Twin Curved Spiked Horns
        ctx.fillStyle = isHit ? '#EF4444' : '#000000';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - hw + 6, cy - hh + 4);
        ctx.quadraticCurveTo(cx - hw - 14, cy - hh - 16, cx - hw + 18, cy - hh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + hw - 6, cy - hh + 4);
        ctx.quadraticCurveTo(cx + hw + 14, cy - hh - 16, cx + hw - 18, cy - hh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing Visor / Angry Eye Slit
        ctx.fillStyle = isHit ? '#FFFFFF' : '#EF4444';
        ctx.beginPath();
        ctx.roundRect(cx - 18, cy - 8, 36, 12, 4);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - 10, cy - 6, 8, 8);
        ctx.fillRect(cx + 2, cy - 6, 8, 8);
      }

      ctx.restore();

      // 5. Render Required Symbol Post-it Pills
      this.renderSymbolBadges(ctx);
    }

    renderSymbolBadges(ctx) {
      if (this.symbolArray.length === 0) return;

      const basePillWidth = 28;
      const pillHeight = 28;
      const spacing = 6;
      const totalWidth = this.symbolArray.length * basePillWidth + (this.symbolArray.length - 1) * spacing + 6;
      const centerX = this.x + this.width / 2;
      const topY = this.y - 10;
      let startX = centerX - totalWidth / 2;

      for (let i = 0; i < this.symbolArray.length; i++) {
        const symName = this.symbolArray[i];
        const meta = SYMBOL_META[symName] || { icon: '?', color: '#000', badgeBg: '#FEF08A' };
        const isActive = (i === 0);
        const pW = isActive ? basePillWidth + 6 : basePillWidth;
        const pH = isActive ? pillHeight + 5 : pillHeight;
        const pY = isActive ? topY - pH - 4 : topY - pH;

        ctx.save();

        const shadowOffset = isActive ? 3.5 : 2.5;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(startX + shadowOffset, pY + shadowOffset, pW, pH, 6);
        ctx.fill();

        ctx.fillStyle = isActive ? meta.badgeBg : '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = isActive ? 3 : 2.2;
        ctx.beginPath();
        ctx.roundRect(startX, pY, pW, pH, 6);
        ctx.fill();
        ctx.stroke();

        if (isActive) {
          ctx.fillStyle = meta.badgeBg;
          ctx.beginPath();
          ctx.moveTo(startX + pW / 2 - 4, pY + pH);
          ctx.lineTo(startX + pW / 2, pY + pH + 5);
          ctx.lineTo(startX + pW / 2 + 4, pY + pH);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.fillStyle = '#000000';
        ctx.font = isActive ? '900 16px "Fredoka", "Bangers", sans-serif' : '800 13px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.icon, startX + pW / 2, pY + pH / 2 + 1);

        ctx.restore();
        startX += pW + spacing;
      }
    }
  }

  // =========================================================================
  // 4. Inkslaught Arcade Game Engine & Spellbook System
  // =========================================================================

  class InkslaughtGame {
    constructor() {
      this.view = null;
      this.canvas = null;
      this.ctx = null;
      this.modalOverlay = null;

      this.timeDisplay = null;
      this.phaseDisplay = null;
      this.scoreDisplay = null;
      this.highScoreDisplay = null;
      this.expDisplay = null;
      this.soundIcon = null;

      this.grimoireSidebar = null;
      this.grimoireSpellsList = null;
      this.grimoireSequenceSlots = null;
      this.skillCanvas = null;
      this.skillCtx = null;
      this.loadoutModal = null;
      this.levelUpModal = null;

      this.recognizer = new DollarRecognizer();

      this.CANVAS_WIDTH = 1200;
      this.CANVAS_HEIGHT = 800;
      this.WALL_X = 50;

      this.isRunning = false;
      this.isGameOver = false;
      this.isPaused = false;
      this.score = 0;
      this.highScore = 0;
      this.survivalTime = 0.0;
      this.enemiesSlain = 0;
      this.currentPhase = 1;

      this.equippedSpells = ['clean_slate', 'freeze_frame', 'margin_bastion'];
      this.selectedLoadoutSpells = new Set(['clean_slate', 'freeze_frame', 'margin_bastion']);
      this.spellLevels = {
        clean_slate: 1,
        freeze_frame: 1,
        margin_bastion: 1,
        vortex_well: 1,
        comic_storm: 1
      };
      this.spellCooldowns = {
        clean_slate: 0,
        freeze_frame: 0,
        margin_bastion: 0,
        vortex_well: 0,
        comic_storm: 0
      };
      this.activeRuneSequence = [];

      this.barriers = [];
      this.freezeTimer = 0;
      this.chillTimer = 0;
      this.vortex = {
        active: false,
        duration: 0,
        tier: 1,
        x: 680,
        y: 400,
        radius: 180,
        pulseTimer: 0
      };

      this.inkExp = 0;
      this.expLevel = 1;
      this.expToNext = 100;

      this.enemies = [];
      this.spawnTimer = 0.0;
      this.nextSpawnInterval = 2500;

      this.particles = [];
      this.floatingTexts = [];
      this.screenFlash = 0;

      this.isDrawing = false;
      this.currentStrokePoints = [];
      this.strokeWidth = 6;

      this.isSkillDrawing = false;
      this.skillStrokePoints = [];

      this.animFrameId = null;
      this.lastTimestamp = 0;

      this.isMuted = false;
    }

    init() {
      this.view = document.getElementById('inkslaughtModeView');
      this.canvas = document.getElementById('inkslaughtCanvas');
      if (!this.view || !this.canvas) {
        console.warn('[Inkslaught] Required DOM elements not found.');
        return;
      }

      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = this.CANVAS_WIDTH;
      this.canvas.height = this.CANVAS_HEIGHT;

      this.timeDisplay = document.getElementById('inkslaughtTimeDisplay');
      this.phaseDisplay = document.getElementById('inkslaughtPhaseDisplay');
      this.scoreDisplay = document.getElementById('inkslaughtScoreDisplay');
      this.highScoreDisplay = document.getElementById('inkslaughtHighScoreDisplay');
      this.expDisplay = document.getElementById('inkslaughtExpDisplay');
      this.modalOverlay = document.getElementById('inkslaughtGameOverModal');
      this.soundIcon = document.getElementById('inkslaughtSoundIcon');

      this.grimoireSidebar = document.getElementById('inkslaughtGrimoireSidebar');
      this.grimoireSpellsList = document.getElementById('grimoireSpellsList');
      this.grimoireSequenceSlots = document.getElementById('grimoireSequenceSlots');
      this.skillCanvas = document.getElementById('inkslaughtSkillCanvas');
      this.loadoutModal = document.getElementById('inkslaughtLoadoutModal');
      this.levelUpModal = document.getElementById('inkslaughtLevelUpModal');

      if (this.skillCanvas) {
        this.skillCtx = this.skillCanvas.getContext('2d');
        this.skillCanvas.width = 220;
        this.skillCanvas.height = 150;
      }

      this.loadHighScore();
      this.bindEvents();
      this.bindSkillCanvasEvents();

      console.log('⚔️ Inkslaught Arcade Game Engine with Grimoire & Skill Canvas initialized.');
    }

    loadHighScore() {
      try {
        const saved = localStorage.getItem('transcribble_inkslaught_high');
        this.highScore = saved ? parseInt(saved, 10) : 0;
        if (this.highScoreDisplay) {
          this.highScoreDisplay.textContent = 'High: ' + this.highScore;
        }
      } catch (e) {
        this.highScore = 0;
      }
    }

    saveHighScore() {
      try {
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('transcribble_inkslaught_high', this.highScore.toString());
          if (this.highScoreDisplay) {
            this.highScoreDisplay.textContent = 'High: ' + this.highScore;
          }
          return true;
        }
      } catch (e) {}
      return false;
    }

    bindEvents() {
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      window.addEventListener('pointermove', (e) => this.onPointerMove(e));
      window.addEventListener('pointerup', (e) => this.onPointerUp(e));
      window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

      this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

      const btnExit = document.getElementById('btnInkslaughtExit');
      if (btnExit) btnExit.addEventListener('click', () => this.close());

      const logo = document.getElementById('inkslaughtLogo');
      if (logo) logo.addEventListener('click', () => this.close());

      const btnRestartTop = document.getElementById('btnInkslaughtRestartTop');
      if (btnRestartTop) btnRestartTop.addEventListener('click', () => this.restart());

      const btnRestartModal = document.getElementById('btnInkslaughtRestart');
      if (btnRestartModal) btnRestartModal.addEventListener('click', () => this.restart());

      const btnExitModal = document.getElementById('btnInkslaughtModalExit');
      if (btnExitModal) btnExitModal.addEventListener('click', () => this.close());

      const btnSound = document.getElementById('btnInkslaughtSound');
      if (btnSound) {
        btnSound.addEventListener('click', () => {
          this.isMuted = !this.isMuted;
          if (this.soundIcon) this.soundIcon.textContent = this.isMuted ? '🔇' : '🔊';
        });
      }
    }

    // =========================================================================
    // Skill Canvas & Runic Inscription Events
    // =========================================================================

    bindSkillCanvasEvents() {
      if (!this.skillCanvas) return;

      const getPos = (e) => {
        const rect = this.skillCanvas.getBoundingClientRect();
        const scaleX = this.skillCanvas.width / rect.width;
        const scaleY = this.skillCanvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
      };

      const start = (e) => {
        if (!this.isRunning || this.isGameOver || this.isPaused) return;
        this.isSkillDrawing = true;
        const pt = getPos(e);
        this.skillStrokePoints = [pt];
        const watermark = document.getElementById('skillPadWatermark');
        if (watermark) watermark.style.opacity = '0';
      };

      const move = (e) => {
        if (!this.isSkillDrawing || !this.isRunning || this.isGameOver || this.isPaused) return;
        const pt = getPos(e);
        this.skillStrokePoints.push(pt);
        this.renderLiveSkillStroke();
      };

      const end = () => {
        if (!this.isSkillDrawing) return;
        this.isSkillDrawing = false;

        if (this.skillStrokePoints.length >= 6) {
          const match = this.recognizer.recognize(this.skillStrokePoints);
          if (match) {
            this.onSkillRuneDrawn(match.name);
          } else {
            this.spawnSkillPadFizzle();
          }
        }

        setTimeout(() => {
          this.clearSkillPad();
        }, 140);
      };

      this.skillCanvas.addEventListener('pointerdown', start);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);

      this.skillCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      this.skillCanvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

      const btnClearSeq = document.getElementById('btnClearSequence');
      if (btnClearSeq) {
        btnClearSeq.addEventListener('click', () => {
          this.activeRuneSequence = [];
          this.updateSequenceUI();
          this.playCombatSound('miss');
        });
      }

      const btnSwap = document.getElementById('btnGrimoireSwapLoadout');
      if (btnSwap) {
        btnSwap.addEventListener('click', () => {
          this.openLoadoutModal(false);
        });
      }
    }

    renderLiveSkillStroke() {
      if (!this.skillCtx || this.skillStrokePoints.length < 2) return;
      const ctx = this.skillCtx;
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(this.skillStrokePoints[0].x, this.skillStrokePoints[0].y);
      for (let i = 1; i < this.skillStrokePoints.length; i++) {
        ctx.lineTo(this.skillStrokePoints[i].x, this.skillStrokePoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    clearSkillPad() {
      if (!this.skillCtx) return;
      this.skillCtx.clearRect(0, 0, this.skillCanvas.width, this.skillCanvas.height);
      this.skillStrokePoints = [];
      const watermark = document.getElementById('skillPadWatermark');
      if (watermark) watermark.style.opacity = '0.35';
    }

    spawnSkillPadFizzle() {
      if (!this.skillCtx) return;
      this.playCombatSound('miss');
      this.skillCtx.save();
      this.skillCtx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      this.skillCtx.fillRect(0, 0, this.skillCanvas.width, this.skillCanvas.height);
      this.skillCtx.restore();
    }

    onSkillRuneDrawn(runeName) {
      if (this.activeRuneSequence.length >= 4) return;

      this.activeRuneSequence.push(runeName);
      this.updateSequenceUI();
      this.playCombatSound('slash');

      if (this.activeRuneSequence.length === 4) {
        this.evaluateRunicSequence();
      }
    }

    updateSequenceUI() {
      for (let i = 0; i < 4; i++) {
        const slot = document.getElementById(`runeSlot${i}`);
        if (!slot) continue;
        if (i < this.activeRuneSequence.length) {
          const rune = this.activeRuneSequence[i];
          const meta = SYMBOL_META[rune] || { icon: '?', badgeBg: '#FEF08A' };
          slot.textContent = meta.icon;
          slot.className = 'rune-slot filled';
          slot.style.background = meta.badgeBg;
          slot.title = rune;
        } else {
          slot.textContent = '?';
          slot.className = 'rune-slot empty';
          slot.style.background = '';
          slot.title = 'Empty slot';
        }
      }
    }

    evaluateRunicSequence() {
      let matchedSpellId = null;
      for (const spellId of this.equippedSpells) {
        const def = SPELL_DEFS[spellId];
        if (!def) continue;
        const isMatch = def.runes.every((r, idx) => r === this.activeRuneSequence[idx]);
        if (isMatch) {
          matchedSpellId = spellId;
          break;
        }
      }

      const slots = document.getElementById('grimoireSequenceSlots');

      if (matchedSpellId) {
        const cd = this.spellCooldowns[matchedSpellId] || 0;
        if (cd <= 0) {
          this.castSpell(matchedSpellId);
          if (slots) slots.classList.add('cast-success');
          setTimeout(() => {
            if (slots) slots.classList.remove('cast-success');
            this.activeRuneSequence = [];
            this.updateSequenceUI();
          }, 350);
        } else {
          this.addFloatingText(`⏳ ${SPELL_DEFS[matchedSpellId].name} ON CD! (${Math.ceil(cd)}s)`, this.CANVAS_WIDTH * 0.3, 240, '#F59E0B', true);
          this.playCombatSound('miss');
          if (slots) slots.classList.add('cast-fail');
          setTimeout(() => {
            if (slots) slots.classList.remove('cast-fail');
            this.activeRuneSequence = [];
            this.updateSequenceUI();
          }, 450);
        }
      } else {
        this.addFloatingText('❌ UNKNOWN RUNIC FORMULA', this.CANVAS_WIDTH * 0.3, 240, '#EF4444', true);
        this.playCombatSound('miss');
        if (slots) slots.classList.add('cast-fail');
        setTimeout(() => {
          if (slots) slots.classList.remove('cast-fail');
          this.activeRuneSequence = [];
          this.updateSequenceUI();
        }, 450);
      }
    }

    // =========================================================================
    // Spell Execution Mechanics
    // =========================================================================

    castSpell(spellId) {
      const def = SPELL_DEFS[spellId];
      if (!def) return;
      const tier = this.spellLevels[spellId] || 1;

      this.spellCooldowns[spellId] = def.cooldown;
      this.playCombatSound('phase_up');
      this.addFloatingText(`🔮 ${def.name.toUpperCase()} (TIER ${tier})!`, this.CANVAS_WIDTH / 2, 180, '#FFE600', true);

      switch (spellId) {
        case 'clean_slate':
          this.executeCleanSlate(tier);
          break;
        case 'freeze_frame':
          this.executeFreezeFrame(tier);
          break;
        case 'margin_bastion':
          this.executeMarginBastion(tier);
          break;
        case 'vortex_well':
          this.executeVortexWell(tier);
          break;
        case 'comic_storm':
          this.executeComicStorm(tier);
          break;
      }

      this.renderGrimoireSpells();
    }

    executeCleanSlate(tier) {
      this.screenFlash = 0.85;
      this.playCombatSound('tank_kill');

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (enemy.isDead) continue;

        if (!enemy.isTank) {
          this.onEnemyDefeated(enemy, '#FFE600');
        } else {
          const stripCount = tier === 1 ? 1 : (tier === 2 ? 2 : 3);
          for (let s = 0; s < stripCount && enemy.symbolArray.length > 0; s++) {
            enemy.symbolArray.shift();
          }
          if (tier >= 2) {
            enemy.x = Math.min(this.CANVAS_WIDTH - 50, enemy.x + 160);
          }
          enemy.hitFlashTimer = 12;
          if (enemy.symbolArray.length === 0) {
            this.onEnemyDefeated(enemy, '#FFE600');
          } else {
            this.spawnHitSparks(enemy.x, enemy.y, '#FFE600');
          }
        }
      }

      if (tier >= 3) {
        this.score += 500;
        this.addFloatingText('+500 BONUS SCORE', this.CANVAS_WIDTH / 2, 230, '#FFE600', true);
      }
    }

    executeFreezeFrame(tier) {
      const durations = [4.5, 7.0, 8.5];
      this.freezeTimer = durations[tier - 1] || 4.5;
      this.playCombatSound('slash');
      this.addFloatingText('❄️ TIME FROZEN! 2x SCORE', this.CANVAS_WIDTH / 2, 220, '#38BDF8', true);

      for (let i = 0; i < 28; i++) {
        this.particles.push({
          type: 'spark',
          x: Math.random() * this.CANVAS_WIDTH,
          y: Math.random() * this.CANVAS_HEIGHT,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          color: '#38BDF8',
          size: 4 + Math.random() * 4,
          life: 1.0,
          decay: 0.02
        });
      }
    }

    executeMarginBastion(tier) {
      // Level 1: 15s duration, 1 hit, max 1 barrier
      // Level 2: 15s duration, 2 hits, max 2 barriers
      // Level 3: Permanent (Infinity), 2 hits, max 3 barriers
      const maxLimit = tier === 1 ? 1 : (tier === 2 ? 2 : 3);
      const hits = tier === 1 ? 1 : 2;
      const duration = tier === 3 ? Infinity : 15.0;
      const isPermanent = (tier === 3);

      if (this.barriers.length >= maxLimit) {
        this.barriers[0].hitsRemaining = hits;
        this.barriers[0].duration = duration;
        this.barriers[0].isPermanent = isPermanent;
        this.barriers[0].tier = tier;
        this.addFloatingText('🛡️ BASTION REINFORCED!', this.WALL_X + 60, this.CANVAS_HEIGHT / 2, '#38BDF8', true);
      } else {
        this.barriers.push({
          hitsRemaining: hits,
          maxHits: hits,
          duration: duration,
          isPermanent: isPermanent,
          tier: tier,
          pulse: 0
        });
        this.addFloatingText(`🛡️ BASTION DEPLOYED [${this.barriers.length}/${maxLimit}]!`, this.WALL_X + 60, this.CANVAS_HEIGHT / 2, '#38BDF8', true);
      }
      this.playCombatSound('tank_kill');
    }

    executeVortexWell(tier) {
      this.vortex.active = true;
      this.vortex.duration = tier === 1 ? 5.0 : 7.0;
      this.vortex.tier = tier;
      this.vortex.x = this.CANVAS_WIDTH * 0.55;
      this.vortex.y = this.CANVAS_HEIGHT * 0.5;
      this.vortex.pulseTimer = 0;
      this.playCombatSound('slash');
      this.addFloatingText('🌀 INK SINGULARITY OPENED!', this.vortex.x, this.vortex.y - 50, '#C084FC', true);
    }

    executeComicStorm(tier) {
      const targetCounts = [4, 7, 10];
      const count = targetCounts[tier - 1] || 4;

      const aliveEnemies = this.enemies.filter(e => !e.isDead);
      aliveEnemies.sort((a, b) => a.x - b.x);
      const targets = aliveEnemies.slice(0, count);

      if (targets.length === 0) {
        this.addFloatingText('⚡ LIGHTNING STRIKES THE SKY!', this.CANVAS_WIDTH / 2, 200, '#FDE047', true);
        return;
      }

      this.playCombatSound('tank_kill');

      let lastX = this.CANVAS_WIDTH / 2;
      let lastY = 0;

      targets.forEach(target => {
        const tx = target.x + target.width / 2;
        const ty = target.y + target.height / 2;

        this.spawnSlashBeam(lastX, lastY, tx, ty, '#FDE047');
        lastX = tx;
        lastY = ty;

        target.hitFlashTimer = 10;
        if (tier >= 2) {
          target.stunTimer = 2.5;
        }

        if (target.symbolArray.length > 1) {
          target.symbolArray.shift();
          this.spawnHitSparks(tx, ty, '#FDE047');
        } else {
          this.onEnemyDefeated(target, '#FDE047');
        }

        if (tier >= 3 && target.isTank) {
          this.spawnDeathExplosion(tx, ty, '#FDE047', false);
          this.enemies.forEach(other => {
            if (other !== target && !other.isDead) {
              const d = Math.hypot(other.x - tx, other.y - ty);
              if (d < 140) {
                if (other.symbolArray.length > 1) other.symbolArray.shift();
                else this.onEnemyDefeated(other, '#FDE047');
              }
            }
          });
        }
      });
    }

    // =========================================================================
    // Grimoire UI & Loadout / Level-Up Modals
    // =========================================================================

    renderGrimoireSpells() {
      if (!this.grimoireSpellsList) return;
      this.grimoireSpellsList.innerHTML = '';

      this.equippedSpells.forEach(spellId => {
        const def = SPELL_DEFS[spellId];
        if (!def) return;

        const tier = this.spellLevels[spellId] || 1;
        const currentTierDesc = def.levels[tier - 1]?.desc || def.desc;
        const cd = this.spellCooldowns[spellId] || 0;
        const isOnCd = cd > 0;

        const card = document.createElement('div');
        card.className = `grimoire-spell-card ${isOnCd ? 'on-cooldown' : ''}`;
        card.id = `grimoireCard_${spellId}`;

        const runesHTML = def.runes.map((r) => {
          const m = SYMBOL_META[r] || { icon: '?', badgeBg: '#FEF08A' };
          return `<div class="spell-rune-badge" style="background:${m.badgeBg};" title="${r}">${m.icon}</div>`;
        }).join('');

        card.innerHTML = `
          <div class="spell-card-header">
            <div class="spell-card-title-group">
              <span class="spell-card-icon">${def.icon}</span>
              <span class="spell-card-name">${def.name}</span>
            </div>
            <div class="spell-card-badges-wrap">
              <span class="spell-card-tier">Tier ${tier}</span>
              <span class="spell-card-cd-tag">${Math.round(def.cooldown)}s CD</span>
            </div>
          </div>
          <div class="spell-card-runes">${runesHTML}</div>
          <div class="spell-card-effect-preview">${currentTierDesc}</div>
          <div class="spell-card-cd-overlay ${isOnCd ? 'active' : ''}" id="spellCdOverlay_${spellId}">
            <span class="cd-timer-text">${isOnCd ? Math.ceil(cd) + 's' : ''}</span>
          </div>
        `;

        this.grimoireSpellsList.appendChild(card);
      });
    }

    updateGrimoireCooldownsUI() {
      this.equippedSpells.forEach(spellId => {
        const cd = this.spellCooldowns[spellId] || 0;
        const card = document.getElementById(`grimoireCard_${spellId}`);
        const overlay = document.getElementById(`spellCdOverlay_${spellId}`);
        if (card && overlay) {
          const timerEl = overlay.querySelector('.cd-timer-text');
          if (cd > 0) {
            card.classList.add('on-cooldown');
            overlay.classList.add('active');
            if (timerEl) timerEl.textContent = `${Math.ceil(cd)}s`;
          } else {
            card.classList.remove('on-cooldown');
            overlay.classList.remove('active');
            if (timerEl) timerEl.textContent = '';
          }
        }
      });
    }

    openLoadoutModal(isStart = false) {
      if (this.isRunning && !this.isGameOver) {
        this.isPaused = true;
      }

      if (!this.loadoutModal) return;
      const grid = document.getElementById('loadoutSpellsGrid');
      const countText = document.getElementById('loadoutCountText');
      const btnConfirm = document.getElementById('btnConfirmLoadout');

      if (!grid) return;
      grid.innerHTML = '';

      const updateCountUI = () => {
        const count = this.selectedLoadoutSpells.size;
        if (countText) countText.textContent = `Selected: ${count} of 3 Spells`;
        if (btnConfirm) {
          btnConfirm.disabled = (count !== 3);
          btnConfirm.style.opacity = (count === 3) ? '1' : '0.5';
          btnConfirm.style.cursor = (count === 3) ? 'pointer' : 'not-allowed';
        }
      };

      Object.values(SPELL_DEFS).forEach(def => {
        const isSelected = this.selectedLoadoutSpells.has(def.id);
        const card = document.createElement('div');
        card.className = `loadout-spell-item ${isSelected ? 'selected' : ''}`;
        card.dataset.spellId = def.id;

        const runesHTML = def.runes.map((r) => {
          const m = SYMBOL_META[r] || { icon: '?', badgeBg: '#FEF08A' };
          return `<span class="loadout-rune-pill" style="background:${m.badgeBg};" title="${r}">${m.icon}</span>`;
        }).join('');

        card.innerHTML = `
          <div class="loadout-spell-top">
            <span class="loadout-spell-icon">${def.icon}</span>
            <div class="loadout-spell-title-wrap">
              <span class="loadout-spell-name">${def.name}</span>
              <span class="loadout-cd-badge">⏳ ${def.cooldown}s CD</span>
            </div>
            <span class="loadout-check-indicator">${isSelected ? '✅' : '⚪'}</span>
          </div>
          <p class="loadout-spell-desc">${def.desc}</p>
          <div class="loadout-runes-preview">
            <span class="preview-label">Formula:</span>
            <div class="preview-runes-row">${runesHTML}</div>
          </div>
        `;

        card.addEventListener('click', () => {
          if (this.selectedLoadoutSpells.has(def.id)) {
            if (this.selectedLoadoutSpells.size > 1) {
              this.selectedLoadoutSpells.delete(def.id);
              card.classList.remove('selected');
              card.querySelector('.loadout-check-indicator').textContent = '⚪';
            }
          } else {
            if (this.selectedLoadoutSpells.size < 3) {
              this.selectedLoadoutSpells.add(def.id);
              card.classList.add('selected');
              card.querySelector('.loadout-check-indicator').textContent = '✅';
            }
          }
          updateCountUI();
        });

        grid.appendChild(card);
      });

      updateCountUI();

      if (btnConfirm) {
        btnConfirm.onclick = () => {
          if (this.selectedLoadoutSpells.size !== 3) return;
          this.equippedSpells = Array.from(this.selectedLoadoutSpells);
          this.loadoutModal.classList.add('hidden');
          this.renderGrimoireSpells();

          if (isStart) {
            this.restart();
          } else {
            this.isPaused = false;
          }
        };
      }

      this.loadoutModal.classList.remove('hidden');
    }

    gainInkExp(expAmount) {
      this.inkExp += expAmount;
      if (this.expDisplay) {
        const pct = Math.min(100, Math.floor((this.inkExp / this.expToNext) * 100));
        this.expDisplay.textContent = `Lv ${this.expLevel} (${pct}%)`;
      }

      if (this.inkExp >= this.expToNext) {
        const canUpgrade = this.equippedSpells.some(id => (this.spellLevels[id] || 1) < 3);
        if (canUpgrade) {
          this.inkExp -= this.expToNext;
          this.expLevel++;
          this.expToNext = Math.floor(this.expToNext * 1.45);
          this.triggerLevelUpModal();
        } else {
          this.inkExp = this.expToNext;
          this.score += 1500;
          this.addFloatingText('⭐ ALL SPELLS MAXED! +1500 PTS', this.CANVAS_WIDTH / 2, 220, '#FFE600', true);
        }
      }
    }

    triggerLevelUpModal() {
      this.isPaused = true;
      if (!this.levelUpModal) return;

      const grid = document.getElementById('levelupOptionsGrid');
      if (!grid) return;
      grid.innerHTML = '';

      const upgradeable = this.equippedSpells.filter(id => (this.spellLevels[id] || 1) < 3);

      upgradeable.forEach(spellId => {
        const def = SPELL_DEFS[spellId];
        const currentTier = this.spellLevels[spellId] || 1;
        const nextTier = currentTier + 1;
        const nextTierDef = def.levels[nextTier - 1];

        const card = document.createElement('div');
        card.className = 'levelup-option-card';
        card.innerHTML = `
          <div class="levelup-option-top">
            <span class="levelup-spell-icon">${def.icon}</span>
            <div class="levelup-spell-info">
              <span class="levelup-spell-name">${def.name}</span>
              <div class="levelup-tier-badges">
                <span class="tier-old">Tier ${currentTier}</span>
                <span class="tier-arrow">➔</span>
                <span class="tier-new">Tier ${nextTier}</span>
              </div>
            </div>
          </div>
          <p class="levelup-tier-desc">${nextTierDef.desc}</p>
          <button type="button" class="btn-select-upgrade">Upgrade to Tier ${nextTier}</button>
        `;

        card.addEventListener('click', () => {
          this.spellLevels[spellId] = nextTier;
          this.levelUpModal.classList.add('hidden');
          this.isPaused = false;
          this.renderGrimoireSpells();
          this.playCombatSound('phase_up');
          this.addFloatingText(`✨ ${def.name.toUpperCase()} ➔ TIER ${nextTier}!`, this.CANVAS_WIDTH / 2, 220, '#38BDF8', true);
        });

        grid.appendChild(card);
      });

      this.levelUpModal.classList.remove('hidden');
      this.playCombatSound('phase_up');
    }

    // =========================================================================
    // Main Battlefield Drawing & Combat Resolution
    // =========================================================================

    getCanvasCoordinates(e) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    onPointerDown(e) {
      if (!this.isRunning || this.isGameOver || this.isPaused) return;
      this.isDrawing = true;
      const pt = this.getCanvasCoordinates(e);
      this.currentStrokePoints = [pt];
    }

    onPointerMove(e) {
      if (!this.isDrawing || !this.isRunning || this.isGameOver || this.isPaused) return;
      const pt = this.getCanvasCoordinates(e);
      this.currentStrokePoints.push(pt);
    }

    onPointerUp() {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      if (!this.isRunning || this.isGameOver || this.isPaused) {
        this.currentStrokePoints = [];
        return;
      }

      if (this.currentStrokePoints.length >= 6) {
        const match = this.recognizer.recognize(this.currentStrokePoints);
        if (match) {
          this.handleGestureMatch(match.name, this.currentStrokePoints);
        } else {
          this.spawnStrokeFizzle(this.currentStrokePoints);
        }
      }

      this.currentStrokePoints = [];
    }

    handleGestureMatch(shapeName, strokePoints) {
      let sumX = 0, sumY = 0;
      for (const p of strokePoints) {
        sumX += p.x;
        sumY += p.y;
      }
      const centroidX = sumX / strokePoints.length;
      const centroidY = sumY / strokePoints.length;

      const eligibleEnemies = this.enemies.filter(e => !e.isDead && e.symbolArray.length > 0 && e.symbolArray[0] === shapeName);
      eligibleEnemies.sort((a, b) => a.x - b.x);

      const meta = SYMBOL_META[shapeName] || { icon: '⚡', color: '#000000', badgeBg: '#FFE600' };

      if (eligibleEnemies.length > 0) {
        const target = eligibleEnemies[0];
        target.symbolArray.shift();
        target.hitFlashTimer = 8;

        this.spawnSlashBeam(centroidX, centroidY, target.x + target.width / 2, target.y + target.height / 2, meta.badgeBg || '#FFE600');
        this.playCombatSound('slash');

        if (target.symbolArray.length === 0) {
          this.onEnemyDefeated(target, meta.badgeBg || '#FFE600');
        } else {
          this.spawnHitSparks(target.x + target.width / 2, target.y + target.height / 2, meta.badgeBg || '#FFE600');
          this.addFloatingText('CRACK!', target.x + target.width / 2, target.y - 10, '#F59E0B', false);
        }

        this.addFloatingText(`${meta.icon} ${shapeName.toUpperCase()}`, centroidX, centroidY - 15, '#FFE600', false);
      } else {
        this.addFloatingText(`${meta.icon} ${shapeName}`, centroidX, centroidY - 15, '#64748B', false);
        this.playCombatSound('miss');
      }
    }

    onEnemyDefeated(target, color = '#FFE600', extraScoreMult = 1.0) {
      target.isDead = true;
      this.enemiesSlain++;

      const isFrozen = (this.freezeTimer > 0);
      const freezeMultiplier = isFrozen ? 2.0 : 1.0;
      const basePoints = target.isTank ? (350 + target.initialSymbolCount * 50) : 100;
      const pointsEarned = Math.floor(basePoints * freezeMultiplier * extraScoreMult);
      this.score += pointsEarned;

      // EXP gain
      const expEarned = target.isTank ? 60 : 15;
      this.gainInkExp(expEarned);

      // Freeze Tier 2: Defeated enemies explode into icy shrapnel
      if (isFrozen && (this.spellLevels.freeze_frame || 1) >= 2) {
        this.spawnIcyShrapnel(target.x + target.width / 2, target.y + target.height / 2);
      }

      // Visuals
      const COMIC_SFX = ['POW!', 'BAM!', 'WHAM!', 'SLASH!', 'CRUSH!', 'KAPOW!', 'ZAP!', 'SMACK!'];
      const randomSfx = COMIC_SFX[Math.floor(Math.random() * COMIC_SFX.length)];
      this.spawnDeathExplosion(target.x + target.width / 2, target.y + target.height / 2, color, target.isTank);
      this.addFloatingText(randomSfx, target.x + target.width / 2, target.y - 18, color, true);
      this.addFloatingText(`+${pointsEarned}`, target.x + target.width / 2, target.y + 14, '#FFFFFF', true);
      if (isFrozen) {
        this.addFloatingText('❄️ 2x FREEZE BONUS!', target.x + target.width / 2, target.y - 36, '#38BDF8', false);
      }
      this.playCombatSound(target.isTank ? 'tank_kill' : 'kill');
      this.updateHUD();
    }

    spawnIcyShrapnel(x, y) {
      let nearest = null;
      let minDist = Infinity;
      for (const e of this.enemies) {
        if (!e.isDead) {
          const d = Math.hypot(e.x - x, e.y - y);
          if (d > 10 && d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
      }
      if (nearest) {
        this.spawnSlashBeam(x, y, nearest.x + nearest.width / 2, nearest.y + nearest.height / 2, '#38BDF8');
        nearest.hitFlashTimer = 6;
        if (nearest.symbolArray.length > 1) {
          nearest.symbolArray.shift();
          this.addFloatingText('❄️ SHRAPNEL!', nearest.x, nearest.y - 15, '#38BDF8', false);
        } else {
          this.onEnemyDefeated(nearest, '#38BDF8');
        }
      }
    }

    // =========================================================================
    // Difficulty Scaling & Wave Spawner
    // =========================================================================

    updatePhase() {
      const prevPhase = this.currentPhase;
      if (this.survivalTime < 45) {
        this.currentPhase = 1;
      } else if (this.survivalTime < 90) {
        this.currentPhase = 2;
      } else if (this.survivalTime < 135) {
        this.currentPhase = 3;
      } else {
        this.currentPhase = 4;
      }

      if (this.currentPhase !== prevPhase) {
        const phaseNames = [
          '',
          'Phase 1: Inklings',
          'Phase 2: Swarm Surge',
          'Phase 3: Arcane Glyphs (Star)',
          'Phase 4: Tank Juggernauts (Ampersand)'
        ];
        this.addFloatingText(`⚡ ${phaseNames[this.currentPhase]}!`, this.CANVAS_WIDTH / 2, 200, '#FFE600', true);
        this.playCombatSound('phase_up');
      }
    }

    spawnEnemy() {
      let pool = [];
      let baseSpeed = 1.2;
      let minInterval = 2400;
      let maxInterval = 3000;
      let tankChance = 0.0;

      if (this.currentPhase === 1) {
        pool = ['Vertical Line', 'Horizontal Line', 'Caret'];
        baseSpeed = 1.1 + Math.random() * 0.3;
        minInterval = 2300;
        maxInterval = 2900;
        tankChance = 0.0;
      } else if (this.currentPhase === 2) {
        pool = ['Vertical Line', 'Horizontal Line', 'Caret', 'V-Shape'];
        baseSpeed = 1.5 + Math.random() * 0.4;
        minInterval = 1600;
        maxInterval = 2100;
        tankChance = 0.0;
      } else if (this.currentPhase === 3) {
        pool = ['Vertical Line', 'Horizontal Line', 'Caret', 'V-Shape', 'Circle', 'Lightning Bolt', 'Star'];
        baseSpeed = 1.8 + Math.random() * 0.5;
        minInterval = 1200;
        maxInterval = 1650;
        tankChance = 0.0;
      } else {
        pool = ['Vertical Line', 'Horizontal Line', 'Caret', 'V-Shape', 'Circle', 'Lightning Bolt', 'Star', 'Ampersand'];
        baseSpeed = 2.0 + Math.random() * 0.6;
        minInterval = 950;
        maxInterval = 1350;
        tankChance = 0.40;
      }

      const isTank = (Math.random() < tankChance);
      let enemySymbols = [];

      if (isTank) {
        const symbolCount = Math.floor(Math.random() * 3) + 2;
        for (let s = 0; s < symbolCount; s++) {
          const randSym = pool[Math.floor(Math.random() * pool.length)];
          enemySymbols.push(randSym);
        }
      } else {
        const randSym = pool[Math.floor(Math.random() * pool.length)];
        enemySymbols = [randSym];
      }

      const speed = isTank ? Math.max(0.8, baseSpeed * 0.65) : baseSpeed;

      const enemy = new Enemy({
        x: this.CANVAS_WIDTH + 20,
        canvasWidth: this.CANVAS_WIDTH,
        canvasHeight: this.CANVAS_HEIGHT,
        speed: speed,
        symbolArray: enemySymbols,
        isTank: isTank
      });

      this.enemies.push(enemy);
      this.nextSpawnInterval = minInterval + Math.random() * (maxInterval - minInterval);
    }

    // =========================================================================
    // Game Loop & Horizontal Physics
    // =========================================================================

    loop(timestamp) {
      if (!this.isRunning) return;

      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const dtMs = Math.min(timestamp - this.lastTimestamp, 100);
      this.lastTimestamp = timestamp;
      const dtSec = dtMs / 1000.0;
      const dtFactor = dtMs / 16.667;

      if (this.isPaused) {
        this.render();
        this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
        return;
      }

      this.survivalTime += dtSec;
      this.updatePhase();

      // Update Cooldowns
      for (const spellId in this.spellCooldowns) {
        if (this.spellCooldowns[spellId] > 0) {
          this.spellCooldowns[spellId] = Math.max(0, this.spellCooldowns[spellId] - dtSec);
        }
      }
      this.updateGrimoireCooldownsUI();

      // Update Spells: Freeze / Chill
      const isFrozen = (this.freezeTimer > 0);
      const isChilled = (this.chillTimer > 0);

      if (this.freezeTimer > 0) {
        this.freezeTimer -= dtSec;
        if (this.freezeTimer <= 0 && (this.spellLevels.freeze_frame || 1) >= 3) {
          this.chillTimer = 6.0;
          this.addFloatingText('❄️ POST-FREEZE CHILL (40% SPD)', this.CANVAS_WIDTH / 2, 200, '#38BDF8', false);
        }
      } else if (this.chillTimer > 0) {
        this.chillTimer -= dtSec;
      }

      // Update Spells: Margin Bastion Barrier Expiration (Lv 1/2: 15s)
      for (let b = this.barriers.length - 1; b >= 0; b--) {
        const bar = this.barriers[b];
        if (!bar.isPermanent) {
          bar.duration -= dtSec;
          if (bar.duration <= 0) {
            this.barriers.splice(b, 1);
            this.addFloatingText('BARRIER EXPIRED', this.WALL_X + 60, this.CANVAS_HEIGHT / 2, '#94A3B8');
            this.playCombatSound('miss');
          }
        }
      }

      // Update Spells: Vortex Singularity
      if (this.vortex.active) {
        this.vortex.duration -= dtSec;
        this.vortex.pulseTimer += dtSec;

        for (const enemy of this.enemies) {
          if (enemy.isDead) continue;
          const dx = this.vortex.x - (enemy.x + enemy.width / 2);
          const dy = this.vortex.y - (enemy.y + enemy.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 15) {
            const pull = Math.min(6.0, 320 / (dist + 30));
            enemy.x += (dx / dist) * pull * dtFactor;
            enemy.y += (dy / dist) * pull * dtFactor;
          }
        }

        if (this.vortex.tier >= 2 && this.vortex.pulseTimer >= 2.0) {
          this.vortex.pulseTimer = 0;
          for (const enemy of this.enemies) {
            if (enemy.isDead) continue;
            const dist = Math.hypot(this.vortex.x - enemy.x, this.vortex.y - enemy.y);
            if (dist < 180) {
              if (enemy.symbolArray.length > 1) {
                enemy.symbolArray.shift();
                this.spawnHitSparks(enemy.x, enemy.y, '#A855F7');
              } else {
                this.onEnemyDefeated(enemy, '#A855F7');
              }
            }
          }
        }

        if (this.vortex.duration <= 0) {
          this.vortex.active = false;
          if (this.vortex.tier >= 3) {
            this.spawnDeathExplosion(this.vortex.x, this.vortex.y, '#C084FC', true);
            this.addFloatingText('🌀 VORTEX KABOOM!', this.vortex.x, this.vortex.y - 40, '#C084FC', true);
            this.playCombatSound('tank_kill');
            for (const enemy of this.enemies) {
              if (enemy.isDead) continue;
              const dist = Math.hypot(this.vortex.x - enemy.x, this.vortex.y - enemy.y);
              if (dist < 260) {
                this.onEnemyDefeated(enemy, '#C084FC', 2.0);
              }
            }
          }
        }
      }

      // Spawner Timer
      this.spawnTimer += dtMs;
      if (this.spawnTimer >= this.nextSpawnInterval) {
        this.spawnTimer = 0;
        this.spawnEnemy();
      }

      // Update Active Enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        let speedMult = 1.0;
        if (isFrozen) {
          speedMult = 0.0;
        } else if (isChilled) {
          speedMult = 0.40;
        }
        enemy.update(dtFactor * speedMult);

        // Check City Wall Breach: x <= 50
        if (enemy.x <= this.WALL_X && !enemy.isDead) {
          if (this.barriers.length > 0) {
            const activeBar = this.barriers[this.barriers.length - 1];
            activeBar.hitsRemaining--;
            enemy.x = this.WALL_X + 170;
            enemy.hitFlashTimer = 10;

            if (activeBar.tier >= 2) {
              if (enemy.symbolArray.length > 1) {
                enemy.symbolArray.shift();
                this.spawnHitSparks(enemy.x, enemy.y, '#38BDF8');
                this.addFloatingText('⚡ ZAP!', enemy.x, enemy.y - 15, '#38BDF8', true);
              } else {
                this.onEnemyDefeated(enemy, '#38BDF8');
              }
            }

            this.spawnHitSparks(this.WALL_X + 16, enemy.y + enemy.height / 2, '#38BDF8');
            this.addFloatingText(`🛡️ BLOCKED! (${activeBar.hitsRemaining} LEFT)`, this.WALL_X + 70, enemy.y, '#38BDF8', true);
            this.playCombatSound('tank_kill');

            if (activeBar.hitsRemaining <= 0) {
              this.barriers.pop();
              this.spawnDeathExplosion(this.WALL_X + 16, this.CANVAS_HEIGHT / 2, '#EF4444', false);
              this.addFloatingText('💥 BARRIER BROKEN!', this.WALL_X + 70, this.CANVAS_HEIGHT / 2, '#EF4444', true);
            }
            continue;
          } else {
            this.triggerGameOver();
            return;
          }
        }

        if (enemy.isDead) {
          this.enemies.splice(i, 1);
        }
      }

      this.updateEffects(dtFactor);
      this.updateHUD();
      this.render();

      if (!this.isGameOver) {
        this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

      this.renderBackground(ctx);
      this.renderCityWall(ctx);

      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].render(ctx);
      }

      this.renderEffects(ctx);
      this.renderLiveStroke(ctx);
    }

    renderBackground(ctx) {
      ctx.save();
      ctx.fillStyle = '#FAF8F5';
      ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      const step = 32;
      for (let x = 60; x < this.CANVAS_WIDTH; x += step) {
        for (let y = 30; y < this.CANVAS_HEIGHT; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 1.5;
      const m = 16;
      const len = 12;
      ctx.beginPath();
      ctx.moveTo(this.CANVAS_WIDTH - m - len, m);
      ctx.lineTo(this.CANVAS_WIDTH - m, m);
      ctx.lineTo(this.CANVAS_WIDTH - m, m + len);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.CANVAS_WIDTH - m - len, this.CANVAS_HEIGHT - m);
      ctx.lineTo(this.CANVAS_WIDTH - m, this.CANVAS_HEIGHT - m);
      ctx.lineTo(this.CANVAS_WIDTH - m, this.CANVAS_HEIGHT - m - len);
      ctx.stroke();

      ctx.restore();
    }

    renderCityWall(ctx) {
      ctx.save();
      const wallX = this.WALL_X;

      let minEnemyDist = Infinity;
      for (const e of this.enemies) {
        if (!e.isDead) minEnemyDist = Math.min(minEnemyDist, e.x - wallX);
      }
      const isThreat = minEnemyDist < 160;

      ctx.fillStyle = isThreat ? '#FEF2F2' : '#F4F4F5';
      ctx.fillRect(0, 0, wallX, this.CANVAS_HEIGHT);

      ctx.strokeStyle = isThreat ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1.5;
      for (let y = -50; y < this.CANVAS_HEIGHT + 50; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(wallX, y + wallX);
        ctx.stroke();
      }

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(wallX, 0);
      ctx.lineTo(wallX, this.CANVAS_HEIGHT);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wallX + 3.5, 0);
      ctx.lineTo(wallX + 3.5, this.CANVAS_HEIGHT);
      ctx.stroke();

      for (let y = 35; y < this.CANVAS_HEIGHT; y += 65) {
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(wallX + 2, y + 2, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isThreat ? '#EF4444' : '#FFE600';
        ctx.beginPath();
        ctx.arc(wallX, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Active Margin Bastion Forcefield
      if (this.barriers.length > 0) {
        const activeBar = this.barriers[this.barriers.length - 1];
        const barX = wallX + 16;

        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#0284C7';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(barX, 0);
        ctx.lineTo(barX, this.CANVAS_HEIGHT);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(barX, 0);
        ctx.lineTo(barX, this.CANVAS_HEIGHT);
        ctx.stroke();

        for (let y = 30; y < this.CANVAS_HEIGHT; y += 70) {
          ctx.fillStyle = '#0284C7';
          ctx.beginPath();
          ctx.arc(barX, y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(barX, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        ctx.translate(barX + 12, this.CANVAS_HEIGHT * 0.15);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, 160, 36);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 160, 36);
        ctx.fillStyle = '#38BDF8';
        ctx.font = '900 12px "Fredoka", sans-serif';
        ctx.fillText(`🛡️ BASTION: ${activeBar.hitsRemaining} HITS`, 10, 16);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 10px "Fredoka", sans-serif';
        const durText = activeBar.isPermanent ? 'PERMANENT' : `${Math.ceil(activeBar.duration)}s REMAINING`;
        ctx.fillText(`${durText} [${this.barriers.length} ACTIVE]`, 10, 28);
        ctx.restore();

        ctx.restore();
      }

      // Vertical Margin Label
      ctx.save();
      ctx.translate(22, this.CANVAS_HEIGHT / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = '900 13px "Fredoka", sans-serif';
      ctx.textAlign = 'center';

      if (isThreat) {
        ctx.fillStyle = '#DC2626';
        ctx.fillText('⚠️ DANGER: PERIMETER BREACH!', 0, 0);
      } else {
        ctx.fillStyle = '#18181B';
        ctx.fillText('🛡️ SANCTUARY MARGIN // DEFEND', 0, 0);
      }
      ctx.restore();

      ctx.restore();
    }

    renderLiveStroke(ctx) {
      if (!this.isDrawing || this.currentStrokePoints.length < 2) return;

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = this.strokeWidth || 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(this.currentStrokePoints[0].x, this.currentStrokePoints[0].y);
      for (let i = 1; i < this.currentStrokePoints.length; i++) {
        ctx.lineTo(this.currentStrokePoints[i].x, this.currentStrokePoints[i].y);
      }
      ctx.stroke();

      const tip = this.currentStrokePoints[this.currentStrokePoints.length - 1];
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // =========================================================================
    // Game Over & Restart
    // =========================================================================

    triggerGameOver() {
      this.isGameOver = true;
      this.isRunning = false;

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      this.playCombatSound('game_over');
      const isNewRecord = this.saveHighScore();

      const modal = document.getElementById('inkslaughtGameOverModal');
      const scoreVal = document.getElementById('inkModalScore');
      const highVal = document.getElementById('inkModalHigh');
      const timeVal = document.getElementById('inkModalTime');
      const killsVal = document.getElementById('inkModalKills');
      const newHighBadge = document.getElementById('inkModalNewHigh');

      if (scoreVal) scoreVal.textContent = this.score.toLocaleString();
      if (highVal) highVal.textContent = this.highScore.toLocaleString();
      if (timeVal) timeVal.textContent = this.formatTime(this.survivalTime);
      if (killsVal) killsVal.textContent = this.enemiesSlain.toString();
      if (newHighBadge) {
        newHighBadge.classList.toggle('hidden', !isNewRecord);
      }

      if (modal) {
        modal.classList.remove('hidden');
      }

      console.log(`💀 Game Over: City Wall breached! Final Score: ${this.score}`);
    }

    restart() {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      this.score = 0;
      this.survivalTime = 0.0;
      this.enemiesSlain = 0;
      this.currentPhase = 1;
      this.spawnTimer = 0.0;
      this.nextSpawnInterval = 2200;
      this.enemies = [];
      this.particles = [];
      this.floatingTexts = [];
      this.currentStrokePoints = [];
      this.skillStrokePoints = [];
      this.isDrawing = false;
      this.isSkillDrawing = false;
      this.isGameOver = false;
      this.isPaused = false;
      this.lastTimestamp = 0;

      this.inkExp = 0;
      this.expLevel = 1;
      this.expToNext = 100;
      this.spellCooldowns = {
        clean_slate: 0,
        freeze_frame: 0,
        margin_bastion: 0,
        vortex_well: 0,
        comic_storm: 0
      };
      this.spellLevels = {
        clean_slate: 1,
        freeze_frame: 1,
        margin_bastion: 1,
        vortex_well: 1,
        comic_storm: 1
      };
      this.activeRuneSequence = [];
      this.barriers = [];
      this.freezeTimer = 0;
      this.chillTimer = 0;
      this.vortex.active = false;
      this.screenFlash = 0;

      if (this.modalOverlay) {
        this.modalOverlay.classList.add('hidden');
      }

      this.updateSequenceUI();
      this.renderGrimoireSpells();
      this.updateHUD();
      this.clearSkillPad();

      this.isRunning = true;
      this.playCombatSound('start');
      this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));

      console.log('⚔️ Inkslaught game restarted in-memory with equipped Grimoire.');
    }

    open() {
      const landingOverlay = document.getElementById('landingOverlay');
      if (landingOverlay) landingOverlay.classList.add('hidden');

      if (this.view) {
        this.view.classList.remove('hidden');
        this.view.style.display = 'flex';
      }

      document.body.classList.add('inkslaught-mode-active');
      this.loadHighScore();

      // Show Pre-Game Grimoire Loadout Selector Modal (3 spells chosen on entry)
      this.openLoadoutModal(true);
    }

    close() {
      this.isRunning = false;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      if (this.view) {
        this.view.classList.add('hidden');
        this.view.style.display = 'none';
      }

      if (this.modalOverlay) {
        this.modalOverlay.classList.add('hidden');
      }
      if (this.loadoutModal) {
        this.loadoutModal.classList.add('hidden');
      }
      if (this.levelUpModal) {
        this.levelUpModal.classList.add('hidden');
      }

      document.body.classList.remove('inkslaught-mode-active');

      const landingOverlay = document.getElementById('landingOverlay');
      if (landingOverlay) landingOverlay.classList.remove('hidden');
    }

    // =========================================================================
    // Visual Effects & Particle Engine
    // =========================================================================

    spawnSlashBeam(x1, y1, x2, y2, color) {
      this.particles.push({
        type: 'slash',
        x1, y1, x2, y2,
        color,
        life: 1.0,
        decay: 0.08
      });
    }

    spawnHitSparks(x, y, color) {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        const isStar = Math.random() > 0.45;
        this.particles.push({
          type: isStar ? 'comic_star' : 'spark',
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: isStar ? (Math.random() > 0.3 ? '#FFE600' : '#FFFFFF') : (color || '#000000'),
          size: 4 + Math.random() * 4,
          life: 1.0,
          decay: 0.04 + Math.random() * 0.04
        });
      }
    }

    spawnDeathExplosion(x, y, color, isTank) {
      const count = isTank ? 32 : 20;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 3 + Math.random() * (isTank ? 9 : 6);
        const isStar = Math.random() > 0.5;
        this.particles.push({
          type: isStar ? 'comic_star' : 'ink_burst',
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: isStar ? (Math.random() > 0.3 ? '#FFE600' : '#FFFFFF') : (Math.random() > 0.4 ? '#18181B' : (color || '#000000')),
          size: 5 + Math.random() * (isTank ? 8 : 5),
          life: 1.0,
          decay: 0.025 + Math.random() * 0.03
        });
      }
    }

    spawnStrokeFizzle(points) {
      for (let i = 0; i < points.length; i += 4) {
        this.particles.push({
          type: 'puff',
          x: points[i].x,
          y: points[i].y,
          vx: (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 2,
          color: 'rgba(0, 0, 0, 0.4)',
          size: 3 + Math.random() * 3,
          life: 0.8,
          decay: 0.07
        });
      }
    }

    addFloatingText(text, x, y, color = '#FFF', isBig = false) {
      this.floatingTexts.push({
        text,
        x,
        y,
        color,
        isBig,
        life: 1.0,
        decay: isBig ? 0.02 : 0.035
      });
    }

    updateEffects(dtFactor) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= p.decay * dtFactor;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        if (p.type === 'spark' || p.type === 'ink_burst' || p.type === 'comic_star' || p.type === 'puff') {
          p.x += p.vx * dtFactor;
          p.y += p.vy * dtFactor;
          p.vy += (p.type === 'puff' ? -0.05 : 0.12) * dtFactor;
        }
      }

      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.life -= ft.decay * dtFactor;
        ft.y -= 1.2 * dtFactor;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    renderEffects(ctx) {
      ctx.save();

      // Screen Flash
      if (this.screenFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash})`;
        ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        this.screenFlash = Math.max(0, this.screenFlash - 0.03);
      }

      // Freeze Frame Vignette
      if (this.freezeTimer > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 14;
        ctx.strokeRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

        ctx.font = '900 16px "Fredoka", sans-serif';
        ctx.fillStyle = '#0284C7';
        ctx.textAlign = 'right';
        ctx.fillText(`❄️ FREEZE FRAME: ${this.freezeTimer.toFixed(1)}s (2x SCORE)`, this.CANVAS_WIDTH - 25, 45);
        ctx.restore();
      }

      // Vortex Singularity
      if (this.vortex.active) {
        ctx.save();
        ctx.translate(this.vortex.x, this.vortex.y);
        ctx.rotate(Date.now() * 0.005);
        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 4;
        for (let a = 0; a < 3; a++) {
          ctx.beginPath();
          ctx.arc(0, 0, 50 + a * 25, a * 2, a * 2 + Math.PI);
          ctx.stroke();
        }
        ctx.fillStyle = '#1E1B4B';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particles
      for (const p of this.particles) {
        if (p.type === 'slash') {
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 5 * p.life;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();

          ctx.strokeStyle = p.color || '#FFE600';
          ctx.lineWidth = 2.5 * p.life;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === 'comic_star') {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.globalAlpha = p.life;
          this.drawComicStar(ctx, p.x, p.y, p.size * p.life, p.size * 0.4 * p.life);
          ctx.restore();
        } else if (p.type === 'ink_burst' || p.type === 'spark') {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          if (p.size * p.life > 3.5) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        } else if (p.type === 'puff') {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life * 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - p.life), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1.0;

      // Floating Texts
      for (const ft of this.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, ft.life * 1.4);

        const fontSize = ft.isBig ? 24 : 15;
        ctx.font = `900 ${fontSize}px "Fredoka", "Bangers", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#000000';
        ctx.fillText(ft.text, ft.x + 2.5, ft.y + 2.5);

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(ft.text, ft.x, ft.y);

        ctx.fillStyle = ft.color || '#FFE600';
        ctx.fillText(ft.text, ft.x, ft.y);

        ctx.restore();
      }

      ctx.restore();
    }

    drawComicStar(ctx, cx, cy, outerRadius, innerRadius) {
      const points = 4;
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / points;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < points; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // =========================================================================
    // HUD & Audio Helpers
    // =========================================================================

    formatTime(seconds) {
      const s = Math.floor(seconds);
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateHUD() {
      if (this.timeDisplay) {
        this.timeDisplay.textContent = this.formatTime(this.survivalTime);
      }
      if (this.scoreDisplay) {
        this.scoreDisplay.textContent = this.score.toLocaleString();
      }
      if (this.phaseDisplay) {
        const phaseNames = ['', 'Phase 1: Inklings', 'Phase 2: Swarm', 'Phase 3: Glyphs', 'Phase 4: Tanks'];
        this.phaseDisplay.textContent = phaseNames[this.currentPhase] || `Phase ${this.currentPhase}`;
      }
    }

    playCombatSound(type) {
      if (this.isMuted) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        if (type === 'slash') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(650, now);
          osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === 'kill') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.2);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);
        } else if (type === 'tank_kill') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === 'miss') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
        } else if (type === 'game_over') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(130, now);
          osc.frequency.setValueAtTime(125, now + 0.2);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.6);
        } else if (type === 'phase_up' || type === 'start') {
          const notes = [440, 554.37, 659.25];
          notes.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(f, now + i * 0.08);
            gain.gain.setValueAtTime(0.2, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.2);
          });
        }
      } catch (e) {}
    }
  }

  // Export to global scope
  global.DollarRecognizer = DollarRecognizer;
  global.InkslaughtEnemy = Enemy;
  global.InkslaughtGame = InkslaughtGame;

})(typeof window !== 'undefined' ? window : this);
