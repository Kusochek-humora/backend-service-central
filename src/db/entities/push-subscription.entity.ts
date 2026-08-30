import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("push_subscriptions")
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  endpoint!: string;

  @Column("json")
  keys!: { p256dh: string; auth: string };

  @Column({ nullable: true })
  lang?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
