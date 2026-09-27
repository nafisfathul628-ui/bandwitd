<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, X-Sync-Token, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Handle CORS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$SYNC_TOKEN = "indibiz_guard_sec_998124_auth";
$TELEMETRY_FILE = __DIR__ . '/telemetry_cache.json';
$COMMANDS_FILE = __DIR__ . '/commands_queue.json';

$action = isset($_GET['action']) ? $_GET['action'] : 'telemetry';

// 1. Health Check
if ($action === 'health') {
    echo json_encode([
        'status' => 'ok',
        'server' => 'Hostinger Cloud Relay',
        'subdomain' => 'netguard.mtsmambaulhikmah.sch.id',
        'timestamp' => time()
    ]);
    exit;
}

$AUTH_FILE = __DIR__ . '/auth_credentials.json';

function getAuthConfig() {
    global $AUTH_FILE;
    if (file_exists($AUTH_FILE)) {
        $c = json_decode(file_get_contents($AUTH_FILE), true);
        if (!empty($c['username'])) return $c;
    }
    $default = [
        'username' => 'admin',
        'password' => 'admin',
        'role' => 'Super Admin NOC',
        'updated_at' => time()
    ];
    file_put_contents($AUTH_FILE, json_encode($default, JSON_PRETTY_PRINT));
    return $default;
}

// 2. Authentication Login Check
if ($action === 'login') {
    $inputRaw = file_get_contents('php://input');
    $req = json_decode($inputRaw, true) ?: [];
    $user = isset($req['username']) ? trim($req['username']) : '';
    $pass = isset($req['password']) ? trim($req['password']) : '';

    $cfg = getAuthConfig();
    if ($user === $cfg['username'] && $pass === $cfg['password']) {
        $token = hash('sha256', $user . time() . 'indibiz_salt_sec_881');
        echo json_encode([
            'status' => 'success',
            'token' => $token,
            'user' => $cfg['username'],
            'role' => $cfg['role'] ?? 'Super Admin NOC',
            'expires_at' => time() + (86400 * 30),
            'message' => 'Login berhasil!'
        ]);
    } else {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Username atau Password salah! Periksa kembali huruf besar/kecil.'
        ]);
    }
    exit;
}

// 3. Change Password
if ($action === 'change_password') {
    $inputRaw = file_get_contents('php://input');
    $req = json_decode($inputRaw, true) ?: [];
    $oldPass = isset($req['old_password']) ? trim($req['old_password']) : '';
    $newPass = isset($req['new_password']) ? trim($req['new_password']) : '';
    $newUsername = isset($req['new_username']) ? trim($req['new_username']) : '';

    $cfg = getAuthConfig();
    if ($oldPass !== $cfg['password']) {
        http_response_code(401);
        echo json_encode(['error' => 'Password lama tidak cocok!']);
        exit;
    }

    if (strlen($newPass) < 4) {
        http_response_code(400);
        echo json_encode(['error' => 'Password baru minimal 4 karakter!']);
        exit;
    }

    $cfg['password'] = $newPass;
    if (!empty($newUsername)) $cfg['username'] = $newUsername;
    $cfg['updated_at'] = time();
    file_put_contents($AUTH_FILE, json_encode($cfg, JSON_PRETTY_PRINT));

    echo json_encode([
        'status' => 'success',
        'message' => 'Password berhasil diperbarui!'
    ]);
    exit;
}

// 4. Delete Hostinger Default Page if exists
if ($action === 'cleanup_default') {
    if (file_exists(__DIR__ . '/default.php')) {
        unlink(__DIR__ . '/default.php');
        echo json_encode(['status' => 'deleted']);
    } else {
        echo json_encode(['status' => 'already_clean']);
    }
    exit;
}

// 3. Local Bridge pushes telemetry to Cloud
if ($action === 'push_telemetry') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);
    
    $token = '';
    if (isset($_SERVER['HTTP_X_SYNC_TOKEN'])) {
        $token = $_SERVER['HTTP_X_SYNC_TOKEN'];
    } elseif (isset($data['token'])) {
        $token = $data['token'];
    }

    if ($token !== $SYNC_TOKEN) {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized: Invalid Sync Token']);
        exit;
    }

    if (!empty($data['payload'])) {
        $payload = $data['payload'];
        $payload['updated_at'] = time();
        $payload['cloud_relay_status'] = 'ONLINE_CONNECTED';
        file_put_contents($TELEMETRY_FILE, json_encode($payload, JSON_PRETTY_PRINT));
    }

    // Check if any pending commands exist to return to local daemon
    $pendingCommands = [];
    if (file_exists($COMMANDS_FILE)) {
        $pendingCommands = json_decode(file_get_contents($COMMANDS_FILE), true) ?: [];
        if (!empty($pendingCommands)) {
            // Clear command queue after returning to local bridge
            file_put_contents($COMMANDS_FILE, json_encode([]));
        }
    }

    echo json_encode([
        'status' => 'success',
        'synced_at' => time(),
        'commands' => $pendingCommands
    ]);
    exit;
}

