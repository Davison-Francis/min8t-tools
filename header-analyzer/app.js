// Email Header Analyzer - Tool 14
// Vanilla JS RFC-5322 header parser. No dependencies. All client-side.

import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const $ = (id) => document.getElementById(id);
const input = $('headers-input');
const analyzeBtn = $('analyze-btn');
const sampleBtn = $('sample-btn');
const sampleSpoofBtn = $('sample-spoof-btn');
const clearBtn = $('clear-btn');
const stats = $('stats');
const results = $('results');
const authBadges = $('auth-badges');
const summaryGrid = $('summary-grid');
const flagsList = $('flags-list');
const hopsList = $('hops-list');
const rawTableBody = document.querySelector('#raw-table tbody');
const rawSearch = $('raw-search');
const ctaDeliveriq = $('cta-deliveriq');
const toast = $('toast');

const HOP_DELAY_WARN = 60; // seconds

// ---- Header parsing (RFC 5322 with continuation lines) ----
function parseHeaders(raw) {
  // Normalize line endings; stop at first blank line (header/body boundary).
  const text = raw.replace(/\r\n?/g, '\n');
  const blankIdx = text.search(/\n\n/);
  const headerSection = blankIdx >= 0 ? text.slice(0, blankIdx) : text;
  const lines = headerSection.split('\n');
  const headers = [];
  let current = null;
  for (const line of lines) {
    if (/^[ \t]/.test(line)) {
      // continuation
      if (current) current.value += ' ' + line.trim();
    } else if (line === '') {
      continue;
    } else {
      if (current) headers.push(current);
      const colon = line.indexOf(':');
      if (colon < 0) {
        // not a header line, ignore
        current = null;
      } else {
        current = {
          name: line.slice(0, colon).trim(),
          value: line.slice(colon + 1).trim(),
        };
      }
    }
  }
  if (current) headers.push(current);
  return headers;
}

function getAll(headers, name) {
  const lc = name.toLowerCase();
  return headers.filter((h) => h.name.toLowerCase() === lc).map((h) => h.value);
}
function getOne(headers, name) {
  const v = getAll(headers, name);
  return v.length ? v[0] : '';
}

// ---- Received-line parsing ----
function parseReceived(value) {
  // Format example:
  //   from senderhost (sender-public.example.com [1.2.3.4])
  //     by recvhost.example.com with ESMTPS id abc123
  //     for <user@example.com>; Tue, 28 Apr 2026 12:34:56 -0500
  const semi = value.lastIndexOf(';');
  const dateStr = semi >= 0 ? value.slice(semi + 1).trim() : '';
  const trace = semi >= 0 ? value.slice(0, semi) : value;
  const fromMatch = trace.match(/from\s+([^\s(]+)(?:\s*\(([^)]+)\))?/i);
  const byMatch = trace.match(/by\s+([^\s;]+)/i);
  // Try to extract IP from the (...) of from clause OR anywhere in the trace
  const ipMatch = trace.match(/\[([0-9a-fA-F.:]+)\]/) || trace.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  const date = dateStr ? new Date(dateStr) : null;
  return {
    fromHost: fromMatch ? fromMatch[1] : '',
    fromHostInfo: fromMatch && fromMatch[2] ? fromMatch[2] : '',
    byHost: byMatch ? byMatch[1] : '',
    ip: ipMatch ? ipMatch[1] : '',
    date: date && !isNaN(date.getTime()) ? date : null,
    rawDate: dateStr,
  };
}

