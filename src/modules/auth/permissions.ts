import { FastifyRequest, FastifyReply } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { User, UserRole, Section } from "../../db/entities/user.entity";

type JwtUser = { id: number; role: UserRole };

export function requirePermission(section: Section) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const jwtUser = request.user as JwtUser;

    if (jwtUser.role === UserRole.CHIEF_EDITOR) return;

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: jwtUser.id });

    if (!user || !user.permissions.includes(section)) {
      return reply.status(403).send({ message: "Forbidden: no permission for this section" });
    }
  };
}
