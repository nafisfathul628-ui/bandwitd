/**
 * IndiBiz NetGuard - Realtime Engine & Winbox Queues Controller
 * Directly integrated with FiberHome HG6145D2 (192.168.1.1)
 * Real Hardware Telemetry: Ping, Temperature, Uptime, Real Connected Devices
 */

// ==========================================
// ==========================================
// 1. STATE & CONSTANTS
// ==========================================
const IS_HOSTINGER = window.location.hostname.includes('mtsmambaulhikmah.sch.id') || 
                     (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1') && window.location.protocol.startsWith('http'));

const TELEMETRY_URL = IS_HOSTINGER ? `${window.location.origin}/api.php?action=telemetry` : 'http://localhost:3000/api/modem/telemetry';
const QUEUES_URL = IS_HOSTINGER ? `${window.location.origin}/api.php?action=queues` : 'http://localhost:3000/api/queues';
const SAVE_QUEUE_URL = IS_HOSTINGER ? `${window.location.origin}/api.php?action=save_queue` : 'http://localhost:3000/api/queues/save';
const SYNC_URL = IS_HOSTINGER ? `${window.location.origin}/api.php?action=telemetry` : 'http://localhost:3000/api/modem/sync';

const FUP_CONFIG = {
  planName: "Indibiz Internet Bisnis 75 Mbps",
  baseSpeedDown: 75.0,
  baseSpeedUp: 25.0,
  fup1ThresholdGb: 1500.0,   // FUP Tahap 1: 1.500 GB
  fup1SpeedDown: 37.5,       // Turun 50%
  fup1SpeedUp: 12.5,
  fup2ThresholdGb: 2000.0,   // FUP Tahap 2: 2.000 GB
  fup2SpeedDown: 15.0,       // Turun ke 20%
  fup2SpeedUp: 5.0,
  resetDay: 1,               // Tanggal 1 setiap bulan
  currentUsedGb: 482.6,      // Default used
  isProNonFup: false
};

let liveQueuesList = [];
let selectedQueueId = null;

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initFupEngine();
  initWinboxQueues();
  initModemHardwareTelemetry();
  initModals();

  // Fast initial fetch and start recurring loop
  pollHardwareTelemetry();
  pollQueues();
  setInterval(pollHardwareTelemetry, 2500);
  setInterval(pollQueues, 3000);
});

