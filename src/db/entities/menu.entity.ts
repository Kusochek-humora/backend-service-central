import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { MenuDiscount } from "./menu-combo.entity";

@Entity("menu_categories")
export class MenuCategory {
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

  @Column({ default: true })
  isPublic!: boolean;

  @Column({ nullable: true })
  parentId?: number;

  @ManyToOne(() => MenuCategory, (cat) => cat.children, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "parentId" })
  parent?: MenuCategory;

  @OneToMany(() => MenuCategory, (cat) => cat.parent, { eager: false })
  children!: MenuCategory[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("menu_items")
export class MenuItem {
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

  @Column({ nullable: true, type: "text" })
  ingredients_ru?: string;

  @Column({ nullable: true, type: "text" })
  ingredients_kz?: string;

  @Column({ nullable: true, type: "text" })
  ingredients_en?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column()
  photo!: string;

  @Column({ type: "text", array: true, default: "{}" })
  photos!: string[];

  @Column({ nullable: true })
  volume?: string;

  @Column({ nullable: true })
  weight?: string;

  @Column({ default: true })
  isAvailable!: boolean;

  @Column({ default: false })
  isNew!: boolean;

  @Column({ default: 0 })
  order!: number;

  @Column({ nullable: true })
  discountId?: number;

  @ManyToOne(() => MenuDiscount, { nullable: true, eager: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "discountId" })
  discount?: MenuDiscount;

  @ManyToOne(() => MenuCategory, { nullable: false, eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" })
  category!: MenuCategory;

  @Column()
  categoryId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("menu_item_reviews")
export class MenuItemReview {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  menuItemId!: number;

  @ManyToOne(() => MenuItem, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "menuItemId" })
  menuItem!: MenuItem;

  @Column({ type: "int" })
  rating!: number;

  @Column({ nullable: true, type: "text" })
  comment?: string;

  @Column({ default: true })
  isVisible!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
