/* ============================================
   Math Tools Pro - Módulo de Pinagens
   ============================================ */

const PinoutsModule = {
    currentPinout: null,

    init() {
        this.populateFilters();
        this.renderList();
        this.setupEvents();
    },

    populateFilters() {
        const brands = new Set();
        App.getAllPinouts().filter(p => p && p.brand).forEach(p => brands.add(p.brand));

        const select = document.getElementById('pinout-brand-filter');
        select.innerHTML = '<option value="">Todos os Fabricantes</option>';
        [...brands].sort((a, b) => a.localeCompare(b)).forEach(b => {
            select.innerHTML += `<option value="${b}">${b}</option>`;
        });
    },

    renderList(filter = {}) {
        const list = document.getElementById('pinout-list');
        let pinouts = App.getAllPinouts();

        if (filter.search) {
            const q = filter.search.toLowerCase();
            pinouts = pinouts.filter(p =>
                p.brand.toLowerCase().includes(q) ||
                p.model.toLowerCase().includes(q) ||
                p.vehicles.some(v => v.toLowerCase().includes(q))
            );
        }
        if (filter.brand) {
            pinouts = pinouts.filter(p => p.brand === filter.brand);
        }
        if (filter.type) {
            pinouts = pinouts.filter(p => p.fuelType === filter.type);
        }

        if (pinouts.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <i class="fas fa-search" style="font-size: 2rem;"></i>
                    <h3>Nenhuma ECU encontrada</h3>
                    <p>Tente ajustar os filtros de busca</p>
                </div>`;
            return;
        }

        list.innerHTML = pinouts.filter(p => p && p.id).map(p => `
            <div class="pinout-list-item ${this.currentPinout?.id === p.id ? 'active' : ''}"
                 data-id="${p.id}">
                <h4>${p.brand || '?'} ${p.model || '?'} ${p.custom ? '<span style="color:var(--accent-green);font-size:0.75rem;">● CUSTOM</span>' : ''}</h4>
                <div class="pinout-meta">
                    <span><i class="fas fa-car"></i> ${(p.vehicles && p.vehicles[0]) || 'N/A'}${p.vehicles && p.vehicles.length > 1 ? ` +${p.vehicles.length - 1}` : ''}</span>
                    <span><i class="fas fa-gas-pump"></i> ${p.fuelType === 'diesel' ? 'Diesel' : 'Gasolina/Flex'}</span>
                    ${p.images && p.images.length > 0 ? `<span style="color:var(--accent-cyan);"><i class="fas fa-image"></i> ${p.images.length}</span>` : ''}
                </div>
            </div>
        `).join('');
    },

    showDetail(id) {
        const pinout = App.getAllPinouts().find(p => p.id === id);
        if (!pinout) return;

        this.currentPinout = pinout;
        this.renderList(this.getCurrentFilters());

        const detail = document.getElementById('pinout-detail');
        const totalPins = pinout.connectors.reduce((sum, c) => sum + c.pins.length, 0);
        const hasImages = pinout.images && pinout.images.length > 0;

        let imagesHtml = '';
        if (hasImages) {
            imagesHtml = `
                <div class="pinout-images-section">
                    <h3 style="margin-bottom:0.75rem;color:var(--accent-cyan);">
                        <i class="fas fa-image"></i> Diagramas de Pinout (${pinout.images.length} ${pinout.images.length > 1 ? 'imagens' : 'imagem'})
                    </h3>
                    <div class="pinout-images-grid">
                        ${pinout.images.map((url, i) => {
                            const fname = decodeURIComponent(url.split('/').pop());
                            const safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                            const safeName = fname.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                            return `
                            <div class="pinout-image-card" data-img-url="${safeUrl}" data-img-name="${safeName}">
                                <img src="${url}" alt="${fname}" loading="lazy" onerror="this.parentElement.style.display='none'">
                                <div class="pinout-image-label">${fname}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }

        detail.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:1rem;">
                <div>
                    <h2>${pinout.brand} ${pinout.model}</h2>
                    <p class="pinout-subtitle">
                        <strong>Veículos:</strong> ${pinout.vehicles.join(', ')}<br>
                        <strong>Tipo:</strong> ${pinout.fuelType === 'diesel' ? 'Diesel' : 'Gasolina/Flex'} |
                        <strong>Pinos mapeados:</strong> ${totalPins}
                        ${hasImages ? ` | <span style="color:var(--accent-cyan);"><i class="fas fa-image"></i> ${pinout.images.length} diagrama(s)</span>` : ''}
                        ${pinout.source ? `<br><span style="color:var(--text-muted);font-size:0.8rem;">Fonte: ${pinout.source}</span>` : ''}
                    </p>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" onclick="PinoutsModule.exportCSV('${pinout.id}')">
                        <i class="fas fa-file-csv"></i> Exportar CSV
                    </button>
                </div>
            </div>
            ${imagesHtml}
            ${pinout.connectors.map(conn => `
                <h3 style="margin-top:1.25rem;margin-bottom:0.5rem;color:var(--accent-blue);">
                    <i class="fas fa-plug"></i> ${conn.name}
                </h3>
                <div style="overflow-x:auto;">
                    <table class="pin-table">
                        <thead>
                            <tr>
                                <th style="width:60px;">Pino</th>
                                <th>Função</th>
                                <th style="width:140px;">Cor do Fio</th>
                                <th>Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${conn.pins.map(pin => `
                                <tr>
                                    <td class="pin-number">${pin.pin}</td>
                                    <td><strong>${pin.function}</strong></td>
                                    <td>
                                        <span class="wire-color-indicator" style="background:${this.getWireColor(pin.wire_color)};"></span>
                                        ${pin.wire_color}
                                    </td>
                                    <td style="color:var(--text-secondary);font-size:0.83rem;">${pin.description}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('')}
        `;

        detail.querySelectorAll('.pinout-image-card[data-img-url]').forEach(card => {
            card.addEventListener('click', () => {
                this.openImageModal(card.dataset.imgUrl, card.dataset.imgName);
            });
        });
    },

    openImageModal(url, title) {
        App.showModal(
            `<i class="fas fa-image"></i> ${title}`,
            `<div class="pinout-modal-image">
                <img src="${url}" alt="${title}" style="max-width:100%;border-radius:var(--radius-sm);">
            </div>
            <div style="margin-top:0.75rem;text-align:center;">
                <a href="${url}" target="_blank" class="btn btn-primary btn-sm">
                    <i class="fas fa-external-link-alt"></i> Abrir em nova aba
                </a>
            </div>`
        );
    },

    getWireColor(colorName) {
        const colorMap = {
            'vermelho': '#ef4444', 'red': '#ef4444',
            'preto': '#333', 'black': '#333',
            'marrom': '#8B4513', 'brown': '#8B4513',
            'verde': '#22c55e', 'green': '#22c55e',
            'azul': '#3b82f6', 'blue': '#3b82f6',
            'amarelo': '#eab308', 'yellow': '#eab308',
            'laranja': '#f97316', 'orange': '#f97316',
            'cinza': '#9ca3af', 'gray': '#9ca3af',
            'branco': '#e5e7eb', 'white': '#e5e7eb',
            'roxo': '#a855f7', 'purple': '#a855f7',
        };

        const name = colorName.toLowerCase();
        for (const [key, value] of Object.entries(colorMap)) {
            if (name.startsWith(key) || name.includes(key)) return value;
        }
        return '#6b7280';
    },

    getCurrentFilters() {
        return {
            search: document.getElementById('pinout-search').value,
            brand: document.getElementById('pinout-brand-filter').value,
            type: document.getElementById('pinout-type-filter').value
        };
    },

    exportCSV(id) {
        const pinout = App.getAllPinouts().find(p => p.id === id);
        if (!pinout) return;

        let csv = 'Pino,Função,Cor do Fio,Descrição\n';
        pinout.connectors.forEach(conn => {
            conn.pins.forEach(pin => {
                csv += `${pin.pin},"${pin.function}","${pin.wire_color}","${pin.description}"\n`;
            });
        });

        App.downloadCSV(csv, `pinagem-${pinout.brand}-${pinout.model}.csv`);
        App.toast('Pinagem exportada com sucesso!', 'success');
    },

    setupEvents() {
        document.getElementById('pinout-list').addEventListener('click', (e) => {
            const item = e.target.closest('.pinout-list-item');
            if (item) this.showDetail(item.dataset.id);
        });

        document.getElementById('pinout-search').addEventListener('input', () => {
            this.renderList(this.getCurrentFilters());
        });

        document.getElementById('pinout-brand-filter').addEventListener('change', () => {
            this.renderList(this.getCurrentFilters());
        });

        document.getElementById('pinout-type-filter').addEventListener('change', () => {
            this.renderList(this.getCurrentFilters());
        });
    }
};
