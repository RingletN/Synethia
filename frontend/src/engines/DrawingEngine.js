class DrawingEngine {
  constructor(mainCanvas, duration = 20) {
    this.mainCanvas = mainCanvas;
    this.ctx = mainCanvas.getContext("2d");

    // СОСТОЯНИЕ РИСОВАНИЯ
    this.isDrawing = false;
    this.isErasing = false;
    this.segments = []; // ВСЕ ЛИНИИ (сегменты)
    this.currentSegment = null; // текущая рисуемая линия

    // НАСТРОЙКИ КИСТИ И ЛАСТИКА
    this.currentColor = "#00ffd1";
    this.lineWidth = 5;
    this.eraserWidth = 22;

    this.onStrokeEnd = null; // колбэк окончания штриха
    this._resizeRafId = null;
    this._eraserTrail = []; // траектория ластика (нормализ. координаты)

    // начальные размеры холста, если не заданы
    if (!mainCanvas.width || mainCanvas.width < 10) mainCanvas.width = 780;
    if (!mainCanvas.height || mainCanvas.height < 10) mainCanvas.height = 700;

    this.initCanvases();
    this.setupEventListeners();
  }

  initCanvases() {
    // стиль линий: скругления
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  // УСТАНОВКА ОБРАБОТЧИКОВ МЫШИ И КАСАНИЙ
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

  // ПЕРЕСЧЕТ КООРДИНАТ УКАЗАТЕЛЯ В ПИКСЕЛИ ХОЛСТА (с учётом положения canvas на странице)
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
      // РЕЖИМ ЛАСТИКА: запоминаем начало траектории (нормализованные координаты)
      this._eraserTrail = [
        { x: pos.x / this.mainCanvas.width, y: pos.y / this.mainCanvas.height },
      ];
      this.currentSegment = null;
    } else {
      // РЕЖИМ РИСОВАНИЯ: создаём новый сегмент
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
      };
    }
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getMousePos(e);

    if (this.isErasing) {
      // ВИЗУАЛЬНОЕ СТИРАНИЕ (destination-out) и запись траектории
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
      // РИСОВАНИЕ ЛИНИИ
      if (!this.currentSegment) return;
      this.ctx.lineWidth = this.lineWidth;
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
      // ПОСЛЕ ШТРИХА ЛАСТИКОМ: удаляем стертые точки из сегментов
      if (this._eraserTrail.length > 0) {
        const changed = this._erasePoints(this._eraserTrail, this.eraserWidth);
        if (changed) {
          this.redraw();
          if (typeof this.onStrokeEnd === "function") this.onStrokeEnd();
        }
      }
      this._eraserTrail = [];
    } else {
      // ЗАВЕРШЕНИЕ ШТРИХА: сохраняем сегмент
      if (this.currentSegment && this.currentSegment.points.length > 1) {
        this.segments.push(this.currentSegment);
        if (typeof this.onStrokeEnd === "function") this.onStrokeEnd();
      }
    }
    this.currentSegment = null;
  }

  // ГЕОМЕТРИЧЕСКАЯ ФИЛЬТРАЦИЯ ТОЧЕК (удаление попавших под ластик)
  _erasePoints(eraserTrail, eraserWidthPx) {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    const rx = eraserWidthPx / 2 / w; // радиус ластика в нормализованных координатах по X
    const ry = eraserWidthPx / 2 / h; // по Y
    let changed = false;

    this.segments = this.segments
      .map((seg) => {
        if (seg.isErase) return null;
        const filteredPoints = seg.points.filter((pt) => {
          // проверка попадания в круги вокруг точек траектории
          for (let i = 0; i < eraserTrail.length; i++) {
            const ep = eraserTrail[i];
            const dx = (pt.x - ep.x) / rx;
            const dy = (pt.y - ep.y) / ry;
            if (dx * dx + dy * dy <= 1) {
              // формула эллипса
              changed = true;
              return false;
            }
            // проверка попадания в отрезок между точками траектории
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
      .flatMap((seg) => this._splitSegmentByGaps(seg)); // разрыв по большим промежуткам
    return changed;
  }

  // проверка близости точки к отрезку (в нормализованных координатах)
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

  // РАЗБИЕНИЕ СЕГМЕНТА НА ЧАСТИ ПРИ БОЛЬШИХ ПРОМЕЖУТКАХ (>5% от размера холста)
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

  // ПОЛНАЯ ПЕРЕРИСОВКА ХОЛСТА ПО СЕГМЕНТАМ
  redraw() {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = "source-over";
    this.segments.forEach((segment) => {
      if (segment.points.length < 2) return;
      this.ctx.lineWidth = segment.lineWidth;
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

  // ИЗМЕНЕНИЕ РАЗМЕРА С СОХРАНЕНИЕМ СОДЕРЖИМОГО
  resize(newWidth, newHeight) {
    if (newWidth < 100 || newHeight < 100) return;
    this._doResize(newWidth, newHeight);
  }

  _doResize(newWidth, newHeight) {
    if (newWidth < 10 || newHeight < 10) return;
    // 1. Рисуем на временном холсте нового размера
    const offscreen = document.createElement("canvas");
    offscreen.width = newWidth;
    offscreen.height = newHeight;
    const offCtx = offscreen.getContext("2d");
    offCtx.lineCap = "round";
    offCtx.lineJoin = "round";
    this.segments.forEach((segment) => {
      if (segment.points.length < 2) return;
      offCtx.lineWidth = segment.lineWidth;
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
    // 2. Атомарно меняем размер основного холста и копируем
    this.mainCanvas.width = newWidth;
    this.mainCanvas.height = newHeight;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.drawImage(offscreen, 0, 0);
  }

  setEraserMode(isEraser) {
    this.isErasing = isEraser;
  }

  clear() {
    this.segments = [];
    this.currentSegment = null;
    this.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
  }

  // СОХРАНЕНИЕ СОСТОЯНИЯ (глубокая копия сегментов)
  getState() {
    return { segments: JSON.parse(JSON.stringify(this.segments)) };
  }

  // ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ
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
    if (typeof this.onStrokeEnd === "function") this.onStrokeEnd();
  }
}

export default DrawingEngine;
