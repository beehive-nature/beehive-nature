import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [input, output] = process.argv.slice(2);
assert.ok(input && output && input !== output);
let config = readFileSync(input, 'utf8').replaceAll('\r\n', '\n');
function replaceExact(before, after, count) {
  assert.equal(config.split(before).length - 1, count, `Unexpected source configuration near ${before.slice(0, 50)}`);
  config = config.replaceAll(before, after);
}
replaceExact('reverse_proxy buzz-prod-relay-1:3000 {\n      header_up Host skaists.buzz\n    }', 'import hostinger-core', 2);
replaceExact('handle @door {\n    root * /srv/door\n    file_server\n  }', 'handle @door {\n    import hostinger-core\n  }', 2);
replaceExact('root * /srv/join\n    file_server', 'import hostinger-core', 2);
replaceExact('root * /srv/join\n    try_files {path} /index.html\n    file_server', 'rewrite * /join{uri}\n    import hostinger-core', 2);
replaceExact('reverse_proxy buzz-prod-pair-relay-1:5000', 'import hostinger-core', 1);
replaceExact('root * /srv/hive/public\n    file_server', 'rewrite * /hive/public{uri}\n    import hostinger-core', 1);
replaceExact('root * /srv/hive\n    file_server', 'rewrite * /hive{uri}\n    import hostinger-core', 1);
const prefix = `(hostinger-core) {
  reverse_proxy https://2.25.245.161 {
    header_up Host {host}
    transport http {
      tls_server_name skaists.buzz
    }
  }
}

`;
writeFileSync(output, prefix + config);
console.log('Prepared Oracle forwarding; other community and auxiliary routes preserved.');