// ---- Authentication-Results parsing ----
function parseAuthResults(value) {
  // Lines look like:
  //   mx.google.com; spf=pass (google.com: domain of x@y.com designates ...) smtp.mailfrom=...; dkim=pass header.i=@domain header.s=selector header.b=...; dmarc=pass action=none header.from=domain
  const result = { spf: null, dkim: null, dmarc: null, dkimDetail: {}, source: '' };
  if (!value) return result;
  // First token (up to first ;) is the receiver host
  const parts = value.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length) result.source = parts[0];
  for (const p of parts) {
    const m = p.match(/^(spf|dkim|dmarc)\s*=\s*([a-z]+)/i);
    if (m) {
      const method = m[1].toLowerCase();
      const verdict = m[2].toLowerCase();
      // Earliest verdict wins; some servers list multiple dkim entries
      if (!result[method]) result[method] = verdict;
      if (method === 'dkim') {
        const d = p.match(/header\.i\s*=\s*@?([^\s;]+)/i) || p.match(/header\.d\s*=\s*([^\s;]+)/i);
        const s = p.match(/header\.s\s*=\s*([^\s;]+)/i);
        if (d && !result.dkimDetail.signingDomain) result.dkimDetail.signingDomain = d[1];
        if (s && !result.dkimDetail.selector) result.dkimDetail.selector = s[1];
      }
    }
  }
  return result;
}

// ---- DKIM-Signature header parsing ----
function parseDkimSignature(value) {
  if (!value) return null;
  const detail = {};
  const tokens = value.split(';').map((s) => s.trim()).filter(Boolean);
  for (const t of tokens) {
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    detail[key] = val;
  }
  return {
    domain: detail.d || '',
    selector: detail.s || '',
    algorithm: detail.a || '',
  };
}

// ---- From / Return-Path domain extraction ----
function extractDomain(addr) {
  if (!addr) return '';
  const m = addr.match(/[\w._%+-]+@([\w.-]+)/);
  return m ? m[1].toLowerCase() : '';
}

// ---- Main analyze ----
function analyze(raw) {
  const headers = parseHeaders(raw);
  if (!headers.length) {
    return { error: 'No valid headers found. Make sure you copied from the start of the message.' };
  }

  const receivedRaw = getAll(headers, 'Received');
  // Headers come top-down; Received headers are added at top, so the last one in the list is the origin.
  const hops = receivedRaw.map(parseReceived);
  // Reverse so first item is origin (oldest) -> last is destination
  hops.reverse();

  // Compute per-hop delays
  for (let i = 1; i < hops.length; i++) {
    const a = hops[i - 1].date;
    const b = hops[i].date;
    if (a && b) hops[i].delaySec = Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
  }

  const authValue = getOne(headers, 'Authentication-Results');
  const auth = parseAuthResults(authValue);
  const arc = parseAuthResults(getOne(headers, 'ARC-Authentication-Results'));

  const dkimSig = parseDkimSignature(getOne(headers, 'DKIM-Signature'));

  const fromHeader = getOne(headers, 'From');
  const returnPath = getOne(headers, 'Return-Path');
  const fromDomain = extractDomain(fromHeader);
  const returnDomain = extractDomain(returnPath);

  const summary = {
    From: fromHeader,
    To: getOne(headers, 'To'),
    Subject: getOne(headers, 'Subject'),
    Date: getOne(headers, 'Date'),
    'Message-ID': getOne(headers, 'Message-ID'),
    'Return-Path': returnPath,
    'Reply-To': getOne(headers, 'Reply-To'),
    'List-Unsubscribe': getOne(headers, 'List-Unsubscribe'),
    'Originating IP': hops.length && hops[0].ip ? hops[0].ip : '',
    'Total hops': hops.length,
    'DKIM signing domain': dkimSig ? dkimSig.domain : '',
  };

  // Suspicious flags
  const flags = [];
  if (!auth.spf && !arc.spf) flags.push({ msg: 'No SPF result in Authentication-Results header.', severity: 'warn' });
  else if (auth.spf && auth.spf !== 'pass') flags.push({ msg: `SPF result: ${auth.spf}.`, severity: auth.spf === 'fail' ? 'fail' : 'warn' });

  if (!auth.dkim && !arc.dkim) flags.push({ msg: 'No DKIM result in Authentication-Results header.', severity: 'warn' });
  else if (auth.dkim && auth.dkim !== 'pass') flags.push({ msg: `DKIM result: ${auth.dkim}.`, severity: auth.dkim === 'fail' ? 'fail' : 'warn' });

  if (!auth.dmarc && !arc.dmarc) flags.push({ msg: 'No DMARC result in Authentication-Results header.', severity: 'warn' });
  else if (auth.dmarc && auth.dmarc !== 'pass') flags.push({ msg: `DMARC result: ${auth.dmarc}.`, severity: auth.dmarc === 'fail' ? 'fail' : 'warn' });

  if (fromDomain && returnDomain && fromDomain !== returnDomain) {
    flags.push({ msg: `From: domain (${fromDomain}) does not match Return-Path domain (${returnDomain}). This is a classic spoofing tell, but is also normal for forwarded messages and many ESP setups.`, severity: 'warn' });
  }

  if (dkimSig && dkimSig.domain && fromDomain && !sameOrSub(dkimSig.domain, fromDomain)) {
    flags.push({ msg: `DKIM-Signature was signed by ${dkimSig.domain}, which is not aligned with From: domain (${fromDomain}). DMARC requires alignment unless your domain explicitly trusts the signing domain.`, severity: 'warn' });
  }

  if (!summary['Message-ID']) flags.push({ msg: 'Missing Message-ID header. Some receivers down-rank messages without it.', severity: 'warn' });

  if (hops.length > 10) flags.push({ msg: `${hops.length} hops in the path. Long chains can indicate forwarding loops or relays.`, severity: 'warn' });

  for (let i = 1; i < hops.length; i++) {
    if (hops[i].delaySec != null && hops[i].delaySec > HOP_DELAY_WARN) {
      flags.push({ msg: `Hop ${i + 1} took ${hops[i].delaySec}s. Delays over ${HOP_DELAY_WARN}s suggest relay queue issues.`, severity: 'warn' });
    }
  }

  if (!flags.length) {
    flags.push({ msg: 'No suspicious patterns detected. Auth verdicts pass and the trace looks normal.', severity: 'ok' });
  }

  return { headers, hops, auth, arc, dkimSig, summary, flags };
}

