import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { AlemLocation } from "./alem-location.entity";
import { AlemCategory } from "./alem-category.entity";

@Entity("alem_events")
export class AlemEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  photo!: string;

  @Column({ nullable: true })
  photoStories?: string;

  @Column({ nullable: true })
  banner?: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column({ type: "enum", enum: ["ru", "kz", "en"], default: "ru" })
  language!: string;

  @Column({ nullable: true })
  notion?: string;

  @Column({ nullable: true, type: "text" })
  description?: string;

  @Column({ nullable: true, type: "text" })
  comedians?: string;

  @Column({ nullable: true })
  link?: string;

  @Column({ nullable: true })
  moreinfolink?: string;

  @Column({ nullable: true, type: "int" })
  order?: number;

  @Column({ nullable: true })
  yandexSessionId?: string;

  @Column({ default: false })
  isSoldOut!: boolean;

  @Column({ default: false })
  publishToOrganizerTelegram!: boolean;

  @Column({ default: false })
  publishToMainBlock!: boolean;

  @Column({ default: false })
  isOnMainPage!: boolean;

  @Column({ nullable: true, type: "bigint" })
  telegramMsgId?: string;

  @ManyToOne(() => AlemLocation, { nullable: true, eager: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "locationId" })
  location?: AlemLocation;

  @Column({ nullable: true })
  locationId?: number;

  @ManyToOne(() => AlemCategory, { nullable: true, eager: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "categoryId" })
  category?: AlemCategory;

  @Column({ nullable: true })
  categoryId?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
