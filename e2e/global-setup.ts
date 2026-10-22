import { execSync } from 'node:child_process';

// The tests start electron/dist/main.js, so bundle the current electron/*.ts first.
export default function globalSetup() {
  execSync('npm run electron:build-main', { stdio: 'inherit' });
}