function sameOrSub(a, b) {
  // a = signing domain, b = From domain.
  // pass if a === b or a is a subdomain of b or b is a subdomain of a
  a = a.toLowerCase(); b = b.toLowerCase();
  return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
}

// ---- Rendering ----
function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
}

function badgeClass(verdict) {
  if (!verdict) return 'unknown';
  const v = verdict.toLowerCase();
  if (v === 'pass') return 'pass';
  if (v === 'fail') return 'fail';
  if (v === 'none') return 'none';
  return 'neutral'; // softfail, neutral, temperror, permerror, policy
}

function renderResults(r) {
  if (r.error) {
    results.classList.remove('show');
    showToast(r.error);
    return;
  }
  results.classList.add('show');

  // Auth badges
  const authToShow = r.auth && (r.auth.spf || r.auth.dkim || r.auth.dmarc) ? r.auth : r.arc;
  authBadges.innerHTML = ['SPF', 'DKIM', 'DMARC']
    .map((m) => {
      const v = authToShow[m.toLowerCase()] || 'unknown';
      return `<span class="badge ${badgeClass(v)}">${m}: ${escapeHtml(v)}</span>`;
    })
    .join('');

  // Summary
  summaryGrid.innerHTML = Object.entries(r.summary)
    .filter(([_, v]) => v != null && v !== '')
    .map(([k, v]) => {
      let val = escapeHtml(String(v));
      if (k === 'Originating IP' && v) {
        val += ` &nbsp;<a href="https://mxtoolbox.com/SuperTool.aspx?action=blacklist:${encodeURIComponent(v)}" target="_blank" rel="noopener" style="font-size:0.8em;">MXToolbox</a>`;
        val += ` &nbsp;<a href="https://check.spamhaus.org/results?query=${encodeURIComponent(v)}" target="_blank" rel="noopener" style="font-size:0.8em;">Spamhaus</a>`;
      }
      return `<div class="k">${escapeHtml(k)}</div><div class="v">${val}</div>`;
    })
    .join('');

  // Flags
  flagsList.innerHTML = r.flags
    .map((f) => {
      const cls = f.severity === 'ok' ? 'ok' : '';
      const icon = f.severity === 'ok' ? '✓' : '!';
      return `<div class="flag ${cls}"><span class="icon">${icon}</span><span>${escapeHtml(f.msg)}</span></div>`;
    })
    .join('');

  // Hops
  hopsList.innerHTML = r.hops
    .map((h, i) => {
      const num = i + 1;
      const delay = h.delaySec != null
        ? `<span class="delay${h.delaySec > HOP_DELAY_WARN ? ' warn' : ''}">+${h.delaySec}s</span>`
        : '';
      const datePart = h.date ? h.date.toUTCString() : (h.rawDate || '(no date)');
      return `<div class="hop">
        <div class="hop-head">
          <span class="num">Hop ${num}</span>
          <span style="color:var(--text-muted);font-size:0.8rem;">${escapeHtml(datePart)}</span>
          ${delay}
        </div>
        ${h.fromHost ? `<div class="hop-line"><span class="l">from</span> ${escapeHtml(h.fromHost)}${h.fromHostInfo ? ` (${escapeHtml(h.fromHostInfo)})` : ''}</div>` : ''}
        ${h.byHost ? `<div class="hop-line"><span class="l">by</span> ${escapeHtml(h.byHost)}</div>` : ''}
        ${h.ip ? `<div class="hop-line"><span class="l">ip</span> <code>${escapeHtml(h.ip)}</code></div>` : ''}
      </div>`;
    })
    .join('');

  // Raw
  renderRawTable(r.headers, '');
  rawSearch.value = '';

  // Track
  trackToolUsed('header-analyzer', 'analyze', {
    hops: r.hops.length,
    spf: r.auth.spf || '',
    dkim: r.auth.dkim || '',
    dmarc: r.auth.dmarc || '',
  });
}

