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

  @Column({ nullable: true, type: "int" })
  discount?: number;

  @Column({ default: 0 })
  order!: number;

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
