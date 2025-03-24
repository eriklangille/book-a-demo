import cors from "@elysiajs/cors";
import { Elysia } from "elysia";

const app = new Elysia()
  .use(cors())
  .get("/", () => "Hello Elysia")
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
