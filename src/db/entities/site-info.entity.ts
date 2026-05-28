import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("site_info")
export class SiteInfo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  address_ru?: string;

  @Column({ nullable: true })
  address_kz?: string;

  @Column({ nullable: true })
  address_en?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true, type: "text" })
  work_hours?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("social_links")
export class SocialLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  type!: string;

  @Column()
  url!: string;

  @Column({ nullable: true })
  label?: string;

  @Column({ nullable: true, type: "text" })
  icon?: string;

  @Column({ default: 0 })
  order!: number;
}

@Entity("email_links")
export class EmailLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  type!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  label?: string;

  @Column({ nullable: true, type: "text" })
  icon?: string;

  @Column({ default: 0 })
  order!: number;
}
