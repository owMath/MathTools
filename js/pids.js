/* ============================================
   Math Tools Pro - Módulo de PIDs OBD-II
   Versão 2.0 - Com fórmulas, unidades e ranges
   ============================================ */

const PIDsModule = {
    currentPid: null,

    init() {
        this.populateFilters();
        this.renderResults();
        this.setupEvents();
    },

    populateFilters() {
        const categories = new Set();
        const modes = new Set();
        App.data.obdPids.forEach(p => {
            if (p.category) categories.add(p.category);
            if (p.mode) modes.add(p.mode);
        });

        const catSelect = document.getElementById('pid-category-filter');
        catSelect.innerHTML = '<option value="">Todas as Categorias</option>';
        [...categories].sort().forEach(c => {
            catSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });

        const modeSelect = document.getElementById('pid-mode-filter');
        modeSelect.innerHTML = '<option value="">Todos os Modos</option>';
        const modeLabels = this.getModeLabels();
        [...modes].sort().forEach(m => {
            modeSelect.innerHTML += `<option value="${m}">${modeLabels[m] || 'Mode ' + m}</option>`;
        });
    },

    getModeLabels() {
        return {
            '01': 'Mode 01 - Dados em Tempo Real',
            '02': 'Mode 02 - Freeze Frame',
            '03': 'Mode 03 - DTCs Armazenados',
            '04': 'Mode 04 - Limpar DTCs',
            '05': 'Mode 05 - Monitoramento O2',
            '06': 'Mode 06 - Testes On-board',
            '07': 'Mode 07 - DTCs Pendentes',
            '08': 'Mode 08 - Controle On-board',
            '09': 'Mode 09 - Info do Veículo'
        };
    },

    getModeIcon(mode) {
        const icons = {
            '01': 'fa-tachometer-alt',
            '02': 'fa-snowflake',
            '03': 'fa-exclamation-triangle',
            '04': 'fa-eraser',
            '05': 'fa-wave-square',
            '06': 'fa-flask',
            '07': 'fa-clock',
            '08': 'fa-sliders-h',
            '09': 'fa-info-circle'
        };
        return icons[mode] || 'fa-list';
    },

    getModeColor(mode) {
        const colors = {
            '01': '#3b82f6',
            '02': '#06b6d4',
            '03': '#ef4444',
            '04': '#f59e0b',
            '05': '#10b981',
            '06': '#8b5cf6',
            '07': '#f97316',
            '08': '#ec4899',
            '09': '#6366f1'
        };
        return colors[mode] || '#6b7280';
    },

    renderResults() {
        const container = document.getElementById('pid-results');
        let pids = App.data.obdPids;

        const search = document.getElementById('pid-search').value.toLowerCase();
        const modeFilter = document.getElementById('pid-mode-filter').value;
        const catFilter = document.getElementById('pid-category-filter').value;

        if (search) {
            pids = pids.filter(p =>
                (p.pid && p.pid.toLowerCase().includes(search)) ||
                p.description.toLowerCase().includes(search) ||
                (p.category && p.category.toLowerCase().includes(search)) ||
                (p.formula && p.formula.toLowerCase().includes(search)) ||
                (p.unit && p.unit.toLowerCase().includes(search))
            );
        }
        if (modeFilter) {
            pids = pids.filter(p => p.mode === modeFilter);
        }
        if (catFilter) {
            pids = pids.filter(p => p.category === catFilter);
        }

        if (pids.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhum PID encontrado</h3>
                    <p>Tente ajustar os filtros</p>
                </div>`;
            return;
        }

        const modeLabels = this.getModeLabels();
        const grouped = {};
        pids.forEach(p => {
            const key = p.mode || '01';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });

        let html = '';
        const sortedModes = Object.keys(grouped).sort();

        for (const mode of sortedModes) {
            const items = grouped[mode];
            const modeColor = this.getModeColor(mode);
            const modeIcon = this.getModeIcon(mode);

            html += `<div class="card" style="margin-bottom: 1rem;">
                <div class="card-header" style="border-left: 3px solid ${modeColor};">
                    <h2><i class="fas ${modeIcon}" style="color:${modeColor};"></i> ${modeLabels[mode] || 'Mode ' + mode} <span style="font-size:0.8rem;font-weight:400;color:var(--text-muted);">(${items.length} PIDs)</span></h2>
                </div>
                <div class="card-body" style="padding:0;">
                    <div style="overflow-x:auto;">
                        <table class="pin-table">
                            <thead>
                                <tr>
                                    <th style="width:70px;">PID</th>
                                    <th style="width:50px;">Bytes</th>
                                    <th>Descrição</th>
                                    <th style="width:180px;">Fórmula</th>
                                    <th style="width:70px;">Unidade</th>
                                    <th style="width:110px;">Range</th>
                                    <th style="width:120px;">Categoria</th>
                                </tr>
                            </thead>
                            <tbody>`;

            items.forEach(p => {
                const catColor = this.getCategoryColor(p.category);
                const pidDisplay = p.pid === 'N/A' ? 'N/A' : `0x${p.pid}`;
                const hasFormula = p.formula && p.formula !== '-' && p.formula !== 'Bit encoded' && p.formula !== 'Enumerated' && p.formula !== 'Various';
                const rangeStr = (p.min !== undefined && p.max !== undefined) ? `${p.min} ~ ${p.max}` : '-';
                const formulaStyle = hasFormula
                    ? 'font-family:Consolas,monospace;font-size:0.78rem;color:var(--accent-cyan);background:var(--bg-secondary);padding:0.15rem 0.4rem;border-radius:4px;'
                    : 'font-size:0.8rem;color:var(--text-muted);font-style:italic;';

                html += `<tr style="cursor:pointer;" onclick="PIDsModule.showDetail('${p.mode}','${p.pid}')">
                    <td class="pin-number" style="font-size:0.85rem;">${pidDisplay}</td>
                    <td style="text-align:center;color:var(--text-secondary);">${p.dataBytes !== null && p.dataBytes !== undefined ? p.dataBytes : '-'}</td>
                    <td>${p.description}</td>
                    <td><span style="${formulaStyle}">${p.formula || '-'}</span></td>
                    <td style="text-align:center;"><span style="background:var(--bg-secondary);padding:0.1rem 0.4rem;border-radius:4px;font-size:0.8rem;">${p.unit || '-'}</span></td>
                    <td style="text-align:center;font-size:0.8rem;color:var(--text-secondary);">${rangeStr}</td>
                    <td><span style="background:${catColor}20;color:${catColor};padding:0.15rem 0.5rem;border-radius:10px;font-size:0.75rem;white-space:nowrap;">${p.category || 'Geral'}</span></td>
                </tr>`;
            });

            html += '</tbody></table></div></div></div>';
        }

        container.innerHTML = html;
    },

    showDetail(mode, pid) {
        const p = App.data.obdPids.find(x => x.mode === mode && x.pid === pid);
        if (!p) return;
        this.currentPid = p;

        const hasFormula = p.formula && p.formula !== '-';
        const hasRange = p.min !== undefined && p.max !== undefined;
        const modeColor = this.getModeColor(p.mode);
        const catColor = this.getCategoryColor(p.category);

        let body = `
            <div style="text-align:center;margin-bottom:1rem;">
                <div style="font-family:Consolas,monospace;font-size:2rem;font-weight:700;color:${modeColor};">
                    Mode ${p.mode} PID ${p.pid === 'N/A' ? 'N/A' : '0x' + p.pid}
                </div>
                <p style="font-size:1.05rem;margin-top:0.5rem;">${p.description}</p>
                <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.75rem;flex-wrap:wrap;">
                    <span style="background:${modeColor}20;color:${modeColor};padding:0.2rem 0.6rem;border-radius:10px;font-size:0.82rem;">Mode ${p.mode}</span>
                    <span style="background:${catColor}20;color:${catColor};padding:0.2rem 0.6rem;border-radius:10px;font-size:0.82rem;">${p.category || 'Geral'}</span>
                    ${p.dataBytes ? `<span style="background:var(--bg-secondary);padding:0.2rem 0.6rem;border-radius:10px;font-size:0.82rem;color:var(--text-secondary);">${p.dataBytes} byte(s)</span>` : ''}
                </div>
            </div>`;

        if (hasFormula) {
            body += `
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1rem;margin-bottom:1rem;">
                    <h4 style="color:var(--accent-cyan);margin-bottom:0.5rem;font-size:0.9rem;"><i class="fas fa-function"></i> Fórmula de Decodificação</h4>
                    <div style="font-family:Consolas,monospace;font-size:1.1rem;color:var(--accent-cyan);background:var(--bg-card);padding:0.75rem;border-radius:var(--radius-sm);text-align:center;border:1px solid var(--border-color);">
                        ${p.formula}
                    </div>
                    <div style="display:flex;gap:1.5rem;margin-top:0.75rem;justify-content:center;">
                        ${p.unit && p.unit !== '-' ? `<div><span style="color:var(--text-muted);font-size:0.8rem;">Unidade:</span> <strong style="color:var(--accent-blue);">${p.unit}</strong></div>` : ''}
                        ${hasRange ? `<div><span style="color:var(--text-muted);font-size:0.8rem;">Min:</span> <strong style="color:var(--accent-green);">${p.min}</strong></div>
                        <div><span style="color:var(--text-muted);font-size:0.8rem;">Max:</span> <strong style="color:var(--accent-orange);">${p.max}</strong></div>` : ''}
                    </div>
                </div>`;
        }

        body += `
            <div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:0.75rem;">
                <h4 style="margin-bottom:0.5rem;font-size:0.88rem;color:var(--text-secondary);"><i class="fas fa-info-circle"></i> Detalhes Técnicos</h4>
                <table style="width:100%;font-size:0.85rem;">
                    <tr><td style="padding:0.3rem;color:var(--text-muted);width:40%;">Byte A, B, C, D:</td><td>Bytes de resposta da ECU</td></tr>
                    <tr><td style="padding:0.3rem;color:var(--text-muted);">Padrão:</td><td>SAE J1979 / ISO 15031-5</td></tr>
                    <tr><td style="padding:0.3rem;color:var(--text-muted);">Protocolo:</td><td>OBD-II (CAN / ISO 9141 / KWP2000)</td></tr>
                    <tr><td style="padding:0.3rem;color:var(--text-muted);">Request:</td><td style="font-family:Consolas;color:var(--accent-blue);">${p.pid !== 'N/A' ? p.mode + ' ' + p.pid : p.mode}</td></tr>
                </table>
            </div>`;

        App.showModal(
            `<i class="fas fa-tachometer-alt" style="color:${modeColor};"></i> PID ${p.pid === 'N/A' ? '' : '0x' + p.pid} - Mode ${p.mode}`,
            body
        );
    },

    getCategoryColor(cat) {
        const colors = {
            'Motor': '#3b82f6',
            'Combustível': '#f59e0b',
            'Temperatura': '#ef4444',
            'Pressão': '#8b5cf6',
            'Velocidade': '#10b981',
            'Sonda Lambda': '#06b6d4',
            'Admissão de Ar': '#6366f1',
            'Aceleração/Borboleta': '#ec4899',
            'Turbo': '#f97316',
            'Emissões': '#84cc16',
            'EGR': '#14b8a6',
            'Diagnóstico': '#a855f7',
            'Sistema OBD': '#64748b',
            'Tempo/Distância': '#0ea5e9',
            'Elétrico': '#eab308',
            'Evaporação': '#22d3ee',
            'Escapamento': '#f43f5e',
            'Informações do Veículo': '#8b5cf6',
            'Freeze Frame': '#06b6d4',
            'O2 Sensor Monitoring': '#10b981',
        };
        return colors[cat] || '#6b7280';
    },

    setupEvents() {
        document.getElementById('pid-search').addEventListener('input', () => this.renderResults());
        document.getElementById('pid-mode-filter').addEventListener('change', () => this.renderResults());
        document.getElementById('pid-category-filter').addEventListener('change', () => this.renderResults());
    }
};
