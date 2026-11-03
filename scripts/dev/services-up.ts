import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

import { REPO_ROOT } from '../lib/repo.js';

/**
 * Starts local PostgreSQL and Redis (DEPLOYMENT.md §2): Docker Compose when Docker exists,
 * otherwise the WSL services installed for this project (Windows without Docker).
 */
const SERVICES = [
  { name: 'postgres', port: 5432, wslService: 'postgresql' },
  { name: 'redis', port: 6379, wslService: 'redis-server' },
] as const;

function hasCommand(command: string): boolean {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(finder, [command], { stdio: 'ignore' }).status === 0;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${String(result.status)}`);
  }
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

async function waitForPort(name: string, port: number): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (await canConnect(port)) {
      console.log(`${name} is accepting connections on 127.0.0.1:${String(port)}`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`${name} did not open port ${String(port)} within 15 s`);
}

if (hasCommand('docker')) {
  run('docker', ['compose', '-f', 'infra/docker-compose.yml', 'up', '-d', '--wait']);
} else if (process.platform === 'win32' && hasCommand('wsl')) {
  const distro = process.env['POS_WSL_DISTRO'] ?? 'Ubuntu';
  for (const service of SERVICES) {
    run('wsl.exe', ['-d', distro, '-u', 'root', '--', 'service', service.wslService, 'start']);
  }
  // WSL stops an idle distro (and its services) shortly after the last client exits.
  // A detached, time-limited sleeper keeps it running for a 12-hour working session.
  spawn('wsl.exe', ['-d', distro, '--', 'sleep', '43200'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
} else {
  console.error(
    'No Docker and no WSL found: start PostgreSQL 17 and Redis 8 manually (DEPLOYMENT.md §2).',
  );
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  for (const service of SERVICES) {
    await waitForPort(service.name, service.port);
  }
}
