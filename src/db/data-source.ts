import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../config/env";

export const AppDataSource = new DataSource({
  type: "postgres",
  host:     env.db.host,
  port:     env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  synchronize: false,
  logging: true,
  entities: env.nodeEnv === "production"
    ? ["dist/db/entities/**/*.js"]
    : ["src/db/entities/**/*.ts"],
  migrations: env.nodeEnv === "production"
    ? ["dist/db/migrations/**/*.js"]
    : ["src/db/migrations/**/*.ts"],
  subscribers:[]
});
