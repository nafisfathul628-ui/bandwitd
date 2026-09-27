const fs = require('fs');
const path = require('path');
const https = require('https');

let config = {};
const configPath = path.join(__dirname, 'hostinger_config.json');
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error("Warning reading hostinger_config.json:", e.message);
  }
}

const UPLOAD_BASE_URL = process.env.HOSTINGER_UPLOAD_URL || config.upload_base_url || '';
const AUTH_KEY = process.env.HOSTINGER_AUTH_KEY || config.auth_key || '';
const REST_AUTH_KEY = process.env.HOSTINGER_REST_AUTH_KEY || config.rest_auth_key || '';

async function uploadFile(localPath, remoteRelativePath) {
  const fileBuffer = fs.readFileSync(localPath);
  const fileSize = fileBuffer.length;
  const targetUrl = new URL(`${UPLOAD_BASE_URL}/${remoteRelativePath}?override=true`);

  console.log(`[Upload] Preparing: ${localPath} (${fileSize} bytes) -> ${remoteRelativePath}`);

  // Step 1: POST to create upload
  await new Promise((resolve, reject) => {
    const req = https.request(targetUrl, {
      method: 'POST',
      headers: {
        'X-Auth': AUTH_KEY,
        'X-Auth-Rest': REST_AUTH_KEY,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': fileSize.toString(),
        'Upload-Offset': '0'
      }
    }, (res) => {
      console.log(`[POST] Response Status: ${res.statusCode} ${res.statusMessage}`);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200 || res.statusCode === 204) {
          resolve(res.headers.location || targetUrl.toString());
        } else {
          reject(new Error(`POST failed with ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });

  // Step 2: PATCH to send content
  await new Promise((resolve, reject) => {
    const req = https.request(targetUrl, {
      method: 'PATCH',
      headers: {
        'X-Auth': AUTH_KEY,
        'X-Auth-Rest': REST_AUTH_KEY,
        'Tus-Resumable': '1.0.0',
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0',
        'Content-Length': fileSize.toString()
      }
    }, (res) => {
      console.log(`[PATCH] Response Status: ${res.statusCode} ${res.statusMessage}`);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          console.log(`[SUCCESS] Uploaded ${remoteRelativePath} successfully!\n`);
          resolve();
        } else {
          reject(new Error(`PATCH failed with ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

async function run() {
  const filesToDeploy = [
    { local: 'e:\\BANDWITH\\api.php', remote: 'netguard/api.php' },
    { local: 'e:\\BANDWITH\\index.html', remote: 'netguard/index.html' },
    { local: 'e:\\BANDWITH\\style.css', remote: 'netguard/style.css' },
    { local: 'e:\\BANDWITH\\app.js', remote: 'netguard/app.js' }
  ];

  for (const item of filesToDeploy) {
    try {
      await uploadFile(item.local, item.remote);
    } catch (err) {
      console.error(`[Upload Error on ${item.remote}]:`, err.message);
    }
  }

  // Cleanup default.php on Hostinger
  console.log('[Cleanup] Triggering default.php removal on Hostinger...');
  try {
    const cleanRes = await fetch('https://netguard.mtsmambaulhikmah.sch.id/api.php?action=cleanup_default');
    const cleanData = await cleanRes.json();
    console.log('[Cleanup Result]:', cleanData);
  } catch (err) {
    console.warn('[Cleanup Warning]:', err.message);
  }

  console.log('=== DEPLOYMENT COMPLETED! ===');
  console.log('Live URL: https://netguard.mtsmambaulhikmah.sch.id');
}

run();
