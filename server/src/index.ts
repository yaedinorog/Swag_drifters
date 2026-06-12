import { createServer } from "http";
import { createApp } from "./app.js";
import { attachSocketIO } from "./socket/index.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();
const httpServer = createServer(app);

attachSocketIO(httpServer);

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
