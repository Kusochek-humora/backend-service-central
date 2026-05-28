import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("rules")
export class Rule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title_ru!: string;

  @Column()
  title_kz!: string;

  @Column({ nullable: true })
  title_en?: string;

  @Column({ nullable: true, type: "text" })
  content_ru?: string;

  @Column({ nullable: true, type: "text" })
  content_kz?: string;

  @Column({ nullable: true, type: "text" })
  content_en?: string;

  @Column({ default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