function renderRawTable(headers, filter) {
  const lc = filter.toLowerCase();
  rawTableBody.innerHTML = headers
    .filter((h) => !lc || h.name.toLowerCase().includes(lc))
    .map((h) => `<tr><td>${escapeHtml(h.name)}</td><td>${escapeHtml(h.value)}</td></tr>`)
    .join('');
}

// ---- UI plumbing ----
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function updateStats() {
  stats.textContent = `${input.value.length.toLocaleString()} chars`;
}

input.addEventListener('input', updateStats);

analyzeBtn.addEventListener('click', () => {
  const raw = input.value.trim();
  if (!raw) {
    showToast('Paste headers first.');
    return;
  }
  renderResults(analyze(raw));
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  results.classList.remove('show');
  updateStats();
});

sampleBtn.addEventListener('click', () => {
  input.value = SAMPLE_CLEAN;
  updateStats();
  renderResults(analyze(input.value));
});

sampleSpoofBtn.addEventListener('click', () => {
  input.value = SAMPLE_SPOOFED;
  updateStats();
  renderResults(analyze(input.value));
});

rawSearch.addEventListener('input', () => {
  // Re-render the raw table only (we still hold parsed headers in DOM rows)
  // Easiest: rebuild from input
  const raw = input.value.trim();
  if (!raw) return;
  const r = analyze(raw);
  if (r.headers) renderRawTable(r.headers, rawSearch.value);
});

ctaDeliveriq.addEventListener('click', () => trackCtaClicked('header-analyzer', 'deliveriq'));

updateStats();

