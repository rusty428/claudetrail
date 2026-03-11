import * as https from 'https';
import * as fs from 'fs';
import * as url from 'url';
import { log } from './log';

const pkg = require('../../package.json');
const UA = `claudetrail/${pkg.version}`;

function postJson(endpoint: string, apiKey: string, data: Record<string, unknown>): Promise<{ uploadUrl: string; s3Key: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(endpoint);
    const body = JSON.stringify(data);

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'User-Agent': UA,
      },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Presign failed: ${res.statusCode} ${responseBody}`));
          return;
        }
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          reject(new Error('Invalid presign response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function uploadFile(uploadUrl: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(uploadUrl);
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Length': stats.size,
        'User-Agent': UA,
      },
    }, (res) => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`S3 upload failed: ${res.statusCode}`));
      });
    });

    req.on('error', reject);
    fileStream.pipe(req);
  });
}

export async function uploadTranscript(baseUrl: string, apiKey: string, sessionId: string, transcriptPath: string): Promise<void> {
  if (!fs.existsSync(transcriptPath)) {
    log('upload', `file not found: ${transcriptPath}`);
    return;
  }

  const fileSize = fs.statSync(transcriptPath).size;
  log('upload', `starting presign for session=${sessionId} file=${transcriptPath} size=${(fileSize / 1024).toFixed(1)}KB`);

  try {
    const t0 = Date.now();
    const { uploadUrl } = await postJson(`${baseUrl}/presign`, apiKey, { sessionId });
    const presignMs = Date.now() - t0;
    log('upload', `presign OK in ${presignMs}ms`);

    const t1 = Date.now();
    await uploadFile(uploadUrl, transcriptPath);
    const uploadMs = Date.now() - t1;
    log('upload', `S3 PUT OK in ${uploadMs}ms (${(fileSize / 1024).toFixed(1)}KB)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('upload', `FAILED: ${msg}`);
  }
}