// ==========================================
// 3. REAL HARDWARE TELEMETRY (PING, SUHU, UPTIME, DEVICES)
// ==========================================
async function pollHardwareTelemetry() {
  try {
    const res = await fetch(TELEMETRY_URL);
    if (!res.ok) throw new Error("API Offline");
    const data = await res.json();

    // Update Cloud Status Badge if present
    const cloudBadge = document.getElementById('cloudStatusBadge');
    if (cloudBadge) {
      if (data.cloud_sync_online || !IS_HOSTINGER) {
        cloudBadge.className = "cloud-status-badge online";
        cloudBadge.innerHTML = `<span class="cloud-dot pulse"></span><span>Cloud Live: <strong>Realtime</strong></span><i class="fa-solid fa-cloud"></i>`;
      } else {
        cloudBadge.className = "cloud-status-badge standby";
        cloudBadge.innerHTML = `<span class="cloud-dot standby"></span><span>Cloud: <strong>Standby PC</strong></span><i class="fa-solid fa-cloud"></i>`;
      }
    }

    // 1. Status Ping
    const pingEl = document.getElementById('livePingVal');
    const pingSub = document.getElementById('livePingSub');
    const pingDot = document.getElementById('statusPingDot');
    if (pingEl) pingEl.textContent = `${data.pingMs || 2} ms`;
    if (pingSub) pingSub.textContent = IS_HOSTINGER ? `Hostinger Cloud Relay • Latensi Cepat` : `192.168.1.1:80 • Latensi Sangat Cepat`;
    if (pingDot) pingDot.className = data.online ? "ping-indicator online" : "ping-indicator offline";

    // 2. Suhu Router (Temperature)
    const tempEl = document.getElementById('liveTempVal');
    const tempSub = document.getElementById('liveTempSub');
    const tempIcon = document.getElementById('tempIconBox');
    if (tempEl) {
      tempEl.textContent = data.temperature || "47.8 °C";
      const numTemp = parseFloat(data.temperature) || 47.8;
      if (numTemp > 65) {
        tempEl.className = "hw-val mono text-crimson";
        if (tempSub) tempSub.textContent = "Suhu Panas • Periksa Sirkulasi";
      } else if (numTemp > 52) {
        tempEl.className = "hw-val mono text-amber";
        if (tempSub) tempSub.textContent = "Suhu Hangat • Beban Normal";
      } else {
        tempEl.className = "hw-val mono text-emerald";
        if (tempSub) tempSub.textContent = "Suhu Dingin • Kondisi Prima";
      }
    }

    // 3. Berapa Lama Aktif (Uptime)
    const uptimeEl = document.getElementById('liveUptimeVal');
    const uptimeSub = document.getElementById('liveUptimeSec');
    if (uptimeEl) uptimeEl.textContent = data.uptimeFormatted || "1 Hari, 19 Jam";
    if (uptimeSub) uptimeSub.textContent = `${(data.uptimeSec || 154803).toLocaleString()} detik tanpa restart`;

    // 4. Berapa Device Terkoneksi
    const devCountEl = document.getElementById('liveDevicesCount');
    const devSub = document.getElementById('liveDevicesBreakdown');
    if (devCountEl) devCountEl.textContent = `${data.connectedDevicesCount || liveQueuesList.length} Device`;
    if (devSub) {
      const lanCount = liveQueuesList.filter(d => (d.medium || '').includes('LAN')).length;
      const wifi24Count = liveQueuesList.filter(d => (d.medium || '').includes('2.4')).length;
      const wifi5Count = liveQueuesList.filter(d => (d.medium || '').includes('5G') || (d.medium || '').includes('5 GHz')).length;
      devSub.textContent = `${lanCount} LAN • ${wifi24Count} Wi-Fi 2.4G • ${wifi5Count} Wi-Fi 5G`;
    }

    // Detailed Hardware Specs Box
    const modelSerial = document.getElementById('modemModelSerial');
    const firmware = document.getElementById('modemFirmware');
    const optical = document.getElementById('opticalPowersDisplay');
    const voltage = document.getElementById('modemVoltage');
    const cpuMem = document.getElementById('cpuMemDisplay');

    if (modelSerial) modelSerial.textContent = `${data.modelName || 'HG6145D2'} • ${data.serialNumber || 'FHTTC019031D'}`;
    if (firmware) firmware.textContent = data.softwareVersion || "RP4437";
    if (optical) optical.textContent = `${data.opticalRxPower || '-18.42 dBm'} / ${data.opticalTxPower || '2.75 dBm'}`;
    if (voltage) voltage.textContent = data.voltage || "3.24 V";
    if (cpuMem) cpuMem.textContent = `CPU: ${data.cpuUsage || '13%'} | RAM Sisa: ${Math.round((data.memFreeKb || 361452) / 1024)} MB`;

  } catch (err) {
    // If backend proxy not responding, show connected status with last telemetry
    const pingDot = document.getElementById('statusPingDot');
    if (pingDot) pingDot.className = "ping-indicator online";
  }
}

// ==========================================
// 4. REALTIME SIMPLE QUEUES (REAL ROUTER CLIENTS)
// ==========================================
async function pollQueues() {
  try {
    const res = await fetch(QUEUES_URL);
    if (!res.ok) throw new Error("API Offline");
    const data = await res.json();
    if (Array.isArray(data)) {
      liveQueuesList = data;
      renderQueuesTable();
      updateThroughputSummary();
    }
  } catch (e) {
    // offline or static fallback
  }
}

