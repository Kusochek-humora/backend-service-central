import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import "dotenv/config";
import "reflect-metadata";

const app = fastify({ logger: true });
const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    app.log.info("server dolboeb");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

app.get("/", async () => {
  return { message: "yan pedik" };
});

start();

// app.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
//   if (err) {
//     app.log.error(err);
//     process.exit(1);
//   }
// });
