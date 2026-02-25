/* ============================================
   Math Tools Pro - Módulo WinOLS
   Editor de binários ECU com Map Finder
   ============================================ */

const WinOLSModule = {
    buffer: null,
    modifiedBuffer: null,
    fileName: '',
    fileSize: 0,
    currentPage: 0,
    bytesPerRow: 16,
    rowsPerPage: 32,
    dataType: 'hex8',
    cursorOffset: -1,
    searchResults: [],
    searchIndex: -1,
    modifiedOffsets: new Set(),

    foundMaps: [],
    currentMapIndex: -1,
    meSelectedCells: new Set(),
    meMapData: null,
    meOriginalData: null,

    cmpBufferA: null,
    cmpBufferB: null,
    cmpNameA: '',
    cmpNameB: '',

    init() {
        this.setupTabs();
        this.setupHexEditor();
        this.setupMapFinder();
        this.setupMapEditor();
        this.setupCompare();
    },

    // ===================== TABS =====================
    setupTabs() {
        document.querySelectorAll('.winols-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.winols-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.winols-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`winols-${tab.dataset.wintab}`).classList.add('active');
            });
        });
    },

    // ===================== HEX EDITOR =====================
    setupHexEditor() {
        document.getElementById('winols-open-file').addEventListener('click', () => {
            document.getElementById('winols-file-input').click();
        });

        document.getElementById('winols-file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.loadFile(e.target.files[0]);
            e.target.value = '';
        });

        document.getElementById('winols-save-file').addEventListener('click', () => this.saveFile());
        document.getElementById('winols-goto-btn').addEventListener('click', () => this.gotoAddress());
        document.getElementById('winols-goto-addr').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.gotoAddress();
        });
        document.getElementById('winols-search-btn').addEventListener('click', () => this.searchHex());
        document.getElementById('winols-search-hex').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.searchHex();
        });
        document.getElementById('winols-search-next').addEventListener('click', () => this.searchNext());

        document.getElementById('winols-page-first').addEventListener('click', () => { this.currentPage = 0; this.renderHex(); });
        document.getElementById('winols-page-prev').addEventListener('click', () => { if (this.currentPage > 0) { this.currentPage--; this.renderHex(); } });
        document.getElementById('winols-page-next').addEventListener('click', () => {
            const max = this.totalPages() - 1;
            if (this.currentPage < max) { this.currentPage++; this.renderHex(); }
        });
        document.getElementById('winols-page-last').addEventListener('click', () => { this.currentPage = this.totalPages() - 1; this.renderHex(); });

        document.getElementById('winols-bytes-per-row').addEventListener('change', (e) => {
            this.bytesPerRow = parseInt(e.target.value);
            this.currentPage = 0;
            this.renderHex();
        });

        document.getElementById('winols-data-type').addEventListener('change', (e) => {
            this.dataType = e.target.value;
            this.renderHex();
        });
    },

    loadFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.buffer = new Uint8Array(e.target.result);
            this.modifiedBuffer = new Uint8Array(this.buffer);
            this.fileName = file.name;
            this.fileSize = file.size;
            this.currentPage = 0;
            this.cursorOffset = 0;
            this.modifiedOffsets.clear();
            this.searchResults = [];
            this.searchIndex = -1;

            document.getElementById('winols-filename').textContent = file.name;
            document.getElementById('winols-filesize').textContent = `(${App.formatFileSize(file.size)})`;
            document.getElementById('winols-save-file').disabled = false;
            document.getElementById('winols-hex-nav').style.display = 'flex';

            this.renderHex();
            this.updateMapFinderUI();
            App.toast(`Arquivo ${file.name} carregado com sucesso!`, 'success');
        };
        reader.readAsArrayBuffer(file);
    },

    saveFile() {
        if (!this.modifiedBuffer) return;
        const blob = new Blob([this.modifiedBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = this.fileName.includes('.') ? '' : '.bin';
        a.download = this.fileName.replace(/(\.[^.]+)$/, '-modified$1') || 'modified' + ext;
        a.click();
        URL.revokeObjectURL(url);
        App.toast('Arquivo salvo com sucesso!', 'success');
    },

    totalPages() {
        if (!this.modifiedBuffer) return 1;
        const bytesPerPage = this.bytesPerRow * this.rowsPerPage;
        return Math.ceil(this.modifiedBuffer.length / bytesPerPage);
    },

    renderHex() {
        if (!this.modifiedBuffer) return;

        const container = document.getElementById('winols-hex-view');
        const buf = this.modifiedBuffer;
        const bpr = this.bytesPerRow;
        const bytesPerPage = bpr * this.rowsPerPage;
        const startOffset = this.currentPage * bytesPerPage;
        const endOffset = Math.min(startOffset + bytesPerPage, buf.length);

        let html = '<div class="winols-hex-grid">';
        html += '<div class="winols-hex-header">';
        html += '<span class="winols-hex-addr-col">Offset</span>';

        const unitSize = this.getUnitSize();
        for (let i = 0; i < bpr; i += unitSize) {
            html += `<span class="winols-hex-byte-col">${i.toString(16).toUpperCase().padStart(2, '0')}</span>`;
        }
        html += '<span class="winols-hex-ascii-col">ASCII</span>';
        html += '</div>';

        for (let row = startOffset; row < endOffset; row += bpr) {
            html += '<div class="winols-hex-row">';
            html += `<span class="winols-hex-addr">${row.toString(16).toUpperCase().padStart(8, '0')}</span>`;

            let asciiStr = '';
            for (let col = 0; col < bpr; col += unitSize) {
                const offset = row + col;
                if (offset >= buf.length) {
                    html += '<span class="winols-hex-byte empty">  </span>';
                    asciiStr += ' ';
                    continue;
                }

                const val = this.readValue(buf, offset);
                const display = this.formatValue(val);
                const isModified = this.isModifiedRange(offset, unitSize);
                const isCursor = (offset === this.cursorOffset);
                const isSearch = this.searchResults.includes(offset);

                let cls = 'winols-hex-byte';
                if (isModified) cls += ' modified';
                if (isCursor) cls += ' cursor';
                if (isSearch) cls += ' search-hit';

                html += `<span class="${cls}" data-offset="${offset}" title="0x${offset.toString(16).toUpperCase()}">${display}</span>`;

                for (let k = 0; k < unitSize && (row + col + k) < buf.length; k++) {
                    const b = buf[row + col + k];
                    asciiStr += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
                }
            }

            html += `<span class="winols-hex-ascii">${this.escapeHtml(asciiStr)}</span>`;
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        document.getElementById('winols-page-info').textContent =
            `Página ${this.currentPage + 1} / ${this.totalPages()}`;

        container.querySelectorAll('.winols-hex-byte:not(.empty)').forEach(el => {
            el.addEventListener('click', (e) => {
                const off = parseInt(e.target.dataset.offset);
                this.cursorOffset = off;
                this.updateCursorInfo();
                this.renderHex();
            });

            el.addEventListener('dblclick', (e) => {
                const off = parseInt(e.target.dataset.offset);
                this.editByte(off, e.target);
            });
        });

        this.updateCursorInfo();
    },

    getUnitSize() {
        if (this.dataType.includes('16')) return 2;
        return 1;
    },

    readValue(buf, offset) {
        switch (this.dataType) {
            case 'hex8':
            case 'dec8':
                return buf[offset];
            case 'hex16le':
            case 'dec16le':
                if (offset + 1 >= buf.length) return buf[offset];
                return buf[offset] | (buf[offset + 1] << 8);
            case 'hex16be':
            case 'dec16be':
                if (offset + 1 >= buf.length) return buf[offset];
                return (buf[offset] << 8) | buf[offset + 1];
            default:
                return buf[offset];
        }
    },

    formatValue(val) {
        switch (this.dataType) {
            case 'hex8': return val.toString(16).toUpperCase().padStart(2, '0');
            case 'hex16le':
            case 'hex16be': return val.toString(16).toUpperCase().padStart(4, '0');
            case 'dec8': return val.toString().padStart(3, ' ');
            case 'dec16le':
            case 'dec16be': return val.toString().padStart(5, ' ');
            default: return val.toString(16).toUpperCase().padStart(2, '0');
        }
    },

    isModifiedRange(offset, size) {
        for (let i = 0; i < size; i++) {
            if (this.modifiedOffsets.has(offset + i)) return true;
        }
        return false;
    },

    updateCursorInfo() {
        if (!this.modifiedBuffer || this.cursorOffset < 0) return;
        const buf = this.modifiedBuffer;
        const off = this.cursorOffset;

        document.getElementById('winols-cursor-offset').textContent =
            `0x${off.toString(16).toUpperCase()} (${off})`;
        document.getElementById('winols-cursor-value').textContent =
            `0x${buf[off].toString(16).toUpperCase().padStart(2, '0')} (${buf[off]})`;

        if (off + 1 < buf.length) {
            const le16 = buf[off] | (buf[off + 1] << 8);
            const be16 = (buf[off] << 8) | buf[off + 1];
            document.getElementById('winols-cursor-int16le').textContent = `${le16} (0x${le16.toString(16).toUpperCase()})`;
            document.getElementById('winols-cursor-int16be').textContent = `${be16} (0x${be16.toString(16).toUpperCase()})`;
        } else {
            document.getElementById('winols-cursor-int16le').textContent = '-';
            document.getElementById('winols-cursor-int16be').textContent = '-';
        }

        if (off + 3 < buf.length) {
            const view = new DataView(buf.buffer, off, 4);
            const f = view.getFloat32(0, true);
            document.getElementById('winols-cursor-float').textContent = isFinite(f) ? f.toFixed(6) : 'NaN';
        } else {
            document.getElementById('winols-cursor-float').textContent = '-';
        }
    },

    editByte(offset, element) {
        if (!this.modifiedBuffer) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.modifiedBuffer[offset].toString(16).toUpperCase().padStart(2, '0');
        input.className = 'winols-hex-edit-input';
        input.maxLength = 2;

        element.textContent = '';
        element.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const val = parseInt(input.value, 16);
            if (!isNaN(val) && val >= 0 && val <= 255) {
                this.modifiedBuffer[offset] = val;
                if (this.buffer[offset] !== val) {
                    this.modifiedOffsets.add(offset);
                } else {
                    this.modifiedOffsets.delete(offset);
                }
            }
            this.renderHex();
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') this.renderHex();
        });
    },

    gotoAddress() {
        const input = document.getElementById('winols-goto-addr').value.trim();
        const addr = parseInt(input.replace(/^0x/i, ''), 16);
        if (isNaN(addr) || !this.modifiedBuffer) return;

        if (addr < 0 || addr >= this.modifiedBuffer.length) {
            App.toast('Endereço fora do alcance do arquivo.', 'warning');
            return;
        }

        const bytesPerPage = this.bytesPerRow * this.rowsPerPage;
        this.currentPage = Math.floor(addr / bytesPerPage);
        this.cursorOffset = addr;
        this.renderHex();
    },

    searchHex() {
        const input = document.getElementById('winols-search-hex').value.trim();
        if (!input || !this.modifiedBuffer) return;

        const pattern = input.replace(/[^0-9a-fA-F]/g, '');
        if (pattern.length < 2 || pattern.length % 2 !== 0) {
            App.toast('Insira um padrão hex válido (ex: FF 00 A5).', 'warning');
            return;
        }

        const searchBytes = [];
        for (let i = 0; i < pattern.length; i += 2) {
            searchBytes.push(parseInt(pattern.substr(i, 2), 16));
        }

        this.searchResults = [];
        const buf = this.modifiedBuffer;
        for (let i = 0; i <= buf.length - searchBytes.length; i++) {
            let found = true;
            for (let j = 0; j < searchBytes.length; j++) {
                if (buf[i + j] !== searchBytes[j]) { found = false; break; }
            }
            if (found) this.searchResults.push(i);
        }

        if (this.searchResults.length === 0) {
            App.toast('Padrão não encontrado.', 'warning');
            document.getElementById('winols-search-next').disabled = true;
            return;
        }

        this.searchIndex = 0;
        document.getElementById('winols-search-next').disabled = false;
        this.navigateToSearch();
        App.toast(`${this.searchResults.length} ocorrência(s) encontrada(s).`, 'info');
    },

    searchNext() {
        if (this.searchResults.length === 0) return;
        this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
        this.navigateToSearch();
    },

    navigateToSearch() {
        const addr = this.searchResults[this.searchIndex];
        const bytesPerPage = this.bytesPerRow * this.rowsPerPage;
        this.currentPage = Math.floor(addr / bytesPerPage);
        this.cursorOffset = addr;
        this.renderHex();

        document.getElementById('winols-selection-info').textContent =
            `Resultado ${this.searchIndex + 1} / ${this.searchResults.length}`;
    },

    escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // ===================== MAP FINDER =====================
    setupMapFinder() {
        document.getElementById('winols-mf-run').addEventListener('click', () => this.runMapFinder());
    },

    updateMapFinderUI() {
        const hasFile = !!this.modifiedBuffer;
        document.getElementById('winols-mf-nofile').style.display = hasFile ? 'none' : 'block';
        document.getElementById('winols-mf-controls').style.display = hasFile ? 'block' : 'none';

        if (hasFile) {
            document.getElementById('winols-mf-end').placeholder =
                `0x${(this.modifiedBuffer.length - 1).toString(16).toUpperCase()}`;
        }
    },

    runMapFinder() {
        if (!this.modifiedBuffer) return;

        const buf = this.modifiedBuffer;
        const dtype = document.getElementById('winols-mf-dtype').value;
        const minSize = parseInt(document.getElementById('winols-mf-minsize').value);
        const sensitivity = document.getElementById('winols-mf-sensitivity').value;

        let startAddr = 0;
        let endAddr = buf.length;
        const startInput = document.getElementById('winols-mf-start').value.trim();
        const endInput = document.getElementById('winols-mf-end').value.trim();
        if (startInput) startAddr = parseInt(startInput.replace(/^0x/i, ''), 16) || 0;
        if (endInput) endAddr = parseInt(endInput.replace(/^0x/i, ''), 16) || buf.length;

        document.getElementById('winols-mf-status').textContent = 'Buscando...';

        setTimeout(() => {
            const maps = this.detectMaps(buf, dtype, minSize, sensitivity, startAddr, endAddr);
            this.foundMaps = maps;

            document.getElementById('winols-mf-results').style.display = 'block';
            document.getElementById('winols-mf-count').textContent = maps.length;
            document.getElementById('winols-mf-status').textContent =
                `Concluído. ${maps.length} mapa(s) encontrado(s).`;

            this.renderMapFinderResults();
        }, 50);
    },

    detectMaps(buf, dtype, minSize, sensitivity, startAddr, endAddr) {
        const unitSize = dtype.includes('16') ? 2 : 1;
        const isBE = dtype.includes('be');
        const isSigned = dtype.startsWith('int');
        const results = [];

        const thresholds = {
            high: { smoothness: 0.6, maxZeroRatio: 0.9, minVariance: 0.5 },
            medium: { smoothness: 0.45, maxZeroRatio: 0.7, minVariance: 2 },
            low: { smoothness: 0.3, maxZeroRatio: 0.5, minVariance: 10 }
        };
        const th = thresholds[sensitivity];

        const readVal = (offset) => {
            if (offset + unitSize > buf.length) return null;
            if (unitSize === 1) {
                return isSigned ? ((buf[offset] > 127) ? buf[offset] - 256 : buf[offset]) : buf[offset];
            }
            let val;
            if (isBE) {
                val = (buf[offset] << 8) | buf[offset + 1];
            } else {
                val = buf[offset] | (buf[offset + 1] << 8);
            }
            if (isSigned && val > 32767) val -= 65536;
            return val;
        };

        const commonSizes = [];
        for (let rows = minSize; rows <= 32; rows++) {
            for (let cols = minSize; cols <= 32; cols++) {
                if (rows * cols >= minSize * minSize && rows * cols <= 1024) {
                    commonSizes.push([rows, cols]);
                }
            }
        }

        const step = unitSize;
        const checked = new Set();

        for (let addr = startAddr; addr < endAddr; addr += step) {
            if (checked.has(addr)) continue;

            for (const [rows, cols] of commonSizes) {
                const totalBytes = rows * cols * unitSize;
                if (addr + totalBytes > endAddr) continue;

                const values = [];
                let valid = true;
                let sum = 0, sumSq = 0, zeros = 0;
                const maxVal = unitSize === 1 ? 255 : 65535;

                for (let r = 0; r < rows && valid; r++) {
                    const rowVals = [];
                    for (let c = 0; c < cols; c++) {
                        const offset = addr + (r * cols + c) * unitSize;
                        const val = readVal(offset);
                        if (val === null) { valid = false; break; }
                        rowVals.push(val);
                        sum += val;
                        sumSq += val * val;
                        if (val === 0) zeros++;
                        if (!isSigned && (val < 0 || val > maxVal)) { valid = false; break; }
                    }
                    if (valid) values.push(rowVals);
                }

                if (!valid || values.length !== rows) continue;

                const n = rows * cols;
                const mean = sum / n;
                const variance = (sumSq / n) - (mean * mean);
                const zeroRatio = zeros / n;

                if (variance < th.minVariance) continue;
                if (zeroRatio > th.maxZeroRatio) continue;

                let smoothCount = 0;
                let totalNeighbors = 0;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols - 1; c++) {
                        const diff = Math.abs(values[r][c + 1] - values[r][c]);
                        const range = Math.max(Math.abs(values[r][c]), Math.abs(values[r][c + 1]), 1);
                        if (diff / range < 0.5) smoothCount++;
                        totalNeighbors++;
                    }
                }
                for (let r = 0; r < rows - 1; r++) {
                    for (let c = 0; c < cols; c++) {
                        const diff = Math.abs(values[r + 1][c] - values[r][c]);
                        const range = Math.max(Math.abs(values[r][c]), Math.abs(values[r + 1][c]), 1);
                        if (diff / range < 0.5) smoothCount++;
                        totalNeighbors++;
                    }
                }

                const smoothness = totalNeighbors > 0 ? smoothCount / totalNeighbors : 0;
                if (smoothness < th.smoothness) continue;

                let hasMonotonic = false;
                for (let r = 0; r < rows; r++) {
                    let incr = 0, decr = 0;
                    for (let c = 1; c < cols; c++) {
                        if (values[r][c] >= values[r][c - 1]) incr++;
                        if (values[r][c] <= values[r][c - 1]) decr++;
                    }
                    if (incr >= (cols - 1) * 0.7 || decr >= (cols - 1) * 0.7) {
                        hasMonotonic = true;
                        break;
                    }
                }
                if (!hasMonotonic) {
                    for (let c = 0; c < cols; c++) {
                        let incr = 0, decr = 0;
                        for (let r = 1; r < rows; r++) {
                            if (values[r][c] >= values[r - 1][c]) incr++;
                            if (values[r][c] <= values[r - 1][c]) decr++;
                        }
                        if (incr >= (rows - 1) * 0.7 || decr >= (rows - 1) * 0.7) {
                            hasMonotonic = true;
                            break;
                        }
                    }
                }

                const score = smoothness * 0.5 + (hasMonotonic ? 0.3 : 0) + (1 - zeroRatio) * 0.2;

                if (score > (sensitivity === 'high' ? 0.35 : sensitivity === 'medium' ? 0.5 : 0.65)) {
                    let overlaps = false;
                    for (const existing of results) {
                        if (addr >= existing.address && addr < existing.address + existing.totalBytes) {
                            if (score > existing.score) {
                                results.splice(results.indexOf(existing), 1);
                            } else {
                                overlaps = true;
                            }
                            break;
                        }
                    }

                    if (!overlaps) {
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                checked.add(addr + (r * cols + c) * unitSize);
                            }
                        }

                        results.push({
                            address: addr,
                            rows,
                            cols,
                            dtype,
                            values,
                            totalBytes: totalBytes,
                            score: parseFloat(score.toFixed(3)),
                            smoothness: parseFloat(smoothness.toFixed(3)),
                            variance: parseFloat(variance.toFixed(1)),
                            min: Math.min(...values.flat()),
                            max: Math.max(...values.flat()),
                            mean: parseFloat(mean.toFixed(2))
                        });
                    }
                }
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 100);
    },

    renderMapFinderResults() {
        const list = document.getElementById('winols-mf-list');
        if (this.foundMaps.length === 0) {
            list.innerHTML = '<p class="text-muted">Nenhum mapa detectado. Tente ajustar os parâmetros.</p>';
            return;
        }

        let html = '';
        this.foundMaps.forEach((map, idx) => {
            const scoreColor = map.score > 0.7 ? 'var(--accent-green)' :
                map.score > 0.5 ? 'var(--accent-orange)' : 'var(--accent-red)';

            html += `
                <div class="winols-mf-item" data-map-idx="${idx}">
                    <div class="winols-mf-item-header">
                        <span class="winols-mf-item-title">
                            <i class="fas fa-map"></i> Mapa #${idx + 1}
                        </span>
                        <span class="winols-mf-item-score" style="color:${scoreColor}">
                            Score: ${(map.score * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div class="winols-mf-item-details">
                        <span><i class="fas fa-map-pin"></i> 0x${map.address.toString(16).toUpperCase()}</span>
                        <span><i class="fas fa-th"></i> ${map.rows}×${map.cols}</span>
                        <span><i class="fas fa-memory"></i> ${map.dtype}</span>
                        <span><i class="fas fa-arrows-alt-v"></i> ${map.min} ~ ${map.max}</span>
                        <span><i class="fas fa-chart-line"></i> Suavidade: ${(map.smoothness * 100).toFixed(0)}%</span>
                    </div>
                    <div class="winols-mf-item-actions">
                        <button class="btn btn-sm btn-primary" onclick="WinOLSModule.openMapInEditor(${idx})">
                            <i class="fas fa-edit"></i> Editar Mapa
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="WinOLSModule.gotoMapInHex(${idx})">
                            <i class="fas fa-search"></i> Ver no Hex
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="WinOLSModule.previewMap3D(${idx})">
                            <i class="fas fa-cube"></i> Preview 3D
                        </button>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    },

    gotoMapInHex(idx) {
        const map = this.foundMaps[idx];
        if (!map) return;

        document.querySelectorAll('.winols-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.winols-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('.winols-tab[data-wintab="hex"]').classList.add('active');
        document.getElementById('winols-hex').classList.add('active');

        const bytesPerPage = this.bytesPerRow * this.rowsPerPage;
        this.currentPage = Math.floor(map.address / bytesPerPage);
        this.cursorOffset = map.address;
        this.renderHex();
    },

    previewMap3D(idx) {
        const map = this.foundMaps[idx];
        if (!map) return;

        const xVals = Array.from({ length: map.cols }, (_, i) => i);
        const yVals = Array.from({ length: map.rows }, (_, i) => i);

        const trace = {
            z: map.values,
            x: xVals,
            y: yVals,
            type: 'surface',
            colorscale: [
                [0, '#1e3a5f'], [0.25, '#3b82f6'],
                [0.5, '#10b981'], [0.75, '#f59e0b'], [1, '#ef4444']
            ],
            hovertemplate: 'Col: %{x}<br>Row: %{y}<br>Valor: %{z}<extra></extra>'
        };

        const layout = {
            title: {
                text: `Mapa #${idx + 1} @ 0x${map.address.toString(16).toUpperCase()} (${map.rows}×${map.cols})`,
                font: { color: '#e4e6f0', size: 14 }
            },
            scene: {
                xaxis: { title: 'Coluna', color: '#8b8fa3', gridcolor: '#2a2d3e' },
                yaxis: { title: 'Linha', color: '#8b8fa3', gridcolor: '#2a2d3e' },
                zaxis: { title: 'Valor', color: '#8b8fa3', gridcolor: '#2a2d3e' },
                bgcolor: '#1c1f2e',
                camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
            },
            paper_bgcolor: '#1c1f2e',
            plot_bgcolor: '#1c1f2e',
            font: { color: '#8b8fa3' },
            margin: { l: 0, r: 0, b: 0, t: 40 },
            autosize: true
        };

        App.showModal(
            `<i class="fas fa-cube"></i> Preview 3D - Mapa #${idx + 1}`,
            '<div id="winols-preview-3d" style="width:100%;height:450px;"></div>',
            `<button class="btn btn-primary" onclick="WinOLSModule.openMapInEditor(${idx}); App.closeModal();">
                <i class="fas fa-edit"></i> Abrir no Editor
            </button>`
        );

        setTimeout(() => {
            Plotly.newPlot('winols-preview-3d', [trace], layout, {
                responsive: true, displayModeBar: true, displaylogo: false
            });
        }, 100);
    },

    // ===================== MAP EDITOR =====================
    setupMapEditor() {
        document.getElementById('winols-me-view-2d').addEventListener('click', () => {
            document.getElementById('winols-me-2d').style.display = 'block';
            document.getElementById('winols-me-3d').style.display = 'none';
            document.getElementById('winols-me-view-2d').classList.add('active');
            document.getElementById('winols-me-view-3d').classList.remove('active');
        });

        document.getElementById('winols-me-view-3d').addEventListener('click', () => {
            document.getElementById('winols-me-2d').style.display = 'none';
            document.getElementById('winols-me-3d').style.display = 'block';
            document.getElementById('winols-me-view-2d').classList.remove('active');
            document.getElementById('winols-me-view-3d').classList.add('active');
            this.renderME3D();
        });

        document.getElementById('winols-me-apply').addEventListener('click', () => this.applyMapEdit());
        document.getElementById('winols-me-writeback').addEventListener('click', () => this.writeMapBack());
    },

    openMapInEditor(idx) {
        const map = this.foundMaps[idx];
        if (!map) return;

        this.currentMapIndex = idx;
        this.meMapData = map.values.map(row => [...row]);
        this.meOriginalData = map.values.map(row => [...row]);
        this.meSelectedCells.clear();

        document.querySelectorAll('.winols-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.winols-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('.winols-tab[data-wintab="mapeditor"]').classList.add('active');
        document.getElementById('winols-mapeditor').classList.add('active');

        document.getElementById('winols-me-empty').style.display = 'none';
        document.getElementById('winols-me-content').style.display = 'block';

        document.getElementById('winols-me-name').textContent = `Mapa #${idx + 1}`;
        document.getElementById('winols-me-addr').textContent = `0x${map.address.toString(16).toUpperCase()}`;
        document.getElementById('winols-me-size').textContent = `${map.rows}×${map.cols}`;
        document.getElementById('winols-me-dtype').textContent = map.dtype;

        this.renderME2D();
        if (document.getElementById('winols-me-3d').style.display !== 'none') {
            this.renderME3D();
        }
    },

    renderME2D() {
        if (!this.meMapData) return;
        const data = this.meMapData;
        const orig = this.meOriginalData;
        const allVals = data.flat();
        const minVal = Math.min(...allVals);
        const maxVal = Math.max(...allVals);

        const table = document.getElementById('winols-me-table');
        let html = '<thead><tr><th>Row\\Col</th>';
        for (let c = 0; c < data[0].length; c++) {
            html += `<th>${c}</th>`;
        }
        html += '</tr></thead><tbody>';

        data.forEach((row, ri) => {
            html += `<tr><td>${ri}</td>`;
            row.forEach((val, ci) => {
                const cellId = `${ri}-${ci}`;
                const color = this.getHeatColor(val, minVal, maxVal);
                const isSelected = this.meSelectedCells.has(cellId);
                const changed = orig && orig[ri][ci] !== val;
                html += `<td class="editable${isSelected ? ' selected' : ''}"
                             data-row="${ri}" data-col="${ci}"
                             style="background:${color};${changed ? 'font-weight:700;color:var(--accent-cyan);' : ''}"
                             title="[${ri},${ci}] = ${val}">${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        table.innerHTML = html;

        const legend = document.getElementById('winols-me-legend');
        legend.innerHTML = `
            <span>${minVal}</span>
            <div class="map-legend-bar"></div>
            <span>${maxVal}</span>
        `;

        table.querySelectorAll('td.editable').forEach(td => {
            td.addEventListener('click', (e) => {
                const r = parseInt(td.dataset.row);
                const c = parseInt(td.dataset.col);
                const cellId = `${r}-${c}`;
                if (e.ctrlKey || e.metaKey) {
                    if (this.meSelectedCells.has(cellId)) {
                        this.meSelectedCells.delete(cellId);
                    } else {
                        this.meSelectedCells.add(cellId);
                    }
                } else {
                    this.meSelectedCells.clear();
                    this.meSelectedCells.add(cellId);
                }
                this.renderME2D();
            });

            td.addEventListener('dblclick', () => {
                const r = parseInt(td.dataset.row);
                const c = parseInt(td.dataset.col);
                const current = this.meMapData[r][c];

                const input = document.createElement('input');
                input.type = 'number';
                input.value = current;
                input.style.cssText = 'width:100%;background:var(--bg-input);border:1px solid var(--accent-blue);color:var(--accent-cyan);text-align:center;padding:2px;font-family:Consolas;font-size:0.82rem;border-radius:3px;';

                td.textContent = '';
                td.appendChild(input);
                input.focus();
                input.select();

                const commit = () => {
                    const val = parseInt(input.value);
                    if (!isNaN(val)) this.meMapData[r][c] = val;
                    this.renderME2D();
                    if (document.getElementById('winols-me-3d').style.display !== 'none') this.renderME3D();
                };

                input.addEventListener('blur', commit);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') commit();
                    if (ev.key === 'Escape') this.renderME2D();
                });
            });
        });
    },

    renderME3D() {
        if (!this.meMapData) return;
        const data = this.meMapData;
        const map = this.foundMaps[this.currentMapIndex];

        const trace = {
            z: data,
            x: Array.from({ length: data[0].length }, (_, i) => i),
            y: Array.from({ length: data.length }, (_, i) => i),
            type: 'surface',
            colorscale: [
                [0, '#1e3a5f'], [0.25, '#3b82f6'],
                [0.5, '#10b981'], [0.75, '#f59e0b'], [1, '#ef4444']
            ],
            hovertemplate: 'Col: %{x}<br>Row: %{y}<br>Valor: %{z}<extra></extra>'
        };

        const layout = {
            scene: {
                xaxis: { title: 'Coluna', color: '#8b8fa3', gridcolor: '#2a2d3e' },
                yaxis: { title: 'Linha', color: '#8b8fa3', gridcolor: '#2a2d3e' },
                zaxis: { title: 'Valor', color: '#8b8fa3', gridcolor: '#2a2d3e' },
                bgcolor: '#1c1f2e',
                camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
            },
            paper_bgcolor: '#1c1f2e',
            plot_bgcolor: '#1c1f2e',
            font: { color: '#8b8fa3' },
            margin: { l: 0, r: 0, b: 0, t: 30 },
            autosize: true
        };

        Plotly.newPlot('winols-me-3dplot', [trace], layout, {
            responsive: true, displayModeBar: true, displaylogo: false
        });
    },

    applyMapEdit() {
        if (!this.meMapData || this.meSelectedCells.size === 0) {
            App.toast('Selecione células para editar.', 'warning');
            return;
        }

        const op = document.getElementById('winols-me-op').value;
        const value = parseFloat(document.getElementById('winols-me-value').value);
        if (isNaN(value)) {
            App.toast('Insira um valor numérico.', 'warning');
            return;
        }

        this.meSelectedCells.forEach(cellId => {
            const [r, c] = cellId.split('-').map(Number);
            let current = this.meMapData[r][c];
            switch (op) {
                case 'add': current += value; break;
                case 'sub': current -= value; break;
                case 'mul': current *= value; break;
                case 'set': current = value; break;
                case 'pct': current *= (1 + value / 100); break;
            }
            this.meMapData[r][c] = Math.round(current);
        });

        this.renderME2D();
        if (document.getElementById('winols-me-3d').style.display !== 'none') this.renderME3D();
        App.toast(`${this.meSelectedCells.size} célula(s) editada(s).`, 'success');
    },

    writeMapBack() {
        if (!this.meMapData || !this.modifiedBuffer || this.currentMapIndex < 0) return;

        const map = this.foundMaps[this.currentMapIndex];
        const dtype = map.dtype;
        const unitSize = dtype.includes('16') ? 2 : 1;
        const isBE = dtype.includes('be');
        const buf = this.modifiedBuffer;

        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                const offset = map.address + (r * map.cols + c) * unitSize;
                let val = this.meMapData[r][c];

                if (unitSize === 1) {
                    val = Math.max(0, Math.min(255, val));
                    buf[offset] = val;
                    if (this.buffer[offset] !== val) this.modifiedOffsets.add(offset);
                } else {
                    val = Math.max(0, Math.min(65535, val));
                    if (isBE) {
                        buf[offset] = (val >> 8) & 0xFF;
                        buf[offset + 1] = val & 0xFF;
                    } else {
                        buf[offset] = val & 0xFF;
                        buf[offset + 1] = (val >> 8) & 0xFF;
                    }
                    if (this.buffer[offset] !== buf[offset]) this.modifiedOffsets.add(offset);
                    if (this.buffer[offset + 1] !== buf[offset + 1]) this.modifiedOffsets.add(offset + 1);
                }
            }
        }

        map.values = this.meMapData.map(row => [...row]);
        this.meOriginalData = this.meMapData.map(row => [...row]);
        this.renderME2D();

        App.toast('Mapa gravado no binário! Use "Salvar .bin" no Hex Editor para exportar.', 'success');
    },

    getHeatColor(value, min, max) {
        if (max === min) return 'rgba(59, 130, 246, 0.3)';
        const ratio = (value - min) / (max - min);
        const colors = [
            { r: 30, g: 58, b: 95 },
            { r: 59, g: 130, b: 246 },
            { r: 16, g: 185, b: 129 },
            { r: 245, g: 158, b: 11 },
            { r: 239, g: 68, b: 68 }
        ];
        const segment = ratio * (colors.length - 1);
        const i = Math.min(Math.floor(segment), colors.length - 2);
        const t = segment - i;
        const c1 = colors[i];
        const c2 = colors[i + 1];
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        return `rgba(${r}, ${g}, ${b}, 0.5)`;
    },

    // ===================== COMPARE =====================
    setupCompare() {
        document.getElementById('winols-cmp-open-a').addEventListener('click', () => {
            document.getElementById('winols-cmp-input-a').click();
        });
        document.getElementById('winols-cmp-open-b').addEventListener('click', () => {
            document.getElementById('winols-cmp-input-b').click();
        });

        document.getElementById('winols-cmp-input-a').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.cmpBufferA = new Uint8Array(ev.target.result);
                    this.cmpNameA = file.name;
                    document.getElementById('winols-cmp-name-a').textContent =
                        `${file.name} (${App.formatFileSize(file.size)})`;
                    this.updateCmpButton();
                };
                reader.readAsArrayBuffer(file);
            }
            e.target.value = '';
        });

        document.getElementById('winols-cmp-input-b').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.cmpBufferB = new Uint8Array(ev.target.result);
                    this.cmpNameB = file.name;
                    document.getElementById('winols-cmp-name-b').textContent =
                        `${file.name} (${App.formatFileSize(file.size)})`;
                    this.updateCmpButton();
                };
                reader.readAsArrayBuffer(file);
            }
            e.target.value = '';
        });

        document.getElementById('winols-cmp-run').addEventListener('click', () => this.runCompare());
    },

    updateCmpButton() {
        document.getElementById('winols-cmp-run').disabled = !(this.cmpBufferA && this.cmpBufferB);
    },

    runCompare() {
        if (!this.cmpBufferA || !this.cmpBufferB) return;

        const a = this.cmpBufferA;
        const b = this.cmpBufferB;
        const dtype = document.getElementById('winols-cmp-dtype').value;
        const filter = document.getElementById('winols-cmp-filter').value;
        const unitSize = dtype.includes('16') ? 2 : 1;
        const isBE = dtype.includes('be');
        const isHex = dtype.startsWith('hex');
        const maxLen = Math.max(a.length, b.length);

        const readVal = (buf, offset) => {
            if (offset >= buf.length) return null;
            if (unitSize === 1) return buf[offset];
            if (offset + 1 >= buf.length) return buf[offset];
            return isBE ? ((buf[offset] << 8) | buf[offset + 1]) : (buf[offset] | (buf[offset + 1] << 8));
        };

        const fmtVal = (val) => {
            if (val === null) return '-';
            if (isHex) {
                return unitSize === 1 ?
                    val.toString(16).toUpperCase().padStart(2, '0') :
                    val.toString(16).toUpperCase().padStart(4, '0');
            }
            return val.toString();
        };

        let diffs = 0;
        const tbody = document.getElementById('winols-cmp-tbody');
        let html = '';
        const MAX_ROWS = 5000;
        let rowCount = 0;

        for (let offset = 0; offset < maxLen && rowCount < MAX_ROWS; offset += unitSize) {
            const valA = readVal(a, offset);
            const valB = readVal(b, offset);
            const isDiff = valA !== valB;
            if (isDiff) diffs++;

            if (filter === 'diff' && !isDiff) continue;

            const diffVal = (valA !== null && valB !== null) ? valB - valA : '-';
            html += `<tr class="${isDiff ? 'winols-cmp-diff' : ''}">
                <td>0x${offset.toString(16).toUpperCase().padStart(8, '0')}</td>
                <td>${fmtVal(valA)}</td>
                <td>${fmtVal(valB)}</td>
                <td>${typeof diffVal === 'number' ? (diffVal >= 0 ? '+' : '') + diffVal : diffVal}</td>
            </tr>`;
            rowCount++;
        }

        if (rowCount >= MAX_ROWS) {
            html += `<tr><td colspan="4" style="color:var(--accent-orange);text-align:center;">
                Exibição limitada a ${MAX_ROWS} linhas. Total de diferenças: ${diffs}
            </td></tr>`;
        }

        tbody.innerHTML = html;
        document.getElementById('winols-cmp-diff-count').textContent = diffs;
        document.getElementById('winols-cmp-size-a').textContent = App.formatFileSize(a.length);
        document.getElementById('winols-cmp-size-b').textContent = App.formatFileSize(b.length);
        document.getElementById('winols-cmp-results').style.display = 'block';

        App.toast(`Comparação concluída. ${diffs} diferença(s) encontrada(s).`, diffs > 0 ? 'info' : 'success');
    }
};
