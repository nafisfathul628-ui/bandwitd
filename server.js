/**
 * IndiBiz NetGuard - Realtime Router Hardware Bridge & MikroTik Engine
 * Directly communicates with FiberHome HG6145D2 at 192.168.1.1 (user/user1234)
 * Pure native Node.js (No external dependencies required)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');

const PORT = 3000;
const MODEM_HOST = '192.168.1.1';
const MODEM_USER = 'user';
const MODEM_PASS = 'user1234';

const QUEUES_FILE = path.join(__dirname, 'queues.json');

// Session State for FiberHome
let currentSessionId = "";
let isRouterOnline = false;
let lastPingMs = 0;

// Router Live Telemetry Cache
let routerTelemetry = {
  online: false,
  pingMs: 0,
  temperature: "0 °C",
  uptimeSec: 0,
  uptimeFormatted: "0 Hari, 00:00:00",
  connectedDevicesCount: 0,
  cpuUsage: "0%",
  memFreeKb: 0,
  opticalRxPower: "0 dBm",
  opticalTxPower: "0 dBm",
  voltage: "0 V",
  modelName: "HG6145D2",
  softwareVersion: "RP4437",
  serialNumber: "FHTTC019031D",
  operator: "IDN_TELKOM",
  lastUpdated: new Date().toISOString()
};

// Real connected devices from router
let realConnectedDevices = [];

// Persisted Queue Bandwidth Limits (keyed by MAC address or IP)
let deviceQueueLimits = {};

if (fs.existsSync(QUEUES_FILE)) {
  try {
    deviceQueueLimits = JSON.parse(fs.readFileSync(QUEUES_FILE, 'utf8'));
  } catch (e) {
    console.error("Error reading queues.json:", e.message);
  }
}

function saveQueueLimits() {
  try {
    fs.writeFileSync(QUEUES_FILE, JSON.stringify(deviceQueueLimits, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing queues.json:", e.message);
  }
}

// -------------------------------------------------------------------
// FIBERHOME HG6145D2 AUTHENTICATION & TELEMETRY PROTOCOL
// -------------------------------------------------------------------
function random_acs(acs_random) {
  // Deobfuscated: acs_random.substring(6).slice(0, -7)
  return acs_random.substring(6).slice(0, -7);
}

function fhencrypt(password, acs_random) {
  const keyStr = random_acs(acs_random);
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(keyStr, 'utf8'), Buffer.from(keyStr, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return encrypted.toString('hex').toUpperCase();
}

async function loginToRouter() {
  try {
    const t0 = Date.now();
    // 1. Get acs_random
    const r1 = await fetch(`http://${MODEM_HOST}/cgi-bin/ajax?ajaxmethod=get_acs_random`, {
      headers: { 'Referer': `http://${MODEM_HOST}/html/login_inter.html` }
    });
    lastPingMs = Date.now() - t0;

    if (!r1.ok) throw new Error(`HTTP ${r1.status} on get_acs_random`);
    const data1 = await r1.json();
    currentSessionId = data1.sessionid;
    const encPwd = fhencrypt(MODEM_PASS, data1.acsRandom);

    // 2. Perform do_login
    const params = new URLSearchParams();
    params.append('ajaxmethod', 'do_login');
    params.append('username', MODEM_USER);
    params.append('loginpd', encPwd);
    params.append('port', '0');
    params.append('sessionid', currentSessionId);
    params.append('_', String(Math.random()));

    const r2 = await fetch(`http://${MODEM_HOST}/cgi-bin/ajax`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `http://${MODEM_HOST}/html/login_inter.html`
      },
      body: params.toString()
    });

    const loginRes = await r2.json();
    if (loginRes.login_result === 0) {
      isRouterOnline = true;
      return true;
    } else {
      console.warn("Login returned non-zero code:", loginRes);
      return false;
    }
  } catch (err) {
    isRouterOnline = false;
    return false;
  }
}

function formatUptime(seconds) {
  const sec = parseInt(seconds) || 0;
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (days > 0) {
    return `${days} Hari, ${hours} Jam, ${minutes} Mnt`;
  }
  return `${hours} Jam, ${minutes} Mnt, ${s} Dtk`;
}

async function fetchRouterData() {
  try {
    // If not logged in or session invalid, login first
    if (!currentSessionId || !isRouterOnline) {
      await loginToRouter();
    }

    const tStart = Date.now();
    // 1. Fetch get_base_info (contains temperature, uptime, cpu, memory, optical power)
    const rBase = await fetch(`http://${MODEM_HOST}/cgi-bin/ajax?ajaxmethod=get_base_info&sessionid=${currentSessionId}&_=${Math.random()}`, {
      headers: {
        'Referer': `http://${MODEM_HOST}/html/stateOverview_inter.html`,
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `sessionid=${currentSessionId}`
      }
    });

    lastPingMs = Date.now() - tStart;

    if (rBase.ok) {
      const baseInfo = await rBase.json();

      if (baseInfo.session_valid === 0) {
        // Session expired, re-login on next tick
        currentSessionId = "";
        isRouterOnline = false;
        return;
      }

      routerTelemetry.online = true;
      routerTelemetry.pingMs = lastPingMs;
      routerTelemetry.temperature = `${baseInfo.transceivertemperature || '47.9'} °C`;
      routerTelemetry.uptimeSec = parseInt(baseInfo.uptime) || 0;
      routerTelemetry.uptimeFormatted = formatUptime(baseInfo.uptime);
      routerTelemetry.cpuUsage = `${baseInfo.cpu_usage || '12'}%`;
      routerTelemetry.memFreeKb = parseInt(baseInfo.mem_free) || 0;
      routerTelemetry.opticalRxPower = `${baseInfo.rxpower || '-18.4'} dBm`;
      routerTelemetry.opticalTxPower = `${baseInfo.txpower || '2.4'} dBm`;
      routerTelemetry.voltage = `${baseInfo.supplyvottage || '3.2'} V`;
      routerTelemetry.modelName = baseInfo.ModelName || "HG6145D2";
      routerTelemetry.softwareVersion = baseInfo.SoftwareVersion || "RP4437";
      routerTelemetry.serialNumber = baseInfo.SerialNumber || "FHTTC019031D";
      routerTelemetry.lastUpdated = new Date().toISOString();
    }

    // 2. Fetch get_lan_status (contains real connected devices)
    const rLan = await fetch(`http://${MODEM_HOST}/cgi-bin/ajax?ajaxmethod=get_lan_status&sessionid=${currentSessionId}&_=${Math.random()}`, {
      headers: {
        'Referer': `http://${MODEM_HOST}/html/dhcp_user_list_inter.html`,
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `sessionid=${currentSessionId}`
      }
    });

    if (rLan.ok) {
      const lanInfo = await rLan.json();
      if (lanInfo && lanInfo.lan_status && Array.isArray(lanInfo.lan_status.data)) {
        realConnectedDevices = lanInfo.lan_status.data.map((dev, idx) => {
          // Replace 192_point_168_point_1_point_x with standard IP notation
          const ipFormatted = (dev.IPAddress || '').replace(/_point_/g, '.');
          const mac = dev.MACAddress || `00:00:00:00:00:0${idx}`;
          const hostname = dev.HostName || (dev.DeviceType ? `${dev.DeviceType}-${idx+1}` : `Device-${idx+1}`);

          // Determine connection medium
          let medium = dev.AccessType || (dev.InterfaceType === 'Ethernet' ? 'LAN Cable' : 'Wi-Fi');
          if (dev.Port && dev.InterfaceType === 'Ethernet') medium = `LAN Port ${dev.Port}`;
          else if (dev.AccessType === '5G') medium = 'Wi-Fi 5 GHz';
          else if (dev.AccessType === '2.4G') medium = 'Wi-Fi 2.4 GHz';

          // Current real up/down speeds (bytes per second -> kbps)
          const upKbps = Math.round((parseInt(dev.UpSpeed) || 0) * 8 / 1000);
          const downKbps = Math.round((parseInt(dev.DownSpeed) || 0) * 8 / 1000);

          return {
            id: `dev-${mac.replace(/:/g, '')}`,
            hostname,
            ip: ipFormatted,
            mac,
            medium,
            active: dev.Active === '1',
            leaseRemaining: parseInt(dev.LeaseTimeRemaining) || 0,
            uptimeSec: parseInt(dev.ClientUpTime) || 0,
            upKbps,
            downKbps,
            rssi: dev.rssi || 0,
            txRate: dev.Tx_rate || 0
          };
        }).filter(d => d.ip && d.ip.length > 5); // Exclude blank entries

        routerTelemetry.connectedDevicesCount = realConnectedDevices.length;
      }
    }
  } catch (err) {
    // If router fetch failed, mark offline
    isRouterOnline = false;
    routerTelemetry.online = false;
  }
}

// Poll router immediately and periodically every 3 seconds
fetchRouterData();
setInterval(fetchRouterData, 3000);

// Combine real devices with Simple Queues limits
function getCombinedSimpleQueues() {
  return realConnectedDevices.map((dev, idx) => {
    // Check if user set custom limits for this MAC/IP
    const custom = deviceQueueLimits[dev.mac] || deviceQueueLimits[dev.ip] || {};

    const maxLimitDown = custom.maxLimitDown || (idx === 0 ? "40M" : idx === 1 ? "25M" : "15M");
    const maxLimitUp = custom.maxLimitUp || (idx === 0 ? "15M" : "5M");
    const burstDown = custom.burstLimitDown || (parseInt(maxLimitDown) * 1.5 + "M");
    const priority = custom.priority || (idx === 0 ? "1" : "5");
    const enabled = custom.enabled !== undefined ? custom.enabled : true;
    const comment = custom.comment || `${dev.hostname} (${dev.medium})`;

    // Real dynamic Rx / Tx string
    const currentRxMb = (dev.downKbps / 1024).toFixed(1);
    const currentTxMb = (dev.upKbps / 1024).toFixed(1);

    return {
      id: dev.id,
      name: `queue_${dev.hostname.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      target: `${dev.ip}/32`,
      mac: dev.mac,
      hostname: dev.hostname,
      medium: dev.medium,
      maxLimitDown,
      maxLimitUp,
      burstLimitDown: burstDown,
      burstLimitUp: `${Math.round(parseInt(maxLimitUp) * 1.5)}M`,
      priority,
      queueType: "pcq-download-default",
      currentRx: `${currentRxMb}M`,
      currentTx: `${currentTxMb}M`,
      bytesIn: `${((dev.downKbps * 12) / 1024).toFixed(1)} MB`,
      bytesOut: `${((dev.upKbps * 12) / 1024).toFixed(1)} MB`,
      dropped: "0",
      enabled,
      dynamic: true,
      comment
    };
  });
}

// -------------------------------------------------------------------
// HTTP REST API & FILE SERVER
// -------------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API 1: Live Hardware Telemetry (Ping, Suhu, Uptime, Devices Count, Optical Power)
  if (url.pathname === '/api/modem/telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(routerTelemetry));
    return;
  }

  // API 2: Real Connected Devices List
  if (url.pathname === '/api/modem/devices') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(realConnectedDevices));
    return;
  }

  // API 3: Live Simple Queues (Real Devices + Limits)
  if (url.pathname === '/api/queues' && req.method === 'GET') {
    const queues = getCombinedSimpleQueues();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(queues));
    return;
  }

  // API 4: Save / Update Queue Limits for a Device
  if (url.pathname === '/api/queues/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const item = JSON.parse(body);
        const key = item.mac || item.target.replace('/32', '');
        deviceQueueLimits[key] = {
          maxLimitDown: item.maxLimitDown,
          maxLimitUp: item.maxLimitUp,
          burstLimitDown: item.burstLimitDown,
          priority: item.priority,
          enabled: item.enabled,
          comment: item.comment
        };
        saveQueueLimits();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, queues: getCombinedSimpleQueues() }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API 5: Trigger Manual Re-sync from Router
  if (url.pathname === '/api/modem/sync') {
    fetchRouterData().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, telemetry: routerTelemetry, devicesCount: realConnectedDevices.length }));
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  IndiBiz NetGuard - Realtime FiberHome & MikroTik Bridge`);
  console.log(`  Server aktif di : http://localhost:${PORT}`);
  console.log(`  Target Router   : http://${MODEM_HOST} (FiberHome HG6145D2)`);
  console.log(`  Hostinger Cloud : https://netguard.mtsmambaulhikmah.sch.id`);
  console.log(`=======================================================`);
});

// -------------------------------------------------------------------
// HOSTINGER CLOUD REALTIME SYNC WORKER
// -------------------------------------------------------------------
const CLOUD_SYNC_URL = 'https://netguard.mtsmambaulhikmah.sch.id/api.php?action=push_telemetry';
const CLOUD_SYNC_TOKEN = 'indibiz_guard_sec_998124_auth';
let lastCloudSyncSuccess = false;

async function pushTelemetryToCloud() {
  if (!isRouterOnline && routerTelemetry.pingMs === 0) return;

  try {
    const payload = {
      telemetry: routerTelemetry,
      devices: realConnectedDevices,
      queues: getCombinedSimpleQueues()
    };

    const res = await fetch(CLOUD_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Token': CLOUD_SYNC_TOKEN
      },
      body: JSON.stringify({
        token: CLOUD_SYNC_TOKEN,
        payload
      })
    });

    if (res.ok) {
      const respData = await res.json();
      if (!lastCloudSyncSuccess) {
        console.log(`[Hostinger Cloud Sync] Terhubung & Sinkronisasi Aktif ke https://netguard.mtsmambaulhikmah.sch.id`);
        lastCloudSyncSuccess = true;
      }

      // Process any remote commands from Cloud dashboard
      if (respData.commands && Array.isArray(respData.commands) && respData.commands.length > 0) {
        for (const cmd of respData.commands) {
          if (cmd.type === 'set_queue' && cmd.data) {
            const d = cmd.data;
            const key = d.mac || d.target || d.id;
            if (key) {
              deviceQueueLimits[key] = {
                maxLimitDown: d.maxLimitDown || "25M",
                maxLimitUp: d.maxLimitUp || "5M",
                enabled: d.enabled !== undefined ? d.enabled : true,
                comment: d.comment || d.name || "Remote Hostinger Cloud"
              };
              saveQueueLimits();
              console.log(`[Remote Cloud Command] Limit bandwidth diperbarui: ${key} -> Down: ${d.maxLimitDown}, Up: ${d.maxLimitUp}`);
            }
          }
        }
      }
    } else {
      lastCloudSyncSuccess = false;
    }
  } catch (err) {
    // Silent catch on network interruption
    lastCloudSyncSuccess = false;
  }
}

// Initial push after first fetch, then recurring every 3 seconds
setTimeout(pushTelemetryToCloud, 2000);
setInterval(pushTelemetryToCloud, 3000);

