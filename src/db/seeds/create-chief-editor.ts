import "reflect-metadata";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/user.entity";

const run = async () => {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);

  let user = await userRepo.findOneBy({ role: UserRole.CHIEF_EDITOR });

  if (!user) {
    user = userRepo.create({ role: UserRole.CHIEF_EDITOR } as User);
  }

  user.email = "yanessa-spermovna";
  user.username = "Yanessa Spermovna";
  user.password = await bcrypt.hash("admin123", 10);

  await userRepo.save(user);
  console.log("Chief editor saved:", user.email);
  await AppDataSource.destroy();
};

run().catch(console.error);