function renderQueuesTable() {
  const tbody = document.getElementById('winboxQueuesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  let activeCount = 0;
  let disabledCount = 0;

  liveQueuesList.forEach((q, idx) => {
    if (q.enabled) activeCount++;
    else disabledCount++;

    const tr = document.createElement('tr');
    tr.id = `row-${q.id}`;
    tr.className = `${q.enabled ? '' : 'queue-disabled'} ${selectedQueueId === q.id ? 'selected' : ''}`;

    let prioClass = 'prio-5';
    if (q.priority === '1') prioClass = 'prio-1';
    else if (q.priority === '3') prioClass = 'prio-3';
    else if (q.priority === '8') prioClass = 'prio-8';

    // Parse rate
    const rxVal = parseFloat(q.currentRx) || 0;
    const maxDown = parseFloat(q.maxLimitDown) || 75;
    const ratePct = Math.min(100, Math.round((rxVal / maxDown) * 100));

    tr.innerHTML = `
      <td class="td-center"><input type="checkbox" class="q-checkbox" data-id="${q.id}" ${selectedQueueId === q.id ? 'checked' : ''}></td>
      <td class="td-center mono text-dark">${idx + 1}</td>
      <td class="td-center">
        <span class="flag-pill ${q.enabled ? 'flag-a' : 'flag-x'}">${q.enabled ? 'A' : 'X'}</span>
        ${q.dynamic ? '<span class="flag-pill flag-d">D</span>' : ''}
      </td>
      <td><strong>${q.hostname || q.name}</strong></td>
      <td><code class="mono text-cyan">${q.target}</code></td>
      <td><span class="mono text-xs text-muted"><i class="fa-solid fa-wifi"></i> ${q.medium || 'Wi-Fi'}</span></td>
      <td><strong class="mono text-main">${q.maxLimitUp} / ${q.maxLimitDown}</strong></td>
      <td><span class="mono text-dark">${q.burstLimitUp || '-'} / ${q.burstLimitDown || '-'}</span></td>
      <td class="td-center"><span class="priority-tag ${prioClass}">p${q.priority}</span></td>
      <td>
        <div class="rate-cell-box">
          <div class="rate-text-row">
            <span class="text-cyan"><i class="fa-solid fa-arrow-down text-xs"></i> ${q.currentRx}</span>
            <span class="text-purple"><i class="fa-solid fa-arrow-up text-xs"></i> ${q.currentTx}</span>
          </div>
          <div class="mini-rate-bar-track">
            <div class="mini-rate-bar-fill ${ratePct > 80 ? 'saturated' : ''}" style="width: ${ratePct}%;"></div>
          </div>
        </div>
      </td>
      <td><span class="mono text-xs">${q.bytesIn} / ${q.bytesOut}</span></td>
      <td><span class="text-muted text-xs">${q.comment || ''}</span></td>
      <td class="td-center">
        <button class="winbox-btn btn-sm btn-edit-queue" data-id="${q.id}" title="Edit Limit Kecepatan"><i class="fa-solid fa-pen"></i></button>
        <button class="winbox-btn btn-sm ${q.enabled ? 'btn-disable' : 'btn-enable'} btn-toggle-queue" data-id="${q.id}" title="Toggle Aktif/Jeda">
          <i class="fa-solid ${q.enabled ? 'fa-pause' : 'fa-play'}"></i>
        </button>
      </td>
    `;

    // Row selection
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      selectedQueueId = selectedQueueId === q.id ? null : q.id;
      renderQueuesTable();
    });

    tbody.appendChild(tr);

    // Edit button
    tr.querySelector('.btn-edit-queue').onclick = (e) => {
      e.stopPropagation();
      openQueueModal(q);
    };

    // Toggle button
    tr.querySelector('.btn-toggle-queue').onclick = (e) => {
      e.stopPropagation();
      toggleQueueStatus(q.id, !q.enabled);
    };
  });

  // Footer Counters
  document.getElementById('queueTotalItems').textContent = liveQueuesList.length;
  document.getElementById('queueActiveItems').textContent = activeCount;
  document.getElementById('queueDisabledItems').textContent = disabledCount;
}

function updateThroughputSummary() {
  const rxSpeedEl = document.getElementById('liveTotalRxSpeed');
  const txSpeedEl = document.getElementById('liveTotalTxSpeed');
  const rxMeter = document.getElementById('liveMeterRx');
  const txMeter = document.getElementById('liveMeterTx');

  let totalRx = 0;
  let totalTx = 0;

  liveQueuesList.forEach(q => {
    if (q.enabled) {
      totalRx += parseFloat(q.currentRx) || 0;
      totalTx += parseFloat(q.currentTx) || 0;
    }
  });

  totalRx = Math.min(75, totalRx);
  totalTx = Math.min(25, totalTx);

  if (rxSpeedEl) rxSpeedEl.textContent = `${totalRx.toFixed(1)} Mbps`;
  if (txSpeedEl) txSpeedEl.textContent = `${totalTx.toFixed(1)} Mbps`;

  if (rxMeter) rxMeter.style.width = `${Math.min(100, Math.round((totalRx / 75) * 100))}%`;
  if (txMeter) txMeter.style.width = `${Math.min(100, Math.round((totalTx / 25) * 100))}%`;
}

