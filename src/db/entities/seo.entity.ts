import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("seo")
export class Seo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  page!: string;

  @Column({ nullable: true })
  title_ru?: string;

  @Column({ nullable: true })
  title_kz?: string;

  @Column({ nullable: true, type: "text" })
  description_ru?: string;

  @Column({ nullable: true, type: "text" })
  description_kz?: string;

  @Column({ nullable: true })
  og_image?: string;

  @Column({ default: "index, follow" })
  robots!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
