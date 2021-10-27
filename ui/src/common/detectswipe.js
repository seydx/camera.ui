class DetectSwipe {
  constructor() {
    this.swipe_det = {
      sX: 0,
      sY: 0,
      eX: 0,
      eY: 0,
    };

    this.min_x = 150; //min x swipe for horizontal swipe
    this.max_x = 30; //max x difference for vertical swipe
    this.min_y = 50; //min y swipe for vertical swipe
    this.max_y = 200; //max y difference for horizontal swipe

    this.direction = '';
    this.mousedown = false;

    this.ele = null;
    this.target = null;
  }

  startEvent(event) {
    this.direction = '';
    this.swipe_det = {
      sX: 0,
      sY: 0,
      eX: 0,
      eY: 0,
    };

    if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'SELECT') {
      if (event.type === 'mousedown') {
        this.mousedown = true;
        this.swipe_det.sX = event.pageX;
        this.swipe_det.sY = event.pageY;
      } else {
        const t = event.touches[0];
        this.swipe_det.sX = t.screenX;
        this.swipe_det.sY = t.screenY;
      }

      this.target = event.target;
    }
  }

  moveEvent(event) {
    if (event.type === 'mousemove') {
      if (this.mousedown) {
        this.swipe_det.eX = event.pageX;
        this.swipe_det.eY = event.pageY;
      }
    } else {
      const t = event.touches[0];
      this.swipe_det.eX = t.screenX;
      this.swipe_det.eY = t.screenY;
    }
  }

  stopEvent(event, ele, function_) {
    //this.min_x = Math.abs(this.swipe_det.eY - this.swipe_det.sY);

    if (
      (this.swipe_det.eX - this.min_x > this.swipe_det.sX || this.swipe_det.eX + this.min_x < this.swipe_det.sX) &&
      /*this.swipe_det.eY < this.swipe_det.sY + this.max_y &&
      this.swipe_det.sY > this.swipe_det.eY - this.max_y &&*/
      this.swipe_det.eX > 0 &&
      this.swipe_det.sX > 0
    ) {
      this.direction = this.swipe_det.eX > this.swipe_det.sX ? 'right' : 'left';
    } else if (
      (this.swipe_det.eY - this.min_y > this.swipe_det.sY || this.swipe_det.eY + this.min_y < this.swipe_det.sY) &&
      /*this.swipe_det.eX < this.swipe_det.sX + this.max_x &&
      this.swipe_det.sX > this.swipe_det.eX - this.max_x &&*/
      this.swipe_det.eY > 0 &&
      this.swipe_det.sY > 0
    ) {
      this.direction = this.swipe_det.eY > this.swipe_det.sY ? 'down' : 'up';
    }

    if (this.direction != '' && typeof function_ == 'function') {
      function_(ele, this.target, this.direction, event);
    }

    if (event.type === 'mouseup') {
      this.mousedown = false;
    }

    this.direction = '';
    this.swipe_det = {
      sX: 0,
      sY: 0,
      eX: 0,
      eY: 0,
    };
  }

  detect(element, function_) {
    this.ele = document.querySelector(element);

    for (const event_ of ['touchstart', 'mousedown'])
      this.ele.addEventListener(
        event_,
        (event) => {
          this.startEvent(event);
        },
        false
      );

    for (const event_ of ['touchmove', 'mousemove'])
      this.ele.addEventListener(
        event_,
        (event) => {
          this.moveEvent(event);
        },
        false
      );

    for (const event_ of ['touchend', 'mouseup'])
      this.ele.addEventListener(
        event_,
        (event) => {
          this.stopEvent(event, this.ele, function_);
        },
        false
      );
  }

  stop() {
    for (const event_ of ['touchstart', 'mousedown']) {
      if (this.ele) this.ele.removeEventListener(event_, this.startEvent);
    }

    for (const event_ of ['touchmove', 'mousemove']) {
      if (this.ele) this.ele.removeEventListener(event_, this.moveEvent);
    }

    for (const event_ of ['touchend', 'mouseup']) {
      if (this.ele) this.ele.removeEventListener(event_, this.stopEvent);
    }

    this.ele = null;
  }
}

export default new DetectSwipe();
