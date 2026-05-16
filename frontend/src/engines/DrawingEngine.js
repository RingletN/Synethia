// engines/DrawingEngine.js
class DrawingEngine {
    constructor(mainCanvas, duration = 8) {
        this.mainCanvas = mainCanvas;
        this.ctx = mainCanvas.getContext('2d');

        this.isDrawing = false;
        this.isErasing = false;
        this.segments = [];
        this.currentSegment = null;

        this.currentInstrument = 'sine';
        this.currentColor = '#00ffd1';
        this.lineWidth = 5;
        this.eraserWidth = 22;

        this.instrumentColors = {
            'sine': '#00ffd1',
            'square': '#ff3366',
            'sawtooth': '#ffcc00',
            'triangle': '#9900ff'
        };

        this.onStrokeEnd = null;

        // RAF handle для дебаунса resize во время drag
        this._resizeRafId = null;

        this.initCanvases();
        this.setupEventListeners();
    }

    initCanvases() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    setupEventListeners() {
        const canvas = this.mainCanvas;
        canvas.addEventListener('mousedown', e => this.startDrawing(e));
        canvas.addEventListener('mousemove', e => this.draw(e));
        canvas.addEventListener('mouseup', () => this.stopDrawing());
        canvas.addEventListener('mouseout', () => this.stopDrawing());

        canvas.addEventListener('touchstart', e => { e.preventDefault(); this.startDrawing(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchmove', e => { e.preventDefault(); this.draw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    getMousePos(e) {
        const rect = this.mainCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;

        this.currentSegment = {
            points: [{
                x: pos.x / this.mainCanvas.width,
                y: pos.y / this.mainCanvas.height,
            }],
            color: this.currentColor,
            lineWidth: this.isErasing ? this.eraserWidth : this.lineWidth,
            isErase: this.isErasing,
            instrument: this.currentInstrument,
        };
    }

    draw(e) {
        if (!this.isDrawing || !this.currentSegment) return;
        const pos = this.getMousePos(e);

        this.ctx.lineWidth = this.isErasing ? this.eraserWidth : this.lineWidth;
        this.ctx.globalCompositeOperation = this.isErasing ? 'destination-out' : 'source-over';
        if (!this.isErasing) this.ctx.strokeStyle = this.currentColor;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        this.currentSegment.points.push({
            x: pos.x / this.mainCanvas.width,
            y: pos.y / this.mainCanvas.height,
        });

        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.ctx.globalCompositeOperation = 'source-over';

        if (this.currentSegment && this.currentSegment.points.length > 1) {
            this.segments.push(this.currentSegment);
            if (typeof this.onStrokeEnd === 'function') {
                this.onStrokeEnd();
            }
        }
        this.currentSegment = null;
    }

    redraw() {
        const w = this.mainCanvas.width;
        const h = this.mainCanvas.height;

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.globalCompositeOperation = 'source-over';

        this.segments.forEach(segment => {
            if (segment.points.length < 2) return;

            this.ctx.lineWidth = segment.lineWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            if (segment.isErase) {
                this.ctx.globalCompositeOperation = 'destination-out';
            } else {
                this.ctx.globalCompositeOperation = 'source-over';
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

        this.ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Resize без мигания: рисуем в offscreen-буфер нужного размера,
     * меняем размер основного canvas и одним drawImage копируем результат.
     * Так браузер никогда не показывает пустой кадр.
     */
    resize(newWidth, newHeight) {
        if (newWidth < 100 || newHeight < 100) return;

        // Отменяем предыдущий ещё не выполненный RAF (дебаунс на drag)
        if (this._resizeRafId !== null) {
            cancelAnimationFrame(this._resizeRafId);
        }

        this._resizeRafId = requestAnimationFrame(() => {
            this._resizeRafId = null;
            this._doResize(newWidth, newHeight);
        });
    }

    _doResize(newWidth, newHeight) {
        // 1. Рисуем все сегменты в offscreen canvas нового размера
        const offscreen = document.createElement('canvas');
        offscreen.width  = newWidth;
        offscreen.height = newHeight;
        const offCtx = offscreen.getContext('2d');
        offCtx.lineCap  = 'round';
        offCtx.lineJoin = 'round';

        this.segments.forEach(segment => {
            if (segment.points.length < 2) return;

            offCtx.lineWidth = segment.lineWidth;
            offCtx.lineCap   = 'round';
            offCtx.lineJoin  = 'round';

            if (segment.isErase) {
                offCtx.globalCompositeOperation = 'destination-out';
            } else {
                offCtx.globalCompositeOperation = 'source-over';
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

        // 2. Атомарно меняем размер основного canvas и сразу копируем готовый кадр
        this.mainCanvas.width  = newWidth;
        this.mainCanvas.height = newHeight;

        this.ctx.lineCap  = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = 'source-over';

        // drawImage — один вызов, пустого кадра не будет
        this.ctx.drawImage(offscreen, 0, 0);
    }

    setInstrument(instrument) {
        this.currentInstrument = instrument;
        this.currentColor = this.instrumentColors[instrument] || '#00ffd1';
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
        this.segments = state?.segments ? JSON.parse(JSON.stringify(state.segments)) : [];
        this.redraw();
    }

    getAllSegments() {
        return JSON.parse(JSON.stringify(this.segments));
    }

    /**
     * Добавляет готовые сегменты (например, из обработки фото) к текущим.
     * Перерисовывает холст и вызывает onStrokeEnd для сохранения в историю.
     * @param {Array} newSegments - массив нормализованных сегментов
     */
    addSegments(newSegments) {
        if (!Array.isArray(newSegments) || newSegments.length === 0) return;
        this.segments.push(...JSON.parse(JSON.stringify(newSegments)));
        this.redraw();
        if (typeof this.onStrokeEnd === 'function') {
            this.onStrokeEnd();
        }
    }
}

export default DrawingEngine;