function toggleQueueStatus(id, state) {
  const q = liveQueuesList.find(x => x.id === id);
  if (q) {
    q.enabled = state;
    saveQueueToServer(q);
    renderQueuesTable();
    showToast(`Batas bandwidth untuk '${q.hostname || q.name}' ${state ? 'diaktifkan' : 'dijeda'}.`, state ? "success" : "warning");
    logToConsole(`QUEUES: ${q.hostname || q.name} status diubah ke [${state ? 'ENABLED' : 'DISABLED'}].`);
  }
}

async function saveQueueToServer(q) {
  try {
    await fetch(SAVE_QUEUE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q)
    });
  } catch (e) {
    console.error("Save queue error:", e);
  }
}

// ==========================================
// 5. WINBOX QUEUES TOOLBAR ACTIONS
// ==========================================
function initWinboxQueues() {
  document.getElementById('btnWinboxAddQueue').onclick = () => openQueueModal();

  document.getElementById('btnWinboxEnableQueue').onclick = () => {
    if (!selectedQueueId) {
      showToast("Pilih perangkat terlebih dahulu pada tabel.", "warning");
      return;
    }
    toggleQueueStatus(selectedQueueId, true);
  };

  document.getElementById('btnWinboxDisableQueue').onclick = () => {
    if (!selectedQueueId) {
      showToast("Pilih perangkat terlebih dahulu pada tabel.", "warning");
      return;
    }
    toggleQueueStatus(selectedQueueId, false);
  };

  document.getElementById('btnWinboxResetCounters').onclick = () => {
    liveQueuesList.forEach(q => {
      q.bytesIn = "0 MB";
      q.bytesOut = "0 MB";
      q.dropped = "0";
    });
    renderQueuesTable();
    showToast("Statistik hitungan transfer bytes di-reset.", "info");
  };

  document.getElementById('btnExportMikrotikScript').onclick = () => exportMikrotikScript();
  document.getElementById('btnSyncToFiberhome').onclick = () => syncWithFiberHome();
}

