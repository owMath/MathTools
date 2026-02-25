/* ============================================
   Math Tools Pro - Módulo UDS (Unified Diagnostic Services)
   Referência completa ISO 14229
   ============================================ */

const UDSModule = {
    currentService: null,

    init() {
        if (!App.data.udsServices || !App.data.udsServices.services) {
            const container = document.getElementById('uds-services-list');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:2rem;">
                        <i class="fas fa-exclamation-triangle" style="font-size:2rem;"></i>
                        <h3>Dados UDS não carregados</h3>
                        <p>Verifique o arquivo data/uds-services.json</p>
                    </div>`;
            }
            return;
        }
        this.renderServices();
        this.renderNRCTable();
        this.setupEvents();
    },

    renderServices(searchTerm = '', category = '') {
        const container = document.getElementById('uds-services-list');
        if (!container) return;

        let services = App.data.udsServices.services || [];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            services = services.filter(s =>
                s.sid.toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q) ||
                (s.namePT && s.namePT.toLowerCase().includes(q)) ||
                (s.description && s.description.toLowerCase().includes(q)) ||
                (s.category && s.category.toLowerCase().includes(q))
            );
        }
        if (category) {
            services = services.filter(s => s.category === category);
        }

        if (services.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:2rem;">
                    <i class="fas fa-search" style="font-size:2rem;"></i>
                    <h3>Nenhum serviço encontrado</h3>
                    <p>Tente buscar por outro termo ou ajustar o filtro</p>
                </div>`;
            return;
        }

        const html = services.map(s => {
            const catColor = this.getCategoryColor(s.category);
            const catLabel = this.getCategoryLabel(s.category);
            const isActive = this.currentService && this.currentService.sid === s.sid;
            return `<div class="dtc-item${isActive ? ' active' : ''}" data-sid="${s.sid}">
                <span style="font-family:Consolas,monospace;font-size:0.95rem;font-weight:700;color:var(--accent-blue);background:rgba(59,130,246,0.1);padding:0.3rem 0.6rem;border-radius:var(--radius-sm);white-space:nowrap;min-width:50px;text-align:center;">${s.sid}</span>
                <div class="dtc-item-info" style="flex:1;min-width:0;">
                    <h4 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</h4>
                    <div class="dtc-system" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                        <span>${s.namePT || ''}</span>
                        <span style="background:${catColor}18;color:${catColor};padding:0.1rem 0.45rem;border-radius:10px;font-size:0.72rem;white-space:nowrap;">${catLabel}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
    },

    showServiceDetail(sid) {
        const services = App.data.udsServices.services || [];
        const svc = services.find(s => s.sid === sid);
        if (!svc) return;

        this.currentService = svc;

        const search = document.getElementById('uds-search');
        const catFilter = document.getElementById('uds-category-filter');
        this.renderServices(
            search ? search.value : '',
            catFilter ? catFilter.value : ''
        );

        const detail = document.getElementById('uds-detail');
        if (!detail) return;

        const catColor = this.getCategoryColor(svc.category);
        const catLabel = this.getCategoryLabel(svc.category);

        let html = `
            <div style="font-family:Consolas,monospace;font-size:2rem;font-weight:700;color:var(--accent-blue);margin-bottom:0.25rem;">${svc.sid}</div>
            <p style="font-size:1.05rem;margin-bottom:0.15rem;font-weight:600;">${svc.name}</p>
            ${svc.namePT ? `<p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:0.5rem;">${svc.namePT}</p>` : ''}
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
                <span style="background:${catColor}18;color:${catColor};padding:0.2rem 0.65rem;border-radius:10px;font-size:0.78rem;font-weight:500;">${catLabel}</span>
            </div>`;

        if (svc.description) {
            html += `<p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.5;margin-bottom:1rem;">${svc.description}</p>`;
        }

        if (svc.request) {
            html += `
                <h3 style="margin-top:1.25rem;margin-bottom:0.5rem;font-size:0.92rem;color:var(--accent-blue);display:flex;align-items:center;gap:0.5rem;">
                    <i class="fas fa-arrow-right"></i> Request Format
                </h3>
                <div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:0.85rem 1rem;font-family:Consolas,monospace;font-size:0.83rem;color:var(--accent-green);border:1px solid var(--border-color);overflow-x:auto;white-space:pre;">${this.escapeHtml(svc.request)}</div>`;
        }

        if (svc.response) {
            html += `
                <h3 style="margin-top:1.25rem;margin-bottom:0.5rem;font-size:0.92rem;color:var(--accent-blue);display:flex;align-items:center;gap:0.5rem;">
                    <i class="fas fa-arrow-left"></i> Response Format
                </h3>
                <div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:0.85rem 1rem;font-family:Consolas,monospace;font-size:0.83rem;color:var(--accent-cyan);border:1px solid var(--border-color);overflow-x:auto;white-space:pre;">${this.escapeHtml(svc.response)}</div>`;
        }

        if (svc.subfunctions && svc.subfunctions.length > 0) {
            html += `
                <h3 style="margin-top:1.25rem;margin-bottom:0.5rem;font-size:0.92rem;color:var(--accent-blue);display:flex;align-items:center;gap:0.5rem;">
                    <i class="fas fa-list-ol"></i> Sub-Functions
                </h3>
                <div style="overflow-x:auto;">
                    <table class="pin-table">
                        <thead><tr><th>ID</th><th>Nome</th><th>Nome PT</th><th>Descrição</th></tr></thead>
                        <tbody>
                            ${svc.subfunctions.map(sf => `<tr>
                                <td style="font-family:Consolas,monospace;color:var(--accent-blue);font-weight:600;white-space:nowrap;">${sf.id}</td>
                                <td style="white-space:nowrap;">${sf.name}</td>
                                <td style="white-space:nowrap;">${sf.namePT || ''}</td>
                                <td style="color:var(--text-secondary);font-size:0.83rem;">${sf.description || ''}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        if (svc.commonDIDs && svc.commonDIDs.length > 0) {
            html += `
                <h3 style="margin-top:1.25rem;margin-bottom:0.5rem;font-size:0.92rem;color:var(--accent-blue);display:flex;align-items:center;gap:0.5rem;">
                    <i class="fas fa-database"></i> DIDs Comuns
                </h3>
                <div style="overflow-x:auto;">
                    <table class="pin-table">
                        <thead><tr><th>DID</th><th>Nome</th><th>Nome PT</th><th>Descrição</th></tr></thead>
                        <tbody>
                            ${svc.commonDIDs.map(d => `<tr>
                                <td style="font-family:Consolas,monospace;color:var(--accent-orange);font-weight:600;white-space:nowrap;">${d.id}</td>
                                <td style="white-space:nowrap;">${d.name}</td>
                                <td style="white-space:nowrap;">${d.namePT || ''}</td>
                                <td style="color:var(--text-secondary);font-size:0.83rem;">${d.description || ''}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        if (svc.notes) {
            html += `
                <h3 style="margin-top:1.25rem;margin-bottom:0.5rem;font-size:0.92rem;color:var(--accent-blue);display:flex;align-items:center;gap:0.5rem;">
                    <i class="fas fa-sticky-note"></i> Notas
                </h3>
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:0.85rem 1rem;color:var(--text-secondary);font-size:0.85rem;line-height:1.5;">${svc.notes}</div>`;
        }

        detail.innerHTML = html;
    },

    renderNRCTable() {
        const container = document.getElementById('uds-nrc-list');
        if (!container) return;

        const nrcCodes = App.data.udsServices.nrcCodes || [];
        if (nrcCodes.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Nenhum NRC disponível</p>';
            return;
        }

        const securityCodes = ['0x33', '0x35', '0x36'];
        const pendingCodes = ['0x78'];

        let html = '<div style="overflow-x:auto;"><table class="pin-table"><thead><tr>';
        html += '<th style="width:70px;">Código</th><th>Nome</th><th>Nome PT</th><th>Descrição</th>';
        html += '</tr></thead><tbody>';

        nrcCodes.forEach(nrc => {
            let codeColor = 'var(--accent-orange)';
            let bgColor = 'rgba(245,158,11,0.1)';

            if (securityCodes.includes(nrc.code)) {
                codeColor = 'var(--accent-red)';
                bgColor = 'rgba(239,68,68,0.1)';
            } else if (pendingCodes.includes(nrc.code)) {
                codeColor = 'var(--accent-blue)';
                bgColor = 'rgba(59,130,246,0.1)';
            }

            html += `<tr>
                <td style="font-family:Consolas,monospace;font-weight:700;font-size:0.88rem;">
                    <span style="background:${bgColor};color:${codeColor};padding:0.2rem 0.5rem;border-radius:var(--radius-sm);">${nrc.code}</span>
                </td>
                <td style="font-size:0.85rem;">${nrc.name}</td>
                <td style="font-size:0.85rem;">${nrc.namePT || ''}</td>
                <td style="color:var(--text-secondary);font-size:0.83rem;">${nrc.description || ''}</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    getCategoryLabel(cat) {
        const labels = {
            'session': 'Sessão & Segurança',
            'data': 'Leitura/Escrita de Dados',
            'dtc': 'Diagnóstico (DTC)',
            'routine': 'Rotinas & Controle',
            'upload': 'Upload/Download',
            'communication': 'Comunicação',
            'io': 'I/O Control'
        };
        return labels[cat] || cat;
    },

    getCategoryColor(cat) {
        const colors = {
            'session': '#f59e0b',
            'data': '#3b82f6',
            'dtc': '#ef4444',
            'routine': '#10b981',
            'upload': '#8b5cf6',
            'communication': '#06b6d4',
            'io': '#ec4899'
        };
        return colors[cat] || '#6b7280';
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    setupEvents() {
        const searchInput = document.getElementById('uds-search');
        const categoryFilter = document.getElementById('uds-category-filter');
        const servicesList = document.getElementById('uds-services-list');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderServices(searchInput.value, categoryFilter ? categoryFilter.value : '');
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.renderServices(searchInput ? searchInput.value : '', categoryFilter.value);
            });
        }

        if (servicesList) {
            servicesList.addEventListener('click', (e) => {
                const item = e.target.closest('.dtc-item');
                if (item && item.dataset.sid) {
                    this.showServiceDetail(item.dataset.sid);
                }
            });
        }
    }
};
