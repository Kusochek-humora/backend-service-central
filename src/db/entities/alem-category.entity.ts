import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("alem_categories")
export class AlemCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}
