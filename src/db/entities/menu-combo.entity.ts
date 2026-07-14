import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { MenuItem } from "./menu.entity";

@Entity("menu_discounts")
export class MenuDiscount {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "enum", enum: ["percent", "fixed"] })
  type!: "percent" | "fixed";

  @Column({ type: "decimal", precision: 10, scale: 2 })
  value!: number;

  @Column({ nullable: true })
  label_ru?: string;

  @Column({ nullable: true })
  label_kz?: string;

  @Column({ nullable: true })
  label_en?: string;

  @Column({ type: "date", nullable: true })
  validFrom?: string;

  @Column({ type: "date", nullable: true })
  validTo?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  comboId?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("menu_combos")
export class MenuCombo {
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

  @Column({ nullable: true })
  photo?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ default: true })
  isAvailable!: boolean;

  @Column({ default: 0 })
  order!: number;

  @OneToMany(() => MenuComboSlot, (slot) => slot.combo, { eager: true, cascade: true })
  slots!: MenuComboSlot[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("menu_combo_slots")
export class MenuComboSlot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  comboId!: number;

  @ManyToOne(() => MenuCombo, (combo) => combo.slots, { onDelete: "CASCADE" })
  @JoinColumn({ name: "comboId" })
  combo!: MenuCombo;

  @Column()
  name_ru!: string;

  @Column()
  name_kz!: string;

  @Column({ nullable: true })
  name_en?: string;

  @Column({ type: "int", default: 1 })
  quantity!: number;

  @Column({ default: 0 })
  order!: number;

  @OneToMany(() => MenuComboSlotOption, (opt) => opt.slot, { eager: true, cascade: true })
  options!: MenuComboSlotOption[];
}

@Entity("menu_combo_slot_options")
export class MenuComboSlotOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  slotId!: number;

  @ManyToOne(() => MenuComboSlot, (slot) => slot.options, { onDelete: "CASCADE" })
  @JoinColumn({ name: "slotId" })
  slot!: MenuComboSlot;

  @Column()
  menuItemId!: number;

  @ManyToOne(() => MenuItem, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "menuItemId" })
  menuItem!: MenuItem;
}
