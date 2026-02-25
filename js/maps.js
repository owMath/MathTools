/* ============================================
   Math Tools Pro - Módulo de Mapas de ECU
   ============================================ */

const MapsModule = {
    currentMap: null,
    originalData: null,
    selectedCells: new Set(),
    isSelecting: false,

    init() {
        this.populateSelector();
        this.setupEvents();
    },

    populateSelector() {
        const select = document.getElementById('map-selector');
        select.innerHTML = '<option value="">Selecione um mapa...</option>';
        App.getAllMaps().forEach(m => {
            select.innerHTML += `<option value="${m.id}">${m.name} ${m.custom ? '(CUSTOM)' : ''}</option>`;
        });
    },

    loadMap(id) {
        const map = App.getAllMaps().find(m => m.id === id);
        if (!map) {
            document.getElementById('map-content').style.display = 'none';
            document.getElementById('map-empty-state').style.display = 'block';
            this.currentMap = null;
            return;
        }

        this.currentMap = JSON.parse(JSON.stringify(map));
        this.originalData = JSON.parse(JSON.stringify(map.data));
        this.selectedCells.clear();

        document.getElementById('map-content').style.display = 'block';
        document.getElementById('map-empty-state').style.display = 'none';
        document.getElementById('btn-save-map').disabled = false;
        document.getElementById('btn-export-map').disabled = false;

        document.getElementById('map-name-display').textContent = map.name;
        document.getElementById('map-unit-display').textContent = `Unidade: ${map.unit}`;
        document.getElementById('map-size-display').textContent = `${map.yAxis.values.length} × ${map.xAxis.values.length}`;

        this.render2D();
        this.render3D();
    },

    render2D() {
        const map = this.currentMap;
        if (!map) return;

        const table = document.getElementById('map-table');
        const allValues = map.data.flat();
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);

        let html = '<thead><tr><th>' + map.yAxis.label + ' \\ ' + map.xAxis.label + '</th>';
        map.xAxis.values.forEach(x => {
            html += `<th>${x}</th>`;
        });
        html += '</tr></thead><tbody>';

        map.data.forEach((row, ri) => {
            html += `<tr><td>${map.yAxis.values[ri]}</td>`;
            row.forEach((val, ci) => {
                const cellId = `${ri}-${ci}`;
                const color = this.getHeatColor(val, minVal, maxVal);
                const isSelected = this.selectedCells.has(cellId);
                const changed = this.originalData && this.originalData[ri][ci] !== val;
                html += `<td class="editable ${isSelected ? 'selected' : ''}"
                             data-row="${ri}" data-col="${ci}"
                             style="background:${color};${changed ? 'font-weight:700;' : ''}"
                             title="${map.yAxis.label}: ${map.yAxis.values[ri]}, ${map.xAxis.label}: ${map.xAxis.values[ci]}"
                             >${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody>';
        table.innerHTML = html;

        const legend = document.getElementById('map-legend');
        legend.innerHTML = `
            <span>${minVal} ${map.unit}</span>
            <div class="map-legend-bar"></div>
            <span>${maxVal} ${map.unit}</span>
        `;
    },

    render3D() {
        const map = this.currentMap;
        if (!map) return;

        const trace = {
            z: map.data,
            x: map.xAxis.values,
            y: map.yAxis.values,
            type: 'surface',
            colorscale: [
                [0, '#1e3a5f'],
                [0.25, '#3b82f6'],
                [0.5, '#10b981'],
                [0.75, '#f59e0b'],
                [1, '#ef4444']
            ],
            contours: {
                z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } }
            },
            hovertemplate:
                `${map.xAxis.label}: %{x}<br>` +
                `${map.yAxis.label}: %{y}<br>` +
                `Valor: %{z} ${map.unit}<extra></extra>`
        };

        const layout = {
            scene: {
                xaxis: { title: map.xAxis.label, color: '#8b8fa3', gridcolor: '#2a2d3e' },
                yaxis: { title: map.yAxis.label, color: '#8b8fa3', gridcolor: '#2a2d3e' },
                zaxis: { title: map.unit, color: '#8b8fa3', gridcolor: '#2a2d3e' },
                bgcolor: '#1c1f2e',
                camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
            },
            paper_bgcolor: '#1c1f2e',
            plot_bgcolor: '#1c1f2e',
            font: { color: '#8b8fa3' },
            margin: { l: 0, r: 0, b: 0, t: 30 },
            autosize: true
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['toImage']
        };

        Plotly.newPlot('map-3d-plot', [trace], layout, config);
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

    toggleCellSelection(row, col, multiSelect) {
        const cellId = `${row}-${col}`;
        if (multiSelect) {
            if (this.selectedCells.has(cellId)) {
                this.selectedCells.delete(cellId);
            } else {
                this.selectedCells.add(cellId);
            }
        } else {
            this.selectedCells.clear();
            this.selectedCells.add(cellId);
        }
        this.render2D();
    },

    applyEdit() {
        if (!this.currentMap || this.selectedCells.size === 0) {
            App.toast('Selecione células para editar.', 'warning');
            return;
        }

        const op = document.getElementById('map-edit-op').value;
        const value = parseFloat(document.getElementById('map-edit-value').value);
        if (isNaN(value)) {
            App.toast('Insira um valor numérico.', 'warning');
            return;
        }

        this.selectedCells.forEach(cellId => {
            const [r, c] = cellId.split('-').map(Number);
            let current = this.currentMap.data[r][c];
            switch (op) {
                case 'add': current += value; break;
                case 'sub': current -= value; break;
                case 'mul': current *= value; break;
                case 'set': current = value; break;
                case 'pct': current *= (1 + value / 100); break;
            }
            this.currentMap.data[r][c] = parseFloat(current.toFixed(2));
        });

        this.render2D();
        this.render3D();
        App.toast(`${this.selectedCells.size} célula(s) editada(s).`, 'success');
    },

    saveMap() {
        if (!this.currentMap) return;

        const existing = App.data.customMaps.findIndex(m => m.id === this.currentMap.id);
        const mapToSave = { ...this.currentMap, custom: true };

        if (existing >= 0) {
            App.data.customMaps[existing] = mapToSave;
        } else {
            const baseExisting = App.data.ecuMaps.findIndex(m => m.id === this.currentMap.id);
            if (baseExisting >= 0) {
                mapToSave.id = this.currentMap.id + '-modified';
                mapToSave.name = this.currentMap.name + ' (Modificado)';
            }
            App.data.customMaps.push(mapToSave);
        }

        App.saveCustomData();
        this.originalData = JSON.parse(JSON.stringify(this.currentMap.data));
        this.populateSelector();
        App.updateDashboardStats();
        App.toast('Mapa salvo com sucesso!', 'success');
    },

    exportCSV() {
        if (!this.currentMap) return;
        const map = this.currentMap;

        let csv = `${map.yAxis.label} \\ ${map.xAxis.label},${map.xAxis.values.join(',')}\n`;
        map.data.forEach((row, i) => {
            csv += `${map.yAxis.values[i]},${row.join(',')}\n`;
        });

        App.downloadCSV(csv, `mapa-${map.id}.csv`);
        App.toast('Mapa exportado como CSV.', 'success');
    },

    importMap() {
        document.getElementById('map-import-input').click();
    },

    handleImport(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (file.name.endsWith('.json')) {
                    const mapData = JSON.parse(e.target.result);
                    if (mapData.xAxis && mapData.yAxis && mapData.data) {
                        mapData.custom = true;
                        if (!mapData.id) mapData.id = 'imported-' + Date.now();
                        if (!mapData.name) mapData.name = file.name;
                        if (!mapData.unit) mapData.unit = '-';

                        App.data.customMaps.push(mapData);
                        App.saveCustomData();
                        this.populateSelector();
                        App.updateDashboardStats();
                        App.toast('Mapa importado com sucesso!', 'success');

                        document.getElementById('map-selector').value = mapData.id;
                        this.loadMap(mapData.id);
                    } else {
                        App.toast('Formato de mapa inválido. Verifique a documentação.', 'error');
                    }
                } else if (file.name.endsWith('.csv')) {
                    const lines = e.target.result.trim().split('\n');
                    if (lines.length < 2) throw new Error('CSV muito curto');

                    const header = lines[0].split(',');
                    const xValues = header.slice(1).map(Number);
                    const yValues = [];
                    const data = [];

                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',');
                        yValues.push(parseFloat(cols[0]));
                        data.push(cols.slice(1).map(Number));
                    }

                    const mapData = {
                        id: 'csv-' + Date.now(),
                        name: file.name.replace('.csv', ''),
                        unit: '-',
                        xAxis: { label: 'X', values: xValues },
                        yAxis: { label: 'Y', values: yValues },
                        data: data,
                        custom: true
                    };

                    App.data.customMaps.push(mapData);
                    App.saveCustomData();
                    this.populateSelector();
                    App.updateDashboardStats();
                    App.toast('CSV importado como mapa!', 'success');

                    document.getElementById('map-selector').value = mapData.id;
                    this.loadMap(mapData.id);
                }
            } catch (err) {
                App.toast('Erro ao importar: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    },

    setupEvents() {
        document.getElementById('map-selector').addEventListener('change', (e) => {
            this.loadMap(e.target.value);
        });

        document.getElementById('map-table').addEventListener('click', (e) => {
            const td = e.target.closest('td.editable');
            if (td) {
                this.toggleCellSelection(
                    parseInt(td.dataset.row),
                    parseInt(td.dataset.col),
                    e.ctrlKey || e.metaKey
                );
            }
        });

        document.getElementById('map-table').addEventListener('dblclick', (e) => {
            const td = e.target.closest('td.editable');
            if (td && this.currentMap) {
                const row = parseInt(td.dataset.row);
                const col = parseInt(td.dataset.col);
                const current = this.currentMap.data[row][col];

                const input = document.createElement('input');
                input.type = 'number';
                input.value = current;
                input.step = '0.1';
                input.style.cssText = 'width:100%;background:var(--bg-input);border:1px solid var(--accent-blue);color:var(--accent-cyan);text-align:center;padding:2px;font-family:Consolas;font-size:0.82rem;border-radius:3px;';

                td.textContent = '';
                td.appendChild(input);
                input.focus();
                input.select();

                const commit = () => {
                    const val = parseFloat(input.value);
                    if (!isNaN(val)) {
                        this.currentMap.data[row][col] = val;
                    }
                    this.render2D();
                    this.render3D();
                };

                input.addEventListener('blur', commit);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') commit();
                    if (ev.key === 'Escape') { this.render2D(); }
                });
            }
        });

        document.getElementById('btn-apply-edit').addEventListener('click', () => this.applyEdit());
        document.getElementById('btn-save-map').addEventListener('click', () => this.saveMap());
        document.getElementById('btn-export-map').addEventListener('click', () => this.exportCSV());
        document.getElementById('btn-import-map').addEventListener('click', () => this.importMap());

        document.getElementById('map-import-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleImport(e.target.files[0]);
        });

        document.getElementById('btn-view-2d').addEventListener('click', () => {
            document.getElementById('map-view-2d').style.display = 'block';
            document.getElementById('map-view-3d').style.display = 'none';
            document.getElementById('btn-view-2d').classList.add('active');
            document.getElementById('btn-view-3d').classList.remove('active');
        });

        document.getElementById('btn-view-3d').addEventListener('click', () => {
            document.getElementById('map-view-2d').style.display = 'none';
            document.getElementById('map-view-3d').style.display = 'block';
            document.getElementById('btn-view-2d').classList.remove('active');
            document.getElementById('btn-view-3d').classList.add('active');
            this.render3D();
        });
    }
};
