export class Signal {
  constructor(header, buffer, colour) {
    this.buffer = buffer;

    this.dataset = {
      label: '',
      rawHeader: header,
      data: buffer.map((y, x) => ({x, y})),
      borderColor: colour,
      borderWidth: 2,
      pointRadius: 0,
      yAxisID: 'y',
      order: 0
    };
  }
}


export class SignalManager {
  constructor() {
    this.signals = [];
    this.datasets = [];
    this.order = [];
  }

  get count() {
    return this.signals.length;
  }

  addSignal(header, buffer, colour) {
    const signal = new Signal(header, buffer, colour);
    signal.dataset.order = this.count;
    this.signals.push(signal);
    this.datasets.push(signal.dataset);
    this.order.push(this.count - 1);
  }

  removeSignal(index) {
    this.order = this.order.filter(i => i !== index);
    this.order = this.order.map(i => i > index ? i - 1 : i);
    this.signals.splice(index, 1);
    this.datasets.splice(index, 1);
  }

  moveSignal(fromVisualIndex, toVisualIndex) {
    const moved = this.order.splice(fromVisualIndex, 1)[0];
    this.order.splice(toVisualIndex, 0, moved);
    this.order.forEach((signalIndex, order) => {
      this.signals[signalIndex].dataset.order = order;
    });
  }

  removeRange(start, count) {
    this.order =
        this.order.filter(index => index < start || index >= start + count);
    this.order = this.order.map(index => index > start ? index - count : index);
    this.signals.splice(start, count);
    this.datasets.splice(start, count);
  }

  getSignal(index) {
    return this.signals[index];
  }

  getDataset(index) {
    return this.datasets[index];
  }

  getBuffer(index) {
    return this.signals[index]?.buffer;
  }

  visualItems() {
    return this.order.map(index => ({index, signal: this.signals[index]}));
  }
}
