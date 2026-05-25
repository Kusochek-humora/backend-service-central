import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("faqs")
export class Faq {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  question_ru!: string;

  @Column()
  answer_ru!: string;

  @Column()
  question_kz!: string;

  @Column()
  answer_kz!: string;

  @Column({ nullable: true })
  question_en!: string;

  @Column({ nullable: true })
  answer_en!: string;

  @Column({ default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
