// ssh-local-host.mjs — whether the host word of an ssh call may name this machine, so its remote command writes locally.
//
//   mayBeLocalHost(word) -> boolean
//     true for localhost, a loopback or wildcard address, a numeric form of one, this machine's hostname or interface address,
//     and any word holding a shell expansion (its value is unknown): the caller then treats the remote command as local.

import { hostname, networkInterfaces } from 'node:os';

const UNKNOWN_VALUE = /[$`\\~%*?{}]/;
const LOCAL_NAME = /^localhost(?:\.[a-z0-9-]+)*$/;
const LOCAL_ADDRESS = /^(?:127(?:\.\d+){0,3}|0(?:\.0){0,3}|(?:0:){7}1|::1?|::ffff:127\..*)$/;
const NUMERIC_ADDRESS = /^(?:0x[0-9a-f]+|\d+)$/;
const SCHEME = /^ssh:\/\//;
const USER_PART = /^.*@/;
const BRACKETED = /^\[(.*)\](?::\d*)?$/;
const HOST_AND_PORT = /^([^:]*):\d*$/;

const bareHost = (word) => {
  const host = String(word).replace(/["']/g, '').toLowerCase().replace(SCHEME, '').replace(USER_PART, '');
  const bracketed = host.match(BRACKETED);
  if (bracketed) return bracketed[1];
  const withPort = host.match(HOST_AND_PORT);
  return withPort ? withPort[1] : host;
};

const ownNames = () => {
  const name = hostname().toLowerCase();
  const addresses = Object.values(networkInterfaces()).flat().map((nic) => nic.address.toLowerCase());
  return new Set([name, name.split('.')[0], ...addresses]);
};

export function mayBeLocalHost(word) {
  if (UNKNOWN_VALUE.test(word)) return true;
  const host = bareHost(word);
  if (!host) return true;
  return LOCAL_NAME.test(host) || LOCAL_ADDRESS.test(host) || NUMERIC_ADDRESS.test(host) || ownNames().has(host);
}
