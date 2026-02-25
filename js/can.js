/* ============================================
   Math Tools Pro - Módulo de Sinais CAN Bus
   ============================================ */

const CANModule = {
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

    setupEvents() {
        document.getElementById('can-search').addEventListener('input', (e) => {
            this.renderVehicles(e.target.value);
        });
    }
};
