/* ============================================
   Math Tools Pro - Módulo de Sinais CAN Bus
   Versão 2.0 - Com parser DBC
   ============================================ */

const CANModule = {
    parsedDBC: null,

    init() {
        this.renderCommonSignals();
        this.renderVehicles();
        this.setupEvents();
    },

    renderCommonSignals() {
        const container = document.getElementById('can-common-signals');
        const signals = App.data.canSignals.commonSignals || [];

        if (signals.length === 0) {
            container.innerHTML = '<p class="text-muted">Nenhum sinal disponível</p>';
            return;
        }

        let html = '<div style="overflow-x:auto;"><table class="pin-table"><thead><tr>';
        html += '<th>Sinal</th><th>Nome</th><th>Unidade</th><th>PID/Fonte</th><th>Descrição</th>';
        html += '</tr></thead><tbody>';

        signals.forEach(s => {
            const isOBD = s.pid && s.pid.startsWith('0x');
            const sourceColor = isOBD ? 'var(--accent-green)' : 'var(--accent-purple)';
            const sourceLabel = isOBD ? `OBD ${s.pid}` : 'CAN Nativo';
            html += `<tr>
                <td style="font-family:Consolas;font-weight:700;color:var(--accent-blue);font-size:0.82rem;">${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td style="text-align:center;"><span style="background:var(--bg-secondary);padding:0.15rem 0.5rem;border-radius:4px;font-size:0.82rem;">${s.unit}</span></td>
                <td><span style="background:${sourceColor}15;color:${sourceColor};padding:0.15rem 0.5rem;border-radius:10px;font-size:0.78rem;">${sourceLabel}</span></td>
                <td style="color:var(--text-secondary);font-size:0.83rem;">${s.description}</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    renderVehicles(searchTerm = '') {
        const container = document.getElementById('can-vehicles-list');
        let vehicles = App.data.canSignals.vehicles || [];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            vehicles = vehicles.filter(v =>
                v.make.toLowerCase().includes(q) ||
                v.models.some(m => m.toLowerCase().includes(q))
            ).map(v => {
                if (v.make.toLowerCase().includes(q)) return v;
                return {
                    ...v,
                    models: v.models.filter(m => m.toLowerCase().includes(q))
                };
            });
        }

        if (vehicles.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem;">
                    <i class="fas fa-search" style="font-size: 2rem;"></i>
                    <h3>Nenhum veículo encontrado</h3>
                </div>`;
            return;
        }

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">';

        vehicles.forEach(v => {
            html += `
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1rem;">
                    <h4 style="color:var(--accent-blue);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem;">
                        <i class="fas fa-car"></i> ${v.make}
                        <span style="background:var(--accent-blue)15;color:var(--accent-blue);padding:0.1rem 0.4rem;border-radius:8px;font-size:0.75rem;font-weight:400;">${v.models.length}</span>
                    </h4>
                    <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
                        ${v.models.map(m => `<span style="background:var(--bg-card);border:1px solid var(--border-color);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.8rem;color:var(--text-secondary);">${m}</span>`).join('')}
                    </div>
                </div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    parseDBC(text) {
        const result = {
            version: '',
            messages: [],
            signalCount: 0
        };

        const lines = text.split('\n');
        let currentMsg = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('VERSION')) {
                const match = line.match(/VERSION\s+"([^"]*)"/);
                if (match) result.version = match[1];
                continue;
            }

            const msgMatch = line.match(/^BO_\s+(\d+)\s+(\w+)\s*:\s*(\d+)\s+(\w+)/);
            if (msgMatch) {
                currentMsg = {
                    id: parseInt(msgMatch[1]),
                    idHex: '0x' + parseInt(msgMatch[1]).toString(16).toUpperCase().padStart(3, '0'),
                    name: msgMatch[2],
                    dlc: parseInt(msgMatch[3]),
                    sender: msgMatch[4],
                    signals: []
                };
                result.messages.push(currentMsg);
                continue;
            }

            const sigMatch = line.match(/^\s*SG_\s+(\w+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*\[\s*([^|]*)\|([^\]]*)\]\s*"([^"]*)"\s*(.*)/);
            if (sigMatch && currentMsg) {
                const signal = {
                    name: sigMatch[1],
                    startBit: parseInt(sigMatch[2]),
                    bitLength: parseInt(sigMatch[3]),
                    byteOrder: sigMatch[4] === '1' ? 'Little Endian' : 'Big Endian',
                    valueType: sigMatch[5] === '+' ? 'Unsigned' : 'Signed',
                    factor: parseFloat(sigMatch[6]),
                    offset: parseFloat(sigMatch[7]),
                    min: parseFloat(sigMatch[8]),
                    max: parseFloat(sigMatch[9]),
                    unit: sigMatch[10],
                    receivers: sigMatch[11] ? sigMatch[11].trim().split(',').map(r => r.trim()) : []
                };
                currentMsg.signals.push(signal);
                result.signalCount++;
                continue;
            }
        }

        return result;
    },

    handleDBCUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = this.parseDBC(e.target.result);
                this.parsedDBC = parsed;
                this.renderDBCResults(parsed, file.name);
                App.toast(`DBC "${file.name}" parseado: ${parsed.messages.length} mensagens, ${parsed.signalCount} sinais`, 'success');
            } catch (err) {
                App.toast('Erro ao parsear DBC: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    },

    renderDBCResults(dbc, filename) {
        const container = document.getElementById('dbc-results');
        if (!container) return;

        let html = `
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1rem;margin-bottom:1rem;">
                <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;">
                    <span class="map-badge"><i class="fas fa-file-code"></i> ${filename}</span>
                    ${dbc.version ? `<span class="map-badge secondary">Versão: ${dbc.version}</span>` : ''}
                    <span class="map-badge secondary">${dbc.messages.length} mensagens</span>
                    <span class="map-badge secondary">${dbc.signalCount} sinais</span>
                </div>
            </div>

            <div class="search-box" style="margin-bottom:1rem;">
                <i class="fas fa-search"></i>
                <input type="text" id="dbc-signal-search" placeholder="Buscar mensagem ou sinal (ex: EngineRPM, SteeringAngle...)">
            </div>

            <div id="dbc-messages-list">`;

        dbc.messages.forEach((msg, idx) => {
            if (msg.signals.length === 0) return;

            html += `
                <div class="card" style="margin-bottom:0.75rem;">
                    <div class="card-header" style="cursor:pointer;padding:0.6rem 1rem;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                            <span style="font-family:Consolas;font-weight:700;color:var(--accent-blue);font-size:0.9rem;background:var(--bg-secondary);padding:0.2rem 0.5rem;border-radius:4px;">${msg.idHex}</span>
                            <strong>${msg.name}</strong>
                            <span style="color:var(--text-muted);font-size:0.8rem;">DLC: ${msg.dlc} | ${msg.signals.length} sinais | TX: ${msg.sender}</span>
                            <i class="fas fa-chevron-down" style="margin-left:auto;color:var(--text-muted);font-size:0.75rem;"></i>
                        </div>
                    </div>
                    <div class="card-body" style="padding:0;display:${idx < 5 ? 'block' : 'none'};">
                        <table class="pin-table">
                            <thead>
                                <tr>
                                    <th>Sinal</th>
                                    <th style="width:70px;">Start Bit</th>
                                    <th style="width:60px;">Length</th>
                                    <th style="width:100px;">Byte Order</th>
                                    <th style="width:80px;">Factor</th>
                                    <th style="width:70px;">Offset</th>
                                    <th style="width:100px;">Range</th>
                                    <th style="width:60px;">Unit</th>
                                </tr>
                            </thead>
                            <tbody>`;

            msg.signals.forEach(sig => {
                html += `<tr>
                    <td style="font-family:Consolas;font-weight:600;color:var(--accent-cyan);font-size:0.83rem;">${sig.name}</td>
                    <td style="text-align:center;">${sig.startBit}</td>
                    <td style="text-align:center;">${sig.bitLength}</td>
                    <td style="font-size:0.78rem;">${sig.byteOrder} ${sig.valueType === 'Signed' ? '(S)' : '(U)'}</td>
                    <td style="text-align:center;font-family:Consolas;font-size:0.82rem;">${sig.factor}</td>
                    <td style="text-align:center;font-family:Consolas;font-size:0.82rem;">${sig.offset}</td>
                    <td style="text-align:center;font-size:0.8rem;">${sig.min} ~ ${sig.max}</td>
                    <td style="text-align:center;"><span style="background:var(--bg-secondary);padding:0.1rem 0.3rem;border-radius:3px;font-size:0.78rem;">${sig.unit || '-'}</span></td>
                </tr>`;
            });

            html += '</tbody></table></div></div>';
        });

        html += '</div>';
        container.innerHTML = html;
        container.style.display = 'block';

        const searchInput = document.getElementById('dbc-signal-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                document.querySelectorAll('#dbc-messages-list > .card').forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(q) ? '' : 'none';
                });
            });
        }
    },

    setupEvents() {
        document.getElementById('can-search').addEventListener('input', (e) => {
            this.renderVehicles(e.target.value);
        });

        const dbcUploadArea = document.getElementById('dbc-upload-area');
        const dbcInput = document.getElementById('dbc-file-input');

        if (dbcUploadArea && dbcInput) {
            dbcUploadArea.addEventListener('click', () => dbcInput.click());
            dbcUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                dbcUploadArea.style.borderColor = 'var(--accent-blue)';
            });
            dbcUploadArea.addEventListener('dragleave', () => {
                dbcUploadArea.style.borderColor = '';
            });
            dbcUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                dbcUploadArea.style.borderColor = '';
                if (e.dataTransfer.files.length > 0) this.handleDBCUpload(e.dataTransfer.files[0]);
            });
            dbcInput.addEventListener('change', () => {
                if (dbcInput.files.length > 0) this.handleDBCUpload(dbcInput.files[0]);
            });
        }
    }
};
