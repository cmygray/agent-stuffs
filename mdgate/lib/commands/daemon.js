import { startServer } from "../server.js";
import { startZrok } from "../zrok.js";

export function run(port, hosts, { shareEnabled, shareName }) {
  startServer(null, port, hosts, { daemon: true });
  if (shareEnabled) {
    startZrok(port, shareName);
  }
}
