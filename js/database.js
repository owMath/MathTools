/* ============================================
   Math Tools Pro - Módulo de Base de Dados
   ============================================ */

const DatabaseModule = {

    init() {
        this.setupTabs();
        this.setupAddPinout();
        this.setupAddDTC();
        this.setupAddMap();
        this.setupImportExport();
        this.updateStats();
    },

    setupTabs() {
        document.querySelectorAll('.db-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.db-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`db-${tab.dataset.db}`).classList.add('active');
            });
        });
    },

    updateStats() {
        document.getElementById('db-stat-pinouts').textContent = App.getAllPinouts().length;
        document.getElementById('db-stat-dtc').textContent = App.getAllDTC().length;
        document.getElementById('db-stat-maps').textContent = App.getAllMaps().length;
        document.getElementById('db-stat-custom').textContent =
            App.data.customPinouts.length + App.data.customDtcCodes.length + App.data.customMaps.length;

        this.renderRecentEntries();
    },

    renderRecentEntries() {
        const container = document.getElementById('db-recent-entries');
        const entries = [];

        App.data.customPinouts.forEach(p => entries.push({
            type: 'pinout', icon: 'fa-plug', color: 'var(--accent-blue)',
            title: `${p.brand} ${p.model}`, subtitle: 'Pinagem de ECU'
        }));
        App.data.customDtcCodes.forEach(d => entries.push({
            type: 'dtc', icon: 'fa-exclamation-triangle', color: 'var(--accent-orange)',
            title: d.code, subtitle: d.description
        }));
        App.data.customMaps.forEach(m => entries.push({
            type: 'map', icon: 'fa-map', color: 'var(--accent-purple)',
            title: m.name, subtitle: `${m.unit} | ${m.yAxis.values.length}×${m.xAxis.values.length}`
        }));

        if (entries.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhuma entrada customizada ainda. Use as abas acima para adicionar dados.</p>';
            return;
        }

        container.innerHTML = entries.map(e => `
            <div style="display:flex;align-items:center;gap:0.85rem;padding:0.65rem 0;border-bottom:1px solid var(--border-color);">
                <div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${e.color}20;color:${e.color};">
                    <i class="fas ${e.icon}"></i>
                </div>
                <div>
                    <div style="font-weight:600;font-size:0.9rem;">${e.title}</div>
                    <div style="color:var(--text-muted);font-size:0.8rem;">${e.subtitle}</div>
                </div>
            </div>
        `).join('');
    },

    setupAddPinout() {
        document.getElementById('btn-generate-pin-form').addEventListener('click', () => {
            const count = parseInt(document.getElementById('new-pinout-pins-count').value);
            if (!count || count < 1 || count > 200) {
                App.toast('Informe um número de pinos entre 1 e 200.', 'warning');
                return;
            }

            const container = document.getElementById('new-pinout-pins-container');
            let html = `
                <div style="overflow-x:auto;max-height:400px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);">
                    <table class="pin-form-table">
                        <thead><tr>
                            <th style="width:60px;">Pino</th>
                            <th>Função</th>
                            <th>Cor do Fio</th>
                            <th>Descrição</th>
                        </tr></thead>
                        <tbody>`;

            for (let i = 1; i <= count; i++) {
                html += `
                    <tr>
                        <td style="text-align:center;font-weight:700;color:var(--accent-blue);">${i}</td>
                        <td><input type="text" class="pin-func" data-pin="${i}" placeholder="Função do pino ${i}"></td>
                        <td><input type="text" class="pin-color" data-pin="${i}" placeholder="Cor do fio"></td>
                        <td><input type="text" class="pin-desc" data-pin="${i}" placeholder="Descrição"></td>
                    </tr>`;
            }

            html += '</tbody></table></div>';
            container.innerHTML = html;
            document.getElementById('btn-save-new-pinout').style.display = 'inline-flex';
        });

        document.getElementById('btn-save-new-pinout').addEventListener('click', () => {
            const brand = document.getElementById('new-pinout-brand').value.trim();
            const model = document.getElementById('new-pinout-model').value.trim();
            if (!brand || !model) {
                App.toast('Preencha o fabricante e modelo da ECU.', 'warning');
                return;
            }

            const vehicles = document.getElementById('new-pinout-vehicles').value.split(',').map(v => v.trim()).filter(Boolean);
            const fuelType = document.getElementById('new-pinout-fuel').value;

            const pins = [];
            document.querySelectorAll('.pin-func').forEach(input => {
                const pin = parseInt(input.dataset.pin);
                const func = input.value.trim();
                if (func) {
                    const color = document.querySelector(`.pin-color[data-pin="${pin}"]`).value.trim();
                    const desc = document.querySelector(`.pin-desc[data-pin="${pin}"]`).value.trim();
                    pins.push({ pin, function: func, wire_color: color || '-', description: desc || func });
                }
            });

            if (pins.length === 0) {
                App.toast('Preencha ao menos um pino.', 'warning');
                return;
            }

            const pinout = {
                id: `custom-${brand.toLowerCase()}-${model.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
                brand, model, vehicles,
                fuelType,
                connectors: [{
                    name: `Conector (${pins.length} pinos mapeados)`,
                    pins
                }],
                custom: true
            };

            App.data.customPinouts.push(pinout);
            App.saveCustomData();
            App.updateDashboardStats();
            this.updateStats();
            PinoutsModule.populateFilters();
            PinoutsModule.renderList();

            document.getElementById('new-pinout-brand').value = '';
            document.getElementById('new-pinout-model').value = '';
            document.getElementById('new-pinout-vehicles').value = '';
            document.getElementById('new-pinout-pins-count').value = '';
            document.getElementById('new-pinout-pins-container').innerHTML = '';
            document.getElementById('btn-save-new-pinout').style.display = 'none';

            App.toast(`Pinagem "${brand} ${model}" salva com sucesso!`, 'success');
        });
    },

    setupAddDTC() {
        document.getElementById('btn-save-new-dtc').addEventListener('click', () => {
            const code = document.getElementById('new-dtc-code').value.trim().toUpperCase();
            const desc = document.getElementById('new-dtc-desc').value.trim();

            if (!code || !desc) {
                App.toast('Preencha o código e a descrição.', 'warning');
                return;
            }

            if (!/^[PBCU]\d{4}$/i.test(code)) {
                App.toast('Formato de código inválido. Use: P0000, B0000, C0000 ou U0000.', 'warning');
                return;
            }

            const system = document.getElementById('new-dtc-system').value.trim();
            const causes = document.getElementById('new-dtc-causes').value.split('\n').map(l => l.trim()).filter(Boolean);
            const solutions = document.getElementById('new-dtc-solutions').value.split('\n').map(l => l.trim()).filter(Boolean);

            const dtc = {
                code,
                category: code[0],
                system: system || 'Geral',
                description: desc,
                causes,
                solutions,
                severity: 'medium',
                custom: true
            };

            App.data.customDtcCodes.push(dtc);
            App.saveCustomData();
            App.updateDashboardStats();
            this.updateStats();
            DTCModule.populateFilters();
            DTCModule.renderResults();

            document.getElementById('new-dtc-code').value = '';
            document.getElementById('new-dtc-desc').value = '';
            document.getElementById('new-dtc-system').value = '';
            document.getElementById('new-dtc-causes').value = '';
            document.getElementById('new-dtc-solutions').value = '';

            App.toast(`Código "${code}" salvo com sucesso!`, 'success');
        });
    },

    setupAddMap() {
        document.getElementById('btn-save-new-map').addEventListener('click', () => {
            const name = document.getElementById('new-map-name').value.trim();
            const unit = document.getElementById('new-map-unit').value.trim() || '-';
            const xStr = document.getElementById('new-map-x').value.trim();
            const yStr = document.getElementById('new-map-y').value.trim();
            const valuesStr = document.getElementById('new-map-values').value.trim();
            const xLabel = document.getElementById('new-map-x-label').value.trim() || 'X';
            const yLabel = document.getElementById('new-map-y-label').value.trim() || 'Y';

            if (!name || !xStr || !yStr || !valuesStr) {
                App.toast('Preencha todos os campos obrigatórios (*).', 'warning');
                return;
            }

            const xValues = xStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            const yValues = yStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));

            const rows = valuesStr.split(';').map(row => row.trim()).filter(Boolean);
            const data = rows.map(row => row.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v)));

            if (data.length !== yValues.length) {
                App.toast(`Número de linhas (${data.length}) não corresponde ao eixo Y (${yValues.length}).`, 'error');
                return;
            }

            for (let i = 0; i < data.length; i++) {
                if (data[i].length !== xValues.length) {
                    App.toast(`Linha ${i + 1} tem ${data[i].length} valores, esperado ${xValues.length}.`, 'error');
                    return;
                }
            }

            const map = {
                id: 'custom-map-' + Date.now(),
                name, unit,
                xAxis: { label: xLabel, values: xValues },
                yAxis: { label: yLabel, values: yValues },
                data,
                custom: true
            };

            App.data.customMaps.push(map);
            App.saveCustomData();
            App.updateDashboardStats();
            this.updateStats();
            MapsModule.populateSelector();

            document.getElementById('new-map-name').value = '';
            document.getElementById('new-map-unit').value = '';
            document.getElementById('new-map-x').value = '';
            document.getElementById('new-map-y').value = '';
            document.getElementById('new-map-values').value = '';
            document.getElementById('new-map-x-label').value = '';
            document.getElementById('new-map-y-label').value = '';

            App.toast(`Mapa "${name}" salvo com sucesso!`, 'success');
        });
    },

    setupImportExport() {
        const importArea = document.getElementById('db-import-area');
        const importInput = document.getElementById('db-import-input');

        importArea.addEventListener('click', () => importInput.click());
        importArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            importArea.style.borderColor = 'var(--accent-blue)';
        });
        importArea.addEventListener('dragleave', () => {
            importArea.style.borderColor = '';
        });
        importArea.addEventListener('drop', (e) => {
            e.preventDefault();
            importArea.style.borderColor = '';
            if (e.dataTransfer.files.length > 0) this.handleImport(e.dataTransfer.files[0]);
        });
        importInput.addEventListener('change', () => {
            if (importInput.files.length > 0) this.handleImport(importInput.files[0]);
        });

        document.getElementById('btn-export-all').addEventListener('click', () => {
            const exportData = {
                type: 'math-tools-export',
                version: '1.0',
                exportDate: new Date().toISOString(),
                data: {
                    pinouts: App.getAllPinouts(),
                    dtcCodes: App.getAllDTC(),
                    ecuMaps: App.getAllMaps()
                }
            };
            App.downloadJSON(exportData, `math-tools-backup-${new Date().toISOString().slice(0, 10)}.json`);
            App.toast('Base completa exportada!', 'success');
        });

        document.getElementById('btn-export-pinouts').addEventListener('click', () => {
            App.downloadJSON(App.getAllPinouts(), 'math-pinouts.json');
            App.toast('Pinagens exportadas!', 'success');
        });

        document.getElementById('btn-export-dtc').addEventListener('click', () => {
            App.downloadJSON(App.getAllDTC(), 'math-dtc-codes.json');
            App.toast('Códigos de falha exportados!', 'success');
        });

        document.getElementById('btn-export-maps').addEventListener('click', () => {
            App.downloadJSON(App.getAllMaps(), 'math-maps.json');
            App.toast('Mapas exportados!', 'success');
        });
    },

    handleImport(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);

                if ((json.type === 'math-tools-export' || json.type === 'ecu-tools-export') && json.data) {
                    let count = 0;

                    if (json.data.pinouts) {
                        json.data.pinouts.forEach(p => {
                            p.custom = true;
                            if (!App.getAllPinouts().some(ep => ep.id === p.id)) {
                                App.data.customPinouts.push(p);
                                count++;
                            }
                        });
                    }
                    if (json.data.dtcCodes) {
                        json.data.dtcCodes.forEach(d => {
                            d.custom = true;
                            if (!App.getAllDTC().some(ed => ed.code === d.code)) {
                                App.data.customDtcCodes.push(d);
                                count++;
                            }
                        });
                    }
                    if (json.data.ecuMaps) {
                        json.data.ecuMaps.forEach(m => {
                            m.custom = true;
                            if (!App.getAllMaps().some(em => em.id === m.id)) {
                                App.data.customMaps.push(m);
                                count++;
                            }
                        });
                    }

                    App.saveCustomData();
                    App.updateDashboardStats();
                    this.updateStats();
                    PinoutsModule.populateFilters();
                    PinoutsModule.renderList();
                    DTCModule.populateFilters();
                    DTCModule.renderResults();
                    MapsModule.populateSelector();

                    App.toast(`Importação concluída: ${count} novas entradas adicionadas.`, 'success');
                } else if (Array.isArray(json)) {
                    if (json.length > 0 && json[0].code) {
                        let count = 0;
                        json.forEach(d => {
                            d.custom = true;
                            if (!App.getAllDTC().some(ed => ed.code === d.code)) {
                                App.data.customDtcCodes.push(d);
                                count++;
                            }
                        });
                        App.saveCustomData();
                        DTCModule.populateFilters();
                        DTCModule.renderResults();
                        App.toast(`${count} códigos DTC importados.`, 'success');
                    } else if (json.length > 0 && json[0].brand) {
                        let count = 0;
                        json.forEach(p => {
                            p.custom = true;
                            if (!App.getAllPinouts().some(ep => ep.id === p.id)) {
                                App.data.customPinouts.push(p);
                                count++;
                            }
                        });
                        App.saveCustomData();
                        PinoutsModule.populateFilters();
                        PinoutsModule.renderList();
                        App.toast(`${count} pinagens importadas.`, 'success');
                    } else if (json.length > 0 && json[0].xAxis) {
                        let count = 0;
                        json.forEach(m => {
                            m.custom = true;
                            if (!App.getAllMaps().some(em => em.id === m.id)) {
                                App.data.customMaps.push(m);
                                count++;
                            }
                        });
                        App.saveCustomData();
                        MapsModule.populateSelector();
                        App.toast(`${count} mapas importados.`, 'success');
                    }

                    App.updateDashboardStats();
                    this.updateStats();
                } else {
                    App.toast('Formato de arquivo não reconhecido. Verifique a documentação.', 'error');
                }
            } catch (err) {
                App.toast('Erro ao importar: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }
};