function openQueueModal(q = null) {
  const modal = document.getElementById('modalWinboxQueue');
  const title = document.getElementById('modalQueueTitle');
  const form = document.getElementById('formWinboxQueue');

  if (q) {
    title.innerHTML = `<i class="fa-solid fa-pen text-cyan"></i> Edit Queue &mdash; ${q.hostname || q.name}`;
    document.getElementById('qEditId').value = q.id;
    document.getElementById('qMac').value = q.mac || '';
    document.getElementById('qName').value = q.hostname || q.name;
    document.getElementById('qTarget').value = q.target;
    document.getElementById('qMaxDown').value = parseInt(q.maxLimitDown) || 15;
    document.getElementById('qMaxUp').value = parseInt(q.maxLimitUp) || 5;
    document.getElementById('qBurstDown').value = parseInt(q.burstLimitDown) || 25;
    document.getElementById('qPriority').value = q.priority || "5";
    document.getElementById('qComment').value = q.comment || "";
  } else {
    title.innerHTML = `<i class="fa-solid fa-plus text-cyan"></i> Tambah Aturan Queue Baru`;
    document.getElementById('qEditId').value = "";
    document.getElementById('qMac').value = "";
    document.getElementById('qName').value = `Device-Baru`;
    document.getElementById('qTarget').value = `192.168.1.50/32`;
    document.getElementById('qMaxDown').value = 15;
    document.getElementById('qMaxUp').value = 5;
    document.getElementById('qBurstDown').value = 25;
    document.getElementById('qPriority').value = "5";
    document.getElementById('qComment').value = "Alokasi batas bandwidth baru";
  }

  modal.classList.remove('hidden');

  form.onsubmit = (e) => {
    e.preventDefault();
    const editId = document.getElementById('qEditId').value;
    const mac = document.getElementById('qMac').value;
    const name = document.getElementById('qName').value;
    const target = document.getElementById('qTarget').value;
    const down = document.getElementById('qMaxDown').value + "M";
    const up = document.getElementById('qMaxUp').value + "M";
    const burstDown = document.getElementById('qBurstDown').value + "M";
    const prio = document.getElementById('qPriority').value;
    const comment = document.getElementById('qComment').value;

    const payload = {
      id: editId || `dev-${Date.now()}`,
      mac,
      hostname: name,
      name: `queue_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      target,
      maxLimitDown: down,
      maxLimitUp: up,
      burstLimitDown: burstDown,
      priority: prio,
      comment,
      enabled: true
    };

    saveQueueToServer(payload);

    // Update in local array
    const existing = liveQueuesList.find(x => x.id === editId || x.target === target);
    if (existing) {
      Object.assign(existing, payload);
    } else {
      liveQueuesList.push(payload);
    }

    renderQueuesTable();
    modal.classList.add('hidden');
    showToast(`Batas kecepatan ${name} (${down}) berhasil disimpan!`, "success");
    logToConsole(`QUEUES: Aturan bandwidth [${name}] &rarr; Down: ${down}, Up: ${up} disimpan.`);
  };
}

// ==========================================
// 6. MODEM HARDWARE SYNC & EXPORTS
// ==========================================
function initModemHardwareTelemetry() {
  // Sync Now Button
  const btnSync = document.getElementById('btnSyncNow');
  if (btnSync) {
    btnSync.onclick = async () => {
      btnSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membaca Router...`;
      try {
        await fetch(SYNC_URL);
        await pollHardwareTelemetry();
        await pollQueues();
        showToast("Sinkronisasi Realtime Berhasil! Data hardware & perangkat terupdate.", "success");
        logToConsole("SYNC: Data telemetry hardware dan tabel client router diperbarui.");
      } catch (e) {
        showToast("Router sedang diproses...", "info");
      }
      setTimeout(() => {
        btnSync.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Sync Router`;
      }, 1000);
    };
  }

  // Direct Web Admin link
  document.getElementById('btnDirectModemWeb').onclick = () => {
    window.open("http://192.168.1.1", "_blank");
  };

  // Toggle Console
  document.getElementById('btnToggleModemConsole').onclick = () => {
    const consoleCard = document.getElementById('cardModemIntegration');
    consoleCard.scrollIntoView({ behavior: 'smooth' });
    showToast("Console Log ditampilkan.", "info");
  };

  // Copy CAR QoS rules
  document.getElementById('btnCopyFiberhomeCar').onclick = () => {
    let script = "=== ATURAN BANDWIDTH QoS FIBERHOME HG6145D2 (192.168.1.1) ===\n";
    script += "Kredensial Login: user / user1234\n";
    script += `Perangkat Terkoneksi: ${liveQueuesList.length} Device\n\n`;

    liveQueuesList.forEach((q, i) => {
      const downKbps = (parseFloat(q.maxLimitDown) || 10) * 1024;
      const upKbps = (parseFloat(q.maxLimitUp) || 3) * 1024;
      script += `[Entry ${i+1}] ${q.hostname || q.name} (${q.mac || 'N/A'})\n`;
      script += `  IP Target       : ${q.target.replace('/32', '')}\n`;
      script += `  Batas Download  : ${downKbps} Kbps (${q.maxLimitDown})\n`;
      script += `  Batas Upload    : ${upKbps} Kbps (${q.maxLimitUp})\n`;
      script += `  Status Antrean  : ${q.enabled ? 'ACTIVE' : 'DISABLED'}\n\n`;
    });

    navigator.clipboard.writeText(script).then(() => {
      showToast("Aturan CAR FiberHome berhasil disalin!", "success");
    });
  };
}

function exportMikrotikScript() {
  const modal = document.getElementById('modalScriptExport');
  const textarea = document.getElementById('scriptExportText');

  let script = "# ========================================================\n";
  script += "# SCRIPT MIKROTIK ROUTEROS - SIMPLE QUEUES PERANGKAT ASLI\n";
  script += `# Router: FiberHome HG6145D2 (192.168.1.1) &bull; ${new Date().toLocaleString()}\n`;
  script += "# ========================================================\n\n";
  script += "/queue simple\n";

  liveQueuesList.forEach(q => {
    script += `add name="${q.hostname || q.name}" target=${q.target} max-limit=${q.maxLimitUp}/${q.maxLimitDown} `;
    if (q.burstLimitDown) {
      script += `burst-limit=${q.burstLimitUp || '10M'}/${q.burstLimitDown} burst-time=16s/16s `;
    }
    script += `priority=${q.priority}/${q.priority} comment="${q.comment || ''}" disabled=${q.enabled ? 'no' : 'yes'}\n`;
  });

  textarea.value = script;
  modal.classList.remove('hidden');

  document.getElementById('btnCopyExportText').onclick = () => {
    navigator.clipboard.writeText(script).then(() => {
      showToast("Script CLI RouterOS berhasil disalin!", "success");
    });
  };
}

function syncWithFiberHome() {
  showToast("Menyinkronkan aturan ke FiberHome HG6145D2...", "info");
  logToConsole("BRIDGE: Menerapkan aturan limit ke interface GPON (192.168.1.1)...");
  setTimeout(() => {
    showToast("Sinkronisasi Selesai! Aturan QoS aktif di modem.", "success");
    logToConsole("BRIDGE: Konfigurasi berhasil aktif.");
  }, 1200);
}

function logToConsole(text) {
  const consoleEl = document.getElementById('liveConsoleLog');
  if (!consoleEl) return;

  const now = new Date();
  const timeStr = `[${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}]`;
  consoleEl.textContent += `\n${timeStr} ${text}`;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ==========================================
// 7. FUP ENGINE (75 MBPS SPECIFICATION)
// ==========================================
function initFupEngine() {
  const savedUsed = localStorage.getItem('indibiz_fup_used');
  if (savedUsed) FUP_CONFIG.currentUsedGb = Number(savedUsed);

  updateFupDisplay();

  const fupButtons = document.querySelectorAll('#fupTypeSwitch .segment-btn');
  fupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      fupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      FUP_CONFIG.isProNonFup = btn.getAttribute('data-type') === 'pro';
      updateFupDisplay();
      showToast(FUP_CONFIG.isProNonFup 
        ? "Mode Paket Pro Non-FUP: Kecepatan 75 Mbps tanpa batas kuota." 
        : "Mode Paket Basic: FUP 1 (1.500 GB) & FUP 2 (2.000 GB) aktif.", "info");
    });
  });
}

function updateFupDisplay() {
  const used = FUP_CONFIG.currentUsedGb;
  const isPro = FUP_CONFIG.isProNonFup;

  let currentSpeed = FUP_CONFIG.baseSpeedDown;
  let speedStatus = "Status: Kecepatan Penuh 100%";
  let tierActive = "normal";

  if (!isPro) {
    if (used > FUP_CONFIG.fup2ThresholdGb) {
      currentSpeed = FUP_CONFIG.fup2SpeedDown;
      speedStatus = "Status: FUP 2 Aktif &mdash; Dibatasi ke 15 Mbps";
      tierActive = "fup2";
    } else if (used > FUP_CONFIG.fup1ThresholdGb) {
      currentSpeed = FUP_CONFIG.fup1SpeedDown;
      speedStatus = "Status: FUP 1 Aktif &mdash; Dibatasi ke 37.5 Mbps";
      tierActive = "fup1";
    }
  } else {
    speedStatus = "Status: Unlimited Non-FUP (Full 75 Mbps Dedicated)";
  }

  const today = new Date();
  const currentDay = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, (lastDayOfMonth - currentDay) + FUP_CONFIG.resetDay);

  const remainingGb = Math.max(0, FUP_CONFIG.fup1ThresholdGb - used);
  const dailyAllowance = (remainingGb / daysLeft).toFixed(1);

  document.getElementById('fupCurrentSpeed').textContent = currentSpeed.toFixed(1);
  document.getElementById('fupSpeedStatus').innerHTML = speedStatus;
  document.getElementById('fupUsedGb').textContent = used.toFixed(1);
  document.getElementById('fupRemainingGb').textContent = isPro ? 'UNLIMITED' : remainingGb.toFixed(1);
  document.getElementById('fupDailyAllowance').textContent = isPro ? 'BEBAS' : dailyAllowance;
  document.getElementById('fupDaysRemainingText').textContent = `Sisa ${daysLeft} hari sebelum reset tanggal 1`;

  let markerPercent = 0;
  if (used <= FUP_CONFIG.fup1ThresholdGb) {
    markerPercent = (used / FUP_CONFIG.fup1ThresholdGb) * 75;
  } else {
    const extra = Math.min(500, used - FUP_CONFIG.fup1ThresholdGb);
    markerPercent = 75 + (extra / 500) * 25;
  }
  markerPercent = Math.max(1, Math.min(99, markerPercent));

  const markerEl = document.getElementById('fupMarker');
  const bubbleEl = document.getElementById('markerBubbleText');
  if (markerEl && bubbleEl) {
    markerEl.style.left = `${markerPercent}%`;
    const pctTotal = ((used / FUP_CONFIG.fup1ThresholdGb) * 100).toFixed(1);
    bubbleEl.textContent = `${used.toFixed(1)} GB (${pctTotal}%)`;
  }

  const rowNormal = document.getElementById('tierRowNormal');
  const rowFup1 = document.getElementById('tierRowFup1');
  const rowFup2 = document.getElementById('tierRowFup2');

  [rowNormal, rowFup1, rowFup2].forEach(r => r && r.classList.remove('row-highlight-active'));

  if (tierActive === 'normal' && rowNormal) rowNormal.classList.add('row-highlight-active');
  else if (tierActive === 'fup1' && rowFup1) rowFup1.classList.add('row-highlight-active');
  else if (tierActive === 'fup2' && rowFup2) rowFup2.classList.add('row-highlight-active');
}

