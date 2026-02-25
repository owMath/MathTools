/* ============================================
   Math Tools Pro - Módulo de Códigos de Falha
   ============================================ */

const DTCModule = {
    currentDTC: null,

    init() {
        this.populateFilters();
        this.renderResults();
        this.setupEvents();
    },

    populateFilters() {
        const systems = new Set();
        App.getAllDTC().forEach(d => { if (d.system) systems.add(d.system); });

        const select = document.getElementById('dtc-system-filter');
        select.innerHTML = '<option value="">Todos os Sistemas</option>';
        [...systems].sort().forEach(s => {
            select.innerHTML += `<option value="${s}">${s}</option>`;
        });
    },

    renderResults(filter = {}) {
        const container = document.getElementById('dtc-results');
        let codes = App.getAllDTC();

        if (filter.search) {
            const q = filter.search.toLowerCase();
            codes = codes.filter(d =>
                d.code.toLowerCase().includes(q) ||
                (d.description && d.description.toLowerCase().includes(q)) ||
                (d.description_en && d.description_en.toLowerCase().includes(q)) ||
                (d.description_pt && d.description_pt.toLowerCase().includes(q)) ||
                (d.system && d.system.toLowerCase().includes(q))
            );
        }
        if (filter.category) {
            codes = codes.filter(d => d.category === filter.category);
        }
        if (filter.system) {
            codes = codes.filter(d => d.system === filter.system);
        }

        // Limitar renderização para performance (6000+ códigos)
        const MAX_RENDER = 200;
        const totalCount = codes.length;
        const truncated = codes.length > MAX_RENDER;
        if (truncated) codes = codes.slice(0, MAX_RENDER);

        if (totalCount === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <i class="fas fa-search" style="font-size: 2rem;"></i>
                    <h3>Nenhum código encontrado</h3>
                    <p>Tente buscar por outro código ou ajustar os filtros</p>
                </div>`;
            return;
        }

        let html = '';
        if (truncated) {
            html += `<div style="padding:0.6rem 1rem;background:var(--accent-blue-glow);border-bottom:1px solid var(--border-color);font-size:0.82rem;color:var(--accent-blue);">
                <i class="fas fa-info-circle"></i> Mostrando ${MAX_RENDER} de ${totalCount} resultados. Use a busca para filtrar.
            </div>`;
        }

        html += codes.map(d => {
            const desc = d.description || d.description_pt || d.description_en || '';
            return `<div class="dtc-item ${this.currentDTC?.code === d.code ? 'active' : ''}" data-code="${d.code}">
                <span class="dtc-code-badge">${d.code}</span>
                <div class="dtc-item-info">
                    <h4>${desc}</h4>
                    <div class="dtc-system">${d.system || 'Geral'} ${d.custom ? '● CUSTOM' : ''}</div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
    },

    showDetail(code) {
        const dtc = App.getAllDTC().find(d => d.code === code);
        if (!dtc) return;

        this.currentDTC = dtc;
        this.renderResults(this.getCurrentFilters());

        const detail = document.getElementById('dtc-detail');
        const severityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
        const categoryLabels = {
            P: 'Powertrain (Motor/Transmissão)',
            B: 'Body (Carroceria)',
            C: 'Chassis (Chassi)',
            U: 'Network (Comunicação)'
        };

        const descPT = dtc.description_pt || dtc.description || '';
        const descEN = dtc.description_en || '';
        const mainDesc = descPT || descEN;

        detail.innerHTML = `
            <div class="dtc-detail-code">${dtc.code}</div>
            <p style="font-size: 1.05rem; margin-bottom: 0.25rem;">${mainDesc}</p>
            ${descPT && descEN && descPT !== descEN ? `<p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fas fa-globe"></i> EN: ${descEN}</p>` : ''}
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                <span class="severity-badge severity-${dtc.severity || 'medium'}">
                    Severidade: ${severityLabels[dtc.severity] || 'Média'}
                </span>
                <span class="map-badge secondary" style="font-size: 0.75rem;">
                    ${categoryLabels[dtc.category] || dtc.category}
                </span>
                ${dtc.system ? `<span class="map-badge secondary" style="font-size: 0.75rem;">${dtc.system}</span>` : ''}
            </div>

            ${dtc.causes && dtc.causes.length > 0 ? `
                <h3><i class="fas fa-search"></i> Causas Possíveis</h3>
                <ul>${dtc.causes.map(c => `<li>${c}</li>`).join('')}</ul>
            ` : ''}

            ${dtc.solutions && dtc.solutions.length > 0 ? `
                <h3><i class="fas fa-wrench"></i> Soluções Sugeridas</h3>
                <ul>${dtc.solutions.map(s => `<li>${s}</li>`).join('')}</ul>
            ` : ''}

            <h3><i class="fas fa-info-circle"></i> Interpretação do Código</h3>
            <div style="background: var(--bg-secondary); border-radius: var(--radius-sm); padding: 1rem; margin-top: 0.5rem;">
                ${this.interpretCode(dtc.code)}
            </div>
        `;
    },

    interpretCode(code) {
        if (!code || code.length < 5) return '';

        const prefix = code[0];
        const digit1 = parseInt(code[1]);
        const digit2 = code[2];

        const prefixNames = { P: 'Powertrain', B: 'Body', C: 'Chassis', U: 'Network' };
        const typeNames = { 0: 'Genérico (SAE/ISO)', 1: 'Específico do fabricante', 2: 'Genérico (SAE/ISO)', 3: 'Genérico/Específico' };

        const systemNames = {
            P: { 0: 'Mistura Ar/Combustível e Dosagem', 1: 'Mistura Ar/Combustível e Dosagem', 2: 'Mistura Ar/Combustível (Injeção)', 3: 'Ignição', 4: 'Emissões Auxiliares', 5: 'Controle de Marcha Lenta e Velocidade', 6: 'Circuitos de Entrada/Saída da ECU', 7: 'Transmissão', 8: 'Transmissão' },
            B: { 0: 'Geral', 1: 'Geral', 2: 'Geral', 3: 'Geral' },
            C: { 0: 'Geral', 1: 'Geral' },
            U: { 0: 'Comunicação CAN/Rede', 1: 'Comunicação' }
        };

        const systemDesc = systemNames[prefix]?.[digit2] || 'Sistema não classificado';

        return `
            <table style="width:100%;font-size:0.85rem;">
                <tr>
                    <td style="padding:0.3rem 0.5rem;color:var(--text-muted);width:40%;">Categoria:</td>
                    <td style="padding:0.3rem 0.5rem;"><strong>${prefix}</strong> - ${prefixNames[prefix] || 'Desconhecido'}</td>
                </tr>
                <tr>
                    <td style="padding:0.3rem 0.5rem;color:var(--text-muted);">Tipo:</td>
                    <td style="padding:0.3rem 0.5rem;">${typeNames[digit1] || 'Desconhecido'}</td>
                </tr>
                <tr>
                    <td style="padding:0.3rem 0.5rem;color:var(--text-muted);">Sistema:</td>
                    <td style="padding:0.3rem 0.5rem;">${systemDesc}</td>
                </tr>
                <tr>
                    <td style="padding:0.3rem 0.5rem;color:var(--text-muted);">Código completo:</td>
                    <td style="padding:0.3rem 0.5rem;font-family:Consolas,monospace;color:var(--accent-orange);font-weight:700;">${code}</td>
                </tr>
            </table>
        `;
    },

    getCurrentFilters() {
        return {
            search: document.getElementById('dtc-search').value,
            category: document.getElementById('dtc-category-filter').value,
            system: document.getElementById('dtc-system-filter').value
        };
    },

    setupEvents() {
        document.getElementById('dtc-results').addEventListener('click', (e) => {
            const item = e.target.closest('.dtc-item');
            if (item) this.showDetail(item.dataset.code);
        });

        document.getElementById('dtc-search').addEventListener('input', () => {
            this.renderResults(this.getCurrentFilters());
        });

        document.getElementById('dtc-category-filter').addEventListener('change', () => {
            this.renderResults(this.getCurrentFilters());
        });

        document.getElementById('dtc-system-filter').addEventListener('change', () => {
            this.renderResults(this.getCurrentFilters());
        });
    }
};
