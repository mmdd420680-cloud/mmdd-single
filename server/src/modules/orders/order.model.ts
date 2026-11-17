import mongoose, { Schema, type Document } from 'mongoose';
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from '../../../../src/lib/orderStateMachine';

export interface IOrderItemSnapshot {
  productId: mongoose.Types.ObjectId;
  variantId?: string | null;
  sku: string;
  name: string;
  slug: string;
  imageUrl: string;
  variantOptions?: Record<string, string>;
  quantity: number;
  unitPrice: number;
  originalPrice?: number | null;
  lineTotal: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: IOrderItemSnapshot[];
  shippingAddress: {
    recipientName: string;
    email?: string;
    phone: string;
    division: string;
    district: string;
    upazila: string;
    area: string;
    house: string;
    road?: string;
    landmark?: string;
    postalCode?: string;
    deliveryInstructions?: string;
  };
  deliveryMethod: 'standard' | 'express';
  deliveryOptionCode?: string;
  deliveryMethodName?: string;
  deliveryEta?: string;
  shippingZone: string;
  couponCode?: string | null;
  subtotal: number;
  discount: number;
  shippingCharge: number;
  tax: number;
  total: number;
  paymentMethod: 'cod' | 'sslcommerz' | 'bkash' | 'nagad' | 'card';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  courierName?: string;
  trackingNumber?: string;
  cancellationReason?: string;
  idempotencyKey?: string;
  deliveredAt?: Date;
  statusHistory: Array<{
    fromStatus?: string;
    toStatus: string;
    actorId?: mongoose.Types.ObjectId | null;
    actorName: string;
    reason?: string;
    timestamp: Date;
  }>;
  staffNotes: Array<{
    note: string;
    actorName: string;
    timestamp: Date;
  }>;
  cancellationRequest?: {
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    message?: string;
    requestedBy?: mongoose.Types.ObjectId | null;
    requestedAt: Date;
    reviewedBy?: mongoose.Types.ObjectId | null;
    reviewedByName?: string;
    reviewedAt?: Date | null;
    adminNotes?: string;
  } | null;
  cancellationHistory: Array<{
    action: 'direct_cancel' | 'requested' | 'approved' | 'rejected';
    actorId?: mongoose.Types.ObjectId | null;
    actorName: string;
    reason?: string;
    message?: string;
    adminNotes?: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          variantId: { type: String, default: null },
          sku: { type: String, required: true },
          name: { type: String, required: true },
          slug: { type: String, required: true },
          imageUrl: { type: String, default: '' },
          variantOptions: { type: Map, of: String, default: {} },
          quantity: { type: Number, required: true, min: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
          originalPrice: { type: Number, default: null },
          lineTotal: { type: Number, required: true, min: 0 },
        },
      ],
      required: true,
    },
    shippingAddress: {
      recipientName: { type: String, required: true },
      email: { type: String },
      phone: { type: String, required: true },
      division: { type: String, required: true },
      district: { type: String, required: true },
      upazila: { type: String, required: true },
      area: { type: String, required: true },
      house: { type: String, required: true },
      road: { type: String },
      landmark: { type: String },
      postalCode: { type: String },
      deliveryInstructions: { type: String },
    },
    deliveryMethod: { type: String, enum: ['standard', 'express'], default: 'standard' },
    deliveryOptionCode: { type: String, default: 'standard' },
    deliveryMethodName: { type: String, default: 'Standard Delivery' },
    deliveryEta: { type: String, default: 'Within 2–5 Business Days' },
    shippingZone: { type: String, default: 'nationwide' },
    couponCode: { type: String, default: null },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['cod', 'sslcommerz', 'bkash', 'nagad', 'card'], required: true },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refund_pending', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
      default: 'pending',
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ['unfulfilled', 'packing', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'unfulfilled',
    },
    courierName: { type: String },
    trackingNumber: { type: String },
    cancellationReason: { type: String },
    idempotencyKey: { type: String, unique: true, sparse: true },
    deliveredAt: { type: Date },
    statusHistory: {
      type: [
        {
          fromStatus: { type: String },
          toStatus: { type: String, required: true },
          actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          actorName: { type: String, required: true },
          reason: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    staffNotes: {
      type: [
        {
          note: { type: String, required: true },
          actorName: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    cancellationRequest: {
      type: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
        reason: { type: String, required: true, trim: true, maxlength: 240 },
        message: { type: String, trim: true, maxlength: 600, default: '' },
        requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        requestedAt: { type: Date, default: Date.now },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedByName: { type: String, trim: true, maxlength: 100 },
        reviewedAt: { type: Date, default: null },
        adminNotes: { type: String, trim: true, maxlength: 500, default: '' },
      },
      default: null,
    },
    cancellationHistory: {
      type: [
        {
          action: { type: String, enum: ['direct_cancel', 'requested', 'approved', 'rejected'], required: true },
          actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          actorName: { type: String, required: true },
          reason: { type: String, trim: true, maxlength: 240 },
          message: { type: String, trim: true, maxlength: 600 },
          adminNotes: { type: String, trim: true, maxlength: 500 },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const OrderModel = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export interface IPaymentTransaction extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  provider: string;
  transactionId: string;
  gatewayValidationId?: string;
  bankTransactionId?: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'paid' | 'failed' | 'cancelled' | 'refund_pending' | 'refunded';
  refundedAmount: number;
  verifiedAt?: Date;
  rawPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    transactionId: { type: String, required: true, unique: true, index: true },
    gatewayValidationId: { type: String },
    bankTransactionId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    status: {
      type: String,
      enum: ['initiated', 'paid', 'failed', 'cancelled', 'refund_pending', 'refunded'],
      default: 'initiated',
      index: true,
    },
    refundedAmount: { type: Number, default: 0 },
    verifiedAt: { type: Date },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const PaymentTransactionModel =
  mongoose.models.PaymentTransaction || mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
