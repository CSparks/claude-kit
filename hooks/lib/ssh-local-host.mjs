// ssh-local-host.mjs — whether the host word of an ssh call provably names another machine (fail closed).
//
//   isPlainRemoteHost(word) -> boolean
//     true only for a plain DNS name (letters, digits, dots, hyphens; optional `user@`) or an IP that node:net reads and that
//     is no loopback, unspecified, link-local or own-interface address. A numeric-looking name, localhost, this machine's
//     hostname, a name whose first label is this machine's short hostname, a name in a local-only suffix (.local,
//     .localdomain, .lan, .internal, .home.arpa, .localhost), and any word with a quote, expansion, port or scheme is false.

import { isIP } from 'node:net';
import { hostname, networkInterfaces } from 'node:os';

const IPV4 = 4;
const IPV6 = 6;
const USER_PREFIX = /^[A-Za-z0-9._-]+@/;
const DNS_LABEL = /^[a-z0-9-]+$/;
const NUMERIC_LABEL = /^(?:0x[0-9a-f]*|\d+)$/;
const BRACKETED = /^\[(.*)\]$/;
const CANONICAL_OCTET = /^(?:0|[1-9]\d{0,2})$/;
const LOCALHOST_LABEL = 'localhost';
const LOCAL_SUFFIXES = ['local', 'localdomain', 'lan', 'internal', 'home.arpa', 'localhost'];
const V4_LOOPBACK_FIRST = 127;
const V4_THIS_NETWORK_FIRST = 0;
const V4_LINK_LOCAL_FIRST = 169;
const V4_LINK_LOCAL_SECOND = 254;
const V6_GROUPS = 8;
const V6_TAIL_GROUP = 5;
const V6_MAPPED_GROUP = 0xffff;
const V6_LINK_LOCAL_MASK = 0xffc0;
const V6_LINK_LOCAL_PREFIX = 0xfe80;
const HEX_RADIX = 16;

const stripTrailingDot = (name) => (name.endsWith('.') ? name.slice(0, -1) : name);

/** The eight 16-bit groups of an IPv6 address; null when it holds a dotted tail or a zone. */
function v6Groups(address) {
  if (/[.%]/.test(address)) return null;
  const [head, tail, ...extra] = address.split('::');
  if (extra.length) return null;
  const part = (text) => (text ? text.split(':').map((g) => parseInt(g, HEX_RADIX)) : []);
  const front = part(head);
  const back = tail === undefined ? [] : part(tail);
  const fill = tail === undefined ? [] : Array(V6_GROUPS - front.length - back.length).fill(0);
  const groups = [...front, ...fill, ...back];
  return groups.length === V6_GROUPS && groups.every((g) => Number.isInteger(g)) ? groups : null;
}

const interfaceAddresses = () => new Set(Object.values(networkInterfaces()).flat().map((nic) => {
  const address = nic.address.toLowerCase();
  return isIP(address) === IPV6 ? v6Groups(address)?.join(':') ?? address : address;
}));

function localV4(address) {
  const octets = address.split('.');
  if (!octets.every((o) => CANONICAL_OCTET.test(o))) return true;
  const [first, second] = octets.map(Number);
  const linkLocal = first === V4_LINK_LOCAL_FIRST && second === V4_LINK_LOCAL_SECOND;
  return first === V4_LOOPBACK_FIRST || first === V4_THIS_NETWORK_FIRST || linkLocal || interfaceAddresses().has(address);
}

function localV6(address) {
  const groups = v6Groups(address);
  if (!groups) return true;
  const tail = groups[V6_TAIL_GROUP];
  const embeddedV4 = groups.slice(0, V6_TAIL_GROUP).every((g) => g === 0) && (tail === 0 || tail === V6_MAPPED_GROUP);
  const linkLocal = (groups[0] & V6_LINK_LOCAL_MASK) === V6_LINK_LOCAL_PREFIX;
  return embeddedV4 || linkLocal || interfaceAddresses().has(groups.join(':'));
}

function remoteDnsName(name) {
  const bare = stripTrailingDot(name);
  const labels = bare.split('.');
  if (!labels.every((l) => DNS_LABEL.test(l)) || NUMERIC_LABEL.test(labels[labels.length - 1])) return false;
  const own = stripTrailingDot(hostname().toLowerCase());
  const ownShort = own.split('.')[0];
  const localSuffix = LOCAL_SUFFIXES.some((suffix) => bare === suffix || bare.endsWith(`.${suffix}`));
  return labels[0] !== LOCALHOST_LABEL && bare !== own && labels[0] !== ownShort && !localSuffix;
}

export function isPlainRemoteHost(word) {
  const host = String(word).toLowerCase().replace(USER_PREFIX, '');
  const bracketed = host.match(BRACKETED);
  const address = bracketed ? bracketed[1] : host;
  const kind = isIP(address);
  if (kind === IPV4 && !bracketed) return !localV4(address);
  if (kind === IPV6) return !localV6(address);
  return !bracketed && !address.includes(':') && remoteDnsName(address);
}
