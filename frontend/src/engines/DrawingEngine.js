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

        this.initCanvases();
        this.setupEventListeners();
    }

    initCanvases() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    // Навешиваем обработчики мыши и тача для рисования
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

    // получаем координаты мыши относительно канваса
    getMousePos(e) {
        const rect = this.mainCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // Начинаем новый мазок: сохраняем начальную точку и создаём новый сегмент для истории
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

    // Рисуем линию от последней точки к текущей, добавляем точку в текущий сегмент
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

    // Завершаем мазок: сохраняем сегмент в историю и вызываем колбэк для сохранения в undo/redo
    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.ctx.globalCompositeOperation = 'source-over';

        if (this.currentSegment && this.currentSegment.points.length > 1) {
            this.segments.push(this.currentSegment);
            // Уведомляем снаружи - теперь можно сохранить в историю
            if (typeof this.onStrokeEnd === 'function') {
                this.onStrokeEnd();
            }
        }
        this.currentSegment = null;
    }

    // Перерисовывает все сегменты по нормализованным координатам.
    // Вызывается и после ресайза, и при undo/redo.
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

    // Меняет физический размер холста и перерисовывает.
    // Нормализованные координаты (0–1) не трогаем - они уже независимы от размера.
    resize(newWidth, newHeight) {
        if (newWidth < 100 || newHeight < 100) return;

        this.mainCanvas.width = newWidth;
        this.mainCanvas.height = newHeight;

        // После изменения размера нужно восстановить все мазки, так как канвас очищается.
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.redraw();
    }

    // Выбираем инструмент - просто меняем цвет и режим стирания.
    setInstrument(instrument) {
        this.currentInstrument = instrument;
        this.currentColor = this.instrumentColors[instrument] || '#00ffd1';
        this.isErasing = false;
    }

    // Включаем режим ластика
    setEraserMode(isEraser) {
        this.isErasing = isEraser;
    }

    // Полностью очищаем холст и историю
    clear() {
        this.segments = [];
        this.currentSegment = null;
        this.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    }

    // Сериализация - глубокая копия, чтобы история не мутировала
    getState() {
        return { segments: JSON.parse(JSON.stringify(this.segments)) };
    }

    // Десериализация - загружаем сегменты и перерисовываем
    loadState(state) {
        this.segments = state?.segments ? JSON.parse(JSON.stringify(state.segments)) : [];
        this.redraw();
    }

    // Для аудио-конвертации: вернуть все сегменты с метаданными
    getAllSegments() {
        return JSON.parse(JSON.stringify(this.segments));
    }
}

export default DrawingEngine;