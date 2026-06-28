import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "./category.entity";


export enum Hall {
  BIG = "big",
  SMALL = "small",
}

export enum Language {
  RU = "ru",
  KZ = "kz",
  EN = "en",
}

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  photo!: string;

  @Column({ type: "enum", enum: Hall })
  hall!: Hall;

  @Column({ type: "enum", enum: Language, default: Language.RU })
  language!: Language;

  @Column()
  link!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column({ default: false })
  isDonation!: boolean;

  @Column({ default: false })
  isSoldOut!: boolean;

  @Column({ default: false })
  isOnMainPage!: boolean;

  @Column({ default: false })
  publishToTelegram!: boolean;

  @Column({ default: false })
  publishToInternalChannel!: boolean;

  @Column({ nullable: true })
  banner?: string;

  @Column({ nullable: true })
  photoStories?: string;

  @Column({ nullable: true, type: "bigint" })
  internalMsgId?: string;

  @Column({ nullable: true, type: "bigint" })
  telegramMsgId?: string;

  @Column({ nullable: true })
  notion?: string;

  @Column({ nullable: true, type: "text" })
  description?: string;

  @Column({ nullable: true, type: "text" })
  comedians?: string;

  @Column({ nullable: true })
  subtext?: string;

  @ManyToOne(() => Category, { nullable: true, eager: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "categoryId" })
  category?: Category;

  @Column({ nullable: true })
  categoryId?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
