import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("blog_posts")
export class BlogPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title_ru!: string;

  @Column()
  title_kz!: string;

  @Column({ nullable: true })
  title_en?: string;

  @Column({ nullable: true, type: "text" })
  excerpt_ru?: string;

  @Column({ nullable: true, type: "text" })
  excerpt_kz?: string;

  @Column({ nullable: true, type: "text" })
  excerpt_en?: string;

  @Column({ type: "text" })
  content_ru!: string;

  @Column({ type: "text" })
  content_kz!: string;

  @Column({ nullable: true, type: "text" })
  content_en?: string;

  @Column()
  photo!: string;

  @Column({ type: "text", array: true, default: "{}" })
  photos!: string[];

  @Column({ nullable: true })
  videoUrl?: string;

  @Column({ nullable: true })
  mainLink?: string;

  @Column({ type: "jsonb", nullable: true })
  links?: { label_ru: string; label_kz: string; label_en?: string; url: string }[];

  @Column({ default: false })
  isPublished!: boolean;

  @Column({ default: false })
  isOnMainPage!: boolean;

  @Column({ default: false })
  publishToTelegram!: boolean;

  @Column({ nullable: true, type: "timestamp" })
  publishedAt?: Date;

  @Column({ default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
