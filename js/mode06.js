/* ============================================
   Math Tools Pro - Módulo Mode $06
   Test Results On-board Monitoring
   ============================================ */

const Mode06Module = {
    init() {
        if (!App.data.mode06Tests || !App.data.mode06Tests.testGroups) return;
        this.renderTestGroups();
        this.setupEvents();
    },

    renderTestGroups(searchTerm = '') {
        const container = document.getElementById('mode06-results');
        if (!container) return;

        let groups = App.data.mode06Tests.testGroups || [];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            groups = groups.map(g => {
                const filteredTests = g.tests.filter(t =>
                    t.name.toLowerCase().includes(q) ||
                    (t.namePt && t.namePt.toLowerCase().includes(q)) ||
                    t.tid.toLowerCase().includes(q) ||
                    (t.description && t.description.toLowerCase().includes(q))
                );
                if (filteredTests.length > 0 || g.name.toLowerCase().includes(q) || (g.namePt && g.namePt.toLowerCase().includes(q))) {
                    return { ...g, tests: filteredTests.length > 0 ? filteredTests : g.tests };
                }
                return null;
            }).filter(Boolean);
        }

        if (groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:2rem;">
                    <i class="fas fa-search" style="font-size:2rem;"></i>
                    <h3>Nenhum teste encontrado</h3>
                    <p>Tente ajustar a busca</p>
                </div>`;
            return;
        }

        const groupColors = [
            '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
            '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6', '#6366f1'
        ];

        let html = '';
        groups.forEach((g, gi) => {
            const color = groupColors[gi % groupColors.length];
            html += `
                <div class="card" style="margin-bottom:1rem;">
                    <div class="card-header" style="border-left:3px solid ${color};cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                            <span style="background:${color}20;color:${color};padding:0.3rem 0.6rem;border-radius:8px;font-size:0.82rem;font-weight:600;">${g.id.toUpperCase()}</span>
                            <div>
                                <h2 style="font-size:0.95rem;margin:0;">${g.namePt || g.name}</h2>
                                <span style="font-size:0.78rem;color:var(--text-muted);">${g.name} - ${g.tests.length} testes</span>
                            </div>
                            <i class="fas fa-chevron-down" style="margin-left:auto;color:var(--text-muted);font-size:0.75rem;"></i>
                        </div>
                    </div>
                    <div class="card-body" style="padding:0;display:block;">
                        <div style="overflow-x:auto;">
                            <table class="pin-table">
                                <thead>
                                    <tr>
                                        <th style="width:70px;">TID</th>
                                        <th style="width:70px;">Comp ID</th>
                                        <th>Descrição</th>
                                        <th style="width:70px;">Unidade</th>
                                        <th style="width:90px;">Min Típico</th>
                                        <th style="width:90px;">Max Típico</th>
                                        <th style="width:150px;">Critério de Falha</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            g.tests.forEach(t => {
                html += `<tr>
                    <td style="font-family:Consolas;font-weight:700;color:${color};font-size:0.83rem;">${t.tid}</td>
                    <td style="font-family:Consolas;font-size:0.82rem;text-align:center;color:var(--text-secondary);">${t.componentId || '-'}</td>
                    <td>
                        <div style="font-weight:500;">${t.namePt || t.name}</div>
                        ${t.description ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.15rem;">${t.description}</div>` : ''}
                    </td>
                    <td style="text-align:center;"><span style="background:var(--bg-secondary);padding:0.1rem 0.35rem;border-radius:3px;font-size:0.78rem;">${t.unit || '-'}</span></td>
                    <td style="text-align:center;font-family:Consolas;font-size:0.82rem;color:var(--accent-green);">${t.typicalMin !== undefined ? t.typicalMin : '-'}</td>
                    <td style="text-align:center;font-family:Consolas;font-size:0.82rem;color:var(--accent-orange);">${t.typicalMax !== undefined ? t.typicalMax : '-'}</td>
                    <td style="font-size:0.78rem;color:var(--accent-red);">${t.failThreshold || '-'}</td>
                </tr>`;
            });

            html += '</tbody></table></div></div></div>';
        });

        container.innerHTML = html;
    },

    setupEvents() {
        const searchInput = document.getElementById('mode06-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTestGroups(e.target.value);
            });
        }
    }
};