// 4. Web Dashboard reads latest telemetry
if ($action === 'telemetry') {
    if (!file_exists($TELEMETRY_FILE)) {
        echo json_encode([
            'online' => true,
            'cloud_sync_online' => true,
            'pingMs' => 2,
            'temperature' => '47.8 °C',
            'uptimeSec' => 154803,
            'uptimeFormatted' => '1 Hari, 19 Jam',
            'connectedDevicesCount' => 6,
            'cpuUsage' => '13%',
            'memFreeKb' => 361452,
            'opticalRxPower' => '-18.42 dBm',
            'opticalTxPower' => '2.75 dBm',
            'voltage' => '3.24 V',
            'modelName' => 'HG6145D2',
            'softwareVersion' => 'RP4437',
            'serialNumber' => 'FHTTC019031D',
            'status_text' => 'Cloud Relay Siap • Menghubungkan ke Modem...',
            'queues' => [],
            'devices' => []
        ]);
        exit;
    }

    $raw = file_get_contents($TELEMETRY_FILE);
    $cache = json_decode($raw, true) ?: [];
    $updatedAt = isset($cache['updated_at']) ? $cache['updated_at'] : 0;
    $timeDiff = time() - $updatedAt;

    $isRecent = ($timeDiff <= 30);
    $telemetry = isset($cache['telemetry']) ? $cache['telemetry'] : [];

    $telemetry['cloud_sync_online'] = $isRecent;
    $telemetry['last_seen_seconds'] = $timeDiff;
    if (!$isRecent) {
        $telemetry['online'] = false;
        $telemetry['status_text'] = 'Offline (' . $timeDiff . 'd ago)';
    } else {
        $telemetry['status_text'] = 'Cloud Sync Realtime Aktif';
    }

    $response = array_merge($telemetry, [
        'telemetry' => $telemetry,
        'queues' => $cache['queues'] ?? [],
        'devices' => $cache['devices'] ?? []
    ]);

    echo json_encode($response);
    exit;
}

// 5. Raw Queues Endpoint
if ($action === 'queues') {
    if (file_exists($TELEMETRY_FILE)) {
        $cache = json_decode(file_get_contents($TELEMETRY_FILE), true);
        echo json_encode($cache['queues'] ?? []);
    } else {
        echo json_encode([]);
    }
    exit;
}

// 6. Remote Web Dashboard submits bandwidth limit command
if ($action === 'save_queue' || $action === 'post_command') {
    $inputRaw = file_get_contents('php://input');
    $command = json_decode($inputRaw, true);

    if (!$command) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid command payload']);
        exit;
    }

    $queue = [];
    if (file_exists($COMMANDS_FILE)) {
        $queue = json_decode(file_get_contents($COMMANDS_FILE), true) ?: [];
    }

    $cmdItem = [
        'id' => 'cmd_' . time() . '_' . rand(100, 999),
        'type' => 'set_queue',
        'data' => $command,
        'created_at' => time()
    ];
    $queue[] = $cmdItem;
    file_put_contents($COMMANDS_FILE, json_encode($queue, JSON_PRETTY_PRINT));

    // Also update telemetry cache optimistically if it's a queue command
    if (file_exists($TELEMETRY_FILE)) {
        $cached = json_decode(file_get_contents($TELEMETRY_FILE), true);
        if (!empty($cached['queues'])) {
            foreach ($cached['queues'] as &$q) {
                if ((!empty($command['target']) && $q['target'] === $command['target']) ||
                    (!empty($command['id']) && $q['id'] === $command['id']) ||
                    (!empty($command['mac']) && !empty($q['mac']) && $q['mac'] === $command['mac'])) {
                    if (isset($command['maxLimitDown'])) $q['maxLimitDown'] = $command['maxLimitDown'];
                    if (isset($command['maxLimitUp'])) $q['maxLimitUp'] = $command['maxLimitUp'];
                    if (isset($command['enabled'])) $q['enabled'] = $command['enabled'];
                    if (isset($command['comment'])) $q['comment'] = $command['comment'];
                    break;
                }
            }
            file_put_contents($TELEMETRY_FILE, json_encode($cached, JSON_PRETTY_PRINT));
        }
    }

    echo json_encode([
        'status' => 'queued',
        'message' => 'Alokasi bandwidth berhasil disimpan ke Cloud & Modem Rumah.',
        'command_id' => $cmdItem['id']
    ]);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Action not found']);
