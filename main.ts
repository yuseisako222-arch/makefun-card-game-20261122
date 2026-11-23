import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outputDirectory = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Submit the game and its browser captures exactly as they appear in the repository.
mkdirSync(outputDirectory, { recursive: true });
for (const folder of ['game', 'screenshots']) {
  cpSync(new URL(`./${folder}/`, import.meta.url), resolve(outputDirectory, folder), {
    recursive: true,
  });
}

const dossier = buildDossier(outputDirectory, {
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  text_max_bytes: 160 * 1024,
});
writeFileSync(resolve(outputDirectory, 'dossier.json'), dossier);
