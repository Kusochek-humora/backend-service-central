import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("vacancies")
export class Vacancy {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title_ru!: string;

  @Column()
  title_kz!: string;

  @Column({ nullable: true })
  title_en?: string;

  @Column({ nullable: true, type: "text" })
  description_ru?: string;

  @Column({ nullable: true, type: "text" })
  description_kz?: string;

  @Column({ nullable: true, type: "text" })
  description_en?: string;

  @Column({ nullable: true })
  salary?: string;

  @Column({ default: false })
  isPublished!: boolean;

  @Column({ default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
