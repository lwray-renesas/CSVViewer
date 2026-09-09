export class CsvLoader {
  constructor(api) {
    this.api = api;

    this.loading = false;
    this.headers = null;
    this.buffers = [];
    this.path = '';
    this.headerSeen = false;
  }

  begin(path) {
    this.path = path;
    this.headers = null;
    this.buffers = [];
    this.headerSeen = false;
    this.loading = true;
  }

  processChunk(lines) {
    for (const line of lines) {
      const parts = line.split(',');

      if (!this.headerSeen) {
        this.headers = parts.map(h => h.replace(/^#+/, '').trim());
        this.buffers = this.headers.map(() => []);
        this.headerSeen = true;
        continue;
      }

      const isInvalid = parts.some(v => {
        const value = v.trim();
        return value === '' || Number.isNaN(Number(value));
      });

      if (isInvalid) {
        continue;
      }

      parts.forEach((value, index) => {
        const num = Number(value);
        this.buffers[index].push(Number.isNaN(num) ? null : num);
      });
    }
  }

  async load(onProgress) {
    while (this.loading) {
      const chunk = await this.api.GetCsvChunk();
      if (onProgress) {
        onProgress(chunk.progress);
      }

      this.processChunk(chunk.rows);

      if (chunk.done) {
        this.loading = false;
      }
    }

    return {path: this.path, headers: this.headers, buffers: this.buffers};
  }
}