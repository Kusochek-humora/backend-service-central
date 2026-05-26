import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  EDITOR = "editor",
  CHIEF_EDITOR = "chief_editor",
}

export enum Section {
  FAQ = "faq",
  EVENTS = "events",
  BLOG = "blog",
  MENU = "menu",
  MENU_CATEGORIES = "menu_categories",
  TOURS = "tours",
  MERCH = "merch",
  CATEGORIES = "categories",
  FILES = "files",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  username!: string;

  @Column()
  password!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.EDITOR })
  role!: UserRole;

  @Column({ type: "text", array: true, default: "{}" })
  permissions!: Section[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
