const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudshell-verify-stubs-'));
const awsStub = path.join(tmpRoot, 'aws');
writeExecutable(
  awsStub,
  `#!/usr/bin/env bash
set -euo pipefail
cmd="$1"

if [[ "$cmd" == "--version" ]]; then
  echo "aws-cli/2.13.0"
  exit 0
fi

if [[ "$cmd" == "cloudformation" ]]; then
  # Simulerer at API-stacken ikke finnes, slik at logggrupper må auto-detekteres.
  exit 1
fi

if [[ "$cmd" == "logs" && "$2" == "describe-log-groups" ]]; then
  if [[ "\${DESCRIBE_LOG_GROUPS_OUTPUT:-}" == "newline" ]]; then
    printf "/aws/lambda/math-visuals-api-Primary\n/aws/lambda/math-visuals-api-Secondary\n"
  else
    printf "/aws/lambda/math-visuals-api-Primary\t/aws/lambda/math-visuals-api-Secondary\n"
  fi
  exit 0
fi

if [[ "$cmd" == "cloudwatch" && "$2" == "logs" && "$3" == "describe-log-streams" ]]; then
  log_group=""
  shift 3
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --log-group-name)
        log_group="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  if [[ "\${ALL_GROUPS_HAVE_STREAMS:-}" == "1" ]]; then
    echo "1"
  elif [[ "$log_group" == "/aws/lambda/math-visuals-api-Secondary" ]]; then
    echo "1"
  else
    echo "0"
  fi
  exit 0
fi

echo "Stub aws fikk uventede argumenter: $*" >&2
exit 1
`,
);

['jq', 'curl', 'npm'].forEach(name => {
  writeExecutable(path.join(tmpRoot, name), '#!/usr/bin/env bash\nexit 0\n');
});

const env = {
  ...process.env,
  PATH: `${tmpRoot}:${process.env.PATH}`,
  CLOUDSHELL_VERIFY_LIB_ONLY: '1',
  DEFAULT_LOG_GROUP: '/aws/lambda/math-visuals-api',
  API_STACK: 'missing-api-stack',
};

const detectLogGroup = execFileSync(
  'bash',
  [
    '-lc',
    [
      'source scripts/cloudshell-verify.sh',
      'LOG_GROUP_SET=false',
      'LOG_GROUP=""',
      'resolve_log_group',
      'printf "%s\n" "$LOG_GROUP"',
    ].join(' && '),
  ],
  { cwd: repoRoot, env, encoding: 'utf8' },
);

const discoveredGroups = execFileSync(
  'bash',
  [
    '-lc',
    [
      'source scripts/cloudshell-verify.sh',
      'mapfile -t groups < <(discover_log_groups)',
      'printf "%s\n" "${groups[@]}"',
    ].join(' && '),
  ],
  { cwd: repoRoot, env, encoding: 'utf8' },
);

assert.equal(
  detectLogGroup.trim(),
  '/aws/lambda/math-visuals-api-Secondary',
  'Auto-detect should select the log group that reports streams when multiple are returned',
);

assert.deepEqual(
  discoveredGroups.trim().split('\n'),
  ['/aws/lambda/math-visuals-api-Secondary'],
  'discover_log_groups should return only log groups that contain streams when describe-log-groups outputs multiple values',
);

const multipleDiscovered = execFileSync(
  'bash',
  [
    '-lc',
    [
      'source scripts/cloudshell-verify.sh',
      'mapfile -t groups < <(discover_log_groups)',
      'printf "%s\n" "${groups[@]}"',
    ].join(' && '),
  ],
  {
    cwd: repoRoot,
    env: {
      ...env,
      DESCRIBE_LOG_GROUPS_OUTPUT: 'newline',
      ALL_GROUPS_HAVE_STREAMS: '1',
    },
    encoding: 'utf8',
  },
);

assert.deepEqual(
  multipleDiscovered.trim().split('\n'),
  [
    '/aws/lambda/math-visuals-api-Primary',
    '/aws/lambda/math-visuals-api-Secondary',
  ],
  'discover_log_groups should handle multiple lines of describe-log-groups output and keep each candidate separate',
);

console.log('cloudshell-verify auto-detect tests passed');
