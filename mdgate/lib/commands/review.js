import { startServer } from "../server.js";

export async function run(filePath, port, hosts) {
  const { server, reviewPromise } = startServer(filePath, port, hosts, { reviewMode: true });
  const comments = await reviewPromise;
  console.log(JSON.stringify(comments, null, 2));
  server.close();
  process.exit(0);
}
