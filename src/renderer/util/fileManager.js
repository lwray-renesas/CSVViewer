export class FileManager {
  constructor(signalManager) {
    this.signalManager = signalManager;
    this.files = [];
  }

  addFile(path, signalCount) {
    const fileRecord = {
      path,
      startIndex: this.signalManager.count - signalCount,
      count: signalCount,
      index: 0,
      element: null
    };

    this.files.push(fileRecord);
    this.reindex();

    return fileRecord;
  }

  removeFile(fileRecord) {
    // Remove signals associated with file from signal manager
    this.signalManager.removeRange(fileRecord.startIndex, fileRecord.count);
    // Destroy the HTML
    fileRecord.element?.remove();
    // Remove from internl storage.
    this.files = this.files.filter(f => f !== fileRecord);
    // reindex files.
    this.reindex();
  }

  removeSignal(datasetIndex) {
    const fileRecord = this.findFileContainingSignal(datasetIndex);
    this.signalManager.removeSignal(datasetIndex);

    if (fileRecord) {
      fileRecord.count--;

      if (fileRecord.count <= 0) {
        this.files = this.files.filter(f => f !== fileRecord);
      }
    }
    this.reindex();

    return fileRecord;
  }

  findFileContainingSignal(datasetIndex) {
    return this.files.find(
        file => datasetIndex >= file.startIndex &&
            datasetIndex < file.startIndex + file.count);
  }

  reindex() {
    let currentIndex = 0;
    this.files.forEach((file, fileIndex) => {
      file.index = fileIndex + 1;
      file.startIndex = currentIndex;

      currentIndex += file.count;
    });
  }
}