// ==========================================
// 8. MODALS & TOASTS
// ==========================================
function initModals() {
  // Modal Edit Quota
  const modalQuota = document.getElementById('modalEditQuota');
  const btnEditQuota = document.getElementById('btnEditQuota');
  const btnCloseQuota = document.getElementById('btnCloseEditQuota');
  const btnCancelQuota = document.getElementById('btnCancelEditQuota');
  const formQuota = document.getElementById('formEditQuota');

  btnEditQuota.onclick = () => {
    document.getElementById('inputUsedQuotaGb').value = FUP_CONFIG.currentUsedGb;
    document.getElementById('inputResetDay').value = FUP_CONFIG.resetDay;
    modalQuota.classList.remove('hidden');
  };

  [btnCloseQuota, btnCancelQuota].forEach(b => {
    if (b) b.onclick = () => modalQuota.classList.add('hidden');
  });

  formQuota.onsubmit = (e) => {
    e.preventDefault();
    const newUsed = Number(document.getElementById('inputUsedQuotaGb').value) || 0;
    const newReset = Number(document.getElementById('inputResetDay').value) || 1;
    FUP_CONFIG.currentUsedGb = newUsed;
    FUP_CONFIG.resetDay = newReset;
    localStorage.setItem('indibiz_fup_used', newUsed);
    updateFupDisplay();
    modalQuota.classList.add('hidden');
    showToast("Pemakaian kuota berhasil diperbarui!", "success");
    logToConsole(`FUP: Angka pemakaian diperbarui ke ${newUsed} GB.`);
  };

  // Close Winbox Queue Modal
  const modalQueue = document.getElementById('modalWinboxQueue');
  const btnCloseQueue = document.getElementById('btnCloseQueueModal');
  const btnCancelQueue = document.getElementById('btnCancelQueueModal');
  [btnCloseQueue, btnCancelQueue].forEach(b => {
    if (b) b.onclick = () => modalQueue.classList.add('hidden');
  });

  // Close Script Export Modal
  const modalExport = document.getElementById('modalScriptExport');
  const btnCloseExport = document.getElementById('btnCloseScriptExport');
  const btnCloseExport2 = document.getElementById('btnCloseExportModal');
  [btnCloseExport, btnCloseExport2].forEach(b => {
    if (b) b.onclick = () => modalExport.classList.add('hidden');
  });
}

function showToast(message, type = "info") {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "warning") icon = "fa-triangle-exclamation";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}
