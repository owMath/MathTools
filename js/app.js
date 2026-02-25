/* ============================================
   Math Tools Pro - Main Application Module
   Navegação, utilitários e inicialização
   ============================================ */

const App = {
    data: {
        pinouts: [],
        dtcCodes: [],
        ecuMaps: [],
        obdPids: [],
        canSignals: {},
        udsServices: {},
        mode06Tests: {},
        customPinouts: [],
        customDtcCodes: [],
        customMaps: []
    },

    async init() {
        await this.loadData();
        this.loadCustomData();
        this.setupNavigation();
        this.setupSidebar();
        this.updateDashboardStats();

        PinoutsModule.init();
        DTCModule.init();
        ChecksumModule.init();
        PIDsModule.init();
        CANModule.init();
        MapsModule.init();
        WinOLSModule.init();
        UDSModule.init();
        Mode06Module.init();
        DatabaseModule.init();
    },

    async loadData() {
        try {
            const [pinoutsRes, dtcRes, mapsRes, pidsRes, canRes, udsRes, mode06Res] = await Promise.all([
                fetch('data/pinouts.json'),
                fetch('data/dtc-codes.json'),
                fetch('data/ecu-maps.json'),
                fetch('data/obd-pids.json'),
                fetch('data/can-signals.json'),
                fetch('data/uds-services.json'),
                fetch('data/mode06-tests.json')
            ]);
            this.data.pinouts = (await pinoutsRes.json()).filter(Boolean);
            this.data.dtcCodes = (await dtcRes.json()).filter(Boolean);
            this.data.ecuMaps = (await mapsRes.json()).filter(Boolean);
            this.data.obdPids = (await pidsRes.json()).filter(Boolean);
            this.data.canSignals = await canRes.json();
            this.data.udsServices = await udsRes.json();
            this.data.mode06Tests = await mode06Res.json();
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            this.toast('Erro ao carregar base de dados. Verifique os arquivos JSON.', 'error');
        }
    },

    loadCustomData() {
        try {
            const cp = localStorage.getItem('ecu-custom-pinouts');
            const cd = localStorage.getItem('ecu-custom-dtc');
            const cm = localStorage.getItem('ecu-custom-maps');
            if (cp) this.data.customPinouts = JSON.parse(cp);
            if (cd) this.data.customDtcCodes = JSON.parse(cd);
            if (cm) this.data.customMaps = JSON.parse(cm);
        } catch (e) {
            console.error('Erro ao carregar dados customizados:', e);
        }
    },

    saveCustomData() {
        localStorage.setItem('ecu-custom-pinouts', JSON.stringify(this.data.customPinouts));
        localStorage.setItem('ecu-custom-dtc', JSON.stringify(this.data.customDtcCodes));
        localStorage.setItem('ecu-custom-maps', JSON.stringify(this.data.customMaps));
    },

    getAllPinouts() {
        return [...this.data.pinouts, ...this.data.customPinouts];
    },

    getAllDTC() {
        return [...this.data.dtcCodes, ...this.data.customDtcCodes];
    },

    getAllMaps() {
        return [...this.data.ecuMaps, ...this.data.customMaps];
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.navigateTo(section);
            });
        });

        document.querySelectorAll('.stat-card[data-section-link]').forEach(card => {
            card.addEventListener('click', () => {
                this.navigateTo(card.dataset.sectionLink);
            });
        });
    },

    navigateTo(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const section = document.getElementById(`section-${sectionId}`);
        const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);

        if (section) section.classList.add('active');
        if (navItem) navItem.classList.add('active');
    },

    setupSidebar() {
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    },

    updateDashboardStats() {
        document.getElementById('stat-pinouts').textContent = this.getAllPinouts().length;
        document.getElementById('stat-dtc').textContent = this.getAllDTC().length;
        document.getElementById('stat-maps').textContent = this.getAllMaps().length;
        document.getElementById('stat-pids').textContent = this.data.obdPids.length;
        const canTotal = this.data.canSignals.vehicles
            ? this.data.canSignals.vehicles.reduce((s, v) => s + v.models.length, 0)
            : 0;
        document.getElementById('stat-can').textContent = canTotal;
        const udsEl = document.getElementById('stat-uds');
        if (udsEl) udsEl.textContent = (this.data.udsServices.services || []).length;
        const m06El = document.getElementById('stat-mode06');
        if (m06El) {
            let total = 0;
            (this.data.mode06Tests.testGroups || []).forEach(g => total += (g.tests || []).length);
            m06El.textContent = total;
        }
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    showModal(title, bodyHtml, footerHtml = '') {
        document.getElementById('modal-title').innerHTML = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-footer').innerHTML = footerHtml;
        document.getElementById('modal-overlay').classList.add('active');
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};

document.getElementById('modal-close').addEventListener('click', () => App.closeModal());
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) App.closeModal();
});

document.addEventListener('DOMContentLoaded', () => App.init());
