// Parses a vless:// link and builds an Xray client config.
// Pure JS, no native deps, so it can be checked with plain node.

export function parseVless(input) {
  const s = (input || '').trim();
  const m = s.match(/^vless:\/\/([^@]+)@(\[[^\]]+\]|[^:/?#]+):(\d+)(\?[^#]*)?(#.*)?$/);
  if (!m) throw new Error('لینک vless:// معتبر نیست');

  const uuid = decodeURIComponent(m[1]);
  const address = m[2].replace(/^\[|\]$/g, '');
  const port = Number(m[3]);
  const query = {};
  (m[4] || '?').slice(1).split('&').filter(Boolean).forEach((kv) => {
    const [k, v = ''] = kv.split('=');
    query[k] = decodeURIComponent(v.replace(/\+/g, ' '));
  });
  const name = m[5] ? decodeURIComponent(m[5].slice(1)) : address;

  if (!uuid || !address || !port) throw new Error('لینک ناقصه');

  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    name: name || address,
    address,
    port,
    uuid,
    network: query.type || 'tcp',
    security: query.security || 'none',
    sni: query.sni || query.host || address,
    fp: query.fp || 'chrome',
    pbk: query.pbk || '',
    sid: query.sid || '',
    flow: query.flow || '',
    path: query.path || '/',
    host: query.host || '',
    serviceName: query.serviceName || '',
    raw: s,
  };
}

export function buildXrayConfig(sv, socksPort = 10808) {
  const stream = { network: sv.network === 'ws' || sv.network === 'grpc' ? sv.network : 'tcp' };

  if (sv.network === 'ws') {
    stream.wsSettings = { path: sv.path, headers: sv.host ? { Host: sv.host } : {} };
  }
  if (sv.network === 'grpc') {
    stream.grpcSettings = { serviceName: sv.serviceName };
  }

  if (sv.security === 'reality') {
    stream.security = 'reality';
    stream.realitySettings = {
      serverName: sv.sni,
      fingerprint: sv.fp,
      publicKey: sv.pbk,
      shortId: sv.sid,
      spiderX: '/',
    };
  } else if (sv.security === 'tls') {
    stream.security = 'tls';
    stream.tlsSettings = { serverName: sv.sni, fingerprint: sv.fp, allowInsecure: false };
  }

  const user = { id: sv.uuid, encryption: 'none' };
  if (sv.flow) user.flow = sv.flow;

  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'socks-in',
        listen: '127.0.0.1',
        port: socksPort,
        protocol: 'socks',
        settings: { udp: true },
      },
    ],
    outbounds: [
      {
        tag: 'proxy',
        protocol: 'vless',
        settings: { vnext: [{ address: sv.address, port: sv.port, users: [user] }] },
        streamSettings: stream,
      },
      { tag: 'direct', protocol: 'freedom' },
    ],
  };
}
