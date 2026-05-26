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

  @Column()
  link!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column({ default: false })
  isDonation!: boolean;

  @Column({ default: false })
  isOnMainPage!: boolean;

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
