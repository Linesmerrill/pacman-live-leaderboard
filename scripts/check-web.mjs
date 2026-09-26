// The TV and staff pages are plain browser JS with no build step, so a missing import only shows up
// when that code path runs — e.g. one rule's animation crashing on the TV. This runs the TypeScript
// checker over them and fails on exactly that class of mistake: a name that doesn't exist.
// (The checker has other opinions about untyped DOM code; those are ignored here.)
import { spawnSync } from 'node:child_process';

const MISSING_NAME = /error TS(2304|2552|2305|2724):/; // cannot find name / did you mean / no such export
const run = spawnSync('npx', ['tsc', '-p', 'tsconfig.web.json'], { encoding: 'utf8' });
const problems = `${run.stdout}${run.stderr}`.split('\n').filter((line) => MISSING_NAME.test(line));
if (problems.length) {
  console.error(`Browser code refers to names that don't exist:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Browser code: every name it uses exists.');
