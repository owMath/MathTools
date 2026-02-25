/* ============================================
   Math Tools Pro - Módulo de PIDs OBD-II
   ============================================ */

const PIDsModule = {
    init() {
        this.populateFilters();
        this.renderResults();
        this.setupEvents();
    },

    populateFilters() {
        const categories = new Set();
        App.data.obdPids.forEach(p => { if (p.category) categories.add(p.category); });

        const select = document.getElementById('pid-category-filter');
        select.innerHTML = '<option value="">Todas as Categorias</option>';
        [...categories].sort().forEach(c => {
            select.innerHTML += `<option value="${c}">${c}</option>`;
        });
    },

    renderResults() {
        const container = document.getElementById('pid-results');
        let pids = App.data.obdPids;

        const search = document.getElementById('pid-search').value.toLowerCase();
        const modeFilter = document.getElementById('pid-mode-filter').value;
        const catFilter = document.getElementById('pid-category-filter').value;

        if (search) {
            pids = pids.filter(p =>
                p.pid.toLowerCase().includes(search) ||
                p.description.toLowerCase().includes(search) ||
                (p.category && p.category.toLowerCase().includes(search))
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

        const modeLabels = {
            '01': 'Mode 01 - Dados em Tempo Real',
            '09': 'Mode 09 - Info do Veículo'
        };

        const grouped = {};
        pids.forEach(p => {
            const key = p.mode || '01';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });

        let html = '';
        for (const [mode, items] of Object.entries(grouped)) {
            html += `<div class="card" style="margin-bottom: 1rem;">
                <div class="card-header">
                    <h2><i class="fas fa-list"></i> ${modeLabels[mode] || 'Mode ' + mode} (${items.length} PIDs)</h2>
                </div>
                <div class="card-body" style="padding:0;">
                    <div style="overflow-x:auto;">
                        <table class="pin-table">
                            <thead>
                                <tr>
                                    <th style="width:80px;">PID</th>
                                    <th style="width:60px;">Bytes</th>
                                    <th>Descrição</th>
                                    <th style="width:150px;">Categoria</th>
                                </tr>
                            </thead>
                            <tbody>`;
            items.forEach(p => {
                const catColor = this.getCategoryColor(p.category);
                html += `<tr>
                    <td class="pin-number" style="font-size:0.9rem;">0x${p.pid}</td>
                    <td style="text-align:center;color:var(--text-secondary);">${p.dataBytes}</td>
                    <td>${p.description}</td>
                    <td><span style="background:${catColor}20;color:${catColor};padding:0.15rem 0.5rem;border-radius:10px;font-size:0.78rem;white-space:nowrap;">${p.category || 'Geral'}</span></td>
                </tr>`;
            });
            html += '</tbody></table></div></div></div>';
        }

        container.innerHTML = html;
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
        };
        return colors[cat] || '#6b7280';
    },

    setupEvents() {
        document.getElementById('pid-search').addEventListener('input', () => this.renderResults());
        document.getElementById('pid-mode-filter').addEventListener('change', () => this.renderResults());
        document.getElementById('pid-category-filter').addEventListener('change', () => this.renderResults());
    }
};
