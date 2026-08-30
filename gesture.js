/**
 * GestureController - 纯手势交互控制（拖拽、缩放、双击放大、双指点击缩小）
 * 用法：const gesture = new GestureController(canvas, { onTransform, minScale, maxScale });
 *       gesture.setTransform(offsetX, offsetY, scale);
 *       gesture.destroy();
 */
class GestureController {
    constructor(element, options = {}) {
        this.element = element;
        this.onTransform = options.onTransform || (() => {});
        this.minScale = options.minScale || 0.00001;
        this.maxScale = options.maxScale || 100;

        this.transform = { offsetX: 0, offsetY: 0, scale: 1 };

        // 鼠标拖拽
        this._isDragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;

        // 双指捏合
        this._isPinched = false;
        this._startDistance = 0;
        this._lastScale = 1;
        this._startTouchCenterX = 0;
        this._startTouchCenterY = 0;
        this._pinchStartOffsetX = 0;
        this._pinchStartOffsetY = 0;

        // 双击检测
        this._lastTapTime = 0;
        this._lastTapX = 0;
        this._lastTapY = 0;

        // 双指点击（轻触）检测
        this._twoFingerTapStartTime = 0;
        this._twoFingerTapStartX = 0;
        this._twoFingerTapStartY = 0;
        this._twoFingerTapCandidate = false;
        this._twoFingerActive = false;

        this._bindEvents();
    }

