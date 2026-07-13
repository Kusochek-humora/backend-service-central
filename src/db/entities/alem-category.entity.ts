import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("alem_categories")
export class AlemCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name_ru!: string;

  @Column({ nullable: true })
  name_kz?: string;

  @Column({ nullable: true })
  name_en?: string;
}
