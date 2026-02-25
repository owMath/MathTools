/* ============================================
   Math Tools Pro - Módulo de Checksum & Ferramentas
   ============================================ */

const ChecksumModule = {
    fileBuffer: null,
    correctionBuffer: null,
    me7Buffer: null,
    compareBufferA: null,
    compareBufferB: null,

    init() {
        this.setupTabs();
        this.setupCalculator();
        this.setupConverter();
        this.setupFileChecksum();
        this.setupByteTools();
        this.setupDutyCycle();
        this.setupCorrection();
        this.setupME7Profile();
        this.setupBinCompare();
        this.setupProfiles();
    },

    // ===================== TABS =====================
    setupTabs() {
        document.querySelectorAll('.tool-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tool-${tab.dataset.tool}`).classList.add('active');
            });
        });
    },

    // ===================== HELPERS =====================
    parseHexInput(input) {
        const cleaned = input.replace(/[^0-9a-fA-F]/g, '');
        const bytes = [];
        for (let i = 0; i < cleaned.length; i += 2) {
            if (i + 1 < cleaned.length) {
                bytes.push(parseInt(cleaned.substr(i, 2), 16));
            }
        }
        return new Uint8Array(bytes);
    },

    parseHexAddr(str) {
        if (!str) return NaN;
        str = str.trim().toLowerCase().replace(/^0x/, '');
        return parseInt(str, 16);
    },

    calcSum8(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum = (sum + data[i]) & 0xFF;
        return sum;
    },

    calcSum16(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum = (sum + data[i]) & 0xFFFF;
        return sum;
    },

    calcSum32(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum = (sum + data[i]) & 0xFFFFFFFF;
        return sum >>> 0;
    },

    calcXOR8(data) {
        let result = 0;
        for (let i = 0; i < data.length; i++) result ^= data[i];
        return result;
    },

    calcCRC16(data) {
        let crc = 0xFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= (data[i] << 8);
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
                } else {
                    crc = (crc << 1) & 0xFFFF;
                }
            }
        }
        return crc;
    },

    calcCRC32(data) {
        if (!this._crc32Table) {
            this._crc32Table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                this._crc32Table[i] = c;
            }
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = this._crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    },

    calculateAll(data) {
        return {
            sum8: this.calcSum8(data),
            sum16: this.calcSum16(data),
            sum32: this.calcSum32(data),
            xor8: this.calcXOR8(data),
            crc16: this.calcCRC16(data),
            crc32: this.calcCRC32(data)
        };
    },

    calcByAlgorithm(data, algo) {
        const map = {
            sum8: () => this.calcSum8(data),
            sum16: () => this.calcSum16(data),
            sum32: () => this.calcSum32(data),
            xor8: () => this.calcXOR8(data),
            crc16: () => this.calcCRC16(data),
            crc32: () => this.calcCRC32(data)
        };
        return (map[algo] || map.sum16)();
    },

    algoBits(algo) {
        const map = { sum8: 8, sum16: 16, sum32: 32, xor8: 8, crc16: 16, crc32: 32 };
        return map[algo] || 16;
    },

    algoBytes(algo) {
        return this.algoBits(algo) / 8;
    },

    formatResult(value, bits) {
        const hexLen = Math.ceil(bits / 4);
        return {
            hex: '0x' + value.toString(16).toUpperCase().padStart(hexLen, '0'),
            dec: value.toString(10),
            bin: value.toString(2).padStart(bits, '0')
        };
    },

    readBytesAt(buffer, offset, count, endian) {
        const view = new DataView(buffer);
        if (count === 1) return view.getUint8(offset);
        if (count === 2) return endian === 'little' ? view.getUint16(offset, true) : view.getUint16(offset, false);
        if (count === 4) return endian === 'little' ? view.getUint32(offset, true) : view.getUint32(offset, false);
        return 0;
    },

    writeBytesAt(buffer, offset, count, value, endian) {
        const view = new DataView(buffer);
        if (count === 1) view.setUint8(offset, value & 0xFF);
        else if (count === 2) {
            if (endian === 'little') view.setUint16(offset, value & 0xFFFF, true);
            else view.setUint16(offset, value & 0xFFFF, false);
        } else if (count === 4) {
            if (endian === 'little') view.setUint32(offset, value >>> 0, true);
            else view.setUint32(offset, value >>> 0, false);
        }
    },

    downloadBin(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    setupDragDrop(areaEl, inputEl, callback) {
        areaEl.addEventListener('click', () => inputEl.click());
        areaEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            areaEl.style.borderColor = 'var(--accent-blue)';
            areaEl.style.background = 'var(--accent-blue-glow)';
        });
        areaEl.addEventListener('dragleave', () => {
            areaEl.style.borderColor = '';
            areaEl.style.background = '';
        });
        areaEl.addEventListener('drop', (e) => {
            e.preventDefault();
            areaEl.style.borderColor = '';
            areaEl.style.background = '';
            if (e.dataTransfer.files.length > 0) callback(e.dataTransfer.files[0]);
        });
        inputEl.addEventListener('change', () => {
            if (inputEl.files.length > 0) callback(inputEl.files[0]);
        });
    },

    // ===================== CALCULADORA =====================
    setupCalculator() {
        document.getElementById('btn-calculate-checksum').addEventListener('click', () => {
            const input = document.getElementById('checksum-input').value.trim();
            if (!input) {
                App.toast('Insira dados hexadecimais para calcular.', 'warning');
                return;
            }

            const data = this.parseHexInput(input);
            if (data.length === 0) {
                App.toast('Dados hexadecimais inválidos.', 'error');
                return;
            }

            const algo = document.getElementById('checksum-algorithm').value;
            const results = this.calculateAll(data);
            const resultContainer = document.getElementById('checksum-result');
            const valuesContainer = document.getElementById('checksum-result-values');

            const items = [];
            const algoMap = {
                sum8: { name: 'Sum8', value: results.sum8, bits: 8 },
                sum16: { name: 'Sum16', value: results.sum16, bits: 16 },
                sum32: { name: 'Sum32', value: results.sum32, bits: 32 },
                xor8: { name: 'XOR8', value: results.xor8, bits: 8 },
                crc16: { name: 'CRC-16', value: results.crc16, bits: 16 },
                crc32: { name: 'CRC-32', value: results.crc32, bits: 32 }
            };

            const selected = algoMap[algo];
            const f = this.formatResult(selected.value, selected.bits);
            items.push(
                this.createResultItem(`${selected.name} (Hex)`, f.hex),
                this.createResultItem(`${selected.name} (Decimal)`, f.dec),
                this.createResultItem(`${selected.name} (Binário)`, f.bin)
            );

            items.push('<div style="grid-column: 1/-1; border-top: 1px solid var(--border-color); margin: 0.5rem 0;"></div>');
            items.push(`<div style="grid-column: 1/-1; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Todos os algoritmos</div>`);

            for (const [key, info] of Object.entries(algoMap)) {
                const r = this.formatResult(info.value, info.bits);
                items.push(this.createResultItem(info.name, r.hex));
            }

            valuesContainer.innerHTML = items.join('');
            resultContainer.style.display = 'block';
            App.toast(`Checksum calculado: ${data.length} bytes processados`, 'success');
        });
    },

    createResultItem(label, value) {
        return `
            <div class="result-item">
                <div class="result-item-label">${label}</div>
                <div class="result-item-value">${value}</div>
            </div>`;
    },

    // ===================== CONVERSOR =====================
    setupConverter() {
        const hexInput = document.getElementById('conv-hex');
        const decInput = document.getElementById('conv-dec');
        const binInput = document.getElementById('conv-bin');
        const asciiInput = document.getElementById('conv-ascii');

        hexInput.addEventListener('input', () => {
            const val = parseInt(hexInput.value, 16);
            if (!isNaN(val)) {
                decInput.value = val;
                binInput.value = val.toString(2);
                asciiInput.value = (val >= 32 && val <= 126) ? String.fromCharCode(val) : '';
            }
        });

        decInput.addEventListener('input', () => {
            const val = parseInt(decInput.value, 10);
            if (!isNaN(val)) {
                hexInput.value = val.toString(16).toUpperCase();
                binInput.value = val.toString(2);
                if (val >= 32 && val <= 126) asciiInput.value = String.fromCharCode(val);
            }
        });

        binInput.addEventListener('input', () => {
            const val = parseInt(binInput.value, 2);
            if (!isNaN(val)) {
                hexInput.value = val.toString(16).toUpperCase();
                decInput.value = val;
                if (val >= 32 && val <= 126) asciiInput.value = String.fromCharCode(val);
            }
        });

        asciiInput.addEventListener('input', () => {
            if (asciiInput.value.length > 0) {
                const hex = [];
                for (let i = 0; i < asciiInput.value.length; i++) {
                    hex.push(asciiInput.value.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0'));
                }
                hexInput.value = hex.join(' ');
                if (asciiInput.value.length === 1) {
                    const val = asciiInput.value.charCodeAt(0);
                    decInput.value = val;
                    binInput.value = val.toString(2);
                }
            }
        });
    },

    // ===================== DUTY CYCLE =====================
    setupDutyCycle() {
        document.getElementById('btn-calc-duty').addEventListener('click', () => {
            const rpm = parseFloat(document.getElementById('calc-rpm').value);
            const injTime = parseFloat(document.getElementById('calc-inj-time').value);
            const engineType = parseInt(document.getElementById('calc-engine-type').value);

            if (isNaN(rpm) || isNaN(injTime) || rpm <= 0) {
                App.toast('Preencha os valores corretamente.', 'warning');
                return;
            }

            const cycleTime = (60 / rpm) * 1000 * (engineType === 4 ? 2 : 1);
            const dutyCycle = (injTime / cycleTime) * 100;
            const frequency = rpm / (engineType === 4 ? 2 : 1) / 60;

            const resultContainer = document.getElementById('duty-result');
            const valuesContainer = document.getElementById('duty-result-values');

            valuesContainer.innerHTML = `
                ${this.createResultItem('Duty Cycle', dutyCycle.toFixed(2) + ' %')}
                ${this.createResultItem('Tempo do Ciclo', cycleTime.toFixed(2) + ' ms')}
                ${this.createResultItem('Frequência', frequency.toFixed(2) + ' Hz')}
                ${this.createResultItem('Tempo de Injeção', injTime.toFixed(2) + ' ms')}
            `;
            resultContainer.style.display = 'block';
        });
    },

    // ===================== FILE CHECKSUM =====================
    setupFileChecksum() {
        const uploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');

        this.setupDragDrop(uploadArea, fileInput, (file) => this.handleFile(file));

        document.getElementById('btn-file-checksum').addEventListener('click', () => {
            if (!this.fileBuffer) return;

            let startOffset = 0;
            let endOffset = this.fileBuffer.byteLength;

            const startVal = document.getElementById('file-offset-start').value.trim();
            const endVal = document.getElementById('file-offset-end').value.trim();

            if (startVal) startOffset = parseInt(startVal, 16) || 0;
            if (endVal) endOffset = parseInt(endVal, 16) || this.fileBuffer.byteLength;

            startOffset = Math.max(0, Math.min(startOffset, this.fileBuffer.byteLength));
            endOffset = Math.max(startOffset, Math.min(endOffset, this.fileBuffer.byteLength));

            const data = new Uint8Array(this.fileBuffer.slice(startOffset, endOffset));
            const results = this.calculateAll(data);

            const valuesContainer = document.getElementById('file-checksum-values');
            const items = [];
            const fmtMap = [
                ['Sum8', results.sum8, 8],
                ['Sum16', results.sum16, 16],
                ['Sum32', results.sum32, 32],
                ['XOR8', results.xor8, 8],
                ['CRC-16', results.crc16, 16],
                ['CRC-32', results.crc32, 32]
            ];

            fmtMap.forEach(([name, value, bits]) => {
                const f = this.formatResult(value, bits);
                items.push(this.createResultItem(name, f.hex));
            });

            items.push(`<div style="grid-column: 1/-1;" class="text-muted">
                Intervalo: 0x${startOffset.toString(16).toUpperCase()} - 0x${endOffset.toString(16).toUpperCase()}
                (${endOffset - startOffset} bytes analisados)
            </div>`);

            valuesContainer.innerHTML = items.join('');
            document.getElementById('file-checksum-result').style.display = 'block';
            App.toast(`Checksums calculados para ${endOffset - startOffset} bytes`, 'success');
        });
    },

    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.fileBuffer = e.target.result;
            document.getElementById('file-info').style.display = 'block';
            document.getElementById('file-name').textContent = file.name;
            document.getElementById('file-size').textContent = App.formatFileSize(file.size);
            document.getElementById('file-offset-end').placeholder = `0x${file.size.toString(16).toUpperCase()} (fim)`;

            this.renderHexViewer(new Uint8Array(this.fileBuffer));
            App.toast(`Arquivo "${file.name}" carregado com sucesso.`, 'success');
        };
        reader.readAsArrayBuffer(file);
    },

    renderHexViewer(data) {
        const viewer = document.getElementById('hex-viewer');
        const maxLines = 64;
        const bytesPerLine = 16;
        const totalLines = Math.min(maxLines, Math.ceil(data.length / bytesPerLine));
        let html = '';

        for (let line = 0; line < totalLines; line++) {
            const offset = line * bytesPerLine;
            let hexPart = '';
            let asciiPart = '';

            for (let i = 0; i < bytesPerLine; i++) {
                const idx = offset + i;
                if (idx < data.length) {
                    hexPart += data[idx].toString(16).toUpperCase().padStart(2, '0') + ' ';
                    const ch = data[idx];
                    asciiPart += (ch >= 32 && ch <= 126) ? String.fromCharCode(ch) : '.';
                } else {
                    hexPart += '   ';
                    asciiPart += ' ';
                }
                if (i === 7) hexPart += ' ';
            }

            html += `<span class="hex-offset">${offset.toString(16).toUpperCase().padStart(8, '0')}</span>  <span class="hex-byte">${hexPart}</span> <span class="hex-ascii">${asciiPart}</span>\n`;
        }

        if (data.length > maxLines * bytesPerLine) {
            html += `\n<span class="hex-offset">...</span>  <span style="color:var(--text-muted);">(mostrando primeiros ${maxLines * bytesPerLine} de ${data.length} bytes)</span>`;
        }

        viewer.innerHTML = html;
    },

    // ===================== BYTE TOOLS =====================
    setupByteTools() {
        document.getElementById('btn-convert-endian').addEventListener('click', () => {
            const input = document.getElementById('endian-input').value.replace(/[^0-9a-fA-F]/g, '');
            if (!input || input.length % 2 !== 0) {
                App.toast('Insira um valor hex com número par de caracteres.', 'warning');
                return;
            }

            const bytes = [];
            for (let i = 0; i < input.length; i += 2) {
                bytes.push(input.substr(i, 2).toUpperCase());
            }

            document.getElementById('endian-big').value = bytes.join(' ');
            document.getElementById('endian-little').value = [...bytes].reverse().join(' ');
        });

        document.getElementById('btn-bitwise').addEventListener('click', () => {
            const aStr = document.getElementById('bitwise-a').value.replace(/[^0-9a-fA-F]/g, '');
            const bStr = document.getElementById('bitwise-b').value.replace(/[^0-9a-fA-F]/g, '');
            const op = document.getElementById('bitwise-op').value;

            const a = parseInt(aStr, 16);
            if (isNaN(a)) {
                App.toast('Valor A inválido.', 'warning');
                return;
            }

            let result;
            const opLabels = { and: 'AND', or: 'OR', xor: 'XOR', not: 'NOT', shl: 'Shift Left', shr: 'Shift Right' };

            switch (op) {
                case 'and': result = a & parseInt(bStr, 16); break;
                case 'or': result = a | parseInt(bStr, 16); break;
                case 'xor': result = a ^ parseInt(bStr, 16); break;
                case 'not': result = (~a) & 0xFF; break;
                case 'shl': result = a << (parseInt(bStr, 16) || parseInt(bStr, 10) || 1); break;
                case 'shr': result = a >>> (parseInt(bStr, 16) || parseInt(bStr, 10) || 1); break;
            }

            result = result >>> 0;

            const bits = result <= 0xFF ? 8 : result <= 0xFFFF ? 16 : 32;
            const f = this.formatResult(result, bits);

            const container = document.getElementById('bitwise-result');
            const values = document.getElementById('bitwise-result-values');
            values.innerHTML = `
                ${this.createResultItem('Operação', `${aStr.toUpperCase()} ${opLabels[op]} ${op === 'not' ? '' : bStr.toUpperCase()}`)}
                ${this.createResultItem('Hex', f.hex)}
                ${this.createResultItem('Decimal', f.dec)}
                ${this.createResultItem('Binário', f.bin)}
            `;
            container.style.display = 'block';
        });
    },

    // ==========================================================
    //  NOVA FUNCIONALIDADE 1: CORREÇÃO MANUAL DE CHECKSUM
    // ==========================================================
    setupCorrection() {
        const uploadArea = document.getElementById('correction-upload-area');
        const fileInput = document.getElementById('correction-file-input');

        this.setupDragDrop(uploadArea, fileInput, (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.correctionBuffer = e.target.result;
                this._correctionFileName = file.name;
                document.getElementById('corr-file-name').textContent = file.name;
                document.getElementById('corr-file-size').textContent = App.formatFileSize(file.size);
                document.getElementById('correction-form').style.display = 'block';
                document.getElementById('btn-apply-correction').disabled = true;
                document.getElementById('correction-result').style.display = 'none';
                App.toast(`Arquivo "${file.name}" carregado para correção.`, 'success');
            };
            reader.readAsArrayBuffer(file);
        });

        document.getElementById('btn-check-correction').addEventListener('click', () => this.checkCorrection());
        document.getElementById('btn-apply-correction').addEventListener('click', () => this.applyCorrection());
    },

    checkCorrection() {
        if (!this.correctionBuffer) {
            App.toast('Carregue um arquivo primeiro.', 'warning');
            return;
        }

        const start = this.parseHexAddr(document.getElementById('corr-region-start').value);
        const end = this.parseHexAddr(document.getElementById('corr-region-end').value);
        const checksumOffset = this.parseHexAddr(document.getElementById('corr-checksum-offset').value);
        const algo = document.getElementById('corr-algorithm').value;
        const endian = document.getElementById('corr-endian').value;

        if (isNaN(start) || isNaN(end) || isNaN(checksumOffset)) {
            App.toast('Preencha os offsets corretamente (formato hex).', 'warning');
            return;
        }

        const fileSize = this.correctionBuffer.byteLength;
        if (start >= fileSize || end >= fileSize || checksumOffset >= fileSize) {
            App.toast(`Offset fora do tamanho do arquivo (0x${fileSize.toString(16).toUpperCase()}).`, 'error');
            return;
        }
        if (start > end) {
            App.toast('Offset de início deve ser menor que o fim.', 'error');
            return;
        }

        const data = new Uint8Array(this.correctionBuffer.slice(start, end + 1));
        const calculated = this.calcByAlgorithm(data, algo);
        const numBytes = this.algoBytes(algo);
        const stored = this.readBytesAt(this.correctionBuffer, checksumOffset, numBytes, endian);

        const bits = this.algoBits(algo);
        const fCalc = this.formatResult(calculated, bits);
        const fStored = this.formatResult(stored, bits);
        const match = calculated === stored;

        this._correctionData = { start, end, checksumOffset, algo, endian, calculated, stored, numBytes };

        const resultDiv = document.getElementById('correction-result-values');
        resultDiv.innerHTML = `
            <div class="corr-summary ${match ? 'corr-ok' : 'corr-fail'}">
                <i class="fas ${match ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                <span>${match ? 'Checksum CORRETO - nenhuma correção necessária.' : 'Checksum INCORRETO - correção disponível!'}</span>
            </div>
            <div class="result-grid" style="margin-top:0.75rem;">
                ${this.createResultItem('Algoritmo', algo.toUpperCase())}
                ${this.createResultItem('Região', `0x${start.toString(16).toUpperCase()} - 0x${end.toString(16).toUpperCase()}`)}
                ${this.createResultItem('Bytes analisados', (end - start + 1).toLocaleString())}
                ${this.createResultItem('Checksum Armazenado', fStored.hex)}
                ${this.createResultItem('Checksum Calculado', fCalc.hex)}
                ${this.createResultItem('Status', match ?
                    '<span style="color:var(--accent-green);">OK</span>' :
                    '<span style="color:var(--accent-red);">DIVERGENTE</span>')}
            </div>
        `;

        document.getElementById('correction-result').style.display = 'block';
        document.getElementById('btn-apply-correction').disabled = match;

        if (match) App.toast('Checksum está correto!', 'success');
        else App.toast('Checksum divergente. Clique em "Corrigir e Baixar" para corrigir.', 'warning');
    },

    applyCorrection() {
        if (!this._correctionData || !this.correctionBuffer) return;

        const { checksumOffset, calculated, numBytes, endian } = this._correctionData;
        const corrected = this.correctionBuffer.slice(0);

        this.writeBytesAt(corrected, checksumOffset, numBytes, calculated, endian);

        const baseName = this._correctionFileName.replace(/(\.[^.]+)$/, '');
        const ext = this._correctionFileName.match(/(\.[^.]+)$/)?.[1] || '.bin';
        this.downloadBin(corrected, `${baseName}_corrected${ext}`);

        App.toast('Arquivo corrigido baixado com sucesso!', 'success');
    },

    // ==========================================================
    //  NOVA FUNCIONALIDADE 2: PERFIL BOSCH ME7
    // ==========================================================
    setupME7Profile() {
        const uploadArea = document.getElementById('me7-upload-area');
        const fileInput = document.getElementById('me7-file-input');

        this.setupDragDrop(uploadArea, fileInput, (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.me7Buffer = e.target.result;
                this._me7FileName = file.name;
                document.getElementById('me7-file-name').textContent = file.name;
                document.getElementById('me7-file-size').textContent = App.formatFileSize(file.size);
                document.getElementById('me7-results').style.display = 'block';
                this.analyzeME7();
            };
            reader.readAsArrayBuffer(file);
        });

        document.getElementById('btn-me7-correct').addEventListener('click', () => this.correctME7());
    },

    analyzeME7() {
        if (!this.me7Buffer) return;
        const data = new Uint8Array(this.me7Buffer);
        const size = data.length;
        const regions = [];
        let hasFailure = false;

        // 1) ROMSYS - Checksum da área de boot (Sum16, primeiros ~16KB)
        const romsysEnd = Math.min(0x3FFE, size - 2);
        if (romsysEnd > 0) {
            const romsysData = data.slice(0, romsysEnd);
            const calc = this.calcSum16(romsysData);
            const stored = this.readBytesAt(this.me7Buffer, romsysEnd, 2, 'big');
            const ok = calc === stored;
            if (!ok) hasFailure = true;
            regions.push({
                name: 'ROMSYS (Boot)',
                start: 0,
                end: romsysEnd - 1,
                checksumOffset: romsysEnd,
                algo: 'sum16',
                endian: 'big',
                calculated: calc,
                stored: stored,
                ok: ok,
                bytes: 2
            });
        }

        // 2) Buscar pares de palavras no firmware que referenciam blocos de dados
        //    Padrão ME7: sequência de (startAddr, endAddr, checksumAddr) em 32-bit
        const multipointBlocks = this.findME7MultipointBlocks(data, size);
        multipointBlocks.forEach((block, idx) => {
            const blockData = data.slice(block.start, block.end + 1);
            const calc = this.calcSum16(blockData);
            const stored = this.readBytesAt(this.me7Buffer, block.checksumOffset, 2, 'big');
            const ok = calc === stored;
            if (!ok) hasFailure = true;
            regions.push({
                name: `Bloco de Dados #${idx + 1}`,
                start: block.start,
                end: block.end,
                checksumOffset: block.checksumOffset,
                algo: 'sum16',
                endian: 'big',
                calculated: calc,
                stored: stored,
                ok: ok,
                bytes: 2
            });
        });

        // 3) Verificar CRC32 do programa principal (se tamanho >= 512KB)
        if (size >= 0x70000) {
            const mainStart = 0x10000;
            const mainEnd = size - 4;
            const mainData = data.slice(mainStart, mainEnd);
            const calc = this.calcCRC32(mainData);

            const storedCrc = this.readBytesAt(this.me7Buffer, mainEnd, 4, 'big');
            const ok = calc === storedCrc;
            if (!ok) hasFailure = true;
            regions.push({
                name: 'Programa Principal (CRC32)',
                start: mainStart,
                end: mainEnd - 1,
                checksumOffset: mainEnd,
                algo: 'crc32',
                endian: 'big',
                calculated: calc,
                stored: storedCrc,
                ok: ok,
                bytes: 4
            });
        }

        this._me7Regions = regions;

        const listEl = document.getElementById('me7-regions-list');
        if (regions.length === 0) {
            listEl.innerHTML = `<div class="corr-summary corr-fail"><i class="fas fa-question-circle"></i> Nenhuma região de checksum detectada. O arquivo pode não ser um firmware ME7.</div>`;
            document.getElementById('btn-me7-correct').disabled = true;
            return;
        }

        let html = '';
        regions.forEach((r, i) => {
            const bits = this.algoBits(r.algo);
            const fCalc = this.formatResult(r.calculated, bits);
            const fStored = this.formatResult(r.stored, bits);

            html += `
            <div class="me7-region-card ${r.ok ? 'me7-ok' : 'me7-fail'}">
                <div class="me7-region-header">
                    <i class="fas ${r.ok ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    <strong>${r.name}</strong>
                    <span class="me7-status-badge ${r.ok ? '' : 'badge-fail'}">${r.ok ? 'OK' : 'FALHA'}</span>
                </div>
                <div class="me7-region-details">
                    <span><strong>Região:</strong> 0x${r.start.toString(16).toUpperCase()} - 0x${r.end.toString(16).toUpperCase()}</span>
                    <span><strong>Offset CS:</strong> 0x${r.checksumOffset.toString(16).toUpperCase()}</span>
                    <span><strong>Algoritmo:</strong> ${r.algo.toUpperCase()}</span>
                    <span><strong>Armazenado:</strong> ${fStored.hex}</span>
                    <span><strong>Calculado:</strong> ${fCalc.hex}</span>
                </div>
            </div>`;
        });

        listEl.innerHTML = html;
        document.getElementById('btn-me7-correct').disabled = !hasFailure;

        const okCount = regions.filter(r => r.ok).length;
        const failCount = regions.length - okCount;
        if (failCount > 0)
            App.toast(`Análise ME7: ${failCount} checksum(s) com falha de ${regions.length} região(ões).`, 'warning');
        else
            App.toast(`Todos os ${regions.length} checksums estão corretos!`, 'success');
    },

    findME7MultipointBlocks(data, size) {
        const blocks = [];
        const view = new DataView(data.buffer);

        // Heurística: procurar por tabelas de ponteiros (triplas de 32-bit)
        // que apontam para regiões válidas dentro do firmware
        const searchStart = 0x4000;
        const searchEnd = Math.min(0x20000, size - 12);

        for (let i = searchStart; i < searchEnd; i += 2) {
            try {
                const s = view.getUint32(i, false);
                const e = view.getUint32(i + 4, false);
                const c = view.getUint32(i + 8, false);

                // Validar que os endereços formam um bloco razoável
                if (s >= 0x10000 && s < size &&
                    e > s && e < size &&
                    c >= s && c <= e + 4 &&
                    (e - s) >= 0x100 && (e - s) <= 0x80000 &&
                    !blocks.some(b => b.start === s)) {

                    // Verificar se o checksum offset está logo após o bloco
                    if (c === e + 1 || c === e + 2) {
                        blocks.push({ start: s, end: e, checksumOffset: c });
                    }
                }
            } catch (err) {
                continue;
            }
        }

        return blocks.slice(0, 20);
    },

    correctME7() {
        if (!this._me7Regions || !this.me7Buffer) return;

        const corrected = this.me7Buffer.slice(0);
        let correctedCount = 0;

        this._me7Regions.forEach(r => {
            if (!r.ok) {
                this.writeBytesAt(corrected, r.checksumOffset, r.bytes, r.calculated, r.endian);
                correctedCount++;
            }
        });

        if (correctedCount === 0) {
            App.toast('Nenhum checksum precisa de correção.', 'info');
            return;
        }

        const baseName = this._me7FileName.replace(/(\.[^.]+)$/, '');
        const ext = this._me7FileName.match(/(\.[^.]+)$/)?.[1] || '.bin';
        this.downloadBin(corrected, `${baseName}_ME7_corrected${ext}`);

        App.toast(`${correctedCount} checksum(s) corrigido(s)! Arquivo baixado.`, 'success');
    },

    // ==========================================================
    //  NOVA FUNCIONALIDADE 3: COMPARADOR DE BINÁRIOS
    // ==========================================================
    setupBinCompare() {
        const uploadA = document.getElementById('compare-upload-a');
        const fileA = document.getElementById('compare-file-a');
        const uploadB = document.getElementById('compare-upload-b');
        const fileB = document.getElementById('compare-file-b');

        this.setupDragDrop(uploadA, fileA, (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.compareBufferA = e.target.result;
                this._compareNameA = file.name;
                document.getElementById('compare-name-a').textContent = `${file.name} (${App.formatFileSize(file.size)})`;
                document.getElementById('compare-name-a').style.display = 'inline-block';
                this.updateCompareBtn();
            };
            reader.readAsArrayBuffer(file);
        });

        this.setupDragDrop(uploadB, fileB, (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.compareBufferB = e.target.result;
                this._compareNameB = file.name;
                document.getElementById('compare-name-b').textContent = `${file.name} (${App.formatFileSize(file.size)})`;
                document.getElementById('compare-name-b').style.display = 'inline-block';
                this.updateCompareBtn();
            };
            reader.readAsArrayBuffer(file);
        });

        document.getElementById('btn-compare').addEventListener('click', () => this.runComparison());
    },

    updateCompareBtn() {
        document.getElementById('btn-compare').disabled = !(this.compareBufferA && this.compareBufferB);
    },

    runComparison() {
        if (!this.compareBufferA || !this.compareBufferB) return;

        const a = new Uint8Array(this.compareBufferA);
        const b = new Uint8Array(this.compareBufferB);
        const maxLen = Math.max(a.length, b.length);
        const minLen = Math.min(a.length, b.length);

        const diffs = [];
        const maxDiffs = 5000;

        for (let i = 0; i < maxLen && diffs.length < maxDiffs; i++) {
            const byteA = i < a.length ? a[i] : null;
            const byteB = i < b.length ? b[i] : null;
            if (byteA !== byteB) {
                diffs.push({ offset: i, a: byteA, b: byteB });
            }
        }

        const statsEl = document.getElementById('compare-stats');
        const identical = diffs.length === 0 && a.length === b.length;

        statsEl.innerHTML = `
            ${this.createResultItem('Arquivo Original', `${this._compareNameA} (${App.formatFileSize(a.length)})`)}
            ${this.createResultItem('Arquivo Modificado', `${this._compareNameB} (${App.formatFileSize(b.length)})`)}
            ${this.createResultItem('Tamanho igual?', a.length === b.length ?
                '<span style="color:var(--accent-green);">Sim</span>' :
                `<span style="color:var(--accent-orange);">Não (diff ${Math.abs(a.length - b.length)} bytes)</span>`)}
            ${this.createResultItem('Bytes diferentes', diffs.length >= maxDiffs ?
                `<span style="color:var(--accent-red);">${maxDiffs}+ (truncado)</span>` :
                `<span style="color:${diffs.length > 0 ? 'var(--accent-orange)' : 'var(--accent-green)'};">${diffs.length}</span>`)}
            ${this.createResultItem('Resultado', identical ?
                '<span style="color:var(--accent-green);"><i class="fas fa-check-circle"></i> Idênticos</span>' :
                '<span style="color:var(--accent-orange);"><i class="fas fa-exclamation-triangle"></i> Diferentes</span>')}
        `;

        const tbody = document.getElementById('compare-table-body');
        const displayLimit = 2000;
        const displayDiffs = diffs.slice(0, displayLimit);

        if (displayDiffs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--accent-green);"><i class="fas fa-check-circle"></i> Arquivos idênticos!</td></tr>`;
        } else {
            let html = '';
            displayDiffs.forEach(d => {
                const aHex = d.a !== null ? d.a.toString(16).toUpperCase().padStart(2, '0') : '--';
                const bHex = d.b !== null ? d.b.toString(16).toUpperCase().padStart(2, '0') : '--';
                const diffVal = d.a !== null && d.b !== null ? (d.b - d.a) : '?';
                const diffSign = typeof diffVal === 'number' && diffVal > 0 ? '+' : '';

                const ctxStart = Math.max(0, d.offset - 3);
                let ctx = '';
                for (let c = ctxStart; c < Math.min(maxLen, d.offset + 4); c++) {
                    const byte = c < a.length ? a[c] : null;
                    if (byte !== null) {
                        const h = byte.toString(16).toUpperCase().padStart(2, '0');
                        ctx += c === d.offset ? `<span class="diff-highlight">${h}</span> ` : `${h} `;
                    }
                }

                html += `<tr>
                    <td class="code-cell">0x${d.offset.toString(16).toUpperCase().padStart(6, '0')}</td>
                    <td class="code-cell">${aHex}</td>
                    <td class="code-cell" style="color:var(--accent-orange);">${bHex}</td>
                    <td class="code-cell" style="color:var(--accent-cyan);">${diffSign}${diffVal}</td>
                    <td class="code-cell" style="font-size:0.78rem;">${ctx}</td>
                </tr>`;
            });

            if (diffs.length > displayLimit) {
                html += `<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--text-muted);">... mostrando ${displayLimit} de ${diffs.length} diferenças ...</td></tr>`;
            }

            tbody.innerHTML = html;
        }

        document.getElementById('compare-results').style.display = 'block';

        if (identical) App.toast('Os arquivos são idênticos!', 'success');
        else App.toast(`Encontradas ${diffs.length} diferenças entre os arquivos.`, 'info');
    },

    // ==========================================================
    //  NOVA FUNCIONALIDADE 4: PERFIS SALVOS
    // ==========================================================
    setupProfiles() {
        this.loadProfiles();
        this.renderProfiles();

        document.getElementById('btn-add-profile-region').addEventListener('click', () => this.addProfileRegionRow());
        document.getElementById('btn-save-profile').addEventListener('click', () => this.saveProfile());
        document.getElementById('btn-export-profiles').addEventListener('click', () => this.exportProfiles());
        document.getElementById('btn-import-profiles').addEventListener('click', () => {
            document.getElementById('profiles-import-input').click();
        });
        document.getElementById('profiles-import-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.importProfiles(e.target.files[0]);
        });
    },

    loadProfiles() {
        try {
            this._profiles = JSON.parse(localStorage.getItem('ecu_checksum_profiles') || '[]');
        } catch {
            this._profiles = [];
        }
    },

    saveProfilesToStorage() {
        localStorage.setItem('ecu_checksum_profiles', JSON.stringify(this._profiles));
    },

    addProfileRegionRow() {
        const container = document.getElementById('profile-regions-container');
        const row = document.createElement('div');
        row.className = 'profile-region-row';
        row.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:0.85rem;margin-bottom:0.5rem;';
        row.innerHTML = `
            <div class="form-row">
                <div class="form-group"><label>Início (hex)</label><input type="text" class="code-input prof-start" placeholder="0x000000"></div>
                <div class="form-group"><label>Fim (hex)</label><input type="text" class="code-input prof-end" placeholder="0x01FFFE"></div>
                <div class="form-group"><label>Offset Checksum (hex)</label><input type="text" class="code-input prof-offset" placeholder="0x01FFFF"></div>
                <div class="form-group">
                    <label>Algoritmo</label>
                    <select class="prof-algo">
                        <option value="sum8">Sum8</option>
                        <option value="sum16" selected>Sum16</option>
                        <option value="sum32">Sum32</option>
                        <option value="xor8">XOR8</option>
                        <option value="crc16">CRC-16</option>
                        <option value="crc32">CRC-32</option>
                    </select>
                </div>
                <div class="form-group" style="justify-content:flex-end;">
                    <button class="btn btn-danger btn-sm btn-remove-region" title="Remover região"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;

        row.querySelector('.btn-remove-region').addEventListener('click', () => row.remove());
        container.appendChild(row);
    },

    saveProfile() {
        const name = document.getElementById('profile-name').value.trim();
        if (!name) {
            App.toast('Informe um nome para o perfil.', 'warning');
            return;
        }

        const ecu = document.getElementById('profile-ecu').value.trim();
        const fileSize = document.getElementById('profile-filesize').value.trim();

        const regionRows = document.querySelectorAll('#profile-regions-container .profile-region-row');
        const regions = [];

        regionRows.forEach(row => {
            const start = row.querySelector('.prof-start')?.value.trim();
            const end = row.querySelector('.prof-end')?.value.trim();
            const offset = row.querySelector('.prof-offset')?.value.trim();
            const algo = row.querySelector('.prof-algo')?.value;

            if (start && end && offset) {
                regions.push({ start, end, checksumOffset: offset, algo });
            }
        });

        if (regions.length === 0) {
            App.toast('Adicione pelo menos uma região de checksum.', 'warning');
            return;
        }

        const profile = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            name,
            ecu,
            fileSize: fileSize || null,
            regions,
            createdAt: new Date().toISOString()
        };

        this._profiles.push(profile);
        this.saveProfilesToStorage();
        this.renderProfiles();

        document.getElementById('profile-name').value = '';
        document.getElementById('profile-ecu').value = '';
        document.getElementById('profile-filesize').value = '';

        App.toast(`Perfil "${name}" salvo com sucesso!`, 'success');
    },

    renderProfiles() {
        const container = document.getElementById('saved-profiles-list');
        if (!this._profiles || this._profiles.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-folder-open" style="font-size:2rem;margin-bottom:0.75rem;display:block;"></i>
                    <p>Nenhum perfil salvo ainda.</p>
                    <p style="font-size:0.82rem;">Crie um perfil abaixo ou importe de um arquivo JSON.</p>
                </div>`;
            return;
        }

        let html = '<div class="profiles-grid">';
        this._profiles.forEach(p => {
            html += `
            <div class="profile-card" data-id="${p.id}">
                <div class="profile-card-header">
                    <div>
                        <h4>${p.name}</h4>
                        ${p.ecu ? `<span class="profile-ecu-badge">${p.ecu}</span>` : ''}
                    </div>
                    <div class="profile-actions">
                        <button class="btn btn-sm btn-primary btn-use-profile" title="Usar no Corretor Manual"><i class="fas fa-play"></i></button>
                        <button class="btn btn-sm btn-danger btn-delete-profile" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="profile-card-body">
                    ${p.fileSize ? `<span class="text-muted" style="font-size:0.8rem;">Tamanho esperado: ${p.fileSize} bytes</span>` : ''}
                    <div class="profile-regions-preview">
                        ${p.regions.map((r, i) => `
                            <div class="region-mini">
                                <span class="region-num">#${i + 1}</span>
                                <span>${r.start} - ${r.end}</span>
                                <span class="region-algo">${r.algo.toUpperCase()}</span>
                                <span class="text-muted">CS@${r.checksumOffset}</span>
                            </div>
                        `).join('')}
                    </div>
                    <span class="text-muted" style="font-size:0.75rem;">${new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.btn-delete-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.profile-card');
                const id = card.dataset.id;
                this._profiles = this._profiles.filter(p => p.id !== id);
                this.saveProfilesToStorage();
                this.renderProfiles();
                App.toast('Perfil removido.', 'info');
            });
        });

        container.querySelectorAll('.btn-use-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.profile-card');
                const id = card.dataset.id;
                const profile = this._profiles.find(p => p.id === id);
                if (profile) this.applyProfileToCorrection(profile);
            });
        });
    },

    applyProfileToCorrection(profile) {
        // Navegar para a aba de Correção
        document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
        const corrTab = document.querySelector('.tool-tab[data-tool="correction"]');
        if (corrTab) corrTab.classList.add('active');
        document.getElementById('tool-correction').classList.add('active');

        if (profile.regions.length > 0) {
            const r = profile.regions[0];
            document.getElementById('corr-region-start').value = r.start;
            document.getElementById('corr-region-end').value = r.end;
            document.getElementById('corr-checksum-offset').value = r.checksumOffset;
            document.getElementById('corr-algorithm').value = r.algo;
        }

        App.toast(`Perfil "${profile.name}" aplicado! Carregue o arquivo .bin para verificar.`, 'info');
    },

    exportProfiles() {
        if (!this._profiles || this._profiles.length === 0) {
            App.toast('Nenhum perfil para exportar.', 'warning');
            return;
        }
        const json = JSON.stringify(this._profiles, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ecu_checksum_profiles.json';
        a.click();
        URL.revokeObjectURL(url);
        App.toast('Perfis exportados!', 'success');
    },

    importProfiles(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) throw new Error('Formato inválido');

                let addedCount = 0;
                imported.forEach(p => {
                    if (p.name && p.regions && Array.isArray(p.regions)) {
                        if (!p.id) p.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                        if (!this._profiles.some(ex => ex.id === p.id)) {
                            this._profiles.push(p);
                            addedCount++;
                        }
                    }
                });

                this.saveProfilesToStorage();
                this.renderProfiles();
                App.toast(`${addedCount} perfil(is) importado(s) com sucesso!`, 'success');
            } catch (err) {
                App.toast('Erro ao importar: arquivo JSON inválido.', 'error');
            }
        };
        reader.readAsText(file);
    }
};
