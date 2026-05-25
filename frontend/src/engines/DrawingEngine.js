// engines/DrawingEngine.js
class DrawingEngine {
  constructor(mainCanvas, duration = 8) {
    this.mainCanvas = mainCanvas;
    this.ctx = mainCanvas.getContext("2d");

    this.isDrawing = false;
    this.isErasing = false;
    this.segments = [];
    this.currentSegment = null;

    this.currentInstrument = "sine";
    this.currentColor = "#00ffd1";
    this.lineWidth = 5;
    this.eraserWidth = 22;

    this.instrumentColors = {
      sine: "#00ffd1",
      square: "#ff3366",
      sawtooth: "#ffcc00",
      triangle: "#9900ff",
    };

    this.onStrokeEnd = null;
    this._resizeRafId = null;
    this._eraserTrail = [];

    // Выставляем начальный размер canvas здесь, так как DrawingArea
    // больше не передаёт width/height атрибуты — React не будет
    // сбрасывать canvas при ре-рендере.
    if (!mainCanvas.width || mainCanvas.width < 10) mainCanvas.width = 780;
    if (!mainCanvas.height || mainCanvas.height < 10) mainCanvas.height = 700;

    this.initCanvases();
    this.setupEventListeners();
  }

  initCanvases() {
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  setupEventListeners() {
    const canvas = this.mainCanvas;
    canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    canvas.addEventListener("mousemove", (e) => this.draw(e));
    canvas.addEventListener("mouseup", () => this.stopDrawing());
    canvas.addEventListener("mouseout", () => this.stopDrawing());

    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.startDrawing(e.touches[0]);
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        this.draw(e.touches[0]);
      },
      { passive: false },
    );
    canvas.addEventListener("touchend", () => this.stopDrawing());
  }

  getMousePos(e) {
    const rect = this.mainCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;

    if (this.isErasing) {
      this._eraserTrail = [
        {
          x: pos.x / this.mainCanvas.width,
          y: pos.y / this.mainCanvas.height,
        },
      ];
      this.currentSegment = null;
    } else {
      this._eraserTrail = [];
      this.currentSegment = {
        points: [
          {
            x: pos.x / this.mainCanvas.width,
            y: pos.y / this.mainCanvas.height,
          },
        ],
        color: this.currentColor,
        lineWidth: this.lineWidth,
        isErase: false,
        instrument: this.currentInstrument,
      };
    }
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getMousePos(e);

    if (this.isErasing) {
      this.ctx.lineWidth = this.eraserWidth;
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
      this.ctx.globalCompositeOperation = "source-over";

      this._eraserTrail.push({
        x: pos.x / this.mainCanvas.width,
        y: pos.y / this.mainCanvas.height,
      });
    } else {
      if (!this.currentSegment) return;
      this.ctx.lineWidth = this.lineWidth;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = this.currentColor;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();

      this.currentSegment.points.push({
        x: pos.x / this.mainCanvas.width,
        y: pos.y / this.mainCanvas.height,
      });
    }

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.ctx.globalCompositeOperation = "source-over";

    if (this.isErasing) {
      if (this._eraserTrail.length > 0) {
        const changed = this._erasePoints(this._eraserTrail, this.eraserWidth);
        if (changed) {
          this.redraw();
          if (typeof this.onStrokeEnd === "function") {
            this.onStrokeEnd();
          }
        }
      }
      this._eraserTrail = [];
    } else {
      if (this.currentSegment && this.currentSegment.points.length > 1) {
        this.segments.push(this.currentSegment);
        if (typeof this.onStrokeEnd === "function") {
          this.onStrokeEnd();
        }
      }
    }
    this.currentSegment = null;
  }

  _erasePoints(eraserTrail, eraserWidthPx) {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    const rx = eraserWidthPx / 2 / w;
    const ry = eraserWidthPx / 2 / h;

    let changed = false;

    this.segments = this.segments
      .map((seg) => {
        if (seg.isErase) return null;

        const filteredPoints = seg.points.filter((pt) => {
          for (let i = 0; i < eraserTrail.length; i++) {
            const ep = eraserTrail[i];
            const dx = (pt.x - ep.x) / rx;
            const dy = (pt.y - ep.y) / ry;
            if (dx * dx + dy * dy <= 1) {
              changed = true;
              return false;
            }
            if (i + 1 < eraserTrail.length) {
              const ep2 = eraserTrail[i + 1];
              if (this._pointNearSegment(pt, ep, ep2, rx, ry)) {
                changed = true;
                return false;
              }
            }
          }
          return true;
        });

        if (filteredPoints.length === seg.points.length) return seg;
        changed = true;
        if (filteredPoints.length < 2) return null;
        return { ...seg, points: filteredPoints };
      })
      .filter(Boolean)
      .flatMap((seg) => this._splitSegmentByGaps(seg));

    return changed;
  }

  _pointNearSegment(pt, a, b, rx, ry) {
    const dx = (b.x - a.x) / rx;
    const dy = (b.y - a.y) / ry;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;
    const px = (pt.x - a.x) / rx;
    const py = (pt.y - a.y) / ry;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
    const closestX = px - t * dx;
    const closestY = py - t * dy;
    return closestX * closestX + closestY * closestY <= 1;
  }

  _splitSegmentByGaps(seg) {
    const GAP_THRESHOLD = 0.05;
    const parts = [];
    let current = [seg.points[0]];

    for (let i = 1; i < seg.points.length; i++) {
      const prev = seg.points[i - 1];
      const curr = seg.points[i];
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (dist > GAP_THRESHOLD) {
        if (current.length >= 2) parts.push({ ...seg, points: current });
        current = [curr];
      } else {
        current.push(curr);
      }
    }
    if (current.length >= 2) parts.push({ ...seg, points: current });
    return parts.length > 0 ? parts : [];
  }

  redraw() {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = "source-over";

    this.segments.forEach((segment) => {
      if (segment.points.length < 2) return;

      this.ctx.lineWidth = segment.lineWidth;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      if (segment.isErase) {
        this.ctx.globalCompositeOperation = "destination-out";
      } else {
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.strokeStyle = segment.color;
      }

      this.ctx.beginPath();
      segment.points.forEach((p, i) => {
        const x = p.x * w;
        const y = p.y * h;
        i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
      });
      this.ctx.stroke();
    });

    this.ctx.globalCompositeOperation = "source-over";
  }

  // resize — синхронный, без RAF. Вызывающий код (useCanvasResize) сам
  // управляет очередью через RAF во время drag.
  resize(newWidth, newHeight) {
    if (newWidth < 100 || newHeight < 100) return;
    this._doResize(newWidth, newHeight);
  }

  _doResize(newWidth, newHeight) {
    if (newWidth < 10 || newHeight < 10) return;

    // 1. Рисуем все сегменты в offscreen canvas нового размера
    const offscreen = document.createElement("canvas");
    offscreen.width = newWidth;
    offscreen.height = newHeight;
    const offCtx = offscreen.getContext("2d");
    offCtx.lineCap = "round";
    offCtx.lineJoin = "round";

    this.segments.forEach((segment) => {
      if (segment.points.length < 2) return;

      offCtx.lineWidth = segment.lineWidth;
      offCtx.lineCap = "round";
      offCtx.lineJoin = "round";

      if (segment.isErase) {
        offCtx.globalCompositeOperation = "destination-out";
      } else {
        offCtx.globalCompositeOperation = "source-over";
        offCtx.strokeStyle = segment.color;
      }

      offCtx.beginPath();
      segment.points.forEach((p, i) => {
        const x = p.x * newWidth;
        const y = p.y * newHeight;
        i === 0 ? offCtx.moveTo(x, y) : offCtx.lineTo(x, y);
      });
      offCtx.stroke();
    });

    // 2. Атомарно меняем размер основного canvas и сразу копируем готовый кадр.
    // Браузер не успевает показать пустой кадр — drawImage идёт сразу после
    // изменения размера в том же стеке вызовов.
    this.mainCanvas.width = newWidth;
    this.mainCanvas.height = newHeight;

    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.drawImage(offscreen, 0, 0);
  }

  setInstrument(instrument) {
    this.currentInstrument = instrument;
    this.currentColor = this.instrumentColors[instrument] || "#00ffd1";
    this.isErasing = false;
  }

  setEraserMode(isEraser) {
    this.isErasing = isEraser;
  }

  clear() {
    this.segments = [];
    this.currentSegment = null;
    this.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
  }

  getState() {
    return { segments: JSON.parse(JSON.stringify(this.segments)) };
  }

  loadState(state) {
    this.segments = state?.segments
      ? JSON.parse(JSON.stringify(state.segments))
      : [];
    this.redraw();
  }

  getAllSegments() {
    return JSON.parse(JSON.stringify(this.segments));
  }

  addSegments(newSegments) {
    if (!Array.isArray(newSegments) || newSegments.length === 0) return;
    this.segments.push(...JSON.parse(JSON.stringify(newSegments)));
    this.redraw();
    if (typeof this.onStrokeEnd === "function") {
      this.onStrokeEnd();
    }
  }
}

export default DrawingEngine;
