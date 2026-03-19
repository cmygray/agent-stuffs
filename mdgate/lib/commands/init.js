import { initConfig } from "../config.js";

export function run(args) {
  const hosts = args.filter((a) => !a.startsWith("-") && args.indexOf(a) > args.indexOf("--init"));
  if (hosts.length === 0) {
    console.error("Usage: mdgate --init <host1> [host2...]");
    process.exit(1);
  }
  initConfig(hosts);
}