    // ----- 公共方法 -----
    setTransform(offsetX, offsetY, scale) {
        this.transform.offsetX = offsetX;
        this.transform.offsetY = offsetY;
        this.transform.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));
        this._emit();
    }

    zoom(cx, cy, factor) {
        const oldScale = this.transform.scale;
        let newScale = oldScale * factor;
        newScale = Math.min(this.maxScale, Math.max(this.minScale, newScale));
        const ratio = newScale / oldScale;
        this.transform.offsetX = cx - (cx - this.transform.offsetX) * ratio;
        this.transform.offsetY = cy - (cy - this.transform.offsetY) * ratio;
        this.transform.scale = newScale;
        this._emit();
    }

    destroy() {
        const el = this.element;
        el.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        el.removeEventListener('wheel', this._onWheel);
        el.removeEventListener('touchstart', this._onTouchStart);
        el.removeEventListener('touchmove', this._onTouchMove);
        el.removeEventListener('touchend', this._onTouchEnd);
    }

    // ----- 内部方法 -----
    _getRect() {
        return this.element.getBoundingClientRect();
    }

    _emit() {
        this.onTransform(this.transform.offsetX, this.transform.offsetY, this.transform.scale);
    }

    _bindEvents() {
        const el = this.element;
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        el.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        el.addEventListener('wheel', this._onWheel, { passive: false });
        el.addEventListener('touchstart', this._onTouchStart, { passive: false });
        el.addEventListener('touchmove', this._onTouchMove, { passive: false });
        el.addEventListener('touchend', this._onTouchEnd, { passive: false });
    }

    // ---- 鼠标 ----
    _onMouseDown(e) {
        this._isDragging = true;
        const rect = this._getRect();
        this._dragStartX = e.clientX - rect.left - this.transform.offsetX;
        this._dragStartY = e.clientY - rect.top - this.transform.offsetY;
    }

    _onMouseMove(e) {
        if (!this._isDragging) return;
        const rect = this._getRect();
        this.transform.offsetX = e.clientX - rect.left - this._dragStartX;
        this.transform.offsetY = e.clientY - rect.top - this._dragStartY;
        this._emit();
    }

    _onMouseUp() {
        this._isDragging = false;
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this._getRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const oldScale = this.transform.scale;
        let newScale = oldScale * (1 + delta);
        newScale = Math.min(this.maxScale, Math.max(this.minScale, newScale));
        const ratio = newScale / oldScale;
        this.transform.offsetX = cx - (cx - this.transform.offsetX) * ratio;
        this.transform.offsetY = cy - (cy - this.transform.offsetY) * ratio;
        this.transform.scale = newScale;
        this._emit();
    }

    // ---- 触摸 ----
    _onTouchStart(e) {
        const touches = e.touches;
        const rect = this._getRect();

        if (touches.length === 1) {
            this._isDragging = true;
            this._isPinched = false;
            const touch = touches[0];
            const cx = touch.clientX - rect.left;
            const cy = touch.clientY - rect.top;
            this._dragStartX = cx - this.transform.offsetX;
            this._dragStartY = cy - this.transform.offsetY;

            const now = Date.now();
            if (now - this._lastTapTime < 300 && Math.hypot(cx - this._lastTapX, cy - this._lastTapY) < 20) {
                this.zoom(cx, cy, 1.5);
                this._lastTapTime = 0;
            } else {
                this._lastTapTime = now;
                this._lastTapX = cx;
                this._lastTapY = cy;
            }
        } else if (touches.length === 2) {
            this._isDragging = false;
            this._isPinched = true;
            const t1 = touches[0], t2 = touches[1];
            this._startDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            this._startTouchCenterX = (t1.clientX + t2.clientX) / 2 - rect.left;
            this._startTouchCenterY = (t1.clientY + t2.clientY) / 2 - rect.top;
            this._lastScale = this.transform.scale;
            this._pinchStartOffsetX = this.transform.offsetX;
            this._pinchStartOffsetY = this.transform.offsetY;

            this._twoFingerTapStartTime = Date.now();
            this._twoFingerTapStartX = this._startTouchCenterX;
            this._twoFingerTapStartY = this._startTouchCenterY;
            this._twoFingerTapCandidate = true;
            this._twoFingerActive = true;
        }
    }

    _onTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;
        const rect = this._getRect();

        if (this._isDragging && touches.length === 1) {
            const touch = touches[0];
            const cx = touch.clientX - rect.left;
            const cy = touch.clientY - rect.top;
            this.transform.offsetX = cx - this._dragStartX;
            this.transform.offsetY = cy - this._dragStartY;
            this._emit();
        } else if (this._isPinched && touches.length === 2) {
            const t1 = touches[0], t2 = touches[1];
            const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            if (this._startDistance > 0) {
                const currentCenterX = (t1.clientX + t2.clientX) / 2 - rect.left;
                const currentCenterY = (t1.clientY + t2.clientY) / 2 - rect.top;
                const factor = currentDistance / this._startDistance;
                let newScale = this._lastScale * factor;
                newScale = Math.min(this.maxScale, Math.max(this.minScale, newScale));
                const ratio = newScale / this._lastScale;
                this.transform.offsetX = currentCenterX - (this._startTouchCenterX - this._pinchStartOffsetX) * ratio;
                this.transform.offsetY = currentCenterY - (this._startTouchCenterY - this._pinchStartOffsetY) * ratio;
                this.transform.scale = newScale;
                this._emit();
            }
            if (this._twoFingerTapCandidate) {
                const cx = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
                const cy = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
                if (Math.hypot(cx - this._twoFingerTapStartX, cy - this._twoFingerTapStartY) > 20) {
                    this._twoFingerTapCandidate = false;
                }
            }
        }
    }

    _onTouchEnd(e) {
        const remaining = e.touches.length;

        if (remaining === 0) {
            if (this._twoFingerTapCandidate && (Date.now() - this._twoFingerTapStartTime < 300)) {
                this.zoom(this._twoFingerTapStartX, this._twoFingerTapStartY, 0.7);
            }
            this._isDragging = false;
            this._isPinched = false;
            this._twoFingerTapCandidate = false;
            this._twoFingerActive = false;
        } else if (remaining === 1) {
            if (this._twoFingerActive) {
                this._twoFingerTapCandidate = false;
                this._twoFingerActive = false;
            }
            this._isDragging = true;
            this._isPinched = false;
            const rect = this._getRect();
            const touch = e.touches[0];
            this._dragStartX = touch.clientX - rect.left - this.transform.offsetX;
            this._dragStartY = touch.clientY - rect.top - this.transform.offsetY;
        }
    }
}