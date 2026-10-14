import { createServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config";
import { createApp } from "./app";
import { setSocketServer } from "./events";

const server = createServer(createApp());

setSocketServer(
  new Server(server, {
    cors: { origin: config.frontendOrigin },
  })
);

server.listen(config.port, () => {
  console.log(`backend listening on http://localhost:${config.port}`);
});
