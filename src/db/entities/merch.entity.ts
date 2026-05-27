import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("merch_categories")
export class MerchCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name_ru!: string;

  @Column()
  name_kz!: string;

  @Column({ nullable: true })
  name_en?: string;

  @Column({ default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("merch_items")
export class MerchItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name_ru!: string;

  @Column()
  name_kz!: string;

  @Column({ nullable: true })
  name_en?: string;

  @Column({ nullable: true, type: "text" })
  description_ru?: string;

  @Column({ nullable: true, type: "text" })
  description_kz?: string;

  @Column({ nullable: true, type: "text" })
  description_en?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ nullable: true, type: "int" })
  discount?: number;

  @Column()
  photo!: string;

  @Column({ type: "text", array: true, default: "{}" })
  photos!: string[];

  @Column({ type: "text", array: true, default: "{}" })
  sizes!: string[];

  @Column({ default: true })
  isAvailable!: boolean;

  @Column({ default: 0 })
  order!: number;

  @Column()
  categoryId!: number;

  @ManyToOne(() => MerchCategory, { nullable: false, eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" })
  category!: MerchCategory;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("merch_orders")
export class MerchOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  socialLink?: string;

  @Column({ nullable: true, type: "text" })
  comment?: string;

  @Column({ type: "jsonb" })
  items!: { name: string; size?: string; quantity: number; price: number }[];

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalPrice!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