// ---- Sample headers ----
const SAMPLE_CLEAN = `Delivered-To: recipient@example.com
Received: by 2002:a05:6402:abcd:def0:1234:5678:0001 with SMTP id xyz12345abc;
        Tue, 28 Apr 2026 14:23:11 -0700 (PDT)
X-Received: by 2002:a05:6402:1234:5678:9abc:def0:0002 with SMTP id pqr98765def;
        Tue, 28 Apr 2026 14:23:11 -0700 (PDT)
ARC-Seal: i=1; a=rsa-sha256; t=1745962991; cv=none;
        d=google.com; s=arc-20240605;
        b=abcdef1234567890=
ARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=arc-20240605;
        h=mime-version:subject:message-id:date:from:to;
        bh=abcdef1234567890;
        b=abcdef1234567890=
ARC-Authentication-Results: i=1; mx.google.com;
       dkim=pass header.i=@example.com header.s=selector1 header.b=abc123;
       spf=pass (google.com: domain of bounce@example.com designates 198.51.100.42 as permitted sender) smtp.mailfrom=bounce@example.com;
       dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=example.com
Return-Path: <bounce@example.com>
Received: from outbound.example.com (outbound.example.com. [198.51.100.42])
        by mx.google.com with ESMTPS id abc123def456
        for <recipient@example.com>
        (version=TLS1_3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256);
        Tue, 28 Apr 2026 14:23:11 -0700 (PDT)
Received-SPF: pass (google.com: domain of bounce@example.com designates 198.51.100.42 as permitted sender) client-ip=198.51.100.42;
Authentication-Results: mx.google.com;
       dkim=pass header.i=@example.com header.s=selector1 header.b=abc123;
       spf=pass (google.com: domain of bounce@example.com designates 198.51.100.42 as permitted sender) smtp.mailfrom=bounce@example.com;
       dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=example.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com; s=selector1;
        h=from:to:subject:date:message-id:mime-version:content-type;
        bh=ZcOcgmVA3qZ8pYPUFi0zT9N3RYZqM4xWZJ7hYlKwL2k=;
        b=BBkQ7P3NV0Mexample==
Received: from app-server.internal (app-server.internal [10.0.1.5])
        by outbound.example.com (Postfix) with ESMTPSA id ABC123DEF
        for <recipient@example.com>; Tue, 28 Apr 2026 14:23:09 -0700 (PDT)
Date: Tue, 28 Apr 2026 14:23:09 -0700
From: Newsletter Team <hello@example.com>
To: recipient@example.com
Message-ID: <20260428212309.ABC123@example.com>
Subject: Welcome to our newsletter
List-Unsubscribe: <https://example.com/unsubscribe?id=abc123>, <mailto:unsubscribe@example.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="boundary-abc-123"
`;

const SAMPLE_SPOOFED = `Delivered-To: victim@example.com
Received: by 2002:a05:dead:beef:cafe:1234:5678:9abc with SMTP id xyz98765;
        Tue, 28 Apr 2026 14:23:11 -0700 (PDT)
ARC-Authentication-Results: i=1; mx.google.com;
       dkim=fail header.i=@suspicious-domain.tk header.s=mail header.b=def456;
       spf=fail (google.com: domain of unknown-sender@bigbrand.com does not designate 192.0.2.99 as permitted sender) smtp.mailfrom=unknown-sender@bigbrand.com;
       dmarc=fail (p=REJECT sp=REJECT dis=QUARANTINE) header.from=bigbrand.com
Return-Path: <unknown-sender@bigbrand.com>
Received: from suspicious-host.tk (suspicious-host.tk. [192.0.2.99])
        by mx.google.com with ESMTP id wow123
        for <victim@example.com>;
        Tue, 28 Apr 2026 14:23:11 -0700 (PDT)
Authentication-Results: mx.google.com;
       dkim=fail header.i=@suspicious-domain.tk header.s=mail header.b=def456;
       spf=fail (google.com: domain of unknown-sender@bigbrand.com does not designate 192.0.2.99 as permitted sender) smtp.mailfrom=unknown-sender@bigbrand.com;
       dmarc=fail (p=REJECT sp=REJECT dis=QUARANTINE) header.from=bigbrand.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=suspicious-domain.tk; s=mail;
        h=from:to:subject;
        bh=fakefakefakefakefakefakefakefakefakefakefakefa=;
        b=fakefakefakefakefakefakefakefake==
Received: from random-zombie.example (random-zombie.example [192.0.2.250])
        by suspicious-host.tk with ESMTP id zombie456
        for <victim@example.com>; Tue, 28 Apr 2026 14:21:50 -0700 (PDT)
Date: Tue, 28 Apr 2026 14:21:50 -0700
From: "BigBrand Support" <support@bigbrand.com>
Reply-To: <attacker@malicious-throwaway.tk>
To: victim@example.com
Subject: URGENT: Verify your account or it will be locked!
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
`;
